-- Wyvern Drive database schema
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  parent_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('file', 'directory')),
  size INTEGER DEFAULT 0,
  content TEXT,
  encrypted INTEGER DEFAULT 0,
  encryption_salt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_parent_id ON files(parent_id);

CREATE TABLE IF NOT EXISTS file_versions (
  id SERIAL PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_versions_file_id ON file_versions(file_id);

-- Disable RLS for now (we handle auth at Edge Function level)
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_versions ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "service_role_files" ON files FOR ALL USING (true);
CREATE POLICY "service_role_versions" ON file_versions FOR ALL USING (true);
