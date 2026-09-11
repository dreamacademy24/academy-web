import { NextResponse } from 'next/server';
import { portalDb, portalStaffIdentity } from '@/lib/portalAuth';

async function mutate(req: Request, deleting: boolean) {
  const username = await portalStaffIdentity(req);
  if (!username) return NextResponse.json({ error: '로그인이 만료되었습니다. 다시 로그인 후 시도해주세요.' }, { status: 401 });
  const author = username.replace(/^admin-/, '');
  if (!author || author === 'jun') return NextResponse.json({ error: '사용 권한이 없습니다.' }, { status: 403 });
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 }); }
  if (!body || typeof body.id !== 'string' || !body.id || body.id.length > 200 || typeof body.taskId !== 'string' || !body.taskId || body.taskId.length > 200 || typeof body.originalText !== 'string' || (!deleting && (typeof body.text !== 'string' || !body.text.trim()))) {
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
  const query = deleting ? db.from('staff_task_comments').delete() : db.from('staff_task_comments').update({ text: body.text.trim() });
  const { data, error } = await query.eq('id', body.id).eq('task_id', body.taskId).eq('from_id', author).eq('text', body.originalText).select('id,task_id,from_id,text,ts');
  if (error) return NextResponse.json({ error: '댓글 저장에 실패했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  if (!data || data.length !== 1) return NextResponse.json({ error: '댓글이 변경·삭제되었거나 본인 댓글이 아닙니다. 최신 내용을 확인해주세요.' }, { status: 409 });
  return NextResponse.json({ comment: data[0], deleted: deleting });
}

export async function PATCH(req: Request) { return mutate(req, false); }
export async function DELETE(req: Request) { return mutate(req, true); }
