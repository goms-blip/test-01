-- ============================================================
-- shoppingmall — 커피향 가득한 5월의 풍경
-- PRD §4: products(public read) + cart(RLS, 본인만)
-- ============================================================

create extension if not exists "pgcrypto";

-- 1) products — 누구나 SELECT, 시드 데이터 포함
create table if not exists public.products (
    id           uuid        primary key default gen_random_uuid(),
    name         text        not null,
    price        int4        not null,
    image_url    text,
    description  text,
    created_at   timestamptz not null default now()
);

create index if not exists products_created_idx on public.products (created_at desc);

alter table public.products enable row level security;

drop policy if exists products_select_all on public.products;
create policy products_select_all
    on public.products
    for select
    to anon, authenticated
    using (true);

-- 2) cart — 본인 user_id 만 조회/추가/수정/삭제
create table if not exists public.cart (
    id          uuid        primary key default gen_random_uuid(),
    user_id     uuid        not null references auth.users(id) on delete cascade,
    product_id  uuid        not null references public.products(id) on delete cascade,
    quantity    int4        not null default 1 check (quantity > 0),
    created_at  timestamptz not null default now(),
    unique (user_id, product_id)
);

create index if not exists cart_user_idx on public.cart (user_id, created_at desc);

alter table public.cart enable row level security;

drop policy if exists cart_select_own on public.cart;
drop policy if exists cart_insert_own on public.cart;
drop policy if exists cart_update_own on public.cart;
drop policy if exists cart_delete_own on public.cart;

create policy cart_select_own
    on public.cart for select
    to authenticated
    using (auth.uid() = user_id);

create policy cart_insert_own
    on public.cart for insert
    to authenticated
    with check (auth.uid() = user_id);

create policy cart_update_own
    on public.cart for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy cart_delete_own
    on public.cart for delete
    to authenticated
    using (auth.uid() = user_id);

-- 3) 시드 — 커피 상품 8종 (id는 고정 UUID로 idempotent 하게)
insert into public.products (id, name, price, image_url, description) values
  ('11111111-1111-1111-1111-111111111101', '에티오피아 예가체프 게샤',  18000,
   'https://images.unsplash.com/photo-1599639957043-f3aa5c986398?w=800&h=800&fit=crop&auto=format',
   '꽃향과 베르가못 시트러스. 5월 아침의 상쾌함을 그대로 옮긴 한 잔.'),
  ('11111111-1111-1111-1111-111111111102', '콜롬비아 우일라 슈프리모', 16500,
   'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=800&fit=crop&auto=format',
   '균형잡힌 단맛과 캐러멜 피니쉬. 어떤 추출에도 안정적.'),
  ('11111111-1111-1111-1111-111111111103', '케냐 키리냐가 AA',         19500,
   'https://images.unsplash.com/photo-1442550528053-c431ecb55509?w=800&h=800&fit=crop&auto=format',
   '블랙베리, 자몽의 진한 산미. 깊고 또렷한 인상.'),
  ('11111111-1111-1111-1111-111111111104', '브라질 세하도 피베리',     14500,
   'https://images.unsplash.com/photo-1494314671902-399b18174975?w=800&h=800&fit=crop&auto=format',
   '초콜릿과 견과 풍미. 우유와 잘 어울리는 데일리 블렌드.'),
  ('11111111-1111-1111-1111-111111111105', '5월의 풍경 블렌드 250g',   17000,
   'https://images.unsplash.com/photo-1497636577773-f1231844b336?w=800&h=800&fit=crop&auto=format',
   '갓 깎은 잔디, 벚꽃이 진 자리. 향긋한 디카페인 호환 블렌드.'),
  ('11111111-1111-1111-1111-111111111106', '핸드드립 드리퍼 — 도자기',  32000,
   'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=800&h=800&fit=crop&auto=format',
   '한 사람을 위한 미세한 곡선의 흰 도자기 드리퍼.'),
  ('11111111-1111-1111-1111-111111111107', '향원 머그 — 차콜 그레이',   22000,
   'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=800&h=800&fit=crop&auto=format',
   '두툼한 손잡이, 따뜻한 회색 톤. 320ml.'),
  ('11111111-1111-1111-1111-111111111108', '서버 + 드립포트 세트',     58000,
   'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=800&h=800&fit=crop&auto=format',
   '500ml 유리 서버와 매트 블랙 드립포트 1L. 정갈한 한 세트.')
on conflict (id) do nothing;
