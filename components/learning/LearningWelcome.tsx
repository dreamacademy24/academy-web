'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import styles from './LearningWelcome.module.css';

const WELCOME_KEY = 'dream-learning-welcome-v2';
const WELCOME_EVENT = 'dream-learning-welcome-changed';

function subscribeWelcome(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(WELCOME_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(WELCOME_EVENT, onChange);
  };
}

function getWelcomeSnapshot(): 'seen' | 'new' {
  try {
    if (new URLSearchParams(window.location.search).get('intro') === '1') return 'new';
    return window.localStorage.getItem(WELCOME_KEY) === 'seen' ? 'seen' : 'new';
  } catch {
    return 'new';
  }
}

function getServerSnapshot(): 'pending' {
  return 'pending';
}

function rememberWelcome() {
  try {
    window.localStorage.setItem(WELCOME_KEY, 'seen');
    window.dispatchEvent(new Event(WELCOME_EVENT));
  } catch {
    // Learning remains available when this browser cannot store preferences.
  }
}

export default function LearningWelcome({ children }: { children: ReactNode }) {
  const saved = useSyncExternalStore(subscribeWelcome, getWelcomeSnapshot, getServerSnapshot);
  const [view, setView] = useState<'intro' | 'home' | null>(null);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'ended'>('ready');
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [dialogue, setDialogue] = useState<{ id: string; text: string } | null>(null);
  const [nativeCaptions, setNativeCaptions] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackAttempt = useRef(0);
  const screen = view ?? (saved === 'pending' ? 'pending' : saved === 'seen' ? 'home' : 'intro');
  const showingFilm = screen === 'intro';

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      playbackAttempt.current += 1;
      video?.pause();
    };
  }, [showingFilm]);

  useEffect(() => {
    const video = videoRef.current;
    const trackElement = video?.querySelector('track');
    if (!video || !trackElement) return;
    const track = trackElement.track;
    // Keep one source of dialogue and timing: the video's caption file.
    track.mode = 'hidden';
    let fullscreenMode: TextTrackMode | null = null;
    function syncDialogue() {
      const cue = track.activeCues?.[0] as VTTCue | undefined;
      const next = cue ? { id: cue.id, text: cue.text } : null;
      setDialogue(previous => previous?.id === next?.id && previous?.text === next?.text ? previous : next);
      setNativeCaptions(track.mode !== 'hidden');
    }
    function enterFullscreen() {
      if (fullscreenMode !== null) return;
      fullscreenMode = track.mode;
      // Native video fullscreen cannot display the surrounding HTML bubble.
      if (track.mode === 'hidden') track.mode = 'showing';
      syncDialogue();
    }
    function leaveFullscreen() {
      if (fullscreenMode === null) return;
      track.mode = fullscreenMode;
      fullscreenMode = null;
      syncDialogue();
    }
    function syncFullscreen() {
      if (document.fullscreenElement === video) enterFullscreen();
      else leaveFullscreen();
    }
    track.addEventListener('cuechange', syncDialogue);
    trackElement.addEventListener('load', syncDialogue);
    video.textTracks.addEventListener('change', syncDialogue);
    video.addEventListener('timeupdate', syncDialogue);
    video.addEventListener('seeked', syncDialogue);
    video.addEventListener('webkitbeginfullscreen', enterFullscreen);
    video.addEventListener('webkitendfullscreen', leaveFullscreen);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => {
      track.removeEventListener('cuechange', syncDialogue);
      trackElement.removeEventListener('load', syncDialogue);
      video.textTracks.removeEventListener('change', syncDialogue);
      video.removeEventListener('timeupdate', syncDialogue);
      video.removeEventListener('seeked', syncDialogue);
      video.removeEventListener('webkitbeginfullscreen', enterFullscreen);
      video.removeEventListener('webkitendfullscreen', leaveFullscreen);
      document.removeEventListener('fullscreenchange', syncFullscreen);
    };
  }, [showingFilm]);

  async function play(retry = false) {
    const video = videoRef.current;
    if (!video) return;
    const attempt = ++playbackAttempt.current;
    setError(false);
    setBuffering(true);
    setPhase('playing');
    if (retry) video.load();
    if (video.ended) video.currentTime = 0;
    try {
      await video.play();
    } catch {
      if (playbackAttempt.current === attempt) {
        setBuffering(false);
        setError(true);
      }
    }
  }

  function finish() {
    setView('intro');
    setPhase('ended');
    setBuffering(false);
    rememberWelcome();
  }

  function skip() {
    videoRef.current?.pause();
    setView('home');
    rememberWelcome();
  }

  function replayIntro() {
    setDialogue(null);
    setNativeCaptions(false);
    setPhase('ready');
    setError(false);
    setBuffering(false);
    setView('intro');
  }

  if (screen === 'pending') {
    return <main className={styles.loading} aria-busy="true">드림이와 만날 준비를 하고 있어요.</main>;
  }

  if (screen === 'home') {
    return <>{children}<div className={styles.revisit}><button type="button" onClick={replayIntro}>▷ 드림이 소개 다시 보기</button></div></>;
  }

  return (
    <main className={styles.welcome}>
      <header className={styles.header}>
        <Link href="/dream-app" className={styles.brand} aria-label="드림앱 모드 선택으로 돌아가기">DREAM <span>LEARNING</span></Link>
        <button type="button" className={styles.skip} onClick={skip}>바로 시작하기 <span aria-hidden="true">→</span></button>
      </header>

      <div className={styles.heading}>
        <span className={styles.eyebrow}>우리의 첫 번째 만남</span>
        <h1>드림이와 함께하는<br className={styles.mobileBreak} /> 영어 모험</h1>
        <p>듣고 말하고, 이야기 속 미션을 함께 풀어요.</p>
      </div>

      <section className={styles.film} aria-label="드림이와 함께하는 영어 공부 소개 영상">
        <video
          ref={videoRef}
          className={styles.video}
          poster="/learning/tree-house/dreamy-intro-poster.webp"
          controls
          playsInline
          preload="metadata"
          aria-label="드림이가 소개하는 영어 모험"
          onPlay={() => { setPhase('playing'); setError(false); }}
          onPlaying={() => setBuffering(false)}
          onWaiting={() => setBuffering(true)}
          onCanPlay={() => setBuffering(false)}
          onPause={() => setBuffering(false)}
          onEnded={finish}
          onError={() => { setBuffering(false); setError(true); }}
        >
          <source src="/learning/tree-house/dreamy-intro.mp4?voice=qwen1" type="video/mp4" onError={() => { setBuffering(false); setError(true); }} />
          <track kind="subtitles" src="/learning/tree-house/dreamy-intro.ko.vtt?voice=qwen1" srcLang="ko" label="한국어" default />
          이 브라우저에서는 영상을 재생할 수 없어요. 아래 버튼으로 학습을 시작할 수 있어요.
        </video>
        {phase === 'playing' && !error && !nativeCaptions && <div className={styles.dialogueLayer}>
          {dialogue && <div key={dialogue.id} className={styles.dialogue} data-testid="dreamy-dialogue">
            <span className={styles.speaker}>드림이</span>
            <p>{dialogue.text}</p>
          </div>}
        </div>}
        {phase === 'ready' && !error && <div className={styles.startOverlay}>
          <button className={styles.play} type="button" onClick={() => void play()}><span className={styles.playIcon} aria-hidden="true">▶</span> 드림이 만나기</button>
          <span className={styles.soundHint}>눌러서 소리와 함께 만나보세요</span>
        </div>}
      </section>

      <div className={styles.afterFilm}>
        <div role="status" aria-live="polite" className={styles.status}>
          {error ? <div className={styles.error}>
            <p>영상을 불러오지 못했어요. 다시 재생하거나 바로 학습을 시작해요.</p>
            <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => void play(true)}>다시 재생하기</button><button type="button" className={styles.primary} onClick={skip}>바로 학습하기 <span aria-hidden="true">→</span></button></div>
          </div> : buffering && phase === 'playing' ? <p>드림이의 이야기를 불러오고 있어요…</p> : null}
        </div>
        {phase === 'ended' && !error ? <div className={styles.finish}>
          <p>이제 나에게 맞는 모험을 시작해 볼까요?</p>
          <div className={styles.actions}><button type="button" onClick={skip} className={styles.primary}>내 학습 시작하기 <span aria-hidden="true">→</span></button><button type="button" className={styles.secondary} onClick={() => void play()}>한 번 더 보기</button></div>
        </div> : !error && <p className={styles.caption}>드림이를 만나고, 나에게 맞는 영어 모험을 시작해요.</p>}
      </div>
    </main>
  );
}
