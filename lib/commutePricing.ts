// 통학형(commute) 학원비 단가 — 공식 "드림컴퍼니 2026 패키지 금액" 엑셀 기준 단일 소스.
// 킨더/주니어 동일, 인원(보호자/아이) 무관한 "학원비"이며 학생 1명당 가격이다.
// (리조트형과 달리 숙소가 없으므로 룸타입/인원 분기 없음. 주차 × 시즌만으로 결정.)
//
// 표 형식: weeks → [정가(list), 비수기(off), 성수기(peak)]
// 검증: EstimateCalc.tsx 의 COMMUTE 표와 동일하며 엑셀 2~8주 전부 일치 확인(2026-06).

export type CommuteSeason = "list" | "off" | "peak"; // 정가 / 비수기 / 성수기

export const COMMUTE_PRICE: Record<number, [number, number, number]> = {
  2: [1000000, 900000, 1000000],
  3: [1390000, 1251000, 1390000],
  4: [1690000, 1521000, 1690000],
  5: [2110000, 1899000, 2110000],
  6: [2530000, 2277000, 2403500],
  7: [2950000, 2522250, 2802500],
  8: [3380000, 2889900, 3211000],
};

const SEASON_IDX: Record<CommuteSeason, number> = { list: 0, off: 1, peak: 2 };

// 통학형 학생 1명 학원비 (주차 + 시즌). 표에 없는 주차는 인접 규칙으로 보정:
//  - 1주: 2주의 절반 (기존 코드 fallback 규칙 유지)
//  - 8주 초과: 가장 가까운 상한(8주) 사용 (운영상 8주 초과는 별도 협의)
export function commuteUnitPrice(weeks: number, season: CommuteSeason = "list"): number {
  const idx = SEASON_IDX[season] ?? 0;
  if (COMMUTE_PRICE[weeks]) return COMMUTE_PRICE[weeks][idx];
  if (weeks === 1 && COMMUTE_PRICE[2]) return Math.round(COMMUTE_PRICE[2][idx] / 2);
  // 표 범위 밖: 가장 가까운 정의된 주차로 폴백
  const keys = Object.keys(COMMUTE_PRICE).map(Number).sort((a, b) => a - b);
  if (weeks < keys[0]) return COMMUTE_PRICE[keys[0]][idx];
  return COMMUTE_PRICE[keys[keys.length - 1]][idx];
}

// 통학형 총 학원비 = 학생 1명 단가 × 학생 수 (메이 결정: 학생수 × 단가)
export function commuteTotal(weeks: number, studentCount: number, season: CommuteSeason = "list"): number {
  const n = Math.max(1, Number(studentCount) || 1);
  return commuteUnitPrice(weeks, season) * n;
}

// 현지지불 안내(엑셀 기준) — 인보이스 현지지불 섹션 자동항목용 참고 상수.
export const COMMUTE_LOCAL_NOTE = {
  kinderMaterialPesoPer4w: 2500, // 킨더 재료비 4주 기준 2,500페소
  juniorBookPesoPerBook: 350,    // 주니어 교재비 1권당 350페소
};

// 부가 규정(엑셀): 별도 등록금 없음 / 재방문 추가 1인 +100,000원(3주 이상) / 비수기 월별 추가할인 가능
export const COMMUTE_REVISIT_ADD_WON = 100000;
