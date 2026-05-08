# shoppingmall — Product Detail · 옵션 · 가격차등

> 6주차 후속 작업 — `prd.md` 에 명시되지 않았던 상품 상세 페이지를 추가하면서
> "옵션마다 가격 차등이 가능한" (option C) 모델을 채택해 구현.

`WORK_HISTORY.md` (5주차) 와 `WORK_HISTORY_admin.md` (6주차 admin) 와 별개로 관리합니다.

---

## 1. 채택한 데이터 모델 — Option Deltas

설계 대안 3가지 중 사용자 요청대로 **(c) 옵션마다 가격 차등** 으로 진행.

세부 설계 방향 두 가지:
- **Variants 테이블 분리** — 옵션 조합마다 별도 row, 별도 SKU·재고·가격
- ✅ **Option Deltas (선택)** — `products.options` 단일 JSONB 에 옵션 + 차등액(delta)

채택 이유:
- 변형이 적은 단일 카탈로그(8 SKU) 에 variants 분리는 과설계
- 단일 컬럼 → 마이그레이션·UI·쿼리 모두 단순
- 가격은 `base_price + Σ choice.delta` 한 줄로 계산
- 옵션·재고 관리가 복잡해지면 그때 variants 로 마이그레이션 가능 (한 방향)

### 데이터 형태
```jsonc
// products.options
[
  { "name": "용량", "choices": [
      { "label": "250g", "delta": 0 },
      { "label": "500g", "delta": 13000 },
      { "label": "1kg",  "delta": 24000 }
  ]},
  { "name": "분쇄도", "choices": [
      { "label": "홀빈",       "delta": 0 },
      { "label": "에스프레소", "delta": 500 },
      { "label": "핸드드립",   "delta": 500 }
  ]}
]

// cart.selected_options
{ "용량": "500g", "분쇄도": "핸드드립" }

// order_items.selected_options  (주문 시점 스냅샷)
{ "용량": "500g", "분쇄도": "핸드드립" }
```

---

## 2. 파일 변경

### 신규
- `schema_options.sql` — products/cart/order_items 옵션 컬럼 + cart UNIQUE 재설계 + 시드 옵션 업데이트
- `WORK_HISTORY_options.md` — 본 문서
- `screenshot/home_v3_with_options_hint.png`, `screenshot/detail_blend_with_options.png` — 시각 검증

### 수정
- `index.html` — Detail page, OptionsEditor, OptionRadioGroup, QuantityStepper 신규. cart/checkout/mypage/admin 모두 옵션 반영.
- `vercel.json` — `/products/:id*` SPA 폴백 rewrite 추가

### 보존
- `schema.sql`, `schema_admin.sql` — 그대로
- `WORK_HISTORY.md`, `WORK_HISTORY_admin.md` — 그대로
- `api/*` — 변경 없음 (서버 로직은 옵션 인식 불필요. order_items 가 이미 unit_price 스냅샷을 받기 때문)

---

## 3. DB 마이그레이션 (`schema_options.sql`)

### 컬럼 추가
| 테이블 | 컬럼 | 타입 | 비고 |
| --- | --- | --- | --- |
| `products` | `options` | jsonb (NULL 허용) | 옵션 정의 |
| `cart` | `selected_options` | jsonb (NULL 허용) | 사용자 선택 |
| `order_items` | `selected_options` | jsonb (NULL 허용) | 주문 시점 스냅샷 |

### cart UNIQUE 재설계
**문제**: 5주차의 `unique (user_id, product_id)` 가 옵션 조합마다 별개 라인을 막음.

**해결**: 기존 unique constraint 모두 제거 후 expression unique index 로 교체:
```sql
create unique index cart_user_product_opts_uidx
  on public.cart (user_id, product_id, (coalesce(selected_options, '{}'::jsonb)));
```
- jsonb 의 동등성은 키 순서 무시 → `{"용량":"500g","분쇄도":"핸드드립"}` == `{"분쇄도":"핸드드립","용량":"500g"}`
- coalesce 로 NULL 도 빈 객체 취급 → 옵션 없는 상품은 한 라인에서 수량 누적
- `do $mig$ ... drop constraint ... $mig$` 블록으로 기존 constraint name (자동생성) 안전 제거

### 인덱스
- `products_options_gin` — `options` 검색용 GIN (`jsonb_path_ops`)

