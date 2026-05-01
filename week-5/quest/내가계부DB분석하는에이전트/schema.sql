-- ============================================================
-- 가계부 DB 분석 에이전트 — Supabase / PostgreSQL Schema
-- ------------------------------------------------------------
-- 가계부앱(ledgers) 테이블을 그대로 사용하고, 분석 전용 뷰를
-- 추가하여 에이전트(자연어 → SQL)의 응답 속도와 일관성을 높임.
-- ============================================================

-- 0) 확장
create extension if not exists "pgcrypto";

-- 1) 메인 테이블 (가계부앱과 동일 스키마)
create table if not exists public.ledgers (
    id          uuid           primary key default gen_random_uuid(),
    created_at  timestamptz    not null default now(),
    date        date           not null,
    type        text           not null check (type in ('income', 'expense')),
    amount      bigint         not null check (amount >= 0),
    category    text           not null,
    memo        text           default ''
);

create index if not exists ledgers_date_desc_idx
    on public.ledgers (date desc, created_at desc);
create index if not exists ledgers_type_idx       on public.ledgers (type);
create index if not exists ledgers_category_idx   on public.ledgers (category);

-- ============================================================
-- 2) 분석 에이전트 전용 뷰 (Read-Only)
--    에이전트는 가급적 아래 뷰를 우선 호출하여 SQL을 단순화.
-- ============================================================

-- 2.1 카테고리별 합계 (지출만)
create or replace view public.v_category_totals as
select
    category,
    sum(amount)::bigint as total_amount,
    count(*)::int       as entry_count,
    round(avg(amount))::bigint as avg_amount
from public.ledgers
where type = 'expense'
group by category
order by total_amount desc;

-- 2.2 월별 type 합계
create or replace view public.v_monthly_summary as
select
    to_char(date, 'YYYY-MM') as month,
    type,
    sum(amount)::bigint      as total,
    count(*)::int            as entry_count
from public.ledgers
group by 1, 2
order by 1 desc, 2;

-- 2.3 월별 × 카테고리별 합계
create or replace view public.v_monthly_category as
select
    to_char(date, 'YYYY-MM') as month,
    category,
    sum(amount)::bigint      as total
from public.ledgers
where type = 'expense'
group by 1, 2
order by 1 desc, 3 desc;

-- 2.4 일자별 합계 (지출)
create or replace view public.v_daily_expense as
select
    date,
    sum(amount)::bigint as total_amount,
    count(*)::int       as entry_count
from public.ledgers
where type = 'expense'
group by date
order by date desc;

-- 2.5 요일별 평균/합계 (지출)
--     dow: 0=일 ... 6=토
create or replace view public.v_weekday_pattern as
with daily as (
    select date, sum(amount)::bigint as day_total
    from public.ledgers
    where type = 'expense'
    group by date
)
select
    extract(dow from date)::int as dow,
    case extract(dow from date)::int
        when 0 then '일'
        when 1 then '월'
        when 2 then '화'
        when 3 then '수'
        when 4 then '목'
        when 5 then '금'
        when 6 then '토'
    end                          as dow_label,
    count(*)::int                as day_count,
    sum(day_total)::bigint       as total_amount,
    round(avg(day_total))::bigint as avg_per_day
from daily
group by 1, 2
order by 1;

-- 2.6 잔액
create or replace view public.v_balance as
select
    coalesce(sum(amount) filter (where type = 'income'), 0)::bigint  as total_income,
    coalesce(sum(amount) filter (where type = 'expense'), 0)::bigint as total_expense,
    (coalesce(sum(amount) filter (where type = 'income'), 0)
   - coalesce(sum(amount) filter (where type = 'expense'), 0))::bigint as balance
from public.ledgers;

-- 2.7 카테고리 × 요일 (어떤 요일에 어떤 카테고리를 많이 쓰는지)
create or replace view public.v_category_by_weekday as
select
    category,
    extract(dow from date)::int as dow,
    sum(amount)::bigint         as total
from public.ledgers
where type = 'expense'
group by 1, 2
order by 1, 2;

-- ============================================================
-- 3) RLS — 단일 유저 데모 (가계부앱과 동일 정책)
-- ============================================================
alter table public.ledgers enable row level security;

drop policy if exists ledgers_anon_select on public.ledgers;
drop policy if exists ledgers_anon_insert on public.ledgers;
drop policy if exists ledgers_anon_update on public.ledgers;
drop policy if exists ledgers_anon_delete on public.ledgers;

create policy ledgers_anon_select on public.ledgers for select to anon using (true);
create policy ledgers_anon_insert on public.ledgers for insert to anon with check (true);
create policy ledgers_anon_update on public.ledgers for update to anon using (true) with check (true);
create policy ledgers_anon_delete on public.ledgers for delete to anon using (true);

-- 분석 전용 read-only 롤(권장):
-- create role analyzer_ro nologin;
-- grant usage on schema public to analyzer_ro;
-- grant select on public.ledgers to analyzer_ro;
-- grant select on
--     public.v_category_totals,
--     public.v_monthly_summary,
--     public.v_monthly_category,
--     public.v_daily_expense,
--     public.v_weekday_pattern,
--     public.v_balance,
--     public.v_category_by_weekday
-- to analyzer_ro;
