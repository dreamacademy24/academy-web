-- 튜터 수업 하루 취소 요청 테이블
-- 엄마 신청 → 어드민 승인/거절 → 교사 알림

CREATE TABLE IF NOT EXISTS tutor_cancel_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id uuid NOT NULL,                         -- tutor_lessons.id
  application_id uuid,                             -- tutor_requests.id (편의)
  booking_id uuid,                                 -- bookings.id
  cancel_date date NOT NULL,                       -- 취소 요청 날짜 (YYYY-MM-DD)
  reason text,                                     -- 엄마 사유
  is_refundable boolean DEFAULT true,              -- 4일 이전=true, 이내=false
  status text DEFAULT 'pending'                    -- pending / approved / rejected
    CHECK (status IN ('pending','approved','rejected')),
  resolution text,                                 -- deduct(차감) / makeup(보강) / null
  admin_note text,                                 -- 어드민 메모
  processed_by text,                               -- 처리자
  processed_at timestamptz,                        -- 처리 시각
  requested_by text,                               -- 요청자 (portal session guest_name)
  student_name text,                               -- 학생 이름
  tutor_id uuid,                                   -- 배정 튜터 (알림용)
  created_at timestamptz DEFAULT now()
);

-- RLS 비활성화 (service_role 사용)
ALTER TABLE tutor_cancel_requests DISABLE ROW LEVEL SECURITY;

-- 권한
GRANT SELECT, INSERT, UPDATE, DELETE ON tutor_cancel_requests TO authenticated;
GRANT SELECT, INSERT ON tutor_cancel_requests TO anon;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tcr_lesson ON tutor_cancel_requests(lesson_id);
CREATE INDEX IF NOT EXISTS idx_tcr_status ON tutor_cancel_requests(status);
CREATE INDEX IF NOT EXISTS idx_tcr_date ON tutor_cancel_requests(cancel_date);
