-- ============================================================
-- Todo App — Supabase / PostgreSQL schema  (todo_app_ prefix)
-- Project: fyeooefvtacfmwxdmevi
--
-- Tables:
--   todo_app_users        profile per user
--   todo_app_categories   per-user labels (Work / Personal / ...)
--   todo_app_todos        todo items
--
-- Notes
--   * user_id is a plain uuid (no FK to auth.users) so demo /
--     seed data can be inserted without a real auth account.
--     RLS still enforces auth.uid() = user_id at runtime.
--   * Drop-first so this script is idempotent.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Clean slate (idempotent re-run)
-- ------------------------------------------------------------
drop table if exists public.todo_app_todos      cascade;
drop table if exists public.todo_app_categories cascade;
drop table if exists public.todo_app_users      cascade;
drop view  if exists public.todo_app_stats      cascade;

-- ------------------------------------------------------------
-- 1. Extensions
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 2. Tables
-- ------------------------------------------------------------

-- 2a. Users (profile)
create table public.todo_app_users (
  id            uuid        primary key default gen_random_uuid(),
  display_name  text        not null check (char_length(btrim(display_name)) between 1 and 60),
  email         text        unique,
  password_hash text,                       -- bcrypt hash; null = OAuth-only or seed
  avatar_emoji  text        default '🙂',
  created_at    timestamptz not null default now()
);

comment on table public.todo_app_users is
  'User profile. id should match auth.users.id when wired to Supabase Auth.';

-- 2b. Categories
create table public.todo_app_categories (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.todo_app_users(id) on delete cascade,
  name        text        not null check (char_length(btrim(name)) between 1 and 40),
  color       text        not null default '#737373'
                            check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

comment on table public.todo_app_categories is 'User-defined labels for grouping todos.';

-- 2c. Todos
create table public.todo_app_todos (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.todo_app_users(id) on delete cascade,
  category_id   uuid        references public.todo_app_categories(id) on delete set null,
  text          text        not null check (char_length(btrim(text)) between 1 and 500),
  completed     boolean     not null default false,
  priority      smallint    not null default 2 check (priority between 1 and 3),
  due_date      date,
  position      integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);

comment on column public.todo_app_todos.priority is '1=low, 2=medium, 3=high';
comment on column public.todo_app_todos.position is 'Manual sort order. Lower = top of list.';

-- ------------------------------------------------------------
-- 3. Indexes
-- ------------------------------------------------------------
create index todo_app_todos_user_idx
  on public.todo_app_todos (user_id);

create index todo_app_todos_user_created_idx
  on public.todo_app_todos (user_id, created_at desc);

create index todo_app_todos_user_active_idx
  on public.todo_app_todos (user_id, position)
  where completed = false;

create index todo_app_todos_due_idx
  on public.todo_app_todos (user_id, due_date)
  where due_date is not null and completed = false;

create index todo_app_categories_user_idx
  on public.todo_app_categories (user_id);

-- ------------------------------------------------------------
-- 4. Triggers
-- ------------------------------------------------------------

-- 4a. Auto-touch updated_at
create or replace function public.todo_app_tg_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger todo_app_todos_touch_updated_at
  before update on public.todo_app_todos
  for each row execute function public.todo_app_tg_touch_updated_at();

-- 4b. Sync completed_at with completed flag
create or replace function public.todo_app_tg_sync_completed_at()
returns trigger language plpgsql as $$
begin
  if new.completed is distinct from old.completed then
    new.completed_at := case when new.completed then now() else null end;
  end if;
  return new;
end;
$$;

create trigger todo_app_todos_sync_completed_at
  before update of completed on public.todo_app_todos
  for each row execute function public.todo_app_tg_sync_completed_at();

-- ------------------------------------------------------------
-- 5. Row Level Security
-- ------------------------------------------------------------
alter table public.todo_app_users      enable row level security;
alter table public.todo_app_categories enable row level security;
alter table public.todo_app_todos      enable row level security;

-- users — each row is the user themselves
create policy todo_app_users_select_own
  on public.todo_app_users for select using (auth.uid() = id);
create policy todo_app_users_insert_own
  on public.todo_app_users for insert with check (auth.uid() = id);
create policy todo_app_users_update_own
  on public.todo_app_users for update using (auth.uid() = id) with check (auth.uid() = id);
create policy todo_app_users_delete_own
  on public.todo_app_users for delete using (auth.uid() = id);

-- categories
create policy todo_app_categories_select_own
  on public.todo_app_categories for select using (auth.uid() = user_id);
create policy todo_app_categories_insert_own
  on public.todo_app_categories for insert with check (auth.uid() = user_id);
create policy todo_app_categories_update_own
  on public.todo_app_categories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy todo_app_categories_delete_own
  on public.todo_app_categories for delete using (auth.uid() = user_id);

-- todos
create policy todo_app_todos_select_own
  on public.todo_app_todos for select using (auth.uid() = user_id);
create policy todo_app_todos_insert_own
  on public.todo_app_todos for insert with check (auth.uid() = user_id);
create policy todo_app_todos_update_own
  on public.todo_app_todos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy todo_app_todos_delete_own
  on public.todo_app_todos for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6. Stats view
-- ------------------------------------------------------------
create view public.todo_app_stats as
select
  user_id,
  count(*)                                  as total,
  count(*) filter (where completed = false) as active,
  count(*) filter (where completed = true)  as completed,
  count(*) filter (where due_date < current_date and completed = false) as overdue
from public.todo_app_todos
group by user_id;

alter view public.todo_app_stats set (security_invoker = on);

-- ============================================================
-- 7. Seed data
--    Three demo users, a few categories each, a realistic mix
--    of todos (active, completed, overdue, varying priority).
-- ============================================================

-- 7a. Users (fixed UUIDs for predictable references)
-- Demo passwords: alice1234 / bob1234 / chloe1234
insert into public.todo_app_users (id, display_name, email, avatar_emoji, password_hash) values
  ('11111111-1111-1111-1111-111111111111', 'Alice Kim',   'alice@example.com',  '🌿',
   '$2b$10$YAi9SIf/H2ZXtrHagey/HO6dyRn7sOMTRCjqGdvE/9.SWJTMWhvj2'),
  ('22222222-2222-2222-2222-222222222222', 'Bob Park',    'bob@example.com',    '🛠️',
   '$2b$10$AIsiFlEH41whikx8zccSKOcf6je.rO.91sNePA4JFXqGKF3neRV9y'),
  ('33333333-3333-3333-3333-333333333333', 'Chloe Jeong', 'chloe@example.com',  '📚',
   '$2b$10$F9p16O.u7n99NXl5ZWnj5.5Uwq4XEuhWVR1mEy.QKECdo03cuSOEi');

-- 7b. Categories
insert into public.todo_app_categories (id, user_id, name, color) values
  ('a1111111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Work',      '#0ea5e9'),
  ('a1111111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Personal',  '#f59e0b'),
  ('a1111111-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Health',    '#10b981'),
  ('b2222222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Side Project', '#a855f7'),
  ('b2222222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Errands',   '#ef4444'),
  ('c3333333-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Study',     '#6366f1'),
  ('c3333333-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Reading',   '#ec4899');

-- 7c. Todos — Alice
insert into public.todo_app_todos
  (user_id, category_id, text, completed, priority, due_date, position) values
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001',
     'Finalize Q2 roadmap deck', false, 3, current_date + 1, 1),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001',
     'Review PR #482 (auth refactor)', false, 2, current_date, 2),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000001',
     'Sync with design on onboarding flow', true, 2, current_date - 2, 3),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000002',
     'Book flights for May trip', false, 2, current_date + 7, 4),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000002',
     'Renew passport', false, 1, current_date + 30, 5),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000003',
     'Morning run — 5km', true, 1, current_date, 6),
  ('11111111-1111-1111-1111-111111111111', 'a1111111-0000-0000-0000-000000000003',
     'Schedule dentist checkup', false, 2, current_date - 3, 7);

