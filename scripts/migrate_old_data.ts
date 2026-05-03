/**
 * migrate_old_data.ts — parsed_data.json → bookings + students bulk insert
 *
 * 입력: scripts/parsed_data.json
 *   배열의 각 원소가 한 예약(bookings 1행 + students N행).
 *
 * 매핑:
 *   bookings:
 *     booking_type, booker_name, checkin_date, checkout_date,
 *     accom_weeks, academy_start,
 *     pickup_raw → flight_in,
 *     drop_raw → flight_out,
 *     hagwon, total_amount, balance_due_date, status,
 *     booking_notes → special_notes,
 *     assignee = null, contact = null
 *
 *   students:
 *     booking_id (FK from bookings insert),
 *     student_name_kr, student_name_en, student_age, student_grade,
 *     accom_room, academy_start, academy_end, photo_ok,
 *     student_notes → special_notes
 *
 * 실행:
 *   npx ts-node scripts/migrate_old_data.ts
 *
 * 환경:
 *   .env.local 또는 process.env.SUPABASE_SERVICE_ROLE_KEY 필요.
 *   에러 발생해도 다음 행으로 continue.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// ─── 경로 ───
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const JSON_PATH = resolve(__dirname, "parsed_data.json");

// ─── env 로드 (process.env 우선, 없으면 .env.local 파싱) ───
function loadEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const envText = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
    const m = envText.match(new RegExp(`^${key}=(.+)$`, "m"));
    return m?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}

const SB_URL = loadEnv("NEXT_PUBLIC_SUPABASE_URL");
const SB_KEY = loadEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!SB_URL || !SB_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경 변수 누락 (.env.local 또는 process.env 확인)");
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

// ─── 입력 JSON 타입 (느슨하게) ───
interface ParsedStudent {
  student_name_kr?: string;
  student_name_en?: string;
  student_age?: number | string | null;
  student_grade?: string | null;
  accom_room?: string | null;
  academy_start?: string | null;
  academy_end?: string | null;
  photo_ok?: boolean | string | null;
  student_notes?: string | null;
}

interface ParsedBooking {
  booking_type?: string | null;
  booker_name?: string | null;
  checkin_date?: string | null;
  checkout_date?: string | null;
  accom_weeks?: number | string | null;
  academy_start?: string | null;
  pickup_raw?: string | null;
  drop_raw?: string | null;
  hagwon?: string | null;
  total_amount?: number | string | null;
  balance_due_date?: string | null;
  status?: string | null;
  booking_notes?: string | null;
  students?: ParsedStudent[];
}

// ─── 변환 헬퍼 ───
const orNull = <T>(v: T | undefined | null | "") => (v === undefined || v === null || v === "" ? null : v);

function bookingPayload(b: ParsedBooking) {
  return {
    booking_type: orNull(b.booking_type),
    booker_name: orNull(b.booker_name),
    checkin_date: orNull(b.checkin_date),
    checkout_date: orNull(b.checkout_date),
    accom_weeks: orNull(b.accom_weeks),
    academy_start: orNull(b.academy_start),
    flight_in: orNull(b.pickup_raw),
    flight_out: orNull(b.drop_raw),
    hagwon: orNull(b.hagwon),
    total_amount: orNull(b.total_amount),
    balance_due_date: orNull(b.balance_due_date),
    status: orNull(b.status),
    special_notes: orNull(b.booking_notes),
    assignee: null,
    contact: null,
  };
}

function studentPayload(s: ParsedStudent, bookingId: string) {
  return {
    booking_id: bookingId,
    student_name_kr: orNull(s.student_name_kr),
    student_name_en: orNull(s.student_name_en),
    student_age: orNull(s.student_age),
    student_grade: orNull(s.student_grade),
    accom_room: orNull(s.accom_room),
    academy_start: orNull(s.academy_start),
    academy_end: orNull(s.academy_end),
    photo_ok: orNull(s.photo_ok),
    special_notes: orNull(s.student_notes),
  };
}

// ─── 메인 ───
async function main() {
  console.log(`📂 reading: ${JSON_PATH}`);
  let raw: string;
  try {
    raw = readFileSync(JSON_PATH, "utf-8");
  } catch (e) {
    console.error(`❌ JSON 파일 읽기 실패: ${JSON_PATH}`);
    console.error(`   파일을 ${JSON_PATH} 경로에 배치한 후 재시도하세요.`);
    process.exit(1);
  }

  let data: ParsedBooking[];
  try {
    const parsed = JSON.parse(raw);
    data = Array.isArray(parsed) ? parsed : (parsed.bookings ?? []);
  } catch (e) {
    console.error("❌ JSON 파싱 실패:", e);
    process.exit(1);
  }

  console.log(`📊 총 ${data.length}건의 예약 처리 시작\n`);

  let bookingOk = 0;
  let bookingFail = 0;
  let studentOk = 0;
  let studentFail = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const label = `[${i + 1}/${data.length}] ${row.booker_name ?? "(no name)"}`;

    // 1) bookings insert
    const bk = bookingPayload(row);
    const { data: inserted, error: bErr } = await supabase
      .from("bookings")
      .insert(bk)
      .select("id")
      .single();

    if (bErr || !inserted?.id) {
      console.error(`❌ ${label} — booking insert 실패:`, bErr?.message ?? "no id returned");
      bookingFail++;
      continue;
    }

    const bookingId: string = inserted.id;
    console.log(`✅ ${label} — booking ${bookingId}`);
    bookingOk++;

    // 2) students bulk insert (있으면)
    const stuList = row.students ?? [];
    if (stuList.length === 0) {
      continue;
    }

    const stuRows = stuList.map((s) => studentPayload(s, bookingId));
    const { error: sErr, data: sData } = await supabase
      .from("students")
      .insert(stuRows)
      .select("id");

    if (sErr) {
      console.error(`   ⚠️ students insert 실패 (${stuRows.length}건):`, sErr.message);
      studentFail += stuRows.length;
      continue;
    }

    const insertedCount = sData?.length ?? stuRows.length;
    console.log(`   👥 students ${insertedCount}건 insert`);
    studentOk += insertedCount;
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📈 결과 요약`);
  console.log(`   bookings: ✅ ${bookingOk}건  ❌ ${bookingFail}건`);
  console.log(`   students: ✅ ${studentOk}건  ❌ ${studentFail}건`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((e) => {
  console.error("💥 unhandled:", e);
  process.exit(1);
});
