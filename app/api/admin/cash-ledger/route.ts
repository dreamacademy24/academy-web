import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 마지막 일마감 날짜 (그 이전 날짜는 잠김)
async function lastClosedDate(): Promise<string | null> {
  const { data } = await sb.from("cash_daily_closings").select("close_date").order("close_date", { ascending: false }).limit(1);
  return data && data[0] ? data[0].close_date : null;
}

// GET — 월별 목록 + 합계
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") || new Date().getFullYear().toString();
  const month = searchParams.get("month") || String(new Date().getMonth() + 1).padStart(2, "0");
  const from = `${year}-${month.padStart(2, "0")}-01`;
  const toD = new Date(Number(year), Number(month), 0); // last day of month
  const to = `${year}-${month.padStart(2, "0")}-${String(toD.getDate()).padStart(2, "0")}`;

  const { data, error } = await sb
    .from("cash_ledger")
    .select("*")
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = data || [];
  const totalIn = items.filter(i => i.type === "in").reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalOut = items.filter(i => i.type === "out").reduce((s, i) => s + Number(i.amount || 0), 0);

  return NextResponse.json({ items, totalIn, totalOut, balance: totalIn - totalOut });
}

// POST — 항목 추가
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { entry_date, type, category, description, amount, guest_name, booking_id, receipt_files, recorded_by, ref_id, house_no } = body;

    if (!type || !amount) return NextResponse.json({ error: "유형과 금액은 필수입니다" }, { status: 400 });

    const ed = entry_date || new Date().toISOString().slice(0, 10);
    const locked = await lastClosedDate();
    if (locked && ed <= locked) return NextResponse.json({ error: `${locked}까지 일마감되어 잠겨 있어요. 관리자가 마감 해제 후 기록할 수 있어요.` }, { status: 409 });

    const { data, error } = await sb
      .from("cash_ledger")
      .insert({
        entry_date: entry_date || new Date().toISOString().slice(0, 10),
        type,
        category: category || "기타",
        description: description || null,
        amount: Math.abs(Number(amount)),
        guest_name: guest_name || null,
        booking_id: booking_id || null,
        receipt_files: receipt_files || [],
        recorded_by: recorded_by || null,
        ref_id: ref_id || null,
        house_no: house_no || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PATCH — 반환 기록을 특정 보증금과 연결 (ref_id 지정)
export async function PATCH(req: Request) {
  try {
    const { id, ref_id } = await req.json();
    if (!id) return NextResponse.json({ error: "id는 필수입니다" }, { status: 400 });
    const { error } = await sb.from("cash_ledger").update({ ref_id: ref_id || null }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}

// DELETE — 항목 삭제 (마감된 날짜는 잠김)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필수" }, { status: 400 });

  const { data: row } = await sb.from("cash_ledger").select("entry_date").eq("id", id).maybeSingle();
  const locked = await lastClosedDate();
  if (row && locked && row.entry_date <= locked) {
    return NextResponse.json({ error: `${locked}까지 일마감되어 잠겨 있어요. 관리자가 마감 해제 후 삭제할 수 있어요.` }, { status: 409 });
  }

  const { error } = await sb.from("cash_ledger").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
