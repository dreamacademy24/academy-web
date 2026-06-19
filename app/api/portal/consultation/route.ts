import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendTelegram, escapeHtml, localTimeLine } from "@/lib/telegram";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — 내가 볼 수 있는 상담 목록 + 슬롯
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("booking_id");
  if (!bookingId) return NextResponse.json({ error: "booking_id required" }, { status: 400 });

  // published 상태인 상담만
  const { data: all, error } = await sb
    .from("consultations")
    .select("*, consultation_slots(*), consultation_invites(*)")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 필터: target_type='all' 이거나, 초대된 booking_id가 포함된 것
  const visible = (all ?? []).filter((c: any) => {
    if (c.target_type === "all") return true;
    return c.consultation_invites?.some((inv: any) => inv.booking_id === bookingId);
  });

  // 슬롯 정렬 (날짜+시간 오름차순)
  for (const c of visible) {
    c.consultation_slots?.sort((a: any, b: any) =>
      `${a.slot_date} ${a.slot_time}`.localeCompare(`${b.slot_date} ${b.slot_time}`)
    );
  }

  return NextResponse.json({ consultations: visible });
}

// POST — 슬롯 선택 (선착순 잠금)
export async function POST(req: Request) {
  try {
    const { slot_id, booking_id, booked_name, booked_student } = await req.json();
    if (!slot_id || !booking_id) {
      return NextResponse.json({ error: "slot_id, booking_id 필수" }, { status: 400 });
    }

    // 1) 이미 이 상담에 예약한 건이 있는지 확인 (1인 1슬롯)
    const { data: slotInfo } = await sb
      .from("consultation_slots")
      .select("consultation_id")
      .eq("id", slot_id)
      .single();

    if (slotInfo) {
      const { data: existing } = await sb
        .from("consultation_slots")
        .select("id")
        .eq("consultation_id", slotInfo.consultation_id)
        .eq("booked_by", booking_id)
        .eq("status", "booked")
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: "이미 이 상담에 예약하셨습니다. 변경을 원하시면 기존 예약을 취소 후 다시 선택해주세요." },
          { status: 409 }
        );
      }
    }

    // 2) 선착순 잠금: status='available'인 것만 업데이트
    const { data, error } = await sb
      .from("consultation_slots")
      .update({
        status: "booked",
        booked_by: booking_id,
        booked_name: booked_name || null,
        booked_student: booked_student || null,
        booked_at: new Date().toISOString(),
      })
      .eq("id", slot_id)
      .eq("status", "available")
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 0 rows = 이미 선택됨
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "이미 선택된 시간입니다. 다른 시간을 선택해주세요." },
        { status: 409 }
      );
    }

    // 텔레그램 알림 (best-effort)
    const bookedSlot = data[0];
    const tgName = escapeHtml(booked_name || "손님");
    const tgStudent = booked_student ? ` (${escapeHtml(booked_student)})` : "";
    const tgDate = bookedSlot.slot_date;
    const tgTime = bookedSlot.slot_time;
    sendTelegram(
      `🗓 <b>상담 예약</b>\n` +
      `👤 ${tgName}${tgStudent}\n` +
      `📅 ${tgDate} ${tgTime}\n` +
      localTimeLine()
    ).catch(() => {});

    return NextResponse.json({ ok: true, slot: data[0] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}

// DELETE — 예약 취소 (본인 것만)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const slotId = searchParams.get("slot_id");
  const bookingId = searchParams.get("booking_id");
  if (!slotId || !bookingId) {
    return NextResponse.json({ error: "slot_id, booking_id 필수" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("consultation_slots")
    .update({
      status: "available",
      booked_by: null,
      booked_name: null,
      booked_student: null,
      booked_at: null,
    })
    .eq("id", slotId)
    .eq("booked_by", bookingId)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "취소할 수 없습니다" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
