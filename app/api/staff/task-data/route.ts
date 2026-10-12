import { NextResponse } from 'next/server';
import { portalDb, workspaceStaffIdentity } from '@/lib/portalAuth';
import { taskAllows } from '@/lib/staffChat';

const deny = () => { throw Object.assign(new Error('이 업무에 접근할 수 없습니다.'), { status: 403 }); };
export async function POST(req: Request) {
 try {
  const username = await workspaceStaffIdentity(req);
  if (!username) return NextResponse.json({error:'로그인이 필요합니다.'},{status:401});
  const actor=username.replace(/^admin-/,''), input=await req.json();
  const [table,query='']=String(input.path||'').split('?');
  if(!['staff_tasks','staff_task_comments'].includes(table)||actor==='jun')return NextResponse.json({error:'잘못된 요청입니다.'},{status:400});
  const db=portalDb(), params=new URLSearchParams(query), method=input.method||'GET';
  const taskRows:any[]=[];
  for(let offset=0;;offset+=1000){const r=await db.from('staff_tasks').select('*').order('id').range(offset,offset+999);if(r.error)throw r.error;taskRows.push(...r.data);if(r.data.length<1000)break;}
  const allowed=taskRows.filter(t=>taskAllows(t,actor)), ids=new Set(allowed.map(t=>t.id));
  function checkTask(id:string){if(!ids.has(id))deny();}
  if(method==='GET'){
   let rows:any[]=allowed;
   if(table==='staff_task_comments'){
    rows=[];
    for(let offset=0;;offset+=1000){const r=await db.from(table).select('*').order('id').range(offset,offset+999);if(r.error)throw r.error;rows.push(...r.data.filter(c=>ids.has(c.task_id)));if(r.data.length<1000)break;}
   }
   for(const [key,value] of params){if(['order','limit','offset'].includes(key))continue;if(!['id','task_id'].includes(key)||!value.startsWith('eq.'))throw Error('지원하지 않는 조회입니다.');rows=rows.filter(r=>String(r[key])===value.slice(3));}
   const [sort,direction]=(params.get('order')||(table==='staff_tasks'?'created_at.desc':'ts.asc')).split('.');
   if(!['created_at','ts','id'].includes(sort))throw Error('잘못된 정렬입니다.');
   rows.sort((a,b)=>{const av=a[sort],bv=b[sort];const cmp=av<bv?-1:av>bv?1:0;return direction==='desc'?-cmp:cmp;});
   const offset=Math.max(0,Number(params.get('offset'))||0), limit=Number(params.get('limit'))||rows.length;
   return NextResponse.json(rows.slice(offset,offset+limit),{headers:{'Cache-Control':'private, no-store'}});
  }
  if(!['POST','PATCH','DELETE'].includes(method))throw Error('지원하지 않는 요청입니다.');
  const body=input.body;
  if(method==='POST'){
   if(!body||Array.isArray(body)||typeof body!=='object')throw Error('업무를 한 건씩 저장해주세요.');
   if(table==='staff_tasks'){
    const prior=taskRows.find(t=>t.id===body.id);
    if(prior){checkTask(prior.id);if(!input.upsert)throw Error('이미 있는 업무입니다.');}
    else if(body.created_by!==actor)deny();
    if(prior&&body.created_by!==undefined&&body.created_by!==prior.created_by)deny();
    if(body.secret)body.shared=false;
   }else{
    checkTask(body.task_id);if(body.from_id!==actor)deny();
    if(body.id){const old=await db.from(table).select('task_id,from_id').eq('id',body.id).maybeSingle();if(old.error)throw old.error;if(old.data&&(old.data.from_id!==actor||old.data.task_id!==body.task_id))deny();}
   }
   const result=await (input.upsert?db.from(table).upsert(body):db.from(table).insert(body)).select();if(result.error)throw result.error;
   return NextResponse.json(result.data);
  }
  const entries=[...params.entries()];if(entries.length!==1||!['id','task_id'].includes(entries[0][0])||!entries[0][1].startsWith('eq.'))throw Error('대상을 확인해주세요.');
  const [field,filter]=entries[0],id=filter.slice(3);
  if(table==='staff_tasks'){if(field!=='id')deny();checkTask(id);if(body?.id&&body.id!==id)deny();if(body?.created_by!==undefined&&body.created_by!==taskRows.find(t=>t.id===id)?.created_by)deny();if(body?.secret)body.shared=false;}
  else if(field==='task_id')checkTask(id);
  else{const r=await db.from(table).select('task_id,from_id').eq('id',id).maybeSingle();if(r.error)throw r.error;if(!r.data)deny();checkTask(r.data!.task_id);if(r.data!.from_id!==actor)deny();}
  if(table==='staff_task_comments'&&method==='PATCH')throw Error('댓글 수정 화면을 이용해주세요.');
  const result=await (method==='DELETE'?db.from(table).delete():db.from(table).update(body)).eq(field,id).select();if(result.error)throw result.error;
  return NextResponse.json(result.data);
 }catch(e){return NextResponse.json({error:(e as Error).message||'저장 실패'},{status:(e as {status?:number}).status||400});}
}
