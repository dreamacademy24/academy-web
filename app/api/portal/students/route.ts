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
    let bkName = "", bkEn = "";
    const { data: bk1 } = await supabase
      .from("bookings").select("booker_name, booker_english").eq("id", bookingId).maybeSingle();
    if (bk1?.booker_name) {
      bkName = bk1.booker_name; bkEn = bk1.booker_english || "";
    } else {
      const { data: bk2 } = await supabase
        .from("bookings_new").select("booker_name, booker_english").eq("id", bookingId).maybeSingle();
      bkName = bk2?.booker_name || ""; bkEn = bk2?.booker_english || "";
    }
    return NextResponse.json({
      students,
      booker: { name_kr: bkName, name_en: bkEn, age: "" }
    });
  }

  // 2) bookings 테이블 students JSON 폴백
  let booking: any = null;
  const { data: b1 } = await supabase
    .from("bookings").select("students, booker_name, booker_english").eq("id", bookingId).maybeSingle();
  if (b1) { booking = b1; } else {
    const { data: b2 } = await supabase
      .from("bookings_new").select("students, booker_name, booker_english").eq("id", bookingId).maybeSingle();
    booking = b2;
  }

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
      return NextResponse.json({
        students: parsed,
        booker: { name_kr: booking.booker_name || "", name_en: booking.booker_english || "", age: "" }
      });
    } catch {
      return NextResponse.json({ students: [] });
    }
  }

  return NextResponse.json({ students: [] });
}
