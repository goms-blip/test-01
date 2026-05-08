# 도담 도자기 쇼핑몰 — DB 설계

Supabase Postgres 위에 **dodam** 전용 스키마로 구축. 같은 DB 인스턴스에 들어 있는
다른 프로젝트의 `public.products`, `public.cart` 등과 충돌하지 않습니다.

## 적용 방법

```bash
# 1) .env 에 DATABASE_URL / JWT_SECRET 채우기 (.env.example 참고)
# 2) 의존성 설치
npm install
# 3) 스키마 적용 (멱등 — 여러 번 실행해도 안전)
npm run db:apply
# 4) 서버 시작
npm run dev
```

## 테이블 한눈에

| #  | 테이블 | 역할 | 주요 키 |
|----|--------|------|---------|
| 1  | `dodam.users`            | 회원 (JWT 기반)            | `id`, `email` UQ |
| 2  | `dodam.refresh_tokens`   | refresh JWT (sha256 해시) | `user_id`, `token_hash` UQ |
| 3  | `dodam.addresses`        | 배송지                    | `user_id`, `is_default` |
| 4  | `dodam.categories`       | 카테고리 (다기/식기/장식) | `slug` UQ, `parent_id` |
| 5  | `dodam.products`         | 상품                      | `slug` UQ, `category_id` |
| 6  | `dodam.carts`            | 장바구니 헤더             | `user_id` 또는 `session_id` |
| 7  | `dodam.cart_items`       | 장바구니 라인             | `(cart_id, product_id)` UQ |
| 8  | `dodam.orders`           | 주문 (배송지·금액 스냅샷) | `order_number` UQ |
| 9  | `dodam.order_items`      | 주문 라인 (가격 스냅샷)   | `order_id` |
| 10 | `dodam.payment_methods`  | 등록 결제수단 (PG 토큰)   | `user_id`, `is_default` |
| 11 | `dodam.payments`         | 결제 트랜잭션             | `provider_transaction_id` UQ |
| 12 | `dodam.payment_events`   | PG 웹훅 멱등 로그         | `(provider, event_id)` UQ |

## 데이터 흐름

```
회원가입/로그인 ─▶ users (+ refresh_tokens)
              │
              ▼
   상품 탐색 ─▶ products (◂ categories)
              │
              ▼
   장바구니 ─▶ carts ─▶ cart_items ─▶ products
              │
              ▼
   주문 생성 ─▶ orders ─▶ order_items   (가격·상품명 스냅샷)
              │
              ▼
   결제 ─────▶ payments ─▶ payment_methods (선택, billing key)
              │
              ▼
   PG 웹훅 ──▶ payment_events  (event_id 로 중복 차단)
```

## 보안 / 결제 데이터 정책 (중요)

> **카드 PAN(전체 번호), CVC, 비밀번호, 평문 유효기간은 어떤 컬럼에도 저장하지 않습니다.**

- `payment_methods.billing_key`: PG(토스페이먼츠/아임포트/스트라이프 등)가 발급한 토큰만.
- `payment_methods.card_last4`: 표기용 마지막 4자리 (CHECK `^[0-9]{4}$`).
- `payment_methods.brand`: VISA / MASTER / BC 등 브랜드명.
- `payments.raw_response`: PG 응답 원문(JSONB). 분쟁/감사용. 민감정보가 섞이지 않도록
  서버에서 마스킹 후 저장 권장.
- `payments.provider_transaction_id`: PG 거래 ID. UNIQUE — 동일 거래 중복 처리 방지(멱등).
- `payment_events`: 웹훅을 받으면 `(provider, event_id)` UNIQUE 충돌로 중복 처리 차단.

## 스냅샷 정책

상품 가격이 나중에 바뀌어도 과거 주문 내역은 변하지 않아야 합니다.

- `order_items.product_name`, `product_sku`, `unit_price`, `line_total` 은 주문 시점 값.
- `orders.shipping_address` 는 주문 시점 배송지를 JSONB 로 박제.

## 인덱스 / 제약 핵심

- `users.email` UNIQUE + CITEXT (대소문자 무시).
- `addresses` / `payment_methods`: 사용자당 기본값 1개만 (Partial UNIQUE INDEX).
- `cart_items (cart_id, product_id)` UNIQUE: 같은 장바구니에 동일 상품은 1줄(수량으로 합산).
- `payments.refunded_amount <= amount` CHECK: 환불액이 결제액 초과 불가.
- `carts`: `user_id IS NOT NULL OR session_id IS NOT NULL` — 비로그인 카트도 허용.

## ENUM-like CHECK 값

- `users.role`: `customer | admin`
- `users.status`: `active | suspended | deleted`
- `products.status`: `active | draft | archived | soldout`
- `carts.status`: `active | ordered | abandoned`
- `orders.status`: `pending | paid | preparing | shipped | delivered | cancelled | refunded`
- `payments.status`: `pending | authorized | paid | failed | cancelled | partial_refunded | refunded`
- `payments.method`: `card | virtual_account | transfer | easy_pay | phone | manual`
- `payments.provider` / `payment_methods.provider`: `toss | iamport | stripe | kakaopay | naverpay`
  (`payments` 는 `manual` 추가 — 수동 입금 처리용)
