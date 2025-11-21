ALTER TABLE offers
  ADD COLUMN discount_type VARCHAR(20) NOT NULL DEFAULT 'percent',
  ADD COLUMN discount_value NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN max_discount NUMERIC(10, 2);

CREATE TABLE  offer_rules (
  rule_id SERIAL PRIMARY KEY,
  offer_id INTEGER NOT NULL REFERENCES offers(offer_id) ON DELETE CASCADE,
  target_type VARCHAR(32) NOT NULL CHECK (target_type IN ('attraction', 'combo')),
  target_id INTEGER,
  applies_to_all BOOLEAN NOT NULL DEFAULT FALSE,
  date_from DATE,
  date_to DATE,
  time_from TIME,
  time_to TIME,
  slot_type VARCHAR(32) CHECK (slot_type IN ('attraction', 'combo')),
  slot_id INTEGER,
  rule_discount_type VARCHAR(20) CHECK (rule_discount_type IN ('percent', 'amount')),
  rule_discount_value NUMERIC(10, 2),
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE offer_rules
  ADD CONSTRAINT offer_rules_target_required
  CHECK (applies_to_all OR target_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_offer_rules_offer ON offer_rules(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_rules_target ON offer_rules(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_offer_rules_slot ON offer_rules(slot_type, slot_id);
CREATE INDEX IF NOT EXISTS idx_offer_rules_priority ON offer_rules(priority);
