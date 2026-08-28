// 색상: 현재 활성 화상영어 튜터 7명 + 과거(비활성) 튜터도 이력 표시용으로 유지
export const TUTOR_COLORS: Record<string, string> = {
  // 활성
  'T.Florefe':  '#f97316',
  'T.Jean':     '#0ea5e9',
  'T.Jenny':    '#a855f7',
  'T.Angelica': '#ec4899',
  'T.Nick':     '#14b8a6',
  'T.Ann':      '#3b82f6',
  'T.Carla':    '#10b981',
  // 과거(비활성) — 지난 세션 색상 유지용
  'T.Angel':    '#8b5cf6',
  'T.Amelyn':   '#f43f5e',
  'T.Cristel':  '#f59e0b',
};

export const TUTOR_COLOR_DEFAULT = '#94a3b8';

export function getTutorColor(nameDisplay: string | null | undefined): string {
  if (!nameDisplay) return TUTOR_COLOR_DEFAULT;
  return TUTOR_COLORS[nameDisplay] || TUTOR_COLOR_DEFAULT;
}
