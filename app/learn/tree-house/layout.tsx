import {Suspense} from 'react';
import LearningContextGuard from '@/components/learning/LearningContext';

export default function TreeHouseLayout({children}:{children:React.ReactNode}) {
  return <Suspense fallback={<main className="learn-loading">학습을 준비하고 있어요…</main>}><LearningContextGuard>{children}</LearningContextGuard></Suspense>;
}
