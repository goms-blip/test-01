import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtTime, fmtPrice, regionToken } from '@/lib/format';
import EmptyState from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

export default async function ChatListPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rooms = [] } = await supabase
    .from('carrot_chat_rooms')
    .select('id, product_id, buyer_id, seller_id, created_at')
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  const productIds = [...new Set(rooms.map((r) => r.product_id))];
  const userIds = [...new Set(rooms.flatMap((r) => [r.buyer_id, r.seller_id]))];

  const [prods, profs, lastMsgs] = await Promise.all([
    productIds.length
      ? supabase.from('carrot_products').select('id, title, price, images').in('id', productIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase.from('carrot_profiles').select('id, nickname, region').in('id', userIds)
      : Promise.resolve({ data: [] }),
    rooms.length
      ? supabase.from('carrot_chat_messages').select('room_id, text, created_at').in('room_id', rooms.map((r) => r.id)).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const prodMap = Object.fromEntries((prods.data || []).map((p) => [p.id, p]));
  const profMap = Object.fromEntries((profs.data || []).map((p) => [p.id, p]));
  const lastMap = {};
  for (const m of (lastMsgs.data || [])) {
    if (!lastMap[m.room_id]) lastMap[m.room_id] = m;
  }

  const enriched = rooms.map((r) => {
    const partner = r.buyer_id === user.id ? profMap[r.seller_id] : profMap[r.buyer_id];
    const last = lastMap[r.id];
    return {
      id: r.id,
      product: prodMap[r.product_id],
      partner,
      last_text: last?.text || '',
      last_at: last?.created_at || r.created_at,
    };
  }).sort((a, b) => (a.last_at < b.last_at ? 1 : -1));

  if (!enriched.length) {
    return (
      <div className="mt-2">
        <h1 className="px-1 pt-3 pb-2 text-lg font-extrabold">채팅</h1>
        <EmptyState
          emoji="💬"
          title="아직 채팅이 없어요"
          desc="상품 상세 페이지에서 '채팅하기' 버튼으로 대화를 시작해보세요"
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="px-1 pt-3 pb-2 text-lg font-extrabold">채팅</h1>
      <ul className="card divide-y divide-[color:var(--line)] overflow-hidden">
        {enriched.map((r) => (
          <li key={r.id}>
            <Link href={`/chat/${r.id}`} className="w-full flex gap-3 p-3.5 text-left hover:bg-gray-50 pressable">
              <div className="w-12 h-12 rounded-full bg-orange-100 text-[color:var(--carrot)] font-bold flex items-center justify-center">{r.partner?.nickname?.[0] || '🥕'}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold truncate">{r.partner?.nickname || '알 수 없음'}</span>
                  <span className="text-[11px] text-gray-400">· {regionToken(r.partner?.region || '')}</span>
                  <span className="text-[11px] text-gray-400 ml-auto pl-2">{fmtTime(r.last_at)}</span>
                </div>
                <div className="text-sm text-gray-500 truncate mt-0.5">{r.last_text || '대화를 시작해보세요'}</div>
              </div>
              {r.product?.images?.[0] ? (
                <img src={r.product.images[0]} className="w-12 h-12 object-cover rounded-lg" alt="" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center text-xl">🥕</div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
