-- Migration: Add grading_system column to subjects table
-- Date: 2025-01-XX
-- Description: Adds a grading_system JSONB column to store grading system configuration per subject

-- Add grading_system column to subjects table
ALTER TABLE subjects 
ADD COLUMN IF NOT EXISTS grading_system JSONB DEFAULT '{}'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN subjects.grading_system IS 'Grading system configuration per subject, stored as JSONB. Contains components, weights, and grade key mappings.';

