"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface Tutor { id: string; name: string }
interface Lesson {
  id: string;
  house_or_reserver: string; student_names: string;
  class_type: string; sessions_per_day: number | null; hourly_rate: number;
  class_time: string | null; confirmed_time: string | null;
  total_sessions: number | null;
  tutor_id: string | null;
  status: string;
}
interface SessionRow {
  id: string; lesson_id: string;
  session_date: string; session_idx: number;
  status: string;
  session_time: string | null;
  session_note: string | null;
}
interface Enriched extends SessionRow {
  lesson: Lesson;
  tutor_name: string | null;
  tutor_color: string;
}

const TUTOR_PALETTE = [
  "#ec4899", "#a855f7", "#3b82f6", "#22c55e", "#eab308",
  "#f97316", "#ef4444", "#06b6d4", "#84cc16", "#6366f1",
];
const UNASSIGNED_COLOR = "#94a3b8";

function getTutorColor(tutorId: string | null | undefined): string {
  if (!tutorId) return UNASSIGNED_COLOR;
  let hash = 0;
  for (let i = 0; i < tutorId.length; i++) hash = (hash * 31 + tutorId.charCodeAt(i)) >>> 0;
  return TUTOR_PALETTE[hash % TUTOR_PALETTE.length];
}

const WEEKDAY_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Monday-based week range
function weekRange(offset = 0): { start: string; end: string; dates: string[]; startDate: Date; endDate: Date } {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun..6=Sat
  const mon = new Date(now);
  mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  mon.setHours(0, 0, 0, 0);
  mon.setDate(mon.getDate() + offset * 7);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    dates.push(fmtDate(d));
  }
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: dates[0], end: dates[6], dates, startDate: mon, endDate: sun };
}

function weekLabelKR(offset: number): string {
  if (offset === 0) return "이번 주";
  if (offset === 1) return "다음 주";
  if (offset === -1) return "지난 주";
  if (offset > 0) return `${offset}주 후`;
  return `${-offset}주 전`;
}

