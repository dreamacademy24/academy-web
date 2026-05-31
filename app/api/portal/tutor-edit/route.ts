import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      class_type, preferred_days, preferred_time, start_date, end_date, notes,
      student_name_kr, student_name_en, skip_dates,
      level_english, level_speaking, level_reading, level_writing,
      textbook, class_style, class_focus_arr, child_personality,
      sessions_per_day, schedule_blocks,
    } = body || {};
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
    if (student_name_kr !== undefined) update.student_name_kr = student_name_kr;
    if (student_name_en !== undefined) update.student_name_en = student_name_en;
    if (skip_dates !== undefined) update.skip_dates = skip_dates;
    if (level_english !== undefined) update.level_english = level_english;
    if (level_speaking !== undefined) update.level_speaking = level_speaking;
    if (level_reading !== undefined) update.level_reading = level_reading;
    if (level_writing !== undefined) update.level_writing = level_writing;
    if (textbook !== undefined) update.textbook = textbook;
    if (class_style !== undefined) update.class_style = class_style;
    if (class_focus_arr !== undefined) update.class_focus_arr = class_focus_arr;
    if (child_personality !== undefined) update.child_personality = child_personality;
    if (sessions_per_day !== undefined) update.sessions_per_day = sessions_per_day;
    if (schedule_blocks !== undefined) update.schedule_blocks = schedule_blocks;

    const { error } = await supabase.from("tutor_requests").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
