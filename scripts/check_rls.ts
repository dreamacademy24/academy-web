/**
 * 1) service_role 키로 bookings_new 5건 읽기 — 데이터 실제 존재 확인
 * 2) anon 키로 bookings_new 읽기 — RLS 정책 확인
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

const URL_ = le("NEXT_PUBLIC_SUPABASE_URL")!;
const ANON = le("NEXT_PUBLIC_SUPABASE_ANON_KEY")!;
const SERV = le("SUPABASE_SERVICE_ROLE_KEY")!;

(async () => {
  console.log("━━━ 1) service_role 으로 bookings_new 5건 ━━━");
  const sbS = createClient(URL_, SERV, { auth: { persistSession: false } });
  const r1 = await sbS.from("bookings_new").select("id, booker_name, booking_type, status, payment_status").limit(5);
  if (r1.error) console.error("❌", r1.error.message);
  else console.log(JSON.stringify(r1.data, null, 2));

  console.log("\n━━━ 2) anon 으로 bookings_new 3건 (RLS 확인) ━━━");
  const sbA = createClient(URL_, ANON, { auth: { persistSession: false } });
  const r2 = await sbA.from("bookings_new").select("id, booker_name").limit(3);
  console.log(`error: ${r2.error?.message ?? "(none)"}`);
  console.log(`rows: ${r2.data?.length ?? 0}`);
  if (r2.data && r2.data.length > 0) console.log(JSON.stringify(r2.data, null, 2));

  // RLS가 막아도 그냥 빈 배열이 나옴 — 추가 진단: insert 시도해서 정책 동작 확인
  if (r2.data?.length === 0 && !r2.error) {
    console.log("\n  → 행 0건 + 에러 없음 = RLS가 SELECT 막거나, 실제로 anon이 볼 수 있는 row 0건");
    console.log("  → service_role count와 비교 필요");
  }

  // count 비교 — bookings_new + students + bookings(옛)
  for (const table of ["bookings_new", "students", "bookings"]) {
    const { count: scnt } = await sbS.from(table).select("*", { count: "exact", head: true });
    const { count: acnt } = await sbA.from(table).select("*", { count: "exact", head: true });
    const flag = scnt === acnt ? "✅" : "⚠️";
    console.log(`  ${flag} ${table}: service=${scnt ?? "?"}  anon=${acnt ?? "?"}`);
  }
})().catch((e) => { console.error("💥", e); process.exit(1); });
