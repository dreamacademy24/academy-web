import { NextResponse } from 'next/server';
import { getStaffIdentity, portalDb } from '@/lib/portalAuth';

export const dynamic = 'force-dynamic';
const allowed = ['korean_admin','korean_staff'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(req: Request) {
 try {
  const staff=await getStaffIdentity(req);
  if(!staff || !allowed.includes(staff.role)) return NextResponse.json({error:'직원 로그인 후 이용해주세요.'},{status:401});
  const db=portalDb(), id=new URL(req.url).searchParams.get('id');
  if(id) {
   if(!uuid.test(id)) return NextResponse.json({error:'잘못된 항목입니다.'},{status:400});
   const {data:issue,error}=await db.from('house_pending_items').select('*').eq('id',id).single();
   if(error || !issue) return NextResponse.json({error:'문제를 찾을 수 없습니다.'},{status:404});
   const {data:events,error:ee}=await db.from('house_issue_events').select('*').eq('issue_id',id).order('created_at');
   if(ee) throw ee;
   let source=null;
   if(issue.report_id) {
    const {data,error:se}=await db.from('house_reports').select('reporter,report_date,time_slot,rooms').eq('id',issue.report_id).maybeSingle();
    if(se) throw se;
    source=data?{reporter:data.reporter,date:data.report_date,files:(data.rooms||[]).filter((r:{room_no:string})=>r.room_no===issue.room_no).flatMap((r:{files?:unknown[]})=>r.files||[])}:null;
   }
   return NextResponse.json({issue,events,source,viewer:staff.name});
  }
  // Range pagination includes all historic records without silently truncating at 1,000.
  const items=[];
  for(let start=0;;start+=500){
   const {data,error}=await db.from('house_issues_summary').select('id,room_no,content,status,created_at,resolved_at,assignee,next_action,next_check,updated_at,version,report_id,latest_note').order('created_at',{ascending:false}).order('id').range(start,start+499);
   if(error) throw error; items.push(...data); if(data.length<500)break;
  }
  const {data:people,error:pe}=await db.from('staff_accounts').select('username,name').eq('is_active',true).in('role',allowed).order('name');
  if(pe)throw pe;
  return NextResponse.json({items,people,viewer:staff.name,viewerId:staff.username});
 }catch{return NextResponse.json({error:'보고를 불러오지 못했습니다. 다시 시도해주세요.'},{status:503});}
}
export async function POST(req:Request){
 try{
  const staff=await getStaffIdentity(req);
  if(!staff || !allowed.includes(staff.role))return NextResponse.json({error:'직원 로그인 후 이용해주세요.'},{status:401});
  const b=await req.json();
  if(!['create','comment','progress','status'].includes(b.action) || (b.action!=='create'&&!uuid.test(b.id||'')))return NextResponse.json({error:'잘못된 요청입니다.'},{status:400});
  for(const [key,max] of [['content',5000],['room_no',100],['next_action',1000],['assignee',100]] as const){if(b[key]!=null&&(typeof b[key]!=='string'||b[key].length>max))return NextResponse.json({error:'입력 길이를 확인해주세요.'},{status:400});}
  const files=b.files||[];
  if(!Array.isArray(files)||files.length>5||JSON.stringify(files).length>3500000||files.some((f:{data?:string;name?:string;type?:string})=>!/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(f.data||'')||typeof f.name!=='string'||f.name.length>200))return NextResponse.json({error:'사진은 JPEG·PNG·WebP 형식, 총 2.5MB 이내로 올려주세요.'},{status:400});
  if(b.next_check && !/^\d{4}-\d{2}-\d{2}$/.test(b.next_check))return NextResponse.json({error:'확인 날짜를 확인해주세요.'},{status:400});
  const db=portalDb();
  if(b.assignee){const {data}=await db.from('staff_accounts').select('username').eq('username',b.assignee).eq('is_active',true).in('role',allowed).maybeSingle();if(!data)return NextResponse.json({error:'담당자를 다시 선택해주세요.'},{status:400});}
  const {data,error}=await db.rpc('house_issue_write',{p_id:b.id||null,p_action:b.action,p_data:{content:b.content,room_no:b.room_no,status:b.status,assignee:b.assignee,next_action:b.next_action,next_check:b.next_check,files},p_author:staff.username,p_name:staff.name,p_version:b.version??null});
  if(error){const conflict=error.message.includes('conflict');return NextResponse.json({error:conflict?'다른 직원이 먼저 수정했습니다. 새로고침 후 다시 저장해주세요.':'저장하지 못했습니다. 입력 내용과 연결 상태를 확인해주세요.'},{status:conflict?409:400});}
  return NextResponse.json({ok:true,id:data});
 }catch{return NextResponse.json({error:'저장하지 못했습니다. 입력 내용은 유지됩니다.'},{status:503});}
}
