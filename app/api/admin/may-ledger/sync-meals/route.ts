import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getStaffIdentity } from "@/lib/portalAuth";

// 게스트(올인원/엄마) 식대를 모리 '발생분(auto_meal)'으로 손익장부에 반영하는 CEO 전용 엔드포인트.
// 계산은 meal-plan 페이지(사이트 인원)에서 그대로 넘어오고, 여기선 그 주 auto_meal을 지우고 재기록(멱등).
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CEO_USERS = ["admin-ceo", "admin-may"];

function addD(s: string, n: number) {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  const staff = await getStaffIdentity(req).catch(() => null);
  if (!staff || !CEO_USERS.includes(staff.username)) {
    return NextResponse.json({ error: "FORBIDDEN", message: "CEO 계정만 사용할 수 있어요." }, { status: 403 });
  }

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "BAD_JSON" }, { status: 400 }); }

  const weekMon = String(b.weekMon || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekMon)) {
    return NextResponse.json({ error: "BAD_weekMon" }, { status: 400 });
  }
  const weekFri = addD(weekMon, 4);
  const amount = Math.round(Number(b.amount) || 0);
  const detail = String(b.detail || `게스트 식대 ${weekMon}~${weekFri}`).slice(0, 200);
  const memo = String(b.memo || "").slice(0, 300);
  const entryDate = /^\d{4}-\d{2}-\d{2}$/.test(String(b.entryDate || ""))
    ? String(b.entryDate).slice(0, 10)
    : weekFri;

  // 그 주(월~금)에 이미 있는 auto_meal(게스트 식대) 삭제 → 재계산 반영 (멱등)
  const { error: delErr } = await sb
    .from("may_ledger")
    .delete()
    .eq("division", "모리")
    .eq("source", "auto_meal")
    .gte("entry_date", weekMon)
    .lte("entry_date", weekFri);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (amount <= 0) {
    return NextResponse.json({ ok: true, deleted: true, inserted: false, weekMon, weekFri });
  }

  const row = {
    id: "auto_meal_" + weekMon,
    entry_date: entryDate,
    book: "회사",
    type: "expense",
    division: "모리",
    detail,
    memo,
    amount,
    currency: "PHP",
    source: "auto_meal",
  };
  const { error: insErr } = await sb.from("may_ledger").insert(row);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: true, inserted: true, amount, weekMon, weekFri, entryDate });
}
