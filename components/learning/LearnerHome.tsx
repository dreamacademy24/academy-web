'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { portalFetch } from '@/lib/portalFetch';
import { supabase } from '@/lib/supabase';
import { getLearningUnit, isLevelCode } from '@/lib/learning/catalog';
import type { LearningChildren, LearningChild } from '@/lib/learning/children';
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

function VisitLearning({ child, visit }: { child: LearningChild; visit: ChildVisit }) {
  const assignment = visit.assignment;
  const level = assignment && isLevelCode(assignment.levelCode) ? assignment.levelCode : null;
  const unit = assignment && getLearningUnit(level, assignment.unitId);
  const published = assignment?.published === true && unit?.published === true;
  const query = new URLSearchParams({ learnerId: child.learnerId, visitId: visit.visitId });
  if (!assignment || !level) return <div className={styles.waiting} role="status"><span className={styles.stateLabel}>학습 배정 대기</span><h3>배울 내용을 준비하고 있어요</h3><p>선생님이 레벨과 교재를 배정하면<br />여기에서 학습을 시작할 수 있어요.</p></div>;
  if (!published || !unit) return <div className={styles.waiting} role="status"><span className={styles.level}>{level}</span><h3>{assignment.unitId ? '교재를 준비하고 있어요' : '교재 배정을 기다리고 있어요'}</h3><p>{assignment.unitId ? '배정된 교재가 아직 앱에 공개되지 않았어요.' : '학습할 교재가 배정되면 여기에서 시작할 수 있어요.'}</p><span className={styles.stateLabel}>{assignment.unitId ? '공개 준비 중' : '교재 배정 대기'}</span></div>;
  return <article className={styles.unit}>
    <div className={styles.unitPicture}><Image src="/learning/tree-house/scene.webp" alt="나무 위에 지어진 작은 집" width={1408} height={1024} sizes="(max-width: 600px) 90vw, 290px" /></div>
    <div className={styles.unitCopy}><span className={styles.level}>{level}</span><span className={styles.unitLabel}>나에게 배정된 교재</span><h3>{unit.title}</h3><p>이야기를 보고, 듣고 말하고,<br />마지막 게임까지 함께해요.</p><Link className={styles.primary} href={`${unit.href}?${query.toString()}`}>학습 시작하기 <span aria-hidden="true">→</span></Link></div>
  </article>;
}

