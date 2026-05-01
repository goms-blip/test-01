-- ============================================================
--  행복을 찾아 떠나는 여행 — Supabase 스키마
--  PRD §3 데이터 구조에 맞춘 단일 테이블 + 보조 컬럼(location)
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.travel_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  date not null,                            -- 기록 일시(여행 일자)
  category    text not null check (category in ('여행지','활동','음식','쉼')),
  content     text not null,                            -- 구체적인 내용
  value       numeric(3,1) not null check (value >= 0 and value <= 10),  -- 행복지수
  -- ────── 보조 컬럼 (PRD 외 — 장소별 그룹핑/조회 가속용) ──────
  location    text not null,                            -- 예: '홋카이도', '베트남 다낭'
  trip_id     text not null                             -- 같은 여행 묶음 ID (T01, T02, …)
);

create index if not exists travel_logs_location_idx on public.travel_logs (location);
create index if not exists travel_logs_trip_idx     on public.travel_logs (trip_id);
create index if not exists travel_logs_value_idx    on public.travel_logs (value desc);

-- ────────── 자주 쓰는 분석용 뷰 ──────────

-- 여행지(=location) 기준 평균 행복지수
create or replace view public.v_location_happiness as
select location,
       count(*)              as record_count,
       count(distinct trip_id) as visit_count,
       round(avg(value)::numeric, 2) as avg_value,
       max(created_at)       as last_visited
from public.travel_logs
group by location
order by avg_value desc;

-- 카테고리×장소 교차표
create or replace view public.v_category_location as
select location, category,
       round(avg(value)::numeric, 2) as avg_value,
       count(*) as cnt
from public.travel_logs
group by location, category;

-- 행복지수 Top 활동
create or replace view public.v_top_moments as
select created_at, location, category, content, value
from public.travel_logs
order by value desc, created_at desc;
