/**
 * migrate-csv.mjs — CSV → Supabase 마이그레이션
 *
 * 패키지디테일 CSV → bookings_new
 * 디테일 CSV → students
 *
 * 실행: node scripts/migrate-csv.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/* ── .env.local 로드 ── */
const envText = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
const getEnv = (k) => envText.match(new RegExp(`${k}=(.+)`))?.[1]?.trim();
const SB_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const SB_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");

/* ── CSV 파서 (멀티라인 셀, 쉼표 in 따옴표 처리) ── */
function parseCSV(text) {
  const rows = [];
  let cur = [];
  let field = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ",") {
        cur.push(field.trim());
        field = "";
      } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        cur.push(field.trim());
        field = "";
        if (ch === "\r") i++; // skip \n after \r
        rows.push(cur);
        cur = [];
      } else {
        field += ch;
      }
    }
  }
  // last field/row
  if (field || cur.length > 0) {
    cur.push(field.trim());
    rows.push(cur);
  }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

/* ── 날짜 파싱 ── */
function parseDate(str) {
  if (!str) return null;
  const s = str.trim();
  // YYYY-MM-DD or YYYY-M-D
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // YYYY.MM.DD
  const dot = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (dot) {
    const [, y, m, d] = dot;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

/* ── 숙소 → booking_type ── */
function toBookingType(accom) {
  if (!accom) return "dreamhouse";
  const a = accom.trim();
  if (a.includes("제이파크") || a.includes("제이 파크")) return "dreamhouse_jaypark";
  if (a.includes("큐브나인") || a.includes("큐브 나인")) return "dreamhouse_cubenine";
  if (a.includes("드림") || a.includes("드하")) return "dreamhouse";
  return "room_only";
}

/* ── 투숙인원 파싱 ── */
function parseGuests(str) {
  if (!str) return { adults: 0, children: 0 };
  let adults = 0, children = 0;
  // "보호자2+아이2" or "보호자 1+아이1"
  const am = str.match(/보호자\s*(\d+)/);
  if (am) adults = parseInt(am[1]);
  const cm = str.match(/아이\s*(\d+)/);
  if (cm) children = parseInt(cm[1]);
  // fallback: "성인" pattern
  const sm = str.match(/성인\s*(\d+)/);
  if (sm) adults = Math.max(adults, parseInt(sm[1]));
  const acm = str.match(/아동\s*(\d+)/);
  if (acm) children = Math.max(children, parseInt(acm[1]));
  return { adults, children };
}

/* ── Supabase REST insert ── */
async function sbInsert(table, rows) {
  if (rows.length === 0) return { count: 0, error: null };

  // Supabase REST has a body size limit, batch in chunks of 50
  const BATCH = 50;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const body = await res.text();
      return { count: total, error: `${res.status}: ${body}` };
    }
    total += chunk.length;
  }
  return { count: total, error: null };
}

