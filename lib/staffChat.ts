import {getStaffIdentity,portalDb} from './portalAuth';
export function chatError(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
export function dmRoom(a:string,b:string){return 'dm:'+ [a,b].sort().join(':');}
export function roomMembers(room:string,ids:string[]){
 if(room==='all')return ids;
 const parts=room.split(':');
 if(parts.length!==3||parts[0]!=='dm'||parts[1]===parts[2]||dmRoom(parts[1],parts[2])!==room||!parts.slice(1).every(id=>ids.includes(id)))return [];
 return parts.slice(1);
}
export function taskAllows(task:any,actor:string){
 if(!task)return false;let ids=task.assignees;
 if(typeof ids==='string'){try{ids=JSON.parse(ids);}catch{ids=[];}}
 return !task.secret||task.created_by===actor||task.assignee===actor||(Array.isArray(ids)&&ids.includes(actor));
}
export async function chatAccess(req:Request){
 const staff=await getStaffIdentity(req);
 if(!staff)chatError('로그인이 만료되었습니다. 다시 로그인해주세요.',401);
 if(staff.role!=='korean_admin')chatError('직원업무 채팅 권한이 없습니다.',403);
 const db=portalDb(),actor=staff.username.replace(/^admin-/,'');
 const {data,error}=await db.from('staff_accounts').select('username,name').eq('is_active',true).eq('role','korean_admin');
 if(error)chatError('직원 목록을 불러오지 못했습니다.',503);
 const employees=(data||[]).map(e=>({id:e.username.replace(/^admin-/,''),name:e.name})).filter(e=>e.id!=='jun');
 if(!employees.some(e=>e.id===actor))chatError('사용 권한이 없습니다.',403);
 const groupResult=await db.from('staff_chat_groups').select('id,name,creator,members,created_at').contains('members',[actor]).order('created_at');
 if(groupResult.error)chatError('그룹 채팅 목록을 불러오지 못했습니다.',503);
 const ids=employees.map(e=>e.id),groups=(groupResult.data||[]).map(g=>({...g,members:g.members.filter((id:string)=>ids.includes(id)),room:'group:'+g.id}));
 const rooms=['all',...ids.filter(id=>id!==actor).map(id=>dmRoom(actor,id)),...groups.map(g=>g.room)];
 return {db,actor,employees,rooms,groups,checkRoom:(room:string):string[]=>{if(!rooms.includes(room))chatError('이 대화에 접근할 수 없습니다.',403);return groups.find(g=>g.room===room)?.members||roomMembers(room,ids);}};
}
export async function chatTask(db:ReturnType<typeof portalDb>,id:string,actor:string){
 const {data,error}=await db.from('staff_tasks').select('id,title,secret,created_by,assignee,assignees,done,due').eq('id',id).maybeSingle();
 if(error)chatError('업무를 확인하지 못했습니다.',503);if(!taskAllows(data,actor))chatError('이 업무에 접근할 수 없습니다.',403);return data!;
}
export function uuid(value:unknown){return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);}
export async function chatReferences(db:ReturnType<typeof portalDb>,refs:any,actor:string,strict=false){
 if(!Array.isArray(refs)||refs.length>5)chatError('업무·예약은 메시지당 최대 5개까지 연결할 수 있습니다.');
 const result=[];
 for(const ref of refs){
  if(!ref||!['task','booking'].includes(ref.kind)||typeof ref.id!=='string'||!ref.id||ref.id.length>200)chatError('연결 정보를 확인해주세요.');
  try{
   if(ref.kind==='task'){const t=await chatTask(db,ref.id,actor);result.push({kind:'task',id:t.id,label:t.title,detail:[t.done?'완료':'진행 중','담당 '+(t.assignee||'미배정'),t.due?'기한 '+t.due:'기한 없음'].join(' · ')});}
   else{if(!uuid(ref.id))chatError('예약을 확인해주세요.');const b=await db.from('bookings').select('id,reservation_no,booker_name,checkin_date,checkout_date,assignee').eq('id',ref.id).maybeSingle();if(b.error)throw b.error;if(!b.data)chatError('예약을 찾을 수 없습니다.',404);const r=b.data;result.push({kind:'booking',id:r.id,label:r.booker_name||r.reservation_no,detail:[r.reservation_no,(r.checkin_date||'')+' ~ '+(r.checkout_date||''),r.assignee?'담당 '+r.assignee:'담당 미배정'].filter(Boolean).join(' · ')});}
  }catch(e){if(strict)throw e;result.push({kind:ref.kind,id:ref.id,label:'삭제되었거나 열람 권한이 없는 '+(ref.kind==='task'?'업무':'예약'),unavailable:true});}
 }return result;
}
