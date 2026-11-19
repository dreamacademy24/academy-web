import { onlineClassOpen } from './onlineClassAccess';
import { packageBookings, studentKey } from './onlinePackagePlan';

/** Match the student AND the stay; an old/sibling enrollment must not hide a new application. */
export function pendingOnlineApplications(bookings: any[], enrollments: any[], sources: any[], today?: string) {
  const active = enrollments.filter(e => !/cancel|취소/i.test(e.status || ''));
  return packageBookings(bookings.filter(b => onlineClassOpen(b, today))).filter(b => {
    const key = studentKey(b.student);
    return !active.some(e => {
      if (studentKey(String(e.student_name || '')) !== key) return false;
      if (sources.some(s => s.enrollment_id === e.id && s.booking_id === b.id && s.student_key === key)) return true;
      const ids = e.package_plan?.bookingIds || (e.package_booking_id ? [e.package_booking_id] : []);
      if (ids.includes(b.id)) return true;
      // The application form blocks duplicate, unlinked legacy package credits too.
      return e.enrollment_type === 'free_package' && ids.length === 0;
    });
  }).map(b => ({ bookingId: b.id, student: b.student, checkin: b.from }));
}
