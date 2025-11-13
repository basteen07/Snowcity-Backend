BEGIN;

-- Combo slots table mirrors attraction slots for combo-specific capacity & pricing
CREATE TABLE IF NOT EXISTS combo_slots (
  combo_slot_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  combo_id      BIGINT NOT NULL REFERENCES combos(combo_id) ON DELETE CASCADE,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  capacity      INT NOT NULL CHECK (capacity >= 0),
  price         NUMERIC(10,2) DEFAULT NULL CHECK (price IS NULL OR price >= 0),
  available     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_combo_slot_dates CHECK (start_date <= end_date),
  CONSTRAINT chk_combo_slot_times CHECK (start_time < end_time),
  CONSTRAINT uq_combo_slot_window UNIQUE (combo_id, start_date, end_date, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_combo_slots_combo_id ON combo_slots(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_slots_available ON combo_slots(available);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_combo_slots_updated_at'
  ) THEN
    CREATE TRIGGER trg_combo_slots_updated_at
    BEFORE UPDATE ON combo_slots
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- Allow bookings to reference combos directly
ALTER TABLE bookings
  ALTER COLUMN attraction_id DROP NOT NULL;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS combo_id BIGINT REFERENCES combos(combo_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS combo_slot_id BIGINT REFERENCES combo_slots(combo_slot_id) ON DELETE SET NULL;

ALTER TABLE bookings
  ADD CONSTRAINT IF NOT EXISTS chk_booking_subject
  CHECK ((CASE WHEN attraction_id IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN combo_id IS NOT NULL THEN 1 ELSE 0 END) = 1);

-- Cart items can reference combo slots for availability checks
ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS combo_slot_id BIGINT REFERENCES combo_slots(combo_slot_id) ON DELETE SET NULL;

-- Store per-attraction entries for combo bookings
CREATE TABLE IF NOT EXISTS booking_combo_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  attraction_id BIGINT NOT NULL REFERENCES attractions(attraction_id) ON DELETE RESTRICT,
  slot_id BIGINT REFERENCES attraction_slots(slot_id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_combo_items_booking_attraction
  ON booking_combo_items(booking_id, attraction_id);

COMMIT;
