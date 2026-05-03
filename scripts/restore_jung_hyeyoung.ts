/**
 * 정혜영 예약 데이터 INSERT into bookings (옛 테이블) + 확인
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
function le(k: string) {
  if (process.env[k]) return process.env[k];
  try {
    const t = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
    return t.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch { return undefined; }
}
const sb = createClient(le("NEXT_PUBLIC_SUPABASE_URL")!, le("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

(async () => {
  // 1) bookings 컬럼 확인
  console.log("━━━ 1) bookings 컬럼 확인 ━━━");
  const { data: sample, error: sErr } = await sb.from("bookings").select("*").limit(1);
  if (sErr) { console.error("❌", sErr.message); process.exit(1); }
  if (!sample || sample.length === 0) {
    console.log("(빈 테이블 — 컬럼 추정 불가)");
  } else {
    console.log(Object.keys(sample[0]).sort().join(", "));
  }
  console.log("");

  // 2) 동일 reservation_no 또는 booker_name 중복 체크
  console.log("━━━ 2) 중복 체크 (reservation_no=DA-20260427-300113) ━━━");
  const { data: dup } = await sb.from("bookings").select("id, booker_name, reservation_no, created_at")
    .eq("reservation_no", "DA-20260427-300113");
  if (dup && dup.length > 0) {
    console.log(`⚠️ 동일 reservation_no 이미 존재: ${dup.length}건`);
    dup.forEach((r: any) => console.log(`  ${r.id} ${r.booker_name} ${r.created_at}`));
    console.log("→ INSERT 중단 (중복 방지). 기존 row를 UPDATE할지는 별도 결정.");
    return;
  }
  console.log("(중복 없음)");
  console.log("");

  // 3) INSERT
  console.log("━━━ 3) INSERT ━━━");
  const students = [
    {
      name_kr: "서가연",
      name_en: "SEO GAYEON",
      age: 10,
      grade: "주니어",
      academy_start: "2026-10-26",
      academy_end: "2026-11-23",
      photo_ok: true,
    },
  ];

  const payload: Record<string, unknown> = {
    booker_name: "정혜영",
    booker_english: "Jung Hye-young",
    reservation_no: "DA-20260427-300113",
    status: "영수증발행",
    reservation_date: "2026-10-25",  // 사용자 지시: 체크인 의도
    checkin_date: "2026-10-25",       // 일관성을 위해 둘 다 채움
    balance_date: "2026-08-25",
    accom_type: "제이파크 단독",        // 표기 정규화 (룸타입은 jp_room_type)
    jp_room_type: "디럭스",
    base_price: 8170000,
    final_price: 8170000,
    special_request: "사과, 복숭아 알레르기",
    students: students,                // jsonb
    children: 1,
    adults: 1,
    created_at: "2026-04-27T00:00:00Z",
  };

  const { data: inserted, error: insErr } = await sb.from("bookings").insert(payload).select("*").single();
  if (insErr) {
    console.error(`❌ INSERT 실패: ${insErr.message}`);
    process.exit(1);
  }
  console.log(`✅ INSERT 성공: id=${inserted.id}`);
  console.log("");

  // 4) SELECT 확인
  console.log("━━━ 4) SELECT 확인 ━━━");
  const { data: verify } = await sb.from("bookings").select("id, booker_name, reservation_no, status, reservation_date, checkin_date, balance_date, accom_type, jp_room_type, base_price, final_price, special_request, students, created_at")
    .eq("id", inserted.id)
    .single();
  console.log(JSON.stringify(verify, null, 2));
})().catch((e) => { console.error("💥", e); process.exit(1); });
