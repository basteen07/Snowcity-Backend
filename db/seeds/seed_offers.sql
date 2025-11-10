BEGIN;

-- Insert offers with Unsplash images
INSERT INTO offers (title, description, image_url, rule_type, discount_percent, valid_from, valid_to, active)
VALUES
(
  'Weekend Special',
  'Get 20% off on all attractions during weekends!',
  'https://images.unsplash.com/photo-1519336056116-9e0d0c7c0a4c?w=1200&h=600&fit=crop&q=80',
  'weekday_special',
  20.00,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '90 days',
  TRUE
),
(
  'Holiday Bonanza',
  'Special holiday discount - 25% off on all premium attractions!',
  'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1200&h=600&fit=crop&q=80',
  'holiday',
  25.00,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '60 days',
  TRUE
),
(
  'Happy Hour Deal',
  'Afternoon special - 15% off on bookings between 2 PM and 5 PM!',
  'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1200&h=600&fit=crop&q=80',
  'happy_hour',
  15.00,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  TRUE
),
(
  'Family Package',
  'Perfect for families - 30% off when booking 3 or more attractions!',
  'https://images.unsplash.com/photo-1517384084767-b6b27c578016?w=1200&h=600&fit=crop&q=80',
  NULL,
  30.00,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '120 days',
  TRUE
)
ON CONFLICT DO NOTHING;

COMMIT;