function formatWeekRange(start: Date, end: Date) {
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opt)} – ${end.toLocaleDateString("en-US", opt)}, ${end.getFullYear()}`;
}

const SESSION_STATUS_ORDER = [
  "scheduled", "attended", "no_show",
  "cancelled_by_student", "cancelled_by_tutor", "rescheduled",
] as const;
const SESSION_STATUS_LABEL: Record<string, string> = {
  scheduled: "예정",
  attended: "출석",
  no_show: "노쇼",
  cancelled_by_student: "학생취소",
  cancelled_by_tutor: "튜터취소",
  rescheduled: "재조정",
};
const STATUS_BADGE: Record<string, { label: string; bg: string; color: string; strike?: boolean }> = {
  scheduled:  { label: "예정",  bg: "#f1f5f9", color: "#64748b" },
  attended:   { label: "출석",  bg: "#dcfce7", color: "#166534" },
  no_show:    { label: "노쇼",  bg: "#fee2e2", color: "#b91c1c" },
  cancelled_by_student: { label: "취소", bg: "#e2e8f0", color: "#64748b", strike: true },
  cancelled_by_tutor:   { label: "취소", bg: "#e2e8f0", color: "#64748b", strike: true },
  rescheduled: { label: "재조정", bg: "#fef3c7", color: "#92400e" },
};

function firstStudent(names: string | null | undefined): string {
  if (!names) return "-";
  const s = names.trim();
  const slashed = s.split("/")[0].trim();
  const comma = slashed.split(",")[0].trim();
  return comma || slashed || s;
}

function classTypeBase(ct: string | null | undefined): string {
  if (!ct) return "-";
  const m = ct.match(/1\s*[:：]\s*[12]/);
  return m ? m[0].replace(/\s+/g, "") : ct;
}

export default function TutorWeeklySchedule() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [sessions, setSessions] = useState<Enriched[]>([]);
  const [tutorFilter, setTutorFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Enriched | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const week = useMemo(() => weekRange(weekOffset), [weekOffset]);
  const today = todayStr();

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2400);
  }, []);

  const loadTutors = useCallback(async () => {
    const { data, error } = await supabase.from("tutors").select("id, name").order("name");
    if (error) { console.error("튜터 로드 실패:", error); return; }
    setTutors((data || []) as Tutor[]);
  }, []);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    const { start, end } = week;
    const { data: sessRows, error: sErr } = await supabase
      .from("tutor_lesson_sessions")
      .select("*")
      .gte("session_date", start)
      .lte("session_date", end)
      .order("session_date", { ascending: true });
    if (sErr) {
      console.error("세션 로드 실패:", sErr);
      setSessions([]); setLoading(false);
      return;
    }
    const rawSessions = (sessRows || []) as SessionRow[];
    const lessonIds = Array.from(new Set(rawSessions.map(s => s.lesson_id)));
    let lessonMap = new Map<string, Lesson>();
    if (lessonIds.length > 0) {
      const { data: lRows, error: lErr } = await supabase
        .from("tutor_lessons")
        .select("*")
        .in("id", lessonIds)
        .in("status", ["active", "completed"]);
      if (lErr) console.error("수업 로드 실패:", lErr);
      const lessons = (lRows || []) as Lesson[];
      lessonMap = new Map(lessons.map(l => [l.id, l]));
    }
    const enriched: Enriched[] = [];
    for (const s of rawSessions) {
      const lesson = lessonMap.get(s.lesson_id);
      if (!lesson) continue; // skip if parent lesson is cancelled/suspended or missing
      const tutorName = lesson.tutor_id ? (tutors.find(t => t.id === lesson.tutor_id)?.name || null) : null;
      enriched.push({
        ...s,
        lesson,
        tutor_name: tutorName,
        tutor_color: getTutorColor(lesson.tutor_id),
      });
    }
    // secondary sort by time
    enriched.sort((a, b) => {
      if (a.session_date !== b.session_date) return a.session_date.localeCompare(b.session_date);
      return (a.session_time || "99:99").localeCompare(b.session_time || "99:99");
    });
    setSessions(enriched);
    setLoading(false);
  }, [week, tutors]);

  useEffect(() => { loadTutors(); }, [loadTutors]);
  useEffect(() => { loadWeek(); }, [loadWeek]);

  // Filtered view
  const filteredSessions = useMemo(() => {
    if (tutorFilter === "all") return sessions;
    if (tutorFilter === "__unassigned__") return sessions.filter(s => !s.lesson.tutor_id);
    return sessions.filter(s => s.lesson.tutor_id === tutorFilter);
  }, [sessions, tutorFilter]);

  const byDate = useMemo(() => {
    const map = new Map<string, Enriched[]>();
    for (const d of week.dates) map.set(d, []);
    for (const s of filteredSessions) {
      const arr = map.get(s.session_date);
      if (arr) arr.push(s);
    }
    return map;
  }, [filteredSessions, week.dates]);

  // Active tutors in this week's sessions (for legend)
  const legendTutors = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>();
    for (const s of sessions) {
      const id = s.lesson.tutor_id;
      if (id && !seen.has(id)) {
        seen.set(id, {
          id,
          name: s.tutor_name || "(이름 없음)",
          color: s.tutor_color,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const hasUnassigned = useMemo(() => sessions.some(s => !s.lesson.tutor_id), [sessions]);

  async function updateSessionStatus(sessionId: string, newStatus: string) {
    setSavingId(sessionId);
    const { error } = await supabase
      .from("tutor_lesson_sessions")
      .update({ status: newStatus })
      .eq("id", sessionId);
    setSavingId(null);
    if (error) {
      console.error("상태 변경 실패:", error);
      showToast("변경 실패: " + error.message);
      return;
    }
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: newStatus } : s));
    setSelected(sel => sel && sel.id === sessionId ? { ...sel, status: newStatus } : sel);
    showToast("상태가 변경되었습니다");
  }

  function resolveTime(s: Enriched): string {
    return s.session_time || s.lesson.confirmed_time || s.lesson.class_time || "--:--";
  }

  return (<>
    <style>{`
