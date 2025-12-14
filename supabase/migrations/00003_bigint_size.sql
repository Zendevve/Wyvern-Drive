-- Migration: Change size column from INTEGER to BIGINT for large file support
-- FIX: "value 11151093523 is out of range for type integer"
-- INTEGER max: 2,147,483,647 (~2GB)
-- BIGINT max: 9,223,372,036,854,775,807 (~9.2 exabytes)

ALTER TABLE files ALTER COLUMN size TYPE BIGINT;

-- Also update file_versions table if it exists
ALTER TABLE file_versions ALTER COLUMN size TYPE BIGINT;
