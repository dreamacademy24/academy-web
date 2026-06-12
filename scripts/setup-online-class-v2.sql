-- 화상영어 개편 P1: 요일별 시간 + 시기 태그 standalone 허용
-- day_times: {"수":"17:00","금":"18:00"} (한국시간, 필리핀은 세션 생성 시 -1시간 자동)
ALTER TABLE online_enrollments ADD COLUMN IF NOT EXISTS day_times jsonb;

-- class_period에 'standalone'(단독, 화상수업만) 값 허용 (CHECK 제약이 있는 경우만 해당)
ALTER TABLE online_enrollments DROP CONSTRAINT IF EXISTS online_enrollments_class_period_check;

NOTIFY pgrst, 'reload schema';
