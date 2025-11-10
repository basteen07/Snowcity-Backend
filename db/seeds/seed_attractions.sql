BEGIN;

-- Clear existing data (optional, comment out if you want to keep existing data)
-- TRUNCATE TABLE attractions CASCADE;

-- Insert attractions with real Unsplash images
INSERT INTO attractions (title, slug, description, image_url, gallery, base_price, price_per_hour, discount_percent, active, badge, slot_capacity)
VALUES
(
  'Snow Park Adventure',
  'snow-park-adventure',
  'Experience the ultimate winter wonderland! Enjoy snowboarding, skiing, and snowball fights in our state-of-the-art snow park. Perfect for families and adventure enthusiasts.',
  'https://images.unsplash.com/photo-1551524164-687a55dd1126?w=1200&h=600&fit=crop&q=80',
  '["https://images.unsplash.com/photo-1551524164-687a55dd1126?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1519336056116-9e0d0c7c0a4c?w=800&h=600&fit=crop"]'::jsonb,
  1299.00,
  0,
  0,
  TRUE,
  'Popular',
  50
),
(
  'Ice Slide Thrills',
  'ice-slide-thrills',
  'Race down our thrilling ice slides! Multiple lanes, varying speeds, and guaranteed fun for all ages. Safety equipment included.',
  'https://images.unsplash.com/photo-1519659528534-7fd733a832a0?w=1200&h=600&fit=crop&q=80',
  '["https://images.unsplash.com/photo-1519659528534-7fd733a832a0?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&h=600&fit=crop"]'::jsonb,
  799.00,
  0,
  15,
  TRUE,
  'Hot Deal',
  40
),
(
  'Penguin Encounter Zone',
  'penguin-encounter-zone',
  'Meet and interact with adorable penguins! Educational sessions, photo opportunities, and unforgettable memories. Perfect for kids and animal lovers.',
  'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1200&h=600&fit=crop&q=80',
  '["https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1583336668537-09f0b6b1b1b2?w=800&h=600&fit=crop"]'::jsonb,
  999.00,
  0,
  0,
  TRUE,
  'New',
  30
),
(
  'Snowball Arena',
  'snowball-arena',
  'Epic snowball battles in our safe, controlled arena! Team competitions, target practice, and endless fun. Equipment and safety gear provided.',
  'https://images.unsplash.com/photo-1579033462043-0f11a7862f7d?w=1200&h=600&fit=crop&q=80',
  '["https://images.unsplash.com/photo-1579033462043-0f11a7862f7d?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&h=600&fit=crop"]'::jsonb,
  699.00,
  0,
  10,
  TRUE,
  NULL,
  45
),
(
  'Ice Skating Rink',
  'ice-skating-rink',
  'Glide across our Olympic-sized ice skating rink! Skates available for rent, music, and professional instructors for beginners.',
  'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1200&h=600&fit=crop&q=80',
  '["https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop"]'::jsonb,
  599.00,
  200.00,
  0,
  TRUE,
  NULL,
  60
),
(
  'Snowman Building Workshop',
  'snowman-building-workshop',
  'Create your perfect snowman! All materials provided including carrots, scarves, hats, and accessories. Great for families and creative minds.',
  'https://images.unsplash.com/photo-1517384084767-b6b27c578016?w=1200&h=600&fit=crop&q=80',
  '["https://images.unsplash.com/photo-1517384084767-b6b27c578016?w=800&h=600&fit=crop"]'::jsonb,
  499.00,
  0,
  5,
  TRUE,
  'Family Favorite',
  35
),
(
  'Ice Cave Exploration',
  'ice-cave-exploration',
  'Discover the magical world of ice caves! Guided tours through stunning ice formations, crystal-clear ice sculptures, and breathtaking views.',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=600&fit=crop&q=80',
  '["https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&h=600&fit=crop"]'::jsonb,
  1499.00,
  0,
  20,
  TRUE,
  'Premium',
  25
),
(
  'Snow Tubing Adventure',
  'snow-tubing-adventure',
  'Slide down our snow tubing lanes! Multiple slopes for different thrill levels. Tubes provided, safety briefings included.',
  'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1200&h=600&fit=crop&q=80',
  '["https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&h=600&fit=crop"]'::jsonb,
  899.00,
  0,
  0,
  TRUE,
  NULL,
  50
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url,
  gallery = EXCLUDED.gallery,
  base_price = EXCLUDED.base_price,
  price_per_hour = EXCLUDED.price_per_hour,
  discount_percent = EXCLUDED.discount_percent,
  badge = EXCLUDED.badge,
  slot_capacity = EXCLUDED.slot_capacity;

COMMIT;
