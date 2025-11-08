-- Migration: Add index on fullname for student_email_cache table
-- Date: 2025-01-XX
-- Description: Adds an index on the fullname column to improve search performance

-- Add index on fullname column for better search performance
CREATE INDEX IF NOT EXISTS idx_student_email_cache_fullname ON student_email_cache(fullname);

