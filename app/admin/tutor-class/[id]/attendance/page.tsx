"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
}

const WEEKDAYS_KR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_KR: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
const DAY_EN_LABEL: Record<string, string> = {
  sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat",
  "일": "Sun", "월": "Mon", "화": "Tue", "수": "Wed", "목": "Thu", "금": "Fri", "토": "Sat",
};
const CODE_TO_IDX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6,
};

function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function fmtMD(iso: string) {
  if (!iso) return "";
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt.getTime())) return iso;
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
}

const WEEKDAY_KR_KEYS = ['일','월','화','수','목','금','토'];

function resolveTime(dateStr: string, lesson: Lesson): string {
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  const krKey = WEEKDAY_KR_KEYS[dow];
  return lesson.time_overrides?.[dateStr]
    || lesson.time_overrides?.[krKey]
    || lesson.confirmed_time || lesson.class_time || '-';
}

function normalizeDayKR(d: string): string {
  const lower = (d || "").toLowerCase().trim();
  return DAY_KR[lower] || d;
}

function generateDates(lesson: Lesson): string[] {
  if (!lesson.start_date || !lesson.end_date) return [];
  const codes = (lesson.class_days || []).map(d => (d || "").toLowerCase().trim());
  if (codes.length === 0) return [];
  const wanted = new Set(codes.map(c => CODE_TO_IDX[c]).filter(i => i !== undefined));
  const skips = new Set(Array.isArray(lesson.skip_dates) ? lesson.skip_dates : []);
  const out: string[] = [];
  const d = new Date(lesson.start_date + "T00:00:00");
  const end = new Date(lesson.end_date + "T00:00:00");
  while (d <= end) {
    if (wanted.has(d.getDay())) {
      const ds = ymd(d);
      if (!skips.has(ds)) out.push(ds);
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function AttendancePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const lessonId = params?.id || "";

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [tutorName, setTutorName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, "○" | "✕" | "△" | "">>({});
  const [notes, setNotes] = useState("");
  const [notesLog, setNotesLog] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [cancelDateVal, setCancelDateVal] = useState("");
  const [changeOldVal, setChangeOldVal] = useState("");
  const [changeNewVal, setChangeNewVal] = useState("");
  const [savingManage, setSavingManage] = useState(false);
  const [draftDays, setDraftDays] = useState<string[]>([]);
  const [draftConfirmedTime, setDraftConfirmedTime] = useState<string>("");
  const [draftDayOverrides, setDraftDayOverrides] = useState<Record<string, string>>({});
  const [draftDateOverrides, setDraftDateOverrides] = useState<Record<string, string>>({});
  const [newOverrideDate, setNewOverrideDate] = useState("");
  const [newOverrideTime, setNewOverrideTime] = useState("");
  const [savingTimes, setSavingTimes] = useState(false);
  useEffect(() => {
    if (lesson) setDraftDays(lesson.class_days || []);
  }, [lesson]);
  useEffect(() => {
    if (!lesson) return;
    setDraftConfirmedTime(lesson.confirmed_time || lesson.class_time || "");
    const ov = lesson.time_overrides || {};
    const days: Record<string, string> = {};
    const dates: Record<string, string> = {};
    for (const [k, v] of Object.entries(ov)) {
      if (WEEKDAY_KR_KEYS.includes(k)) days[k] = String(v);
      else dates[k] = String(v);
    }
    setDraftDayOverrides(days);
    setDraftDateOverrides(dates);
  }, [lesson]);

  const load = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    setErrorMsg("");
    const { data, error } = await supabase
      .from("tutor_lessons")
      .select("*")
      .eq("id", lessonId)
      .maybeSingle();
    if (error || !data) {
      setLoading(false);
      setErrorMsg(error?.message || "Lesson not found");
      return;
    }
    const l = data as Lesson;
    setLesson(l);
    setNotes(l.tutor_memo || "");
    setNotesLog(l.notes_log || {});
    setDraft({ ...(l.attendance_log || {}) });
    if (l.tutor_id) {
      const { data: t } = await supabase.from("tutors").select("name").eq("id", l.tutor_id).maybeSingle();
      if (t) setTutorName((t as { name: string }).name || "");
    }
    setLoading(false);
  }, [lessonId]);

  useEffect(() => { load(); }, [load]);

  const dates = useMemo(() => lesson ? generateDates(lesson) : [], [lesson]);

  const counts = useMemo(() => {
    const c = { O: 0, X: 0, T: 0 };
    for (const d of dates) {
      const v = draft[d];
      if (v === "○") c.O++;
      else if (v === "✕") c.X++;
      else if (v === "△") c.T++;
    }
    return c;
  }, [dates, draft]);

  const baseTotal = dates.length;
  const total = baseTotal + counts.T;
  const remaining = total - counts.O - counts.X - counts.T;

  function cycle(date: string) {
    setDraft(prev => {
      const cur = prev[date] || "";
      const next: "○" | "✕" | "△" | "" =
        cur === "" ? "○" :
        cur === "○" ? "✕" :
        cur === "✕" ? "△" :
        "";
      return { ...prev, [date]: next };
    });
  }

  async function save() {
    if (!lesson) return;
    setSaving(true);
    const log: Record<string, "○" | "✕" | "△"> = {};
    for (const [k, v] of Object.entries(draft)) {
      if (v === "○" || v === "✕" || v === "△") log[k] = v;
    }
    const { error } = await supabase
      .from("tutor_lessons")
      .update({ attendance_log: log, tutor_memo: notes || null, total_sessions: total, notes_log: notesLog })
      .eq("id", lesson.id);
    setSaving(false);
    if (error) { alert("Save failed: " + error.message); return; }
    alert("✅ Saved");
    router.back();
  }

  async function cancelOneDate() {
    if (!lesson) return;
    const d = cancelDateVal.trim();
    if (!d) { alert("Please select a date to cancel."); return; }
    const current: string[] = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
    if (current.includes(d)) { alert("This date is already cancelled."); return; }
    setSavingManage(true);
    const { error } = await supabase.from("tutor_lessons")
      .update({ skip_dates: [...current, d] })
      .eq("id", lesson.id);
    setSavingManage(false);
    if (error) { alert("Cancel failed: " + error.message); return; }
    setCancelDateVal("");
    alert(`✅ ${d} class cancelled.`);
    load();
  }

  async function rescheduleDate() {
    if (!lesson) return;
    const oldD = changeOldVal.trim();
    const newD = changeNewVal.trim();
    if (!oldD || !newD) { alert("Please select both the original date and the new date."); return; }
    if (oldD === newD) { alert("Original date and new date are the same."); return; }
    const current: string[] = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
    const nextSkips = current.includes(oldD) ? current : [...current, oldD];
    const note = `Rescheduled: ${oldD} → ${newD}`;
    const nextNotes = notes ? `${notes}\n${note}` : note;
    setSavingManage(true);
    const { error } = await supabase.from("tutor_lessons")
      .update({ skip_dates: nextSkips, tutor_memo: nextNotes })
      .eq("id", lesson.id);
    setSavingManage(false);
    if (error) { alert("Reschedule failed: " + error.message); return; }
    setChangeOldVal("");
    setChangeNewVal("");
    setNotes(nextNotes);
    alert(`✅ Rescheduled: ${oldD} → ${newD}`);
    load();
  }

  async function saveClassDays() {
    if (!lesson) return;
    setSavingManage(true);
    const { error } = await supabase.from("tutor_lessons")
      .update({ class_days: draftDays }).eq("id", lesson.id);
    setSavingManage(false);
    if (error) { alert("Save failed: " + error.message); return; }
    alert("✅ Class days saved.");
    load();
  }

  async function saveTimeOverrides() {
    if (!lesson) return;
    setSavingTimes(true);
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries(draftDayOverrides)) {
      const t = String(v || "").trim();
      if (t) merged[k] = t;
    }
    for (const [k, v] of Object.entries(draftDateOverrides)) {
      const t = String(v || "").trim();
      if (t) merged[k] = t;
    }
    const { error } = await supabase.from("tutor_lessons")
      .update({ confirmed_time: draftConfirmedTime || null, time_overrides: merged })
      .eq("id", lesson.id);
    setSavingTimes(false);
    if (error) { alert("Time save failed: " + error.message); return; }
    alert("✅ Class times saved.");
    load();
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14 }}>Loading...</div>;
  }
  if (errorMsg || !lesson) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>{errorMsg || "No lesson"}</div>
        <button onClick={() => router.back()} style={{ padding: "8px 16px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>← Back</button>
      </div>
    );
  }

  const daysLabel = (lesson.class_days || []).map(d => DAY_EN_LABEL[d] || DAY_EN_LABEL[d.toLowerCase()] || d).join(", ");
  const timeLabel = lesson.confirmed_time || lesson.class_time || "-";

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f9fafb;color:#111827}
.at-w{max-width:1100px;margin:0 auto;padding:24px 20px}
.at-top{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.at-back{padding:8px 12px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-weight:600;color:#475569;cursor:pointer;font-family:inherit}
.at-back:hover{background:#f1f5f9;color:#1a6fc4;border-color:#cbd5e1}
.at-title{flex:1;min-width:0}
.at-title h1{font-size:19px;font-weight:800;color:#111827;line-height:1.4;word-break:keep-all}
.at-title .sub{font-size:12.5px;color:#6b7280;font-weight:500;margin-top:4px;display:flex;flex-wrap:wrap;gap:8px}
.at-title .sub span{display:inline-block}
.at-title .sub .tag{padding:2px 8px;background:#eff6ff;color:#1a6fc4;border-radius:5px;font-weight:700;font-size:11.5px}

.at-card{background:#fff;border-radius:12px;border:1px solid #f3f4f6;box-shadow:0 1px 4px rgba(0,0,0,0.05);padding:18px 20px;margin-bottom:16px}

.at-sum{display:flex;flex-wrap:wrap;gap:10px}
.at-sum .s{padding:10px 14px;background:#f9fafb;border-radius:9px;font-size:12.5px;color:#475569;font-weight:600;display:flex;align-items:baseline;gap:6px;border:1px solid #f3f4f6}
.at-sum .s .lbl{font-size:11px;color:#9ca3af}
.at-sum .s b{font-size:15px;color:#111827;font-weight:800}
.at-sum .s.attend b{color:#15803d}
.at-sum .s.miss b{color:#dc2626}
.at-sum .s.makeup b{color:#c2410c}
.at-sum .s.remain b{color:#1a6fc4}

.at-help{font-size:12px;color:#6b7280;line-height:1.7;background:#f9fafb;border-radius:8px;padding:10px 14px;margin-bottom:14px;border:1px dashed #e5e7eb}
.at-help b{color:#374151}

.at-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px}
.at-box{padding:12px 6px 10px;border-radius:12px;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:3px;border:2px solid;transition:all 120ms;user-select:none;min-height:96px;justify-content:space-between}
.at-box .idx{font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:0.02em}
.at-box .dt{font-size:13px;font-weight:800;color:inherit}
.at-box .dw{font-size:10.5px;font-weight:600;color:inherit;opacity:0.65;margin-left:2px}
.at-box .mark{font-size:36px;font-weight:900;line-height:1;min-height:38px;display:flex;align-items:center;justify-content:center;width:100%}
.at-box.s-blank{background:#f9fafb;color:#64748b;border-color:#e2e8f0}
.at-box.s-blank:hover{border-color:#94a3b8;background:#f1f5f9}
.at-box.s-blank .idx{color:#94a3b8}
.at-box.s-o{background:#dcfce7;color:#15803d;border-color:#86efac}
.at-box.s-o .idx{color:#16a34a;opacity:0.8}
.at-box.s-x{background:#fee2e2;color:#b91c1c;border-color:#fca5a5}
.at-box.s-x .idx{color:#dc2626;opacity:0.8}
.at-box.s-t{background:#fef3c7;color:#92400e;border-color:#fcd34d}
.at-box.s-t .idx{color:#b45309;opacity:0.8}

.at-notes-card label{display:block;font-size:13px;font-weight:700;color:#374151;margin-bottom:8px}
.at-notes-card label .en{font-weight:500;color:#6b7280;font-size:12px;margin-left:6px}
.at-notes-card textarea{width:100%;min-height:96px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:inherit;outline:none;resize:vertical}
.at-notes-card textarea:focus{border-color:#1a6fc4}

.at-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}
.at-btn{height:40px;padding:0 22px;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:6px}
.at-btn.secondary{background:#fff;border:1px solid #e5e7eb;color:#475569}
.at-btn.secondary:hover{background:#f9fafb;border-color:#cbd5e1;color:#111827}
.at-btn.primary{background:#1a6fc4;border:none;color:#fff}
.at-btn.primary:hover:not(:disabled){background:#155aa0}
.at-btn:disabled{opacity:0.6;cursor:not-allowed}

@media(max-width:600px){
  .at-w{padding:16px 12px}
  .at-sum .s{flex:1 1 calc(50% - 5px);min-width:0}
  .at-grid{grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px}
}
    `}</style>

    <div className="at-w">
      <div className="at-top">
        <button className="at-back" onClick={() => router.back()}>← Back</button>
        <div className="at-title">
          <h1>📋 Attendance · {lesson.house_or_reserver} · {(() => {
            const p = (lesson.student_names || "").split("/").map(s => s.trim()).filter(Boolean);
            return p.length >= 2 ? [...p].reverse().join(" / ") : lesson.student_names;
          })()}</h1>
          <div className="sub">
            <span className="tag">{lesson.class_type}</span>
            <span><b style={{ color: "#374151" }}>Days:</b> {daysLabel || "-"}</span>
            <span><b style={{ color: "#374151" }}>Time:</b> {timeLabel}</span>
            <span><b style={{ color: "#374151" }}>Period:</b> {fmtMD(lesson.start_date)}~{fmtMD(lesson.end_date)}</span>
            {tutorName && <span><b style={{ color: "#374151" }}>Tutor:</b> {tutorName}</span>}
          </div>
        </div>
      </div>

      <div className="at-card">
        <div className="at-sum">
          <div className="s"><span className="lbl">Total</span><b>{total}</b></div>
          <div className="s attend"><span className="lbl">Attended</span><b>{counts.O}</b></div>
          <div className="s miss"><span className="lbl">Absent</span><b>{counts.X}</b></div>
          <div className="s makeup"><span className="lbl">Makeup</span><b>{counts.T}</b></div>
          <div className="s remain"><span className="lbl">Remaining</span><b>{remaining}</b></div>
        </div>
      </div>

      <div className="at-card">
        <div className="at-help">
          Click each box to cycle: <b>blank → ○ attended → ✕ absent → △ makeup → blank</b>. △ (Makeup) extends total session count by +1.
        </div>
        {dates.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>
            No class dates available (check start/end date and days)
          </div>
        ) : (
          <div className="at-grid">
            {dates.map((d, i) => {
              const dt = new Date(d + "T00:00:00");
              const md = `${dt.getMonth() + 1}/${dt.getDate()}`;
              const dw = WEEKDAYS_KR[dt.getDay()];
              const v = draft[d] || "";
              const tm = resolveTime(d, lesson);
              const cls =
                v === "○" ? "s-o" :
                v === "✕" ? "s-x" :
                v === "△" ? "s-t" : "s-blank";
              return (
                <button
                  key={d}
                  type="button"
                  className={`at-box ${cls}`}
                  onClick={() => cycle(d)}
                  title={`${d} (${dw}) ${tm} — ${v || "blank"}`}
                >
                  <span className="idx">#{i + 1}</span>
                  <span className="dt">{md}<span className="dw">({dw})</span></span>
                  <span style={{fontSize:10.5,fontWeight:700,opacity:0.75,letterSpacing:"0.02em"}}>{tm}</span>
                  <span className="mark">{v || ""}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {dates.length > 0 && (
        <div className="at-card">
          <div style={{fontSize:13,fontWeight:800,color:"#374151",marginBottom:12}}>
            📝 Date Notes
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {dates.map((d, i) => {
              const dt = new Date(d + "T00:00:00");
              const md = `${dt.getMonth() + 1}/${dt.getDate()}`;
              const dw = WEEKDAYS_KR[dt.getDay()];
              const mark = draft[d] || "";
              const markColor = mark === "○" ? "#15803d" : mark === "✕" ? "#b91c1c" : mark === "△" ? "#92400e" : "#94a3b8";
              const note = notesLog[d] || "";
              if (!mark && !note) return null;
              return (
                <div key={d} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid #f3f4f6"}}>
                  <span style={{fontSize:11,fontWeight:700,color:"#6b7280",minWidth:28}}>#{i+1}</span>
                  <span style={{fontSize:12,fontWeight:800,color:"#374151",minWidth:60}}>{md} ({dw})</span>
                  <span style={{fontSize:16,fontWeight:900,color:markColor,minWidth:20,textAlign:"center"}}>{mark || ""}</span>
                  <input
                    type="text"
                    value={note}
                    onChange={e => setNotesLog(prev => ({ ...prev, [d]: e.target.value }))}
                    placeholder="Add note..."
                    style={{flex:1,padding:"5px 8px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}
                  />
                </div>
              );
            })}
            {dates.every(d => !draft[d] && !notesLog[d]) && (
              <div style={{fontSize:12,color:"#9ca3af",textAlign:"center",padding:"12px 0"}}>
                Click a date box then type a note above.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="at-card">
        <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>

          {/* Class Days */}
          <div style={{flex:"1 1 200px",display:"flex",flexDirection:"column",gap:6}}>
            <div style={{fontSize:12,fontWeight:800,color:"#7c3aed",marginBottom:2}}>📅 Class Days</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {["mon","tue","wed","thu","fri","sat","sun"].map(day => {
                const labelMap: Record<string,string> = {mon:"Mon",tue:"Tue",wed:"Wed",thu:"Thu",fri:"Fri",sat:"Sat",sun:"Sun"};
                const krMap: Record<string,string> = {mon:"월",tue:"화",wed:"수",thu:"목",fri:"금",sat:"토",sun:"일"};
                const checked = draftDays.some(d => d === day || d === krMap[day]);
                return (
                  <label key={day} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,border:`1.5px solid ${checked?"#7c3aed":"#e5e7eb"}`,background:checked?"#f5f3ff":"#fff",cursor:"pointer",fontSize:12,fontWeight:700,color:checked?"#7c3aed":"#6b7280"}}>
                    <input type="checkbox" checked={checked}
                      onChange={e => setDraftDays(prev =>
                        e.target.checked ? [...prev.filter(d => d!==day && d!==krMap[day]), day]
                        : prev.filter(d => d!==day && d!==krMap[day])
                      )}
                      style={{display:"none"}}
                    />
                    {labelMap[day]}
                  </label>
                );
              })}
            </div>
            <button onClick={saveClassDays} disabled={savingManage}
              style={{height:30,padding:"0 14px",border:"none",borderRadius:6,background:"#7c3aed",color:"#fff",fontWeight:700,fontSize:12,cursor:savingManage?"not-allowed":"pointer",fontFamily:"inherit",opacity:savingManage?0.6:1,alignSelf:"flex-start",marginTop:2}}
            >{savingManage?"Saving...":"Save Days"}</button>
          </div>

          {/* Cancel Day */}
          <div style={{flex:"1 1 200px",display:"flex",flexDirection:"column",gap:6}}>
            <div style={{fontSize:12,fontWeight:800,color:"#dc2626",marginBottom:2}}>❌ Cancel Day</div>
            <input
              type="date"
              lang="en"
              placeholder="YYYY-MM-DD"
              value={cancelDateVal}
              min={lesson.start_date || undefined}
              max={lesson.end_date || undefined}
              onChange={e => setCancelDateVal(e.target.value)}
              style={{padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",outline:"none"}}
            />
            {(lesson.skip_dates || []).length > 0 && (
              <div style={{fontSize:11,color:"#475569"}}>
                <span style={{fontWeight:700}}>Cancelled ({(lesson.skip_dates||[]).length}): </span>
                {(lesson.skip_dates||[]).map((d:string) => (
                  <span key={d} style={{display:"inline-block",padding:"1px 6px",borderRadius:4,background:"#fef2f2",color:"#b91c1c",fontSize:10.5,fontWeight:700,marginRight:3}}>{d}</span>
                ))}
              </div>
            )}
            <button
              onClick={cancelOneDate}
              disabled={savingManage || !cancelDateVal}
              style={{height:32,padding:"0 14px",border:"none",borderRadius:6,background:"#dc2626",color:"#fff",fontWeight:700,fontSize:13,cursor:(savingManage||!cancelDateVal)?"not-allowed":"pointer",fontFamily:"inherit",opacity:(savingManage||!cancelDateVal)?0.6:1,alignSelf:"flex-start"}}
            >{savingManage ? "Saving..." : "Cancel Day"}</button>
          </div>

          {/* Reschedule */}
          <div style={{flex:"1 1 240px",display:"flex",flexDirection:"column",gap:6}}>
            <div style={{fontSize:12,fontWeight:800,color:"#92400e",marginBottom:2}}>🔄 Reschedule</div>
            <label style={{fontSize:11,fontWeight:600,color:"#6b7280"}}>From</label>
            <input
              type="date"
              lang="en"
              placeholder="YYYY-MM-DD"
              value={changeOldVal}
              min={lesson.start_date || undefined}
              max={lesson.end_date || undefined}
              onChange={e => setChangeOldVal(e.target.value)}
              style={{padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",outline:"none"}}
            />
            <label style={{fontSize:11,fontWeight:600,color:"#6b7280"}}>To</label>
            <input
              type="date"
              lang="en"
              placeholder="YYYY-MM-DD"
              value={changeNewVal}
              onChange={e => setChangeNewVal(e.target.value)}
              style={{padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",outline:"none"}}
            />
            <button
              onClick={rescheduleDate}
              disabled={savingManage || !changeOldVal || !changeNewVal}
              style={{height:32,padding:"0 14px",border:"none",borderRadius:6,background:"#f59e0b",color:"#fff",fontWeight:700,fontSize:13,cursor:(savingManage||!changeOldVal||!changeNewVal)?"not-allowed":"pointer",fontFamily:"inherit",opacity:(savingManage||!changeOldVal||!changeNewVal)?0.6:1,alignSelf:"flex-start"}}
            >{savingManage ? "Saving..." : "Reschedule"}</button>
          </div>

        </div>
      </div>

      <div className="at-card">
        <div style={{fontSize:13,fontWeight:800,color:"#374151",marginBottom:12}}>⏰ Class Time Overrides</div>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>

          {/* 전체 시간 */}
          <div style={{flex:"1 1 180px",display:"flex",flexDirection:"column",gap:6}}>
            <div style={{fontSize:12,fontWeight:800,color:"#1a6fc4",marginBottom:2}}>⏰ 전체 시간</div>
            <input
              type="time"
              lang="en"
              value={draftConfirmedTime}
              onChange={e => setDraftConfirmedTime(e.target.value)}
              style={{padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",outline:"none"}}
            />
            <div style={{fontSize:11,color:"#6b7280"}}>모든 날의 기본 수업 시간</div>
          </div>

          {/* 요일별 시간 */}
          <div style={{flex:"1 1 260px",display:"flex",flexDirection:"column",gap:6}}>
            <div style={{fontSize:12,fontWeight:800,color:"#7c3aed",marginBottom:2}}>📅 요일별 시간</div>
            {(lesson.class_days || []).length === 0 && (
              <div style={{fontSize:11,color:"#9ca3af"}}>설정된 요일이 없습니다.</div>
            )}
            {(lesson.class_days || []).map((rawDay, i) => {
              const kr = normalizeDayKR(rawDay);
              const val = draftDayOverrides[kr] || "";
              return (
                <div key={`${rawDay}-${i}`} style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#7c3aed",minWidth:24}}>{kr}</span>
                  <input
                    type="time"
                    lang="en"
                    value={val}
                    onChange={e => setDraftDayOverrides(prev => ({ ...prev, [kr]: e.target.value }))}
                    style={{flex:1,padding:"6px 8px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}
                  />
                  {val && (
                    <button type="button"
                      onClick={() => setDraftDayOverrides(prev => { const n = { ...prev }; delete n[kr]; return n; })}
                      style={{padding:"4px 8px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:5,color:"#94a3b8",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                    >✕</button>
                  )}
                </div>
              );
            })}
            <div style={{fontSize:11,color:"#6b7280"}}>비우면 전체 시간 사용</div>
          </div>

          {/* 특정 날짜 시간 */}
          <div style={{flex:"1 1 280px",display:"flex",flexDirection:"column",gap:6}}>
            <div style={{fontSize:12,fontWeight:800,color:"#0369a1",marginBottom:2}}>🗓 특정 날짜 시간</div>
            {Object.entries(draftDateOverrides).sort(([a],[b]) => a.localeCompare(b)).map(([dt, tm]) => (
              <div key={dt} style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,fontWeight:700,color:"#0369a1",minWidth:78}}>{dt}</span>
                <input
                  type="time"
                  lang="en"
                  value={tm}
                  onChange={e => setDraftDateOverrides(prev => ({ ...prev, [dt]: e.target.value }))}
                  style={{flex:1,padding:"6px 8px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}
                />
                <button type="button"
                  onClick={() => setDraftDateOverrides(prev => { const n = { ...prev }; delete n[dt]; return n; })}
                  style={{padding:"4px 8px",background:"#fff",border:"1px solid #e5e7eb",borderRadius:5,color:"#94a3b8",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}
                >✕</button>
              </div>
            ))}
            <div style={{display:"flex",alignItems:"center",gap:6,paddingTop:4,borderTop:"1px dashed #e5e7eb",marginTop:2}}>
              <input
                type="date"
                lang="en"
                placeholder="YYYY-MM-DD"
                value={newOverrideDate}
                min={lesson.start_date || undefined}
                max={lesson.end_date || undefined}
                onChange={e => setNewOverrideDate(e.target.value)}
                style={{flex:"1 1 110px",padding:"6px 8px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}
              />
              <input
                type="time"
                lang="en"
                value={newOverrideTime}
                onChange={e => setNewOverrideTime(e.target.value)}
                style={{flex:"1 1 90px",padding:"6px 8px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}
              />
              <button type="button"
                disabled={!newOverrideDate || !newOverrideTime}
                onClick={() => {
                  if (!newOverrideDate || !newOverrideTime) return;
                  setDraftDateOverrides(prev => ({ ...prev, [newOverrideDate]: newOverrideTime }));
                  setNewOverrideDate("");
                  setNewOverrideTime("");
                }}
                style={{padding:"6px 10px",background:"#0369a1",color:"#fff",border:"none",borderRadius:6,fontSize:12,fontWeight:700,cursor:(!newOverrideDate||!newOverrideTime)?"not-allowed":"pointer",fontFamily:"inherit",opacity:(!newOverrideDate||!newOverrideTime)?0.5:1}}
              >+ Add</button>
            </div>
          </div>

        </div>
        <div style={{marginTop:14}}>
          <button onClick={saveTimeOverrides} disabled={savingTimes}
            style={{height:34,padding:"0 18px",border:"none",borderRadius:7,background:"#1a6fc4",color:"#fff",fontWeight:700,fontSize:13,cursor:savingTimes?"not-allowed":"pointer",fontFamily:"inherit",opacity:savingTimes?0.6:1}}
          >{savingTimes ? "Saving..." : "Save Times"}</button>
        </div>
      </div>

      <div className="at-foot">
        <button className="at-btn secondary" onClick={() => router.back()} disabled={saving}>Cancel</button>
        <button className="at-btn primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "💾 Save"}</button>
      </div>
    </div>
  </>);
}
