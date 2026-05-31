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
