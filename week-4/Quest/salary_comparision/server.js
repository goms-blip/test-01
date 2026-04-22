try { require('dotenv').config({ path: require('path').join(__dirname, '.env') }); } catch (_) { /* optional */ }

const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 4329;

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

const JOB_CATEGORIES = ['개발', '디자인', '기획', '마케팅', '영업', '운영', 'HR', '기타'];
const EXPENSE_KEYS = ['food', 'housing', 'transport', 'subscription', 'leisure', 'etc'];

let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
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

function toInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function sanitizeCategoryExpenses(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of EXPENSE_KEYS) {
    const n = toInt(input[key]);
    if (n !== null && n >= 0) out[key] = n;
  }
  return out;
}

// POST /api/salary  — 신규 입력
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
      `INSERT INTO public.salary_stats
         (monthly_income, monthly_expenses, job_category, experience_years, category_expenses)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at, monthly_income, monthly_expenses, job_category, experience_years, category_expenses`,
      [income, expenses, job, years, catExp]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('POST /api/salary error:', err);
    res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

// GET /api/stats?job=&experience=&income=&expenses=
// 전체 통계 + (optional) 내 위치 백분위 + 직군별/연차별 평균 + 카테고리별 평균
app.get('/api/stats', async (req, res) => {
  try {
    const jobFilter = typeof req.query.job === 'string' && JOB_CATEGORIES.includes(req.query.job) ? req.query.job : '';
    const expFilter = toInt(req.query.experience);
    const myIncome = toInt(req.query.income);
    const myExpenses = toInt(req.query.expenses);

    const clauses = [];
    const values = [];
    if (jobFilter) {
      values.push(jobFilter);
      clauses.push(`job_category = $${values.length}`);
    }
    if (expFilter !== null && expFilter >= 0) {
      values.push(expFilter);
      clauses.push(`experience_years = $${values.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const overall = await pool.query(
      `SELECT
         COUNT(*)::int                       AS total,
         COALESCE(AVG(monthly_income), 0)    AS avg_income,
         COALESCE(AVG(monthly_expenses), 0)  AS avg_expenses,
         COALESCE(
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY monthly_income), 0
         )                                    AS median_income,
         COALESCE(
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY monthly_expenses), 0
         )                                    AS median_expenses
       FROM public.salary_stats ${where}`,
      values
    );

    const byJob = await pool.query(
      `SELECT job_category,
              COUNT(*)::int                      AS n,
              COALESCE(AVG(monthly_income), 0)   AS avg_income,
              COALESCE(AVG(monthly_expenses), 0) AS avg_expenses
         FROM public.salary_stats
         GROUP BY job_category
         ORDER BY avg_income DESC`
    );

    const byExp = await pool.query(
      `SELECT experience_years,
              COUNT(*)::int                      AS n,
              COALESCE(AVG(monthly_income), 0)   AS avg_income,
              COALESCE(AVG(monthly_expenses), 0) AS avg_expenses
         FROM public.salary_stats
         GROUP BY experience_years
         ORDER BY experience_years ASC`
    );

    // 카테고리별 지출 평균(필터 반영)
    const catAggParts = EXPENSE_KEYS.map(
      (k) => `COALESCE(AVG((category_expenses->>'${k}')::bigint), 0) AS ${k}`
    ).join(', ');
    const byCategory = await pool.query(
      `SELECT ${catAggParts} FROM public.salary_stats ${where}`,
      values
    );

    // 최근 분포 샘플 (익명 산점도 용)
    const sample = await pool.query(
      `SELECT monthly_income, monthly_expenses, job_category, experience_years
         FROM public.salary_stats
         ${where}
         ORDER BY created_at DESC
         LIMIT 500`,
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
          `SELECT COUNT(*)::int AS n
             FROM public.salary_stats
             ${where ? where + ' AND ' : 'WHERE '} ${column} < $${vals2.length}`,
          vals2
        );
        const equal = await pool.query(
          `SELECT COUNT(*)::int AS n
             FROM public.salary_stats
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
  } catch (err) {
    console.error('GET /api/stats error:', err);
    res.status(500).json({ success: false, message: err.message || 'DB error' });
  }
});

// GET /api/meta — 직군/카테고리 메타 정보
app.get('/api/meta', (_req, res) => {
  res.json({
    success: true,
    data: {
      job_categories: JOB_CATEGORIES,
      expense_keys: EXPENSE_KEYS,
      expense_labels: {
        food: '식비',
        housing: '주거비',
        transport: '교통비',
        subscription: '구독료',
        leisure: '여가/문화',
        etc: '기타',
      },
    },
  });
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
    console.log(`Salary-Comparision server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
