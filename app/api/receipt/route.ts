import { NextRequest, NextResponse } from "next/server";
import { appendNewSheet, InvoiceSheetData } from "@/lib/googleSheets";

export async function POST(req: NextRequest) {
  try {
    const data: InvoiceSheetData = await req.json();
    if (!data.name) return NextResponse.json({ error: "예약자명 필요" }, { status: 400 });
    await appendNewSheet(data);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Receipt API error:", err);
    return NextResponse.json({ error: err.message || "시트 기록 실패" }, { status: 500 });
  }
}
