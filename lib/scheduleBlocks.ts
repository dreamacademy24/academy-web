export function blocksToTimeOverrides(blocks: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(blocks)) return out;
  for (const b of blocks) {
    if (!b || !b.time || !Array.isArray(b.days)) continue;
    for (const d of b.days) { if (d) out[String(d).trim()] = b.time; }
  }
  return out;
}

// class_focus 등 text[] 컬럼 정규화 — "" 들어가면 22P02 "malformed array literal" 에러
export function toFocusArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter(x => x != null && String(x).trim() !== '');
  if (v && String(v).trim()) return [String(v)];
  return [];
}

// 요일별 시간이 다르면 그룹화 표시. 단일이거나 빈 overrides면 classTime 그대로.
const _KR_DAY_ORDER = ['월','화','수','목','금','토','일'];
const _DAY_EN_MAP: Record<string, string> = { '월':'Mon','화':'Tue','수':'Wed','목':'Thu','금':'Fri','토':'Sat','일':'Sun' };
function _normalizeKR(d: string): string {
  if (!d) return d;
  const krMap: Record<string, string> = { mon:'월', tue:'화', wed:'수', thu:'목', fri:'금', sat:'토', sun:'일' };
  const lower = String(d).toLowerCase().trim();
  return krMap[lower] || d;
}
export function formatLessonTime(
  classTime: string | null | undefined,
  timeOverrides: Record<string, string> | null | undefined,
  classDays: string[] | string | null | undefined,
  lang: 'ko' | 'en' = 'ko'
): string {
  const fallback = (classTime && String(classTime).trim()) || '-';
  const daysArr = Array.isArray(classDays)
    ? classDays
    : (typeof classDays === 'string' ? classDays.split(',') : []);
  const days = daysArr.map((d: string) => _normalizeKR(String(d).trim())).filter(Boolean);
  if (days.length === 0) return fallback;
  if (!timeOverrides || typeof timeOverrides !== 'object') return fallback;

  // 각 요일의 해석 시간 (override 없으면 classTime 폴백)
  const dayTime: Array<{ day: string; time: string }> = [];
  for (const d of days) {
    const t = (timeOverrides as Record<string, string>)[d] || classTime || '';
    if (t) dayTime.push({ day: d, time: t });
  }
  if (dayTime.length === 0) return fallback;

  const uniqueTimes = new Set(dayTime.map(x => x.time));
  if (uniqueTimes.size <= 1) return fallback;

  // 시간별 요일 그룹화
  const byTime = new Map<string, string[]>();
  for (const { day, time } of dayTime) {
    const arr = byTime.get(time) || [];
    arr.push(day);
    byTime.set(time, arr);
  }
  const stripSuffix = (t: string) => t.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const groups = Array.from(byTime.entries()).sort((a, b) =>
    Math.min(...a[1].map(d => _KR_DAY_ORDER.indexOf(d))) -
    Math.min(...b[1].map(d => _KR_DAY_ORDER.indexOf(d)))
  );
  return groups.map(([time, gdays]) => {
    const sd = [...gdays].sort((a, b) => _KR_DAY_ORDER.indexOf(a) - _KR_DAY_ORDER.indexOf(b));
    const dayLabel = lang === 'en'
      ? sd.map(d => _DAY_EN_MAP[d] || d).join('·')
      : sd.join('·');
    return `${dayLabel} ${stripSuffix(time)}`;
  }).join(' / ');
}
