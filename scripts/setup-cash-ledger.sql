-- 시재관리 테이블
CREATE TABLE IF NOT EXISTS cash_ledger (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL CHECK (type IN ('in', 'out')),          -- in=입금, out=출금
  category text NOT NULL DEFAULT '기타',                      -- 보증금, 식비, 교통비, 소모품, 유지보수, 기타
  description text,                                           -- 내용/메모
  amount numeric NOT NULL DEFAULT 0,                          -- 금액 (항상 양수)
  guest_name text,                                            -- 관련 손님 이름 (선택)
  booking_id uuid,                                            -- 관련 예약 (선택)
  receipt_files jsonb DEFAULT '[]',                           -- 영수증 이미지 [{name, url}]
  recorded_by text,                                           -- 기록자
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE cash_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all" ON cash_ledger FOR ALL USING (true) WITH CHECK (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_cash_ledger_date ON cash_ledger (entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_type ON cash_ledger (type);
