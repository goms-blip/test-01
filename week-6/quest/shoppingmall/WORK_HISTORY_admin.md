# shoppingmall — Admin · Payment · MyPage 확장

> 6주차 PRD `prd.md` (이미지 업로드 + 토스페이먼츠 + 마이페이지) 구현 기록.
> 5주차의 `WORK_HISTORY.md` 와 별도로 관리합니다.

---

## 1. 무엇을 추가했나

| 영역 | 추가된 것 |
|---|---|
| DB | `orders`, `order_items` 테이블 + `is_admin()` SQL 함수 + RLS 9개 정책 |
| 클라이언트 | `/admin`, `/checkout`, `/checkout/success`, `/checkout/fail`, `/mypage` 5개 라우트 |
| 서버 API | `/api/imagekit-auth`, `/api/toss-confirm` (Vercel + 로컬 양쪽 지원) |
| 환경변수 | `IMAGEKIT_*` 3개 + `TOSS_CLIENT_KEY` + `TOSS_SECRET_KEY` |

기존 5주차 자산(상품 목록, 인증, 장바구니)은 그대로 유지하고 위에 얹는 형태로 작업했습니다.

---

## 2. 파일 변경 요약

### 신규
- `schema_admin.sql` — 6주차용 DB 스키마 (products 컬럼 추가 + orders/order_items + admin RLS)
- `api/imagekit-auth.js` — ImageKit 클라이언트 업로드 인증 토큰 발급
- `api/toss-confirm.js` — 토스 결제 승인 API (secret key는 서버에서만)
- `WORK_HISTORY_admin.md` — 본 문서

### 수정
- `api/env.js` — `TOSS_CLIENT_KEY` 추가 (CJS 통일)
- `server.js` — `/api/imagekit-auth`, `/api/toss-confirm` 라우팅 추가
- `vercel.json` — SPA 폴백 rewrites 추가 (`/admin`, `/checkout/*`, `/mypage`)
- `.env`, `.env.example` — ImageKit/Toss 키 항목 추가
- `index.html` — 라우터·관리자 페이지·체크아웃·마이페이지 전면 추가

### 보존
- `schema.sql` (5주차) — 그대로 유지. `schema_admin.sql` 이 ALTER TABLE 로 컬럼만 추가하므로 충돌 없음.
- `WORK_HISTORY.md` (5주차) — 보존.
- `prd_old.md` — 5주차 PRD 보존용.

---

## 3. DB 변경 상세 (`schema_admin.sql`)

### `products` 테이블 — 컬럼 2개 추가
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| `stock` | int4, NULL 허용 | NULL = 무제한 |
| `category` | text, NULL 허용 | 자유 텍스트 |

### `orders` 테이블 — 신규
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| `id` | uuid PK | gen_random_uuid() |
| `user_id` | uuid FK → auth.users | 본인 주문만 조회 |
| `payment_key` | text UNIQUE | Toss 가 발급, 영수증/취소시 재사용 |
| `order_no` | text UNIQUE | 클라이언트 UUID, Toss orderId |
| `total_price` | int4 | 위변조 방지 검증용 |
| `status` | text | `pending` / `paid` / `failed` / `canceled` |
| `paid_at` | timestamptz | 승인 완료 시각 |
| `created_at` | timestamptz | now() 기본 |

### `order_items` 테이블 — 신규
| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| `id` | uuid PK | |
| `order_id` | uuid FK → orders | on delete cascade |
| `product_id` | uuid FK → products | on delete restrict |
| `product_name`, `unit_price` | 주문 시점 스냅샷 | 추후 상품 변경되어도 보존 |
| `quantity` | int4 | check > 0 |

### `is_admin()` SQL 함수
```sql
auth.jwt() ->> 'email' in (
  'seunghun.oh@griff.co.kr',
  'seunghun.oh+shop@griff.co.kr'
)
```
> ⚠ 클라이언트가 가입 시 `nsEmail()` 로 `+shop` 네임스페이스를 붙이므로 DB 에는 `+shop@` 형태로 저장됩니다. 두 형태 모두 화이트리스트 등록.

### RLS 정책 (총 9개)
- `products_admin_insert / update / delete` — `is_admin()` 만 가능
- `orders_select_own_or_admin` — 본인 또는 admin
- `orders_insert_own` — 본인의 pending 만 insert
- `orders_update_own_or_admin` — 본인/admin status 갱신 (서버가 access_token 들고 호출)
- `order_items_select_own_or_admin` — 부모 orders 의 user_id 검증
- `order_items_insert_own` — 부모 orders 의 user_id 검증

---

## 4. 결제 흐름 (보안 모델)

