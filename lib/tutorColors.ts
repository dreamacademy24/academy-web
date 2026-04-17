export const TUTOR_COLORS: Record<string, string> = {
  'T.Ann':     '#3b82f6',
  'T.Angel':   '#8b5cf6',
  'T.Carla':   '#10b981',
  'T.Amelyn':  '#ec4899',
  'T.Cristel': '#f59e0b',
};

export const TUTOR_COLOR_DEFAULT = '#94a3b8';

export function getTutorColor(nameDisplay: string | null | undefined): string {
  if (!nameDisplay) return TUTOR_COLOR_DEFAULT;
  return TUTOR_COLORS[nameDisplay] || TUTOR_COLOR_DEFAULT;
}
