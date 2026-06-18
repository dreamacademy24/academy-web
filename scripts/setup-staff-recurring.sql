-- 고정업무 (반복 업무 템플릿)
CREATE TABLE IF NOT EXISTS staff_recurring (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly')),
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=일 1=월 ... 6=토
  owner_id text NOT NULL,          -- 등록한 직원 id
  is_shared boolean DEFAULT false, -- true면 전체 직원에게 표시
  active boolean DEFAULT true,
  start_date date DEFAULT CURRENT_DATE, -- 격주 기준점
  created_at timestamptz DEFAULT now()
);

-- 고정업무 날짜별 완료 추적
CREATE TABLE IF NOT EXISTS staff_recurring_done (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recurring_id uuid NOT NULL REFERENCES staff_recurring(id) ON DELETE CASCADE,
  done_date date NOT NULL,         -- 완료한 특정 날짜
  done_by text NOT NULL,
  done_at timestamptz DEFAULT now(),
  UNIQUE(recurring_id, done_date)
);

ALTER TABLE staff_recurring ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all" ON staff_recurring FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE staff_recurring_done ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all" ON staff_recurring_done FOR ALL USING (true) WITH CHECK (true);
