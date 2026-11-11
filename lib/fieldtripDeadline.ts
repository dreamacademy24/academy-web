import { FT_PROGRAMS, parseToken } from './fieldtripPrograms';

export const FIELDTRIP_DEADLINE_MESSAGE = '필드트립 신청 및 취소는 행사 7일 전까지만 가능합니다. 마감 후에는 직원에게 문의해 주세요.';

// Match the existing application cutoff: seven calendar days before, 16:50 Philippine time.
export function fieldtripClosed(date: string, now = Date.now()): boolean {
  const event = Date.parse(`${date}T16:50:00+08:00`);
  return !Number.isFinite(event) || now >= event - 7 * 86400000;
}

export function legacyProgramDate(token: string, createdAt: string): string | null {
  const p = parseToken(token);
  const created = new Date(createdAt);
  if (!p || !Number.isFinite(created.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(created);
  let year = Number(parts.find(x => x.type === 'year')?.value);
  const month = Number(parts.find(x => x.type === 'month')?.value);
  if (p.month < month) year++;
  const date = `${year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
  const parsed = new Date(date+'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === date ? date : null;
}

export function isFieldtripToken(token: string): boolean {
  return parseToken(token)?.key === 'ft' || !!FT_PROGRAMS[token]?.isFieldtrip;
}
