-- 화상영어 P3: 변경요청 + 튜터 알림
-- 접근은 전부 Next.js API Route(service_role) 경유 → RLS 켜두면 anon 직접 접근 차단됨

CREATE TABLE IF NOT EXISTS online_change_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id uuid NOT NULL,
  customer_user_id text,
  req_days_of_week jsonb,          -- ["수","금"] (없으면 기존 유지)
  req_time_kr text,                -- "20:00" (없으면 기존 유지)
  effective_from date,             -- 적용 시작일 (수업 4일 전 규칙)
  memo text,                       -- 엄마 메모/사유
  status text DEFAULT 'pending',   -- pending / approved / rejected
  admin_note text,
  processed_by text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE online_change_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS online_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id uuid,                   -- online_tutors.id (NULL = 전체 튜터 공지)
  type text DEFAULT 'schedule_change',
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE online_notifications ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
