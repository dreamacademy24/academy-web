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
      const { data, error } = await db.from('online_enrollments').select('id,student_name,student_name_en,status,total_sessions,used_sessions,tutor:online_tutors(name_display,name_en)').order('id').range(offset, offset + 999);
      if (error) throw error;
      for (const e of data || []) {
        if (!onlineCreditsComplete(e)) continue;
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
