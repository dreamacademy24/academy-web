"use client";
import {useCallback,useEffect,useState} from 'react';
type Account = {id:string;name:string;username:string};
type Tutor = {id:string;name:string;is_active:boolean;staff_account_id:string|null};
export default function TutorAccountImport({english=false}:{english?:boolean}) {
  const [open,setOpen]=useState(false),[accounts,setAccounts]=useState<Account[]>([]),[tutors,setTutors]=useState<Tutor[]>([]);
  const [selected,setSelected]=useState(''),[target,setTarget]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=useCallback(async()=>{
    setLoading(true);
    try {const r=await fetch('/api/admin/tutor/accounts',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error);setAccounts(d.accounts);setTutors(d.tutors);setError('');}
    catch(e){setError(e instanceof Error?e.message:'Could not load accounts');}finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('focus',refresh);const timer=setInterval(refresh,30000);return()=>{window.removeEventListener('focus',refresh);clearInterval(timer);};},[load]);
  async function save(){
    if(!selected||busy)return;setBusy(true);setError('');
    try {const r=await fetch('/api/admin/tutor/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account_id:selected,tutor_id:target||null})}),d=await r.json();if(!r.ok)throw Error(d.error);window.location.reload();}
    catch(e){setError(e instanceof Error?e.message:'Could not import');setBusy(false);}
  }
  const label=english?'Import tutor from account':'계정에서 튜터 가져오기';
  return <section style={{margin:'12px 0',padding:12,background:'#fff',border:'1px solid #cbd5e1',borderRadius:10}}>
    <button type="button" onClick={()=>{setOpen(!open);if(!open)void load();}} aria-expanded={open}>{label}{!loading&&!error?` (${accounts.length})`:''}</button>
    {open&&<div style={{display:'grid',gap:10,marginTop:12}}>
      <p>{english?'New active teacher accounts appear automatically. Select an existing tutor for the same person, or add a new tutor.':'새로 만든 활성 교사 계정이 자동으로 표시됩니다. 같은 선생님이 이미 있으면 기존 튜터를 선택하고, 없으면 신규 등록하세요.'}</p>
      <label>{english?'Teacher account':'교사 계정'} <select aria-label={english?'Teacher account':'교사 계정'} value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);setTarget('');}}><option value="">{english?'Select an account':'계정 선택'}</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.username})</option>)}</select></label>
      <label>{english?'Existing tutor or new':'기존 튜터 연결 또는 신규 등록'} <select aria-label={english?'Existing tutor or new':'기존 튜터 연결 또는 신규 등록'} value={target} disabled={busy} onChange={e=>setTarget(e.target.value)}><option value="">{english?'Add new (same name will be linked)':'신규 등록 (동일 이름이 있으면 연결)'}</option>{tutors.filter(t=>!t.staff_account_id&&t.is_active).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <p>{english?'Existing rates and lessons are preserved. Inactive tutors must be reviewed in tutor management.':'기존 수업과 수업료는 유지됩니다. 비활성 튜터는 튜터 관리에서 상태를 먼저 확인해주세요.'}</p>
      {loading&&<p role="status">{english?'Loading…':'불러오는 중…'}</p>}{error&&<p role="alert">{error}</p>}
      <div><button type="button" disabled={!selected||busy||loading} onClick={save}>{busy?(english?'Saving…':'저장 중…'):(english?'Import selected tutor':'선택한 튜터 가져오기')}</button> <button type="button" disabled={busy||loading} onClick={load}>{english?'Refresh accounts':'계정 새로고침'}</button></div>
    </div>}
  </section>;
}
