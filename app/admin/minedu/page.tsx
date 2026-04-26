import { createClient } from "@supabase/supabase-js";
import MineduListClient, { type MineduApp } from "./MineduListClient";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export const metadata = {
  title: "민에듀 공구 신청 관리 | 드림아카데미",
};

export default async function MineduAdminPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let rows: MineduApp[] = [];
  let fetchError: string | null = null;

  if (!url || !serviceKey) {
    fetchError = "Supabase 환경변수 누락 (SUPABASE_SERVICE_ROLE_KEY)";
  } else {
    try {
      const supabase = createClient(url, serviceKey, {
        auth: { persistSession: false },
      });
      const { data, error } = await supabase
        .from("minedu_applications")
        .select("id, created_at, name, phone, children, ages, period, lodging")
        .order("created_at", { ascending: false });
      if (error) {
        fetchError = error.message;
      } else {
        rows = (data || []) as MineduApp[];
      }
    } catch (e) {
      fetchError = e instanceof Error ? e.message : String(e);
    }
  }

  return <MineduListClient initialRows={rows} fetchError={fetchError} />;
}