### 시드 업데이트 (멱등)
| 상품 | 옵션 |
| --- | --- |
| 원두 5종 (예가체프 / 콜롬비아 / 케냐 / 브라질 / 5월의 풍경 블렌드) | **용량 4** (200g base / 100g ×0.55 / 500g ×2.3 / 1kg ×4.3) × **분쇄도 4** (홀빈·핸드드립·에스프레소·모카프레소, 가격 동일) |
| 향원 머그 | 색상 3 (차콜·아이보리 0 / 올리브 +2000) |
| 드리퍼, 드립포트 세트 | 옵션 없음 (NULL) |

**가격 차등 — 원두 (200g 기준 base price)**
- delta 는 base × multiplier 를 100원 단위로 round 한 값
- 200g multiplier 1.0 (delta 0) · 100g 0.55 · 500g 2.30 · 1kg 4.30
- 분쇄도는 모두 delta 0 — 가공비 차이 미반영, 가격은 용량으로만 결정

| Base (200g) | 100g | 500g | 1kg |
| --- | --- | --- | --- |
| ₩14,500 (브라질) | ₩8,000 | ₩33,400 | ₩62,400 |
| ₩16,500 (콜롬비아) | ₩9,100 | ₩38,000 | ₩71,000 |
| ₩17,000 (블렌드) | ₩9,400 | ₩39,100 | ₩73,100 |
| ₩18,000 (예가체프) | ₩9,900 | ₩41,400 | ₩77,400 |
| ₩19,500 (케냐) | ₩10,700 | ₩44,900 | ₩83,900 |

> 디테일 페이지 진입 시 기본 선택은 200g · 홀빈. 각 옵션 라디오에서 선택 변경 시 합계 실시간 반영.

---

## 4. 클라이언트 변경

### 옵션 헬퍼 (4 개)
```js
hasOptions(product)            // boolean
defaultSelectedOptions(p)      // 첫 choice 로 기본값
computeOptionPrice(p, sel)     // base + Σ delta
optionsKey(sel)                // dedup 용 정규화 JSON 문자열
formatOptions(sel)             // '용량: 500g · 분쇄도: 핸드드립'
```

### 새 라우트 — `/products/:id`
- App 의 라우터에서 `route.path.match(/^\/products\/(.+)$/)` 로 분기
- ProductDetailPage 컴포넌트:
  - 좌: 1:1 정사각 큰 이미지
  - 우: 카테고리 / 이름 / 단가(옵션 반영) / 설명 / 옵션 라디오 그룹들 / 수량 스테퍼 / Add to bag
  - 옵션 차등액 표시 — `+₩500` 형태 라벨 옆 표시
  - 합계 = `unit × qty` 실시간

### 카드 동작 변경
| 상품 형태 | 카드 클릭 | 호버 버튼 |
|---|---|---|
| 옵션 있음 | → /products/:id | "View options" → 디테일 |
| 옵션 없음 | → /products/:id | "Add to bag" (Quick Add) |
| 모든 카드 | 가격 옆 `~` 표시 (옵션이 있어 변동 가능 시그널) | |

### 카트
- 라인마다 `formatOptions` 으로 선택 옵션 한 줄 표시
- 단가는 `computeOptionPrice` 로 옵션 적용
- 동일 상품 + 동일 옵션 = 같은 cart 행 (수량 +1)
- 동일 상품 + **다른 옵션** = 별개 cart 행

### 체크아웃
- 주문 요약 라인에 옵션 표시
- `createPendingOrder` 에서 옵션 적용 단가로 `unit_price` 스냅샷
- `total_price = Σ unit_price × quantity`
- 결제 성공 후 cart 정리 — `sessionStorage.shop_order_cart_ids:<orderNo>` 로 보관한 정확한 cart_id 들만 삭제 (옵션 다른 라인 보호)

### 마이페이지
- 주문 라인의 `selected_options` 를 한 줄로 표시
- `unit_price` 는 옵션 반영된 스냅샷이라 별도 계산 불필요

### 관리자 — OptionsEditor
- 옵션 추가/삭제, 옵션마다 choices 추가/삭제
- 각 choice 는 `label` (text) + `delta` (number, +₩)
- JSON 직접 편집 X — 모두 입력 폼
- 저장 시 빈 name·빈 label 자동 정제

---

## 5. 마이그레이션 전·후 동작 매트릭스

`schema_options.sql` 미적용 환경에서도 페이지가 깨지지 않도록 보호 코드 삽입:

