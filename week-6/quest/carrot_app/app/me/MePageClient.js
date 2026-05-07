'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductRow from '@/components/ProductRow';
import { signOut, updateRegion } from '@/app/auth/actions';
import { detectKoreanRegion } from '@/lib/geo';

export default function MePageClient({ profile, mineCount, favCount, mine, favs, tab }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [region, setRegion] = useState(profile?.region || '');
  const [busy, start] = useTransition();
  const [detecting, setDetecting] = useState(false);
  const [msg, setMsg] = useState('');

  const detect = async () => {
    setMsg(''); setDetecting(true);
    try {
      const name = await detectKoreanRegion();
      setRegion(name);
    } catch (e) {
      setMsg(e.message);
    } finally {
      setDetecting(false);
    }
  };

  const setTab = (next) => {
    const params = new URLSearchParams(sp);
    params.set('tab', next);
    router.replace(`/me?${params.toString()}`);
  };

  const saveRegion = () => {
    setMsg('');
    start(async () => {
      const fd = new FormData(); fd.set('region', region);
      const r = await updateRegion(fd);
      if (r?.error) setMsg(r.error);
      else { setMsg('저장됨'); router.refresh(); }
    });
  };

  const list = tab === 'favs' ? favs : mine;
  const empty = tab === 'favs' ? '관심 등록한 상품이 없어요' : '등록한 상품이 없어요';

  return (
    <div className="space-y-3 mt-3">
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-200 to-orange-400 text-white text-2xl font-bold flex items-center justify-center shadow-inner">{profile?.nickname?.[0] || '🥕'}</div>
          <div className="flex-1 min-w-0">
            <div className="font-extrabold text-lg">{profile?.nickname || '-'}</div>
            <div className="text-xs text-gray-500 truncate">{profile?.email}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              <span>매너온도</span>
              <span>36.5°C</span>
            </div>
          </div>
          <form action={signOut}>
            <button className="text-xs text-gray-500 px-3 py-1.5 rounded-full border border-[color:var(--line)] pressable">로그아웃</button>
          </form>
        </div>
      </div>

      <div className="card p-4">
        <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><span>📍</span> 내 동네 설정</div>
        <div className="flex gap-2">
          <input className="flex-1 border border-[color:var(--line)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--carrot)]" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="예: 강남구 역삼동" />
          <button type="button" onClick={detect} disabled={detecting} className="rounded-xl px-3 py-2.5 text-sm font-semibold border border-[color:var(--line)] bg-[color:var(--carrot-soft)] text-[color:var(--carrot)] pressable disabled:opacity-60">{detecting ? '감지중…' : '📍 인증'}</button>
          <button onClick={saveRegion} disabled={busy} className="btn-carrot rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60">{busy ? '저장 중…' : '저장'}</button>
        </div>
        {msg && <div className="text-xs mt-2 text-gray-500">{msg}</div>}
      </div>

      <div className="card overflow-hidden">
        <div className="flex border-b border-[color:var(--line)]">
          <button onClick={() => setTab('mine')} className={`flex-1 py-3.5 text-sm pressable ${tab === 'mine' ? 'text-[color:var(--carrot)] border-b-2 border-[color:var(--carrot)] font-bold' : 'text-gray-500'}`}>내 상품 ({mineCount})</button>
          <button onClick={() => setTab('favs')} className={`flex-1 py-3.5 text-sm pressable ${tab === 'favs' ? 'text-[color:var(--carrot)] border-b-2 border-[color:var(--carrot)] font-bold' : 'text-gray-500'}`}>관심 ({favCount})</button>
        </div>
        {list.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">{empty}</div>
        ) : (
          <ul className="divide-y divide-[color:var(--line)]">
            {list.map((p) => <ProductRow key={p.id} p={p} />)}
          </ul>
        )}
      </div>
    </div>
  );
}
