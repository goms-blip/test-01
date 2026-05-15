"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function CheckoutSuccessPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const [phase, setPhase] = useState<"confirming" | "ok" | "error">("confirming");
  const [info, setInfo] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const paymentKey = sp.get("paymentKey");
    const orderId = sp.get("orderId");
    const amount = sp.get("amount");
    if (!paymentKey || !orderId || !amount) { setErr("결제 정보가 없습니다."); setPhase("error"); return; }

    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken) throw new Error("세션이 만료되었습니다. 다시 로그인해 주세요.");
        const res = await fetch("/api/toss/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentKey, orderId, amount, accessToken }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.message || j.detail || j.error || "결제 승인 실패");
        setInfo({ orderId, paymentKey, method: j.method, amount });
        setPhase("ok");
      } catch (e: any) { setErr(e.message); setPhase("error"); }
    })();
  }, [sp]);

  return (
    <div className="max-w-md mx-auto py-16 text-center">
      {phase === "confirming" && (<><div className="text-5xl mb-3">⏳</div><h1 className="text-xl font-black mb-2">결제 확인 중…</h1></>)}
      {phase === "ok" && (
        <>
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-2xl font-black mb-2">결제가 완료됐어요</h1>
          <p className="text-sm text-zinc-500 mb-4">{Number(info?.amount).toLocaleString()}원 · {info?.method ?? "카드"}</p>
          <div className="text-xs text-zinc-400 break-all mb-6">주문번호: {info?.orderId}</div>
          <div className="flex gap-2 justify-center">
            <Link href="/me?tab=orders" className="btn btn-primary">구매 내역 보기</Link>
            <Link href="/store" className="btn btn-outline">스토어로</Link>
          </div>
        </>
      )}
      {phase === "error" && (
        <>
          <div className="text-5xl mb-3">⚠️</div>
          <h1 className="text-xl font-black mb-2">결제 확인 실패</h1>
          <p className="text-sm text-red-600 mb-6">{err}</p>
          <button onClick={() => router.push("/store")} className="btn btn-outline">스토어로</button>
        </>
      )}
    </div>
  );
}
