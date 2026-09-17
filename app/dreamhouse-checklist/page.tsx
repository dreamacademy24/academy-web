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
  async function load(){
    setLoading(true);setError('');setMessage('');
    try{const r=await fetch('/api/dreamhouse/checklist',{cache:'no-store'}),d=await r.json();setNeedsLogin(r.status===401);if(!r.ok)throw Error(d.error);setSaved(d.template);setDraft(d.template);setEditing(false);}
    catch(e){setError(e instanceof Error?e.message:'Could not load the checklist.');}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get('bookingId');if(!id){setBookingReady(true);return;}fetch('/api/admin/checkin-preparation?bookingId='+encodeURIComponent(id)).then(async r=>{if(!r.ok)throw Error('예약 정보를 불러오지 못했습니다.');return r.json();}).then(({booking:b,detail:d})=>{setFields(f=>({...f,guest:b.booker_name||'',date:(b.checkin_date||'').slice(0,10),house:b.house_no||b.accom_room||'',beds:(()=>{try{return Object.entries(JSON.parse(d?.bed_setting||'{}')).map(([k,v])=>k+': '+v).join(' / ');}catch{return d?.bed_setting||'';}})()}));setBookingReady(true);}).catch(e=>setError(e.message));},[]);
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
      <a href="/dreamhouse-rooms">← Dream House</a>
      <div className={styles.heading}><div><p>DREAM HOUSE · HOUSEKEEPING</p><h1>Check-in checklist</h1><p>Choose a checklist, fill in the details, then print. Check each item on paper.</p></div>
      <div className={styles.actions}><button disabled={!saved||loading||editing} onClick={()=>window.print()}>Print / Save PDF</button><button disabled={!saved||loading||busy} onClick={()=>{setEditing(!editing);setDraft(saved);setError('');setMessage('');}}>{editing?'Cancel editing':'Edit checklist'}</button></div></div>
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
    {saved&&!loading&&<article className={styles.sheet} id="dreamhouse-print-sheet" data-booking-ready={bookingReady?"true":"false"}>
      <header className={styles.sheetHeader}><div><p>DREAM HOUSE</p><h1>Check-in Preparation Checklist</h1></div><strong>{variant==='daon'?'DAON MOM':'STANDARD'}</strong></header>
      <div className={styles.details}>{field('guest','Guest / Reservation')}{field('date','Check-in date')}{field('house','Block and lot / House')}{field('beds','Bed setup')}{field('inspector','Checked by')}</div>
      <p className={styles.instructions}>Check that each item is clean, complete and working. Tick when ready; write N/A if not applicable. Record any issues below.</p>
      <div className={styles.columns}><div>{left.map(section)}</div><div>{right.map(section)}</div></div>
      <footer className={styles.footer}><label>Issues / Follow-up notes<textarea aria-label="Issues / Follow-up notes" rows={2} maxLength={600} value={fields.notes} onChange={e=>setFields({...fields,notes:e.target.value})}/><span className={styles.printNotes}>{fields.notes||' '}</span></label><div className={styles.signatures}><span>Final check / Signature: ____________________</span><span>Date / Time: ____________________</span></div></footer>
    </article>}
  </main>;
}
