"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { toastOk, toastErr } from "@/lib/toast";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { stripTimeSuffix } from "@/lib/scheduleBlocks";
import { cancelMap, resolutionLabelEN } from "@/lib/lessonCancellations";
import { sessionsForDate, typeForDate } from "@/lib/lessonDates";

interface Lesson {
  id: string;
  house_or_reserver: string;
  student_names: string;
  tutor_id: string | null;
  class_type: string;
  sessions_per_day: number | null;
  start_date: string;
  end_date: string;
  class_days: string[] | null;
  class_time: string | null;
  confirmed_time: string | null;
  total_sessions: number | null;
  skip_dates: string[] | null;
  tutor_memo: string | null;
  attendance_log: Record<string, "○" | "✕" | "△"> | null;
  notes_log: Record<string, string> | null;
  time_overrides?: Record<string, string> | null;
  session_overrides?: Record<string, number> | null;
  type_overrides?: Record<string, string> | null;
  tutor_overrides?: Record<string, string> | null;
  cancellations?: Record<string, string> | null;
}
interface Tutor { id: string; name: string }

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_KR_KEYS = ["일", "월", "화", "수", "목", "금", "토"];
const CODE_TO_IDX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6,
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function fmtMD(iso: string) { if (!iso) return ""; const dt = new Date(iso + "T00:00:00"); if (isNaN(dt.getTime())) return iso; return `${MONTHS[dt.getMonth()]} ${dt.getDate()}`; }

const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 20; h++) for (const m of [0, 30]) out.push(`${pad2(h)}:${pad2(m)}`);
  return out;
})();
function startOf(range: string): string {
  const s = String(range || "").split("~")[0].trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}
function addMin(t: string, mins: number): string {
  const m = t.match(/(\d{1,2}):(\d{2})/); if (!m) return t;
  const tot = Number(m[1]) * 60 + Number(m[2]) + mins;
  return `${pad2(Math.floor(tot / 60) % 24)}:${pad2(tot % 60)}`;
}
function rangeFor(start: string, sessions: number): string {
  if (!start) return "";
  return `${start} ~ ${addMin(start, sessions === 2 ? 100 : 50)}`;
}
function generateDates(lesson: Lesson): string[] {
  if (!lesson.start_date || !lesson.end_date) return [];
  const codes = (lesson.class_days || []).map(d => (d || "").toLowerCase().trim());
  if (codes.length === 0) return [];
  const wanted = new Set(codes.map(c => CODE_TO_IDX[c]).filter(i => i !== undefined));
  const out: string[] = [];
  const d = new Date(lesson.start_date + "T00:00:00");
  const end = new Date(lesson.end_date + "T00:00:00");
  while (d <= end) { if (wanted.has(d.getDay())) out.push(ymd(d)); d.setDate(d.getDate() + 1); }
  return out;
}

