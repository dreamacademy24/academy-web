// 견적서/인보이스/숙소페이지 공유 패키지 정보

export type AccomType = "dreamhouse" | "jpark" | "cubenine";
export type PackageDataKey = "dreamhouse_jpark" | "cubenine";

export interface PkgItem { icon: string; title: string; desc?: string; }
export interface ExclusionItem { icon: string; title: string; desc: string; }

// 드림하우스 단독 패키지
export const INCLUSIONS_DH: PkgItem[] = [
  { icon: "🏡", title: "드림하우스 객실 (단독 빌리지)", desc: "수영장 자유 이용 / 단독 하우스 라이프" },
  { icon: "🍱", title: "평일 3식 프리미엄 도시락", desc: "아침/점심/저녁" },
  { icon: "🎓", title: "드림아카데미 정규 수업", desc: "+ 에프터 스쿨 + 주말 체험" },
  { icon: "🚐", title: "공항 픽업 & 드랍", desc: "+ 주말 투어 셔틀" },
  { icon: "💻", title: "무료 화상영어", desc: "출국 전 / 귀국 후 (등록기간만큼)" },
];

// 제이파크 리조트 단독 패키지
export const INCLUSIONS_JP: PkgItem[] = [
  { icon: "🏨", title: "제이파크 리조트 객실", desc: "워터파크 & 비치 자유 이용 (뽀로로 파크 제외)" },
  { icon: "🍽️", title: "리조트 내 모든 레스토랑 30% 할인", desc: "(논끼 제외)" },
  { icon: "🥐", title: "아발론 조식 50% 할인", desc: "보호자 1인 결제 시 6세 미만 무료" },
  { icon: "🍱", title: "평일 3식 프리미엄 도시락", desc: "아침/점심/저녁" },
  { icon: "🎓", title: "드림아카데미 정규 수업", desc: "+ 에프터 스쿨 + 주말 체험" },
  { icon: "🚐", title: "공항 픽업 & 드랍", desc: "+ 주말 투어 셔틀" },
  { icon: "💻", title: "무료 화상영어", desc: "출국 전 / 귀국 후 (등록기간만큼)" },
];

// 통학형 (학원만 이용)
export const INCLUSIONS_COMMUTE: PkgItem[] = [
  { icon: "🎓", title: "드림아카데미 정규 수업", desc: "+ 에프터 스쿨 + 주말 체험" },
  { icon: "💻", title: "무료 화상영어", desc: "출국 전 / 귀국 후 (등록기간만큼)" },
  { icon: "ℹ️", title: "통학형 안내", desc: "숙박/식사/픽드랍 미포함 (학원만 이용)" },
];

// 하위호환: INCLUSIONS_DH_JP를 INCLUSIONS_JP의 alias로 유지
export const INCLUSIONS_DH_JP = INCLUSIONS_JP;

export const INCLUSIONS_C9: PkgItem[] = [
  { icon: "🏨", title: "큐브나인 객실", desc: "조식 포함 / 인피티니 풀 및 시설 자유 이용" },
  { icon: "🍽️", title: "식사 바우처 포함", desc: "1주 기준 10만원 / 더 나인 레스토랑" },
  { icon: "🎓", title: "드림아카데미 정규 수업", desc: "+ 에프터 스쿨 + 주말 체험" },
  { icon: "🚐", title: "공항 픽업 & 드랍", desc: "+ 주말 투어 셔틀" },
  { icon: "💻", title: "무료 화상영어", desc: "출국 전 / 귀국 후 (등록기간만큼)" },
];

export const COMMON_EXCLUSIONS: ExclusionItem[] = [
  { icon: "✈️", title: "왕복 항공권", desc: "별도 구매 필요" },
  { icon: "📋", title: "SSP (필수)", desc: "7,000페소/인 (유효 6개월)" },
  { icon: "💳", title: "SSP-i Card", desc: "4,000페소/인 (유효 1년)" },
  { icon: "📖", title: "교재비 (주니어)", desc: "350페소/권" },
  { icon: "🎨", title: "재료비 (킨더)", desc: "2,500페소/월" },
  { icon: "🛡️", title: "해외여행자 보험", desc: "별도 가입 필수" },
];

export function getInclusionsByAccom(accom: AccomType): PkgItem[] {
  if (accom === "cubenine") return INCLUSIONS_C9;
  if (accom === "jpark") return INCLUSIONS_JP;
  return INCLUSIONS_DH;
}

export function getDataKey(accom: AccomType): PackageDataKey {
  return accom === "cubenine" ? "cubenine" : "dreamhouse_jpark";
}
