// =============================================================================
// 도담 도자기 쇼핑몰 — Express 인증 서버
// 정적 파일 서빙 + JWT 기반 이메일/비밀번호 회원가입 / 로그인 / me
// =============================================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs'); // bcrypt 빌드 이슈 우회 (pure-JS 구현)
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// -----------------------------------------------------------------------------
// 환경 / 상수
// -----------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '8765', 10);

// .env 우선 로드 (개발 편의)
try { require('dotenv').config({ path: require('path').join(__dirname, '.env') }); } catch (_) {}

const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const JWT_SECRET   = (process.env.JWT_SECRET   || 'dodam_dev_secret_d0_n0t_use_in_production_2026').trim();
if (!DATABASE_URL) {
  console.error('[boot] DATABASE_URL 이 설정되지 않았습니다. .env 또는 환경변수를 확인하세요.');
  process.exit(1);
}
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 10;

// 토스페이먼츠 키 (시크릿은 서버에서만 사용)
const TOSS_CLIENT_KEY = (process.env.TOSS_CLIENT_KEY || '').trim();
const TOSS_SECRET_KEY = (process.env.TOSS_SECRET_KEY || '').trim();
if (!TOSS_CLIENT_KEY || !TOSS_SECRET_KEY) {
  console.warn('[boot] TOSS_CLIENT_KEY / TOSS_SECRET_KEY 가 설정되지 않았습니다. 결제 기능이 비활성화됩니다.');
}
// 토스 confirm API 의 Authorization 헤더 (Basic <base64(secret:)>)
const TOSS_AUTH_HEADER = TOSS_SECRET_KEY
  ? 'Basic ' + Buffer.from(TOSS_SECRET_KEY + ':').toString('base64')
  : null;

// -----------------------------------------------------------------------------
// Postgres Pool (Supabase Pooler, SSL 필요)
// 주의: pg의 connectionString 파서가 점(.)이 포함된 사용자명(예: postgres.<project_ref>)
// 을 안정적으로 처리하지 못하는 케이스가 있어, URL 을 명시 객체로 분해해 전달합니다.
// -----------------------------------------------------------------------------
// connectionString 통째로 전달 (점이 포함된 사용자명도 안전하게 처리됨).
// search_path 를 dodam 우선으로 지정해 신규 스키마 테이블이 자동 사용되도록 함.
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
  options: '-c search_path=dodam,public',
});

pool.on('error', (err) => {
  console.error('[pg pool] idle client error:', err.message);
});

