BEGIN;

-- Create combos by pairing different attractions with attractive pricing
INSERT INTO combos (attraction_1_id, attraction_2_id, combo_price, discount_percent, active)
SELECT 
  a1.attraction_id,
  a2.attraction_id,
  (a1.base_price + a2.base_price) * 0.85, -- 15% discount on combo
  15.00,
  TRUE
FROM attractions a1
CROSS JOIN attractions a2
WHERE a1.attraction_id < a2.attraction_id
  AND a1.active = TRUE
  AND a2.active = TRUE
  AND a1.slug IN ('snow-park-adventure', 'ice-slide-thrills', 'penguin-encounter-zone', 'ice-skating-rink', 'snow-tubing-adventure')
  AND a2.slug IN ('snow-park-adventure', 'ice-slide-thrills', 'penguin-encounter-zone', 'ice-skating-rink', 'snow-tubing-adventure')
ON CONFLICT (attraction_1_id, attraction_2_id) DO UPDATE SET
  combo_price = EXCLUDED.combo_price,
  discount_percent = EXCLUDED.discount_percent,
  active = EXCLUDED.active;

-- Special premium combos with higher discounts
INSERT INTO combos (attraction_1_id, attraction_2_id, combo_price, discount_percent, active)
SELECT 
  a1.attraction_id,
  a2.attraction_id,
  (a1.base_price + a2.base_price) * 0.75, -- 25% discount on premium combos
  25.00,
  TRUE
FROM attractions a1
CROSS JOIN attractions a2
WHERE a1.attraction_id < a2.attraction_id
  AND a1.active = TRUE
  AND a2.active = TRUE
  AND (
    (a1.slug = 'ice-cave-exploration' AND a2.slug IN ('snow-park-adventure', 'ice-skating-rink'))
    OR (a1.slug = 'snow-park-adventure' AND a2.slug = 'ice-skating-rink')
  )
ON CONFLICT (attraction_1_id, attraction_2_id) DO UPDATE SET
  combo_price = EXCLUDED.combo_price,
  discount_percent = EXCLUDED.discount_percent,
  active = EXCLUDED.active;

COMMIT;

