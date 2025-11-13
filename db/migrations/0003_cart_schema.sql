BEGIN;

SET TIME ZONE 'UTC';

-- Cart status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cart_status') THEN
    CREATE TYPE cart_status AS ENUM ('Open','Paid','Cancelled','Abandoned');
  END IF;
END$$;

-- Sequence for human-friendly cart references
CREATE SEQUENCE IF NOT EXISTS cart_ref_seq;

-- Carts table
CREATE TABLE IF NOT EXISTS carts (
  cart_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_ref       TEXT NOT NULL UNIQUE DEFAULT ('SCART' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD') || LPAD(nextval('cart_ref_seq')::TEXT, 8, '0')),
  user_id        BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  session_id     VARCHAR(100),
  total_amount   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0 AND discount_amount <= total_amount),
  final_amount   NUMERIC(10,2) GENERATED ALWAYS AS (GREATEST(total_amount - discount_amount, 0)) STORED,
  payment_status payment_status NOT NULL DEFAULT 'Pending',
  payment_mode   payment_mode NOT NULL DEFAULT 'Online',
  payment_ref    VARCHAR(100),
  status         cart_status NOT NULL DEFAULT 'Open',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id);
CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);

-- Trigger to maintain updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_carts_updated_at'
  ) THEN
    CREATE TRIGGER trg_carts_updated_at
    BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- Cart items
CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_id        BIGINT NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
  item_type      VARCHAR(20) NOT NULL CHECK (item_type IN ('attraction','combo','offer','page','blog')),
  attraction_id  BIGINT REFERENCES attractions(attraction_id) ON DELETE SET NULL,
  combo_id       BIGINT,
  offer_id       BIGINT,
  slot_id        BIGINT REFERENCES attraction_slots(slot_id) ON DELETE SET NULL,
  booking_date   DATE,
  booking_time   TIME,
  quantity       INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_amount   NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  meta           JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_type ON cart_items(item_type);
CREATE INDEX IF NOT EXISTS idx_cart_items_slot_id ON cart_items(slot_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cart_items_updated_at'
  ) THEN
    CREATE TRIGGER trg_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- Map bookings created from a cart (post-payment)
CREATE TABLE IF NOT EXISTS cart_bookings (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_id       BIGINT NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
  booking_id    BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_booking ON cart_bookings(cart_id, booking_id);

COMMIT;
