-- 0004_realtime.sql
-- Realtime broadcast 활성화. 관리자가 토글하면 공개 사이트가 새로고침 없이 즉시 반영.
--
-- 사전 조건: supabase_realtime publication은 Supabase 프로젝트에 기본 존재.
--
-- replica identity full: UPDATE 이벤트 payload의 `old` 데이터까지 전부 포함.
-- 우리는 단순 refetch만 하지만, 향후 diff 기반 업데이트를 쓸 때 필요해서 미리 켬.

alter table public.ingredients replica identity full;

do $$
begin
  -- 이미 publication 멤버일 수 있어 try/catch.
  begin
    alter publication supabase_realtime add table public.ingredients;
  exception
    when duplicate_object then
      null; -- 이미 등록됨, 무시
  end;
end $$;
