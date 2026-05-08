-- =============================================================================
-- 도담 도자기 쇼핑몰 — Supabase Postgres Schema
-- 전용 스키마: dodam (다른 프로젝트의 public.* 와 충돌 회피)
--
-- - JWT 인증 (dodam.users + dodam.refresh_tokens)
-- - 카탈로그 (dodam.categories, dodam.products)
-- - 장바구니 (dodam.carts, dodam.cart_items)
-- - 주문/결제 (dodam.orders, dodam.order_items,
--             dodam.payment_methods, dodam.payments, dodam.payment_events)
--
-- 멱등성: 모든 객체는 IF NOT EXISTS / DO 블록으로 재실행 안전.
-- 운영 원칙:
--   1) 카드 PAN/CVC 는 절대 저장하지 않는다. PG 토큰 + brand/last4 만 저장.
--   2) 가격·이름은 주문 시점 스냅샷을 order_items 에 박제.
--   3) 외부 결제 응답(raw_response)은 jsonb 로 보존 (분쟁/감사 대비).
-- =============================================================================

-- 0. 확장 / 스키마 -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS dodam;

-- 공용 updated_at 트리거 함수 (스키마 단위로 둠) -------------------------------
CREATE OR REPLACE FUNCTION dodam.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. dodam.users — 회원
-- =============================================================================
CREATE TABLE IF NOT EXISTS dodam.users (
  id              SERIAL PRIMARY KEY,
  email           CITEXT UNIQUE NOT NULL,
  password_hash   TEXT   NOT NULL,
  name            TEXT,
  phone           TEXT,
  role            TEXT   NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer','admin')),
  status          TEXT   NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','deleted')),
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dodam_users_status ON dodam.users(status);

DROP TRIGGER IF EXISTS trg_dodam_users_updated_at ON dodam.users;
CREATE TRIGGER trg_dodam_users_updated_at
  BEFORE UPDATE ON dodam.users
  FOR EACH ROW EXECUTE FUNCTION dodam.set_updated_at();

-- =============================================================================
-- 2. dodam.refresh_tokens — JWT refresh
-- =============================================================================
CREATE TABLE IF NOT EXISTS dodam.refresh_tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES dodam.users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,            -- 평문 X (sha256 해시 권장)
  user_agent  TEXT,
  ip          INET,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dodam_refresh_tokens_user
  ON dodam.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_dodam_refresh_tokens_active
  ON dodam.refresh_tokens(user_id) WHERE revoked_at IS NULL;

-- =============================================================================
-- 3. dodam.addresses — 배송지
-- =============================================================================
CREATE TABLE IF NOT EXISTS dodam.addresses (
  id           BIGSERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES dodam.users(id) ON DELETE CASCADE,
  recipient    TEXT    NOT NULL,
  phone        TEXT    NOT NULL,
  postal_code  TEXT    NOT NULL,
  address1     TEXT    NOT NULL,
  address2     TEXT,
  is_default   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dodam_addresses_user ON dodam.addresses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dodam_addresses_default_per_user
  ON dodam.addresses(user_id) WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS trg_dodam_addresses_updated_at ON dodam.addresses;
CREATE TRIGGER trg_dodam_addresses_updated_at
  BEFORE UPDATE ON dodam.addresses
  FOR EACH ROW EXECUTE FUNCTION dodam.set_updated_at();

-- =============================================================================
-- 4. dodam.categories — 카테고리 (다기/식기/장식 등)
-- =============================================================================
CREATE TABLE IF NOT EXISTS dodam.categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT    NOT NULL,
  slug        TEXT    NOT NULL UNIQUE,
  parent_id   INTEGER REFERENCES dodam.categories(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dodam_categories_parent
  ON dodam.categories(parent_id);

-- =============================================================================
-- 5. dodam.products — 상품
-- =============================================================================
CREATE TABLE IF NOT EXISTS dodam.products (
  id             BIGSERIAL PRIMARY KEY,
  sku            TEXT    UNIQUE,
  name           TEXT    NOT NULL,
  slug           TEXT    NOT NULL UNIQUE,
  description    TEXT,
  category_id    INTEGER REFERENCES dodam.categories(id) ON DELETE SET NULL,
  price          INTEGER NOT NULL CHECK (price >= 0),               -- KRW
  compare_price  INTEGER CHECK (compare_price IS NULL OR compare_price >= 0),
  stock          INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  status         TEXT    NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','draft','archived','soldout')),
  images         JSONB   NOT NULL DEFAULT '[]'::jsonb,
  metadata       JSONB   NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dodam_products_category
  ON dodam.products(category_id);
CREATE INDEX IF NOT EXISTS idx_dodam_products_status
  ON dodam.products(status);

DROP TRIGGER IF EXISTS trg_dodam_products_updated_at ON dodam.products;
CREATE TRIGGER trg_dodam_products_updated_at
  BEFORE UPDATE ON dodam.products
  FOR EACH ROW EXECUTE FUNCTION dodam.set_updated_at();

-- =============================================================================
-- 6. dodam.carts / dodam.cart_items — 장바구니
-- =============================================================================
CREATE TABLE IF NOT EXISTS dodam.carts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES dodam.users(id) ON DELETE CASCADE,
  session_id  TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','ordered','abandoned')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_dodam_carts_user_active
  ON dodam.carts(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_dodam_carts_session_active
  ON dodam.carts(session_id) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_dodam_carts_updated_at ON dodam.carts;
CREATE TRIGGER trg_dodam_carts_updated_at
  BEFORE UPDATE ON dodam.carts
  FOR EACH ROW EXECUTE FUNCTION dodam.set_updated_at();

CREATE TABLE IF NOT EXISTS dodam.cart_items (
  id          BIGSERIAL PRIMARY KEY,
  cart_id     BIGINT  NOT NULL REFERENCES dodam.carts(id) ON DELETE CASCADE,
  product_id  BIGINT  NOT NULL REFERENCES dodam.products(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_dodam_cart_items_cart
  ON dodam.cart_items(cart_id);

DROP TRIGGER IF EXISTS trg_dodam_cart_items_updated_at ON dodam.cart_items;
CREATE TRIGGER trg_dodam_cart_items_updated_at
  BEFORE UPDATE ON dodam.cart_items
  FOR EACH ROW EXECUTE FUNCTION dodam.set_updated_at();

-- =============================================================================
-- 7. dodam.orders / dodam.order_items — 주문 (가격·상품명 스냅샷)
-- =============================================================================
CREATE TABLE IF NOT EXISTS dodam.orders (
  id                BIGSERIAL PRIMARY KEY,
  order_number      TEXT    NOT NULL UNIQUE,            -- 'DD-2026-000123'
  user_id           INTEGER REFERENCES dodam.users(id) ON DELETE SET NULL,
  status            TEXT    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','preparing','shipped','delivered','cancelled','refunded')),
  subtotal          INTEGER NOT NULL CHECK (subtotal >= 0),
  shipping_fee      INTEGER NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  discount          INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total             INTEGER NOT NULL CHECK (total >= 0),
  currency          TEXT    NOT NULL DEFAULT 'KRW',
  shipping_address  JSONB   NOT NULL,                   -- 주문 시점 배송지 스냅샷
  customer_memo     TEXT,
  placed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at           TIMESTAMPTZ,
  shipped_at        TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dodam_orders_user
  ON dodam.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_dodam_orders_status
  ON dodam.orders(status);
CREATE INDEX IF NOT EXISTS idx_dodam_orders_placed
  ON dodam.orders(placed_at DESC);

DROP TRIGGER IF EXISTS trg_dodam_orders_updated_at ON dodam.orders;
CREATE TRIGGER trg_dodam_orders_updated_at
  BEFORE UPDATE ON dodam.orders
  FOR EACH ROW EXECUTE FUNCTION dodam.set_updated_at();

CREATE TABLE IF NOT EXISTS dodam.order_items (
  id              BIGSERIAL PRIMARY KEY,
  order_id        BIGINT  NOT NULL REFERENCES dodam.orders(id) ON DELETE CASCADE,
  product_id      BIGINT  REFERENCES dodam.products(id) ON DELETE SET NULL,
  product_name    TEXT    NOT NULL,                     -- 스냅샷
  product_sku     TEXT,                                 -- 스냅샷
  unit_price      INTEGER NOT NULL CHECK (unit_price >= 0),
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  line_total      INTEGER NOT NULL CHECK (line_total >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dodam_order_items_order
  ON dodam.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_dodam_order_items_product
  ON dodam.order_items(product_id);

-- =============================================================================
-- 8. dodam.payment_methods — 등록 결제수단 (PG 토큰만)
--    *** 절대 저장 금지: 카드 PAN, CVC, 비밀번호, 평문 유효기간 ***
-- =============================================================================
CREATE TABLE IF NOT EXISTS dodam.payment_methods (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL REFERENCES dodam.users(id) ON DELETE CASCADE,
  provider             TEXT    NOT NULL
    CHECK (provider IN ('toss','iamport','stripe','kakaopay','naverpay')),
  provider_customer_id TEXT,
  billing_key          TEXT,                            -- PG 발급 카드 토큰 / billing key
  brand                TEXT,                            -- VISA/MASTER/BC/...
  card_last4           TEXT    CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'),
  expires_yyyymm       TEXT    CHECK (expires_yyyymm IS NULL OR expires_yyyymm ~ '^[0-9]{6}$'),
  is_default           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dodam_payment_methods_user
  ON dodam.payment_methods(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_dodam_payment_methods_default_per_user
  ON dodam.payment_methods(user_id) WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS trg_dodam_payment_methods_updated_at ON dodam.payment_methods;
CREATE TRIGGER trg_dodam_payment_methods_updated_at
  BEFORE UPDATE ON dodam.payment_methods
  FOR EACH ROW EXECUTE FUNCTION dodam.set_updated_at();

-- =============================================================================
-- 9. dodam.payments — 결제 트랜잭션 (1주문 N결제 가능: 부분환불/재결제)
-- =============================================================================
CREATE TABLE IF NOT EXISTS dodam.payments (
  id                       BIGSERIAL PRIMARY KEY,
  order_id                 BIGINT  NOT NULL REFERENCES dodam.orders(id) ON DELETE RESTRICT,
  user_id                  INTEGER REFERENCES dodam.users(id) ON DELETE SET NULL,
  payment_method_id        BIGINT  REFERENCES dodam.payment_methods(id) ON DELETE SET NULL,
  provider                 TEXT    NOT NULL
    CHECK (provider IN ('toss','iamport','stripe','kakaopay','naverpay','manual')),
  provider_transaction_id  TEXT    UNIQUE,              -- PG 거래ID (멱등키)
  method                   TEXT    NOT NULL
    CHECK (method IN ('card','virtual_account','transfer','easy_pay','phone','manual')),
  amount                   INTEGER NOT NULL CHECK (amount >= 0),
  currency                 TEXT    NOT NULL DEFAULT 'KRW',
  status                   TEXT    NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','authorized','paid','failed','cancelled','partial_refunded','refunded')),
  failure_code             TEXT,
  failure_message          TEXT,
  approved_at              TIMESTAMPTZ,
  cancelled_at             TIMESTAMPTZ,
  refunded_amount          INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  raw_response             JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (refunded_amount <= amount)
);
CREATE INDEX IF NOT EXISTS idx_dodam_payments_order
  ON dodam.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_dodam_payments_user
  ON dodam.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_dodam_payments_status
  ON dodam.payments(status);

DROP TRIGGER IF EXISTS trg_dodam_payments_updated_at ON dodam.payments;
CREATE TRIGGER trg_dodam_payments_updated_at
  BEFORE UPDATE ON dodam.payments
  FOR EACH ROW EXECUTE FUNCTION dodam.set_updated_at();

-- =============================================================================
-- 10. dodam.payment_events — PG 웹훅/콜백 이벤트 로그 (멱등성)
-- =============================================================================
CREATE TABLE IF NOT EXISTS dodam.payment_events (
  id           BIGSERIAL PRIMARY KEY,
  payment_id   BIGINT REFERENCES dodam.payments(id) ON DELETE SET NULL,
  provider     TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  event_id     TEXT,
  payload      JSONB NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_dodam_payment_events_payment
  ON dodam.payment_events(payment_id);

-- =============================================================================
-- 끝.
-- =============================================================================
