-- 정산 개편 v2 (2026-06-13) — 현지지불(₱) 전용, 자주쓰는 항목 마스터, 마감 플로우
-- ※ 원화 입금/잔금입금은 정산에서 제외 (현지지불금액만 정산)

-- 1) settlement_items 에 파트(section) 컬럼 추가
--    section: 'deposit'(보증금 정산) | 'class'(수업·교재비 등)
ALTER TABLE settlement_items ADD COLUMN IF NOT EXISTS section text DEFAULT 'class';
ALTER TABLE settlement_items ADD COLUMN IF NOT EXISTS note text;

-- 2) kind 값: deposit / deduct / refund / charge
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name='settlement_items' AND constraint_name='settlement_items_kind_check') THEN
    ALTER TABLE settlement_items DROP CONSTRAINT settlement_items_kind_check;
  END IF;
END $$;
ALTER TABLE settlement_items ADD CONSTRAINT settlement_items_kind_check
  CHECK (kind IN ('deposit','charge','deduct','payment','refund'));

-- 3) 자주 쓰는 항목 마스터 (예약마다 X, 전사 공통 — 직원이 등록/수정)
CREATE TABLE IF NOT EXISTS settlement_presets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  section text NOT NULL,            -- 'deposit' | 'class'
  kind text NOT NULL,               -- deposit/deduct/refund/charge
  label text NOT NULL,              -- 예: 전기세 / 튜터비 / 교재비-주니어
  default_amount numeric,           -- 비워두면 입력 시 직접 입력
  needs_dates boolean DEFAULT false,-- true면 날짜 표기 권장(튜터비 등)
  sort int DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE settlement_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON settlement_presets;
CREATE POLICY "all" ON settlement_presets FOR ALL USING (true) WITH CHECK (true);

-- 기본 자주쓰는 항목 시드 (중복 방지)
INSERT INTO settlement_presets (section, kind, label, default_amount, needs_dates, sort)
SELECT * FROM (VALUES
  ('class','charge','튜터비',          NULL::numeric, true,  10),
  ('class','charge','교재비 - 주니어',  350::numeric,  false, 20),
  ('class','charge','킨더 재료비',      NULL::numeric, false, 30),
  ('class','charge','SSP / SSP I card', 11000::numeric,false, 40),
  ('deposit','deposit','보증금 수령',   NULL::numeric, false, 10),
  ('deposit','deduct','전기세',         NULL::numeric, false, 20),
  ('deposit','deduct','물품/생수',      NULL::numeric, false, 30),
  ('deposit','deduct','픽드랍 추가',    NULL::numeric, false, 40),
  ('deposit','refund','튜터비 환불',    NULL::numeric, true,  50)
) AS v(section,kind,label,default_amount,needs_dates,sort)
WHERE NOT EXISTS (SELECT 1 FROM settlement_presets);

-- 4) 정산 마감 상태 (아카데미 마감 → 드림하우스 최종마감 → 엄마 알림)
CREATE TABLE IF NOT EXISTS settlement_status (
  booking_id uuid PRIMARY KEY,
  academy_closed boolean DEFAULT false,
  academy_closed_at timestamptz,
  academy_closed_by text,
  final_closed boolean DEFAULT false,
  final_closed_at timestamptz,
  final_closed_by text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE settlement_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON settlement_status;
CREATE POLICY "all" ON settlement_status FOR ALL USING (true) WITH CHECK (true);

-- 5) 데모 공개 대상 (지정한 예약만 엄마 포털에 정산내역 노출)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS settlement_open boolean DEFAULT false;

NOTIFY pgrst, 'reload schema';
