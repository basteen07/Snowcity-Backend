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
