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
