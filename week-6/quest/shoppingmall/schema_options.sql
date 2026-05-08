-- ============================================================
-- shoppingmall — 옵션 + 가격 차등 (option deltas)
--
-- 데이터 모델 결정:
--   · variants 테이블 분리 X
--   · products.options 단일 JSONB 컬럼에 옵션 정의 저장
--     [
--       { "name": "용량", "choices": [
--           {"label":"250g","delta":0},
--           {"label":"500g","delta":13000}
--       ]},
--       { "name": "분쇄도", "choices": [...] }
--     ]
--   · 최종 단가 = base_price + Σ choice.delta
--   · cart / order_items 는 selected_options JSONB 로 사용자 선택 보관
--     (예: {"용량":"500g","분쇄도":"핸드드립"})
--   · 같은 (user_id, product_id) 라도 옵션 조합이 다르면 별개 cart 라인
--
-- 적용:  Supabase SQL Editor 에서 이 파일 전체 실행
-- 멱등:  ADD COLUMN IF NOT EXISTS / DROP IF / CREATE IF NOT EXISTS
-- ============================================================

-- ------------------------------------------------------------
-- 1) products.options
-- ------------------------------------------------------------
alter table public.products
  add column if not exists options jsonb;

-- (선택) 옵션 검색용 GIN 인덱스
create index if not exists products_options_gin
  on public.products using gin (options jsonb_path_ops);

-- ------------------------------------------------------------
-- 2) cart.selected_options + 옵션 조합 단위 UNIQUE
--    기존 unique (user_id, product_id) 제약 제거 후, jsonb 평탄화 키로 대체
-- ------------------------------------------------------------

alter table public.cart
  add column if not exists selected_options jsonb;

-- 5주차 자동 생성된 unique constraint(name 다양) 모두 제거
do $mig$
declare
  c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.cart'::regclass
       and contype  = 'u'
  loop
    execute format('alter table public.cart drop constraint %I', c.conname);
  end loop;
end $mig$;

-- 옵션 NULL 도 동등 비교가 되도록 coalesce 한 expression 으로 unique
-- jsonb 동등성은 키 순서 무시이므로 동일 옵션 조합은 1행으로 dedup 됨
create unique index if not exists cart_user_product_opts_uidx
  on public.cart (
    user_id,
    product_id,
    (coalesce(selected_options, '{}'::jsonb))
  );

-- ------------------------------------------------------------
-- 3) order_items.selected_options
--    unit_price 는 5주차에서 이미 INT4 — 옵션 반영 후 단가를 그대로 스냅샷
-- ------------------------------------------------------------
alter table public.order_items
  add column if not exists selected_options jsonb;

-- ------------------------------------------------------------
-- 4) 시드 업데이트 — 기존 8 종에 옵션/가격차등 부여
--    멱등: UPDATE WHERE id 매칭, 항상 같은 결과
--
--    원두 5 종은 동일 스펙: 용량 4 (200g 기준) × 분쇄도 4 (가격 동일)
--    delta 는 base price 비율로 계산 (정수 ROUND, 100원 단위 절상)
--
--      용량 multiplier (per-g 가격 약간 디스카운트):
--        100g = 0.55  · 200g = 1.0 · 500g = 2.30 · 1kg = 4.30
--
--      분쇄도 4 종 모두 delta 0 — 가공 비용 차이 미반영
-- ------------------------------------------------------------

-- 4-1) 원두 5 종 (단일 원두 4 + 5월의 풍경 블렌드)
update public.products
   set options = jsonb_build_array(
     jsonb_build_object('name', '용량', 'choices', jsonb_build_array(
       jsonb_build_object('label', '200g', 'delta', 0),
       jsonb_build_object('label', '100g', 'delta', round(price::numeric * -0.45 / 100) * 100),
       jsonb_build_object('label', '500g', 'delta', round(price::numeric *  1.30 / 100) * 100),
       jsonb_build_object('label', '1kg',  'delta', round(price::numeric *  3.30 / 100) * 100)
     )),
     jsonb_build_object('name', '분쇄도', 'choices', jsonb_build_array(
       jsonb_build_object('label', '홀빈',       'delta', 0),
       jsonb_build_object('label', '핸드드립',   'delta', 0),
       jsonb_build_object('label', '에스프레소', 'delta', 0),
       jsonb_build_object('label', '모카프레소', 'delta', 0)
     ))
   )
 where id in (
   '11111111-1111-1111-1111-111111111101',
   '11111111-1111-1111-1111-111111111102',
   '11111111-1111-1111-1111-111111111103',
   '11111111-1111-1111-1111-111111111104',
   '11111111-1111-1111-1111-111111111105'
 );

-- 4-3) 머그 — 색상 옵션 (한 가지에만 +가격)
update public.products
   set options = $opt$[
     {"name":"색상","choices":[
       {"label":"차콜 그레이","delta":0},
       {"label":"아이보리","delta":0},
       {"label":"올리브","delta":2000}
     ]}
   ]$opt$::jsonb
 where id = '11111111-1111-1111-1111-111111111107';

-- 4-4) 드리퍼·세트 — 옵션 없음(NULL) 유지

-- ============================================================
-- 검증
-- ============================================================
-- select id, name, jsonb_array_length(options) as opt_count
--   from public.products order by created_at;
--
-- -- 옵션 미선택(=NULL) 과 선택 시 동일성 체크
-- select '{"분쇄도":"홀빈"}'::jsonb = '{"분쇄도":"홀빈"}'::jsonb;       -- true
-- select '{"a":1,"b":2}'::jsonb     = '{"b":2,"a":1}'::jsonb;            -- true (key 순서 무관)
