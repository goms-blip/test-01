import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import UserMenu from "./user-menu";

export default async function Header() {
  noStore(); // 매 요청마다 fresh — 로그인 직후 stale 헤더 방지
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null as null | { nickname: string | null; avatar_url: string | null; role: string | null };
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("nickname, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle();
    profile = data ?? { nickname: user.email?.split("@")[0] ?? null, avatar_url: null, role: null };
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-zinc-200">
      <div className="max-w-7xl mx-auto h-16 px-4 flex items-center gap-6">
        <Link href="/" className="font-black text-lg tracking-tight">오늘의집 <span className="text-zinc-400 text-xs">v2</span></Link>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/" className="px-3 h-10 inline-flex items-center font-semibold rounded-lg hover:bg-zinc-100">둘러보기</Link>
          <Link href="/store" className="px-3 h-10 inline-flex items-center font-semibold rounded-lg hover:bg-zinc-100">스토어</Link>
          <Link href="/admin" className="px-3 h-10 inline-flex items-center font-semibold rounded-lg hover:bg-zinc-100">관리자</Link>
        </nav>
        <div className="flex-1" />
        {user ? (
          <UserMenu nickname={profile?.nickname ?? null} email={user.email ?? ""} avatar={profile?.avatar_url ?? null} />
        ) : (
          <div className="flex items-center gap-1">
            <Link href="/login" className="btn btn-ghost">로그인</Link>
            <Link href="/signup" className="btn btn-primary">회원가입</Link>
          </div>
        )}
      </div>
    </header>
  );
}
