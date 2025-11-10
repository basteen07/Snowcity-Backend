BEGIN;

-- Insert banners with real Unsplash images linking to attractions and offers
INSERT INTO banners (web_image, mobile_image, title, description, linked_attraction_id, linked_offer_id, active)
SELECT 
  'https://images.unsplash.com/photo-1551524164-687a55dd1126?w=1200&h=600&fit=crop&q=80' AS web_image,
  'https://images.unsplash.com/photo-1551524164-687a55dd1126?w=600&h=800&fit=crop&q=80' AS mobile_image,
  'Winter Wonderland Awaits!',
  'Experience the magic of winter with our snow park adventure. Book now and get 20% off!',
  a.attraction_id,
  NULL,
  TRUE
FROM attractions a
WHERE a.slug = 'snow-park-adventure'
ON CONFLICT DO NOTHING;

INSERT INTO banners (web_image, mobile_image, title, description, linked_attraction_id, linked_offer_id, active)
SELECT 
  'https://images.unsplash.com/photo-1519659528534-7fd733a832a0?w=1200&h=600&fit=crop&q=80' AS web_image,
  'https://images.unsplash.com/photo-1519659528534-7fd733a832a0?w=600&h=800&fit=crop&q=80' AS mobile_image,
  'Slide Into Fun!',
  'Race down our thrilling ice slides. Perfect for families and thrill-seekers!',
  a.attraction_id,
  NULL,
  TRUE
FROM attractions a
WHERE a.slug = 'ice-slide-thrills'
ON CONFLICT DO NOTHING;

INSERT INTO banners (web_image, mobile_image, title, description, linked_attraction_id, linked_offer_id, active)
SELECT 
  'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=1200&h=600&fit=crop&q=80' AS web_image,
  'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&h=800&fit=crop&q=80' AS mobile_image,
  'Meet the Penguins!',
  'Get up close with adorable penguins in our new encounter zone. Educational and fun!',
  a.attraction_id,
  NULL,
  TRUE
FROM attractions a
WHERE a.slug = 'penguin-encounter-zone'
ON CONFLICT DO NOTHING;

INSERT INTO banners (web_image, mobile_image, title, description, linked_attraction_id, linked_offer_id, active)
SELECT 
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=600&fit=crop&q=80' AS web_image,
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=800&fit=crop&q=80' AS mobile_image,
  'Explore Ice Caves',
  'Discover the magical world of ice caves. Premium experience with guided tours.',
  a.attraction_id,
  NULL,
  TRUE
FROM attractions a
WHERE a.slug = 'ice-cave-exploration'
ON CONFLICT DO NOTHING;

INSERT INTO banners (web_image, mobile_image, title, description, linked_attraction_id, linked_offer_id, active)
SELECT 
  'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1200&h=600&fit=crop&q=80' AS web_image,
  'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&h=800&fit=crop&q=80' AS mobile_image,
  'Ice Skating Fun',
  'Glide across our Olympic-sized rink. Perfect for beginners and pros alike!',
  a.attraction_id,
  NULL,
  TRUE
FROM attractions a
WHERE a.slug = 'ice-skating-rink'
ON CONFLICT DO NOTHING;

INSERT INTO banners (web_image, mobile_image, title, description, linked_attraction_id, linked_offer_id, active)
SELECT 
  'https://images.unsplash.com/photo-1579033462043-0f11a7862f7d?w=1200&h=600&fit=crop&q=80' AS web_image,
  'https://images.unsplash.com/photo-1579033462043-0f11a7862f7d?w=600&h=800&fit=crop&q=80' AS mobile_image,
  'Snowball Battle Arena',
  'Epic snowball battles await! Team competitions and target practice for all ages.',
  a.attraction_id,
  NULL,
  TRUE
FROM attractions a
WHERE a.slug = 'snowball-arena'
ON CONFLICT DO NOTHING;

-- Generic promotional banner linking to offer
INSERT INTO banners (web_image, mobile_image, title, description, linked_attraction_id, linked_offer_id, active)
SELECT 
  'https://images.unsplash.com/photo-1519336056116-9e0d0c7c0a4c?w=1200&h=600&fit=crop&q=80' AS web_image,
  'https://images.unsplash.com/photo-1519336056116-9e0d0c7c0a4c?w=600&h=800&fit=crop&q=80' AS mobile_image,
  'Winter Festival Special',
  'Book any combo and save up to 25%! Limited time offer.',
  NULL,
  o.offer_id,
  TRUE
FROM offers o
WHERE o.title = 'Holiday Bonanza'
LIMIT 1
ON CONFLICT DO NOTHING;

COMMIT;

