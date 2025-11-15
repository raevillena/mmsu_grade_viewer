-- Migration: Add computed_grade column to records table
-- Date: 2025-01-XX
-- Description: Adds a computed_grade JSONB column to store computed final grades and breakdown

-- Add computed_grade column to records table
ALTER TABLE records 
ADD COLUMN IF NOT EXISTS computed_grade JSONB;

-- Add comment to document the column
COMMENT ON COLUMN records.computed_grade IS 'Computed final grade and breakdown based on grading system, stored as JSONB. Contains finalGrade, categoryScores, and breakdown.';

