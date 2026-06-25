"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { toastOk, toastErr } from "@/lib/toast";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { stripTimeSuffix } from "@/lib/scheduleBlocks";
import { cancelMap, resolutionLabelEN, resolutionLabelKR } from "@/lib/lessonCancellations";
import { sessionsForDate } from "@/lib/lessonDates";

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
  cancellations?: Record<string, string> | null;
  session_overrides?: Record<string, number> | null;
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

function normalizeDayKR(d: string): string {
  const lower = (d || "").toLowerCase().trim();
  return DAY_KR[lower] || d;
}

function generateDates(lesson: Lesson): string[] {
  if (!lesson.start_date || !lesson.end_date) return [];
  const codes = (lesson.class_days || []).map(d => (d || "").toLowerCase().trim());
  if (codes.length === 0) return [];
  const wanted = new Set(codes.map(c => CODE_TO_IDX[c]).filter(i => i !== undefined));
  const out: string[] = [];
  const d = new Date(lesson.start_date + "T00:00:00");
  const end = new Date(lesson.end_date + "T00:00:00");
  while (d <= end) {
    if (wanted.has(d.getDay())) {
      // 취소된 날짜도 목록에 유지 (숨기지 않고 '취소'로 표기)
      out.push(ymd(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const TIME_SLOTS: string[] = (() => {
  const out: string[] = [];
  for (let h = 8; h <= 20; h++) for (const m of [0, 30]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
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
  const hh = Math.floor(tot / 60) % 24, mm = tot % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function rangeFor(start: string, sessions: number): string {
  if (!start) return "";
  return `${start} ~ ${addMin(start, sessions === 2 ? 100 : 50)}`;
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
  const [changeOldVal, setChangeOldVal] = useState("");
  const [changeNewVal, setChangeNewVal] = useState("");
  const [savingManage, setSavingManage] = useState(false);
  const [draftDays, setDraftDays] = useState<string[]>([]);
  const [draftConfirmedTime, setDraftConfirmedTime] = useState<string>("");
  const [draftDayOverrides, setDraftDayOverrides] = useState<Record<string, string>>({});
  const [savingTimes, setSavingTimes] = useState(false);
  const [englishMode, setEnglishMode] = useState(false);
  useEffect(() => { if (typeof window !== "undefined") setEnglishMode(!!localStorage.getItem("teacherSession")); }, []);
  useEffect(() => {
    if (lesson) setDraftDays(lesson.class_days || []);
  }, [lesson]);
  useEffect(() => {
    if (!lesson) return;
    setDraftConfirmedTime(lesson.confirmed_time || lesson.class_time || "");
    const ov = lesson.time_overrides || {};
    const days: Record<string, string> = {};
    for (const [k, v] of Object.entries(ov)) {
      if (WEEKDAY_KR_KEYS.includes(k)) days[k] = String(v);
    }
    setDraftDayOverrides(days);
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
  const cMap = useMemo(() => cancelMap(lesson), [lesson]);
  // 차감 취소는 청구 회차에서 제외 / 보강·미차감은 유지
  const billedDates = useMemo(() => dates.filter(d => cMap[d] !== "deduct"), [dates, cMap]);

  const counts = useMemo(() => {
    const c = { O: 0, X: 0, T: 0 };
    for (const d of dates) {
      if (cMap[d]) continue; // 취소된 날짜는 출결 집계 제외
      const v = draft[d];
      if (v === "○") c.O++;
      else if (v === "✕") c.X++;
      else if (v === "△") c.T++;
    }
    return c;
  }, [dates, draft, cMap]);

  const baseTotal = billedDates.length;
  const total = baseTotal + counts.T;
  const remaining = total - counts.O - counts.X - counts.T;

  function cycle(date: string) {
    if (cMap[date]) return; // 취소된 날짜는 출결 변경 불가
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
    if (error) { toastErr("Save failed: " + error.message); return; }
    // 현지직원 코멘트("무슨 일 있었는지") → 직원업무 "확인해야 할 목록" + 텔레그램 (메모 있을 때만)
    try {
      const noteParts: string[] = [];
      if (notes && notes.trim()) noteParts.push(notes.trim());
      for (const v of Object.values(notesLog)) if (v && String(v).trim()) noteParts.push(String(v).trim());
      const noteText = noteParts.join(" / ");
      if (noteText) {
        await supabase.from("customer_activity").insert({
          type: "tutor_note", action: "코멘트",
          title: `${lesson.student_names || "수업"} · ${noteText}`.slice(0, 250),
          reserver: lesson.house_or_reserver || null,
          ref_table: "tutor_lessons", ref_id: lesson.id,
        });
        fetch("/api/notify/telegram", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "note", payload: { who: lesson.house_or_reserver || lesson.student_names, student: lesson.student_names, note: noteText } }) }).catch(() => {});
      }
    } catch { /* noop */ }
    toastOk("Saved");
    router.back();
  }

  async function rescheduleDate() {
    if (!lesson) return;
    const oldD = changeOldVal.trim();
    const newD = changeNewVal.trim();
    if (!oldD || !newD) { toastErr("Please select both the original date and the new date."); return; }
    if (oldD === newD) { toastErr("Original date and new date are the same."); return; }
    const current: string[] = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
    const nextSkips = current.includes(oldD) ? current : [...current, oldD];
    const note = `Rescheduled: ${oldD} → ${newD}`;
    const nextNotes = notes ? `${notes}\n${note}` : note;
    setSavingManage(true);
    const { error } = await supabase.from("tutor_lessons")
      .update({ skip_dates: nextSkips, tutor_memo: nextNotes })
      .eq("id", lesson.id);
    setSavingManage(false);
    if (error) { toastErr("Reschedule failed: " + error.message); return; }
    setChangeOldVal("");
    setChangeNewVal("");
    setNotes(nextNotes);
    toastOk(`Rescheduled: ${oldD} → ${newD}`);
    load();
  }

  async function setOneDateTimeSession(date: string, start: string, sessions: number) {
    if (!lesson || !start) return;
    const ov = { ...(lesson.time_overrides || {}) }; ov[date] = rangeFor(start, sessions);
    const so = { ...((lesson.session_overrides || {}) as Record<string, number>) }; so[date] = sessions;
    const { error } = await supabase.from("tutor_lessons").update({ time_overrides: ov, session_overrides: so }).eq("id", lesson.id);
    if (error) { toastErr("Save failed: " + error.message); return; }
    setLesson(l => l ? { ...l, time_overrides: ov, session_overrides: so } : l);
    toastOk(englishMode ? "Updated" : "변경됨");
  }
  async function cancelDateInline(date: string) {
    if (!lesson) return;
    const cur: string[] = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
    if (cur.includes(date)) return;
    const { error } = await supabase.from("tutor_lessons").update({ skip_dates: [...cur, date] }).eq("id", lesson.id);
    if (error) { toastErr("Cancel failed: " + error.message); return; }
    setLesson(l => l ? { ...l, skip_dates: [...cur, date] } : l);
    toastOk(englishMode ? "Cancelled" : "취소됨");
  }
  async function restoreDate(date: string) {
    if (!lesson) return;
    const cur: string[] = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
    const nextSkips = cur.filter(d => d !== date);
    const cancellations = { ...((lesson.cancellations || {}) as Record<string, string>) };
    delete cancellations[date];
    const { error } = await supabase.from("tutor_lessons").update({ skip_dates: nextSkips, cancellations }).eq("id", lesson.id);
    if (error) { toastErr("Restore failed: " + error.message); return; }
    setLesson(l => l ? { ...l, skip_dates: nextSkips, cancellations } : l);
    toastOk(englishMode ? "Restored" : "복구됨");
  }

  async function saveClassDays() {
    if (!lesson) return;
    setSavingManage(true);
    const { error } = await supabase.from("tutor_lessons")
      .update({ class_days: draftDays }).eq("id", lesson.id);
    setSavingManage(false);
    if (error) { toastErr("Save failed: " + error.message); return; }
    toastOk("Class days saved.");
    load();
  }

  async function saveTimeOverrides() {
    if (!lesson) return;
    setSavingTimes(true);
    const merged: Record<string, string> = {};
    // 날짜별 시간(줄별 시간 변경)은 보존
    for (const [k, v] of Object.entries(lesson.time_overrides || {})) {
      if (!WEEKDAY_KR_KEYS.includes(k) && String(v).trim()) merged[k] = String(v);
    }
    // 요일별 시간 적용
    for (const [k, v] of Object.entries(draftDayOverrides)) {
      const t = String(v || "").trim();
      if (t) merged[k] = t;
    }
    const { error } = await supabase.from("tutor_lessons")
      .update({ confirmed_time: draftConfirmedTime || null, time_overrides: merged })
      .eq("id", lesson.id);
    setSavingTimes(false);
    if (error) { toastErr("Time save failed: " + error.message); return; }
    toastOk(englishMode ? "Class times saved." : "시간 저장됨.");
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
  const timeLabel = stripTimeSuffix(lesson.confirmed_time || lesson.class_time) || "-";

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
.at-box.s-cancel{background:#f1f5f9;color:#94a3b8;border-color:#e2e8f0;border-style:dashed;cursor:not-allowed;opacity:0.85}
.at-box.s-cancel .idx{color:#cbd5e1}
.at-box.s-cancel .dt{text-decoration:line-through;text-decoration-thickness:1.5px}

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
          <div className="s"><span className="lbl">{englishMode ? "Total" : "총 회차"}</span><b>{total}</b></div>
          <div className="s attend"><span className="lbl">{englishMode ? "Attended" : "출석"}</span><b>{counts.O}</b></div>
          <div className="s miss"><span className="lbl">{englishMode ? "Absent" : "결석"}</span><b>{counts.X}</b></div>
          <div className="s makeup"><span className="lbl">{englishMode ? "Makeup" : "메이크업"}</span><b>{counts.T}</b></div>
          <div className="s remain"><span className="lbl">{englishMode ? "Remaining" : "잔여"}</span><b>{remaining}</b></div>
        </div>
      </div>

      <div className="at-card">
        <div className="at-help">
          {englishMode
            ? "Each row: set time, attendance (○ attended / ✕ absent / △ makeup), memo, and cancel. △ extends total by +1. Time & cancel save instantly; attendance & memo save with the Save button."
            : "한 줄에서 시간 · 출결(○출석/✕결석/△메이크업) · 메모 · 취소를 처리합니다. △는 총 회차 +1. 시간·취소는 즉시 저장, 출결·메모는 저장 버튼으로 저장."}
        </div>
        {dates.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "#9ca3af", fontSize: 13 }}>
            {englishMode ? "No class dates (check start/end date and days)" : "수업일이 없습니다 (기간·요일 확인)"}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 580 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ textAlign: "left", padding: "9px 10px", fontWeight: 700, fontSize: 11.5, color: "#6b7c93", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", width: 120 }}>{englishMode ? "Date" : "회차·날짜"}</th>
                  <th style={{ textAlign: "left", padding: "9px 10px", fontWeight: 700, fontSize: 11.5, color: "#6b7c93", borderBottom: "2px solid #e2e8f0", width: 150 }}>{englishMode ? "Time" : "시간"}</th>
                  <th style={{ textAlign: "center", padding: "9px 10px", fontWeight: 700, fontSize: 11.5, color: "#6b7c93", borderBottom: "2px solid #e2e8f0", width: 140 }}>{englishMode ? "Attendance" : "출결"}</th>
                  <th style={{ textAlign: "left", padding: "9px 10px", fontWeight: 700, fontSize: 11.5, color: "#6b7c93", borderBottom: "2px solid #e2e8f0" }}>{englishMode ? "Memo" : "메모"}</th>
                  <th style={{ textAlign: "center", padding: "9px 10px", fontWeight: 700, fontSize: 11.5, color: "#6b7c93", borderBottom: "2px solid #e2e8f0", width: 70 }}>{englishMode ? "Cancel" : "취소"}</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((d, i) => {
                  const dt = new Date(d + "T00:00:00");
                  const md = `${dt.getMonth() + 1}/${dt.getDate()}`;
                  const dw = WEEKDAYS_KR[dt.getDay()];
                  const cancelRes = cMap[d];
                  const v = draft[d] || "";
                  const curRange = (lesson.time_overrides?.[d]) || stripTimeSuffix(lesson.confirmed_time || lesson.class_time) || "";
                  const curStart = startOf(curRange);
                  const curSessions = sessionsForDate(lesson, d);
                  if (cancelRes) {
                    return (
                      <tr key={d} style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc", opacity: 0.85 }}>
                        <td style={{ padding: "9px 10px", whiteSpace: "nowrap", textDecoration: "line-through", color: "#94a3b8" }}><b>#{i + 1}</b> {md} <span style={{ fontSize: 11 }}>({dw})</span></td>
                        <td style={{ padding: "9px 10px", color: "#dc2626", fontWeight: 700 }}>🚫 {englishMode ? `Cancelled (${resolutionLabelEN(cancelRes)})` : `취소됨 (${resolutionLabelKR(cancelRes)})`}</td>
                        <td style={{ padding: "9px 10px", textAlign: "center", color: "#94a3b8" }}>—</td>
                        <td style={{ padding: "9px 10px", color: "#94a3b8", fontSize: 12 }}>{notesLog[d] || ""}</td>
                        <td style={{ padding: "9px 10px", textAlign: "center" }}><button onClick={() => restoreDate(d)} style={{ padding: "4px 10px", border: "1px solid #cbd5e1", background: "#fff", color: "#475569", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{englishMode ? "Restore" : "복구"}</button></td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={d} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}><b style={{ color: "#1a6fc4" }}>#{i + 1}</b> {md} <span style={{ fontSize: 11, color: "#94a3b8" }}>({dw})</span></td>
                      <td style={{ padding: "9px 10px" }}>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <select value={curStart} onChange={e => setOneDateTimeSession(d, e.target.value, curSessions)} style={{ flex: 1, padding: "6px 4px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "inherit", background: "#fff", outline: "none" }}>
                            {curStart === "" && <option value="">{englishMode ? "Start" : "시작"}</option>}
                            {curStart !== "" && !TIME_SLOTS.includes(curStart) && <option value={curStart}>{curStart}</option>}
                            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <select value={String(curSessions)} onChange={e => setOneDateTimeSession(d, curStart, Number(e.target.value))} style={{ width: 70, padding: "6px 4px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "inherit", background: "#fff", outline: "none" }}>
                            <option value="1">{englishMode ? "1T" : "1타임"}</option>
                            <option value="2">{englishMode ? "2T" : "2타임"}</option>
                          </select>
                        </div>
                        {curStart !== "" && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{rangeFor(curStart, curSessions)}</div>}
                      </td>
                      <td style={{ padding: "9px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                        {(["○", "✕", "△"] as const).map(mk => (
                          <button key={mk} type="button" onClick={() => setDraft(pr => ({ ...pr, [d]: pr[d] === mk ? "" : mk }))}
                            title={mk === "○" ? (englishMode ? "Attended" : "출석") : mk === "✕" ? (englishMode ? "Absent" : "결석") : (englishMode ? "Makeup" : "메이크업")}
                            style={{ width: 30, height: 30, margin: "0 2px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 800,
                              border: v === mk ? "none" : "1px solid #e5e7eb",
                              background: v === mk ? (mk === "○" ? "#dcfce7" : mk === "✕" ? "#fee2e2" : "#fef3c7") : "#fff",
                              color: v === mk ? (mk === "○" ? "#15803d" : mk === "✕" ? "#b91c1c" : "#92400e") : "#cbd5e1" }}>{mk}</button>
                        ))}
                      </td>
                      <td style={{ padding: "9px 10px" }}>
                        <input value={notesLog[d] || ""} onChange={e => setNotesLog(pr => ({ ...pr, [d]: e.target.value }))} placeholder={englishMode ? "Memo..." : "메모..."}
                          style={{ width: "100%", padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                      </td>
                      <td style={{ padding: "9px 10px", textAlign: "center" }}>
                        <button type="button" onClick={() => cancelDateInline(d)} style={{ padding: "4px 10px", border: "1px solid #fca5a5", background: "#fff", color: "#dc2626", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{englishMode ? "Cancel" : "취소"}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

          {/* Default Time */}
          <div style={{flex:"1 1 180px",display:"flex",flexDirection:"column",gap:6}}>
            <div style={{fontSize:12,fontWeight:800,color:"#1a6fc4",marginBottom:2}}>⏰ Default Time</div>
            <input
              type="time"
              lang="en"
              value={draftConfirmedTime}
              onChange={e => setDraftConfirmedTime(e.target.value)}
              style={{padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:6,fontSize:13,fontFamily:"inherit",outline:"none"}}
            />
            <div style={{fontSize:11,color:"#6b7280"}}>Default class time for all days</div>
          </div>

          {/* Time by Day */}
          <div style={{flex:"1 1 260px",display:"flex",flexDirection:"column",gap:6}}>
            <div style={{fontSize:12,fontWeight:800,color:"#7c3aed",marginBottom:2}}>📅 Time by Day</div>
            {(lesson.class_days || []).length === 0 && (
              <div style={{fontSize:11,color:"#9ca3af"}}>No days set.</div>
            )}
            {(lesson.class_days || []).map((rawDay, i) => {
              const kr = normalizeDayKR(rawDay);
              const en = ({'월':'Mon','화':'Tue','수':'Wed','목':'Thu','금':'Fri','토':'Sat','일':'Sun'} as Record<string,string>)[kr] || kr;
              const val = draftDayOverrides[kr] || "";
              return (
                <div key={`${rawDay}-${i}`} style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#7c3aed",minWidth:32}}>{en}</span>
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
            <div style={{fontSize:11,color:"#6b7280"}}>Leave blank to use default time</div>
          </div>

        </div>
        <div style={{marginTop:14}}>
          <button onClick={saveTimeOverrides} disabled={savingTimes}
            style={{height:34,padding:"0 18px",border:"none",borderRadius:7,background:"#1a6fc4",color:"#fff",fontWeight:700,fontSize:13,cursor:savingTimes?"not-allowed":"pointer",fontFamily:"inherit",opacity:savingTimes?0.6:1}}
          >{savingTimes ? "Saving..." : "Save Times"}</button>
        </div>
      </div>

      <div className="at-foot">
        <button className="at-btn secondary" onClick={() => router.back()} disabled={saving}>{englishMode ? "Back" : "닫기"}</button>
        <button className="at-btn primary" onClick={save} disabled={saving}>{saving ? (englishMode ? "Saving..." : "저장중...") : (englishMode ? "💾 Save" : "💾 저장")}</button>
      </div>
    </div>
  </>);
}
