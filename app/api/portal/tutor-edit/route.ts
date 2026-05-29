import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, class_type, preferred_days, preferred_time, start_date, end_date, notes } = body || {};
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // status가 pending인 경우에만 수정 허용
    const { data: existing, error: getErr } = await supabase
      .from("tutor_requests")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (getErr) return NextResponse.json({ error: getErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (existing.status !== "pending") {
      return NextResponse.json({ error: "확정 이후에는 수정할 수 없습니다." }, { status: 403 });
    }

    const update: Record<string, unknown> = {};
    if (class_type !== undefined) update.class_type = class_type;
    if (preferred_days !== undefined) {
      update.preferred_days = Array.isArray(preferred_days) ? preferred_days.join(",") : preferred_days;
    }
    if (preferred_time !== undefined) update.preferred_time = preferred_time;
    if (start_date !== undefined) update.start_date = start_date;
    if (end_date !== undefined) update.end_date = end_date;
    if (notes !== undefined) update.notes = notes;

    const { error } = await supabase.from("tutor_requests").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
