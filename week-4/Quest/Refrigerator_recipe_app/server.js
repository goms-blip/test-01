try { require('dotenv').config({ path: require('path').join(__dirname, '.env') }); } catch (_) { /* optional */ }

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 4326;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const connectionString = (process.env.DATABASE_URL || '').trim();
const pool = connectionString
  ? new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host: 'aws-1-us-east-1.pooler.supabase.com',
      port: 6543,
      user: 'postgres.fyeooefvtacfmwxdmevi',
      password: 'iDnFZJ,hV?/zvg6',
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    });

const DIFFICULTIES = ['쉬움', '보통', '어려움'];
const THEMES = ['간단', '다이어트', '야식', '술안주', '기타'];

let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.ingredients_app (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      quantity    TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.recipes_app (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title            TEXT NOT NULL,
      content          TEXT,
      ingredients_used TEXT[] NOT NULL DEFAULT '{}',
      difficulty       TEXT,
      cooking_time     INT,
      category         TEXT,
      is_favorite      BOOLEAN NOT NULL DEFAULT FALSE,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  dbInitialized = true;
}

app.use('/api', async (_req, res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error('initDB error:', err);
    res.status(500).json({ success: false, message: 'Database initialization failed' });
  }
});

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function parseIntId(raw) {
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// =================== Ingredients ===================

app.get('/api/ingredients', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const result = q
      ? await pool.query(
          `SELECT id, name, quantity, created_at FROM public.ingredients_app
            WHERE name ILIKE $1 ORDER BY created_at DESC`,
          [`%${q}%`]
        )
      : await pool.query(
          `SELECT id, name, quantity, created_at FROM public.ingredients_app
            ORDER BY created_at DESC`
        );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /api/ingredients error:', err);
    res.status(500).json({ success: false, message: 'Failed to list ingredients' });
  }
});

