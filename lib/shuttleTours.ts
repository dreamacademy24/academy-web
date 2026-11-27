// 투어셔틀 주간 패턴 단일 소스(SSOT)
// 손님 신청(app/portal/shuttle, app/shuttle)과 어드민 운영달력(app/admin/tour-shuttle)이 모두 이 규칙을 읽는다.
// ⚠️ 패턴 변경 시 반드시 이 파일만 수정할 것 — 화면별 복사본 금지.

export const SHUTTLE_HOLIDAYS = new Set([
  '2026-05-01','2026-05-29',
  '2026-06-12',
  '2026-08-09',
  '2026-10-30','2026-10-31',
  '2026-11-01','2026-11-30',
  '2026-12-24','2026-12-25','2026-12-31',
  '2027-01-16','2027-01-17',
]);

export const SHUTTLE_SPECIAL_MSG: Record<string,string> = {
  '2026-08-09': '⚠️ 아이언맨 도로통제로 투어셔틀 불가',
  '2027-01-16': '시눌룩 축제로 인한 도로 통제로 투어셔틀 운영 불가',
  '2027-01-17': '시눌룩 축제로 인한 도로 통제로 투어셔틀 운영 불가',
};

import { defaultHmartRoute } from './shuttleRoute';
export interface ShSlot { time: string; name: string; return: string; note?: string; displayName?: string; route?: string; }

// Preserve published exceptions and the already-booked Dec 5 Safari while
// staff confirm that additional conflict. Regeneration must not erase them.
export const SHUTTLE_PRESERVED_DATES = new Set(['2026-12-05', '2026-12-06', '2026-12-12', '2027-01-24']);

export const PARKMALL_SLOT: ShSlot = { name: '파크몰 · 아얄라몰', time: '10:00am', return: '개별 복귀',
  route: '10:00 출발 → 파크몰 → 아얄라몰 게이트워크점 · 개별 복귀' };
export const RESORT_SLOT: ShSlot = { name: '리조트 드랍 셔틀', time: '09:15am', return: '드림센터',
  route: '09:15 드림하우스 출발 → 09:25 제이파크 → 09:40 블루워터 마리바고 → 드림센터 복귀' };

export function shuttleDescription(slot: ShSlot): string {
  return `출발 ${slot.time} · 복귀 ${slot.return}`
    + (slot.displayName ? `\n노선명: ${slot.displayName}` : '')
    + (slot.route ? `\n노선: ${slot.route}` : '');
}

export function shuttleMonthKeys(first: string, last: string): string[] {
  const result: string[] = [];
  const cursor = new Date(first + '-01T00:00:00Z');
  const end = new Date(last + '-01T00:00:00Z');
  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0,7));
    cursor.setUTCMonth(cursor.getUTCMonth()+1);
  }
  return result;
}

export function weekendPark(date: string, saturday: boolean) {
  const anjo = date >= '2027-01-01' ? saturday : !saturday;
  return anjo
    ? { name:'안조 월드 (Anjo World)', time:'1:00pm', return:'20:00', note:'' }
    : { name:'펀파크 (Fun Park)', time:'2:00pm', return:'20:00', note:'' };
}

export function nthWeekday(d: Date) { return Math.ceil(d.getDate() / 7); }

