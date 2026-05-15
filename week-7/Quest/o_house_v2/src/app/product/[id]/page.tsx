import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtPrice } from "@/lib/types";

export const revalidate = 0;

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*, seller:profiles!products_seller_id_fkey(*)")
    .eq("id", params.id)
    .maybeSingle();
  if (!product) notFound();

  return (
    <div className="py-8 grid md:grid-cols-2 gap-10">
      <div className="aspect-square rounded-2xl overflow-hidden bg-zinc-100">
        {product.image_urls?.[0] && <img src={product.image_urls[0]} alt={product.name} className="w-full h-full object-cover" />}
      </div>

      <aside>
        <span className="inline-block px-2.5 py-1 rounded-md bg-zinc-100 text-xs font-semibold mb-3">{product.category ?? "—"}</span>
        <h1 className="text-2xl font-black">{product.name}</h1>
        <div className="text-3xl font-black mt-2">{fmtPrice(product.price)}</div>
        <p className="text-sm text-zinc-600 mt-4 whitespace-pre-line">{product.description}</p>

        <div className="mt-6 flex items-center gap-3 p-3 rounded-lg bg-zinc-50">
          <div className="w-10 h-10 rounded-full bg-zinc-200 overflow-hidden">
            {product.seller?.avatar_url && <img src={product.seller.avatar_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{product.seller?.nickname ?? "—"}</div>
            <div className="text-xs text-zinc-500 truncate">셀러 · {product.seller?.region ?? "—"}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_2fr] gap-2">
          <button className="btn btn-outline btn-lg">스크랩</button>
          <Link href={`/checkout/${product.id}`} className="btn btn-primary btn-lg">바로 구매</Link>
        </div>
      </aside>
    </div>
  );
}
