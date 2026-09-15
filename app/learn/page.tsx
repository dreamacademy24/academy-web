import LearnerHome from '@/components/learning/LearnerHome';
import StaffPreviewAccess from '@/components/learning/StaffPreviewAccess';
import { getLearningStaffAccess } from '@/lib/learning/staff-preview';

export default async function LearnHome() {
  const access = await getLearningStaffAccess();
  if (process.env.NODE_ENV !== 'development' && access.status !== 'staff') return <StaffPreviewAccess status={access.status} />;
  return <LearnerHome staffPreview={access.status === 'staff'} />;
}
