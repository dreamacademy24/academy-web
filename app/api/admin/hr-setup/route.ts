import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// HR ERP 초기 세팅 — 멱등(IF NOT EXISTS). Abby 'ACADEMY EMPLOYEE DATABASE' 시트 구조 기반.
// 1회 호출: POST { key:'dream-hr-2026' }
export async function POST(req: Request) {
  const { key } = await req.json().catch(() => ({ key: '' }))
  if (key !== 'dream-hr-2026') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const ddl = `
-- 현지직원 인사 마스터 (Employee Master + Employment + Compensation + Gov Benefits 통합)
CREATE TABLE IF NOT EXISTS hr_employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id text UNIQUE,              -- 2026-0901-1 (YYYY-MMDD-seq)
  biometrics_id text,
  cost_center text DEFAULT '아카데미',   -- 인건비 부문: 아카데미 / 드림하우스 (손익 연동)
  -- 인적사항 (Employee Master File)
  last_name text, first_name text, middle_name text, suffix text,
  name_display text,                    -- "LASTNAME, Firstname" 표시용 캐시
  photo_url text,
  gender text, civil_status text, date_of_birth date, place_of_birth text,
  nationality text DEFAULT 'Filipino', religion text,
  contact_number text, personal_email text, company_email text,
  current_address text, permanent_address text,
  emergency_contact_name text, emergency_contact_number text,
  emergency_contact_address text, emergency_relationship text,
  status text DEFAULT 'Active',         -- Active / Inactive
  -- 근무 (Employment Details)
  position text, division text, department text, job_level text,
  date_hired date, eval_3month date, eval_6month date,
  regularization_date date, separation_date date,
  work_location text, shift_schedule text, time_in text, time_out text,
  reporting_to text,
  employment_status text,               -- Contractual / Probationary / Regular / On Call
  -- 급여 (Compensation & Payroll)
  salary_type text DEFAULT 'Monthly',   -- Daily / Monthly
  basic_salary numeric DEFAULT 0,
  tax_status text,
  allow_position numeric DEFAULT 0, allow_transpo numeric DEFAULT 0,
  allow_tutorial numeric DEFAULT 0, allow_load numeric DEFAULT 0,
  bank_name text, bank_account text, bank_status text,
  -- 4대보험 (Government Benefits)
  sss_no text, philhealth_no text, pagibig_no text, tin text,
  -- 입사서류/온보딩 (Application & Requirements Tracker)
  application_no text, position_applied text, date_of_application date,
  application_status text, date_submitted date, requirement_status text,
  onboarding_date date,
  requirements jsonb DEFAULT '{}'::jsonb,   -- {psa:true, nbi:true, ...}
  documents jsonb DEFAULT '[]'::jsonb,      -- [{name,url,uploaded_at}]
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON hr_employees;
CREATE POLICY "all" ON hr_employees FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON hr_employees TO anon, authenticated;

-- HR 접속 계정 (관리자 / 직원 본인)
CREATE TABLE IF NOT EXISTS hr_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin',   -- admin(전체) / employee(본인만)
  name text,
  employee_id text,                     -- role=employee 일 때 hr_employees.employee_id 연결
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE hr_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON hr_accounts;
CREATE POLICY "all" ON hr_accounts FOR ALL USING (true) WITH CHECK (true);
REVOKE ALL ON hr_accounts FROM anon;          -- 계정/해시는 anon 차단 (service_role만)
GRANT ALL ON hr_accounts TO authenticated;

-- 로그인 검증 (해시 비노출) — staff verify_teacher_login 패턴
CREATE OR REPLACE FUNCTION verify_hr_login(p_username text, p_password text)
RETURNS TABLE(id uuid, username text, role text, name text, employee_id text)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id, username, role, name, employee_id
  FROM hr_accounts
  WHERE username = p_username
    AND is_active = true
    AND password_hash = crypt(p_password, password_hash);
$$;

NOTIFY pgrst, 'reload schema';
`
  const ex = await supabase.rpc('exec_sql', { sql: ddl })
  if (ex.error) return NextResponse.json({ error: ex.error.message, step: 'ddl' }, { status: 500 })

  // 관리자 계정 시드 (없을 때만) — 매니저·오피스매니저·아비·벨라·may (전체 열람 권한)
  const admins = [
    { u: 'may', n: 'May (오너)' },
    { u: 'abby', n: 'Abby' },
    { u: 'bella', n: 'Bella' },
    { u: 'manager', n: '매니저' },
    { u: 'office', n: '오피스매니저' },
  ]
  for (const a of admins) {
    const esc = (v: string) => "'" + v.replace(/'/g, "''") + "'"
    const sql = `INSERT INTO hr_accounts (username, password_hash, role, name, is_active)
      SELECT ${esc(a.u)}, crypt(${esc(a.u + '2026!')}, gen_salt('bf')), 'admin', ${esc(a.n)}, true
      WHERE NOT EXISTS (SELECT 1 FROM hr_accounts WHERE username = ${esc(a.u)})`
    await supabase.rpc('exec_sql', { sql })
  }

  // ── v2 (2026-09-29): 회사 구분 + 접속자 정리 ─────────────────────────
  // 회사: 아카데미 / 드림하우스 / 모리 / 88. 계정별 볼 수 있는 회사(companies, null = 전체)
  const v2 = `
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS company text;
UPDATE hr_employees SET company = COALESCE(NULLIF(cost_center,''), '아카데미') WHERE company IS NULL;
ALTER TABLE hr_employees ALTER COLUMN company SET DEFAULT '아카데미';
REVOKE ALL ON hr_employees FROM anon;   -- 급여 등 민감정보: anon 차단 (API는 service_role)
ALTER TABLE hr_accounts ADD COLUMN IF NOT EXISTS companies text[];
ALTER TABLE hr_accounts ADD COLUMN IF NOT EXISTS must_change_pw boolean DEFAULT false;
DROP FUNCTION IF EXISTS verify_hr_login(text, text);
CREATE FUNCTION verify_hr_login(p_username text, p_password text)
RETURNS TABLE(id uuid, username text, role text, name text, employee_id text, companies text[], must_change_pw boolean)
LANGUAGE sql SECURITY DEFINER AS $fn$
  SELECT id, username, role, name, employee_id, companies, must_change_pw
  FROM hr_accounts
  WHERE lower(username) = lower(p_username)
    AND is_active = true
    AND password_hash = crypt(p_password, password_hash);
$fn$;
NOTIFY pgrst, 'reload schema';
`
  const ex2 = await supabase.rpc('exec_sql', { sql: v2 })
  if (ex2.error) return NextResponse.json({ error: ex2.error.message, step: 'v2' }, { status: 500 })

  // 접속 가능: may·abby·vella(전체) / menchu(모리) / janziel(88) / lziem(드림하우스). manager·office 비활성
  const esc = (v: string) => "'" + v.replace(/'/g, "''") + "'"
  const scoped = [
    { u: 'menchu', n: 'Menchu (모리)', c: ['모리'] },
    { u: 'janziel', n: 'Janziel (88 매니저)', c: ['88'] },
    { u: 'lziem', n: 'Lziem (드림하우스)', c: ['드림하우스'] },
  ]
  for (const a of scoped) {
    await supabase.rpc('exec_sql', { sql: `INSERT INTO hr_accounts (username, password_hash, role, name, is_active, companies, must_change_pw)
      SELECT ${esc(a.u)}, crypt(${esc(a.u + '2026!')}, gen_salt('bf')), 'admin', ${esc(a.n)}, true, ARRAY[${a.c.map(esc).join(',')}]::text[], true
      WHERE NOT EXISTS (SELECT 1 FROM hr_accounts WHERE username = ${esc(a.u)});
      UPDATE hr_accounts SET companies = ARRAY[${a.c.map(esc).join(',')}]::text[], is_active = true WHERE username = ${esc(a.u)};` })
  }
  // 벨라 아이디는 기존 직원 아이디(bella)로 통일 — vella → bella (비번 bella2026!, 첫 로그인 변경)
  await supabase.rpc('exec_sql', { sql: `UPDATE hr_accounts SET username='bella', name='Bella', password_hash=crypt('bella2026!', gen_salt('bf')), must_change_pw=true
    WHERE username='vella' AND NOT EXISTS (SELECT 1 FROM hr_accounts WHERE username='bella');` })
  await supabase.rpc('exec_sql', { sql: `UPDATE hr_accounts SET companies = NULL WHERE username IN ('may','abby','bella');
    UPDATE hr_accounts SET is_active = false WHERE username IN ('manager','office','vella');` })

  const { count } = await supabase.from('hr_employees').select('id', { count: 'exact', head: true })
  const { data: accts } = await supabase.from('hr_accounts').select('username,role,name,companies,is_active')
  return NextResponse.json({ ok: true, employees: count ?? 0, accounts: accts ?? [] })
}
