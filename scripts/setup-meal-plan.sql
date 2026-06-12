-- 식단 모리인폼: 보호자 체류 기간 (주차별 성인 수 자동 계산용)
-- guardian_stays: [{"name":"아빠","from":"2026-06-15","to":"2026-06-21"}, ...]
-- 기본 보호자 1명은 전 기간 상주로 간주, 추가 보호자만 기간 입력
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS guardian_stays jsonb DEFAULT '[]';
NOTIFY pgrst, 'reload schema';
