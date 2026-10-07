export function onlineCreditsComplete(e: { total_sessions: number | null; used_sessions: number | null; status?: string }) {
  return e.status !== 'cancelled' && Number(e.total_sessions) > 0 && Number(e.used_sessions) >= Number(e.total_sessions);
}
