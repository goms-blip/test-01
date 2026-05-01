// ============================================================
// 가계부 앱 — Express + Supabase(PostgreSQL) 서버
// ------------------------------------------------------------
// PRD 6단계 Step 2 / Step 4 구현
//   - GET    /api/ledgers              내역 리스트 (최신순)
//   - POST   /api/ledgers              내역 등록
//   - PATCH  /api/ledgers/:id          내역 수정
//   - DELETE /api/ledgers/:id          내역 삭제
//   - GET    /api/stats/balance        총 수입·지출·잔액
//   - GET    /api/stats/categories     카테고리별 지출 합계
//   - GET    /api/stats/monthly        월별 수입·지출
// ============================================================

const express = require('express');
const path = require('path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const API_TOKEN = (process.env.API_TOKEN || '').trim();

if (!DATABASE_URL) {
  console.error('[fatal] DATABASE_URL is not set. Refusing to start.');
  console.error('         .env.example 를 .env 로 복사해 Supabase 연결 문자열을 채우세요.');
  process.exit(1);
}

// 토큰 동등성 비교 (타이밍 공격 방어)
function tokenEquals(a, b) {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// /api/* 만 보호. 정적 자산은 그대로 공개.
function requireAuth(req, res, next) {
  if (!API_TOKEN) return next(); // dev 모드 — 토큰 미설정 시 인증 우회
  const auth = req.headers.authorization || '';
  const got = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!got || !tokenEquals(got, API_TOKEN)) {
    return res.status(401).json({ error: 'unauthorized', hint: 'set Authorization: Bearer <API_TOKEN>' });
  }
  next();
}

// why: Supabase pooler(6543, transaction mode) 호환을 위해 pool size 작게,
//      SSL 사용. node-pg 의 기본 파라미터 쿼리는 unnamed prepared 라 ok.
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
});

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});
app.use(express.static(__dirname));

// /api/* 인증 미들웨어 (정적 파일 다음에 등록 — 정적은 인증 불필요)
app.use('/api/', requireAuth);

// --------- 유틸 ---------
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = new Set(['income', 'expense']);

function bad(res, msg, status = 400) {
  return res.status(status).json({ error: msg });
}
function wrap(handler) {
  return async (req, res) => {
    try { await handler(req, res); }
    catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

function validateLedger(body, { partial = false } = {}) {
  const out = {};
  const has = (k) => body && Object.prototype.hasOwnProperty.call(body, k);

  if (has('date') || !partial) {
    if (typeof body.date !== 'string' || !DATE_RE.test(body.date)) {
      return { error: 'date must be YYYY-MM-DD' };
    }
    out.date = body.date;
  }
  if (has('type') || !partial) {
    if (!TYPES.has(body.type)) return { error: 'type must be "income" or "expense"' };
    out.type = body.type;
  }
  if (has('amount') || !partial) {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return { error: 'amount must be a non-negative integer' };
    }
    out.amount = n;
  }
  if (has('category') || !partial) {
    if (typeof body.category !== 'string' || body.category.trim().length === 0) {
      return { error: 'category required' };
    }
    out.category = body.category.trim().slice(0, 40);
  }
  if (has('memo')) {
    if (body.memo !== null && typeof body.memo !== 'string') {
      return { error: 'memo must be string or null' };
    }
    out.memo = (body.memo || '').slice(0, 200);
  } else if (!partial) {
    out.memo = '';
  }
  return { value: out };
}

// --------- 내역 CRUD ---------
app.get('/api/ledgers', wrap(async (_req, res) => {
  const { rows } = await pool.query(
    `select id, created_at, date, type, amount, category, memo
       from public.ledgers
      order by date desc, created_at desc`
  );
  res.json(rows);
}));

app.post('/api/ledgers', wrap(async (req, res) => {
  const { value, error } = validateLedger(req.body || {});
  if (error) return bad(res, error);
  const { rows } = await pool.query(
    `insert into public.ledgers (date, type, amount, category, memo)
     values ($1, $2, $3, $4, $5)
     returning id, created_at, date, type, amount, category, memo`,
    [value.date, value.type, value.amount, value.category, value.memo]
  );
  res.status(201).json(rows[0]);
}));

app.patch('/api/ledgers/:id', wrap(async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return bad(res, 'invalid id');

  const { value, error } = validateLedger(req.body || {}, { partial: true });
  if (error) return bad(res, error);
  const keys = Object.keys(value);
  if (keys.length === 0) return bad(res, 'no fields to update');

  const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const vals = keys.map((k) => value[k]);
  vals.push(id);

  const { rows } = await pool.query(
    `update public.ledgers set ${sets}
       where id = $${vals.length}
     returning id, created_at, date, type, amount, category, memo`,
    vals
  );
  if (rows.length === 0) return bad(res, 'not found', 404);
  res.json(rows[0]);
}));

app.delete('/api/ledgers/:id', wrap(async (req, res) => {
  const { id } = req.params;
  if (!UUID_RE.test(id)) return bad(res, 'invalid id');
  const { rowCount } = await pool.query(
    'delete from public.ledgers where id = $1', [id]
  );
  if (rowCount === 0) return bad(res, 'not found', 404);
  res.json({ deleted: 1 });
}));

// --------- 통계 ---------
app.get('/api/stats/balance', wrap(async (_req, res) => {
  const { rows } = await pool.query('select * from public.ledger_balance');
  res.json(rows[0] || { total_income: 0, total_expense: 0, balance: 0 });
}));

app.get('/api/stats/categories', wrap(async (_req, res) => {
  // PRD 3.2 — SQL GROUP BY 활용한 카테고리별 지출 합계
  const { rows } = await pool.query('select * from public.ledger_category_totals');
  res.json(rows);
}));

app.get('/api/stats/monthly', wrap(async (_req, res) => {
  const { rows } = await pool.query('select * from public.ledger_monthly_summary');
  res.json(rows);
}));

// --------- SPA fallback ---------
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[ledger] server running on http://localhost:${PORT}`);
    console.log(`[ledger] auth: ${API_TOKEN ? '🔒 API_TOKEN required' : '⚠ dev mode (set API_TOKEN to enable auth)'}`);
  });
}
module.exports = app;
