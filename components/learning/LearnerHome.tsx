'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { portalFetch } from '@/lib/portalFetch';
import { supabase } from '@/lib/supabase';
import { getLearningUnit, isLevelCode, type LearningUnit } from '@/lib/learning/catalog';
import type { LearningChildren, LearningChild } from '@/lib/learning/children';
import LearningWorld from './LearningWorld';
import styles from './LearnerHome.module.css';

type HomeState = { status: 'loading' | 'login' | 'error' } | { status: 'ready'; data: LearningChildren };
type ChildVisit = LearningChild['visits'][number];
const childName = (child: LearningChild) => child.nameKr || child.nameEn || '우리 아이';
function visitDates(visit: ChildVisit) {
  const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.replaceAll('-', '.') : '기간 미정';
  return `${date(visit.startDate)} – ${date(visit.endDate)}`;
}
function isChildrenResponse(value: unknown): value is LearningChildren {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LearningChildren>;
  return Array.isArray(data.children) && typeof data.pendingCount === 'number'
    && data.children.every(child => typeof child.learnerId === 'string' && typeof child.nameKr === 'string' && Array.isArray(child.visits));
}

function HudIcon({ kind }: { kind: 'back' | 'refresh' | 'people' | 'arrow' | 'sparkle' }) {
  const paths = {
    back: 'M14 6l-6 6 6 6M8 12h12',
    refresh: 'M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9',
    people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    sparkle: 'M12 3l2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3',
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

function PreviewLink() {
  return <Link href="/learn/tree-house?preview=1" className={styles.preview} aria-label="로그인 없이 공개 체험 보기">먼저 해보기 <HudIcon kind="arrow" /></Link>;
}

function ChildPicker({ learners, selectedId, onSelect, onCancel }: {
  learners: LearningChild[]; selectedId: string | null;
  onSelect: (id: string) => void; onCancel?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={dialogRef} className={styles.childPicker} aria-labelledby="choose-learner-title" onCancel={event => { event.preventDefault(); onCancel?.(); }}>
    <div className={styles.pickerTop}><span className={styles.smallLabel}>함께할 친구</span>{onCancel && <button type="button" className={styles.close} onClick={onCancel} aria-label="아이 선택 닫기">×</button>}</div>
    <h2 id="choose-learner-title">학습할 아이를 선택해 주세요</h2><p>드림이가 기다리고 있어요.</p>
    <div className={styles.childButtons}>{learners.map((item, index) => <button key={item.learnerId} type="button" className={styles.childButton} aria-pressed={selectedId === item.learnerId} onClick={() => onSelect(item.learnerId)}>
      <span className={styles.avatar} data-color={index % 3} aria-hidden="true">{childName(item).slice(0, 1) || index + 1}</span>
      <span className={styles.childName}><strong>{childName(item)}</strong>{item.nameEn && item.nameEn !== childName(item) && <small>{item.nameEn}</small>}</span>
      <span className={styles.childArrow} aria-hidden="true">{selectedId === item.learnerId ? '✓' : '→'}</span>
    </button>)}</div>
    {!onCancel && <Link href="/dream-app" className={styles.pickerBack}>모드 선택으로 돌아가기</Link>}
  </dialog>;
}

function VisitLearning({ child, visit }: { child: LearningChild; visit: ChildVisit }) {
  const assignment = visit.assignment;
  const level = assignment && isLevelCode(assignment.levelCode) ? assignment.levelCode : null;
  const unit = assignment && getLearningUnit(level, assignment.unitId);
  const published = assignment?.published === true && unit?.published === true;
  const query = new URLSearchParams({ learnerId: child.learnerId, visitId: visit.visitId });
  if (!assignment || !level) return <section className={styles.missionPanel}><span className={styles.smallLabel}>학습 배정 대기</span><h2>배울 내용을 준비하고 있어요</h2><p>선생님이 레벨과 교재를 배정하면<br />내 모험을 시작할 수 있어요.</p><PreviewLink /></section>;
  if (!published || !unit) return <section className={styles.missionPanel}><span className={styles.level}>{level}</span><h2>{assignment.unitId ? '교재를 준비하고 있어요' : '교재 배정을 기다리고 있어요'}</h2><p>{assignment.unitId ? '배정된 교재가 아직 앱에 공개되지 않았어요.' : '학습할 교재가 배정되면 여기에서 시작할 수 있어요.'}</p><PreviewLink /></section>;
  return <LearningUnitCard unit={unit} href={`${unit.href}?${query.toString()}`} />;
}

function LearningUnitCard({ unit, href, staffPreview = false }: { unit: LearningUnit; href: string; staffPreview?: boolean }) {
  return <article className={styles.unit}>
    <div className={styles.bookTop}><span className={styles.smallLabel}>{staffPreview ? '직원 체험 · Staff preview' : '지금 떠날 이야기'}</span><span className={styles.level}>{unit.levelCode}</span></div>
    <div className={styles.bookRow}><div className={styles.bookCover}><Image src="/learning/tree-house/dream-world-v2.png" alt="나무 위에 지어진 작은 집" width={1408} height={1024} sizes="120px" /><span aria-hidden="true"><HudIcon kind="sparkle" /></span></div><div><h2>{unit.title}</h2><p>나무 위에 누가 살고 있을까?</p></div></div>
    <Link className={styles.primary} href={href}>{staffPreview ? '체험 시작 · Start preview' : '학습 시작하기'} <HudIcon kind="arrow" /></Link>
    {staffPreview && <p className={styles.pending}>체험 기록과 녹음은 이 기기에만 저장돼요.<br />Preview only · Saved on this device.</p>}
  </article>;
}

export default function LearnerHome({ staffPreview = false }: { staffPreview?: boolean }) {
  const [state, setState] = useState<HomeState>({ status: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedVisits, setSelectedVisits] = useState<Record<string, string>>({});
  const [choosingChild, setChoosingChild] = useState(false);
  const [characterBounds, setCharacterBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [greetingStatus, setGreetingStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
  const [greetingRun, setGreetingRun] = useState(0);
  const greetingAudio = useRef<HTMLAudioElement>(null);
  const greetingVersion = useRef(0);
  const replayGreeting = () => {
    const clip = greetingAudio.current;
    if (!clip) return;
    const version = ++greetingVersion.current;
    clip.pause();
    clip.currentTime = 0;
    setGreetingRun(value => value + 1);
    setGreetingStatus('loading');
    void clip.play().catch(() => {
      if (version === greetingVersion.current) setGreetingStatus('error');
    });
  };
  useEffect(() => {
    const clip = greetingAudio.current;
    const stopWhenHidden = () => {
      if (!document.hidden) return;
      greetingVersion.current += 1;
      clip?.pause();
      setGreetingStatus('idle');
    };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      greetingVersion.current += 1;
      clip?.pause();
      document.removeEventListener('visibilitychange', stopWhenHidden);
    };
  }, []);
  const requestVersion = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const actorId = useRef<string | null>(null);
  const invalidateRequest = useCallback(() => {
    requestVersion.current += 1;
    activeRequest.current?.abort();
  }, []);
  const reload = useCallback(() => {
    invalidateRequest();
    setState({ status: 'loading' });
    setRefresh(value => value + 1);
  }, [invalidateRequest]);
  useEffect(() => {
    if (staffPreview) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') { actorId.current = session?.user.id ?? null; return; }
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
      invalidateRequest();
      const nextActor = session?.user.id ?? null;
      if (event === 'SIGNED_OUT' || actorId.current !== nextActor) {
        setSelectedChildId(null);
        setSelectedVisits({});
        setChoosingChild(false);
      }
      actorId.current = nextActor;
      setState({ status: event === 'SIGNED_OUT' ? 'login' : 'loading' });
      setRefresh(value => value + 1);
    });
    function whenVisible() { if (document.visibilityState === 'visible') reload(); }
    window.addEventListener('focus', whenVisible);
    document.addEventListener('visibilitychange', whenVisible);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener('focus', whenVisible);
      document.removeEventListener('visibilitychange', whenVisible);
    };
  }, [invalidateRequest, reload, staffPreview]);
  useEffect(() => {
    if (staffPreview) return;
    const controller = new AbortController();
    const version = ++requestVersion.current;
    activeRequest.current?.abort();
    activeRequest.current = controller;
    let active = true;
    const isCurrent = () => active && version === requestVersion.current;
    async function load() {
      try {
        const response = await portalFetch('/api/learning/children', { signal: controller.signal });
        if (!isCurrent()) return;
        if (response.status === 401) { setState({ status: 'login' }); return; }
        if (!response.ok) throw new Error('Unable to load learning information');
        const data: unknown = await response.json();
        if (!isChildrenResponse(data)) throw new Error('Invalid learning information');
        if (isCurrent()) setState({ status: 'ready', data });
      } catch {
        if (isCurrent()) setState({ status: 'error' });
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [refresh, staffPreview]);
  const children = state.status === 'ready' ? state.data.children : [];
  const child = children.find(item => item.learnerId === selectedChildId) ?? (children.length === 1 ? children[0] : null);
  const visit = child ? child.visits.find(item => item.visitId === selectedVisits[child.learnerId]) ?? child.visits[0] : null;
  const pickChild = state.status === 'ready' && children.length > 1 && (!child || choosingChild);
  const previewUnit = staffPreview ? getLearningUnit('DSL-F2', 'dsl-f2-w1-d1') : null;
  const greeting = staffPreview ? '안녕! 나는 드림이야. 나랑 함께 영어 모험을 떠나자!'
    : state.status === 'loading' ? '우리의 모험을 찾고 있어. 잠깐만!'
    : state.status === 'error' ? '잠깐, 길이 끊겼나 봐. 다시 연결해 볼까?'
      : child ? `${childName(child)}, 반가워! 오늘도 나랑 함께 놀자.` : '안녕! 나는 드림이야. 우리 같이 영어 모험을 떠나자!';
  return <main className={styles.home} aria-label="드림이의 영어 모험">
    <LearningWorld className={styles.world} speaking={greetingStatus === 'playing'} onCharacterBounds={setCharacterBounds} />
    <audio ref={greetingAudio} src="/learning/tree-house/intro-voice-01.wav" preload="auto" aria-hidden="true"
      onPlaying={() => setGreetingStatus('playing')} onEnded={() => setGreetingStatus('idle')}
      onError={() => { if (greetingStatus !== 'idle') setGreetingStatus('error'); }} />
    <div className={styles.shade} aria-hidden="true" /><h1 className={styles.screenReader}>드림이와 함께하는 영어 모험</h1>
    <button type="button" className={styles.dreamyGreeting} style={characterBounds ?? undefined} onClick={replayGreeting}
      aria-label="드림이 인사 다시 듣기" title="드림이를 눌러 인사해요" data-greeting={greetingStatus}>
      <span className={styles.greetingHint}>드림이와 인사해요</span>
    </button>
    <header className={styles.hud}>
      <div className={styles.hudLeft}><Link href="/dream-app" className={styles.iconButton} aria-label="모드 선택으로 돌아가기"><HudIcon kind="back" /></Link>
        {child ? children.length > 1 ? <button type="button" className={styles.profile} onClick={() => setChoosingChild(true)} aria-label={`${childName(child)} · 학습할 아이 바꾸기`}><span className={styles.profileAvatar} aria-hidden="true">{childName(child).slice(0, 1)}</span><span>{childName(child)}</span><HudIcon kind="people" /></button> : <div className={styles.profile}><span className={styles.profileAvatar} aria-hidden="true">{childName(child).slice(0, 1)}</span><span>{childName(child)}</span></div> : <span className={styles.worldLabel}>드림이의 영어 섬</span>}
      </div>
      <div className={styles.hudRight}>
        {child && visit && <div className={styles.visitPicker}>{child.visits.length > 1 ? <><label className={styles.screenReader} htmlFor="learning-visit">연수 기록 선택</label><select id="learning-visit" value={visit.visitId} onChange={event => setSelectedVisits(previous => ({ ...previous, [child.learnerId]: event.target.value }))}>{child.visits.map((item, index) => <option key={item.visitId} value={item.visitId}>{visitDates(item)}{index === 0 ? ' · 최근 연수' : ''}</option>)}</select></> : <span className={styles.visitDate} aria-label="연수 기간">{visitDates(visit)}</span>}</div>}
        {state.status === 'ready' && <button type="button" className={styles.iconButton} onClick={reload} aria-label="아이의 학습 정보 새로고침"><HudIcon kind="refresh" /></button>}
      </div>
    </header>
    <div className={styles.sceneUI}>
      <div key={greetingRun} className={`${styles.coachBubble} ${greetingStatus !== 'idle' ? styles.greetingBubble : ''}`} aria-live="polite"><span className={styles.speaker}>드림이</span><p>{greetingStatus === 'error' ? '목소리를 불러오지 못했어. 나를 다시 눌러 줄래?' : greetingStatus !== 'idle' ? '안녕! 나는 드림이야! Hello!' : greeting}</p></div>
      <div className={styles.launchArea}>
        {staffPreview && previewUnit && <LearningUnitCard unit={previewUnit} href={`${previewUnit.href}?preview=1`} staffPreview />}
        {!staffPreview && <>
        {state.status === 'loading' && <section className={`${styles.missionPanel} ${styles.loading}`} role="status" aria-busy="true"><span className={styles.loadingDot} aria-hidden="true" /><h2>아이의 학습 정보를 불러오고 있어요</h2></section>}
        {state.status === 'login' && <section className={styles.missionPanel}><span className={styles.smallLabel}>나의 모험</span><h2>우리, 같이 시작할까?</h2><p>보호자 계정으로 로그인하면<br />나에게 맞는 이야기가 열려요.</p><Link href="/portal?returnTo=%2Flearn" className={styles.primary}>로그인하고 시작하기 <HudIcon kind="arrow" /></Link><PreviewLink /></section>}
        {state.status === 'error' && <section className={styles.missionPanel} role="alert"><span className={styles.smallLabel}>잠시 쉬어가기</span><h2>학습 정보를 불러오지 못했어요</h2><p>연결 상태를 확인하고 다시 시도해 주세요.</p><button type="button" className={styles.primary} onClick={reload}>다시 불러오기 <HudIcon kind="refresh" /></button></section>}
        {state.status === 'ready' && children.length === 0 && <section className={styles.missionPanel}><span className={styles.smallLabel}>내 모험 준비 중</span><h2>{state.data.pendingCount > 0 ? '연수 기록 확인이 필요해요' : '연결된 아이가 아직 없어요'}</h2><p>{state.data.pendingCount > 0 ? '직원이 연수 기록을 확인하면 아이와 배정된 교재가 표시돼요.' : '학원에 보호자 계정의 학생 정보 확인을 요청해 주세요.'}</p><button type="button" onClick={reload} className={styles.secondary}>다시 확인하기</button><PreviewLink /></section>}
        {state.status === 'ready' && child && <div className={styles.childPanel} aria-label={`${childName(child)}의 학습`}>
          {visit ? <VisitLearning child={child} visit={visit} /> : <section className={styles.missionPanel}><span className={styles.smallLabel}>내 모험 준비 중</span><h2>연수 기록을 확인하고 있어요</h2><p>연수 기록이 연결되면 배정된 교재를 확인할 수 있어요.</p><PreviewLink /></section>}
          {state.data.pendingCount > 0 && <p className={styles.pending} role="status">연수 기록 {state.data.pendingCount}건 확인 중</p>}
        </div>}
        </>}
      </div>
    </div>
    {pickChild && <ChildPicker learners={children} selectedId={child?.learnerId ?? null} onSelect={id => { setSelectedChildId(id); setChoosingChild(false); }} onCancel={child ? () => setChoosingChild(false) : undefined} />}
  </main>;
}
