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

// 손님 페이지 6종 (어드민도 동일 6종 사용)
export const PUBLIC_BOOKING_TYPES: BookingTypeDef[] = [
  { value: "dreamhouse",          icon: "🏠", label: "드림하우스 단독",  desc: "드림하우스 패키지" },
  { value: "dreamhouse_jaypark",  icon: "🏨", label: "드하 + 제이파크", desc: "드림하우스 + 제이파크 조합" },
  { value: "dreamhouse_cubenine", icon: "🏢", label: "드하 + 큐브나인", desc: "드림하우스 + 큐브나인 조합" },
  { value: "jaypark",             icon: "🏨", label: "제이파크 단독",    desc: "제이파크 패키지" },
  { value: "cubenine",            icon: "🏢", label: "큐브나인 단독",    desc: "큐브나인 패키지" },
  { value: "commute",             icon: "🚶", label: "통학형",           desc: "숙소 없이 학원만" },
];

// 어드민 전용 추가 옵션
export const ADMIN_ONLY_BOOKING_TYPES: BookingTypeDef[] = [
  { value: "room_only",           icon: "🛏️", label: "숙소만",           desc: "숙소만 (어드민 전용)" },
];

// 어드민 풀 셋 (손님 6종 + 어드민 전용)
export const ADMIN_BOOKING_TYPES: BookingTypeDef[] = [
  ...PUBLIC_BOOKING_TYPES,
  ...ADMIN_ONLY_BOOKING_TYPES,
];
