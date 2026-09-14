import { buildOnlineSessionDates } from './onlineClassSchedule';

/** Validate before saving enrollment fields: a renewal must not erase its old history. */
export function onlineSessionCountIssue(total: number, historyCount: number, scheduledCount: number, used: number): string | null {
  if (!Number.isSafeInteger(total) || total < 1) return '총 회차는 1 이상의 정수로 입력해주세요.';
  if (total < Math.max(historyCount, used)) {
    return `기존 출석·취소·보강 이력 ${historyCount}개, 사용 ${used}회가 있어 총 ${total}회로 변경할 수 없습니다. 총 회차는 이 수강권의 기존 이력을 포함한 횟수입니다. 새로 시작하는 수업은 별도 수강권을 사용해주세요. 기존 출석부는 변경하지 않았습니다.`;
  }
  if (total === Math.max(historyCount, used) && scheduledCount > 0) {
    return `기존 이력 ${historyCount}개, 사용 ${used}회로 총 회차가 모두 채워져 있지만 예정 수업 ${scheduledCount}개가 남아 있습니다. 예정 수업 정리 또는 총 회차를 먼저 확인해주세요. 기존 출석부는 변경하지 않았습니다.`;
  }
  return null;
}

/** Future makeup/cancelled rows reserve their dates; they do not move the start date. */
export function planOnlineSessions(start: string, days: string[], total: number, history: { session_number: number; scheduled_date: string }[], holidays: Set<string>, stays: { from: string; to: string }[], usedCount = history.length) {
  const excluded = new Set([...holidays, ...history.map(s => s.scheduled_date)]);
  const reserved = new Set(history.map(s => s.session_number));
  let number = 0;
  return buildOnlineSessionDates(start, days, Math.max(0, total - Math.max(history.length, usedCount)), excluded, stays).dates.map(date => {
    do { number++; } while (reserved.has(number));
    return { date, number };
  });
}
