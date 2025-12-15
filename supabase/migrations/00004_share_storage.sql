-- Add storage support for share links
-- Small files (<25MB) are copied to Supabase Storage for permanent download links

ALTER TABLE shares ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_shares_expires_at ON shares(expires_at) WHERE expires_at IS NOT NULL;
