-- Migration: Add file_chunks table for scalable chunk metadata storage
-- This allows storing chunk info separately instead of in one giant JSON blob
-- Use Case: Files with 1000+ chunks where the JSON content exceeds Edge Function limits

-- New file_chunks table (normalized storage)
CREATE TABLE IF NOT EXISTS file_chunks (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,     -- Order of chunk in file
  url TEXT NOT NULL,                -- Discord CDN URL
  size INTEGER NOT NULL,            -- Chunk size in bytes
  iv INTEGER[],                     -- Encryption IV (nullable for unencrypted)
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique chunk per file
  UNIQUE(file_id, chunk_index)
);

-- Index for fast chunk lookups by file
CREATE INDEX IF NOT EXISTS idx_file_chunks_file_id ON file_chunks(file_id);

-- Enable RLS with service role access
ALTER TABLE file_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_chunks" ON file_chunks FOR ALL USING (true);

-- MIGRATION STRATEGY:
-- 1. For new large files (>500 chunks), store chunks in file_chunks table
-- 2. Set files.content to JSON: {"chunked": true, "count": N}
-- 3. For download, check if content.chunked is true, then fetch from file_chunks
-- 4. Existing files continue to work with content JSON (backward compat)

-- EDGE FUNCTION CHANGES NEEDED:
-- POST /files: If chunk count > 500, insert into file_chunks instead of content
-- GET /files/:userId/:fileId/chunks: New endpoint to fetch chunks for large files
-- Download logic: Check content.chunked flag to determine fetch method
