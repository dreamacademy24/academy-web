import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
async function access(req:Request){const s=await getStaffIdentity(req);return s?.role==='korean_admin'?s:null;}
export async function GET(req:Request){
 try{
  if(!await access(req))return NextResponse.json({error:'직원 로그인이 필요합니다.'},{status:403});
  const db=portalDb(),sync=await db.rpc('sync_medication_followups');if(sync.error)throw sync.error;
  const [receipts,bookings,legacy]=await Promise.all([db.from('checkin_preparation_receipts').select('*'),db.from('bookings').select('id,booker_name,house_no,accom_room,checkin_date,checkout_date,academy_start,academy_end,booking_type,accom_type,students,assignee,care_assignee,status'),db.from('app_settings').select('value').eq('key','med_form_submitted').maybeSingle()]);
  if(receipts.error||bookings.error||legacy.error)throw Error('load');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());
  const seeds=[];
  for(const b of bookings.data||[]){
   if(!(/commute/i.test(b.booking_type||'')||b.accom_type==='통학형')||/취소|cancel/i.test(b.status||''))continue;
   let students=[];try{students=typeof b.students==='string'?JSON.parse(b.students):b.students||[];}catch{continue;}
   if(!Array.isArray(students))continue;
   for(const s of students){
    const name=String(s.name_kr||s.korName||s.name_en||s.engName||'').trim();
    const start=s.academy_start||s.academyStart||b.academy_start||b.checkin_date;
    const end=s.academy_end||s.academyEnd||b.academy_end||b.checkout_date;
    if(!name||!start||!end||end<today)continue;
    const d=new Date(start+'T12:00:00Z');if(!Number.isFinite(d.getTime()))continue;
    d.setUTCDate(d.getUTCDate()+(3-d.getUTCDay()+7)%7);
    seeds.push({booking_id:b.id,student_name:name,followup_due:d.toISOString().slice(0,10)});
   }
  }
  if(seeds.length){const result=await db.from('checkin_preparation_receipts').upsert(seeds,{onConflict:'booking_id,student_name',ignoreDuplicates:true});if(result.error)throw result.error;}
  const refreshed=seeds.length?await db.from('checkin_preparation_receipts').select('*'):receipts;
  if(refreshed.error)throw refreshed.error;
  return NextResponse.json({receipts:refreshed.data,bookings:bookings.data,legacy:legacy.data?.value||{}},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'수령 현황을 불러오지 못했습니다. 다시 시도해주세요.'},{status:503});}
}
export async function PATCH(req:Request){
 try{
  const staff=await access(req);if(!staff)return NextResponse.json({error:'직원 로그인이 필요합니다.'},{status:403});
  const body=await req.json(),{booking_id,student_name,revision,field,value}=body;
  if(typeof booking_id!=='string'||typeof student_name!=='string'||!Number.isInteger(revision)||!['paper_at','medicine_at','followup_due'].includes(field))return NextResponse.json({error:'유효하지 않은 변경입니다.'},{status:400});
  if(field==='followup_due'?(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))):typeof value!=='boolean')return NextResponse.json({error:'날짜 또는 확인 값을 확인해주세요.'},{status:400});
  const now=new Date().toISOString();
  const {data,error}=await portalDb().from('checkin_preparation_receipts').update({[field]:field==='followup_due'?value:value?now:null,updated_by:staff.name||staff.username,updated_at:now,revision:revision+1}).eq('booking_id',booking_id).eq('student_name',student_name).eq('revision',revision).select().maybeSingle();
  if(error)throw error;if(!data)return NextResponse.json({error:'다른 직원이 먼저 변경했습니다. 새로고침 후 확인해주세요.'},{status:409});
  return NextResponse.json({receipt:data});
 }catch{return NextResponse.json({error:'저장하지 못했습니다. 변경은 완료되지 않았습니다.'},{status:503});}
}
