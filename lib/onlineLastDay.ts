export type Session = { enrollment_id: string; scheduled_date: string | null; scheduled_time_kr?: string | null; scheduled_time_ph?: string | null; status: string; session_number: number };
type Enrollment = { id: string; status: string; total_sessions: number | null };
export function finalLessonsToday(enrollment: Enrollment, sessions: Session[], today: string) {
  if (!['active', 'scheduled', 'completed'].includes(enrollment.status)) return [];
  const own = sessions.filter(s => s.enrollment_id === enrollment.id);
  const lessons = own.filter(s => ['scheduled', 'attended', 'no_show'].includes(s.status));
  // Undated lessons and unallocated credits mean the final teaching day is not known yet.
  if (lessons.some(s => !s.scheduled_date || s.scheduled_date > today)) return [];
  const allocated = own.filter(s => ['scheduled', 'attended', 'no_show', 'cancelled'].includes(s.status)).length;
  if (!enrollment.total_sessions || allocated < enrollment.total_sessions) return [];
  return lessons.filter(s => s.scheduled_date === today);
}
