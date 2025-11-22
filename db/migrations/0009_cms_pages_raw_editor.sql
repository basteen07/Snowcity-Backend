BEGIN;

SET TIME ZONE 'UTC';

-- Extend cms_pages with raw editor + navigation placement fields
ALTER TABLE cms_pages
  ADD COLUMN IF NOT EXISTS editor_mode VARCHAR(10) NOT NULL DEFAULT 'rich' CHECK (editor_mode IN ('rich','raw')),
  ADD COLUMN IF NOT EXISTS raw_html TEXT,
  ADD COLUMN IF NOT EXISTS raw_css TEXT,
  ADD COLUMN IF NOT EXISTS raw_js TEXT,
  ADD COLUMN IF NOT EXISTS nav_group VARCHAR(50),
  ADD COLUMN IF NOT EXISTS nav_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS placement VARCHAR(30) NOT NULL DEFAULT 'none' CHECK (placement IN ('none','home_bottom','attraction_details')),
  ADD COLUMN IF NOT EXISTS placement_ref_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_cms_pages_nav_group ON cms_pages(nav_group);

-- Extend blogs with raw editor fields
ALTER TABLE blogs
  ADD COLUMN IF NOT EXISTS editor_mode VARCHAR(10) NOT NULL DEFAULT 'rich' CHECK (editor_mode IN ('rich','raw')),
  ADD COLUMN IF NOT EXISTS raw_html TEXT,
  ADD COLUMN IF NOT EXISTS raw_css TEXT,
  ADD COLUMN IF NOT EXISTS raw_js TEXT;

COMMIT;
