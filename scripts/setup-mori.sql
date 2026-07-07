-- 모리칸 (식단 조합 자동화) — 2026-07-07
-- 실행 순서: ① setup-mori.sql → ② seed-mori.sql (과거 1~10회 이력 + 픽스 세트)

-- 메뉴 아이템 풀
CREATE TABLE IF NOT EXISTS mori_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'side',   -- base|soup|main|side|salad|fruit|dairy|breakfast_main|staple
  protein text,                        -- 닭|돼지|소|생선해물|계란|두부
  meals text[] NOT NULL DEFAULT '{아침,점심,저녁}',
  is_staple boolean DEFAULT false,     -- 김치·쌈장 등 중복검사 제외
  active boolean DEFAULT true,
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 제공 이력 (중복 검사의 기준)
CREATE TABLE IF NOT EXISTS mori_servings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  serve_date date NOT NULL,
  meal text NOT NULL,                  -- 아침|점심|간식|저녁
  item_name text NOT NULL,
  source text DEFAULT 'seed',          -- seed(과거 엑셀)|plan(모리칸 확정)
  UNIQUE(serve_date, meal, item_name)
);
CREATE INDEX IF NOT EXISTS idx_mori_servings_date ON mori_servings(serve_date DESC);

-- 픽스 점심+간식 세트 (1~45회)
CREATE TABLE IF NOT EXISTS mori_fixed_sets (
  set_no int PRIMARY KEY,
  lunch jsonb NOT NULL,                -- ["모듬어묵탕", ...]
  snack text
);

-- 주간 플랜
CREATE TABLE IF NOT EXISTS mori_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,     -- 월요일
  round_no int,                        -- 회차
  plan jsonb NOT NULL DEFAULT '{}',    -- { "2026-07-13": { "아침":[..], "점심":[..], "간식":[..], "저녁":[..], "fixedSet": 11 }, ... }
  status text DEFAULT 'draft',         -- draft|confirmed
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mori_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mori_servings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mori_fixed_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE mori_weeks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON mori_items;
DROP POLICY IF EXISTS "all" ON mori_servings;
DROP POLICY IF EXISTS "all" ON mori_fixed_sets;
DROP POLICY IF EXISTS "all" ON mori_weeks;
CREATE POLICY "all" ON mori_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all" ON mori_servings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all" ON mori_fixed_sets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all" ON mori_weeks FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
