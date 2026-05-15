-- 0005_rls_hide_invisible.sql
-- 공개 RLS 정책에 is_visible=true 조건을 추가해, 숨김 처리된 재료는
-- 클라이언트가 anon 키로 직접 쿼리해도 노출되지 않도록 한다.
--
-- service_role은 RLS를 bypass하므로 관리자 API는 그대로 모든 행을 본다.

begin;

drop policy if exists "ingredients public read" on public.ingredients;

create policy "ingredients public read"
  on public.ingredients
  for select
  to anon, authenticated
  using (is_visible = true);

commit;
