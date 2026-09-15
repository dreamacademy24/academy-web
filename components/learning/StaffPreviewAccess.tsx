import Link from 'next/link';
import styles from '@/app/learn/coming-soon.module.css';

export default function StaffPreviewAccess({ status }: { status: 'public' | 'error' }) {
  const unavailable = status === 'error';
  return <main className={styles.page} data-learning-availability={unavailable ? 'error' : 'signin'}>
    <section className={styles.content} aria-labelledby="learning-access-title">
      <span className={styles.brand}>DREAM ACADEMY</span>
      <h1 id="learning-access-title">{unavailable ? '로그인 상태를 확인하지 못했어요' : '직원 로그인이 필요해요'}</h1>
      <p role={unavailable ? 'alert' : 'status'}>{unavailable
        ? <>잠시 연결이 원활하지 않아요. 다시 확인해 주세요.<br />We couldn’t check your staff session. Please try again.</>
        : <>직원 계정으로 다시 로그인하면 체험을 이어갈 수 있어요.<br />Sign in with your staff account to continue the preview.</>}</p>
      <nav className={styles.actions} aria-label="로그인 확인">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- A full reload reruns authentication in the persistent layout. */}
        {unavailable && <a href="/learn" className={styles.guest}>다시 확인 · Retry</a>}
        <Link href="/login?next=%2Flearn" className={unavailable ? styles.back : styles.guest}>직원 로그인 · Staff sign in</Link>
      </nav>
    </section>
  </main>;
}
