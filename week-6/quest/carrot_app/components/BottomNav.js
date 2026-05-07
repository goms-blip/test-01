'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav({ loggedIn }) {
  const pathname = usePathname() || '/';
  const tab = (icon, label, to, active) => (
    <Link
      key={to}
      href={to}
      className={`flex-1 flex flex-col items-center justify-center py-2.5 pressable ${active ? 'text-[color:var(--carrot)]' : 'text-gray-400'}`}
    >
      <span className={`text-[20px] leading-none ${active ? 'scale-110' : ''} transition-transform`}>{icon}</span>
      <span className={`text-[11px] mt-1 ${active ? 'font-semibold' : ''}`}>{label}</span>
    </Link>
  );
  const showFab = loggedIn && !pathname.startsWith('/chat/') && !pathname.startsWith('/post');
  return (
    <>
      {showFab && (
        <Link
          href="/post"
          className="fixed bottom-20 right-4 z-30 btn-carrot rounded-full w-14 h-14 shadow-xl text-3xl flex items-center justify-center pressable"
          style={{ boxShadow: '0 10px 22px -6px rgba(255, 126, 54, 0.55)' }}
        >＋</Link>
      )}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-[color:var(--line)] z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-3xl mx-auto flex">
          {tab('🏠', '홈', '/', pathname === '/')}
          {tab('💬', '채팅', '/chats', pathname.startsWith('/chat'))}
          {tab('👤', '나의 당근', '/me', pathname === '/me')}
        </div>
      </nav>
    </>
  );
}
