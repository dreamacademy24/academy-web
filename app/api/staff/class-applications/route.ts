import {NextResponse} from 'next/server';
import {portalDb,portalStaffIdentity} from '@/lib/portalAuth';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 try{
  const username=await portalStaffIdentity(req);
  if(!username)return NextResponse.json({error:'로그인이 필요합니다.'},{status:401,headers});
  const db=portalDb(),rows:any[]=[];
  for(let offset=0;;offset+=500){
   const r=await db.from('staff_tasks').select('*').not('application_source','is',null).eq('done',false).order('created_at',{ascending:false}).order('id').range(offset,offset+499);
   if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<500)break;
  }
  const id=username.replace(/^admin-/,''),visible=rows.filter(r=>!r.secret||r.created_by===id||r.assignee===id||(Array.isArray(r.assignees)&&r.assignees.includes(id)));
  const counts={tutor:visible.filter(r=>r.application_source.kind==='tutor').length,online:visible.filter(r=>r.application_source.kind==='online').length};
  return NextResponse.json({counts,items:visible,employee:id},{headers});
 }catch{return NextResponse.json({error:'신규 신청을 불러오지 못했습니다. 다시 확인해주세요.'},{status:503,headers});}
}
