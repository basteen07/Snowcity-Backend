BEGIN;

-- Create a few sample slots for each attraction
-- Snow Park
INSERT INTO attraction_slots (attraction_id, start_date, end_date, start_time, end_time, capacity, available)
SELECT a.attraction_id, CURRENT_DATE, CURRENT_DATE, '10:00', '11:00', 50, TRUE
FROM attractions a WHERE a.slug = 'snow-park'
ON CONFLICT DO NOTHING;

INSERT INTO attraction_slots (attraction_id, start_date, end_date, start_time, end_time, capacity, available)
SELECT a.attraction_id, CURRENT_DATE, CURRENT_DATE, '12:00', '13:00', 50, TRUE
FROM attractions a WHERE a.slug = 'snow-park'
ON CONFLICT DO NOTHING;

-- Ice Slide
INSERT INTO attraction_slots (attraction_id, start_date, end_date, start_time, end_time, capacity, available)
SELECT a.attraction_id, CURRENT_DATE, CURRENT_DATE, '11:00', '12:00', 40, TRUE
FROM attractions a WHERE a.slug = 'ice-slide'
ON CONFLICT DO NOTHING;

-- Penguin Zone
INSERT INTO attraction_slots (attraction_id, start_date, end_date, start_time, end_time, capacity, available)
SELECT a.attraction_id, CURRENT_DATE, CURRENT_DATE, '14:00', '15:00', 30, TRUE
FROM attractions a WHERE a.slug = 'penguin-zone'
ON CONFLICT DO NOTHING;

COMMIT;