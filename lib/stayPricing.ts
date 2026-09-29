// 견적(EstimateCalc) ↔ 인보이스(/invoice) 공용 계산 — "견적 금액 = 인보이스 금액" 단일 소스 (2026-09-29)
// ① 시즌 판정(주 단위) ② 콤보 구간 금액(해당 숙소 4주 금액 ÷ 4 × 주수, 주별 시즌)
// ③ 방학(평일 휴무) 수업료 차감 ④ 제이파크 연말 서차지(계약서 기준) ⑤ 휴무일 안내 문구
import { COMMUTE_PRICE } from "@/lib/commutePricing";
import { holidaysInRange, type HolidayItem } from "@/lib/holidays";

export type P3 = [number, number, number]; // [정가, 비수기, 성수기]

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDaysStr(ds: string, n: number): string {
  const d = new Date(ds.slice(0, 10) + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d);
}

export function isPeakDate(ds: string): boolean {
  if (!ds) return false;
  const dt = new Date(ds.slice(0, 10) + "T00:00:00"), y = dt.getFullYear(), m = dt.getMonth() + 1, day = dt.getDate();
  if (y === 2027) return (m === 7 && day >= 18) || (m === 8 && day <= 30) || (m === 12 && day >= 19) || m === 1 || m === 2;
  if (y === 2028) return m === 1 || (m === 2 && day <= 28) || (m === 7 && day >= 15) || m === 8 || (m === 12 && day >= 15);
  return (m === 7 && day >= 15) || m === 8 || (m === 12 && day >= 15) || m === 1 || m === 2;
}
/* 주 시작~6일 뒤가 모두 성수기일 때만 성수기 주 (걸친 주 = 비수기, 2026-07-30 확정) */
export function weekIsPeak(ds: string): boolean {
  return !!ds && isPeakDate(ds) && isPeakDate(addDaysStr(ds, 6));
}
export function weekMix(start: string, w: number): { off: number; peak: number } {
  let off = 0, peak = 0;
  for (let i = 0; i < w; i++) { if (start && weekIsPeak(addDaysStr(start, i * 7))) peak++; else off++; }
  return { off, peak };
}

/* 단독 숙소/통학형: 해당 주수 가격표 기준, 혼합이면 주당가(시즌가÷주수)×시즌별 주수 */
export function blendStayPrice(e: P3, start: string, w: number): { price: number; off: number; peak: number } {
  const mx = start ? weekMix(start, w) : { off: w, peak: 0 };
  if (mx.peak === 0) return { price: e[1], ...mx };
  if (mx.off === 0) return { price: e[2], ...mx };
  return { price: Math.round(e[1] / w) * mx.off + Math.round(e[2] / w) * mx.peak, ...mx };
}

/* 콤보 구간: 주당 단가 = 해당 숙소 4주 금액 ÷ 4 (시즌은 각 주 시작일로 판정) */
export function comboSegPrice(four: P3, start: string, w: number): { price: number; off: number; peak: number } {
  let price = 0, off = 0, peak = 0;
  for (let i = 0; i < w; i++) {
    const pk = !!start && weekIsPeak(addDaysStr(start, i * 7));
    price += Math.round(four[pk ? 2 : 1] / 4);
    if (pk) peak++; else off++;
  }
  return { price, off, peak };
}

/* ③ 방학(평일 휴무) 수업료 차감 — 통학형 학원비 주당·일당 단가 기준 × 아이 수 */
export const VACATION_LINE_PREFIX = "학원 방학 수업료 제외";
export function computeVacationDeduct(
  holidays: HolidayItem[], checkin: string, weeks: number, kids: number, commute: boolean,
): { name: string; amount: number } | null {
  const w = Number(weeks) || 0, k = Number(kids) || 0;
  if (!checkin || !w || !k) return null;
  const co = addDaysStr(checkin, commute ? (w - 1) * 7 + 4 : w * 7);
  const hs = holidaysInRange(holidays, checkin, co).filter(h => { const d = new Date(h.date + "T00:00:00").getDay(); return d >= 1 && d <= 5; });
  if (!hs.length) return null;
  const base: P3 = COMMUTE_PRICE[w] || (w === 1 ? [500000, 450000, 500000] : COMMUTE_PRICE[12]);
  const days = w * 5;
  const perOff = Math.round(base[1] / days), perPeak = Math.round(base[2] / days);
  let sum = 0; const parts: string[] = [];
  for (const h of hs) { const pk = isPeakDate(h.date); sum += (pk ? perPeak : perOff) * k; parts.push(h.date.slice(5).replace("-", "/") + (pk ? "·성수기" : "·비수기")); }
  return { name: `${VACATION_LINE_PREFIX} (${parts.join(", ")} × 아이 ${k}명 · ${w}주 단가 기준)`, amount: sum };
}

