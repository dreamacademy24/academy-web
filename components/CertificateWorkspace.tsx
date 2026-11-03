'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { certificateHtml, defaultCertificateTemplate, emptyCertificate, REQUIRED_FIELDS, TOKENS, validateCertificateData, validateCertificateTemplate, type CertificateBooking, type CertificateData, type CertificateLanguage, type CertificatePayload, type CertificateTemplate } from '@/lib/certificates';
import { certificatePdf } from '@/lib/certificatePdf';
import { openStaffSignIn } from '@/lib/staffSessionClient';

type Saved = { document_id: string; version: number; language: CertificateLanguage; booking_id: string | null; student_name: string; reference: string; created_at: string; created_by: string; payload: CertificatePayload };
type Templates = Record<CertificateLanguage, { version: number; payload: CertificateTemplate }>;
const initialTemplates = (): Templates => ({ ko: { version: 0, payload: defaultCertificateTemplate('ko') }, en: { version: 0, payload: defaultCertificateTemplate('en') } });
async function api(action = '', options?: RequestInit) {
  const response = await fetch('/api/certificates' + action, { ...options, cache: 'no-store', credentials: 'same-origin' });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'Request failed.'); Object.assign(error, { status: response.status }); throw error; }
  return data;
}
export default function CertificateWorkspace({ uiLanguage }: { uiLanguage: CertificateLanguage }) {
  const en = uiLanguage === 'en', tx = (ko: string, english: string) => en ? english : ko;
  const [access, setAccess] = useState<'loading' | 'ready' | 'signin' | 'forbidden' | 'error'>('loading');
  const [templates, setTemplates] = useState<Templates>(initialTemplates), [language, setLanguage] = useState<CertificateLanguage>(uiLanguage);
  const [template, setTemplate] = useState<CertificateTemplate>(() => defaultCertificateTemplate(uiLanguage));
  const [data, setData] = useState<CertificateData>(emptyCertificate), [documents, setDocuments] = useState<Saved[]>([]), [history, setHistory] = useState<Saved[]>([]);
  const [documentId, setDocumentId] = useState(''), [version, setVersion] = useState(0), [latestVersion, setLatestVersion] = useState(0), [bookingId, setBookingId] = useState<string | null>(null);
  const [q, setQ] = useState(''), [results, setResults] = useState<CertificateBooking[]>([]), [booking, setBooking] = useState<CertificateBooking | null>(null);
  const [studentIndex, setStudentIndex] = useState(0), [guardianIndex, setGuardianIndex] = useState(0), [dateConfirmed, setDateConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [templateMode, setTemplateMode] = useState(false), [dirty, setDirty] = useState(false);
  const [origin, setOrigin] = useState(''), [previewReady, setPreviewReady] = useState(false), [overflow, setOverflow] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null), busyRef = useRef(false);
  const load = useCallback(async () => {
    try { const d = await api(); setTemplates(d.templates); setDocuments(d.documents); setAccess('ready'); return d; }
    catch (e) { const err = e as Error & { status?: number }; setError(err.message); setAccess(err.status === 401 ? 'signin' : err.status === 403 ? 'forbidden' : 'error'); }
  }, []);
  useEffect(() => { setOrigin(window.location.origin); setDocumentId(crypto.randomUUID()); void load().then(d => { if (d) setTemplate(d.templates[uiLanguage].payload); }); }, [load, uiLanguage]);
  useEffect(() => { const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  const html = useMemo(() => certificateHtml({ data, template }, language, origin), [data, template, language, origin]);
  useEffect(() => { setPreviewReady(false); }, [html]);
  const student = booking?.students[studentIndex];
  const dateConflict = !!(student && ((booking?.endDate && student.endDate && booking.endDate !== student.endDate) || (student.invoiceEnd && student.endDate && student.invoiceEnd !== student.endDate) || (booking?.startDate && student.startDate && booking.startDate !== student.startDate)));
  const edited = () => { setDirty(true); setMessage(''); };
  const field = (key: keyof CertificateData, value: string) => { setData(d => ({ ...d, [key]: value })); edited(); };
  const tf = <K extends keyof CertificateTemplate>(key: K, value: CertificateTemplate[K]) => { setTemplate(t => ({ ...t, [key]: value })); edited(); };
  const discard = () => !dirty || window.confirm(tx('저장하지 않은 변경사항을 버리고 이동할까요?', 'Discard unsaved changes?'));
  async function run(fn: () => Promise<void>) {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError(''); setMessage('');
    try { await fn(); } catch (e) { const err = e as Error & { status?: number }; setError(err.message); if (err.status === 401) setAccess('signin'); if (err.status === 403) setAccess('forbidden'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function newDocument(nextLanguage = language) {
    if (!discard()) return;
    setLanguage(nextLanguage); setData(emptyCertificate()); setTemplate(templates[nextLanguage].payload); setDocumentId(crypto.randomUUID()); setVersion(0); setLatestVersion(0); setBookingId(null); setBooking(null); setHistory([]); setDateConfirmed(false); setDirty(false); setError(''); setMessage('');
  }
  function switchLanguage(nextLanguage: CertificateLanguage) {
    if (nextLanguage === language || !discard()) return;
    setLanguage(nextLanguage); setTemplate(templates[nextLanguage].payload); setDocumentId(crypto.randomUUID()); setVersion(0); setLatestVersion(0); setHistory([]); setData(d => ({ ...d, reference: d.reference ? d.reference.replace(/-(EN|KO)$/, '') + '-' + nextLanguage.toUpperCase() : '' })); setDirty(true); setMessage('');
  }
  function chooseStudent(b: CertificateBooking, idx: number, gidx: number) {
    const s = b.students[idx], g = b.guardians[gidx];
    setBooking(b); setBookingId(b.id); setStudentIndex(idx); setGuardianIndex(gidx); setDateConfirmed(false);
    setData(d => ({ ...d, reference: `${b.reservation}-ADM-${String(idx+1).padStart(2,'0')}-${language.toUpperCase()}`, studentNameKo: s?.nameKo || '', studentNameEn: s?.nameEn || '', studentDob: s?.dob || '', guardianNameKo: g?.nameKo || '', guardianNameEn: g?.nameEn || '', guardianDob: g?.dob || '', programKo: s?.programKo || '', programEn: s?.programEn || '', startDate: s?.startDate || b.startDate, endDate: s?.endDate || b.endDate, gender: '' }));
    edited();
  }
  function pickBooking(b: CertificateBooking) {
    if (!discard()) return;
    setDocumentId(crypto.randomUUID()); setVersion(0); setLatestVersion(0); setHistory([]); setData(emptyCertificate()); chooseStudent(b, 0, 0);
  }
  async function search(e: React.FormEvent) { e.preventDefault(); await run(async () => { const d = await api('?action=search&q=' + encodeURIComponent(q.trim())); setResults(d.bookings); if (!d.bookings.length) setMessage(tx('일치하는 예약이 없습니다.', 'No matching bookings.')); }); }
  function validation() {
    const problem = validateCertificateTemplate(template, language) || validateCertificateData(data, language);
    if (problem) throw new Error(problem);
    if (dateConflict && !dateConfirmed) throw new Error(tx('연수일 차이를 확인하고 아래 확인란을 체크해주세요.', 'Review the training date difference and tick the confirmation box.'));
  }
  function applySaved(row: Saved, maxVersion: number) {
    setLanguage(row.language); setData(row.payload.data); setTemplate(row.payload.template); setDocumentId(row.document_id); setVersion(row.version); setLatestVersion(maxVersion); setBookingId(row.booking_id); setBooking(null); setDateConfirmed(true); setDirty(false); setTemplateMode(false);
  }
  async function openDocument(id: string) {
    if (!discard()) return;
    await run(async () => { const d = await api('?action=history&documentId=' + id); setHistory(d.versions); if (d.versions[0]) applySaved(d.versions[0], d.versions[0].version); });
  }
  async function saveDocument() { await run(async () => {
    validation();
    const d = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'document', language, documentId, bookingId, expectedVersion: latestVersion, payload: { data, template } }) });
    setVersion(d.saved.version); setLatestVersion(d.saved.version); setDirty(false);
    setHistory(h => [d.saved, ...h]); setDocuments(docs => [d.saved, ...docs.filter(x => x.document_id !== documentId)]);
    setMessage(tx(`새 버전 v${d.saved.version}으로 저장했습니다.`, `Saved as revision v${d.saved.version}.`));
  }); }
  async function saveTemplate() { await run(async () => {
    const invalid = validateCertificateTemplate(template, language); if (invalid) throw new Error(invalid);
    const d = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'template', language, expectedVersion: templates[language].version, payload: template }) });
    setTemplates(ts => ({ ...ts, [language]: { version: d.saved.version, payload: d.saved.payload } }));
    setMessage(tx('공용 양식을 새 버전으로 저장했습니다. 기존 발급본은 유지됩니다.', 'Shared form saved as a new revision. Existing documents retain their original form.'));
  }); }
  async function readySheet() {
    validation();
    if (!previewReady || !frame.current?.contentDocument) throw new Error(tx('미리보기가 준비될 때까지 기다려주세요.', 'Please wait for the preview.'));
    const page = frame.current.contentDocument.querySelector<HTMLElement>('.sheet');
    if (!page || page.scrollHeight > 1125) throw new Error(tx('A4 한 장을 초과합니다. 양식의 문구·글자 크기를 줄여주세요.', 'The form exceeds one A4 page. Shorten text or reduce font size.'));
    return page;
  }
  async function downloadPdf() { await run(async () => {
    const page = await readySheet();
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#fffefb', useCORS: true, logging: false, windowWidth: 794, windowHeight: 1123 });
    const jpeg = Uint8Array.from(atob(canvas.toDataURL('image/jpeg', .96).split(',')[1]), c => c.charCodeAt(0));
    const pdf = certificatePdf(jpeg, canvas.width, canvas.height);
    const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: 'application/pdf' }));
    const a = document.createElement('a'); a.href = url; a.download = `${data.reference}_${language}_v${dirty ? 'draft' : version}_${Date.now()}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    setMessage(tx('PDF를 저장했습니다.', 'PDF downloaded.'));
  }); }
  async function print() { await run(async () => { await readySheet(); frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }); }
  const input = (key: keyof CertificateData, ko: string, english: string, type = 'text') => <label key={key}>{tx(ko, english)}<input type={type} value={data[key]} maxLength={500} onChange={e => field(key, e.target.value)} /></label>;
  if (access !== 'ready') return <section className="cert-gate" style={{ padding: 32, maxWidth: 680, margin: 'auto' }}><h1>{tx('Certificate 공문서', 'Certificates')}</h1><p role="status">{access === 'loading' ? tx('접근 권한을 확인하고 있습니다.', 'Checking access…') : error}</p>{access === 'signin' ? <button onClick={openStaffSignIn}>{tx('로그인하고 돌아오기', 'Sign in and return')}</button> : access === 'error' ? <button onClick={() => void load()}>{tx('다시 시도', 'Retry')}</button> : access === 'forbidden' ? <a href={en ? '/admineng/hub' : '/admin/hub'}>{tx('홈으로', 'Back to home')}</a> : null}</section>;
  return <div className="cert-workspace">
    <style>{`
    .cert-workspace{background:#f5f5ef;min-height:100vh;padding:26px;color:#203247;font:14px Arial,'Malgun Gothic',sans-serif}.cert-workspace *{box-sizing:border-box}.cert-top{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:24px}.cert-top h1{font-size:25px;margin:5px 0}.cert-top p{color:#677686;margin:0;line-height:1.6}.cert-eyebrow{font-size:11px;letter-spacing:.13em;color:#637d8a;font-weight:700}.cert-tools{display:flex;gap:8px;flex-wrap:wrap}.cert-workspace button,.cert-workspace .cert-home{border:1px solid #ced8df;background:white;border-radius:8px;padding:10px 14px;color:#203247;font:inherit;cursor:pointer;text-decoration:none}.cert-workspace button:disabled{opacity:.5;cursor:wait}.cert-workspace button.active,.cert-workspace button.primary{background:#234c69;border-color:#234c69;color:white}.cert-workspace button:focus-visible,.cert-workspace a:focus-visible{outline:3px solid #d7af39;outline-offset:3px}.cert-grid{display:grid;grid-template-columns:minmax(330px,440px) minmax(0,1fr);gap:22px;align-items:start}.cert-panel{background:white;border:1px solid #e2e5df;border-radius:14px;padding:20px;margin-bottom:16px}.cert-panel h2{font-size:16px;margin:0 0 14px}.cert-panel p{font-size:12px;color:#617485;line-height:1.6}.cert-panel label{display:block;font-size:12px;font-weight:600;margin:10px 0;color:#465a6c}.cert-panel input:not([type=checkbox]),.cert-panel select,.cert-panel textarea{width:100%;padding:10px;border:1px solid #cdd6dc;border-radius:7px;color:#203247;background:#fff;font:14px Arial,'Malgun Gothic',sans-serif;margin-top:5px}.cert-panel textarea{min-height:95px;resize:vertical}.cert-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cert-search{display:flex;gap:8px;align-items:end}.cert-search label{flex:1;margin:0}.cert-search button{flex-shrink:0}.cert-result{width:100%;text-align:left;margin-top:8px;line-height:1.5}.cert-result small{display:block;color:#697e8e}.cert-note,.cert-warning,.cert-error,.cert-message{padding:12px 14px;border-radius:8px;margin:10px 0;line-height:1.6;font-size:13px}.cert-note{background:#f0f5f8;color:#436076}.cert-warning{background:#fff7db;color:#79600a;border:1px solid #ead28a}.cert-error{background:#ffefed;color:#982d22}.cert-message{background:#eaf4ee;color:#25643e}.cert-preview-wrap{position:sticky;top:16px;min-width:0}.cert-preview-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:10px;flex-wrap:wrap}.cert-preview-scroll{overflow:auto;border:1px solid #d6dedf;background:#e8edea;padding:20px;border-radius:10px;max-height:83vh}.cert-preview{display:block;width:794px;height:1123px;border:0;box-shadow:0 4px 18px #20324718;background:white}.cert-history button{display:block;width:100%;text-align:left;margin-top:7px;font-size:12px}.cert-fieldrow{display:flex;gap:6px;align-items:center;margin:6px 0}.cert-fieldrow input[type=text]{margin:0;min-width:0}.cert-fieldrow button{padding:7px}.cert-fieldrow input[type=checkbox]{flex-shrink:0}.cert-template-tools{display:flex;gap:6px;flex-wrap:wrap}.cert-badge{font-size:11px;background:#e6eef3;padding:5px 9px;border-radius:20px}.cert-check{display:flex!important;align-items:flex-start;gap:8px;font-size:12px!important;line-height:1.6}.cert-check input{margin-top:4px}.cert-panel summary{cursor:pointer;font-weight:600;line-height:1.6}.cert-workspace button:hover:not(:disabled){filter:brightness(.97)}
    @media(max-width:1200px){.cert-grid{grid-template-columns:380px minmax(0,1fr)}}@media(max-width:900px){.cert-workspace{padding:16px}.cert-grid{grid-template-columns:1fr}.cert-preview-wrap{position:static}.cert-preview-scroll{max-height:75vh}.cert-top h1{font-size:22px}}@media print{.cert-workspace{display:none}}
    `}</style>
    <header className="cert-top"><div><div className="cert-eyebrow">DREAM ACADEMY · CERTIFICATES</div><h1>{tx('Certificate 공문서', 'Certificates')}</h1><p>{tx('입학허가서 · 예약 정보 불러오기 · 한글/영문 발급', 'Admission letters · Import booking details · Korean / English')}</p></div><div className="cert-tools"><a className="cert-home" href={en ? '/admineng/hub' : '/admin/hub'}>{tx('홈으로', 'Home')}</a><button disabled={busy} onClick={() => newDocument()}>{tx('새 문서', 'New document')}</button></div></header>
    {error && <div className="cert-error" role="alert">{error}</div>}{message && <div className="cert-message" role="status">{message}</div>}
    <div className="cert-grid"><fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
    <section className="cert-panel"><h2>{tx('1. 발급 양식', '1. Select a form')}</h2><div className="cert-tools"><button disabled={busy} className={language === 'ko' ? 'active' : ''} onClick={() => switchLanguage('ko')}>입학허가서 · 한글</button><button disabled={busy} className={language === 'en' ? 'active' : ''} onClick={() => switchLanguage('en')}>Letter of Admission · EN</button></div><p>{tx('영문 서류에는 영문 내용만 표시됩니다. 언어를 바꾸면 별도 문서로 작성합니다.', 'English letters contain English content only. Changing language starts a separate document.')}</p><div className="cert-tools"><button className={!templateMode ? 'active' : ''} onClick={() => setTemplateMode(false)}>{tx('내용 작성', 'Document details')}</button><button className={templateMode ? 'active' : ''} onClick={() => setTemplateMode(true)}>{tx('양식 수정', 'Edit form')}</button></div></section>
    {!templateMode ? <>
    <section className="cert-panel"><h2>{tx('2. 예약자 또는 학생 찾기', '2. Find a booking or student')}</h2><form className="cert-search" onSubmit={search}><label>{tx('예약자명 · 학생명 · 예약번호', 'Booker · Student · Reservation')}<input value={q} onChange={e => setQ(e.target.value)} minLength={2} maxLength={80} placeholder={tx('예: 황우연, 남호준', 'Name or reservation number')} /></label><button disabled={busy || q.trim().length < 2}>{tx('검색', 'Search')}</button></form>{results.map(b => <button disabled={busy} type="button" className="cert-result" key={b.id} onClick={() => pickBooking(b)}><strong>{b.bookerKo} / {b.bookerEn}</strong><small>{b.reservation} · {b.students.map(s => s.nameKo || s.nameEn).join(', ')}</small></button>)}
    {booking && <><label>{tx('학생 선택', 'Student')}<select value={studentIndex} onChange={e => chooseStudent(booking, Number(e.target.value), guardianIndex)}>{booking.students.map((s, i) => <option key={i} value={i}>{s.nameKo} / {s.nameEn}</option>)}</select></label><label>{tx('보호자 선택', 'Parent / Guardian')}<select value={guardianIndex} onChange={e => chooseStudent(booking, studentIndex, Number(e.target.value))}>{booking.guardians.map((g, i) => <option key={i} value={i}>{g.nameKo} / {g.nameEn}</option>)}</select></label><p>{tx('생년월일이 비어 있으면 확인 후 입력해주세요. 공문서 수정은 예약 원본을 바꾸지 않습니다.', 'Enter any missing dates of birth after confirmation. Certificate edits do not change the booking.')}</p></>}
    {dateConflict && <div className="cert-warning"><strong>{tx('연수일 확인 필요', 'Training dates differ')}</strong><div>{tx('학생별', 'Student')}: {student?.startDate} ~ {student?.endDate}</div><div>{tx('예약 전체', 'Booking')}: {booking?.startDate} ~ {booking?.endDate}</div>{student?.invoiceEnd && <div>{tx('저장 인보이스 종료일', 'Saved invoice end')}: {student.invoiceEnd}</div>}<button type="button" onClick={() => { setData(d => ({ ...d, startDate: booking?.startDate || d.startDate, endDate: booking?.endDate || d.endDate })); edited(); }}>{tx('예약 전체 연수일 적용', 'Use booking training dates')}</button><label className="cert-check"><input type="checkbox" checked={dateConfirmed} onChange={e => setDateConfirmed(e.target.checked)} />{tx('발급할 연수 기간을 확인했습니다.', 'I have confirmed the training period for this letter.')}</label></div>}
    </section>
    <section className="cert-panel"><h2>{tx('3. 발급 내용', '3. Certificate details')}</h2>
      {input('reference', '발급번호', 'Reference number')}{input('issueDate', '발급일', 'Date of issue', 'date')}
      <div className="cert-pair">{input('studentNameKo', '학생 한글 이름', 'Student Korean name')}{input('studentNameEn', '학생 영문 이름', 'Student English name')}</div>{input('studentDob', '학생 생년월일', 'Student date of birth', 'date')}
      <div className="cert-pair">{input('guardianNameKo', '보호자 한글 이름', 'Guardian Korean name')}{input('guardianNameEn', '보호자 영문 이름', 'Guardian English name')}</div>{input('guardianDob', '보호자 생년월일', 'Guardian date of birth', 'date')}
      {input('programKo', '과정 한글명', 'Program in Korean')}{input('programEn', '과정 영문명', 'Program in English')}
      <div className="cert-pair">{input('startDate', '연수 시작일', 'Training start', 'date')}{input('endDate', '연수 종료일', 'Training end', 'date')}</div>
      <details><summary>{tx('선택 항목', 'Optional details')}</summary><label>{tx('성별', 'Gender')}<select value={data.gender} onChange={e => field('gender', e.target.value)}><option value="">—</option><option value="Male">{tx('남', 'Male')}</option><option value="Female">{tx('여', 'Female')}</option></select></label>{input('nationality', '국적', 'Nationality')}{input('homeSchool', '재학 학교 · 학년', 'Home school / Grade')}{input('schedule', '수업 일정', 'Class schedule')}<p>{tx('선택 항목을 출력하려면 양식 수정에서 해당 항목을 켜주세요.', 'Enable optional rows in Edit form to display them.')}</p></details>
    </section></> : <section className="cert-panel"><h2>{tx('공용 양식 수정', 'Edit the shared form')} <span className="cert-badge">v{templates[language].version}</span></h2><p>{tx('현재 문서에 바로 미리보기가 적용됩니다. 공용 양식 저장 시 다음 새 문서에도 적용됩니다. 이전 발급본은 바뀌지 않습니다.', 'Edits appear in this preview. Save the shared form to use it for new letters. Previously saved letters remain unchanged.')}</p>
      {(['title', 'academy', 'address', 'contact', 'greeting', 'referenceLabel', 'issueDateLabel', 'signatureLabel', 'stampLabel'] as const).map((key, i) => <label key={key}>{tx(['문서 제목','학원명','주소','연락처','수신 문구','발급번호 표기','발급일 표기','서명란 제목','직인 표기'][i], ['Title','Academy name','Address','Contact','Greeting','Reference label','Issue date label','Signature heading','Stamp label'][i])}<input value={template[key]} maxLength={250} onChange={e => tf(key, e.target.value)} /></label>)}
      {(['body','closing'] as const).map((key, i) => <label key={key}>{tx(i ? '발급 목적 문구' : '입학허가 본문', i ? 'Purpose statement' : 'Admission statement')}<textarea value={template[key]} maxLength={1800} onChange={e => tf(key, e.target.value)} /></label>)}
      <p>{tx('자동입력 항목', 'Merge fields')}: {TOKENS.map(k => '{{' + k + '}}').join(' · ')}</p>
      <h2>{tx('출력 항목 · 순서 · 이름', 'Rows · Order · Labels')}</h2>{template.fields.map((f, idx) => <div className="cert-fieldrow" key={f.key}><input type="checkbox" aria-label={f.label + ' visible'} checked={f.visible} disabled={REQUIRED_FIELDS.includes(f.key)} onChange={e => tf('fields', template.fields.map((x,i) => i === idx ? { ...x, visible: e.target.checked } : x))} /><input type="text" aria-label={f.key + ' label'} value={f.label} maxLength={100} onChange={e => tf('fields', template.fields.map((x,i) => i === idx ? { ...x, label: e.target.value } : x))} /><button aria-label={f.key + ' move up'} disabled={idx === 0} onClick={() => { const fields = [...template.fields]; [fields[idx-1],fields[idx]]=[fields[idx],fields[idx-1]]; tf('fields', fields); }}>↑</button><button aria-label={f.key + ' move down'} disabled={idx === template.fields.length - 1} onClick={() => { const fields = [...template.fields]; [fields[idx+1],fields[idx]]=[fields[idx],fields[idx+1]]; tf('fields', fields); }}>↓</button></div>)}
      <h2 style={{marginTop:20}}>{tx('서명 담당자', 'Signatories')}</h2>{template.signers.map((s, idx) => <div className="cert-pair" key={idx}><label>{tx('이름', 'Name')} {idx+1}<input value={s.name} maxLength={80} onChange={e => tf('signers', template.signers.map((x,i) => i === idx ? { ...x,name:e.target.value } : x))}/></label><label>{tx('직책', 'Position')}<input value={s.position} maxLength={100} onChange={e => tf('signers', template.signers.map((x,i) => i === idx ? { ...x,position:e.target.value } : x))}/></label></div>)}
      <div className="cert-pair"><label>{tx('글자 크기', 'Font size')}<input type="number" min={9} max={13} step={.5} value={template.fontSize} onChange={e => tf('fontSize', Number(e.target.value))}/></label><label>{tx('D 워터마크 농도', 'D watermark opacity')}<input type="number" min={.02} max={.08} step={.005} value={template.watermarkOpacity} onChange={e => tf('watermarkOpacity', Number(e.target.value))}/></label></div><label className="cert-check"><input type="checkbox" checked={template.watermark} onChange={e => tf('watermark',e.target.checked)}/>{tx('배경에 로고의 D 표시', 'Show the logo D in the background')}</label>
      <div className="cert-template-tools"><button className="primary" disabled={busy} onClick={saveTemplate}>{tx('공용 양식 새 버전 저장', 'Save shared form revision')}</button><button disabled={busy} onClick={() => { if (discard()) { setTemplate(defaultCertificateTemplate(language)); edited(); } }}>{tx('기본 양식으로 되돌리기', 'Load default form')}</button></div>
    </section>}
    <section className="cert-panel"><h2>{tx('저장된 공문서', 'Saved certificates')}</h2><div className="cert-history">{documents.length ? documents.map(row => <button disabled={busy} key={row.document_id} onClick={() => openDocument(row.document_id)}><strong>{row.student_name} · {row.language.toUpperCase()} · v{row.version}</strong><br/>{row.reference}<br/>{new Date(row.created_at).toLocaleString(en ? 'en-GB' : 'ko-KR', {timeZone:'Asia/Seoul'})}</button>) : <p>{tx('저장된 문서가 없습니다.', 'No saved certificates yet.')}</p>}</div>
    {history.length > 0 && <><h2 style={{marginTop:20}}>{tx('현재 문서 버전 이력', 'Revision history')}</h2><div className="cert-history">{history.map(row => <button disabled={busy} className={version === row.version ? 'active' : ''} key={row.version} onClick={() => { if (discard()) applySaved(row,latestVersion); }}>v{row.version} · {row.created_by} · {new Date(row.created_at).toLocaleString(en ? 'en-GB' : 'ko-KR', {timeZone:'Asia/Seoul'})}</button>)}</div></>}
    </section></fieldset>
    <section className="cert-preview-wrap"><div className="cert-preview-head"><strong>{tx('A4 미리보기', 'A4 preview')} <span className="cert-badge">{dirty ? tx('저장 전 변경 있음', 'Unsaved changes') : version ? 'v' + version : tx('새 문서', 'New document')}</span></strong><div className="cert-tools"><button disabled={busy} className="primary" onClick={saveDocument}>{tx('문서 새 버전 저장', 'Save document revision')}</button><button disabled={busy || !previewReady || overflow} onClick={downloadPdf}>{tx('PDF 다운로드', 'Download PDF')}</button><button disabled={busy || !previewReady || overflow} onClick={print}>{tx('인쇄', 'Print')}</button></div></div>{overflow && <div className="cert-warning" role="alert">{tx('A4 한 장을 초과합니다. 양식에서 본문이나 글자 크기를 줄여주세요.', 'The letter exceeds one A4 page. Shorten the text or reduce font size.')}</div>}<div className="cert-preview-scroll"><iframe ref={frame} title={tx('입학허가서 미리보기', 'Admission letter preview')} className="cert-preview" srcDoc={html} sandbox="allow-same-origin allow-modals" onLoad={async () => { const doc = frame.current?.contentDocument; if (!doc) return; await doc.fonts.ready; await Promise.all(Array.from(doc.images).map(img => img.complete ? Promise.resolve() : new Promise<void>(resolve => { img.onload=()=>resolve(); img.onerror=()=>resolve(); }))); setOverflow((doc.querySelector<HTMLElement>('.sheet')?.scrollHeight || 0) > 1125); setPreviewReady(true); }} /></div></section>
    </div>
  </div>;
}
