"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

/* ──── Types ──── */
interface Item { content: string; status: string }
interface Room { room_no: string; items: Item[] }
interface Report {
  id: string; reporter: string; report_date: string;
  time_slot: "morning" | "afternoon" | "checkin";
  rooms: Room[]; memo: string | null; created_at: string;
}
interface PendingItem { id: string; room_no: string; content: string; status: string; created_at: string }

/* ──── Constants ──── */
const SLOT_LABEL: Record<string, string> = { morning: "🌅 오전", afternoon: "☀️ 오후", checkin: "🌙 체크인" };
const SLOT_BG: Record<string, string> = { morning: "#fef3c7", afternoon: "#fed7aa", checkin: "#ddd6fe" };
const SLOT_COLOR: Record<string, string> = { morning: "#92400e", afternoon: "#9a3412", checkin: "#5b21b6" };

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; bold: boolean }> = {
  done:     { label: "해결",   bg: "#dcfce7", color: "#166534", bold: false },
  progress: { label: "해결중", bg: "#fed7aa", color: "#9a3412", bold: true  },
  problem:  { label: "문제",   bg: "#fecaca", color: "#991b1b", bold: true  },
  check:    { label: "확인필요", bg: "#fecaca", color: "#991b1b", bold: true },
};

const HOUSE_ROOMS = ['b17-4','b17-5','b17-6','b17-7','b17-8','b17-9','b17-10','b17-11','b17-12','b17-13','b17-14','b17-15','b17-16','b17-17','b17-18','b16-19','b13-10'];

