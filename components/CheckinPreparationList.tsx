'use client';
import {useState} from 'react';
import styles from './CheckinPreparationList.module.css';

type Booking={id:string;booker_name:string;booker_english?:string;reservation_no?:string;accom_type?:string;booking_type?:string;seg1_type?:string;seg2_type?:string;house_no?:string;accom_room?:string;checkin_date:string;checkout_date:string;flight_in?:string;flight_in_airline?:string;flight_in_no?:string;flight_in_time?:string};
type View='week'|'pending'|'upcoming'|'staying'|'past';
export default function CheckinPreparationList({bookings,status,onSelect}:{bookings:Booking[];status:Record<string,{saved:boolean;submitted:boolean}>;onSelect:(id:string)=>void}){
  const [view,setView]=useState<View>('week'),[query,setQuery]=useState('');
  const [chosen,setChosen]=useState<string[]>([]);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date());
  const next=new Date(today+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+7);const weekEnd=next.toISOString().slice(0,10);
  const all=bookings.filter(b=>{
    if(b.seg1_type==='dreamhouse'||b.seg2_type==='dreamhouse')return true;
    const a=b.accom_type||'',t=b.booking_type||'';
    if(a.includes('통학')||t.includes('commute'))return false;
    if((a.includes('제이파크')||a.includes('큐브'))&&!a.includes('드림하우스'))return false;
    return /드림하우스|dream/i.test(a)||t.includes('dreamhouse')||!!(b.house_no||b.accom_room);
  });
  const matches=(b:Booking,v:View)=>{
    const ci=b.checkin_date?.slice(0,10),co=b.checkout_date?.slice(0,10);
    if(v==='week')return ci>=today&&ci<weekEnd;
    if(v==='pending')return !!ci&&(!co||co>=today)&&!status[b.id]?.saved&&!status[b.id]?.submitted;
    if(v==='upcoming')return ci>=today;
    if(v==='staying')return ci<today&&co>=today;
    return !!co&&co<today;
  };
  const labels:Record<View,string>={week:'7일 내 입실',pending:'디테일 미작성',upcoming:'입실 예정',staying:'체류 중',past:'지난 예약'};
  const descriptions:Record<View,string>={week:'오늘을 포함해 앞으로 7일 안에 입실하는 가족 목록입니다. 예약을 선택해 서류를 함께 출력하거나, 이름을 눌러 체크인 정보를 확인하세요.',pending:'아직 체크인디테일 작성·제출이 확인되지 않은 입실 예정 또는 체류 중 가족입니다. 이름이나 확인·수정을 눌러 내용을 작성하세요.',upcoming:'오늘부터 입실 예정인 가족 전체 목록입니다. 입실 날짜가 가까운 순서로 표시합니다.',staying:'오늘 이전에 입실하여 현재 체류 중인 가족 목록입니다. 안내문 전달과 실제 약 수령은 위의 안내문 전달·약 수령 탭에서 확인하세요.',past:'퇴실일이 지난 가족의 예약입니다. 기존 체크인 정보와 서류를 다시 확인할 수 있습니다.'};
  const rows=all.filter(b=>matches(b,view)&&[b.booker_name,b.booker_english,b.reservation_no,b.house_no,b.accom_room].join(' ').toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>view==='past'?b.checkin_date.localeCompare(a.checkin_date):a.checkin_date.localeCompare(b.checkin_date));
  return <section className={styles.wrap}>
    <p className={styles.intro}>입실할 가족을 확인하고 필요한 서류를 준비하세요. 작성 상태와 실제 전달·수령은 별도로 확인합니다.</p>
    <nav className={styles.tabs} aria-label="예약 상태">{(Object.keys(labels) as View[]).map(v=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{labels[v]} <b>{all.filter(b=>matches(b,v)).length}</b></button>)}</nav>
    <p aria-live="polite" style={{margin:'12px 0 16px',padding:'12px 16px',background:'#f0f5ff',borderRadius:8,color:'#405578',lineHeight:1.7}}>{descriptions[view]}</p>
    <div className={styles.tools}><h2>{labels[view]} <small>{rows.length}팀</small></h2><button disabled={!chosen.length} onClick={()=>window.open("/admin/checkin-print?bookings="+chosen.map(encodeURIComponent).join(","),"_blank","noopener,noreferrer")}>선택 {chosen.length}팀 세트 출력</button><input aria-label="예약 검색" placeholder="예약자 · 예약번호 · 룸 검색" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    <div className={styles.table}><table><thead><tr><th><input type="checkbox" aria-label="표시된 예약 전체 선택" checked={rows.length>0&&rows.every(b=>chosen.includes(b.id))} onChange={e=>setChosen(e.target.checked?[...new Set([...chosen,...rows.map(b=>b.id)])]:chosen.filter(id=>!rows.some(b=>b.id===id)))}/></th><th>예약자 / 숙소</th><th>입실 → 퇴실</th><th>입국편</th><th>디테일</th><th>서류 준비</th></tr></thead><tbody>{rows.map(b=><tr key={b.id}>
      <td><input type="checkbox" aria-label={b.booker_name+" 출력 선택"} checked={chosen.includes(b.id)} onChange={e=>setChosen(e.target.checked?[...chosen,b.id]:chosen.filter(id=>id!==b.id))}/></td><td><button className={styles.name} onClick={()=>onSelect(b.id)}>{b.booker_name}</button><small>{b.house_no||b.accom_room||'룸 미배정'} · {b.accom_type||'숙소 확인 필요'}</small></td>
      <td>{b.checkin_date?.slice(0,10)}<small>→ {b.checkout_date?.slice(0,10)}</small></td>
      <td>{[b.flight_in_airline,b.flight_in_no].filter(Boolean).join(' ')||b.flight_in||'미입력'}<small>{b.flight_in_time}</small></td>
      <td><span className={status[b.id]?.saved||status[b.id]?.submitted?styles.done:styles.pending}>{status[b.id]?.saved?'작성완료':status[b.id]?.submitted?'손님 제출됨':'미작성'}</span></td>
      <td><button onClick={()=>onSelect(b.id)}>확인·수정</button><a href={'/dreamhouse-checklist?bookingId='+encodeURIComponent(b.id)} target="_blank" rel="noopener noreferrer">체크리스트 ↗</a><a href={'/admin/med-form?bookingId='+encodeURIComponent(b.id)} target="_blank" rel="noopener noreferrer">상비약 안내서 ↗</a><a href={'/admin/checkin-card?bookingId='+encodeURIComponent(b.id)} target="_blank" rel="noopener noreferrer">공항픽업피켓 ↗</a></td>
    </tr>)}</tbody></table></div>{!rows.length&&<p className={styles.empty}>해당하는 예약이 없습니다. 다른 상태나 검색어를 선택해주세요.</p>}
  </section>;
}
