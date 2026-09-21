import { NextResponse } from 'next/server';
import { getStaffIdentity, portalDb } from '@/lib/portalAuth';
import { CHECKLIST_KEY, DEFAULT_CHECKLIST, validateChecklist } from '@/lib/dreamhouseChecklist';
export const dynamic = 'force-dynamic';
async function access(req: Request) {
  const staff = await getStaffIdentity(req);
  if (!staff) return NextResponse.json({error:'Please sign in with your staff account.'},{status:401});
  if (staff.role !== 'korean_admin') return NextResponse.json({error:'Staff workspace access is required.'},{status:403});
  return null;
}
async function scope(req:Request){
  const id=new URL(req.url).searchParams.get('bookingId');
  if(!id)return {key:CHECKLIST_KEY,id:null};
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id))return null;
  const {data,error}=await portalDb().from('bookings').select('id').eq('id',id).maybeSingle();
  if(error)throw error;
  return data?{key:CHECKLIST_KEY+':booking:'+id,id}:null;
}
function validFields(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const fields=value as Record<string,unknown>;
  return Object.keys(fields).length===6&&['guest','date','house','beds','inspector','notes'].every(k=>typeof fields[k]==='string'&&(fields[k] as string).length<=(k==='notes'?600:100));
}
export async function GET(req: Request) {
  try {
    const denied=await access(req); if(denied)return denied;
    const target=await scope(req);if(!target)return NextResponse.json({error:'예약을 찾을 수 없습니다.'},{status:404});
    const {data,error}=await portalDb().from('app_settings').select('value').eq('key',target.key).maybeSingle();
    if(error)throw error;
    let template=data?validateChecklist(data.value):DEFAULT_CHECKLIST;
    if(target.id&&!data){
      const common=await portalDb().from('app_settings').select('value').eq('key',CHECKLIST_KEY).maybeSingle();
      if(common.error)throw common.error;
      const base=common.data?validateChecklist(common.data.value):DEFAULT_CHECKLIST;
      template=base?{...base,revision:0}:null;
    }
    if(!template)throw Error('Invalid saved checklist');
    return NextResponse.json({template,fields:target.id&&validFields(data?.value?.fields)?data!.value.fields:null,variant:target.id&&data?.value?.variant==='daon'?'daon':'standard',customized:!!(target.id&&data)},{headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'Could not load the checklist. Please try again.'},{status:503}); }
}
export async function PUT(req: Request) {
  try {
    const denied=await access(req); if(denied)return denied;
    const target=await scope(req);if(!target)return NextResponse.json({error:'예약을 찾을 수 없습니다.'},{status:404});
    if(!target.id&&new URL(req.url).searchParams.get('scope')!=='shared')return NextResponse.json({error:'전체 양식은 체크인 준비의 체크인 체크리스트 탭에서 수정해주세요.'},{status:400});
    let body;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid checklist.'},{status:400});}
    const template=validateChecklist(body);
    if(!template)return NextResponse.json({error:'Each section needs a title and at least one item. Keep titles under 80 and items under 180 characters (180 items maximum).'}, {status:400});
    if(target.id&&(!validFields(body.fields)||!['standard','daon'].includes(body.variant)))return NextResponse.json({error:'예약별 체크리스트 정보를 확인해주세요.'},{status:400});
    const db=portalDb(),current=await db.from('app_settings').select('value').eq('key',target.key).maybeSingle();
    if(current.error)throw current.error;
    if((current.data?.value?.revision??0)!==template.revision)return NextResponse.json({error:'Another employee updated this checklist. Your edits are still here. Copy any changes you need, then reload the saved version.'},{status:409});
    const saved={...template,revision:template.revision+1};
    const row={key:target.key,value:{...saved,...(target.id?{fields:body.fields,variant:body.variant}:{})},updated_at:new Date().toISOString()};
    const result=current.data
      ?await db.from('app_settings').update(row).eq('key',target.key).eq('value',JSON.stringify(current.data.value)).select('key')
      :await db.from('app_settings').insert(row).select('key');
    if(result.error?.code==='23505'||(!result.error&&!result.data?.length))return NextResponse.json({error:'Another employee saved first. Your edits are still here. Reload the saved version before saving again.'},{status:409});
    if(result.error)throw result.error;
    return NextResponse.json({template:saved});
  } catch { return NextResponse.json({error:'Could not save. Your edits are still here. Please try again.'},{status:503}); }
}
