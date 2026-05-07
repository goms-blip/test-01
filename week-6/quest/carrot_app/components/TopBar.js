import Link from 'next/link';

export default function TopBar({ profile }) {
  const region = profile?.region || '';
  return (
    <header className="sticky top-0 z-20 backdrop-blur bg-white/90 border-b border-[color:var(--line)]">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-2">
        <Link href="/" className="text-xl font-extrabold tracking-tight pressable">
          🥕 <span className="text-[color:var(--carrot)]">당근</span>
        </Link>
        <Link
          href="/me"
          className="ml-1 inline-flex items-center gap-1 px-2.5 h-8 rounded-full bg-[color:var(--carrot-soft)] text-[13px] font-semibold text-[color:var(--carrot)] pressable max-w-[55%] truncate"
        >
          <span className="text-[12px]">📍</span>
          <span className="truncate">{region || '동네 설정하기'}</span>
          <span className="opacity-60 text-[11px]">▾</span>
        </Link>
        <div className="flex-1" />
        {profile ? (
          <Link href="/me" className="w-9 h-9 rounded-full bg-orange-100 text-[color:var(--carrot)] font-bold flex items-center justify-center pressable">
            {profile.nickname?.[0] || '🥕'}
          </Link>
        ) : (
          <Link href="/login" className="text-sm font-semibold text-[color:var(--carrot)] px-3 py-1.5 rounded-full bg-[color:var(--carrot-soft)] pressable">
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}
