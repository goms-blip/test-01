-- 0003_is_visible.sql
-- 공개 사이트 노출 여부 토글.
-- 관리자가 임시로 숨기거나 초안 상태를 유지할 때 사용.
-- 기존 행은 모두 default true → 동작 변화 없음.

begin;

alter table public.ingredients
  add column if not exists is_visible boolean not null default true;

create index if not exists ingredients_is_visible_idx
  on public.ingredients (is_visible);

commit;
