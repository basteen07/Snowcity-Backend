-- Allow password_hash to be NULL for passwordless users
-- Regular users (passwordless) will have NULL password_hash
-- Admin users will have password_hash set

ALTER TABLE users 
ALTER COLUMN password_hash DROP NOT NULL;

-- Add a check constraint to ensure at least one authentication method exists
-- (Either password_hash OR phone must be present for regular users)
-- Note: Admin users will have password_hash, regular users can have NULL password_hash

