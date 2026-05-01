-- ============================================================
-- 가계부 앱 (Account Book) — Supabase / PostgreSQL Schema
-- ------------------------------------------------------------
-- PRD 5.2 의 ledgers 테이블 정의 + 인덱스 + 보조 뷰 + 시드 데이터
-- ============================================================

-- 1) 확장: UUID 생성용
create extension if not exists "pgcrypto";

-- 2) 메인 테이블
create table if not exists public.ledgers (
    id          uuid           primary key default gen_random_uuid(),
    created_at  timestamptz    not null default now(),
    date        date           not null,
    type        text           not null check (type in ('income', 'expense')),
    amount      bigint         not null check (amount >= 0),
    category    text           not null,
    memo        text           default ''
);

-- 3) 조회 성능 인덱스
create index if not exists ledgers_date_desc_idx
    on public.ledgers (date desc, created_at desc);
create index if not exists ledgers_type_idx
    on public.ledgers (type);
create index if not exists ledgers_category_idx
    on public.ledgers (category);

-- 4) 카테고리별 합계 뷰 (지출만 집계)
create or replace view public.ledger_category_totals as
select
    category,
    sum(amount)::bigint           as total_amount,
    count(*)::int                 as entry_count
from public.ledgers
where type = 'expense'
group by category
order by total_amount desc;

-- 5) 잔액 요약 뷰
create or replace view public.ledger_balance as
select
    coalesce(sum(amount) filter (where type = 'income'), 0)::bigint  as total_income,
    coalesce(sum(amount) filter (where type = 'expense'), 0)::bigint as total_expense,
    (
        coalesce(sum(amount) filter (where type = 'income'), 0)
        - coalesce(sum(amount) filter (where type = 'expense'), 0)
    )::bigint as balance
from public.ledgers;

-- 6) 월별 합계 뷰 (Step 5 advanced 리포트용)
create or replace view public.ledger_monthly_summary as
select
    to_char(date, 'YYYY-MM') as month,
    type,
    sum(amount)::bigint      as total
from public.ledgers
group by to_char(date, 'YYYY-MM'), type
order by month desc;

-- 7) RLS — 단일 유저 데모용으로 anon 에 read/write 허용
--    (실서비스에서는 user_id 컬럼 추가 후 auth.uid() 기반 정책으로 교체할 것)
alter table public.ledgers enable row level security;

drop policy if exists ledgers_anon_select on public.ledgers;
drop policy if exists ledgers_anon_insert on public.ledgers;
drop policy if exists ledgers_anon_update on public.ledgers;
drop policy if exists ledgers_anon_delete on public.ledgers;

create policy ledgers_anon_select on public.ledgers for select to anon using (true);
create policy ledgers_anon_insert on public.ledgers for insert to anon with check (true);
create policy ledgers_anon_update on public.ledgers for update to anon using (true) with check (true);
create policy ledgers_anon_delete on public.ledgers for delete to anon using (true);

-- 8) 데모 시드 (필요 시 실행)
-- insert into public.ledgers (date, type, amount, category, memo) values
--     (current_date,           'income',  3200000, '월급',     '4월 월급'),
--     (current_date,           'expense',   12500, '식비',     '점심'),
--     (current_date - 1,       'expense',   45000, '교통',     '주유'),
--     (current_date - 2,       'expense',  120000, '주거',     '전기/가스'),
--     (current_date - 3,       'expense',   15900, '구독료',   '넷플릭스'),
--     (current_date - 5,       'expense',  100000, '경조사',   '결혼식 축의금');
