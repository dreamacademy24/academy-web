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

  const [shuttleRes, fieldtripRes, tutorRes, pickupRes] = await Promise.all([
    supabase.from("shuttle_applications").select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false }),
    roomNumber
      ? supabase.from("fieldtrip_applications").select("*")
          .eq("room_number", roomNumber)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null } as { data: Array<Record<string, unknown>>; error: null }),
    // /portal/tutor와 동일하게 booking_id로 직접 조회 (student_id 경유 X)
    supabase.from("tutor_requests")
      .select("id, student_name_kr, student_name_en, class_type, start_date, end_date, status, cancel_reason, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false }),
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
