'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {openStaffSignIn} from '@/lib/staffSessionClient';
import styles from './students.module.css';
type Assignment={id:string;teacherId:string;name:string;active:boolean;available:boolean};
type Visit={id:string;learner_id:string;name_kr:string;name_en:string|null;start_date:string;end_date:string;reason?:string;linkMethod?:string;assignments:Assignment[];history:{id:string;teacher:string;actor:string;active:boolean;at:string}[]};
type SourceStudent={id:string;name_kr:string;name_en:string|null;start_date:string|null;end_date:string|null;reason:string};
type Roster={isAdmin:boolean;visits:Visit[];teachers:{id:string;name:string}[];sourceCount?:number;pendingStudents?:SourceStudent[]};
type Change={requestId:string;visitId:string;teacherId:string;previousId:string|null;active:boolean;name:string};
export default function StudentCare(){
 const [data,setData]=useState<Roster|null>(null),[busy,setBusy]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[auth,setAuth]=useState(false);
 const [query,setQuery]=useState(''),[onlyUnassigned,setOnlyUnassigned]=useState(false),[pending,setPending]=useState<Change|null>(null),[message,setMessage]=useState('');
 const [onlyReview,setOnlyReview]=useState(false),[page,setPage]=useState(0);
 const load=useCallback(async()=>{
  setBusy(true);setError('');setData(null);setAuth(false);setPending(null);
  try{const r=await fetch('/api/staff/students',{cache:'no-store'});const d=await r.json();if(!r.ok){setAuth(r.status===401);throw new Error(d.error||'Unable to load student care.');}setData(d);
   if(d.isAdmin){
    const syncResponse=await fetch('/api/staff/students',{method:'POST'});const result=await syncResponse.json();
    if(!syncResponse.ok){if([401,403].includes(syncResponse.status)){setData(null);setAuth(syncResponse.status===401);}setMessage(result.error||'자동 연결을 다시 확인해주세요.');}
    else{setData(result.roster);if(result.sync.linked)setMessage(`일치하는 방문 ${result.sync.linked}건을 자동 연결했습니다.`);else if(result.sync.busy)setMessage('다른 화면에서 자동 연결 중입니다. 잠시 후 Refresh를 눌러주세요.');}
   }
  }
  catch(e){setError(e instanceof Error?e.message:'Unable to load student care.');}finally{setBusy(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 function login(){openStaffSignIn();}
 function choose(v:Visit,teacherId:string,active:boolean,name:string){
  setMessage('');setPending({requestId:crypto.randomUUID(),visitId:v.id,teacherId,active,name,previousId:v.assignments.find(a=>a.teacherId===teacherId)?.id||null});
 }
 async function save(){
  if(!pending||saving)return;setSaving(true);setMessage('');
  try{const r=await fetch('/api/staff/students/assign',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending)});const d=await r.json();if(!r.ok){if(r.status===401||r.status===403){setData(null);setPending(null);setAuth(r.status===401);setError(d.error);}throw new Error(d.error||'저장 결과를 확인하지 못했습니다.');}await load();setMessage('담당자 변경을 저장했습니다.');}
  catch(e){setMessage(e instanceof Error?e.message:'저장 결과를 확인하지 못했습니다.');}finally{setSaving(false);}
 }
 const admin=data?.isAdmin===true;
 const sourceVisits:Visit[]=admin?(data?.pendingStudents||[]).map(s=>({id:`source:${s.id}`,learner_id:`source:${s.id}`,name_kr:s.name_kr||'이름 미등록',name_en:s.name_en,start_date:s.start_date||'기간 미등록',end_date:s.end_date||'기간 미등록',reason:s.reason,assignments:[],history:[]})):[];
 const allVisits=[...(data?.visits||[]),...sourceVisits];
 const visits=allVisits.filter(v=>`${v.name_kr} ${v.name_en||''}`.toLowerCase().includes(query.trim().toLowerCase())&&(!onlyReview||!!v.reason)&&(!onlyUnassigned||(!v.reason&&v.assignments.every(a=>!a.active||!a.available))));
 const learners=[...new Set(visits.map(v=>v.learner_id))];
 const lastPage=Math.max(0,Math.ceil(learners.length/25)-1),currentPage=Math.min(page,lastPage);
 return <main className={styles.main}>
  <header className={styles.top}><Link href={admin?'/admin/today':'/admineng/hub'}>← {admin?'직원 홈':'Teacher Hub'}</Link><span>DREAM · STUDENT CARE</span></header>
  <section className={styles.hero}><div><p>함께 이어가는 학생 케어 · Connected care</p><h1>{admin?'학생과 방문 이력':'My students'}</h1><p>{admin?'기존 학생 명부를 바로 확인하고, 방문별 담당 선생님을 배정합니다.':'Prepare for each visit and care for your assigned students.'}</p></div><button disabled={busy||saving} onClick={()=>{setMessage('');void load();}}>{busy?'Loading…':'↻ Refresh'}</button></section>
  <nav className={styles.actions} aria-label="Staff guides"><a href="/staff-guides/student-care/ko.html">직원 가이드 · 한국어</a><a href="/staff-guides/student-care/en.html" lang="en">Staff guide · English</a></nav>
  {auth&&<button disabled={busy} onClick={login}>Sign in again / 다시 로그인</button>}
  {error&&<p className={styles.error} role="alert">{error}</p>}
  {message&&<p className={styles.notice} role="status">{message}</p>}
  {data&&<>
   <nav className={styles.actions}>{admin&&<Link href="/staff/student-review">확인 필요한 기록 검토 →</Link>}<span>{admin?`기존 명부 ${data.sourceCount||0}건 · 연결된 방문 ${data.visits.length}건 · 확인 필요 ${sourceVisits.length}건`:`${new Set(data.visits.map(v=>v.learner_id)).size} students · ${data.visits.length} visits`}</span></nav>
   {admin&&<p className={styles.notice}>학생 번호·예약·이름·방문 기간이 정확히 일치하면 자동 연결됩니다. 확인이 필요한 기록도 목록에 표시됩니다. 명부 건수에는 재방문 기록이 포함될 수 있으며, 이름만 같은 학생을 합치지 않습니다.</p>}
   <div className={styles.toolbar}><label>{admin?'학생 이름 검색':'Search students'}<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="Korean / English name"/></label>{admin&&<><label className={styles.check}><input type="checkbox" checked={onlyUnassigned} onChange={e=>{setOnlyUnassigned(e.target.checked);setOnlyReview(false);setPage(0);}}/>담당자 미배정 방문</label><label className={styles.check}><input type="checkbox" checked={onlyReview} onChange={e=>{setOnlyReview(e.target.checked);setOnlyUnassigned(false);setPage(0);}}/>확인 필요한 기록만</label></>}</div>
   {!allVisits.length&&<section className={styles.empty}><h2>{admin?'등록된 학생이 없습니다':'No assigned students yet'}</h2><p>{admin?'기존 학생 명부에 학생이 등록되면 자동으로 표시됩니다.':'Your administrator will assign your students and visit dates here.'}</p></section>}
   {!!allVisits.length&&!visits.length&&<p className={styles.empty}>{admin?'검색 조건에 맞는 학생이 없습니다.':'No matching students.'}</p>}
   <div className={styles.list}>{learners.slice(currentPage*25,(currentPage+1)*25).map(id=>{
    const periods=visits.filter(v=>v.learner_id===id),student=periods[0];
    return <article key={id} className={styles.student}><header><span className={styles.avatar} aria-hidden="true">{(student.name_en||student.name_kr).slice(0,1)}</span><div><h2>{student.name_en||student.name_kr}</h2><p>{student.name_en?student.name_kr:''} · {student.reason?'기존 학생 명부':`${periods.length} ${admin?'방문':'visible visits'}`}</p></div></header>
     {periods.map(v=><section key={v.id} className={styles.visit} aria-label={`${student.name_kr} ${v.start_date}`}>
      <div className={styles.period}><h3>{v.start_date} → {v.end_date}</h3><span>{v.reason?'확인 필요':admin?(v.linkMethod==='automatic'?'자동 연결 · 방문별 담당 선생님':'방문별 담당 선생님'):'Care team'}</span></div>
      {v.reason?<p className={styles.notice}>{v.reason} · 명부에 있는 학생입니다. 정보 확인 후 담당 선생님을 배정할 수 있습니다. <Link href="/staff/student-review">기록 확인 →</Link></p>:<>
      <div className={styles.teachers}>{v.assignments.filter(a=>a.active).map(a=><div key={a.teacherId}><span>{a.name}{!a.available&&(admin?' · 계정 비활성':' · unavailable')}</span>{admin&&<button disabled={saving||!!pending} onClick={()=>choose(v,a.teacherId,false,a.name)}>배정 해제</button>}</div>)}{v.assignments.every(a=>!a.active)&&<p>{admin?'아직 담당 선생님이 없습니다.':'No care teacher assigned.'}</p>}</div>
      {admin&&<label className={styles.assign}>담당 선생님 추가<select aria-label={`${student.name_kr} ${v.start_date} 담당 선생님 추가`} disabled={saving||!!pending} value="" onChange={e=>{const t=data.teachers.find(t=>t.id===e.target.value);if(t)choose(v,t.id,true,t.name);}}><option value="">선생님 선택</option>{data.teachers.filter(t=>!v.assignments.some(a=>a.teacherId===t.id&&a.active)).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
      {pending?.visitId===v.id&&<div className={styles.confirm}><p><strong>{student.name_kr} · {v.start_date} ~ {v.end_date}</strong></p><p>{pending.name} 선생님을 {pending.active?'담당자로 배정합니다. 이 방문의 학생 케어 정보를 볼 수 있게 됩니다.':'배정 해제합니다. 이 방문의 케어 정보 접근이 종료됩니다. 기존 배정 이력은 보존됩니다.'}</p><button disabled={saving} onClick={save}>{saving?'저장 중…':pending.active?'배정 저장':'해제 저장'}</button> <button disabled={saving} onClick={()=>{setPending(null);setMessage('');}}>취소</button></div>}
      {admin&&v.history.length>0&&<details className={styles.history}><summary>담당자 변경 이력 ({v.history.length})</summary><ul>{v.history.map(h=><li key={h.id}>{h.teacher} · {h.active?'배정':'해제'}<small>{new Date(h.at).toLocaleString('ko-KR')} · {h.actor}</small></li>)}</ul></details>}
      </>}
     </section>)}
    </article>;
   })}</div>
   {learners.length>25&&<nav className={styles.actions} aria-label="학생 목록 페이지"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>이전 / Previous</button><span>{currentPage+1} / {lastPage+1}</span><button disabled={currentPage===lastPage} onClick={()=>setPage(currentPage+1)}>다음 / Next</button></nav>}
  </>}
 </main>;
}
