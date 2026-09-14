export const BOOKING3_VERSION = '2026-09-14';
export const BOOKING3_DAYS = ['월', '화', '수', '목', '금'];
export const BOOKING3_TIMES = Array.from({ length: 16 }, (_, i) => `${14 + Math.floor(i / 2)}:${i % 2 ? '30' : '00'}`);
export const BOOKING3_MONTHS = [1, 2, 3, 6];
export const BOOKING3_PRICES: Record<number, number> = { 2: 72000, 3: 105600, 5: 160000 };
export type Booking3Form = {
  guardian: string; phone: string; email: string; student: string; englishName: string;
  birthYear: string; level: string; weekly: number; months: number; days: string[];
  dayTimes: Record<string, string>; startDate: string; referral: string; notes: string;
  privacy: boolean; rules: boolean;
};
export function booking3Quote(weekly: number, months: number) {
  if (![2, 3, 5].includes(weekly) || !BOOKING3_MONTHS.includes(months)) throw new Error('주당 횟수와 등록 개월을 확인해주세요.');
  const bonusWeeks = months === 6 ? 4 : months === 3 ? 2 : 0;
  const paidSessions = weekly * months * 4;
  const bonusSessions = weekly * bonusWeeks;
  return { paidSessions, bonusSessions, totalSessions: paidSessions + bonusSessions, bonusWeeks, weeks: months * 4 + bonusWeeks, amount: BOOKING3_PRICES[weekly] * months };
}
export function koreaToday(now = new Date()) { return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10); }
export function booking3Initial(): Booking3Form {
  return { guardian: '', phone: '', email: '', student: '', englishName: '', birthYear: '', level: '', weekly: 3, months: 1, days: ['월', '수', '금'], dayTimes: { 월: '19:00', 수: '19:00', 금: '19:00' }, startDate: '', referral: '', notes: '', privacy: false, rules: false };
}
export function validateBooking3(input: unknown, today = koreaToday()): Booking3Form {
  if (!input || typeof input !== 'object') throw new Error('신청 내용을 확인해주세요.');
  const x = input as Record<string, unknown>;
  const str = (key: string, max: number, required = false) => {
    const value = typeof x[key] === 'string' ? x[key].trim() : '';
    if ((required && !value) || value.length > max) throw new Error('학생·보호자 정보와 입력 길이를 확인해주세요.');
    return value;
  };
  const weekly = Number(x.weekly), months = Number(x.months);
  booking3Quote(weekly, months);
  const days = BOOKING3_DAYS.filter(d => Array.isArray(x.days) && x.days.includes(d));
  if (!Array.isArray(x.days) || days.length !== weekly || x.days.length !== days.length) throw new Error(`평일 중 ${weekly}개의 수업 요일을 선택해주세요.`);
  const dayTimes: Record<string, string> = {};
  for (const day of days) {
    const value = x.dayTimes && typeof x.dayTimes === 'object' ? (x.dayTimes as Record<string, unknown>)[day] : '';
    if (typeof value !== 'string' || !BOOKING3_TIMES.includes(value)) throw new Error('수업 시간은 한국 기준 14:00~21:30 중 선택해주세요.');
    dayTimes[day] = value;
  }
  const startDate = str('startDate', 10, true);
  const date = new Date(startDate + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== startDate || startDate < today || Number(startDate.slice(0, 4)) > Number(today.slice(0, 4)) + 2) throw new Error('희망 시작일은 오늘부터 2년 이내의 날짜로 입력해주세요.');
  const phone = str('phone', 30, true);
  if (!/^\+?[0-9 ()-]{9,30}$/.test(phone) || phone.replace(/\D/g, '').length < 9) throw new Error('연락 가능한 보호자 전화번호를 입력해주세요.');
  const email = str('email', 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('이메일 형식을 확인해주세요.');
  const birthYear = str('birthYear', 4, true);
  if (!/^\d{4}$/.test(birthYear) || Number(birthYear) < 1900 || Number(birthYear) > Number(today.slice(0, 4))) throw new Error('출생연도를 네 자리로 입력해주세요.');
  if (x.privacy !== true || x.rules !== true) throw new Error('개인정보 수집·이용과 수업 규정을 확인해주세요.');
  return { guardian: str('guardian', 80, true), student: str('student', 80, true), englishName: str('englishName', 100, true), phone, email, birthYear, level: str('level', 100), weekly, months, days, dayTimes, startDate, referral: str('referral', 100), notes: str('notes', 1500), privacy: true, rules: true };
}
