import Image from 'next/image';
import Link from 'next/link';
import StaffSessionBoundary from '@/components/StaffSessionBoundary';
import StaffPreviewAccess from '@/components/learning/StaffPreviewAccess';
import { getLearningStaffAccess } from '@/lib/learning/staff-preview';
import './learning.css';
import styles from './coming-soon.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const development = process.env.NODE_ENV === 'development';
  const staffPreview = !development && (await getLearningStaffAccess()).status === 'staff';
  return {
    title: development ? 'Dream Learning · 드림이와 영어 모험' : staffPreview ? '드림이 학습모드 · 직원 체험' : '학습모드 준비 중 · 드림아카데미',
    description: '드림이와 고래상어가 즐거운 영어 모험을 준비하고 있어요. 조금만 기다려 주세요.',
    manifest: '/manifest-guest.webmanifest',
  };
}

function LearningComingSoon() {
  return <main className={styles.page} data-learning-availability="coming-soon">
    <section className={styles.content} aria-labelledby="learning-coming-soon-title">
      <span className={styles.brand}>DREAM ACADEMY</span>
      <div className={styles.illustration}>
        <Image src="/learning/dreamy-friends.png" alt="함께 영어 모험을 준비하는 망고 드림이와 고래상어" width={560} height={560} sizes="(max-width: 440px) 280px, 390px" preload />
      </div>
      <span className={styles.badge}>준비 중</span>
      <h1 id="learning-coming-soon-title">학습모드는 준비 중이에요</h1>
      <p>드림이와 고래상어가 즐거운 영어 모험을 준비하고 있어요.<br />조금만 기다려 주세요.</p>
      <nav className={styles.actions} aria-label="다음 화면 선택">
        <Link href="/dream-app" className={styles.back}>모드 선택으로 돌아가기</Link>
        <Link href="/portal" className={styles.guest}>게스트 시작하기 <span aria-hidden="true">→</span></Link>
      </nav>
      <Link href="/login?next=%2Flearn" className={styles.staffSignIn}>직원 로그인 · Staff sign in</Link>
    </section>
  </main>;
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'development') return <div className="learning-app">{children}</div>;

  const access = await getLearningStaffAccess();
  return <div className="learning-app">{access.status === 'staff'
    ? <StaffSessionBoundary>{children}</StaffSessionBoundary>
    : access.status === 'error' ? <StaffPreviewAccess status="error" /> : <LearningComingSoon />}</div>;
}
