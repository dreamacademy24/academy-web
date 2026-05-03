/**
 * retry_commute.ts — 직전 마이그레이션에서 실패한 commute 4건만 재시도
 *
 * 흐름:
 *  STEP 1: bookings_new의 distinct booking_type 값 조회 (현재 허용되는 값 확인)
 *  STEP 2: Excel에서 commute 4건 추출 → 시도할 booking_type 값 결정 → INSERT + students
 *
 * 실행: npx tsx scripts/retry_commute.ts
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function le(k: string) {
  if (process.env[k]) return process.env[k];
  try {
    const t = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
    return t.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch {
    return undefined;
  }
}
const SB_URL = le("NEXT_PUBLIC_SUPABASE_URL")!;
const SB_KEY = le("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

// migrate_from_excel.ts와 동일 헤더/그룹화/매핑 로직 (필요 부분만 복사)
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

const trim = (v: unknown) => v === null || v === undefined ? "" : String(v).trim();
const orNull = <T>(v: T | "" | null | undefined): T | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v as T;
};
function parseAge(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Math.round(raw);
  const s = String(raw).trim();
  if (!s) return null;
  const yr = s.match(/(\d{1,4})\s*년생/);
  if (yr) {
    let n = Number(yr[1]);
    if (n < 100) n += 2000;
    return Math.max(0, 2026 - n);
  }
  const man = s.match(/만\s*(\d+)\s*세?/);
  if (man) return Number(man[1]);
  const n = s.match(/\d+/);
  return n ? Number(n[0]) : null;
}
function parseAccomRoom(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/\(([^)]+)\)/);
  return m ? m[1].trim() : null;
}
function parseDate(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    return `${String(d.y).padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(raw).trim();
  return s || null;
}
function mapLevel(raw: unknown): string {
  const v = trim(raw);
  if (v.includes("킨더")) return "kinder";
  if (v.includes("주니어")) return "junior";
  return "junior";
}
function mapPhoto(raw: unknown): boolean | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  const s = String(raw).trim().toUpperCase();
  if (["1", "O", "TRUE", "Y", "YES"].includes(s)) return true;
  if (["0", "X", "FALSE", "N", "NO"].includes(s)) return false;
  return null;
}

function loadGroups(filePath: string) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: false });
  const dataRows = matrix.slice(6);
  const rows: Row[] = dataRows.map((arr) => {
    const obj: Record<string, unknown> = {};
    HEADERS.forEach((h, i) => (obj[h] = arr[i] ?? ""));
    return obj as Row;
  });
  // 그룹화
  const out: { booking: Row; students: Row[] }[] = [];
  let cur: { booking: Row; students: Row[] } | null = null;
  for (const r of rows) {
    const bt = trim(r.booking_type);
    const bn = trim(r.booker_name);
    if (!bt && !bn) continue;
    if (bt) {
      cur = { booking: r, students: [] };
      out.push(cur);
      if (trim(r.student_name_kr) || trim(r.student_name_en)) cur.students.push(r);
    } else if (cur && (!bn || bn === trim(cur.booking.booker_name))) {
      if (trim(r.student_name_kr) || trim(r.student_name_en)) cur.students.push(r);
    }
  }
  return out;
}

function buildBookingPayload(b: Row, numChildren: number, bookingTypeValue: string) {
  return {
    booking_type: bookingTypeValue,
    booker_name: orNull(trim(b.booker_name)),
    booker_phone: orNull(trim(b.contact)),
    check_in: parseDate(b.checkin_date),
    check_out: parseDate(b.checkout_date),
    agency: orNull(trim(b.hagwon)),
    total_amount: null as number | null,
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
function buildStudentPayload(s: Row, bookingId: string) {
  return {
    booking_id: bookingId,
    name_kr: orNull(trim(s.student_name_kr)),
    name_en: orNull(trim(s.student_name_en)),
    age: parseAge(s.student_age),
    level: mapLevel(s.student_grade),
    address_detail: parseAccomRoom(s.accom_room),
    academy_start: parseDate(s.academy_start),
    academy_end: parseDate(s.academy_end),
    photo_allowed: mapPhoto(s.photo_ok),
    special_request: orNull(trim(s.student_special_notes)),
  };
}

async function main() {
  // ─── STEP 1: 현재 bookings_new에 존재하는 booking_type 값 확인 ───
  console.log("━━━ STEP 1: bookings_new.booking_type 허용값 확인 ━━━");
  const { data: existing, error: exErr } = await sb.from("bookings_new").select("booking_type");
  if (exErr) {
    console.error("❌ select 실패:", exErr.message);
    process.exit(1);
  }
  const existingTypes = [...new Set((existing ?? []).map((r: any) => r.booking_type).filter(Boolean))];
  console.log("현재 사용 중인 booking_type 값:", existingTypes);

  // commute에 해당하는 후보 — 우선순위 순으로 시도
  const COMMUTE_CANDIDATES = ["commute", "통학", "통학형", "room_only"];
  console.log("commute 시도 후보:", COMMUTE_CANDIDATES);
  console.log("");

  // ─── STEP 2: Excel commute 4건 추출 ───
  console.log("━━━ STEP 2: Excel commute 4건 추출 + INSERT ━━━");
  const FILE_PATH = resolve(ROOT, "data/dream_migration_filled_1.xlsx");
  const groups = loadGroups(FILE_PATH);
  const commuteGroups = groups.filter((g) => {
    const bt = trim(g.booking).toLowerCase();
    const raw = trim(g.booking.booking_type);
    return raw.includes("통학") || raw.toLowerCase() === "commute";
  });
  console.log(`Excel commute 그룹: ${commuteGroups.length}건`);
  commuteGroups.forEach((g, i) => {
    console.log(`  [${i + 1}] ${trim(g.booking.booker_name)} (학생 ${g.students.length}명)`);
  });
  console.log("");

  // 중복 방지: 이미 들어간 (booker_name, check_in) 조합 체크
  const { data: alreadyIn } = await sb.from("bookings_new").select("booker_name, check_in");
  const dupSet = new Set((alreadyIn ?? []).map((r: any) => `${r.booker_name}|${r.check_in ?? ""}`));

  let bOk = 0, bFail = 0, sOk = 0, sFail = 0;
  let chosenType: string | null = null;

  for (let i = 0; i < commuteGroups.length; i++) {
    const g = commuteGroups[i];
    const bookerName = trim(g.booking.booker_name);
    const checkIn = parseDate(g.booking.checkin_date) ?? "";
    const dupKey = `${bookerName}|${checkIn}`;
    if (dupSet.has(dupKey)) {
      console.log(`⏭️  [${i + 1}] ${bookerName} — 이미 존재 (중복 스킵)`);
      continue;
    }

    let inserted: any = null;
    let lastErr: string | null = null;

    // 후보 booking_type 값 차례로 시도 (chosenType 정해지면 그것만 사용)
    const tries: string[] = chosenType ? [chosenType] : COMMUTE_CANDIDATES;
    for (const candidate of tries) {
      const payload = buildBookingPayload(g.booking, g.students.length, candidate);
      const { data, error } = await sb.from("bookings_new").insert(payload).select("id").single();
      if (!error && data?.id) {
        inserted = data;
        chosenType = candidate;
        console.log(`✅ [${i + 1}] ${bookerName} — booking ${data.id} (booking_type="${candidate}")`);
        break;
      }
      lastErr = error?.message ?? "unknown";
    }

    if (!inserted) {
      console.error(`❌ [${i + 1}] ${bookerName} — 모든 후보 실패. 마지막 에러: ${lastErr}`);
      bFail++;
      continue;
    }
    bOk++;
    dupSet.add(dupKey);

    if (g.students.length === 0) continue;
    const stuRows = g.students.map((s) => buildStudentPayload(s, inserted.id));
    const { data: sData, error: sErr } = await sb.from("students").insert(stuRows).select("id");
    if (sErr) {
      console.error(`   ⚠️ students(${stuRows.length}) 실패: ${sErr.message}`);
      sFail += stuRows.length;
      continue;
    }
    console.log(`   👥 students ${sData?.length ?? stuRows.length}건`);
    sOk += sData?.length ?? stuRows.length;
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`bookings: ✅ ${bOk}  ❌ ${bFail}`);
  console.log(`students: ✅ ${sOk}  ❌ ${sFail}`);
  if (chosenType) console.log(`사용된 booking_type 값: "${chosenType}"`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((e) => {
  console.error("💥 unhandled:", e);
  process.exit(1);
});
