import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * DELETE /api/bookings/[id]/delete
 * 예약 삭제 시 하위 데이터 전부 cascade 정리
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 하위 테이블 삭제 (순서 중요: FK 의존 → 먼저)
  const childTables = [
    "tutor_lesson_sessions", // tutor_lessons FK → 먼저 삭제
  ];
  for (const t of childTables) {
    // tutor_lesson_sessions는 lesson_id FK라 직접 booking_id가 없음
    // tutor_lessons에서 lesson_id 수집 후 삭제
    if (t === "tutor_lesson_sessions") {
      const { data: lessons } = await sb
        .from("tutor_lessons")
        .select("id")
        .eq("application_id", id); // application_id는 아님, 아래에서 별도 처리
      // tutor_requests → tutor_lessons → tutor_lesson_sessions 경로
      const { data: reqs } = await sb
        .from("tutor_requests")
        .select("id")
        .eq("booking_id", id);
      if (reqs && reqs.length > 0) {
        const reqIds = reqs.map((r) => r.id);
        const { data: tLessons } = await sb
          .from("tutor_lessons")
          .select("id")
          .in("application_id", reqIds);
        if (tLessons && tLessons.length > 0) {
          const lessonIds = tLessons.map((l) => l.id);
          await sb
            .from("tutor_lesson_sessions")
            .delete()
            .in("lesson_id", lessonIds);
          await sb.from("tutor_lessons").delete().in("id", lessonIds);
        }
      }
    }
  }

  // 직접 booking_id FK가 있는 하위 테이블들
  const directChildTables = [
    "students",
    "pickup_requests",
    "shuttle_applications",
    "tutor_requests",
    "checkin_details",
    "booking_comments",
    "booking_consents",
    "fieldtrip_applications",
    "settlement_items",
  ];

  const results: Record<string, string> = {};
  for (const table of directChildTables) {
    const { error, count } = await sb
      .from(table)
      .delete()
      .eq("booking_id", id);
    results[table] = error ? `error: ${error.message}` : `deleted`;
  }

  // 메인 예약 삭제 (bookings 테이블)
  const { error: delErr } = await sb
    .from("bookings")
    .delete()
    .eq("id", id);

  if (delErr) {
    return NextResponse.json(
      { error: delErr.message, childResults: results },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, childResults: results });
}
