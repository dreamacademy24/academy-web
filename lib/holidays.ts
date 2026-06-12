// 배포된 휴일 단일 소스 — 부킹 팝업 · 포털 사전안내 · 셔틀/튜터/애프터스쿨 차단이 모두 이걸 읽는다
// 휴일 배포: /admin/afterschool-fieldtrip 배포 탭 → holidays 테이블 (is_deployed=true)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setExtraLessonHolidays } from "@/lib/lessonDates";

export interface HolidayItem { date: string; name: string }

let _own: SupabaseClient | null = null;
function ownClient(): SupabaseClient {
  if (!_own) _own = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return _own;
}

export async function fetchDeployedHolidays(sb?: SupabaseClient): Promise<HolidayItem[]> {
  try {
    const client = sb || ownClient();
    const { data } = await client.from("holidays").select("date,name").eq("is_deployed", true).order("date");
    return ((data || []) as HolidayItem[]).filter(h => h.date);
  } catch { return []; }
}

/* 기간과 겹치는 휴일 (양 끝 포함) */
export function holidaysInRange(holidays: HolidayItem[], from?: string | null, to?: string | null): HolidayItem[] {
  if (!from || !to) return [];
  const a = from.slice(0, 10), b = to.slice(0, 10);
  return holidays.filter(h => h.date >= a && h.date <= b);
}

export function fmtHolidayList(list: HolidayItem[]): string {
  const DOW = ["일", "월", "화", "수", "목", "금", "토"];
  return list.map(h => {
    const d = new Date(h.date + "T00:00:00");
    return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]}) ${h.name}`.trim();
  }).join(", ");
}

/* 손님 안내 공통 문구 (한 줄 버전) */
export const HOLIDAY_GUEST_NOTICE =
  "휴무일에는 수업·헬퍼·셔틀·관리실이 운영되지 않으며, 식사는 정상 제공됩니다. 휴무일에 대한 별도 환불·보강은 없습니다.";

/* 체크리스트 버전 — 팝업/배너 공통 렌더용 */
export const HOLIDAY_NOTICE_LINES = [
  { icon: "✕", text: "수업 · 헬퍼 · 셔틀 · 관리실 운영하지 않아요", bg: "#fef2f2", color: "#b91c1c", ic: "#dc2626" },
  { icon: "✓", text: "식사는 정상 제공됩니다", bg: "#ecfdf5", color: "#065f46", ic: "#059669" },
  { icon: "!", text: "휴무일에 대한 별도 환불 · 보강은 없습니다", bg: "#fffbeb", color: "#92400e", ic: "#b45309" },
] as const;

/* 튜터 수업 날짜 전개(lib/lessonDates)에 배포 휴일을 주입 — 페이지 mount 시 1회 호출 */
export async function applyDeployedHolidaysToLessons(sb?: SupabaseClient): Promise<HolidayItem[]> {
  const list = await fetchDeployedHolidays(sb);
  setExtraLessonHolidays(list.map(h => h.date));
  return list;
}
