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

  // 승인 시 → 세션 상태 변경 + 취소 기록(인보이스/티쳐 화면 연동)
  if (status === "approved" && cr.lesson_id && cr.cancel_date) {
    // 처리방법(없으면 deduct 기본 — DB에도 동일하게 저장됨)
    const res = (resolution || "deduct") as "deduct" | "makeup" | "no_deduct";
    const isCancelType = !cr.req_type || cr.req_type === "cancel"; // 시간/날짜 변경 요청은 세션 취소하지 않음

    if (isCancelType) {
    // tutor_lesson_sessions 업데이트
    await sb.from("tutor_lesson_sessions")
      .update({ status: "cancelled_by_student" })
      .eq("lesson_id", cr.lesson_id)
      .eq("session_date", cr.cancel_date);

    // tutor_lessons에 취소 기록 (cancellations = {날짜: 처리방법}) — 단일 소스
    const { data: lesson } = await sb.from("tutor_lessons")
      .select("cancellations, skip_dates, total_sessions").eq("id", cr.lesson_id).single();
    if (lesson) {
      const cancellations = { ...((lesson.cancellations || {}) as Record<string, string>) };
      cancellations[cr.cancel_date] = res;
      const updates: Record<string, unknown> = { cancellations };
      // 차감: 회차 -1 + skip_dates에도 추가(하위호환 청구 제외) / 보강·미차감: 그대로 청구
      if (res === "deduct") {
        const skips: string[] = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
        if (!skips.includes(cr.cancel_date)) updates.skip_dates = [...skips, cr.cancel_date];
        if ((lesson.total_sessions || 0) > 0) updates.total_sessions = lesson.total_sessions - 1;
      }
      const { error: upLessonErr } = await sb.from("tutor_lessons").update(updates).eq("id", cr.lesson_id);
      // cancellations 컬럼 미존재 등으로 실패 시 → 차감 케이스만이라도 skip_dates/회차 반영(폴백)
      if (upLessonErr && res === "deduct") {
        const skips: string[] = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
        const fb: Record<string, unknown> = {};
        if (!skips.includes(cr.cancel_date)) fb.skip_dates = [...skips, cr.cancel_date];
        if ((lesson.total_sessions || 0) > 0) fb.total_sessions = lesson.total_sessions - 1;
        if (Object.keys(fb).length) await sb.from("tutor_lessons").update(fb).eq("id", cr.lesson_id);
      }
    }
    }

    // 교사 알림 (online_notifications 패턴 재사용)
    if (cr.tutor_id) {
      const msg = `Lesson cancelled — ${cr.student_name || "Student"} on ${cr.cancel_date}` +
        (res === "deduct" ? " (session deducted)" : res === "makeup" ? " (makeup scheduled)" : " (no deduction)");
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
          (res === "deduct" ? "📉 Session deducted" : res === "makeup" ? "🔄 Makeup to be scheduled" : "💚 No deduction (special case)")
        );
      } catch { /* best-effort */ }
    }

    // 한국인 직원 텔레그램
    try {
      const resText = res === "deduct" ? "차감" : res === "makeup" ? "보강" : "미차감";
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
