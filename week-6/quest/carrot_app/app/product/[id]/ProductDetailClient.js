'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fmtPrice, fmtTime, statusLabel } from '@/lib/format';

export default function ProductDetailClient({ item, seller, favCount, initialFavorited, meId }) {
  const router = useRouter();
  const supabase = createClient();
  const [imgIdx, setImgIdx] = useState(0);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [favCnt, setFavCnt] = useState(favCount);
  const [status, setStatus] = useState(item.status);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  const isOwner = meId && meId === item.seller_id;
  const imgs = item.images?.length ? item.images : null;

  const toggleFav = () => {
    if (!meId) return router.push('/login');
    start(async () => {
      try {
        if (favorited) {
          const { error } = await supabase
            .from('carrot_favorites')
            .delete()
            .eq('product_id', item.id)
            .eq('user_id', meId);
          if (error) throw error;
          setFavorited(false); setFavCnt((n) => Math.max(0, n - 1));
        } else {
          const { error } = await supabase
            .from('carrot_favorites')
            .insert({ product_id: item.id, user_id: meId });
          if (error) throw error;
          setFavorited(true); setFavCnt((n) => n + 1);
        }
      } catch (e) { setErr(e.message); }
    });
  };

  const startChat = () => {
    if (!meId) return router.push('/login');
    if (isOwner) return alert('본인 상품과는 채팅할 수 없어요');
    start(async () => {
      try {
        // upsert into chat_rooms (unique on product_id, buyer_id)
        const { data: existing } = await supabase
          .from('carrot_chat_rooms')
          .select('id')
          .eq('product_id', item.id)
          .eq('buyer_id', meId)
          .maybeSingle();
        let roomId = existing?.id;
        if (!roomId) {
          const { data, error } = await supabase
            .from('carrot_chat_rooms')
            .insert({ product_id: item.id, buyer_id: meId, seller_id: item.seller_id })
            .select('id')
            .single();
          if (error) throw error;
          roomId = data.id;
        }
        router.push(`/chat/${roomId}`);
      } catch (e) { setErr(e.message); }
    });
  };

  const removeProduct = () => {
    if (!confirm('정말 삭제할까요?')) return;
    start(async () => {
      const { error } = await supabase.from('carrot_products').delete().eq('id', item.id);
      if (error) return setErr(error.message);
      router.push('/');
      router.refresh();
    });
  };

  const updateStatus = (next) => {
    setStatus(next);
    start(async () => {
      const { error } = await supabase.from('carrot_products').update({ status: next }).eq('id', item.id);
      if (error) setErr(error.message);
      router.refresh();
    });
  };

  const statusBadgeClass = status === 'reserved' ? 'badge badge-rsv' : status === 'sold' ? 'badge badge-sold' : 'badge badge-on';

  return (
    <div className="-mx-4 sm:mx-0 card overflow-hidden mt-2">
      <div className="aspect-square bg-gradient-to-br from-orange-50 to-orange-100 relative flex items-center justify-center text-6xl">
        {imgs ? (
          <>
            <img src={imgs[imgIdx]} alt="" className="w-full h-full object-cover" />
            {imgs.length > 1 && (
              <>
                <button onClick={() => setImgIdx((imgIdx - 1 + imgs.length) % imgs.length)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/45 hover:bg-black/60 text-white w-9 h-9 rounded-full text-lg">‹</button>
                <button onClick={() => setImgIdx((imgIdx + 1) % imgs.length)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/45 hover:bg-black/60 text-white w-9 h-9 rounded-full text-lg">›</button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {imgs.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIdx ? 'bg-white' : 'bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
            {status !== 'on_sale' && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                <span className="text-white text-2xl font-bold tracking-wider">{statusLabel(status)}</span>
              </div>
            )}
          </>
        ) : <span>🥕</span>}
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3 pb-4 border-b border-[color:var(--line)]">
          <div className="w-11 h-11 rounded-full bg-orange-100 text-[color:var(--carrot)] font-bold flex items-center justify-center">{seller?.nickname?.[0] || '🥕'}</div>
          <div>
            <div className="font-semibold">{seller?.nickname || '알 수 없음'}</div>
            <div className="text-xs text-gray-500">📍 {seller?.region || '-'}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10px] text-gray-400">매너온도</div>
            <div className="text-sm font-bold text-emerald-500">36.5°C</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-4">
          <span className={statusBadgeClass}>{statusLabel(status)}</span>
          <span className="text-[12px] text-gray-400">{item.category}</span>
        </div>
        <h1 className="text-[22px] font-extrabold mt-1.5 leading-snug">{item.title}</h1>
        <div className="text-[12px] text-gray-400 mt-1">{fmtTime(item.created_at)}</div>
        <div className="text-2xl font-extrabold mt-3">{fmtPrice(item.price)}</div>
        <div className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">{item.description || ' '}</div>
        <div className="text-xs text-gray-400 mt-5 flex items-center gap-3">
          <span>💗 관심 {favCnt}</span>
        </div>
        {err && <div className="mt-3 text-sm text-red-500">{err}</div>}
      </div>

      <div className="sticky bottom-[60px] bg-white/95 backdrop-blur border-t border-[color:var(--line)] px-4 py-3 flex items-center gap-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
        <button onClick={toggleFav} disabled={pending} className="text-2xl pressable">
          {favorited ? '💖' : '🤍'}
        </button>
        <div className="h-7 w-px bg-gray-200" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-gray-400">{favorited ? '관심 등록됨' : '가격'}</div>
          <div className="font-extrabold truncate">{fmtPrice(item.price)}</div>
        </div>
        {isOwner ? (
          <div className="flex gap-1.5">
            <select value={status} onChange={(e) => updateStatus(e.target.value)} className="border border-[color:var(--line)] rounded-xl px-2 py-2 text-sm bg-white">
              <option value="on_sale">판매중</option>
              <option value="reserved">예약중</option>
              <option value="sold">거래완료</option>
            </select>
            <button onClick={() => router.push(`/edit/${item.id}`)} className="px-3 py-2 rounded-xl border border-[color:var(--line)] text-sm font-semibold">수정</button>
            <button onClick={removeProduct} className="px-3 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-semibold">삭제</button>
          </div>
        ) : (
          <button onClick={startChat} disabled={pending} className="btn-carrot rounded-xl px-5 py-3 font-semibold disabled:opacity-60">채팅하기</button>
        )}
      </div>
    </div>
  );
}
