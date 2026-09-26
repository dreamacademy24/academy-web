import type { portalDb } from './portalAuth';
type Db=ReturnType<typeof portalDb>;
export function taskCommentPeople(task:{created_by?:string;assignee?:string;assignees?:unknown}){
 let ids=task.assignees;if(typeof ids==='string'){try{ids=JSON.parse(ids);}catch{ids=[];}}
 return [...new Set([task.created_by,task.assignee,...(Array.isArray(ids)?ids:[])].filter((id):id is string=>typeof id==='string'&&!!id&&id!=='all'))];
}
export async function commentThreadContext(db:Db,taskId:string,mentionIds:unknown,parentId:unknown){
 if(!Array.isArray(mentionIds)||mentionIds.length>50||mentionIds.some(id=>typeof id!=='string'||id.length>100))throw Error('태그할 직원을 확인해주세요.');
 const taskResult=await db.from('staff_tasks').select('id,title,secret,created_by,assignee,assignees').eq('id',taskId).single();
 if(taskResult.error)throw Error('업무 정보를 확인하지 못했습니다.');
 const task=taskResult.data,people=taskCommentPeople(task);
 const accounts=await db.from('staff_accounts').select('username,name').eq('role','korean_admin').eq('is_active',true);
 if(accounts.error)throw Error('직원 목록을 확인하지 못했습니다.');
 const active=new Map((accounts.data||[]).map(p=>[p.username.replace(/^admin-/,''),p.name]));active.delete('jun');
 const mentions=[...new Set(mentionIds as string[])];
 if(mentions.some(id=>!active.has(id)||(task.secret&&!people.includes(id))))throw Error('이 업무를 볼 수 있는 재직 직원만 태그할 수 있습니다.');
 let parent=null;
 if(parentId){
  if(typeof parentId!=='string'||parentId.length>200)throw Error('답글을 남길 댓글을 확인해주세요.');
  const r=await db.from('staff_task_comments').select('id,task_id,from_id,parent_id').eq('id',parentId).eq('task_id',taskId).maybeSingle();
  if(r.error||!r.data)throw Error('원래 댓글이 삭제되었거나 다른 업무의 댓글입니다.');
  parent=r.data;
 }
 return {task,people,active,mentions,parent};
}
export async function notifyTaskComment(db:Db,author:string,comment:{id:string;task_id:string;text:string},ctx:Awaited<ReturnType<typeof commentThreadContext>>){
 const recipients=[...new Set([...ctx.people,...ctx.mentions,...(ctx.parent?[ctx.parent.from_id]:[])])].filter(id=>id!==author&&ctx.active.has(id)&&(!ctx.task.secret||ctx.people.includes(id)));
 if(!recipients.length)return;
 const rows=recipients.map(to=>({id:`tc:${comment.id}:${to}`,to_id:to,type:'task_comment',ref_id:comment.task_id,
 message:`${ctx.active.get(author)||author}님이 ${ctx.mentions.includes(to)?'태그했습니다':ctx.parent?.from_id===to?'답글을 남겼습니다':'댓글을 남겼습니다'}: ${String(ctx.task.title||'업무').slice(0,45)} · ${comment.text.slice(0,80)}`,is_read:false}));
 // Retrying after a dropped response must not create another notification or reset its read state.
 const r=await db.from('staff_notifications').upsert(rows,{onConflict:'id',ignoreDuplicates:true});
 if(r.error)throw Error('댓글은 저장되었지만 알림 전달을 완료하지 못했습니다. 다시 등록을 눌러 알림 전달을 재시도해주세요.');
}
