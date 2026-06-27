-- 체험단 동의서 (1:1 토큰 발송, 공개 목록 없음) — 체크인 디테일과 동일 패턴
CREATE TABLE IF NOT EXISTS consent_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  public_token text UNIQUE NOT NULL,
  booking_id uuid,
  recipient_name text,
  title text DEFAULT '체험단 참여 동의서',
  terms_version text DEFAULT '2026-06',
  agreed boolean DEFAULT false,
  signature_name text,
  submitted_at timestamptz,
  user_agent text,
  created_by text,
  created_at timestamptz DEFAULT now()
);
-- RLS: 서비스롤(서버 API)만 접근. anon 정책 없음 → 공개 enumeration 차단.
ALTER TABLE consent_requests ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
