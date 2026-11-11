import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendTelegram, escapeHtml } from "@/lib/telegram";
import { requireApplication } from '@/lib/portalAuth';
import { fieldtripClosed, legacyProgramDate, isFieldtripToken, FIELDTRIP_DEADLINE_MESSAGE } from '@/lib/fieldtripDeadline';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_TABLES = ["shuttle_applications", "fieldtrip_applications", "tutor_requests"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { table, id, reason, token } = body || {};
    if (!table || !ALLOWED_TABLES.includes(table as AllowedTable)) {
      return NextResponse.json({ error: "invalid table" }, { status: 400 });
    }
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const denied = await requireApplication(req, table, id);
    if (denied) return denied;

    let update: Record<string, unknown> = { status: "cancel_requested" };
    if (table === 'fieldtrip_applications') {
      const { data: application, error } = await supabase.from(table).select('date,created_at').eq('id', id).maybeSingle();
      if (error) return NextResponse.json({ error: '신청 내역을 확인하지 못했습니다.' }, { status: 500 });
      if (!application) return NextResponse.json({ error: '신청 내역이 없습니다.' }, { status: 404 });
      const tokens = String(application.date || '').split(',').map(t => t.trim()).filter(Boolean);
      if (token && !tokens.includes(String(token))) return NextResponse.json({ error: '신청한 프로그램이 아닙니다.' }, { status: 400 });
      const targets = token ? [String(token)] : tokens;
      if (!targets.length) return NextResponse.json({ error: '신청 날짜를 확인해 주세요.' }, { status: 400 });
      for (const target of targets) {
        const date = legacyProgramDate(target, application.created_at);
        if (!date) return NextResponse.json({ error: '행사 날짜를 확인할 수 없습니다. 직원에게 문의해 주세요.' }, { status: 400 });
        // Deployed type wins over the legacy program key.
        const { data: schedule, error: scheduleError } = await supabase.from('schedule_items').select('type').eq('date', date).eq('is_deployed', true).in('type', ['fieldtrip','afterschool']);
        if (scheduleError) return NextResponse.json({ error: '행사 일정을 확인하지 못했습니다.' }, { status: 500 });
        const isFieldtrip = isFieldtripToken(target) || schedule?.some(s => s.type === 'fieldtrip');
        if (isFieldtrip && fieldtripClosed(date)) return NextResponse.json({ error: FIELDTRIP_DEADLINE_MESSAGE }, { status: 403 });
      }
    }
    if (table === "fieldtrip_applications" && token) {
      // 날짜(프로그램) 단위 취소요청 — 전체 status는 건드리지 않음
      const { data: row0 } = await supabase.from(table).select("cancel_requested_dates").eq("id", id).maybeSingle();
      const cur = String(row0?.cancel_requested_dates || "").split(",").map((t: string) => t.trim()).filter(Boolean);
      if (!cur.includes(String(token))) cur.push(String(token));
      update = { cancel_requested_dates: cur.join(", ") };
    }
    if (reason && String(reason).trim()) update.cancel_reason = String(reason).trim();

    const { error } = await supabase.from(table).update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 직원업무 체크리스트용 취소 활동 로그 (셔틀/필드트립/튜터 전체, best-effort)
    try {
      const typeMap: Record<string, string> = { shuttle_applications: "shuttle", fieldtrip_applications: "fieldtrip", tutor_requests: "tutor" };
      const { data: cr } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
      const row = (cr || {}) as Record<string, unknown>;
      const who = String(row.portal_name || row.room_number || row.name || row.student_name_kr || "");
      const ttl = String(row.tour_name || row.name || row.student_name_kr || "취소 요청");
      await supabase.from("customer_activity").insert({
        type: typeMap[table] || "etc", action: "취소",
        title: ttl, reserver: who,
        booking_id: (row.booking_id as string) || null, ref_table: table, ref_id: String(id),
      });
    } catch { /* noop */ }

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
