export type GuardianName = { kor: string; eng: string; [key: string]: unknown };

/** Keep legacy fields and unrelated guardian metadata when editing names. */
export function normalizeGuardians(value: unknown): GuardianName[] {
  let raw = value;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(raw)) return [];
  return raw.map(g => {
    const item = typeof g === 'string' ? { kor: g } : (g && typeof g === 'object' ? g : {});
    return { ...item, kor: String(item.kor || item.kr || item.name_kr || item.name || '').trim(), eng: String(item.eng || item.en || item.name_en || item.english || '').trim() };
  });
}

export function tutorGuardians(booking: { booker_name?: string; booker_english?: string; extra_guardians?: unknown }) {
  const seen = new Set<string>();
  return [{ kor: booking.booker_name || '', eng: booking.booker_english || '' }, ...normalizeGuardians(booking.extra_guardians)]
    .filter(g => {
      const key = `${g.kor.trim().toLowerCase()}|${g.eng.trim().toLowerCase()}`;
      if (key === '|' || seen.has(key)) return false;
      seen.add(key); return true;
    }).map(g => ({ name_kr: g.kor, name_en: g.eng, age: '' }));
}
