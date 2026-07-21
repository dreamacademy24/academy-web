// 투어셔틀 주간 패턴 단일 소스(SSOT)
// 손님 신청(app/portal/shuttle, app/shuttle)과 어드민 운영달력(app/admin/tour-shuttle)이 모두 이 규칙을 읽는다.
// ⚠️ 패턴 변경 시 반드시 이 파일만 수정할 것 — 화면별 복사본 금지.

export const SHUTTLE_HOLIDAYS = new Set([
  '2026-05-01','2026-05-29',
  '2026-06-12',
  '2026-08-09',
  '2026-10-30','2026-10-31',
  '2026-11-01','2026-11-27',
  '2026-12-24','2026-12-25','2026-12-31',
]);

export const SHUTTLE_SPECIAL_MSG: Record<string,string> = {
  '2026-08-09': '⚠️ 아이언맨 도로통제로 투어셔틀 불가',
};

export interface ShSlot { time: string; name: string; return: string; note?: string; }

export function nthWeekday(d: Date) { return Math.ceil(d.getDate() / 7); }

export function getShSlots(dateStr: string, extraHolidays?: Set<string>): ShSlot[] | 'holiday' {
  if (SHUTTLE_HOLIDAYS.has(dateStr) || (extraHolidays && extraHolidays.has(dateStr))) return 'holiday';
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  const odd = nthWeekday(d) % 2 === 1;
  const S_HMART    = { time:'10:00am', return:'11:00',          note:'' };
  const S_ILCORSO  = { time:'4:00pm',  return:'2시간 30분 후',   note:'' };
  const S_ANJO     = { time:'1:00pm',  return:'20:00',           note:'' };
  const S_FUNPARK  = { time:'2:00pm',  return:'20:00',           note:'' };
  const S_SAFARI   = { time:'8:30am',  return:'15:00',           note:'유료 200페소' };
  const S_SHRINE   = { time:'5:30pm',  return:'40분 후',         note:'' };
  const S_LANTAW   = { time:'4:00pm',  return:'2시간 30분 후',   note:'' };
  const S_PAROLA   = { time:'4:40pm',  return:'식사 후',         note:'별도 출발시간 없음' };
  const S_SMSEASIDE= { time:'10:30am', return:'-',               note:'개별 복귀' };

  const hmart: ShSlot[] = [{ name:'H-Mart 쇼핑', ...S_HMART }];
  if (dow===1||dow===3||dow===5) return hmart;
  if (dow===2) return odd
    ? [{ name:'파롤라 (Parola)',       ...S_PAROLA }]
    : [{ name:'SM 씨사이드 쇼핑',      ...S_SMSEASIDE }];
  if (dow===4) return odd
    ? [{ name:'SM 씨사이드 쇼핑',      ...S_SMSEASIDE }]
    : [{ name:'막탄 쉬라인',           ...S_SHRINE }];
  if (dow===6) return odd
    ? [{ name:'세부 사파리',           ...S_SAFARI },
       { name:'일콜소 (Il Corso)',     ...S_ILCORSO }]
    : [{ name:'펀파크 (Fun Park)',     ...S_FUNPARK },
       { name:'란타우 (Lantaw)',       ...S_LANTAW }];
  if (dow===0) return odd
    ? [{ name:'안조 월드 (Anjo World)',...S_ANJO },
       { name:'란타우 (Lantaw)',       ...S_LANTAW }]
    : [{ name:'세부 사파리',           ...S_SAFARI },
       { name:'일콜소 (Il Corso)',     ...S_ILCORSO }];
  return [];
}
