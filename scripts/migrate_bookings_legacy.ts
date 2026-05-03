/**
 * migrate_bookings_legacy.ts — 옛 bookings 테이블 → bookings_new 마이그레이션
 *
 * 흐름:
 *   1) bookings_new 컬럼 목록 + 옛 bookings 9건 SELECT
 *   2) 이미 동일 id가 bookings_new에 있으면 skip
 *   3) 각 row 변환 후 INSERT
 *   4) 성공/실패 카운트 + 실패 목록 출력
 *
 * 실행: npx tsx scripts/migrate_bookings_legacy.ts
 *  (또는: npx ts-node scripts/migrate_bookings_legacy.ts — ts-node 미설치 가능)
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
const SERV = le("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(URL_, SERV, { auth: { persistSession: false } });

// accom_type(한국어) → booking_type(영문) 매핑
const TYPE_MAP: Record<string, string> = {
  "드림하우스": "dreamhouse",
  "드림하우스+제이파크": "dreamhouse_jaypark",
  "드림하우스+큐브나인": "dreamhouse_cubenine",
  "제이파크 단독": "jaypark",
  "큐브나인 단독": "cubenine",
  "통학형": "commute",
};
function mapBookingType(raw: unknown): string {
  if (!raw) return "dreamhouse";
  const s = String(raw).trim();
  if (TYPE_MAP[s]) return TYPE_MAP[s];
  // 부분 매칭 fallback
  if (s.includes("드림하우스") && s.includes("제이파크")) return "dreamhouse_jaypark";
  if (s.includes("드림하우스") && s.includes("큐브")) return "dreamhouse_cubenine";
  if (s.includes("제이파크")) return "jaypark";
  if (s.includes("큐브")) return "cubenine";
  if (s.includes("통학")) return "commute";
  if (s.includes("드림")) return "dreamhouse";
  return "dreamhouse";
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Math.trunc(v);
  const s = String(v).replace(/[^\d.-]/g, "");
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
function emptyToNull<T>(v: T | "" | null | undefined): T | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  return v as T;
}

(async () => {
  // ─── 1) 옛 bookings 전체 조회 ───
  console.log("━━━ 옛 bookings 조회 ━━━");
  const { data: oldRows, error: oldErr } = await sb.from("bookings").select("*");
  if (oldErr) {
    console.error("❌ bookings select 실패:", oldErr.message);
    process.exit(1);
  }
  console.log(`bookings 총 ${oldRows?.length ?? 0}건`);
  if (!oldRows || oldRows.length === 0) {
    console.log("(처리할 row 없음)");
    return;
  }
  console.log("샘플 keys:", Object.keys(oldRows[0]).sort().join(", "));
  console.log("");

  // ─── 2) bookings_new에 이미 존재하는 id 조회 ───
  const ids = oldRows.map((r: any) => r.id);
  const { data: existing, error: exErr } = await sb
    .from("bookings_new")
    .select("id")
    .in("id", ids);
  if (exErr) {
    console.error("❌ bookings_new 중복 조회 실패:", exErr.message);
    process.exit(1);
  }
  const existingIds = new Set((existing ?? []).map((r: any) => r.id));
  console.log(`이미 bookings_new에 존재: ${existingIds.size}건 (skip)`);
  console.log("");

  // ─── 3) 변환 + INSERT ───
  let ok = 0, skip = 0, fail = 0;
  const failures: { id: string; name: string; reason: string }[] = [];

  for (const r of oldRows) {
    const old = r as Record<string, any>;
    const label = `${old.id?.slice(0, 8)}... ${old.booker_name ?? "(no name)"}`;

    if (existingIds.has(old.id)) {
      console.log(`⏭️  ${label} — 이미 존재, skip`);
      skip++;
      continue;
    }

    const payload: Record<string, unknown> = {
      id: old.id,
      booker_name: emptyToNull(old.booker_name),
      status: emptyToNull(old.status),
      check_in: emptyToNull(old.reservation_date),
      balance_due: emptyToNull(old.balance_date),
      booking_type: mapBookingType(old.accom_type),
      flight_in_airline: emptyToNull(old.flight_in),     // 텍스트 컬럼 (date 타입 충돌 방지)
      flight_out_airline: emptyToNull(old.flight_out),
      pickup_place: emptyToNull(old.pickup_place),
      drop_place: emptyToNull(old.drop_place ?? old.drop_off),
      special_request: emptyToNull(old.special_request),
      total_amount: toIntOrNull(old.total_amount ?? old.base_price ?? old.final_price),
      paid_amount: toIntOrNull(old.paid_amount),
      num_adults: old.num_adults ?? old.adults ?? 1,
      num_children: old.num_children ?? old.children ?? 0,
      created_at: old.created_at ?? null,
    };

    const { error: insErr } = await sb.from("bookings_new").insert(payload);
    if (insErr) {
      console.error(`❌ ${label} — ${insErr.message}`);
      fail++;
      failures.push({ id: old.id, name: old.booker_name ?? "", reason: insErr.message });
      continue;
    }
    console.log(`✅ ${label} — booking_type=${payload.booking_type} status=${payload.status}`);
    ok++;
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`성공: ${ok}건  /  skip: ${skip}건  /  실패: ${fail}건`);
  if (failures.length > 0) {
    console.log("\n실패 목록:");
    failures.forEach((f) => console.log(`  ${f.id} ${f.name} — ${f.reason}`));
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━");
})().catch((e) => { console.error("💥", e); process.exit(1); });
