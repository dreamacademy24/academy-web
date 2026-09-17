import {NextResponse} from 'next/server';
import {chatAccess,chatError,chatTask,chatReferences,chatTaskLookup,uuid} from '@/lib/staffChat';
import {sendChatPush} from '@/lib/staffChatPush';
export const dynamic='force-dynamic';
function failure(e:unknown){return NextResponse.json({error:(e as Error).message||'채팅 요청에 실패했습니다.'},{status:(e as any).status||503});}
export async function GET(req:Request){try{
 const c=await chatAccess(req),u=new URL(req.url),room=u.searchParams.get('room'),task=u.searchParams.get('task');
 const lookup=u.searchParams.get('lookup');if(lookup){
  const q=(u.searchParams.get('q')||'').trim().slice(0,100);
  if(lookup==='task'){
   const cursor=Number(u.searchParams.get('cursor')||0);if(!Number.isSafeInteger(cursor)||cursor<0)chatError('목록 위치를 확인해주세요.');
   return NextResponse.json(await chatTaskLookup(c,q,u.searchParams.get('employee')||'',cursor));
  }
  if(q.length<2)return NextResponse.json({results:[]});
  const pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
  if(lookup==='booking'){const column=/^DA[-\d]/i.test(q)?'reservation_no':'booker_name';const r=await c.db.from('bookings').select('id,reservation_no,booker_name,checkin_date,checkout_date,assignee').ilike(column,pattern).order('checkin_date',{ascending:false}).limit(20);if(r.error)throw r.error;return NextResponse.json({results:(r.data||[]).map(b=>({kind:'booking',id:b.id,label:b.booker_name,detail:[b.reservation_no,b.checkin_date+' ~ '+b.checkout_date,b.assignee||'미배정'].join(' · ')}))});}
  chatError('검색 대상을 확인해주세요.');
 }
 if(task){await chatTask(c.db,task,c.actor);const links=await c.db.from('staff_message_links').select('message_id').eq('task_id',task);if(links.error)throw links.error;
  const ids=(links.data||[]).map(l=>l.message_id);if(!ids.length)return NextResponse.json({messages:[]});
  const m=await c.db.from('staff_messages').select('*').in('id',ids).order('seq');if(m.error)throw m.error;
  const messages=await Promise.all((m.data||[]).map(async m=>({...m,refs:await chatReferences(c.db,m.refs||[],c.actor),canOpen:c.rooms.includes(m.room)})));
  return NextResponse.json({messages,employees:c.employees});
 }
 if(!room){const counts=await c.db.rpc('staff_message_counts',{p_employee:c.actor,p_rooms:c.rooms});if(counts.error)throw counts.error;return NextResponse.json({actor:c.actor,employees:c.employees,rooms:c.rooms,groups:c.groups,counts:counts.data});}
 c.checkRoom(room);
 const q=u.searchParams.get('q')?.trim().slice(0,150),before=Number(u.searchParams.get('before')||0),target=u.searchParams.get('message');
 let query=c.db.from('staff_messages').select('*').eq('room',room);
 if(q)query=query.ilike('body','%'+q.replace(/[\\%_]/g,'\\$&')+'%');
 if(before>0)query=query.lt('seq',before);
 if(target&&uuid(target)){const found=await c.db.from('staff_messages').select('seq').eq('room',room).eq('id',target).maybeSingle();if(found.data)query=query.lte('seq',found.data.seq+20);}
 const result=await query.order('seq',{ascending:false}).limit(60);if(result.error)throw result.error;
 const messages=(result.data||[]).reverse(),ids=messages.map(m=>m.id);
 const [reads,links,replies]=await Promise.all([
  c.db.from('staff_message_reads').select('employee,seq').eq('room',room),
  ids.length?c.db.from('staff_message_links').select('message_id,task_id').in('message_id',ids):Promise.resolve({data:[],error:null}),
  messages.some(m=>m.reply_to)?c.db.from('staff_messages').select('id,sender,body').eq('room',room).in('id',messages.map(m=>m.reply_to).filter(Boolean)):Promise.resolve({data:[],error:null})]);
 if(reads.error||links.error||replies.error)throw Error('대화 상태를 불러오지 못했습니다.');
 const visibleLinks=[];for(const l of links.data||[]){try{const t=await chatTask(c.db,l.task_id,c.actor);visibleLinks.push({...l,title:t.title});}catch{ /* A secret task title is not exposed to chat members. */ }}
 const resolved=await Promise.all(messages.map(async m=>({...m,refs:await chatReferences(c.db,m.refs||[],c.actor)})));
 return NextResponse.json({messages:resolved,reads:reads.data,links:visibleLinks,replies:replies.data,more:messages.length===60});
 }catch(e){return failure(e);}}
