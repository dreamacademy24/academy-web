/**
 * run-sql.mjs — Supabase DDL 실행 스크립트
 *
 * 사용법:
 *   node scripts/run-sql.mjs                       # 내장 SQL 실행
 *   node scripts/run-sql.mjs path/to/file.sql      # 파일 SQL 실행
 *
 * .env.local 에서 DATABASE_URL 읽어 pg 직접 연결
 * DATABASE_URL 설정법: Supabase Dashboard > Settings > Database > Connection string (URI) 복사
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/* ── .env.local 파싱 ── */
function loadEnv() {
  const envPath = resolve(ROOT, ".env.local");
  const text = readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.+)/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return env;
}

/* ── 메인 ── */
async function main() {
  const env = loadEnv();
  const dbUrl = env.DATABASE_URL;

  if (!dbUrl) {
    console.error(`
❌ DATABASE_URL이 .env.local에 없습니다.

설정 방법:
  1. Supabase Dashboard 접속
     https://supabase.com/dashboard/project/yiglafscjvjgkxpycevk/settings/database
  2. Connection string > URI 복사
  3. .env.local 맨 아래에 추가:
     DATABASE_URL=postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres
  4. 다시 실행: node scripts/run-sql.mjs
`);
    process.exit(1);
  }

  // SQL: 인자로 파일 경로가 들어오면 파일에서, 아니면 내장 SQL
  const sqlFile = process.argv[2];
  let sql;
  if (sqlFile) {
    sql = readFileSync(resolve(ROOT, sqlFile), "utf-8");
    console.log(`\n📄 SQL 파일: ${sqlFile}\n`);
  } else {
    sql = DEFAULT_SQL;
    console.log(`\n📄 내장 SQL 실행\n`);
  }

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    process.stdout.write("🔌 Supabase 연결 중... ");
    await client.connect();
    console.log("성공!\n");

    console.log("⚡ SQL 실행 중...");
    await client.query(sql);
    console.log("✅ SQL 실행 완료!\n");

    // 생성된 테이블 확인
    const res = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log("📋 public 스키마 테이블 목록:");
    res.rows.forEach((r) => console.log(`   - ${r.table_name}`));
    console.log();
  } catch (e) {
    console.error("❌ 에러:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

/* ── 내장 SQL (기본) ── */
const DEFAULT_SQL = `
CREATE TABLE IF NOT EXISTS students (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES bookings_new(id) ON DELETE SET NULL,
  name_kr text NOT NULL,
  name_en text,
  age text,
  level text CHECK (level IN ('kinder','junior')),
  class_type text CHECK (class_type IN ('morning','fullday')),
  academy_start date,
  academy_end date,
  pickup_location text,
  address_detail text,
  ssp boolean DEFAULT false,
  photo_allowed boolean DEFAULT true,
  special_request text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academy_enrollments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  level text,
  class_type text,
  start_date date,
  end_date date,
  weeks int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ssp_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  ssp_amount int DEFAULT 7000,
  ssp_id int DEFAULT 4000,
  issue_date date,
  receipt_sent_date date,
  transport_fee int DEFAULT 0,
  deposit int DEFAULT 0,
  exempted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
`;

main();
