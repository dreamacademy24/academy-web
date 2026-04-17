"use client";
import { useState, useEffect, useCallback } from "react";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";

interface SessionItem {
  id: string; session_number: number;
  scheduled_date: string; scheduled_time_ph: string | null; scheduled_time_kr: string | null;
  status: string; note: string | null;
  enrollment: { id: string; student_name: string; student_name_en: string | null; student_birth_year: string | null; status: string } | null;
  tutor: { id: string; name_display: string; name_en: string } | null;
}
interface Tutor { id: string; name_display: string }

const SES_STYLE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  scheduled:  { label: "Scheduled",  bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" },
  attended:   { label: "Attended",   bg: "#dcfce7", color: "#166534", border: "#bbf7d0" },
  no_show:    { label: "Absent",     bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  absent:     { label: "Absent",     bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  cancelled:  { label: "Cancelled",  bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  makeup:     { label: "Makeup",     bg: "#fef9c3", color: "#92400e", border: "#fde68a" },
};

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

function weekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sat = new Date(mon); sat.setDate(mon.getDate() + 5);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return { start: fmt(mon), end: fmt(sat) };
}

function formatDateEN(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function StaffOnlineClassPage() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"today" | "week">("today");
  const [userId, setUserId] = useState("");

  const [todaySessions, setTodaySessions] = useState<SessionItem[]>([]);
  const [weekSessions, setWeekSessions] = useState<SessionItem[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [tutorFilter, setTutorFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (isAdminAuthed()) {
      setAuthed(true);
      const info = getAdminInfo();
      if (info) setUserId(info.staffId || "");
    } else if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  const loadToday = useCallback(async () => {
    const res = await fetch(`/api/online-class/sessions?date=${todayStr()}`);
    if (res.ok) { const d = await res.json(); setTodaySessions(d.sessions || []); }
  }, []);

  const loadWeek = useCallback(async () => {
    const { start, end } = weekRange();
    const res = await fetch(`/api/online-class/sessions?start=${start}&end=${end}`);
    if (res.ok) { const d = await res.json(); setWeekSessions(d.sessions || []); }
  }, []);

  const loadTutors = useCallback(async () => {
    const res = await fetch("/api/online-class/tutors");
    if (res.ok) { const d = await res.json(); setTutors(d.tutors || []); }
  }, []);

  useEffect(() => {
    if (authed) { loadToday(); loadWeek(); loadTutors(); }
  }, [authed, loadToday, loadWeek, loadTutors]);

  async function markStatus(sessionId: string, status: string) {
    setUpdating(sessionId);
    const res = await fetch("/api/online-class/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sessionId, status, recorded_by: userId }),
    });
    if (!res.ok) { const r = await res.json(); alert(r.error || "Failed"); }
    await loadToday();
    await loadWeek();
    setUpdating(null);
  }

  const weekByDate: Record<string, SessionItem[]> = {};
  const filteredWeek = weekSessions.filter(s => tutorFilter === "all" || s.tutor?.name_display === tutorFilter);
  filteredWeek.forEach(s => {
    const d = s.scheduled_date;
    if (!weekByDate[d]) weekByDate[d] = [];
    weekByDate[d].push(s);
  });
  const sortedDates = Object.keys(weekByDate).sort();

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.sc-w{max-width:600px;margin:0 auto;padding:20px 16px;min-height:100vh}
.sc-head{margin-bottom:20px}
.sc-head h1{font-size:20px;font-weight:800;color:#1a1a2e;margin-bottom:4px}
.sc-head .date{font-size:13px;color:#6b7c93}
.sc-tabs{display:flex;gap:0;background:#fff;border-radius:10px;margin-bottom:16px;border:1px solid #e2e8f0;overflow:hidden}
.sc-tab{flex:1;padding:11px;font-size:13px;font-weight:700;text-align:center;border:none;cursor:pointer;font-family:inherit;background:transparent;color:#6b7c93;transition:all .2s}
.sc-tab.ac{background:#1a6fc4;color:#fff}
.sc-back{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:600;color:#6b7c93;cursor:pointer;text-decoration:none;margin-bottom:14px}
.sc-back:hover{background:#f8fafc}
.card{background:#fff;border-radius:14px;padding:16px;margin-bottom:12px;border:2px solid #e2e8f0;transition:border-color .15s}
.card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.card-time{font-size:18px;font-weight:800;color:#1a6fc4}
.card-badge{display:inline-block;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700}
.card-info{margin-bottom:12px}
.card-info .name{font-size:15px;font-weight:700;color:#1a1a2e}
.card-info .meta{font-size:12px;color:#6b7c93;margin-top:2px}
.card-btns{display:flex;gap:8px}
.card-btn{flex:1;padding:10px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:opacity .15s}
.card-btn:disabled{opacity:0.4;cursor:not-allowed}
.card-btn.green{background:#dcfce7;color:#166534}.card-btn.green:hover{background:#bbf7d0}
.card-btn.red{background:#fef2f2;color:#dc2626}.card-btn.red:hover{background:#fecaca}
.card-btn.yellow{background:#fef9c3;color:#92400e}.card-btn.yellow:hover{background:#fde68a}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px;background:#fff;border:1px dashed #e2e8f0;border-radius:14px}
.day-header{font-size:14px;font-weight:800;color:#374151;margin:18px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
.week-card{display:flex;align-items:center;gap:10px;background:#fff;border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid #e2e8f0}
.week-card .time{font-size:14px;font-weight:800;color:#1a6fc4;min-width:50px}
.week-card .info{flex:1;min-width:0}
.week-card .info .name{font-size:13px;font-weight:700}
.week-card .info .tutor{font-size:11px;color:#6b7c93}
.filter-bar{display:flex;gap:8px;margin-bottom:14px;align-items:center}
.filter-bar select{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;outline:none;background:#fff}
    `}</style>
    <div className="sc-w">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
        <a href="/staff" className="sc-back" style={{ marginBottom: 0 }}>← Back to Team Manager</a>
        <a href="/tutor/online-class" className="sc-back" style={{ marginBottom: 0, background: "#eff6ff", borderColor: "#bfdbfe", color: "#1a6fc4" }}>👤 My Schedule (Tutor View) →</a>
      </div>

      <div className="sc-head">
        <h1>Online Class — Attendance</h1>
        <div className="date">{formatDateEN(todayStr())}</div>
      </div>

      <div className="sc-tabs">
        <button className={`sc-tab${tab === "today" ? " ac" : ""}`} onClick={() => setTab("today")}>📅 Today&apos;s Schedule</button>
        <button className={`sc-tab${tab === "week" ? " ac" : ""}`} onClick={() => setTab("week")}>📆 This Week</button>
      </div>

      {/* ═══ TODAY ═══ */}
      {tab === "today" && <>
        {todaySessions.length === 0 ? (
          <div className="empty">No classes scheduled for today.</div>
        ) : todaySessions.map(s => {
          const st = SES_STYLE[s.status] || SES_STYLE.scheduled;
          const isScheduled = s.status === "scheduled";
          const studentName = s.enrollment?.student_name_en || s.enrollment?.student_name || "-";
          return (
            <div key={s.id} className="card" style={{ borderColor: st.border }}>
              <div className="card-top">
                <div className="card-time">{s.scheduled_time_ph || "-"}</div>
                <span className="card-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              </div>
              <div className="card-info">
                <div className="name">{studentName}</div>
                <div className="meta">Tutor: {s.tutor?.name_display || "-"} · KR: {s.scheduled_time_kr || "-"} · #{s.session_number}</div>
              </div>
              {isScheduled && (
                <div className="card-btns">
                  <button className="card-btn green" disabled={updating === s.id} onClick={() => markStatus(s.id, "attended")}>✅ Attended</button>
                  <button className="card-btn red" disabled={updating === s.id} onClick={() => markStatus(s.id, "no_show")}>❌ Absent</button>
                  <button className="card-btn yellow" disabled={updating === s.id} onClick={() => markStatus(s.id, "makeup")}>🔄 Makeup</button>
                </div>
              )}
            </div>
          );
        })}
      </>}

      {/* ═══ WEEK ═══ */}
      {tab === "week" && <>
        <div className="filter-bar">
          <select value={tutorFilter} onChange={e => setTutorFilter(e.target.value)}>
            <option value="all">All Tutors</option>
            {tutors.map(t => <option key={t.id} value={t.name_display}>{t.name_display}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "#6b7c93", marginLeft: "auto" }}>{filteredWeek.length} sessions</span>
        </div>

        {sortedDates.length === 0 ? (
          <div className="empty">No classes this week.</div>
        ) : sortedDates.map(date => (
          <div key={date}>
            <div className="day-header">{formatDateShort(date)}</div>
            {weekByDate[date].map(s => {
              const st = SES_STYLE[s.status] || SES_STYLE.scheduled;
              return (
                <div key={s.id} className="week-card">
                  <div className="time">{s.scheduled_time_ph || "-"}</div>
                  <div className="info">
                    <div className="name">{s.enrollment?.student_name_en || s.enrollment?.student_name || "-"}</div>
                    <div className="tutor">{s.tutor?.name_display || "-"}</div>
                  </div>
                  <span className="card-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </>}
    </div>
  </>);
}
