-- 하우스 미해결 항목 (이월 기능)
-- team_manager3.html 하우스 보고 탭에서 문제/해결중 상태 항목을 이월 저장

CREATE TABLE IF NOT EXISTS house_pending_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_no text NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'problem',  -- problem | progress | done
  report_id uuid REFERENCES house_reports(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_house_pending_unresolved
  ON house_pending_items (created_at)
  WHERE resolved_at IS NULL;

ALTER TABLE house_pending_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "house_pending_items_all" ON house_pending_items;
CREATE POLICY "house_pending_items_all"
  ON house_pending_items
  FOR ALL
  USING (true)
  WITH CHECK (true);
