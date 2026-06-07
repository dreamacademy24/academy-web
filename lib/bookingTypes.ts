// 부킹 타입 단일 source — 손님(/booking)과 어드민(/admin/bookings)이 공유

export type BookingTypeValue =
  | "dreamhouse"
  | "dreamhouse_jaypark"
  | "dreamhouse_cubenine"
  | "jaypark"
  | "cubenine"
  | "commute"
  | "room_only";

export interface BookingTypeDef {
  value: BookingTypeValue;
  label: string;
  desc: string;
  icon: string;
}

// 손님 페이지 5종 (통학형은 /booking2로 이동)
export const PUBLIC_BOOKING_TYPES: BookingTypeDef[] = [
  { value: "dreamhouse",          icon: "🏠", label: "드림하우스 단독",  desc: "드림하우스 패키지" },
  { value: "dreamhouse_jaypark",  icon: "🏨", label: "드하 + 제이파크", desc: "드림하우스 + 제이파크 조합" },
  { value: "dreamhouse_cubenine", icon: "🏢", label: "드하 + 큐브나인", desc: "드림하우스 + 큐브나인 조합" },
  { value: "jaypark",             icon: "🏨", label: "제이파크 단독",    desc: "제이파크 패키지" },
  { value: "cubenine",            icon: "🏢", label: "큐브나인 단독",    desc: "큐브나인 패키지" },
];

// 어드민 전용 추가 옵션 (통학형 + 숙소만)
export const ADMIN_ONLY_BOOKING_TYPES: BookingTypeDef[] = [
  { value: "commute",             icon: "🚶", label: "통학형",           desc: "숙소 없이 학원만" },
  { value: "room_only",           icon: "🛏️", label: "숙소만",           desc: "숙소만 (어드민 전용)" },
];

// 어드민 풀 셋 (손님 6종 + 어드민 전용)
export const ADMIN_BOOKING_TYPES: BookingTypeDef[] = [
  ...PUBLIC_BOOKING_TYPES,
  ...ADMIN_ONLY_BOOKING_TYPES,
];

// ── 통학형 단일 판별 (Single Source of Truth) ──
// 정식 필드는 booking_type='commute' 이지만, 과거 데이터는 accom_type='통학형'만
// 채워진 경우가 있어 두 필드를 모두 확인한다. 예약 레코드 판별은 항상 이 함수 사용.
export function isCommuteBooking(
  b: { booking_type?: string | null; accom_type?: string | null } | null | undefined
): boolean {
  if (!b) return false;
  return b.booking_type === "commute" || b.accom_type === "통학형";
}
