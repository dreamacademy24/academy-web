import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_TABLES = ["shuttle_applications", "fieldtrip_applications", "tutor_requests"] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { table, id, reason } = body || {};
    if (!table || !ALLOWED_TABLES.includes(table as AllowedTable)) {
      return NextResponse.json({ error: "invalid table" }, { status: 400 });
    }
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const update: Record<string, unknown> = { status: "cancel_requested" };
    if (reason && String(reason).trim()) update.cancel_reason = String(reason).trim();

    const { error } = await supabase.from(table).update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
