try { require('dotenv').config({ path: require('path').join(__dirname, '.env') }); } catch (_) { /* optional */ }

const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

let OpenAI = null;
try { OpenAI = require('openai'); } catch (_) { OpenAI = null; }

const app = express();
const PORT = process.env.PORT || 4330;

app.use(express.json({ limit: '1mb' }));
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

// ====================================================================
// Shared
// ====================================================================
function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}
function toInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

// ====================================================================
// DB initialisation — runs once on first /api request
// ====================================================================
let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // Anonymous board
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.posts (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category   TEXT NOT NULL,
      content    TEXT NOT NULL,
      likes      BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS posts_created_at_idx ON public.posts (created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS posts_likes_idx      ON public.posts (likes DESC);`);

  // Money balance
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

  // Salary stats
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.salary_stats (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      monthly_income     BIGINT NOT NULL,
      monthly_expenses   BIGINT NOT NULL,
      job_category       TEXT   NOT NULL,
      experience_years   INT    NOT NULL,
      category_expenses  JSONB  NOT NULL DEFAULT '{}'::jsonb
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS salary_stats_created_at_idx ON public.salary_stats (created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS salary_stats_job_idx        ON public.salary_stats (job_category);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS salary_stats_exp_idx        ON public.salary_stats (experience_years);`);

  // Refrigerator manager (UUID ingredients + recipes)
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

  // Refrigerator AI app (serial ingredients + recipes_app)
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

// ====================================================================
// 1) Anonymous board  (/api/board/...)
// ====================================================================
const BOARD_CATEGORIES = ['고민', '칭찬', '응원', '기타'];
const BOARD_MAX_LEN = 2000;

app.get('/api/board/posts', async (req, res) => {
  try {
    const sort = req.query.sort === 'likes' ? 'likes' : 'recent';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const clauses = [], values = [];
    if (category) {
      if (!BOARD_CATEGORIES.includes(category)) return res.status(400).json({ success: false, message: '알 수 없는 카테고리' });
      values.push(category); clauses.push(`category = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderBy = sort === 'likes' ? 'likes DESC, created_at DESC' : 'created_at DESC';
    const result = await pool.query(
      `SELECT id, category, content, likes, created_at FROM public.posts ${where} ORDER BY ${orderBy} LIMIT 200`,
      values
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err); res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

app.post('/api/board/posts', async (req, res) => {
  try {
    const { category, content } = req.body || {};
    const cat = typeof category === 'string' ? category.trim() : '';
    const body = typeof content === 'string' ? content.trim() : '';
    if (!BOARD_CATEGORIES.includes(cat)) return res.status(400).json({ success: false, message: '카테고리를 선택해주세요' });
    if (!body) return res.status(400).json({ success: false, message: '내용을 입력해주세요' });
    if (body.length > BOARD_MAX_LEN) return res.status(400).json({ success: false, message: `내용은 ${BOARD_MAX_LEN}자 이하` });
    const result = await pool.query(
      `INSERT INTO public.posts (category, content) VALUES ($1, $2)
         RETURNING id, category, content, likes, created_at`,
      [cat, body]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err); res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

app.post('/api/board/posts/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: '잘못된 id' });
    const result = await pool.query(
      `UPDATE public.posts SET likes = likes + 1 WHERE id = $1
         RETURNING id, category, content, likes, created_at`,
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없어요' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err); res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

app.delete('/api/board/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: '잘못된 id' });
    const result = await pool.query(`DELETE FROM public.posts WHERE id = $1`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: '게시글을 찾을 수 없어요' });
    res.json({ success: true });
  } catch (err) {
    console.error(err); res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

app.get('/api/board/meta', (_req, res) => {
  res.json({ success: true, data: { categories: BOARD_CATEGORIES, max_len: BOARD_MAX_LEN } });
});

// ====================================================================
// 2) Money Balance  (/api/balance/...)
// ====================================================================
const MB_CATEGORIES = ['직장/연봉', '재테크/소비', '일상/음식', '연애/관계', '기타'];
const MB_MAX_OPT_LEN = 160;

const MB_SELECT = `
  SELECT q.id, q.option_a, q.option_b, q.category, q.created_at,
         COALESCE(SUM(CASE WHEN v.choice = 'A' THEN 1 ELSE 0 END), 0)::int AS votes_a,
         COALESCE(SUM(CASE WHEN v.choice = 'B' THEN 1 ELSE 0 END), 0)::int AS votes_b,
         COALESCE(COUNT(v.id), 0)::int AS total_votes
    FROM public.mb_questions q
    LEFT JOIN public.mb_votes v ON v.question_id = q.id
`;

app.get('/api/balance/questions', async (req, res) => {
  try {
    const sort = req.query.sort === 'popular' ? 'popular' : 'recent';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const clauses = [], values = [];
    if (category) {
      if (!MB_CATEGORIES.includes(category)) return res.status(400).json({ success: false, message: '알 수 없는 카테고리' });
      values.push(category); clauses.push(`q.category = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const orderBy = sort === 'popular' ? 'total_votes DESC, q.created_at DESC' : 'q.created_at DESC';
    const result = await pool.query(
      `${MB_SELECT} ${where} GROUP BY q.id ORDER BY ${orderBy} LIMIT 200`,
      values
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message || 'DB error' }); }
});

app.get('/api/balance/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: '잘못된 id' });
    const result = await pool.query(`${MB_SELECT} WHERE q.id = $1 GROUP BY q.id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: '질문을 찾을 수 없어요' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message || 'DB error' }); }
});

app.post('/api/balance/questions', async (req, res) => {
  try {
    const { option_a, option_b, category } = req.body || {};
    const a = typeof option_a === 'string' ? option_a.trim() : '';
    const b = typeof option_b === 'string' ? option_b.trim() : '';
    const cat = typeof category === 'string' ? category.trim() : '';
    if (!a || !b) return res.status(400).json({ success: false, message: '두 선택지를 모두 입력해주세요' });
    if (a.length > MB_MAX_OPT_LEN || b.length > MB_MAX_OPT_LEN) {
      return res.status(400).json({ success: false, message: `선택지는 ${MB_MAX_OPT_LEN}자 이하` });
    }
    if (!MB_CATEGORIES.includes(cat)) return res.status(400).json({ success: false, message: '카테고리를 선택해주세요' });

    const insert = await pool.query(
      `INSERT INTO public.mb_questions (option_a, option_b, category) VALUES ($1, $2, $3) RETURNING id`,
      [a, b, cat]
    );
    const id = insert.rows[0].id;
    const full = await pool.query(`${MB_SELECT} WHERE q.id = $1 GROUP BY q.id`, [id]);
    res.status(201).json({ success: true, data: full.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message || 'DB error' }); }
});

app.post('/api/balance/questions/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: '잘못된 id' });
    const choice = String((req.body && req.body.choice) || '').toUpperCase();
    if (choice !== 'A' && choice !== 'B') return res.status(400).json({ success: false, message: 'choice는 A 또는 B' });
    const exists = await pool.query(`SELECT 1 FROM public.mb_questions WHERE id = $1`, [id]);
    if (exists.rowCount === 0) return res.status(404).json({ success: false, message: '질문을 찾을 수 없어요' });
    await pool.query(`INSERT INTO public.mb_votes (question_id, choice) VALUES ($1, $2)`, [id, choice]);
    const full = await pool.query(`${MB_SELECT} WHERE q.id = $1 GROUP BY q.id`, [id]);
    res.status(201).json({ success: true, data: full.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message || 'DB error' }); }
});

app.delete('/api/balance/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: '잘못된 id' });
    const result = await pool.query(`DELETE FROM public.mb_questions WHERE id = $1`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: '질문을 찾을 수 없어요' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message || 'DB error' }); }
});

app.get('/api/balance/meta', (_req, res) => {
  res.json({ success: true, data: { categories: MB_CATEGORIES, max_option_len: MB_MAX_OPT_LEN } });
});

// ====================================================================
// 3) Salary comparison  (/api/salary/...)
// ====================================================================
const JOB_CATEGORIES = ['개발', '디자인', '기획', '마케팅', '영업', '운영', 'HR', '기타'];
const EXPENSE_KEYS = ['food', 'housing', 'transport', 'subscription', 'leisure', 'etc'];
const EXPENSE_LABELS = { food: '식비', housing: '주거비', transport: '교통비', subscription: '구독료', leisure: '여가/문화', etc: '기타' };

function sanitizeCategoryExpenses(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const k of EXPENSE_KEYS) {
    const n = toInt(input[k]);
    if (n !== null && n >= 0) out[k] = n;
  }
  return out;
}

app.post('/api/salary', async (req, res) => {
  try {
    const { monthly_income, monthly_expenses, job_category, experience_years, category_expenses } = req.body || {};
    const income = toInt(monthly_income);
    const expenses = toInt(monthly_expenses);
    const years = toInt(experience_years);
    const job = typeof job_category === 'string' ? job_category.trim() : '';
    const catExp = sanitizeCategoryExpenses(category_expenses);

    if (income === null || income < 0) return res.status(400).json({ success: false, message: '월급을 올바르게 입력해주세요' });
    if (income > 1_000_000_000) return res.status(400).json({ success: false, message: '월급 값이 너무 큽니다' });
    if (expenses === null || expenses < 0) return res.status(400).json({ success: false, message: '월 지출을 올바르게 입력해주세요' });
    if (expenses > 1_000_000_000) return res.status(400).json({ success: false, message: '월 지출 값이 너무 큽니다' });
    if (!JOB_CATEGORIES.includes(job)) return res.status(400).json({ success: false, message: '직군을 선택해주세요' });
    if (years === null || years < 0 || years > 60) return res.status(400).json({ success: false, message: '연차를 올바르게 입력해주세요 (0~60)' });

    const result = await pool.query(
      `INSERT INTO public.salary_stats (monthly_income, monthly_expenses, job_category, experience_years, category_expenses)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at, monthly_income, monthly_expenses, job_category, experience_years, category_expenses`,
      [income, expenses, job, years, catExp]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message || 'DB error' }); }
});

app.get('/api/salary/stats', async (req, res) => {
  try {
    const jobFilter = typeof req.query.job === 'string' && JOB_CATEGORIES.includes(req.query.job) ? req.query.job : '';
    const expFilter = toInt(req.query.experience);
    const myIncome = toInt(req.query.income);
    const myExpenses = toInt(req.query.expenses);

    const clauses = [], values = [];
    if (jobFilter) { values.push(jobFilter); clauses.push(`job_category = $${values.length}`); }
    if (expFilter !== null && expFilter >= 0) { values.push(expFilter); clauses.push(`experience_years = $${values.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const overall = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(AVG(monthly_income), 0) AS avg_income,
              COALESCE(AVG(monthly_expenses), 0) AS avg_expenses,
              COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY monthly_income), 0)   AS median_income,
              COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY monthly_expenses), 0) AS median_expenses
         FROM public.salary_stats ${where}`,
      values
    );

    const byJob = await pool.query(
      `SELECT job_category, COUNT(*)::int AS n,
              COALESCE(AVG(monthly_income), 0) AS avg_income,
              COALESCE(AVG(monthly_expenses), 0) AS avg_expenses
         FROM public.salary_stats GROUP BY job_category ORDER BY avg_income DESC`
    );

    const byExp = await pool.query(
      `SELECT experience_years, COUNT(*)::int AS n,
              COALESCE(AVG(monthly_income), 0) AS avg_income,
              COALESCE(AVG(monthly_expenses), 0) AS avg_expenses
         FROM public.salary_stats GROUP BY experience_years ORDER BY experience_years ASC`
    );

    const catAggParts = EXPENSE_KEYS.map(k => `COALESCE(AVG((category_expenses->>'${k}')::bigint), 0) AS ${k}`).join(', ');
    const byCategory = await pool.query(
      `SELECT ${catAggParts} FROM public.salary_stats ${where}`,
      values
    );

    const sample = await pool.query(
      `SELECT monthly_income, monthly_expenses, job_category, experience_years
         FROM public.salary_stats ${where} ORDER BY created_at DESC LIMIT 500`,
      values
    );

    let mine = null;
    if (myIncome !== null || myExpenses !== null) {
      const totalAll = await pool.query(
        `SELECT COUNT(*)::int AS total FROM public.salary_stats ${where}`,
        values
      );
      const total = totalAll.rows[0].total;

      async function percentile(column, value) {
        if (value === null) return null;
        if (total === 0) return null;
        const vals2 = [...values, value];
        const below = await pool.query(
          `SELECT COUNT(*)::int AS n FROM public.salary_stats
             ${where ? where + ' AND ' : 'WHERE '} ${column} < $${vals2.length}`,
          vals2
        );
        const equal = await pool.query(
          `SELECT COUNT(*)::int AS n FROM public.salary_stats
             ${where ? where + ' AND ' : 'WHERE '} ${column} = $${vals2.length}`,
          vals2
        );
        const rank = below.rows[0].n + equal.rows[0].n / 2;
        return Math.max(0, Math.min(100, Math.round((rank / total) * 1000) / 10));
      }

      mine = {
        income: myIncome,
        expenses: myExpenses,
        income_percentile_in_group: await percentile('monthly_income', myIncome),
        expenses_percentile_in_group: await percentile('monthly_expenses', myExpenses),
      };
    }

    res.json({
      success: true,
      data: {
        filter: { job: jobFilter || null, experience: expFilter !== null ? expFilter : null },
        overall: overall.rows[0],
        by_job: byJob.rows,
        by_experience: byExp.rows,
        by_category: byCategory.rows[0] || {},
        sample: sample.rows,
        mine,
      },
    });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: err.message || 'DB error' }); }
});

app.get('/api/salary/meta', (_req, res) => {
  res.json({ success: true, data: { job_categories: JOB_CATEGORIES, expense_keys: EXPENSE_KEYS, expense_labels: EXPENSE_LABELS } });
});

// ====================================================================
// 4) Refrigerator manager (/api/refri/...)  — UUID + expiry + AI suggest
// ====================================================================
const REFRI_CATEGORIES = ['육류', '채소', '유제품', '곡물', '조미료', '기타'];

app.get('/api/refri/ingredients', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const clauses = [], values = [];
    if (q) { values.push(`%${q}%`); clauses.push(`name ILIKE $${values.length}`); }
    if (category) { values.push(category); clauses.push(`category = $${values.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT id, name, category, expiry_date, created_at
         FROM public.ingredients ${where}
         ORDER BY CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END, expiry_date ASC, created_at DESC`,
      values
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to list ingredients' }); }
});

app.post('/api/refri/ingredients', async (req, res) => {
  try {
    const { name, category, expiry_date } = req.body || {};
    if (typeof name !== 'string' || name.trim() === '') return res.status(400).json({ success: false, message: 'name is required' });
    if (category !== undefined && category !== null && category !== '' && !REFRI_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: `category must be one of: ${REFRI_CATEGORIES.join(', ')}` });
    }
    const safeCategory = category || null;
    const safeExpiry = (typeof expiry_date === 'string' && expiry_date.trim() !== '') ? expiry_date : null;
    const result = await pool.query(
      `INSERT INTO public.ingredients (name, category, expiry_date) VALUES ($1, $2, $3)
         RETURNING id, name, category, expiry_date, created_at`,
      [name.trim(), safeCategory, safeExpiry]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to create ingredient' }); }
});

app.delete('/api/refri/ingredients/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const result = await pool.query(`DELETE FROM public.ingredients WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Ingredient not found' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to delete ingredient' }); }
});

