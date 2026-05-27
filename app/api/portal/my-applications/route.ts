import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("booking_id");
  if (!bookingId) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

  // 예약에서 룸 번호 조회 (fieldtrip_applications 매칭용)
  const { data: booking } = await supabase
    .from("bookings")
    .select("house_no, accom_room")
    .eq("id", bookingId)
    .maybeSingle();
  const roomNumber = booking?.house_no || booking?.accom_room || "";

  // 학생 id (tutor_requests 매칭용)
  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("booking_id", bookingId);
  const studentIds = (students || []).map((s: { id: string }) => s.id);

  const [shuttleRes, fieldtripRes, tutorRes, pickupRes] = await Promise.all([
    supabase.from("shuttle_applications").select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false }),
    roomNumber
      ? supabase.from("fieldtrip_applications").select("*")
          .eq("room_number", roomNumber)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null } as { data: Array<Record<string, unknown>>; error: null }),
    studentIds.length > 0
      ? supabase.from("tutor_requests").select("*")
          .in("student_id", studentIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null } as { data: Array<Record<string, unknown>>; error: null }),
    supabase.from("pickup_requests").select("*")
      .eq("booking_id", bookingId)
      .in("request_type", ["extra_pickup", "extra_drop"])
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    shuttle: shuttleRes.data || [],
    fieldtrip: fieldtripRes.data || [],
    tutor: tutorRes.data || [],
    pickup: pickupRes.data || [],
  });
}
