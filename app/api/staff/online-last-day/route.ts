import { NextResponse } from 'next/server';
import { portalDb, workspaceStaffIdentity } from '@/lib/portalAuth';
import { onlineCreditsComplete } from '@/lib/onlineLastDay';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
export async function GET(req: Request) {
  try {
    if (!await workspaceStaffIdentity(req)) return NextResponse.json({ error: '직원 로그인이 필요합니다.' }, { status: 401, headers });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const db = portalDb();
    const students = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from('online_enrollments').select('id,student_name,student_name_en,status,total_sessions,used_sessions,completion_ack_total,tutor:online_tutors(name_display,name_en)').order('id').range(offset, offset + 999);
      if (error) throw error;
      for (const e of data || []) {
        if (!onlineCreditsComplete(e) || e.completion_ack_total === e.total_sessions) continue;
        const tutor = Array.isArray(e.tutor) ? e.tutor[0] : e.tutor;
        students.push({ id: e.id, name: e.student_name, english_name: e.student_name_en, tutor: tutor?.name_display || tutor?.name_en || '미배정', total: e.total_sessions, used: e.used_sessions });
      }
      if (!data || data.length < 1000) break;
    }
    students.sort((a,b) => a.name.localeCompare(b.name, 'ko'));
    return NextResponse.json({ date: today, students }, { headers });
  } catch {
    return NextResponse.json({ error: '화상영어 회차 완료 명단을 불러오지 못했습니다.' }, { status: 503, headers });
  }
}

export async function POST(req: Request) {
  try {
    if (req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({error:'허용되지 않은 요청입니다.'},{status:403,headers});
    const staff = await workspaceStaffIdentity(req);
    if (!staff) return NextResponse.json({error:'직원 로그인이 필요합니다.'},{status:401,headers});
    const body = await req.json();
    if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) return NextResponse.json({error:'학생을 확인해주세요.'},{status:400,headers});
    const db = portalDb();
    const {data:e,error} = await db.from('online_enrollments').select('id,total_sessions,used_sessions,status').eq('id',body.id).maybeSingle();
    if(error)throw error;
    if(!e || !onlineCreditsComplete(e)) return NextResponse.json({error:'아직 잔여 회차가 있거나 수강권이 변경되었습니다.'},{status:409,headers});
    const {data:saved,error:saveError}=await db.from('online_enrollments').update({completion_ack_total:e.total_sessions,completion_ack_at:new Date().toISOString(),completion_ack_by:staff}).eq('id',e.id).eq('total_sessions',e.total_sessions).eq('used_sessions',e.used_sessions).eq('status',e.status).select('id').maybeSingle();
    if(saveError)throw saveError;
    if(!saved)return NextResponse.json({error:'수강권이 변경되었습니다. 새로고침해주세요.'},{status:409,headers});
    return NextResponse.json({ok:true},{headers});
  } catch { return NextResponse.json({error:'확인 상태를 저장하지 못했습니다. 다시 시도해주세요.'},{status:503,headers}); }
}