app.post('/api/ingredients', async (req, res) => {
  try {
    const { name, quantity } = req.body || {};
    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    const safeQuantity = (typeof quantity === 'string' && quantity.trim() !== '') ? quantity.trim() : null;
    const result = await pool.query(
      `INSERT INTO public.ingredients_app (name, quantity) VALUES ($1, $2)
         RETURNING id, name, quantity, created_at`,
      [name.trim(), safeQuantity]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /api/ingredients error:', err);
    res.status(500).json({ success: false, message: 'Failed to create ingredient' });
  }
});

app.delete('/api/ingredients/:id', async (req, res) => {
  try {
    const id = parseIntId(req.params.id);
    if (id === null) return res.status(400).json({ success: false, message: 'Invalid id' });
    const result = await pool.query(
      `DELETE FROM public.ingredients_app WHERE id = $1
         RETURNING id, name, quantity, created_at`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Ingredient not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('DELETE /api/ingredients/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete ingredient' });
  }
});

// =================== AI Recipe Generation ===================

let openaiClient = null;
function getOpenAI() {
  if (openaiClient) return openaiClient;
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY_NOT_SET');
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

const THEME_GUIDES = {
  '간단': '빠르고 간편하게, 조리 단계 최소화. 15분 이내.',
  '다이어트': '저칼로리/고단백, 기름 최소화, 건강한 조리법.',
  '야식': '밤에 가볍게 먹을 만한 맵거나 짭조름한 요리.',
  '술안주': '술과 어울리는 짭짤/기름진 요리.',
  '기타': '특정 테마 없이 재료를 잘 활용할 수 있는 요리.',
};

const AI_SYSTEM_PROMPT = `당신은 집밥 요리 전문가입니다. 사용자의 냉장고 재료와 선택된 테마를 반영해 1인분 레시피를 1개 추천하세요.

반드시 아래 JSON만 반환하세요 (추가 설명 금지):
{
  "title": "요리명",
  "content": "1. 첫 단계\\n2. 두 번째 단계\\n...",
  "ingredients_used": ["재료1", "재료2", ...],
  "difficulty": "쉬움" | "보통" | "어려움",
  "cooking_time": 15,
  "category": "간단" | "다이어트" | "야식" | "술안주" | "기타"
}

규칙:
- ingredients_used는 사용자 냉장고에 실제 있는 재료 위주로 구성. 기본 양념(소금/후추/간장/설탕/식용유/참기름)은 있다고 가정해도 됨.
- difficulty는 반드시 ["쉬움","보통","어려움"] 중 하나.
- cooking_time은 정수(분 단위).
- category는 사용자가 지정한 테마를 그대로 반영. 테마가 "기타"(any)면 가장 적합한 것을 선택.
- content는 번호 매긴 단계들을 \\n으로 구분.`;

app.post('/api/recipes/generate', async (req, res) => {
  try {
    const themeRaw = typeof req.body?.theme === 'string' ? req.body.theme : '기타';
    const theme = THEMES.includes(themeRaw) ? themeRaw : '기타';

    const ing = await pool.query(
      `SELECT name, quantity FROM public.ingredients_app ORDER BY created_at DESC LIMIT 30`
    );
    if (ing.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: '냉장고에 재료가 없습니다. 먼저 재료를 등록해 주세요.',
      });
    }

    const ingredientLines = ing.rows.map(r => {
      let line = `- ${r.name}`;
      if (r.quantity) line += ` (${r.quantity})`;
      return line;
    });

    const userMessage = `냉장고 재료:\n${ingredientLines.join('\n')}\n\n선택한 테마: ${theme} — ${THEME_GUIDES[theme]}\n\n위 재료와 테마를 반영해 JSON 레시피 1개를 생성하세요.`;

    const client = getOpenAI();
    const aiResponse = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const text = (aiResponse.choices?.[0]?.message?.content || '').trim();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      return res.status(500).json({ success: false, message: 'AI 응답 파싱 실패', raw: text });
    }

    // Normalize
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    const content = typeof parsed.content === 'string' ? parsed.content : '';
    const ingredients_used = Array.isArray(parsed.ingredients_used)
      ? parsed.ingredients_used.map(x => String(x).trim()).filter(Boolean)
      : [];
    const difficulty = DIFFICULTIES.includes(parsed.difficulty) ? parsed.difficulty : '보통';
    const cooking_time = Number.isFinite(Number(parsed.cooking_time))
      ? Math.max(1, Math.round(Number(parsed.cooking_time)))
      : null;
    const category = THEMES.includes(parsed.category) ? parsed.category : theme;

    res.json({
      success: true,
      data: {
        title,
        content,
        ingredients_used,
        difficulty,
        cooking_time,
        category,
        source_ingredients: ing.rows.map(r => r.name),
        theme_requested: theme,
      },
    });
  } catch (err) {
    console.error('POST /api/recipes/generate error:', err);
    if (err.message === 'OPENAI_API_KEY_NOT_SET') {
      return res.status(503).json({
        success: false,
        message: 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다.',
      });
    }
    res.status(500).json({ success: false, message: 'AI 레시피 생성에 실패했습니다: ' + (err.message || '') });
  }
});

// =================== Recipes CRUD ===================

app.get('/api/recipes', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const maxTime = req.query.max_cooking_time !== undefined ? Number(req.query.max_cooking_time) : null;
    const favOnly = req.query.is_favorite === 'true' || req.query.is_favorite === '1';

    const clauses = [];
    const values = [];
    if (q) { values.push(`%${q}%`); clauses.push(`(title ILIKE $${values.length} OR EXISTS (SELECT 1 FROM unnest(ingredients_used) AS u WHERE u ILIKE $${values.length}))`); }
    if (difficulty && DIFFICULTIES.includes(difficulty)) { values.push(difficulty); clauses.push(`difficulty = $${values.length}`); }
    if (category && THEMES.includes(category)) { values.push(category); clauses.push(`category = $${values.length}`); }
    if (Number.isFinite(maxTime) && maxTime > 0) { values.push(maxTime); clauses.push(`cooking_time IS NOT NULL AND cooking_time <= $${values.length}`); }
    if (favOnly) { clauses.push(`is_favorite = TRUE`); }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT id, title, content, ingredients_used, difficulty, cooking_time, category, is_favorite, created_at
         FROM public.recipes_app ${where} ORDER BY is_favorite DESC, created_at DESC`,
      values
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /api/recipes error:', err);
    res.status(500).json({ success: false, message: 'Failed to list recipes' });
  }
});

app.get('/api/recipes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const result = await pool.query(
      `SELECT id, title, content, ingredients_used, difficulty, cooking_time, category, is_favorite, created_at
         FROM public.recipes_app WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Recipe not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('GET /api/recipes/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch recipe' });
  }
});

