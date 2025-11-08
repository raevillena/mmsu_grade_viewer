-- MMSU Grade Viewer Database Schema
-- Run this SQL in your Supabase SQL Editor to create the necessary tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Records table (grade records)
CREATE TABLE IF NOT EXISTS records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_number TEXT NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  grades JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Student email cache table (for Moodle email lookups)
CREATE TABLE IF NOT EXISTS student_email_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_number TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  fullname TEXT,
  moodle_user_id INTEGER,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_subjects_teacher_id ON subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_records_subject_id ON records(subject_id);
CREATE INDEX IF NOT EXISTS idx_records_email ON records(email);
CREATE INDEX IF NOT EXISTS idx_records_student_number ON records(student_number);
CREATE INDEX IF NOT EXISTS idx_records_code ON records(code);
CREATE INDEX IF NOT EXISTS idx_records_lookup ON records(email, student_number, code);
CREATE INDEX IF NOT EXISTS idx_student_email_cache_student_number ON student_email_cache(student_number);
CREATE INDEX IF NOT EXISTS idx_student_email_cache_email ON student_email_cache(email);

-- Enable Row Level Security (RLS) - optional, adjust based on your security needs
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- Sample data (optional - remove in production)
-- Insert a sample admin user
-- INSERT INTO users (name, email, role) VALUES ('Admin User', 'admin@example.com', 'admin');

-- Insert a sample teacher user
-- INSERT INTO users (name, email, role) VALUES ('Teacher User', 'teacher@example.com', 'teacher');

-- Insert a sample student user
-- INSERT INTO users (name, email, role) VALUES ('Student User', 'student@example.com', 'student');

