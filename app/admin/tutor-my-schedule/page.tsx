"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed, getAdminUserId } from "@/lib/adminAuth";

// 로그인 어드민 계정 → 튜터 이름 매핑
const ACCOUNT_TUTOR: Record<string, string> = {
  "admin-ann": "T.Ann",
  "admin-angel": "T.Angel",
  "admin-carla": "T.Carla",
  "admin-amelyn": "T.Amelyn",
  "admin-cristel": "T.Cristel",
};

interface Tutor { id: string; name: string }
interface Lesson {
  id: string;
  student_names: string;
  class_type: string;
  class_time: string | null;
  confirmed_time: string | null;
  tutor_id: string | null;
  status: string;
}
interface SessionRow {
  id: string; lesson_id: string;
  session_date: string; session_idx: number;
  status: string; session_time: string | null;
}
interface Enriched extends SessionRow { lesson: Lesson }

const WEEKDAY_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STATUS_BADGE: Record<string, { label: string; bg: string; color: string; strike?: boolean }> = {
  scheduled:            { label: "예정", bg: "#f1f5f9", color: "#64748b" },
  attended:             { label: "출석", bg: "#dcfce7", color: "#166534" },
  no_show:              { label: "노쇼", bg: "#fee2e2", color: "#b91c1c" },
  cancelled_by_student: { label: "취소", bg: "#e2e8f0", color: "#64748b", strike: true },
  cancelled_by_tutor:   { label: "취소", bg: "#e2e8f0", color: "#64748b", strike: true },
  cancelled:            { label: "취소", bg: "#e2e8f0", color: "#64748b", strike: true },
  rescheduled:          { label: "재조정", bg: "#fef3c7", color: "#92400e" },
};

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayStr() { return fmtDate(new Date()); }

function weekRange(offset = 0): { start: string; end: string; dates: string[]; startDate: Date; endDate: Date } {
  const now = new Date();
  const dow = now.getDay();
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
  return offset > 0 ? `${offset}주 후` : `${-offset}주 전`;
}

