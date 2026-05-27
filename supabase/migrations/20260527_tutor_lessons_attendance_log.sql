-- 튜터 수업 출결 로그 (OX△ JSONB)
ALTER TABLE tutor_lessons ADD COLUMN IF NOT EXISTS attendance_log jsonb DEFAULT '{}'::jsonb;
