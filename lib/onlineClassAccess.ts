type OnlineBooking = {
  checkin_date?: string | null;
  status?: string | null;
  accom_type?: string | null;
  booking_type?: string | null;
  portal_features?: Partial<Record<string, boolean>> | null;
} | null | undefined;

/** Calendar months, clamped to the last day of the target month (not 60 days). */
export function onlineClassOpeningDate(checkin: string | null | undefined): string | null {
  const raw = String(checkin || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(raw + 'T12:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== raw) return null;
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 2, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), last));
  return target.toISOString().slice(0, 10);
}

export function onlineClassOpen(b: OnlineBooking, today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)): boolean {
  if (!b || /취소|cancel/i.test(b.status || '')) return false;
  const override = b.portal_features?.online_class;
  if (typeof override === 'boolean') return override;
  // Keep the existing non-commute automatic entitlement; completed stays remain eligible.
  if (b.booking_type === 'commute' || /통학/.test(b.accom_type || '')) return false;
  const opens = onlineClassOpeningDate(b.checkin_date);
  return !!opens && today >= opens;
}
