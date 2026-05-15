"use client";

import { useSearchParams, useRouter } from "next/navigation";

export default function CheckoutFailPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const code = sp.get("code");
  const message = sp.get("message");
  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <div className="text-5xl mb-3">❌</div>
      <h1 className="text-2xl font-black mb-2">결제가 취소되었거나 실패했어요</h1>
      {message && <p className="text-sm text-red-600 mb-2">{message}</p>}
      {code && <p className="text-xs text-zinc-400 mb-6">코드: {code}</p>}
      <div className="flex gap-2 justify-center">
        <button onClick={() => router.push("/store")} className="btn btn-outline">스토어로</button>
        <button onClick={() => router.back()} className="btn btn-primary">다시 시도</button>
      </div>
    </div>
  );
}
