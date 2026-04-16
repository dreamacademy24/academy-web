-- =============================================
-- 드림아카데미 화상영어 시스템 DB v1.0
-- =============================================

-- 1. 튜터
CREATE TABLE IF NOT EXISTS online_tutors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name_display TEXT NOT NULL,
  name_en TEXT NOT NULL,
  staff_user_id TEXT,
  available_days TEXT[] DEFAULT '{}',
  available_time_slots TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 수강 등록
CREATE TABLE IF NOT EXISTS online_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_name TEXT NOT NULL,
  student_name_en TEXT,
  student_birth_year TEXT,
  customer_user_id TEXT,
  tutor_id UUID REFERENCES online_tutors(id),
  enrollment_type TEXT DEFAULT 'free_package',
  level TEXT,
  days_of_week TEXT[] NOT NULL,
  class_time_kr TEXT,
  class_time_ph TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  duration_weeks INTEGER,
  class_duration_weeks INTEGER,
  class_period TEXT DEFAULT 'post',
  sessions_per_week INTEGER DEFAULT 3,
  total_sessions INTEGER NOT NULL,
  pre_sessions INTEGER DEFAULT 0,
  post_sessions INTEGER DEFAULT 0,
  used_sessions INTEGER DEFAULT 0,
  remaining_sessions INTEGER,
  package_booking_id UUID,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 개별 세션 (회차별 날짜+출결)
CREATE TABLE IF NOT EXISTS online_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID REFERENCES online_enrollments(id) ON DELETE CASCADE,
  tutor_id UUID REFERENCES online_tutors(id),
  session_number INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time_ph TEXT,
  scheduled_time_kr TEXT,
  status TEXT DEFAULT 'scheduled',
  is_makeup_added BOOLEAN DEFAULT false,
  original_session_id UUID,
  cancel_noticed_at TIMESTAMPTZ,
  cancel_days_before INTEGER,
  recorded_by TEXT,
  recorded_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 인보이스
CREATE TABLE IF NOT EXISTS online_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID REFERENCES online_enrollments(id),
  issued_at TIMESTAMPTZ DEFAULT now(),
  invoice_html TEXT,
  created_by TEXT
);

-- 5. remaining_sessions 자동계산 트리거
CREATE OR REPLACE FUNCTION update_remaining_sessions()
RETURNS TRIGGER AS $$
BEGIN
  NEW.remaining_sessions := NEW.total_sessions - NEW.used_sessions;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_remaining_sessions ON online_enrollments;
CREATE TRIGGER trg_remaining_sessions
BEFORE INSERT OR UPDATE ON online_enrollments
FOR EACH ROW EXECUTE FUNCTION update_remaining_sessions();

-- 6. makeup 시 다음 세션 자동생성 트리거
CREATE OR REPLACE FUNCTION auto_add_makeup_session()
RETURNS TRIGGER AS $$
DECLARE
  last_session RECORD;
BEGIN
  IF NEW.status = 'makeup' AND OLD.status = 'scheduled' THEN
    SELECT * INTO last_session
    FROM online_sessions
    WHERE enrollment_id = NEW.enrollment_id
    ORDER BY session_number DESC
    LIMIT 1;

    INSERT INTO online_sessions (
      enrollment_id, tutor_id, session_number,
      scheduled_date, scheduled_time_ph, scheduled_time_kr,
      status, is_makeup_added, original_session_id
    ) VALUES (
      NEW.enrollment_id,
      NEW.tutor_id,
      last_session.session_number + 1,
      last_session.scheduled_date + INTERVAL '7 days',
      NEW.scheduled_time_ph,
      NEW.scheduled_time_kr,
      'scheduled',
      true,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_makeup ON online_sessions;
CREATE TRIGGER trg_auto_makeup
AFTER UPDATE ON online_sessions
FOR EACH ROW EXECUTE FUNCTION auto_add_makeup_session();

-- 7. 튜터 초기 데이터
INSERT INTO online_tutors (name_display, name_en, staff_user_id, is_active) VALUES
('T.Ann',    'Ann',    'admin-ann',    true),
('T.Angel',  'Angel',  'admin-angel',  true),
('T.Carla',  'Carla',  'admin-carla',  true),
('T.Amelyn', 'Amelyn', 'admin-amelyn', true),
('T.Cristel','Cristel','admin-cristel',true)
ON CONFLICT DO NOTHING;
