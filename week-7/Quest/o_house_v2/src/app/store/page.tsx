import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, fmtPrice } from "@/lib/types";

export const revalidate = 0;

export default async function StorePage({ searchParams }: { searchParams: { category?: string; q?: string } }) {
  const supabase = createClient();
  let q = supabase
    .from("products")
    .select("id, name, price, category, image_urls, seller:profiles!products_seller_id_fkey(id, nickname)")
    .order("created_at", { ascending: false })
    .limit(60);
  if (searchParams.category) q = q.eq("category", searchParams.category);
  if (searchParams.q) q = q.ilike("name", `%${searchParams.q}%`);
  const { data: products } = await q;

  const Chip = ({ active, href, label }: { active: boolean; href: string; label: string }) => (
    <Link href={href} className={`chip ${active ? "chip-on" : "chip-off"}`}>{label}</Link>
  );

  return (
    <div className="py-8">
      <h1 className="text-2xl font-black mb-1">오늘의 스토어</h1>
      <p className="text-sm text-zinc-600 mb-6">셀러가 큐레이션한 가구 · 조명 · 패브릭</p>

      <div className="flex flex-wrap gap-2 mb-6">
        <Chip active={!searchParams.category} href="/store" label="전체" />
        {CATEGORIES.map((c) => (
          <Chip key={c} active={searchParams.category === c} href={`/store?category=${encodeURIComponent(c)}`} label={c} />
        ))}
      </div>

      {!products || products.length === 0 ? (
        <div className="py-20 text-center text-zinc-500">상품이 없어요</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p: any) => (
            <Link key={p.id} href={`/product/${p.id}`} className="group">
              <div className="aspect-square rounded-xl overflow-hidden bg-zinc-100">
                {p.image_urls?.[0] && <img src={p.image_urls[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition" />}
              </div>
              <div className="mt-2 text-xs text-zinc-500">{p.seller?.nickname ?? "—"}</div>
              <div className="text-sm font-semibold truncate">{p.name}</div>
              <div className="text-sm font-black">{fmtPrice(p.price)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
