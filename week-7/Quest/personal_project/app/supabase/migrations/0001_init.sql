-- 0001_init.sql
-- 초보자를 위한 베이킹 재료 사전 — v1 초기 스키마
-- frontend: app/index_studio.html (source of truth for fields & categories)
--
-- 적용 방법 (psql):
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql

begin;

-- 1) Extensions ---------------------------------------------------------------
-- pg_trgm: name_ko / name_en 부분일치 검색 (ilike) 인덱스용
create extension if not exists pg_trgm with schema extensions;
-- pgcrypto: gen_random_uuid() — Postgres 13+에서는 사실상 내장이지만 안전을 위해 명시
create extension if not exists pgcrypto with schema extensions;

-- 2) Category enum ------------------------------------------------------------
-- 프론트(index_studio.html) 기준 6 카테고리.
-- dev.md엔 5개로 적혀 있지만 'spirit'(술·리큐어)가 별도 카테고리로 운영되어 추가.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ingredient_category') then
    create type public.ingredient_category as enum (
      'flour',      -- 가루류
      'leavening',  -- 팽창제
      'sugar',      -- 당류
      'dairy_fat',  -- 유제품·지방
      'etc',        -- 계란·견과·초콜릿·향료
      'spirit'      -- 술·리큐어
    );
  end if;
end $$;

-- 3) ingredients 테이블 -------------------------------------------------------
create table if not exists public.ingredients (
  id                  uuid                          primary key default gen_random_uuid(),
  slug                text                          not null unique,
  name_ko             text                          not null,
  name_en             text                          not null,
  name_zh             text,
  category            public.ingredient_category    not null,
  summary             text                          not null,
  emoji               text,
  image_url           text,
  role                text                          not null,
  similar_ingredients text,
  common_mistakes     text,
  substitutes         text,
  storage             text,
  where_to_buy        text,
  created_at          timestamptz                   not null default now(),
  updated_at          timestamptz                   not null default now()
);

comment on table  public.ingredients                     is '베이킹 재료 사전 v1 — 재료 1개당 9개 정보 항목';
comment on column public.ingredients.slug                is 'URL용 식별자 (예: cake-flour)';
comment on column public.ingredients.summary             is '한 줄 정체 (1~2문장)';
comment on column public.ingredients.role                is '베이킹에서의 역할';
comment on column public.ingredients.similar_ingredients is '헷갈리는 비슷한 재료와의 차이';
comment on column public.ingredients.common_mistakes     is '초보자 자주 하는 실수';
comment on column public.ingredients.substitutes         is '대체 가능 여부 + 비율';
comment on column public.ingredients.where_to_buy        is '한국에서 구매 가능한 곳';

-- 4) Indexes ------------------------------------------------------------------
-- ilike 부분일치 검색 인덱스 (검색 도달 3초 이내 성공 기준)
create index if not exists ingredients_name_ko_trgm_idx
  on public.ingredients using gin (name_ko extensions.gin_trgm_ops);
create index if not exists ingredients_name_en_trgm_idx
  on public.ingredients using gin (name_en extensions.gin_trgm_ops);
-- 카테고리 페이지 필터
create index if not exists ingredients_category_idx
  on public.ingredients (category);

-- 5) updated_at 자동 갱신 트리거 ---------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ingredients_set_updated_at on public.ingredients;
create trigger ingredients_set_updated_at
  before update on public.ingredients
  for each row execute function public.set_updated_at();

-- 6) RLS — ingredients 공개 읽기 only ----------------------------------------
alter table public.ingredients enable row level security;

drop policy if exists "ingredients public read"  on public.ingredients;
drop policy if exists "ingredients anon no write" on public.ingredients;

-- 익명/로그인 사용자 모두 SELECT 가능
create policy "ingredients public read"
  on public.ingredients
  for select
  to anon, authenticated
  using (true);

-- INSERT/UPDATE/DELETE 정책은 일부러 만들지 않는다.
-- service_role 키는 RLS를 bypass하므로 시드/관리 작업은 service_role로만 수행.
-- anon/authenticated 클라이언트는 쓰기 시 자동 거절된다.

-- 7) Storage 버킷 — ingredient-images (public read) --------------------------
insert into storage.buckets (id, name, public)
values ('ingredient-images', 'ingredient-images', true)
on conflict (id) do update set public = excluded.public;

-- Storage objects RLS는 Supabase가 기본 enable. 공개 읽기 정책만 추가.
drop policy if exists "ingredient-images public read" on storage.objects;
create policy "ingredient-images public read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'ingredient-images');

-- 업로드/삭제도 service_role만 — anon/authenticated 정책은 만들지 않음.

commit;

-- 8) 검증용 쿼리 (수동 실행 권장) --------------------------------------------
-- \dt public.*
-- \d  public.ingredients
-- select bucket_id, name, public from storage.buckets where id = 'ingredient-images';
-- select policyname, cmd, roles from pg_policies where schemaname in ('public','storage');
