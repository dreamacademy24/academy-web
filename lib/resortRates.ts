// 리조트 지불 단가 — 리조트용 인보이스 생성에 사용
// 제이파크: PHP/박. 단기(Corporate, 2박~) / 장기 7박~ / 장기 14박~ 3단계
// ⚠️ Corporate 단가는 2026 단가표 스캔 기준 — 발행 전 화면에서 수정 가능
// 큐브나인: KRW/박 (풀사이드 17만 / 오션디럭스 15만)

export interface JparkRoom {
  key: string; label: string; location: string;
  corporate: number; // PHP/박 (2박 이상)
  long7: number;     // PHP/박 (7박 이상)
  long14: number;    // PHP/박 (14박 이상)
}

export const JPARK_ROOMS: JparkRoom[] = [
  { key: "deluxe",           label: "Deluxe",                  location: "Main Building", corporate: 8000,  long7: 6400,  long14: 5600 },
  { key: "deluxe_ov",        label: "Deluxe Ocean View",       location: "Main Building", corporate: 9000,  long7: 7600,  long14: 6650 },
  { key: "premier",          label: "Premier",                 location: "Jpark Tower",   corporate: 8700,  long7: 6800,  long14: 5950 },
  { key: "premier_ov",       label: "Premier Ocean View",      location: "Jpark Tower",   corporate: 9700,  long7: 8000,  long14: 7000 },
  { key: "mactan_suite",     label: "Mactan Suite",            location: "Main Building", corporate: 11700, long7: 8800,  long14: 7700 },
  { key: "mactan_suite_ov",  label: "Mactan Suite Ocean View", location: "Main Building", corporate: 13500, long7: 10000, long14: 8750 },
  { key: "mountain_suite",   label: "Mountain Suite",          location: "Jpark Tower",   corporate: 12500, long7: 9200,  long14: 8050 },
  { key: "ocean_suite",      label: "Ocean Suite",             location: "Jpark Tower",   corporate: 14300, long7: 10400, long14: 9100 },
];

export const JPARK_EXTRA_PERSON = 3000; // PHP/박 (전 단계 동일)

export type JparkTier = "corporate" | "long7" | "long14";
export function jparkTier(nights: number): JparkTier {
  if (nights >= 14) return "long14";
  if (nights >= 7) return "long7";
  return "corporate";
}
export const JPARK_TIER_LABEL: Record<JparkTier, string> = {
  corporate: "단기 (Corporate, 2박~)",
  long7: "장기 (7박~)",
  long14: "장기 (14박~)",
};

export interface CubenineRoom { key: string; label: string; nightly: number } // KRW/박
export const CUBENINE_ROOMS: CubenineRoom[] = [
  { key: "poolside",     label: "풀사이드 (Poolside)",       nightly: 170000 },
  { key: "ocean_deluxe", label: "오션디럭스 (Ocean Deluxe)", nightly: 150000 },
];

export function calcNights(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  const n = Math.round((e.getTime() - s.getTime()) / 86400000);
  return n > 0 ? n : 0;
}
