'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { learningUnits, officialLevels, type LearningAssignment as Assignment } from '@/lib/learning/catalog';
import styles from './LearningAssignment.module.css';

type AssignmentData = { assignment: Assignment | null; history: (Assignment & { actorName: string })[]; canEdit: boolean };
type SaveRequest = { visitId: string; requestId: string; expectedAssignmentId: string | null; levelCode: string; unitId: string | null };
export default function LearningAssignment({ visitId, admin, defaultOpen = false }: { visitId: string; admin: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [data, setData] = useState<AssignmentData | null>(null);
  const [loading, setLoading] = useState(defaultOpen);
  const [revision, setRevision] = useState(0);
  const [levelCode, setLevelCode] = useState('');
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [operation, setOperation] = useState<SaveRequest | null>(null);
  const [conflict, setConflict] = useState(false);
  const dirty = useRef(false);
  const alive = useRef(true);
  const formId = useId();
  const label = (ko: string, en: string) => admin ? ko : en;

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let current = true;
    async function read() {
      try {
        const response = await fetch(`/api/staff/learning-assignment?visitId=${encodeURIComponent(visitId)}`, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to load learning assignment.');
        if (!current) return;
        setData(result); setError(''); setConflict(false);
        if (!dirty.current) { setLevelCode(result.assignment?.levelCode || ''); setUnitId(result.assignment?.unitId || ''); }
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : 'Unable to load learning assignment.');
      } finally { if (current) setLoading(false); }
    }
    void read();
    return () => { current = false; controller.abort(); };
  }, [open, revision, visitId]);

  const canEdit = admin && data?.canEdit === true;
  const locked = saving || operation !== null;
  const changed = levelCode !== (data?.assignment?.levelCode || '') || unitId !== (data?.assignment?.unitId || '');
  const units = learningUnits.filter(unit => unit.levelCode === levelCode && unit.published);
  function refresh() { if (locked) return; setLoading(true); setMessage(''); setRevision(value => value + 1); }
  async function save() {
    if (saving || !canEdit || conflict || (!operation && (!levelCode || !changed))) return;
    const request = operation ?? { visitId, requestId: crypto.randomUUID(), expectedAssignmentId: data?.assignment?.id ?? null, levelCode, unitId: unitId || null };
    setOperation(request); setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/staff/learning-assignment', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      let result;
      try { result = await response.json(); } catch { throw new Error(); }
      if (!alive.current) return;
      if (!response.ok) {
        // A definite rejection may be edited; ambiguous server/network outcomes retry the same request.
        if ([400, 401, 403, 409, 413].includes(response.status)) setOperation(null);
        if (response.status === 409) {
          setConflict(true);
          setError(label('다른 변경이 있어요. 현재 배정을 새로고침한 뒤 다시 저장해주세요. 입력한 내용은 유지됩니다.', 'Another change was saved. Refresh the assignment, then save again. Your draft is kept.'));
          return;
        }
        if (response.status >= 500 || response.status === 408 || response.status === 429) throw new Error();
        setError(result.error || label('학습 배정을 저장하지 못했습니다.', 'Could not save the assignment.'));
        return;
      }
      setData(result); setLevelCode(result.assignment?.levelCode || ''); setUnitId(result.assignment?.unitId || '');
      dirty.current = false; setOperation(null); setConflict(false);
      setMessage(label('이 방문의 학습 레벨과 교재를 저장했습니다.', 'The learning level and book were saved for this visit.'));
    } catch {
      if (alive.current) setError(label('저장 결과를 확인하지 못했어요. 내용을 바꾸지 말고 아래 버튼으로 같은 요청을 다시 확인해주세요.', 'The save result is uncertain. Retry the same request below before making changes.'));
    } finally { if (alive.current) setSaving(false); }
  }

  return <details className={styles.panel} open={open} onToggle={event => {
    const expanded = event.currentTarget.open;
    if (expanded !== open) { setOpen(expanded); if (expanded) setLoading(true); }
  }}>
    <summary>{label('학습 레벨 · 교재', 'Learning level & book')}{data?.assignment && <span>{data.assignment.levelCode}{data.assignment.unitTitle ? ` · ${data.assignment.unitTitle}` : ''}</span>}</summary>
    {open && <div className={styles.content}>
      <div className={styles.current}><div><small>{label('현재 배정', 'Current assignment')}</small><strong>{data ? data.assignment?.levelCode || label('아직 배정하지 않았습니다', 'Not assigned yet') : loading ? label('불러오는 중…', 'Loading…') : label('배정 확인 필요', 'Check assignment')}</strong>{data?.assignment && <p>{data.assignment.unitTitle || label('앱 교재 미배정 · 준비 중', 'App book not assigned · Pending')}</p>}</div><button type="button" disabled={loading || locked} onClick={refresh}>{label('새로고침', 'Refresh')}</button></div>
      {loading && <p className={styles.note} role="status">{label('학습 정보를 불러오는 중…', 'Loading learning information…')}</p>}
      {data && canEdit && <form className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
        <label htmlFor={`${formId}-level`}>공식 학습 레벨<select id={`${formId}-level`} aria-label="공식 학습 레벨" value={levelCode} disabled={loading || locked} onChange={event => { dirty.current = true; setLevelCode(event.target.value); setUnitId(''); setMessage(''); }}><option value="">레벨 선택</option>{officialLevels.map(level => <option key={level} value={level}>{level}</option>)}</select></label>
        <label htmlFor={`${formId}-unit`}>배정 교재<select id={`${formId}-unit`} aria-label="배정 교재" value={unitId} disabled={loading || locked || !levelCode || !units.length} onChange={event => { dirty.current = true; setUnitId(event.target.value); setMessage(''); }}><option value="">{levelCode && !units.length ? '이 레벨의 앱 교재 준비 중' : '교재 미배정'}</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.title} · Week 1 / Day 1</option>)}</select></label>
        <button className={styles.save} type="submit" disabled={loading || saving || conflict || (!operation && (!levelCode || !changed))}>{saving ? '저장 중…' : operation ? '저장 결과 다시 확인' : '학습 배정 저장'}</button>
      </form>}
      {data && !canEdit && <p className={styles.note}>{label('학습 배정은 한국인 담당자가 수정합니다.', 'Your Korean coordinator manages learning assignments.')}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.success} role="status">{message}</p>}
      {!!data?.history.length && <details className={styles.history}><summary>{label('방문별 변경 이력', 'Assignment history')} ({data.history.length})</summary><ol>{data.history.map(item => <li key={item.id}><strong>{item.levelCode}</strong><span>{item.unitTitle || label('교재 미배정', 'No app book assigned')}</span><small>{new Date(item.effectiveAt).toLocaleString(admin ? 'ko-KR' : 'en-PH')} · {item.actorName} · v{item.version}</small></li>)}</ol></details>}
    </div>}
  </details>;
}
