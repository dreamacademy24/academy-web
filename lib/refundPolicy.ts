// 부킹/견적 페이지 공유 환불 규정 데이터

export type RefundPolicyKey = "dreamhouse" | "jpark" | "cubenine";

export interface PolicySection {
  icon: string;
  title: string;
  bullets: string[];
}

export interface RefundPolicy {
  key: RefundPolicyKey;
  label: string;
  title: string;
  sections: PolicySection[];
}

export const COMMON_NOTICE_TEXT =
  "등록 및 환불 규정 미숙지로 인한 피해는 보상되지 않으므로 모든 규정은 필히 확인해주세요.";

const COMMON_PROGRAM_NOTICE: PolicySection = {
  icon: "⚠️",
  title: "프로그램 참여 유의사항",
  bullets: [
    "보호자와 분리 가능한 아동만 수업 참여 가능",
    "아동의 부적응 또는 분리 불가능 사유로 인한 환불 불가",
    "학원 내 부모님 대기 및 수업 참관 불가",
    "수업 및 환불 규정을 반드시 확인해주시고, 등록 후 일정 변경은 불가합니다.",
  ],
};

const COMMON_HOUSE_RULE: PolicySection = {
  icon: "🏠",
  title: "숙소 이용 유의사항",
  bullets: [
    "모든 숙소는 밤 10시 이후 정숙 유지 원칙",
    "타 가정 방문, 과도한 소음, 폭언·폭력 등 위반 시 즉시 퇴소 및 환불 불가",
  ],
};

const COMMON_REFUND_RULE: PolicySection = {
  icon: "🔄",
  title: "환불 및 변경 규정",
  bullets: [
    "1. 등록 후 취소·환불은 아래 4번 환불 기준에 따르며, 일정 변경 및 패키지 일부만 변경·취소는 불가능합니다. (예: 숙소만 이용 / 수업만 이용 / 식사 제외 등 부분 선택 불가)",
    "2. 입실 후 개인 사정으로 인한 중도 퇴실 시 남은 기간에 대한 환불은 불가합니다. 단, 불가항력 사유(천재지변·항공편 결항 등) 발생 시, 현지 상황 및 리조트 운영 상황에 따라 일정 일부 조정이 가능하며 이 경우 반드시 드림 측과 사전 협의 후 조율됩니다.",
    "3. 중대한 질병 또는 출국 불가 등으로 인한 일정 조정은 아래 조건 충족 시 일부 조정 가능: 암·수술 등 연수 기간 내 치료 불가 질환(의사 소견서 제출), 정부 명령·질병·입원 등으로 인한 출국 불가 증빙, 치료 기간이 연수 기간을 초과함을 증빙할 서류 제출",
    "4. 환불 기준 (출국일 기준): ① 잔금 납부 전(출국 8주 이전) 취소 — 예약금 환불 불가, 잔금 청구 없음 ② 출국 8주~6주 전 취소 — 예약금 환불 불가 + 납부한 잔금의 50% 환불 ③ 출국 6주 이내 취소 또는 입실 후 중도 퇴실 — 환불 불가",
    "5. 휴무일 안내: 센터 및 드림센터 휴무일(필리핀 공휴일 등)에 대한 별도 환불은 없습니다. 휴무일에도 식사는 정상 제공됩니다.",
    "6. 사전에 공지되지 않은 필리핀 정부의 갑작스러운 휴일(특별 공휴일) 지정으로 부득이하게 휴무하게 되는 경우가 있으며, 이 경우에도 별도의 환불·보강은 없습니다.",
    "※ 등록 완료 후 일정 변경은 불가합니다.",
    "※ 천재지변 등 불가항력 사유 발생 시 드림 측과 협의 후 일정 일부 조정이 가능합니다.",
  ],
};

// 동의 내역 보관용 규정 버전 — 문구가 바뀔 때마다 날짜 갱신 (booking_consents.policy_version에 저장)
export const REFUND_POLICY_VERSION = "2026-07-28";

const COMMON_INSURANCE: PolicySection = {
  icon: "🛡️",
  title: "보험 안내",
  bullets: [
    "출국 전 해외여행자 보험 가입 필수 권장",
    "미가입으로 인한 손해에 대해서는 학원에서 책임지지 않습니다.",
  ],
};