// -----------------------------------------------------------------------------
// DB 스키마는 db/schema.sql 로 관리 (node db/apply.js 로 적용).
// 서버 부팅 시에는 dodam.users 존재만 확인.
// -----------------------------------------------------------------------------
let dbInitialized = false;
async function initDB() {
  if (dbInitialized) return;
  const r = await pool.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='dodam' AND table_name='users' LIMIT 1
  `);
  if (r.rowCount === 0) {
    throw new Error('dodam.users 테이블이 없습니다. `node db/apply.js` 로 스키마를 먼저 적용하세요.');
  }
  dbInitialized = true;
  console.log('[db] dodam 스키마 준비 완료');
}

// -----------------------------------------------------------------------------
// Express 앱
// -----------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 정적 파일: index.html + images/
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));
app.use('/images', express.static(path.join(__dirname, 'images')));

// /api 진입 시 DB 초기화 보장
app.use('/api', async (_req, res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error('[initDB] failed:', err);
    res.status(500).json({ error: 'Database initialization failed' });
  }
});

// -----------------------------------------------------------------------------
// 유틸
// -----------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name };
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
  try {
    req.auth = jwt.verify(m[1], JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
  }
}

// -----------------------------------------------------------------------------
// API: 헬스체크
// -----------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// -----------------------------------------------------------------------------
// API: 회원가입
// -----------------------------------------------------------------------------
app.post('/api/auth/signup', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim() || null;

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: '올바른 이메일 형식이 아닙니다.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
    }

    const dup = await pool.query('SELECT 1 FROM dodam.users WHERE email = $1', [email]);
    if (dup.rowCount > 0) {
      return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const ins = await pool.query(
      `INSERT INTO dodam.users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name`,
      [email, password_hash, name]
    );

    const user = ins.rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('[signup] error:', err);
    res.status(500).json({ error: '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

// -----------------------------------------------------------------------------
// API: 로그인
// -----------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!EMAIL_RE.test(email) || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 확인해 주세요.' });
    }

    const r = await pool.query(
      'SELECT id, email, password_hash, name FROM dodam.users WHERE email = $1',
      [email]
    );
    if (r.rowCount === 0) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const row = r.rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = signToken(row);
    res.json({ token, user: publicUser(row) });
  } catch (err) {
    console.error('[login] error:', err);
    res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

// -----------------------------------------------------------------------------
// API: 현재 사용자
// -----------------------------------------------------------------------------
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, email, name FROM dodam.users WHERE id = $1',
      [req.auth.sub]
    );
    if (r.rowCount === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json({ user: publicUser(r.rows[0]) });
  } catch (err) {
    console.error('[me] error:', err);
    res.status(500).json({ error: '사용자 조회 중 오류가 발생했습니다.' });
  }
});

// -----------------------------------------------------------------------------
// API: 공개 설정 — 클라이언트 키 등 프론트가 필요로 하는 안전한 값만 노출
// -----------------------------------------------------------------------------
app.get('/api/config', (_req, res) => {
  res.json({
    tossClientKey: TOSS_CLIENT_KEY || null,
  });
});

// =============================================================================
// 결제 (토스페이먼츠 결제위젯)
// =============================================================================

// 서버 측 상품 카탈로그 — 클라이언트가 보낸 가격을 절대 신뢰하지 않기 위함.
// 실서비스에서는 dodam.products 테이블에서 조회해야 하지만, 데모 단순화 위해
// index.html 의 PRODUCTS 와 동일한 가격을 박아둔다.
const PRODUCT_PRICES = {
  1: 28000, 2: 42000, 3: 36000, 4: 38000, 5: 32000, 6: 39000,
  7: 22000, 8: 26000, 9: 18000, 10: 24000, 11: 64000, 12: 78000,
  13: 92000, 14: 145000, 15: 110000,
};
const PRODUCT_NAMES = {
  1: '백자 민무늬 밥공기', 2: '청자 학문 밥공기', 3: '모래빛 손맛 국대접',
  4: '흑유 깊은 국대접', 5: '백자 넓은 평접시', 6: '석기질 점박이 디너 플레이트',
  7: '청자 머그', 8: '백자 찻잔', 9: '분청 머그',
  10: '흑유 찻사발', 11: '청자 화병', 12: '백자 달항아리 화병',
  13: '백자 2인 식기 세트', 14: '청자 4인 다기 세트', 15: '분청 4인 식기 세트',
};

const SHIPPING_FEE_FREE_THRESHOLD = 50000;
const SHIPPING_FEE = 3500;

function makeOrderId() {
  // 토스 orderId: 6자~64자, 영문/숫자/하이픈/언더스코어
  return 'dodam-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// -----------------------------------------------------------------------------
// 주문 생성 — 클라이언트가 cart items 를 보내면 서버에서 가격을 다시 계산해
// orders 테이블에 'pending' 상태로 저장하고, orderId/amount/orderName 을 반환.
//
// 보안 포인트:
//   - 클라이언트가 보내는 price 는 무시. PRODUCT_PRICES 만 신뢰.
//   - 사용자 인증은 선택 (비로그인 게스트 주문 허용)
// -----------------------------------------------------------------------------
app.post('/api/payments/orders', async (req, res) => {
  try {
    if (!TOSS_AUTH_HEADER) {
      return res.status(503).json({ error: '결제 기능이 비활성화되어 있습니다. 서버 환경변수 확인 필요.' });
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) {
      return res.status(400).json({ error: '주문할 상품이 없습니다.' });
    }

    // 가격 재계산
    let subtotal = 0;
    const lineItems = [];
    for (const it of items) {
      const pid = Number(it.productId);
      const qty = Math.max(1, Math.min(99, Number(it.qty) || 0));
      if (!PRODUCT_PRICES[pid] || qty <= 0) {
        return res.status(400).json({ error: `잘못된 상품 정보: ${it.productId}` });
      }
      const unit = PRODUCT_PRICES[pid];
      const lineTotal = unit * qty;
      subtotal += lineTotal;
      lineItems.push({
        productId: pid,
        productName: PRODUCT_NAMES[pid],
        unitPrice: unit,
        quantity: qty,
        lineTotal,
        // 옵션(스냅샷)
        color: String(it.color || ''),
        size:  String(it.size  || ''),
      });
    }

    const shipping = subtotal >= SHIPPING_FEE_FREE_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = subtotal + shipping;

    // 사용자 식별 (옵션)
    let userId = null;
    const auth = req.headers.authorization || '';
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) {
      try { userId = jwt.verify(m[1], JWT_SECRET).sub || null; } catch (_) { /* 게스트 처리 */ }
    }

    const orderId = makeOrderId();
    const orderName = lineItems.length === 1
      ? `${lineItems[0].productName} 외 ${lineItems[0].quantity - 1}개`.replace(' 외 0개', '')
      : `${lineItems[0].productName} 외 ${lineItems.length - 1}건`;

    // 배송지는 데모 단계에서 빈 객체 — 실서비스에서는 체크아웃 폼에서 받아야 함.
    const shippingAddress = {
      recipient: req.body?.recipient || null,
      phone:     req.body?.phone     || null,
      address1:  req.body?.address1  || null,
      address2:  req.body?.address2  || null,
      postal:    req.body?.postal    || null,
    };

    await pool.query(
      `INSERT INTO dodam.orders
         (order_number, user_id, status, subtotal, shipping_fee, discount, total,
          currency, shipping_address)
       VALUES ($1, $2, 'pending', $3, $4, 0, $5, 'KRW', $6::jsonb)`,
      [orderId, userId, subtotal, shipping, total, JSON.stringify(shippingAddress)]
    );

    // order_items 스냅샷 저장
    // 데모 단계에서는 dodam.products 가 비어있을 수 있어, 실제로 row 가 있을 때만
    // FK 를 채우고 그렇지 않으면 NULL 로 둔다 (스냅샷 컬럼만으로도 회계 무결).
    for (const li of lineItems) {
      const exists = await pool.query(
        `SELECT 1 FROM dodam.products WHERE id = $1`,
        [li.productId]
      );
      const fkProductId = exists.rowCount > 0 ? li.productId : null;
      await pool.query(
        `INSERT INTO dodam.order_items
           (order_id, product_id, product_name, unit_price, quantity, line_total)
         SELECT id, $1, $2, $3, $4, $5
         FROM dodam.orders WHERE order_number = $6`,
        [fkProductId, li.productName, li.unitPrice, li.quantity, li.lineTotal, orderId]
      );
    }

    res.status(201).json({
      orderId,
      orderName,
      amount: total,
      subtotal,
      shipping,
      currency: 'KRW',
      items: lineItems,
    });
  } catch (err) {
    console.error('[orders] error:', err);
    res.status(500).json({ error: '주문 생성 중 오류가 발생했습니다.' });
  }
});

// -----------------------------------------------------------------------------
// 주문 조회 — 결제 성공 화면에서 표시용
// -----------------------------------------------------------------------------
app.get('/api/payments/orders/:orderId', async (req, res) => {
  try {
    const orderId = String(req.params.orderId || '');
    const r = await pool.query(
      `SELECT order_number, status, subtotal, shipping_fee, total, currency,
              placed_at, paid_at
       FROM dodam.orders WHERE order_number = $1`,
      [orderId]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });

    const items = await pool.query(
      `SELECT product_id, product_name, unit_price, quantity, line_total
       FROM dodam.order_items
       WHERE order_id = (SELECT id FROM dodam.orders WHERE order_number = $1)`,
      [orderId]
    );
    res.json({ order: r.rows[0], items: items.rows });
  } catch (err) {
    console.error('[order get] error:', err);
    res.status(500).json({ error: '주문 조회 중 오류가 발생했습니다.' });
  }
});

// -----------------------------------------------------------------------------
// 결제 승인 — successUrl 로 리다이렉트된 클라이언트가 호출.
//
// 보안 포인트 (★ 매우 중요):
//   1. 클라이언트가 보낸 amount 를 절대 그대로 토스에 넘기지 않는다.
//      반드시 서버의 orders.total 과 비교 일치할 때만 confirm 진행.
//   2. provider_transaction_id (paymentKey) 에 UNIQUE 제약 → 중복 confirm 방어.
//   3. Idempotency-Key 헤더로 토스 측 중복 요청도 방어.
// -----------------------------------------------------------------------------
app.post('/api/payments/confirm', async (req, res) => {
  try {
    if (!TOSS_AUTH_HEADER) {
      return res.status(503).json({ error: '결제 기능이 비활성화되어 있습니다.' });
    }
    const paymentKey = String(req.body?.paymentKey || '').trim();
    const orderId    = String(req.body?.orderId    || '').trim();
    const amount     = Number(req.body?.amount);

    if (!paymentKey || !orderId || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: '필수 결제 정보가 누락되었습니다.' });
    }

    // 1) 서버에 저장된 주문과 금액 검증
    const orderRow = await pool.query(
      `SELECT id, total, status FROM dodam.orders WHERE order_number = $1`,
      [orderId]
    );
    if (orderRow.rowCount === 0) {
      return res.status(404).json({ error: '주문 정보를 찾을 수 없습니다.' });
    }
    const order = orderRow.rows[0];
    if (Number(order.total) !== amount) {
      console.warn('[confirm] amount mismatch', { orderId, expected: order.total, got: amount });
      return res.status(400).json({ error: '결제 금액이 주문 금액과 일치하지 않습니다.' });
    }
    if (order.status === 'paid') {
      // 이미 처리된 주문 — 중복 confirm 호출 (새로고침 등)
      return res.json({ ok: true, alreadyProcessed: true, orderId });
    }

    // 2) 토스 결제 승인 호출
    const tossResp = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': TOSS_AUTH_HEADER,
        'Content-Type': 'application/json',
        'Idempotency-Key': paymentKey, // 같은 paymentKey 로 들어온 중복 요청은 토스가 멱등 처리
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const tossData = await tossResp.json().catch(() => ({}));

    if (!tossResp.ok) {
      // 실패 — payments row 만 failed 로 기록하고 원인 반환
      await pool.query(
        `INSERT INTO dodam.payments
           (order_id, provider, provider_transaction_id, method, amount, currency,
            status, failure_code, failure_message, raw_response)
         VALUES ($1, 'toss', $2, 'manual', $3, 'KRW', 'failed', $4, $5, $6::jsonb)
         ON CONFLICT (provider_transaction_id) DO NOTHING`,
        [order.id, paymentKey, amount,
         tossData?.code || null, tossData?.message || null, JSON.stringify(tossData)]
      );
      return res.status(tossResp.status).json({
        error: tossData?.message || '결제 승인에 실패했습니다.',
        code:  tossData?.code    || 'CONFIRM_FAILED',
      });
    }

    // 3) 성공 — payments + orders 업데이트 (트랜잭션)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO dodam.payments
           (order_id, provider, provider_transaction_id, method, amount, currency,
            status, approved_at, raw_response)
         VALUES ($1, 'toss', $2, $3, $4, 'KRW', 'paid', NOW(), $5::jsonb)
         ON CONFLICT (provider_transaction_id) DO NOTHING`,
        [order.id, paymentKey,
         (tossData.method === '카드' ? 'card'
           : tossData.method === '가상계좌' ? 'virtual_account'
           : tossData.method === '계좌이체' ? 'transfer'
           : tossData.method === '간편결제' ? 'easy_pay'
           : tossData.method === '휴대폰'   ? 'phone'
           : 'card'),
         amount, JSON.stringify(tossData)]
      );
      await client.query(
        `UPDATE dodam.orders SET status = 'paid', paid_at = NOW() WHERE id = $1`,
        [order.id]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({
      ok: true,
      orderId,
      paymentKey,
      method:    tossData.method    || null,
      approvedAt: tossData.approvedAt || null,
      receiptUrl: tossData?.receipt?.url || null,
    });
  } catch (err) {
    console.error('[confirm] error:', err);
    res.status(500).json({ error: '결제 승인 처리 중 서버 오류가 발생했습니다.' });
  }
});

// -----------------------------------------------------------------------------
// SPA fallback — 알 수 없는 GET 경로는 index.html 로 (해시 라우팅 친화)
// -----------------------------------------------------------------------------
app.get(/^\/(?!api\/|images\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 공통 에러 핸들러
app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: '서버 내부 오류' });
});

// -----------------------------------------------------------------------------
// 시작 (로컬) / export (서버리스)
// -----------------------------------------------------------------------------
if (require.main === module) {
  initDB()
    .catch((e) => console.error('[boot] initDB warning:', e.message))
    .finally(() => {
      app.listen(PORT, () => {
        console.log(`[dodam] http://localhost:${PORT}`);
      });
    });
}

module.exports = app;
