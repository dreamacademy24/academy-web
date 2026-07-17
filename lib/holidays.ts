// 배포된 휴일 단일 소스 — 부킹 팝업 · 포털 사전안내 · 셔틀/튜터/애프터스쿨 차단이 모두 이걸 읽는다
// 휴일 배포: /admin/afterschool-fieldtrip 배포 탭 → holidays 테이블 (is_deployed=true)
//
// ⚠️ 중요(재발 방지): 여기서의 읽기는 "로그인 세션과 무관한 anon 전용 클라이언트"로만 수행한다.
// 공용 supabase 클라이언트는 localStorage에 로그인(authenticated) 세션이 있으면 그 JWT로 요청을 보낸다.
// holidays RLS가 anon만 허용하던 시절엔 로그인 상태에서 조회가 0건으로 막혀 "휴일이 사라진 것처럼" 보였다.
// 아래 전용 클라이언트는 세션을 절대 붙이지 않으므로 로그인 여부와 상관없이 항상 읽힌다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { setExtraLessonHolidays } from "@/lib/lessonDates";

export interface HolidayItem { date: string; name: string }

let _pub: SupabaseClient | null = null;
// 세션 미부착 anon 전용 클라이언트 (persistSession:false → localStorage 세션을 읽지 않음)
function publicClient(): SupabaseClient {
  if (!_pub) _pub = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, storageKey: "sb-public-readonly" } }
  );
  return _pub;
}

// sb 인자는 하위 호환용으로 받되 무시한다 (항상 anon 전용 클라이언트로 읽어 로그인 여부와 무관하게 동작)
export async function fetchDeployedHolidays(_sb?: SupabaseClient): Promise<HolidayItem[]> {
  try {
    const { data } = await publicClient().from("holidays").select("date,name").eq("is_deployed", true).order("date");
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

/* 비패키지(숙소만/booking2)용 — 수업·식사 언급 없이 드림센터 휴무만 안내 */
export const HOLIDAY_NOTICE_LINES_ROOMONLY = [
  { icon: "🏖", text: "드림센터(헬퍼 · 셔틀 · 관리실) 휴무일입니다", bg: "#fef2f2", color: "#b91c1c", ic: "#dc2626" },
  { icon: "!", text: "휴무일에 대한 별도 환불 · 보강은 없습니다", bg: "#fffbeb", color: "#92400e", ic: "#b45309" },
] as const;

/* 튜터 수업 날짜 전개(lib/lessonDates)에 배포 휴일을 주입 — 페이지 mount 시 1회 호출 */
export async function applyDeployedHolidaysToLessons(_sb?: SupabaseClient): Promise<HolidayItem[]> {
  const list = await fetchDeployedHolidays();
  setExtraLessonHolidays(list.map(h => h.date));
  return list;
}