export default function LearnerHome() {
  const [state, setState] = useState<HomeState>({ status: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedVisits, setSelectedVisits] = useState<Record<string, string>>({});
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
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') { actorId.current = session?.user.id ?? null; return; }
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
      invalidateRequest();
      const nextActor = session?.user.id ?? null;
      if (event === 'SIGNED_OUT' || actorId.current !== nextActor) {
        setSelectedChildId(null);
        setSelectedVisits({});
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
  }, [invalidateRequest, reload]);
  useEffect(() => {
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
  }, [refresh]);
  const children = state.status === 'ready' ? state.data.children : [];
  const child = children.find(item => item.learnerId === selectedChildId) ?? (children.length === 1 ? children[0] : null);
  const visit = child ? child.visits.find(item => item.visitId === selectedVisits[child.learnerId]) ?? child.visits[0] : null;
  return <main className={styles.home}>
    <header className={styles.header}><Link href="/dream-app" className={styles.brand}>DREAM <span>LEARNING</span></Link><Link href="/dream-app" className={styles.modeLink}>모드 선택</Link></header>
    <section className={styles.hello} aria-labelledby="learn-home-title"><div><span className={styles.eyebrow}>드림이와 함께하는 영어 공부</span><h1 id="learn-home-title">오늘의 모험을<br />시작해 볼까요?</h1><p>우리 아이의 레벨과 교재로 이어지는 영어 시간.</p></div><Image className={styles.mango} src="/learning/tree-house/dreamy-wave.webp" width={300} height={400} alt="망고 드림이" sizes="(max-width: 600px) 90px, 150px" /></section>
    {state.status === 'loading' && <section className={styles.message} role="status" aria-busy="true"><span className={styles.loadingDot} aria-hidden="true" /><h2>아이의 학습 정보를 불러오고 있어요</h2></section>}
    {state.status === 'login' && <section className={styles.message}><span className={styles.stateLabel}>나의 학습</span><h2>누구와 함께 떠날까요?</h2><p>보호자 계정으로 로그인하면<br />아이별 교재와 연수 기록을 확인할 수 있어요.</p><Link href="/portal?returnTo=%2Flearn" className={styles.primary}>로그인하고 시작하기 <span aria-hidden="true">→</span></Link></section>}
    {state.status === 'error' && <section className={styles.message} role="alert"><h2>학습 정보를 불러오지 못했어요</h2><p>연결 상태를 확인하고 다시 시도해 주세요.</p><button type="button" className={styles.secondary} onClick={reload}>다시 불러오기</button></section>}
    {state.status === 'ready' && <>
      <div className={styles.sectionBar}><h2>{children.length > 1 ? '학습할 아이를 선택해 주세요' : '나의 학습'}</h2><button type="button" className={styles.refresh} onClick={reload} aria-label="아이의 학습 정보 새로고침">↻ 새로고침</button></div>
      {children.length === 0 ? <section className={styles.message}><h3>{state.data.pendingCount > 0 ? '연수 기록 확인이 필요해요' : '연결된 아이가 아직 없어요'}</h3><p>{state.data.pendingCount > 0 ? '직원이 연수 기록을 확인하면 아이와 배정된 교재가 표시돼요.' : '학원에 보호자 계정의 학생 정보 확인을 요청해 주세요.'}</p><button type="button" onClick={reload} className={styles.secondary}>다시 확인하기</button></section> : <>
        {children.length > 1 && <div className={styles.children} aria-label="학습할 아이"><div className={styles.childButtons}>{children.map((item, index) => <button key={item.learnerId} type="button" className={styles.childButton} aria-pressed={child?.learnerId === item.learnerId} onClick={() => setSelectedChildId(item.learnerId)}><span className={styles.avatar} aria-hidden="true">{childName(item).slice(0, 1) || index + 1}</span><span><strong>{childName(item)}</strong>{item.nameEn && item.nameEn !== childName(item) && <small>{item.nameEn}</small>}</span><span className={styles.check} aria-hidden="true">{child?.learnerId === item.learnerId ? '✓' : ''}</span></button>)}</div></div>}
        {child ? <section className={styles.childPanel} aria-label={`${childName(child)}의 학습`}>
          <div className={styles.childTitle}><div><span className={styles.stateLabel}>지금 학습할 아이</span><h2>{childName(child)}{child.nameEn && child.nameEn !== childName(child) && <small>{child.nameEn}</small>}</h2></div></div>
          {visit ? <><div className={styles.visitPicker}>{child.visits.length > 1 ? <><label htmlFor="learning-visit">연수 기록 선택</label><select id="learning-visit" value={visit.visitId} onChange={event => setSelectedVisits(previous => ({ ...previous, [child.learnerId]: event.target.value }))}>{child.visits.map((item, index) => <option key={item.visitId} value={item.visitId}>{visitDates(item)}{index === 0 ? ' · 최근 연수' : ''}</option>)}</select></> : <><span>연수 기간</span><strong>{visitDates(visit)}</strong></>}</div><VisitLearning child={child} visit={visit} /></> : <div className={styles.waiting} role="status"><h3>연수 기록을 확인하고 있어요</h3><p>연수 기록이 연결되면 배정된 교재를 확인할 수 있어요.</p></div>}
        </section> : <div className={styles.chooseHint}>위에서 아이를 선택하면 배정된 교재가 열려요.</div>}
        {state.data.pendingCount > 0 && <p className={styles.pending} role="status">확인이 필요한 연수 기록 {state.data.pendingCount}건이 있어요. 직원이 확인하면 이곳에 함께 표시돼요.</p>}
      </>}
    </>}
    <footer className={styles.footer}><Link href="/learn/tree-house?preview=1">로그인 없이 공개 체험 보기 <span aria-hidden="true">→</span></Link><p>공개 체험은 아이에게 배정된 학습과 별도로 진행돼요.</p></footer>
  </main>;
}
