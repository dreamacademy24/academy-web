"use client";
import React, { useEffect, useState, useCallback } from "react";
import { toastErr } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthed } from "@/lib/adminAuth";
import ScheduleDeploy from "./ScheduleDeploy";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ShuttleApp {
  id: string;
  created_at: string;
  booking_id: string | null;
  portal_name: string | null;
  name: string | null;
  room_number: string | null;
  tour_name: string | null;
  tour_date: string | null;
  depart_time: string | null;
  riders: string | null;
  people_count: number | null;
  request: string | null;
  message: string | null;
  status: string;
  cancel_reason: string | null;
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기중", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정",   bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
};

function fmtDate(s: string | null) {
  if (!s) return "-";
  return s.length >= 10 ? s.slice(0, 10) : s;
}

const ACC_KR: Record<string, string> = { jaypark: "제이파크", dreamhouse: "드림하우스", cubenine: "큐브나인" };

/** 콤보 예약: 투어 날짜가 seg2 구간이면 seg2 숙소명, 아니면 seg1 숙소명 반환 */
function resolveComboRoom(
  tourDate: string | null,
  info: { room: string; seg1_type?: string; seg2_type?: string; seg2_checkin?: string; accom_type?: string }
): string {
  if (!info) return "";
  const isCombo = info.seg1_type && info.seg2_type;
  if (!isCombo) return info.room || "";
  // 콤보: tourDate >= seg2_checkin → 둘째 숙소
  const td = (tourDate || "").slice(0, 10);
  const s2 = (info.seg2_checkin || "").slice(0, 10);
  if (td && s2 && td >= s2) {
    if (info.seg2_type === "dreamhouse" && info.room) return info.room;
    return ACC_KR[info.seg2_type!] || info.seg2_type || info.room;
  }
  if (info.seg1_type === "dreamhouse" && info.room) return info.room;
  return ACC_KR[info.seg1_type!] || info.seg1_type || info.room;
}

