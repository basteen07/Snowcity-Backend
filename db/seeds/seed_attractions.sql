BEGIN;

INSERT INTO attractions (title, slug, description, image_url, gallery, base_price, price_per_hour, discount_percent, active, badge, slot_capacity)
VALUES
('Snow Park', 'snow-park', 'Experience the snow wonderland', 'https://picsum.photos/seed/snowpark/800/400', '[]', 799.00, 0, 0, TRUE, 'Popular', 50),
('Ice Slide', 'ice-slide', 'Thrilling ice slides for all ages', 'https://picsum.photos/seed/iceslide/800/400', '[]', 499.00, 0, 10, TRUE, NULL, 40),
('Penguin Zone', 'penguin-zone', 'Meet adorable penguin mascots', 'https://picsum.photos/seed/penguin/800/400', '[]', 599.00, 0, 0, TRUE, 'New', 30)
ON CONFLICT (slug) DO NOTHING;

COMMIT;