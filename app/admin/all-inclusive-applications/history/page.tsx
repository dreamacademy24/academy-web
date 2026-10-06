import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import MineduListClient from '../../minedu/MineduListClient';

type Application = {
  id: number;
  created_at: string;
  name: string;
  phone: string | null;
  children: string | null;
  ages: string | null;
  depart_date: string | null;
  duration_weeks: string | null;
  period: string | null; // 호환성 위해 유지 (옛날 신청)
  lodging: string | null;
  assignee: string | null;
  status: string | null;
};

async function getApplications(): Promise<Application[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase
    .from('minedu_applications')
    .select('id, created_at, name, phone, children, ages, depart_date, duration_weeks, period, lodging, assignee, status')
    .is('source', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/minedu] fetch error:', error);
    throw new Error('신청 내역을 불러오지 못했습니다. 새로고침해 주세요.');
  }
  return (data as Application[]) || [];
}

export default async function MineduAdminPage() {
  const applications = await getApplications();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = applications.filter(
    (a) => new Date(a.created_at) >= today
  ).length;

  const jamieCount = applications.filter((a) => a.assignee === 'jamie').length;
  const mayCount = applications.filter((a) => a.assignee === 'may').length;
  const unassignedCount = applications.filter((a) => !a.assignee).length;

  const newCount = applications.filter((a) => !a.status || a.status === 'new').length;
  const contactedCount = applications.filter((a) => a.status === 'contacted').length;
  const inProgressCount = applications.filter((a) => a.status === 'in_progress').length;
  const confirmedCount = applications.filter((a) => a.status === 'confirmed').length;

  return (
    <><nav style={{padding:'20px 24px',display:'flex',gap:20,flexWrap:'wrap'}} aria-label="상담 신청 목록"><Link href="/admin/all-inclusive-applications">올인원 상담 신청</Link><Link href="/admin/all-inclusive-applications/history">이전 접수 내역 (출처 미기록)</Link></nav><MineduListClient
      title="이전 접수 내역"
      subtitle="출처 기록을 시작하기 전의 통합 신청입니다. 올인원·민에듀 등 신청이 섞여 있으며 이름으로 검색할 수 있습니다."
      applications={applications}
      total={applications.length}
      today={todayCount}
      jamieCount={jamieCount}
      mayCount={mayCount}
      unassignedCount={unassignedCount}
      newCount={newCount}
      contactedCount={contactedCount}
      inProgressCount={inProgressCount}
      confirmedCount={confirmedCount}
    /></>
  );
}

export const revalidate = 60;
export const dynamic = 'force-dynamic';
