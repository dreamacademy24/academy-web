/**
 * verify-rls.mjs — RLS 적용 확인 스크립트
 *
 * anon key로 접근 시 차단되는지, service role key로는 통과하는지 검증
 * 실행: node scripts/verify-rls.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const envText = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
const get = (k) => envText.match(new RegExp(`${k}=(.+)`))?.[1]?.trim();

const SB_URL = get("NEXT_PUBLIC_SUPABASE_URL");
const ANON_KEY = get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = get("SUPABASE_SERVICE_ROLE_KEY");

const TABLES = [
  "bookings_new", "booking_accommodations", "invoices_new",
  "students", "academy_enrollments", "ssp_records",
  "tutors", "tutor_schedules", "tutor_invoices", "online_class_enrollments",
  "drivers", "vehicles", "pickup_requests", "shuttle_requests", "driver_schedules",
  "checkin_details", "guest_profiles", "tutor_requests",
];

async function checkAccess(table, key, label) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return { status: res.status, ok: res.ok };
}

async function main() {
  console.log("🔍 RLS 검증 시작\n");

  let anonBlocked = 0, anonAllowed = 0;
  let svcOk = 0, svcFail = 0;

  console.log("테이블                        anon    service_role");
  console.log("─".repeat(58));

  for (const t of TABLES) {
    const [anon, svc] = await Promise.all([
      checkAccess(t, ANON_KEY, "anon"),
      checkAccess(t, SERVICE_KEY, "service"),
    ]);

    const anonResult = anon.ok ? "⚠️ 허용" : "🔒 차단";
    const svcResult = svc.ok ? "✅ OK" : "❌ 실패";

    if (anon.ok) anonAllowed++; else anonBlocked++;
    if (svc.ok) svcOk++; else svcFail++;

    console.log(`  ${t.padEnd(30)} ${anonResult.padEnd(10)} ${svcResult}`);
  }

  console.log("─".repeat(58));
  console.log(`\nanon key:     ${anonBlocked}개 차단, ${anonAllowed}개 허용`);
  console.log(`service role: ${svcOk}개 정상, ${svcFail}개 실패`);

  if (anonAllowed > 0) {
    console.log("\n⚠️  anon key로 접근 가능한 테이블이 있습니다. RLS 정책을 확인하세요.");
  } else if (svcFail > 0) {
    console.log("\n❌ service role 접근 실패 테이블이 있습니다. 테이블 존재 여부를 확인하세요.");
  } else {
    console.log("\n✅ RLS 정상 — anon 전체 차단, service role 전체 접근");
  }
}

main().catch(console.error);
