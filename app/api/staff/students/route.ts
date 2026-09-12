import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
export const dynamic='force-dynamic';
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function GET(req:Request){
 const staff=await getStaffIdentity(req);
 if(!staff)return respond({error:'Please sign in again. / 다시 로그인해주세요.'},401);
 if(!['korean_admin','local_teacher'].includes(staff.role))return respond({error:'Access denied.'},403);
 try{
  const {data,error}=await portalDb().rpc('get_care_roster',{p_actor_id:staff.id});
  if(error)return respond({error:error.code==='42501'?'Access denied.':'Student care is unavailable. Please try again later.'},error.code==='42501'?403:503);
  return respond(data);
 }catch{return respond({error:'Student care is unavailable. Please try again later.'},503);}
}
