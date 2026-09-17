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
export async function GET(req: Request) {
  try {
    const denied=await access(req); if(denied)return denied;
    const {data,error}=await portalDb().from('app_settings').select('value').eq('key',CHECKLIST_KEY).maybeSingle();
    if(error)throw error;
    const template=data?validateChecklist(data.value):DEFAULT_CHECKLIST;
    if(!template)throw Error('Invalid saved checklist');
    return NextResponse.json({template},{headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'Could not load the checklist. Please try again.'},{status:503}); }
}
export async function PUT(req: Request) {
  try {
    const denied=await access(req); if(denied)return denied;
    let body;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid checklist.'},{status:400});}
    const template=validateChecklist(body);
    if(!template)return NextResponse.json({error:'Each section needs a title and at least one item. Keep titles under 80 and items under 180 characters (180 items maximum).'}, {status:400});
    const db=portalDb(),current=await db.from('app_settings').select('value').eq('key',CHECKLIST_KEY).maybeSingle();
    if(current.error)throw current.error;
    if((current.data?.value?.revision??0)!==template.revision)return NextResponse.json({error:'Another employee updated this checklist. Your edits are still here. Copy any changes you need, then reload the saved version.'},{status:409});
    const saved={...template,revision:template.revision+1};
    const row={key:CHECKLIST_KEY,value:saved,updated_at:new Date().toISOString()};
    const result=current.data
      ?await db.from('app_settings').update(row).eq('key',CHECKLIST_KEY).eq('value',JSON.stringify(current.data.value)).select('key')
      :await db.from('app_settings').insert(row).select('key');
    if(result.error?.code==='23505'||(!result.error&&!result.data?.length))return NextResponse.json({error:'Another employee saved first. Your edits are still here. Reload the saved version before saving again.'},{status:409});
    if(result.error)throw result.error;
    return NextResponse.json({template:saved});
  } catch { return NextResponse.json({error:'Could not save. Your edits are still here. Please try again.'},{status:503}); }
}
