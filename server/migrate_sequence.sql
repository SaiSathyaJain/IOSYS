-- Migration: add sequence_no to inward and inward_deleted tables
ALTER TABLE inward ADD COLUMN sequence_no INTEGER;
ALTER TABLE inward_deleted ADD COLUMN sequence_no INTEGER;

-- Backfill existing live entries using their id as the sequence number
UPDATE inward SET sequence_no = id WHERE sequence_no IS NULL;

-- Backfill existing deleted entries using their original_id
UPDATE inward_deleted SET sequence_no = original_id WHERE sequence_no IS NULL;