app.get('/api/refri/recipes', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const result = q
      ? await pool.query(
          `SELECT id, title, ingredients, steps, created_at FROM public.recipes
            WHERE title ILIKE $1 OR EXISTS (SELECT 1 FROM unnest(ingredients) AS ing WHERE ing ILIKE $1)
            ORDER BY created_at DESC`,
          [`%${q}%`]
        )
      : await pool.query(
          `SELECT id, title, ingredients, steps, created_at FROM public.recipes ORDER BY created_at DESC`
        );
    res.json({ success: true, data: result.rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to list recipes' }); }
});

app.post('/api/refri/recipes', async (req, res) => {
  try {
    const { title, ingredients, steps } = req.body || {};
    if (typeof title !== 'string' || title.trim() === '') return res.status(400).json({ success: false, message: 'title is required' });
    const safeIng = Array.isArray(ingredients) ? ingredients.map(x => String(x).trim()).filter(Boolean) : [];
    const safeSteps = typeof steps === 'string' ? steps : null;
    const result = await pool.query(
      `INSERT INTO public.recipes (title, ingredients, steps) VALUES ($1, $2, $3)
         RETURNING id, title, ingredients, steps, created_at`,
      [title.trim(), safeIng, safeSteps]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to create recipe' }); }
});

app.delete('/api/refri/recipes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const result = await pool.query(`DELETE FROM public.recipes WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Recipe not found' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to delete recipe' }); }
});

app.get('/api/refri/meta', (_req, res) => {
  res.json({ success: true, data: { categories: REFRI_CATEGORIES } });
});

const REFRI_AI_SYSTEM_PROMPT = `당신은 가정 요리 전문가입니다. 사용자가 제공한 냉장고 재료를 기반으로 1인분 기준, 15분 이내 조리 가능한 자취생 난이도의 레시피를 1개 추천하세요.

규칙:
- 유통기한이 임박한(D-day 가까운) 재료를 최우선으로 활용하세요.
- 기본 양념(소금/후추/설탕/간장/식용유/참기름/마늘)은 있다고 가정해도 됩니다.
- 사용자 냉장고에 없는 특별한 재료는 제안하지 마세요.

반드시 아래 JSON 형식만 반환하세요:
{
  "title": "요리명",
  "ingredients": ["재료1", "재료2"],
  "steps": "1. ...\\n2. ..."
}`;

app.post('/api/refri/recipes/suggest', async (req, res) => {
  try {
    const daysWithin = Number.isFinite(Number(req.body?.days_within)) ? Number(req.body.days_within) : 7;
    const expiring = await pool.query(
      `SELECT name, category, expiry_date FROM public.ingredients
        WHERE expiry_date IS NOT NULL AND expiry_date - CURRENT_DATE <= $1
        ORDER BY expiry_date ASC`,
      [daysWithin]
    );
    let sourceRows = expiring.rows;
    let usedFallback = false;
    if (sourceRows.length === 0) {
      const fb = await pool.query(
        `SELECT name, category, expiry_date FROM public.ingredients
          ORDER BY CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END, expiry_date ASC, created_at DESC LIMIT 10`
      );
      sourceRows = fb.rows;
      usedFallback = sourceRows.length > 0;
    }
    if (sourceRows.length === 0) {
      return res.status(400).json({ success: false, message: '냉장고에 등록된 재료가 없습니다. 먼저 재료를 추가해 주세요.' });
    }

    const today = new Date(); today.setHours(0,0,0,0);
    const lines = sourceRows.map(r => {
      let s = `- ${r.name}`;
      if (r.category) s += ` (${r.category})`;
      if (r.expiry_date) {
        const e = new Date(r.expiry_date); e.setHours(0,0,0,0);
        const diff = Math.round((e - today) / 86400000);
        if (diff < 0) s += ` [유통기한 ${-diff}일 경과]`;
        else if (diff === 0) s += ` [오늘까지]`;
        else s += ` [D-${diff}]`;
      }
      return s;
    });

    const client = getOpenAI();
    const aiResponse = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: REFRI_AI_SYSTEM_PROMPT },
        { role: 'user', content: `다음 냉장고 재료로 추천 레시피를 1개 만들어주세요. JSON 형식으로만 응답하세요.\n\n${lines.join('\n')}` },
      ],
    });
    const text = (aiResponse.choices?.[0]?.message?.content || '').trim();
    let parsed;
    try { parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || text); }
    catch { return res.status(500).json({ success: false, message: 'AI 응답 파싱 실패', raw: text }); }

    res.json({ success: true, data: {
      title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.map(x => String(x).trim()).filter(Boolean) : [],
      steps: typeof parsed.steps === 'string' ? parsed.steps : '',
      source_ingredients: sourceRows.map(r => r.name),
      used_fallback: usedFallback,
      days_within: daysWithin,
    }});
  } catch (err) {
    console.error(err);
    if (err.message === 'OPENAI_API_KEY_NOT_SET') return res.status(503).json({ success: false, message: 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다.' });
    if (err.message === 'OPENAI_LIB_NOT_INSTALLED') return res.status(503).json({ success: false, message: 'openai 패키지가 설치되지 않았습니다.' });
    res.status(500).json({ success: false, message: 'AI 추천 실패: ' + (err.message || '') });
  }
});

