-- booking_comments 테이블 생성
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS booking_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL,
  author text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_comments_booking_id ON booking_comments(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_comments_created_at ON booking_comments(created_at DESC);

ALTER TABLE booking_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all_service_role" ON booking_comments;
CREATE POLICY "all_service_role" ON booking_comments FOR ALL USING (true) WITH CHECK (true);
