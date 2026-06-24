-- 튜터 수업 휴강/취소 정보 (날짜별 jsonb)
ALTER TABLE tutor_lessons ADD COLUMN IF NOT EXISTS cancellations jsonb DEFAULT '{}'::jsonb;
