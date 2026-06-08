// 애프터스쿨/필드트립 프로그램 단일 소스 (SSOT) — 어드민·현지직원 페이지 공유
//   토큰 형식: "월-일-키" (예: "5-9-nimobrew") — 토큰 자체가 (날짜 + 프로그램)을 인코딩.
//   ※ 손님 신청폼(app/after-school-fieldtrip)에 새 일정 추가 시 이 표도 갱신 필요.
//      미등록 토큰은 키를 보기 좋게 변환하는 폴백으로 처리됨.

export interface FtProgram { name: string; isFieldtrip: boolean; time: string; }

export const FT_PROGRAMS: Record<string, FtProgram> = {
  // May
  "5-4-origami":      { name: "Origami Activity & Paper Airplane",        isFieldtrip: false, time: "4:20~5:10pm" },
  "5-6-snack":        { name: "Snack Grabbing Game + Obstacle Course",    isFieldtrip: false, time: "4:30~5:20pm" },
  "5-9-nimobrew":     { name: "Nimo Brew",                                isFieldtrip: true,  time: "픽업 10:15~20" },
  "5-11-ecoplanting": { name: "Eco Planting & Herb",                      isFieldtrip: false, time: "4:20~5:10pm" },
  "5-13-olympics":    { name: "Mini Olympics",                            isFieldtrip: false, time: "4:30~5:20pm" },
  "5-18-pinwheel":    { name: "Pinwheel Activity",                        isFieldtrip: false, time: "4:20~5:10pm" },
  "5-20-naturewalk":  { name: "Nature Walk & Jackfruit Maze",            isFieldtrip: false, time: "4:30~5:20pm" },
  "5-23-smskating":   { name: "SM Seaside — SM Skating",                  isFieldtrip: true,  time: "픽업 10:15~20" },
  "5-25-watergun":    { name: "Water Gun Fun",                            isFieldtrip: false, time: "4:20~5:10pm" },
  "5-27-hulahoop":    { name: "Hula Hoop & Jump Rope",                    isFieldtrip: false, time: "4:30~5:20pm" },
  // June
  "6-1-flower":       { name: "Flower Arrangement",                       isFieldtrip: false, time: "4:20~5:10pm" },
  "6-3-grossmotor":   { name: "Gross Motor",                              isFieldtrip: false, time: "4:30~5:20pm" },
  "6-8-baseball":     { name: "Hand Baseball",                            isFieldtrip: false, time: "4:20~5:10pm" },
  "6-10-trafficlight":{ name: "Red Light Green Light & Team Treasure Hunt", isFieldtrip: false, time: "4:30~5:20pm" },
  "6-13-shrine":      { name: "Shrine Tour",                              isFieldtrip: true,  time: "픽업 10:15~20" },
  "6-15-watergun":    { name: "Water Gun Fun",                            isFieldtrip: false, time: "4:20~5:10pm" },
  "6-17-olympics":    { name: "Mini Olympics",                            isFieldtrip: false, time: "4:30~5:20pm" },
  "6-22-natureart":   { name: "Art with Leaves, Grass & Flowers",        isFieldtrip: false, time: "4:20~5:10pm" },
  "6-24-naturewalk":  { name: "Nature Walk & Jackfruit Maze",            isFieldtrip: false, time: "4:30~5:20pm" },
  "6-27-magellan":    { name: "Magellan's Cross",                         isFieldtrip: true,  time: "픽업 10:15~20" },
  "6-29-watergun":    { name: "Water Gun Fun",                            isFieldtrip: false, time: "4:20~5:10pm" },
};

export const KR_DOW = ["일", "월", "화", "수", "목", "금", "토"];

// 토큰 파싱 → {month, day, key}
export function parseToken(token: string): { month: number; day: number; key: string } | null {
  const m = token.trim().match(/^(\d{1,2})-(\d{1,2})-(.+)$/);
  if (!m) return null;
  return { month: Number(m[1]), day: Number(m[2]), key: m[3] };
}

