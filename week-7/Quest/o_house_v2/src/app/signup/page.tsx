"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const supabase = createClient();
    const nn = (nickname || email.split("@")[0] || "user").trim();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nickname: nn } } });
    if (error) {
      const m = error.message || "";
      setErr(/already registered|exists/i.test(m) ? "이미 가입된 이메일이에요. 로그인 해 주세요." : m);
      setBusy(false); return;
    }
    if (data.user) {
      await supabase.from("profiles").upsert({ id: data.user.id, nickname: nn }, { onConflict: "id" });
    }
    router.refresh();
    router.push("/onboarding");
  };

  return (
    <div className="max-w-sm mx-auto py-16">
      <h1 className="text-2xl font-black mb-1">회원가입</h1>
      <p className="text-sm text-zinc-500 mb-6">새 계정을 만들어요.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div><label className="label">이메일</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label className="label">비밀번호</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></div>
        <div><label className="label">닉네임 (선택)</label><input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="홈데코" /></div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button className="btn btn-primary w-full btn-lg" disabled={busy}>{busy ? "가입 중…" : "가입하기"}</button>
      </form>
      <div className="mt-4 text-sm text-zinc-500">이미 계정이 있나요? <Link href="/login" className="font-semibold text-zinc-900">로그인</Link></div>
    </div>
  );
}
