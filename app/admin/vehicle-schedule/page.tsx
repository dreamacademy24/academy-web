"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import './vehicle.css';
import CommuteBoard from './CommuteBoard';
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";
import {
  aggregate, weekDates, to24h, commuteMovements,
  type VehMovement, type FtResolver, type AggregateResult,
} from "@/lib/vehicleSchedule";
import {
  buildScheduleByMd, mergeWithFallback, resolveProgram,
  type DeployedScheduleItem,
} from "@/lib/fieldtripPrograms";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const KIND: Record<string, { emoji: string; bg: string; color: string; label: string }> = {
  pickup:      { emoji: "🛬", bg: "#dbeafe", color: "#1e40af", label: "공항픽업" },
  dropoff:     { emoji: "🛫", bg: "#dcfce7", color: "#166534", label: "공항드랍" },
  transfer:    { emoji: "🔄", bg: "#fae8ff", color: "#86198f", label: "환승" },
  extra:       { emoji: "🚐", bg: "#ede9fe", color: "#6d28d9", label: "추가픽드랍" },
  shuttle:     { emoji: "🚌", bg: "#fef3c7", color: "#92400e", label: "투어셔틀" },
  afterschool: { emoji: "🎒", bg: "#ffedd5", color: "#9a3412", label: "애프터스쿨" },
  fieldtrip:   { emoji: "🧭", bg: "#cffafe", color: "#155e75", label: "필드트립" },
  commute:     { emoji: "🏠", bg: "#f1f5f9", color: "#334155", label: "통학·기타 셔틀표" },
};

function fDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()} (${DAYS[dt.getDay()]})`;
}

// 탭(카테고리) — 담당이 달라서 항목별로 분리
type Cat = "academy" | "shuttle" | "airport";
const TABS: { key: "all" | Cat; label: string; sub?: string }[] = [
  { key: "all", label: "전체", sub: "놓친 차량 확인" },
  { key: "academy", label: "🎒 아카데미 스케줄", sub: "애프터스쿨·필드트립 (현지직원)" },
  { key: "shuttle", label: "🚌 투어셔틀" },
  { key: "airport", label: "🛬 공항 픽드랍" },
];
const CAT_OF: Record<string, Cat> = {
  afterschool: "academy", fieldtrip: "academy", commute: "academy",
  shuttle: "shuttle",
  pickup: "airport", dropoff: "airport", transfer: "airport", extra: "airport",
};

interface Driver { id: string; name: string }
type Confirmed = boolean | { academy?: boolean; shuttle?: boolean; airport?: boolean };
type DayState = {
  confirmed?: Confirmed;
  overrides?: Record<string, { driver_id?: string | null; time?: string; note?: string }>;
  manual?: VehMovement[];
  updated_by?: string;
  updated_at?: string;
};
function isConfirmed(c: Confirmed | undefined, cat: Cat): boolean {
  if (!c) return false;
  if (c === true) return true;
  return typeof c === "object" ? !!c[cat] : false;
}

export default function VehicleSchedulePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [base, setBase] = useState(new Date());
  const [weeks, setWeeks] = useState(1);          // 기본 1주, 2~3주 미리보기
  const [tab, setTab] = useState<"all" | Cat>("all");
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [result, setResult] = useState<AggregateResult | null>(null);
  const [states, setStates] = useState<Record<string, DayState>>({}); // date → 수동수정/전달 상태
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [selectedDate,setSelectedDate]=useState(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date()));
  const [dirty,setDirty]=useState<Record<string,boolean>>({});
  const [sources,setSources]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{const fn=(e:BeforeUnloadEvent)=>{if(Object.values(dirty).some(Boolean)){e.preventDefault();}};window.addEventListener('beforeunload',fn);return()=>window.removeEventListener('beforeunload',fn);},[dirty]);

  useEffect(() => {
    if (!isAdminAuthed()) { router.replace("/login"); return; }
    setAuthed(true);
  }, [router]);

  const dates = useMemo(() => weekDates(base, weeks), [base, weeks]);
  const from = dates[0], to = dates[dates.length - 1];

  const load = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`/api/admin/vehicle-schedule?from=${from}&to=${to}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "load failed");
      setDrivers(j.drivers || []);
      setStates(j.overrides || {});

      // 애프터스쿨/필드트립 토큰 해석기 (배포 일정 우선 + 하드코딩 폴백)
      const byMd = buildScheduleByMd(mergeWithFallback((j.scheduleItems || []) as DeployedScheduleItem[]));
      const yFrom = Number(from.slice(0, 4)), yTo = Number(to.slice(0, 4));
      const resolver: FtResolver = {
        resolve: (token: string) => {
          const p = resolveProgram(token, byMd);
          if (!p) return null;
          // "월-일" → 조회 기간에 맞는 연도 선택
          const mkd = (y: number) => `${y}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
          let date = mkd(yFrom);
          if (!(date >= from && date <= to) && yTo !== yFrom) { const d2 = mkd(yTo); if (d2 >= from && d2 <= to) date = d2; }
          return { date, isFieldtrip: p.isFieldtrip, name: p.name };
        },
      };

      const agg = aggregate(
        { pickups: j.pickups || [], bookings: j.bookings || [], shuttles: j.shuttles || [], fieldtrips: j.fieldtrips || [], ftResolver: resolver, manual: commuteMovements(j.commutes || []) },
        dates
      );
      setResult(agg);
    } catch (e) {
      setResult(null);
      setError("불러오기 실패: " + (e as Error).message);
    } finally { setLoading(false); }
  }, [authed, from, to, dates]);

  useEffect(() => { load(); }, [load]);

  // 자동 취합 + 수동 오버레이 병합
  const mergedDays = useMemo(() => {
    if (!result) return [];
    return result.days.map((d) => {
      const st = states[d.date] || {};
      const ov = st.overrides || {};
      const autoMoves = d.movements.map((m) => {
        const o = ov[m.id];
        return o ? { ...m, driver_id: "driver_id" in o ? o.driver_id ?? null : m.driver_id, time: o.time ?? m.time, sortTime: o.time !== undefined ? to24h(o.time) : m.sortTime, note: o.note ?? m.note } : m;
      });
      const manual = (st.manual || []).map((m) => ({ ...m }));
      const all = [...autoMoves, ...manual].sort((a, b) => (a.sortTime || to24h(a.time)).localeCompare(b.sortTime || to24h(b.time)));
      return { date: d.date, confirmed: st.confirmed as Confirmed | undefined, movements: all };
    });
  }, [result, states]);

  const setOverride = (date: string, id: string, patch: { driver_id?: string | null; time?: string; note?: string }) => {
    setDirty(prev=>({...prev,[date]:true}));
    setStates((prev) => {
      const st = { ...(prev[date] || {}) };
      st.overrides = { ...(st.overrides || {}), [id]: { ...(st.overrides?.[id] || {}), ...patch } };
      return { ...prev, [date]: st };
    });
  };
  const addManual = (date: string) => {
    setTab('all');setFilter('all');setQuery('');
    setDirty(prev=>({...prev,[date]:true}));
    setStates((prev) => {
      const st = { ...(prev[date] || {}) };
      const m: VehMovement = { id: `mn_${Date.now()}`, date, time: "", sortTime: "99:99", kind: "extra", source: "manual", guest: "", location: "", destination: "", num_people: 1, driver_id: null };
      st.manual = [...(st.manual || []), m];
      return { ...prev, [date]: st };
    });
  };
  const patchManual = (date: string, id: string, patch: Partial<VehMovement>) => {
    if(saving)return;
    setDirty(prev=>({...prev,[date]:true}));
    setStates((prev) => {
      const st = { ...(prev[date] || {}) };
      st.manual = (st.manual || []).map((m) => m.id === id ? { ...m, ...patch, sortTime: patch.time ? to24h(patch.time) : m.sortTime } : m);
      return { ...prev, [date]: st };
    });
  };
  const removeManual = (date: string, id: string) => {
    setDirty(prev=>({...prev,[date]:true}));
    setStates((prev) => {
      const st = { ...(prev[date] || {}) };
      st.manual = (st.manual || []).filter((m) => m.id !== id);
      return { ...prev, [date]: st };
    });
  };

  const saveDay = async (date: string, confirmPatch?: Partial<Record<Cat, boolean>>) => {
    setSaving(date);
    try {
      const st = { ...(states[date] || {}) };
      if (confirmPatch) {
        const cur: Record<string, boolean> = st.confirmed === true
          ? { academy: true, shuttle: true, airport: true }
          : (typeof st.confirmed === "object" && st.confirmed ? { ...st.confirmed } : {});
        st.confirmed = { ...cur, ...confirmPatch };
      }
      const by = getAdminInfo()?.name || "admin";
      const r = await fetch(`/api/admin/vehicle-schedule`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, by, state: st }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "save failed");
      setStates((prev) => ({ ...prev, [date]: j.state }));
      setDirty(prev=>({...prev,[date]:false}));
      setSavedMsg(`${fDate(date)} 저장되었습니다`);
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (e) {
      setSavedMsg("저장 실패: " + (e as Error).message);
    } finally { setSaving(null); }
  };

  if (!authed) return null;
  const CAT_LABEL:Record<Cat,string>={academy:'아카데미',shuttle:'투어셔틀',airport:'공항·추가 픽드랍'};
  const all=mergedDays.flatMap(d=>d.movements);
  const needsDriver=(m:VehMovement)=>!m.driver_id&&!m.driver_name;
  const noTime=(m:VehMovement)=>!m.time||m.sortTime==='99:99';
  const match=(m:VehMovement)=>(tab==='all'||CAT_OF[m.kind]===tab)&&(filter==='all'||(filter==='driver'?needsDriver(m):filter==='time'?noTime(m):m.auto))&&(!query||[m.guest,m.location,m.destination,m.flight_info,m.driver_name,drivers.find(d=>d.id===m.driver_id)?.name].join(' ').toLowerCase().includes(query.toLowerCase()));
  const days=mergedDays.filter(d=>!selectedDate||d.date===selectedDate).map(d=>({...d,movements:d.movements.filter(match)}));
  const changePeriod=(fn:()=>void)=>{if(Object.values(dirty).some(Boolean)&&!window.confirm('저장하지 않은 변경이 있습니다. 변경을 버리고 이동할까요?'))return;setDirty({});setSelectedDate('');fn();};
  const sourceOf=(m:VehMovement)=>m.source==='pickup_requests'?{name:'픽드랍 요청',url:'/admin/pickups'}:m.source==='bookings'?{name:'예약·체크인 정보',url:'/admin/bookings/'+m.id.replace(/^bk_(in|out|tr)_/,'')}:m.source==='shuttle_applications'?{name:'투어셔틀 신청',url:'/admin/tour-shuttle'}:m.source==='fieldtrip_applications'?{name:'체험활동 신청',url:'/admin/afterschool-fieldtrip'}:m.source==='pickup_schedules'?{name:'집↔학원 셔틀표',url:'/ashuttle'}:{name:'이 화면에서 추가',url:''};
  return <main className="vehicle-page">
    <header className="vehicle-heading"><div><span className="vehicle-eyebrow">DREAM ACADEMY · TRANSPORT</span><h1>차량 스케줄</h1><p>오늘의 이동부터 기사 배정까지, 한곳에서 확인하세요.</p></div><div className="vehicle-actions"><button onClick={()=>setSources(!sources)} aria-expanded={sources}>자료 출처 안내</button><button disabled={loading||!!saving} onClick={()=>changePeriod(()=>{void load();})}>↻ 새로고침</button><button onClick={()=>window.print()}>인쇄</button></div></header>
    {sources&&<section className="vehicle-sources"><h2>어디에서 가져온 일정인가요?</h2><div><p><b>공항·추가 픽드랍</b>등록된 픽드랍 요청을 우선하고, 없는 항목은 예약의 항공·숙박 정보로 초안을 만듭니다. 초안은 차량 시간 확인이 필요합니다.</p><p><b>투어셔틀</b>투어셔틀 신청에서 가져옵니다. 취소 신청은 제외합니다.</p><p><b>애프터스쿨·필드트립</b>신청 날짜와 배포 일정으로 구성합니다. 표시 시간은 프로그램 기준이며 차량 배정은 별도로 확인합니다.</p><p><b>집↔학원</b>기존 셔틀표에 저장된 날짜만 가져옵니다. 기사·탑승자 수정은 원본 셔틀표에서 해주세요. 결석 메모는 원본 확인이 필요합니다.</p></div><p>기사 배정은 픽드랍 요청·투어셔틀 신청에 함께 반영됩니다. 다른 유형의 배정, 차량 시간·메모는 이 통합 화면에 저장됩니다. ‘확인 완료’는 내부 표시이며 기사에게 자동 발송되지 않습니다.</p></section>}
    <section className="vehicle-stats" aria-label="조회 기간 요약">
      <button onClick={()=>{setFilter('all');setTab('all');}}><span>전체 일정 항목</span><strong>{all.length}<small>건</small></strong><em>신청·운행 묶음 기준</em></button>
      <button className="warning" onClick={()=>setFilter('driver')} aria-pressed={filter==='driver'}><span>기사 확인 필요</span><strong>{all.filter(needsDriver).length}<small>건</small></strong><em>미배정 일정 보기 →</em></button>
      <button className="warning" onClick={()=>setFilter('time')} aria-pressed={filter==='time'}><span>차량 시간 미정</span><strong>{all.filter(noTime).length}<small>건</small></strong><em>시간 입력할 일정 →</em></button>
      <button onClick={()=>setFilter('draft')} aria-pressed={filter==='draft'}><span>예약 기반 초안</span><strong>{all.filter(m=>m.auto).length}<small>건</small></strong><em>실제 운행 여부 확인 →</em></button>
    </section>
    <section className="vehicle-controls"><div className="vehicle-period"><button aria-label="이전 주" disabled={!!saving} onClick={()=>changePeriod(()=>{const d=new Date(base);d.setDate(d.getDate()-7);setBase(d);})}>←</button><b>{from} — {to}</b><button aria-label="다음 주" disabled={!!saving} onClick={()=>changePeriod(()=>{const d=new Date(base);d.setDate(d.getDate()+7);setBase(d);})}>→</button><button disabled={!!saving} onClick={()=>changePeriod(()=>setBase(new Date()))}>이번 주</button><select aria-label="조회 기간" value={weeks} disabled={!!saving} onChange={e=>changePeriod(()=>setWeeks(Number(e.target.value)))}>{[1,2,3].map(w=><option key={w} value={w}>{w}주 보기</option>)}</select></div><input aria-label="일정 검색" placeholder="이름, 숙소, 기사, 항공편 검색" value={query} onChange={e=>setQuery(e.target.value)}/></section>
    <nav className="vehicle-tabs" aria-label="일정 종류">{TABS.map(t=><button key={t.key} aria-pressed={tab===t.key} className={tab===t.key?'active':''} onClick={()=>setTab(t.key)}>{t.label}<span>{all.filter(m=>t.key==='all'||CAT_OF[m.kind]===t.key).length}</span></button>)}</nav>
    <div className="vehicle-days"><button className={!selectedDate?'active':''} onClick={()=>setSelectedDate('')}>전체 날짜</button>{dates.map(d=><button key={d} className={selectedDate===d?'active':''} onClick={()=>setSelectedDate(d)}>{fDate(d)}<span>{all.filter(m=>m.date===d&&match(m)).length}건</span></button>)}</div>
    <div className="vehicle-filter"><label>표시 <select aria-label="상태 필터" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">모든 상태</option><option value="driver">기사 확인 필요</option><option value="time">시간 미정</option><option value="draft">예약 기반 초안</option></select></label><span>시간은 필리핀 현지 기준 · 원본 링크에서 등록 내용을 확인할 수 있습니다.</span></div>
    {savedMsg&&<div className="vehicle-message" role="status">{savedMsg}</div>}
    {error?<div className="vehicle-error" role="alert">{error}<button onClick={()=>void load()}>다시 불러오기</button></div>:loading?<div className="vehicle-empty" role="status">원본 일정을 모으고 있습니다…</div>:days.map(day=>{
      const cats=Array.from(new Set((mergedDays.find(d=>d.date===day.date)?.movements||[]).map(m=>CAT_OF[m.kind])));
      const done=cats.length>0&&cats.every(c=>isConfirmed(day.confirmed,c));
      if(!day.movements.length&&!selectedDate)return null;
      return <section className="vehicle-day" key={day.date}><header><div><h2>{fDate(day.date)}</h2><span>{day.movements.length}건 표시</span>{dirty[day.date]&&<b className="vehicle-unsaved">저장 전</b>}</div><div className="vehicle-actions"><button disabled={!!saving} onClick={()=>addManual(day.date)}>＋ 일정 추가</button><button className="primary" disabled={!!saving} onClick={()=>void saveDay(day.date)}>{saving===day.date?'저장 중…':'변경 저장'}</button><button disabled={!!saving||!cats.length} className={done?'confirmed':''} onClick={()=>void saveDay(day.date,tab==='all'?Object.fromEntries(cats.map(c=>[c,!done])):{[tab]:!isConfirmed(day.confirmed,tab)})}>{tab==='all'?(done?'✓ 전체 확인 완료':'전체 확인 완료 표시'):(isConfirmed(day.confirmed,tab)?'✓ 확인 완료':'확인 완료 표시')}</button></div></header>
        <div className="vehicle-confirmations">{cats.map(c=><span key={c} className={isConfirmed(day.confirmed,c)?'done':''}>{CAT_LABEL[c]} · {isConfirmed(day.confirmed,c)?'확인 완료':'확인 전'}</span>)}<small>확인 표시는 내부 관리용입니다.</small></div>
        <CommuteBoard movements={day.movements.filter(m=>m.source==='pickup_schedules')}/>
        {day.movements.some(m=>m.source!=='pickup_schedules')&&<div className="vehicle-column-head"><span>차량 시간 / 종류</span><span>탑승자 · 이동 경로</span><span>기사 / 메모</span></div>}
        {!day.movements.length&&<div className="vehicle-empty">해당 조건의 일정이 없습니다. 일정을 추가하거나 필터를 변경하세요.</div>}
        {day.movements.filter(m=>m.source!=='pickup_schedules').map(m=>{const k=KIND[m.kind]||KIND.extra,isManual=m.source==='manual',board=m.source==='pickup_schedules',source=sourceOf(m);return <article className="vehicle-row" key={m.id}>
          <div className="vehicle-time"><span className="vehicle-kind" style={{background:k.bg,color:k.color}}>{k.emoji} {k.label}</span>{board?<strong>{m.time||'시간 미정'}</strong>:<input aria-label={`${m.guest||'새 일정'} 차량 시간`} value={m.time} placeholder="시간 미정" onChange={e=>isManual?patchManual(day.date,m.id,{time:e.target.value}):setOverride(day.date,m.id,{time:e.target.value})} disabled={!!saving}/>}<small>{m.auto?'운행 확인 필요':board?'원본 표기 시간 · 메모 확인':m.kind==='afterschool'||m.kind==='fieldtrip'?'프로그램 기준 · 배차 확인':'필리핀 현지 시간'}</small></div>
          <div className="vehicle-route">{isManual?<div className="vehicle-manual"><input aria-label="탑승자" placeholder="탑승자 이름" value={m.guest} onChange={e=>patchManual(day.date,m.id,{guest:e.target.value})}/><select aria-label="일정 종류" value={m.kind} onChange={e=>patchManual(day.date,m.id,{kind:e.target.value as VehMovement['kind']})}>{Object.entries(KIND).map(([v,k])=><option key={v} value={v}>{k.label}</option>)}</select><input aria-label="출발지" placeholder="출발지" value={m.location} onChange={e=>patchManual(day.date,m.id,{location:e.target.value})}/><input aria-label="도착지" placeholder="도착지" value={m.destination} onChange={e=>patchManual(day.date,m.id,{destination:e.target.value})}/><label>인원 <input type="number" min="1" aria-label="탑승 인원" value={m.num_people} onChange={e=>patchManual(day.date,m.id,{num_people:Math.max(1,Number(e.target.value))})}/></label></div>:<><h3>{m.guest} <span>{m.num_people||'?'}명</span></h3><p>{board?'원본 경유지: ':''}{m.location||'출발지 확인'} {!board&&<><span className="vehicle-arrow">→</span> {m.destination||'도착지 확인'}</>}</p>{m.flight_info&&<p className="vehicle-flight">✈ {m.flight_info}</p>}</>}
          <div className="vehicle-source">{source.url?<a href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a>:<span>{source.name}</span>}{m.auto&&<span className="vehicle-draft">자동 초안</span>}</div></div>
          <div className="vehicle-assignment">{board?<><b>{m.driver_name||'기사 확인 필요'}</b><small>배정 변경은 원본 셔틀표에서</small><p>{m.note}</p></>:<><select aria-label={`${m.guest||'새 일정'} 담당 기사`} className={!m.driver_id?'unassigned':''} value={m.driver_id||''} disabled={!!saving} onChange={e=>isManual?patchManual(day.date,m.id,{driver_id:e.target.value||null}):setOverride(day.date,m.id,{driver_id:e.target.value||null})}><option value="">기사 미배정</option>{m.driver_id&&!drivers.some(d=>d.id===m.driver_id)&&<option value={m.driver_id}>기존 배정 기사 (비활성)</option>}{drivers.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select><textarea aria-label={`${m.guest||'새 일정'} 운행 메모`} placeholder="운행 메모" rows={2} value={m.note||''} disabled={!!saving} onChange={e=>isManual?patchManual(day.date,m.id,{note:e.target.value}):setOverride(day.date,m.id,{note:e.target.value})}/></>}{isManual&&<button className="vehicle-remove" disabled={!!saving} onClick={()=>removeManual(day.date,m.id)}>추가한 일정 삭제</button>}</div>
        </article>;})}
      </section>;
    })}
    {!loading&&!error&&!days.some(d=>d.movements.length)&&!selectedDate&&<div className="vehicle-empty">조건에 맞는 일정이 없습니다.<p>위에서 날짜를 선택하면 빈 날짜에도 일정을 추가할 수 있습니다.</p></div>}
  </main>;
}

