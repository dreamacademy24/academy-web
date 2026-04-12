-- house_reports 테이블 생성 (admin-jun 전용 하우스 보고)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS house_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter text NOT NULL,
  report_date date NOT NULL,
  time_slot text NOT NULL CHECK (time_slot IN ('morning','afternoon','checkin')),
  rooms jsonb DEFAULT '[]',
  memo text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_house_reports_date ON house_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_house_reports_created ON house_reports(created_at DESC);

ALTER TABLE house_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON house_reports;
CREATE POLICY "all" ON house_reports FOR ALL USING (true) WITH CHECK (true);
