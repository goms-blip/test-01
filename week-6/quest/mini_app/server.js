// server.js — 유료 콘텐츠 잠금 해제 미니앱 백엔드 (Supabase Postgres + JWT 기반)
//
// 핵심 보안 원칙 (PRD §7):
//   - 본문(body)은 권한이 있는 사용자에게만 응답에 포함된다.
//   - 미구매 사용자는 preview만 받는다 (body 키 자체가 응답에서 빠짐).
//   - 결제 승인은 반드시 서버에서 TossPayments /v1/payments/confirm 호출로 검증.
//   - 클라이언트가 보낸 amount/userId를 그대로 신뢰하지 않는다.
//     · amount — 서버 contents 가격과 대조
//     · userId — body·query 무시, JWT의 req.user.userId만 사용
//
// 영속성:
//   - users·purchases는 Postgres (Supabase) — prefix miniapp_*
//   - 토큰은 JWT (stateless) — Vercel 서버리스 환경에서 sessions Map이 무용해서 JWT로 전환

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const { CONTENTS } = require('./seed.js');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─────────────────────────────────────────────────────────────
// env 검증
// ─────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;
const TOSS_CLIENT_KEY = process.env.TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6';

if (!DATABASE_URL) console.warn('[mini_app] DATABASE_URL missing — DB 호출은 모두 실패합니다');
if (!JWT_SECRET) console.warn('[mini_app] JWT_SECRET missing — 인증 토큰 발급/검증 불가');

// ─────────────────────────────────────────────────────────────
// pg Pool — 모듈 레벨에서 1회 생성하여 함수 콜드스타트 간 재사용 시도
// ─────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

// ─────────────────────────────────────────────────────────────
// 콘텐츠 (정적) — DB가 아니라 코드에 둔다 (변경 빈도 낮음)
// ─────────────────────────────────────────────────────────────
const contents = CONTENTS;

// ─────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────
function safeContent(c) {
  return {
    id: c.id,
    title: c.title,
    preview: c.preview,
    price: c.price,
    thumbnail: c.thumbnail,
  };
}

async function hasPurchased(userId, contentId) {
  const r = await pool.query(
    'SELECT 1 FROM miniapp_purchases WHERE user_id = $1 AND content_id = $2 LIMIT 1',
    [userId, contentId],
  );
  return r.rowCount > 0;
}

async function popularTop(n) {
  const r = await pool.query(
    `SELECT content_id, COUNT(*)::int AS purchase_count
       FROM miniapp_purchases
       GROUP BY content_id
       ORDER BY purchase_count DESC
       LIMIT $1`,
    [n],
  );
  const counts = new Map(r.rows.map((row) => [row.content_id, row.purchase_count]));
  return contents
    .map((c) => ({ ...safeContent(c), purchase_count: counts.get(c.id) || 0 }))
    .sort((a, b) => b.purchase_count - a.purchase_count)
    .slice(0, n);
}

function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' },
  );
}

function customerKeyOf(userId) {
  // 토스 customerKey 정책: 영문/숫자/일부 기호. 동일 사용자 동일 키여야 매칭.
  return `miniapp_u_${userId}`;
}