// ====================================================================
// 5) Refrigerator AI app (/api/refri-ai/...)  — themes + AI generate
// ====================================================================
const RA_DIFFICULTIES = ['쉬움', '보통', '어려움'];
const RA_THEMES = ['간단', '다이어트', '야식', '술안주', '기타'];

const RA_THEME_GUIDES = {
  '간단': '빠르고 간편하게, 조리 단계 최소화. 15분 이내.',
  '다이어트': '저칼로리/고단백, 기름 최소화, 건강한 조리법.',
  '야식': '밤에 가볍게 먹을 만한 맵거나 짭조름한 요리.',
  '술안주': '술과 어울리는 짭짤/기름진 요리.',
  '기타': '특정 테마 없이 재료를 잘 활용할 수 있는 요리.',
};

const RA_SYSTEM_PROMPT = `당신은 집밥 요리 전문가입니다. 사용자의 냉장고 재료와 선택된 테마를 반영해 1인분 레시피를 1개 추천하세요.

반드시 아래 JSON만 반환하세요 (추가 설명 금지):
{
  "title": "요리명",
  "content": "1. 첫 단계\\n2. 두 번째 단계\\n...",
  "ingredients_used": ["재료1", "재료2", ...],
  "difficulty": "쉬움" | "보통" | "어려움",
  "cooking_time": 15,
  "category": "간단" | "다이어트" | "야식" | "술안주" | "기타"
}`;

