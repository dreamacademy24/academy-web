-- 범용 동의서함 (체험단 등 1:1 토큰 발송) — 체크인 디테일과 동일 패턴
CREATE TABLE IF NOT EXISTS consents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  public_token uuid DEFAULT gen_random_uuid(),
  consent_type text NOT NULL DEFAULT 'experience',
  type_label  text DEFAULT '체험단 참가 계약 및 동의서',
  booking_id  uuid,
  applicant_name text,
  phone text,
  email text,
  child text,
  room  text,
  month text,
  insta text,
  blog  text,
  agreed_items jsonb DEFAULT '[]',
  signer_name text,
  sig_date date,
  signature text,
  policy_version text,
  status text DEFAULT 'pending',
  submitted_at timestamptz,
  user_agent text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consents_all" ON consents FOR ALL USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';
