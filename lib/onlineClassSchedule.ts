// 화상영어 세션 날짜 계산 — 성수기(방학)·휴일·주말은 수업 없음 (2026-08-28)
// 성수기 = 아카데미 집중 운영(방학) 기간 → 화상영어 일시 중단
// 규칙은 견적 isPeak와 동일하게 유지

export function isPeakVacation(dateStr: string): boolean {
  if (!dateStr) return false;
  const dt = new Date(dateStr + "T00:00:00");
  const y = dt.getFullYear(), m = dt.getMonth() + 1, day = dt.getDate();
  if (y === 2027) return (m === 7 && day >= 18) || (m === 8 && day <= 30) || (m === 12 && day >= 19) || m === 1 || m === 2;
  if (y === 2028) return m === 1 || (m === 2 && day <= 28) || (m === 7 && day >= 15) || m === 8 || (m === 12 && day >= 15);
  return (m === 7 && day >= 15) || m === 8 || (m === 12 && day >= 15) || m === 1 || m === 2;
}

const DAY_KR_TO_JS: Record<string, number> = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 };

/**
 * 시작일부터 요일·회차 기준으로 실제 수업 날짜를 생성.
 * 성수기(방학)·휴일·주말(요일 미선택)은 건너뜀 → 마지막 날짜 = 마지막 회차.
 * @param holidayDates 휴일 날짜 Set (YYYY-MM-DD)
 * @returns { dates, endDate, skipped } skipped = 건너뛴 (날짜·사유) 목록
 */
export function buildOnlineSessionDates(
  startDate: string,
  daysOfWeek: string[],
  totalSessions: number,
  holidayDates: Set<string>
): { dates: string[]; endDate: string; skipped: { date: string; reason: "휴일" | "방학" }[] } {
  const dates: string[] = [];
  const skipped: { date: string; reason: "휴일" | "방학" }[] = [];
  if (!startDate || !totalSessions || !daysOfWeek?.length) return { dates, endDate: "", skipped };
  const targetJs = new Set(daysOfWeek.map(d => DAY_KR_TO_JS[d]).filter(v => v !== undefined));
  const cur = new Date(startDate + "T00:00:00");
  let guard = 0;
  while (dates.length < totalSessions && guard < 2000) {
    guard++;
    const js = cur.getDay();
    if (targetJs.has(js)) {
      const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      if (holidayDates.has(ds)) skipped.push({ date: ds, reason: "휴일" });
      else if (isPeakVacation(ds)) skipped.push({ date: ds, reason: "방학" });
      else dates.push(ds);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return { dates, endDate: dates.length ? dates[dates.length - 1] : "", skipped };
}