let openaiClient = null;
function getOpenAI() {
  if (openaiClient) return openaiClient;
  if (!OpenAI) throw new Error('OPENAI_LIB_NOT_INSTALLED');
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY_NOT_SET');
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

app.get('/api/refri-ai/ingredients', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const result = q
      ? await pool.query(
          `SELECT id, name, quantity, created_at FROM public.ingredients_app
            WHERE name ILIKE $1 ORDER BY created_at DESC`,
          [`%${q}%`]
        )
      : await pool.query(
          `SELECT id, name, quantity, created_at FROM public.ingredients_app ORDER BY created_at DESC`
        );
    res.json({ success: true, data: result.rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to list ingredients' }); }
});

app.post('/api/refri-ai/ingredients', async (req, res) => {
  try {
    const { name, quantity } = req.body || {};
    if (typeof name !== 'string' || name.trim() === '') return res.status(400).json({ success: false, message: 'name is required' });
    const safeQty = (typeof quantity === 'string' && quantity.trim() !== '') ? quantity.trim() : null;
    const result = await pool.query(
      `INSERT INTO public.ingredients_app (name, quantity) VALUES ($1, $2)
         RETURNING id, name, quantity, created_at`,
      [name.trim(), safeQty]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to create ingredient' }); }
});

app.delete('/api/refri-ai/ingredients/:id', async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid id' });
    const result = await pool.query(`DELETE FROM public.ingredients_app WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Ingredient not found' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to delete ingredient' }); }
});

app.get('/api/refri-ai/recipes', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty.trim() : '';
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const maxTime = req.query.max_cooking_time !== undefined ? Number(req.query.max_cooking_time) : null;
    const favOnly = req.query.is_favorite === 'true' || req.query.is_favorite === '1';

    const clauses = [], values = [];
    if (q) { values.push(`%${q}%`); clauses.push(`(title ILIKE $${values.length} OR EXISTS (SELECT 1 FROM unnest(ingredients_used) AS u WHERE u ILIKE $${values.length}))`); }
    if (difficulty && RA_DIFFICULTIES.includes(difficulty)) { values.push(difficulty); clauses.push(`difficulty = $${values.length}`); }
    if (category && RA_THEMES.includes(category)) { values.push(category); clauses.push(`category = $${values.length}`); }
    if (Number.isFinite(maxTime) && maxTime > 0) { values.push(maxTime); clauses.push(`cooking_time IS NOT NULL AND cooking_time <= $${values.length}`); }
    if (favOnly) clauses.push(`is_favorite = TRUE`);

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT id, title, content, ingredients_used, difficulty, cooking_time, category, is_favorite, created_at
         FROM public.recipes_app ${where} ORDER BY is_favorite DESC, created_at DESC`,
      values
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to list recipes' }); }
});

app.post('/api/refri-ai/recipes', async (req, res) => {
  try {
    const { title, content, ingredients_used, difficulty, cooking_time, category, is_favorite } = req.body || {};
    if (typeof title !== 'string' || title.trim() === '') return res.status(400).json({ success: false, message: 'title is required' });
    if (difficulty && !RA_DIFFICULTIES.includes(difficulty)) return res.status(400).json({ success: false, message: 'invalid difficulty' });
    if (category && !RA_THEMES.includes(category)) return res.status(400).json({ success: false, message: 'invalid category' });
    const safeIng = Array.isArray(ingredients_used) ? ingredients_used.map(x => String(x).trim()).filter(Boolean) : [];
    const safeTime = Number.isFinite(Number(cooking_time)) ? Math.max(1, Math.round(Number(cooking_time))) : null;
    const result = await pool.query(
      `INSERT INTO public.recipes_app (title, content, ingredients_used, difficulty, cooking_time, category, is_favorite)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, title, content, ingredients_used, difficulty, cooking_time, category, is_favorite, created_at`,
      [title.trim(), content || null, safeIng, difficulty || null, safeTime, category || null, !!is_favorite]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to create recipe' }); }
});

app.patch('/api/refri-ai/recipes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const { is_favorite } = req.body || {};
    if (typeof is_favorite !== 'boolean') return res.status(400).json({ success: false, message: 'is_favorite must be boolean' });
    const result = await pool.query(
      `UPDATE public.recipes_app SET is_favorite = $1 WHERE id = $2
         RETURNING id, title, content, ingredients_used, difficulty, cooking_time, category, is_favorite, created_at`,
      [is_favorite, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Recipe not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to update recipe' }); }
});

app.delete('/api/refri-ai/recipes/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const result = await pool.query(`DELETE FROM public.recipes_app WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Recipe not found' });
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to delete recipe' }); }
});

app.post('/api/refri-ai/generate', async (req, res) => {
  try {
    const themeRaw = typeof req.body?.theme === 'string' ? req.body.theme : '기타';
    const theme = RA_THEMES.includes(themeRaw) ? themeRaw : '기타';

    const ing = await pool.query(`SELECT name, quantity FROM public.ingredients_app ORDER BY created_at DESC LIMIT 30`);
    if (ing.rows.length === 0) return res.status(400).json({ success: false, message: '냉장고에 재료가 없습니다. 먼저 재료를 등록해 주세요.' });

    const ingredientLines = ing.rows.map(r => `- ${r.name}${r.quantity ? ` (${r.quantity})` : ''}`);
    const userMessage = `냉장고 재료:\n${ingredientLines.join('\n')}\n\n선택한 테마: ${theme} — ${RA_THEME_GUIDES[theme]}\n\n위 재료와 테마를 반영해 JSON 레시피 1개를 생성하세요.`;

    const client = getOpenAI();
    const aiResponse = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: RA_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const text = (aiResponse.choices?.[0]?.message?.content || '').trim();
    let parsed;
    try { parsed = JSON.parse(text); } catch (_) {
      return res.status(500).json({ success: false, message: 'AI 응답 파싱 실패', raw: text });
    }

    const out = {
      title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
      content: typeof parsed.content === 'string' ? parsed.content : '',
      ingredients_used: Array.isArray(parsed.ingredients_used) ? parsed.ingredients_used.map(x => String(x).trim()).filter(Boolean) : [],
      difficulty: RA_DIFFICULTIES.includes(parsed.difficulty) ? parsed.difficulty : '보통',
      cooking_time: Number.isFinite(Number(parsed.cooking_time)) ? Math.max(1, Math.round(Number(parsed.cooking_time))) : null,
      category: RA_THEMES.includes(parsed.category) ? parsed.category : theme,
      source_ingredients: ing.rows.map(r => r.name),
      theme_requested: theme,
    };
    res.json({ success: true, data: out });
  } catch (err) {
    console.error(err);
    if (err.message === 'OPENAI_API_KEY_NOT_SET') return res.status(503).json({ success: false, message: 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다.' });
    if (err.message === 'OPENAI_LIB_NOT_INSTALLED') return res.status(503).json({ success: false, message: 'openai 패키지가 설치되지 않았습니다. npm install openai' });
    res.status(500).json({ success: false, message: 'AI 레시피 생성에 실패했습니다: ' + (err.message || '') });
  }
});

app.get('/api/refri-ai/meta', (_req, res) => {
  res.json({ success: true, data: { difficulties: RA_DIFFICULTIES, themes: RA_THEMES, theme_guides: RA_THEME_GUIDES } });
});

// ====================================================================
// 6) Skill — static JSON file ingredients (no DB)
// ====================================================================
// 배포 번들용 내부 경로를 우선 조회, 없으면 저장소의 원본 폴더로 폴백.
const SKILL_DIR_LOCAL = path.join(__dirname, 'data', 'skill_ingredients');
const SKILL_DIR_REPO  = path.join(__dirname, '..', 'Refrigerator_skill', 'ingredients');
const SKILL_DIR = fs.existsSync(SKILL_DIR_LOCAL) ? SKILL_DIR_LOCAL : SKILL_DIR_REPO;

app.get('/api/skill/ingredients', (_req, res) => {
  try {
    if (!fs.existsSync(SKILL_DIR)) return res.json({ success: true, data: [] });
    const files = fs.readdirSync(SKILL_DIR).filter(f => f.endsWith('.json'));
    const out = files.map(f => {
      try {
        const raw = fs.readFileSync(path.join(SKILL_DIR, f), 'utf8');
        const data = JSON.parse(raw);
        return { file: f, ...data };
      } catch (_) { return { file: f, error: 'parse error' }; }
    });
    res.json({ success: true, data: out });
  } catch (err) { console.error(err); res.status(500).json({ success: false, message: 'Failed to read skill ingredients' }); }
});

// ====================================================================
// Health / SPA fallback
// ====================================================================
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { ok: true, time: new Date().toISOString() } });
});

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
    console.log(`Quest All server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