const COMMON_ETC_TAIL: string[] = [
  "예약 내용, 포함 사항, 납부금, 이용 규정 등 모든 안내 확인은 고객의 책임입니다.",
  "미확인으로 인한 불이익에 대해서는 당사에서 책임지지 않습니다.",
  "본 규정은 등록 시 자동 동의된 것으로 간주되며, 드림아카데미는 운영상 필요에 따라 규정을 보완할 수 있습니다.",
];

// === 드림하우스 ===
const DREAMHOUSE_POLICY: RefundPolicy = {
  key: "dreamhouse",
  label: "드림하우스",
  title: "드림하우스 패키지 규정 안내",
  sections: [
    {
      icon: "💳",
      title: "등록 및 결제 안내",
      bullets: [
        "예약금: 드림하우스 1채당 100만원 (선납 시 등록 완료) — 입금 확인 후 등록 완료",
        "잔금 납부: 잔금은 입실일 기준 2개월 전까지 전액 입금해주셔야 합니다.",
        "등록 완료 후 환불/변경: 등록 완료 후에는 패키지 전체 또는 일부에 대한 환불 및 변경이 불가하오니 신중히 결정 부탁드립니다.",
        "숙소 이용 규정: 필리핀 현지 이웃과 함께 생활하는 빌리지로, 닭 울음·개 짖음·파티 등 생활 소음이 있을 수 있습니다. 문화와 환경 차이를 이해해주시고, 개인 특이사항이 있으시다면 충분한 상담 후 예약 부탁드립니다.",
      ],
    },
    {
      icon: "🌀",
      title: "자연재해 및 불가항력 상황",
      bullets: [
        "태풍, 지진, 홍수 등으로 수업이 불가능한 경우 일정 조정 가능",
        "단, 숙소 및 학원이 정상 운영 가능한 경우 환불 및 변경 불가",
      ],
    },
    COMMON_HOUSE_RULE,
    COMMON_PROGRAM_NOTICE,
    {
      icon: "📌",
      title: "숙소 및 수업 관련 안내",
      bullets: [
        "패키지 정원: 최대 6인 기준",
        "정원 초과 시 숙박 및 수업 제공 불가 (사전 협의 필요)",
        "체크인: 오후 3시 / 체크아웃: 정오 12시",
        "얼리 체크인 또는 레이트 체크아웃 시 규정에 따라 추가 요금 발생",
      ],
    },
    COMMON_REFUND_RULE,
    COMMON_INSURANCE,
    {
      icon: "📎",
      title: "기타 안내",
      bullets: [
        "하우스 배정 및 수업 일정 등은 양측 사정에 따라 변경될 수 있습니다.",
        ...COMMON_ETC_TAIL,
      ],
    },
  ],
};

// === 제이파크 ===
const JPARK_POLICY: RefundPolicy = {
  key: "jpark",
  label: "제이파크",
  title: "제이파크 패키지 등록 및 환불 규정",
  sections: [
    {
      icon: "💳",
      title: "등록 및 결제 안내",
      bullets: [
        "예약금: 제이파크 패키지 예약금은 총 금액의 50% 선입금이며, 입금 확인 후 등록이 완료됩니다. (예약과 동시에 객실 확보가 필요하므로 선입금을 받고 있습니다.)",
        "잔금 납부: 잔금은 입실일 기준 2개월 전까지 전액 입금해주셔야 합니다.",
        "등록 완료 후 환불/변경: 등록 완료 후에는 패키지 전체 또는 일부에 대한 환불 및 변경이 불가하오니 신중히 결정 부탁드립니다.",
        "숙소 이용 규정: 제이파크 리조트 내 숙박 시 호텔의 기본 운영 규정을 반드시 준수해주시기 바랍니다.",
      ],
    },
    {
      icon: "🌀",
      title: "자연재해 및 불가항력 상황",
      bullets: [
        "태풍, 지진, 홍수 등으로 수업이 불가능한 경우 일정 조정 가능",
        "단, 리조트 및 학원이 정상 운영 가능한 경우 환불 및 변경 불가",
      ],
    },
    COMMON_HOUSE_RULE,
    COMMON_PROGRAM_NOTICE,
    {
      icon: "📌",
      title: "숙소 및 수업 관련 안내",
      bullets: [
        "패키지 정원: 최대 4인 기준 (성인 최대 2인)",
        "정원 초과 시 숙박 및 수업 제공 불가 (사전 협의 필요)",
        "체크인: 오후 3시 / 체크아웃: 정오 12시",
        "얼리 체크인 또는 레이트 체크아웃 시 리조트 규정에 따라 추가 요금 발생",
      ],
    },
    COMMON_REFUND_RULE,
    COMMON_INSURANCE,
    {
      icon: "📎",
      title: "기타 안내",
      bullets: [
        "제이파크 리조트 패키지는 드림아카데미 × 제이파크 리조트 제휴 프로그램입니다.",
        "객실 배정 및 수업 일정 등은 양측 사정에 따라 변경될 수 있습니다.",
        ...COMMON_ETC_TAIL,
      ],
    },
  ],
};

