'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ProductRow from '@/components/ProductRow';
import EmptyState from '@/components/EmptyState';
import { CATEGORIES, regionToken } from '@/lib/format';

export default function HomeClient({ initialItems, me, initialScope, initialCat, initialQ }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [cat, setCat] = useState(initialCat);
  const [scope, setScope] = useState(initialScope);
  const [pending, start] = useTransition();

  const apply = (next = {}) => {
    const sp = new URLSearchParams();
    const _q = next.q ?? q;
    const _cat = next.cat ?? cat;
    const _scope = next.scope ?? scope;
    if (_q) sp.set('q', _q);
    if (_cat && _cat !== '전체') sp.set('c', _cat);
    if (_scope) sp.set('scope', _scope);
    start(() => router.push(`/?${sp.toString()}`));
  };

  const cats = ['전체', ...CATEGORIES];
  const items = initialItems;

  return (
    <div className="pb-2">
      <div className="sticky top-14 z-10 bg-[color:var(--bg)] -mx-4 px-4 pt-3 pb-3">
        <form
          onSubmit={(e) => { e.preventDefault(); apply({}); }}
          className="relative mb-2.5"
        >
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">🔍</span>
          <input
            className="w-full bg-white border border-[color:var(--line)] rounded-full pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--carrot)]"
            placeholder={me?.region ? `${regionToken(me.region)}에서 무엇을 찾으세요?` : '어떤 상품을 찾으세요?'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button type="button" onClick={() => { setQ(''); apply({ q: '' }); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-xs">×</button>
          )}
        </form>

        {me?.region && (
          <div className="flex gap-1.5 mb-2">
            <button
              onClick={() => { setScope('mine'); apply({ scope: 'mine' }); }}
              className={`px-3 h-8 rounded-full text-[13px] font-semibold pressable ${scope === 'mine' ? 'bg-[color:var(--carrot)] text-white' : 'bg-white border border-[color:var(--line)] text-gray-700'}`}
            >📍 내 동네</button>
            <button
              onClick={() => { setScope('all'); apply({ scope: 'all' }); }}
              className={`px-3 h-8 rounded-full text-[13px] font-semibold pressable ${scope === 'all' ? 'bg-[color:var(--carrot)] text-white' : 'bg-white border border-[color:var(--line)] text-gray-700'}`}
            >전체 동네</button>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => { setCat(c); apply({ cat: c }); }}
              className={`shrink-0 px-3.5 h-8 rounded-full text-[13px] pressable ${cat === c ? 'bg-gray-900 text-white' : 'bg-white border border-[color:var(--line)] text-gray-600'}`}
            >{c}</button>
          ))}
        </div>
      </div>

      <div className="px-1 pt-1 pb-1 text-xs text-gray-400 flex items-center gap-2">
        <span>{pending ? '...' : `${items.length}개 상품`}</span>
        {scope === 'mine' && me?.region && <span>· 📍 {me.region}</span>}
      </div>

      {items.length === 0 ? (
        <EmptyState
          emoji="🥕"
          title="아직 상품이 없어요"
          desc={scope === 'mine' && me?.region ? `${me.region}에 등록된 상품이 없어요.` : '조건에 맞는 상품이 없어요'}
          action={me ? { label: '+ 상품 등록하기', onClick: () => router.push('/post') } : null}
          secondary={scope === 'mine' ? { label: '전체 동네 보기', onClick: () => { setScope('all'); apply({ scope: 'all' }); } } : null}
        />
      ) : (
        <ul className="card divide-y divide-[color:var(--line)] overflow-hidden">
          {items.map((p) => <ProductRow key={p.id} p={p} />)}
        </ul>
      )}
    </div>
  );
}
