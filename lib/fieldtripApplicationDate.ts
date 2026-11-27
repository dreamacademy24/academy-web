// Legacy application tokens contain month/day only. Resolve against the stay,
// never against the year in which a staff member happens to open the page.
export function fieldtripApplicationDate(
  token: string,
  booking: { checkin_date?: string | null; checkout_date?: string | null } | null | undefined,
  createdAt: string,
): string | null {
  const match = token.trim().match(/^(\d{1,2})-(\d{1,2})-.+$/);
  if (!match) return null;
  const month = Number(match[1]), day = Number(match[2]);
  const make = (year: number) => {
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? d.toISOString().slice(0, 10) : null;
  };
  const start = booking?.checkin_date?.slice(0, 10);
  const end = booking?.checkout_date?.slice(0, 10);
  if (start && end) {
    const matches: string[] = [];
    for (let year = Number(start.slice(0, 4)); year <= Number(end.slice(0, 4)); year++) {
      const date = make(year);
      if (date && date >= start && date <= end) matches.push(date);
    }
    if (matches.length === 1) return matches[0];
  }
  // Unlinked legacy requests use the nearest year to submission, including
  // back-entered past activities. Viewing an old request must not advance it.
  const submitted = createdAt.slice(0, 10);
  const year = Number(submitted.slice(0, 4));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(submitted) || !Number.isFinite(year)) return null;
  const candidates = [year, year + 1, year - 1].map(make).filter((d): d is string => !!d);
  candidates.sort((a, b) => Math.abs(Date.parse(a) - Date.parse(submitted)) - Math.abs(Date.parse(b) - Date.parse(submitted)));
  return candidates[0] || null;
}
