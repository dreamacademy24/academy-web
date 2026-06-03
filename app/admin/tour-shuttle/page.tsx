"use client";
import { useEffect, useState, useCallback } from "react";
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

export default function TourShuttleAdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [apps, setApps] = useState<ShuttleApp[]>([]);
  const [bookingNumbers, setBookingNumbers] = useState<Record<string, string>>({});
  const [bookingNames, setBookingNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<"list" | "deploy">("list");
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ tour_name: "", tour_date: "", depart_time: "", portal_name: "", room_number: "", riders: "", people_count: 1, request: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [monthsInitDone, setMonthsInitDone] = useState(false);
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());

  function toggleMonth(m: string) {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  }

  // 주차는 기본 펼침 → 접힌 주차만 추적
  function toggleWeek(key: string) {
    setCollapsedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function deleteApp(id: string) {
    if (!window.confirm("이 신청 내역을 삭제할까요?")) return;
    const { error } = await supabase.from("shuttle_applications").delete().eq("id", id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    load();
  }

  async function saveAddManual() {
    if (!addForm.tour_name.trim() || !addForm.tour_date || !addForm.portal_name.trim()) {
      alert("투어명, 날짜, 예약자명은 필수입니다.");
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
    if (error) { alert("저장 실패: " + error.message); return; }
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
        const { data: bs } = await supabase.from("bookings").select("id, reservation_no, booker_name, students").in("id", ids);
        const numMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};
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
        });
        setBookingNumbers(numMap);
        setBookingNames(nameMap);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  // 월 챕터 기본 펼침 초기화 (현재 월 또는 가장 가까운 미래 월)
  useEffect(() => {
    if (monthsInitDone) return;
    const valid = apps.filter(a => (a.tour_name || "").trim() && (a.tour_date || "").trim());
    if (valid.length === 0) return;
    const months = Array.from(new Set(valid.map(a => (a.tour_date as string).slice(0, 7)))).sort();
    const now = new Date();
    const curM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const pick = months.find(m => m === curM) || months.find(m => m > curM) || months[months.length - 1];
    setExpandedMonths(new Set(pick ? [pick] : []));
    setMonthsInitDone(true);
  }, [apps, monthsInitDone]);

  async function changeStatus(id: string, status: string) {
    const prev = apps;
    setApps(apps.map(a => a.id === id ? { ...a, status } : a));
    const { error } = await supabase.from("shuttle_applications").update({ status }).eq("id", id);
    if (error) { alert("상태 변경 실패: " + error.message); setApps(prev); }
  }

  if (!authed) return null;

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
          <span className="ts-sub">총 {apps.length}건</span>
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
        const valid = apps.filter(a => (a.tour_name || "").trim() && (a.tour_date || "").trim());
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
        if (groups.length === 0 && legacy.length === 0) {
          return <div className="ts-card"><div className="ts-empty">신청 내역이 없습니다.</div></div>;
        }
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
        const monthChapters = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        return (
          <div style={{display:"flex", flexDirection:"column", gap:14}}>
            {monthChapters.map(([ym, mGroups]) => {
              const open = expandedMonths.has(ym);
              const mPeople = mGroups.reduce((s, [, l]) => s + l.reduce((ss, a) => ss + (a.people_count || 0), 0), 0);
              const mCount = mGroups.reduce((s, [, l]) => s + l.length, 0);
              return (
                <div key={ym}>
                  <div
                    onClick={() => toggleMonth(ym)}
                    style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:"#1a6fc4", color:"#fff", borderRadius:12, cursor:"pointer", boxShadow:"0 2px 8px rgba(26,111,196,0.18)"}}
                  >
                    <div style={{fontSize:16, fontWeight:800, display:"flex", alignItems:"center", gap:8}}>
                      <span style={{fontSize:13}}>{open ? "▼" : "▶"}</span>📅 {monthLabelKR(ym)} <span style={{fontWeight:600, opacity:0.85}}>({mCount}건)</span>
                    </div>
                    <div style={{fontSize:13, fontWeight:700, color:"#1a6fc4", background:"#fff", padding:"4px 14px", borderRadius:999}}>총 {mPeople}명</div>
                  </div>
                  {open && (
                  <div style={{display:"flex", flexDirection:"column", gap:12, marginTop:12}}>
            {(() => {
              const weekMap = new Map<number, [string, ShuttleApp[]][]>();
              for (const g of mGroups) {
                const d = Number(g[0].split("|")[0].slice(8, 10));
                const wn = Math.min(4, Math.floor((d - 1) / 7) + 1);
                const arr = weekMap.get(wn) || [];
                arr.push(g);
                weekMap.set(wn, arr);
              }
              const weeks = Array.from(weekMap.entries()).sort((a, b) => a[0] - b[0]);
              const [yy, mn] = ym.split("-").map(Number);
              const lastDay = new Date(yy, mn, 0).getDate();
              const weekRange = (wn: number) => {
                const startD = (wn - 1) * 7 + 1;
                const endD = wn === 4 ? lastDay : wn * 7;
                return `${mn}/${startD}~${mn}/${endD}`;
              };
              return weeks.map(([wn, weekGroups]) => {
                const weekKey = `${ym}-w${wn}`;
                const weekOpen = !collapsedWeeks.has(weekKey);
                const wPeople = weekGroups.reduce((s, [, l]) => s + l.reduce((ss, a) => ss + (a.people_count || 0), 0), 0);
                return (
                  <div key={weekKey}>
                    <div
                      onClick={() => toggleWeek(weekKey)}
                      style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:"#dbeafe", color:"#1e40af", borderRadius:10, cursor:"pointer"}}
                    >
                      <div style={{fontSize:14, fontWeight:800, display:"flex", alignItems:"center", gap:8}}>
                        <span style={{fontSize:12}}>{weekOpen ? "▼" : "▶"}</span>{wn}주차 <span style={{fontWeight:600, opacity:0.8}}>({weekRange(wn)})</span>
                      </div>
                      <div style={{fontSize:12.5, fontWeight:700, color:"#1e40af", background:"#fff", padding:"3px 12px", borderRadius:999}}>총 {wPeople}명</div>
                    </div>
                    {weekOpen && (
                    <div style={{display:"flex", flexDirection:"column", gap:14, marginTop:10}}>
            {weekGroups.map(([key, list]) => {
              const date = key.split("|")[0];
              const tour = key.split("|").slice(1).join("|");
              const total = list.reduce((s, a) => s + (a.people_count || 0), 0);
              const depart = list.find(a => (a.depart_time || "").trim())?.depart_time || "";
              return (
                <div key={key} className="ts-card">
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:"#eff6ff", borderBottom:"1px solid #bfdbfe"}}>
                    <div style={{fontSize:15, fontWeight:800, color:"#1a1a2e"}}>
                      📅 {fmtDateKR(date)} · {tour}{depart && <span style={{fontWeight:600, color:"#475569", marginLeft:8}}>· 출발 {depart}</span>}
                    </div>
                    <div style={{fontSize:13, fontWeight:700, color:"#1d4ed8", background:"#fff", border:"1px solid #bfdbfe", padding:"4px 12px", borderRadius:999}}>
                      총 {total}명
                    </div>
                  </div>
                  <table className="ts-tbl">
                    <thead>
                      <tr>
                        <th style={{width:120}}>예약자</th>
                        <th style={{width:120}}>픽업장소</th>
                        <th style={{width:150}}>탑승자</th>
                        <th style={{width:70, textAlign:"center"}}>인원</th>
                        <th>요청사항</th>
                        <th style={{width:120}}>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(a => {
                        const meta = STATUS_META[a.status] || STATUS_META.pending;
                        const req = a.request || a.message || "";
                        return (
                          <tr key={a.id}>
                            <td style={{fontWeight:600}}>{(a.booking_id && bookingNames[a.booking_id]) || a.portal_name || a.name || "-"}</td>
                            <td style={{color:"#475569"}}>{a.room_number || "-"}</td>
                            <td style={{color:"#475569"}}>{a.riders || "-"}</td>
                            <td style={{textAlign:"center", fontWeight:700}}>{a.people_count != null ? `${a.people_count}명` : "-"}</td>
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
              });
            })()}
                  </div>
                  )}
                </div>
              );
            })}

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
                      <th style={{width:120}}>픽업장소</th>
                      <th style={{width:150}}>탑승자</th>
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
                          <td style={{color:"#475569"}}>{a.room_number || "-"}</td>
                          <td style={{color:"#475569"}}>{a.riders || "-"}</td>
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
