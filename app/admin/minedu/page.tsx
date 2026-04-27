import { createClient } from '@supabase/supabase-js';
import MineduListClient from './MineduListClient';

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
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/minedu] fetch error:', error);
    return [];
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
    <MineduListClient
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
    />
  );
}

export const revalidate = 60;
export const dynamic = 'force-dynamic';
