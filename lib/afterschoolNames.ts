// 애프터스쿨/필드트립 프로그램명 영↔한 매칭 + 표준 표기 (2026-06-12 메이 제공)
// 한국인 페이지 → toKR(), 현지직원 페이지 → toEN(). 사전에 없으면 원문 그대로.
// [매칭키(영문, 느슨), 표준 영문 표기, 한글 표기]

const ENTRIES: Array<[key: string, en: string, kr: string]> = [
  ["hula hoop and jump rope activities", "Hula Hoop & Jump Rope", "훌라후프 및 줄넘기 활동"],
  ["interactive book hunt and puzzle game", "Book Hunt & Puzzle Game", "책 탐색 활동 및 퍼즐게임"],
  ["red light green light and team treasure hunt", "Red Light Green Light & Team Treasure Hunt", "신호등 게임 및 보물 찾기"],
  ["crocolandia", "Crocolandia", "악어 및 파충류 관찰 (크로코랜디아)"],
  ["water gun fun", "Water Gun Fun", "물총놀이"],
  ["mini olympics", "Mini Olympics", "미니 올림픽"],
  ["plant observation activity using handmade color magnifiers", "Plant Observation with Color Magnifiers", "색깔 확대경 식물 관찰"],
  ["nature walk and jackfruit maze", "Nature Walk & Jackfruit Maze", "베이스워터 산책 및 열대과일 테마 미로"],
  ["kids cafe", "Kids Café", "키즈 카페"],
  ["flower arrangement", "Flower Arrangement", "꽃꽂이 활동 수업"],
  ["balloon tennis", "Balloon Tennis", "풍선 테니스"],
  ["origami activity and paper airplane flying contest", "Origami Activity & Paper Airplane", "종이접기 및 비행기 날리기"],
  ["snack grabbing game and obstacle course game", "Snack Grabbing Game + Obstacle Course", "간식 잡기 및 장애물 코스 게임"],
  ["nimo brew", "Nimo Brew", "파충류 체험 (니모브루)"],
  ["eco planting and herb", "Eco Planting & Herb", "친환경 식물 심기 및 허브 심기"],
  ["pinwheel activity", "Pinwheel Activity", "바람개비 게임"],
  ["sm seaside sm skating", "SM Seaside — SM Skating", "아이스 스케이팅 (SM 씨사이드)"],
  ["gross motor", "Gross Motor", "체육 중심 신체활동 수업"],
  ["hand baseball and hide and seek", "Hand Baseball & Hide and Seek", "손야구 및 숨바꼭질"],
  ["hand baseball", "Hand Baseball", "손 야구 게임"],
  ["badminton and dodge ball", "Badminton & Dodge Ball", "배드민턴 및 피구 게임"],
  ["badminton", "Badminton", "배드민턴 활동 수업"],
  ["shrine tour", "Shrine Tour", "쉬라인 투어"],
  ["art activities using leaves grass and flowers", "Art with Leaves, Grass & Flowers", "나뭇잎·풀·꽃 미술 활동"],
  ["magellans cross", "Magellan's Cross", "마젤란 십자가"],
];

/* 영문 정규화: 소문자 · &/+→and · 특수문자 제거 · 흔한 오타 흡수 (fying, ballon 등) */
export function normEn(s: string): string {
  return s
    .toLowerCase()
    .replace(/&|\+/g, " and ")
    .replace(/['’"“”(),.—-]/g, " ")
    .replace(/\bfying\b/g, "flying")
    .replace(/\bballon\b/g, "balloon")
    .replace(/café/g, "cafe")
    .replace(/[^a-z0-9가-힣 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normKr(s: string): string {
  return s.replace(/[\s·,“”"'()]/g, "").trim();
}

const EN_IDX = new Map<string, [string, string, string]>();
const KR_IDX = new Map<string, [string, string, string]>();
for (const e of ENTRIES) {
  EN_IDX.set(e[0], e);
  EN_IDX.set(normEn(e[1]), e);
  KR_IDX.set(normKr(e[2]), e);
}

function findEntry(title: string): [string, string, string] | null {
  const ne = normEn(title);
  if (EN_IDX.has(ne)) return EN_IDX.get(ne)!;
  const nk = normKr(title);
  if (KR_IDX.has(nk)) return KR_IDX.get(nk)!;
  for (const [key, e] of EN_IDX) {
    if (ne.length >= 6 && (key.includes(ne) || ne.includes(key))) return e;
  }
  for (const [key, e] of KR_IDX) {
    if (nk.length >= 3 && (key.includes(nk) || nk.includes(key))) return e;
  }
  return null;
}

/* 한국인 페이지 표시 */
export function toKR(title: string | null | undefined): string {
  if (!title) return "";
  const e = findEntry(title);
  return e ? e[2] : title;
}

/* 현지직원 페이지 표시 — 표준 영문 표기 */
export function toEN(title: string | null | undefined): string {
  if (!title) return "";
  const e = findEntry(title);
  return e ? e[1] : title;
}

/* DB 정리용 — 표준 영문 표기 (매칭 안 되면 null) */
export function canonicalEN(title: string | null | undefined): string | null {
  if (!title) return null;
  const e = findEntry(title);
  return e ? e[1] : null;
}
