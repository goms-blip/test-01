-- mini_app paywall — Supabase Postgres 스키마
-- 같은 Supabase 프로젝트의 다른 앱과 충돌 방지를 위해 모든 테이블에 miniapp_ prefix.

CREATE TABLE IF NOT EXISTS miniapp_users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS miniapp_purchases (
  id                BIGSERIAL PRIMARY KEY,
  user_id           BIGINT      NOT NULL REFERENCES miniapp_users(id) ON DELETE CASCADE,
  content_id        TEXT        NOT NULL,
  amount            INTEGER     NOT NULL CHECK (amount >= 0),
  toss_payment_key  TEXT,
  toss_order_id     TEXT,
  paid_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, content_id)
);

CREATE INDEX IF NOT EXISTS miniapp_purchases_user_idx
  ON miniapp_purchases (user_id, paid_at DESC);

CREATE INDEX IF NOT EXISTS miniapp_purchases_content_idx
  ON miniapp_purchases (content_id);

-- RLS — Supabase anon key로의 REST API 접근을 모두 차단.
--   mini_app은 서버에서 pg connection(소유자 권한)으로만 접근하므로 정책 불필요.
--   ENABLE 만으로 anon/authenticated key는 0 rows 반환 + write 거부.
ALTER TABLE miniapp_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE miniapp_purchases ENABLE ROW LEVEL SECURITY;
