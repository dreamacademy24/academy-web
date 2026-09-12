'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import type {ReviewItem,ReviewStatus} from '@/lib/student-care/reconcile';
import styles from './review.module.css';
type Item=ReviewItem&{name:string;reservation:string;start:string|null;end:string|null;candidates:{id:string;name:string;english:string}[]};
type Result={items:Item[];issues:{bookingId:string;reason:string}[];loadedAt:string;bookingCount:number;studentRowCount:number;orphanRows:number};
const labels:Record<ReviewStatus,string>={id_candidate:'번호 일치 후보',name_review:'이름 확인 필요',unmatched:'연결 대상 없음',conflict:'정보 충돌',placeholder:'이름 미등록 / 자리표시'};
const reasons:Record<string,string>={no_student_name:'학생 이름이 등록되지 않았습니다.',conflicting_source_ids:'한 항목에 서로 다른 학생 번호가 있습니다.',id_not_unique_or_wrong_booking:'학생 번호의 예약 소속 또는 중복 여부를 확인해야 합니다.',id_name_disagreement:'학생 번호는 있지만 이름이 일치하지 않습니다.',same_booking_and_id:'같은 예약의 학생 번호가 일치합니다.',source_id_not_found:'예약에 적힌 번호를 기존 명부에서 찾지 못했습니다.',name_only_requires_review:'같은 예약에서 이름이 일치하는 후보입니다. 직접 확인이 필요합니다.',ambiguous_name:'같은 이름의 후보가 여러 명입니다.',no_candidate_in_booking:'해당 예약에서 연결 후보를 찾지 못했습니다.',repeated_id_claim:'여러 항목이 같은 학생 번호를 가리킵니다.'};
export default function StudentReview(){
 const [data,setData]=useState<Result|null>(null),[error,setError]=useState(''),[auth,setAuth]=useState(false),[busy,setBusy]=useState(true),[filter,setFilter]=useState('all'),[query,setQuery]=useState(''),[page,setPage]=useState(0);
 const load=useCallback(async()=>{
  setBusy(true);setError('');setData(null);setAuth(false);
  try{const r=await fetch('/api/staff/student-review',{cache:'no-store'});const d=await r.json();if(!r.ok){setAuth(r.status===401);throw new Error(d.error||'불러오지 못했어요.');}setData(d);setPage(0);}
  catch(e){setError(e instanceof Error?e.message:'불러오지 못했어요.');}finally{setBusy(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function relogin(){
  setBusy(true);
  try{const r=await fetch('/api/admin/logout',{method:'POST'});if(!r.ok)throw new Error();localStorage.removeItem('adminToken');localStorage.removeItem('adminInfo');localStorage.removeItem('teacherSession');window.location.assign('/login');}
  catch{setError('로그인 화면으로 이동하지 못했습니다. 다시 시도해주세요.');setBusy(false);}
 }
 const filtered=(data?.items||[]).filter(i=>(filter==='all'||i.status===filter)&&`${i.name} ${i.reservation} ${i.candidates.map(c=>c.name+' '+c.english).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
 return <main className={styles.main}>
  <header className={styles.top}><Link href="/admin/today">← 직원 홈</Link><span>DREAM · STUDENT CARE</span></header>
  <section className={styles.hero}><div><p>학생 케어 기반 정리 · 01</p><h1>학생 연결 검토</h1><p>예약에 있는 학생과 기존 학생 명부를 함께 확인합니다.</p></div><button disabled={busy} onClick={load}>{busy?'불러오는 중…':'새로 확인'}</button></section>
  <aside className={styles.notice}><strong>현재는 검토 단계입니다.</strong> 이름이나 번호가 같아도 학생을 자동으로 합치지 않습니다. 원본 자료는 변경하지 않습니다.</aside>
  {error&&<section className={styles.error} role="alert"><p>{error}</p>{auth&&<button disabled={busy} onClick={relogin}>관리자 계정으로 다시 로그인</button>}</section>}
  {busy&&<p role="status">예약과 학생 자료를 확인하고 있습니다…</p>}
  {data&&<>
   <div className={styles.stats}><div><b>{data.bookingCount}</b><span>예약</span></div><div><b>{data.items.length}</b><span>예약 속 학생 항목</span></div><div><b>{data.studentRowCount}</b><span>기존 학생 명부 행</span></div><div><b>{data.orphanRows}</b><span>예약 연결 확인 필요</span></div></div>
   <p className={styles.note}>항목 수는 고유 학생 수가 아닙니다. 방문별 중복과 이름 미등록 항목이 포함될 수 있어요.</p>
   <div className={styles.toolbar}><label>학생 이름 또는 예약번호<input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="검색"/></label><label>검토 상태<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="all">전체</option>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v} · {data.items.filter(i=>i.status===k).length}</option>)}</select></label></div>
   <p>{filtered.length}건 · {new Date(data.loadedAt).toLocaleString('ko-KR')} 조회</p>
   <div className={styles.list}>{filtered.slice(page*25,(page+1)*25).map(i=><article key={i.sourceKey} className={styles.card}><div><span className={styles.badge} data-status={i.status}>{labels[i.status]}</span><h2>{i.name}</h2><p>예약 {i.reservation}</p><p>{i.start||'수업 시작 미등록'} ~ {i.end||'종료 미등록'}</p><small>예약의 {i.sourceIndex+1}번째 항목</small></div><div><h3>기존 명부 연결 후보</h3>{i.candidates.length?i.candidates.map(c=><p key={c.id}><strong>{c.name}</strong> {c.english}<small className={styles.id}>{c.id}</small></p>):<p>확인된 후보가 없습니다.</p>}<details><summary>대조 근거 보기</summary><p>기존 참조 번호: {i.sourceId||'없음'}</p><p>예약 항목과 기존 명부의 번호·이름·예약 소속을 대조한 결과입니다. 다른 방문의 동일 학생 여부는 별도 확인이 필요합니다.</p><ul>{i.reasons.map(reason=><li key={reason}>{reasons[reason]||'추가 확인이 필요합니다.'}</li>)}</ul></details></div></article>)}</div>
   {!filtered.length&&<p>조건에 맞는 항목이 없습니다.</p>}
   <nav className={styles.pager} aria-label="검토 목록 페이지"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>이전</button><span>{page+1} / {Math.max(1,Math.ceil(filtered.length/25))}</span><button disabled={(page+1)*25>=filtered.length} onClick={()=>setPage(p=>p+1)}>다음</button></nav>
   {data.issues.length>0&&<div className={styles.error}>해석하지 못한 자료 {data.issues.length}건이 있습니다. 해당 자료를 확인하기 전 전체 연결을 확정하지 마세요.</div>}
  </>}
 </main>;
}
