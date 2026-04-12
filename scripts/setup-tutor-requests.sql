-- tutor_requests 테이블에 18항목 폼 필드 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS house_number text;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS student_name_kr text;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS student_name_en text;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS student_age text;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS class_type text;              -- "1:1" | "1:2"
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS preferred_days_arr text[];    -- ["월","화",...]
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS skip_dates text;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS level_english text;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS level_speaking text;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS level_reading text;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS level_writing text;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS textbook text;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS class_style text;             -- 놀이식/학습식/놀이+학습
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS class_focus_arr text[];       -- 최대 2개
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS child_personality text;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS privacy_agreed boolean DEFAULT false;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS rules_agreed boolean DEFAULT false;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS booking_id uuid;
ALTER TABLE tutor_requests ADD COLUMN IF NOT EXISTS guest_name text;
