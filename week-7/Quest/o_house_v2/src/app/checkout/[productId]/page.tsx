"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";
import { createClient } from "@/lib/supabase/client";
import { fmtPrice, type Product } from "@/lib/types";

export default function CheckoutPage({ params }: { params: { productId: string } }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [order, setOrder] = useState<{ id: string; order_no: string; total_price: number } | null>(null);
  const [widgets, setWidgets] = useState<any>(null);
  const [user, setUser] = useState<{ id: string; email: string; nickname: string | null } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const initOnceRef = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.replace("/login"); return; }
      const { data: prof } = await supabase.from("profiles").select("nickname").eq("id", u.id).maybeSingle();
      const { data: p } = await supabase.from("products").select("*").eq("id", params.productId).maybeSingle();
      if (!alive) return;
      if (!p) { setErr("상품을 찾을 수 없어요."); return; }
      setUser({ id: u.id, email: u.email ?? "", nickname: prof?.nickname ?? null });
      setProduct(p as Product);

      // pending 주문 생성
      const order_no = "ord_" + crypto.randomUUID().replace(/-/g, "");
      const { data: o, error: e1 } = await supabase
        .from("orders").insert({ user_id: u.id, order_no, total_price: p.price, status: "pending" })
        .select().single();
      if (e1) { setErr("주문 생성 실패: " + e1.message); return; }
      const { error: e2 } = await supabase.from("order_items").insert({
        order_id: o.id, product_id: p.id, product_name: p.name, unit_price: p.price, quantity: 1,
      });
      if (e2) { setErr("주문 라인 생성 실패: " + e2.message); return; }
      if (!alive) return;
      setOrder({ id: o.id, order_no: o.order_no, total_price: o.total_price });
    })();
    return () => { alive = false; };
  }, [params.productId, router]);

  // 토스 위젯 mount (한 번만)
  useEffect(() => {
    if (initOnceRef.current || !order || !user) return;
    initOnceRef.current = true;
    (async () => {
      try {
        const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
        const w = toss.widgets({ customerKey: user.id ?? ANONYMOUS });
        await w.setAmount({ currency: "KRW", value: order.total_price });
        await Promise.all([
          w.renderPaymentMethods({ selector: "#pm-widget", variantKey: "DEFAULT" }),
          w.renderAgreement({ selector: "#agree-widget", variantKey: "AGREEMENT" }),
        ]);
        setWidgets(w);
      } catch (e: any) { setErr("위젯 렌더 실패: " + (e?.message ?? String(e))); }
    })();
  }, [order, user]);

  const onPay = async () => {
    if (!widgets || !order || !product || !user) return;
    setBusy(true);
    try {
      await widgets.requestPayment({
        orderId: order.order_no,
        orderName: product.name,
        successUrl: window.location.origin + "/checkout/success",
        failUrl: window.location.origin + "/checkout/fail",
        customerEmail: user.email,
        customerName: user.nickname ?? user.email,
      });
    } catch (e: any) { setErr("결제 요청 실패: " + (e?.message ?? String(e))); setBusy(false); }
  };

  if (err) return (
    <div className="max-w-md mx-auto py-16 text-center">
      <p className="text-red-600 mb-4">{err}</p>
      <button className="btn btn-outline" onClick={() => router.back()}>돌아가기</button>
    </div>
  );
  if (!product || !order) return <div className="py-16 text-center text-zinc-500">결제 정보 준비 중…</div>;

  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-black mb-5">결제</h1>

      <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 mb-6">
        <div className="w-16 h-16 rounded-md bg-zinc-200 overflow-hidden shrink-0">
          {product.image_urls?.[0] && <img src={product.image_urls[0]} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-zinc-500">{product.category ?? "—"}</div>
          <div className="font-semibold text-sm truncate">{product.name}</div>
        </div>
        <div className="font-black">{fmtPrice(product.price)}</div>
      </div>

      <section className="mb-3"><div id="pm-widget" /></section>
      <section className="mb-5"><div id="agree-widget" /></section>

      <div className="border-t border-zinc-200 pt-4 mb-3 flex items-baseline justify-between">
        <span className="text-sm text-zinc-500">총 결제금액</span>
        <span className="text-2xl font-black">{fmtPrice(product.price)}</span>
      </div>
      <div className="text-[11px] text-zinc-400 mb-4 break-all">주문번호: {order.order_no}</div>

      <button onClick={onPay} disabled={!widgets || busy} className="btn btn-primary btn-lg w-full">
        {busy ? "결제 진행 중…" : "결제하기"}
      </button>
      <p className="text-[11px] text-zinc-400 mt-3 leading-relaxed">
        테스트 키로 운영 중입니다. 실제 결제는 발생하지 않아요.<br/>
        테스트 카드: 4330-1234-1234-1234 (CVC/만료/생년월일 임의)
      </p>
    </div>
  );
}
