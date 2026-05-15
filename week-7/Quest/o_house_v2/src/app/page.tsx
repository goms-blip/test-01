import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SPACES, STYLES } from "@/lib/types";

export const revalidate = 0;

export default async function FeedPage({ searchParams }: { searchParams: { space?: string; style?: string; q?: string } }) {
  const supabase = createClient();
  let q = supabase
    .from("photos")
    .select("id, title, description, space, style, area_pyeong, image_urls, scrap_count, created_at, author:profiles!photos_author_id_fkey(id, nickname, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(60);
  if (searchParams.space) q = q.eq("space", searchParams.space);
  if (searchParams.style) q = q.eq("style", searchParams.style);
  if (searchParams.q) q = q.ilike("title", `%${searchParams.q}%`);
  const { data: photos } = await q;

  const Chip = ({ active, href, label }: { active: boolean; href: string; label: string }) => (
    <Link href={href} className={`chip ${active ? "chip-on" : "chip-off"}`}>{label}</Link>
  );
  const buildHref = (k: "space" | "style", v: string | null) => {
    const p = new URLSearchParams();
    if (k === "space" ? v : searchParams.space) p.set("space", k === "space" ? v! : searchParams.space!);
    if (k === "style" ? v : searchParams.style) p.set("style", k === "style" ? v! : searchParams.style!);
    if (searchParams.q) p.set("q", searchParams.q);
    return p.toString() ? `/?${p}` : "/";
  };

  return (
    <div className="py-8">
      <section className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-zinc-100 to-white border border-zinc-200">
        <h1 className="text-2xl font-black mb-1">오늘의 인테리어 영감, 한곳에</h1>
        <p className="text-sm text-zinc-600">사진을 누르면 사용된 가구와 소품을 바로 볼 수 있어요.</p>
      </section>

      <div className="space-y-3 mb-6">
        <div>
          <div className="text-xs text-zinc-500 mb-2">공간</div>
          <div className="flex flex-wrap gap-2">
            <Chip active={!searchParams.space} href={buildHref("space", null)} label="전체" />
            {SPACES.map((s) => <Chip key={s} active={searchParams.space === s} href={buildHref("space", s)} label={s} />)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 mb-2">스타일</div>
          <div className="flex flex-wrap gap-2">
            <Chip active={!searchParams.style} href={buildHref("style", null)} label="전체" />
            {STYLES.map((s) => <Chip key={s} active={searchParams.style === s} href={buildHref("style", s)} label={s} />)}
          </div>
        </div>
      </div>

      {!photos || photos.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">검색 결과가 없어요</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((p: any) => (
            <Link key={p.id} href={`/photo/${p.id}`} className="group">
              <div className="aspect-square rounded-xl overflow-hidden bg-zinc-100">
                {p.image_urls?.[0] && <img src={p.image_urls[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition" />}
              </div>
              <div className="mt-2 text-sm font-semibold truncate">{p.title}</div>
              <div className="text-xs text-zinc-500 truncate">{p.author?.nickname ?? "—"}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
