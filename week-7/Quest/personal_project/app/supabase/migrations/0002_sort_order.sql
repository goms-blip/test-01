-- 0002_sort_order.sql
-- 큐레이션 순서 보존용 정렬 컬럼.
-- 프론트 next/prev 네비, 인기 재료 카드 순서, 추후 관리자 모듈의 드래그 정렬 기준.

begin;

alter table public.ingredients
  add column if not exists sort_order integer;

create index if not exists ingredients_sort_order_idx
  on public.ingredients (sort_order);

commit;