/* ──── Helpers ──── */
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function addDays(s: string, n: number) { const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function defaultTimeSlot() { const h = new Date().getHours(); if (h < 12) return "morning"; if (h < 18) return "afternoon"; return "checkin"; }

/* ──── Component ──── */
export default function HouseReportsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [mainTab, setMainTab] = useState<"view" | "write">("view");

  // --- View tab state ---
  const [reports, setReports] = useState<Report[]>([]);
  const [slot, setSlot] = useState<"all" | "morning" | "afternoon" | "checkin">("all");
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [creating, setCreating] = useState<string | null>(null);

  // --- Write tab state ---
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [formDate, setFormDate] = useState(todayStr());
  const [formSlot, setFormSlot] = useState(defaultTimeSlot());
  const [formRooms, setFormRooms] = useState<Room[]>([]);
  const [formMemo, setFormMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Report[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  // --- Who is logged in ---
  const [reporter, setReporter] = useState("unknown");

  useEffect(() => {
    if (isAdminAuthed()) { setAuthed(true); }
    else if (typeof window !== "undefined") window.location.href = "/login";
    // Get reporter from localStorage admin session
    if (typeof window !== "undefined") {
      try {
        const s = localStorage.getItem("admin_user");
        if (s) setReporter(s);
      } catch { /* ignore */ }
    }
  }, []);

  /* ──── View: load reports ──── */
  const loadReports = useCallback(async () => {
    if (!authed) return;
    const res = await fetch(`/api/house-reports?from=${dateFrom}&to=${dateTo}&slot=${slot}`);
    if (res.ok) { const d = await res.json(); setReports(d.reports || []); }
  }, [authed, dateFrom, dateTo, slot]);

  useEffect(() => { loadReports(); }, [loadReports]);

  /* ──── Write: load pending + history ──── */
  const loadPending = useCallback(async () => {
    if (!authed) return;
    try {
      const res = await fetch("/api/house-reports?action=pending");
      if (res.ok) { const d = await res.json(); setPending(d.items || []); }
    } catch { setPending([]); }
  }, [authed]);

  const loadHistory = useCallback(async () => {
    if (!authed) return;
    const t = todayStr();
    const from7 = addDays(t, -6);
    const res = await fetch(`/api/house-reports?from=${from7}&to=${t}`);
    if (res.ok) { const d = await res.json(); setHistory(d.reports || []); }
  }, [authed]);

  useEffect(() => {
    if (mainTab === "write") { loadPending(); loadHistory(); }
  }, [mainTab, loadPending, loadHistory]);

  /* ──── View: helpers ──── */
  function setDateRange(type: "today" | "yesterday" | "week") {
    const t = todayStr();
    if (type === "today") { setDateFrom(t); setDateTo(t); }
    else if (type === "yesterday") { const y = addDays(t, -1); setDateFrom(y); setDateTo(y); }
    else { setDateFrom(addDays(t, -6)); setDateTo(t); }
  }

  async function createTask(room_no: string, item: Item, rReporter: string, report_date: string, key: string) {
    setCreating(key);
    const res = await fetch("/api/house-reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_task", room_no, content: item.content, status: item.status, reporter: rReporter, report_date }),
    });
    setCreating(null);
    if (!res.ok) { const r = await res.json(); alert(r.error || "생성 실패"); return; }
    alert("✓ 업무가 생성되었습니다");
  }

  /* ──── Write: form actions ──── */
  function addRoom() { setFormRooms([...formRooms, { room_no: "", items: [{ content: "", status: "problem" }] }]); }
  function removeRoom(idx: number) { setFormRooms(formRooms.filter((_, i) => i !== idx)); }
  function setRoomNo(idx: number, v: string) { const r = [...formRooms]; r[idx] = { ...r[idx], room_no: v }; setFormRooms(r); }
  function addItem(rIdx: number) { const r = [...formRooms]; r[rIdx] = { ...r[rIdx], items: [...r[rIdx].items, { content: "", status: "problem" }] }; setFormRooms(r); }
  function removeItem(rIdx: number, iIdx: number) { const r = [...formRooms]; r[rIdx] = { ...r[rIdx], items: r[rIdx].items.filter((_, i) => i !== iIdx) }; setFormRooms(r); }
  function setItemContent(rIdx: number, iIdx: number, v: string) { const r = [...formRooms]; r[rIdx] = { ...r[rIdx], items: r[rIdx].items.map((it, i) => i === iIdx ? { ...it, content: v } : it) }; setFormRooms(r); }
  function setItemStatus(rIdx: number, iIdx: number, s: string) { const r = [...formRooms]; r[rIdx] = { ...r[rIdx], items: r[rIdx].items.map((it, i) => i === iIdx ? { ...it, status: s } : it) }; setFormRooms(r); }

  async function updatePendingStatus(id: string, status: string) {
    const res = await fetch("/api/house-reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_pending", id, status }),
    });
    if (res.ok) loadPending();
    else alert("상태 변경 실패");
  }

  async function submitReport() {
    if (!formRooms.length) { alert("호실을 1개 이상 추가해주세요"); return; }
    const validRooms = formRooms.filter(r => r.room_no);
    if (!validRooms.length) { alert("호실 번호를 입력해주세요"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/house-reports", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          reporter,
          report_date: formDate,
          time_slot: formSlot,
          rooms: validRooms,
          memo: formMemo || null,
        }),
      });
      if (!res.ok) { const r = await res.json(); alert(r.error || "제출 실패"); return; }
      alert("보고 완료! ✅");
      setFormRooms([]);
      setFormMemo("");
      setFormDate(todayStr());
      setFormSlot(defaultTimeSlot());
      loadPending();
      loadHistory();
      setMainTab("view"); setSlot("all");
      loadReports();
    } catch (e) {
      alert("제출 실패: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setSubmitting(false);
    }
  }

  /* ──── Stats (View tab) ──── */
  const todayReports = reports.filter(r => r.report_date === todayStr());
  let progressCount = 0, checkCount = 0;
  reports.forEach(r => r.rooms?.forEach(rm => rm.items?.forEach(it => {
    if (it.status === "progress") progressCount++;
    if (it.status === "check" || it.status === "problem") checkCount++;
  })));

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f9fafb;color:#111827}
.hr-w{max-width:900px;margin:0 auto;padding:28px 20px}
.hr-top{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.hr-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.hr-back:hover{background:#e5e7eb}
.hr-top h1{font-size:22px;font-weight:800;flex:1}
.main-tabs{display:flex;gap:0;background:#fff;border-radius:12px;margin-bottom:20px;border:1px solid #e5e7eb;overflow:hidden}
.main-tab{flex:1;padding:14px;font-size:15px;font-weight:700;text-align:center;border:none;cursor:pointer;font-family:inherit;background:transparent;color:#6b7280;transition:all .2s}
.main-tab.ac{background:#2563eb;color:#fff}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
.stat{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px}
.stat .lbl{font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px}
.stat .val{font-size:22px;font-weight:800;color:#111827}
.stat.warn{background:#fff7ed;border-color:#fdba74}.stat.warn .val{color:#9a3412}
.stat.danger{background:#fef2f2;border-color:#fca5a5}.stat.danger .val{color:#991b1b}
.toolbar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
.date-quick{display:flex;gap:4px}
.date-quick button{padding:6px 12px;border:1px solid #d1d5db;border-radius:7px;background:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}.date-quick button:hover{background:#f3f4f6}
.date-input{padding:6px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:12px;font-family:inherit;outline:none}
.tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:10px;margin-bottom:16px;border:1px solid #e5e7eb}
.tab{flex:1;padding:10px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:8px;cursor:pointer;font-family:inherit;background:transparent;color:#6b7280}
.tab.ac{background:#2563eb;color:#fff}
.report{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin-bottom:12px}
.report-head{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #e5e7eb;flex-wrap:wrap}
.report-date{font-size:15px;font-weight:800}
.badge{display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700}
.report-meta{margin-left:auto;font-size:11px;color:#9ca3af}
.room{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px}
.room-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.room-no{font-size:14px;font-weight:800}
.item{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px}
.item .badge-sm{padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;flex-shrink:0}
.item .content{flex:1}
.item .task-btn{padding:4px 10px;font-size:11px;font-weight:700;border:1px solid #d1d5db;background:#fff;color:#374151;border-radius:5px;cursor:pointer;font-family:inherit}
.item .task-btn:hover{background:#f3f4f6}
.item .task-btn:disabled{opacity:0.5;cursor:not-allowed}
.memo{margin-top:12px;padding:10px 12px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e;line-height:1.5}
.empty{text-align:center;padding:40px;color:#9ca3af;background:#fff;border:1px dashed #e5e7eb;border-radius:12px}
.form-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin-bottom:16px}
.form-label{font-size:13px;font-weight:700;color:#374151;margin-bottom:8px}
.form-input{width:100%;padding:12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;font-family:inherit;outline:none;min-height:44px}
.slot-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.slot-btn{padding:12px 8px;min-height:44px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid #d1d5db;background:#fff;color:#374151;transition:all .2s}
.slot-btn.on{border-color:#2563eb;background:#2563eb;color:#fff}
.room-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;position:relative}
.room-del{position:absolute;top:10px;right:10px;width:32px;height:32px;border:none;background:#fef2f2;color:#dc2626;border-radius:8px;font-size:16px;cursor:pointer;font-family:inherit}
.add-room-btn{width:100%;padding:12px;min-height:48px;background:#fff;border:1px dashed #d1d5db;color:#6b7280;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px}
.submit-btn{width:100%;padding:14px;min-height:52px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:24px}
.submit-btn:disabled{opacity:0.5;cursor:not-allowed}
.status-btn{padding:6px 14px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;min-height:36px;border:1.5px solid;transition:all .15s}
.pending-wrap{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px;margin-bottom:16px}
.pending-ok{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;text-align:center;color:#166534;font-size:13px;font-weight:600;margin-bottom:16px}
.history-item{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:8px;cursor:pointer}
.history-item:hover{background:#f9fafb}
@media(max-width:600px){.hr-w{padding:20px 12px}.stats{grid-template-columns:1fr}.toolbar{flex-direction:column;align-items:stretch}}
    `}</style>
    <div className="hr-w">
      <div className="hr-top">
        <button className="hr-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>🏠 하우스 보고</h1>
      </div>

      {/* ──── Unified Tab Row ──── */}
      <div className="tabs">
        {([
          ["write", "📝 보고하기"],
          ["all", "전체"],
          ["morning", "🌅 오전"],
          ["afternoon", "☀️ 오후"],
          ["checkin", "🌙 체크인"],
        ] as const).map(([k, v]) => {
          const active = k === "write" ? mainTab === "write" : mainTab === "view" && slot === k;
          return (
            <button key={k} className={`tab${active ? " ac" : ""}`} onClick={() => {
              if (k === "write") { setMainTab("write"); }
              else { setMainTab("view"); setSlot(k as typeof slot); }
            }}>{v}</button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/*  VIEW TAB                                               */}
      {/* ════════════════════════════════════════════════════════ */}
      {mainTab === "view" && <>
        <div className="stats">
          <div className="stat"><div className="lbl">오늘 보고</div><div className="val">{todayReports.length}건</div></div>
          <div className={`stat${progressCount > 0 ? " warn" : ""}`}><div className="lbl">🔄 조치중</div><div className="val">{progressCount}개</div></div>
          <div className={`stat${checkCount > 0 ? " danger" : ""}`}><div className="lbl">❗ 확인필요</div><div className="val">{checkCount}개</div></div>
        </div>

        <div className="toolbar">
          <div className="date-quick">
            <button onClick={() => setDateRange("today")}>오늘</button>
            <button onClick={() => setDateRange("yesterday")}>어제</button>
            <button onClick={() => setDateRange("week")}>이번주</button>
          </div>
          <input className="date-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span style={{ color: "#9ca3af", fontSize: 12 }}>~</span>
          <input className="date-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>{reports.length}건</span>
        </div>

        {reports.length === 0 ? (
          <div className="empty">📭 해당 기간 보고 내역이 없습니다</div>
        ) : reports.map(r => {
          const slotBg = SLOT_BG[r.time_slot] || "#f3f4f6";
          const slotColor = SLOT_COLOR[r.time_slot] || "#374151";
          const submitTime = new Date(r.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={r.id} className="report">
              <div className="report-head">
                <div className="report-date">{r.report_date || "-"}</div>
                <span className="badge" style={{ background: slotBg, color: slotColor }}>{SLOT_LABEL[r.time_slot] || r.time_slot}</span>
                <span className="badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>👤 {r.reporter}</span>
                <div className="report-meta">제출 {submitTime}</div>
              </div>
              {(r.rooms || []).map((rm, rIdx) => (
                <div key={rIdx} className="room">
                  <div className="room-head"><span className="room-no">{rm.room_no || "-"}</span></div>
                  {(rm.items || []).map((it, iIdx) => {
                    const st = STATUS_MAP[it.status] || STATUS_MAP.done;
                    const canCreate = it.status !== "done";
                    const key = `${r.id}-${rIdx}-${iIdx}`;
                    return (
                      <div key={iIdx} className="item">
                        <span className="badge-sm" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        <span className="content" style={{ fontWeight: st.bold ? 700 : 400, color: st.bold ? st.color : "#374151" }}>{it.content}</span>
                        {canCreate && (
                          <button className="task-btn" onClick={() => createTask(rm.room_no, it, r.reporter, r.report_date, key)} disabled={creating === key}>
                            {creating === key ? "생성 중..." : "📝 업무 생성"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {r.memo && <div className="memo">📝 <b>메모:</b> {r.memo}</div>}
            </div>
          );
        })}
      </>}

      {/* ════════════════════════════════════════════════════════ */}
      {/*  WRITE TAB                                              */}
      {/* ════════════════════════════════════════════════════════ */}
      {mainTab === "write" && <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* 미해결 항목 */}
        {pending.length === 0 ? (
          <div className="pending-ok">미해결 항목 없음 ✅</div>
        ) : (
          <div className="pending-wrap">
            <div style={{ fontSize: 13, fontWeight: 700, color: "#9a3412", marginBottom: 10 }}>⚠️ 미해결 항목 ({pending.length})</div>
            {(() => {
              const byRoom: Record<string, PendingItem[]> = {};
              pending.forEach(p => { (byRoom[p.room_no] = byRoom[p.room_no] || []).push(p); });
              return Object.entries(byRoom).map(([roomNo, items]) => (
                <div key={roomNo} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#9a3412", marginBottom: 4 }}>{roomNo}</div>
                  {items.map(p => (
                    <div key={p.id} style={{ background: "#fff", border: "1px solid #fed7aa", borderRadius: 6, padding: 10, marginBottom: 6 }}>
                      <div style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>{p.content}</div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {(["problem", "progress", "done"] as const).map(s => {
                          const on = p.status === s;
                          const st = STATUS_MAP[s] || STATUS_MAP.done;
                          return (
                            <button key={s} className="status-btn"
                              style={{ borderColor: st.color, background: on ? st.color : "#fff", color: on ? "#fff" : st.color }}
                              onClick={() => updatePendingStatus(p.id, s)}
                            >{st.label}</button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ));
            })()}
          </div>
        )}

        {/* 날짜 */}
        <div className="form-card">
          <div className="form-label">날짜</div>
          <input className="form-input" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} style={{ marginBottom: 16 }} />
          <div className="form-label">시간대</div>
          <div className="slot-grid">
            {([["morning", "오전 보고"], ["afternoon", "오후 보고"], ["checkin", "체크인 보고"]] as const).map(([k, v]) => (
              <button key={k} className={`slot-btn${formSlot === k ? " on" : ""}`} onClick={() => setFormSlot(k)}>{v}</button>
            ))}
          </div>
        </div>

        {/* 호실 목록 */}
        {formRooms.map((rm, rIdx) => (
          <div key={rIdx} className="room-card">
            <button className="room-del" onClick={() => removeRoom(rIdx)}>×</button>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>호실 {rIdx + 1}</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, paddingRight: 36 }}>
              <select className="form-input" style={{ flex: 1 }} value={rm.room_no} onChange={e => setRoomNo(rIdx, e.target.value)}>
                <option value="">선택</option>
                {HOUSE_ROOMS.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input className="form-input" style={{ flex: 1 }} placeholder="직접입력" value={rm.room_no} onChange={e => setRoomNo(rIdx, e.target.value)} />
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700, marginBottom: 6 }}>업무 항목</div>
            {rm.items.map((it, iIdx) => (
              <div key={iIdx} style={{ marginBottom: 10, padding: 10, background: "#f9fafb", borderRadius: 8 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 8, alignItems: "center" }}>
                  <input className="form-input" style={{ flex: 1 }} placeholder="업무 내용" value={it.content} onChange={e => setItemContent(rIdx, iIdx, e.target.value)} />
                  <button onClick={() => removeItem(rIdx, iIdx)} style={{ padding: "8px 10px", minWidth: 40, minHeight: 40, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", borderRadius: 6, fontSize: 14, cursor: "pointer" }}>🗑️</button>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["problem", "progress", "done"] as const).map(s => {
                    const on = it.status === s;
                    const st = STATUS_MAP[s] || STATUS_MAP.done;
                    return (
                      <button key={s} className="status-btn"
                        style={{ borderColor: st.color, background: on ? st.color : "#fff", color: on ? "#fff" : st.color }}
                        onClick={() => setItemStatus(rIdx, iIdx, s)}
                      >{st.label}</button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button onClick={() => addItem(rIdx)} style={{ width: "100%", padding: 8, minHeight: 40, background: "#f9fafb", border: "1px dashed #d1d5db", color: "#6b7280", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ 항목 추가</button>
          </div>
        ))}

        <button className="add-room-btn" onClick={addRoom}>+ 호실 추가</button>

        {/* 메모 */}
        <div className="form-card">
          <div className="form-label">전체 메모</div>
          <textarea className="form-input" placeholder="전체 특이사항 메모" value={formMemo} onChange={e => setFormMemo(e.target.value)} style={{ resize: "vertical", height: 80 }} />
        </div>

        {/* 제출 */}
        <button className="submit-btn" onClick={submitReport} disabled={submitting}>{submitting ? "제출 중..." : "보고 제출"}</button>

        {/* 최근 보고 히스토리 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>📋 최근 보고 (7일)</div>
        {history.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, color: "#9ca3af", fontSize: 13 }}>최근 7일 보고 내역이 없습니다</div>
        ) : history.map(r => {
          const slotLabel = SLOT_LABEL[r.time_slot] || r.time_slot;
          const roomCnt = (r.rooms || []).length;
          const isOpen = expandedHistory.has(r.id);
          return (
            <div key={r.id} className="history-item" onClick={() => {
              const next = new Set(expandedHistory);
              if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
              setExpandedHistory(next);
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{r.report_date} · {slotLabel}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>호실 {roomCnt}개 · 👤 {r.reporter}</div>
                </div>
                <div style={{ color: "#9ca3af" }}>{isOpen ? "▲" : "▼"}</div>
              </div>
              {isOpen && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
                  {(r.rooms || []).map((rm, rIdx) => (
                    <div key={rIdx} style={{ marginBottom: 10, padding: 10, background: "#f9fafb", borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{rm.room_no || "-"}</div>
                      {(rm.items || []).map((it, iIdx) => {
                        const st = STATUS_MAP[it.status] || STATUS_MAP.done;
                        return (
                          <div key={iIdx} style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 0", fontSize: 13, fontWeight: st.bold ? 700 : 400 }}>
                            <span style={{ display: "inline-block", padding: "2px 8px", background: st.bg, color: st.color, borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                            <span>{it.content}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {r.memo && <div className="memo">📝 <b>메모:</b> {r.memo}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>}

    </div>
  </>);
}
