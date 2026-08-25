// 부킹 타입 단일 source — 손님(/booking)과 어드민(/admin/bookings)이 공유

export type BookingTypeValue =
  | "dreamhouse"
  | "dreamhouse_jaypark"
  | "dreamhouse_cubenine"
  | "jaypark"
  | "cubenine"
  | "jaypark_cubenine"
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
  { value: "jaypark_cubenine",    icon: "🌊", label: "제이파크 + 큐브나인", desc: "제이파크 + 큐브나인 조합" },
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

// ── 콤보 예약 숙소/룸 판별 (Single Source of Truth) ──
// 숙소 코드 → 한글/영문 매핑
export const ACC_KR: Record<string, string> = {
  jaypark: "제이파크",
  dreamhouse: "드림하우스",
  cubenine: "큐브나인",
};
export const ACC_EN: Record<string, string> = {
  jaypark: "J-Park",
  dreamhouse: "Dream House",
  cubenine: "Cube9",
};

/**
 * 콤보 예약에서 특정 날짜에 해당하는 숙소 정보를 반환.
 * - 제이파크 = "J-Park" (룸번호 없음)
 * - 드림하우스 = accom_room 에서 추출 (e.g. "B17L8")
 * - 큐브나인 = "Cube9" (별도 룸번호 없으면 빈값)
 *
 * @param b  예약 레코드 (seg 필드 + house_no/accom_room 포함)
 * @param date  비교 날짜 YYYY-MM-DD (없으면 첫 번째 세그먼트 기준)
 * @returns { segType, nameKr, nameEn, room }
 */
export function resolveComboAccom(
  b: {
    seg1_type?: string | null;
    seg2_type?: string | null;
    seg2_checkin?: string | null;
    house_no?: string | null;
    accom_room?: string | null;
    accom_type?: string | null;
  } | null | undefined,
  date?: string | null
): { segType: string; nameKr: string; nameEn: string; room: string } {
  const fallbackRoom = normalizeDhRoom(
    String(b?.house_no || b?.accom_room || "")
  );

  // 콤보가 아닌 경우 — 단순 폴백
  if (!b?.seg1_type || !b?.seg2_type) {
    const t = b?.accom_type || "";
    const isJp = /제이파크|jaypark/i.test(t);
    const isCn = /큐브나인|cubenine/i.test(t);
    if (isJp) return { segType: "jaypark", nameKr: "제이파크", nameEn: "J-Park", room: "" };
    if (isCn) return { segType: "cubenine", nameKr: "큐브나인", nameEn: "Cube9", room: "" };
    return { segType: "dreamhouse", nameKr: "드림하우스", nameEn: "Dream House", room: fallbackRoom };
  }

  // 콤보: 날짜가 seg2_checkin 이후면 2번째 숙소, 아니면 1번째
  const seg2Start = b.seg2_checkin ? String(b.seg2_checkin).slice(0, 10) : "";
  const inSeg2 = !!(date && seg2Start && date >= seg2Start);
  const segType = inSeg2 ? String(b.seg2_type) : String(b.seg1_type);

  if (segType === "jaypark") {
    return { segType, nameKr: "제이파크", nameEn: "J-Park", room: "" };
  }
  if (segType === "cubenine") {
    return { segType, nameKr: "큐브나인", nameEn: "Cube9", room: "" };
  }
  // dreamhouse
  return { segType, nameKr: "드림하우스", nameEn: "Dream House", room: fallbackRoom };
}

/** DH 룸 번호 정규화: "b17L8" → "B17L8", "dh b17L8" → "B17L8" */
export function normalizeDhRoom(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/^dh/i, "").toUpperCase();
}

/** 콤보 여부 간이 판별 */
export function isComboBooking(
  b: { seg1_type?: string | null; seg2_type?: string | null } | null | undefined
): boolean {
  return !!(b?.seg1_type && b?.seg2_type);
}

// ── 통학형 단일 판별 (Single Source of Truth) ──
// 정식 필드는 booking_type='commute' 이지만, 과거 데이터는 accom_type='통학형'만
// 채워진 경우가 있어 두 필드를 모두 확인한다. 예약 레코드 판별은 항상 이 함수 사용.
export function isCommuteBooking(
  b: { booking_type?: string | null; accom_type?: string | null } | null | undefined
): boolean {
  if (!b) return false;
  return b.booking_type === "commute" || b.accom_type === "통학형";
}

// ── 예약 카테고리 라벨 (패키지 여부 / 서비스 구성) — 2026-08-25
// pkg: "올인원" | "비패키지"
// comp: 드하 / 드하+드아 / 드하+JP / 드하+C9 / JP / JP+드아 / C9 / C9+드아 / 통학(드아)
export function getBookingCategory(b: {
  accom_type?: string | null; booking_type?: string | null;
  is_all_in_one?: boolean | null; academy_option?: boolean | null;
  house_no?: string | null; accom_room?: string | null;
} | null | undefined): { pkg: string; comp: string } {
  if (!b) return { pkg: "-", comp: "-" };
  // 패키지 판정: 올인원 플래그 > accom_type 문구
  //  · "○○ 단독"(booking2 room only) → 비패키지
  //  · "○○ 패키지" / 콤보(+) / 구버전 단일 표기(드림하우스·제이파크·큐브나인) → 패키지
  const at0 = (b.accom_type || "").trim();
  let pkg: string;
  if (b.is_all_in_one) pkg = "올인원";
  else if (isCommuteBooking(b)) pkg = "비패키지";
  else if (at0.includes("단독")) pkg = "비패키지";
  else if (at0.includes("패키지") || at0.includes("+") || ["드림하우스", "제이파크", "큐브나인"].includes(at0)) pkg = "패키지";
  else pkg = "비패키지";
  const at = (b.accom_type || "").toLowerCase();
  // 통학형: 드림하우스 룸 번호 패턴(B13L10 등)이 배정된 경우만 드하+드아 — 외부 숙소/기타 텍스트는 통학으로 유지
  const _roomNorm = normalizeDhRoom(String(b.house_no || b.accom_room || ""));
  const hasDhRoom = /^B\d{1,2}L\d{1,2}$/.test(_roomNorm);
  const ac = b.academy_option === true;
  let comp: string;
  if (isCommuteBooking(b)) comp = hasDhRoom ? "드하+드아" : "통학(드아)";
  else if (at.includes("+")) comp = at.includes("제이파크") ? "드하+JP" : at.includes("큐브") ? "드하+C9" : "콤보";
  else if (at.includes("제이파크")) comp = ac ? "JP+드아" : "JP";
  else if (at.includes("큐브")) comp = ac ? "C9+드아" : "C9";
  else if (at.includes("드림") || at.includes("드하")) comp = ac ? "드하+드아" : "드하";
  else comp = b.accom_type || "-";
  return { pkg, comp };
}
