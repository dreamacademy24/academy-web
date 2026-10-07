import { NextResponse } from 'next/server';
import { portalDb, workspaceStaffIdentity } from '@/lib/portalAuth';
import { finalLessonsToday, type Session } from '@/lib/onlineLastDay';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
export async function GET(req: Request) {
  try {
    if (!await workspaceStaffIdentity(req)) return NextResponse.json({ error: '직원 로그인이 필요합니다.' }, { status: 401, headers });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const db = portalDb();
    const { data: candidates, error: candidateError } = await db.from('online_sessions').select('enrollment_id').eq('scheduled_date', today).in('status', ['scheduled', 'attended', 'no_show']);
    if (candidateError) throw candidateError;
    const ids = [...new Set((candidates || []).map(s => s.enrollment_id))];
    if (!ids.length) return NextResponse.json({ date: today, students: [] }, { headers });
    const { data: enrollments, error } = await db.from('online_enrollments').select('id,student_name,student_name_en,status,total_sessions,tutor:online_tutors(name_display,name_en)').in('id', ids);
    if (error) throw error;
    // Paginate so a busy day cannot silently truncate the future/makeup checks.
    const sessions: Session[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error: sessionError } = await db.from('online_sessions').select('id,enrollment_id,scheduled_date,scheduled_time_kr,scheduled_time_ph,status,session_number').in('enrollment_id', ids).order('id').range(offset, offset + 999);
      if (sessionError) throw sessionError;
      sessions.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    const students = (enrollments || []).flatMap(e => {
      const final = finalLessonsToday(e, sessions, today);
      if (!final.length) return [];
      const tutor = Array.isArray(e.tutor) ? e.tutor[0] : e.tutor;
      return [{ id: e.id, name: e.student_name, english_name: e.student_name_en, tutor: tutor?.name_display || tutor?.name_en || '미배정', lessons: final.map(s => ({ time_kr: s.scheduled_time_kr, time_ph: s.scheduled_time_ph, status: s.status })).sort((a,b) => String(a.time_kr).localeCompare(String(b.time_kr))) }];
    }).sort((a,b) => a.name.localeCompare(b.name, 'ko'));
    return NextResponse.json({ date: today, students }, { headers });
  } catch {
    return NextResponse.json({ error: '화상영어 마지막 수업을 불러오지 못했습니다.' }, { status: 503, headers });
  }
}
