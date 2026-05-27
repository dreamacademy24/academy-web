-- invoice_snapshots: confirmed_at 컬럼 추가 (인보이스 확정 시각)
ALTER TABLE invoice_snapshots ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
