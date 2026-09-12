import {NextResponse} from 'next/server';
import {getStaffIdentity,staffCookie} from '@/lib/portalAuth';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function POST(req:Request){
 try{
  const staff=await getStaffIdentity(req);
  if(!staff)return reply({error:'Please sign in. / 로그인이 필요합니다.'},401);
  if(!['korean_admin','local_teacher'].includes(staff.role))return reply({error:'Access denied.'},403);
  const response=reply({staff:{username:staff.username,name:staff.name,role:staff.role}});
  response.cookies.set(staffCookie(staff.username));
  return response;
 }catch{return reply({error:'로그인 상태를 확인할 수 없습니다. 잠시 후 다시 시도해주세요. / Sign-in service is temporarily unavailable.'},503);}
}
