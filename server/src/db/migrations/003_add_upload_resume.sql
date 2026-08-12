-- Migration 003: resumable uploads. Client-generated upload tokens let a
-- failed/interrupted upload be resumed against the same entry row (reusing
-- its name) instead of starting over; expected_size_bytes records the
-- client-declared total for upload progress reporting.

ALTER TABLE entries ADD COLUMN upload_token TEXT;
ALTER TABLE entries ADD COLUMN expected_size_bytes INTEGER;
CREATE INDEX idx_entries_drive_upload_token ON entries(drive_id, upload_token) WHERE upload_token IS NOT NULL;
