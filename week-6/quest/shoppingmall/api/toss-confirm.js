// Vercel Serverless Function — /api/toss-confirm
//
// 토스페이먼츠 결제 승인.
//   secret key 는 절대 클라이언트로 내려가지 않는다.
//   클라이언트는 paymentKey/orderId/amount + 본인 access_token 을 전달.
//   서버는:
//     1) Toss confirm API 호출 (Basic auth = base64(secretKey:))
//     2) 응답 OK 면 사용자 access_token 으로 Supabase orders 를 'paid' 로 갱신
//        (RLS 가 orders.user_id = auth.uid() 일 때만 통과 → 위변조 차단)
//     3) 금액 위변조 방지: DB 에 저장된 total_price === Toss 응답 totalAmount === 클라이언트 amount

const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

async function readJson(req) {
  return await new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
  const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
  const TOSS_SECRET_KEY = (process.env.TOSS_SECRET_KEY || '').trim();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TOSS_SECRET_KEY) {
    return res.status(500).json({
      error: 'server_env_missing',
      detail: 'SUPABASE_URL / SUPABASE_ANON_KEY / TOSS_SECRET_KEY 가 모두 필요합니다.',
    });
  }

  let body;
  try { body = req.body && typeof req.body === 'object' ? req.body : await readJson(req); }
  catch { return res.status(400).json({ error: 'invalid_json' }); }

  const { paymentKey, orderId, amount, accessToken } = body || {};

  if (!paymentKey || !orderId || !amount || !accessToken) {
    return res.status(400).json({
      error: 'missing_fields',
      detail: 'paymentKey, orderId, amount, accessToken 모두 필요합니다.',
    });
  }

  const amountInt = Number(amount);
  if (!Number.isFinite(amountInt) || amountInt <= 0) {
    return res.status(400).json({ error: 'invalid_amount' });
  }

  // -----------------------------------------------------------------
  // 0) DB 에서 주문 조회 — 금액·소유자 검증
  //    RLS 통과를 위해 사용자 access_token 사용. 본인 주문만 조회됨.
  // -----------------------------------------------------------------
  const orderRes = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?order_no=eq.${encodeURIComponent(orderId)}&select=id,user_id,total_price,status`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }
  );

  if (!orderRes.ok) {
    const txt = await orderRes.text();
    return res.status(401).json({ error: 'order_lookup_failed', detail: txt });
  }
  const orders = await orderRes.json();
  if (!Array.isArray(orders) || orders.length === 0) {
    return res.status(404).json({ error: 'order_not_found' });
  }
  const order = orders[0];

  if (order.status === 'paid') {
    // 이미 승인 완료 — 멱등 처리 (success 페이지 재로드 등)
    return res.status(200).json({ ok: true, idempotent: true, orderId, paymentKey });
  }

  if (order.total_price !== amountInt) {
    return res.status(400).json({
      error: 'amount_mismatch',
      detail: `db total_price=${order.total_price}, request amount=${amountInt}`,
    });
  }

  // -----------------------------------------------------------------
  // 1) Toss confirm 호출
  // -----------------------------------------------------------------
  const basic = Buffer.from(`${TOSS_SECRET_KEY}:`).toString('base64');
  const tossRes = await fetch(TOSS_CONFIRM_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount: amountInt }),
  });
  const tossJson = await tossRes.json().catch(() => ({}));

  if (!tossRes.ok) {
    // 실패 시 orders.status='failed' 표시 (RLS 본인만)
    await fetch(
      `${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status: 'failed' }),
      }
    );
    return res.status(402).json({
      error: 'toss_confirm_failed',
      code: tossJson.code,
      message: tossJson.message,
    });
  }

  // -----------------------------------------------------------------
  // 2) Toss 응답 금액 재검증 (이중 체크)
  // -----------------------------------------------------------------
  if (Number(tossJson.totalAmount) !== amountInt) {
    return res.status(400).json({
      error: 'toss_amount_mismatch',
      detail: `toss totalAmount=${tossJson.totalAmount}, request amount=${amountInt}`,
    });
  }

  // -----------------------------------------------------------------
  // 3) orders 를 'paid' 로 업데이트
  // -----------------------------------------------------------------
  const patch = {
    status: 'paid',
    payment_key: paymentKey,
    paid_at: new Date().toISOString(),
  };
  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patch),
    }
  );

  if (!patchRes.ok) {
    const txt = await patchRes.text();
    return res.status(500).json({ error: 'order_update_failed', detail: txt });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: true,
    orderId,
    paymentKey,
    method: tossJson.method,
    approvedAt: tossJson.approvedAt,
  });
};

module.exports.default = module.exports;
