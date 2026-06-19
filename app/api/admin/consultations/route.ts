import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — 전체 상담 목록 (슬롯+초대 포함)
export async function GET() {
  const { data, error } = await sb
    .from("consultations")
    .select("*, consultation_slots(*), consultation_invites(*)")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ consultations: data ?? [] });
}

// POST — 새 상담 생성 (슬롯 + 초대 포함)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, target_type, slots, invite_booking_ids, status } = body;
    if (!title) return NextResponse.json({ error: "제목을 입력해주세요" }, { status: 400 });

    // 1) 상담 생성
    const { data: cons, error: cErr } = await sb
      .from("consultations")
      .insert({
        title,
        description: description || null,
        target_type: target_type || "all",
        status: status || "draft",
      })
      .select()
      .single();
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    // 2) 슬롯 등록
    if (slots?.length) {
      const slotRows = slots.map((s: { date: string; time: string; duration?: number }) => ({
        consultation_id: cons.id,
        slot_date: s.date,
        slot_time: s.time,
        duration_min: s.duration || 40,
        status: "available",
      }));
      const { error: sErr } = await sb.from("consultation_slots").insert(slotRows);
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    }

    // 3) 초대 (selected인 경우)
    if (target_type === "selected" && invite_booking_ids?.length) {
      const invRows = invite_booking_ids.map((bid: string) => ({
        consultation_id: cons.id,
        booking_id: bid,
      }));
      const { error: iErr } = await sb.from("consultation_invites").insert(invRows);
      if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: cons.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}

// PATCH — 상담 수정 (상태변경, 슬롯 추가/삭제, 초대 변경)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // 상담 기본정보 업데이트
    const allowed = ["title", "description", "target_type", "status"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (k in fields) updates[k] = fields[k];
    }
    const { error } = await sb.from("consultations").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 슬롯 추가
    if (fields.add_slots?.length) {
      const rows = fields.add_slots.map((s: { date: string; time: string; duration?: number }) => ({
        consultation_id: id,
        slot_date: s.date,
        slot_time: s.time,
        duration_min: s.duration || 40,
        status: "available",
      }));
      await sb.from("consultation_slots").insert(rows);
    }

    // 슬롯 삭제 (available만)
    if (fields.remove_slot_ids?.length) {
      await sb
        .from("consultation_slots")
        .delete()
        .in("id", fields.remove_slot_ids)
        .eq("status", "available");
    }

    // 초대 교체 (selected 타입이면)
    if (fields.invite_booking_ids !== undefined) {
      await sb.from("consultation_invites").delete().eq("consultation_id", id);
      if (fields.invite_booking_ids?.length) {
        const rows = fields.invite_booking_ids.map((bid: string) => ({
          consultation_id: id,
          booking_id: bid,
        }));
        await sb.from("consultation_invites").insert(rows);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}

// DELETE — 상담 삭제 (cascade로 슬롯+초대 함께)
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await sb.from("consultations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
