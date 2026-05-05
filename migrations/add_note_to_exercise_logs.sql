-- Add optional note column to exercise_logs table
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS note TEXT;
