import { NextResponse } from "next/server";

const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

export async function POST(req: Request) {
  const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const TOSS_SECRET_KEY = (process.env.TOSS_SECRET_KEY ?? "").trim();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TOSS_SECRET_KEY) {
    return NextResponse.json({ error: "server_env_missing" }, { status: 500 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const { paymentKey, orderId, amount, accessToken } = body ?? {};
  if (!paymentKey || !orderId || !amount || !accessToken) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const amountInt = Number(amount);
  if (!Number.isFinite(amountInt) || amountInt <= 0) return NextResponse.json({ error: "invalid_amount" }, { status: 400 });

  // 0) RLS 통과로 본인 주문 조회 — 금액·소유자 검증
  const orderRes = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?order_no=eq.${encodeURIComponent(orderId)}&select=id,user_id,total_price,status`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
  );
  if (!orderRes.ok) return NextResponse.json({ error: "order_lookup_failed", detail: await orderRes.text() }, { status: 401 });
  const orders = await orderRes.json();
  if (!Array.isArray(orders) || orders.length === 0) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  const order = orders[0];

  if (order.status === "paid") return NextResponse.json({ ok: true, idempotent: true, orderId, paymentKey });
  if (order.total_price !== amountInt) {
    return NextResponse.json({ error: "amount_mismatch", detail: `db=${order.total_price}, req=${amountInt}` }, { status: 400 });
  }

  // 1) Toss confirm
  const basic = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");
  const tossRes = await fetch(TOSS_CONFIRM_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    body: JSON.stringify({ paymentKey, orderId, amount: amountInt }),
  });
  const tossJson: any = await tossRes.json().catch(() => ({}));
  if (!tossRes.ok) {
    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed" }),
    });
    return NextResponse.json({ error: "toss_confirm_failed", code: tossJson.code, message: tossJson.message }, { status: 402 });
  }
  if (Number(tossJson.totalAmount) !== amountInt) {
    return NextResponse.json({ error: "toss_amount_mismatch" }, { status: 400 });
  }

  // 2) paid 갱신
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
    method: "PATCH",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ status: "paid", payment_key: paymentKey, paid_at: new Date().toISOString() }),
  });
  if (!patchRes.ok) return NextResponse.json({ error: "order_update_failed", detail: await patchRes.text() }, { status: 500 });

  return NextResponse.json({ ok: true, orderId, paymentKey, method: tossJson.method, approvedAt: tossJson.approvedAt });
}
