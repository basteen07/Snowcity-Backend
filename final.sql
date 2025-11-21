BEGIN;

-- Recommended: keep everything in UTC
SET TIME ZONE 'UTC';

-- Extensions
CREATE EXTENSION IF NOT EXISTS citext;

-- Drop old objects if they exist (idempotent)
DROP TABLE IF EXISTS
    notifications,
    api_logs,
    settings,
    analytics,
    banners,
    blogs,
    cms_pages,
    happy_hours,
    holidays,
    offers,
    coupons,
    combos,
    booking_addons,
    addons,
    bookings,
    attraction_slots,
    attractions,
    user_roles,
    role_permissions,
    permissions,
    roles,
    users
CASCADE;

-- Drop custom types if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN DROP TYPE payment_status; END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_mode') THEN DROP TYPE payment_mode; END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN DROP TYPE booking_status; END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN DROP TYPE notification_channel; END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN DROP TYPE notification_status; END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'offer_rule_type') THEN DROP TYPE offer_rule_type; END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_type') THEN DROP TYPE coupon_type; END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_status') THEN DROP TYPE api_status; END IF;
END$$;

-- Enums for robust, consistent values
CREATE TYPE payment_status AS ENUM ('Pending','Completed','Failed','Cancelled');
CREATE TYPE payment_mode   AS ENUM ('Online','Offline');
CREATE TYPE booking_status AS ENUM ('Booked','Redeemed','Expired','Cancelled');
CREATE TYPE notification_channel AS ENUM ('email','whatsapp');
CREATE TYPE notification_status  AS ENUM ('sent','failed','pending');
CREATE TYPE offer_rule_type AS ENUM ('holiday','happy_hour','weekday_special');
CREATE TYPE coupon_type     AS ENUM ('flat','percent','bogo','specific');
CREATE TYPE api_status      AS ENUM ('success','failed');

-- Utility: trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Sequence for human-friendly booking references
CREATE SEQUENCE IF NOT EXISTS booking_ref_seq;

