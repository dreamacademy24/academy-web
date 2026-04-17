"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";

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
}

interface SessionItem {
  id: string;
  session_number: number;
  scheduled_date: string;
  scheduled_time_ph: string | null;
  scheduled_time_kr: string | null;
  status: string;
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

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sat = new Date(mon); sat.setDate(mon.getDate() + 5);
  return { start: fmt(mon), end: fmt(sat), startDate: mon, endDate: sat };
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
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"students" | "schedule">("students");
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [loadingTutor, setLoadingTutor] = useState(true);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [weekSessions, setWeekSessions] = useState<SessionItem[]>([]);

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else if (typeof window !== "undefined") window.location.href = "/login";
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
    const { start, end } = weekRange();
    const res = await fetch(`/api/online-class/sessions?start=${start}&end=${end}`);
    if (res.ok) {
      const d = await res.json();
      const all = (d.sessions || []) as (SessionItem & { tutor?: { id: string } | null })[];
      setWeekSessions(all.filter(s => s.tutor && s.tutor.id === tutor.id));
    }
  }, [tutor]);

  useEffect(() => { if (tutor) { loadEnrollments(); loadWeek(); } }, [tutor, loadEnrollments, loadWeek]);

  const { startDate, endDate } = weekRange();
  const weekByDate: Record<string, SessionItem[]> = {};
  weekSessions.forEach(s => {
    if (!weekByDate[s.scheduled_date]) weekByDate[s.scheduled_date] = [];
    weekByDate[s.scheduled_date].push(s);
  });
  const sortedDates = Object.keys(weekByDate).sort();

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.tv-w{max-width:1100px;margin:0 auto;padding:20px 16px;min-height:100vh}
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
.tbl-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;min-width:1100px;font-size:13px}
.tbl th{background:#f8fafc;padding:10px 12px;text-align:left;font-size:12px;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:10px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top;white-space:nowrap}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:#fafbfc}
.cell-remaining{color:#166534;font-weight:800}
.cell-name{font-weight:700}
.cell-notes{white-space:normal;min-width:160px;color:#475569}
.day-header{font-size:15px;font-weight:800;color:#374151;margin:18px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
.sch-row{display:grid;grid-template-columns:80px 1fr 80px 60px 100px;gap:10px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:8px}
.sch-time{font-size:15px;font-weight:800;color:#1a6fc4}
.sch-name{font-size:14px;font-weight:700;color:#1a1a2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sch-kr{font-size:12px;color:#6b7c93}
.sch-no{font-size:12px;color:#6b7c93}
.badge{display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;text-align:center}
.week-range{font-size:13px;color:#6b7c93;margin-bottom:12px}
@media(max-width:640px){
  .sch-row{grid-template-columns:70px 1fr 90px;grid-template-rows:auto auto;gap:6px}
  .sch-kr{grid-column:2;font-size:11px}
  .sch-no{display:none}
}
    `}</style>
    <div className="tv-w">
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
        <a href="/staff/online-class" className="tv-back" style={{margin:0}}>← Back to Attendance</a>
        <a href="/guide?tab=tutor" className="tv-back" style={{margin:0,background:'#eff6ff',borderColor:'#bfdbfe',color:'#1a6fc4'}}>📖 Guide</a>
      </div>

      <div className="tv-head">
        <h1>My Online Class</h1>
        <div className="who">
          {loadingTutor ? "Loading..." : (tutor ? `${tutor.name_display}${tutor.name_en ? ` (${tutor.name_en})` : ""}` : "⚠️ Tutor profile not found for this account.")}
        </div>
      </div>

      <div className="tv-tabs">
        <button className={`tv-tab${tab === "students" ? " ac" : ""}`} onClick={() => setTab("students")}>👩‍🎓 My Students</button>
        <button className={`tv-tab${tab === "schedule" ? " ac" : ""}`} onClick={() => setTab("schedule")}>📆 My Schedule</button>
      </div>

      {!loadingTutor && !tutor && (
        <div className="tv-empty">
          No tutor profile linked to this account. Please contact admin or use ?tutor=&lt;staff_user_id&gt; in the URL.
        </div>
      )}

      {tutor && tab === "students" && (
        enrollments.length === 0 ? (
          <div className="tv-empty">No students assigned yet.</div>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Student</th><th>English Name</th><th>Age</th><th>Days</th>
                  <th>KR Time</th><th>PH Time</th><th>Start</th><th>End</th>
                  <th>Period</th><th>Class Period</th>
                  <th>Pre</th><th>Post</th><th>Total</th><th>Remaining</th><th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map(e => {
                  const total = e.total_sessions || 0;
                  const used = e.used_sessions || 0;
                  const remaining = Math.max(0, total - used);
                  const age = e.student_birth_year ? (new Date().getFullYear() - Number(e.student_birth_year)) : null;
                  return (
                    <tr key={e.id}>
                      <td className="cell-name">{e.student_name || "-"}</td>
                      <td>{e.student_name_en || "-"}</td>
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
                      <td className="cell-notes">{e.notes || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tutor && tab === "schedule" && (
        <>
          <div className="week-range">📅 {formatWeekRangeEN(startDate, endDate)}</div>
          {sortedDates.length === 0 ? (
            <div className="tv-empty">No classes this week.</div>
          ) : sortedDates.map(date => (
            <div key={date}>
              <div className="day-header">{formatDayHeader(date)}</div>
              {weekByDate[date]
                .sort((a, b) => (a.scheduled_time_ph || "").localeCompare(b.scheduled_time_ph || ""))
                .map(s => {
                  const st = SES_STYLE[s.status] || SES_STYLE.scheduled;
                  const studentName = s.enrollment?.student_name_en || s.enrollment?.student_name || "-";
                  return (
                    <div key={s.id} className="sch-row">
                      <div className="sch-time">{s.scheduled_time_ph || "-"}</div>
                      <div className="sch-name">{studentName}</div>
                      <div className="sch-kr">KR: {s.scheduled_time_kr || "-"}</div>
                      <div className="sch-no">#{s.session_number}</div>
                      <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                  );
                })}
            </div>
          ))}
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
