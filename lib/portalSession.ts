import { supabase } from "@/lib/supabase";

export interface PortalSessionData {
  booking_id: string;
  booking_number: string;
  guest_name: string;
  expires: number;
}

export async function resolvePortalSession(): Promise<PortalSessionData | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("portalSession");
    if (raw) {
      const s = JSON.parse(raw);
      if (s.booking_id && Date.now() < s.expires) return s as PortalSessionData;
      localStorage.removeItem("portalSession");
    }
  } catch {}
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    const u = data.session.user;
    const bid = (u.user_metadata as { booking_id?: string } | null)?.booking_id || u.id;
    return { booking_id: bid, booking_number: "", guest_name: u.email?.split("@")[0] || "회원", expires: Date.now() + 86400000 };
  }
  return null;
}
