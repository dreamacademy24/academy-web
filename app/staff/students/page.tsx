'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import styles from './students.module.css';
type Assignment={id:string;teacherId:string;name:string;active:boolean;available:boolean};
type Visit={id:string;learner_id:string;name_kr:string;name_en:string|null;start_date:string;end_date:string;assignments:Assignment[];history:{id:string;teacher:string;actor:string;active:boolean;at:string}[]};
type Roster={isAdmin:boolean;visits:Visit[];teachers:{id:string;name:string}[]};
type Change={requestId:string;visitId:string;teacherId:string;previousId:string|null;active:boolean;name:string};
export default function StudentCare(){
 const [data,setData]=useState<Roster|null>(null),[busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[auth,setAuth]=useState(false);
 const [query,setQuery]=useState(''),[onlyUnassigned,setOnlyUnassigned]=useState(false),[pending,setPending]=useState<Change|null>(null),[message,setMessage]=useState('');
 const load=useCallback(async()=>{
  setBusy(true);setError('');setData(null);setAuth(false);setPending(null);
  try{const r=await fetch('/api/staff/students',{cache:'no-store'});const d=await r.json();if(!r.ok){setAuth(r.status===401);throw new Error(d.error||'Unable to load student care.');}setData(d);}
  catch(e){setError(e instanceof Error?e.message:'Unable to load student care.');}finally{setBusy(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function login(){
  setBusy(true);
  try{const r=await fetch('/api/admin/logout',{method:'POST'});if(!r.ok)throw new Error();for(const k of ['adminToken','adminInfo','teacherSession'])localStorage.removeItem(k);window.location.assign('/login');}
  catch{setError('Unable to open sign in. Please retry.');setBusy(false);}
 }
 function choose(v:Visit,teacherId:string,active:boolean,name:string){
  setMessage('');setPending({requestId:crypto.randomUUID(),visitId:v.id,teacherId,active,name,previousId:v.assignments.find(a=>a.teacherId===teacherId)?.id||null});
 }
 async function save(){
  if(!pending||saving)return;setSaving(true);setMessage('');
  try{const r=await fetch('/api/staff/students/assign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending)});const d=await r.json();if(!r.ok){if(r.status===401||r.status===403){setData(null);setPending(null);setAuth(r.status===401);setError(d.error);}throw new Error(d.error||'저장 결과를 확인하지 못했습니다.');}await load();setMessage('담당자 변경을 저장했습니다.');}
  catch(e){setMessage(e instanceof Error?e.message:'저장 결과를 확인하지 못했습니다.');}finally{setSaving(false);}
 }
 const admin=data?.isAdmin===true;
 const visits=(data?.visits||[]).filter(v=>`${v.name_kr} ${v.name_en||''}`.toLowerCase().includes(query.trim().toLowerCase())&&(!onlyUnassigned||v.assignments.every(a=>!a.active||!a.available)));
 const learners=[...new Set(visits.map(v=>v.learner_id))];
 return <main className={styles.main}>
  <header className={styles.top}><Link href={admin?'/admin/today':'/admineng/hub'}>← {admin?'직원 홈':'Teacher Hub'}</Link><span>DREAM · STUDENT CARE</span></header>
  <section className={styles.hero}><div><p>함께 이어가는 학생 케어 · Connected care</p><h1>{admin?'학생과 방문 이력':'My students'}</h1><p>{admin?'같은 학생의 방문을 구분하고, 방문별로 담당 선생님을 연결합니다.':'Prepare for each visit and care for your assigned students.'}</p></div><button disabled={busy||saving} onClick={()=>{setMessage('');void load();}}>{busy?'Loading…':'↻ Refresh'}</button></section>
  {auth&&<button disabled={busy} onClick={login}>Sign in again / 다시 로그인</button>}
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {message&&<p className={styles.notice} role="status">{message}</p>}
  {data&&<>
   <nav className={styles.actions}>{admin&&<Link href="/staff/student-review">학생 연결 검토 →</Link>}<span>{new Set(data.visits.map(v=>v.learner_id)).size} students · {data.visits.length} visits</span></nav>
   <div className={styles.toolbar}><label>{admin?'학생 이름 검색':'Search students'}<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Korean / English name"/></label>{admin&&<label className={styles.check}><input type="checkbox" checked={onlyUnassigned} onChange={e=>setOnlyUnassigned(e.target.checked)}/>담당자 미배정 방문</label>}</div>
   {!data.visits.length&&<section className={styles.empty}><h2>{admin?'연결한 학생이 아직 없습니다':'No assigned students yet'}</h2><p>{admin?'학생 연결 검토에서 신원과 방문 기간을 확인하면 이곳에 표시됩니다.':'Your administrator will connect your students and visit dates here.'}</p></section>}
   {!!data.visits.length&&!visits.length&&<p className={styles.empty}>{admin?'검색 조건에 맞는 학생이 없습니다.':'No matching students.'}</p>}
   <div className={styles.list}>{learners.map(id=>{
    const periods=visits.filter(v=>v.learner_id===id),student=periods[0];
    return <article key={id} className={styles.student}><header><span className={styles.avatar} aria-hidden="true">{(student.name_en||student.name_kr).slice(0,1)}</span><div><h2>{student.name_en||student.name_kr}</h2><p>{student.name_en?student.name_kr:''} · {periods.length} {admin?'방문':'visible visits'}</p></div></header>
     {periods.map(v=><section key={v.id} className={styles.visit} aria-label={`${student.name_kr} ${v.start_date}`}>
      <div className={styles.period}><h3>{v.start_date} → {v.end_date}</h3><span>{admin?'방문별 담당 선생님':'Care team'}</span></div>
      <div className={styles.teachers}>{v.assignments.filter(a=>a.active).map(a=><div key={a.teacherId}><span>{a.name}{!a.available&&(admin?' · 계정 비활성':' · unavailable')}</span>{admin&&<button disabled={saving||!!pending} onClick={()=>choose(v,a.teacherId,false,a.name)}>배정 해제</button>}</div>)}{v.assignments.every(a=>!a.active)&&<p>{admin?'아직 담당 선생님이 없습니다.':'No care teacher assigned.'}</p>}</div>
      {admin&&<label className={styles.assign}>담당 선생님 추가<select aria-label={`${student.name_kr} ${v.start_date} 담당 선생님 추가`} disabled={saving||!!pending} value="" onChange={e=>{const t=data.teachers.find(t=>t.id===e.target.value);if(t)choose(v,t.id,true,t.name);}}><option value="">선생님 선택</option>{data.teachers.filter(t=>!v.assignments.some(a=>a.teacherId===t.id&&a.active)).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
      {pending?.visitId===v.id&&<div className={styles.confirm}><p><strong>{student.name_kr} · {v.start_date} ~ {v.end_date}</strong></p><p>{pending.name} 선생님을 {pending.active?'담당자로 배정합니다. 이 방문의 학생 케어 정보를 볼 수 있게 됩니다.':'배정 해제합니다. 이 방문의 케어 정보 접근이 종료됩니다. 기존 배정 이력은 보존됩니다.'}</p><button disabled={saving} onClick={save}>{saving?'저장 중…':pending.active?'배정 저장':'해제 저장'}</button> <button disabled={saving} onClick={()=>{setPending(null);setMessage('');}}>취소</button></div>}
      {admin&&v.history.length>0&&<details className={styles.history}><summary>담당자 변경 이력 ({v.history.length})</summary><ul>{v.history.map(h=><li key={h.id}>{h.teacher} · {h.active?'배정':'해제'}<small>{new Date(h.at).toLocaleString('ko-KR')} · {h.actor}</small></li>)}</ul></details>}
     </section>)}
    </article>;
   })}</div>
  </>}
 </main>;
}
