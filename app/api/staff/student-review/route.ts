import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
import {canReviewStudents} from '@/lib/staffSession';
import {reconcileStudents,type LegacyStudent,type BookingInput} from '@/lib/student-care/reconcile';
import {issueConfirmation} from '@/lib/student-care/confirmation';
export const dynamic='force-dynamic';
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
type Booking=BookingInput&{reservation_no:string|null;academy_start:string|null;academy_end:string|null};
export async function GET(req:Request){
 let staff;try{staff=await getStaffIdentity(req);}catch{return respond({error:'로그인 서버 연결을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.'},503);}
 if(!staff)return respond({error:'로그인이 만료되었어요. 관리자 계정으로 다시 로그인해주세요.'},401);
 if(!canReviewStudents(staff))return respond({error:'학생 연결 검토는 관리자만 이용할 수 있습니다.'},403);
 try{
  const db=portalDb();
  async function rows(table:string,columns:string){
   const all:unknown[]=[];
   // Explicitly paginate instead of silently accepting the API's row limit.
   for(let start=0;start<20000;start+=500){
    const {data,error}=await db.from(table).select(columns).order('id').range(start,start+499);
    if(error)throw error;
    all.push(...(data||[]));if(!data||data.length<500)return all;
   }
   throw new Error('Review capacity exceeded');
  }
  const [bookingRows,studentRows]=await Promise.all([
   rows('bookings','id,reservation_no,students,academy_start,academy_end'),
   rows('students','id,booking_id,name_kr,name_en'),
  ]);
  const bookings=bookingRows as Booking[],students=studentRows as LegacyStudent[];
  const review=reconcileStudents(bookings,students);
  let registry:{id:string;name_kr:string;name_en:string|null}[]=[];
  let visits:{id:string;learner_id:string;start_date:string;end_date:string}[]=[];
  let links:{booking_id:string;source_index:number;learner_id:string;visit_id:string}[]=[];
  let linkingAvailable=false;
  try{
   const result=await Promise.all([rows('care_learners','id,name_kr,name_en'),rows('care_visits','id,learner_id,start_date,end_date'),rows('care_links','id,booking_id,source_index,learner_id,visit_id')]);
   registry=result[0] as typeof registry;visits=result[1] as typeof visits;links=result[2] as typeof links;linkingAvailable=true;
  }catch{ /* Existing read-only review remains usable before registry migration. */ }
  const linkedBySource=new Map(links.map(l=>[l.booking_id+':'+l.source_index,l]));
  const byBooking=new Map(bookings.map(b=>[b.id,b]));const byStudent=new Map(students.map(s=>[s.id,s]));
  const items=review.items.map(item=>{
   const b=byBooking.get(item.bookingId)!;
   let source:Record<string,unknown>={};
   try{const a=typeof b.students==='string'?JSON.parse(b.students):b.students;if(Array.isArray(a))source=a[item.sourceIndex]||{};}catch{}
   const name=[source.korName,source.name_kr,source.koreanName,source.name,source.engName,source.name_en].find(v=>typeof v==='string'&&v.trim());
   const candidate=byStudent.get(item.candidateIds[0]);
   const token=linkingAvailable&&item.status==='id_candidate'&&candidate?issueConfirmation({bookingId:b.id,index:item.sourceIndex,students:b.students,student:{id:candidate.id,booking_id:candidate.booking_id,name_kr:candidate.name_kr,name_en:candidate.name_en??null}},staff.id,process.env.STAFF_SESSION_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||''):null;
   return {...item,token,linked:linkedBySource.get(item.sourceKey)||null,name:typeof name==='string'?name:'이름 미등록',reservation:b.reservation_no||b.id,start:b.academy_start,end:b.academy_end,
    candidates:item.candidateIds.map(id=>({id,name:byStudent.get(id)?.name_kr||'이름 미등록',english:byStudent.get(id)?.name_en||''}))};
  });
  return respond({items,linkingAvailable,registry:registry.map(r=>({...r,visits:visits.filter(v=>v.learner_id===r.id)})),issues:review.issues,loadedAt:new Date().toISOString(),bookingCount:bookings.length,studentRowCount:students.length,
   orphanRows:students.filter(s=>!s.booking_id||!byBooking.has(s.booking_id)).length});
 }catch{return respond({error:'학생 자료를 모두 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'},503);}
}