export default function TourShuttleAdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [apps, setApps] = useState<ShuttleApp[]>([]);
  const [bookingNumbers, setBookingNumbers] = useState<Record<string, string>>({});
  const [bookingNames, setBookingNames] = useState<Record<string, string>>({});
  const [bookingRooms, setBookingRooms] = useState<Record<string, { room: string; seg1_type?: string; seg2_type?: string; seg2_checkin?: string; accom_type?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<"list" | "deploy">("list");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ tour_name: "", tour_date: "", depart_time: "", portal_name: "", room_number: "", riders: "", people_count: 1, request: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [monthsInitDone, setMonthsInitDone] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "week">("list");
  const [weekStart, setWeekStart] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("");

  async function deleteApp(id: string) {
    if (!window.confirm("이 신청 내역을 삭제할까요?")) return;
    const { error } = await supabase.from("shuttle_applications").delete().eq("id", id);
    if (error) { toastErr("삭제 실패: " + error.message); return; }
    load();
  }

  async function saveAddManual() {
    if (!addForm.tour_name.trim() || !addForm.tour_date || !addForm.portal_name.trim()) {
      toastErr("투어명, 날짜, 예약자명은 필수입니다.");
      return;
    }
    setAddSaving(true);
    const { error } = await supabase.from("shuttle_applications").insert({
      tour_name: addForm.tour_name.trim(),
      tour_date: addForm.tour_date,
      depart_time: addForm.depart_time.trim() || null,
      portal_name: addForm.portal_name.trim(),
      name: addForm.portal_name.trim(),
      room_number: addForm.room_number.trim() || null,
      riders: addForm.riders.trim() || null,
      people_count: Number(addForm.people_count) || 1,
      request: addForm.request.trim() || null,
      message: addForm.request.trim() || null,
      status: "confirmed",
    });
    setAddSaving(false);
    if (error) { toastErr("저장 실패: " + error.message); return; }
    setAddOpen(false);
    setAddForm({ tour_name: "", tour_date: "", depart_time: "", portal_name: "", room_number: "", riders: "", people_count: 1, request: "" });
    load();
  }

  useEffect(() => {
    if (!isAdminAuthed()) { router.replace("/login"); return; }
    setAuthed(true);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shuttle_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setApps(data as ShuttleApp[]);
      const ids = Array.from(new Set(data.map(d => d.booking_id).filter(Boolean) as string[]));
      if (ids.length > 0) {
        const { data: bs } = await supabase.from("bookings").select("id, reservation_no, booker_name, students, house_no, accom_room, accom_type, seg1_type, seg1_checkin, seg1_checkout, seg2_type, seg2_checkin, seg2_checkout").in("id", ids);
        const numMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};
        const roomMap: Record<string, { room: string; seg1_type?: string; seg2_type?: string; seg2_checkin?: string; accom_type?: string }> = {};
        (bs || []).forEach((b: any) => {
          numMap[b.id] = b.reservation_no || "";
          // 예약자 이름: booker_name 우선, 없으면 students JSONB 대표자명 폴백
          let nm = (b.booker_name || "").trim();
          if (!nm && b.students) {
            try {
              const arr = typeof b.students === "string" ? JSON.parse(b.students) : b.students;
              if (Array.isArray(arr) && arr.length > 0) {
                const s0 = arr[0] || {};
                nm = (s0.korName || s0.name_kr || s0.name || s0.engName || s0.name_en || "").trim();
              }
            } catch { /* ignore parse error */ }
          }
          if (nm) nameMap[b.id] = nm;
          // 라이브 룸번호 + 콤보 seg 정보
          const rm = (b.house_no || b.accom_room || "").trim().replace(/^DH[\s-]*/i, "").toUpperCase();
          roomMap[b.id] = { room: rm, seg1_type: b.seg1_type, seg2_type: b.seg2_type, seg2_checkin: b.seg2_checkin, accom_type: b.accom_type };
        });
        setBookingNumbers(numMap);
        setBookingNames(nameMap);
        setBookingRooms(roomMap);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  // 월 탭 기본 선택 (현재 월)
  useEffect(() => {
    if (monthsInitDone) return;
    const now = new Date();
    const curM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(curM);
    setMonthsInitDone(true);
  }, [monthsInitDone]);

  async function changeStatus(id: string, status: string) {
    const prev = apps;
    setApps(apps.map(a => a.id === id ? { ...a, status } : a));
    const { error } = await supabase.from("shuttle_applications").update({ status }).eq("id", id);
    if (error) { toastErr("상태 변경 실패: " + error.message); setApps(prev); }
  }

  if (!authed) return null;

  // 지난 날짜 제외한 건수
  const _now2 = new Date();
  const _todayStr2 = `${_now2.getFullYear()}-${String(_now2.getMonth()+1).padStart(2,"0")}-${String(_now2.getDate()).padStart(2,"0")}`;
  const futureCount = apps.filter(a => (a.tour_name || "").trim() && (a.tour_date || "").trim() && (a.tour_date || "") >= _todayStr2).length;

  return (<>
    <style>{`
*{box-sizing:border-box}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.ts-w{max-width:1400px;margin:0 auto;padding:24px}
.ts-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.ts-back{background:none;border:1px solid #cbd5e1;color:#475569;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit;font-weight:600}.ts-back:hover{background:#fff;color:#1a6fc4}
.ts-title{font-size:20px;font-weight:800;color:#1a1a2e}
.ts-sub{font-size:13px;color:#6b7c93;margin-left:10px}
.ts-card{background:#fff;border-radius:14px;padding:0;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow:hidden}
.ts-tbl{width:100%;border-collapse:collapse;font-size:13px}
.ts-tbl th{background:#f8fafc;text-align:left;padding:12px 14px;font-weight:700;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;white-space:nowrap}
.ts-tbl td{padding:12px 14px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.ts-tbl tr:hover td{background:#f8fafc}
.ts-sel{padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit;background:#fff;cursor:pointer;font-weight:600}
.ts-empty{padding:60px;text-align:center;color:#94a3b8;font-size:14px}
.ts-loading{padding:40px;text-align:center;color:#3b82f6;font-size:14px}
.ts-notes{max-width:280px;font-size:12px;color:#475569;white-space:pre-wrap}
    `}</style>
    <div className="ts-w">
      <div className="ts-head">
        <button className="ts-back" onClick={() => router.push("/admin/hub")}>← 어드민 홈</button>
        <div>
          <span className="ts-title">🚌 투어셔틀 관리</span>
          <span className="ts-sub">총 {futureCount}건</span>
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

      {mainTab === "deploy" ? (
        <ScheduleDeploy />
      ) : (
      <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          onClick={() => setAddOpen(true)}
          style={{ padding: "8px 14px", background: "#1a6fc4", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
        >+ 신청 직접 추가</button>
      </div>
      {loading ? (
        <div className="ts-card"><div className="ts-loading">불러오는 중...</div></div>
      ) : (() => {
        // 투어명+tour_date 둘 다 존재 → 정상 그룹 / 둘 중 하나 없으면 → 미분류
        const _n = new Date(); const _tdy = `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,"0")}-${String(_n.getDate()).padStart(2,"0")}`;
        const valid = apps.filter(a => (a.tour_name || "").trim() && (a.tour_date || "").trim() && (a.tour_date || "") >= _tdy);
        const legacy = apps.filter(a => !((a.tour_name || "").trim() && (a.tour_date || "").trim()));
        const groupMap = new Map<string, ShuttleApp[]>();
        for (const a of valid) {
          const key = `${a.tour_date}|${a.tour_name}`;
          const arr = groupMap.get(key) || [];
          arr.push(a);
          groupMap.set(key, arr);
        }
        const groups = Array.from(groupMap.entries()).sort((a, b) => {
          const da = a[0].split("|")[0];
          const db = b[0].split("|")[0];
          return da.localeCompare(db);
        });
        const KR_DOW = ["일","월","화","수","목","금","토"];
        const fmtDateKR = (s: string) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
          const dt = new Date(s + "T00:00:00");
          if (isNaN(dt.getTime())) return s;
          return `${dt.getMonth()+1}/${dt.getDate()} (${KR_DOW[dt.getDay()]})`;
        };
        const monthLabelKR = (ym: string) => {
          const [y, mm] = ym.split("-");
          const curY = new Date().getFullYear();
          return Number(y) === curY ? `${Number(mm)}월` : `${y}년 ${Number(mm)}월`;
        };
        const monthMap = new Map<string, [string, ShuttleApp[]][]>();
        for (const g of groups) {
          const m = g[0].split("|")[0].slice(0, 7);
          const arr = monthMap.get(m) || [];
          arr.push(g);
          monthMap.set(m, arr);
        }
        const curYear = new Date().getFullYear();
        const fixedMonths: string[] = [];
        for (let mo = 6; mo <= 12; mo++) fixedMonths.push(`${curYear}-${String(mo).padStart(2, "0")}`);
        const allMonthKeys = Array.from(new Set([...fixedMonths, ...monthMap.keys()]));
        const monthChapters: [string, [string, ShuttleApp[]][]][] = allMonthKeys
          .sort((a, b) => a.localeCompare(b))
          .map(ym => [ym, monthMap.get(ym) || []] as [string, [string, ShuttleApp[]][]]);
        const selKey = monthChapters.some(([ym]) => ym === selectedMonth) ? selectedMonth : (monthChapters[0]?.[0] || "");
        const isActive = (a: ShuttleApp) => { const v = String(a.status || "").toLowerCase(); return v !== "cancelled" && v !== "cancel" && v !== "cancel_requested"; };
        const isReq = (a: ShuttleApp) => String(a.status || "").toLowerCase() === "cancel_requested";
        const isCanc = (a: ShuttleApp) => { const v = String(a.status || "").toLowerCase(); return v === "cancelled" || v === "cancel"; };
        const selChapter = monthChapters.find(([ym]) => ym === selKey);
        const selGroups: [string, ShuttleApp[]][] = selChapter ? selChapter[1] : [];
        const mPeople = selGroups.reduce((s, [, l]) => s + l.filter(isActive).reduce((ss, a) => ss + (a.people_count || 0), 0), 0);
        const mCount = selGroups.reduce((s, [, l]) => s + l.filter(isActive).length, 0);
        const DOW_BADGE = (date: string) => {
          const d = new Date(date + "T00:00:00").getDay();
          const nm = ["일","월","화","수","목","금","토"][d];
          const st = d === 0 ? {bg:"#FCEBEB", c:"#A32D2D"} : d === 6 ? {bg:"#FAEEDA", c:"#854F0B"} : {bg:"#E6F1FB", c:"#185FA5"};
          return <span style={{background:st.bg, color:st.c, fontSize:11, fontWeight:800, borderRadius:8, padding:"2px 9px", flexShrink:0}}>{nm}</span>;
        };
        const chipS: React.CSSProperties = {display:"inline-flex", alignItems:"center", gap:5, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:999, padding:"4px 12px", fontSize:12.5, whiteSpace:"nowrap"};
        const renderTourCard = ([key, list]: [string, ShuttleApp[]]) => {
          const date = key.split("|")[0];
          const tour = key.split("|").slice(1).join("|");
          const depart = list.find(a => (a.depart_time || "").trim())?.depart_time || "";
          const activeList = list.filter(isActive);
          const reqList = list.filter(isReq);
          const cancList = list.filter(isCanc);
          const tourTotal = activeList.reduce((s2, a) => s2 + (a.people_count || 0), 0);
          const chipInfo = (a: ShuttleApp) => {
            const liveRoom = a.booking_id && bookingRooms[a.booking_id] ? resolveComboRoom(a.tour_date, bookingRooms[a.booking_id]) : "";
            const room = liveRoom || a.room_number || "";
            const nm = (a.booking_id ? bookingNames[a.booking_id] : "") || a.portal_name || "";
            return { room, nm };
          };
          const reqNotes = activeList.map(a => a.request || a.message || "").filter(Boolean);
          return (
            <div key={key} style={{background:"#fff", border:"1px solid #e2e8f0", borderRadius:14, padding:"12px 16px", boxShadow:"0 1px 4px rgba(15,23,42,0.04)"}}>
              <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
                {DOW_BADGE(date)}
                <span style={{fontSize:14, fontWeight:800, color:"#1a1a2e"}}>{fmtDateKR(date)} · {tour}</span>
                {depart && <span style={{fontSize:12, color:"#94a3b8", fontWeight:600}}>출발 {depart}</span>}
                <span style={{marginLeft:"auto", fontSize:12.5, fontWeight:800, color:"#1d4ed8", background:"#eff6ff", border:"1px solid #bfdbfe", padding:"3px 12px", borderRadius:999}}>총 {tourTotal}명</span>
              </div>
              <div style={{display:"flex", gap:6, flexWrap:"wrap", marginTop:9}}>
                {activeList.map(a => {
                  const { room, nm } = chipInfo(a);
                  return (
                    <span key={a.id} style={chipS} title={a.request || a.message || ""}>
                      {nm && <b style={{fontWeight:700, color:"#1a1a2e"}}>{nm}</b>}
                      {room && <span style={{color:"#94a3b8", fontSize:11.5}}>{room}</span>}
                      <b style={{fontWeight:800, color:"#1d4ed8"}}>{a.people_count ?? "-"}</b>
                    </span>
                  );
                })}
                {reqList.map(a => {
                  const { room, nm } = chipInfo(a);
                  return (
                    <span key={a.id} style={{...chipS, background:"#fffbeb", borderColor:"#fde68a", color:"#92400e"}} title={a.cancel_reason ? `사유: ${a.cancel_reason}` : "취소요청"}>
                      <b style={{fontWeight:700}}>{nm || room}</b> {a.people_count ?? ""} · 취소요청
                      <button onClick={() => changeStatus(a.id, "cancelled")} style={{border:"none", background:"#92400e", color:"#fff", borderRadius:999, fontSize:11, padding:"1px 8px", cursor:"pointer", fontFamily:"inherit"}}>확정</button>
                    </span>
                  );
                })}
                {cancList.map(a => {
                  const { room, nm } = chipInfo(a);
                  return (
                    <span key={a.id} style={{...chipS, background:"#fef2f2", borderColor:"#fecaca", color:"#b91c1c"}}>
                      <s>{nm || room} · {a.people_count ?? ""}</s> 취소
                      <button onClick={() => changeStatus(a.id, "confirmed")} style={{border:"none", background:"transparent", color:"#b91c1c", textDecoration:"underline", fontSize:11, cursor:"pointer", fontFamily:"inherit", padding:0}}>되돌리기</button>
                    </span>
                  );
                })}
              </div>
              {reqNotes.length > 0 && (
                <div style={{marginTop:7, fontSize:12, color:"#64748b"}}>📝 {reqNotes.join(" · ")}</div>
              )}
            </div>
          );
        };
        const addDays = (ymd: string, n: number) => { const dt = new Date(ymd + "T00:00:00"); dt.setDate(dt.getDate() + n); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`; };
        const fmtMD = (ymd: string) => { const dt = new Date(ymd + "T00:00:00"); return `${dt.getMonth()+1}/${dt.getDate()}`; };
        const todayYmd = (() => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`; })();
        const todayMon = (() => { const x = new Date(); const dow = (x.getDay()+6)%7; x.setDate(x.getDate()-dow); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`; })();
        const wkStart = weekStart || todayMon;
        const weekDays = Array.from({length:7}, (_, i) => addDays(wkStart, i));
        const DOW_MON = ["월","화","수","목","금","토","일"];
        const byDate = new Map<string, [string, ShuttleApp[]][]>();
        for (const g of groups) { const d = g[0].split("|")[0]; const arr = byDate.get(d) || []; arr.push(g); byDate.set(d, arr); }
        const dayDetail: [string, ShuttleApp[]][] = selectedDay ? (byDate.get(selectedDay) || []) : [];
        return (
          <div style={{display:"flex", flexDirection:"column", gap:14}}>
            <div style={{display:"flex", gap:6, background:"#fff", padding:4, borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
              <button onClick={() => setViewMode("list")} style={{flex:1, padding:"9px 14px", border:"none", borderRadius:9, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background: viewMode==="list" ? "#1a6fc4" : "transparent", color: viewMode==="list" ? "#fff" : "#6b7c93"}}>📋 일자목록</button>
              <button onClick={() => setViewMode("week")} style={{flex:1, padding:"9px 14px", border:"none", borderRadius:9, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background: viewMode==="week" ? "#1a6fc4" : "transparent", color: viewMode==="week" ? "#fff" : "#6b7c93"}}>📅 주간보드</button>
            </div>
            {viewMode === "list" ? (
            <>
            <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
              {monthChapters.map(([ym, mGroups]) => {
                const tabCount = mGroups.reduce((s, [, l]) => s + l.filter(isActive).length, 0);
                const active = ym === selKey;
                return (
                  <button key={ym} onClick={() => setSelectedMonth(ym)} style={{padding:"10px 16px", borderRadius:10, border: active ? "none" : "1px solid #cbd5e1", background: active ? "#1a6fc4" : "#fff", color: active ? "#fff" : "#475569", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow: active ? "0 2px 8px rgba(26,111,196,0.25)" : "none"}}>
                    {monthLabelKR(ym)} <span style={{fontWeight:600, opacity:0.85, fontSize:12}}>({tabCount})</span>
                  </button>
                );
              })}
            </div>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:"#1a6fc4", color:"#fff", borderRadius:12, boxShadow:"0 2px 8px rgba(26,111,196,0.18)"}}>
              <div style={{fontSize:16, fontWeight:800}}>📅 {monthLabelKR(selKey)} <span style={{fontWeight:600, opacity:0.85}}>({mCount}건)</span></div>
              <div style={{fontSize:13, fontWeight:700, color:"#1a6fc4", background:"#fff", padding:"4px 14px", borderRadius:999}}>총 {mPeople}명</div>
            </div>
            {selGroups.length === 0 ? (
              <div className="ts-card"><div className="ts-empty">이 달은 신청 내역이 없습니다.</div></div>
            ) : selGroups.map(renderTourCard)}
            </>
            ) : (
            <>
            <div style={{display:"flex", alignItems:"center", justifyContent:"center", gap:16, padding:"8px 0"}}>
              <button onClick={() => { setWeekStart(addDays(wkStart, -7)); setSelectedDay(""); }} style={{padding:"6px 14px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff", color:"#475569", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit"}}>◀</button>
              <div style={{fontSize:15, fontWeight:800, color:"#1a1a2e", minWidth:130, textAlign:"center"}}>{fmtMD(wkStart)} ~ {fmtMD(addDays(wkStart, 6))}</div>
              <button onClick={() => { setWeekStart(addDays(wkStart, 7)); setSelectedDay(""); }} style={{padding:"6px 14px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff", color:"#475569", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit"}}>▶</button>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:6}}>
              {weekDays.map((day, i) => {
                const dt = new Date(day + "T00:00:00");
                const dayGroups = byDate.get(day) || [];
                const isToday = day === todayYmd;
                const isSel = day === selectedDay;
                return (
                  <div key={day} onClick={() => setSelectedDay(isSel ? "" : day)} style={{minHeight:92, border: isSel ? "2px solid #1a6fc4" : (isToday ? "1px solid #1a6fc4" : "1px solid #e2e8f0"), borderRadius:10, padding:6, background: dayGroups.length ? "#fff" : "#f8fafc", cursor:"pointer"}}>
                    <div style={{fontSize:11, fontWeight:700, color: isToday ? "#1a6fc4" : "#94a3b8", textAlign:"center", marginBottom:4}}>{DOW_MON[i]} {dt.getDate()}</div>
                    {dayGroups.map(([key, list]) => {
                      const tour = key.split("|").slice(1).join("|");
                      const t = list.filter(isActive).reduce((ss, a) => ss + (a.people_count || 0), 0);
                      return (
                        <div key={key} style={{fontSize:11, lineHeight:1.3, marginBottom:3, padding:"3px 4px", background:"#eff6ff", borderRadius:5}}>
                          <div style={{fontWeight:700, color:"#1d4ed8", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{tour}</div>
                          <div style={{color:"#1a6fc4"}}>{t}명</div>
                        </div>
                      );
                    })}
                    {dayGroups.length === 0 && <div style={{fontSize:11, color:"#cbd5e1", textAlign:"center"}}>·</div>}
                  </div>
                );
              })}
            </div>
            {selectedDay && (
              dayDetail.length > 0
                ? <div style={{display:"flex", flexDirection:"column", gap:12}}>{dayDetail.map(renderTourCard)}</div>
                : <div className="ts-card"><div className="ts-empty">{fmtMD(selectedDay)} 신청 내역이 없습니다.</div></div>
            )}
            </>
            )}

            {legacy.length > 0 && (
              <div className="ts-card">
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:"#f1f5f9", borderBottom:"1px solid #cbd5e1"}}>
                  <div style={{fontSize:15, fontWeight:800, color:"#475569"}}>📦 미분류 (구형 데이터)</div>
                  <div style={{fontSize:13, fontWeight:700, color:"#475569", background:"#fff", border:"1px solid #cbd5e1", padding:"4px 12px", borderRadius:999}}>총 {legacy.length}건</div>
                </div>
                <table className="ts-tbl">
                  <thead>
                    <tr>
                      <th style={{width:120}}>예약자</th>
                      <th style={{width:120}}>신청 집</th>
                      <th style={{width:70, textAlign:"center"}}>인원</th>
                      <th style={{width:130}}>날짜/투어</th>
                      <th>요청사항</th>
                      <th style={{width:120}}>상태</th>
                      <th style={{width:70, textAlign:"center"}}>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {legacy.map(a => {
                      const meta = STATUS_META[a.status] || STATUS_META.pending;
                      const req = a.request || a.message || "";
                      const dt = (a.tour_name || "").trim() || (a.tour_date || "").trim() || "-";
                      return (
                        <tr key={a.id}>
                          <td style={{fontWeight:600}}>{(a.booking_id && bookingNames[a.booking_id]) || a.portal_name || a.name || "-"}</td>
                          <td style={{color:"#475569"}}>{(a.booking_id && bookingRooms[a.booking_id] ? resolveComboRoom(a.tour_date, bookingRooms[a.booking_id]) : "") || a.room_number || "-"}</td>
                          <td style={{textAlign:"center", fontWeight:700}}>{a.people_count != null ? `${a.people_count}명` : "-"}</td>
                          <td style={{color:"#475569", fontSize:12}}>{dt}</td>
                          <td className="ts-notes" title={req}>{req || "-"}</td>
                          <td>
                            <select
                              className="ts-sel"
                              style={{background:meta.bg, color:meta.color, borderColor:meta.bg}}
                              value={a.status}
                              onChange={e => changeStatus(a.id, e.target.value)}
                            >
                              <option value="pending">대기중</option>
                              <option value="confirmed">확정</option>
                              <option value="cancelled">취소</option>
                            </select>
                          </td>
                          <td style={{textAlign:"center"}}>
                            <button
                              onClick={() => deleteApp(a.id)}
                              title="삭제"
                              style={{padding:"5px 10px", border:"none", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", background:"#fef2f2", color:"#dc2626"}}
                            >🗑️ 삭제</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}
      </>
      )}
    </div>

    {addOpen && (
      <div onClick={() => setAddOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>🚌 신청 직접 추가</h3>
            <button onClick={() => setAddOpen(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>✕</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ gridColumn: "1 / 3", fontSize: 12, fontWeight: 700, color: "#374151" }}>
              투어명 <span style={{ color: "#dc2626" }}>*</span>
              <input type="text" value={addForm.tour_name} onChange={e => setAddForm(p => ({ ...p, tour_name: e.target.value }))} placeholder="예: 세부 사파리" style={{ width: "100%", marginTop: 4, padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
              날짜 <span style={{ color: "#dc2626" }}>*</span>
              <input type="date" value={addForm.tour_date} onChange={e => setAddForm(p => ({ ...p, tour_date: e.target.value }))} style={{ width: "100%", marginTop: 4, padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
              출발 시간
              <input type="text" value={addForm.depart_time} onChange={e => setAddForm(p => ({ ...p, depart_time: e.target.value }))} placeholder="예: 8:30am" style={{ width: "100%", marginTop: 4, padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
              예약자 <span style={{ color: "#dc2626" }}>*</span>
              <input type="text" value={addForm.portal_name} onChange={e => setAddForm(p => ({ ...p, portal_name: e.target.value }))} placeholder="홍길동" style={{ width: "100%", marginTop: 4, padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
              픽업장소
              <input type="text" value={addForm.room_number} onChange={e => setAddForm(p => ({ ...p, room_number: e.target.value }))} placeholder="예: 드림하우스 B16 L19" style={{ width: "100%", marginTop: 4, padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
              탑승자
              <input type="text" value={addForm.riders} onChange={e => setAddForm(p => ({ ...p, riders: e.target.value }))} placeholder="예: 김지아, 김지우" style={{ width: "100%", marginTop: 4, padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
              인원
              <input type="number" min={1} max={6} value={addForm.people_count} onChange={e => setAddForm(p => ({ ...p, people_count: Number(e.target.value) || 1 }))} style={{ width: "100%", marginTop: 4, padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            </label>
            <label style={{ gridColumn: "1 / 3", fontSize: 12, fontWeight: 700, color: "#374151" }}>
              요청사항
              <textarea value={addForm.request} onChange={e => setAddForm(p => ({ ...p, request: e.target.value }))} placeholder="기타 요청사항 (선택)" style={{ width: "100%", marginTop: 4, padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", minHeight: 70, resize: "vertical" }} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setAddOpen(false)} disabled={addSaving} style={{ padding: "9px 16px", border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff", color: "#475569", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>취소</button>
            <button onClick={saveAddManual} disabled={addSaving} style={{ padding: "9px 18px", border: "none", borderRadius: 7, background: "#1a6fc4", color: "#fff", fontSize: 13, fontWeight: 700, cursor: addSaving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: addSaving ? 0.6 : 1 }}>{addSaving ? "저장중..." : "💾 저장"}</button>
          </div>
        </div>
      </div>
    )}
  </>);
}
