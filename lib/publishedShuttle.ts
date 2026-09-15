import { getShSlots, type ShSlot } from './shuttleTours';

export interface PublishedShuttle { id: string; date: string; title: string; description: string | null; }

// A published month is authoritative: deleted dates must not reappear from the template.
export function publishedShuttleSlots(date: string, rows: PublishedShuttle[], holidays: Set<string>): ShSlot[] | 'holiday' {
  const fallback = getShSlots(date, holidays);
  if (fallback === 'holiday') return fallback;
  if (!rows.some(row => row.date.slice(0, 7) === date.slice(0, 7))) return fallback;
  return rows.filter(row => row.date === date).map(row => {
    const known = Array.from({ length: 14 }, (_, i) => getShSlots(`2026-09-${String(7 + i).padStart(2, '0')}`))
      .flatMap(slots => slots === 'holiday' ? [] : slots).find(slot => slot.name === row.title);
    const description = (row.description || '').trim();
    const [departure, back] = description.split(/\s*·\s*복귀\s*/);
    return { name: row.title, time: departure.replace(/^출발\s*/, '') || known?.time || '',
      return: back || known?.return || '', note: known?.note || '' };
  });
}
