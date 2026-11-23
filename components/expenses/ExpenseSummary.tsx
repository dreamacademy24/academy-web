'use client';

import {useEffect,useState} from 'react';
import {getCategory} from '../../lib/expenses/catalogue';

type Report={totals:{revenue_php_cents:number;expense_php_cents:number;profit_php_cents:number};classified_approved_php_cents:number;legacy_unattributed_php_cents:number;units:Record<string,number>;categories:Record<string,number>;houses:{by_house:Record<string,number>;common_php_cents:number;multiple_unallocated_php_cents:number;unconfirmed_php_cents:number}};
type Response={from:string;to:string;report:Report};
const labels:Record<string,string>={academy:'아카데미',dreamhouse:'드림하우스',shared:'공통·미배분'};
const php=(cents:number)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(cents/100);
function manilaMonth(){const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),value=(type:string)=>parts.find(p=>p.type===type)?.value||'';const now=value('year')+'-'+value('month')+'-'+value('day');return{from:now.slice(0,7)+'-01',to:now};}
function Rows({rows}:{rows:[string,number][]}){const visible=rows.filter(([,v])=>v!==0);return visible.length?<ul className="er-breakdown">{visible.map(([k,v])=><li key={k}><span>{labels[k]||getCategory(k)?.labelKo||k}</span><b>{php(v)}</b></li>)}</ul>:<p className="er-no-data">이 기간에 분류된 비용이 없습니다.</p>}
export default function ExpenseSummary(){
 const initial=manilaMonth(),[from,setFrom]=useState(initial.from),[to,setTo]=useState(initial.to),[data,setData]=useState<Response|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');try{const response=await fetch('/api/expenses/report?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to),{cache:'no-store'});const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.error||'요약을 불러오지 못했습니다.');setData(body);}catch(e){setData(null);setError(e instanceof Error?e.message:'요약을 불러오지 못했습니다.');}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 return <section className="er-summary" aria-label="지출 요약">
 <div className="er-panel er-period"><div><h2>수입·지출 요약</h2><p>회사 원장 기준 · 필리핀 페소 (PHP)</p></div><form onSubmit={e=>{e.preventDefault();load();}}><label>시작일<input type="date" required value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><span className="er-date-separator">—</span><label>종료일<input type="date" required value={to} min={from} onChange={e=>setTo(e.target.value)}/></label><button className="er-primary" disabled={loading}>{loading?'조회 중…':'조회'}</button></form></div>
 {error&&<p className="er-error" role="alert">{error}</p>}
 {data&&<div aria-live="polite"><p className="er-period-caption">조회 기간 {data.from} ~ {data.to}</p><div className="er-metrics">{[['매출',data.report.totals.revenue_php_cents,'원장에 기록된 매출'],['비용',data.report.totals.expense_php_cents,'원장에 기록된 비용'],['이익',data.report.totals.profit_php_cents,'매출 − 비용']].map(([label,value,description],i)=><article className={'er-metric er-metric-'+i} key={String(label)}><span>{label}</span><strong>{php(Number(value))}</strong><small>{description}</small></article>)}</div>
 <div className="er-detail-grid"><section className="er-panel"><h2>사업장별 비용</h2><p className="er-caption">승인 및 분류가 완료된 내역</p><Rows rows={Object.entries(data.report.units)}/><details className="er-category"><summary>카테고리별 자세히 보기</summary><Rows rows={Object.entries(data.report.categories)}/></details></section><section className="er-panel"><h2>드림하우스 비용</h2><p className="er-caption">하우스가 지정된 승인 내역</p><Rows rows={Object.entries(data.report.houses.by_house)}/><Rows rows={[["공통",data.report.houses.common_php_cents],["복수 하우스 · 배분 대기",data.report.houses.multiple_unallocated_php_cents],["하우스 확인 대기",data.report.houses.unconfirmed_php_cents]]}/></section></div>
 <div className="er-unclassified"><div><strong>기존 원장 미분류 비용</strong><p>사업장·하우스별 비용에 아직 배분되지 않은 금액입니다.</p></div><b>{php(data.report.legacy_unattributed_php_cents)}</b></div></div>}
 </section>;
}
