// 체크인 카드/픽업용 — 콤보 예약(제이파크+드림하우스 등)에서 "첫 숙소" 기준 정보 산출
// 양지나 케이스: seg1=제이파크 → 공항 픽업·체크인카드는 제이파크로 나와야 함

export interface ComboBooking {
  accom_type?: string | null;
  accom_room?: string | null;
  house_no?: string | null;
  booking_type?: string | null;
  seg1_type?: string | null;
  seg1_checkin?: string | null;
  seg1_checkout?: string | null;
  seg2_type?: string | null;
  seg2_checkin?: string | null;
  seg2_checkout?: string | null;
}

const ACC_KR: Record<string, string> = {
  jaypark: "제이파크", dreamhouse: "드림하우스", cubenine: "큐브나인",
};

export function isCombo(b: ComboBooking): boolean {
  return !!(b.seg1_type && b.seg2_type);
}

/** 첫 숙소(입국 시 가는 곳) 이름 — 콤보면 seg1, 아니면 accom_type 기반 */
export function firstAccomName(b: ComboBooking): string {
  if (isCombo(b)) return ACC_KR[b.seg1_type!] || b.seg1_type || "드림하우스";
  const at = String(b.accom_type || "");
  if (at.includes("제이파크")) return "제이파크";
  if (at.includes("큐브")) return "큐브나인";
  return "드림하우스";
}

/** 체크인 카드에 찍을 룸/숙소 라벨.
 *  - 제이파크/큐브나인이 첫 숙소면 리조트명만 (룸번호 없음)
 *  - 드림하우스면 룸번호(B17 L8 등) */
export function firstAccomRoomLabel(b: ComboBooking): { accom: string; room: string } {
  const name = firstAccomName(b);
  if (name === "드림하우스") {
    const raw = String(b.house_no || b.accom_room || "").trim();
    const m = raw.match(/b?\s*(\d{2})\s*[-_ ]?\s*L?\s*(\d+)/i);
    const room = m ? `B${m[1]} L${m[2]}` : raw;
    return { accom: "DREAM HOUSE", room };
  }
  if (name === "제이파크") return { accom: "J PARK", room: "" };
  if (name === "큐브나인") return { accom: "CUBE NINE", room: "" };
  return { accom: name, room: "" };
}
