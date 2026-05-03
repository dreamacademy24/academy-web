/**
 * STEP 1: 중복 students 3건 삭제
 * STEP 2: CHECK 제약 ALTER + commute 교정 (exec_sql rpc 시도, 실패 시 SQL 출력)
 * STEP 3: 최종 집계
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
  // ─── STEP 1: 중복 students 삭제 ───
  console.log("━━━ STEP 1: 중복 students 3건 삭제 ━━━");
  const dupIds = [
    "8b2ad665-648a-4e77-a9ac-22491d8c6867", // 도유민#1 - 임태양
    "36863061-7c67-44cb-a830-0f9883ce36c7", // 김광진 - 김래원
    "006b8f24-b955-44a6-a494-f061eea973aa", // 정지은 - 김이안
  ];
  const { error: dErr, count: dCount } = await sb.from("students").delete({ count: "exact" }).in("id", dupIds);
  console.log(dErr ? `❌ ${dErr.message}` : `✅ ${dCount ?? 0}건 삭제 완료`);
  console.log("");

  // ─── STEP 2: CHECK 제약 ALTER + commute 교정 ───
  console.log("━━━ STEP 2: CHECK 제약 ALTER + commute 교정 ━━━");
  const alterSQL = `
ALTER TABLE bookings_new
DROP CONSTRAINT IF EXISTS bookings_new_booking_type_check;

ALTER TABLE bookings_new
ADD CONSTRAINT bookings_new_booking_type_check
CHECK (booking_type IN (
  'dreamhouse', 'dreamhouse_jaypark',
  'dreamhouse_cubenine', 'room_only', 'commute'
));

UPDATE bookings_new
SET booking_type = 'commute'
WHERE booker_name IN ('도유민', '김광진', '정지은')
  AND booking_type = 'room_only';
`.trim();

  // exec_sql RPC 시도 (CLAUDE.md에 존재 명시됨)
  const { data: rpcData, error: rpcErr } = await sb.rpc("exec_sql", { query: alterSQL });
  if (!rpcErr) {
    console.log("✅ exec_sql RPC 실행 성공");
    if (rpcData) console.log("   결과:", rpcData);
  } else {
    console.log(`⚠️ exec_sql RPC 실패: ${rpcErr.message}`);
    console.log("→ Supabase SQL Editor에서 아래 SQL을 직접 실행해주세요:");
    console.log("─────────────────────────────────────");
    console.log(alterSQL);
    console.log("─────────────────────────────────────");
  }
  console.log("");

  // commute 교정 결과 확인
  const { data: verify } = await sb
    .from("bookings_new")
    .select("booker_name, booking_type")
    .in("booker_name", ["도유민", "김광진", "정지은"]);
  console.log("교정 후 booking_type 확인:");
  verify?.forEach((r: any) => console.log(`  ${r.booker_name}: ${r.booking_type}`));
  console.log("");

  // ─── STEP 3: 최종 집계 ───
  console.log("━━━ STEP 3: 최종 집계 ━━━");
  const { count: bc } = await sb.from("bookings_new").select("*", { count: "exact", head: true });
  const { count: sc } = await sb.from("students").select("*", { count: "exact", head: true });
  console.log(`📊 bookings_new 전체: ${bc}건  /  students 전체: ${sc}명`);

  // 마이그레이션 데이터만 카운트 (booker_name 화이트리스트)
  const MIG_NAMES = [
    "장훈화","장미연","김연정","이지은","김은혜","이혜영","주수영","윤준용","이유정","이은미",
    "신혜연","송진희","김희영","강연미","왕지현","허은녕","김가희","안소현","신현선",
    "양지나","도유민","김소현","김광진","김미수","정지은","정명한","전나영","이현미","김현경",
    "백서윤","이덕원","박경숙","노혜진","신혜미",
  ];
  const { data: migBks, count: migBc } = await sb
    .from("bookings_new")
    .select("id, booker_name", { count: "exact" })
    .in("booker_name", MIG_NAMES);
  console.log(`   마이그레이션 booking: ${migBc}건 (정확히 일치 명단 기준)`);

  if (migBks) {
    const ids = migBks.map((b: any) => b.id);
    const { count: migSc } = await sb
      .from("students")
      .select("*", { count: "exact", head: true })
      .in("booking_id", ids);
    console.log(`   마이그레이션 students: ${migSc}명`);
  }
  console.log("\n(목표: bookings 36건, students 64명)");
})().catch((e) => { console.error("💥", e); process.exit(1); });
