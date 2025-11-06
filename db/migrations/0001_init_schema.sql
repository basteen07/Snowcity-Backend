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
    linked_attraction_id BIGINT REFERENCES attractions(attraction_id) ON DELETE SET NULL,
    linked_offer_id      BIGINT REFERENCES offers(offer_id) ON DELETE SET NULL,
    active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_banners_updated_at
BEFORE UPDATE ON banners
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_banners_linked_attraction_id ON banners(linked_attraction_id);
CREATE INDEX idx_banners_linked_offer_id ON banners(linked_offer_id);

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