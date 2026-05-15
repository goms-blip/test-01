-- O_house v2 — orders / order_items 스키마 (v1 §12에서 한 번 만들고 revert했던 것 복원)
-- admin 분기 RLS 정책은 절대 추가하지 않음 (v1 hang 원인). admin 데이터 조회는 Route Handler + service_role 우회.

create table if not exists public.orders (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  order_no      text        not null unique,
  payment_key   text        unique,
  total_price   int4        not null check (total_price >= 0),
  status        text        not null default 'pending'
                check (status in ('pending','paid','failed','canceled')),
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);

alter table public.orders enable row level security;

drop policy if exists orders_select_own on public.orders;
drop policy if exists orders_insert_own on public.orders;
drop policy if exists orders_update_own on public.orders;

create policy orders_select_own on public.orders for select to authenticated using (auth.uid() = user_id);
create policy orders_insert_own on public.orders for insert to authenticated with check (auth.uid() = user_id);
create policy orders_update_own on public.orders for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.order_items (
  id           uuid        primary key default gen_random_uuid(),
  order_id     uuid        not null references public.orders(id) on delete cascade,
  product_id   uuid        not null references public.products(id) on delete restrict,
  product_name text        not null,
  unit_price   int4        not null check (unit_price >= 0),
  quantity     int4        not null check (quantity > 0),
  created_at   timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);

alter table public.order_items enable row level security;

drop policy if exists order_items_select_own on public.order_items;
drop policy if exists order_items_insert_own on public.order_items;

create policy order_items_select_own on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid()));

create policy order_items_insert_own on public.order_items for insert to authenticated
  with check (exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid()));

-- admin 식별용 컬럼 (RLS 정책엔 안 씀. 클라이언트 UI 분기 + Route Handler 검증용)
alter table public.profiles add column if not exists role text not null default 'user' check (role in ('user','admin'));

-- home@ohou.test 를 admin 으로 승격 (다른 계정으로 바꿔도 OK)
update public.profiles set role = 'admin'
 where id = (select id from auth.users where email = 'home@ohou.test');
