-- ============================================================
-- Auth 기반 커뮤니티 앱 — Supabase / PostgreSQL Schema
-- ------------------------------------------------------------
-- PRD §3 의 posts 테이블 + RLS 정책 + 인덱스 + 보조 뷰
--   · 조회는 누구나 (anon · authenticated 모두 SELECT)
--   · 생성/수정/삭제는 로그인 사용자 본인만 (auth.uid() 일치)
-- ============================================================

create extension if not exists "pgcrypto";

-- 1) posts 테이블
create table if not exists public.community_posts (
    id            uuid           primary key default gen_random_uuid(),
    created_at    timestamptz    not null   default now(),
    title         text           not null,
    content       text           not null,
    user_id       uuid           not null   references auth.users(id) on delete cascade,
    author_email  text           not null
);

-- 2) 정렬·필터 인덱스
create index if not exists community_posts_created_desc_idx
    on public.community_posts (created_at desc);
create index if not exists community_posts_user_id_idx
    on public.community_posts (user_id);

-- 3) RLS 활성화
alter table public.community_posts enable row level security;

-- 정책 초기화 (멱등 실행 위해)
drop policy if exists community_posts_select_all          on public.community_posts;
drop policy if exists community_posts_insert_own          on public.community_posts;
drop policy if exists community_posts_update_own          on public.community_posts;
drop policy if exists community_posts_delete_own          on public.community_posts;

-- 3-1) 조회: 누구나 (로그인 없이도 목록·상세 열람 허용 — PRD Part2 Read)
create policy community_posts_select_all
    on public.community_posts
    for select
    to anon, authenticated
    using (true);

-- 3-2) 생성: 로그인 사용자, 본인 user_id 로만 작성 가능
create policy community_posts_insert_own
    on public.community_posts
    for insert
    to authenticated
    with check (auth.uid() = user_id);

-- 3-3) 수정: 작성자 본인만
create policy community_posts_update_own
    on public.community_posts
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- 3-4) 삭제: 작성자 본인만
create policy community_posts_delete_own
    on public.community_posts
    for delete
    to authenticated
    using (auth.uid() = user_id);

-- 4) 목록 뷰 (간단 메타데이터 포함)
create or replace view public.community_posts_list as
select
    id,
    created_at,
    title,
    user_id,
    author_email,
    -- content 미리보기 120자
    case when char_length(content) > 120
         then substring(content, 1, 120) || '…'
         else content
    end as preview,
    char_length(content) as content_length
from public.community_posts
order by created_at desc;
