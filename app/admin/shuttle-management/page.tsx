"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

type Tab = "board" | "shuttle" | "drivers" | "schedule";

// ─────────────────────── Types ───────────────────────
interface Shuttle {
  id: string; booking_id: string;
  request_date: string; request_time: string; destination: string;
  num_people: number; round_trip: boolean;
  driver_id: string | null; status: string; notes: string;
  bookings_new: { booker_name: string; num_adults: number; num_children: number } | null;
}
interface Driver { id: string; name: string; phone: string; is_active: boolean }
interface Vehicle { id: string; name: string; capacity: number; is_active: boolean }
interface Entry {
  id: string; date: string; driver_id: string | null; type: string;
  guest: string; time: string; location: string; destination: string;
  num_people: number; flight_info: string; status: string; round_trip?: boolean;
}

// ─────────────────────── Constants ───────────────────────
const DAYS = ["일","월","화","수","목","금","토"];
const ST: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정", bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소", bg: "#fef2f2", color: "#dc2626" },
};
const TYPE_STYLE: Record<string, { emoji: string; bg: string; color: string; label: string }> = {
  pickup:  { emoji: "🔵", bg: "#dbeafe", color: "#1e40af", label: "픽업" },
  dropoff: { emoji: "🟢", bg: "#dcfce7", color: "#166534", label: "드랍" },
  shuttle: { emoji: "🟠", bg: "#fef3c7", color: "#92400e", label: "셔틀" },
};

