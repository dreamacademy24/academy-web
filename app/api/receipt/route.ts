import { NextRequest, NextResponse } from "next/server";
import { appendSheet1, appendSheet2, ReceiptData } from "@/lib/googleSheets";

export async function POST(req: NextRequest) {
  try {
    const data: ReceiptData = await req.json();

    if (!data.name) {
      return NextResponse.json({ error: "예약자명이 필요합니다." }, { status: 400 });
    }

    // 시트1, 시트2 동시 기록
    await Promise.all([appendSheet1(data), appendSheet2(data)]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Receipt API error:", err);
    return NextResponse.json(
      { error: err.message || "시트 기록 실패" },
      { status: 500 }
    );
  }
}
