import {Suspense} from 'react';
import LearningContextGuard from '@/components/learning/LearningContext';
import StaffPreviewAccess from '@/components/learning/StaffPreviewAccess';
import {getLearningStaffAccess} from '@/lib/learning/staff-preview';

export default async function TreeHouseLayout({children}:{children:React.ReactNode}) {
  const access = await getLearningStaffAccess();
  if (process.env.NODE_ENV !== 'development' && access.status !== 'staff') return <StaffPreviewAccess status={access.status} />;
  return <Suspense fallback={<main className="learn-loading">학습을 준비하고 있어요…</main>}><LearningContextGuard previewOnly={access.status === 'staff'}>{children}</LearningContextGuard></Suspense>;
}