-- 7d. Todos — Bob
insert into public.todo_app_todos
  (user_id, category_id, text, completed, priority, due_date, position) values
  ('22222222-2222-2222-2222-222222222222', 'b2222222-0000-0000-0000-000000000001',
     'Wire up Supabase auth on landing page', false, 3, current_date + 2, 1),
  ('22222222-2222-2222-2222-222222222222', 'b2222222-0000-0000-0000-000000000001',
     'Refactor todo data layer to use realtime', false, 2, null, 2),
  ('22222222-2222-2222-2222-222222222222', 'b2222222-0000-0000-0000-000000000001',
     'Pick a domain name', true, 1, null, 3),
  ('22222222-2222-2222-2222-222222222222', 'b2222222-0000-0000-0000-000000000002',
     'Pick up dry cleaning', false, 1, current_date, 4),
  ('22222222-2222-2222-2222-222222222222', 'b2222222-0000-0000-0000-000000000002',
     'Grocery run — milk, eggs, coffee beans', false, 2, current_date + 1, 5),
  ('22222222-2222-2222-2222-222222222222', null,
     'Read the new Postgres 17 release notes', false, 1, null, 6);

-- 7e. Todos — Chloe
insert into public.todo_app_todos
  (user_id, category_id, text, completed, priority, due_date, position) values
  ('33333333-3333-3333-3333-333333333333', 'c3333333-0000-0000-0000-000000000001',
     'Finish Chapter 4 — distributed systems', false, 3, current_date + 3, 1),
  ('33333333-3333-3333-3333-333333333333', 'c3333333-0000-0000-0000-000000000001',
     'Solve 3 Leetcode mediums', true, 2, current_date - 1, 2),
  ('33333333-3333-3333-3333-333333333333', 'c3333333-0000-0000-0000-000000000001',
     'Write notes on Raft consensus', false, 2, current_date + 5, 3),
  ('33333333-3333-3333-3333-333333333333', 'c3333333-0000-0000-0000-000000000002',
     'Finish "Designing Data-Intensive Apps" Ch.7', false, 2, null, 4),
  ('33333333-3333-3333-3333-333333333333', 'c3333333-0000-0000-0000-000000000002',
     'Return library books', false, 1, current_date - 1, 5);

-- Make completed_at consistent for already-completed seed rows
update public.todo_app_todos
   set completed_at = created_at + interval '2 hours'
 where completed = true and completed_at is null;

-- ============================================================
-- Done. Quick sanity counts:
--   select count(*) from public.todo_app_users;       -- 3
--   select count(*) from public.todo_app_categories;  -- 7
--   select count(*) from public.todo_app_todos;       -- 18
-- ============================================================