```
[Cart Drawer]
  └─ Checkout 클릭 → navigate('/checkout')

[/checkout]
  ├─ pending order INSERT (RLS: 본인만, status=pending)
  ├─ order_items INSERT (RLS: 부모 order user_id 일치)
  └─ Toss widget 마운트
        ├─ widgets.setAmount({ value: total })
        ├─ renderPaymentMethods → #pm-widget
        ├─ renderAgreement → #agree-widget
        └─ Pay 버튼 → widgets.requestPayment({
              orderId: order_no,
              successUrl: '/checkout/success',
              failUrl:    '/checkout/fail',
            })

[Toss 결제창 → success redirect]
  → /checkout/success?paymentKey=...&orderId=...&amount=...

[/checkout/success]
  └─ POST /api/toss-confirm
        body: { paymentKey, orderId, amount, accessToken }
        ↓
   ┌────────────────────────────────┐
   │ /api/toss-confirm (서버)      │
   │  1) accessToken 으로 orders   │
   │     SELECT (RLS: 본인만)      │
   │  2) total_price === amount?  │
   │  3) Toss /v1/payments/confirm│
   │     Basic auth = secretKey   │
   │  4) Toss totalAmount === amt?│
   │  5) accessToken 으로 orders  │
   │     UPDATE status='paid'     │
   └────────────────────────────────┘
        ↓
   Cart 에서 주문 상품 제거 → MyPage 로 이동
```

### 검증 4중 안전장치
1. `paymentKey`/`orderId`/`amount`/`accessToken` 누락 검증 (400)
2. accessToken 으로 orders 조회 — 본인 주문 아니면 RLS 가 0건 반환 (404)
3. DB `total_price` === 클라이언트 `amount` (위변조 차단)
4. Toss 응답 `totalAmount` === 클라이언트 `amount` (이중 체크)

### Secret 노출 차단
- **클라이언트가 절대 보지 못하는 값**: `IMAGEKIT_PRIVATE_KEY`, `TOSS_SECRET_KEY`
- `/env.js` 에 노출되는 값: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TOSS_CLIENT_KEY` (모두 공개키)
- `/api/imagekit-auth` 응답에 `publicKey`, `urlEndpoint`, `signature` 만 (private key 미포함)

---

## 5. ImageKit 업로드 흐름

1. **인증 토큰 발급** — `GET /api/imagekit-auth`
   - 서버가 `HMAC-SHA1(token + expire, privateKey)` 로 signature 생성
   - 응답: `{ token, expire, signature, publicKey, urlEndpoint }`
   - 만료시간: 30분
2. **클라이언트 업로드** — `POST https://upload.imagekit.io/api/v1/files/upload`
   - multipart/form-data: `file, fileName, publicKey, signature, expire, token, folder=/shoppingmall`
3. **응답 URL 저장** — `products.image_url` 컬럼에 INSERT/UPDATE

> 관리자 페이지에서만 호출되도록 UI 가드. RLS 가 `products` write 를 admin 으로만 막아주므로, 업로드만 성공해도 DB write 는 실패함 → 정합성 보장.

---

## 6. 환경변수

### 로컬 (`.env`)
```bash
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
IMAGEKIT_PUBLIC_KEY=public_...
IMAGEKIT_PRIVATE_KEY=private_...
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/...
TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm
TOSS_SECRET_KEY=test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6
PORT=4001
```

### Vercel (Production / Preview / Development 모두 등록)
```bash
vercel env add IMAGEKIT_PUBLIC_KEY production
vercel env add IMAGEKIT_PRIVATE_KEY production
vercel env add IMAGEKIT_URL_ENDPOINT production
vercel env add TOSS_CLIENT_KEY production
vercel env add TOSS_SECRET_KEY production
# (SUPABASE_* 는 5주차에 이미 등록됨)
```

> `.gitignore` 가 `.env` 를 보호. `.env.example` 만 커밋.

---

## 7. 실행 / 검증

### 로컬
```bash
cd week-6/quest/shoppingmall
npm install
npm run dev          # http://localhost:4001
```

### Supabase 스키마 적용
1. https://supabase.com → 프로젝트 → SQL Editor
2. `schema_admin.sql` 전체 복사 후 Run
3. 검증: `select public.is_admin();` (admin 계정 로그인 후 RLS Studio 에서 true)

### 시연 시나리오
1. **비로그인 → 상품 둘러보기** — `/` 8개 카드 표시
2. **회원가입** — Header LOGIN → "계정 만들기"
3. **장바구니에 담기** — 카드 호버 → "Add to bag" → CART 뱃지 +1
4. **결제** — CART → Checkout → Toss 위젯 → 카드/간편결제 선택 → Pay
   - 테스트 카드: `4330-1234-1234-1234`, 모든 CVC/만료일 OK
   - 성공시 `/checkout/success` 에서 ✓ 표시
