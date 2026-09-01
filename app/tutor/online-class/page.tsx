"use client";
// Teacher Online Class — full redesign 2026-08-26 (3 tabs: Today / My Students / Schedule)
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";
import StudentInvoiceCalendar from "@/components/StudentInvoiceCalendar";

// Admin can view other teachers' dashboards (?tutor= / select)
const TUTOR_ACCOUNTS: { id: string; label: string }[] = [
  { id: "admin-angelica", label: "T.Angelica" },
  { id: "admin-jean", label: "T.Jean" },
  { id: "admin-ann", label: "T.Ann" },
  { id: "admin-florefe", label: "T.Florefe" },
  { id: "admin-jenny", label: "T.Jenny" },
  { id: "admin-nick", label: "T.Nick" },
  { id: "admin-carla", label: "T.Carla" },
  { id: "admin-angel", label: "T.Angel" },
  { id: "admin-amelyn", label: "T.Amelyn" },
  { id: "admin-cristel", label: "T.Cristel" },
];

interface Tutor { id: string; staff_user_id: string | null; name_display: string; name_en: string | null; level?: string | null }
interface Enrollment {
  id: string; student_name: string; student_name_en: string | null; student_birth_year: string | null;
  days_of_week: string[] | null; class_time_kr: string | null; class_time_ph: string | null;
  day_times?: Record<string, string> | null; level?: string | null;
  start_date: string | null; end_date: string | null; class_period: string | null;
  total_sessions: number | null; used_sessions: number | null; status: string | null;
  notes: string | null; tutor_notes: string | null;
}
interface Ses {
  id: string; session_number: number; scheduled_date: string;
  scheduled_time_ph: string | null; scheduled_time_kr: string | null;
  status: string; session_note: string | null;
  attitude?: string | null; attitude_note?: string | null;
  enrollment: { id: string; student_name: string; student_name_en: string | null } | null;
}

const ST: Record<string, { label: string; bg: string; color: string }> = {
  scheduled: { label: "Scheduled", bg: "#eef2f7", color: "#64748b" },
  attended: { label: "Attended", bg: "#dcfce7", color: "#166534" },
  no_show: { label: "Absent", bg: "#fee2e2", color: "#dc2626" },
  absent: { label: "Absent", bg: "#fee2e2", color: "#dc2626" },
  cancelled: { label: "Cancelled", bg: "#fee2e2", color: "#dc2626" },
  makeup: { label: "Makeup", bg: "#fef3c7", color: "#92400e" },
};
const LV: Record<string, { label: string; bg: string; color: string }> = {
  beginner: { label: "Beginner", bg: "#dbeafe", color: "#1e40af" },
  intermediate: { label: "Intermediate", bg: "#ede9fe", color: "#6d28d9" },
  advanced: { label: "Advanced", bg: "#fce7f3", color: "#9d174d" },
};
const DAY_EN: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun", "월": "Mon", "화": "Tue", "수": "Wed", "목": "Thu", "금": "Fri", "토": "Sat", "일": "Sun" };

