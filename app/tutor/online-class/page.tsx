"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";
import { TUTOR_COLORS } from "@/lib/tutorColors";
import StudentInvoiceCalendar from "@/components/StudentInvoiceCalendar";

// Admin이 다른 튜터 대시보드를 열람할 때 사용할 계정 목록.
// staff_user_id 값은 app/login/page.tsx의 tutor 계정과 동일.
const TUTOR_ACCOUNTS: { id: string; label: string }[] = [
  { id: "admin-ann",     label: "T.Ann" },
  { id: "admin-angel",   label: "T.Angel" },
  { id: "admin-carla",   label: "T.Carla" },
  { id: "admin-amelyn",  label: "T.Amelyn" },
  { id: "admin-cristel", label: "T.Cristel" },
];

interface Tutor {
  id: string;
  staff_user_id: string | null;
  name_display: string;
  name_en: string | null;
}

interface Enrollment {
  id: string;
  student_name: string;
  student_name_en: string | null;
  student_birth_year: string | null;
  days_of_week: string[] | null;
  class_time_kr: string | null;
  class_time_ph: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_weeks: number | null;
  class_period: string | null;
  pre_sessions: number | null;
  post_sessions: number | null;
  total_sessions: number | null;
  used_sessions: number | null;
  status: string | null;
  notes: string | null;
  tutor_notes: string | null;
}

interface SessionItem {
  id: string;
  session_number: number;
  scheduled_date: string;
  scheduled_time_ph: string | null;
  scheduled_time_kr: string | null;
  status: string;
  session_note: string | null;
  enrollment: { id: string; student_name: string; student_name_en: string | null } | null;
}

const SES_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  scheduled: { label: "Scheduled", bg: "#f1f5f9", color: "#64748b" },
  attended:  { label: "Attended",  bg: "#dcfce7", color: "#166534" },
  no_show:   { label: "Absent",    bg: "#fef2f2", color: "#dc2626" },
  absent:    { label: "Absent",    bg: "#fef2f2", color: "#dc2626" },
  cancelled: { label: "Cancelled", bg: "#fef2f2", color: "#dc2626" },
  makeup:    { label: "Makeup",    bg: "#fef9c3", color: "#92400e" },
};