export function getShSlots(dateStr: string, extraHolidays?: Set<string>): ShSlot[] | 'holiday' {
  if (SHUTTLE_HOLIDAYS.has(dateStr) || (extraHolidays && extraHolidays.has(dateStr))) return 'holiday';
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  const odd = nthWeekday(d) % 2 === 1;
  const S_HMART    = { time:'10:00am', return:'11:00',          note:'' };
  const S_ILCORSO  = { time:'4:00pm',  return:'2시간 30분 후',   note:'' };
  const S_SAFARI   = { time:'8:30am',  return:'15:00',           note:'유료 200페소' };
  const S_SHRINE   = { time:'5:30pm',  return:'40분 후',         note:'' };
  const S_LANTAW   = { time:'4:00pm',  return:'2시간 30분 후',   note:'' };
  const S_PAROLA   = { time:'4:40pm',  return:'식사 후',         note:'별도 출발시간 없음' };
  const S_SMSEASIDE= { time:'10:30am', return:'-',               note:'개별 복귀' };

  const hmart: ShSlot[] = [{ name:'H-Mart 쇼핑', ...S_HMART, ...defaultHmartRoute(dateStr) }];
  if (dateStr >= '2026-12-01' && !SHUTTLE_PRESERVED_DATES.has(dateStr)) {
    const resort = { ...RESORT_SLOT, route: RESORT_SLOT.route!.replace('드림하우스', '드림센터') };
    const safari = { name:'세부 사파리', ...S_SAFARI, route:'08:30 드림센터 출발 → 세부 사파리 → 15:00 사파리 출발 → 드림센터 복귀 · 유료 200페소' };
    const ilcorso = { name:'일콜소 (Il Corso)', ...S_ILCORSO, route:'16:00 드림센터 출발 → 일콜소 → 도착 후 2시간 30분 뒤 출발 → 드림센터 복귀' };
    const lantaw = { name:'란타우 (Lantaw)', ...S_LANTAW, route:'16:00 드림센터 출발 → 란타우 → 도착 후 2시간 30분 뒤 출발 → 드림센터 복귀' };
    const anjo = { name:'안조 월드 (Anjo World)', time:'1:00pm', return:'20:00', route:'13:00 드림센터 출발 → 안조월드 → 20:00 안조월드 출발 → 드림센터 복귀' };
    const fun = { name:'세부 쇼핑 & 펀 투어', displayName:'세부 쇼핑 & 펀 투어', time:'2:00pm', return:'20:00', route:'14:00 드림센터 출발 → SM씨사이드 → 오션파크 → 펀파크 → 20:00 SM씨사이드 출발 → 드림센터 복귀' };
    if ([1,3,5].includes(dow)) return hmart.map(slot => ({ ...slot, name:slot.displayName! }));
    if (dow === 2) return odd
      ? [{ name:'파롤라 (Parola)', ...S_PAROLA, route:'16:40 드림센터 출발 → 파롤라 → 식사 후 출발 → 드림센터 복귀' }]
      : [{ ...PARKMALL_SLOT, time:'10:30am', route:'10:30 드림센터 출발 → 파크몰 → 아얄라몰 게이트워크점 · 개별 복귀' }];
    if (dow === 4) return odd
      ? [{ name:'SM 씨사이드 쇼핑', ...S_SMSEASIDE, return:'개별 복귀', route:'10:30 드림센터 출발 → SM씨사이드 · 개별 복귀' }]
      : [{ name:'막탄 쉬라인', ...S_SHRINE, route:'17:30 드림센터 출발 → 막탄 쉬라인 → 도착 후 40분 뒤 출발 → 드림센터 복귀' }];
    if (dow === 6) return odd ? [resort, anjo, lantaw] : [resort, ilcorso, safari];
    if (dow === 0) return odd ? [ilcorso, safari] : [lantaw, fun];
  }
  if (dow===1||dow===3||dow===5) return hmart;
  if (dow===2) return odd
    ? [{ name:'파롤라 (Parola)',       ...S_PAROLA }]
    : [dateStr >= '2026-12-08' ? { ...PARKMALL_SLOT } : { name:'SM 씨사이드 쇼핑', ...S_SMSEASIDE }];
  if (dow===4) return odd
    ? [{ name:'SM 씨사이드 쇼핑',      ...S_SMSEASIDE }]
    : [{ name:'막탄 쉬라인',           ...S_SHRINE }];
  if (dow===6) return [...(dateStr >= '2026-11-28' ? [{ ...RESORT_SLOT }] : []), ...(odd
    ? [{ name:'세부 사파리',           ...S_SAFARI },
       { name:'일콜소 (Il Corso)',     ...S_ILCORSO }]
    : [weekendPark(dateStr,true),
       { name:'란타우 (Lantaw)',       ...S_LANTAW }])];
  if (dow===0) return odd
    ? [weekendPark(dateStr,false),
       { name:'란타우 (Lantaw)',       ...S_LANTAW }]
    : [{ name:'세부 사파리',           ...S_SAFARI },
       { name:'일콜소 (Il Corso)',     ...S_ILCORSO }];
  return [];
}
