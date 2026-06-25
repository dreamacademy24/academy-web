// 튜터 수업일/셔틀 신청 공통 날짜 제약 — 서버/클라 양쪽에서 사용 가능한 순수 함수.
//
// 1) 휴일: 아래 날짜는 수업/신청 불가 (예: 6/12 금요일)
// 2) 토요일: 매월 둘째·넷째 주 토요일(= Math.ceil(getDate()/7) ∈ {2,4})만 수업 가능
//    (필드트립이 있는 주에만 운영)

export const LESSON_HOLIDAYS = new Set<string>([
  "2026-06-12",
]);

// 배포된 휴일(holidays 테이블) 주입용 — 페이지에서 lib/holidays.applyDeployedHolidaysToLessons() 호출 시 채워짐
const EXTRA_HOLIDAYS = new Set<string>();
export function setExtraLessonHolidays(dates: string[]) {
  EXTRA_HOLIDAYS.clear();
  dates.forEach(d => { if (d) EXTRA_HOLIDAYS.add(d.slice(0, 10)); });
}

export function isHolidayDate(ds: string): boolean {
  return LESSON_HOLIDAYS.has(ds) || EXTRA_HOLIDAYS.has(ds);
}

// 그 달의 몇 번째 토요일인지로 판정 — 둘째(2)·넷째(4)만 유효
export function isSecondOrFourthSaturday(d: Date): boolean {
  const nth = Math.ceil(d.getDate() / 7);
  return nth === 2 || nth === 4;
}

// 요일 매칭은 호출부가 책임지고, 여기서는 휴일/토요일-주차 제약만 검사.
// 수업/세션으로 잡아도 되는 날짜면 true.
export function isLessonDateAllowed(d: Date, ds: string): boolean {
  if (isHolidayDate(ds)) return false;            // 휴일 제외 (6/12 등)
  if (d.getDay() === 6 && !isSecondOrFourthSaturday(d)) return false; // 1·3·5번째 토요일 제외
  return true;
}

// ──────────────────────────────────────────────────────────────────────────
// 튜터 단가·회차·총액 공통 정의 — 모든 화면(신청 상세/인보이스/포털)이 동일 공식 참조.
//   · 단가(₱)   = "하루치 단가" = 기본단가 × 타임(sessions_per_day)
//                  1:1 기본 300 → 1T=300, 2T=600 / 1:2 기본 350 → 1T=350, 2T=700
//   · 회차      = 실제 수업 "일수" (타임 곱 X. skip·6/12·토요일 둘째넷째주 규칙 반영)
//   · 총액      = 단가(하루치) × 회차(일수)
//   검증값: 1:1 2T 5일=3,000 / 1:1 1T 3일=900 / 1:2 1T 8일=2,800 / 1:2 2T 5일=3,500

// 기본단가(타임 1 기준)
export function tutorBaseRate(classType: string | null | undefined): number {
  return (classType || "").includes("1:2") ? 350 : 300;
}
// 하루치 단가 = 기본단가 × 타임
export function tutorDailyRate(
  classType: string | null | undefined,
  sessionsPerDay: number | null | undefined,
): number {
  const spd = Number(sessionsPerDay) === 2 ? 2 : 1;
  return tutorBaseRate(classType) * spd;
}

// 날짜별 타임(세션) — session_overrides[date] 우선, 없으면 lesson.sessions_per_day
export function sessionsForDate(lesson: { session_overrides?: Record<string, number> | null; sessions_per_day?: number | null } | null | undefined, date: string): number {
  const ov = lesson?.session_overrides;
  if (ov && typeof ov === "object") {
    const v = Number((ov as Record<string, number>)[date]);
    if (v === 1 || v === 2) return v;
  }
  return Number(lesson?.sessions_per_day) === 2 ? 2 : 1;
}
// 날짜별 수업 유형 (type_overrides[date] 우선, 없으면 lesson.class_type)
export function typeForDate(lesson: { type_overrides?: Record<string, string> | null; class_type?: string | null } | null | undefined, date: string): string {
  const ov = lesson?.type_overrides;
  if (ov && typeof ov === "object" && (ov as Record<string, string>)[date]) return String((ov as Record<string, string>)[date]);
  return lesson?.class_type || "1:1";
}
// 날짜별 하루치 단가 (날짜별 유형 1:1/1:2 + 타임 반영)
export function tutorDayRate(lesson: { class_type?: string | null; type_overrides?: Record<string, string> | null; session_overrides?: Record<string, number> | null; sessions_per_day?: number | null } | null | undefined, date: string): number {
  return tutorDailyRate(typeForDate(lesson, date), sessionsForDate(lesson, date));
}
// 청구 날짜 배열의 총액 (날짜별 타임 단가 합산)
export function tutorTotalForDates(lesson: { class_type?: string | null; type_overrides?: Record<string, string> | null; session_overrides?: Record<string, number> | null; sessions_per_day?: number | null } | null | undefined, billedDates: string[]): number {
  return billedDates.reduce((sum, d) => sum + tutorDayRate(lesson, d), 0);
}

const _DAY_NUM: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6,
};
function _localStr(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// 실제 수업 "일수" — 시작~종료 범위에서 요일 매칭 + 휴일/토요일제약(isLessonDateAllowed) + skip 제외.
// 타임은 곱하지 않음 (하루 2타임이어도 1일로 카운트).
export function countLessonDays(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  classDays: string[] | null | undefined,
  skipDates?: string[] | null,
): number {
  if (!startDate || !endDate || !classDays || classDays.length === 0) return 0;
  const targetDays = classDays
    .map((d) => _DAY_NUM[String(d).trim()])
    .filter((n) => n !== undefined);
  if (targetDays.length === 0) return 0;
  const skipSet = new Set(skipDates || []);
  const cur = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  if (isNaN(cur.getTime()) || isNaN(end.getTime())) return 0;
  let count = 0;
  while (cur <= end) {
    if (targetDays.includes(cur.getDay())) {
      const ds = _localStr(cur);
      if (!skipSet.has(ds) && isLessonDateAllowed(cur, ds)) count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
