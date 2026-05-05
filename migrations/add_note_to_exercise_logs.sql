-- Add optional note column to exercise_logs table
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS note TEXT;

-- Add body measurement columns to body_stats table
ALTER TABLE body_stats ADD COLUMN IF NOT EXISTS chest NUMERIC(5,1);
ALTER TABLE body_stats ADD COLUMN IF NOT EXISTS waist NUMERIC(5,1);
ALTER TABLE body_stats ADD COLUMN IF NOT EXISTS hips NUMERIC(5,1);
ALTER TABLE body_stats ADD COLUMN IF NOT EXISTS arm NUMERIC(5,1);
ALTER TABLE body_stats ADD COLUMN IF NOT EXISTS thigh NUMERIC(5,1);
ALTER TABLE body_stats ADD COLUMN IF NOT EXISTS calf NUMERIC(5,1);
ALTER TABLE body_stats ADD COLUMN IF NOT EXISTS shoulders NUMERIC(5,1);
ALTER TABLE body_stats ADD COLUMN IF NOT EXISTS neck NUMERIC(5,1);

-- Add superset group column to workout_template_exercises
ALTER TABLE workout_template_exercises ADD COLUMN IF NOT EXISTS superset_group TEXT;