function fDate(d: string | null) {
  if (!d) return "-";
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()}(${DAYS[dt.getDay()]})`;
}
function weekDates(base: Date): string[] {
  const d = new Date(base);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(d); dd.setDate(d.getDate() + i);
    dates.push(dd.toISOString().slice(0, 10));
  }
  return dates;
}
// 로컬 타임존 안전한 주(월~일) 날짜 배열
function weekOf(iso: string): string[] {
  const base = new Date(iso + "T00:00:00");
  const mon = new Date(base); mon.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
}

export default function ShuttleManagementPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("board");

  // 투어 배정 보드 (shuttle_applications 기반 드래그 배정)
  const [boardDate, setBoardDate] = useState<string>(() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; });
  const [boardApps, setBoardApps] = useState<any[]>([]);
  const [boardDrivers, setBoardDrivers] = useState<{id:string;name:string}[]>([]);
  const [dragId, setDragId] = useState<string|null>(null);
  const [shifts, setShifts] = useState<Record<string,{am:boolean;pm:boolean}>>({}); // 기사 주간 근무표 (key: driverId_weekday)

  // Shuttle tab
  const [shuttles, setShuttles] = useState<Shuttle[]>([]);
  const [shFilter, setShFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("all");

  // Drivers tab
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  type ModalMode = null | { kind: "driver"; data?: Driver } | { kind: "vehicle"; data?: Vehicle };
  const [modal, setModal] = useState<ModalMode>(null);
  const [form, setForm] = useState<Record<string, string | number>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Schedule tab
  const [baseDate, setBaseDate] = useState(new Date());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeDrivers, setActiveDrivers] = useState<{ id: string; name: string }[]>([]);
  const [popup, setPopup] = useState<Entry | null>(null);
  const dates = weekDates(baseDate);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else window.location.href = "/login"; }, []);

  // ─── 투어 배정 보드 load/배정 ───
  const loadBoard = useCallback(async () => {
    const wk = weekOf(boardDate);
    const appsRes = await supabase.from("shuttle_applications").select("*").gte("tour_date", wk[0]).lte("tour_date", wk[6]).order("tour_date", { ascending: true }).order("depart_time", { ascending: true });
    setBoardApps(appsRes.data || []);
    // 기사는 RLS 우회 위해 서버 API(service role)로 로드
    try {
      const r = await fetch("/api/admin/drivers");
      if (r.ok) { const d = await r.json(); setBoardDrivers(((d.drivers || []) as any[]).filter(x => x.is_active !== false).map(x => ({ id: x.id, name: x.name }))); }
    } catch {}
  }, [boardDate]);
  function appCard(a: any) {
    return (
      <div key={a.id} draggable onDragStart={() => setDragId(a.id)} onDragEnd={() => setDragId(null)}
        style={{ background: "#f0f7ff", border: "1px solid #dbeafe", borderRadius: 8, padding: "7px 9px", cursor: "grab", fontSize: 12, lineHeight: 1.5, minWidth: 150 }}>
        <div style={{ fontWeight: 700, color: "#1a1a2e" }}>🚌 {a.tour_name || "투어셔틀"}</div>
        <div style={{ color: "#475569" }}>{a.room_number || ""} · {a.depart_time || ""}</div>
        <div style={{ color: "#475569" }}>{[a.portal_name, a.riders].filter(Boolean).join(" · ")} ({a.people_count || 0}명)</div>
        {a.request && <div style={{ color: "#b45309", fontSize: 11 }}>{a.request}</div>}
      </div>
    );
  }
  async function assignDriver(appId: string, driverId: string | null) {
    setBoardApps(prev => prev.map(a => a.id === appId ? { ...a, driver_id: driverId } : a)); // 낙관적 갱신
    const { error } = await supabase.from("shuttle_applications").update({ driver_id: driverId }).eq("id", appId);
    if (error) { alert("배정 저장 실패: " + error.message); loadBoard(); }
  }
  function shiftBoardDate(delta: number) { const d=new Date(boardDate+"T00:00:00"); d.setDate(d.getDate()+delta); setBoardDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`); }
  function boardCap(driverId: string | null) { return boardApps.filter(a => a.tour_date===boardDate && (a.driver_id||null)===driverId).reduce((s,a)=>s+(Number(a.people_count)||0),0); }

  // ─── 기사 근무표(주간) load / 토글 / 자동배정 ───
  const loadShifts = useCallback(async () => {
    const { data } = await supabase.from("driver_shifts").select("*");
    const m: Record<string,{am:boolean;pm:boolean}> = {};
    (data || []).forEach((r:any)=>{ m[`${r.driver_id}_${r.weekday}`] = { am: !!r.am, pm: !!r.pm }; });
    setShifts(m);
  }, []);
  async function toggleShift(driverId: string, weekday: number) {
    const key = `${driverId}_${weekday}`;
    const c = shifts[key] || { am:false, pm:false };
    // 휴무 → 오전 → 오후 → 종일 → 휴무
    const next = (!c.am && !c.pm) ? {am:true,pm:false} : (c.am && !c.pm) ? {am:false,pm:true} : (!c.am && c.pm) ? {am:true,pm:true} : {am:false,pm:false};
    setShifts(prev=>({...prev,[key]:next}));
    await supabase.from("driver_shifts").upsert({ driver_id:driverId, weekday, am:next.am, pm:next.pm });
  }
  function shiftCell(driverId: string, weekday: number) {
    const s = shifts[`${driverId}_${weekday}`] || {am:false,pm:false};
    if(s.am&&s.pm) return {txt:"종일",bg:"#dcfce7",color:"#166534"};
    if(s.am) return {txt:"오전",bg:"#dbeafe",color:"#1e40af"};
    if(s.pm) return {txt:"오후",bg:"#fef3c7",color:"#92400e"};
    return {txt:"휴무",bg:"#f8fafc",color:"#cbd5e1"};
  }
  function isAmTime(t?: string): boolean {
    if(!t) return true;
    const s=String(t).toLowerCase();
    if(s.includes("오전")||s.includes("am")) return true;
    if(s.includes("오후")||s.includes("pm")) return false;
    const h=parseInt(s,10); return isNaN(h)?true:h<12;
  }
  function workingDrivers(weekday: number) {
    return boardDrivers.filter(d=>{ const s=shifts[`${d.id}_${weekday}`]; return s && (s.am||s.pm); });
  }
  async function autoAssign() {
    const wd = new Date(boardDate+"T00:00:00").getDay();
    const working = workingDrivers(wd);
    if(working.length===0){ alert("그날 근무하는 기사가 없습니다. '기사 관리' 탭의 근무표를 먼저 설정하세요."); return; }
    const todo = boardApps.filter(a=>a.tour_date===boardDate && !a.driver_id);
    if(todo.length===0){ alert("자동배정할 미배정 신청이 없습니다."); return; }
    const cap: Record<string,number> = {}; working.forEach(d=>cap[d.id]=boardCap(d.id));
    for(const a of todo){
      const am = isAmTime(a.depart_time);
      let pool = working.filter(d=>{ const s=shifts[`${d.id}_${wd}`]; return am ? s.am : s.pm; });
      if(pool.length===0) pool = working;
      pool = [...pool].sort((x,y)=>(cap[x.id]||0)-(cap[y.id]||0));
      const target = pool[0];
      cap[target.id] = (cap[target.id]||0) + (Number(a.people_count)||0);
      await assignDriver(a.id, target.id);
    }
  }

  // ─── Shuttle load ───
  const loadShuttles = useCallback(async () => {
    const res = await fetch("/api/admin/shuttle");
    if (res.ok) { const d = await res.json(); setShuttles(d.shuttles); setActiveDrivers(d.drivers); }
  }, []);

  // ─── Drivers load ───
  const loadDrivers = useCallback(async () => {
    const res = await fetch("/api/admin/drivers");
    if (res.ok) { const d = await res.json(); setDrivers(d.drivers); setVehicles(d.vehicles); }
  }, []);

  // ─── Schedule load ───
  const loadSchedule = useCallback(async () => {
    const res = await fetch(`/api/admin/driver-schedule?start=${dates[0]}&end=${dates[6]}`);
    if (res.ok) { const d = await res.json(); setEntries(d.entries); setActiveDrivers(d.drivers); }
  }, [dates[0], dates[6]]);

  useEffect(() => { if (authed && tab === "board") { loadBoard(); loadShifts(); } }, [authed, tab, loadBoard, loadShifts]);
  useEffect(() => { if (authed && tab === "shuttle") loadShuttles(); }, [authed, tab, loadShuttles]);
  useEffect(() => { if (authed && tab === "drivers") { loadDrivers(); loadShifts(); } }, [authed, tab, loadDrivers, loadShifts]);
  useEffect(() => { if (authed && tab === "schedule") loadSchedule(); }, [authed, tab, loadSchedule]);

  // ─── Shuttle functions ───
  async function patchShuttle(id: string, updates: Record<string, unknown>) {
    await fetch("/api/admin/shuttle", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    loadShuttles();
  }
  function driverDateTotal(driverId: string | null, date: string) {
    if (!driverId) return 0;
    return shuttles.filter(s => s.driver_id === driverId && s.request_date === date && s.status !== "cancelled")
      .reduce((sum, s) => sum + (s.num_people || 0) * (s.round_trip ? 2 : 1), 0);
  }

  // ─── Drivers functions ───
  function openDrvModal(kind: "driver" | "vehicle", data?: Driver | Vehicle) {
    if (kind === "driver") {
      const d = data as Driver | undefined;
      setForm({ name: d?.name || "", phone: d?.phone || "" });
    } else {
      const v = data as Vehicle | undefined;
      setForm({ name: v?.name || "", capacity: v?.capacity ?? 12 });
    }
    setModal({ kind, data: data as never });
  }
  async function saveModal() {
    if (!modal) return;
    const isEdit = !!modal.data;
    const body = { type: modal.kind === "vehicle" ? "vehicle" : "driver", ...(isEdit ? { id: (modal.data as { id: string }).id } : {}), ...form };
    await fetch("/api/admin/drivers", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setModal(null);
    loadDrivers();
  }
  async function toggleActive(type: string, id: string, current: boolean) {
    await fetch("/api/admin/drivers", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, is_active: !current }),
    });
    loadDrivers();
  }
  async function del(type: string, id: string, label: string) {
    if (!confirm(`${label} 삭제하시겠습니까?`)) return;
    await fetch(`/api/admin/drivers?type=${type}&id=${id}`, { method: "DELETE" });
    loadDrivers();
  }
  async function copyDriverLink(driverId: string) {
    const res = await fetch("/api/driver-token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driver_id: driverId }),
    });
    if (!res.ok) { alert("토큰 생성 실패"); return; }
    const { token } = await res.json();
    await navigator.clipboard.writeText(`${window.location.origin}/driver/${token}`);
    setCopiedId(driverId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // ─── Schedule functions ───
  function shiftWeek(n: number) { const d = new Date(baseDate); d.setDate(d.getDate() + n * 7); setBaseDate(d); }
  function cellEntries(date: string, driverId: string) {
    return entries.filter(e => e.date === date && e.driver_id === driverId);
  }
  const unassigned = entries.filter(e => !e.driver_id);

  // ─── Filtered shuttles ───
  const filteredShuttles = shuttles.filter(s => shFilter === "all" || s.status === shFilter);

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.sm-w{max-width:1100px;margin:0 auto;padding:28px 20px}
.sm-top{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.sm-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.sm-back:hover{background:#e2e8f0}
.sm-top h1{font-size:22px;font-weight:800;flex:1}
.tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:12px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
.tab{flex:1;padding:12px 8px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:10px;cursor:pointer;font-family:inherit;background:transparent;color:#6b7c93}
.tab.ac{background:#1a6fc4;color:#fff}
.toolbar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
.btn{padding:10px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 150ms}
.btn-sm{padding:6px 12px;font-size:12px;border:1px solid #e2e8f0}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#0d3d7a}
.btn-gray{background:#f1f5f9;color:#475569}.btn-gray:hover{background:#e2e8f0}
.btn-red{background:#fef2f2;color:#dc2626}.btn-red:hover{background:#fecaca}
.btn-on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.cnt{font-size:13px;color:#6b7c93;margin-left:auto}
.sec{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);margin-bottom:14px;overflow-x:auto}
.sec-head{display:flex;align-items:center;gap:8px;margin-bottom:14px}
.sec-head h2{font-size:15px;font-weight:700;flex:1}
.tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:700px}
.tbl th{background:#f8fafc;padding:10px 8px;text-align:left;font-weight:700;font-size:12px;color:#6b7c93;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.tbl tr:hover{background:#f8fafc}
.tbl tr.over{background:#fef2f2}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.b-rt{background:#e0e7ff;color:#3730a3}.b-ow{background:#fef3c7;color:#92400e}
.badge-on{background:#dcfce7;color:#166534}.badge-off{background:#fef2f2;color:#dc2626}
.sel{padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:inherit;outline:none;background:#fff;min-width:90px}.sel:focus{border-color:#1a6fc4}
.warn{color:#dc2626;font-weight:700;font-size:11px;white-space:nowrap}
.empty{text-align:center;padding:32px;color:#94a3b8;font-size:14px}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;transition:border-color 150ms}
.card.inactive{opacity:0.5}
.card-av{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.card-info{flex:1;min-width:0}.card-info .nm{font-size:15px;font-weight:700}.card-info .sub{font-size:12px;color:#6b7c93;margin-top:2px}
.card-actions{display:flex;gap:6px;flex-wrap:wrap}
.nav{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.nav button{padding:6px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}.nav button:hover{background:#e2e8f0}
.nav .cur{font-size:14px;font-weight:700;min-width:170px;text-align:center}
.grid{width:100%;border-collapse:collapse;font-size:12px;min-width:640px}
.grid th{background:#f8fafc;padding:10px 6px;font-weight:700;color:#6b7c93;border:1px solid #e2e8f0;text-align:center;white-space:nowrap}
.grid td{border:1px solid #e2e8f0;padding:4px;vertical-align:top;min-width:110px;height:60px}
.grid .date-cell{background:#f8fafc;font-weight:700;text-align:center;padding:8px 4px;min-width:70px;white-space:nowrap}
.chip{display:block;padding:3px 6px;border-radius:5px;margin-bottom:3px;font-size:11px;cursor:pointer}
.chip:hover{opacity:0.8}
.ua-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.ua-chip{padding:4px 10px;border-radius:6px;font-size:11px;background:#fef2f2;color:#dc2626;font-weight:600}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px}
.modal{background:#fff;border-radius:16px;padding:28px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
.modal h3{font-size:17px;font-weight:800;margin-bottom:16px}
.modal label{display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:4px}
.modal input{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;margin-bottom:14px}
.modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
@media(max-width:700px){.sm-w{padding:20px 12px}.toolbar{flex-direction:column;align-items:stretch}}
    `}</style>
    <div className="sm-w">
      <div className="sm-top">
        <button className="sm-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>셔틀 · 기사 관리</h1>
      </div>

      <div className="tabs">
        <button className={`tab${tab === "board" ? " ac" : ""}`} onClick={() => setTab("board")}>🚌 투어 배정</button>
        <button className={`tab${tab === "shuttle" ? " ac" : ""}`} onClick={() => setTab("shuttle")}>🚐 셔틀 관리</button>
        <button className={`tab${tab === "drivers" ? " ac" : ""}`} onClick={() => setTab("drivers")}>🚗 기사 관리</button>
        <button className={`tab${tab === "schedule" ? " ac" : ""}`} onClick={() => setTab("schedule")}>📅 기사 스케줄</button>
      </div>

      {/* ───── 탭1: 셔틀 관리 ───── */}
      {tab === "board" && (() => {
        const wk = weekOf(boardDate);
        const dayApps = boardApps.filter(a => a.tour_date === boardDate);
        const unassigned = dayApps.filter(a => !a.driver_id);
        const wd = new Date(boardDate+"T00:00:00").getDay();
        const working = workingDrivers(wd);
        const cols = [...working];
        dayApps.forEach(a=>{ if(a.driver_id && !cols.find(c=>c.id===a.driver_id)){ const d=boardDrivers.find(b=>b.id===a.driver_id); if(d) cols.push(d); } });
        return (<>
          {/* 주간 네비 */}
          <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0 10px",flexWrap:"wrap"}}>
            <button className="btn btn-sm btn-gray" onClick={()=>shiftBoardDate(-7)}>◀ 이전주</button>
            <b style={{fontSize:14}}>{wk[0].slice(5)} ~ {wk[6].slice(5)}</b>
            <button className="btn btn-sm btn-gray" onClick={()=>shiftBoardDate(7)}>다음주 ▶</button>
            <input type="date" value={boardDate} onChange={e=>setBoardDate(e.target.value)} style={{padding:"7px 10px",border:"1px solid #cbd5e1",borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
          </div>
          {/* 주간보드 7일 — 클릭하면 아래 그날 배정 */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:16}}>
            {wk.map((d,i)=>{
              const dayAll=boardApps.filter(a=>a.tour_date===d);
              const sel=d===boardDate;
              return (
                <div key={d} onClick={()=>setBoardDate(d)}
                  style={{cursor:"pointer",border:`2px solid ${sel?"#1a6fc4":"#e2e8f0"}`,background:sel?"#eff6ff":"#fff",borderRadius:10,padding:8,minHeight:86}}>
                  <div style={{fontSize:11,fontWeight:800,color:i>=5?"#dc2626":"#64748b",marginBottom:4}}>{DAYS[new Date(d+"T00:00:00").getDay()]} {Number(d.slice(8))}</div>
                  {dayAll.length===0?<div style={{fontSize:10,color:"#cbd5e1"}}>—</div>:dayAll.slice(0,3).map(a=>(
                    <div key={a.id} style={{fontSize:10,color:a.driver_id?"#16a34a":"#1a6fc4",fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.driver_id?"✅ ":"• "}{a.tour_name||"투어"}</div>
                  ))}
                  {dayAll.length>3&&<div style={{fontSize:10,color:"#94a3b8"}}>+{dayAll.length-3}건</div>}
                </div>
              );
            })}
          </div>
          {/* 선택한 날 배정 */}
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#475569"}}>📅 {boardDate} ({DAYS[wd]}) 기사 배정 <span style={{fontWeight:600,color:"#94a3b8"}}>· 근무 {working.length}명</span></div>
            <button onClick={autoAssign} style={{padding:"6px 14px",border:"none",borderRadius:8,background:"#1a6fc4",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>🤖 근무기사 자동배정</button>
          </div>
          <div onDragOver={e=>e.preventDefault()} onDrop={()=>{ if(dragId){ assignDriver(dragId,null); setDragId(null); } }}
            style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:12,marginBottom:14}}>
            <div style={{fontWeight:800,fontSize:13,color:"#92400e",marginBottom:8}}>📋 미배정 신청 ({unassigned.length}건) <span style={{fontWeight:600,color:"#b45309",fontSize:11}}>— 카드를 아래 기사에게 끌어다 배정</span></div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {unassigned.length===0?<div style={{fontSize:12,color:"#cbd5e1",padding:"6px 0"}}>이 날짜에 미배정 신청이 없습니다.</div>:unassigned.map(a=>appCard(a))}
            </div>
          </div>
          <div style={{fontWeight:800,fontSize:13,color:"#1a6fc4",marginBottom:8}}>🚗 기사별 배정 <span style={{fontWeight:600,color:"#94a3b8",fontSize:11}}>— 다시 끌어 변경 / 위로 끌면 취소</span></div>
          <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8}}>
            {cols.length===0?<div style={{fontSize:12,color:"#94a3b8",padding:"10px"}}>이 요일에 근무하는 기사가 없습니다. "🚗 기사 관리" 탭의 주간 근무표를 설정하세요.</div>:cols.map(col=>{
              const colApps=dayApps.filter(a=>a.driver_id===col.id);
              const cap=boardCap(col.id);
              const over=cap>12;
              return (
                <div key={col.id} onDragOver={e=>e.preventDefault()} onDrop={()=>{ if(dragId){ assignDriver(dragId,col.id); setDragId(null); } }}
                  style={{minWidth:200,flex:"0 0 200px",background:"#fff",border:`2px solid ${over?"#ef4444":"#e2e8f0"}`,borderRadius:12,padding:10,minHeight:120}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,fontWeight:800,fontSize:13,color:"#1a6fc4"}}>
                    <span>🚗 {col.name}</span>
                    <span style={{fontSize:11,fontWeight:700,color:over?"#dc2626":"#16a34a"}}>{cap}/12명{over?" ⚠️":""}</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {colApps.length===0?<div style={{fontSize:12,color:"#cbd5e1",textAlign:"center",padding:"16px 0"}}>여기로 드래그</div>:colApps.map(a=>appCard(a))}
                  </div>
                </div>
              );
            })}
          </div>
        </>);
      })()}

      {tab === "shuttle" && (<>
        <div className="toolbar">
          {([["all","전체"],["pending","대기"],["confirmed","확정"],["cancelled","취소"]] as const).map(([k,v]) => (
            <button key={k} className={`btn btn-sm ${shFilter === k ? "btn-on" : "btn-gray"}`} onClick={() => setShFilter(k as typeof shFilter)}>{v}</button>
          ))}
          <span className="cnt">{filteredShuttles.length}건</span>
        </div>
        <div className="sec">
          {filteredShuttles.length === 0 ? <div className="empty">셔틀 신청이 없습니다</div> : (
            <table className="tbl">
              <thead><tr><th>날짜</th><th>시간</th><th>손님</th><th>목적지</th><th>인원</th><th>왕복</th><th>기사 배정</th><th>상태</th><th>메모</th></tr></thead>
              <tbody>
                {filteredShuttles.map(s => {
                  const total = driverDateTotal(s.driver_id, s.request_date);
                  const over = !!s.driver_id && total > 12;
                  const st = ST[s.status] || ST.pending;
                  return (
                    <tr key={s.id} className={over ? "over" : ""}>
                      <td style={{ whiteSpace: "nowrap" }}>{fDate(s.request_date)}</td>
                      <td>{s.request_time || "-"}</td>
                      <td>{s.bookings_new?.booker_name || "-"}</td>
                      <td>{s.destination || "-"}</td>
                      <td>{s.num_people || 0}명{over && <div className="warn">합산 {total}명!</div>}</td>
                      <td><span className={`badge ${s.round_trip ? "b-rt" : "b-ow"}`}>{s.round_trip ? "왕복" : "편도"}</span></td>
                      <td>
                        <select className="sel" value={s.driver_id || ""} onChange={e => patchShuttle(s.id, { driver_id: e.target.value || null })}>
                          <option value="">미배정</option>
                          {activeDrivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="sel" style={{ background: st.bg, color: st.color, fontWeight: 700, fontSize: 11 }} value={s.status} onChange={e => patchShuttle(s.id, { status: e.target.value })}>
                          <option value="pending">대기</option><option value="confirmed">확정</option><option value="cancelled">취소</option>
                        </select>
                      </td>
                      <td style={{ fontSize: 12, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.notes || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </>)}

      {/* ───── 탭2: 기사 관리 ───── */}
      {tab === "drivers" && (<>
        <div className="sec">
          <h2 style={{marginBottom:10}}>📋 주간 근무표 <span style={{fontWeight:600,fontSize:12,color:"#94a3b8"}}>— 칸 클릭: 휴무→오전→오후→종일 (매주 반복)</span></h2>
          {drivers.filter(d=>d.is_active).length===0?<div className="empty">활성 기사가 없습니다</div>:(
            <div style={{overflowX:"auto"}}>
              <table style={{borderCollapse:"collapse",width:"100%",fontSize:12}}>
                <thead><tr><th style={{textAlign:"left",padding:"6px 8px",color:"#6b7c93"}}>기사</th>
                  {[1,2,3,4,5,6,0].map(wd=><th key={wd} style={{padding:"6px 4px",color:(wd===0||wd===6)?"#dc2626":"#6b7c93"}}>{DAYS[wd]}</th>)}
                </tr></thead>
                <tbody>
                  {drivers.filter(d=>d.is_active).map(d=>(
                    <tr key={d.id}>
                      <td style={{padding:"6px 8px",fontWeight:700,whiteSpace:"nowrap"}}>{d.name}</td>
                      {[1,2,3,4,5,6,0].map(wd=>{ const c=shiftCell(d.id,wd); return (
                        <td key={wd} style={{padding:3,textAlign:"center"}}>
                          <button onClick={()=>toggleShift(d.id,wd)} style={{width:"100%",minWidth:46,padding:"6px 0",border:"none",borderRadius:6,background:c.bg,color:c.color,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{c.txt}</button>
                        </td>
                      );})}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="sec">
          <div className="sec-head">
            <h2>🚗 기사 목록</h2>
            <button className="btn btn-sm btn-blue" onClick={() => openDrvModal("driver")}>+ 기사 추가</button>
          </div>
          {drivers.length === 0 ? <div className="empty">등록된 기사가 없습니다</div> : drivers.map(d => (
            <div key={d.id} className={`card${d.is_active ? "" : " inactive"}`}>
              <div className="card-av" style={{ background: d.is_active ? "#dbeafe" : "#f1f5f9" }}>🚗</div>
              <div className="card-info">
                <div className="nm">{d.name}</div>
                <div className="sub">{d.phone || "연락처 미등록"}</div>
              </div>
              <div className="card-actions">
                <span className={`badge ${d.is_active ? "badge-on" : "badge-off"}`}>{d.is_active ? "활성" : "비활성"}</span>
                <button className="btn btn-sm btn-gray" onClick={() => toggleActive("driver", d.id, d.is_active)}>{d.is_active ? "비활성화" : "활성화"}</button>
                <button className="btn btn-sm btn-gray" onClick={() => openDrvModal("driver", d)}>수정</button>
                <button className="btn btn-sm" style={{ background: copiedId === d.id ? "#dcfce7" : "#eff6ff", color: copiedId === d.id ? "#166534" : "#1a6fc4", border: "1px solid " + (copiedId === d.id ? "#bbf7d0" : "#bfdbfe") }} onClick={() => copyDriverLink(d.id)}>{copiedId === d.id ? "복사됨!" : "📱 링크"}</button>
                <button className="btn btn-sm btn-red" onClick={() => del("driver", d.id, d.name)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
        <div className="sec">
          <div className="sec-head">
            <h2>🚐 차량 목록</h2>
            <button className="btn btn-sm btn-blue" onClick={() => openDrvModal("vehicle")}>+ 차량 추가</button>
          </div>
          {vehicles.length === 0 ? <div className="empty">등록된 차량이 없습니다</div> : vehicles.map(v => (
            <div key={v.id} className={`card${v.is_active ? "" : " inactive"}`}>
              <div className="card-av" style={{ background: v.is_active ? "#fef3c7" : "#f1f5f9" }}>🚐</div>
              <div className="card-info">
                <div className="nm">{v.name || "차량명 미등록"}</div>
                <div className="sub">{v.capacity}인승</div>
              </div>
              <div className="card-actions">
                <span className={`badge ${v.is_active ? "badge-on" : "badge-off"}`}>{v.is_active ? "활성" : "비활성"}</span>
                <button className="btn btn-sm btn-gray" onClick={() => toggleActive("vehicle", v.id, v.is_active)}>{v.is_active ? "비활성화" : "활성화"}</button>
                <button className="btn btn-sm btn-gray" onClick={() => openDrvModal("vehicle", v)}>수정</button>
                <button className="btn btn-sm btn-red" onClick={() => del("vehicle", v.id, v.name || "차량")}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      </>)}

      {/* ───── 탭3: 기사 스케줄 ───── */}
      {tab === "schedule" && (<>
        <div className="toolbar">
          <div className="nav">
            <button onClick={() => shiftWeek(-1)}>← 이전</button>
            <span className="cur">{fDate(dates[0])} ~ {fDate(dates[6])}</span>
            <button onClick={() => shiftWeek(1)}>다음 →</button>
            <button onClick={() => setBaseDate(new Date())}>이번 주</button>
          </div>
          <button className="btn btn-sm btn-gray" style={{ marginLeft: "auto" }} onClick={() => window.print()}>🖨 인쇄</button>
        </div>
        <div className="sec">
          <table className="grid">
            <thead>
              <tr><th>날짜</th>{activeDrivers.map(d => <th key={d.id}>{d.name}</th>)}</tr>
            </thead>
            <tbody>
              {dates.map(date => (
                <tr key={date}>
                  <td className="date-cell">{fDate(date)}</td>
                  {activeDrivers.map(d => {
                    const items = cellEntries(date, d.id);
                    return (
                      <td key={d.id}>
                        {items.map(e => {
                          const ts = TYPE_STYLE[e.type] || TYPE_STYLE.pickup;
                          return (
                            <div key={e.id} className="chip" style={{ background: ts.bg, color: ts.color }} onClick={() => setPopup(e)}>
                              <span style={{ fontWeight: 700 }}>{ts.emoji} {e.time || ""}</span>{" "}{e.guest}
                              <span style={{ fontSize: 10 }}> {e.num_people}명</span>
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {unassigned.length > 0 && (
          <div className="sec">
            <div className="sec-head"><h2 style={{ color: "#dc2626" }}>미배정 ({unassigned.length}건)</h2></div>
            <div className="ua-list">
              {unassigned.map(e => (
                <span key={e.id} className="ua-chip">
                  {fDate(e.date)} {TYPE_STYLE[e.type]?.emoji} {e.guest} {e.num_people}명
                </span>
              ))}
            </div>
          </div>
        )}
      </>)}
    </div>

    {/* 기사/차량 편집 모달 */}
    {modal && (
      <div className="overlay" onClick={() => setModal(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>{modal.data ? "수정" : "추가"} — {modal.kind === "driver" ? "기사" : "차량"}</h3>
          {modal.kind === "driver" ? (<>
            <label>이름</label>
            <input value={form.name as string} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="기사 이름" autoFocus />
            <label>연락처</label>
            <input value={form.phone as string} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="010-0000-0000" />
          </>) : (<>
            <label>차량명</label>
            <input value={form.name as string} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="스타리아 1호" autoFocus />
            <label>정원</label>
            <input type="number" value={form.capacity as number} onChange={e => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })} />
          </>)}
          <div className="modal-foot">
            <button className="btn btn-gray" onClick={() => setModal(null)}>취소</button>
            <button className="btn btn-blue" onClick={saveModal}>저장</button>
          </div>
        </div>
      </div>
    )}

    {/* 스케줄 셀 팝업 */}
    {popup && (
      <div className="overlay" onClick={() => setPopup(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>{TYPE_STYLE[popup.type]?.emoji} {TYPE_STYLE[popup.type]?.label} 상세</h3>
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            <div><b>손님:</b> {popup.guest}</div>
            <div><b>날짜:</b> {fDate(popup.date)}</div>
            <div><b>시간:</b> {popup.time || "-"}</div>
            <div><b>출발:</b> {popup.location || "-"}</div>
            <div><b>도착:</b> {popup.destination || "-"}</div>
            <div><b>인원:</b> {popup.num_people}명</div>
            {popup.flight_info && <div><b>항공편:</b> {popup.flight_info}</div>}
            <div><b>상태:</b> {popup.status}</div>
          </div>
          <button className="btn btn-gray" onClick={() => setPopup(null)} style={{ width: "100%", marginTop: 14 }}>닫기</button>
        </div>
      </div>
    )}
  </>);
}
