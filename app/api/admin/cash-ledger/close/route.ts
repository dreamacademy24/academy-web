import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const d10 = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return d10(d); };

// GET — 마감 내역 전체 (작은 테이블)
export async function GET() {
  const { data, error } = await sb.from("cash_daily_closings").select("*").order("close_date", { ascending: false }).limit(400);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ closings: data || [] });
}

// POST — 일마감 (사이 0건 날짜는 자동 마감)
export async function POST(req: Request) {
  try {
    const { close_date, actual_amount, memo, closed_by } = await req.json();
    if (!close_date) return NextResponse.json({ error: "close_date 필수" }, { status: 400 });
    const today = d10(new Date());
    if (close_date > today) return NextResponse.json({ error: "미래 날짜는 마감할 수 없어요" }, { status: 400 });

    const { data: last } = await sb.from("cash_daily_closings").select("close_date").order("close_date", { ascending: false }).limit(1);
    const lastDate = last && last[0] ? last[0].close_date : null;
    if (lastDate && close_date <= lastDate) return NextResponse.json({ error: `이미 ${lastDate}까지 마감되어 있어요` }, { status: 409 });

    // 장부 잔액 = close_date까지 전체 순액
    const { data: all, error: e1 } = await sb.from("cash_ledger").select("entry_date,type,amount").lte("entry_date", close_date);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
    const balAt = (dt: string) => (all || []).filter(i => i.entry_date <= dt).reduce((s, i) => s + (i.type === "in" ? 1 : -1) * Number(i.amount || 0), 0);

    // 마지막 마감 다음날 ~ close_date 전날: 기록이 있으면 순서대로 마감 요구, 없으면 자동 마감
    const rows: Record<string, unknown>[] = [];
    if (lastDate) {
      for (let d = addDays(lastDate, 1); d < close_date; d = addDays(d, 1)) {
        const hasEntries = (all || []).some(i => i.entry_date === d);
        if (hasEntries) return NextResponse.json({ error: `${d}에 기록이 있어요 — 그 날짜를 먼저 마감해주세요` }, { status: 409 });
        rows.push({ close_date: d, ledger_balance: balAt(d), actual_amount: null, diff: null, memo: "기록 없음 · 자동마감", closed_by: closed_by || null });
      }
    }
    const ledger = balAt(close_date);
    const act = actual_amount === null || actual_amount === undefined || actual_amount === "" ? null : Number(actual_amount);
    const diff = act === null ? null : Math.round((act - ledger) * 100) / 100;
    if (diff !== null && diff !== 0 && !String(memo || "").trim()) {
      return NextResponse.json({ error: `차액 ${diff > 0 ? "+" : ""}${diff}가 있어요 — 메모(사유)를 입력해주세요` }, { status: 400 });
    }
    rows.push({ close_date, ledger_balance: ledger, actual_amount: act, diff, memo: memo || null, closed_by: closed_by || null });

    const { error: e2 } = await sb.from("cash_daily_closings").insert(rows);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
    return NextResponse.json({ ok: true, closed: rows.length, ledger_balance: ledger, diff });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}

// DELETE — 마감 해제 (가장 최근 마감만, 연속성 유지)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date 필수" }, { status: 400 });
  const { data: last } = await sb.from("cash_daily_closings").select("close_date").order("close_date", { ascending: false }).limit(1);
  if (!last || !last[0] || last[0].close_date !== date) {
    return NextResponse.json({ error: "가장 최근 마감만 해제할 수 있어요 (순서 유지)" }, { status: 409 });
  }
  const { error } = await sb.from("cash_daily_closings").delete().eq("close_date", date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
