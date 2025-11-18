-- Booking History and Status Audit Trail
BEGIN;

-- Extend booking status enum if needed
DO $$
BEGIN
  -- Add new statuses for better tracking
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel IN ('Pending', 'Confirmed', 'Redeemed', 'Expired', 'Cancelled')
    AND enumtypid = 'booking_status'::regtype
  ) THEN
    ALTER TYPE booking_status ADD VALUE 'Pending' BEFORE 'Booked';
    ALTER TYPE booking_status ADD VALUE 'Confirmed' AFTER 'Pending';
  END IF;
END$$;

-- Booking History Table for audit trail
CREATE TABLE IF NOT EXISTS booking_history (
  history_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id      BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  old_status      VARCHAR(50),
  new_status      VARCHAR(50) NOT NULL,
  payment_status  VARCHAR(50),
  changed_by      BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  change_reason   VARCHAR(255),
  notes           TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_history_booking_id ON booking_history(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_history_new_status ON booking_history(new_status);
CREATE INDEX IF NOT EXISTS idx_booking_history_created_at ON booking_history(created_at);

-- Payment Transaction Log
CREATE TABLE IF NOT EXISTS payment_txn_logs (
  txn_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id      BIGINT REFERENCES bookings(booking_id) ON DELETE CASCADE,
  cart_id         BIGINT REFERENCES carts(cart_id) ON DELETE SET NULL,
  payment_ref     VARCHAR(100) UNIQUE,
  payment_txn_no  VARCHAR(100) UNIQUE,
  gateway         VARCHAR(50) NOT NULL DEFAULT 'payphi',
  amount          NUMERIC(10,2) NOT NULL,
  status          VARCHAR(50) NOT NULL DEFAULT 'Initiated',
  response_code   VARCHAR(10),
  response_data   JSONB,
  error_message   TEXT,
  retries         INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_payment_txn_logs_updated_at
BEFORE UPDATE ON payment_txn_logs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_payment_txn_logs_booking_id ON payment_txn_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_payment_txn_logs_cart_id ON payment_txn_logs(cart_id);
CREATE INDEX IF NOT EXISTS idx_payment_txn_logs_ref ON payment_txn_logs(payment_ref);
CREATE INDEX IF NOT EXISTS idx_payment_txn_logs_status ON payment_txn_logs(status);

-- Add new columns to bookings if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='bookings' AND column_name='payment_txn_no'
  ) THEN
    ALTER TABLE bookings ADD COLUMN payment_txn_no VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='bookings' AND column_name='booking_status_updated_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN booking_status_updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='bookings' AND column_name='redemption_date'
  ) THEN
    ALTER TABLE bookings ADD COLUMN redemption_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='bookings' AND column_name='expiry_date'
  ) THEN
    ALTER TABLE bookings ADD COLUMN expiry_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='bookings' AND column_name='cancel_reason'
  ) THEN
    ALTER TABLE bookings ADD COLUMN cancel_reason TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='bookings' AND column_name='cancelled_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN cancelled_at TIMESTAMPTZ;
  END IF;
END$$;

-- Add new columns to carts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='carts' AND column_name='payment_txn_no'
  ) THEN
    ALTER TABLE carts ADD COLUMN payment_txn_no VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='carts' AND column_name='coupon_code'
  ) THEN
    ALTER TABLE carts ADD COLUMN coupon_code VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='carts' AND column_name='abandoned_at'
  ) THEN
    ALTER TABLE carts ADD COLUMN abandoned_at TIMESTAMPTZ;
  END IF;
END$$;

COMMIT;
