-- 상담 예약 시스템 테이블 (2026-06-19)
-- Supabase SQL Editor에서 실행

-- 1. consultations: 상담 이벤트
CREATE TABLE IF NOT EXISTS consultations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  created_by text DEFAULT 'admin',
  target_type text DEFAULT 'all' CHECK (target_type IN ('all', 'selected')),
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. consultation_slots: 시간 슬롯
CREATE TABLE IF NOT EXISTS consultation_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  slot_time text NOT NULL,
  duration_min int DEFAULT 40,
  status text DEFAULT 'available' CHECK (status IN ('available', 'booked')),
  booked_by uuid,
  booked_name text,
  booked_student text,
  booked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 3. consultation_invites: 대상 엄마 (selected일 때)
CREATE TABLE IF NOT EXISTS consultation_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  consultation_id uuid NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL,
  notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(consultation_id, booking_id)
);

-- RLS (일단 비활성화 + 전체 허용, 나중에 세분화)
ALTER TABLE consultations DISABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_invites DISABLE ROW LEVEL SECURITY;

GRANT ALL ON consultations TO authenticated, anon;
GRANT ALL ON consultation_slots TO authenticated, anon;
GRANT ALL ON consultation_invites TO authenticated, anon;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_slots_consultation ON consultation_slots(consultation_id);
CREATE INDEX IF NOT EXISTS idx_slots_status ON consultation_slots(status);
CREATE INDEX IF NOT EXISTS idx_invites_consultation ON consultation_invites(consultation_id);
CREATE INDEX IF NOT EXISTS idx_invites_booking ON consultation_invites(booking_id);