function formatWeekRange(start: Date, end: Date) {
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opt)} – ${end.toLocaleDateString("en-US", opt)}, ${end.getFullYear()}`;
}

// "T.Ann" / "Ann" / "T. Ann" → "ann" 으로 정규화하여 tutors.name 과 매칭
function normalizeTutorName(n: string): string {
  return (n || "").toLowerCase().replace(/^t\.?\s*/, "").replace(/\s+/g, "").trim();
}

function firstStudent(names: string | null | undefined): string {
  if (!names) return "-";
  const s = names.trim();
  return s.split("/")[0].split(",")[0].trim() || s;
}

function classTypeBase(ct: string | null | undefined): string {
  if (!ct) return "-";
  const m = ct.match(/1\s*[:：]\s*[12]/);
  return m ? m[0].replace(/\s+/g, "") : ct;
}

function resolveTime(s: Enriched): string {
  return s.session_time || s.lesson.confirmed_time || s.lesson.class_time || "--:--";
}

export default function TutorMySchedulePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [selectedTutorId, setSelectedTutorId] = useState<string>("");
  const [weekOffset, setWeekOffset] = useState(0);
  const [sessions, setSessions] = useState<Enriched[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    setAuthed(true);
    setAccountId(getAdminUserId());
  }, []);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      const { data, error } = await supabase.from("tutors").select("id, name").order("name");
      if (error) { console.error("튜터 로드 실패:", error); return; }
      setTutors((data || []) as Tutor[]);
    })();
  }, [authed]);

  const mappedTutorName = accountId ? ACCOUNT_TUTOR[accountId] : undefined;
  const isMappedTutor = !!mappedTutorName;

  // 매핑된 튜터 계정이면 tutors 로드 후 본인 id 자동 선택
  useEffect(() => {
    if (!isMappedTutor || !mappedTutorName || tutors.length === 0) return;
    const norm = normalizeTutorName(mappedTutorName);
    const found = tutors.find(t => normalizeTutorName(t.name) === norm);
    if (found) setSelectedTutorId(found.id);
  }, [tutors, isMappedTutor, mappedTutorName]);

  const week = useMemo(() => weekRange(weekOffset), [weekOffset]);
  const today = todayStr();

  const loadWeek = useCallback(async () => {
    if (!selectedTutorId) { setSessions([]); setLoading(false); return; }
    setLoading(true);
    const { start, end } = week;
    const { data: sessRows, error: sErr } = await supabase
      .from("tutor_lesson_sessions")
      .select("*")
      .gte("session_date", start)
      .lte("session_date", end)
      .order("session_date", { ascending: true });
    if (sErr) { console.error("세션 로드 실패:", sErr); setSessions([]); setLoading(false); return; }
    const raw = (sessRows || []) as SessionRow[];
    const lessonIds = Array.from(new Set(raw.map(s => s.lesson_id)));
    let lessonMap = new Map<string, Lesson>();
    if (lessonIds.length > 0) {
      const { data: lRows, error: lErr } = await supabase
        .from("tutor_lessons")
        .select("*")
        .in("id", lessonIds)
        .in("status", ["active", "completed"]);
      if (lErr) console.error("수업 로드 실패:", lErr);
      lessonMap = new Map(((lRows || []) as Lesson[]).map(l => [l.id, l]));
    }
    const enriched: Enriched[] = [];
    for (const s of raw) {
      const lesson = lessonMap.get(s.lesson_id);
      if (!lesson) continue;
      if (lesson.tutor_id !== selectedTutorId) continue;
      enriched.push({ ...s, lesson });
    }
    enriched.sort((a, b) =>
      a.session_date !== b.session_date
        ? a.session_date.localeCompare(b.session_date)
        : (a.session_time || "99:99").localeCompare(b.session_time || "99:99")
    );
    setSessions(enriched);
    setLoading(false);
  }, [week, selectedTutorId]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  const byDate = useMemo(() => {
    const m = new Map<string, Enriched[]>();
    for (const d of week.dates) m.set(d, []);
    for (const s of sessions) m.get(s.session_date)?.push(s);
    return m;
  }, [sessions, week.dates]);

  if (!authed) return null;

  const myTutorName = tutors.find(t => t.id === selectedTutorId)?.name || mappedTutorName || "";

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.tms-w{max-width:1500px;margin:0 auto;padding:28px 20px}
.tms-top{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.tms-back{background:#fff;border:1px solid #cbd5e1;border-radius:8px;font-size:12.5px;font-weight:700;color:#475569;cursor:pointer;padding:8px 14px;font-family:inherit}
.tms-back:hover{background:#e2e8f0}
.tms-top h1{flex:1;text-align:center;font-size:21px;font-weight:800}
.tms-top .spacer{width:120px}
.tms-id{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.tms-id .hi{font-size:15px;font-weight:800;color:#1a6fc4}
.tms-id label{font-size:12.5px;font-weight:700;color:#6b7c93}
.tms-id select{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;background:#fff;outline:none;min-width:180px}
.tms-id select:focus{border-color:#1a6fc4}
.tms-ctrl{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}
.tms-nav{display:flex;gap:4px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:3px}
.tms-nav button{padding:7px 14px;border:none;border-radius:7px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;background:transparent;color:#475569;transition:all 120ms}
.tms-nav button:hover:not(.ac){background:#f1f5f9}
.tms-nav button.ac{background:#1a6fc4;color:#fff}
.tms-label{font-size:13px;font-weight:700;color:#1a1a2e;padding:7px 12px;background:#eff6ff;border-radius:8px}
.tms-label .sub{color:#6b7c93;font-weight:600;margin-left:6px}
.tms-spacer{flex:1;min-width:8px}
.tms-cnt{font-size:12.5px;font-weight:700;color:#1a1a2e;padding:6px 10px;background:#f1f5f9;border-radius:8px}
.tms-grid{display:grid;grid-template-columns:repeat(7,minmax(140px,1fr));gap:10px;overflow-x:auto;padding-bottom:4px}
.tms-col{background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:10px;min-height:420px;display:flex;flex-direction:column}
.tms-head{text-align:center;font-size:12px;font-weight:800;padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid #e2e8f0;color:#475569}
.tms-head .day{font-size:11px;color:#94a3b8;font-weight:700;margin-bottom:3px;letter-spacing:0.04em}
.tms-head .date{font-size:14px;color:#1a1a2e}
.tms-head.today .date{display:inline-block;background:#1a6fc4;color:#fff;border-radius:999px;width:26px;height:26px;line-height:26px;text-align:center}
.tms-head.today .day{color:#1a6fc4}
.tms-head.weekend .day{color:#dc2626}
.tms-sess{border-left:4px solid #1a6fc4;border-radius:8px;padding:7px 9px;margin-bottom:6px;background:#f8fafc}
.tms-sess .time{font-size:10.5px;color:#6b7c93;font-weight:700}
.tms-sess .stu{font-size:13px;font-weight:800;color:#1a1a2e;margin-top:2px;line-height:1.3;word-break:keep-all}
.tms-sess .full{font-size:10.5px;color:#94a3b8;font-weight:600;margin-top:1px}
.tms-sess .badges{display:flex;flex-wrap:wrap;gap:3px;margin-top:5px}
.tms-sess .b{display:inline-block;padding:1px 6px;border-radius:4px;font-size:9.5px;font-weight:800;line-height:1.5}
.tms-sess .b-type{background:#eff6ff;color:#1a6fc4}
.tms-empty{text-align:center;color:#cbd5e1;font-size:11px;padding:40px 4px;font-weight:600}
.tms-msg{background:#fff;border-radius:14px;padding:56px 28px;text-align:center;color:#94a3b8;font-size:14px;font-weight:600}
@media(max-width:1100px){.tms-grid{grid-template-columns:repeat(7,minmax(120px,1fr))}}
@media(max-width:800px){.tms-grid{grid-template-columns:repeat(7,140px)}.tms-top h1{font-size:17px}}
    `}</style>

    <div className="tms-w">
      <div className="tms-top">
        <button className="tms-back" onClick={() => router.push("/admin/hub")}>← Admin Home</button>
        <h1>📅 My Tutor Schedule</h1>
        <span className="spacer" />
      </div>

      <div className="tms-id">
        {isMappedTutor ? (
          <span className="hi">안녕하세요, {myTutorName || mappedTutorName}님 👋</span>
        ) : (
          <>
            <label htmlFor="tutorSel">튜터 선택</label>
            <select
              id="tutorSel"
              value={selectedTutorId}
              onChange={e => setSelectedTutorId(e.target.value)}
            >
              <option value="">— 튜터를 선택하세요 —</option>
              {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </>
        )}
      </div>

      {isMappedTutor && !selectedTutorId && tutors.length > 0 ? (
        <div className="tms-msg">튜터 정보를 찾을 수 없습니다 ({mappedTutorName}). 관리자에게 문의하세요.</div>
      ) : !selectedTutorId ? (
        <div className="tms-msg">{isMappedTutor ? "불러오는 중..." : "위에서 튜터를 선택하세요."}</div>
      ) : (<>
        <div className="tms-ctrl">
          <div className="tms-nav" role="group" aria-label="주 네비게이션">
            <button onClick={() => setWeekOffset(o => o - 1)}>◀ 이전 주</button>
            <button className={weekOffset === 0 ? "ac" : ""} onClick={() => setWeekOffset(0)}>이번 주</button>
            <button onClick={() => setWeekOffset(o => o + 1)}>다음 주 ▶</button>
          </div>
          <div className="tms-label">
            {weekLabelKR(weekOffset)}
            <span className="sub">{formatWeekRange(week.startDate, week.endDate)}</span>
          </div>
          <div className="tms-spacer" />
          <div className="tms-cnt">{sessions.length} sessions</div>
        </div>

        {loading ? (
          <div className="tms-msg">로딩 중...</div>
        ) : (
          <div className="tms-grid">
            {week.dates.map((date, i) => {
              const dt = new Date(date + "T00:00:00");
              const isToday = date === today;
              const isWeekend = i === 5 || i === 6;
              const list = byDate.get(date) || [];
              return (
                <div key={date} className="tms-col">
                  <div className={`tms-head${isToday ? " today" : ""}${isWeekend ? " weekend" : ""}`}>
                    <div className="day">{WEEKDAY_EN[i]}</div>
                    <div className="date">{dt.getDate()}</div>
                  </div>
                  {list.length === 0 ? (
                    <div className="tms-empty">No class</div>
                  ) : (
                    list.map(s => {
                      const badge = STATUS_BADGE[s.status] || STATUS_BADGE.scheduled;
                      return (
                        <div key={s.id} className="tms-sess">
                          <div className="time">{resolveTime(s)}</div>
                          <div className="stu" style={badge.strike ? { textDecoration: "line-through", color: "#94a3b8" } : undefined}>
                            {firstStudent(s.lesson.student_names)}
                          </div>
                          {s.lesson.student_names && s.lesson.student_names !== firstStudent(s.lesson.student_names) && (
                            <div className="full">{s.lesson.student_names}</div>
                          )}
                          <div className="badges">
                            <span className="b b-type">{classTypeBase(s.lesson.class_type)}</span>
                            <span className="b" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
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
      </>)}
    </div>
  </>);
}
