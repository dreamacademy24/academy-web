// 손님 앱(포털) 메뉴 권한 — 예약 카테고리 기본값 + 예약별 오버라이드 (2026-08-25)
// bookings.portal_features (jsonb, null = 자동 기본값) 로 어드민이 개별 조정
import { getBookingCategory, isCommuteBooking } from "./bookingTypes";

export const PORTAL_FEATURES = [
  { key: "checkin", label: "체크인 정보입력", desc: "항공권·체크인·픽드랍" },
  { key: "shuttle", label: "투어 셔틀", desc: "주말 투어 셔틀 신청" },
  { key: "afterschool", label: "애프터스쿨/필드트립", desc: "방과후·현장학습" },
  { key: "tutor", label: "튜터 수업", desc: "방문/아카데미 튜터" },
  { key: "meal", label: "식단", desc: "아카데미 점심·드림하우스 식단" },
  { key: "consultation", label: "상담 예약", desc: "학습 상담" },
] as const;

export type PortalFeatureKey = (typeof PORTAL_FEATURES)[number]["key"];
export type PortalFeatureMap = Record<PortalFeatureKey, boolean>;

type BookingLike = {
  accom_type?: string | null; booking_type?: string | null;
  is_all_in_one?: boolean | null; academy_option?: boolean | null;
  house_no?: string | null; accom_room?: string | null;
  portal_features?: Partial<Record<string, boolean>> | null;
} | null | undefined;

/** 카테고리 규정 기본값 */
export function defaultPortalFeatures(b: BookingLike): PortalFeatureMap {
  const cat = getBookingCategory(b as never);
  const commute = isCommuteBooking(b as never);
  const dhda = cat.comp === "드하+드아";
  // 올인원·패키지: 전부 제공 (통학형 패키지는 숙소 관련 제외)
  if (cat.pkg === "올인원" || cat.pkg === "패키지") {
    return { checkin: !commute, shuttle: !commute, afterschool: !commute, tutor: true, meal: true, consultation: true };
  }
  // 비패키지 드하+드아 (예: 장보운): 셔틀 O · 애프터스쿨 X · 튜터 O
  if (dhda) return { checkin: true, shuttle: true, afterschool: false, tutor: true, meal: true, consultation: true };
  // 비패키지 통학형: 셔틀 X(패키지 전용) · 애프터스쿨 X(참여 불가, 필드트립은 관리자가 개별 오픈) · 튜터 O
  if (commute) return { checkin: false, shuttle: false, afterschool: false, tutor: true, meal: true, consultation: true };
  // 비패키지 숙소 단독 (room only): 투어셔틀 X · 애프터스쿨 X · 튜터 O(리조트=아카데미 내)
  // 큐브나인은 저녁 식사 제공(2026-08-26~) → 식단 탭 O
  const isCube = (b?.accom_type || "").includes("큐브");
  return { checkin: true, shuttle: false, afterschool: false, tutor: true, meal: isCube, consultation: true };
}

/** 기본값 + portal_features 오버라이드 병합 */
export function resolvePortalFeatures(b: BookingLike): PortalFeatureMap {
  const base = defaultPortalFeatures(b);
  const ov = b?.portal_features;
  if (ov && typeof ov === "object") {
    for (const f of PORTAL_FEATURES) {
      const v = (ov as Record<string, unknown>)[f.key];
      if (typeof v === "boolean") base[f.key] = v;
    }
  }
  return base;
}