const pad = (n: number) => String(n).padStart(2, "0");
const fmtD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s: string, n: number) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return fmtD(d); };
function weekStart(offset: number) { const now = new Date(); const day = now.getDay(); const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7); return mon; }
const dateEN = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const shortEN = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Inner() {
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState(false);
  const [adminRole, setAdminRole] = useState("");
  const [tab, setTab] = useState<"today" | "students" | "schedule" | "requests" | "open">("today");
  const [openStudents, setOpenStudents] = useState<Enrollment[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [availMap, setAvailMap] = useState<Record<string, { names: string[]; meFree: boolean }>>({});
  const [changeReqs, setChangeReqs] = useState<any[]>([]);
  const [reqBusy, setReqBusy] = useState<string | null>(null);
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [loadingTutor, setLoadingTutor] = useState(true);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [todaySessions, setTodaySessions] = useState<Ses[]>([]);
  const [weekSessions, setWeekSessions] = useState<Ses[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [dateOffset, setDateOffset] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [invoiceStudent, setInvoiceStudent] = useState<string | null>(null);
  const [expandStu, setExpandStu] = useState<string | null>(null);
  const [pickSes, setPickSes] = useState<{ enrId: string; ses: Ses } | null>(null);
  const [stuSessions, setStuSessions] = useState<Record<string, Ses[]>>({});
  const [notifs, setNotifs] = useState<Array<{ id: string; message: string; is_read: boolean; created_at: string }>>([]);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const selectedDate = addDays(fmtD(new Date()), dateOffset);

  useEffect(() => {
    if (isAdminAuthed()) { setAuthed(true); setAdminRole(getAdminInfo()?.role || ""); }
    else if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  const resolveTutor = useCallback(async () => {
    if (!authed) return;
    setLoadingTutor(true);
    let sid = getAdminInfo()?.staffId || "";
    const qp = searchParams.get("tutor");
    if (qp) sid = qp;
    if (!sid) { setTutor(null); setLoadingTutor(false); return; }
    const res = await fetch(`/api/online-class/tutors?staff_user_id=${encodeURIComponent(sid)}`);
    if (res.ok) { const d = await res.json(); setTutor(d.tutor || null); }
    setLoadingTutor(false);
  }, [authed, searchParams]);
  useEffect(() => { resolveTutor(); }, [resolveTutor]);

  const loadEnrollments = useCallback(async () => {
    if (!tutor) return;
    const res = await fetch(`/api/online-class/enrollments?tutor_id=${tutor.id}`);
    if (res.ok) { const d = await res.json(); setEnrollments((d.enrollments || []).filter((e: Enrollment) => e.status === "active")); }
  }, [tutor]);

  const loadToday = useCallback(async () => {
    if (!tutor) return;
    const res = await fetch(`/api/online-class/sessions?date=${selectedDate}`);
    if (res.ok) {
      const d = await res.json();
      setTodaySessions((d.sessions || []).filter((s: any) => s.tutor_id === tutor.id || s.tutor?.id === tutor.id));
    }
  }, [tutor, selectedDate]);

  const loadWeek = useCallback(async () => {
    if (!tutor) return;
    const mon = weekStart(weekOffset);
    const res = await fetch(`/api/online-class/sessions?start=${fmtD(mon)}&end=${addDays(fmtD(mon), 6)}`);
    if (res.ok) {
      const d = await res.json();
      setWeekSessions((d.sessions || []).filter((s: any) => s.tutor_id === tutor.id || s.tutor?.id === tutor.id));
    }
  }, [tutor, weekOffset]);

  useEffect(() => { loadEnrollments(); }, [loadEnrollments]);
  useEffect(() => { loadToday(); }, [loadToday]);
  useEffect(() => { loadWeek(); }, [loadWeek]);

  // notifications (30s poll)
  const loadNotifs = useCallback(async () => {
    if (!tutor) return;
    const res = await fetch(`/api/online-class/notifications?tutor_id=${tutor.id}`);
    if (res.ok) { const d = await res.json(); setNotifs(d.notifications || []); }
  }, [tutor]);
  useEffect(() => { loadNotifs(); const t = setInterval(loadNotifs, 30000); return () => clearInterval(t); }, [loadNotifs]);

  const loadChangeReqs = useCallback(async () => {
    if (!tutor) return;
    const res = await fetch(`/api/online-class/change-requests?tutor_id=${tutor.id}&status=pending`);
    if (res.ok) { const d = await res.json(); setChangeReqs((d.requests || []).filter((r: any) => r.teacher_status === "pending")); }
  }, [tutor]);
  useEffect(() => { loadChangeReqs(); }, [loadChangeReqs]);
  async function teacherProcess(id: string, action: "teacher_approve" | "teacher_reject") {
    let teacher_note: string | null = null;
    if (action === "teacher_reject") { teacher_note = window.prompt("Reason for rejecting (optional):") || null; }
    setReqBusy(id);
    const res = await fetch("/api/online-class/change-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, teacher_note }) });
    setReqBusy(null);
    if (!res.ok) { const r = await res.json(); alert(r.error || "Failed"); return; }
    loadChangeReqs();
  }
  const unread = notifs.filter(n => !n.is_read);
  async function markNotifsRead() {
    if (!tutor || unread.length === 0) { setNotifDismissed(true); return; }
    await fetch("/api/online-class/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: unread.map(n => n.id) }) });
    setNotifDismissed(true); loadNotifs();
  }

  async function markStatus(s: Ses, status: string) {
    setUpdating(s.id);
    const body: Record<string, unknown> = { id: s.id, status, recorded_by: tutor?.staff_user_id || "" };
    if (status === "makeup") body.force_makeup = true; // 보강 = 무차감 + 마지막에 1회 추가 (어드민과 동일)
    if (noteDraft[s.id] !== undefined) body.session_note = noteDraft[s.id];
    const res = await fetch("/api/online-class/sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const r = await res.json(); alert(r.error || "Failed"); }
    await loadToday(); await loadWeek(); await loadEnrollments();
    setUpdating(null);
  }
  async function saveNote(s: Ses, value: string) {
    await fetch("/api/online-class/sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: s.id, session_note: value }) });
    setTodaySessions(prev => prev.map(x => x.id === s.id ? { ...x, session_note: value.trim() || null } : x));
  }
  async function setAttitude(s: Ses, val: string) {
    let note: string | null = s.attitude_note || null;
    if (val === "issue") {
      const input = window.prompt("Describe the behavior issue (visible to admin):", s.attitude_note || "");
      if (input === null) return;
      note = input.trim() || null;
    } else note = null;
    const res = await fetch("/api/online-class/sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: s.id, attitude: val === "clear" ? null : val, attitude_note: note }) });
    if (!res.ok) { const r = await res.json(); alert(r.error || "Failed"); return; }
    setTodaySessions(prev => prev.map(x => x.id === s.id ? { ...x, attitude: val === "clear" ? null : val, attitude_note: note } : x));
  }
  async function toggleStuSessions(enrId: string) {
    if (expandStu === enrId) { setExpandStu(null); return; }
    setExpandStu(enrId);
    if (!stuSessions[enrId]) {
      const res = await fetch(`/api/online-class/sessions?enrollment_id=${enrId}`);
      if (res.ok) { const d = await res.json(); setStuSessions(prev => ({ ...prev, [enrId]: d.sessions || [] })); }
    }
  }

  async function markStuSession(enrId: string, s: Ses, status: string) {
    const body: Record<string, unknown> = { id: s.id, status, recorded_by: tutor?.staff_user_id || "" };
    if (status === "makeup") body.force_makeup = true;
    const res = await fetch("/api/online-class/sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setPickSes(null);
    if (!res.ok) { const r = await res.json().catch(() => ({})); alert((r as any).error || "Failed"); return; }
    const rr = await fetch(`/api/online-class/sessions?enrollment_id=${enrId}`);
    if (rr.ok) { const d = await rr.json(); setStuSessions(prev => ({ ...prev, [enrId]: d.sessions || [] })); }
    await loadEnrollments(); await loadToday(); await loadWeek();
  }

  const loadOpenStudents = useCallback(async () => {
    const res = await fetch("/api/online-class/enrollments?unassigned=true");
    if (!res.ok) return;
    const d = await res.json();
    const list: Enrollment[] = d.enrollments || [];
    setOpenStudents(list);
    // 각 수강권의 요일·시간에 가능한 티쳐 조회 (한정된 시간/자리 표시)
    const entries = await Promise.all(list.map(async e => {
      if (!e.days_of_week?.length || !e.class_time_kr) return [e.id, { names: [], meFree: true }] as const;
      try {
        const r = await fetch(`/api/online-class/availability?days=${encodeURIComponent((e.days_of_week || []).join(","))}&time=${encodeURIComponent(e.class_time_kr)}`);
        if (!r.ok) return [e.id, { names: [], meFree: true }] as const;
        const a = await r.json();
        const frees = (a.tutors || []).filter((t: any) => t.available);
        return [e.id, { names: frees.map((t: any) => t.name), meFree: tutor ? frees.some((t: any) => t.id === tutor.id) : true }] as const;
      } catch { return [e.id, { names: [], meFree: true }] as const; }
    }));
    setAvailMap(Object.fromEntries(entries));
  }, [tutor]);
  useEffect(() => { if (tutor) loadOpenStudents(); }, [tutor, loadOpenStudents]);

  async function claimStudent(e: Enrollment) {
    if (!tutor) return;
    if (!confirm(`Take ${e.student_name_en || e.student_name}?\n${(e.days_of_week || []).join("/")} · PH ${e.class_time_ph || "-"}`)) return;
    setClaiming(e.id);
    const res = await fetch("/api/online-class/enrollments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id, tutor_id: tutor.id }) });
    const r = await res.json().catch(() => ({}));
    setClaiming(null);
    if (!res.ok) { alert((r as any).error || "Failed — maybe another teacher took this student already."); await loadOpenStudents(); return; }
    await loadOpenStudents(); await loadEnrollments(); await loadWeek();
    alert(`✅ ${e.student_name_en || e.student_name} is now your student!`);
  }

  if (!authed) return null;
  if (loadingTutor) return <div className="tcw"><div className="empty">Loading…</div><Css /></div>;

  const isAdminViewer = adminRole && adminRole !== "local_teacher";
  const stuName = (s: Ses) => s.enrollment?.student_name_en || s.enrollment?.student_name || "?";
  const doneCnt = todaySessions.filter(s => s.status !== "scheduled").length;
  const sortedToday = [...todaySessions].sort((a, b) => (a.scheduled_time_ph || "").localeCompare(b.scheduled_time_ph || ""));

  return (
    <div className="tcw">
      {/* ── Header ── */}
      <div className="hd">
        <div>
          <div className="hd-t">💻 Online Class {tutor ? <span className="hd-name">{tutor.name_display}</span> : null}
            {tutor?.level && LV[tutor.level] && <span className="chip" style={{ background: LV[tutor.level].bg, color: LV[tutor.level].color }}>{LV[tutor.level].label}</span>}
          </div>
          <div className="hd-s">{dateEN(fmtD(new Date()))} · PH time</div>
        </div>
        <div style={{ flex: 1 }} />
        {isAdminViewer && (
          <select className="sel" value={searchParams.get("tutor") || ""} onChange={e => { window.location.href = `/tutor/online-class?tutor=${e.target.value}`; }}>
            <option value="">— view as teacher —</option>
            {TUTOR_ACCOUNTS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        )}
        <a href="/admineng/hub" className="hub">← Hub</a>
      </div>

      {!tutor ? <div className="empty">No teacher account matched. Please contact the manager.</div> : (
        <>
          {/* ── Tabs ── */}
          <div className="tabs">
            <button className={`tb ${tab === "today" ? "on" : ""}`} onClick={() => setTab("today")}>📅 Today {todaySessions.length > 0 && <span className="cnt">{doneCnt}/{todaySessions.length}</span>}</button>
            <button className={`tb ${tab === "students" ? "on" : ""}`} onClick={() => setTab("students")}>👧 My Students <span className="cnt">{enrollments.length}</span></button>
            <button className={`tb ${tab === "open" ? "on" : ""}`} onClick={() => setTab("open")}>✋ Open Students {openStudents.length > 0 && <span className="cnt" style={{ background: "#f59e0b", color: "#fff" }}>{openStudents.length}</span>}</button>
            <button className={`tb ${tab === "schedule" ? "on" : ""}`} onClick={() => setTab("schedule")}>🗓 My Schedule</button>
            <button className={`tb ${tab === "requests" ? "on" : ""}`} onClick={() => setTab("requests")}>🔔 Change Requests {changeReqs.length > 0 && <span className="cnt" style={{ background: "#dc2626", color: "#fff" }}>{changeReqs.length}</span>}</button>
          </div>

          {/* ══ TODAY ══ */}
          {tab === "today" && (
            <div>
              <div className="dnav">
                <button className="nb" onClick={() => setDateOffset(dateOffset - 1)}>‹</button>
                <button className="nb today" onClick={() => setDateOffset(0)} style={dateOffset === 0 ? { background: "#1a6fc4", color: "#fff" } : {}}>Today</button>
                <button className="nb" onClick={() => setDateOffset(dateOffset + 1)}>›</button>
                <span className="dlabel" onClick={() => dateInputRef.current?.showPicker?.()}>{dateEN(selectedDate)}</span>
                <input ref={dateInputRef} type="date" lang="en" value={selectedDate} onChange={e => { if (e.target.value) setDateOffset(Math.round((new Date(e.target.value + "T12:00:00").getTime() - new Date(fmtD(new Date()) + "T12:00:00").getTime()) / 86400000)); }} style={{ width: 0, height: 0, opacity: 0, position: "absolute" }} />
              </div>
              {sortedToday.length === 0 ? <div className="empty">No classes on this day 🌴</div> : (
                <div className="tgrid">
                  {sortedToday.map(s => {
                    const st = ST[s.status] || ST.scheduled;
                    const done = s.status !== "scheduled";
                    return (
                      <div key={s.id} className={`tcard ${done ? "done" : ""}`}>
                        <div className="trow1">
                          <div className="ttime">{s.scheduled_time_ph || "-"}<span className="tkr">KR {s.scheduled_time_kr || "-"}</span></div>
                          <span className="chip" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        </div>
                        <div className="tname">{stuName(s)} <span className="tnkr">{s.enrollment?.student_name}</span></div>
                        <div className="tmeta">Session #{s.session_number}</div>
                        <div className="tbtns">
                          <button className={`ab at ${s.status === "attended" ? "on" : ""}`} disabled={updating === s.id} onClick={() => markStatus(s, "attended")}>✓ Attended</button>
                          <button className={`ab ab2 ${(s.status === "no_show" || s.status === "absent") ? "on" : ""}`} disabled={updating === s.id} onClick={() => markStatus(s, "no_show")}>✗ Absent</button>
                          <button className={`ab am ${s.status === "makeup" ? "on" : ""}`} disabled={updating === s.id} onClick={() => markStatus(s, "makeup")}>△ Makeup</button>
                          {done && <button className="ab" disabled={updating === s.id} onClick={() => markStatus(s, "scheduled")}>↺ Undo</button>}
                        </div>
                        <div className="brow">
                          <span className="blbl">Behavior</span>
                          <button className={`bb good ${s.attitude === "good" ? "on" : ""}`} onClick={() => setAttitude(s, s.attitude === "good" ? "clear" : "good")}>😊 Good</button>
                          <button className={`bb issue ${s.attitude === "issue" ? "on" : ""}`} onClick={() => setAttitude(s, "issue")}>⚠ Issue</button>
                          {s.attitude === "issue" && s.attitude_note && <span className="bnote">{s.attitude_note}</span>}
                        </div>
                        <textarea className="nta" rows={1} placeholder="Class note (optional) — saved automatically"
                          value={noteDraft[s.id] !== undefined ? noteDraft[s.id] : (s.session_note || "")}
                          onChange={e => { setNoteDraft(prev => ({ ...prev, [s.id]: e.target.value })); const el = e.target; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
                          onBlur={e => saveNote(s, e.target.value)} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ MY STUDENTS ══ */}
          {tab === "students" && (
            enrollments.length === 0 ? <div className="empty">No active students</div> : (
              <div className="sgrid">
                {enrollments.map(e => {
                  const total = e.total_sessions || 0, used = e.used_sessions || 0;
                  const rem = Math.max(0, total - used);
                  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                  const lv = e.level && LV[e.level];
                  const open = expandStu === e.id;
                  return (
                    <div key={e.id} className="scard">
                      <div className="srow1">
                        <div className="sname">{e.student_name_en || e.student_name} <span className="tnkr">{e.student_name_en ? e.student_name : ""}</span></div>
                        {lv && <span className="chip" style={{ background: lv.bg, color: lv.color }}>{lv.label}</span>}
                      </div>
                      <div className="smeta">
                        {(e.days_of_week || []).map(d => DAY_EN[d] || d).join("/")} · PH {e.class_time_ph || "-"} <span className="tnkr">(KR {e.class_time_kr || "-"})</span>
                        {e.day_times && Object.keys(e.day_times).length > 0 && <span className="tnkr"> · per-day times</span>}
                      </div>
                      <div className="smeta">{e.start_date} ~ {e.end_date || "?"}</div>
                      <div className="pbar-wrap">
                        <div className="pbar-info"><span>Used {used} / {total}</span><b style={{ color: rem <= 3 ? "#dc2626" : "#166534" }}>{rem} left</b></div>
                        <div className="pbar"><div style={{ width: `${pct}%`, height: "100%", background: rem <= 3 ? "#ef4444" : "#1a6fc4" }} /></div>
                      </div>
                      {e.tutor_notes && <div className="snote">📝 {e.tutor_notes}</div>}
                      <div className="sbtns">
                        <button className="ab" onClick={() => toggleStuSessions(e.id)}>{open ? "▲ Hide history" : "▼ History"}</button>
                        <button className="ab" onClick={() => setInvoiceStudent(e.id)}>🧾 Calendar</button>
                      </div>
                      {open && (
                        <div className="hist">
                          {(stuSessions[e.id] || []).length === 0 ? <div className="tnkr">Loading…</div> : (() => {
                            const all = [...(stuSessions[e.id] || [])].sort((a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || ""));
                            const byM: Record<string, Ses[]> = {};
                            all.forEach(s => { const m = (s.scheduled_date || "").slice(0, 7); if (!byM[m]) byM[m] = []; byM[m].push(s); });
                            return Object.keys(byM).sort().map(m => (
                              <div key={m} style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#1a6fc4", marginBottom: 5 }}>{m}</div>
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                  {byM[m].map(s => {
                                    const st = ST[s.status] || ST.scheduled;
                                    const d = s.scheduled_date ? `${Number(s.scheduled_date.split("-")[1])}/${Number(s.scheduled_date.split("-")[2])}` : "";
                                    const lb = s.status === "attended" ? "O" : (s.status === "no_show" || s.status === "absent") ? "✗" : s.status === "makeup" ? "△" : s.status === "cancelled" ? "X" : "·";
                                    return (
                                      <div key={s.id} onClick={() => setPickSes({ enrId: e.id, ses: s })} title={`#${s.session_number} ${s.scheduled_date} · ${s.status} — tap to mark`}
                                        style={{ width: 52, borderRadius: 8, padding: "6px 2px 5px", textAlign: "center", background: st.bg, color: st.color, border: "1px solid rgba(0,0,0,0.05)", cursor: "pointer", position: "relative" }}>
                                        <div style={{ fontSize: 10.5, fontWeight: 700 }}>{d}</div>
                                        <div style={{ fontSize: 13, fontWeight: 800 }}>{lb}</div>
                                        {s.attitude === "issue" && <span style={{ position: "absolute", top: 1, right: 2, fontSize: 9 }}>⚠️</span>}
                                        {s.session_note && <span style={{ position: "absolute", bottom: 1, right: 2, fontSize: 9 }}>💬</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ));
                          })()}
                          <div className="tnkr" style={{ fontSize: 10.5 }}>O Attended · ✗ Absent · △ Makeup (no deduction) · X Cancelled — tap a box to mark</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ══ OPEN STUDENTS — 튜터 수신함 스타일 테이블 (레벨 확인 후 선택) ══ */}
          {tab === "open" && (
            openStudents.length === 0 ? <div className="empty">No open students right now 🎉</div> : (
              <div style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 14, padding: "6px 0", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
                  <thead>
                    <tr style={{ color: "#6b7c93", fontSize: 12, textAlign: "left" }}>
                      {["Student", "Level", "Days", "Time (PH)", "Period", "Sessions", "Available Teachers", "Action"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", borderBottom: "1px solid #eef2f7", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openStudents.map(e => {
                      const lv = e.level && LV[e.level];
                      const av = availMap[e.id];
                      const meBusy = av && tutor && !av.meFree;
                      return (
                        <tr key={e.id} style={{ borderBottom: "1px solid #f5f7fa" }}>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            <b>{e.student_name_en || e.student_name}</b> <span className="tnkr">{e.student_name_en ? e.student_name : ""}</span>
                          </td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            {lv ? <span className="chip" style={{ background: lv.bg, color: lv.color, fontWeight: 800 }}>{lv.label}</span> : <span style={{ color: "#cbd5e1" }}>—</span>}
                          </td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap", fontWeight: 700 }}>{(e.days_of_week || []).map(d => DAY_EN[d] || d).join("/")}</td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>{e.class_time_ph || "-"} <span className="tnkr">(KR {e.class_time_kr || "-"})</span></td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap", fontSize: 12.5 }}>{e.start_date?.slice(5)} ~ {e.end_date?.slice(5) || "?"}</td>
                          <td style={{ padding: "11px 14px", textAlign: "center", fontWeight: 800 }}>{e.total_sessions}</td>
                          <td style={{ padding: "11px 14px", fontSize: 12, lineHeight: 1.5, minWidth: 180 }}>
                            {!av ? <span className="tnkr">…</span> : av.names.length ? <span style={{ color: "#166534", fontWeight: 700 }}>{av.names.join(", ")}</span> : <span style={{ color: "#dc2626", fontWeight: 700 }}>none — slot full</span>}
                            {meBusy && <div style={{ color: "#dc2626", fontWeight: 700 }}>⚠ overlaps your class</div>}
                          </td>
                          <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                            <button className="ab" disabled={claiming === e.id} onClick={() => {
                              if (meBusy && !confirm("⚠ This overlaps your existing class time. Take anyway?")) return;
                              claimStudent(e);
                            }}
                              style={{ background: meBusy ? "#94a3b8" : "#f59e0b", color: "#fff", border: "none", fontWeight: 800, padding: "8px 14px" }}>
                              {claiming === e.id ? "Taking…" : "✋ Take"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ fontSize: 11.5, color: "#94a3b8", padding: "8px 14px" }}>Check the level and schedule, then tap ✋ Take to become the teacher. First come, first served.</div>
              </div>
            )
          )}

          {/* ══ CHANGE REQUESTS (teacher approval) ══ */}
          {tab === "requests" && (
            changeReqs.length === 0 ? <div className="empty">No pending change requests 🎉</div> : (
              <div className="sgrid">
                {changeReqs.map(r => {
                  const en = r.enrollment || {};
                  const dEn: Record<string, string> = { "월": "Mon", "화": "Tue", "수": "Wed", "목": "Thu", "금": "Fri", "토": "Sat" };
                  const dstr = (arr: any) => (arr || []).map((d: string) => dEn[d] || d).join("/");
                  return (
                    <div key={r.id} className="scard">
                      <div className="srow1">
                        <div className="sname">{en.student_name_en || en.student_name}</div>
                        <span className="chip" style={{ background: r.req_type === "single" ? "#dbeafe" : "#ede9fe", color: r.req_type === "single" ? "#1e40af" : "#6d28d9" }}>{r.req_type === "single" ? "1 session" : "Full schedule"}</span>
                      </div>
                      <div className="smeta">Now: {dstr(en.days_of_week)} {en.class_time_kr || ""}</div>
                      <div className="smeta" style={{ color: "#1a6fc4", fontWeight: 700 }}>
                        {r.req_type === "single"
                          ? `→ ${r.req_date || "(keep date)"} ${r.req_time_kr || ""}`
                          : `→ ${r.req_days_of_week?.length ? dstr(r.req_days_of_week) : dstr(en.days_of_week)} ${r.req_time_kr || en.class_time_kr || ""} (from ${r.effective_from})`}
                      </div>
                      {r.memo && <div className="snote">💬 {r.memo}</div>}
                      <div className="sbtns">
                        <button className="ab at on" disabled={reqBusy === r.id} onClick={() => teacherProcess(r.id, "teacher_approve")}>✓ Approve</button>
                        <button className="ab ab2" disabled={reqBusy === r.id} onClick={() => teacherProcess(r.id, "teacher_reject")}>✗ Reject</button>
                      </div>
                      <div className="tnkr" style={{ marginTop: 6 }}>After you approve, the Korean manager gives final approval.</div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ══ SCHEDULE ══ */}
          {tab === "schedule" && (() => {
            const mon = weekStart(weekOffset);
            const days = Array.from({ length: 6 }, (_, i) => addDays(fmtD(mon), i)); // Mon~Sat
            const todayStr = fmtD(new Date());
            const byDay: Record<string, Ses[]> = {};
            weekSessions.forEach(s => { if (!byDay[s.scheduled_date]) byDay[s.scheduled_date] = []; byDay[s.scheduled_date].push(s); });
            return (
              <div>
                <div className="dnav">
                  <button className="nb" onClick={() => setWeekOffset(weekOffset - 1)}>‹ Prev</button>
                  <button className="nb" onClick={() => setWeekOffset(0)} style={weekOffset === 0 ? { background: "#1a6fc4", color: "#fff" } : {}}>This Week</button>
                  <button className="nb" onClick={() => setWeekOffset(weekOffset + 1)}>Next ›</button>
                  <span className="dlabel">{shortEN(days[0])} – {shortEN(days[5])}</span>
                </div>
                <div className="wgrid">
                  {days.map(d => {
                    const list = (byDay[d] || []).sort((a, b) => (a.scheduled_time_ph || "").localeCompare(b.scheduled_time_ph || ""));
                    const isToday = d === todayStr;
                    return (
                      <div key={d} className={`wcol ${isToday ? "today" : ""}`}>
                        <div className="whead">{new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })}<br /><span className="tnkr">{shortEN(d)}</span></div>
                        {list.length === 0 ? <div className="wempty">—</div> : list.map(s => {
                          const st = ST[s.status] || ST.scheduled;
                          return (
                            <div key={s.id} className="wchip" style={{ background: st.bg, color: st.color }} title={`${stuName(s)} · ${s.status}` + (s.session_note ? `\n📝 ${s.session_note}` : "")}>
                              <b>{s.scheduled_time_ph || "-"}</b> {stuName(s)}
                              {s.attitude === "issue" && " ⚠️"}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                <div className="tnkr" style={{ marginTop: 8 }}>Gray=Scheduled · Green=Attended · Red=Absent/Cancelled · Yellow=Makeup · Click Today tab to mark attendance</div>
              </div>
            );
          })()}
        </>
      )}

      {/* notifications popup */}
      {unread.length > 0 && !notifDismissed && (
        <div className="nov">
          <div className="nbox">
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>🔔 Schedule updates</div>
            {unread.map(n => <div key={n.id} className="nrow">{n.message}</div>)}
            <button className="ab at on" style={{ width: "100%", marginTop: 12 }} onClick={markNotifsRead}>OK, got it</button>
          </div>
        </div>
      )}

      {pickSes && (
        <div onClick={() => setPickSes(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={ev => ev.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: "min(340px,92vw)" }}>
            <div style={{ fontWeight: 800, marginBottom: 3 }}>#{pickSes.ses.session_number} · {pickSes.ses.scheduled_date}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>Mark this session</div>
            <div style={{ display: "grid", gap: 8 }}>
              <button onClick={() => markStuSession(pickSes.enrId, pickSes.ses, "attended")} style={{ padding: "11px 12px", borderRadius: 9, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>O Attended</button>
              <button onClick={() => markStuSession(pickSes.enrId, pickSes.ses, "no_show")} style={{ padding: "11px 12px", borderRadius: 9, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>✗ Absent</button>
              <button onClick={() => markStuSession(pickSes.enrId, pickSes.ses, "makeup")} style={{ padding: "11px 12px", borderRadius: 9, border: "1px solid #fcd34d", background: "#fffbeb", color: "#b45309", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>△ Makeup <span style={{ fontWeight: 600, color: "#94a3b8" }}>· no deduction, +1 at end</span></button>
              <button onClick={() => markStuSession(pickSes.enrId, pickSes.ses, "scheduled")} style={{ padding: "11px 12px", borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>↺ Back to scheduled</button>
            </div>
          </div>
        </div>
      )}
      {invoiceStudent && <StudentInvoiceCalendar enrollmentId={invoiceStudent} onClose={() => setInvoiceStudent(null)} />}
      <Css />
    </div>
  );
}

function Css() {
  return <style>{`
    body{background:#f4f6fa}
    .tcw{font-family:'Noto Sans KR',sans-serif;max-width:1500px;margin:0 auto;padding:22px 18px}
    .hd{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
    .hd-t{font-size:20px;font-weight:800}
    .hd-name{color:#1a6fc4;margin-left:6px}
    .hd-s{font-size:12.5px;color:#94a3b8;margin-top:2px}
    .hub{font-size:13px;font-weight:700;color:#475569;text-decoration:none;border:1px solid #e2e8f0;background:#fff;border-radius:9px;padding:8px 13px}
    .sel{padding:8px 10px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;font-family:inherit;background:#fff}
    .tabs{display:flex;gap:6px;margin-bottom:16px;overflow-x:auto}
    .tb{flex:0 0 auto;padding:10px 18px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;color:#475569}
    .tb.on{background:#1a6fc4;border-color:#1a6fc4;color:#fff}
    .cnt{font-size:11px;background:rgba(0,0,0,0.08);border-radius:99px;padding:1px 7px;margin-left:5px}
    .tb.on .cnt{background:rgba(255,255,255,0.25)}
    .chip{font-size:11px;font-weight:800;border-radius:7px;padding:2px 8px;white-space:nowrap}
    .dnav{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap}
    .nb{padding:8px 14px;border-radius:9px;border:1px solid #e2e8f0;background:#fff;font-size:13.5px;font-weight:700;cursor:pointer;font-family:inherit}
    .dlabel{font-size:15px;font-weight:800;cursor:pointer}
    .tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}
    .tcard{background:#fff;border:1px solid #e8ecf3;border-radius:14px;padding:16px}
    .tcard.done{opacity:.82}
    .trow1{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
    .ttime{font-size:20px;font-weight:800;color:#0f172a}
    .tkr{font-size:12px;font-weight:600;color:#94a3b8;margin-left:8px}
    .tname{font-size:16.5px;font-weight:800}
    .tnkr{font-size:12px;font-weight:600;color:#94a3b8}
    .tmeta{font-size:12px;color:#94a3b8;margin:2px 0 10px}
    .tbtns{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
    .ab{padding:9px 13px;border-radius:9px;border:1px solid #e2e8f0;background:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;color:#475569}
    .ab.at.on{background:#16a34a;border-color:#16a34a;color:#fff}
    .ab.ab2.on{background:#dc2626;border-color:#dc2626;color:#fff}
    .ab.am.on{background:#d97706;border-color:#d97706;color:#fff}
    .brow{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}
    .blbl{font-size:11px;font-weight:800;color:#94a3b8}
    .bb{padding:6px 11px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:#64748b}
    .bb.good.on{background:#dcfce7;border-color:#86efac;color:#166534}
    .bb.issue.on{background:#fef2f2;border-color:#fecaca;color:#dc2626}
    .bnote{font-size:11.5px;color:#dc2626}
    .nta{width:100%;box-sizing:border-box;border:1px solid #e2e8f0;border-radius:9px;padding:9px 11px;font-size:13px;font-family:inherit;resize:none;overflow:hidden}
    .sgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
    .scard{background:#fff;border:1px solid #e8ecf3;border-radius:14px;padding:16px}
    .srow1{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}
    .sname{font-size:16px;font-weight:800}
    .smeta{font-size:12.5px;color:#64748b;margin-bottom:3px}
    .pbar-wrap{margin:10px 0}
    .pbar-info{display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:4px}
    .pbar{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden}
    .snote{font-size:12.5px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:7px 10px;color:#78350f;margin-bottom:8px}
    .sbtns{display:flex;gap:6px}
    .hist{margin-top:10px;border-top:1px solid #eef2f7;padding-top:8px;display:flex;flex-direction:column;gap:5px}
    .hrow{display:flex;align-items:center;gap:8px;font-size:12.5px}
    .wgrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
    .wcol{background:#fff;border:1px solid #e8ecf3;border-radius:12px;padding:10px;min-height:120px}
    .wcol.today{border-color:#1a6fc4;box-shadow:0 0 0 2px rgba(26,111,196,0.12)}
    .whead{text-align:center;font-size:13px;font-weight:800;margin-bottom:8px}
    .wempty{text-align:center;color:#cbd5e1;font-size:12px;padding:12px 0}
    .wchip{font-size:11.5px;font-weight:700;border-radius:7px;padding:5px 8px;margin-bottom:5px;line-height:1.35}
    .empty{background:#fff;border:1px solid #e8ecf3;border-radius:14px;padding:44px;text-align:center;color:#94a3b8;font-size:14px}
    .nov{position:fixed;inset:0;background:rgba(15,23,42,0.45);z-index:999;display:flex;align-items:center;justify-content:center}
    .nbox{background:#fff;border-radius:16px;padding:22px;width:min(440px,90vw)}
    .nrow{font-size:13.5px;padding:9px 12px;background:#f0f7ff;border-radius:9px;margin-bottom:6px;line-height:1.5}
    @media(max-width:640px){
      .tcw{padding:14px 10px}
      .tgrid,.sgrid{grid-template-columns:1fr}
      .wgrid{grid-template-columns:repeat(3,minmax(0,1fr))}
      .ttime{font-size:18px}
    }
  `}</style>;
}

export default function TutorOnlineClassPage() {
  return <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Loading…</div>}><Inner /></Suspense>;
}
