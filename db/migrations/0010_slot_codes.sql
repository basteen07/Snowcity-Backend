BEGIN;

ALTER TABLE attraction_slots ADD COLUMN slot_code VARCHAR(32);
ALTER TABLE combo_slots ADD COLUMN combo_slot_code VARCHAR(32);

WITH ranked AS (
  SELECT
    s.slot_id,
    lower(COALESCE(NULLIF(SUBSTRING(a.title FROM 1 FOR 1), ''), 'x')) AS name_letter,
    lower(SUBSTRING(TO_CHAR(s.start_date, 'Month') FROM 1 FOR 1)) AS month_letter,
    TO_CHAR(s.start_date, 'DD') AS day_token,
    LPAD(
      row_number() OVER (PARTITION BY s.attraction_id, s.start_date ORDER BY s.start_time)::text,
      2,
      '0'
    ) AS slot_token,
    LPAD(s.capacity::text, 3, '0') AS cap_token
  FROM attraction_slots s
  JOIN attractions a ON a.attraction_id = s.attraction_id
)
UPDATE attraction_slots AS s
SET slot_code = ranked.name_letter || ranked.month_letter || ranked.day_token || ranked.slot_token || ranked.cap_token
FROM ranked
WHERE ranked.slot_id = s.slot_id;

ALTER TABLE attraction_slots
  ALTER COLUMN slot_code SET NOT NULL,
  ADD CONSTRAINT uq_attraction_slots_slot_code UNIQUE (attraction_id, slot_code);

WITH ranked AS (
  SELECT
    cs.combo_slot_id,
    ('c' || cs.combo_id::text) AS combo_prefix,
    lower(SUBSTRING(TO_CHAR(cs.start_date, 'Month') FROM 1 FOR 1)) AS month_letter,
    TO_CHAR(cs.start_date, 'DD') AS day_token,
    LPAD(
      row_number() OVER (PARTITION BY cs.combo_id, cs.start_date ORDER BY cs.start_time)::text,
      2,
      '0'
    ) AS slot_token,
    LPAD(cs.capacity::text, 3, '0') AS cap_token
  FROM combo_slots cs
)
UPDATE combo_slots AS cs
SET combo_slot_code = ranked.combo_prefix || ranked.month_letter || ranked.day_token || ranked.slot_token || ranked.cap_token
FROM ranked
WHERE ranked.combo_slot_id = cs.combo_slot_id;

ALTER TABLE combo_slots
  ALTER COLUMN combo_slot_code SET NOT NULL,
  ADD CONSTRAINT uq_combo_slots_combo_slot_code UNIQUE (combo_id, combo_slot_code);

COMMIT;
