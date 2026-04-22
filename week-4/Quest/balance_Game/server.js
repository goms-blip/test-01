try { require('dotenv').config({ path: require('path').join(__dirname, '.env') }); } catch (_) { /* optional */ }

const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 4328;

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

const CATEGORIES = ['직장/연봉', '재테크/소비', '일상/음식', '연애/관계', '기타'];
const MAX_OPT_LEN = 160;

let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.mb_questions (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      option_a   TEXT NOT NULL,
      option_b   TEXT NOT NULL,
      category   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.mb_votes (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id UUID NOT NULL REFERENCES public.mb_questions(id) ON DELETE CASCADE,
      choice      CHAR(1) NOT NULL CHECK (choice IN ('A','B')),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS mb_questions_created_idx ON public.mb_questions (created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS mb_votes_question_idx    ON public.mb_votes (question_id);`);
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

const SELECT_WITH_COUNTS = `
  SELECT q.id,
         q.option_a,
         q.option_b,
         q.category,
         q.created_at,
         COALESCE(SUM(CASE WHEN v.choice = 'A' THEN 1 ELSE 0 END), 0)::int AS votes_a,
         COALESCE(SUM(CASE WHEN v.choice = 'B' THEN 1 ELSE 0 END), 0)::int AS votes_b,
         COALESCE(COUNT(v.id), 0)::int AS total_votes
  FROM public.mb_questions q
  LEFT JOIN public.mb_votes v ON v.question_id = q.id
`;

// GET /api/questions?sort=recent|popular&category=
app.get('/api/questions', async (req, res) => {
  try {
    const sort = req.query.sort === 'popular' ? 'popular' : 'recent';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const clauses = [];
    const values = [];
    if (category) {
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ success: false, message: '알 수 없는 카테고리' });
      }
      values.push(category);
      clauses.push(`q.category = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderBy = sort === 'popular'
      ? 'total_votes DESC, q.created_at DESC'
      : 'q.created_at DESC';
    const result = await pool.query(
      `${SELECT_WITH_COUNTS}
         ${where}
         GROUP BY q.id
         ORDER BY ${orderBy}
         LIMIT 200`,
      values
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('GET /api/questions error:', err);
    res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

// GET /api/questions/:id
app.get('/api/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: '잘못된 id' });
    const result = await pool.query(
      `${SELECT_WITH_COUNTS} WHERE q.id = $1 GROUP BY q.id`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: '질문을 찾을 수 없어요' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('GET /api/questions/:id error:', err);
    res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

// POST /api/questions { option_a, option_b, category }
app.post('/api/questions', async (req, res) => {
  try {
    const { option_a, option_b, category } = req.body || {};
    const a = typeof option_a === 'string' ? option_a.trim() : '';
    const b = typeof option_b === 'string' ? option_b.trim() : '';
    const cat = typeof category === 'string' ? category.trim() : '';

    if (!a || !b) return res.status(400).json({ success: false, message: '두 선택지를 모두 입력해주세요' });
    if (a.length > MAX_OPT_LEN || b.length > MAX_OPT_LEN) {
      return res.status(400).json({ success: false, message: `선택지는 ${MAX_OPT_LEN}자 이하로 작성해주세요` });
    }
    if (!CATEGORIES.includes(cat)) {
      return res.status(400).json({ success: false, message: '카테고리를 선택해주세요' });
    }

    const insert = await pool.query(
      `INSERT INTO public.mb_questions (option_a, option_b, category)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [a, b, cat]
    );
    const id = insert.rows[0].id;
    const full = await pool.query(
      `${SELECT_WITH_COUNTS} WHERE q.id = $1 GROUP BY q.id`,
      [id]
    );
    res.status(201).json({ success: true, data: full.rows[0] });
  } catch (err) {
    console.error('POST /api/questions error:', err);
    res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

// POST /api/questions/:id/vote { choice: 'A' | 'B' }
app.post('/api/questions/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: '잘못된 id' });
    const choice = String((req.body && req.body.choice) || '').toUpperCase();
    if (choice !== 'A' && choice !== 'B') {
      return res.status(400).json({ success: false, message: 'choice는 A 또는 B 여야 해요' });
    }

    const exists = await pool.query(`SELECT 1 FROM public.mb_questions WHERE id = $1`, [id]);
    if (exists.rowCount === 0) {
      return res.status(404).json({ success: false, message: '질문을 찾을 수 없어요' });
    }

    await pool.query(
      `INSERT INTO public.mb_votes (question_id, choice) VALUES ($1, $2)`,
      [id, choice]
    );
    const full = await pool.query(
      `${SELECT_WITH_COUNTS} WHERE q.id = $1 GROUP BY q.id`,
      [id]
    );
    res.status(201).json({ success: true, data: full.rows[0] });
  } catch (err) {
    console.error('POST /api/questions/:id/vote error:', err);
    res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

// DELETE /api/questions/:id
app.delete('/api/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: '잘못된 id' });
    const result = await pool.query(`DELETE FROM public.mb_questions WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: '질문을 찾을 수 없어요' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/questions/:id error:', err);
    res.status(500).json({ success: false, message: err.message || 'DB error' });
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
    console.log(`Money-Balance server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
