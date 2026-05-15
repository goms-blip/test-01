import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtPrice } from "@/lib/types";

export const revalidate = 0;

export default async function PhotoDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("*, author:profiles!photos_author_id_fkey(*)")
    .eq("id", params.id)
    .maybeSingle();

  if (!photo) notFound();

  const { data: tags } = await supabase
    .from("photo_tags")
    .select("*, product:products(*)")
    .eq("photo_id", params.id);

  const { data: comments } = await supabase
    .from("comments")
    .select("*, author:profiles!comments_author_id_fkey(nickname, avatar_url)")
    .eq("photo_id", params.id)
    .order("created_at");

  return (
    <div className="py-8 grid md:grid-cols-[1fr_360px] gap-8">
      <div>
        <div className="relative rounded-2xl overflow-hidden bg-zinc-100">
          {photo.image_urls?.[0] && <img src={photo.image_urls[0]} alt={photo.title} className="w-full aspect-square object-cover" />}
          {(tags ?? []).filter((t: any) => (t.image_index ?? 0) === 0).map((t: any) => (
            <div key={t.id}
              className="absolute w-7 h-7 rounded-full bg-white border-2 border-zinc-900 grid place-items-center text-xs font-bold shadow-lg -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(t.pos_x ?? 0.5) * 100}%`, top: `${(t.pos_y ?? 0.5) * 100}%` }}>
              +
            </div>
          ))}
        </div>
        <h1 className="text-2xl font-black mt-5">{photo.title}</h1>
        <div className="flex gap-2 mt-2 text-xs">
          {photo.space && <span className="px-2 py-1 rounded-md bg-zinc-100">#{photo.space}</span>}
          {photo.style && <span className="px-2 py-1 rounded-md bg-zinc-100">#{photo.style}</span>}
          {photo.area_pyeong && <span className="px-2 py-1 rounded-md bg-zinc-100">#{photo.area_pyeong}평</span>}
        </div>
        <p className="text-sm text-zinc-600 mt-4 whitespace-pre-line">{photo.description}</p>

        <section className="mt-8">
          <h2 className="text-sm font-bold mb-3">댓글 {comments?.length ?? 0}</h2>
          <ul className="space-y-3">
            {(comments ?? []).map((c: any) => (
              <li key={c.id} className="flex gap-3 p-3 rounded-lg bg-zinc-50">
                <div className="w-8 h-8 rounded-full bg-zinc-200 shrink-0 overflow-hidden">
                  {c.author?.avatar_url && <img src={c.author.avatar_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{c.author?.nickname ?? "—"}</div>
                  <div className="text-sm mt-0.5">{c.body}</div>
                </div>
              </li>
            ))}
            {(!comments || comments.length === 0) && <li className="text-sm text-zinc-500">아직 댓글이 없어요.</li>}
          </ul>
        </section>
      </div>

      <aside>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-50 mb-6">
          <div className="w-10 h-10 rounded-full bg-zinc-200 overflow-hidden">
            {photo.author?.avatar_url && <img src={photo.author.avatar_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{photo.author?.nickname ?? "—"}</div>
            <div className="text-xs text-zinc-500 truncate">{photo.author?.home_type ?? "—"} · {photo.author?.area_pyeong ?? "—"}평 · {photo.author?.region ?? "—"}</div>
          </div>
        </div>

        <h3 className="text-sm font-bold mb-3">사진 속 상품 {tags?.length ?? 0}</h3>
        <ul className="space-y-2">
          {(tags ?? []).map((t: any) => t.product ? (
            <li key={t.id}>
              <Link href={`/product/${t.product.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50">
                <div className="w-14 h-14 rounded-md bg-zinc-100 overflow-hidden shrink-0">
                  {t.product.image_urls?.[0] && <img src={t.product.image_urls[0]} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-500">{t.product.category ?? "—"}</div>
                  <div className="text-sm font-semibold truncate">{t.product.name}</div>
                  <div className="text-xs font-bold">{fmtPrice(t.product.price)}</div>
                </div>
              </Link>
            </li>
          ) : null)}
          {(!tags || tags.length === 0) && <li className="text-sm text-zinc-500">태그된 상품이 없어요.</li>}
        </ul>
      </aside>
    </div>
  );
}
