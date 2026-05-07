'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { signUp } from '@/app/auth/actions';
import { detectKoreanRegion } from '@/lib/geo';

export default function SignupPage() {
  const [err, setErr] = useState('');
  const [region, setRegion] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [pending, start] = useTransition();

  const detect = async () => {
    setErr(''); setDetecting(true);
    try {
      const name = await detectKoreanRegion();
      setRegion(name);
    } catch (e) {
      setErr(e.message);
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="mt-8 card p-7">
      <h1 className="text-2xl font-extrabold tracking-tight">회원가입</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">동네를 설정하면 근처 이웃과 거래할 수 있어요</p>
      <form
        action={(fd) => start(async () => {
          setErr('');
          fd.set('region', region);
          const r = await signUp(fd);
          if (r?.error) setErr(r.error);
        })}
        className="space-y-2.5"
      >
        <input name="email" type="email" required placeholder="이메일" className="w-full border border-[color:var(--line)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[color:var(--carrot)]" />
        <input name="password" type="password" required minLength={6} placeholder="비밀번호 (6자 이상)" className="w-full border border-[color:var(--line)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[color:var(--carrot)]" />
        <input name="nickname" placeholder="닉네임" className="w-full border border-[color:var(--line)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[color:var(--carrot)]" />
        <div className="flex gap-2">
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="동네 (예: 강남구 역삼동)"
            className="flex-1 border border-[color:var(--line)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[color:var(--carrot)]"
          />
          <button type="button" onClick={detect} disabled={detecting} className="px-3.5 rounded-xl border border-[color:var(--line)] text-sm bg-[color:var(--carrot-soft)] text-[color:var(--carrot)] font-semibold pressable disabled:opacity-60">{detecting ? '감지 중…' : '📍 인증'}</button>
        </div>
        {err && <div className="text-sm text-red-500 px-1">{err}</div>}
        <button disabled={pending} className="w-full btn-carrot rounded-xl py-3 font-semibold mt-2 disabled:opacity-60">
          {pending ? '가입 중…' : '가입하기'}
        </button>
      </form>
      <Link href="/login" className="block w-full mt-4 text-sm text-gray-500 text-center">
        이미 계정이 있나요? <span className="font-semibold text-[color:var(--carrot)]">로그인</span>
      </Link>
    </div>
  );
}
