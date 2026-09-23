import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(req:Request){
  try {
    const staff=await getStaffIdentity(req);
    if(!staff || !['korean_admin','local_teacher'].includes(staff.role))return reply({error:'직원 로그인이 필요합니다.'},403);
    const body=await req.json().catch(()=>null);
    if(!body || typeof body.taskId!=='string' || !body.taskId || body.taskId.length>250 || typeof body.completed!=='boolean' || Object.keys(body).some(k=>!['taskId','completed'].includes(k)))return reply({error:'완료 요청이 올바르지 않습니다.'},400);
    const actor=staff.username.replace(/^admin-/,'');
    const {data,error}=await portalDb().rpc('staff_complete_own_task',{task_id:body.taskId,actor,completed:body.completed});
    if(error)return reply({error:error.code==='42501'?'본인에게 배정된 업무만 완료할 수 있습니다.':'완료 상태를 저장하지 못했습니다.'},error.code==='42501'?403:error.code==='P0002'?404:503);
    return reply({task:data});
  }catch{return reply({error:'서버 연결을 확인하고 다시 시도해주세요.'},503);}
}

