import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { portalDb, isPortalAdmin, portalUser } from './portalAuth';
import { packageBookings, packageBounds, studentKey, validatePackagePlan, buildPackageSchedule, initialPackagePlan } from './onlinePackagePlan';
import { koreaToday } from './booking3';
export async function packageContext(req:Request,params:{id?:string;uid?:string;student?:string}){
  const db=portalDb(),admin=await isPortalAdmin(req),user=admin?null:await portalUser(req);
  if(!admin&&!user)throw Error('로그인이 필요합니다.');
  let enrollment:any=null,sessions:any[]=[],uid=admin?params.uid:user!.id;
  const before=await db.rpc('online_package_snapshot',{p_id:params.id||null});if(before.error)throw Error('현재 저장 버전을 확인하지 못했습니다.');
  if(params.id){const r=await db.from('online_enrollments').select('*').eq('id',params.id).single();if(r.error||!r.data)throw Error('수강권을 확인하지 못했습니다.');enrollment=r.data;
    if(!admin&&enrollment.customer_user_id!==user!.id)throw Error('본인 수강권만 확인할 수 있습니다.');
    if(enrollment.enrollment_type!=='free_package')throw Error('연수 패키지 수강권에서 이용해주세요.');uid=enrollment.customer_user_id;
    const s=await db.from('online_sessions').select('*').eq('enrollment_id',params.id).order('id');if(s.error)throw Error('기존 출석부를 확인하지 못했습니다.');sessions=s.data||[];
  }
  if(!uid)throw Error('손님 앱 계정을 먼저 연결하고 저장해주세요.');
  const b=await db.from('bookings').select('id,reservation_no,students,checkin_date,checkout_date,dh_weeks,accom_weeks,status').eq('portal_user_id',uid).neq('status','취소').order('id');if(b.error)throw Error('연수 예약을 불러오지 못했습니다. 다시 시도해주세요.');
  const all=packageBookings(b.data||[]),name=enrollment?.student_name||params.student||'';
  const own=all.filter(x=>!name||studentKey(x.student)===studentKey(name));
  const existing=await db.from('online_enrollments').select('id,student_name,total_sessions,package_booking_id,package_plan,status').eq('customer_user_id',uid).eq('enrollment_type','free_package').neq('status','cancelled');if(existing.error)throw Error('기존 패키지 수강권을 확인하지 못했습니다.');
  const claims=await db.from('online_package_sources').select('booking_id,student_key,enrollment_id').in('booking_id',all.map(x=>x.id));if(claims.error)throw Error('연수별 회차 연결을 확인하지 못했습니다.');
  const bookings=own.map(x=>({...x,claimed:claims.data?.find(c=>c.booking_id===x.id&&c.student_key===studentKey(x.student)&&c.enrollment_id!==params.id)?.enrollment_id}));
  const holidays=await db.from('holidays').select('date').eq('is_deployed',true);if(holidays.error)throw Error('휴일 정보를 확인하지 못했습니다.');
  const fingerprint=await db.rpc('online_package_snapshot',{p_id:params.id||null});if(fingerprint.error)throw Error('현재 저장 버전을 확인하지 못했습니다.');
  if(before.data!==fingerprint.data)throw Error('조회 중 출석부가 변경되었습니다. 다시 불러와주세요.');
  return {db,admin,user,uid,name,enrollment,sessions,bookings,children:[...new Map(all.map(x=>[studentKey(x.student),{name:x.student,english:x.english}])).values()],existing:existing.data||[],holidays:new Set<string>((holidays.data||[]).map(h=>h.date)),snapshot:fingerprint.data,bookingSnapshot:createHash('sha256').update(JSON.stringify(b.data)).digest('hex')};
}
export async function packageRead(req:Request){const u=new URL(req.url);const c=await packageContext(req,{id:u.searchParams.get('id')||undefined,uid:u.searchParams.get('uid')||undefined,student:u.searchParams.get('student')||undefined});
  const usable=c.bookings.filter(b=>!b.claimed);return {admin:c.admin,children:c.children,bookings:c.bookings,existing:c.existing,enrollment:c.enrollment,sessions:c.sessions,holidays:[...c.holidays],snapshot:c.snapshot,bookingSnapshot:c.bookingSnapshot,plan:initialPackagePlan(usable,c.enrollment)};
}
export async function packageSave(req:Request,body:any){
  const c=await packageContext(req,{id:body.id,uid:body.customer_user_id,student:body.student_name});
  if(!body.id&&body.requestKey){const prior=c.existing.find(e=>e.id===body.requestKey&&studentKey(e.student_name)===studentKey(c.name));if(prior?.package_plan&&isDeepStrictEqual(prior.package_plan,body.package_plan))return {ok:true,id:prior.id,replayed:true};}
  if(!c.admin&&body.id)throw Error('이미 신청한 수업의 전후 배분 변경은 담당자에게 요청해주세요. 기존 출석부는 유지됩니다.');
  if(body.bookingSnapshot!==c.bookingSnapshot||body.snapshot!==c.snapshot)throw Error('예약 또는 출석부가 변경되었습니다. 새로고침 후 다시 확인해주세요.');
  if(!c.name||!c.bookings.length)throw Error('학생과 연결된 연수 예약을 확인해주세요.');
  const same=c.existing.filter(e=>e.id!==body.id&&studentKey(e.student_name)===studentKey(c.name));
  // Unlinked legacy credits are ambiguous: do not let a new application reuse them.
  if(same.some(e=>!e.package_plan&&!e.package_booking_id))throw Error('이 학생의 기존 패키지 수강권이 있습니다. 담당자가 기존 수강권에서 연수 예약을 연결한 후 추가 신청해주세요.');
  const plan=validatePackagePlan(body.package_plan,c.bookings,c.admin);
  const selected=c.bookings.filter(b=>plan.bookingIds.includes(b.id));
  if(selected.some(b=>b.claimed)||same.some(e=>e.package_booking_id&&plan.bookingIds.includes(e.package_booking_id)))throw Error('선택한 연수는 다른 수강권에 이미 연결되어 있습니다. 중복 회차를 제공할 수 없습니다.');
  if(!c.admin){const min=new Date(Date.now()+9*3600000+4*86400000).toISOString().slice(0,10);for(const p of [plan.pre,plan.post])if(p.count&&p.start<min)throw Error('희망 시작일은 최소 4일 뒤부터 선택해주세요.');}
  const schedule=buildPackageSchedule(plan,c.bookings,c.sessions,c.holidays,c.enrollment?.used_sessions||0);
  const tutor=c.admin?(body.tutor_id===undefined?c.enrollment?.tutor_id:body.tutor_id)||null:null;
  if(tutor){const valid=await c.db.from('online_tutors').select('id').eq('id',tutor).single();if(valid.error)throw Error('담당 선생님을 확인해주세요.');}
  if(body.preview===true)return {preview:schedule};
  const id=body.id||body.requestKey||randomUUID();if(!/^[\da-f-]{36}$/i.test(id))throw Error('접수 번호를 확인해주세요.');
  const bounds=packageBounds(selected);
  const next={student_name:c.name,student_name_en:c.admin?(body.student_name_en??c.enrollment?.student_name_en):selected[0].english,student_birth_year:c.admin?(body.student_birth_year??c.enrollment?.student_birth_year):null,customer_user_id:c.uid,tutor_id:tutor,level:String(body.level??c.enrollment?.level??'').slice(0,100),notes:c.admin?String(body.notes??c.enrollment?.notes??''): '엄마 앱 신청 · 연수 전후 회차 배분',status:c.admin?(body.status||c.enrollment?.status||'active'):'active',portal_open:c.admin?(body.portal_open??c.enrollment?.portal_open??true):true,start_date:schedule.startDate,end_date:schedule.endDate,used_sessions:schedule.used,duration_weeks:bounds.weeks};
  const {data,error}=await c.db.rpc('save_online_package_plan',{p_id:id,p_existing:!!body.id,p_snapshot:c.snapshot,p_student_key:studentKey(c.name),p_enrollment:next,p_plan:plan,p_rows:schedule.rows,p_today:koreaToday()});
  if(error){console.error('[online-package-save]',error.code,error.message);if(error.message.includes('PENDING_REQUEST'))throw Error('검토 중인 일정 변경 요청을 먼저 승인 또는 반려한 후 저장해주세요.');if(error.message.includes('STALE'))throw Error('다른 화면에서 출석부가 변경되었습니다. 새로고침 후 다시 확인해주세요.');if(error.message.includes('SOURCE_USED')||error.code==='23505')throw Error('이미 신청한 연수 또는 수강권입니다. 새로고침 후 기존 수업을 확인해주세요.');if(error.message.includes('TUTOR_CONFLICT'))throw Error('선생님의 다른 수업과 시간이 겹칩니다. 요일·시간 또는 담당 선생님을 변경해주세요.');throw Error('회차와 출석부를 저장하지 못했습니다. 입력 내용은 유지됩니다.');}
  return {ok:true,id:data,sessions_regenerated:schedule.rows.length,summary:schedule.summary};
}
