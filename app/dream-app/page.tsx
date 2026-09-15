import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/learning/Tools';
import styles from './page.module.css';

export const metadata = { title: '드림아카데미 · 모드 선택', description: '게스트 신청과 예약 확인을 시작하세요. 드림이와 함께하는 학습모드는 준비 중입니다.', manifest: '/manifest-guest.webmanifest' };

export default function Page() {
  return <main className={styles.entry}>
    <header className={styles.brand}><Image className={styles.brandFriends} src="/learning/dreamy-friends.png" alt="" width={48} height={48}/><span>DREAM <b>ACADEMY</b></span></header>
    <section className={styles.welcome} aria-labelledby="welcome-title"><span>드림아카데미에 오신 것을 환영해요</span><h1 id="welcome-title">오늘은 무엇을 할까요?</h1><p>연수 신청과 예약 확인을 편하게.<br/>새로운 영어 학습은 준비 중이에요.</p></section>
    <div className={styles.choices}>
      <Link href="/portal" className={`${styles.card} ${styles.guest}`} aria-label="게스트(신청용) 시작하기">
        <div className={styles.guestArt} aria-hidden="true"><div className={styles.sun}/><div className={styles.ticket}><span>DREAM JOURNEY</span><Icon name="check" size={36}/><i/><i/><i/></div><div className={styles.miniCard}><Icon name="home" size={24}/><span>나의 연수 준비</span></div><span className={styles.artLabel}>설레는 시작을 함께</span></div>
        <div className={styles.cardBody}><span className={styles.category}>GUEST · 신청과 준비</span><h2>게스트<span>(신청용)</span></h2><p>연수 신청부터 예약 확인까지,<br/>나의 드림아카데미 일정을 준비해요.</p><div className={styles.tags}><span>예약 확인</span><span>결제</span><span>셔틀·튜터 신청</span></div><span className={styles.cta}>게스트 시작하기 <Icon name="arrow"/></span></div>
      </Link>
      <article className={`${styles.card} ${styles.learningSoon}`} aria-labelledby="learning-mode-title">
        <div className={styles.learningArt}><Image src="/learning/dreamy-friends.png" alt="함께 인사하는 드림이와 고래상어" fill sizes="(max-width: 700px) 110px, 450px" priority/></div>
        <div className={styles.cardBody}><span className={styles.category}>LEARNING · 영어 학습</span><h2 id="learning-mode-title">학습모드</h2><p>드림이와 고래상어가 함께하는<br/>새로운 영어 모험을 준비하고 있어요.</p><span className={styles.comingSoon}>준비 중</span></div>
      </article>
    </div>
    <p className={styles.switchNote}>연수 신청과 예약 확인은 게스트 모드에서 이용해 주세요.</p>
    <footer className={styles.footer}>DREAM ACADEMY <span>함께 준비하고, 즐겁게 배워요.</span></footer>
  </main>;
}
