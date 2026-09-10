import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireBooking } from '@/lib/portalAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("booking_id");
  if (!bookingId) return NextResponse.json({ error: "booking_id required" }, { status: 400 });
  const denied = await requireBooking(req, bookingId);
  if (denied) return denied;

  const [shuttleRes, fieldtripRes, tutorRes, pickupRes] = await Promise.all([
    supabase.from("shuttle_applications").select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false }),
    // booking_id 기준(셔틀·튜터와 동일). 구버전 room_number 저장분도 OR로 호환.
    supabase.from("fieldtrip_applications").select("*")
      .eq('booking_id', bookingId)
      .order("created_at", { ascending: false }),
    // /portal/tutor와 동일하게 booking_id로 직접 조회 (student_id 경유 X)
    supabase.from("tutor_requests")
      .select("id, student_name_kr, student_name_en, class_type, start_date, end_date, status, cancel_reason, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false }),
    // pickup_requests.request_type 실제값: 'pickup' | 'dropoff' (구버전 'extra_pickup'/'extra_drop' 호환)
    supabase.from("pickup_requests").select("*")
      .or(`booking_id.eq.${bookingId},and(booking_id.is.null,notes.eq.portal_booking_id:${bookingId})`)
      .in("request_type", ["pickup", "dropoff", "extra_pickup", "extra_drop", "additional", "extra"])
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    shuttle: shuttleRes.data || [],
    fieldtrip: fieldtripRes.data || [],
    tutor: tutorRes.data || [],
    pickup: pickupRes.data || [],
  });
}
