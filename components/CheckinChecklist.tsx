'use client';
import {useEffect,useRef,useState} from 'react';
import {ChecklistSection,ChecklistTemplate} from '@/lib/dreamhouseChecklist';
import styles from '@/app/dreamhouse-checklist/checklist.module.css';

export default function CheckinChecklist({shared=false}:{shared?:boolean}){
  const [initialized,setInitialized]=useState(false),[savedFields,setSavedFields]=useState(''),[customized,setCustomized]=useState(false);
  const loadVersion=useRef(0);
  const [bookingReady,setBookingReady]=useState(false);
  const [saved,setSaved]=useState<ChecklistTemplate|null>(null),[draft,setDraft]=useState<ChecklistTemplate|null>(null);
  const [variant,setVariant]=useState<'standard'|'daon'>('standard'),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[needsLogin,setNeedsLogin]=useState(false);
  const [fields,setFields]=useState({guest:'',date:'',house:'',beds:'',inspector:'',notes:''});
  const [bookings,setBookings]=useState<{id:string;name:string;date:string;house:string;reservation:string}[]>([]),[bookingId,setBookingId]=useState('');
  const [bookingBusy,setBookingBusy]=useState(false),[bookingError,setBookingError]=useState(''),[bookingRetry,setBookingRetry]=useState(0),[bookingQuery,setBookingQuery]=useState('');
  useEffect(()=>{
    setBookingId(shared?'':new URLSearchParams(window.location.search).get('bookingId')||'');setInitialized(true);
    if(shared)return;
    const abort=new AbortController();
    fetch('/api/dreamhouse/checklist/bookings',{cache:'no-store',signal:abort.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setBookings(d.bookings);}).catch(e=>{if(!abort.signal.aborted)setBookingError(e.message);});
    return()=>abort.abort();
  },[shared]);
  const endpoint='/api/dreamhouse/checklist'+(bookingId?'?bookingId='+encodeURIComponent(bookingId):shared?'?scope=shared':'');
  function chooseBooking(id:string){if(dirty&&!window.confirm('저장하지 않은 수정 내용을 버리고 다른 예약을 여시겠습니까?'))return;setBookingReady(false);setLoading(true);setBookingId(id);}
  async function load(){
    const version=++loadVersion.current;setLoading(true);setBookingReady(false);setError('');setMessage('');setBookingError('');setBookingBusy(!!bookingId);
    try{
      const r=await fetch(endpoint,{cache:'no-store'}),d=await r.json();if(version!==loadVersion.current)return;setNeedsLogin(r.status===401);if(!r.ok)throw Error(d.error);
      let nextFields={guest:'',date:'',house:'',beds:'',inspector:'',notes:''};
      if(bookingId){const b=await fetch('/api/dreamhouse/checklist/bookings?bookingId='+encodeURIComponent(bookingId),{cache:'no-store'}),summary=await b.json();if(!b.ok)throw Error(summary.error);nextFields={...nextFields,...summary.summary,...(d.fields||{})};}
      if(version!==loadVersion.current)return;
      setFields(nextFields);setVariant(d.variant||'standard');setSavedFields(JSON.stringify({fields:nextFields,variant:d.variant||'standard'}));setCustomized(d.customized);setSaved(d.template);setDraft(d.template);setEditing(false);setBookingReady(true);
    }catch(e){if(version===loadVersion.current){setSaved(null);setError(e instanceof Error?e.message:'불러오지 못했습니다.');}}
    finally{if(version===loadVersion.current){setLoading(false);setBookingBusy(false);}}
  }
  useEffect(()=>{if(initialized)void load();return()=>{loadVersion.current++;};},[initialized,bookingId,bookingRetry,shared]);
  const dirty=!!saved&&((editing&&JSON.stringify(draft)!==JSON.stringify(saved))||(!shared&&!!bookingId&&JSON.stringify({fields,variant})!==savedFields));
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  async function save(){
    if(!draft)return;setBusy(true);setError('');setMessage('');
    try{const r=await fetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...draft,...(!shared?{fields,variant}:{})})}),d=await r.json();if(!r.ok)throw Error(d.error);setSaved(d.template);setDraft(d.template);setSavedFields(JSON.stringify({fields,variant}));setCustomized(!shared);setEditing(false);setMessage(shared?'전체 공통 양식을 저장했습니다.':'이 예약에만 저장했습니다. 세트 출력에도 반영됩니다.');}
    catch(e){setError(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}
  }
  function change(group:'common'|'daon',index:number,patch:Partial<ChecklistSection>){setDraft(previous=>previous?{...previous,[group]:previous[group].map((s,i)=>i===index?{...s,...patch}:s)}:null);}
  function field(key:keyof typeof fields,label:string){return <label className={styles.field}><span>{label}</span><input disabled={busy} aria-label={label} value={fields[key]} maxLength={100} onChange={e=>setFields({...fields,[key]:e.target.value})}/><span className={styles.printValue}>{fields[key]||' '}</span></label>;}
  function section(s:ChecklistSection,index:number){return <section className={styles.section} key={index}><h2>{s.title}</h2><ul>{s.items.map((item,i)=><li key={i}><span className={styles.box} aria-hidden="true"/><span>{item}</span></li>)}</ul></section>;}
  const left=saved?[...saved.common.slice(0,2),...(variant==='daon'?saved.daon:[])]:[];
  const right=saved?saved.common.slice(2):[];
  return <div className={styles.page} lang="ko">
    <div className={`${styles.toolbar} ${styles.noPrint}`}>
      {!shared&&<a href="/admin/checkin-details">← 체크인 준비</a>}
      <div className={styles.heading}><div><p>DREAM HOUSE · HOUSEKEEPING</p><h1>{shared?'체크인 체크리스트 · 공통 양식':'예약별 체크인 체크리스트'}</h1><p>{shared?'모든 예약의 기본 체크 항목을 추가·편집합니다. 별도로 저장한 예약별 체크리스트는 바뀌지 않습니다.':bookingId?'이 화면에서 수정하고 저장한 내용은 선택한 예약에만 적용됩니다.':'예약을 선택하면 해당 예약의 체크 항목과 정보를 수정·저장할 수 있습니다.'}</p></div>
      <div className={styles.actions}>{!shared&&<button disabled={!saved||loading||editing||dirty||bookingBusy||!!(bookingId&&bookingError)} onClick={()=>window.print()}>인쇄 / PDF 저장</button>}<button disabled={!saved||loading||busy||(!shared&&!bookingId)} onClick={()=>{setEditing(!editing);setDraft(saved);setError('');setMessage('');}}>{editing?'항목 편집 취소':shared?'공통 항목 편집':'이 예약 항목 편집'}</button>{!shared&&bookingId&&<button disabled={busy||!dirty||loading} onClick={()=>void save()}>{busy?'저장 중…':'이 예약에만 저장'}</button>}</div></div>
      {!shared&&<section className={styles.bookingPicker}>
        <label>Find a reservation<input aria-label="Find a reservation" placeholder="Name, house or reservation number" value={bookingQuery} onChange={e=>setBookingQuery(e.target.value)}/></label>
        <label>예약 선택<select disabled={busy} aria-label="Fill from Check-in Details" value={bookingId} onChange={e=>chooseBooking(e.target.value)}>
          <option value="">Blank checklist / Enter manually</option>
          {bookingId&&!bookings.some(b=>b.id===bookingId)&&<option value={bookingId}>Linked reservation</option>}
          {bookings.filter(b=>b.id===bookingId||[b.name,b.house,b.reservation,b.date].join(' ').toLowerCase().includes(bookingQuery.toLowerCase())).map(b=><option value={b.id} key={b.id}>{[b.date,b.name,b.house,b.reservation].filter(Boolean).join(' · ')}</option>)}
        </select></label>
        <p className={styles.hint}>{customized?'이 예약에 따로 저장된 체크리스트입니다.':'공통 양식을 기본으로 불러왔습니다.'} 수정 후 ‘이 예약에만 저장’을 누르면 다음에 열거나 세트 출력할 때도 유지됩니다. {dirty&&'아직 저장하지 않은 수정 내용이 있습니다.'}</p>
        {bookingBusy&&<p role="status">Loading check-in details…</p>}
        {bookingError&&<p role="alert">{bookingError} {bookingId&&<button onClick={()=>setBookingRetry(n=>n+1)}>Retry</button>}</p>}
      </section>}
      <div role="tablist" aria-label="Checklist type" className={styles.tabs}>
        <button disabled={busy} role="tab" aria-selected={variant==='standard'} onClick={()=>setVariant('standard')}>Standard</button>
        <button disabled={busy} role="tab" aria-selected={variant==='daon'} onClick={()=>setVariant('daon')}>Daon Mom</button>
      </div>
      <p className={styles.hint}>{variant==='daon'?'Includes the standard welcome pack plus mango jelly, cup noodles and cup noodles for children.':'Includes the standard welcome pack and all house checks.'}</p>
      {loading&&<p role="status">Loading checklist…</p>}{message&&<p role="status">{message}</p>}
      {error&&<div role="alert" className={styles.error}>{error} {needsLogin?<a href="/login?next=%2Fdreamhouse-checklist">Staff sign in</a>:<button disabled={busy} onClick={()=>{if(!dirty||window.confirm('Discard your unsaved template edits and reload?'))void load();}}>Reload saved version</button>}</div>}
    </div>
    {editing&&draft&&<div className={`${styles.editor} ${styles.noPrint}`}>
      <h2>{shared?'전체 공통 체크 항목 편집':'선택한 예약의 체크 항목 편집'}</h2><p>한 줄이 체크 항목 한 개입니다. 줄을 추가하거나 삭제해 항목을 바꾸세요. 구역도 추가·삭제할 수 있습니다. 현지 직원도 읽을 수 있도록 항목은 영어로 작성해주세요. {shared?'공통 항목은 기본형과 다온맘 양식에 함께 적용됩니다.':'다른 예약과 공통 양식은 변경되지 않습니다.'}</p>
      <fieldset disabled={busy}><div className={styles.editGrid}>{(['common','daon'] as const).flatMap(group=>draft[group].map((s,i)=><section key={group+i}>
        <label>{group==='common'?'Standard section':'Daon Mom extras'}<input aria-label={`${group} section ${i+1} title`} value={s.title} maxLength={80} onChange={e=>change(group,i,{title:e.target.value})}/></label>
        <label>Items — one per line<textarea aria-label={`${s.title} items`} rows={Math.min(18,s.items.length+1)} value={s.items.join('\n')} onChange={e=>change(group,i,{items:e.target.value.split('\n')})}/></label>
        <button type="button" disabled={draft[group].length<=1} onClick={()=>setDraft({...draft,[group]:draft[group].filter((_,index)=>index!==i)})}>이 구역 삭제</button>
      </section>))}</div></fieldset>
      <div className={styles.actions}>{(['common','daon'] as const).map(group=><button key={group} disabled={busy||draft[group].length>=12} onClick={()=>setDraft({...draft,[group]:[...draft[group],{title:'New section',items:['New item']}]})}>{group==='common'?'공통 구역 추가':'다온맘 구역 추가'}</button>)}<button disabled={busy||!dirty} onClick={()=>void save()}>{busy?'저장 중…':shared?'전체 공통 양식 저장':'이 예약에만 저장'}</button></div>
    </div>}
    {saved&&!loading&&!bookingBusy&&!(bookingId&&bookingError)&&<article className={styles.sheet} id="dreamhouse-print-sheet" data-booking-ready={bookingReady?"true":"false"}>
      <header className={styles.sheetHeader}><div><p>DREAM HOUSE</p><h1>Check-in Preparation Checklist</h1></div><strong>{variant==='daon'?'DAON MOM':'STANDARD'}</strong></header>
      {!shared&&<div className={styles.details}>{field('guest','Guest / Reservation')}{field('date','Check-in date')}{field('house','Block and lot / House')}{field('beds','Bed setup')}{field('inspector','Checked by')}</div>}
      <p className={styles.instructions}>Check that each item is clean, complete and working. Tick when ready; write N/A if not applicable. Record any issues below.</p>
      <div className={styles.columns}><div>{left.map(section)}</div><div>{right.map(section)}</div></div>
      {!shared&&<footer className={styles.footer}><label>Issues / Follow-up notes<textarea disabled={busy} aria-label="Issues / Follow-up notes" rows={2} maxLength={600} value={fields.notes} onChange={e=>setFields({...fields,notes:e.target.value})}/><span className={styles.printNotes}>{fields.notes||' '}</span></label><div className={styles.signatures}><span>Final check / Signature: ____________________</span><span>Date / Time: ____________________</span></div></footer>}
    </article>}
  </div>;
}

