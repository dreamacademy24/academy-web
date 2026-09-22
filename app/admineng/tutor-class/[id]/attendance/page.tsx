import StaffSessionBoundary from '@/components/StaffSessionBoundary';
import AttendancePage from '@/app/admin/tutor-class/[id]/attendance/page';

// Share the attendance editor, without mounting the Korean-admin layout.
export default function LocalTutorAttendancePage() {
  return <StaffSessionBoundary><AttendancePage /></StaffSessionBoundary>;
}
