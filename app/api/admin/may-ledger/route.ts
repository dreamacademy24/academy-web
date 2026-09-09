import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 오너 전용 암호. Vercel/.env.local 에 MAY_LEDGER_PASSCODE 설정.
function checkPass(req: Request): { ok: true } | { ok: false; res: NextResponse } {
  const expected = process.env.MAY_LEDGER_PASSCODE;
  if (!expected) {
    return { ok: false, res: NextResponse.json(
      { error: "NO_PASSCODE_ENV", message: "서버에 MAY_LEDGER_PASSCODE 환경변수가 설정되지 않았어요." },
      { status: 503 }) };
  }
  const given = req.headers.get("x-ledger-pass") || "";
  if (given !== expected) return { ok: false, res: NextResponse.json({ error: "BAD_PASS" }, { status: 401 }) };
  return { ok: true };
}

async function getConfig() {
  const { data } = await sb.from("may_ledger_config").select("*").eq("id", "settings").maybeSingle();
  return {
    krwPerPhp: data?.krw_per_php != null ? Number(data.krw_per_php) : 23,
    usdPerPhp: data?.usd_per_php != null ? Number(data.usd_per_php) : 58,
  };
}

// GET — 전체 항목 + 설정
export async function GET(req: Request) {
  const c = checkPass(req); if (!c.ok) return c.res;
  const { data, error } = await sb
    .from("may_ledger").select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [], config: await getConfig() });
}

// POST — 항목 추가, 또는 {kind:'config'} 로 환율 저장
export async function POST(req: Request) {
  const c = checkPass(req); if (!c.ok) return c.res;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "BAD_JSON" }, { status: 400 }); }

  if (b.kind === "config") {
    const patch: Record<string, number> = {};
    if (b.krwPerPhp != null) patch.krw_per_php = Number(b.krwPerPhp);
    if (b.usdPerPhp != null) patch.usd_per_php = Number(b.usdPerPhp);
    const { error } = await sb.from("may_ledger_config")
      .upsert({ id: "settings", ...patch, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const amount = Number(b.amount);
  if (!isFinite(amount) || amount <= 0) return NextResponse.json({ error: "금액을 확인해주세요" }, { status: 400 });
  const id = (typeof b.id === "string" && b.id) ? b.id
    : "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const row = {
    id,
    entry_date: (b.entry_date as string) || new Date().toISOString().slice(0, 10),
    book: (b.book as string) === "집" ? "집" : "회사",
    type: (b.type as string) === "income" ? "income" : "expense",
    division: (b.division as string) || "",
    detail: (b.detail as string) || "",
    memo: (b.memo as string) || "",
    amount: Math.abs(amount),
    currency: (b.currency as string) === "KRW" ? "KRW" : "PHP",
    source: "manual",
  };
  const { data, error } = await sb.from("may_ledger").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

// PATCH — {id, patch:{...}}
export async function PATCH(req: Request) {
  const c = checkPass(req); if (!c.ok) return c.res;
  const b = await req.json().catch(() => null) as { id?: string; patch?: Record<string, unknown> } | null;
  if (!b?.id || !b.patch) return NextResponse.json({ error: "id/patch 필요" }, { status: 400 });
  const allowed: Record<string, unknown> = {};
  for (const k of ["entry_date", "book", "type", "division", "detail", "memo", "amount", "currency"]) {
    if (k in b.patch) allowed[k] = b.patch[k];
  }
  const { error } = await sb.from("may_ledger").update(allowed).eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — ?id=
export async function DELETE(req: Request) {
  const c = checkPass(req); if (!c.ok) return c.res;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const { error } = await sb.from("may_ledger").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
