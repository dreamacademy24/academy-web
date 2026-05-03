/**
 * STEP 1: bookings_new 컬럼 목록 조회
 * STEP 2: 방금 INSERT한 36건 롤백 (booker_name 화이트리스트 + 오늘 created_at)
 *
 * 실행: npx tsx scripts/rollback_and_discover.ts
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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
if (!SB_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY 누락");
  process.exit(1);
}
const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const MIGRATION_NAMES = [
  "장훈화","장미연","김연정","이지은","김은혜","이혜영","주수영","윤준용","이유정","이은미",
  "김장미\n/\n장이화","신혜연","송진희","김희영","강연미","왕지현","허은녕","김가희","안소현","신현선",
  "양지나","도유민","김소현","김광진","김미수","정지은","정명한","전나영","이현미","김현경",
  "백서윤","이덕원","박경숙","노혜진","신혜미",
];

async function main() {
  // ─── STEP 1: bookings_new 컬럼 목록 ───
  console.log("━━━ STEP 1: bookings_new 컬럼 목록 ━━━");
  const { data: bnRows, error: bnErr } = await supabase.from("bookings_new").select("*").limit(1);
  if (bnErr) {
    console.error("❌ bookings_new select 실패:", bnErr.message);
  } else if (bnRows && bnRows.length > 0) {
    console.log(`bookings_new 컬럼 (${Object.keys(bnRows[0]).length}개):`);
    console.log("  " + Object.keys(bnRows[0]).sort().join(", "));
  } else {
    console.log("⚠️ bookings_new 테이블 row 0건 — 빈 테이블. 빈 INSERT 시도해 컬럼 추론.");
    const { error: ee } = await supabase.from("bookings_new").insert({}).select("id").single();
    console.log("  empty insert error:", ee?.message);
  }

  // ─── STEP 2: 마이그레이션 row 롤백 (bookings 테이블) ───
  console.log("\n━━━ STEP 2: 마이그레이션 36건 롤백 ━━━");
  const { data: rows, error: selErr } = await supabase
    .from("bookings")
    .select("id, booker_name, created_at")
    .in("booker_name", MIGRATION_NAMES)
    .order("created_at", { ascending: false });
  if (selErr) {
    console.error("❌ select 실패:", selErr.message);
    process.exit(1);
  }
  const candidates = (rows ?? []).filter((r: any) => MIGRATION_NAMES.includes(r.booker_name));
  console.log(`booker_name 화이트리스트 매칭: ${candidates.length}건`);
  if (candidates.length > 0) {
    console.log("샘플 (3건):");
    candidates.slice(0, 3).forEach((r: any) => {
      console.log(`  ${r.id} | ${r.booker_name} | ${r.created_at}`);
    });
    const ids = candidates.map((r: any) => r.id);
    const { error: delErr, count } = await supabase
      .from("bookings")
      .delete({ count: "exact" })
      .in("id", ids);
    if (delErr) {
      console.error("❌ 삭제 실패:", delErr.message);
    } else {
      console.log(`✅ ${count ?? candidates.length}건 삭제 완료`);
    }
  } else {
    console.log("(삭제 대상 없음)");
  }
}

main().catch((e) => {
  console.error("💥 unhandled:", e);
  process.exit(1);
});
