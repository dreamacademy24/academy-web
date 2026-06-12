-- 동의 내역 보관 (증거용) — 부킹 제출 시 자동 저장
CREATE TABLE IF NOT EXISTS booking_consents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid,
  reservation_no text,
  booker_name text,
  booking_type text,
  policy_version text,          -- lib/refundPolicy.ts REFUND_POLICY_VERSION (문구 변경 시 갱신)
  policy_keys jsonb,            -- ["dreamhouse","jpark"] 등 동의한 규정 종류
  agreed_text text,             -- 체크박스 옆에 표시됐던 문구 스냅샷
  holidays_notified jsonb,      -- 예약 시점에 안내된 기간 내 휴무일 [{date,name}]
  user_agent text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE booking_consents ENABLE ROW LEVEL SECURITY;
-- 공개 부킹 폼(anon)에서 INSERT 필요, 조회는 어드민(anon, allow_all 패턴)
CREATE POLICY "consents_all" ON booking_consents FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
