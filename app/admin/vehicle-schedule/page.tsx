"use client";
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { isAdminAuthed } from '@/lib/adminAuth';
import { useRouter } from 'next/navigation';
import { aggregate, commuteMovements, pickupMovements, type VehMovement, type FtResolver } from '@/lib/vehicleSchedule';
import { buildScheduleByMd, mergeWithFallback, resolveProgram, type DeployedScheduleItem } from '@/lib/fieldtripPrograms';
import { checkinMovements, mergeMovement, movementTime, needsDispatch, vehicleCategory, type VehicleTab } from '@/lib/vehicleView';
import './vehicle.css';

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());
const shift=(date:string,days:number)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const dateLabel=(date:string)=>date?new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Manila'}).format(new Date(date+'T00:00:00Z')):'날짜 미정';
const tabs:{key:VehicleTab;label:string}[]=[{key:'all',label:'전체'},{key:'shuttle',label:'셔틀'},{key:'airport',label:'공항 픽업·드랍'},{key:'student',label:'학생 픽업·드랍'},{key:'extra',label:'추가 픽업·드랍'}];
const label=(m:VehMovement)=>m.kind==='commute'?(m.commuteDetails?.period==='am'?'학생 픽업':'학생 드랍'):({pickup:'공항 픽업',dropoff:'공항 드랍',transfer:'숙소 이동',extra:'추가 픽드랍',shuttle:'셔틀',afterschool:'애프터스쿨',fieldtrip:'필드트립'}[m.kind]||'차량');
type Override={driver_id?:string|null;time?:string;note?:string};
type DayState={overrides?:Record<string,Override>;manual?:VehMovement[];confirmed?:boolean|Record<string,boolean>};
type Driver={id:string;name:string};
const sourceOf=(m:VehMovement)=>m.source==='pickup_requests'?{name:'픽드랍 신청',url:'/admin/pickups'}:m.source==='checkin_details'?{name:'체크인 디테일 · 추가 픽드랍',url:`/admin/checkin-details?bookingId=${m.booking_id}`} :m.source==='bookings'?{name:'예약 · 항공 정보',url:'/admin/bookings/'+m.id.replace(/^bk_(in|out|tr)_/,'')}:m.source==='pickup_schedules'?{name:'현지 직원 통학표',url:'/admin/view?src=%2Fashuttle'}:m.source==='shuttle_applications'?{name:'셔틀 신청',url:'/admin/tour-shuttle'}:m.source==='fieldtrip_applications'?{name:'체험활동 신청',url:'/admin/afterschool-fieldtrip'}:{name:'직접 등록',url:''};