| 기능 | 마이그 전 | 마이그 후 |
| --- | --- | --- |
| 홈 상품 목록 | ✓ (옵션 컬럼 없으면 단일 가격) | ✓ |
| 디테일 페이지 | ✓ (옵션 영역 미표시) | ✓ (옵션 라디오) |
| Quick Add (옵션 없는 상품) | ✓ (selected_options 키 자체 미포함) | ✓ |
| Add with options | ✗ (cart.selected_options 컬럼 부재 → 400) | ✓ |
| 결제 | ✓ (모든 라인이 NULL 옵션이면 order_items.selected_options 컬럼 미포함) | ✓ |
| 마이페이지 옵션 표시 | "—" | ✓ 옵션 한 줄 |

→ 마이그 적용 안 하고도 5 주차 사용감(옵션 없는 단순 쇼핑)은 보존됨.

---

## 6. 주요 트레이드오프

### 왜 variants 테이블 안 만드나
- 옵션 조합마다 재고를 따로 관리할 필요 없음 (PRD 미요구)
- 가격은 base + delta 로 충분히 표현 가능
- `products.options` 1 컬럼 vs 별도 테이블 + N:N JOIN — 압도적으로 단순
- 옵션 검색 GIN 인덱스 1 개로 카테고리·옵션 필터링 가능

### 왜 dedup 을 클라이언트에서
PostgREST 의 `?selected_options=eq.{...}` 필터는 jsonb 의 텍스트 표현(키 순서/공백) 에 민감해서 server-side eq 매칭이 깨질 수 있음. 그래서:
- 같은 (user_id, product_id) 의 모든 행을 가져옴 (옵션 조합 수가 작아 비용 미미)
- 클라이언트 `optionsKey()` 로 정규화 비교
- DB 의 expression unique index 는 안전 그물

### 왜 sessionStorage 로 cart 라인 추적
결제 성공 페이지가 reload 될 수 있고, URL 에는 `paymentKey/orderId/amount` 만 옴. 어떤 cart 라인이 이 주문에 들어갔는지 알 길이 없음 → CheckoutPage 에서 pending 주문 생성 직후 sessionStorage 에 cart_ids 저장. 성공 페이지가 그걸 읽어 정확히 그 라인만 삭제. 옵션 다른 라인은 보존.

### 가격 변동 보호
- `order_items.unit_price` 가 옵션 적용된 스냅샷 → admin 이 base price 나 delta 를 바꿔도 과거 주문 금액 보존
- `order_items.selected_options` 도 스냅샷 → admin 이 옵션 정의를 바꿔도 사용자 선택 보존

---

## 7. 적용 순서

```bash
# 1) 스키마 적용 (필수)
#    Supabase SQL Editor 에서 schema_admin.sql 먼저, 그 다음 schema_options.sql 실행
#    (schema_admin.sql 만 적용 → 옵션 없는 상태로 동작)

# 2) 로컬 검증
cd week-6/quest/shoppingmall
npm run dev   # http://localhost:4001

# 3) 시연 시나리오
#    /  →  카드 호버 → 옵션 있는 상품은 'View options', 없는 상품은 'Add to bag'
#    /products/<uuid>  →  옵션 라디오 선택 시 단가 +Δ 실시간 반영
#    /admin (admin 계정) → 새 상품 등록 시 옵션 행 추가 → choices 추가
#    카트 라인에 '용량: 500g · 분쇄도: 핸드드립' 같이 옵션 한 줄 표시
#    결제 후 mypage 에서 같은 옵션 표기 확인
```

---

## 8. 알려진 한계 / TODO

- Variants 별 재고 관리 X (전체 stock 만 노출)
- 옵션 조합별 이미지 X (예: 색상 옵션 → 색상별 이미지)
- 옵션 정렬 변경 UI X (배열 순서가 표시 순서)
- 옵션 삭제 시 기존 cart 라인에 'orphan label' 가능 (admin 이 옵션을 바꿔도 cart 의 selected_options 는 텍스트 라벨이라 영향 없음 — 단가만 default 0 으로 잡힘)
- 옵션 차등에 % 단위 X (정액 ₩ 만)

---

## 9. 검증 결과

| 검증 항목 | 결과 |
|---|---|
| `/` 홈 | ✓ 200, 옵션 있는 상품에 `~` 가격 힌트 |
| `/products/<uuid>` | ✓ 200, no console errors |
| 마이그 전 옵션 라디오 | ✓ 미표시 (graceful) |
| Quick add (마이그 전) | ✓ selected_options 컬럼 미포함 INSERT |
| Admin OptionsEditor | ✓ 추가/삭제/편집 |
| Cart drawer 옵션 라인 | ✓ |
| Checkout 요약 옵션 라인 | ✓ |
| MyPage 주문 옵션 라인 | ✓ |
| 콘솔 에러 | 0 |
