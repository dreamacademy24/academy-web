import { buildOnlineSessionDates } from './onlineClassSchedule';
import { BOOKING3_DAYS, BOOKING3_TIMES, koreaToday } from './booking3';
export type PackageBooking = { id:string; number:string; from:string; to:string; weeks:number; basis:string; student:string; english:string; claimed?:string };
export type PackagePart = { count:number; start:string; days:string[]; times:Record<string,string> };
export type PackagePlan = { version:1; bookingIds:string[]; total:number; manual:boolean; reason:string; pre:PackagePart; post:PackagePart };
export function packagePlanText(plan:PackagePlan){return `총 ${plan.total}회\n`+(['pre','post'] as const).map(key=>{const p=plan[key];return `${key==='pre'?'연수 전':'연수 후'} ${p.count}회`+(p.count?` · 희망 시작 ${p.start}\n${p.days.map(d=>`${d} ${p.times[d]}`).join(' / ')} (한국 시간)`:'');}).join('\n');}
export type PackageSession = { id:string; status:string; scheduled_date:string; session_number:number; package_phase?:string|null; cancel_days_before?:number|null; is_makeup_added?:boolean; original_session_id?:string|null; note?:string|null; session_note?:string|null; attitude?:string|null; attitude_note?:string|null; recorded_at?:string|null; scheduled_time_kr?:string|null };
export const addDate = (date:string,n:number) => new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export function bookingStudents(value:unknown):any[]{if(typeof value==='string'){try{return bookingStudents(JSON.parse(value));}catch{return [];}}return Array.isArray(value)?value:[];}
export const studentKey=(s:string)=>s.normalize('NFKC').replace(/\s/g,'').toLowerCase();
export function packageBookings(rows:any[],name?:string):PackageBooking[]{
  const result:PackageBooking[]=[];
  for(const b of rows){if(b.status==='취소'||!validDate(b.checkin_date||'')||!validDate(b.checkout_date||''))continue;
    for(const student of bookingStudents(b.students)){
      const kor=String(student.korName||student.name_kr||student.name||'').trim();if(!kor||(name&&studentKey(kor)!==studentKey(name)))continue;
      const from=student.academyStart||student.academy_start,to=student.academyEnd||student.academy_end;
      const hasStudy=validDate(from||'')&&validDate(to||'')&&to>=from;
      const explicit=Number(student.academy_weeks||student.academyWeeks||student.study_weeks);
      const weeks=explicit>0?explicit:hasStudy?Math.ceil((Date.parse(to)-Date.parse(from)+86400000)/(7*86400000)):Number(b.dh_weeks||b.accom_weeks)||Math.ceil((Date.parse(b.checkout_date)-Date.parse(b.checkin_date))/(7*86400000));
      if(!Number.isSafeInteger(weeks)||weeks<1||weeks>104)continue;
      if(result.some(r=>r.id===b.id&&studentKey(r.student)===studentKey(kor)))continue;
      result.push({id:b.id,number:b.reservation_no||b.id,from:b.checkin_date,to:b.checkout_date,weeks,basis:explicit>0?'학생 등록 주수':hasStudy?'학생 연수 일정':'예약 등록 주수',student:kor,english:student.engName||student.name_en||''});
    }
  }return result.sort((a,b)=>a.from.localeCompare(b.from));
}
export function packageBounds(bookings:PackageBooking[]){return {from:bookings.map(b=>b.from).sort()[0]||'',to:bookings.map(b=>b.to).sort().at(-1)||'',weeks:bookings.reduce((n,b)=>n+b.weeks,0)};}
export function initialPackagePlan(bookings:PackageBooking[],enrollment?:any,today=koreaToday()):PackagePlan{
  if(enrollment?.package_plan)return enrollment.package_plan;
  const bounds=packageBounds(bookings),total=bounds.weeks*3||Number(enrollment?.total_sessions)||0;
  const days=enrollment?.days_of_week?.map((d:string)=>({mon:'월',tue:'화',wed:'수',thu:'목',fri:'금'} as Record<string,string>)[d]||d).filter((d:string)=>BOOKING3_DAYS.includes(d))||['월','수','금'];
  const times=Object.fromEntries(days.map((d:string)=>[d,enrollment?.day_times?.[d]||enrollment?.class_time_kr?.slice(0,5)||'19:00']));
  const legacyTotal=Number(enrollment?.total_sessions)||total;
  const pre=enrollment?Number(enrollment.pre_sessions)||0:bounds.from>addDate(today,4)?Math.floor(total/6)*3:0;
  const effectiveTotal=enrollment?legacyTotal:total;
  const preStart=enrollment?.start_date&&pre>0?enrollment.start_date:addDate(today,4);
  const postStart=enrollment?.start_date&&!pre?enrollment.start_date:bounds.to?addDate(bounds.to,1):addDate(today,4);
  return {version:1,bookingIds:bookings.map(b=>b.id),total:effectiveTotal,manual:!!enrollment&&effectiveTotal!==total,reason:enrollment&&effectiveTotal!==total?'기존 수강권 회차 유지':'',pre:{count:pre,start:preStart,days:[...days],times:{...times}},post:{count:effectiveTotal-pre,start:postStart>today?postStart:addDate(today,4),days:[...days],times:{...times}}};
}
export function validatePackagePlan(value:unknown,bookings:PackageBooking[],admin:boolean):PackagePlan{
  const p=value as PackagePlan;if(!p||!Array.isArray(p.bookingIds)||!p.bookingIds.length)throw Error('회차에 포함할 연수 예약을 선택해주세요.');
  const selected=bookings.filter(b=>p.bookingIds.includes(b.id));
  if(selected.length!==p.bookingIds.length||new Set(p.bookingIds).size!==p.bookingIds.length)throw Error('연결된 학생의 연수 예약만 선택할 수 있습니다.');
  const auto=packageBounds(selected).weeks*3;
  if(!Number.isSafeInteger(p.total)||p.total<1||p.total>1000)throw Error('총 제공 회차는 1~1000회로 입력해주세요.');
  if(!admin&&(p.manual||p.total!==auto))throw Error('총 제공 회차는 연수 주수 × 주 3회로 계산됩니다. 조정은 담당자에게 문의해주세요.');
  const manual=admin&&p.manual===true;
  if(!manual&&p.total!==auto)throw Error('연수 기준 회차가 변경되었습니다. 자동 회차를 다시 적용해주세요.');
  if(manual&&(!p.reason?.trim()||p.reason.length>500))throw Error('총 회차 수동 조정 사유를 입력해주세요.');
  const parts={} as {pre:PackagePart;post:PackagePart};
  for(const key of ['pre','post'] as const){const v=p[key];if(!v||!Number.isSafeInteger(v.count)||v.count<0)throw Error('연수 전·후 회차를 0 이상의 정수로 입력해주세요.');
    if(v.count===0){parts[key]={count:0,start:'',days:[],times:{}};continue;}
    if(!validDate(v.start)||v.start<'2020-01-01'||v.start>'2035-12-31')throw Error(`${key==='pre'?'연수 전':'연수 후'} 시작일을 확인해주세요.`);
    if(!Array.isArray(v.days)||![2,3,5].includes(v.days.length)||new Set(v.days).size!==v.days.length||v.days.some(d=>!BOOKING3_DAYS.includes(d)))throw Error('각 일정은 평일 중 주 2·3·5회로 선택해주세요. 총 제공 회차는 요일 수와 관계없이 유지됩니다.');
    const times:Record<string,string>={};for(const d of v.days){if(!BOOKING3_TIMES.includes(v.times?.[d]))throw Error('수업 시간은 한국 14:00~21:30 중 선택해주세요.');times[d]=v.times[d];}
    parts[key]={count:v.count,start:v.start,days:BOOKING3_DAYS.filter(d=>v.days.includes(d)),times};
  }
  if(parts.pre.count+parts.post.count!==p.total)throw Error(`연수 전 ${parts.pre.count}회 + 연수 후 ${parts.post.count}회가 총 ${p.total}회와 같아야 합니다.`);
  return {version:1,bookingIds:selected.map(b=>b.id),total:p.total,manual,reason:manual?p.reason.trim():'',...parts};
}
export function mutablePackageSession(s:PackageSession,today:string){return s.status==='scheduled'&&s.scheduled_date>=today&&!s.is_makeup_added&&!s.original_session_id&&!s.note&&!s.session_note&&!s.attitude&&!s.attitude_note&&!s.recorded_at;}
export function chargedPackageSession(s:PackageSession){return ['attended','absent','no_show'].includes(s.status)||(s.status==='cancelled'&&(s.cancel_days_before==null||s.cancel_days_before<4));}
export function buildPackageSchedule(plan:PackagePlan,bookings:PackageBooking[],sessions:PackageSession[],holidays:Set<string>,used=0,today=koreaToday()){
  const selected=bookings.filter(b=>plan.bookingIds.includes(b.id)),bounds=packageBounds(selected);
  const fixed=sessions.filter(s=>!mutablePackageSession(s,today));
  const charged=fixed.filter(chargedPackageSession).length;
  if(used>charged)throw Error(`저장된 사용 ${used}회와 출석 기록 ${charged}회가 다릅니다. 기존 사용 이력을 먼저 확인해주세요. 회차를 임의로 늘리지 않았습니다.`);
  const rows:{date:string;number:number;time:string;phase:'pre'|'post'}[]=[];
  const reserved=new Set(fixed.map(s=>s.session_number));let number=0;
  const phase=(s:PackageSession)=>s.package_phase==='pre'||s.package_phase==='post'?s.package_phase:s.scheduled_date<bounds.from?'pre':'post';
  const summary:{pre:{first:string;last:string;count:number};post:{first:string;last:string;count:number}}={pre:{first:'',last:'',count:0},post:{first:'',last:'',count:0}};
  for(const key of ['pre','post'] as const){const part=plan[key];const history=fixed.filter(s=>phase(s)===key);
    const committed=history.filter(s=>s.status==='scheduled'||chargedPackageSession(s)).length;
    if(part.count<committed)throw Error(`${key==='pre'?'연수 전':'연수 후'} 기존 사용·보존 예정 ${committed}회보다 적게 배정할 수 없습니다.`);
    const remaining=part.count-committed;
    if(remaining){
      if(key==='post'&&part.start<=bounds.to)throw Error(`연수 후 시작일은 마지막 연수 종료일 ${bounds.to} 다음 날부터 지정해주세요.`);
      const start=part.start>today?part.start:today;
      const excluded=new Set([...holidays,...fixed.map(s=>s.scheduled_date)]);
      const all=buildOnlineSessionDates(start,part.days,remaining,excluded,selected.map(b=>({from:b.from,to:b.to}))).dates;
      const dates=key==='pre'?all.filter(d=>d<bounds.from):all;
      if(dates.length<remaining)throw Error(`연수 전 배정 ${part.count}회 중 앞으로 ${dates.length}회만 가능합니다. 시작일·요일을 조정하거나 남은 회차를 연수 후로 배분해주세요.`);
      for(const date of dates){do{number++;}while(reserved.has(number));const day=['일','월','화','수','목','금','토'][new Date(date+'T12:00:00Z').getUTCDay()];rows.push({date,number,time:part.times[day],phase:key});}
    }
    const dates=[...history.filter(s=>s.status==='scheduled'||chargedPackageSession(s)).map(s=>s.scheduled_date),...rows.filter(r=>r.phase===key).map(r=>r.date)].sort();summary[key]={first:dates[0]||'',last:dates.at(-1)||'',count:part.count};
  }
  return {rows,summary,fixedCount:fixed.length,used:Math.max(used,charged),endDate:[...fixed.map(s=>s.scheduled_date),...rows.map(r=>r.date)].sort().at(-1)||'',startDate:[plan.pre.count?plan.pre.start:'',plan.post.count?plan.post.start:''].filter(Boolean).sort()[0]};
}
