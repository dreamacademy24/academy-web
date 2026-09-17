'use client';
import {useEffect,useState} from 'react';
import {ChecklistSection,ChecklistTemplate} from '@/lib/dreamhouseChecklist';
import styles from './checklist.module.css';

export default function DreamhouseChecklist(){
  const [bookingReady,setBookingReady]=useState(false);
  const [saved,setSaved]=useState<ChecklistTemplate|null>(null),[draft,setDraft]=useState<ChecklistTemplate|null>(null);
  const [variant,setVariant]=useState<'standard'|'daon'>('standard'),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[needsLogin,setNeedsLogin]=useState(false);
  const [fields,setFields]=useState({guest:'',date:'',house:'',beds:'',inspector:'',notes:''});
  const [bookings,setBookings]=useState<{id:string;name:string;date:string;house:string;reservation:string}[]>([]),[bookingId,setBookingId]=useState('');
  const [bookingBusy,setBookingBusy]=useState(false),[bookingError,setBookingError]=useState(''),[bookingRetry,setBookingRetry]=useState(0),[bookingQuery,setBookingQuery]=useState('');
  useEffect(()=>{
    setBookingId(new URLSearchParams(window.location.search).get('bookingId')||'');
    const abort=new AbortController();
    fetch('/api/dreamhouse/checklist/bookings',{cache:'no-store',signal:abort.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setBookings(d.bookings);}).catch(e=>{if(!abort.signal.aborted)setBookingError(e.message);});
    return()=>abort.abort();
  },[]);
  useEffect(()=>{
    if(!bookingId){setBookingBusy(false);setBookingReady(true);return;}
    const abort=new AbortController();setBookingReady(false);setBookingBusy(true);setBookingError('');
    fetch('/api/dreamhouse/checklist/bookings?bookingId='+encodeURIComponent(bookingId),{cache:'no-store',signal:abort.signal}).then(async r=>{
      const d=await r.json();if(!r.ok)throw Error(d.error);if(abort.signal.aborted)return;
      setFields(previous=>({...previous,...d.summary}));setBookingReady(true);
    }).catch(e=>{if(!abort.signal.aborted)setBookingError(e.message);}).finally(()=>{if(!abort.signal.aborted)setBookingBusy(false);});
    return()=>abort.abort();
  },[bookingId,bookingRetry]);
  function chooseBooking(id:string){setFields(previous=>({...previous,guest:'',date:'',house:'',beds:'',notes:''}));setBookingError('');setBookingBusy(!!id);setBookingId(id);}
  async function load(){
    setLoading(true);setError('');setMessage('');
    try{const r=await fetch('/api/dreamhouse/checklist',{cache:'no-store'}),d=await r.json();setNeedsLogin(r.status===401);if(!r.ok)throw Error(d.error);setSaved(d.template);setDraft(d.template);setEditing(false);}
    catch(e){setError(e instanceof Error?e.message:'Could not load the checklist.');}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  const dirty=editing&&JSON.stringify(draft)!==JSON.stringify(saved);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  async function save(){
    if(!draft)return;setBusy(true);setError('');setMessage('');
    try{const r=await fetch('/api/dreamhouse/checklist',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)}),d=await r.json();if(!r.ok)throw Error(d.error);setSaved(d.template);setDraft(d.template);setEditing(false);setMessage('Template saved for all staff.');}
    catch(e){setError(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}
  }
  function change(group:'common'|'daon',index:number,patch:Partial<ChecklistSection>){setDraft(previous=>previous?{...previous,[group]:previous[group].map((s,i)=>i===index?{...s,...patch}:s)}:null);}
  function field(key:keyof typeof fields,label:string){return <label className={styles.field}><span>{label}</span><input aria-label={label} value={fields[key]} maxLength={100} onChange={e=>setFields({...fields,[key]:e.target.value})}/><span className={styles.printValue}>{fields[key]||' '}</span></label>;}
  function section(s:ChecklistSection,index:number){return <section className={styles.section} key={index}><h2>{s.title}</h2><ul>{s.items.map((item,i)=><li key={i}><span className={styles.box} aria-hidden="true"/><span>{item}</span></li>)}</ul></section>;}
  const left=saved?[...saved.common.slice(0,2),...(variant==='daon'?saved.daon:[])]:[];
  const right=saved?saved.common.slice(2):[];
  return <main className={styles.page} lang="en">
    <div className={`${styles.toolbar} ${styles.noPrint}`}>
      <a href="/dreamhouse-rooms">← Dream House</a>{' · '}<a href={'/admin/checkin-details'+(bookingId?'?bookingId='+encodeURIComponent(bookingId):'')} target="_blank" rel="noopener">Check-in Details</a>
      <div className={styles.heading}><div><p>DREAM HOUSE · HOUSEKEEPING</p><h1>Check-in checklist</h1><p>Choose a checklist, fill in the details, then print. Check each item on paper.</p></div>
      <div className={styles.actions}><button disabled={!saved||loading||editing||bookingBusy||!!(bookingId&&bookingError)} onClick={()=>window.print()}>Print / Save PDF</button><button disabled={!saved||loading||busy} onClick={()=>{setEditing(!editing);setDraft(saved);setError('');setMessage('');}}>{editing?'Cancel editing':'Edit checklist'}</button></div></div>
      <section className={styles.bookingPicker}>
        <label>Find a reservation<input aria-label="Find a reservation" placeholder="Name, house or reservation number" value={bookingQuery} onChange={e=>setBookingQuery(e.target.value)}/></label>
        <label>Fill from Check-in Details<select aria-label="Fill from Check-in Details" value={bookingId} onChange={e=>chooseBooking(e.target.value)}>
          <option value="">Blank checklist / Enter manually</option>
          {bookingId&&!bookings.some(b=>b.id===bookingId)&&<option value={bookingId}>Linked reservation</option>}
          {bookings.filter(b=>b.id===bookingId||[b.name,b.house,b.reservation,b.date].join(' ').toLowerCase().includes(bookingQuery.toLowerCase())).map(b=><option value={b.id} key={b.id}>{[b.date,b.name,b.house,b.reservation].filter(Boolean).join(' · ')}</option>)}
        </select></label>
        <p className={styles.hint}>Guest name, check-in date, house number and saved bed setup fill automatically. Changes on this sheet affect this printout only. Print in black and white.</p>
        {bookingBusy&&<p role="status">Loading check-in details…</p>}
        {bookingError&&<p role="alert">{bookingError} {bookingId&&<button onClick={()=>setBookingRetry(n=>n+1)}>Retry</button>}</p>}
      </section>
      <div role="tablist" aria-label="Checklist type" className={styles.tabs}>
        <button role="tab" aria-selected={variant==='standard'} onClick={()=>setVariant('standard')}>Standard</button>
        <button role="tab" aria-selected={variant==='daon'} onClick={()=>setVariant('daon')}>Daon Mom</button>
      </div>
      <p className={styles.hint}>{variant==='daon'?'Includes the standard welcome pack plus mango jelly, cup noodles and cup noodles for children.':'Includes the standard welcome pack and all house checks.'}</p>
      {loading&&<p role="status">Loading checklist…</p>}{message&&<p role="status">{message}</p>}
      {error&&<div role="alert" className={styles.error}>{error} {needsLogin?<a href="/login?next=%2Fdreamhouse-checklist">Staff sign in</a>:<button disabled={busy} onClick={()=>{if(!dirty||window.confirm('Discard your unsaved template edits and reload?'))void load();}}>Reload saved version</button>}</div>}
    </div>
    {editing&&draft&&<div className={`${styles.editor} ${styles.noPrint}`}>
      <h2>Edit the shared checklist</h2><p>Use English. Put one item on each line. Add, remove or reorder lines as needed. Standard items apply to both tabs; Daon Mom extras apply only to Daon Mom. Save to update the template for all staff.</p>
      <fieldset disabled={busy}><div className={styles.editGrid}>{(['common','daon'] as const).flatMap(group=>draft[group].map((s,i)=><section key={group+i}>
        <label>{group==='common'?'Standard section':'Daon Mom extras'}<input aria-label={`${group} section ${i+1} title`} value={s.title} maxLength={80} onChange={e=>change(group,i,{title:e.target.value})}/></label>
        <label>Items — one per line<textarea aria-label={`${s.title} items`} rows={Math.min(18,s.items.length+1)} value={s.items.join('\n')} onChange={e=>change(group,i,{items:e.target.value.split('\n')})}/></label>
      </section>))}</div></fieldset>
      <button disabled={busy||!dirty} onClick={()=>void save()}>{busy?'Saving…':'Save template for all staff'}</button>
    </div>}
    {saved&&!loading&&!bookingBusy&&!(bookingId&&bookingError)&&<article className={styles.sheet} id="dreamhouse-print-sheet" data-booking-ready={bookingReady?"true":"false"}>
      <header className={styles.sheetHeader}><div><p>DREAM HOUSE</p><h1>Check-in Preparation Checklist</h1></div><strong>{variant==='daon'?'DAON MOM':'STANDARD'}</strong></header>
      <div className={styles.details}>{field('guest','Guest / Reservation')}{field('date','Check-in date')}{field('house','Block and lot / House')}{field('beds','Bed setup')}{field('inspector','Checked by')}</div>
      <p className={styles.instructions}>Check that each item is clean, complete and working. Tick when ready; write N/A if not applicable. Record any issues below.</p>
      <div className={styles.columns}><div>{left.map(section)}</div><div>{right.map(section)}</div></div>
      <footer className={styles.footer}><label>Issues / Follow-up notes<textarea aria-label="Issues / Follow-up notes" rows={2} maxLength={600} value={fields.notes} onChange={e=>setFields({...fields,notes:e.target.value})}/><span className={styles.printNotes}>{fields.notes||' '}</span></label><div className={styles.signatures}><span>Final check / Signature: ____________________</span><span>Date / Time: ____________________</span></div></footer>
    </article>}
  </main>;
}
