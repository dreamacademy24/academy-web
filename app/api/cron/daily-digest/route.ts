import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendTelegram, escapeHtml } from "@/lib/telegram";

// Vercel Cron: 매일 UTC 0시 = 필리핀 8AM 발송
// vercel.json → "0 0 * * *"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function localDate(): string {
  const d = new Date();
  // 필리핀 시간 기준 YYYY-MM-DD
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Manila" });
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00+08:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  // Vercel Cron 인증 (CRON_SECRET 설정 시 검증)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = localDate();
  const lines: string[] = [];
  lines.push(`📋 <b>드림아카데미 데일리 리포트</b>`);
  lines.push(`📅 ${today} (필리핀 시간)`);
  lines.push("");

  // ── 1. 오늘/내일/모레 체크인 예정 ──
  const d1 = addDays(today, 1);
  const d2 = addDays(today, 2);
  const { data: upcoming } = await supabase
    .from("bookings")
    .select("booker_name, check_in, reservation_no, house_no")
    .in("check_in", [today, d1, d2])
    .not("status", "eq", "취소")
    .not("status", "eq", "완료")
    .order("check_in");

  if (upcoming && upcoming.length > 0) {
    lines.push(`🏠 <b>체크인 예정 (3일 이내)</b>`);
    for (const b of upcoming) {
      const dday = b.check_in === today ? "오늘" : b.check_in === d1 ? "내일" : "모레";
      lines.push(
        `  • [${dday}] ${escapeHtml(b.booker_name || "미입력")} (${b.reservation_no || "-"}) ${b.house_no || ""}`
      );
    }
    lines.push("");
  }

  // ── 2. 항공편 미등록 (체크인 7일 이내) ──
  const d7 = addDays(today, 7);
  const { data: noFlight } = await supabase
    .from("bookings")
    .select("booker_name, check_in, reservation_no")
    .gte("check_in", today)
    .lte("check_in", d7)
    .or("flight_in.is.null,flight_in.eq.,flight_in_date.is.null")
    .not("status", "eq", "취소")
    .not("status", "eq", "완료");

  if (noFlight && noFlight.length > 0) {
    lines.push(`✈️ <b>항공편 미등록 (7일 이내 체크인)</b>`);
    for (const b of noFlight) {
      lines.push(`  • ${escapeHtml(b.booker_name || "미입력")} - 체크인 ${b.check_in}`);
    }
    lines.push("");
  }

  // ── 3. 미배정 픽업 ──
  const { data: unassignedPickup } = await supabase
    .from("pickup_requests")
    .select("id, booker_name, request_date, request_type")
    .is("driver_id", null)
    .gte("request_date", today)
    .lte("request_date", d7)
    .order("request_date");

  if (unassignedPickup && unassignedPickup.length > 0) {
    lines.push(`🚗 <b>기사 미배정 픽드랍 (${unassignedPickup.length}건)</b>`);
    for (const p of unassignedPickup.slice(0, 5)) {
      const type = p.request_type === "pickup" ? "픽업" : p.request_type === "dropoff" ? "드랍" : p.request_type === "transfer" ? "환승" : p.request_type;
      lines.push(`  • [${type}] ${escapeHtml(p.booker_name || "미입력")} - ${p.request_date}`);
    }
    if (unassignedPickup.length > 5) lines.push(`  ... 외 ${unassignedPickup.length - 5}건`);
    lines.push("");
  }

  // ── 4. 대기 중인 튜터 신청 ──
  const { data: pendingTutor } = await supabase
    .from("tutor_requests")
    .select("id, children_names, reserver_name, status")
    .in("status", ["pending", "검토중"]);

  if (pendingTutor && pendingTutor.length > 0) {
    lines.push(`📚 <b>튜터 신청 대기 (${pendingTutor.length}건)</b>`);
    for (const t of pendingTutor.slice(0, 5)) {
      lines.push(`  • ${escapeHtml(t.reserver_name || t.children_names || "미입력")}`);
    }
    if (pendingTutor.length > 5) lines.push(`  ... 외 ${pendingTutor.length - 5}건`);
    lines.push("");
  }

  // ── 5. 잔금 마감 임박 (7일 이내) ──
  const { data: balanceDue } = await supabase
    .from("bookings")
    .select("booker_name, balance_due, reservation_no, total_amount, paid_amount")
    .gte("balance_due", today)
    .lte("balance_due", d7)
    .not("payment_status", "eq", "paid")
    .not("status", "eq", "취소")
    .not("status", "eq", "완료");

  if (balanceDue && balanceDue.length > 0) {
    lines.push(`💰 <b>잔금 마감 임박 (7일 이내, ${balanceDue.length}건)</b>`);
    for (const b of balanceDue) {
      const remaining = (Number(b.total_amount) || 0) - (Number(b.paid_amount) || 0);
      lines.push(
        `  • ${escapeHtml(b.booker_name || "미입력")} - ${b.balance_due}까지 (${remaining > 0 ? remaining.toLocaleString() + "원" : "확인필요"})`
      );
    }
    lines.push("");
  }

  // ── 6. 미확인 셔틀 신청 ──
  const { data: pendingShuttle } = await supabase
    .from("shuttle_applications")
    .select("id")
    .eq("status", "pending");

  if (pendingShuttle && pendingShuttle.length > 0) {
    lines.push(`🚌 <b>셔틀 신청 대기: ${pendingShuttle.length}건</b>`);
    lines.push("");
  }

  // 아무 알림 없으면 스킵
  if (lines.length <= 3) {
    return NextResponse.json({ ok: true, sent: false, reason: "no items" });
  }

  lines.push("—");
  lines.push("🔗 <a href=\"https://dreamacademyph.com/admin/hub\">관리자 허브 열기</a>");

  await sendTelegram(lines.join("\n"));

  return NextResponse.json({ ok: true, sent: true, items: lines.length });
}
