import { buildOnlineSessionDates } from './onlineClassSchedule';

/** Future makeup/cancelled rows reserve their dates; they do not move the start date. */
export function planOnlineSessions(start: string, days: string[], total: number, history: { session_number: number; scheduled_date: string }[], holidays: Set<string>, stays: { from: string; to: string }[]) {
  const excluded = new Set([...holidays, ...history.map(s => s.scheduled_date)]);
  const reserved = new Set(history.map(s => s.session_number));
  let number = 0;
  return buildOnlineSessionDates(start, days, Math.max(0, total - history.length), excluded, stays).dates.map(date => {
    do { number++; } while (reserved.has(number));
    return { date, number };
  });
}
