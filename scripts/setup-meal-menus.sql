-- 엄마용 식단 공개 — 2026-06-15
-- 두 종류: dreamhouse(올인원 3끼, 주간 요일별) / academy(학생 점심, 월간 1장)
CREATE TABLE IF NOT EXISTS meal_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'dreamhouse',  -- 'dreamhouse' | 'academy'
  menu_date date NOT NULL,                   -- dreamhouse=해당 요일 / academy=해당 월 1일
  image_url text NOT NULL,                   -- 압축 이미지 data URL
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(kind, menu_date)
);
ALTER TABLE meal_menus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON meal_menus;
CREATE POLICY "all" ON meal_menus FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