// ─────────────────────────────────────────────────────────────
// 미들웨어
// ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 인증 파싱 — Bearer JWT 검증, 통과 시 req.user 채움. 실패는 무시(미인증으로 통과).
app.use((req, _res, next) => {
  const m = (req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (m && JWT_SECRET) {
    try {
      req.user = jwt.verify(m[1], JWT_SECRET);
    } catch (_) {
      // 만료/위조 토큰 — 로그인 안 된 것으로 간주
    }
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────

app.get('/api/config', (_req, res) => {
  res.json({ tossClientKey: TOSS_CLIENT_KEY });
});

// ─── Auth ───
app.post('/api/auth/signup', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'missing_fields' });
    if (!/^[^\s@]+@[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });
    if (password.length < 4) return res.status(400).json({ error: 'password_too_short' });

    const exists = await pool.query('SELECT 1 FROM miniapp_users WHERE email = $1', [email]);
    if (exists.rowCount > 0) return res.status(409).json({ error: 'email_exists' });

    const hash = await bcrypt.hash(password, 10);
    const ins = await pool.query(
      `INSERT INTO miniapp_users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email`,
      [email, hash],
    );
    const u = ins.rows[0];
    res.json({ userId: u.id, email: u.email, token: signToken(u) });
  } catch (err) {
    console.error('[signup]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const r = await pool.query(
      'SELECT id, email, password_hash FROM miniapp_users WHERE email = $1',
      [email],
    );
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    res.json({ userId: u.id, email: u.email, token: signToken(u) });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// JWT는 stateless — logout은 클라이언트에서 토큰을 버리면 끝. 서버 호출은 의례용.
app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  res.json({ userId: req.user.userId, email: req.user.email });
});

// ─── Contents ───
app.get('/api/contents', (_req, res) => {
  res.json(contents.map(safeContent));
});

app.get('/api/popular', async (_req, res) => {
  try {
    res.json(await popularTop(3));
  } catch (err) {
    console.error('[popular]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// 콘텐츠 상세 — 권한에 따라 body 포함 여부 결정. 미인증/미구매면 body 키 자체 미포함.
app.get('/api/contents/:id', async (req, res) => {
  try {
    const c = contents.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'not_found' });

    let purchased = false;
    if (req.user) purchased = await hasPurchased(req.user.userId, c.id);

    if (purchased) {
      return res.json({ ...safeContent(c), body: c.body, locked: false });
    }
    return res.json({ ...safeContent(c), locked: true });
  } catch (err) {
    console.error('[detail]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── Purchases ───
app.get('/api/purchases', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, user_id, content_id, amount, paid_at, toss_payment_key, toss_order_id
         FROM miniapp_purchases
         WHERE user_id = $1
         ORDER BY paid_at DESC`,
      [req.user.userId],
    );
    const items = r.rows.map((row) => {
      const c = contents.find((x) => x.id === row.content_id);
      return {
        id: row.id,
        user_id: row.user_id,
        content_id: row.content_id,
        amount: row.amount,
        paid_at: row.paid_at,
        title: c ? c.title : '(삭제됨)',
        preview: c ? c.preview : '',
        thumbnail: c ? c.thumbnail : null,
      };
    });
    res.json(items);
  } catch (err) {
    console.error('[purchases]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ─── Payments ───
app.post('/api/payments/intent', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { contentId } = req.body || {};
    if (!contentId) return res.status(400).json({ error: 'missing_fields' });

    const c = contents.find((x) => x.id === contentId);
    if (!c) return res.status(404).json({ error: 'content_not_found' });

    if (await hasPurchased(userId, contentId)) {
      return res.status(409).json({ error: 'already_purchased' });
    }

    const orderId = `mini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    res.json({
      orderId,
      orderName: c.title,
      amount: c.price,
      customerKey: customerKeyOf(userId),
      contentId: c.id,
    });
  } catch (err) {
    console.error('[intent]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/api/payments/confirm', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { paymentKey, orderId, amount, contentId } = req.body || {};
    if (!paymentKey || !orderId || !amount || !contentId) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    // ① 서버 보유 가격과 클라이언트 amount 대조 (위변조 방지)
    const c = contents.find((x) => x.id === contentId);
    if (!c) return res.status(404).json({ error: 'content_not_found' });
    if (Number(amount) !== c.price) {
      return res.status(400).json({ error: 'amount_mismatch' });
    }

    // ② 이미 구매했으면 중복 결제 거부 (UNIQUE 제약이 있어 추가 안전망)
    if (await hasPurchased(userId, contentId)) {
      return res.status(409).json({ error: 'already_purchased' });
    }

    // ③ 토스페이먼츠 결제 승인 호출
    const auth = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');
    let tossResp;
    try {
      const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      });
      tossResp = await r.json();
      if (!r.ok) {
        return res.status(r.status).json({ error: 'toss_failed', detail: tossResp });
      }
    } catch (err) {
      return res.status(502).json({ error: 'toss_unreachable', detail: String(err) });
    }

    // ④ purchase 저장 (UNIQUE(user_id, content_id) → ON CONFLICT은 의례용 안전망)
    const ins = await pool.query(
      `INSERT INTO miniapp_purchases
         (user_id, content_id, amount, toss_payment_key, toss_order_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, content_id) DO NOTHING
       RETURNING id, paid_at`,
      [userId, contentId, c.price, paymentKey, orderId],
    );

    const row = ins.rows[0];
    res.json({
      ok: true,
      purchase: {
        id: row?.id,
        user_id: userId,
        content_id: contentId,
        amount: c.price,
        paid_at: row?.paid_at,
        toss_order_id: orderId,
      },
      toss: tossResp,
    });
  } catch (err) {
    console.error('[confirm]', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// SPA fallback — 정적 자산이 아닌 모든 경로에 index.html
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─────────────────────────────────────────────────────────────
// Vercel 호환 — listen은 직접 실행될 때만. import/require로 들어오면 app만 export.
// ─────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[mini_app] listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
