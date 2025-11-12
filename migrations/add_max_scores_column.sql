-- Migration: Add max_scores column to records table
-- Date: 2025-01-XX
-- Description: Adds a max_scores JSONB column to store maximum scores per grade key (from second row of sheets)

-- Add max_scores column to records table
ALTER TABLE records 
ADD COLUMN IF NOT EXISTS max_scores JSONB DEFAULT '{}'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN records.max_scores IS 'Maximum scores per grade key, stored as JSONB. Typically populated from the second row of imported sheets.';

