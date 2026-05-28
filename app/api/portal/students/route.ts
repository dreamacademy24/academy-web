import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("booking_id");
  if (!bookingId) return NextResponse.json({ students: [] });

  // 1) students 테이블에서 직접 조회
  const { data: students } = await supabase
    .from("students")
    .select("id, name_kr, name_en, age, level")
    .eq("booking_id", bookingId)
    .order("name_kr");

  if (students && students.length > 0) {
    return NextResponse.json({ students });
  }

  // 2) bookings 테이블 students JSON 폴백
  const { data: booking } = await supabase
    .from("bookings")
    .select("students")
    .eq("id", bookingId)
    .maybeSingle();

  if (booking?.students) {
    try {
      const raw = typeof booking.students === "string"
        ? JSON.parse(booking.students)
        : booking.students;
      const parsed = (Array.isArray(raw) ? raw : []).map((s: any) => ({
        id: null,
        name_kr: s.korName ?? s.name_kr ?? "",
        name_en: s.engName ?? s.name_en ?? null,
        age: s.age ?? null,
        level: s.level ?? "junior",
      })).filter((s: any) => s.name_kr);
      return NextResponse.json({ students: parsed });
    } catch {
      return NextResponse.json({ students: [] });
    }
  }

  return NextResponse.json({ students: [] });
}
