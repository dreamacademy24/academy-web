import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BOARD_ID = "may";

export async function GET() {
  const { data, error } = await supabase
    .from("web_board")
    .select("data")
    .eq("id", BOARD_ID)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data?.data ?? null });
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { error } = await supabase
      .from("web_board")
      .upsert({ id: BOARD_ID, data: body, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
