'use client';
import { useEffect, useState } from 'react';
import type { Booking3Form } from '@/lib/booking3';
import { koreaToday } from '@/lib/booking3';
import { englishLevelLabel } from '@/lib/englishLevels';
import s from '@/app/booking3/booking3.module.css';

type Application = { id: string; payload: Booking3Form; quote: { amount: number; paidSessions: number; bonusSessions: number; totalSessions: number }; status: string; existing_user_id: string | null; enrollment_id: string | null; account_username: string | null; created_at: string; updated_at: string };
type Issued = { enrollmentId: string; username: string; password: string | null; existing: boolean };
export default function Booking3Applications() {
  const [rows, setRows] = useState<Application[]>([]), [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [start, setStart] = useState(''), [filter, setFilter] = useState('pending'), [search, setSearch] = useState('');
  const [issued, setIssued] = useState<Issued | null>(null), [copied, setCopied] = useState(false);
  const current = rows.find(r => r.id === selected);
  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/booking3', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setRows(result.applications);
    } catch (e) { setError((e as Error).message || '신청 목록을 불러오지 못했습니다.'); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  function select(row: Application) { setSelected(row.id); setStart(row.payload.startDate); setIssued(null); setCopied(false); setError(''); }
  async function action(kind: 'issue' | 'reject') {
    if (!current || busy) return;
    if (kind === 'reject' && !confirm('이 신청을 취소 처리할까요?')) return;
    setBusy(true); setError(''); setCopied(false);
    try {
      const response = await fetch('/api/admin/booking3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: kind, id: current.id, startDate: start }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (kind === 'issue') setIssued(result);
      await load();
    } catch (e) { setError((e as Error).message || '처리 결과를 확인하지 못했습니다.'); } finally { setBusy(false); }
  }
  async function copy() {
    if (!issued || !current) return;
    const message = `안녕하세요. ${current.payload.student} 학생 화상영어 앱 안내드립니다.\n앱 로그인: https://www.dreamacademyph.com/login\n아이디: ${issued.username}\n${issued.password ? `임시 비밀번호: ${issued.password}\n로그인 후 비밀번호를 변경해주세요.\n` : '기존 비밀번호로 로그인해주세요.\n'}앱 설치: https://www.dreamacademyph.com/install\n앱 → 화상영어에서 수업 일정을 확인해주세요. 선생님·최종 시간은 담당자 안내를 확인해주세요.\n수업 안내: https://www.dreamacademyph.com/booking3/class-guide-20260902.png`;
    try { await navigator.clipboard.writeText(message); setCopied(true); } catch { setError('복사하지 못했습니다. 아래 계정 정보를 직접 복사해주세요.'); }
  }
  const status = (v: string) => ({ pending: '접수 대기', processing: '발급 처리 중', issued: '발급 완료', rejected: '취소' }[v] || v);
  return <section className={s.page} style={{ borderRadius: 18, padding: 24 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}><div><h2 style={{ margin: 0, fontSize: 25 }}>화상영어 신청서</h2><p className={s.muted}>booking3 접수 → 내용·입금 확인 → 수강권·앱 발급 → 선생님 배정</p></div><div className={s.actions} style={{ margin: 0 }}><a className={s.secondary} href="/booking3" target="_blank" rel="noopener noreferrer">신청서 열기 ↗</a><button className={s.secondary} onClick={load} disabled={loading || busy}>새로고침</button></div></div>
    {error && <div role="alert" className={s.error}>{error}{error.includes('로그인') && <p><a href="/login?next=%2Fadmin%2Fonline-class">다시 로그인</a></p>}</div>}
    <div className={s.fields}><label className={s.field}>처리 상태<select value={filter} onChange={e => setFilter(e.target.value)}><option value="pending">접수·처리 대기</option><option value="issued">발급 완료</option><option value="all">전체 (최근 200건)</option></select></label><label className={s.field}>신청 검색<input placeholder="학생·보호자 이름 또는 연락처" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
    <div style={{ display: 'grid', gridTemplateColumns: current ? 'minmax(260px, 1fr) minmax(400px, 1.6fr)' : '1fr', gap: 22, alignItems: 'start', overflowX: 'auto' }}>
      <div>{loading && <p role="status">신청서를 불러오는 중입니다…</p>}{!loading && !rows.filter(r => (filter === 'all' || (filter === 'pending' ? ['pending', 'processing'].includes(r.status) : r.status === filter)) && `${r.payload.student} ${r.payload.guardian} ${r.payload.phone}`.includes(search)).length && <div className={s.card}>해당 신청서가 없습니다.</div>}
        {rows.filter(r => (filter === 'all' || (filter === 'pending' ? ['pending', 'processing'].includes(r.status) : r.status === filter)) && `${r.payload.student} ${r.payload.guardian} ${r.payload.phone}`.includes(search)).map(r => <button type="button" key={r.id} onClick={() => select(r)} disabled={busy} style={{ display: 'block', width: '100%', textAlign: 'left', background: selected === r.id ? '#fffae4' : '#fff', border: selected === r.id ? '2px solid #d9b329' : '1px solid #dde2e8', padding: 20, borderRadius: 14, marginBottom: 12, color: '#203044' }}><strong style={{ fontSize: 18 }}>{r.payload.student}</strong> <span style={{ fontSize: 12 }}>{status(r.status)}</span><div>{r.payload.guardian} · {r.payload.phone}</div><div className={s.muted}>{r.payload.months}개월 / 주 {r.payload.weekly}회 / 총 {r.quote.totalSessions}회<br />{new Date(r.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</div></button>)}
      </div>
      {current && <article className={s.card}><h2 style={{ marginTop: 0 }}>{current.payload.student} · 신청 상세</h2><dl className={s.review}><div><dt>영문명·출생</dt><dd>{current.payload.englishName} · {current.payload.birthYear}</dd></div><div><dt>보호자</dt><dd>{current.payload.guardian} · {current.payload.phone}<br />{current.payload.email}</dd></div><div><dt>레벨</dt><dd>{englishLevelLabel(current.payload.level)}</dd></div><div><dt>희망 시간</dt><dd>{current.payload.days.map(d => `${d} ${current.payload.dayTimes[d]}`).join(' · ')} (한국)</dd></div><div><dt>수강 내용</dt><dd>{current.payload.months}개월 · 유료 {current.quote.paidSessions}회 + 혜택 {current.quote.bonusSessions}회<br />총 {current.quote.totalSessions}회 · {current.quote.amount.toLocaleString()}원</dd></div><div><dt>앱 계정</dt><dd>{current.existing_user_id ? '로그인 확인된 기존 계정 연결' : '새 아이디·임시 비밀번호 발급'}</dd></div><div><dt>소개자</dt><dd>{current.payload.referral || '없음'}<br /><small>소개 혜택은 확인 후 수강권에서 별도 반영</small></dd></div><div><dt>요청 사항</dt><dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{current.payload.notes || '없음'}</dd></div></dl>
        {current.status !== 'issued' && current.status !== 'rejected' && <><label className={s.field}>확인한 시작일<input type="date" value={start} min={koreaToday()} onChange={e => setStart(e.target.value)} /></label><div className={s.note}>입금과 희망 시간을 확인한 뒤 발급하세요. 발급하면 수강생 목록에 출석부가 만들어집니다. 선생님은 수강권 상세에서 배정하세요. 휴일·방학은 자동 제외됩니다.</div></>}
        <div className={s.actions}>{current.status === 'pending' && <button className={s.secondary} disabled={busy} onClick={() => action('reject')}>신청 취소</button>}{current.status !== 'rejected' && <button className={s.primary} disabled={busy} onClick={() => action('issue')}>{busy ? '발급 처리 중…' : current.status === 'issued' ? '발급 계정 확인' : '수강권·앱 계정 발급'}</button>}</div>
        {current.enrollment_id && <p><a href={`/admin/online-class/${current.enrollment_id}`}>수강권·출석부 열기 → 선생님 배정</a></p>}
        {issued && <section className={s.note} style={{ background: '#eef9f1' }}><h3>발급 완료</h3><p>아이디 <strong>{issued.username}</strong><br />{issued.password ? <>임시 비밀번호 <code style={{ userSelect: 'all' }}>{issued.password}</code></> : '기존 비밀번호를 그대로 사용합니다.'}</p><button className={s.secondary} onClick={copy}>{copied ? '안내 문구 복사됨' : '손님에게 보낼 계정 안내 복사'}</button><p className={s.muted}>이 화면에서 메시지를 자동 발송하지 않습니다. 확인한 보호자에게 전달해주세요.</p></section>}
      </article>}
    </div>
  </section>;
}
