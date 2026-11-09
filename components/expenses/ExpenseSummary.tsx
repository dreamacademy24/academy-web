'use client';

import {useEffect,useState} from 'react';

type Report={totals:{revenue_php_cents:number;expense_php_cents:number;profit_php_cents:number};classified_approved_php_cents:number;legacy_unattributed_php_cents:number;units:Record<string,number>;categories:Record<string,number>;houses:{by_house:Record<string,number>;common_php_cents:number;multiple_unallocated_php_cents:number;unconfirmed_php_cents:number}};
type Response={from:string;to:string;report:Report};
const labels:Record<string,string>={academy:'아카데미',dreamhouse:'드림하우스',shared:'공통·미배분'};
const php=(cents:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(cents/100);
function manilaMonth(){const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),value=(type:string)=>parts.find(p=>p.type===type)?.value||'';const now=value('year')+'-'+value('month')+'-'+value('day');return{from:now.slice(0,7)+'-01',to:now};}
function Rows({rows}:{rows:[string,number][]}){return <ul style={{margin:'6px 0',paddingLeft:20}}>{rows.filter(([,v])=>v!==0).map(([k,v])=><li key={k}>{labels[k]||k}: <b>{php(v)}</b></li>)||null}</ul>}
export default function ExpenseSummary(){
 const initial=manilaMonth(),[from,setFrom]=useState(initial.from),[to,setTo]=useState(initial.to),[data,setData]=useState<Response|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');try{const response=await fetch('/api/expenses/report?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to),{cache:'no-store'});const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.error||'요약을 불러오지 못했습니다.');setData(body);}catch(e){setData(null);setError(e instanceof Error?e.message:'요약을 불러오지 못했습니다.');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 return <main style={{maxWidth:900,margin:'24px auto',padding:16,fontFamily:'system-ui'}}>
  <h1>지출 요약 <small style={{fontSize:14,fontWeight:'normal'}}>대표 전용</small></h1>
  <p>회사 원장을 기준으로 한 통합 손익입니다. 하우스별 세부 내역은 승인·분류된 비용만 보여주며, 과거 전체 하우스 손익을 추정하지 않습니다.</p>
  <form onSubmit={e=>{e.preventDefault();load();}} style={{display:'flex',gap:8,alignItems:'end',flexWrap:'wrap'}}><label>시작일<input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label><label>종료일<input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label><button disabled={loading}>{loading?'불러오는 중…':'조회'}</button></form>
  {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
  {data&&<section aria-live="polite"><h2>{data.from} ~ {data.to}</h2><div style={{display:'flex',gap:18,flexWrap:'wrap'}}><p>매출 <b>{php(data.report.totals.revenue_php_cents)}</b></p><p>비용 <b>{php(data.report.totals.expense_php_cents)}</b></p><p>이익 <b>{php(data.report.totals.profit_php_cents)}</b></p></div><h2>승인·분류 비용</h2><Rows rows={Object.entries(data.report.units)}/><h3>카테고리</h3><Rows rows={Object.entries(data.report.categories)}/><h2>드림하우스 분류 비용</h2><Rows rows={Object.entries(data.report.houses.by_house)}/><Rows rows={[["공통",data.report.houses.common_php_cents],["다중 하우스·배분 미확정",data.report.houses.multiple_unallocated_php_cents],["하우스 미확정",data.report.houses.unconfirmed_php_cents]]}/><p><b>기존 미분류 원장 잔액: {php(data.report.legacy_unattributed_php_cents)}</b><br/>이 금액은 과거 원장 비용 중 승인 claim으로 분류되지 않은 부분이며, 아카데미나 특정 하우스에 임의 배분하지 않습니다.</p></section>}
 </main>;
}
