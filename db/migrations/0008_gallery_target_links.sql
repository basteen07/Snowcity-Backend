BEGIN;

SET TIME ZONE 'UTC';

-- Allow gallery items to be scoped to a specific attraction or combo
ALTER TABLE IF EXISTS gallery_items
  ADD COLUMN IF NOT EXISTS target_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (target_type IN ('none','attraction','combo')),
  ADD COLUMN IF NOT EXISTS target_ref_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_gallery_items_target ON gallery_items(target_type, target_ref_id);

COMMIT;







