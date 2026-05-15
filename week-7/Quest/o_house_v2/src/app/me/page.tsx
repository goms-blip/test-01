import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtPrice } from "@/lib/types";

export const revalidate = 0;

export default async function MyPage({ searchParams }: { searchParams: { tab?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  const tab = searchParams.tab ?? "orders";

  const [myPhotos, myProducts, orders] = await Promise.all([
    supabase.from("photos").select("id, title, image_urls").eq("author_id", user.id).order("created_at", { ascending: false }),
    supabase.from("products").select("id, name, price, image_urls").eq("seller_id", user.id).order("created_at", { ascending: false }),
    supabase.from("orders").select("*, items:order_items(*, product:products(id, name, image_urls))").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  const paidOrders = (orders.data ?? []).filter((o: any) => o.status === "paid");

  const Tab = ({ k, label, count }: { k: string; label: string; count: number }) => (
    <Link href={`/me?tab=${k}`} className={`shrink-0 px-4 h-11 inline-flex items-center text-sm font-semibold border-b-2 -mb-px ${tab === k ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}>
      {label} <span className="ml-1 text-xs">{count}</span>
    </Link>
  );

  return (
    <div className="py-8">
      <div className="p-5 rounded-2xl bg-zinc-50 mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-zinc-200 overflow-hidden">
          {profile?.avatar_url && <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-black">{profile?.nickname ?? user.email}</div>
          <div className="text-sm text-zinc-500 mt-0.5">{user.email}</div>
          <div className="text-xs text-zinc-500 mt-1">{profile?.home_type ?? "—"} · {profile?.area_pyeong ?? "—"}평 · {profile?.region ?? "—"}</div>
        </div>
        <Link href="/onboarding" className="btn btn-outline">프로필 수정</Link>
      </div>

      <div className="border-b border-zinc-200 mb-5 flex gap-1 overflow-x-auto">
        <Tab k="orders" label="구매 내역" count={paidOrders.length} />
        <Tab k="photos" label="내 사진" count={(myPhotos.data ?? []).length} />
        <Tab k="products" label="내 상품" count={(myProducts.data ?? []).length} />
      </div>

      {tab === "orders" && (
        paidOrders.length === 0 ? (
          <div className="py-12 text-center text-zinc-500">구매한 상품이 없어요. <Link href="/store" className="text-zinc-900 font-semibold">스토어 둘러보기</Link></div>
        ) : (
          <ul className="space-y-3">
            {paidOrders.map((o: any) => (
              <li key={o.id} className="border border-zinc-200 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                  <span>{new Date(o.paid_at ?? o.created_at).toLocaleString("ko-KR")}</span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700">결제완료</span>
                </div>
                <ul className="space-y-2">
                  {(o.items ?? []).map((it: any) => (
                    <li key={it.id} className="flex items-center gap-3">
                      {it.product?.image_urls?.[0] && <img src={it.product.image_urls[0]} className="w-14 h-14 rounded-md object-cover bg-zinc-100" alt="" />}
                      <div className="flex-1 min-w-0">
                        <Link href={it.product ? `/product/${it.product.id}` : "/store"} className="text-sm font-semibold hover:underline truncate block">{it.product_name}</Link>
                        <div className="text-xs text-zinc-500">{fmtPrice(it.unit_price)} · {it.quantity}개</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-zinc-100 mt-3 pt-2 flex items-baseline justify-between">
                  <span className="text-xs text-zinc-400 break-all">{o.order_no}</span>
                  <span className="font-black">{fmtPrice(o.total_price)}</span>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "photos" && (
        (myPhotos.data ?? []).length === 0 ? (
          <div className="py-12 text-center text-zinc-500">아직 올린 사진이 없어요.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(myPhotos.data ?? []).map((p: any) => (
              <Link key={p.id} href={`/photo/${p.id}`} className="group">
                <div className="aspect-square rounded-xl overflow-hidden bg-zinc-100">
                  {p.image_urls?.[0] && <img src={p.image_urls[0]} alt={p.title} className="w-full h-full object-cover" />}
                </div>
                <div className="mt-2 text-sm font-semibold truncate">{p.title}</div>
              </Link>
            ))}
          </div>
        )
      )}

      {tab === "products" && (
        (myProducts.data ?? []).length === 0 ? (
          <div className="py-12 text-center text-zinc-500">등록한 상품이 없어요.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(myProducts.data ?? []).map((p: any) => (
              <Link key={p.id} href={`/product/${p.id}`} className="group">
                <div className="aspect-square rounded-xl overflow-hidden bg-zinc-100">
                  {p.image_urls?.[0] && <img src={p.image_urls[0]} alt={p.name} className="w-full h-full object-cover" />}
                </div>
                <div className="mt-2 text-sm font-semibold truncate">{p.name}</div>
                <div className="text-xs font-bold">{fmtPrice(p.price)}</div>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}