// 토큰의 프로그램 표시명 (매핑 없으면 키를 보기 좋게 변환)
export function programNameOf(token: string, key: string): string {
  const meta = FT_PROGRAMS[token];
  if (meta) return meta.name;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// ─────────────────────────────────────────────────────────────
// 배포(schedule_items) 연동 — 손님폼/어드민/티쳐뷰 공유 (SSOT)
//   schedule_items: { id, type:"afterschool"|"fieldtrip", date:"YYYY-MM-DD", title, description, is_deployed, deploy_month }
//   배포된 일정이 진실원본. 토큰은 "월-일-키"를 유지하되, 프로그램명은 날짜로 배포 일정에서 조회.
// ─────────────────────────────────────────────────────────────
export interface DeployedScheduleItem {
  id: string;
  type: "afterschool" | "fieldtrip" | "shuttle";
  date: string;            // "YYYY-MM-DD"
  title: string;
  description: string | null;
  is_deployed: boolean;
  deploy_month: string | null;
}

// FT_PROGRAMS(하드코딩 5·6월 2026)을 배포 항목 형태로 변환 — 배포 누락분 폴백 베이스라인
export function ftProgramsAsItems(year = 2026): DeployedScheduleItem[] {
  return Object.entries(FT_PROGRAMS).map(([token, meta]) => {
    const p = parseToken(token)!;
    const date = `${year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    return {
      id: `ft_${token}`,
      type: meta.isFieldtrip ? "fieldtrip" : "afterschool",
      date, title: meta.name, description: null,
      is_deployed: true, deploy_month: date.slice(0, 7),
    } as DeployedScheduleItem;
  });
}

// 배포 일정 + 하드코딩 베이스라인 병합 (같은 날짜는 배포가 우선) — 손님폼/티쳐뷰 데이터 손실 방지
export function mergeWithFallback(deployed: DeployedScheduleItem[]): DeployedScheduleItem[] {
  const byMd: Record<string, DeployedScheduleItem> = {};
  for (const it of ftProgramsAsItems()) byMd[mdFromDate(it.date)] = it;
  for (const it of deployed) byMd[mdFromDate(it.date)] = it; // 실제 배포가 덮어씀
  return Object.values(byMd).sort((a, b) => a.date.localeCompare(b.date));
}

// 배포된 애프터스쿨/필드트립 일정 로드 (is_deployed=true)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadDeployedSchedule(sb: any): Promise<DeployedScheduleItem[]> {
  const { data } = await sb
    .from("schedule_items").select("*")
    .in("type", ["afterschool", "fieldtrip"])
    .eq("is_deployed", true)
    .order("date", { ascending: true });
  return ((data as DeployedScheduleItem[]) || []).filter((d) => d.type !== "shuttle");
}

// "YYYY-MM-DD" → "월-일" (예: "2026-07-06" → "7-6")
export function mdFromDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}-${d}`;
}

// 배포 일정 배열 → "월-일" 키 맵
export function buildScheduleByMd(items: DeployedScheduleItem[]): Record<string, DeployedScheduleItem> {
  const map: Record<string, DeployedScheduleItem> = {};
  for (const it of items) map[mdFromDate(it.date)] = it;
  return map;
}

// 신규 신청용 토큰 (배포 항목 기준). 예: "7-6-as" / "7-11-ft"
export function tokenForItem(it: DeployedScheduleItem): string {
  return `${mdFromDate(it.date)}-${it.type === "fieldtrip" ? "ft" : "as"}`;
}

// 요일·유형으로 표시 시간 결정 (배포엔 시간 미저장)
export function timeOfDate(dateStr: string, type: string): string {
  if (type === "fieldtrip") return "픽업 10:15~20";
  const dow = new Date(dateStr + "T00:00:00").getDay();
  return dow === 1 ? "4:20~5:10pm" : "4:30~5:20pm";
}

// 통합 해석: 배포 일정 우선 → FT_PROGRAMS → 키 폴백. (어드민/티쳐뷰 공유)
export function resolveProgram(
  token: string,
  byMd: Record<string, DeployedScheduleItem>
): { month: number; day: number; name: string; isFieldtrip: boolean; time: string } | null {
  const p = parseToken(token);
  if (!p) return null;
  const it = byMd[`${p.month}-${p.day}`];
  if (it) {
    return {
      month: p.month, day: p.day,
      name: it.title || programNameOf(token, p.key),
      isFieldtrip: it.type === "fieldtrip",
      time: timeOfDate(it.date, it.type),
    };
  }
  const meta = FT_PROGRAMS[token];
  return {
    month: p.month, day: p.day,
    name: meta ? meta.name : programNameOf(token, p.key),
    isFieldtrip: meta ? meta.isFieldtrip : p.key === "ft",
    time: meta ? meta.time : "",
  };
}
