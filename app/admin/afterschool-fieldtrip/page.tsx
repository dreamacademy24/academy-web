"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthed } from "@/lib/adminAuth";
import AfterFieldDeploy from "./AfterFieldDeploy";
import { KR_DOW, parseToken, resolveProgram, loadDeployedSchedule, buildScheduleByMd, tokenForItem, type DeployedScheduleItem } from "@/lib/fieldtripPrograms";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface FieldtripApp {
  id: number;
  created_at: string;
  name: string | null;          // 아이 이름
  date: string | null;          // 선택 일정 토큰(콤마 결합) 예: "5-9-nimobrew, 6-13-shrine"
  message: string | null;
  room_number: string | null;
  request: string | null;
  status: string | null;
  booking_id: string | null;    // 예약 연결키 (픽업·셔틀·튜터와 동일)
  portal_name: string | null;   // 신청 시점 예약자명 스냅샷
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기중", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정",   bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
};

// 프로그램 매핑(FT_PROGRAMS)·토큰 파서는 @/lib/fieldtripPrograms 로 이전 (현지직원 페이지와 공유)

// 주간 뷰 헬퍼
function ymdA(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function mondayOfA(base: Date) { const d = new Date(base); const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); d.setHours(0, 0, 0, 0); return d; }
const wkNavBtn: React.CSSProperties = { padding: "6px 12px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

// 토큰 단위로 펼친 행
interface FlatRow {
  appId: number;
  childName: string;
  reserver: string;
  room: string;
  request: string;
  status: string;
  token: string;
  month: number;
  day: number;
  programName: string;
  isFieldtrip: boolean;
  time: string;
}

export default function AfterschoolFieldtripAdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [mainTab, setMainTab] = useState<"list" | "deploy">("list");
  const [apps, setApps] = useState<FieldtripApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set());
  const [monthsInitDone, setMonthsInitDone] = useState(false);
  const [bookerNames, setBookerNames] = useState<Record<string, string>>({}); // booking_id → 예약자 실명
  const [scheduleByMd, setScheduleByMd] = useState<Record<string, DeployedScheduleItem>>({}); // 배포 일정(월-일 → 항목)
  const [listView, setListView] = useState<"month" | "week">("month");
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOfA(new Date()));
  const shiftWeek = (delta: number) => { const d = new Date(weekStart); d.setDate(d.getDate() + delta * 7); setWeekStart(mondayOfA(d)); };
  // 직원 신청 추가 모달
  const [deployedItems, setDeployedItems] = useState<DeployedScheduleItem[]>([]);
  const [students, setStudents] = useState<{ id: string; name_kr: string; name_en: string; booking_id: string | null; reserver: string; room: string }[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addStudentId, setAddStudentId] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [addTokens, setAddTokens] = useState<Set<string>>(new Set());
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    if (!isAdminAuthed()) { router.replace("/login"); return; }
    setAuthed(true);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    // 배포된 일정(프로그램명) 로드 — 신청 토큰을 날짜로 해석 + 직원 신청 모달용 원본
    try { const deployed = await loadDeployedSchedule(supabase); setDeployedItems(deployed); setScheduleByMd(buildScheduleByMd(deployed)); } catch { /* noop */ }
    // 직원 신청 모달용 학생 목록 (이름 + 예약자 + 방번호)
    try {
      const { data: st } = await supabase.from("students").select("id, name_kr, name_en, booking_id");
      const rows = (st || []) as { id: string; name_kr: string | null; name_en: string | null; booking_id: string | null }[];
      const bids = Array.from(new Set(rows.map(r => r.booking_id).filter(Boolean))) as string[];
      const bmap: Record<string, { booker_name: string | null; house_no: string | null; accom_room: string | null }> = {};
      if (bids.length) {
        const { data: bks } = await supabase.from("bookings").select("id, booker_name, house_no, accom_room").in("id", bids);
        (bks || []).forEach((b: { id: string; booker_name: string | null; house_no: string | null; accom_room: string | null }) => { bmap[b.id] = { booker_name: b.booker_name, house_no: b.house_no, accom_room: b.accom_room }; });
      }
      setStudents(rows.map(r => {
        const b = bmap[r.booking_id || ""];
        return {
          id: r.id, name_kr: (r.name_kr || "").trim(), name_en: (r.name_en || "").trim(), booking_id: r.booking_id,
          reserver: (b?.booker_name || "").trim(),
          room: String(b?.house_no || b?.accom_room || "").replace(/\s+/g, "").replace(/^dh/i, "").toUpperCase(),
        };
      }).filter(s => s.name_kr || s.name_en).sort((a, b) => a.name_kr.localeCompare(b.name_kr)));
    } catch { /* noop */ }
    const { data, error } = await supabase
      .from("fieldtrip_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setApps(data as FieldtripApp[]);
      // booking_id → 예약자 실명 매핑 (픽업·셔틀과 동일하게 실명 표시)
      const ids = Array.from(new Set((data as FieldtripApp[]).map(a => a.booking_id).filter(Boolean))) as string[];
      if (ids.length > 0) {
        const { data: bks } = await supabase.from("bookings").select("id, booker_name").in("id", ids);
        const map: Record<string, string> = {};
        (bks || []).forEach((b: { id: string; booker_name: string | null }) => { map[b.id] = (b.booker_name || "").trim(); });
        setBookerNames(map);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function saveAddSignup() {
    const stu = students.find(s => s.id === addStudentId);
    if (!stu) { alert("아이를 선택하세요."); return; }
    if (addTokens.size === 0) { alert("날짜를 1개 이상 선택하세요."); return; }
    setAddSaving(true);
    const { error } = await supabase.from("fieldtrip_applications").insert({
      name: stu.name_kr || stu.name_en,
      date: Array.from(addTokens).join(", "),
      message: "[직원 신청]", request: "[직원 신청]",
      booking_id: stu.booking_id, portal_name: stu.reserver || null,
      room_number: stu.room || null, status: "confirmed",
    });
    setAddSaving(false);
    if (error) { alert("저장 실패: " + error.message); return; }
    setAddOpen(false); setAddStudentId(""); setAddSearch(""); setAddTokens(new Set());
    load();
  }

  async function changeStatus(appId: number, status: string) {
    const prev = apps;
    setApps(apps.map(a => a.id === appId ? { ...a, status } : a));
    const { error } = await supabase.from("fieldtrip_applications").update({ status }).eq("id", appId);
    if (error) { alert("상태 변경 실패: " + error.message); setApps(prev); }
  }

  function toggleMonth(m: number) {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  }

  // 펼친 행 + 미분류 분리
  const flat: FlatRow[] = [];
  const legacy: FieldtripApp[] = [];
  for (const a of apps) {
    const tokens = (a.date || "").split(",").map(t => t.trim()).filter(Boolean);
    const childName = (a.name || "").trim();
    const reserver = (a.booking_id && bookerNames[a.booking_id]) || (a.portal_name || "").trim();
    const room = (a.room_number || "").trim();
    const request = (a.request || a.message || "").trim();
    const status = a.status || "pending";
    let pushedAny = false;
    for (const token of tokens) {
      const r = resolveProgram(token, scheduleByMd);
      if (!r) continue;
      flat.push({
        appId: a.id, childName, reserver, room, request, status, token,
        month: r.month, day: r.day,
        programName: r.name,
        isFieldtrip: r.isFieldtrip,
        time: r.time,
      });
      pushedAny = true;
    }
    if (!pushedAny) legacy.push(a);
  }

  // 토큰(=날짜+프로그램) 단위 그룹
  const groupMap = new Map<string, FlatRow[]>();
  for (const r of flat) {
    const arr = groupMap.get(r.token) || [];
    arr.push(r);
    groupMap.set(r.token, arr);
  }
  // 월 → 그룹들
  const monthMap = new Map<number, [string, FlatRow[]][]>();
  for (const [token, rows] of groupMap.entries()) {
    const m = rows[0].month;
    const arr = monthMap.get(m) || [];
    arr.push([token, rows]);
    monthMap.set(m, arr);
  }
  // 각 월 내부 그룹은 일→프로그램명 순 정렬
  for (const arr of monthMap.values()) {
    arr.sort((a, b) => (a[1][0].day - b[1][0].day) || a[1][0].programName.localeCompare(b[1][0].programName));
  }
  const monthChapters = Array.from(monthMap.entries()).sort((a, b) => a[0] - b[0]);

  // 주간 뷰 — 선택 주(월~일)의 날짜별 → 프로그램(token) 그룹
  const weekDays = (() => {
    const arr: { date: Date; key: string; label: string; groups: [string, FlatRow[]][] }[] = [];
    for (let i = 0; i < 7; i++) { const d = new Date(weekStart); d.setDate(d.getDate() + i); arr.push({ date: d, key: ymdA(d), label: `${d.getMonth() + 1}/${d.getDate()} (${KR_DOW[d.getDay()]})`, groups: [] }); }
    const year = weekStart.getFullYear();
    const dayMap = new Map<string, Map<string, FlatRow[]>>();
    for (const r of flat) {
      const k = ymdA(new Date(year, r.month - 1, r.day));
      if (!arr.find((x) => x.key === k)) continue;
      let g = dayMap.get(k); if (!g) { g = new Map(); dayMap.set(k, g); }
      const a = g.get(r.token) || []; a.push(r); g.set(r.token, a);
    }
    arr.forEach((d) => { const g = dayMap.get(d.key); if (g) d.groups = Array.from(g.entries()); });
    return arr;
  })();
  const wkLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()} ~ ${weekDays[6].date.getMonth() + 1}/${weekDays[6].date.getDate()}`;

  // 기본 펼침 월 초기화 (현재 월 또는 가장 가까운 미래 월)
  useEffect(() => {
    if (monthsInitDone) return;
    if (apps.length === 0) return;
    const months = new Set<number>();
    for (const a of apps) {
      for (const token of (a.date || "").split(",").map(t => t.trim()).filter(Boolean)) {
        const p = parseToken(token);
        if (p) months.add(p.month);
      }
    }
    if (months.size === 0) { setMonthsInitDone(true); return; }
    const sorted = Array.from(months).sort((a, b) => a - b);
    const curM = new Date().getMonth() + 1;
    const pick = sorted.find(m => m === curM) || sorted.find(m => m > curM) || sorted[sorted.length - 1];
    setExpandedMonths(new Set([pick]));
    setMonthsInitDone(true);
  }, [apps, monthsInitDone]);

  if (!authed) return null;

  const totalRows = flat.length + legacy.length;

  return (<>
    <style>{`
*{box-sizing:border-box}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.af-w{max-width:1400px;margin:0 auto;padding:24px}
.af-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.af-back{background:none;border:1px solid #cbd5e1;color:#475569;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit;font-weight:600}.af-back:hover{background:#fff;color:#1a6fc4}
.af-title{font-size:20px;font-weight:800;color:#1a1a2e}
.af-sub{font-size:13px;color:#6b7c93;margin-left:10px}
.af-card{background:#fff;border-radius:14px;padding:0;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow:hidden}
.af-tbl{width:100%;border-collapse:collapse;font-size:13px}
.af-tbl th{background:#f8fafc;text-align:left;padding:12px 14px;font-weight:700;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;white-space:nowrap}
.af-tbl td{padding:12px 14px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.af-tbl tr:hover td{background:#f8fafc}
.af-sel{padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit;background:#fff;cursor:pointer;font-weight:600}
.af-empty{padding:60px;text-align:center;color:#94a3b8;font-size:14px}
.af-loading{padding:40px;text-align:center;color:#3b82f6;font-size:14px}
.af-notes{max-width:280px;font-size:12px;color:#475569;white-space:pre-wrap}
    `}</style>
    <div className="af-w">
      <div className="af-head">
        <button className="af-back" onClick={() => router.push("/admin/hub")}>← 어드민 홈</button>
        <div>
          <span className="af-title">🎒 애프터스쿨/필드트립 관리</span>
          <span className="af-sub">총 {totalRows}건</span>
        </div>
        <div style={{ width: 100 }} />
      </div>

      <div style={{display:"flex",gap:6,background:"#fff",padding:4,borderRadius:12,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
        <button
          onClick={() => setMainTab("list")}
          style={{flex:1,padding:"10px 14px",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:mainTab==="list"?"#1a6fc4":"transparent",color:mainTab==="list"?"#fff":"#6b7c93"}}
        >📋 신청목록</button>
        <button
          onClick={() => setMainTab("deploy")}
          style={{flex:1,padding:"10px 14px",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:mainTab==="deploy"?"#1a6fc4":"transparent",color:mainTab==="deploy"?"#fff":"#6b7c93"}}
        >📅 배포</button>
      </div>

      {mainTab === "list" && (
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
          <button onClick={() => setAddOpen(true)} style={{padding:"9px 16px",border:"none",borderRadius:9,background:"#16a34a",color:"#fff",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>➕ 직원 신청 추가</button>
        </div>
      )}

      {mainTab === "deploy" ? (
        <AfterFieldDeploy />
      ) : loading ? (
        <div className="af-card"><div className="af-loading">불러오는 중...</div></div>
      ) : (monthChapters.length === 0 && legacy.length === 0) ? (
        <div className="af-card"><div className="af-empty">신청 내역이 없습니다.</div></div>
      ) : (
        <>
        <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center"}}>
          <span style={{fontSize:12,fontWeight:700,color:"#6b7c93",marginRight:2}}>보기</span>
          <button onClick={()=>setListView("month")} style={{padding:"6px 14px",borderRadius:8,border:"1px solid #cbd5e1",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,background:listView==="month"?"#16a34a":"#fff",color:listView==="month"?"#fff":"#475569"}}>📅 월별</button>
          <button onClick={()=>setListView("week")} style={{padding:"6px 14px",borderRadius:8,border:"1px solid #cbd5e1",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:700,background:listView==="week"?"#16a34a":"#fff",color:listView==="week"?"#fff":"#475569"}}>🗓️ 주간</button>
        </div>
        {listView === "week" && (
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <button onClick={()=>shiftWeek(-1)} style={wkNavBtn}>◀ 이전주</button>
              <button onClick={()=>setWeekStart(mondayOfA(new Date()))} style={wkNavBtn}>이번주</button>
              <button onClick={()=>shiftWeek(1)} style={wkNavBtn}>다음주 ▶</button>
              <b style={{fontSize:14}}>{wkLabel}</b>
            </div>
            {weekDays.every(d=>d.groups.length===0) ? (
              <div className="af-card"><div className="af-empty">이번 주 신청이 없습니다.</div></div>
            ) : weekDays.filter(d=>d.groups.length>0).map(d=>(
              <div key={d.key} className="af-card" style={{padding:"12px 16px"}}>
                <div style={{fontSize:14,fontWeight:800,marginBottom:8}}>{d.label}</div>
                {d.groups.map(([token,rows])=>{ const r0=rows[0]; return (
                  <div key={token} style={{border:"1px solid #e2e8f0",borderRadius:10,padding:"8px 12px",marginBottom:8,background:r0.isFieldtrip?"#fff7ed":"#fff"}}>
                    <div style={{fontSize:13,fontWeight:800,marginBottom:6,color:r0.isFieldtrip?"#c2410c":"#1a1a2e"}}>{r0.programName}{r0.isFieldtrip?" · 필드트립":""} <span style={{fontWeight:600,color:"#94a3b8"}}>· {rows.length}명</span></div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {rows.map((r,i)=>(<span key={i} style={{fontSize:12.5,fontWeight:600,background:"#f1f5f9",borderRadius:8,padding:"3px 9px"}}>{r.childName}{r.room?<span style={{color:"#1a6fc4",fontWeight:700}}> 🏠 {r.room}</span>:null}</span>))}
                    </div>
                  </div>
                );})}
              </div>
            ))}
          </div>
        )}
        <div style={{display: listView==="week" ? "none" : "flex", flexDirection:"column", gap:14}}>
          {monthChapters.map(([month, mGroups]) => {
            const open = expandedMonths.has(month);
            const mPeople = mGroups.reduce((s, [, rows]) => s + rows.length, 0);
            const mCount = mGroups.length;
            return (
              <div key={month}>
                <div
                  onClick={() => toggleMonth(month)}
                  style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:"#16a34a", color:"#fff", borderRadius:12, cursor:"pointer", boxShadow:"0 2px 8px rgba(22,163,74,0.18)"}}
                >
                  <div style={{fontSize:16, fontWeight:800, display:"flex", alignItems:"center", gap:8}}>
                    <span style={{fontSize:13}}>{open ? "▼" : "▶"}</span>📅 {month}월 <span style={{fontWeight:600, opacity:0.85}}>({mCount}건)</span>
                  </div>
                  <div style={{fontSize:13, fontWeight:700, color:"#15803d", background:"#fff", padding:"4px 14px", borderRadius:999}}>총 {mPeople}명</div>
                </div>
                {open && (
                <div style={{display:"flex", flexDirection:"column", gap:14, marginTop:12}}>
                  {mGroups.map(([token, rows]) => {
                    const r0 = rows[0];
                    const total = rows.length;
                    const dt = new Date(new Date().getFullYear(), r0.month - 1, r0.day);
                    const dowStr = isNaN(dt.getTime()) ? "" : ` (${KR_DOW[dt.getDay()]})`;
                    return (
                      <div key={token} className="af-card">
                        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background: r0.isFieldtrip ? "#fff7ed" : "#eff6ff", borderBottom: r0.isFieldtrip ? "1px solid #fed7aa" : "1px solid #bfdbfe"}}>
                          <div style={{fontSize:15, fontWeight:800, color:"#1a1a2e", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
                            📅 {r0.month}/{r0.day}{dowStr} · {r0.programName}
                            {r0.isFieldtrip && <span style={{fontSize:11, fontWeight:700, background:"#c2410c", color:"#fff", padding:"2px 8px", borderRadius:999}}>필드트립</span>}
                            {r0.time && <span style={{fontWeight:600, color:"#475569"}}>· {r0.time}</span>}
                          </div>
                          <div style={{fontSize:13, fontWeight:700, color: r0.isFieldtrip ? "#c2410c" : "#1d4ed8", background:"#fff", border: r0.isFieldtrip ? "1px solid #fed7aa" : "1px solid #bfdbfe", padding:"4px 12px", borderRadius:999}}>
                            총 {total}명
                          </div>
                        </div>
                        <table className="af-tbl">
                          <thead>
                            <tr>
                              <th style={{width:130}}>아이 이름</th>
                              <th style={{width:130}}>예약자</th>
                              <th style={{width:120}}>방 번호</th>
                              <th style={{width:70, textAlign:"center"}}>인원</th>
                              <th>요청사항</th>
                              <th style={{width:120}}>상태</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => {
                              const meta = STATUS_META[r.status] || STATUS_META.pending;
                              return (
                                <tr key={r.appId + "-" + r.token + "-" + i}>
                                  <td style={{fontWeight:600}}>{r.childName || "-"}</td>
                                  <td style={{color:"#475569"}}>{r.reserver || "-"}</td>
                                  <td style={{color:"#475569"}}>{r.room || "-"}</td>
                                  <td style={{textAlign:"center", fontWeight:700}}>1명</td>
                                  <td className="af-notes" title={r.request}>{r.request || "-"}</td>
                                  <td>
                                    <select
                                      className="af-sel"
                                      style={{background:meta.bg, color:meta.color, borderColor:meta.bg}}
                                      value={r.status}
                                      onChange={e => changeStatus(r.appId, e.target.value)}
                                    >
                                      <option value="pending">대기중</option>
                                      <option value="confirmed">확정</option>
                                      <option value="cancelled">취소</option>
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })}

          {legacy.length > 0 && (
            <div className="af-card">
              <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:"#f1f5f9", borderBottom:"1px solid #cbd5e1"}}>
                <div style={{fontSize:15, fontWeight:800, color:"#475569"}}>📦 미분류 (일정 미확인)</div>
                <div style={{fontSize:13, fontWeight:700, color:"#475569", background:"#fff", border:"1px solid #cbd5e1", padding:"4px 12px", borderRadius:999}}>총 {legacy.length}건</div>
              </div>
              <table className="af-tbl">
                <thead>
                  <tr>
                    <th style={{width:130}}>아이 이름</th>
                    <th style={{width:130}}>예약자</th>
                    <th style={{width:120}}>방 번호</th>
                    <th style={{width:160}}>선택 일정(원본)</th>
                    <th>요청사항</th>
                    <th style={{width:120}}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {legacy.map(a => {
                    const status = a.status || "pending";
                    const meta = STATUS_META[status] || STATUS_META.pending;
                    const req = (a.request || a.message || "").trim();
                    return (
                      <tr key={a.id}>
                        <td style={{fontWeight:600}}>{(a.name || "").trim() || "-"}</td>
                        <td style={{color:"#475569"}}>{((a.booking_id && bookerNames[a.booking_id]) || (a.portal_name || "").trim()) || "-"}</td>
                        <td style={{color:"#475569"}}>{(a.room_number || "").trim() || "-"}</td>
                        <td style={{color:"#475569", fontSize:12}}>{(a.date || "").trim() || "-"}</td>
                        <td className="af-notes" title={req}>{req || "-"}</td>
                        <td>
                          <select
                            className="af-sel"
                            style={{background:meta.bg, color:meta.color, borderColor:meta.bg}}
                            value={status}
                            onChange={e => changeStatus(a.id, e.target.value)}
                          >
                            <option value="pending">대기중</option>
                            <option value="confirmed">확정</option>
                            <option value="cancelled">취소</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
      )}

      {addOpen && (() => {
        const groups = (() => { const m = new Map<string, DeployedScheduleItem[]>(); for (const it of [...deployedItems].sort((a,b)=>a.date.localeCompare(b.date))) { const mk=it.date.slice(0,7); if(!m.has(mk)) m.set(mk,[]); m.get(mk)!.push(it); } return Array.from(m.entries()); })();
        const filtered = students.filter(s => { const q=addSearch.trim().toLowerCase(); return !q || (s.name_kr+s.name_en+s.reserver+s.room).toLowerCase().includes(q); });
        return (
        <div onClick={()=>setAddOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:200,padding:"36px 14px",overflowY:"auto"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,maxWidth:560,width:"100%",padding:22}}>
            <div style={{display:"flex",alignItems:"center",marginBottom:14}}>
              <h3 style={{fontSize:17,fontWeight:800,flex:1}}>➕ 직원 신청 추가</h3>
              <button onClick={()=>setAddOpen(false)} style={{border:"none",background:"none",fontSize:20,cursor:"pointer"}}>✕</button>
            </div>
            <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>1. 아이 선택</div>
            <input value={addSearch} onChange={e=>setAddSearch(e.target.value)} placeholder="이름·예약자 검색" style={{width:"100%",padding:"9px 11px",border:"1px solid #cbd5e1",borderRadius:9,fontSize:13,marginBottom:8,fontFamily:"inherit"}} />
            <div style={{maxHeight:168,overflowY:"auto",border:"1px solid #eef2f7",borderRadius:10,marginBottom:16}}>
              {filtered.length===0 ? <div style={{padding:14,color:"#cbd5e1",fontSize:13}}>{students.length===0?"학생 목록을 불러오는 중…":"검색 결과 없음"}</div> :
               filtered.slice(0,80).map(s => (
                <div key={s.id} onClick={()=>setAddStudentId(s.id)} style={{padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,background:addStudentId===s.id?"#eff6ff":"#fff",borderBottom:"1px solid #f1f5f9"}}>
                  <span style={{fontWeight:700,fontSize:13.5}}>{s.name_kr||s.name_en}</span>
                  {s.name_en && s.name_kr && <span style={{fontSize:12,color:"#64748b"}}>{s.name_en}</span>}
                  <span style={{marginLeft:"auto",fontSize:11.5,color:"#94a3b8"}}>{s.reserver}{s.room?` · 🏠${s.room}`:""}</span>
                  {addStudentId===s.id && <span style={{color:"#2563eb",fontWeight:800}}>✓</span>}
                </div>
              ))}
            </div>
            <div style={{fontSize:13,fontWeight:700,marginBottom:6}}>2. 날짜 선택 <span style={{fontWeight:600,color:"#94a3b8"}}>(복수 가능)</span></div>
            <div style={{maxHeight:240,overflowY:"auto",border:"1px solid #eef2f7",borderRadius:10,marginBottom:16}}>
              {groups.length===0 ? <div style={{padding:14,color:"#cbd5e1",fontSize:13}}>배포된 일정이 없습니다.</div> :
               groups.map(([mk,its]) => (
                <div key={mk}>
                  <div style={{padding:"6px 12px",fontSize:12,fontWeight:800,color:"#15803d",background:"#f0fdf4",position:"sticky",top:0}}>📅 {Number(mk.split("-")[1])}월</div>
                  {its.map(it => { const tok=tokenForItem(it); const on=addTokens.has(tok); const dt=new Date(it.date+"T00:00:00"); const ft=it.type==="fieldtrip"; return (
                    <label key={it.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 12px",cursor:"pointer",borderBottom:"1px solid #f8fafc",background:on?(ft?"#fff7ed":"#eff6ff"):"#fff"}}>
                      <input type="checkbox" checked={on} onChange={()=>setAddTokens(prev=>{const n=new Set(prev); if(n.has(tok))n.delete(tok); else n.add(tok); return n;})} />
                      <span style={{fontWeight:700,fontSize:12.5,color:ft?"#c2410c":"#1a1a2e"}}>{dt.getMonth()+1}/{dt.getDate()} ({KR_DOW[dt.getDay()]})</span>
                      <span style={{fontSize:12.5,color:"#334155"}}>{it.title}</span>
                      {ft && <span style={{fontSize:10,fontWeight:800,background:"#c2410c",color:"#fff",padding:"1px 6px",borderRadius:999}}>필드트립</span>}
                    </label>
                  );})}
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setAddOpen(false)} style={{padding:"11px 18px",border:"1px solid #cbd5e1",borderRadius:9,background:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
              <button onClick={saveAddSignup} disabled={addSaving} style={{flex:1,padding:"11px",border:"none",borderRadius:9,background:"#16a34a",color:"#fff",fontWeight:800,cursor:addSaving?"default":"pointer",fontFamily:"inherit",opacity:addSaving?0.7:1}}>{addSaving?"저장 중…":`신청 추가 (${addTokens.size}건)`}</button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  </>);
}
