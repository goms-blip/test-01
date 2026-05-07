'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { signIn } from '@/app/auth/actions';

export default function LoginPage() {
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  return (
    <div className="mt-8 card p-7">
      <div className="text-5xl mb-3 text-center">🥕</div>
      <h1 className="text-2xl font-extrabold tracking-tight text-center">당근에 오신 걸 환영해요</h1>
      <p className="text-sm text-gray-500 mt-1.5 mb-7 text-center">이메일로 로그인</p>
      <form
        action={(fd) => start(async () => {
          setErr('');
          const r = await signIn(fd);
          if (r?.error) setErr(r.error);
        })}
        className="space-y-2.5"
      >
        <input name="email" type="email" required placeholder="이메일" className="w-full border border-[color:var(--line)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[color:var(--carrot)]" />
        <input name="password" type="password" required placeholder="비밀번호" className="w-full border border-[color:var(--line)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[color:var(--carrot)]" />
        {err && <div className="text-sm text-red-500 px-1">{err}</div>}
        <button disabled={pending} className="w-full btn-carrot rounded-xl py-3 font-semibold mt-1 disabled:opacity-60">
          {pending ? '로그인 중…' : '로그인'}
        </button>
      </form>
      <Link href="/signup" className="block w-full mt-4 text-sm text-gray-500 text-center">
        계정이 없으신가요? <span className="font-semibold text-[color:var(--carrot)]">회원가입</span>
      </Link>
    </div>
  );
}
