import Link from 'next/link';
import { fmtPrice, fmtTime, statusLabel } from '@/lib/format';

export default function ProductRow({ p }) {
  const img = p.images?.[0];
  return (
    <li>
      <Link href={`/product/${p.id}`} className="w-full text-left flex gap-3 p-3 hover:bg-gray-50 pressable">
        <div className="relative w-24 h-24 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 overflow-hidden shrink-0 flex items-center justify-center text-3xl">
          {img
            ? <img src={img} alt="" className="w-full h-full object-cover" />
            : <span>🥕</span>}
          {p.status === 'sold' && (
            <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-xs font-semibold tracking-wide">거래완료</div>
          )}
          {p.status === 'reserved' && (
            <div className="absolute top-1.5 left-1.5 badge badge-rsv">예약중</div>
          )}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="font-medium truncate text-[15px] leading-snug">{p.title}</div>
          <div className="text-[12px] text-gray-500 mt-1 truncate">
            <span>{p.region || '동네 미정'}</span>
            <span className="mx-1">·</span>
            <span>{fmtTime(p.created_at)}</span>
          </div>
          <div className="font-extrabold text-[15px] mt-1.5">{fmtPrice(p.price)}</div>
        </div>
      </Link>
    </li>
  );
}
