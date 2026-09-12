import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
export const dynamic='force-dynamic';
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function GET(req:Request){
 const staff=await getStaffIdentity(req);
 if(!staff)return respond({error:'Please sign in again. / 다시 로그인해주세요.'},401);
 if(!['korean_admin','local_teacher'].includes(staff.role))return respond({error:'Access denied.'},403);
 try{
  const {data,error}=await portalDb().rpc('get_care_directory',{p_actor_id:staff.id});
  if(error)return respond({error:error.code==='42501'?'Access denied.':'Student care is unavailable. Please try again later.'},error.code==='42501'?403:503);
  return respond(data);
 }catch{return respond({error:'Student care is unavailable. Please try again later.'},503);}
}
export async function POST(req:Request){
 const staff=await getStaffIdentity(req);
 if(!staff)return respond({error:'다시 로그인해주세요.'},401);
 if(staff.role!=='korean_admin')return respond({error:'Access denied.'},403);
 try{
  const db=portalDb();
  const {data:sync,error}=await db.rpc('sync_care_directory',{p_actor_id:staff.id});
  if(error)return respond({error:'자동 연결을 완료하지 못했습니다. 잠시 후 Refresh를 눌러주세요.'},error.code==='42501'?403:503);
  const {data:roster,error:readError}=await db.rpc('get_care_directory',{p_actor_id:staff.id});
  if(readError)throw readError;
  return respond({sync,roster});
 }catch{return respond({error:'자동 연결 결과를 확인하지 못했습니다. Refresh로 다시 확인해주세요.'},503);}
}
