import { NextResponse } from 'next/server';
import { portalDb, portalStaffIdentity } from '@/lib/portalAuth';
import {commentAccess,validateCommentPhotos} from '@/lib/staffCommentMedia';
import {isDeepStrictEqual} from 'node:util';

async function mutate(req: Request, deleting: boolean) {
  const username = await portalStaffIdentity(req);
  if (!username) return NextResponse.json({ error: '로그인이 만료되었습니다. 다시 로그인 후 시도해주세요.' }, { status: 401 });
  const author = username.replace(/^admin-/, '');
  if (!author || author === 'jun') return NextResponse.json({ error: '사용 권한이 없습니다.' }, { status: 403 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 }); }
  if (!body || typeof body.id !== 'string' || !body.id || body.id.length > 200 || typeof body.taskId !== 'string' || !body.taskId || body.taskId.length > 200 || typeof body.originalText !== 'string' || (!deleting && (typeof body.text !== 'string' || (!body.text.trim()&&!body.files?.length)))) {
    return NextResponse.json({ error: '댓글과 내용을 확인해주세요.' }, { status: 400 });
  }
  const db = portalDb();
  const { data: task, error: taskError } = await db.from('staff_tasks').select('id,secret,created_by,assignee,assignees').eq('id', body.taskId).maybeSingle();
  if (taskError) return NextResponse.json({ error: '업무 권한을 확인하지 못했습니다.' }, { status: 503 });
  let assignees = task?.assignees;
  if (typeof assignees === 'string') { try { assignees = JSON.parse(assignees); } catch { assignees = []; } }
  if (!task || (task.secret && task.created_by !== author && task.assignee !== author && !(Array.isArray(assignees) && assignees.includes(author)))) {
    return NextResponse.json({ error: '이 업무에 접근할 수 없습니다.' }, { status: 403 });
  }
  let photos;try{if(!deleting&&body.files!==undefined)photos=validateCommentPhotos(body.files,author,body.taskId);}catch(e){return NextResponse.json({error:(e as Error).message},{status:400});}
  const query = deleting ? db.from('staff_task_comments').delete() : db.from('staff_task_comments').update({ text: body.text.trim(),...(photos?{files:photos}:{}) });
  if(body.originalFiles!==undefined)query.eq('files',JSON.stringify(body.originalFiles));
  const { data, error } = await query.eq('id', body.id).eq('task_id', body.taskId).eq('from_id', author).eq('text', body.originalText).select('id,task_id,from_id,text,ts,files');
  if (error) return NextResponse.json({ error: '댓글 저장에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  if (!data || data.length !== 1) return NextResponse.json({ error: '댓글이 변경·삭제되었거나 본인 댓글이 아닙니다. 최신 내용을 확인해주세요.' }, { status: 409 });
  return NextResponse.json({ comment: data[0], deleted: deleting });
}

export async function PATCH(req: Request) { return mutate(req, false); }
export async function DELETE(req: Request) { return mutate(req, true); }

export async function POST(req:Request){try{
 const body=await req.json(),{db,author}=await commentAccess(req,String(body.taskId||''));
 const files=validateCommentPhotos(body.files||[],author,body.taskId),text=typeof body.text==='string'?body.text.trim():'';
 if((!text&&!files.length)||text.length>20000||typeof body.id!=='string'||!/^[a-f\d-]{36}$/i.test(body.id))return NextResponse.json({error:'댓글 내용 또는 사진을 입력해주세요.'},{status:400});
 const prior=await db.from('staff_task_comments').select('id,task_id,from_id,text,ts,files').eq('id',body.id).maybeSingle();if(prior.error)throw Error('저장 상태를 확인하지 못했습니다.');
 if(prior.data){if(prior.data.task_id!==body.taskId||prior.data.from_id!==author||prior.data.text!==text||!isDeepStrictEqual(prior.data.files,files))return NextResponse.json({error:'이미 등록된 댓글과 내용이 다릅니다. 목록에서 등록 결과를 확인한 뒤 수정해주세요.'},{status:409});return NextResponse.json({comment:prior.data});}
 const saved=await db.from('staff_task_comments').insert({id:body.id,task_id:body.taskId,from_id:author,text,files,ts:Date.now()}).select('id,task_id,from_id,text,ts,files').single();
 if(saved.error)throw Error('댓글을 저장하지 못했습니다. 입력 내용은 유지됩니다.');return NextResponse.json({comment:saved.data});
 }catch(e){return NextResponse.json({error:(e as Error).message||'댓글 저장에 실패했습니다.'},{status:(e as any).status||400});}}
