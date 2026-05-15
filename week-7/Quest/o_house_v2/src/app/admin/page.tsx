import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fmtPrice } from "@/lib/types";

export const revalidate = 0;

export default async function AdminPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // role 체크 (admin 분기 RLS 없이 단순 컬럼 조회)
  const { data: profile } = await supabase.from("profiles").select("role, nickname").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <div className="text-5xl mb-3">🔒</div>
        <h1 className="text-xl font-black mb-2">접근 권한이 없어요</h1>
        <p className="text-sm text-zinc-500 mb-6">이 페이지는 운영자만 볼 수 있어요.</p>
        <Link href="/" className="btn btn-outline">홈으로</Link>
      </div>
    );
  }

  // admin 데이터는 service_role 로 우회 (RLS 정책에 admin 분기 안 둠 — v1 hang 원인)
  const svc = createServiceClient();
  let ordersQ = svc.from("orders").select("*, items:order_items(*, product:products(id, name)), user:profiles!orders_user_id_fkey(nickname)")
    .order("created_at", { ascending: false }).limit(50);
  if (searchParams.status) ordersQ = ordersQ.eq("status", searchParams.status);
  const [orders, photos, products, profiles] = await Promise.all([
    ordersQ,
    svc.from("photos").select("id, title, image_urls, created_at, author:profiles!photos_author_id_fkey(nickname)").order("created_at", { ascending: false }).limit(20),
    svc.from("products").select("id, name, price, image_urls, created_at, seller:profiles!products_seller_id_fkey(nickname)").order("created_at", { ascending: false }).limit(20),
    svc.from("profiles").select("id, nickname, role, home_type, area_pyeong, region").limit(50),
  ]);

  const paid = (orders.data ?? []).filter((o: any) => o.status === "paid");
  const totalPaid = paid.reduce((s: number, o: any) => s + (o.total_price ?? 0), 0);

  const StatusChip = ({ s }: { s: string | null }) => (
    <Link href={s ? `/admin?status=${s}` : "/admin"} className={`chip ${(searchParams.status ?? "") === (s ?? "") ? "chip-on" : "chip-off"}`}>
      {s ?? "전체"}
    </Link>
  );

  return (
    <div className="py-8">
      <div className="flex items-baseline justify-between mb-5">
        <h1 className="text-2xl font-black">운영자</h1>
        <span className="text-xs text-zinc-500">{profile?.nickname} · admin</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Card label="결제완료 매출" value={fmtPrice(totalPaid)} />
        <Card label="주문" value={String((orders.data ?? []).length)} />
        <Card label="사진" value={String((photos.data ?? []).length)} />
        <Card label="상품" value={String((products.data ?? []).length)} />
      </div>

      <section className="mb-12">
        <h2 className="text-sm font-bold mb-3">주문</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <StatusChip s={null} />
          {(["paid","pending","failed","canceled"] as const).map((s) => <StatusChip key={s} s={s} />)}
        </div>
        {(orders.data ?? []).length === 0 ? <div className="py-8 text-center text-zinc-500">주문이 없어요.</div> : (
          <ul className="space-y-2">
            {(orders.data ?? []).map((o: any) => (
              <li key={o.id} className="border border-zinc-200 rounded-xl p-3 text-sm">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                  <span className="break-all">{o.order_no}</span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-100">{o.status}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-zinc-500">{o.user?.nickname ?? "—"} · {new Date(o.created_at).toLocaleString("ko-KR")}</span>
                  <span className="font-black">{fmtPrice(o.total_price)}</span>
                </div>
                {(o.items ?? []).length > 0 && (
                  <div className="text-xs text-zinc-500 truncate mt-1">{o.items.map((it: any) => it.product_name).join(", ")}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-12">
        <h2 className="text-sm font-bold mb-3">사진</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {(photos.data ?? []).map((p: any) => (
            <div key={p.id} className="border border-zinc-200 rounded-xl overflow-hidden">
              <Link href={`/photo/${p.id}`}><img src={p.image_urls?.[0]} alt="" className="w-full aspect-square object-cover bg-zinc-100" /></Link>
              <div className="p-2 text-xs">
                <div className="text-zinc-500 truncate">{p.author?.nickname ?? "—"}</div>
                <div className="font-semibold truncate">{p.title}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold mb-3">유저 ({(profiles.data ?? []).length})</h2>
        <ul className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
          {(profiles.data ?? []).map((u: any) => (
            <li key={u.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{u.nickname ?? u.id.slice(0, 8)}</div>
                <div className="text-xs text-zinc-500 truncate">{u.home_type ?? "—"} · {u.area_pyeong ? u.area_pyeong + "평" : "—"} · {u.region ?? "—"}</div>
              </div>
              {u.role === "admin" && <span className="px-2 py-0.5 rounded-md bg-zinc-900 text-white text-xs font-semibold">admin</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-zinc-200">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-xl font-black mt-1">{value}</div>
    </div>
  );
}
