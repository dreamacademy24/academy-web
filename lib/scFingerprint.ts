// 학생 캘린더 업데이트 감지용 fingerprint — 신규 학생/일정 변경 시 값이 바뀐다.
// Teacher Hub 빨간 점 뱃지 + Student Calendar 방문 시 읽음 처리에 사용.
import type { SupabaseClient } from "@supabase/supabase-js";

export const SC_SEEN_KEY = "sc_seen_fp";

export async function fetchStudentCalFingerprint(sb: SupabaseClient): Promise<string> {
  try {
    const { data } = await sb
      .from("bookings")
      .select("id, students, checkin_date, checkout_date, accom_weeks, status")
      .in("status", ["영수증발행", "결제완료", "완료"]);
    const parts: string[] = [];
    (data || []).forEach((b: any) => {
      let arr: any[] = [];
      try {
        const p = typeof b.students === "string" ? JSON.parse(b.students) : b.students;
        if (Array.isArray(p)) arr = p;
      } catch { return; }
      arr.forEach((s: any, i: number) => {
        parts.push([
          b.id, i,
          s.korName || s.name_kr || s.name || "",
          s.engName || s.name_en || "",
          String(s.academyStart || s.academy_start || b.checkin_date || "").split("T")[0],
          String(s.academyEnd || s.academy_end || b.checkout_date || "").split("T")[0],
          s.academyWeeks || b.accom_weeks || "",
        ].join("|"));
      });
    });
    parts.sort();
    const str = parts.join("\n");
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return `${h >>> 0}:${parts.length}`;
  } catch {
    return "";
  }
}
