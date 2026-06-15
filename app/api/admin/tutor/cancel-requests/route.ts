import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendTelegram, sendTelegramTeachers, escapeHtml } from "@/lib/telegram";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — 취소 요청 목록 (어드민)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // pending / approved / rejected / all

  let q = sb.from("tutor_cancel_requests").select("*").order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// PATCH — 승인/거절
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { id, status, resolution, admin_note, processed_by } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "id, status 필수" }, { status: 400 });
  }
  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "status는 approved 또는 rejected" }, { status: 400 });
  }

  // 요청 조회
  const { data: cr, error: crErr } = await sb.from("tutor_cancel_requests")
    .select("*").eq("id", id).single();
  if (crErr || !cr) return NextResponse.json({ error: "요청을 찾을 수 없습니다" }, { status: 404 });

  // 업데이트
  const { error: upErr } = await sb.from("tutor_cancel_requests").update({
    status,
    resolution: status === "approved" ? (resolution || "deduct") : null,
    admin_note: admin_note || null,
    processed_by: processed_by || null,
    processed_at: new Date().toISOString(),
  }).eq("id", id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // 승인 시 → 세션 상태 변경 + 출석부 반영
  if (status === "approved" && cr.lesson_id && cr.cancel_date) {
    // tutor_lesson_sessions 업데이트
    await sb.from("tutor_lesson_sessions")
      .update({ status: "cancelled_by_student" })
      .eq("lesson_id", cr.lesson_id)
      .eq("session_date", cr.cancel_date);

    // tutor_lessons.attendance_log에 ✕ 마크
    const { data: lesson } = await sb.from("tutor_lessons")
      .select("attendance_log, total_sessions").eq("id", cr.lesson_id).single();
    if (lesson) {
      const log = (lesson.attendance_log || {}) as Record<string, string>;
      log[cr.cancel_date] = "✕";
      const updates: Record<string, unknown> = { attendance_log: log };
      // 차감이면 total_sessions -1 / no_deduct는 차감 없이 취소 (아픈 경우 등)
      if (resolution === "deduct" && lesson.total_sessions > 0) {
        updates.total_sessions = lesson.total_sessions - 1;
      }
      // no_deduct: 출석부 ✕ 기록만, total_sessions 유지
      await sb.from("tutor_lessons").update(updates).eq("id", cr.lesson_id);
    }

    // 교사 알림 (online_notifications 패턴 재사용)
    if (cr.tutor_id) {
      const msg = `Lesson cancelled — ${cr.student_name || "Student"} on ${cr.cancel_date}` +
        (resolution === "deduct" ? " (session deducted)" : resolution === "makeup" ? " (makeup scheduled)" : resolution === "no_deduct" ? " (no deduction)" : "");
      await sb.from("online_notifications").insert({
        tutor_id: cr.tutor_id,
        type: "lesson_cancelled",
        message: msg,
      });

      // 텔레그램 교사 그룹
      try {
        await sendTelegramTeachers(
          `🚫 <b>Tutor Lesson Cancelled</b>\n` +
          `Student: ${escapeHtml(cr.student_name || "?")}\n` +
          `Date: ${cr.cancel_date}\n` +
          `Reason: ${escapeHtml(cr.reason || "N/A")}\n` +
          (resolution === "deduct" ? "📉 Session deducted" : resolution === "makeup" ? "🔄 Makeup to be scheduled" : resolution === "no_deduct" ? "💚 No deduction (special case)" : "")
        );
      } catch { /* best-effort */ }
    }

    // 한국인 직원 텔레그램
    try {
      const resText = resolution === "deduct" ? "차감" : resolution === "makeup" ? "보강" : resolution === "no_deduct" ? "미차감" : "미정";
      await sendTelegram(
        `✅ <b>튜터 취소 승인</b>\n` +
        `학생: ${cr.student_name || "?"}\n` +
        `취소일: ${cr.cancel_date}\n` +
        `처리: ${resText}\n` +
        `처리자: ${processed_by || "?"}`
      );
    } catch { /* best-effort */ }
  }

  return NextResponse.json({ ok: true, status });
}
