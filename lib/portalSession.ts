import { supabase } from "@/lib/supabase";
import { portalFetch } from '@/lib/portalFetch';

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
    const response = await portalFetch('/api/portal/find-booking', { method: 'POST' });
    if (!response.ok) return null;
    const { booking, bookings } = await response.json();
    if (!booking) return null;
    const session = { booking_id: booking.id, booking_number: booking.reservation_no || '', guest_name: booking.booker_name || '회원', bookings, expires: Date.now() + 86400000 };
    localStorage.setItem('portalSession', JSON.stringify(session));
    return session;
  }
  return null;
}
