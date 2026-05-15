"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setErr(/Invalid login/.test(error.message) ? "이메일 또는 비밀번호가 일치하지 않아요." : error.message); setBusy(false); return; }
    router.refresh();
    router.push("/");
  };

  const quick = async (e: string, p: string) => {
    setEmail(e); setPassword(p);
    setBusy(true); setErr("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
    if (error) { setErr(error.message); setBusy(false); return; }
    router.refresh();
    router.push("/");
  };

  return (
    <div className="max-w-sm mx-auto py-16">
      <h1 className="text-2xl font-black mb-1">로그인</h1>
      <p className="text-sm text-zinc-500 mb-6">이메일과 비밀번호를 입력해 주세요.</p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div><label className="label">이메일</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label className="label">비밀번호</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button className="btn btn-primary w-full btn-lg" disabled={busy}>{busy ? "로그인 중…" : "로그인"}</button>
      </form>
      <div className="mt-4 text-sm text-zinc-500">계정이 없으신가요? <Link href="/signup" className="font-semibold text-zinc-900">회원가입</Link></div>
      <div className="mt-6 pt-6 border-t border-zinc-200 space-y-2 text-xs">
        <div className="text-zinc-500">데모 빠른 로그인:</div>
        <button type="button" onClick={() => quick("home@ohou.test", "Passw0rd!2026")} className="btn btn-outline w-full">홈데코로 로그인</button>
        <button type="button" onClick={() => quick("jay@ohou.test", "Passw0rd!2026")} className="btn btn-outline w-full">모던제이로 로그인</button>
      </div>
    </div>
  );
}
