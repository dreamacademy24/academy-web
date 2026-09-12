import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
import {canReviewStudents} from '@/lib/staffSession';
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function POST(req:Request){
 const staff=await getStaffIdentity(req);
 if(!staff)return respond({error:'다시 로그인해주세요.'},401);
 if(!canReviewStudents(staff))return respond({error:'담당자 배정은 관리자만 변경할 수 있습니다.'},403);
 let body;
 try{body=await req.json();}catch{return respond({error:'잘못된 요청입니다.'},400);}
 if(!body||!uuid(body.requestId)||!uuid(body.visitId)||!uuid(body.teacherId)||typeof body.active!=='boolean'||!(body.previousId===null||uuid(body.previousId)))return respond({error:'배정할 방문과 선생님을 확인해주세요.'},400);
 try{
  const {data,error}=await portalDb().rpc('set_care_assignment',{p_actor_id:staff.id,p_request_id:body.requestId,p_visit_id:body.visitId,p_teacher_id:body.teacherId,p_active:body.active,p_previous_id:body.previousId});
  if(error){
   if(error.code==='40001'||error.code==='23505')return respond({error:'배정 정보가 변경됐습니다. 새로고침 후 다시 확인해주세요.'},409);
   if(error.code==='42501')return respond({error:'배정 권한이 없습니다.'},403);
   if(error.code==='22023')return respond({error:'방문 또는 선생님의 현재 상태를 확인해주세요.'},400);
   return respond({error:'저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해주세요.'},503);
  }
  return respond(data);
 }catch{return respond({error:'저장 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해주세요.'},503);}
}