app.post('/api/recipes', async (req, res) => {
  try {
    const { title, content, ingredients_used, difficulty, cooking_time, category, is_favorite } = req.body || {};
    if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'title is required' });
    }
    if (difficulty !== undefined && difficulty !== null && difficulty !== '' && !DIFFICULTIES.includes(difficulty)) {
      return res.status(400).json({ success: false, message: `difficulty must be one of: ${DIFFICULTIES.join(', ')}` });
    }
    if (category !== undefined && category !== null && category !== '' && !THEMES.includes(category)) {
      return res.status(400).json({ success: false, message: `category must be one of: ${THEMES.join(', ')}` });
    }
    const safeIngs = Array.isArray(ingredients_used)
      ? ingredients_used.map(x => String(x).trim()).filter(Boolean) : [];
    const safeTime = Number.isFinite(Number(cooking_time)) ? Math.max(1, Math.round(Number(cooking_time))) : null;

    const result = await pool.query(
      `INSERT INTO public.recipes_app (title, content, ingredients_used, difficulty, cooking_time, category, is_favorite)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, title, content, ingredients_used, difficulty, cooking_time, category, is_favorite, created_at`,
      [title.trim(), content || null, safeIngs, difficulty || null, safeTime, category || null, !!is_favorite]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /api/recipes error:', err);
    res.status(500).json({ success: false, message: 'Failed to create recipe' });
  }
});

app.patch('/api/recipes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const { title, content, ingredients_used, difficulty, cooking_time, category, is_favorite } = req.body || {};

    const sets = [];
    const values = [];

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ success: false, message: 'title must be non-empty' });
      }
      values.push(title.trim()); sets.push(`title = $${values.length}`);
    }
    if (content !== undefined) { values.push(typeof content === 'string' ? content : null); sets.push(`content = $${values.length}`); }
    if (ingredients_used !== undefined) {
      if (!Array.isArray(ingredients_used)) return res.status(400).json({ success: false, message: 'ingredients_used must be an array' });
      values.push(ingredients_used.map(x => String(x).trim()).filter(Boolean));
      sets.push(`ingredients_used = $${values.length}`);
    }
    if (difficulty !== undefined) {
      if (difficulty !== null && !DIFFICULTIES.includes(difficulty)) {
        return res.status(400).json({ success: false, message: `difficulty must be one of: ${DIFFICULTIES.join(', ')}` });
      }
      values.push(difficulty); sets.push(`difficulty = $${values.length}`);
    }
    if (cooking_time !== undefined) {
      const t = cooking_time === null ? null : (Number.isFinite(Number(cooking_time)) ? Math.max(1, Math.round(Number(cooking_time))) : null);
      values.push(t); sets.push(`cooking_time = $${values.length}`);
    }
    if (category !== undefined) {
      if (category !== null && !THEMES.includes(category)) {
        return res.status(400).json({ success: false, message: `category must be one of: ${THEMES.join(', ')}` });
      }
      values.push(category); sets.push(`category = $${values.length}`);
    }
    if (is_favorite !== undefined) { values.push(!!is_favorite); sets.push(`is_favorite = $${values.length}`); }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, message: 'No updatable fields provided' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE public.recipes_app SET ${sets.join(', ')} WHERE id = $${values.length}
         RETURNING id, title, content, ingredients_used, difficulty, cooking_time, category, is_favorite, created_at`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Recipe not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PATCH /api/recipes/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to update recipe' });
  }
});

app.delete('/api/recipes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const result = await pool.query(
      `DELETE FROM public.recipes_app WHERE id = $1
         RETURNING id, title, content, ingredients_used, difficulty, cooking_time, category, is_favorite, created_at`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Recipe not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('DELETE /api/recipes/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete recipe' });
  }
});

// SPA fallback (Express 5)
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'), (err) => {
    if (err) res.status(404).json({ success: false, message: 'Not found' });
  });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Refri-AI-App server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