export default function VehicleSchedulePage(){
 const router=useRouter();
 const [authed,setAuthed]=useState(false),[date,setDate]=useState(today),[tab,setTab]=useState<VehicleTab>('all');
 const [pending,setPending]=useState(false),[query,setQuery]=useState(''),[expanded,setExpanded]=useState<string|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [drivers,setDrivers]=useState<Driver[]>([]),[dayMoves,setDayMoves]=useState<VehMovement[]>([]),[requests,setRequests]=useState<VehMovement[]>([]);
 const [states,setStates]=useState<Record<string,DayState>>({});
 const [editor,setEditor]=useState<VehMovement|null>(null),[saving,setSaving]=useState(false),[sources,setSources]=useState(false);
 useEffect(()=>{if(!isAdminAuthed()){router.replace('/login');return;}setAuthed(true);},[router]);
 const load=useCallback(async(signal?:AbortSignal)=>{
  if(!authed)return;
  setLoading(true);setError('');
  try{
   const response=await fetch(`/api/admin/vehicle-schedule?from=${date}&to=${date}`,{cache:'no-store',signal});
   const j=await response.json();if(!response.ok)throw new Error(j.error||'일정을 불러오지 못했습니다.');
   const byMd=buildScheduleByMd(mergeWithFallback((j.scheduleItems||[]) as DeployedScheduleItem[]));
   const resolver:FtResolver={resolve:token=>{const p=resolveProgram(token,byMd);if(!p)return null;return {date:`${date.slice(0,4)}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`,isFieldtrip:p.isFieldtrip,name:p.name};}};
   const extras=checkinMovements(j.checkinExtras||[]);
   const agg=aggregate({pickups:j.pickups||[],bookings:j.bookings||[],shuttles:j.shuttles||[],fieldtrips:j.fieldtrips||[],ftResolver:resolver,manual:[...commuteMovements(j.commutes||[]),...extras]},[date]);
   if(signal?.aborted)return;
   setDrivers(j.drivers||[]);setStates(j.overrides||{});setDayMoves(agg.days[0]?.movements||[]);
   setRequests([...pickupMovements(j.pickups||[]),...extras]);
  }catch(e){if(signal?.aborted)return;setError((e as Error).message);}
  finally{if(!signal?.aborted)setLoading(false);}
 },[authed,date]);
 useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
 const merge=useCallback((m:VehMovement)=>mergeMovement(m,states[m.date]?.overrides?.[m.id]),[states]);
 const pendingRows=useMemo(()=>requests.map(merge).filter(needsDispatch),[requests,merge]);
 const rows=useMemo(()=>{
  const items=pending?pendingRows:[...dayMoves.map(merge),...(states[date]?.manual||[]).map(merge)];
  return items.filter(m=>(tab==='all'||vehicleCategory(m)===tab)&&(!query||[m.guest,m.location,m.destination,m.flight_info,m.driver_name,drivers.find(d=>d.id===m.driver_id)?.name].join(' ').toLowerCase().includes(query.toLowerCase())))
    .sort((a,b)=>(pending?(Number(!!a.date&&a.date<today())-Number(!!b.date&&b.date<today())||(a.date||'0000').localeCompare(b.date||'0000')):0)||a.sortTime.localeCompare(b.sortTime)||a.id.localeCompare(b.id));
 },[pending,pendingRows,dayMoves,merge,states,date,tab,query,drivers]);
 const openEditor=(m:VehMovement)=>{setMessage('');setEditor({...m});};
 const closeEditor=()=>{if(saving)return;if(window.confirm('입력한 변경을 저장하지 않고 닫을까요?'))setEditor(null);};
 useEffect(()=>{if(!editor)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[editor]);
 const save=async()=>{
  if(!editor?.date)return;
  setSaving(true);setMessage('');
  try{
   const st={...(states[editor.date]||{})};
   st.overrides={...st.overrides,[editor.id]:{driver_id:editor.driver_id||null,time:editor.time,note:editor.note||''}};
   const response=await fetch('/api/admin/vehicle-schedule',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:editor.date,state:st,onlyId:editor.id})});
   const j=await response.json();if(!response.ok)throw new Error(j.error||'저장 실패');
   setStates(prev=>({...prev,[editor.date]:j.state}));setEditor(null);setMessage('배정 내용이 저장되었습니다.');
   await load();
  }catch(e){setMessage((e as Error).message);}finally{setSaving(false);}
 };
 if(!authed)return null;
 return <main className="vehicle-page">
  <header className="vehicle-heading"><div><span className="vehicle-brand">DREAM WORKSPACE</span><h1>차량 스케줄</h1><p>흩어진 운행 일정을 한눈에 확인하세요.</p></div><div className="vehicle-actions"><button onClick={()=>setSources(!sources)} aria-expanded={sources}>원본 일정 안내</button><button disabled={loading} onClick={()=>void load()}>새로고침</button><button onClick={()=>window.print()}>인쇄</button></div></header>
  {sources&&<aside className="vehicle-source-guide"><b>원본과 연결된 일정입니다.</b><p>공항·추가 픽드랍 신청, 체크인 디테일의 추가 픽드랍, 예약 항공 정보, 셔틀 신청, 현지 직원 통학표, 체험활동 신청을 가져옵니다. 각 행을 펼치면 원본으로 이동할 수 있습니다.</p><p>배차 필요는 전체 날짜의 픽드랍 신청과 체크인 추가 픽드랍 중 날짜·시간·기사가 부족한 건입니다. 과거 기록은 실제 누락을 뜻하지 않으므로 원본과 대조해주세요. 예약 기반 항공 일정은 신청이 아닌 초안으로 구분합니다.</p><p>픽드랍 신청의 시간·기사 변경은 원본 신청에도 저장됩니다. 통학 명단은 현지 직원 원본에서 수정합니다. 배정 저장은 기사에게 메시지를 발송하지 않습니다.</p></aside>}
  <section className="vehicle-datebar"><button aria-label="이전 날" disabled={loading} onClick={()=>{setDate(shift(date,-1));setPending(false);}}>〈 이전 날</button><div><h2>{dateLabel(date)}</h2><input aria-label="운행 날짜" type="date" value={date} onChange={e=>{if(e.target.value){setDate(e.target.value);setPending(false);}}}/><button onClick={()=>{setDate(today());setPending(false);}}>오늘</button></div><button aria-label="다음 날" disabled={loading} onClick={()=>{setDate(shift(date,1));setPending(false);}}>다음 날 〉</button></section>
  <div className="vehicle-toolbar"><nav aria-label="일정 종류">{tabs.map(t=><button key={t.key} className={tab===t.key?'active':''} aria-pressed={tab===t.key} onClick={()=>setTab(t.key)}>{t.label}</button>)}</nav><button className={`vehicle-pending ${pending?'active':''}`} aria-pressed={pending} disabled={loading||!!error} onClick={()=>{setPending(!pending);setTab('all');setQuery('');}}>배차 필요 <b>{loading||error?'—':pendingRows.length}건</b></button></div>
  <div className="vehicle-listbar"><span>{pending?'전체 날짜 · 배차가 필요한 신청':`${rows.length}건 · 필리핀 현지 시간`}{pending&&<button onClick={()=>setPending(false)}>선택한 날짜로 돌아가기 ×</button>}</span><input aria-label="일정 검색" placeholder="이름 · 숙소 · 기사 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  {pending&&<p className="vehicle-pending-help">날짜와 관계없이 미배정 신청을 확인합니다. 지난 일정은 원본의 처리 상태를 먼저 확인해주세요.</p>}
  {message&&!editor&&<p className="vehicle-message" role="status">{message}</p>}
  {error?<div className="vehicle-empty" role="alert">{error}<button onClick={()=>void load()}>다시 불러오기</button></div>:loading?<div className="vehicle-empty" role="status">일정을 불러오고 있습니다…</div>:<div className="vehicle-table-wrap"><table className="vehicle-table"><thead><tr><th>구분</th><th>{pending?'운행일 / 시간':'시간'}</th><th>운행 내용</th><th>탑승</th><th>기사</th><th><span className="vehicle-sr">상세 보기</span></th></tr></thead><tbody>
   {rows.map(m=>{const source=sourceOf(m),isOpen=expanded===m.id,board=m.commuteDetails,needed=needsDispatch(m),driver=m.driver_name||drivers.find(d=>d.id===m.driver_id)?.name||(m.driver_id?'기존 배정 기사':'미배정');return <Fragment key={m.id}><tr className={isOpen?'expanded':''}>
    <td><span className={`vehicle-badge ${vehicleCategory(m)}`}>{label(m)}</span>{m.auto&&<small className="vehicle-muted">예약 기반 초안</small>}</td>
    <td>{pending&&<small className="vehicle-date-label">{m.date||'날짜 미정'}</small>}<strong>{movementTime(m)}</strong>{m.sortTime==='99:99'&&m.time&&<small className="vehicle-alert">시간 확인 필요</small>}{pending&&m.date&&m.date<today()&&<small className="vehicle-alert">지난 일정 확인 필요</small>}</td>
    <td><button className="vehicle-route-button" onClick={()=>setExpanded(isOpen?null:m.id)} aria-expanded={isOpen} aria-controls={`details-${m.id}`}>{board?<>{board.teacher||'통학 운행'}<small>{m.location}</small></>:<>{m.location||'출발지 확인'} <span className="vehicle-arrow">→</span> {m.destination||'도착지 확인'}<small>{m.guest}</small></>}</button>{m.flight_info&&<small className="vehicle-muted">{m.flight_info}</small>}{m.source==='checkin_details'&&<small className="vehicle-muted">체크인 추가 신청 · 원본 대조 필요</small>}</td>
    <td className="vehicle-people">{m.num_people?`${m.num_people}명`:'인원 확인'}</td><td><strong className={!m.driver_id&&!m.driver_name?'vehicle-alert':''}>{driver}</strong>{needed&&<small className="vehicle-alert">{m.auto?'운행 확인 필요':'배차 필요'}</small>}</td>
    <td><button className="vehicle-expand" aria-label={`${m.guest} ${label(m)} 상세 보기`} aria-expanded={isOpen} onClick={()=>setExpanded(isOpen?null:m.id)}>{isOpen?'⌃':'⌄'}</button></td>
   </tr>{isOpen&&<tr className="vehicle-detail-row" id={`details-${m.id}`}><td colSpan={6}><div className="vehicle-detail">
    <div>{board?<><b>탑승 명단</b><ul>{board.cards.map((card,i)=><li key={i}><strong>{card.addr}</strong> ({card.count||'0'}) {card.names}</li>)}</ul>{!!board.absent?.length&&<p className="vehicle-alert">결석·미탑승 메모: {board.absent.join(' · ')}</p>}</>:<><b>{m.guest}</b><p>{m.note||'등록된 운행 메모가 없습니다.'}</p></>}{m.auto&&<p>항공 정보로 만든 초안입니다. 실제 차량 시간과 운행 여부를 확인해주세요.</p>}</div>
    <div className="vehicle-detail-actions">{source.url&&<a href={source.url} target="_blank" rel="noreferrer">{source.name} · 원본 보기 ↗</a>}{m.date&&<button className="primary" onClick={()=>openEditor(m)}>{needed?'시간·기사 배정':'배정 수정'}</button>}{!m.date&&<span className="vehicle-alert">원본에서 운행 날짜를 입력해주세요.</span>}</div>
   </div></td></tr>}</Fragment>;})}
   {!rows.length&&<tr><td colSpan={6} className="vehicle-empty">{pending?'조건에 맞는 배차 필요 신청이 없습니다.':'선택한 날짜에 표시할 일정이 없습니다.'}</td></tr>}
  </tbody></table></div>}
  <p className="vehicle-footnote">학생 픽업·드랍은 현지 직원이 저장한 통학표 기준입니다. 픽업·드랍 구분은 오전·오후를 의미하지 않습니다.</p>
  {editor&&<div className="vehicle-modal-backdrop"><section className="vehicle-modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-edit-title"><h2 id="vehicle-edit-title">시간·기사 배정</h2><p>{editor.date} · {editor.guest}<br/>{editor.location} → {editor.destination||'원본 경유지 확인'}</p><label>차량 출발 시간 <input autoFocus placeholder="예: 14:30 또는 14:30–14:40" value={editor.time} disabled={saving} onChange={e=>setEditor({...editor,time:e.target.value})}/></label><small>24시간제로 입력해주세요. 항공편 시간과 구분합니다.</small>{editor.source==='pickup_schedules'?<p>담당 기사: {editor.driver_name} · 변경은 원본 통학표에서 해주세요.</p>:<label>담당 기사 <select value={editor.driver_id||''} disabled={saving} onChange={e=>setEditor({...editor,driver_id:e.target.value||null})}><option value="">미배정</option>{editor.driver_id&&!drivers.some(d=>d.id===editor.driver_id)&&<option value={editor.driver_id}>기존 배정 기사</option>}{drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}<label>운행 메모 <textarea value={editor.note||''} disabled={saving} onChange={e=>setEditor({...editor,note:e.target.value})}/></label>{message&&<p role="alert">{message}</p>}<footer><button disabled={saving} onClick={closeEditor}>취소</button><button className="primary" disabled={saving} onClick={()=>void save()}>{saving?'저장 중…':'저장'}</button></footer></section></div>}
 </main>;
}

