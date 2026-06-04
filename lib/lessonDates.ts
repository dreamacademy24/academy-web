// 튜터 수업일/셔틀 신청 공통 날짜 제약 — 서버/클라 양쪽에서 사용 가능한 순수 함수.
//
// 1) 휴일: 아래 날짜는 수업/신청 불가 (예: 6/12 금요일)
// 2) 토요일: 매월 둘째·넷째 주 토요일(= Math.ceil(getDate()/7) ∈ {2,4})만 수업 가능
//    (필드트립이 있는 주에만 운영)

export const LESSON_HOLIDAYS = new Set<string>([
  "2026-06-12",
]);

export function isHolidayDate(ds: string): boolean {
  return LESSON_HOLIDAYS.has(ds);
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