export default function AttendancePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const lessonId = params?.id || "";

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [draft, setDraft] = useState<Record<string, "○" | "✕" | "△" | "">>({});
  const [notesLog, setNotesLog] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [selDate, setSelDate] = useState<string>("");
  const [rescheduleVal, setRescheduleVal] = useState("");
  // lesson-wide settings
  const [draftDays, setDraftDays] = useState<string[]>([]);
  const [draftConfirmedTime, setDraftConfirmedTime] = useState("");
  const [savingTimes, setSavingTimes] = useState(false);
  const [savingDays, setSavingDays] = useState(false);

  const tutorMap = useMemo(() => { const m: Record<string, string> = {}; tutors.forEach(t => { m[t.id] = t.name; }); return m; }, [tutors]);

  const load = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true); setErrorMsg("");
    const { data, error } = await supabase.from("tutor_lessons").select("*").eq("id", lessonId).maybeSingle();
    if (error || !data) { setLoading(false); setErrorMsg(error?.message || "Lesson not found"); return; }
    const l = data as Lesson;
    setLesson(l);
    setDraft({ ...(l.attendance_log || {}) });
    setNotesLog(l.notes_log || {});
    setNotes(l.tutor_memo || "");
    setDraftDays(l.class_days || []);
    setDraftConfirmedTime(l.confirmed_time || l.class_time || "");
    const { data: ts } = await supabase.from("tutors").select("id, name").order("name");
    setTutors((ts || []) as Tutor[]);
    setLoading(false);
  }, [lessonId]);
  useEffect(() => { load(); }, [load]);

  const dates = useMemo(() => lesson ? generateDates(lesson) : [], [lesson]);
  const cMap = useMemo(() => cancelMap(lesson), [lesson]);
  const billedDates = useMemo(() => dates.filter(d => cMap[d] !== "deduct"), [dates, cMap]);

  const counts = useMemo(() => {
    const c = { O: 0, X: 0, T: 0 };
    for (const d of dates) { if (cMap[d]) continue; const v = draft[d]; if (v === "○") c.O++; else if (v === "✕") c.X++; else if (v === "△") c.T++; }
    return c;
  }, [dates, draft, cMap]);
  const total = billedDates.length + counts.T;
  const remaining = total - counts.O - counts.X - counts.T;

  // resolved per-date values
  function timeRangeOf(d: string): string {
    if (!lesson) return "";
    const kr = WEEKDAY_KR_KEYS[new Date(d + "T00:00:00").getDay()];
    return lesson.time_overrides?.[d] || lesson.time_overrides?.[kr] || stripTimeSuffix(lesson.confirmed_time || lesson.class_time) || "";
  }
  function tutorIdOf(d: string): string { return (lesson?.tutor_overrides?.[d]) || lesson?.tutor_id || ""; }
  function tutorNameOf(d: string): string { const id = tutorIdOf(d); return id ? (tutorMap[id] || "") : ""; }

  async function patchLesson(patch: Record<string, unknown>, optimistic: Partial<Lesson>) {
    if (!lesson) return;
    setLesson(l => l ? { ...l, ...optimistic } : l);
    const { error } = await supabase.from("tutor_lessons").update(patch).eq("id", lesson.id);
    if (error) { toastErr("Save failed: " + error.message); return; }
    toastOk("Updated");
  }
  async function setDateTimeSession(d: string, start: string, sessions: number) {
    if (!lesson || !start) return;
    const ov = { ...(lesson.time_overrides || {}) }; ov[d] = rangeFor(start, sessions);
    const so = { ...((lesson.session_overrides || {}) as Record<string, number>) }; so[d] = sessions;
    await patchLesson({ time_overrides: ov, session_overrides: so }, { time_overrides: ov, session_overrides: so });
  }
  async function setDateType(d: string, type: string) {
    if (!lesson) return;
    const to = { ...((lesson.type_overrides || {}) as Record<string, string>) }; to[d] = type;
    await patchLesson({ type_overrides: to }, { type_overrides: to });
  }
  async function setDateTutor(d: string, tutorId: string) {
    if (!lesson) return;
    const tu = { ...((lesson.tutor_overrides || {}) as Record<string, string>) };
    if (tutorId) tu[d] = tutorId; else delete tu[d];
    await patchLesson({ tutor_overrides: tu }, { tutor_overrides: tu });
  }
  async function cancelDate(d: string) {
    if (!lesson) return;
    const cur: string[] = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
    if (cur.includes(d)) return;
    await patchLesson({ skip_dates: [...cur, d] }, { skip_dates: [...cur, d] });
  }
  async function restoreDate(d: string) {
    if (!lesson) return;
    const cur: string[] = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
    const nextSkips = cur.filter(x => x !== d);
    const c = { ...((lesson.cancellations || {}) as Record<string, string>) }; delete c[d];
    await patchLesson({ skip_dates: nextSkips, cancellations: c }, { skip_dates: nextSkips, cancellations: c });
  }
  async function rescheduleMove(d: string, newDate: string) {
    if (!lesson || !newDate) return;
    const cur: string[] = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
    const nextSkips = cur.includes(d) ? cur : [...cur, d];
    const note = `Rescheduled: ${d} → ${newDate}`;
    const nextMemo = lesson.tutor_memo ? `${lesson.tutor_memo}\n${note}` : note;
    await patchLesson({ skip_dates: nextSkips, tutor_memo: nextMemo }, { skip_dates: nextSkips, tutor_memo: nextMemo });
    setRescheduleVal(""); setNotes(nextMemo); toastOk("Rescheduled");
  }
  function setAttendance(d: string, mk: "○" | "✕" | "△") {
    setDraft(p => ({ ...p, [d]: p[d] === mk ? "" : mk }));
  }

  async function save() {
    if (!lesson) return;
    setSaving(true);
    const log: Record<string, "○" | "✕" | "△"> = {};
    for (const [k, v] of Object.entries(draft)) if (v === "○" || v === "✕" || v === "△") log[k] = v;
    const { error } = await supabase.from("tutor_lessons")
      .update({ attendance_log: log, notes_log: notesLog, tutor_memo: notes || null, total_sessions: total }).eq("id", lesson.id);
    setSaving(false);
    if (error) { toastErr("Save failed: " + error.message); return; }
    toastOk("Saved");
    router.back();
  }
  async function saveClassDays() {
    if (!lesson) return;
    setSavingDays(true);
    const { error } = await supabase.from("tutor_lessons").update({ class_days: draftDays }).eq("id", lesson.id);
    setSavingDays(false);
    if (error) { toastErr("Save failed: " + error.message); return; }
    toastOk("Class days saved"); load();
  }
  async function saveUnifyTime() {
    if (!lesson) return;
    setSavingTimes(true);
    const ct = (draftConfirmedTime || "").trim();
    const confirmedOut = ct ? (ct.includes("~") ? ct : rangeFor(ct, Number(lesson.sessions_per_day) === 2 ? 2 : 1)) : null;
    const { error } = await supabase.from("tutor_lessons").update({ confirmed_time: confirmedOut, time_overrides: {} }).eq("id", lesson.id);
    setSavingTimes(false);
    if (error) { toastErr("Save failed: " + error.message); return; }
    toastOk("Class time unified"); load();
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14, fontFamily: "'Noto Sans KR',sans-serif" }}>Loading...</div>;
  if (errorMsg || !lesson) return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "'Noto Sans KR',sans-serif" }}>
      <div style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>{errorMsg || "No lesson"}</div>
      <button onClick={() => router.back()} style={{ padding: "8px 16px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>← Back</button>
    </div>
  );

  const daysLabel = (lesson.class_days || []).map(d => WEEKDAYS[CODE_TO_IDX[(d || "").toLowerCase().trim()]] || d).join(", ");
  const selIdx = selDate ? dates.indexOf(selDate) : -1;
  const selCancel = selDate ? cMap[selDate] : undefined;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f9fafb;color:#111827}
.aw{max-width:1040px;margin:0 auto;padding:24px 20px 60px}
.card{background:#fff;border-radius:12px;border:1px solid #f0f1f3;box-shadow:0 1px 4px rgba(0,0,0,0.05);padding:16px 18px;margin-bottom:14px}
.btn{height:38px;padding:0 18px;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px;border:1px solid #e5e7eb;background:#fff;color:#475569}
.btn.pri{background:#1a6fc4;border:none;color:#fff}.btn:disabled{opacity:0.6;cursor:not-allowed}
.chip{padding:6px 12px;background:#f3f4f6;border-radius:8px;font-size:12px;color:#6b7280}.chip b{font-size:14px;color:#111827;margin-left:4px}
.gbox{border-radius:12px;padding:10px 8px;text-align:center;cursor:pointer;border:1.5px solid #e5e7eb;background:#fff;transition:all 120ms;min-height:96px;display:flex;flex-direction:column;justify-content:center;gap:2px}
.gbox:hover{border-color:#1a6fc4}
.gbox .gi{font-size:11px;color:#6b7280}
.gbox .gt{font-size:12.5px;font-weight:700;color:#111827}
.gbox .gtut{font-size:10px;color:#6b7280;font-weight:600}
.gbox .gmk{font-size:24px;font-weight:800;line-height:1.1;min-height:26px}
.gbox.sel{border:2px solid #1a6fc4;background:#eff6ff}
.gbox.can{border-style:dashed;background:#f8fafc;opacity:0.8}
.sel-ipt{padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff;width:100%}
.fld{font-size:12px;color:#6b7280;margin-bottom:4px;font-weight:600}
    `}</style>
    <div className="aw">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button className="btn" onClick={() => router.back()}>← Back</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800 }}>📋 Attendance · {lesson.house_or_reserver} · {lesson.student_names}</h1>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
            {lesson.class_type} · Days: {daysLabel || "-"} · Period: {fmtMD(lesson.start_date)}~{fmtMD(lesson.end_date)}{lesson.tutor_id && tutorMap[lesson.tutor_id] ? ` · Tutor: ${tutorMap[lesson.tutor_id]}` : ""}
          </div>
        </div>
        <button className="btn pri" onClick={save} disabled={saving}>{saving ? "Saving..." : "💾 Save"}</button>
      </div>

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span className="chip">Total<b>{total}</b></span>
        <span className="chip">Attended<b style={{ color: "#15803d" }}>{counts.O}</b></span>
        <span className="chip">Absent<b style={{ color: "#dc2626" }}>{counts.X}</b></span>
        <span className="chip">Makeup<b style={{ color: "#b45309" }}>{counts.T}</b></span>
        <span className="chip">Remaining<b style={{ color: "#1a6fc4" }}>{remaining}</b></span>
      </div>

      <div className="card">
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>Tap a date box to edit that day&apos;s attendance, time, type, tutor, or reschedule.</div>
        {dates.length === 0 ? (
          <div style={{ textAlign: "center", padding: 36, color: "#9ca3af", fontSize: 13 }}>No class dates (check period & days)</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px,1fr))", gap: 10 }}>
            {dates.map((d, i) => {
              const dt = new Date(d + "T00:00:00");
              const dw = WEEKDAYS[dt.getDay()];
              const canc = cMap[d];
              const v = draft[d] || "";
              const sessions = sessionsForDate(lesson, d);
              const tname = tutorNameOf(d);
              const mkColor = v === "○" ? "#15803d" : v === "✕" ? "#dc2626" : v === "△" ? "#b45309" : "#cbd5e1";
              return (
                <button key={d} type="button" onClick={() => { setSelDate(d); setRescheduleVal(""); }}
                  className={`gbox${selDate === d ? " sel" : ""}${canc ? " can" : ""}`}>
                  <div className="gi" style={canc ? { textDecoration: "line-through" } : undefined}>#{i + 1} · {MONTHS[dt.getMonth()]} {dt.getDate()} ({dw})</div>
                  {canc ? (<>
                    <div style={{ fontSize: 18 }}>🚫</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#dc2626" }}>Cancelled</div>
                  </>) : (<>
                    <div className="gt">{startOf(timeRangeOf(d)) || "--:--"} · {sessions === 2 ? "2T" : "1T"}</div>
                    {tname && <div className="gtut">{tname}{typeForDate(lesson, d) !== lesson.class_type ? ` · ${typeForDate(lesson, d)}` : ""}</div>}
                    <div className="gmk" style={{ color: mkColor }}>{v || "·"}</div>
                  </>)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selDate && (
        <div className="card" style={{ border: "2px solid #1a6fc4" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>✏️ Edit · #{selIdx + 1} · {(() => { const dt = new Date(selDate + "T00:00:00"); return `${MONTHS[dt.getMonth()]} ${dt.getDate()} (${WEEKDAYS[dt.getDay()]})`; })()}</div>
            <button className="btn" style={{ height: 30 }} onClick={() => setSelDate("")}>Close</button>
          </div>

          {selCancel ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>🚫 Cancelled ({resolutionLabelEN(selCancel)})</span>
              <button className="btn" onClick={() => { restoreDate(selDate); }}>↩ Restore</button>
            </div>
          ) : (() => {
            const start = startOf(timeRangeOf(selDate));
            const sessions = sessionsForDate(lesson, selDate);
            const type = typeForDate(lesson, selDate);
            const tid = tutorIdOf(selDate);
            const v = draft[selDate] || "";
            return (<>
              <div className="fld">Attendance</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {(["○", "✕", "△"] as const).map(mk => (
                  <button key={mk} type="button" onClick={() => setAttendance(selDate, mk)}
                    style={{ width: 38, height: 38, borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 17, fontWeight: 800,
                      border: v === mk ? "none" : "1px solid #e5e7eb",
                      background: v === mk ? (mk === "○" ? "#dcfce7" : mk === "✕" ? "#fee2e2" : "#fef3c7") : "#fff",
                      color: v === mk ? (mk === "○" ? "#15803d" : mk === "✕" ? "#dc2626" : "#b45309") : "#cbd5e1" }}>{mk}</button>
                ))}
                <span style={{ fontSize: 11, color: "#94a3b8", alignSelf: "center", marginLeft: 6 }}>○ attended · ✕ absent · △ makeup</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="fld">Time · Session</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select className="sel-ipt" value={start} onChange={e => setDateTimeSession(selDate, e.target.value, sessions)}>
                      {start === "" && <option value="">Start</option>}
                      {start !== "" && !TIME_SLOTS.includes(start) && <option value={start}>{start}</option>}
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select className="sel-ipt" style={{ width: 70 }} value={String(sessions)} onChange={e => setDateTimeSession(selDate, start || "16:30", Number(e.target.value))}>
                      <option value="1">1T</option><option value="2">2T</option>
                    </select>
                  </div>
                  {start && <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>{rangeFor(start, sessions)}</div>}
                </div>
                <div>
                  <div className="fld">Class type</div>
                  <select className="sel-ipt" value={type} onChange={e => setDateType(selDate, e.target.value)}>
                    <option value="1:1">1:1</option><option value="1:2">1:2</option>
                  </select>
                </div>
                <div>
                  <div className="fld">Tutor (this day)</div>
                  <select className="sel-ipt" value={tid} onChange={e => setDateTutor(selDate, e.target.value)}>
                    <option value="">(lesson tutor{lesson.tutor_id && tutorMap[lesson.tutor_id] ? `: ${tutorMap[lesson.tutor_id]}` : ""})</option>
                    {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="fld">Reschedule to</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="date" className="sel-ipt" value={rescheduleVal} onChange={e => setRescheduleVal(e.target.value)} />
                    <button className="btn" style={{ height: 38 }} disabled={!rescheduleVal} onClick={() => rescheduleMove(selDate, rescheduleVal)}>Move</button>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                <button className="btn" style={{ color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => { cancelDate(selDate); }}>🚫 Cancel this day</button>
              </div>
            </>);
          })()}
        </div>
      )}

      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>📝 Memos <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>(separate — not changed by the edit panel)</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {dates.filter(d => !cMap[d]).map((d, i) => {
            const dt = new Date(d + "T00:00:00");
            return (
              <div key={d} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11.5, color: "#6b7280", minWidth: 92, fontWeight: 600 }}>#{dates.indexOf(d) + 1} {MONTHS[dt.getMonth()]} {dt.getDate()} ({WEEKDAYS[dt.getDay()]})</span>
                <input className="sel-ipt" style={{ fontSize: 12, flex: 1 }} value={notesLog[d] || ""} onChange={e => setNotesLog(p => ({ ...p, [d]: e.target.value }))} placeholder="Memo for this day..." />
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>⚙️ Lesson Settings</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, alignItems: "flex-start" }}>
          <div>
            <div className="fld" style={{ color: "#7c3aed" }}>📅 Class Days</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(day => {
                const lbl: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
                const kr: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
                const on = draftDays.some(x => x === day || x === kr[day]);
                return (
                  <label key={day} style={{ padding: "4px 10px", borderRadius: 6, border: `1.5px solid ${on ? "#7c3aed" : "#e5e7eb"}`, background: on ? "#f5f3ff" : "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, color: on ? "#7c3aed" : "#6b7280" }}>
                    <input type="checkbox" checked={on} onChange={e => setDraftDays(prev => e.target.checked ? [...prev.filter(x => x !== day && x !== kr[day]), day] : prev.filter(x => x !== day && x !== kr[day]))} style={{ display: "none" }} />
                    {lbl[day]}
                  </label>
                );
              })}
            </div>
            <button className="btn" style={{ height: 30, marginTop: 8, background: "#7c3aed", color: "#fff", border: "none" }} onClick={saveClassDays} disabled={savingDays}>{savingDays ? "Saving..." : "Save Days"}</button>
          </div>
          <div>
            <div className="fld" style={{ color: "#1a6fc4" }}>⏰ Default Class Time</div>
            <input type="time" className="sel-ipt" value={draftConfirmedTime.includes("~") ? startOf(draftConfirmedTime) : draftConfirmedTime} onChange={e => setDraftConfirmedTime(e.target.value)} />
            <button className="btn" style={{ height: 30, marginTop: 8, background: "#1a6fc4", color: "#fff", border: "none" }} onClick={saveUnifyTime} disabled={savingTimes}>{savingTimes ? "Saving..." : "Save & Unify Time"}</button>
            <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4 }}>Resets per-date time changes to this time.</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button className="btn" onClick={() => router.back()} disabled={saving}>Back</button>
        <button className="btn pri" onClick={save} disabled={saving}>{saving ? "Saving..." : "💾 Save"}</button>
      </div>
    </div>
  </>);
}
