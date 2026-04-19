"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";
import { getTutorColor } from "@/lib/tutorColors";
import OnlineClassLoginScreen from "@/components/OnlineClassLoginScreen";

interface SessionItem {
  id: string; session_number: number;
  scheduled_date: string; scheduled_time_ph: string | null; scheduled_time_kr: string | null;
  status: string; note: string | null; session_note: string | null;
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
function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function diffDays(a: string, b: string) {
  const da = new Date(a + "T12:00:00").getTime();
  const db = new Date(b + "T12:00:00").getTime();
  return Math.round((da - db) / (1000 * 60 * 60 * 24));
}

function weekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  mon.setDate(mon.getDate() + offset * 7);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return { start: fmt(mon), end: fmt(sun), startDate: mon, endDate: sun };
}
function weekLabelEN(offset: number) {
  if (offset === 0) return "This Week";
  if (offset === 1) return "Next Week";
  if (offset === -1) return "Last Week";
  if (offset > 0) return `${offset} weeks later`;
  return `${-offset} weeks ago`;
}
function formatWeekRange(start: Date, end: Date) {
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opt)} – ${end.toLocaleDateString("en-US", opt)}, ${end.getFullYear()}`;
}

function formatDateEN(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const TUTOR_OPTIONS = ["T.Ann", "T.Angel", "T.Carla", "T.Amelyn", "T.Cristel"];

export default function StaffOnlineClassPage() {
  const [authState, setAuthState] = useState<'loading' | 'guest' | 'authed'>('loading');
  const [adminRole, setAdminRole] = useState("");
  const [tab, setTab] = useState<"today" | "week">("today");

  const [todaySessions, setTodaySessions] = useState<SessionItem[]>([]);
  const [weekSessions, setWeekSessions] = useState<SessionItem[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [tutorFilter, setTutorFilter] = useState("all");
  const [viewAsTutor, setViewAsTutor] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [dateOffset, setDateOffset] = useState(0);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const selectedDate = addDays(todayStr(), dateOffset);

  const applyAuthedInfo = useCallback(() => {
    const info = getAdminInfo();
    if (info) setAdminRole(info.role || "");
    setAuthState('authed');
  }, []);

  useEffect(() => {
    if (isAdminAuthed()) applyAuthedInfo();
    else setAuthState('guest');
  }, [applyAuthedInfo]);

  const loadToday = useCallback(async () => {
    const res = await fetch(`/api/online-class/sessions?date=${selectedDate}`);
    if (res.ok) { const d = await res.json(); setTodaySessions(d.sessions || []); }
  }, [selectedDate]);

  const loadWeek = useCallback(async () => {
    const { start, end } = weekRange(weekOffset);
    const res = await fetch(`/api/online-class/sessions?start=${start}&end=${end}`);
    if (res.ok) { const d = await res.json(); setWeekSessions(d.sessions || []); }
  }, [weekOffset]);

  const loadTutors = useCallback(async () => {
    const res = await fetch("/api/online-class/tutors");
    if (res.ok) { const d = await res.json(); setTutors(d.tutors || []); }
  }, []);

  useEffect(() => { if (authState === 'authed') loadTutors(); }, [authState, loadTutors]);
  useEffect(() => { if (authState === 'authed') loadToday(); }, [authState, loadToday]);
  useEffect(() => { if (authState === 'authed') loadWeek(); }, [authState, loadWeek]);

  const canViewAll = adminRole === "admin";

  const filteredToday = useMemo(() => {
    if (!canViewAll || viewAsTutor === "all") return todaySessions;
    return todaySessions.filter(s => s.tutor?.name_display === viewAsTutor);
  }, [todaySessions, viewAsTutor, canViewAll]);

  const weekByDate: Record<string, SessionItem[]> = {};
  const filteredWeek = weekSessions.filter(s => {
    if (tutorFilter !== "all" && s.tutor?.name_display !== tutorFilter) return false;
    if (canViewAll && viewAsTutor !== "all" && s.tutor?.name_display !== viewAsTutor) return false;
    return true;
  });
  filteredWeek.forEach(s => {
    const d = s.scheduled_date;
    if (!weekByDate[d]) weekByDate[d] = [];
    weekByDate[d].push(s);
  });
  const sortedDates = Object.keys(weekByDate).sort();

  function onDatePicked(newDate: string) {
    if (!newDate) return;
    setDateOffset(diffDays(newDate, todayStr()));
  }

  function openDatePicker() {
    const el = dateInputRef.current;
    if (!el) return;
    const picker = (el as HTMLInputElement & { showPicker?: () => void }).showPicker;
    if (typeof picker === "function") picker.call(el);
    else el.click();
  }

  const viewingTutorColor = viewAsTutor !== "all" ? getTutorColor(viewAsTutor) : null;

  if (authState === 'loading') return null;
  if (authState === 'guest') return <OnlineClassLoginScreen onAuthenticated={applyAuthedInfo} />;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.sc-w{max-width:1200px;margin:0 auto;padding:20px 24px;min-height:100vh}
.sc-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.week-nav{display:flex;align-items:center;gap:10px;margin-bottom:14px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px}
.week-nav button{padding:7px 14px;border:1px solid #e2e8f0;background:#fff;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:#334155}
.week-nav button:hover{background:#f8fafc;border-color:#1a6fc4;color:#1a6fc4}
.week-nav .center{flex:1;text-align:center;font-size:14px;font-weight:800;color:#1a1a2e}
.week-nav .center .sub{font-size:12px;font-weight:500;color:#64748b;margin-left:8px}
.week-nav .center.clickable{cursor:pointer}
.week-nav .center.clickable:hover{color:#1a6fc4}
.week-nav .today-btn{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.week-nav .today-btn:hover{background:#0d3d7a;color:#fff}
.sc-head{margin-bottom:20px}
.sc-head h1{font-size:20px;font-weight:800;color:#1a1a2e;margin-bottom:4px}
.sc-head .date{font-size:13px;color:#6b7c93}
.sc-tabs{display:flex;gap:0;background:#fff;border-radius:10px;margin-bottom:16px;border:1px solid #e2e8f0;overflow:hidden}
.sc-tab{flex:1;padding:11px;font-size:13px;font-weight:700;text-align:center;border:none;cursor:pointer;font-family:inherit;background:transparent;color:#6b7c93;transition:all .2s}
.sc-tab.ac{background:#1a6fc4;color:#fff}
.sc-back{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:600;color:#6b7c93;cursor:pointer;text-decoration:none;margin-bottom:14px}
.sc-back:hover{background:#f8fafc}
.card{background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:10px;border:1px solid #e2e8f0;position:relative;overflow:hidden}
.card .color-bar{position:absolute;left:0;top:0;bottom:0;width:4px}
.card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;padding-left:8px}
.card-time{font-size:17px;font-weight:800;color:#1a6fc4}
.card-badge{display:inline-block;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700}
.card-info{padding-left:8px}
.card-info .line1{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.card-info .name{font-size:16px;font-weight:800;color:#1a1a2e}
.card-info .tutor-tag{font-size:13px;font-weight:700}
.card-info .meta{font-size:12px;color:#6b7c93;margin-top:4px}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px;background:#fff;border:1px dashed #e2e8f0;border-radius:14px}
.day-header{font-size:14px;font-weight:800;color:#374151;margin:18px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
.week-card{display:flex;align-items:center;gap:10px;background:#fff;border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid #e2e8f0;position:relative;overflow:hidden;padding-left:16px}
.week-card .color-bar{position:absolute;left:0;top:0;bottom:0;width:4px}
.week-card .time{font-size:14px;font-weight:800;color:#1a6fc4;min-width:50px}
.week-card .info{flex:1;min-width:0}
.week-card .info .line1{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
.week-card .info .name{font-size:13px;font-weight:800}
.week-card .info .tutor-tag{font-size:11px;font-weight:700}
.week-card .info .meta{font-size:11px;color:#94a3b8;margin-top:2px}
.filter-bar{display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap}
.filter-bar select{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit;outline:none;background:#fff}
.tutor-legend{display:flex;gap:6px;flex-wrap:wrap;font-size:11px;color:#64748b}
.tutor-legend .lg{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#fff;border-radius:6px;border:1px solid #e2e8f0}
.tutor-legend .sw{width:10px;height:10px;border-radius:2px}
.view-as-bar{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;margin-bottom:12px;flex-wrap:wrap}
.view-as-bar label{font-size:12px;font-weight:700;color:#475569}
.view-as-bar select{padding:6px 10px;border:1px solid #e2e8f0;border-radius:7px;font-size:12px;font-family:inherit;outline:none;background:#fff}
.view-as-bar .clear-link{font-size:11px;color:#1a6fc4;cursor:pointer;text-decoration:underline;text-underline-offset:2px;background:none;border:none;font-family:inherit}
.viewing-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:700;color:#fff;margin-top:6px}
.date-hidden{position:absolute;opacity:0;pointer-events:none;width:0;height:0}
.note-icon{cursor:help;font-size:12px}
.note-preview{margin-top:6px;padding:6px 10px;background:#fef9c3;border-left:3px solid #eab308;border-radius:4px;font-size:11px;color:#78350f;line-height:1.4}
.wk-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.wk-col{min-height:120px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px}
.wk-head{font-size:12px;font-weight:800;color:#1a1a2e;text-align:center;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.wk-empty{font-size:11px;color:#cbd5e1;text-align:center;padding:14px 0;font-style:italic}
.wk-card{position:relative;padding:8px 8px 8px 12px;background:#f8fafc;border-radius:7px;overflow:hidden}
.wk-card .wk-bar{position:absolute;left:0;top:0;bottom:0;width:3px}
.wk-time{font-size:12px;font-weight:800;color:#1a6fc4;margin-bottom:2px}
.wk-name{font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wk-tutor{font-size:10px;font-weight:700;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wk-badge{display:inline-block;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700}
.wk-note-icon{position:absolute;top:6px;right:6px;font-size:11px;cursor:help}
    `}</style>
    <div className="sc-w">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
        <a href="/admin/hub" className="sc-back" style={{ marginBottom: 0 }}>← Admin Home</a>
        <a href="/tutor/guide" className="sc-back" style={{ marginBottom: 0 }}>📖 Tutor Guide</a>
        <a href="/tutor/online-class" className="sc-back" style={{ marginBottom: 0, background: "#eff6ff", borderColor: "#bfdbfe", color: "#1a6fc4" }}>👤 My Schedule (Tutor View) →</a>
      </div>

      <div className="sc-head">
        <h1>Online Class — Attendance Monitor</h1>
        <div className="date">{formatDateEN(selectedDate)}</div>
        {viewingTutorColor && (
          <span className="viewing-badge" style={{ background: viewingTutorColor }}>
            👤 Viewing: {viewAsTutor}
            <button type="button" onClick={() => setViewAsTutor("all")} style={{ background: "rgba(255,255,255,0.25)", color: "#fff", border: "none", borderRadius: 4, padding: "0 6px", cursor: "pointer", fontSize: 11, fontWeight: 700, marginLeft: 4 }}>Clear</button>
          </span>
        )}
      </div>

      <div className="sc-tabs">
        <button className={`sc-tab${tab === "today" ? " ac" : ""}`} onClick={() => setTab("today")}>📅 Today&apos;s Schedule</button>
        <button className={`sc-tab${tab === "week" ? " ac" : ""}`} onClick={() => setTab("week")}>📆 This Week</button>
      </div>

      {canViewAll && (
        <div className="view-as-bar">
          <label>👤 View as:</label>
          <select value={viewAsTutor} onChange={e => setViewAsTutor(e.target.value)}>
            <option value="all">All Tutors</option>
            {TUTOR_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {viewAsTutor !== "all" && (
            <button type="button" className="clear-link" onClick={() => setViewAsTutor("all")}>Clear filter</button>
          )}
        </div>
      )}

      <div className="tutor-legend" style={{ marginBottom: 12 }}>
        {tutors.map(t => (
          <span key={t.id} className="lg">
            <span className="sw" style={{ background: getTutorColor(t.name_display) }} />
            {t.name_display}
          </span>
        ))}
      </div>

      {/* ═══ TODAY ═══ */}
      {tab === "today" && <>
        <div className="week-nav">
          <button onClick={() => setDateOffset(o => o - 1)}>◀ Previous</button>
          <div className="center clickable" onClick={openDatePicker} title="Click to pick a date">
            📅 {formatDateEN(selectedDate)}
          </div>
          {dateOffset !== 0 && <button className="today-btn" onClick={() => setDateOffset(0)}>Today</button>}
          <button onClick={() => setDateOffset(o => o + 1)}>Next ▶</button>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={e => onDatePicked(e.target.value)}
            className="date-hidden"
          />
        </div>

        {filteredToday.length === 0 ? (
          <div className="empty">No classes scheduled on {formatDateEN(selectedDate)}.</div>
        ) : (
          <div className="sc-grid">
            {filteredToday.map(s => {
              const st = SES_STYLE[s.status] || SES_STYLE.scheduled;
              const studentName = s.enrollment?.student_name_en || s.enrollment?.student_name || "-";
              const tutorName = s.tutor?.name_display || "-";
              const tutorColor = getTutorColor(tutorName);
              return (
                <div key={s.id} className="card">
                  <div className="color-bar" style={{ background: tutorColor }} />
                  <div className="card-top">
                    <div className="card-time">{s.scheduled_time_ph || "-"}</div>
                    <span className="card-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div className="card-info">
                    <div className="line1">
                      <span className="name">{studentName}</span>
                      <span className="tutor-tag" style={{ color: tutorColor }}>/ {tutorName}</span>
                      {s.session_note && <span className="note-icon" title={s.session_note}>💬</span>}
                    </div>
                    <div className="meta">KR: {s.scheduled_time_kr || "-"} · #{s.session_number}</div>
                    {s.session_note && <div className="note-preview">📝 {s.session_note}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>}

      {/* ═══ WEEK ═══ */}
      {tab === "week" && <>
        <div className="week-nav">
          <button onClick={() => setWeekOffset(o => o - 1)}>◀ Previous Week</button>
          <div className="center">
            📅 {weekLabelEN(weekOffset)}
            <span className="sub">{formatWeekRange(weekRange(weekOffset).startDate, weekRange(weekOffset).endDate)}</span>
          </div>
          {weekOffset !== 0 && <button className="today-btn" onClick={() => setWeekOffset(0)}>Today</button>}
          <button onClick={() => setWeekOffset(o => o + 1)}>Next Week ▶</button>
        </div>
        <div className="filter-bar">
          <select value={tutorFilter} onChange={e => setTutorFilter(e.target.value)}>
            <option value="all">All Tutors</option>
            {tutors.map(t => <option key={t.id} value={t.name_display}>{t.name_display}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "#6b7c93", marginLeft: "auto" }}>{filteredWeek.length} sessions</span>
        </div>

        {filteredWeek.length === 0 ? (
          <div className="empty">No classes scheduled {weekOffset === 0 ? "this week" : weekOffset === 1 ? "next week" : weekOffset === -1 ? "last week" : `in ${weekLabelEN(weekOffset).toLowerCase()}`}.</div>
        ) : (
          <div className="wk-grid">
            {Array.from({ length: 7 }).map((_, i) => {
              const d = new Date(weekRange(weekOffset).startDate); d.setDate(weekRange(weekOffset).startDate.getDate() + i);
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
              const dayNum = d.getDate();
              const list = (weekByDate[dateStr] || []).slice().sort((a, b) => (a.scheduled_time_ph || "").localeCompare(b.scheduled_time_ph || ""));
              return (
                <div key={dateStr} className="wk-col">
                  <div className="wk-head">{dayLabel} {dayNum}</div>
                  {list.length === 0 ? (
                    <div className="wk-empty">No class</div>
                  ) : list.map(s => {
                    const st = SES_STYLE[s.status] || SES_STYLE.scheduled;
                    const tutorName = s.tutor?.name_display || "-";
                    const tutorColor = getTutorColor(tutorName);
                    return (
                      <div key={s.id} className="wk-card">
                        <div className="wk-bar" style={{ background: tutorColor }} />
                        <div className="wk-time">{s.scheduled_time_ph || "-"}</div>
                        <div className="wk-name">{s.enrollment?.student_name_en || s.enrollment?.student_name || "-"}</div>
                        <div className="wk-tutor" style={{ color: tutorColor }}>{tutorName}</div>
                        <span className="wk-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        {s.session_note && <span className="wk-note-icon" title={s.session_note}>💬</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </>}
    </div>
  </>);
}
