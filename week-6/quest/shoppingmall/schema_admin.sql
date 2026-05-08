-- ============================================================
-- shoppingmall — admin/orders 확장 스키마
-- 6주차: 이미지 업로드 + 토스 결제 + 마이페이지
--
-- 적용 방법:
--   Supabase SQL Editor 에서 이 파일 전체를 실행
--   (기존 schema.sql 의 products / cart 는 유지)
-- ============================================================

-- ------------------------------------------------------------
-- 0) 관리자 식별 — 화이트리스트 이메일
-- ------------------------------------------------------------
-- RLS 정책에서 재사용. SECURITY DEFINER 로 두어 anon 도 호출 가능하지만
-- "내가 admin 인지" 만 확인하므로 정보 노출 위험 없음.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  -- 클라이언트가 nsEmail() 로 '+shop' 네임스페이스를 붙여 가입하므로
  -- DB 에 실제 저장되는 이메일은 'seunghun.oh+shop@griff.co.kr'.
  -- 미래의 이메일 정책 변경에 대비해 두 형태 모두 허용.
  select coalesce(
    (auth.jwt() ->> 'email') in (
      'seunghun.oh@griff.co.kr',
      'seunghun.oh+shop@griff.co.kr'
    ),
    false
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ------------------------------------------------------------
-- 1) products — 관리자 INSERT/UPDATE/DELETE 정책 추가
--    (기존 products_select_all 정책은 그대로 살려둠)
-- ------------------------------------------------------------

-- 6주차 신규 컬럼: 재고. NULL 이면 재고 무제한 취급.
alter table public.products
  add column if not exists stock int4;

-- 6주차 신규 컬럼: 카테고리(자유 텍스트 — 추후 정규화 가능)
alter table public.products
  add column if not exists category text;

drop policy if exists products_admin_insert on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists products_admin_delete on public.products;

create policy products_admin_insert
  on public.products for insert
  to authenticated
  with check (public.is_admin());

create policy products_admin_update
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy products_admin_delete
  on public.products for delete
  to authenticated
  using (public.is_admin());

-- ------------------------------------------------------------
-- 2) orders — 주문 헤더 (사용자별 / admin 전체)
-- ------------------------------------------------------------

create table if not exists public.orders (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  -- Toss 가 발급하는 결제키. 영수증/취소시 재사용.
  payment_key   text        unique,
  -- 클라이언트가 만들어 보낸 주문번호 (UUID). Toss orderId 로 사용.
  order_no      text        not null unique,
  total_price   int4        not null check (total_price >= 0),
  status        text        not null default 'pending'
                check (status in ('pending', 'paid', 'failed', 'canceled')),
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists orders_user_idx on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx on public.orders (status);

alter table public.orders enable row level security;

drop policy if exists orders_select_own_or_admin on public.orders;
drop policy if exists orders_insert_own on public.orders;
drop policy if exists orders_update_own_or_admin on public.orders;

-- 본인 주문은 조회 가능, admin 은 전체 조회
create policy orders_select_own_or_admin
  on public.orders for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- 본인의 pending 주문 생성만 허용
create policy orders_insert_own
  on public.orders for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 본인 또는 admin 만 갱신 (status 전환은 서버 confirm API 가 처리)
create policy orders_update_own_or_admin
  on public.orders for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- ------------------------------------------------------------
-- 3) order_items — 주문 라인
-- ------------------------------------------------------------

create table if not exists public.order_items (
  id          uuid        primary key default gen_random_uuid(),
  order_id    uuid        not null references public.orders(id) on delete cascade,
  product_id  uuid        not null references public.products(id) on delete restrict,
  -- 주문 시점의 상품 스냅샷 (가격/이름은 추후 변경되어도 보존)
  product_name text       not null,
  unit_price  int4        not null check (unit_price >= 0),
  quantity    int4        not null check (quantity > 0),
  created_at  timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id);

alter table public.order_items enable row level security;

drop policy if exists order_items_select_own_or_admin on public.order_items;
drop policy if exists order_items_insert_own on public.order_items;

-- order_items 는 부모 orders 의 user_id 기준으로 통제
create policy order_items_select_own_or_admin
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

create policy order_items_insert_own
  on public.order_items for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- 4) 주문번호 생성 helper (선택 사용)
-- ------------------------------------------------------------
-- 클라이언트는 UUID 그대로 써도 무방. Toss orderId 는 6~64자.
create or replace function public.gen_order_no()
returns text
language sql
stable
as $$
  select 'ord_' || replace(gen_random_uuid()::text, '-', '');
$$;

grant execute on function public.gen_order_no() to anon, authenticated;

-- ============================================================
-- 검증 쿼리 (Supabase SQL Editor 에서 한번씩 돌려보면 좋음)
-- ============================================================
-- select public.is_admin();           -- admin 계정 로그인 후 실행 시 true
-- select * from public.orders;        -- RLS 가 본인 + admin 만 노출
-- select * from public.order_items;