/* ④ 제이파크 연말 서차지 — 장기투숙(Long Stay) 계약: 연말 서차지만 적용 (그 외 서차지 면제)
   · 12/28 ~ 1/2 숙박 1박당 PHP 4,500 (객실 기준)
   · 12/31 숙박 포함 시 갈라 디너 의무: 성인(13세↑) PHP 5,500 · 어린이(7~12세) PHP 2,750 · 0~6세 무료 */
export const JP_YE_NIGHT = 4500, JP_GALA_ADULT = 5500, JP_GALA_CHILD = 2750;
export interface JpSurcharge { nights: string[]; nightTotal: number; gala: boolean; galaAdults: number; galaChildren: number; galaTotal: number; childAgesKnown: boolean; total: number; }
function isYearEndNight(ds: string): boolean {
  const md = ds.slice(5);
  return md >= "12-28" || md <= "01-02";
}
/** checkout 전날까지가 숙박일. childAges: 아이 나이 배열(모르면 null → 전원 어린이 요금으로 계산) */
export function computeJparkSurcharge(checkin: string, checkout: string, adults: number, kids: number, childAges?: (number | null)[] | null): JpSurcharge | null {
  if (!checkin || !checkout || checkout <= checkin) return null;
  const nights: string[] = [];
  for (let d = checkin.slice(0, 10); d < checkout.slice(0, 10); d = addDaysStr(d, 1)) if (isYearEndNight(d)) nights.push(d);
  if (!nights.length) return null;
  const gala = nights.some(d => d.slice(5) === "12-31");
  let galaChildren = 0, galaAdults = Math.max(0, Number(adults) || 0), childAgesKnown = false;
  if (gala) {
    const ages = (childAges || []).filter(a => a != null && !isNaN(Number(a))) as number[];
    if (ages.length && ages.length >= (Number(kids) || 0)) {
      childAgesKnown = true;
      for (const a of ages) { if (a >= 13) galaAdults++; else if (a >= 7) galaChildren++; }
    } else galaChildren = Math.max(0, Number(kids) || 0);
  }
  const nightTotal = nights.length * JP_YE_NIGHT;
  const galaTotal = gala ? galaAdults * JP_GALA_ADULT + galaChildren * JP_GALA_CHILD : 0;
  return { nights, nightTotal, gala, galaAdults, galaChildren, galaTotal, childAgesKnown, total: nightTotal + galaTotal };
}
export function fmtNightRange(nights: string[]): string {
  const f = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return nights.length === 1 ? f(nights[0]) : `${f(nights[0])}~${f(nights[nights.length - 1])}`;
}
/** 인보이스 현지지불/견적 안내용 라인 (PHP) */
export function jparkSurchargeLines(s: JpSurcharge): { name: string; amount: number }[] {
  const out = [{ name: `제이파크 연말 서차지 (${fmtNightRange(s.nights)} ${s.nights.length}박 × ₱4,500)`, amount: s.nightTotal }];
  if (s.gala) {
    const parts = [s.galaAdults ? `성인 ${s.galaAdults}명×₱5,500` : "", s.galaChildren ? `어린이(7~12세) ${s.galaChildren}명×₱2,750` : ""].filter(Boolean).join(" + ");
    out.push({ name: `제이파크 12/31 갈라디너 의무 (${parts || "0~6세 무료"}${s.childAgesKnown ? "" : " · 0~6세 무료"})`, amount: s.galaTotal });
  }
  return out;
}
export const JP_SURCHARGE_PREFIX = "제이파크 연말 서차지";
export const JP_GALA_PREFIX = "제이파크 12/31 갈라디너";

/* ⑤ 휴무일 안내 — 숙소 유형별 제공/미제공 */
export type StayKind = "package" | "jpark" | "cubenine" | "commute" | "roomonly";
export function holidayNotice(kind: StayKind, deducted: boolean): { off: string; on: string | null; money: string } {
  const off = kind === "roomonly" ? "드림센터(헬퍼 · 셔틀 · 관리실) 운영 안 함"
    : kind === "commute" ? "아카데미 수업 · 셔틀 · 관리실 운영 안 함"
    : "아카데미 수업 · 헬퍼 · 투어셔틀 · 관리실 운영 안 함";
  const on = kind === "commute" ? null
    : kind === "cubenine" ? "숙소는 정상 이용 가능합니다"
    : kind === "roomonly" ? "숙소는 정상 이용 가능합니다"
    : "숙소 이용 · 식사는 정상 제공됩니다";
  const money = deducted
    ? "평일 휴무일 수업료는 위 금액에서 이미 차감되었으며, 그 외 별도 환불 · 보강은 없습니다"
    : "휴무일에 대한 별도 환불 · 보강은 없습니다";
  return { off, on, money };
}
