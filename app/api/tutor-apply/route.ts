import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const row = {
      guest_name: body.house_or_reserver?.trim() || null,
      house_number: body.house_or_reserver?.trim() || null,
      student_name_kr: body.children_names?.trim() || null,
      student_name_en: null,
      student_age: body.children_ages?.trim() || null,
      class_type: body.class_type || null,
      sessions_per_day: body.sessions_per_day || 1,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      preferred_days: Array.isArray(body.class_days)
        ? body.class_days.join(",")
        : (body.class_days || null),
      skip_dates: body.excluded_dates?.trim() || null,
      preferred_time: body.class_time?.trim() || null,
      level_english: body.overall_level || null,
      level_speaking: body.speaking_level || null,
      level_reading: body.reading_level || null,
      level_writing: body.writing_level || null,
      textbook: body.textbook?.trim() || null,
      class_style: body.class_style || null,
      class_focus_arr: Array.isArray(body.class_focus) ? body.class_focus : null,
      child_personality: body.child_notes?.trim() || null,
      privacy_agreed: true,
      rules_agreed: true,
      status: "pending",
      reserver_type: "external",
    };
    const { error } = await supabase.from("tutor_requests").insert(row);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
