-- 식단 명단 주별 제외 테이블
CREATE TABLE IF NOT EXISTS meal_exclusions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid NOT NULL,
  week_start date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(booking_id, week_start)
);

ALTER TABLE meal_exclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all" ON meal_exclusions FOR ALL USING (true) WITH CHECK (true);
