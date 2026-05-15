"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UserMenu({ nickname, email, avatar }: { nickname: string | null; email: string; avatar: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const onLogout = async () => {
    setOpen(false);
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) localStorage.removeItem(k);
      });
    } catch {}
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    window.location.href = "/";
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="w-10 h-10 rounded-full bg-zinc-100 grid place-items-center overflow-hidden">
        {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-semibold">{(nickname ?? email)[0]?.toUpperCase()}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl border border-zinc-200 shadow-lg py-1.5 text-sm">
          <div className="px-3 py-2 border-b border-zinc-100">
            <div className="font-semibold truncate">{nickname ?? email.split("@")[0]}</div>
            <div className="text-xs text-zinc-500 truncate">{email}</div>
          </div>
          <Link href="/me" onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-zinc-50">마이페이지</Link>
          <Link href="/admin" onClick={() => setOpen(false)} className="block px-3 py-2 hover:bg-zinc-50">관리자</Link>
          <button onClick={onLogout} className="w-full text-left px-3 py-2 hover:bg-zinc-50">로그아웃</button>
        </div>
      )}
    </div>
  );
}
