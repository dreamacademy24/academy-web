import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendTelegram } from "@/lib/telegram";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — 내 취소 요청 목록
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lessonId = searchParams.get("lesson_id");
  const bookingId = searchParams.get("booking_id");

  let q = sb.from("tutor_cancel_requests").select("*").order("created_at", { ascending: false });
  if (lessonId) q = q.eq("lesson_id", lessonId);
  if (bookingId) q = q.eq("booking_id", bookingId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST — 하루 취소 신청
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { lesson_id, cancel_date, reason, booking_id, requested_by, student_name, application_id, tutor_id, req_type } = body;
  const reqType = (req_type as string) || "cancel"; // cancel | time_change | date_change

  if (!lesson_id || !cancel_date) {
    return NextResponse.json({ error: "lesson_id, cancel_date 필수" }, { status: 400 });
  }

  // 중복 체크
  const { data: dup } = await sb.from("tutor_cancel_requests")
    .select("id").eq("lesson_id", lesson_id).eq("cancel_date", cancel_date)
    .in("status", ["pending", "approved"]).limit(1);
  if (dup && dup.length > 0) {
    return NextResponse.json({ error: "이미 해당 날짜에 취소 요청이 있습니다." }, { status: 409 });
  }

  // 4일 이내 판별 (환불 불가)
  const cancelD = new Date(cancel_date + "T00:00:00+08:00"); // PHT
  const now = new Date();
  const diffMs = cancelD.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const isRefundable = diffDays >= 4;

  const { data, error } = await sb.from("tutor_cancel_requests").insert({
    lesson_id,
    application_id: application_id || null,
    booking_id: booking_id || null,
    cancel_date,
    reason: reason || null,
    is_refundable: isRefundable,
    requested_by: requested_by || null,
    student_name: student_name || null,
    tutor_id: tutor_id || null,
    req_type: reqType,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 텔레그램 알림 (한국인 직원 그룹)
  try {
    const typeLabel = reqType === "time_change" ? "시간 변경 요청" : reqType === "date_change" ? "날짜 변경 요청" : "수업 취소 요청";
    const refundText = reqType === "cancel" ? (isRefundable ? "\n환불 가능" : "\n⚠️ 4일 이내 — 환불 불가") : "";
    await sendTelegram(
      `📋 <b>튜터 ${typeLabel}</b>\n` +
      `학생: ${student_name || "?"}\n` +
      `날짜: ${cancel_date}\n` +
      `내용: ${reason || "없음"}` +
      `${refundText}\n` +
      `👉 어드민에서 확인해주세요`
    );
  } catch { /* best-effort */ }

  return NextResponse.json(data, { status: 201 });
}
