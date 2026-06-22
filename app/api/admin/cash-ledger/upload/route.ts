import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST — 영수증 이미지 업로드 (Supabase Storage)
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "파일 없음" }, { status: 400 });

    const ext = file.name.split(".").pop() || "jpg";
    const path = `cash-receipts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const arrayBuf = await file.arrayBuffer();
    const { error: upErr } = await sb.storage
      .from("staff-files")
      .upload(path, Buffer.from(arrayBuf), { contentType: file.type, upsert: false });

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { data: urlData } = sb.storage.from("staff-files").getPublicUrl(path);

    return NextResponse.json({ name: file.name, url: urlData.publicUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "unknown" }, { status: 500 });
  }
}
