// 견적(EstimateCalc) ↔ 인보이스(/invoice) 공용 계산 — "견적 금액 = 인보이스 금액" 단일 소스 (2026-09-29)
// ① 시즌 판정(주 단위) ② 콤보 구간 금액(해당 숙소 총 체류 주수 금액 ÷ 총 체류 주수 × 주수, 주별 시즌)
// ③ 방학(평일 방학만) 수업료 차감 ④ 제이파크 연말 서차지(계약서 기준) ⑤ 휴무일 안내 문구
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

/* 콤보 구간: 주당 단가 = 해당 숙소 총 체류 주수 금액 ÷ 총 체류 주수 (시즌은 각 주 시작일로 판정) */
export function comboSegPrice(totalPrice: P3, start: string, w: number, totalWeeks: number, season?: 0 | 1 | 2): { price: number; off: number; peak: number } {
  if (!Number.isInteger(totalWeeks) || totalWeeks <= 0 || !Number.isInteger(w) || w < 0 || w > totalWeeks) throw new Error("Invalid mixed-stay duration");
  const mx = start && season !== 0 ? weekMix(start, w) : { off: w, peak: 0 };
  const amount = season === 0 || !start && season !== undefined
    ? totalPrice[season ?? 1] * w
    : totalPrice[1] * mx.off + totalPrice[2] * mx.peak;
  return { price: Math.round(amount / totalWeeks), ...mx };
}

/* ③ 방학(평일 방학만) 수업료 차감 — 통학형 학원비 주당·일당 단가 기준 × 아이 수 */
export const VACATION_LINE_PREFIX = "학원 방학 수업료 제외";
export function computeVacationDeduct(
  holidays: HolidayItem[], checkin: string, weeks: number, kids: number, commute: boolean,
): { name: string; amount: number; detail: string } | null {
  const w = Number(weeks) || 0, k = Number(kids) || 0;
  if (!checkin || !w || !k) return null;
  const co = addDaysStr(checkin, commute ? (w - 1) * 7 + 4 : w * 7);
  // Only explicitly named academy vacations qualify. Public holidays remain notices only.
  const hs = holidaysInRange(holidays, checkin, co).filter(h => {
    const day = new Date(h.date + "T00:00:00").getDay();
    return h.name.replace(/\s/g, "") === "학원방학" && day >= 1 && day <= 5;
  }).filter((h, i, all) => all.findIndex(other => other.date === h.date) === i);
  if (!hs.length) return null;
  const base: P3 = COMMUTE_PRICE[w] || (w === 1 ? [500000, 450000, 500000] : COMMUTE_PRICE[12]);
  const days = w * 5;
  const perOff = Math.round(base[1] / days), perPeak = Math.round(base[2] / days);
  let sum = 0; const parts: string[] = [];
  for (const h of hs) { const pk = isPeakDate(h.date); sum += (pk ? perPeak : perOff) * k; parts.push(h.date.slice(5).replace("-", "/") + (pk ? "·성수기" : "·비수기")); }
  // 인보이스·견적 표시는 짧게, 계산 근거는 detail (직원용 "계산 내역"에서 확인)
  return { name: `${VACATION_LINE_PREFIX} (평일 방학 ${hs.length}일)`, amount: sum,
    detail: `${parts.join(", ")} · 1일 수업료 비수기 ${perOff.toLocaleString()}원 / 성수기 ${perPeak.toLocaleString()}원 (통학형 ${w}주 단가 ÷ ${days}일) × 아이 ${k}명` };
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
    // 아이 나이: 아카데미 학생 인적사항 기준. 모르는 아이는 어린이 요금(7~12세)으로 계산
    const n = Math.max(0, Number(kids) || 0), ages = childAges || [];
    let known = 0;
    for (let i = 0; i < n; i++) {
      const a = ages[i];
      if (a == null || isNaN(Number(a))) { galaChildren++; continue; }
      known++;
      if (a >= 13) galaAdults++; else if (a >= 7) galaChildren++;
    }
    childAgesKnown = n > 0 && known === n;
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
    out.push({ name: `제이파크 12/31 갈라디너 의무 (${parts || "0~6세 무료"}${s.childAgesKnown ? "" : " · 나이 미확인 아이는 7~12세 기준"})`, amount: s.galaTotal });
  }
  return out;
}
export const JP_SURCHARGE_PREFIX = "제이파크 연말 서차지";
/* 원화 청구 (메이 확정 2026-09-29): 환율 = 매매기준율 + 0.6원, 1,000원 단위 올림
   매매기준율은 /api/fx/php 에서 받아옴 (실패 시 FX_FALLBACK_BASE) */
export const FX_MARGIN = 0.6;
export const FX_FALLBACK_BASE = 24.0;
export function surchargeRate(base?: number | null): number {
  const b = Number(base) > 0 ? Number(base) : FX_FALLBACK_BASE;
  return Math.round((b + FX_MARGIN) * 100) / 100;
}
export function phpToKrw(php: number, rate: number): number { return Math.ceil((php * rate) / 1000) * 1000; }
export function jparkSurchargeKrwLines(s: JpSurcharge, rate: number): { name: string; amount: number; detail: string }[] {
  const out = [{ name: `${JP_SURCHARGE_PREFIX} (${s.nights.length}박)`, amount: phpToKrw(s.nightTotal, rate),
    detail: `${fmtNightRange(s.nights)} ${s.nights.length}박 × ₱4,500 = ₱${s.nightTotal.toLocaleString()} × ${rate}원(매매기준율+0.6) → 1,000원 올림` }];
  if (s.gala) {
    const parts = [s.galaAdults ? `성인 ${s.galaAdults}명×₱5,500` : "", s.galaChildren ? `어린이(7~12세) ${s.galaChildren}명×₱2,750` : ""].filter(Boolean).join(" + ") || "0~6세 무료";
    out.push({ name: `${JP_GALA_PREFIX} (의무)`, amount: phpToKrw(s.galaTotal, rate),
      detail: `${parts} = ₱${s.galaTotal.toLocaleString()} × ${rate}원${s.childAgesKnown ? " (나이: 학생 인적사항 기준, 0~6세 무료)" : " (나이 미확인 아이는 7~12세 기준)"}` });
  }
  return out;
}
/* 매매기준율 조회 (클라이언트용, 페이지당 1회 캐시) */
let _fxP: Promise<number> | null = null;
export function fetchPhpBaseRate(): Promise<number> {
  if (!_fxP) _fxP = fetch("/api/fx/php").then(r => r.json()).then(d => Number(d?.base) > 0 ? Number(d.base) : FX_FALLBACK_BASE).catch(() => FX_FALLBACK_BASE);
  return _fxP;
}
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
    ? "학원 방학 중 평일 수업료만 위 금액에서 차감되었습니다. 공휴일·기타 휴무일은 차감 대상이 아니며 별도 환불 · 보강은 없습니다"
    : "휴무일에 대한 별도 환불 · 보강은 없습니다";
  return { off, on, money };
}
