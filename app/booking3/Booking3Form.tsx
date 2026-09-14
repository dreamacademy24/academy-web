'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BOOKING3_DAYS, BOOKING3_MONTHS, BOOKING3_TIMES, BOOKING3_PRICES, booking3Initial, booking3Quote, koreaToday, validateBooking3, type Booking3Form as Form } from '@/lib/booking3';
import Booking3Guide from '@/components/Booking3Guide';
import s from './booking3.module.css';

export default function Booking3Form() {
  const [form, setForm] = useState<Form>(booking3Initial);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [guide, setGuide] = useState(false);
  const [account, setAccount] = useState<'new' | 'existing'>('new');
  const [login, setLogin] = useState({ username: '', password: '' });
  const [verified, setVerified] = useState('');
  const key = useRef('');
  const quote = booking3Quote(form.weekly, form.months);
  useEffect(() => { key.current = crypto.randomUUID(); }, []);
  function change<K extends keyof Form>(name: K, value: Form[K]) { setForm(f => ({ ...f, [name]: value })); setError(''); }
  function toggle(day: string) {
    if (!form.days.includes(day) && form.days.length >= form.weekly) { setError(`주 ${form.weekly}회에 맞춰 요일 ${form.weekly}개를 선택해주세요.`); return; }
    change('days', form.days.includes(day) ? form.days.filter(d => d !== day) : BOOKING3_DAYS.filter(d => form.days.includes(d) || d === day));
    if (!form.dayTimes[day]) setForm(f => ({ ...f, dayTimes: { ...f.dayTimes, [day]: '19:00' } }));
  }
  function next() {
    if (step === 1 && (!form.guardian.trim() || !form.phone.trim() || !form.student.trim() || !form.englishName.trim() || !form.birthYear)) { setError('필수 학생·보호자 정보를 입력해주세요.'); return; }
    if (step === 2) {
      try { validateBooking3({ ...form, privacy: true, rules: true }); } catch (e) { setError((e as Error).message); return; }
    }
    setError(''); setStep(step + 1); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function signIn() {
    setBusy(true); setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: login.username.trim().toLowerCase() + '@dreamacademyph.com', password: login.password });
      if (authError || !data.user) throw new Error('기존 앱 아이디와 비밀번호를 확인해주세요.');
      setVerified(login.username.trim()); setLogin(f => ({ ...f, password: '' }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function submit() {
    if (busy || receipt) return;
    setError('');
    try {
      const payload = validateBooking3(form);
      if (account === 'existing' && !verified) throw new Error('기존 앱 계정으로 로그인해주세요.');
      setBusy(true);
      const { data } = await supabase.auth.getSession();
      if (account === 'existing' && !data.session) throw new Error('앱 로그인이 만료됐습니다. 다시 로그인해주세요.');
      const res = await fetch('/api/booking3', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(account === 'existing' && data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}) }, body: JSON.stringify({ requestKey: key.current, form: payload, useExisting: account === 'existing' }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '접수에 실패했습니다.');
      setReceipt(result.id); setGuide(true); setLogin({ username: '', password: '' }); window.scrollTo({ top: 0 });
    } catch (e) { setError(e instanceof TypeError ? '연결을 확인하지 못했습니다. 입력 내용은 유지됩니다. 다시 접수해주세요.' : (e as Error).message); } finally { setBusy(false); }
  }
  const field = (name: 'guardian' | 'phone' | 'email' | 'student' | 'englishName' | 'birthYear' | 'level' | 'referral', label: string, placeholder: string, required = false, type = 'text') => <label className={s.field}>{label}{required && <span className={s.required}> *</span>}<input type={type} value={form[name]} placeholder={placeholder} required={required} maxLength={name === 'birthYear' ? 4 : 200} inputMode={name === 'phone' ? 'tel' : name === 'birthYear' ? 'numeric' : undefined} onChange={e => change(name, e.target.value)} /></label>;
  return <main className={s.page}>
    <header className={s.nav}><a href="/" className={s.logo}><span>D</span>ream <em>A</em>cademy</a><a href="/login">앱 로그인 ↗</a></header>
    <div className={s.wrap}>
      <div className={s.heading}><span className={s.eyebrow}>ONLINE ENGLISH · 1:1 LIVE CLASS</span><h1>{receipt ? '화상영어 신청이 접수됐어요.' : <>하루 25분,<br />영어로 말하는 습관.</>}</h1><p>{receipt ? '담당자가 희망 일정과 수강 내용을 확인한 뒤 안내드립니다.' : '우리 아이에게 맞는 요일과 시간을 고르세요. 등록 기간에 맞춰 수업 횟수를 계산해 드립니다.'}</p></div>
      {receipt ? <section className={s.success}>
        <span className={s.check}>✓</span><h2>{form.student} 학생 · 주 {form.weekly}회 / {form.months}개월</h2>
        <p>기본 {quote.paidSessions}회 + 추가 혜택 {quote.bonusSessions}회 = <b>총 {quote.totalSessions}회</b></p><p>{form.days.map(d => `${d} ${form.dayTimes[d]}`).join(' · ')} · 한국 시간</p>
        <div className={s.receipt}>접수번호 <strong>{receipt}</strong></div>
        <p>아직 수업이 확정된 것은 아닙니다. 담당자 확인 후 수업 일정과 {account === 'new' ? '앱 아이디·임시 비밀번호를' : '기존 앱 계정 연결을'} 안내드립니다.</p>
        <div className={s.actions}><button type="button" className={s.primary} onClick={() => setGuide(true)}>수업 안내 다시 보기</button><a className={s.secondary} href="/install">앱 설치 방법</a></div>
        <p className={s.muted}>접수번호를 저장해 두세요. 문의 시 함께 알려주시면 확인이 빠릅니다.</p>
      </section> : <>
        <nav className={s.steps} aria-label="신청 단계">{['학생·보호자', '수업 일정', '확인·접수'].map((label, i) => <button key={label} type="button" disabled={i + 1 > step || busy} aria-current={step === i + 1 ? 'step' : undefined} className={step === i + 1 ? s.activeStep : ''} onClick={() => setStep(i + 1)}><span>{i + 1}</span>{label}</button>)}</nav>
        <div className={s.grid}>
          <section className={s.card}>
            <div className={s.sectionHead}><span>0{step}</span><div><h2>{['학생과 보호자 정보', '원하는 수업을 선택하세요', '신청 내용을 확인해주세요'][step - 1]}</h2><p>{step === 2 ? '모든 시간은 한국 기준입니다. 수업은 1회 25분입니다.' : '화상영어 전용 신청서입니다.'}</p></div></div>
            {step === 1 && <><div className={s.fields}>{field('student', '학생 한글 이름', '예: 김드림', true)}{field('englishName', '학생 영문 이름', '예: Dream Kim', true)}{field('birthYear', '출생연도', '예: 2018', true)}{field('level', '영어 수준 · 사용 교재', '처음 배우는 경우 “처음”')}{field('guardian', '보호자 이름', '연락받으실 보호자', true)}{field('phone', '보호자 연락처', '010-0000-0000', true, 'tel')}{field('email', '이메일 (선택)', '안내받을 이메일', false, 'email')}{field('referral', '소개해 주신 분 (선택)', '담당자가 확인 후 혜택 안내')}</div><label className={s.field}>상담·요청 사항<textarea rows={4} maxLength={1500} value={form.notes} onChange={e => change('notes', e.target.value)} placeholder="아이의 학습 경험이나 일정 관련 요청을 알려주세요." /></label></>}
            {step === 2 && <>
              <fieldset className={s.options}><legend>주당 수업 횟수</legend>{[2, 3, 5].map(n => <button type="button" key={n} aria-pressed={form.weekly === n} className={form.weekly === n ? s.selected : ''} onClick={() => { const days = n === 2 ? ['화', '목'] : n === 3 ? ['월', '수', '금'] : [...BOOKING3_DAYS]; setForm(f => ({ ...f, weekly: n, days, dayTimes: Object.fromEntries(days.map(d => [d, f.dayTimes[d] || '19:00'])) })); setError(''); }}><b>주 {n}회</b><small>월 {n * 4}회 · {BOOKING3_PRICES[n].toLocaleString()}원</small></button>)}</fieldset>
              <fieldset className={s.options}><legend>등록 기간 <small>1개월 = 4주</small></legend>{BOOKING3_MONTHS.map(n => <button type="button" key={n} aria-pressed={form.months === n} className={form.months === n ? s.selected : ''} onClick={() => change('months', n)}><b>{n}개월</b><small>{n === 3 ? '+ 2주 혜택' : n === 6 ? '+ 4주 혜택' : `${n * 4}주`}</small></button>)}</fieldset>
              <fieldset className={s.days}><legend>수업 요일 <small>{form.days.length}/{form.weekly}개 선택</small></legend>{BOOKING3_DAYS.map(d => <button key={d} type="button" aria-pressed={form.days.includes(d)} className={form.days.includes(d) ? s.selected : ''} onClick={() => toggle(d)}>{d}</button>)}</fieldset>
              <div className={s.fields}>{form.days.map(day => <label key={day} className={s.field}>{day}요일 시간<select value={form.dayTimes[day] || '19:00'} onChange={e => change('dayTimes', { ...form.dayTimes, [day]: e.target.value })}>{BOOKING3_TIMES.map(t => <option key={t}>{t}</option>)}</select></label>)}<label className={s.field}>희망 시작일 <span className={s.required}>*</span><input type="date" min={koreaToday()} value={form.startDate} onChange={e => change('startDate', e.target.value)} /></label></div>
              <div className={s.note}>희망 시간은 담당자가 확인 후 확정합니다. 휴일·성수기 수업 중단 기간과 연결된 연수 기간은 제외하고 총 회차에 맞춰 종료일을 계산합니다.</div>
            </>}
            {step === 3 && <>
              <dl className={s.review}><div><dt>학생</dt><dd>{form.student} · {form.englishName} ({form.birthYear}년)</dd></div><div><dt>연락처</dt><dd>{form.guardian} · {form.phone}</dd></div><div><dt>희망 일정</dt><dd>{form.startDate}부터<br />{form.days.map(d => `${d} ${form.dayTimes[d]}`).join(' · ')}</dd></div><div><dt>등록 내용</dt><dd>{form.months}개월 · 주 {form.weekly}회 · 총 {quote.totalSessions}회</dd></div></dl>
              <fieldset className={s.options}><legend>앱 계정</legend><button type="button" aria-pressed={account === 'new'} className={account === 'new' ? s.selected : ''} onClick={() => setAccount('new')}><b>새 계정 발급</b><small>확인 후 아이디·비밀번호 안내</small></button><button type="button" aria-pressed={account === 'existing'} className={account === 'existing' ? s.selected : ''} onClick={() => setAccount('existing')}><b>기존 계정 연결</b><small>이미 드림게스트 앱을 쓰고 있어요</small></button></fieldset>
              {account === 'existing' && <div className={s.login}>{verified ? <p>✓ {verified} 계정으로 연결합니다. <button type="button" onClick={() => setVerified('')}>다른 계정</button></p> : <><label className={s.field}>앱 아이디<input autoComplete="username" value={login.username} onChange={e => setLogin({ ...login, username: e.target.value })} /></label><label className={s.field}>앱 비밀번호<input autoComplete="current-password" type="password" value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} /></label><button type="button" className={s.secondary} disabled={busy} onClick={signIn}>기존 계정 확인</button></>}</div>}
              <div className={s.rules}><h3>신청 전 꼭 확인해주세요</h3><ul><li>수업 4일 전까지 변경·취소를 신청하면 회차 차감 없이 조정합니다. 3일 전부터 당일 취소 및 사전 신청 없는 미접속은 회차가 차감됩니다.</li><li>수업 당일 개별 연락은 드리지 않습니다. 일정과 링크를 확인하고 시작 5분 전 접속해주세요.</li><li>현지 정전 등 학원 사정으로 취소되면 회차 차감 없이 보강합니다.</li><li>선생님은 시간과 레벨에 맞춰 배정하며 현지 연수 담당 선생님과 다를 수 있습니다.</li><li>수업 시작 전 전액 환불, 시작 후 총 횟수 1/3 경과 전 2/3, 1/2 경과 전 1/2 환불이며 1/2 경과 후 환불되지 않습니다. 무료 혜택 회차는 환불 금액 산정에 포함하지 않습니다.</li><li>소개 혜택은 담당자가 확인 후 별도 적용합니다. 접수만으로 결제·시간 배정이 확정되지 않습니다.</li></ul><button type="button" className={s.textButton} onClick={() => setGuide(true)}>화상영어 수업 안내 원본 보기 ↗</button></div>
              <label className={s.agree}><input type="checkbox" checked={form.rules} onChange={e => change('rules', e.target.checked)} />수업 운영·취소·환불 규정을 확인했습니다. (필수)</label>
              <div className={s.privacy}><p>신청 상담·수업 운영·앱 계정 발급을 위해 학생 이름·출생연도·학습 정보, 보호자 이름·연락처 및 선택 입력한 정보를 수집합니다. 자세한 보유·처리 기준은 <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보 처리방침</a>에서 확인할 수 있습니다. 동의하지 않으면 신청할 수 없습니다.</p><label className={s.agree}><input type="checkbox" checked={form.privacy} onChange={e => change('privacy', e.target.checked)} />개인정보 수집·이용에 동의합니다. (필수)</label></div>
            </>}
            {error && <div className={s.error} role="alert">{error}</div>}
            <div className={s.actions}>{step > 1 && <button type="button" disabled={busy} className={s.secondary} onClick={() => setStep(step - 1)}>이전</button>}<button type="button" disabled={busy} className={s.primary} onClick={step < 3 ? next : submit}>{busy ? '처리 중…' : step < 3 ? '다음 단계 →' : '화상영어 신청 접수'}</button></div>
          </section>
          <aside className={s.summary}><div className={s.summaryTop}><span>MY CLASS PLAN</span><h2>우리 아이의 수업</h2><strong>{quote.totalSessions}<small>회</small></strong><p>주 {form.weekly}회 · {form.months}개월 등록</p></div><dl><div><dt>기본 수업</dt><dd>{quote.paidSessions}회</dd></div><div><dt>등록 혜택</dt><dd>+ {quote.bonusSessions}회</dd></div><div className={s.total}><dt>신청 금액</dt><dd>{quote.amount.toLocaleString()}원</dd></div></dl><p className={s.muted}>1개월은 4주 기준입니다.<br />3개월 +2주 / 6개월 +4주 혜택</p><div className={s.summaryFoot}>25분 1:1 수업<br />한국 시간 · 평일 운영</div><button type="button" className={s.textButton} onClick={() => setGuide(true)}>수업 안내 보기 ↗</button></aside>
        </div>
      </>}
      <footer className={s.footer}>Dream Academy · Online English<br /><a href="http://pf.kakao.com/_Yuhxhn" target="_blank" rel="noopener noreferrer">신청 문의 · 카카오톡</a></footer>
    </div><Booking3Guide open={guide} onClose={() => setGuide(false)} />
  </main>;
}
