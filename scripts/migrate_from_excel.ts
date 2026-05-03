/**
 * migrate_from_excel.ts — Excel(xlsx) → bookings + students
 *
 * 실행:
 *   npx tsx scripts/migrate_from_excel.ts --dry-run
 *   npx tsx scripts/migrate_from_excel.ts
 *   npx tsx scripts/migrate_from_excel.ts ./data/foo.xlsx --dry-run
 *
 * env: SUPABASE_SERVICE_ROLE_KEY (.env.local 또는 process.env)
 *      NEXT_PUBLIC_SUPABASE_URL (없으면 https://yiglafscjvjgkxpycevk.supabase.co fallback)
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── argv parsing ───
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const filePathArg = argv.find((a) => !a.startsWith("--"));
const FILE_PATH = filePathArg
  ? resolve(filePathArg)
  : resolve(ROOT, "data/dream_migration_filled_1.xlsx");

// ─── env ───
function loadEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const t = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
    const m = t.match(new RegExp(`^${key}=(.+)$`, "m"));
    return m?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}
const SB_URL = loadEnv("NEXT_PUBLIC_SUPABASE_URL") || "https://yiglafscjvjgkxpycevk.supabase.co";
const SB_KEY = loadEnv("SUPABASE_SERVICE_ROLE_KEY");

if (!DRY_RUN && !SB_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY 누락 — .env.local 또는 process.env 확인");
  process.exit(1);
}

// ─── 헤더 (사용자 지정 순서) ───
const HEADERS = [
  "booking_type", "booker_name", "contact", "checkin_date", "checkout_date",
  "dh_weeks", "jp_weeks", "jp_room_type",
  "student_name_kr", "student_name_en", "student_age", "student_grade",
  "accom_room", "academy_start", "academy_end",
  "flight_in", "flight_out", "pickup_place", "dropoff_place",
  "c9_weeks", "hagwon", "photo_ok",
  "total_amount", "deposit_paid", "balance_due_date",
  "status", "assignee", "student_special_notes", "booking_special_notes",
] as const;

type Row = Record<(typeof HEADERS)[number], unknown>;

// ─── 변환 헬퍼 ───
const trim = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).trim();

const orNull = <T>(v: T | "" | null | undefined): T | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v as T;
};

// 입력값(영문 또는 한글) → bookings_new.booking_type 영문 라벨
function mapBookingType(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const known = new Set([
    "dreamhouse", "dreamhouse_jaypark", "dreamhouse_cubenine",
    "jaypark", "cubenine", "commute", "room_only",
  ]);
  if (known.has(v)) return v;
  // 한글 매핑
  if (v.includes("패키지") || v === "드하" || v === "Choi Dain" || v === "캠프") return "dreamhouse";
  if (v.includes("통학")) return "commute";
  if (v.includes("드림하우스") && v.includes("제이파크")) return "dreamhouse_jaypark";
  if (v.includes("드림하우스") && (v.includes("큐브나인") || v.includes("큐브"))) return "dreamhouse_cubenine";
  if (v.includes("제이파크")) return "jaypark";
  if (v.includes("큐브")) return "cubenine";
  if (v.includes("드림하우스")) return "dreamhouse";
  // fallback
  return v;
}

// "킨더"/"킨더(오)"/"킨더(종)" → "kinder", "주니어" → "junior", 기본 → "junior"
function mapStudentLevel(raw: unknown): string {
  const v = trim(raw);
  if (!v) return "junior";
  if (v.includes("킨더")) return "kinder";
  if (v.includes("주니어")) return "junior";
  return "junior";
}

// photo_ok (1/0/"O"/"X") → boolean
function mapPhotoAllowed(raw: unknown): boolean | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  const s = String(raw).trim().toUpperCase();
  if (!s) return null;
  if (s === "1" || s === "O" || s === "TRUE" || s === "Y" || s === "YES") return true;
  if (s === "0" || s === "X" || s === "FALSE" || s === "N" || s === "NO") return false;
  return null;
}

// "16년생" → 2026-2016=10, "만3세"→3, "10"→10
function parseAge(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Math.round(raw);
  const s = String(raw).trim();
  if (!s) return null;
  // 16년생 / 06년생
  const yr = s.match(/(\d{1,4})\s*년생/);
  if (yr) {
    let n = Number(yr[1]);
    if (n < 100) n += 2000; // 2-digit → 20XX
    return Math.max(0, 2026 - n);
  }
  // 만3세 / 만 3 세
  const man = s.match(/만\s*(\d+)\s*세?/);
  if (man) return Number(man[1]);
  // 그냥 숫자
  const n = s.match(/\d+/);
  if (n) return Number(n[0]);
  return null;
}

// "드하(B17L8)" → "B17L8" / "큐브나인(C302)" → "C302"
function parseAccomRoom(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/\(([^)]+)\)/);
  if (m) return m[1].trim();
  return null;
}

function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return raw;
  const s = String(raw).replace(/[, ]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// 날짜 정규화: Excel serial → ISO string, 또는 string passthrough
function parseDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    // XLSX serial date
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    const yyyy = String(d.y).padStart(4, "0");
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(raw).trim();
  if (!s) return null;
  return s;
}

// ─── xlsx 로드 + sheet → row 객체 배열 ───
function loadRows(filePath: string): Row[] {
  if (!existsSync(filePath)) {
    console.error(`❌ xlsx 파일 없음: ${filePath}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  // raw matrix (header: 1) — 모든 행을 배열의 배열로
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: false });
  // header at row index 3 (0-indexed)
  // row 4 = 설명, row 5 = 예시(김효정) → skip
  // row 6+ → 실제 데이터
  const dataRows = matrix.slice(6);
  return dataRows.map((arr) => {
    const obj: Record<string, unknown> = {};
    HEADERS.forEach((h, i) => {
      obj[h] = arr[i] ?? "";
    });
    return obj as Row;
  });
}

// ─── 그룹화: booking_type이 비어 있고 booker_name이 같으면 직전 booking에 student 추가 ───
interface GroupedBooking {
  booking: Row;
  students: Row[];
}

function group(rows: Row[]): GroupedBooking[] {
  const out: GroupedBooking[] = [];
  let cur: GroupedBooking | null = null;

  for (const r of rows) {
    const bt = trim(r.booking_type);
    const bn = trim(r.booker_name);
    if (!bt && !bn) continue; // 완전히 빈 행
    if (bt) {
      // 새 booking 시작
      cur = { booking: r, students: [] };
      out.push(cur);
      // 첫 번째 student도 동일 행에서 추출
      if (trim(r.student_name_kr) || trim(r.student_name_en)) {
        cur.students.push(r);
      }
    } else if (cur && (!bn || bn === trim(cur.booking.booker_name))) {
      // 직전 그룹의 student 행
      if (trim(r.student_name_kr) || trim(r.student_name_en)) {
        cur.students.push(r);
      }
    } else {
      // booker_name만 있고 booking_type 없는데 직전 그룹과 다름 — 무시 또는 새 그룹 (정의 모호)
      // 안전: 직전 그룹에 student로 추가하지 않고 스킵
    }
  }
  return out;
}

// ─── payload 빌더 ───
function bookingPayload(b: Row, numChildren: number) {
  return {
    booking_type: mapBookingType(trim(b.booking_type)),
    booker_name: orNull(trim(b.booker_name)),
    booker_phone: orNull(trim(b.contact)),
    check_in: parseDate(b.checkin_date),
    check_out: parseDate(b.checkout_date),
    agency: orNull(trim(b.hagwon)),
    total_amount: parseNumber(b.total_amount),
    balance_due: parseDate(b.balance_due_date),
    pickup_place: orNull(trim(b.pickup_place)),
    drop_place: orNull(trim(b.dropoff_place)),
    status: orNull(trim(b.status)),
    special_request: orNull(trim(b.booking_special_notes)),
    num_adults: null as number | null,
    num_children: numChildren,
    academy_start: parseDate(b.academy_start),
    flight_in_airline: orNull(trim(b.flight_in)),
    flight_in_date: null as string | null,
    flight_in_time: null as string | null,
    flight_out_airline: orNull(trim(b.flight_out)),
    flight_out_date: null as string | null,
    flight_out_time: null as string | null,
    confirmed: false,
  };
}

function studentPayload(s: Row, bookingId: string) {
  return {
    booking_id: bookingId,
    name_kr: orNull(trim(s.student_name_kr)),
    name_en: orNull(trim(s.student_name_en)),
    age: parseAge(s.student_age),
    level: mapStudentLevel(s.student_grade),
    address_detail: parseAccomRoom(s.accom_room),
    academy_start: parseDate(s.academy_start),
    academy_end: parseDate(s.academy_end),
    photo_allowed: mapPhotoAllowed(s.photo_ok),
    special_request: orNull(trim(s.student_special_notes)),
  };
}

// ─── main ───
async function main() {
  console.log(`📂 file: ${FILE_PATH}`);
  console.log(`🔧 mode: ${DRY_RUN ? "DRY-RUN (insert 생략)" : "LIVE INSERT"}`);
  if (!DRY_RUN) console.log(`🌐 supabase: ${SB_URL}`);
  console.log("");

  const rows = loadRows(FILE_PATH);
  const groups = group(rows);

  console.log(`📊 파싱 결과: 예약 ${groups.length}건, 학생 합 ${groups.reduce((s, g) => s + g.students.length, 0)}명\n`);

  // dry-run 시 첫 5건 미리보기
  if (DRY_RUN) {
    const preview = groups.slice(0, 5);
    preview.forEach((g, i) => {
      const bp = bookingPayload(g.booking, g.students.length);
      console.log(`─── [${i + 1}] ${bp.booker_name ?? "(no name)"} ───`);
      console.log("  booking:", bp);
      g.students.forEach((s, j) => {
        const sp = studentPayload(s, "{booking_id}");
        console.log(`  student[${j + 1}]:`, sp);
      });
      console.log("");
    });
    if (groups.length > 5) {
      console.log(`... (총 ${groups.length}건 중 5건만 표시)\n`);
    }
    // 추가: 모든 booking 요약
    console.log("━━━━━━━━ 전체 요약 ━━━━━━━━");
    groups.forEach((g, i) => {
      const bp = bookingPayload(g.booking, g.students.length);
      console.log(`  [${i + 1}] ${bp.booker_name} | ${bp.booking_type} | check_in=${bp.check_in} | students=${g.students.length}`);
    });
    return;
  }

  // LIVE INSERT
  const supabase = createClient(SB_URL, SB_KEY!, { auth: { persistSession: false } });
  let bOk = 0, bFail = 0, sOk = 0, sFail = 0;

  const failures: { idx: number; name: string | null; reason: string }[] = [];

  async function insertBooking(payload: ReturnType<typeof bookingPayload>) {
    const { data, error } = await supabase.from("bookings_new").insert(payload).select("id").single();
    if (!error && data?.id) return { id: data.id as string, error: null as string | null };
    return { id: null as string | null, error: error?.message ?? "no id returned" };
  }

  async function insertStudents(rows: ReturnType<typeof studentPayload>[]) {
    const { data, error } = await supabase.from("students").insert(rows).select("id");
    if (!error) return { count: data?.length ?? rows.length, error: null as string | null };
    return { count: 0, error: error?.message ?? "unknown" };
  }

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const bp = bookingPayload(g.booking, g.students.length);
    const label = `[${i + 1}/${groups.length}] ${bp.booker_name ?? "(no name)"}`;

    const { id: bookingId, error: bErr } = await insertBooking(bp);
    if (!bookingId) {
      console.error(`❌ ${label} — booking insert 실패: ${bErr}`);
      bFail++;
      failures.push({ idx: i + 1, name: bp.booker_name, reason: `booking: ${bErr}` });
      continue;
    }
    console.log(`✅ ${label} — booking ${bookingId}`);
    bOk++;

    if (g.students.length === 0) continue;
    const stuRows = g.students.map((s) => studentPayload(s, bookingId));
    const { count, error: sErr } = await insertStudents(stuRows);
    if (sErr) {
      console.error(`   ⚠️ students(${stuRows.length}) 실패: ${sErr}`);
      sFail += stuRows.length;
      failures.push({ idx: i + 1, name: bp.booker_name, reason: `students: ${sErr}` });
      continue;
    }
    console.log(`   👥 students ${count}건`);
    sOk += count;
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`bookings: ✅ ${bOk}  ❌ ${bFail}`);
  console.log(`students: ✅ ${sOk}  ❌ ${sFail}`);
  if (failures.length > 0) {
    console.log("\n실패 목록:");
    failures.forEach((f) => console.log(`  [${f.idx}] ${f.name ?? "(no name)"} — ${f.reason}`));
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((e) => {
  console.error("💥 unhandled:", e);
  process.exit(1);
});
