// 계약 유학원 프리셋 — 뱃지 단축표기 (2026-07-20)
export const AGENCY_PRESETS = [
  { name: "이젠유학", short: "이젠" },
  { name: "영리쉬", short: "영" },
  { name: "코코키즈", short: "코코" },
] as const;

/** 유학원명 → 짧은 뱃지 라벨 (프리셋 매칭, 아니면 앞 3자) */
export function agencyShort(name?: string | null): string {
  const n = (name || "").trim();
  if (!n || n === "개인") return "";
  for (const p of AGENCY_PRESETS) {
    if (n.includes(p.short) || n.includes(p.name) || p.name.includes(n)) return p.short;
  }
  return n.slice(0, 3);
}

/** 예약 agency 문자열이 특정 유학원(name)에 해당하는지 느슨 매칭 */
export function matchAgency(bookingAgency?: string | null, agencyName?: string | null): boolean {
  const a = (bookingAgency || "").trim();
  const b = (agencyName || "").trim();
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const p = AGENCY_PRESETS.find(x => x.name === b);
  return !!p && a.includes(p.short);
}
