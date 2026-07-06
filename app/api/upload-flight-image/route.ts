import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/upload-flight-image
 *
 * FormData:
 *   - image: File (required)
 *   - bookingId: string (admin 용)
 *   - token: string (guest 용 — checkin_details.public_token으로 booking_id 조회)
 *
 * 둘 중 하나만 있으면 됨. service_role로 Storage + bookings.flight_images 동시 처리
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const image = formData.get("image") as File | null;
    const bookingId = formData.get("bookingId") as string | null;
    const token = formData.get("token") as string | null;
    const target = formData.get("target") as string | null; // "pickup" = 픽드랍 항공권 (flight_images에 추가 안 함)

    if (!image) {
      return NextResponse.json({ error: "image required" }, { status: 400 });
    }

    // booking_id 결정
    let bid = bookingId;
    if (!bid && token) {
      const { data: detail } = await sb
        .from("checkin_details")
        .select("booking_id")
        .eq("public_token", token)
        .maybeSingle();
      bid = detail?.booking_id || null;
    }
    if (!bid) {
      return NextResponse.json({ error: "bookingId or valid token required" }, { status: 400 });
    }

    // 1) Storage 업로드
    const ext = (image.name?.split(".").pop() || "jpg").toLowerCase();
    const path = `flight/${bid}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const buf = Buffer.from(await image.arrayBuffer());

    const { error: upErr } = await sb.storage
      .from("staff-files")
      .upload(path, buf, { contentType: image.type || "image/jpeg" });

    if (upErr) {
      console.error("[upload-flight-image] storage upload failed:", upErr.message);
      return NextResponse.json({ error: "storage upload failed: " + upErr.message }, { status: 500 });
    }

    // 2) Public URL 생성
    const { data: pub } = sb.storage.from("staff-files").getPublicUrl(path);
    const publicUrl = pub?.publicUrl;
    if (!publicUrl) {
      return NextResponse.json({ error: "failed to get public url" }, { status: 500 });
    }

    // target=pickup: URL만 반환 (픽드랍 행에 저장)
    if (target === "pickup") {
      return NextResponse.json({ ok: true, publicUrl });
    }

    // 3) bookings.flight_images 배열에 추가
    const { data: bk } = await sb
      .from("bookings")
      .select("flight_images")
      .eq("id", bid)
      .maybeSingle();

    const existing = Array.isArray(bk?.flight_images) ? bk.flight_images : [];
    const updated = [...existing, publicUrl];

    const { error: patchErr } = await sb
      .from("bookings")
      .update({ flight_images: updated })
      .eq("id", bid);

    if (patchErr) {
      console.error("[upload-flight-image] bookings patch failed:", patchErr.message);
      return NextResponse.json({ error: "bookings update failed: " + patchErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, publicUrl, flight_images: updated });
  } catch (err: unknown) {
    console.error("[upload-flight-image] unexpected:", err);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}

/**
 * DELETE /api/upload-flight-image
 *
 * Body: { bookingId: string, url: string }
 * flight_images 배열에서 url 제거
 */
export async function DELETE(req: Request) {
  try {
    const { bookingId, url } = await req.json();
    if (!bookingId || !url) {
      return NextResponse.json({ error: "bookingId and url required" }, { status: 400 });
    }

    const { data: bk } = await sb
      .from("bookings")
      .select("flight_images")
      .eq("id", bookingId)
      .maybeSingle();

    const existing = Array.isArray(bk?.flight_images) ? bk.flight_images : [];
    const updated = existing.filter((u: string) => u !== url);

    const { error: patchErr } = await sb
      .from("bookings")
      .update({ flight_images: updated })
      .eq("id", bookingId);

    if (patchErr) {
      return NextResponse.json({ error: patchErr.message }, { status: 500 });
    }

    // 선택적으로 Storage에서도 삭제 시도
    try {
      const match = url.match(/\/staff-files\/(.+)$/);
      if (match) {
        await sb.storage.from("staff-files").remove([match[1]]);
      }
    } catch { /* best-effort */ }

    return NextResponse.json({ ok: true, flight_images: updated });
  } catch {
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
