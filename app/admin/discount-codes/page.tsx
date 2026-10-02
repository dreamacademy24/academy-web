'use client';
import {useEffect,useState} from 'react';
type Code={code:string;amount:number;active:boolean};
export default function DiscountCodes(){
 const [codes,setCodes]=useState<Code[]>([]),[code,setCode]=useState(''),[amount,setAmount]=useState('100000'),[active,setActive]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function load(){try{const r=await fetch('/api/booking-discounts',{cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error);setCodes(j.codes);}catch(e){setMessage(e instanceof Error?e.message:'목록 조회 실패');}}
 useEffect(()=>{void load();},[]);
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');try{const r=await fetch('/api/booking-discounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,amount:Number(amount),active})});const j=await r.json();if(!r.ok)throw Error(j.error);setMessage('저장했습니다.');setCode('');await load();}catch(e){setMessage(e instanceof Error?e.message:'저장 실패');}finally{setBusy(false);}}
 const input={padding:12,border:'1px solid #cbd5e1',borderRadius:8,fontSize:16};
 return <main style={{maxWidth:1000,margin:'32px auto',padding:24}}><h1 style={{fontSize:26,fontWeight:800}}>부킹 할인코드</h1><p style={{margin:'12px 0 24px',color:'#64748b'}}>대소문자 구분 없이 예약 1건당 정액 할인됩니다. 날짜·기간·인원 제한이 없습니다. 변경된 금액은 새 예약부터 적용됩니다.</p>
 <form onSubmit={save} style={{display:'flex',flexWrap:'wrap',gap:16,padding:24,background:'white',borderRadius:12}}><label>할인코드<br/><input required pattern="[A-Za-z0-9_-]{3,40}" maxLength={40} value={code} onChange={e=>setCode(e.target.value)} style={input}/></label><label>할인 금액 (원)<br/><input required type="number" min={1} max={100000000} step={1} value={amount} onChange={e=>setAmount(e.target.value)} style={input}/></label><label style={{alignSelf:'center'}}><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> 사용</label><button disabled={busy} style={{...input,background:'#4f46e5',color:'white',alignSelf:'end'}}>{busy?'저장 중…':'저장'}</button></form>
 <p role="status" style={{margin:'16px 0'}}>{message}</p><div style={{display:'grid',gap:12}}>{codes.map(c=><div key={c.code} style={{padding:20,background:'white',borderRadius:12,display:'flex',gap:20,alignItems:'center',flexWrap:'wrap'}}><strong style={{flex:1}}>{c.code}</strong><span>{c.amount.toLocaleString()}원 할인</span><span>{c.active?'사용 중':'사용 중지'}</span><button style={input} onClick={()=>{setCode(c.code);setAmount(String(c.amount));setActive(c.active);setMessage('위 입력칸에서 수정 후 저장해주세요.');}}>수정</button></div>)}</div></main>;
}

