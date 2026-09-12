import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
import {readCareSelection,selectCareStudent,SelectionError} from '@/lib/student-care/selection';
export const dynamic='force-dynamic';
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function GET(req:Request){
 let staff;try{staff=await getStaffIdentity(req);}catch{return respond({error:'로그인 서버 연결을 확인하지 못했습니다. 잠시 후 다시 시도해주세요. / Sign-in service unavailable.'},503);}
 if(!staff)return respond({error:'Please sign in again. / 다시 로그인해주세요.'},401);
 if(!['korean_admin','local_teacher'].includes(staff.role))return respond({error:'Access denied.'},403);
 try{
  const selection=readCareSelection(req.url);
  if(selection&&staff.role!=='korean_admin')return respond({error:'Access denied.'},403);
  const db=portalDb();
  const {data,error}=await db.rpc('get_care_directory',{p_actor_id:staff.id});
  if(error)return respond({error:error.code==='42501'?'Access denied.':'Student care is unavailable. Please try again later.'},error.code==='42501'?403:503);
  return respond(await selectCareStudent(db,data,selection));
 }catch(e){return respond({error:e instanceof SelectionError?e.message:'Student care is unavailable. Please try again later.'},e instanceof SelectionError?e.status:503);}
}
export async function POST(req:Request){
 let staff;try{staff=await getStaffIdentity(req);}catch{return respond({error:'로그인 서버 연결을 확인하지 못했습니다. 잠시 후 다시 시도해주세요. / Sign-in service unavailable.'},503);}
 if(!staff)return respond({error:'다시 로그인해주세요.'},401);
 if(staff.role!=='korean_admin')return respond({error:'Access denied.'},403);
 try{
  const selection=readCareSelection(req.url);
  const db=portalDb();
  if(selection){
   const {data:roster,error}=await db.rpc('get_care_directory',{p_actor_id:staff.id});
   if(error)throw error;
   return respond({sync:{linked:0,busy:false},roster:await selectCareStudent(db,roster,selection)});
  }
  const {data:sync,error}=await db.rpc('sync_care_directory',{p_actor_id:staff.id});
  if(error)return respond({error:'자동 연결을 완료하지 못했습니다. 잠시 후 Refresh를 눌러주세요.'},error.code==='42501'?403:503);
  const {data:roster,error:readError}=await db.rpc('get_care_directory',{p_actor_id:staff.id});
  if(readError)throw readError;
  return respond({sync,roster:await selectCareStudent(db,roster,selection)});
 }catch(e){return respond({error:e instanceof SelectionError?e.message:'자동 연결 결과를 확인하지 못했습니다. Refresh로 다시 확인해주세요.'},e instanceof SelectionError?e.status:503);}
}