-- USERS
CREATE TABLE users (
    user_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    email           CITEXT UNIQUE NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    password_hash   TEXT NOT NULL,
    otp_code        VARCHAR(10),
    otp_expires_at  TIMESTAMPTZ,
    otp_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    jwt_token       TEXT,
    jwt_expires_at  TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    last_ip         INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_email_format CHECK (email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'),
    CONSTRAINT chk_phone_format CHECK (phone IS NULL OR phone ~ '^[0-9+\-\s()]{7,20}$')
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ROLES & PERMISSIONS
CREATE TABLE roles (
    role_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_name       CITEXT UNIQUE NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_roles_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE permissions (
    permission_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    permission_key  CITEXT UNIQUE NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_permissions_updated_at
BEFORE UPDATE ON permissions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE role_permissions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_id         BIGINT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id   BIGINT NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_perm UNIQUE (role_id, permission_id)
);

CREATE TRIGGER trg_role_permissions_updated_at
BEFORE UPDATE ON role_permissions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- User-to-Role mapping (many-to-many)
CREATE TABLE user_roles (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id     BIGINT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

CREATE TRIGGER trg_user_roles_updated_at
BEFORE UPDATE ON user_roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- ATTRACTIONS
CREATE TABLE attractions (
    attraction_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title               VARCHAR(150) NOT NULL,
    slug                CITEXT UNIQUE,
    description         TEXT,
    image_url           VARCHAR(255),
    gallery             JSONB DEFAULT '[]'::jsonb,
    base_price          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
    price_per_hour      NUMERIC(10,2) DEFAULT 0 CHECK (price_per_hour >= 0),
    discount_percent    NUMERIC(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    badge               VARCHAR(50),
    video_url           VARCHAR(255),
    slot_capacity       INT NOT NULL DEFAULT 0 CHECK (slot_capacity >= 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_gallery_array CHECK (gallery IS NULL OR jsonb_typeof(gallery) = 'array')
);

CREATE TRIGGER trg_attractions_updated_at
BEFORE UPDATE ON attractions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_attractions_active ON attractions(active);

-- ATTRACTION SLOTS
CREATE TABLE attraction_slots (
    slot_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attraction_id   BIGINT NOT NULL REFERENCES attractions(attraction_id) ON DELETE CASCADE,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    capacity        INT NOT NULL CHECK (capacity >= 0),
    price           NUMERIC(10,2) DEFAULT NULL CHECK (price IS NULL OR price >= 0),
    available       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_slot_dates CHECK (start_date <= end_date),
    CONSTRAINT chk_slot_times CHECK (start_time < end_time),
    CONSTRAINT uq_slot_window UNIQUE (attraction_id, start_date, end_date, start_time, end_time)
);

CREATE TRIGGER trg_attraction_slots_updated_at
BEFORE UPDATE ON attraction_slots
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_attraction_slots_attraction_id ON attraction_slots(attraction_id);
CREATE INDEX idx_attraction_slots_available ON attraction_slots(available);

-- BOOKINGS
CREATE TABLE bookings (
    booking_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_ref     TEXT NOT NULL UNIQUE DEFAULT ('SC' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD') || LPAD(nextval('booking_ref_seq')::TEXT, 8, '0')),
    user_id         BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    attraction_id   BIGINT NOT NULL REFERENCES attractions(attraction_id) ON DELETE RESTRICT,
    slot_id         BIGINT REFERENCES attraction_slots(slot_id) ON DELETE SET NULL,
    quantity        INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    booking_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    booking_time    TIME NOT NULL DEFAULT CURRENT_TIME,
    total_amount    NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0 AND discount_amount <= total_amount),
    final_amount    NUMERIC(10,2) GENERATED ALWAYS AS (GREATEST(total_amount - discount_amount, 0)) STORED,
    payment_status  payment_status NOT NULL DEFAULT 'Pending',
    payment_mode    payment_mode NOT NULL DEFAULT 'Online',
    payment_ref     VARCHAR(100),
    booking_status  booking_status NOT NULL DEFAULT 'Booked',
    ticket_pdf      VARCHAR(255),
    whatsapp_sent   BOOLEAN NOT NULL DEFAULT FALSE,
    email_sent      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_payment_ref_when_completed CHECK (payment_status <> 'Completed' OR payment_ref IS NOT NULL)
);

CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_attraction_id ON bookings(attraction_id);
CREATE INDEX idx_bookings_slot_id ON bookings(slot_id);
CREATE INDEX idx_bookings_created_at ON bookings(created_at);
CREATE INDEX idx_bookings_payment_pending ON bookings(booking_id) WHERE payment_status = 'Pending';

-- ADDONS
CREATE TABLE addons (
    addon_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title           VARCHAR(100) NOT NULL,
    description     TEXT,
    price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    discount_percent NUMERIC(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    image_url       VARCHAR(255),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_addons_updated_at
BEFORE UPDATE ON addons
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- BOOKING ADDONS
CREATE TABLE booking_addons (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id      BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
    addon_id        BIGINT NOT NULL REFERENCES addons(addon_id) ON DELETE RESTRICT,
    quantity        INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_booking_addon UNIQUE (booking_id, addon_id)
);

CREATE TRIGGER trg_booking_addons_updated_at
BEFORE UPDATE ON booking_addons
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_booking_addons_booking_id ON booking_addons(booking_id);
CREATE INDEX idx_booking_addons_addon_id ON booking_addons(addon_id);

-- COMBOS
CREATE TABLE combos (
    combo_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attraction_1_id BIGINT NOT NULL REFERENCES attractions(attraction_id) ON DELETE CASCADE,
    attraction_2_id BIGINT NOT NULL REFERENCES attractions(attraction_id) ON DELETE CASCADE,
    combo_price     NUMERIC(10,2) NOT NULL CHECK (combo_price >= 0),
    discount_percent NUMERIC(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_combo_pair CHECK (attraction_1_id < attraction_2_id),
    CONSTRAINT uq_combo_pair UNIQUE (attraction_1_id, attraction_2_id)
);

CREATE TRIGGER trg_combos_updated_at
BEFORE UPDATE ON combos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- COUPONS
CREATE TABLE coupons (
    coupon_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            CITEXT UNIQUE NOT NULL,
    description     TEXT,
    type            coupon_type NOT NULL,
    value           NUMERIC(10,2) NOT NULL CHECK (value >= 0),
    attraction_id   BIGINT REFERENCES attractions(attraction_id) ON DELETE SET NULL,
    min_amount      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (min_amount >= 0),
    valid_from      DATE NOT NULL,
    valid_to        DATE NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_coupon_dates CHECK (valid_from <= valid_to)
);

CREATE TRIGGER trg_coupons_updated_at
BEFORE UPDATE ON coupons
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_coupons_attraction_id ON coupons(attraction_id);
CREATE INDEX idx_coupons_active_valid ON coupons(valid_from, valid_to) WHERE active = TRUE;

-- OFFERS
CREATE TABLE offers (
    offer_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title           VARCHAR(100) NOT NULL,
    description     TEXT,
    image_url       VARCHAR(255),
    rule_type       offer_rule_type,
    discount_percent NUMERIC(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    valid_from      DATE,
    valid_to        DATE,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_offer_dates CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);

CREATE TRIGGER trg_offers_updated_at
BEFORE UPDATE ON offers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_offers_valid ON offers(valid_from, valid_to, active);

-- CMS PAGES
CREATE TABLE cms_pages (
    page_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title           VARCHAR(100) NOT NULL,
    slug            CITEXT UNIQUE NOT NULL,
    content         TEXT NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_cms_pages_updated_at
BEFORE UPDATE ON cms_pages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_cms_pages_active ON cms_pages(active);

-- BLOGS
CREATE TABLE blogs (
    blog_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title           VARCHAR(150) NOT NULL,
    slug            CITEXT UNIQUE NOT NULL,
    content         TEXT,
    image_url       VARCHAR(255),
    author          VARCHAR(100),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_blogs_updated_at
BEFORE UPDATE ON blogs
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_blogs_active ON blogs(active);

-- BANNERS
CREATE TABLE banners (
    banner_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    web_image            VARCHAR(255),
    mobile_image         VARCHAR(255),
    title                VARCHAR(100),
    description          TEXT,
    linked_attraction_id BIGINT REFERENCES attractions(attraction_id) ON DELETE CASCADE,
    linked_offer_id      BIGINT REFERENCES offers(offer_id) ON DELETE CASCADE,
    active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_banners_updated_at
BEFORE UPDATE ON banners
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_banners_linked_attraction_id ON banners(linked_attraction_id);
CREATE INDEX idx_banners_linked_offer_id ON banners(linked_offer_id);
CREATE INDEX idx_banners_active ON banners(active);

-- MEDIA FILES (for uploads with ID-based retrieval)
CREATE TABLE media_files (
    media_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    url_path       VARCHAR(255) NOT NULL,
    relative_path  VARCHAR(255) NOT NULL,
    filename       VARCHAR(255) NOT NULL,
    size           BIGINT NOT NULL,
    mimetype       VARCHAR(100) NOT NULL,
    folder         VARCHAR(100),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_files_folder ON media_files(folder);

-- ANALYTICS
CREATE TABLE analytics (
    analytics_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attraction_id   BIGINT NOT NULL REFERENCES attractions(attraction_id) ON DELETE CASCADE,
    total_bookings  INT NOT NULL DEFAULT 0 CHECK (total_bookings >= 0),
    total_people    INT NOT NULL DEFAULT 0 CHECK (total_people >= 0),
    total_revenue   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_revenue >= 0),
    report_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_analytics_day UNIQUE (attraction_id, report_date)
);

CREATE TRIGGER trg_analytics_updated_at
BEFORE UPDATE ON analytics
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_analytics_attraction_date ON analytics(attraction_id, report_date);

-- SETTINGS
CREATE TABLE settings (
    setting_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key_name        CITEXT UNIQUE NOT NULL,
    key_value       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_settings_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- API LOGS
CREATE TABLE api_logs (
    log_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    endpoint        VARCHAR(255) NOT NULL,
    payload         JSONB,
    response_code   INT NOT NULL,
    status          api_status NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_logs_endpoint ON api_logs(endpoint);
CREATE INDEX idx_api_logs_created_at ON api_logs(created_at);

-- NOTIFICATIONS
CREATE TABLE notifications (
    notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
    booking_id      BIGINT REFERENCES bookings(booking_id) ON DELETE CASCADE,
    channel         notification_channel NOT NULL,
    status          notification_status NOT NULL DEFAULT 'pending',
    message         TEXT,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_booking_id ON notifications(booking_id);
CREATE INDEX idx_notifications_pending ON notifications(notification_id) WHERE status = 'pending';

-- HOLIDAYS
CREATE TABLE holidays (
    holiday_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    holiday_date    DATE NOT NULL UNIQUE,
    description     VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_holidays_updated_at
BEFORE UPDATE ON holidays
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- HAPPY HOURS
CREATE TABLE happy_hours (
    hh_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attraction_id   BIGINT NOT NULL REFERENCES attractions(attraction_id) ON DELETE CASCADE,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_hh_times CHECK (start_time < end_time)
);

CREATE TRIGGER trg_happy_hours_updated_at
BEFORE UPDATE ON happy_hours
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_happy_hours_attraction_id ON happy_hours(attraction_id);

COMMIT;



select * from users;

select * from attractions;

select * from permissions;
select * from roles;

select * from role_permissions;

select






SELECT booking_id, user_id, booking_ref, payment_status
FROM bookings
WHERE booking_id = 2;

SELECT booking_id, user_id, booking_ref, payment_status
FROM bookings
WHERE booking_id = 2;






BEGIN;

SET TIME ZONE 'UTC';

-- Cart status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cart_status') THEN
    CREATE TYPE cart_status AS ENUM ('Open','Paid','Cancelled','Abandoned');
  END IF;
END$$;

-- Sequence for human-friendly cart references
CREATE SEQUENCE IF NOT EXISTS cart_ref_seq;

-- Carts table
CREATE TABLE IF NOT EXISTS carts (
  cart_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_ref       TEXT NOT NULL UNIQUE DEFAULT ('SCART' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD') || LPAD(nextval('cart_ref_seq')::TEXT, 8, '0')),
  user_id        BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  session_id     VARCHAR(100),
  total_amount   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0 AND discount_amount <= total_amount),
  final_amount   NUMERIC(10,2) GENERATED ALWAYS AS (GREATEST(total_amount - discount_amount, 0)) STORED,
  payment_status payment_status NOT NULL DEFAULT 'Pending',
  payment_mode   payment_mode NOT NULL DEFAULT 'Online',
  payment_ref    VARCHAR(100),
  status         cart_status NOT NULL DEFAULT 'Open',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id);
CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);

-- Trigger to maintain updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_carts_updated_at'
  ) THEN
    CREATE TRIGGER trg_carts_updated_at
    BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- Cart items
CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_id        BIGINT NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
  item_type      VARCHAR(20) NOT NULL CHECK (item_type IN ('attraction','combo','offer','page','blog')),
  attraction_id  BIGINT REFERENCES attractions(attraction_id) ON DELETE SET NULL,
  combo_id       BIGINT,
  offer_id       BIGINT,
  slot_id        BIGINT REFERENCES attraction_slots(slot_id) ON DELETE SET NULL,
  booking_date   DATE,
  booking_time   TIME,
  quantity       INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_amount   NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  meta           JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_type ON cart_items(item_type);
CREATE INDEX IF NOT EXISTS idx_cart_items_slot_id ON cart_items(slot_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cart_items_updated_at'
  ) THEN
    CREATE TRIGGER trg_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- Map bookings created from a cart (post-payment)
CREATE TABLE IF NOT EXISTS cart_bookings (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_id       BIGINT NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
  booking_id    BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_booking ON cart_bookings(cart_id, booking_id);

COMMIT;

















BEGIN;

SET TIME ZONE 'UTC';

-- Add meta and gallery fields to blogs and cms_pages
ALTER TABLE blogs
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS meta_keywords TEXT,
  ADD COLUMN IF NOT EXISTS section_type VARCHAR(20) DEFAULT 'none' CHECK (section_type IN ('none','attraction','combo','offer','blog','page')),
  ADD COLUMN IF NOT EXISTS section_ref_id BIGINT,
  ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::jsonb,
  ADD CONSTRAINT chk_blogs_gallery_array CHECK (gallery IS NULL OR jsonb_typeof(gallery) = 'array');

ALTER TABLE cms_pages
  ADD COLUMN IF NOT EXISTS meta_title TEXT,
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS meta_keywords TEXT,
  ADD COLUMN IF NOT EXISTS section_type VARCHAR(20) DEFAULT 'none' CHECK (section_type IN ('none','attraction','combo','offer','blog','page')),
  ADD COLUMN IF NOT EXISTS section_ref_id BIGINT,
  ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::jsonb,
  ADD CONSTRAINT chk_pages_gallery_array CHECK (gallery IS NULL OR jsonb_typeof(gallery) = 'array');

-- Optional global gallery for photos/videos
CREATE TABLE IF NOT EXISTS gallery_items (
  gallery_item_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image','video')),
  url TEXT NOT NULL,
  title VARCHAR(150),
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_gallery_items_updated_at'
  ) THEN
    CREATE TRIGGER trg_gallery_items_updated_at
    BEFORE UPDATE ON gallery_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_gallery_items_active ON gallery_items(active);

COMMIT;







BEGIN;

SET TIME ZONE 'UTC';

-- Cart status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cart_status') THEN
    CREATE TYPE cart_status AS ENUM ('Open','Paid','Cancelled','Abandoned');
  END IF;
END$$;

-- Sequence for human-friendly cart references
CREATE SEQUENCE IF NOT EXISTS cart_ref_seq;

-- Carts table
CREATE TABLE IF NOT EXISTS carts (
  cart_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_ref       TEXT NOT NULL UNIQUE DEFAULT ('SCART' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD') || LPAD(nextval('cart_ref_seq')::TEXT, 8, '0')),
  user_id        BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
  session_id     VARCHAR(100),
  total_amount   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0 AND discount_amount <= total_amount),
  final_amount   NUMERIC(10,2) GENERATED ALWAYS AS (GREATEST(total_amount - discount_amount, 0)) STORED,
  payment_status payment_status NOT NULL DEFAULT 'Pending',
  payment_mode   payment_mode NOT NULL DEFAULT 'Online',
  payment_ref    VARCHAR(100),
  status         cart_status NOT NULL DEFAULT 'Open',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id);
CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status);

-- Trigger to maintain updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_carts_updated_at'
  ) THEN
    CREATE TRIGGER trg_carts_updated_at
    BEFORE UPDATE ON carts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- Cart items
CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_id        BIGINT NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
  item_type      VARCHAR(20) NOT NULL CHECK (item_type IN ('attraction','combo','offer','page','blog')),
  attraction_id  BIGINT REFERENCES attractions(attraction_id) ON DELETE SET NULL,
  combo_id       BIGINT,
  offer_id       BIGINT,
  slot_id        BIGINT REFERENCES attraction_slots(slot_id) ON DELETE SET NULL,
  booking_date   DATE,
  booking_time   TIME,
  quantity       INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_amount   NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  meta           JSONB DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_type ON cart_items(item_type);
CREATE INDEX IF NOT EXISTS idx_cart_items_slot_id ON cart_items(slot_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cart_items_updated_at'
  ) THEN
    CREATE TRIGGER trg_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END$$;

-- Map bookings created from a cart (post-payment)
CREATE TABLE IF NOT EXISTS cart_bookings (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_id       BIGINT NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
  booking_id    BIGINT NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_booking ON cart_bookings(cart_id, booking_id);

COMMIT;







-- carts table
ALTER TABLE carts ADD COLUMN IF NOT EXISTS cart_ref TEXT UNIQUE;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';
ALTER TABLE carts ADD COLUMN IF NOT EXISTS payment_ref TEXT;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS payment_txn_no TEXT;

-- cart_items
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) DEFAULT 0;



-- carts
ALTER TABLE carts ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS payment_ref TEXT;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';

-- bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_ref TEXT;

-- carts
ALTER TABLE carts ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS payment_ref TEXT;
ALTER TABLE carts ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';

-- cart_items
ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) DEFAULT 0;










ro



BEGIN;

-- Create ENUM if not exists
DO $$
BEGIN
    CREATE TYPE booking_item_type AS ENUM ('Attraction', 'Combo');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END$$;

-- Add columns safely
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS item_type booking_item_type,
ADD COLUMN IF NOT EXISTS combo_id BIGINT REFERENCES combos(combo_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS combo_slot_id BIGINT REFERENCES combo_slots(combo_slot_id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS offer_id BIGINT REFERENCES offers(offer_id) ON DELETE SET NULL;

-- Fix: Cast text to ENUM
UPDATE bookings
SET item_type = CASE 
    WHEN combo_id IS NOT NULL THEN 'Combo'::booking_item_type
    ELSE 'Attraction'::booking_item_type
END
WHERE item_type IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_combo_id ON bookings(combo_id);
CREATE INDEX IF NOT EXISTS idx_bookings_combo_slot_id ON bookings(combo_slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_offer_id ON bookings(offer_id);

COMMIT;





select * from attraction_slots;


select * from bookings;
select * from users;


select* from orders;


BEGIN;

-- 1. Create an ORDERS table (Parent table for the payment)
CREATE TABLE IF NOT EXISTS orders (
    order_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_ref       VARCHAR(50) UNIQUE NOT NULL DEFAULT ('ORD' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD') || substring(md5(random()::text), 1, 6)),
    user_id         BIGINT REFERENCES users(user_id) ON DELETE SET NULL,
    total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(10,2) DEFAULT 0,
    final_amount    NUMERIC(10,2) GENERATED ALWAYS AS (GREATEST(total_amount - discount_amount, 0)) STORED,
    payment_status  payment_status NOT NULL DEFAULT 'Pending', -- Uses your existing ENUM
    payment_mode    payment_mode DEFAULT 'Online',
    payment_ref     VARCHAR(100),
    coupon_code     VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Modify BOOKINGS table to support Multi-Item logic
-- First, drop the constraint that is causing the error
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_booking_subject;

-- Make attraction_id NULLABLE (Crucial for Combos)
ALTER TABLE bookings ALTER COLUMN attraction_id DROP NOT NULL;

-- Add link to the Order parent
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(order_id) ON DELETE CASCADE;

-- Ensure item_type column exists and uses the ENUM or VARCHAR
DO $$ 
BEGIN
    -- If you haven't created the enum yet, create it, or just use VARCHAR
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_item_type') THEN
        CREATE TYPE booking_item_type AS ENUM ('Attraction', 'Combo');
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE bookings 
    ADD COLUMN IF NOT EXISTS item_type booking_item_type DEFAULT 'Attraction',
    ADD COLUMN IF NOT EXISTS combo_id BIGINT REFERENCES combos(combo_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS combo_slot_id BIGINT, -- Assuming you might have a combo_slots table or logic
    ADD COLUMN IF NOT EXISTS offer_id BIGINT REFERENCES offers(offer_id) ON DELETE SET NULL;

-- 3. Add the Correct Constraint (The Fix)
-- This ensures a booking is EITHER an Attraction OR a Combo, never both, never neither.
ALTER TABLE bookings 
ADD CONSTRAINT chk_booking_subject 
CHECK (
    (item_type = 'Attraction' AND attraction_id IS NOT NULL AND combo_id IS NULL) OR
    (item_type = 'Combo' AND combo_id IS NOT NULL AND attraction_id IS NULL)
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_order_id ON bookings(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

COMMIT;












ALTER TABLE offers
  ADD COLUMN discount_type VARCHAR(20) NOT NULL DEFAULT 'percent',
  ADD COLUMN discount_amount NUMERIC(10, 2) DEFAULT 0,
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






ALTER TABLE offers ADD COLUMN discount_value NUMERIC(10, 2) DEFAULT 0;









































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



ALTER TABLE offer_rules
  ADD COLUMN rule_discount_type VARCHAR(20) CHECK (rule_discount_type IN ('percent','amount')),
  ADD COLUMN rule_discount_value NUMERIC(10,2);