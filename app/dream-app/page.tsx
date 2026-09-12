import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/learning/Tools';
import styles from './page.module.css';

export const metadata = { title: '드림아카데미 · 모드 선택', description: '게스트 신청과 영어 학습, 원하는 모드를 선택해주세요.', manifest: '/manifest-guest.webmanifest' };

export default function Page() {
  return <main className={styles.entry}>
    <header className={styles.brand}><Icon name="leaf" size={27}/><span>DREAM <b>ACADEMY</b></span></header>
    <section className={styles.welcome} aria-labelledby="welcome-title"><span>드림아카데미에 오신 것을 환영해요</span><h1 id="welcome-title">오늘은 무엇을 할까요?</h1><p>신청과 준비도, 즐거운 영어 공부도.<br/>원하는 모드를 선택해주세요.</p></section>
    <div className={styles.choices}>
      <Link href="/portal" className={`${styles.card} ${styles.guest}`} aria-label="게스트(신청용) 시작하기">
        <div className={styles.guestArt} aria-hidden="true"><div className={styles.sun}/><div className={styles.ticket}><span>DREAM JOURNEY</span><Icon name="check" size={36}/><i/><i/><i/></div><div className={styles.miniCard}><Icon name="home" size={24}/><span>나의 연수 준비</span></div><span className={styles.artLabel}>설레는 시작을 함께</span></div>
        <div className={styles.cardBody}><span className={styles.category}>GUEST · 신청과 준비</span><h2>게스트<span>(신청용)</span></h2><p>연수 신청부터 예약 확인까지,<br/>나의 드림아카데미 일정을 준비해요.</p><div className={styles.tags}><span>예약 확인</span><span>결제</span><span>셔틀·튜터 신청</span></div><span className={styles.cta}>게스트 시작하기 <Icon name="arrow"/></span></div>
      </Link>
      <Link href="/learn" className={styles.card} aria-label="학습모드 시작하기">
        <div className={styles.learningArt}><Image src="/learning/tree-house/scene.webp" alt="커다란 나무 위의 아늑한 집" fill sizes="(max-width: 700px) 100vw, 500px" priority/><span className={styles.storyTag}><Icon name="book" size={17}/> 첫 번째 모험 · My Tree House</span></div>
        <div className={styles.cardBody}><span className={styles.category}>LEARNING · 영어 학습</span><h2>학습모드</h2><p>그림을 보고, 듣고, 쓰고, 말하며<br/>나만의 영어 이야기를 만들어요.</p><div className={styles.tags}><span>단어 게임</span><span>손글씨</span><span>목소리 녹음</span></div><span className={styles.cta}>학습 시작하기 <Icon name="arrow"/></span></div>
      </Link>
    </div>
    <p className={styles.switchNote}>모드는 언제든 다시 선택할 수 있어요.</p>
    <footer className={styles.footer}>DREAM ACADEMY <span>함께 준비하고, 즐겁게 배워요.</span></footer>
  </main>;
}