5. **마이페이지** — Header MY ORDERS 로 이동, 주문 내역 확인
6. **관리자 페이지** — `seunghun.oh@griff.co.kr` 로 로그인 시 Header 에 ADMIN 메뉴 노출
   - 이미지 드래그앤드롭 → ImageKit 업로드 → URL 자동 채움
   - 새 상품 등록 / EDIT / DEL 모두 동작
   - 비admin 계정으로는 "권한 없음" 안내

---

## 8. 라우팅 정책 변경 (hash → pathname)

5주차에는 단일 페이지였지만, Toss 가 successUrl 에 `?paymentKey=...` 쿼리를 붙여 redirect 하기 때문에 hash 라우팅과 충돌 위험이 있었습니다. **pathname 라우팅** 으로 전환하면서:

- `vercel.json` 에 5개 SPA 폴백 rewrites 등록
- `server.js` 의 정적 fallback 정규식이 이미 모든 비-API 경로를 `index.html` 로 보내므로 로컬은 추가 작업 없음
- 새로운 `useRoute()` / `navigate()` / `<NavLink>` 패턴 도입

---

## 9. 구현 메모 / 트레이드오프

### 왜 service role 키를 안 쓰나
서버에서 DB write 시 `service_role` 키를 쓰면 가장 간단하지만, 추가 secret 1개가 늘고 RLS 우회 위험이 생깁니다. 대신 **클라이언트의 access_token 을 서버로 전달 → 서버가 그 토큰으로 Supabase REST 호출** 패턴을 채택. RLS 가 그대로 작동하므로 본인 주문이 아니면 0건 반환되어 안전.

### pending order 를 미리 만드는 이유
Toss `requestPayment` 는 `orderId` 가 필수 인자. 결제 성공 후에 만들면 orderId 가 없어 호출 자체가 안 됨. 그래서 결제 진입 시점에 pending 으로 만들어둠. 사용자가 결제를 포기하면 pending 행이 남지만, status 컬럼으로 구분되므로 무해. (배치로 24h 이상 pending 정리 가능)

### 멱등 처리
`/checkout/success` 페이지가 reload 될 수 있으므로 `/api/toss-confirm` 은 이미 `paid` 인 주문에 대해서는 `{ ok: true, idempotent: true }` 반환. Toss 도 같은 paymentKey 로 재호출하면 적절히 응답.

### 가격 변동 보호
`order_items.unit_price`, `product_name` 을 주문 시점 스냅샷으로 저장. 나중에 admin 이 상품 가격을 바꿔도 과거 주문의 금액/이름은 그대로 보존.

### 클라이언트 SELECT 안전성
`listProducts()` 는 `select(*)` 사용. 6주차 신규 컬럼(`stock`, `category`) 이 아직 적용되지 않은 환경에서도 깨지지 않음.

---

## 10. 알려진 한계 / TODO (시간 되면)

- 환불/취소 (`/api/toss-cancel` + 관리자 UI) 는 미구현. PRD 범위 밖.
- 카테고리는 자유 텍스트 → 추후 정규화 테이블로 분리 가능
- `stock` 차감 트리거가 없음. PRD 가 재고 관리를 명시하지 않아서 컬럼만 추가
- 관리자 페이지의 주문 목록(전체) 뷰 미구현. 본인 주문만 마이페이지로 노출. 필요 시 같은 패턴으로 `/admin/orders` 추가 가능.
- 이미지 삭제 시 ImageKit 원본도 같이 지우는 hook 미구현 (스토리지 누적 가능)

---

## 11. 배포 체크리스트

- [ ] `schema_admin.sql` Supabase 에 적용
- [ ] Vercel env vars 5개 추가 (IMAGEKIT × 3, TOSS × 2)
- [ ] `vercel --prod` 배포
- [ ] 배포 URL 에서 회원가입 → 상품 담기 → 결제 → 마이페이지 풀 플로우 1회 시연
- [ ] admin 계정으로 상품 등록 1건 → 홈에서 노출 확인
- [ ] 스크린샷 4장 (홈, 결제창, 결제완료, 마이페이지) 캡처

---

## 부록 · API 응답 예시

### `GET /api/imagekit-auth`
```json
{
  "token": "uuid-...",
  "expire": 1800000000,
  "signature": "hex...",
  "publicKey": "public_...",
  "urlEndpoint": "https://ik.imagekit.io/..."
}
```

### `POST /api/toss-confirm` 성공
```json
{ "ok": true, "orderId": "ord_...", "paymentKey": "...", "method": "카드", "approvedAt": "2026-..." }
```

### `POST /api/toss-confirm` 실패
```json
{ "error": "amount_mismatch", "detail": "db total_price=18000, request amount=10000" }
```