// === 큐브나인 ===
const CUBENINE_POLICY: RefundPolicy = {
  key: "cubenine",
  label: "큐브나인",
  title: "큐브나인 패키지 등록 및 환불 규정",
  sections: [
    {
      icon: "💳",
      title: "등록 및 결제 안내",
      bullets: [
        "예약금: 큐브나인 패키지 예약금은 총 금액의 50% 선입금이며, 입금 확인 후 등록이 완료됩니다. (예약과 동시에 객실 확보가 필요하므로 선입금을 받고 있습니다.)",
        "잔금 납부: 잔금은 입실일 기준 2개월 전까지 전액 입금해주셔야 합니다.",
        "등록 완료 후 환불/변경: 등록 완료 후에는 패키지 전체 또는 일부에 대한 환불 및 변경이 불가하오니 신중히 결정 부탁드립니다.",
        "숙소 이용 규정: 큐브나인 리조트 내 숙박 시 호텔의 기본 운영 규정을 반드시 준수해주시기 바랍니다.",
      ],
    },
    {
      icon: "🌀",
      title: "자연재해 및 불가항력 상황",
      bullets: [
        "태풍, 지진, 홍수 등으로 수업이 불가능한 경우 일정 조정 가능",
        "단, 리조트 및 학원이 정상 운영 가능한 경우 환불 및 변경 불가",
      ],
    },
    COMMON_HOUSE_RULE,
    COMMON_PROGRAM_NOTICE,
    {
      icon: "📌",
      title: "숙소 및 수업 관련 안내",
      bullets: [
        "패키지 정원: 최대 4인 기준 (성인 최대 2인)",
        "정원 초과 시 숙박 및 수업 제공 불가 (사전 협의 필요)",
        "체크인: 오후 3시 / 체크아웃: 정오 12시",
        "얼리 체크인 또는 레이트 체크아웃 시 리조트 규정에 따라 추가 요금 발생",
      ],
    },
    COMMON_REFUND_RULE,
    COMMON_INSURANCE,
    {
      icon: "📎",
      title: "기타 안내",
      bullets: [
        "큐브나인 리조트 패키지는 드림아카데미 × 큐브나인 리조트 제휴 프로그램입니다.",
        "객실 배정 및 수업 일정 등은 양측 사정에 따라 변경될 수 있습니다.",
        ...COMMON_ETC_TAIL,
      ],
    },
  ],
};

export const REFUND_POLICIES: Record<RefundPolicyKey, RefundPolicy> = {
  dreamhouse: DREAMHOUSE_POLICY,
  jpark: JPARK_POLICY,
  cubenine: CUBENINE_POLICY,
};

// 부킹 타입 → 표시할 환불 규정 키 매핑
// BookingType union이 영어/한국어 어느 쪽이어도 cover하도록 양쪽 매칭
export function getRefundPolicyKeys(bType: string): RefundPolicyKey[] {
  const lower = bType.toLowerCase();
  const isDH = lower.includes("dream") || lower.includes("dh") || bType.includes("드림");
  const isJP = lower.includes("jpark") || lower.includes("jaypark") || bType.includes("제이파크");
  const isC9 = lower.includes("cube") || bType.includes("큐브");

  // 콤보 (드림하우스 + X)
  if (isDH && isJP) return ["dreamhouse", "jpark"];
  if (isDH && isC9) return ["dreamhouse", "cubenine"];

  // 단독
  if (isJP) return ["jpark"];
  if (isC9) return ["cubenine"];

  // 기본: 드림하우스 (드림하우스 단독, 통학형, 룸오프리 등)
  return ["dreamhouse"];
}
