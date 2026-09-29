import { NextResponse } from "next/server";

// 필리핀 페소 → 원 기준 환율 (매매기준율에 해당하는 중간값). 1시간 캐시.
// 제이파크 서차지 원화 환산 = 이 값 + 0.6원 (lib/stayPricing surchargeRate)
export const revalidate = 3600;

export async function GET() {
  const sources: [string, (d: any) => number][] = [
    ["https://open.er-api.com/v6/latest/PHP", d => Number(d?.rates?.KRW)],
    ["https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/php.json", d => Number(d?.php?.krw)],
  ];
  for (const [url, pick] of sources) {
    try {
      const r = await fetch(url, { next: { revalidate: 3600 } });
      if (!r.ok) continue;
      const v = pick(await r.json());
      if (v > 5 && v < 100) return NextResponse.json({ base: Math.round(v * 100) / 100, source: new URL(url).host, at: new Date().toISOString() });
    } catch { /* 다음 소스 */ }
  }
  return NextResponse.json({ base: null, source: "fallback" });
}
