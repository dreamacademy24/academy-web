// 튜터 수업 취소 통합 헬퍼
// - 취소 정보 단일 소스: tutor_lessons.cancellations (jsonb) = { "YYYY-MM-DD": "deduct"|"makeup"|"no_deduct" }
// - 하위호환: 기존 skip_dates 항목은 "deduct"(차감 취소)로 간주
// 표시 규칙: 취소된 날짜는 화면에서 숨기지 않고 "취소"로 표기
// 청구 규칙: resolution === "deduct" 인 날짜만 회차/인보이스에서 제외 (보강·미차감은 그대로 청구)

export type CancelResolution = "deduct" | "makeup" | "no_deduct";

export interface CancellableLesson {
  skip_dates?: string[] | null;
  cancellations?: Record<string, string> | null;
}

// 날짜 → 처리방법 맵 (skip_dates 병합, cancellations 우선)
export function cancelMap(lesson: CancellableLesson | null | undefined): Record<string, CancelResolution> {
  const out: Record<string, CancelResolution> = {};
  if (!lesson) return out;
  const skips = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
  for (const d of skips) {
    if (d) out[d] = "deduct";
  }
  const c = lesson.cancellations && typeof lesson.cancellations === "object" ? lesson.cancellations : {};
  for (const [d, v] of Object.entries(c)) {
    const r = String(v) as CancelResolution;
    if (d && (r === "deduct" || r === "makeup" || r === "no_deduct")) out[d] = r;
  }
  return out;
}

export function isCancelled(lesson: CancellableLesson | null | undefined, date: string): boolean {
  if (!date) return false;
  return date in cancelMap(lesson);
}

// 청구 제외 대상(=차감 취소)인지
export function isDeducted(lesson: CancellableLesson | null | undefined, date: string): boolean {
  return cancelMap(lesson)[date] === "deduct";
}

// 취소 처리방법 라벨
export function resolutionLabelKR(r: string | undefined): string {
  return r === "deduct" ? "차감" : r === "makeup" ? "보강" : r === "no_deduct" ? "미차감" : "취소";
}
export function resolutionLabelEN(r: string | undefined): string {
  return r === "deduct" ? "Deducted" : r === "makeup" ? "Makeup" : r === "no_deduct" ? "No deduction" : "Cancelled";
}

// 수업에 취소/변경 이력이 하나라도 있는지 (선생님 알림 느낌표용)
export function hasAnyCancellation(lesson: CancellableLesson | null | undefined): boolean {
  return Object.keys(cancelMap(lesson)).length > 0;
}
