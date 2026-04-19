try { require('dotenv').config({ path: require('path').join(__dirname, '.env') }); } catch (_) { /* optional */ }

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 4325;

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

const CATEGORIES = ['육류', '채소', '유제품', '곡물', '조미료', '기타'];

let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.ingredients (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      category    TEXT,
      expiry_date DATE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.recipes (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title       TEXT NOT NULL,
      ingredients TEXT[] NOT NULL DEFAULT '{}',
      steps       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

// =================== Ingredients ===================

// GET /api/ingredients?q=&category=
app.get('/api/ingredients', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const clauses = [];
    const values = [];
    if (q) { values.push(`%${q}%`); clauses.push(`name ILIKE $${values.length}`); }
    if (category) { values.push(category); clauses.push(`category = $${values.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT id, name, category, expiry_date, created_at
         FROM public.ingredients
         ${where}
         ORDER BY
           CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
           expiry_date ASC,
           created_at DESC`,
      values
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /api/ingredients error:', err);
    res.status(500).json({ success: false, message: 'Failed to list ingredients' });
  }
});

// POST /api/ingredients { name, category?, expiry_date? }
app.post('/api/ingredients', async (req, res) => {
  try {
    const { name, category, expiry_date } = req.body || {};
    if (typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    if (category !== undefined && category !== null && category !== '' && !CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `category must be one of: ${CATEGORIES.join(', ')}`,
      });
    }
    const safeCategory = category || null;
    const safeExpiry = (typeof expiry_date === 'string' && expiry_date.trim() !== '') ? expiry_date : null;

    const result = await pool.query(
      `INSERT INTO public.ingredients (name, category, expiry_date)
            VALUES ($1, $2, $3)
         RETURNING id, name, category, expiry_date, created_at`,
      [name.trim(), safeCategory, safeExpiry]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /api/ingredients error:', err);
    res.status(500).json({ success: false, message: 'Failed to create ingredient' });
  }
});

// DELETE /api/ingredients/:id
app.delete('/api/ingredients/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const result = await pool.query(
      `DELETE FROM public.ingredients WHERE id = $1
         RETURNING id, name, category, expiry_date, created_at`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Ingredient not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('DELETE /api/ingredients/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete ingredient' });
  }
});

// =================== Recipes ===================

// GET /api/recipes?q=
app.get('/api/recipes', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const result = q
      ? await pool.query(
          `SELECT id, title, ingredients, steps, created_at
             FROM public.recipes
            WHERE title ILIKE $1
               OR EXISTS (
                 SELECT 1 FROM unnest(ingredients) AS ing WHERE ing ILIKE $1
               )
            ORDER BY created_at DESC`,
          [`%${q}%`]
        )
      : await pool.query(
          `SELECT id, title, ingredients, steps, created_at
             FROM public.recipes
            ORDER BY created_at DESC`
        );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /api/recipes error:', err);
    res.status(500).json({ success: false, message: 'Failed to list recipes' });
  }
});

// GET /api/recipes/:id — detail
app.get('/api/recipes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const result = await pool.query(
      `SELECT id, title, ingredients, steps, created_at
         FROM public.recipes
        WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Recipe not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('GET /api/recipes/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch recipe' });
  }
});

// PATCH /api/recipes/:id — partial update on title, ingredients, or steps.
app.patch('/api/recipes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const { title, ingredients, steps } = req.body || {};
    const sets = [];
    const values = [];

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'title must be a non-empty string when provided',
        });
      }
      values.push(title.trim());
      sets.push(`title = $${values.length}`);
    }
    if (ingredients !== undefined) {
      if (!Array.isArray(ingredients)) {
        return res.status(400).json({
          success: false,
          message: 'ingredients must be an array of strings',
        });
      }
      const safe = ingredients.map(x => String(x).trim()).filter(Boolean);
      values.push(safe);
      sets.push(`ingredients = $${values.length}`);
    }
    if (steps !== undefined) {
      values.push(typeof steps === 'string' ? steps : null);
      sets.push(`steps = $${values.length}`);
    }

    if (sets.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one of title, ingredients, or steps must be provided',
      });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE public.recipes
          SET ${sets.join(', ')}
        WHERE id = $${values.length}
        RETURNING id, title, ingredients, steps, created_at`,
      values
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Recipe not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('PATCH /api/recipes/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to update recipe' });
  }
});

