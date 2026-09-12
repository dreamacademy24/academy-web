import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
import {canReviewStudents} from '@/lib/staffSession';
import {verifyConfirmation,validVisitDates} from '@/lib/student-care/confirmation';
import {reconcileStudents,type LegacyStudent} from '@/lib/student-care/reconcile';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export async function POST(req:Request){
 let staff;try{staff=await getStaffIdentity(req);}catch{return reply({error:'로그인 서버 연결을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.'},503);}
 if(!staff)return reply({error:'다시 로그인해주세요.'},401);
 if(!canReviewStudents(staff))return reply({error:'관리자만 연결을 확정할 수 있습니다.'},403);
 try{
  let body;
  try{body=await req.json();}catch{return reply({error:'올바른 요청 형식이 필요합니다.'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'올바른 요청 형식이 필요합니다.'},400);
  const {bookingId,index,studentId,token,requestId,start,end,learnerId}=body;
  if(!uuid(bookingId)||!uuid(studentId)||!uuid(requestId)||!Number.isInteger(index)||index<0||index>1000||typeof token!=='string'||token.length>2000||!validVisitDates(start,end)||(learnerId!==null&&!uuid(learnerId))||body.confirmed!==true)return reply({error:'학생과 방문 기간을 확인해주세요.'},400);
  const db=portalDb();
  const [{data:booking,error:be},{data:student,error:se}]=await Promise.all([
   db.from('bookings').select('id,students').eq('id',bookingId).maybeSingle(),
   db.from('students').select('id,booking_id,name_kr,name_en').eq('id',studentId).maybeSingle(),
  ]);
  if(be||se)throw new Error('read_failed');
  if(!booking||!student)return reply({error:'원본 학생을 찾지 못했습니다. 목록을 새로 확인해주세요.'},409);
  const snapshot={bookingId,index,students:booking.students,student:student as LegacyStudent&{name_en:string|null}};
  const key=process.env.STAFF_SESSION_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(!verifyConfirmation(token,snapshot,staff.id,key))return reply({error:'검토 후 자료가 변경되었거나 확인 시간이 지났습니다. 목록을 새로 확인해주세요.'},409);
  const candidate=reconcileStudents([booking],[student]).items.find(i=>i.sourceIndex===index);
  if(candidate?.status!=='id_candidate')return reply({error:'번호와 이름을 다시 확인해야 하는 학생입니다.'},409);
  const {data,error}=await db.rpc('confirm_care_student_link',{
   p_request_id:requestId,p_actor_id:staff.id,p_booking_id:bookingId,p_source_index:index,p_student_id:studentId,
   p_expected_students:booking.students,p_expected_student:student,p_start:start,p_end:end,p_learner_id:learnerId,
  });
  if(error){
   if(error.code==='40001'||error.code==='23505')return reply({error:'이미 연결되었거나 자료가 변경되었습니다. 목록을 새로 확인해주세요.'},409);
   if(error.code==='42501')return reply({error:'현재 계정의 연결 권한을 다시 확인해주세요.'},403);
   if(error.code==='22023')return reply({error:'학생과 방문 기간을 다시 확인해주세요.'},400);
   throw error;
  }
  return reply({ok:true,...data});
 }catch{return reply({error:'연결 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도하거나 목록을 새로 확인해주세요.'},503);}
}