export async function POST(req:Request){try{
 const c=await chatAccess(req),b=await req.json();
 if(b.action==='create_group'){
  const name=typeof b.name==='string'?b.name.trim():'';
  if(!uuid(b.id)||!name||name.length>80||!Array.isArray(b.members)||b.members.length>50||b.members.some((id:unknown)=>typeof id!=='string'||!c.employees.some(e=>e.id===id)))chatError('채팅방 이름과 참여 직원을 확인해주세요.');
  const members=[...new Set<string>([c.actor,...b.members])].sort();if(members.length<2||members.length>50)chatError('함께 대화할 직원을 한 명 이상 선택해주세요.');
  const r=await c.db.rpc('staff_chat_group_create',{p_id:b.id,p_name:name,p_creator:c.actor,p_members:members});
  if(r.error)chatError('그룹 채팅을 만들지 못했습니다. 참여자를 확인하고 다시 시도해주세요.',409);
  return NextResponse.json({group:{...r.data,room:'group:'+r.data.id}});
 }
 if(b.action==='read'){c.checkRoom(b.room);if(!Number.isSafeInteger(b.seq)||b.seq<1)chatError('읽음 위치가 올바르지 않습니다.');const r=await c.db.rpc('staff_message_read',{p_room:b.room,p_employee:c.actor,p_seq:b.seq});if(r.error)throw r.error;return NextResponse.json({ok:true});}
 if(b.action==='link'){
  if(!uuid(b.message)||typeof b.task!=='string')chatError('연결할 업무를 선택해주세요.');
  const m=await c.db.from('staff_messages').select('*').eq('id',b.message).single();if(m.error)chatError('메시지를 찾지 못했습니다.',404);c.checkRoom(m.data.room);await chatTask(c.db,b.task,c.actor);
  const saved=await c.db.from('staff_message_links').upsert({message_id:b.message,task_id:b.task,linked_by:c.actor},{onConflict:'message_id,task_id',ignoreDuplicates:true});if(saved.error)throw saved.error;
  return NextResponse.json({ok:true});
 }
 const members=c.checkRoom(b.room),text=typeof b.text==='string'?b.text.trim():'';
 if(!uuid(b.id)||text.length>20000||(!text&&!b.files?.length&&!b.refs?.length)||!Array.isArray(b.files)||b.files.length>10||b.files.some((id:unknown)=>!uuid(id))||(b.reply&&!uuid(b.reply)))chatError('메시지 또는 첨부를 확인해주세요.');
 const refs=(await chatReferences(c.db,b.refs||[],c.actor,true)).map(r=>({kind:r.kind,id:r.id}));
 const mentions=Array.isArray(b.mentions)?[...new Set<string>(b.mentions.filter((id:string)=>members.includes(id)&&id!==c.actor))].sort():[];
 let files:any[]=[];if(b.files.length){const f=await c.db.from('staff_message_files').select('id,name,mime,size').in('id',b.files).eq('room',b.room).eq('owner',c.actor);if(f.error||f.data?.length!==new Set(b.files).size)chatError('첨부 권한을 확인하지 못했습니다.');files=f.data.sort((a,b)=>a.id.localeCompare(b.id));}
 const r=await c.db.rpc('staff_message_send',{p_id:b.id,p_room:b.room,p_sender:c.actor,p_body:text,p_reply:b.reply||null,p_mentions:mentions,p_files:files,p_refs:refs});
 if(r.error)chatError(r.error.message.includes('conflict')?'이미 전송된 메시지와 내용이 다릅니다. 대화를 확인해주세요.':'메시지를 저장하지 못했습니다. 입력은 유지됩니다.',409);
 let push='not_requested';if(r.data.created){const recipients=b.room.startsWith('dm:')?members.filter(id=>id!==c.actor):mentions;push=await sendChatPush(c.db,recipients,b.room,b.id).catch(()=> 'failed');}
 return NextResponse.json({...r.data,push});
 }catch(e){return failure(e);}}