// POST /api/recipes { title, ingredients: string[], steps }
app.post('/api/recipes', async (req, res) => {
  try {
    const { title, ingredients, steps } = req.body || {};
    if (typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'title is required' });
    }
    const safeIngredients = Array.isArray(ingredients)
      ? ingredients.map(x => String(x)).map(s => s.trim()).filter(Boolean)
      : [];
    const safeSteps = typeof steps === 'string' ? steps : null;

    const result = await pool.query(
      `INSERT INTO public.recipes (title, ingredients, steps)
            VALUES ($1, $2, $3)
         RETURNING id, title, ingredients, steps, created_at`,
      [title.trim(), safeIngredients, safeSteps]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /api/recipes error:', err);
    res.status(500).json({ success: false, message: 'Failed to create recipe' });
  }
});

// DELETE /api/recipes/:id
app.delete('/api/recipes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const result = await pool.query(
      `DELETE FROM public.recipes WHERE id = $1
         RETURNING id, title, ingredients, steps, created_at`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Recipe not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('DELETE /api/recipes/:id error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete recipe' });
  }
});

// =================== AI Recipe Suggestion ===================

let openaiClient = null;
function getOpenAI() {
  if (openaiClient) return openaiClient;
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY_NOT_SET');
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

const AI_SYSTEM_PROMPT = `당신은 가정 요리 전문가입니다. 사용자가 제공한 냉장고 재료를 기반으로 1인분 기준, 15분 이내 조리 가능한 자취생 난이도의 레시피를 1개 추천하세요.

규칙:
- 유통기한이 임박한(D-day 가까운) 재료를 최우선으로 활용하세요.
- 기본 양념(소금/후추/설탕/간장/식용유/참기름/마늘)은 있다고 가정해도 됩니다.
- 사용자 냉장고에 없는 특별한 재료(고기 특정 부위 등)는 제안하지 마세요.

반드시 아래 JSON 형식만 반환하세요 (코드블록 없이, 설명 없이, 오직 JSON만):
{
  "title": "요리명",
  "ingredients": ["재료1", "재료2", "..."],
  "steps": "1. 첫 단계\\n2. 두 번째 단계\\n3. ..."
}`;

// POST /api/recipes/suggest — AI suggests a recipe from expiring ingredients.
app.post('/api/recipes/suggest', async (req, res) => {
  try {
    const daysWithin = Number.isFinite(Number(req.body?.days_within))
      ? Number(req.body.days_within)
      : 7;

    const expiring = await pool.query(
      `SELECT name, category, expiry_date
         FROM public.ingredients
        WHERE expiry_date IS NOT NULL
          AND expiry_date - CURRENT_DATE <= $1
        ORDER BY expiry_date ASC`,
      [daysWithin]
    );
    let sourceRows = expiring.rows;
    let usedFallback = false;
    if (sourceRows.length === 0) {
      const fallback = await pool.query(
        `SELECT name, category, expiry_date
           FROM public.ingredients
          ORDER BY
            CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
            expiry_date ASC,
            created_at DESC
          LIMIT 10`
      );
      sourceRows = fallback.rows;
      usedFallback = sourceRows.length > 0;
    }
    if (sourceRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: '냉장고에 등록된 재료가 없습니다. 먼저 재료를 추가해 주세요.',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ingredientLines = sourceRows.map((r) => {
      let line = `- ${r.name}`;
      if (r.category) line += ` (${r.category})`;
      if (r.expiry_date) {
        const e = new Date(r.expiry_date);
        e.setHours(0, 0, 0, 0);
        const diff = Math.round((e - today) / 86400000);
        if (diff < 0) line += ` [유통기한 ${-diff}일 경과]`;
        else if (diff === 0) line += ` [오늘까지]`;
        else line += ` [D-${diff}]`;
      }
      return line;
    });

    const userMessage = `다음 냉장고 재료로 추천 레시피를 1개 만들어주세요. JSON 형식으로만 응답하세요.\n\n${ingredientLines.join('\n')}`;

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
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'AI 응답을 JSON으로 파싱하지 못했습니다',
        raw: text,
      });
    }

    res.json({
      success: true,
      data: {
        title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
        ingredients: Array.isArray(parsed.ingredients)
          ? parsed.ingredients.map((x) => String(x).trim()).filter(Boolean)
          : [],
        steps: typeof parsed.steps === 'string' ? parsed.steps : '',
        source_ingredients: sourceRows.map((r) => r.name),
        used_fallback: usedFallback,
        days_within: daysWithin,
      },
    });
  } catch (err) {
    console.error('POST /api/recipes/suggest error:', err);
    if (err.message === 'OPENAI_API_KEY_NOT_SET') {
      return res.status(503).json({
        success: false,
        message: 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다. 서버 .env에 키를 추가해 주세요.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'AI 레시피 추천에 실패했습니다: ' + (err.message || 'unknown error'),
    });
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
    console.log(`Refri-Manager server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
