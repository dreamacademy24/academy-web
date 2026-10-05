/** Resolve chronological day-of-month OCR rows against the menu's start date.
 * Keep the stored menus intact; a smaller day number means the next month.
 * Calendar construction also handles December -> January and leap years.
 */
export function resolveMealDates<T extends { date: number; weekday: string }>(days: T[], startDate: string) {
  const [year, month, firstDay] = startDate.split('-').map(Number);
  let monthIndex = month - 1;
  let previousDay = firstDay;
  return days.map(day => {
    if (day.date < previousDay) monthIndex += 1;
    previousDay = day.date;
    const date = new Date(year, monthIndex, day.date, 12);
    return { ...day, month: date.getMonth() + 1, year: date.getFullYear(), weekday: ['일','월','화','수','목','금','토'][date.getDay()] };
  });
}

/** Pin monthly navigation to day one so Jan 31 -> Feb does not skip to March. */
export function shiftMealPeriod(base: Date, monthly: boolean, direction: number) {
  const next = new Date(base);
  if (monthly) { next.setDate(1); next.setMonth(next.getMonth() + direction); }
  else next.setDate(next.getDate() + direction * 7);
  return next;
}