async function sbCount(table) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?select=id&limit=1`, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Prefer: "count=exact",
    },
  });
  const range = res.headers.get("content-range");
  if (range) {
    const m = range.match(/\/(\d+)/);
    return m ? parseInt(m[1]) : "?";
  }
  return "?";
}

/* ══════════════════════════════════
   메인
   ══════════════════════════════════ */
async function main() {
  console.log("📦 CSV 마이그레이션 시작\n");

  // ── 1. 패키지디테일 → bookings_new ──
  const pkgPath = resolve(ROOT, "..", "Downloads", "드하 최종 예약현황 - 패키지 디테일.csv");
  const pkgText = readFileSync(pkgPath, "utf-8");
  const pkgRows = csvToObjects(pkgText);

  const bookings = [];
  for (const r of pkgRows) {
    const name = r["예약자명"]?.trim();
    if (!name) continue; // 빈 행 스킵

    const guests = parseGuests(r["투숙인원"]);

    bookings.push({
      booker_name: name,
      booking_type: toBookingType(r["숙소"]),
      check_in: parseDate(r["체크인"]),
      check_out: parseDate(r["체크아웃"]),
      flight_in_airline: r["항공편"] || null,
      pickup_place: r["픽업장소"] || null,
      agency: r["유학원"] || null,
      balance_due: parseDate(r["잔금일자"]),
      special_request: r["특이사항"] || null,
      num_adults: guests.adults,
      num_children: guests.children,
      status: "confirmed",
      confirmed: true,
    });
  }

  console.log(`📋 패키지디테일: ${pkgRows.length}행 파싱 → ${bookings.length}건 변환`);

  const bResult = await sbInsert("bookings_new", bookings);
  if (bResult.error) {
    console.error(`❌ bookings_new INSERT 에러: ${bResult.error}`);
  } else {
    console.log(`✅ bookings_new INSERT 완료: ${bResult.count}건`);
  }

  // ── 2. 디테일 → students ──
  const detPath = resolve(ROOT, "..", "Downloads", "드림아카데미 - 디테일.csv");
  const detText = readFileSync(detPath, "utf-8");
  const detRows = csvToObjects(detText);

  const students = [];
  for (const r of detRows) {
    const rawName = r["한글 이름"]?.trim();
    if (!rawName) continue; // 빈 행 스킵

    // "이로하 / Roha Lee" → name_kr: "이로하", name_en: "Roha Lee"
    // "김아인 kim ah in" → name_kr: "김아인", name_en: "kim ah in"
    let nameKr = rawName;
    let nameEn = r["영어 이름"]?.trim() || null;

    if (rawName.includes("/")) {
      const parts = rawName.split("/");
      nameKr = parts[0].trim();
      if (!nameEn) nameEn = parts[1]?.trim() || null;
    } else if (rawName.includes(",")) {
      // "최윤범, choi yoon beom"
      const parts = rawName.split(",");
      nameKr = parts[0].trim();
      if (!nameEn) nameEn = parts[1]?.trim() || null;
    } else {
      // "김아인 kim ah in" — 한글 + 영문이 같은 셀에
      const spaceMatch = rawName.match(/^([가-힣]+)\s+(.+)$/);
      if (spaceMatch) {
        nameKr = spaceMatch[1];
        if (!nameEn) nameEn = spaceMatch[2];
      }
    }

    // level
    const kinderJunior = (r["킨더/주니어"] || "").trim();
    let level = null;
    if (/킨더/i.test(kinderJunior)) level = "kinder";
    else if (/주니어/i.test(kinderJunior)) level = "junior";

    // class_type — 오전/종일 컬럼 또는 기간 컬럼에서 추출
    const ampm = (r["오전/종일"] || "").trim();
    const period = (r["기간"] || "").trim();
    let classType = null;
    if (/종일/.test(ampm) || /종일/.test(period) || /종일/.test(kinderJunior)) classType = "fullday";
    else if (/오전/.test(ampm) || /오전/.test(period) || /오전/.test(kinderJunior)) classType = "morning";

    // SSP
    const sspVal = (r["SSP"] || "").trim().toLowerCase();
    const ssp = sspVal === "o" || sspVal === "yes" || sspVal === "true" || sspVal.length > 0 && sspVal !== "x";

    // photo_allowed
    const photoVal = (r["사진 허용"] || "").trim().toUpperCase();
    const photoAllowed = photoVal === "O" || photoVal === "YES";

    students.push({
      name_kr: nameKr,
      name_en: nameEn,
      age: r["나이"]?.trim() || null,
      level,
      class_type: classType,
      academy_start: parseDate(r["시작"]),
      academy_end: parseDate(r["종료"]),
      pickup_location: r["픽/드롭"]?.trim() || null,
      address_detail: r["상세주소"]?.trim() || null,
      ssp,
      photo_allowed: photoAllowed,
      special_request: r["특이사항"]?.trim() || null,
    });
  }

  console.log(`\n📋 디테일: ${detRows.length}행 파싱 → ${students.length}건 변환`);

  const sResult = await sbInsert("students", students);
  if (sResult.error) {
    console.error(`❌ students INSERT 에러: ${sResult.error}`);
  } else {
    console.log(`✅ students INSERT 완료: ${sResult.count}건`);
  }

  // ── 건수 확인 ──
  console.log("\n── 테이블 건수 확인 ──");
  const bCount = await sbCount("bookings_new");
  const sCount = await sbCount("students");
  console.log(`   bookings_new: ${bCount}건`);
  console.log(`   students:     ${sCount}건`);
  console.log("\n✅ 마이그레이션 완료!");
}

main().catch((e) => {
  console.error("❌ 에러:", e);
  process.exit(1);
});
