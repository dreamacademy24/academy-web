/**
 * STEP 1: 기존 3건 booking ID 조회
 * STEP 2: 학생 INSERT (booking_id 연결)
 * STEP 3: 도유민 2번 예약(4번째) booking + students 추가
 * STEP 4: 최종 집계
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
  // ─── STEP 1: 기존 3건 booking ID ───
  console.log("━━━ STEP 1: 기존 3건 booking ID 조회 ━━━");
  const { data: commuters, error: cErr } = await sb
    .from("bookings_new")
    .select("id, booker_name, created_at")
    .in("booker_name", ["도유민", "김광진", "정지은"])
    .order("created_at", { ascending: true });
  if (cErr) { console.error("❌", cErr.message); process.exit(1); }
  commuters?.forEach((r: any) => console.log(`  ${r.booker_name}: ${r.id} (${r.created_at})`));
  console.log("");

  const doyumin1 = commuters?.find((r: any) => r.booker_name === "도유민");
  const kimGwangjin = commuters?.find((r: any) => r.booker_name === "김광진");
  const jungJieun = commuters?.find((r: any) => r.booker_name === "정지은");

  if (!doyumin1 || !kimGwangjin || !jungJieun) {
    console.error("❌ 필수 booking ID 누락");
    process.exit(1);
  }

  // ─── STEP 2: 학생 INSERT (3명) ───
  console.log("━━━ STEP 2: 학생 INSERT (3명) ━━━");
  const stu1: any[] = [
    {
      booking_id: doyumin1.id, name_kr: "임태양", name_en: "Taeuadng",
      age: 10, level: "junior",
      academy_start: "2026-06-22", academy_end: "2026-07-17",
      photo_allowed: false,
      special_request: "6/22~7/17(태양), 7/18~7/26(말레이여행), 7/27~8/14(태양가온별하)",
    },
    {
      booking_id: kimGwangjin.id, name_kr: "김래원", name_en: "Ray",
      age: 8, level: "junior",
      academy_start: "2026-06-29", academy_end: "2026-07-10",
      photo_allowed: false,
    },
    {
      booking_id: jungJieun.id, name_kr: "김이안", name_en: "Kim Yian",
      age: 8, level: "junior",
      academy_start: "2026-07-13", academy_end: "2026-08-07",
      photo_allowed: false,
    },
  ];
  const { error: s1Err, data: s1Data } = await sb.from("students").insert(stu1).select("id");
  if (s1Err) { console.error("❌", s1Err.message); }
  else console.log(`✅ ${s1Data?.length ?? stu1.length}명 INSERT 완료`);
  console.log("");

  // ─── STEP 3: 도유민 2번 예약 추가 + students 3명 ───
  console.log("━━━ STEP 3: 도유민 2번 예약(4번째) 추가 ━━━");
  const { data: b2, error: b2Err } = await sb
    .from("bookings_new")
    .insert({
      booker_name: "도유민",
      booking_type: "room_only",
      status: "접수",
      special_request: "6/22~7/17(태양), 7/18~7/26(말레이여행), 7/27~8/14(태양가온별하)",
    })
    .select("id")
    .single();
  if (b2Err || !b2?.id) {
    console.error("❌ 도유민 2번 booking 실패:", b2Err?.message);
    process.exit(1);
  }
  console.log(`✅ 도유민2 booking: ${b2.id}`);

  const stu2 = [
    { booking_id: b2.id, name_kr: "임태양", name_en: "Lim Taeyang",
      age: 10, level: "junior",
      academy_start: "2026-07-27", academy_end: "2026-08-14", photo_allowed: false },
    { booking_id: b2.id, name_kr: "임가온", name_en: "Lim Gaon",
      age: 6, level: "kinder",
      academy_start: "2026-07-27", academy_end: null, photo_allowed: false },
    { booking_id: b2.id, name_kr: "임별하", name_en: "Lim Byulha",
      age: 4, level: "kinder",
      academy_start: "2026-07-27", academy_end: null, photo_allowed: false },
  ];
  const { error: s2Err, data: s2Data } = await sb.from("students").insert(stu2).select("id");
  if (s2Err) console.error("❌", s2Err.message);
  else console.log(`✅ students ${s2Data?.length ?? stu2.length}명 INSERT`);
  console.log("");

  // ─── STEP 4: 최종 집계 ───
  console.log("━━━ STEP 4: 최종 집계 ━━━");
  const { count: bc } = await sb.from("bookings_new").select("*", { count: "exact", head: true });
  const { count: sc } = await sb.from("students").select("*", { count: "exact", head: true });
  console.log(`📊 bookings_new: ${bc}건  /  students: ${sc}명`);
  console.log("(목표: bookings 36건, students 64명)");
})().catch((e) => { console.error("💥", e); process.exit(1); });