.tws-ctrl{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}
.tws-nav{display:flex;gap:4px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:3px}
.tws-nav button{padding:7px 14px;border:none;border-radius:7px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;background:transparent;color:#475569;transition:all 120ms}
.tws-nav button:hover:not(.ac){background:#f1f5f9}
.tws-nav button.ac{background:#1a6fc4;color:#fff}
.tws-label{font-size:13px;font-weight:700;color:#1a1a2e;padding:7px 12px;background:#eff6ff;border-radius:8px}
.tws-label .sub{color:#6b7c93;font-weight:600;margin-left:6px}
.tws-spacer{flex:1;min-width:8px}
.tws-ctrl select{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;font-family:inherit;background:#fff;outline:none;min-width:150px}
.tws-cnt{font-size:12.5px;font-weight:700;color:#1a1a2e;padding:6px 10px;background:#f1f5f9;border-radius:8px}

.tws-legend{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px;font-size:11.5px;color:#475569;font-weight:700;padding:8px 12px;background:#fff;border-radius:10px;border:1px solid #e2e8f0}
.tws-legend .chip{display:inline-flex;align-items:center;gap:5px}
.tws-legend .dot{width:10px;height:10px;border-radius:50%}
.tws-legend .none{color:#94a3b8;font-weight:600}

.tws-grid{display:grid;grid-template-columns:repeat(7,minmax(140px,1fr));gap:10px;overflow-x:auto;padding-bottom:4px}
.tws-col{background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:10px;min-height:420px;display:flex;flex-direction:column}
.tws-head{text-align:center;font-size:12px;font-weight:800;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;color:#475569}
.tws-head .day{font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:3px;letter-spacing:0.04em}
.tws-head .date{font-size:14px;color:#1a1a2e}
.tws-head.today .date{display:inline-block;background:#1a6fc4;color:#fff;border-radius:999px;width:26px;height:26px;line-height:26px;text-align:center}
.tws-head.today .day{color:#1a6fc4}
.tws-head.weekend .day{color:#dc2626}

.tws-sess{border-left:4px solid #94a3b8;border-radius:8px;padding:7px 9px;margin-bottom:6px;cursor:pointer;background:#f8fafc;transition:all 120ms}
.tws-sess:hover{background:#eff6ff;transform:translateY(-1px)}
.tws-sess .time{font-size:10.5px;color:#6b7c93;font-weight:700}
.tws-sess .stu{font-size:13px;font-weight:800;color:#1a1a2e;margin-top:2px;line-height:1.3;word-break:keep-all}
.tws-sess .tut{font-size:11px;font-weight:700;margin-top:2px}
.tws-sess .tut.unassigned{color:#dc2626;font-weight:800}
.tws-sess .badges{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}
.tws-sess .b{display:inline-block;padding:1px 6px;border-radius:4px;font-size:9.5px;font-weight:800;line-height:1.5}
.tws-sess .b-type{background:#eff6ff;color:#1a6fc4}
.tws-sess .b-time1{background:#f1f5f9;color:#475569}
.tws-sess .b-time2{background:#dbeafe;color:#1e40af}

.tws-empty{text-align:center;color:#cbd5e1;font-size:11px;padding:40px 4px;font-weight:600}
.tws-week-empty{background:#fff;border-radius:14px;padding:56px 28px;text-align:center;color:#94a3b8;font-size:14px}

.tws-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 22px;border-radius:10px;font-size:13.5px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,0.18);z-index:300;animation:twsToastIn 250ms ease-out}
@keyframes twsToastIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}

.tws-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:200;padding:20px}
.tws-m{background:#fff;border-radius:16px;width:100%;max-width:460px;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
.tws-m-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid #e2e8f0}
.tws-m-head h3{font-size:15px;font-weight:800;margin:0}
.tws-close{background:none;border:none;font-size:20px;cursor:pointer;color:#6b7c93;padding:4px 8px;border-radius:6px;line-height:1}.tws-close:hover{background:#f1f5f9}
.tws-m-body{padding:16px 20px}
.tws-kv{display:grid;grid-template-columns:100px 1fr;gap:7px 12px;font-size:13px;margin-bottom:14px}
.tws-kv .k{color:#6b7c93;font-weight:700;font-size:11.5px;align-self:center}
.tws-kv .v{color:#1a1a2e;font-weight:700;word-break:keep-all}
.tws-kv .v.unassigned{color:#dc2626}
.tws-m-row{margin-bottom:12px}
.tws-m-row label{display:block;font-size:11.5px;font-weight:800;color:#6b7c93;margin-bottom:5px}
.tws-m-row select{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;background:#fff;outline:none}
.tws-m-row select:focus{border-color:#1a6fc4}
.tws-m-note{padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;color:#475569;min-height:38px;white-space:pre-wrap;line-height:1.5}
.tws-m-note.empty{color:#cbd5e1;font-style:italic}
.tws-m-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid #e2e8f0}
.tws-m-foot button{padding:9px 16px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid #e2e8f0;background:#f1f5f9;color:#475569}
.tws-m-foot button:hover{background:#e2e8f0}

@media(max-width:1100px){.tws-grid{grid-template-columns:repeat(7,minmax(120px,1fr))}}
@media(max-width:800px){.tws-grid{grid-template-columns:repeat(7,140px)}}
    `}</style>

    <div className="tws-ctrl">
      <div className="tws-nav" role="group" aria-label="주 네비게이션">
        <button onClick={() => setWeekOffset(o => o - 1)}>◀ 이전 주</button>
        <button className={weekOffset === 0 ? "ac" : ""} onClick={() => setWeekOffset(0)}>이번 주</button>
        <button onClick={() => setWeekOffset(o => o + 1)}>다음 주 ▶</button>
      </div>
      <div className="tws-label">
        {weekLabelKR(weekOffset)}
        <span className="sub">{formatWeekRange(week.startDate, week.endDate)}</span>
      </div>
      <div className="tws-spacer" />
      <select
        value={tutorFilter}
        onChange={e => setTutorFilter(e.target.value)}
        aria-label="튜터 필터"
      >
        <option value="all">모든 튜터</option>
        {hasUnassigned && <option value="__unassigned__">(미배정)</option>}
        {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <div className="tws-cnt">{filteredSessions.length} sessions</div>
    </div>

    <div className="tws-legend">
      {legendTutors.length === 0 && !hasUnassigned ? (
        <span className="none">표시할 튜터가 없습니다</span>
      ) : (
        <>
          {legendTutors.map(t => (
            <span key={t.id} className="chip">
              <span className="dot" style={{ background: t.color }} />
              {t.name}
            </span>
          ))}
          {hasUnassigned && (
            <span className="chip">
              <span className="dot" style={{ background: UNASSIGNED_COLOR }} />
              (미배정)
            </span>
          )}
        </>
      )}
    </div>

    {loading ? (
      <div className="tws-week-empty">로딩 중...</div>
    ) : filteredSessions.length === 0 ? (
      <div className="tws-week-empty">이 주에 예정된 수업이 없습니다.</div>
    ) : (
      <div className="tws-grid">
        {week.dates.map((date, i) => {
          const dt = new Date(date + "T00:00:00");
          const dayNum = dt.getDate();
          const isToday = date === today;
          const isWeekend = i === 5 || i === 6; // Sat, Sun
          const list = byDate.get(date) || [];
          return (
            <div key={date} className="tws-col">
              <div className={`tws-head${isToday ? " today" : ""}${isWeekend ? " weekend" : ""}`}>
                <div className="day">{WEEKDAY_EN[i]}</div>
                <div className="date">{dayNum}</div>
              </div>
              {list.length === 0 ? (
                <div className="tws-empty">No class</div>
              ) : (
                list.map(s => {
                  const t = STATUS_BADGE[s.status] || STATUS_BADGE.scheduled;
                  const typeBase = classTypeBase(s.lesson.class_type);
                  const spd = s.lesson.sessions_per_day === 2 ? "2T" : "1T";
                  return (
                    <div
                      key={s.id}
                      className="tws-sess"
                      style={{ borderLeftColor: s.tutor_color }}
                      onClick={() => setSelected(s)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(s); } }}
                    >
                      <div className="time">{resolveTime(s)}</div>
                      <div className="stu">{firstStudent(s.lesson.student_names)}</div>
                      <div className={`tut${s.lesson.tutor_id ? "" : " unassigned"}`} style={s.lesson.tutor_id ? { color: s.tutor_color } : undefined}>
                        {s.tutor_name || (s.lesson.tutor_id ? "(이름 없음)" : "미배정")}
                      </div>
                      <div className="badges">
                        <span className="b b-type">{typeBase}</span>
                        <span className={`b ${s.lesson.sessions_per_day === 2 ? "b-time2" : "b-time1"}`}>{spd}</span>
                        <span
                          className="b"
                          style={{
                            background: t.bg,
                            color: t.color,
                            textDecoration: t.strike ? "line-through" : "none",
                          }}
                        >
                          {t.label}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    )}

    {selected && (
      <div className="tws-overlay" onClick={() => setSelected(null)}>
        <div className="tws-m" onClick={e => e.stopPropagation()}>
          <div className="tws-m-head">
            <h3>📋 {firstStudent(selected.lesson.student_names)} · {selected.session_idx}회차</h3>
            <button className="tws-close" onClick={() => setSelected(null)} aria-label="닫기">✕</button>
          </div>
          <div className="tws-m-body">
            <div className="tws-kv">
              <span className="k">학생</span>
              <span className="v">{selected.lesson.student_names}</span>
              <span className="k">예약자</span>
              <span className="v">{selected.lesson.house_or_reserver}</span>
              <span className="k">클래스</span>
              <span className="v">
                {classTypeBase(selected.lesson.class_type)} · {selected.lesson.sessions_per_day === 2 ? "2타임" : "1타임"} · ₱{(selected.lesson.hourly_rate || 0).toLocaleString()}/타임
              </span>
              <span className="k">튜터</span>
              <span className={`v${selected.lesson.tutor_id ? "" : " unassigned"}`}>
                {selected.tutor_name || (selected.lesson.tutor_id ? "(이름 없음)" : "튜터 미배정")}
              </span>
              <span className="k">회차</span>
              <span className="v">
                {selected.session_idx}회차 / {selected.lesson.total_sessions ?? "-"}회 중
              </span>
              <span className="k">날짜/시간</span>
              <span className="v">{selected.session_date} · {resolveTime(selected)}</span>
            </div>

            <div className="tws-m-row">
              <label htmlFor="tws-status">상태</label>
              <select
                id="tws-status"
                value={selected.status}
                onChange={e => updateSessionStatus(selected.id, e.target.value)}
                disabled={savingId === selected.id}
              >
                {SESSION_STATUS_ORDER.map(k => (
                  <option key={k} value={k}>{SESSION_STATUS_LABEL[k]}</option>
                ))}
              </select>
            </div>

            <div className="tws-m-row">
              <label>튜터 노트 (읽기 전용)</label>
              <div className={`tws-m-note${selected.session_note ? "" : " empty"}`}>
                {selected.session_note || "노트 없음"}
              </div>
            </div>
          </div>
          <div className="tws-m-foot">
            <button onClick={() => setSelected(null)}>닫기</button>
          </div>
        </div>
      </div>
    )}

    {toast && <div className="tws-toast" role="status" aria-live="polite">{toast}</div>}
  </>);
}
