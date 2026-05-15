# 오늘의집 클론 v2 — PRD

## 0. 배경
v1 (`week-7/Quest/O_house`) 은 단일 `index.html` (React 18 CDN + Tailwind CDN + Babel-in-browser) 로 만들어 Supabase 어댑터 교체까지 §9-6 안정점에 도달했으나, 결제(§12) + 관리자(§13) 누적 후 클라이언트 supabase 상태 회귀로 hang 발생 → 전체 revert. 본 v2 는 같은 함정을 피하기 위해 **모듈식 Next.js 14 (App Router)** 로 처음부터 다시 빌드한다.

## 1. 스택 (확정)
- **Frontend**: Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui
- **Backend / Auth / DB / Storage**: Supabase — **v1과 동일 프로젝트 (`ieyegmmadztsatdghjvb`)** 재사용. v1/v2는 같은 앱의 리뉴얼이라 데이터·스키마·스토리지 분리 불필요. 기존 시드(8 products / 5 photos / home@ohou.test / jay@ohou.test)도 그대로 활용. (메모리상 "앱마다 분리"는 다른 앱일 때 적용되는 룰)
- **결제**: 토스페이먼츠 v2 SDK (`@tosspayments/tosspayments-sdk` npm) + Next.js Route Handler 로 confirm API
- **배포**: Vercel
- **레이아웃 라이브러리**: shadcn/ui — 디자인 톤은 v1 ohou 오렌지(#FF6F0F) 그대로 가져가되, 컴포넌트는 shadcn 기반으로 일관성 확보 (메모리상 "한 버전 더 만들자 = 디자인도 다른 버전" 가이드 — 컴포넌트 시스템 자체가 달라지므로 충족)

## 2. 범위 (v1 + 결제 + 관리자)
### 2-1. 일반 사용자
- 인테리어 사진 피드 (둘러보기) — space/style 필터, 검색
- 사진 상세 — 이미지 슬라이더, 핀(상품 태그), 스크랩, 댓글(Realtime polling 2.5s)
- 스토어 — 카테고리 필터, 검색
- 상품 상세 — 이미지 슬라이더, 스크랩, **"바로 구매" (토스 결제 위젯)**
- 회원가입/로그인/온보딩 (거주형태/평수/지역 자동 채움)
- 마이페이지 — 내 사진/스크랩 사진/내 상품/스크랩 상품/내 댓글/**구매 내역**
- 사진 업로드 (좌표 클릭 핀 태그)
- 상품 업로드

### 2-2. 운영자 (admin role)
- `/admin` 진입 — 비admin은 redirect
- 전체 주문 조회 (status 필터)
- 사진/상품 모더레이션 (삭제)
- 유저 목록
- 통계 카드 (매출 / 주문 수 / 사진 수 / 상품 수)

### 2-3. 결제 흐름
1. 상품 상세 → "바로 구매" → `/checkout/[productId]`
2. `db.orders.createPending` → pending 주문 생성
3. 토스 결제위젯 (`renderPaymentMethods` + `renderAgreement`)
4. 사용자가 "결제하기" 누름 → 토스 결제창 → 카드 입력 → success
5. `/checkout/success?paymentKey&orderId&amount` 진입
6. 클라가 자기 access_token 동봉해 **Route Handler `/api/toss/confirm`** 호출
7. Route Handler가 server-only `TOSS_SECRET_KEY` 로 confirm + Supabase orders `paid` 갱신 (3중 금액 검증)
8. 마이페이지 "구매 내역" 노출

## 3. 데이터 모델 (v1 동일 + 결제·관리자)
- `profiles` (id, nickname, home_type, area_pyeong, region, avatar_url, **role** ['user'|'admin'])
- `photos` (id, author_id, title, description, space, style, area_pyeong, image_urls[], scrap_count)
- `products` (id, seller_id, name, price, category, description, image_urls[])
- `photo_tags` (id, photo_id, product_id, pos_x, pos_y, image_index)
- `comments` (id, photo_id, author_id, body)
- `scraps` (user_id, photo_id) / `product_scraps` (user_id, product_id)
- `orders` (id, user_id, order_no, payment_key, total_price, status, paid_at)
- `order_items` (id, order_id, product_id, product_name, unit_price, quantity)

### RLS 핵심
- 누구나 select: photos, products, profiles
- 본인 only: scraps, product_scraps, comments insert/update/delete, photos/products insert/update/delete (작성자 = auth.uid)
- orders / order_items: 본인만 select·insert·update
- **admin 분기 정책은 v1 §13 회귀의 직접 원인이었음** — v2 에서는 **Route Handler + service_role key** 로 admin 데이터 조회·삭제를 우회시켜, RLS 정책에 admin 분기를 일절 추가하지 않는다 (`is_admin()` 같은 함수 사용 안 함).

## 4. 안 할 것
- 단일 파일에 모든 코드 인라인 (v1 패턴) — 컴포넌트 파일 분리
- 클라이언트 측 admin RLS — Route Handler 우회로 대체
- 인라인 부트 스크립트 (토큰 정리 등) — Next.js 미들웨어 또는 컴포넌트 effect 로

## 5. 작업 순서
1. ✅ 폴더 + PRD (이 문서)
2. Next.js scaffold (`npx create-next-app@latest --typescript --tailwind --app --src-dir`)
3. shadcn/ui init + 기본 컴포넌트 install
4. Supabase 새 프로젝트 생성 (사용자 작업) + schema.sql + storage policies 적용
5. 인증 흐름 (Supabase Auth Helpers for Next.js)
6. 피드/스토어/상세 페이지
7. 사진 업로드 / 상품 업로드
8. 결제 — 위젯 + Route Handler confirm
9. 마이페이지
10. 운영자 페이지 (`/admin`) — Route Handler 기반
11. Vercel 배포

## 6. 사용자 액션 (1회성)
- **Supabase 새 프로젝트 만들 필요 없음.** v1 프로젝트(`ieyegmmadztsatdghjvb`) 그대로 사용.
- `.env.local` 만들고 v1 의 `O_house/.env.local` 값을 그대로 옮기면 됨:
  - `NEXT_PUBLIC_SUPABASE_URL` ← 기존 `SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← 기존 `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` ← 기존 동일 값
- Toss Payments 키 추가 (공식 테스트키 그대로 OK):
  - `NEXT_PUBLIC_TOSS_CLIENT_KEY=test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm`
  - `TOSS_SECRET_KEY=test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6`
- 관리자 식별: 기존 home@ohou.test 를 admin 으로 한 줄 update (`schema-admin.sql` 적용 후) — 이건 v2 작업 마무리 단계에 안내.
