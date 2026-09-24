import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:Request){
 try {
  const staff=await getStaffIdentity(req);
  if(!staff||!['korean_admin','local_teacher'].includes(staff.role))return reply({error:'직원 로그인이 필요합니다.'},403);
  const body=await req.json().catch(()=>null);
  if(!body||!/^\d+$/.test(String(body.id))||typeof body.completed!=='boolean')return reply({error:'완료 요청을 확인해주세요.'},400);
  const db=portalDb();
  const {data:op,error:readError}=await db.from('staff_opinions').select('id,from_id').eq('id',body.id).maybeSingle();
  if(readError)throw readError;
  if(!op)return reply({error:'의견요청을 찾을 수 없습니다.'},404);
  const actor=staff.username.replace(/^admin-/,'');
  if(op.from_id!==actor&&op.from_id!==staff.id&&staff.role!=='korean_admin')return reply({error:'작성자 또는 관리자만 완료할 수 있습니다.'},403);
  const {data,error}=await db.from('staff_opinions').update({completed_at:body.completed?new Date().toISOString():null}).eq('id',op.id).select('*').single();
  if(error)throw error;
  return reply({opinion:data});
 }catch{return reply({error:'완료 상태를 저장하지 못했습니다. 다시 시도해주세요.'},503);}
}

