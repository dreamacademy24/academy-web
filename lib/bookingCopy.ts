// 재방문 손님용 "예약 복사" — 기존 예약의 예약자·보호자·학생·숙소 유형을 새 접수 폼에 프리필
// 날짜·항공편·결제는 복사하지 않는다 (새로 입력)
// 사용: 어드민에서 copyBookingUrl(b) 로 새 탭 열기 → /booking?copy=<id> 또는 /booking2?copy=<id>

export type CopyStudent = { korName: string; engName: string; age: string; grade: "킨더" | "주니어"; photo: "O" | "X" };

export interface CopySource {
  id: string;
  reservation_no?: string | null;
  booker_name?: string | null;
  booker_english?: string | null;
  booker_phone?: string | null;
  accom_type?: string | null;
  booking_type?: string | null;
  extra_guardians?: unknown;
  dh_weeks?: number | null; jp_weeks?: number | null; cn_period?: string | null;
  jp_room_type?: string | null; cn_room_type?: string | null;
  accom_weeks?: number | null;
  academy_option?: unknown;
  agency?: string | null;
}

/** 단독/통학형(비패키지)이면 /booking2, 그 외 패키지면 /booking */
export function isNonPackage(b: Pick<CopySource, "accom_type" | "booking_type">): boolean {
  const at = String(b.accom_type || "");
  if (at.includes("통학")) return true;
  if (at.includes("단독")) return true;
  if (String(b.booking_type || "").includes("commute")) return true;
  return false;
}

export function copyBookingUrl(b: Pick<CopySource, "id" | "accom_type" | "booking_type">): string {
  return (isNonPackage(b) ? "/booking2" : "/booking") + "?copy=" + encodeURIComponent(b.id);
}

/** 패키지 폼(/booking) BookingType 값으로 변환 */
export function packageTypeFromAccom(accomType: string | null | undefined): string {
  const at = String(accomType || "");
  const dh = at.includes("드림하우스"), jp = at.includes("제이파크"), cn = at.includes("큐브");
  if (dh && jp) return "dreamhouse_jaypark";
  if (dh && cn) return "dreamhouse_cubenine";
  if (jp && cn) return "jaypark_cubenine";
  if (jp) return "jaypark";
  if (cn) return "cubenine";
  return "dreamhouse";
}

/** 비패키지 폼(/booking2) NPType 값으로 변환 */
export function nonPackageTypeFromAccom(b: Pick<CopySource, "accom_type" | "academy_option">): string {
  const at = String(b.accom_type || "");
  if (at.includes("통학")) return "commute";
  if (at.includes("제이파크")) return "jp_only";
  if (at.includes("큐브")) return "cn_only";
  // 드림하우스 단독: 아카데미 옵션이 있었으면 드하+드림아카데미
  const opt = b.academy_option as { enabled?: boolean } | string | null | undefined;
  const hadAcademy = !!(opt && (typeof opt === "string" ? opt !== "" && opt !== "null" : (opt as { enabled?: boolean }).enabled));
  return hadAcademy ? "dh_da" : "dh_only";
}

export function copyGuardians(raw: unknown): { kor: string; eng: string }[] {
  let arr: unknown = raw;
  if (typeof raw === "string") { try { arr = JSON.parse(raw); } catch { arr = []; } }
  if (!Array.isArray(arr)) return [];
  return arr.map((g) => {
    const o = (g || {}) as Record<string, unknown>;
    return { kor: String(o.kor ?? o.name ?? o.korName ?? ""), eng: String(o.eng ?? o.eng_name ?? o.engName ?? "") };
  }).filter((g) => g.kor || g.eng);
}

/** /api/bookings/[id] 응답의 students(테이블 row 또는 JSONB 정규화본) → 폼 학생 */
export function copyStudents(rows: unknown): CopyStudent[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const s = (r || {}) as Record<string, unknown>;
    const kor = String(s.name_kr ?? s.korName ?? "").trim();
    const eng = String(s.name_en ?? s.engName ?? "").trim();
    const age = String(s.age ?? s.birth_date ?? "").trim();
    const lv = String(s.level ?? "").toLowerCase();
    const grade: "킨더" | "주니어" = (lv === "kinder" || String(s.grade ?? s.class_type ?? "").includes("킨더")) ? "킨더" : "주니어";
    const photoAllowed = s.photo_allowed === undefined ? (s.photo === undefined ? true : s.photo === "O") : !!s.photo_allowed;
    const photo: "O" | "X" = photoAllowed ? "O" : "X";
    return { korName: kor, engName: eng, age, grade, photo };
  }).filter((s) => s.korName);
}

/** 폼에서 호출: copy 파라미터가 있으면 예약 원본을 가져온다 */
export async function fetchCopySource(copyId: string): Promise<{ booking: CopySource; students: CopyStudent[] } | null> {
  try {
    const r = await fetch("/api/bookings/" + encodeURIComponent(copyId), { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.booking) return null;
    return { booking: j.booking as CopySource, students: copyStudents(j.students) };
  } catch { return null; }
}
