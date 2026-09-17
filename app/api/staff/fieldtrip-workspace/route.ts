import { getStaffIdentity, portalDb } from '@/lib/portalAuth';
import { textBlocks, validBlocks, validItems, type Template, type Block } from '@/lib/fieldtripWorkspace';
import legacy from '@/lib/fieldtripLegacy.json';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status});
async function auth(req:Request){const u=await getStaffIdentity(req);return u?.role==='korean_admin'?u:null;}
const check=<T,>(r:{data:T;error:unknown})=>{if(r.error)throw r.error;return r.data;};
async function templates(){
 const db=portalDb();
 const [guides,notices,documents]=await Promise.all([
  db.from('guide_messages').select('*').order('sort_order'),db.from('fieldtrip_notices').select('*'),db.from('fieldtrip_workspace').select('*').like('id','template:%').order('updated_at',{ascending:false})
 ]);
 const gs=check(guides)||[],ns=check(notices)||[],docs=check(documents)||[];
 const originals:Template[]=legacy.map(g=>({id:'legacy:'+g.id,title:g.title,type:g.type as Template['type'],blocks:textBlocks(g.content),source:'기존 기본 문구',revision:0}));
 for(const g of gs.filter(g=>/필드|애프터|에프터/.test(g.category)))originals.unshift({id:'guide:'+g.id,title:g.title,type:/필드/.test(g.category)?'fieldtrip':'afterschool',blocks:textBlocks(g.content||''),source:'직원 저장 문구',revision:0});
 for(const n of ns){
  const block=(id:string,title:string,text:string,width:1|2=2):Block=>({id,title,text,width,height:140});
  originals.unshift({id:'notice:'+n.id,title:n.title||'기존 필드트립 안내문',type:'fieldtrip',revision:0,source:'기존 고정 안내문',originalUrl:n.category==='skating'?'/admin/notices/fieldtrip/skating/preview':undefined,blocks:[block('date','행사 일자',[n.event_date,n.event_day].filter(Boolean).join(' ')),block('schedule','당일 일정',(n.schedule||[]).map((s:Record<string,string>)=>[s.time,s.main,s.sub].filter(Boolean).join(' · ')).join('\n')), ...(n.programs||[]).map((p:Record<string,string>,i:number)=>block('program-'+i,[p.num,p.label].filter(Boolean).join(' '),[p.name,p.desc].filter(Boolean).join('\n'),1)),block('outfit','준비물·복장',n.outfit_text||'',1),block('safety','안전 안내',n.safety_text||'',1),block('pickup','픽업·하원',n.pickup_text||'',1),block('footer','마무리 안내',n.footer_msg||'')]});
 }
 return [...docs.map(d=>({...d.data,id:d.id,revision:d.revision,source:'저장한 템플릿'} as Template)),...originals];
}
export async function GET(req:Request){try{
 if(!await auth(req))return json({error:'직원 로그인이 필요합니다.'},403);
 const q=new URL(req.url).searchParams,db=portalDb();
 if(q.get('history')) {const id=q.get('history')!;if(!id.startsWith('template:'))return json({error:'잘못된 템플릿'},400);return json({history:check(await db.from('fieldtrip_workspace_history').select('revision,data,created_at').eq('document_id',id).order('revision',{ascending:false}).limit(30))});}
 const month=q.get('month');if(!month||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))return json({error:'월을 선택해주세요.'},400);
 const [monthData,list]=await Promise.all([db.rpc('fieldtrip_month',{p_month:month,p_action:'load'}),templates()]);return json({...check(monthData),templates:list});
 }catch(e){console.error('fieldtrip load',e);return json({error:'자료를 불러오지 못했습니다. 다시 시도해주세요.'},500);}}
export async function POST(req:Request){try{
 const actor=await auth(req);if(!actor)return json({error:'직원 로그인이 필요합니다.'},403);
 const raw=await req.text();if(raw.length>900000)return json({error:'내용이 너무 큽니다.'},400);const b=JSON.parse(raw),db=portalDb();
 if(b.action==='template'){
  const t=b.template;
  if(!t||!/^template:[0-9a-f-]{36}$/i.test(t.id)||typeof t.title!=='string'||!t.title.trim()||t.title.length>200||!['fieldtrip','afterschool'].includes(t.type)||!validBlocks(t.blocks)||!Number.isInteger(t.revision)||t.revision<0)return json({error:'템플릿 이름과 항목을 확인해주세요.'},400);
  const result=await db.rpc('fieldtrip_document_save',{p_id:t.id,p_revision:t.revision,p_data:{title:t.title.trim(),type:t.type,blocks:t.blocks},p_actor:actor.username});if(result.error)throw result.error;return json(result.data);
 }
 if(!['save','publish'].includes(b.action)||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(b.month)||!Number.isInteger(b.revision)||b.revision<0||typeof b.fingerprint!=='string')return json({error:'잘못된 저장 요청입니다.'},400);
 if(b.action==='save'&&!validItems(b.items,b.month))return json({error:'날짜·내용을 확인해주세요. 같은 날짜·유형은 한 번만 등록할 수 있습니다.'},400);
 const result=await db.rpc('fieldtrip_month',{p_month:b.month,p_action:b.action,p_revision:b.revision,p_items:b.items||[],p_fingerprint:b.fingerprint,p_actor:actor.username});if(result.error)throw result.error;return json(result.data);
 }catch(e){const msg=e&&typeof e==='object'&&'message'in e?String(e.message):'';if(msg.includes('CONFLICT'))return json({error:'다른 직원 또는 기존 화면에서 변경했습니다. 새로고침 후 다시 확인해주세요.'},409);console.error('fieldtrip save',e);return json({error:'저장하지 못했습니다. 입력 내용을 유지한 채 다시 시도해주세요.'},500);}}
