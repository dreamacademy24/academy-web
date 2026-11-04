'use client';
import {useEffect,useState} from 'react';
type Row={id:string;student_name:string;tutor_id:string|null;tutor:{name_display:string}|null;days_of_week:string[];class_time_kr:string;day_times:Record<string,string>|null;start_date:string;total_sessions:number;pre_sessions:number;post_sessions:number};
export default function OnlineApplicationInbox({onApproved}:{onApproved?:(id:string)=>void}){
 const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState('');
 async function load(){try{const r=await fetch('/api/online-class/applications',{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error);setRows(d.applications);setError('');}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{void load();const refresh=()=>void load();window.addEventListener('focus',refresh);const timer=setInterval(refresh,30000);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 async function approve(row:Row){if(!window.confirm(row.student_name+' · '+row.tutor?.name_display+' 선생님 배정을 승인할까요?'))return;setBusy(row.id);try{const r=await fetch('/api/online-class/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:row.id,on:true,expectedTutorId:row.tutor_id})});const d=await r.json();if(!r.ok)throw Error(d.error);onApproved?.(row.id);await load();window.dispatchEvent(new Event('focus'));}catch(e){setError((e as Error).message);}finally{setBusy('');}}
 return <section style={{padding:24,background:'#fff',border:'1px solid #dce3ef',borderRadius:16,marginBottom:24}}>
 <div style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><h2 style={{margin:0}}>엄마 앱 화상영어 신청 · 배정/승인</h2><button onClick={load}>새로고침</button></div>
 <p>신청 접수 → 현지직원 선생님 배정 → 한국 담당자 승인</p>
 <p>배정 대기 {rows.filter(r=>!r.tutor_id).length}건 · 승인 대기 {rows.filter(r=>r.tutor_id).length}건</p>
 {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}{loading?<p>불러오는 중…</p>:!error&&!rows.length?<p>확인할 패키지 화상영어 신청이 없습니다.</p>:null}
 {rows.map(row=><article key={row.id} style={{border:'1px solid #dce3ef',borderRadius:12,padding:18,marginTop:12}}>
 <strong>{row.student_name}</strong> · {row.tutor_id?'승인 대기':'현지 배정 대기'}
 <p>신청 시작일 {row.start_date} · {(row.days_of_week||[]).map(d=>d+' '+(row.day_times?.[d]||row.class_time_kr||'시간 미정')).join(' / ')} (한국시간)</p>
 <p>총 {row.total_sessions}회 · 연수 전 {row.pre_sessions}회 / 연수 후 {row.post_sessions}회</p>
 <p>선생님: {row.tutor?.name_display||'현지직원 배정 전'}</p>
 <div style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}><a href={'/admin/online-class/'+row.id}>신청 상세·전체 일정 보기 →</a><button disabled={!row.tutor_id||!!busy} onClick={()=>approve(row)}>{busy===row.id?'저장 중…':row.tutor_id?'배정 승인':'배정 후 승인 가능'}</button></div>
 </article>)}
 </section>;
}
