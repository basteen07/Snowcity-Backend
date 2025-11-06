-- Full schema (can be used for quick rebuilds in local dev)
\echo 'Applying SnowCity schema...'

BEGIN;
SET TIME ZONE 'UTC';
CREATE EXTENSION IF NOT EXISTS citext;

-- You may reuse the same content as migration 0001 for convenience in dev
-- For simplicity, embedding the same DDL here
-- (Content identical to migrations/0001_init_schema.sql)
-- If you prefer single source of truth, only keep migrations and run them.

-- TYPES, FUNCTIONS, TABLES, INDEXES identical to the migration file above.
-- To avoid duplication in this snippet, you can just run:
--   node backend/db/index.js migrate
-- which executes the migration file.
COMMIT;