const DAY_LABEL: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
  "월": "Mon", "화": "Tue", "수": "Wed", "목": "Thu", "금": "Fri", "토": "Sat", "일": "Sun",
};

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmt(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function weekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  mon.setDate(mon.getDate() + offset * 7);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: fmt(mon), end: fmt(sun), startDate: mon, endDate: sun };
}
function weekLabel(offset: number) {
  if (offset === 0) return "This Week";
  if (offset === 1) return "Next Week";
  if (offset === -1) return "Last Week";
  if (offset > 0) return `${offset} weeks later`;
  return `${-offset} weeks ago`;
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function diffDays(a: string, b: string) {
  const da = new Date(a + "T12:00:00").getTime();
  const db = new Date(b + "T12:00:00").getTime();
  return Math.round((da - db) / (1000 * 60 * 60 * 24));
}
function formatTodayEN(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatWeekRangeEN(start: Date, end: Date) {
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = start.toLocaleDateString("en-US", opt);
  const e = end.toLocaleDateString("en-US", opt);
  const y = end.getFullYear();
  return `${s} – ${e}, ${y}`;
}

function formatDayHeader(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function capDays(days: string[] | null) {
  if (!days || !days.length) return "-";
  return days.map(d => DAY_LABEL[d.toLowerCase()] || DAY_LABEL[d] || d).join(", ");
}

function TutorOnlineClassInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState(false);
  const [adminRole, setAdminRole] = useState<string>("");
  const [tab, setTab] = useState<"today" | "students" | "schedule">("today");
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [loadingTutor, setLoadingTutor] = useState(true);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [weekSessions, setWeekSessions] = useState<SessionItem[]>([]);
  const [todaySessions, setTodaySessions] = useState<SessionItem[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dateOffset, setDateOffset] = useState(0);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [invoiceStudent, setInvoiceStudent] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [sessionNoteDraft, setSessionNoteDraft] = useState<Record<string, string>>({});

  const selectedDate = addDays(fmt(new Date()), dateOffset);

  useEffect(() => {
    if (isAdminAuthed()) {
      setAuthed(true);
      const info = getAdminInfo();
      setAdminRole(info?.role || "");
    } else if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  const resolveTutor = useCallback(async () => {
    if (!authed) return;
    setLoadingTutor(true);
    let staffUserId = "";
    const info = getAdminInfo();
    if (info && info.staffId) staffUserId = info.staffId;
    const qp = searchParams.get("tutor");
    if (qp) staffUserId = qp;
    if (!staffUserId) { setTutor(null); setLoadingTutor(false); return; }
    const res = await fetch(`/api/online-class/tutors?staff_user_id=${encodeURIComponent(staffUserId)}`);
    if (res.ok) { const d = await res.json(); setTutor(d.tutor || null); }
    setLoadingTutor(false);
  }, [authed, searchParams]);

  useEffect(() => { resolveTutor(); }, [resolveTutor]);

  const loadEnrollments = useCallback(async () => {
    if (!tutor) return;
    const res = await fetch(`/api/online-class/enrollments?tutor_id=${tutor.id}`);
    if (res.ok) { const d = await res.json(); setEnrollments((d.enrollments || []).filter((e: Enrollment) => e.status === "active")); }
  }, [tutor]);

  const loadWeek = useCallback(async () => {
    if (!tutor) return;
    const { start, end } = weekRange(weekOffset);
    const res = await fetch(`/api/online-class/sessions?start=${start}&end=${end}`);
    if (res.ok) {
      const d = await res.json();
      const all = (d.sessions || []) as (SessionItem & { tutor?: { id: string } | null })[];
      setWeekSessions(all.filter(s => s.tutor && s.tutor.id === tutor.id));
    }
  }, [tutor, weekOffset]);

  const loadToday = useCallback(async () => {
    if (!tutor) return;
    const res = await fetch(`/api/online-class/sessions?date=${selectedDate}`);
    if (res.ok) {
      const d = await res.json();
      const all = (d.sessions || []) as (SessionItem & { tutor?: { id: string } | null })[];
      setTodaySessions(all.filter(s => s.tutor && s.tutor.id === tutor.id));
    }
  }, [tutor, selectedDate]);

  async function markStatus(sessionId: string, status: string) {
    if (!tutor) return;
    setUpdating(sessionId);
    const body: Record<string, unknown> = { id: sessionId, status, recorded_by: tutor.staff_user_id || "" };
    if (sessionNoteDraft[sessionId] !== undefined) body.session_note = sessionNoteDraft[sessionId];
    const res = await fetch("/api/online-class/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) { const r = await res.json(); alert(r.error || "Failed"); }
    await loadToday();
    await loadWeek();
    setUpdating(null);
  }

  async function saveSessionNote(sessionId: string, value: string) {
    const res = await fetch("/api/online-class/sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sessionId, session_note: value }),
    });
    if (res.ok) {
      setTodaySessions(prev => prev.map(s => s.id === sessionId ? { ...s, session_note: value.trim() || null } : s));
    }
  }

  useEffect(() => { if (tutor) { loadEnrollments(); loadWeek(); loadToday(); } }, [tutor, loadEnrollments, loadWeek, loadToday]);

  async function saveNote(enrollmentId: string, value: string) {
    const res = await fetch(`/api/online-class/enrollments/${enrollmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tutor_notes: value }),
    });
    if (res.ok) {
      setEnrollments(prev => prev.map(e => e.id === enrollmentId ? { ...e, tutor_notes: value } : e));
    }
    setEditingNoteId(null);
  }

  const { startDate, endDate } = weekRange(weekOffset);
  const weekByDate: Record<string, SessionItem[]> = {};
  weekSessions.forEach(s => {
    if (!weekByDate[s.scheduled_date]) weekByDate[s.scheduled_date] = [];
    weekByDate[s.scheduled_date].push(s);
  });
  const sortedDates = Object.keys(weekByDate).sort();

  const tutorParam = searchParams.get("tutor");

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.tv-w{max-width:1500px;margin:0 auto;padding:20px 24px;min-height:100vh}
.tv-back{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:600;color:#6b7c93;cursor:pointer;text-decoration:none;margin-bottom:14px}
.tv-back:hover{background:#f8fafc}
.tv-head{margin-bottom:20px}
.tv-head h1{font-size:22px;font-weight:800;color:#1a1a2e;margin-bottom:4px}
.tv-head .who{font-size:13px;color:#6b7c93}
.tv-tabs{display:flex;gap:0;background:#fff;border-radius:10px;margin-bottom:16px;border:1px solid #e2e8f0;overflow:hidden}
.tv-tab{flex:1;padding:12px;font-size:14px;font-weight:700;text-align:center;border:none;cursor:pointer;font-family:inherit;background:transparent;color:#6b7c93}
.tv-tab.ac{background:#1a6fc4;color:#fff}
.tv-card{background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:16px;margin-bottom:12px}
.tv-empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px;background:#fff;border:1px dashed #e2e8f0;border-radius:12px}
.tbl-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:visible}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{background:#f8fafc;padding:10px 12px;text-align:left;font-size:12px;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle;white-space:nowrap}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:#fafbfc}
.cell-remaining{color:#166534;font-weight:800}
.cell-name{font-weight:700}
.cell-en-link{font-weight:800;color:#1a6fc4;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.cell-en-link:hover{color:#0d3d7a}
.cell-notes{white-space:normal;min-width:200px;color:#475569;cursor:pointer;padding:6px 12px !important;border-radius:6px}
.cell-notes:hover{background:#eff6ff}
.cell-notes.empty{color:#cbd5e1;font-style:italic}
.cell-notes textarea{width:100%;min-height:60px;padding:6px 8px;border:1px solid #1a6fc4;border-radius:6px;font-family:inherit;font-size:12px;outline:none;resize:vertical;background:#fff}
.day-header{font-size:15px;font-weight:800;color:#374151;margin:18px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
.sch-row{display:grid;grid-template-columns:80px 1fr 80px 60px 100px;gap:10px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:8px}
.sch-time{font-size:15px;font-weight:800;color:#1a6fc4}
.sch-name{font-size:14px;font-weight:700;color:#1a1a2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sch-kr{font-size:12px;color:#6b7c93}
.sch-no{font-size:12px;color:#6b7c93}
.badge{display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-align:center}
.week-range{font-size:13px;color:#6b7c93;margin-bottom:12px}
.week-nav{display:flex;align-items:center;gap:10px;margin-bottom:16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px}
.week-nav button{padding:7px 14px;border:1px solid #e2e8f0;background:#fff;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:#334155}
.week-nav button:hover{background:#f8fafc;border-color:#1a6fc4;color:#1a6fc4}
.week-nav .center{flex:1;text-align:center;font-size:14px;font-weight:800;color:#1a1a2e}
.week-nav .center .sub{font-size:12px;font-weight:500;color:#64748b;margin-left:8px}
.week-nav .today-btn{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.week-nav .today-btn:hover{background:#0d3d7a;color:#fff}
.td-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px}
.td-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.td-time{font-size:17px;font-weight:800;color:#1a6fc4}
.td-info{margin-bottom:12px}
.td-info .name{font-size:16px;font-weight:800;color:#1a1a2e}
.td-info .meta{font-size:12px;color:#6b7c93;margin-top:4px}
.td-btns{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.td-btn{padding:9px;border:1.5px solid #e2e8f0;background:#fff;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;color:#64748b}
.td-btn:hover{background:#f8fafc}
.td-btn:disabled{opacity:0.4;cursor:not-allowed}
.td-btn.ac-scheduled{background:#f1f5f9;border-color:#94a3b8;color:#334155}
.td-btn.ac-attended{background:#16a34a;border-color:#16a34a;color:#fff}
.td-btn.ac-absent{background:#dc2626;border-color:#dc2626;color:#fff}
.td-btn.ac-makeup{background:#eab308;border-color:#eab308;color:#fff}
.td-btn.ac-undo{background:#64748b;border-color:#64748b;color:#fff}
.td-note{margin-top:10px;border-top:1px dashed #e2e8f0;padding-top:10px}
.td-note-label{display:block;font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;text-transform:uppercase;letter-spacing:.3px}
.td-note-ta{width:100%;min-height:32px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-family:inherit;font-size:12.5px;outline:none;resize:vertical;background:#fff;color:#334155;line-height:1.5;overflow:hidden}
.td-note-ta:focus{border-color:#1a6fc4;background:#fffdf5}
.td-note-ta::placeholder{color:#cbd5e1;font-style:italic}
.wk-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.wk-col{min-height:120px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px}
.wk-head{font-size:12px;font-weight:800;color:#1a1a2e;text-align:center;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.wk-empty{font-size:11px;color:#cbd5e1;text-align:center;padding:14px 0;font-style:italic}
.wk-card{position:relative;padding:8px 8px 8px 12px;background:#f8fafc;border-radius:7px;font-size:11px;overflow:hidden}
.wk-card .wk-bar{position:absolute;left:0;top:0;bottom:0;width:3px;background:#94a3b8}
.wk-time{font-size:12px;font-weight:800;color:#1a6fc4;margin-bottom:2px}
.wk-name{font-size:12px;font-weight:700;color:#1a1a2e;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wk-meta{font-size:10px;color:#94a3b8;margin-bottom:4px}
.wk-badge{display:inline-block;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700}
.wk-note-icon{position:absolute;top:6px;right:6px;font-size:11px;cursor:help}
.tv-admin-ribbon{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;font-size:12.5px;color:#78350f;font-weight:700;flex-wrap:wrap;margin-bottom:14px}
.tv-admin-ribbon select{padding:4px 10px;border:1px solid #fcd34d;border-radius:6px;background:#fff;font-size:12.5px;font-family:inherit;font-weight:700;color:#78350f;cursor:pointer;outline:none}
.tv-admin-ribbon select:focus{border-color:#f59e0b}
.tv-admin-ribbon .tv-admin-switch{color:#1a6fc4;font-weight:700;text-decoration:none;font-size:12px}
.tv-admin-ribbon .tv-admin-switch:hover{text-decoration:underline}
.tv-select-intro{margin-bottom:10px}
.tv-select-intro h2{font-size:18px;font-weight:800;color:#1a1a2e;margin:0 0 4px}
.tv-select-intro p{font-size:13px;color:#6b7c93;margin:0}
.tv-select-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:14px}
.tv-select-card{aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;border-radius:14px;font-size:16px;font-weight:800;color:#fff;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,0.08);transition:transform 120ms,box-shadow 120ms;text-align:center;padding:8px}
.tv-select-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,0.18)}
@media(max-width:800px){.tv-select-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:500px){.tv-select-grid{grid-template-columns:repeat(2,1fr)}.tv-admin-ribbon{width:100%}}
    `}</style>
    <div className="tv-w">
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8,alignItems:'center'}}>
        <a href="/admin/online-class-attendance" className="tv-back" style={{margin:0}}>← Back to Attendance</a>
        <a href="/tutor/guide" className="tv-back" style={{margin:0,background:'#eff6ff',borderColor:'#bfdbfe',color:'#1a6fc4'}}>📖 Guide</a>
        {adminRole === "admin" && tutorParam && tutor && (
          <div className="tv-admin-ribbon" style={{marginLeft:'auto'}}>
            <span>👁 Admin view — showing {tutor.name_display}</span>
            <select
              value={tutorParam}
              onChange={e => router.push(`/tutor/online-class?tutor=${e.target.value}`)}
              aria-label="View as tutor"
            >
              {TUTOR_ACCOUNTS.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.label}</option>
              ))}
            </select>
            <a href="/tutor/online-class" className="tv-admin-switch">← All tutors</a>
          </div>
        )}
      </div>

      <div className="tv-head">
        <h1>My Online Class</h1>
        <div className="who">
          {loadingTutor
            ? "Loading..."
            : tutor
              ? `${tutor.name_display}${tutor.name_en ? ` (${tutor.name_en})` : ""}`
              : adminRole === "admin" && !tutorParam
                ? "Admin — select a tutor below"
                : "⚠️ Tutor profile not found for this account."}
        </div>
      </div>

      <div className="tv-tabs">
        <button className={`tv-tab${tab === "today" ? " ac" : ""}`} onClick={() => setTab("today")}>📅 Today</button>
        <button className={`tv-tab${tab === "students" ? " ac" : ""}`} onClick={() => setTab("students")}>👩‍🎓 My Students</button>
        <button className={`tv-tab${tab === "schedule" ? " ac" : ""}`} onClick={() => setTab("schedule")}>📆 My Schedule</button>
      </div>

      {!loadingTutor && !tutor && (
        adminRole === "admin" && !tutorParam ? (
          <div className="tv-card">
            <div className="tv-select-intro">
              <h2>Select a tutor to view</h2>
              <p>As an admin, you can view any tutor&apos;s dashboard.</p>
            </div>
            <div className="tv-select-grid">
              {TUTOR_ACCOUNTS.map(acc => (
                <a
                  key={acc.id}
                  href={`/tutor/online-class?tutor=${acc.id}`}
                  className="tv-select-card"
                  style={{ background: TUTOR_COLORS[acc.label] || "#64748b" }}
                >
                  {acc.label}
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div className="tv-empty">
            No tutor profile linked to this account. Please contact admin or use ?tutor=&lt;staff_user_id&gt; in the URL.
          </div>
        )
      )}

      {tutor && tab === "today" && (
        <>
          <div className="week-nav">
            <button onClick={() => setDateOffset(o => o - 1)}>◀ Previous</button>
            <div
              className="center"
              style={{ cursor: "pointer" }}
              title="Click to pick a date"
              onClick={() => {
                const el = dateInputRef.current;
                if (!el) return;
                const picker = (el as HTMLInputElement & { showPicker?: () => void }).showPicker;
                if (typeof picker === "function") picker.call(el);
                else el.click();
              }}
            >
              📅 {formatTodayEN(selectedDate)}
            </div>
            {dateOffset !== 0 && <button className="today-btn" onClick={() => setDateOffset(0)}>Today</button>}
            <button onClick={() => setDateOffset(o => o + 1)}>Next ▶</button>
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={e => { if (e.target.value) setDateOffset(diffDays(e.target.value, fmt(new Date()))); }}
              style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
            />
          </div>
          {todaySessions.length === 0 ? (
            <div className="tv-empty">No classes scheduled on {formatTodayEN(selectedDate)}.</div>
          ) : (
            todaySessions
              .slice()
              .sort((a, b) => (a.scheduled_time_ph || "").localeCompare(b.scheduled_time_ph || ""))
              .map(s => {
                const st = SES_STYLE[s.status] || SES_STYLE.scheduled;
                const studentName = s.enrollment?.student_name_en || s.enrollment?.student_name || "-";
                const cur = s.status;
                return (
                  <div key={s.id} className="td-card">
                    <div className="td-top">
                      <div className="td-time">{s.scheduled_time_ph || "-"} <span style={{fontSize:12,fontWeight:600,color:"#94a3b8"}}>· KR {s.scheduled_time_kr || "-"}</span></div>
                      <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div className="td-info">
                      <div className="name">{studentName}</div>
                      <div className="meta">Session #{s.session_number}</div>
                    </div>
                    <div className="td-btns">
                      <button className={`td-btn${cur === "scheduled" ? " ac-undo" : ""}`} disabled={updating === s.id} onClick={() => markStatus(s.id, "scheduled")} style={{background:"#f1f5f9",color:"#64748b",borderColor:"#cbd5e1"}}>↺ Undo</button>
                      <button className={`td-btn${cur === "attended" ? " ac-attended" : ""}`} disabled={updating === s.id} onClick={() => markStatus(s.id, "attended")}>✓ Attended</button>
                      <button className={`td-btn${(cur === "no_show" || cur === "absent") ? " ac-absent" : ""}`} disabled={updating === s.id} onClick={() => markStatus(s.id, "no_show")}>✗ Absent</button>
                      <button className={`td-btn${cur === "makeup" ? " ac-makeup" : ""}`} disabled={updating === s.id} onClick={() => markStatus(s.id, "makeup")}>△ Makeup</button>
                    </div>
                    <div className="td-note">
                      <label className="td-note-label">Notes (optional)</label>
                      <textarea
                        className="td-note-ta"
                        rows={1}
                        placeholder="Any notes about today's class? (e.g., student was late, tech issue)"
                        value={sessionNoteDraft[s.id] !== undefined ? sessionNoteDraft[s.id] : (s.session_note || "")}
                        onChange={e => {
                          setSessionNoteDraft(prev => ({ ...prev, [s.id]: e.target.value }));
                          const el = e.target as HTMLTextAreaElement;
                          el.style.height = "auto";
                          el.style.height = el.scrollHeight + "px";
                        }}
                        onBlur={e => {
                          const draft = sessionNoteDraft[s.id];
                          if (draft !== undefined && draft !== (s.session_note || "")) {
                            saveSessionNote(s.id, draft);
                          }
                          const el = e.target as HTMLTextAreaElement;
                          if (!el.value) { el.style.height = ""; }
                        }}
                      />
                    </div>
                  </div>
                );
              })
          )}
        </>
      )}

      {tutor && tab === "students" && (
        enrollments.length === 0 ? (
          <div className="tv-empty">No students assigned yet.</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>English Name</th><th>Age</th><th>Days</th>
                  <th>KR Time</th><th>PH Time</th><th>Start</th><th>End</th>
                  <th>Period</th><th>Class Period</th>
                  <th>Pre</th><th>Post</th><th>Total</th><th>Remaining</th>
                  <th style={{ minWidth: 220 }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map(e => {
                  const total = e.total_sessions || 0;
                  const used = e.used_sessions || 0;
                  const remaining = Math.max(0, total - used);
                  const age = e.student_birth_year ? (new Date().getFullYear() - Number(e.student_birth_year)) : null;
                  const isEditing = editingNoteId === e.id;
                  return (
                    <tr key={e.id}>
                      <td className="cell-en-link" onClick={() => setInvoiceStudent(e.id)} title="Click to view calendar">
                        {e.student_name_en || e.student_name || "-"}
                      </td>
                      <td>{age !== null && !isNaN(age) ? age : (e.student_birth_year || "-")}</td>
                      <td>{capDays(e.days_of_week)}</td>
                      <td>{e.class_time_kr || "-"}</td>
                      <td>{e.class_time_ph || "-"}</td>
                      <td>{e.start_date || "-"}</td>
                      <td>{e.end_date || "-"}</td>
                      <td>{e.duration_weeks ? `${e.duration_weeks} wks` : "-"}</td>
                      <td>{e.class_period || "-"}</td>
                      <td>{e.pre_sessions ?? 0}</td>
                      <td>{e.post_sessions ?? 0}</td>
                      <td>{total}</td>
                      <td className="cell-remaining">{remaining}</td>
                      <td
                        className={`cell-notes${!e.tutor_notes && !isEditing ? " empty" : ""}`}
                        onClick={() => { if (!isEditing) { setEditingNoteId(e.id); setNoteDraft(e.tutor_notes || ""); } }}
                      >
                        {isEditing ? (
                          <textarea
                            autoFocus
                            value={noteDraft}
                            onChange={ev => setNoteDraft(ev.target.value)}
                            onBlur={() => saveNote(e.id, noteDraft.trim())}
                            onKeyDown={ev => {
                              if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); saveNote(e.id, noteDraft.trim()); }
                              if (ev.key === "Escape") { setEditingNoteId(null); }
                            }}
                            placeholder="Enter to save (Shift+Enter: new line)"
                          />
                        ) : (
                          e.tutor_notes || "Click to add notes"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {invoiceStudent && <StudentInvoiceCalendar enrollmentId={invoiceStudent} onClose={() => setInvoiceStudent(null)} />}

      {tutor && tab === "schedule" && (
        <>
          <div className="week-nav">
            <button onClick={() => setWeekOffset(o => o - 1)}>◀ Previous Week</button>
            <div className="center">
              📅 {weekLabel(weekOffset)}
              <span className="sub">{formatWeekRangeEN(startDate, endDate)}</span>
            </div>
            {weekOffset !== 0 && <button className="today-btn" onClick={() => setWeekOffset(0)}>Today</button>}
            <button onClick={() => setWeekOffset(o => o + 1)}>Next Week ▶</button>
          </div>
          <div className="wk-grid">
            {Array.from({ length: 7 }).map((_, i) => {
              const d = new Date(startDate); d.setDate(startDate.getDate() + i);
              const dateStr = fmt(d);
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
                    const studentName = s.enrollment?.student_name_en || s.enrollment?.student_name || "-";
                    return (
                      <div key={s.id} className="wk-card">
                        <div className="wk-bar" />
                        <div className="wk-time">{s.scheduled_time_ph || "-"}</div>
                        <div className="wk-name">{studentName}</div>
                        <div className="wk-meta">#{s.session_number}</div>
                        <span className="wk-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        {s.session_note && <span className="wk-note-icon" title={s.session_note}>💬</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  </>);
}

export default function TutorOnlineClassPage() {
  return (
    <Suspense fallback={null}>
      <TutorOnlineClassInner />
    </Suspense>
  );
}
