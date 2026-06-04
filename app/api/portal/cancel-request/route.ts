import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendTelegram, escapeHtml } from "@/lib/telegram";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_TABLES = ["shuttle_applications", "fieldtrip_applications", "tutor_requests"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { table, id, reason } = body || {};
    if (!table || !ALLOWED_TABLES.includes(table as AllowedTable)) {
      return NextResponse.json({ error: "invalid table" }, { status: 400 });
    }
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const update: Record<string, unknown> = { status: "cancel_requested" };
    if (reason && String(reason).trim()) update.cancel_reason = String(reason).trim();

    const { error } = await supabase.from(table).update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 셔틀 취소요청 → 텔레그램 알림 (best-effort, 실패해도 무시)
    if (table === "shuttle_applications") {
      try {
        const { data: row } = await supabase
          .from("shuttle_applications")
          .select("room_number, portal_name, name, tour_name, tour_date, depart_time, people_count")
          .eq("id", id)
          .maybeSingle();
        const who = row?.room_number || row?.portal_name || row?.name || "";
        const tourLine = `${row?.tour_name || ""}${row?.tour_date ? ` (${row.tour_date}${row?.depart_time ? ` ${row.depart_time}` : ""})` : ""}`.trim();
        const lines = ["🔕 <b>투어 셔틀 취소요청</b>"];
        if (who) lines.push(`신청 집: ${escapeHtml(who)}`);
        if (tourLine) lines.push(`투어: ${escapeHtml(tourLine)}`);
        if (row?.people_count != null) lines.push(`인원: ${escapeHtml(row.people_count)}명`);
        if (reason && String(reason).trim()) lines.push(`사유: ${escapeHtml(String(reason).trim())}`);
        await sendTelegram(lines.join("\n"));
      } catch (e) {
        console.error("[cancel-request] telegram failed:", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
