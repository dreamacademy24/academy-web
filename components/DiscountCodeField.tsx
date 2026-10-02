'use client';
import { useRef, useState } from 'react';
export default function DiscountCodeField({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const [message,setMessage]=useState('');
  const [valid,setValid]=useState(false);
  const sequence=useRef(0);
  async function check(){
    const current=++sequence.current;
    if(!value.trim()){setMessage('');return;}
    setMessage('확인 중…');setValid(false);
    try {
      const response=await fetch('/api/booking-discounts?code='+encodeURIComponent(value.trim()),{cache:'no-store'});
      const data=await response.json();
      if(current!==sequence.current)return;
      setValid(response.ok);
      setMessage(response.ok?`인보이스에서 ${Number(data.amount).toLocaleString('ko-KR')}원 할인됩니다.`:data.error);
    } catch {if(current===sequence.current)setMessage('코드를 확인하지 못했습니다. 다시 입력해주세요.');}
  }
  return <div style={{marginTop:16,padding:16,background:'#fff',border:'1px solid #d1d5db',borderRadius:10}}>
    <label htmlFor="booking-discount-code" style={{display:'block',fontWeight:700,marginBottom:8}}>할인코드 <span style={{fontWeight:400,color:'#64748b'}}>(선택)</span></label>
    <input id="booking-discount-code" value={value} maxLength={40} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="할인코드를 입력해주세요" onBlur={check} onChange={e=>{sequence.current++;onChange(e.target.value);setMessage('');}} style={{width:'100%',boxSizing:'border-box',padding:'12px',fontSize:16,border:'1px solid #cbd5e1',borderRadius:8}} />
    {message&&<p role="status" style={{margin:'8px 0 0',fontSize:13,color:valid?'#15803d':'#b45309'}}>{message}</p>}
  </div>;
}

