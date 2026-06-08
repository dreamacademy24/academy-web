"use client";
import { useState, useEffect, useCallback, Fragment } from "react";
import { toastErr } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatLessonTime } from "@/lib/scheduleBlocks";
import { isLessonDateAllowed } from "@/lib/lessonDates";

interface Tutor { id: string; name: string }
interface Lesson {
  id: string; created_at: string;
  house_or_reserver: string; student_names: string; student_ages: string | null;
  tutor_id: string | null;
  class_type: string; sessions_per_day: number | null; hourly_rate: number;
  start_date: string; end_date: string;
  class_days: string[] | null; class_time: string | null; confirmed_time: string | null;
  total_sessions: number | null; total_amount: number | null;
  status: string;
  skip_dates: string[] | null; tutor_memo: string | null;
  attendance_log: Record<string, "O" | "X" | "△"> | null;
  time_overrides?: Record<string, string> | null;
}
interface SessionRow {
  id: string; lesson_id: string;
  session_date: string; session_idx: number;
  status: string;
  session_time: string | null;
  session_note: string | null;
}
interface Counts { total: number; scheduled: number; attended: number; no_show: number; cancelled: number; rescheduled: number }
interface LessonRow extends Lesson { tutor_name: string | null; counts: Counts }

const DAY_KR: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
const WEEKDAYS_KR = ["일", "월", "화", "수", "목", "금", "토"];

const LESSON_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  active:    { label: "수업중", bg: "#dcfce7", color: "#166534" },
  completed: { label: "완료",   bg: "#dbeafe", color: "#1e40af" },
  suspended: { label: "중단",   bg: "#fef3c7", color: "#92400e" },
  cancelled: { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
};

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

function countStatus(rows: { status: string }[]): Counts {
  const c: Counts = { total: 0, scheduled: 0, attended: 0, no_show: 0, cancelled: 0, rescheduled: 0 };
  for (const s of rows) {
    c.total++;
    if (s.status === "scheduled") c.scheduled++;
    else if (s.status === "attended") c.attended++;
    else if (s.status === "no_show") c.no_show++;
    else if (s.status === "cancelled_by_student" || s.status === "cancelled_by_tutor") c.cancelled++;
    else if (s.status === "rescheduled") c.rescheduled++;
  }
  return c;
}

function fmtMD(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function fmtRange(start: string, end: string): string {
  if (!start || !end) return "-";
  const s = new Date(start + "T00:00:00"), e = new Date(end + "T00:00:00");
  return `${s.getMonth() + 1}/${s.getDate()}~${e.getMonth() + 1}/${e.getDate()}`;
}

export default function TutorLessonList() {
  const router = useRouter();
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tutorFilter, setTutorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [toast, setToast] = useState("");

  const [selectedLesson, setSelectedLesson] = useState<LessonRow | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);

  // 출결 OX△ 입력 상태
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, "O" | "X" | "△" | "">>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  // 인라인 관리 패널 상태 (코멘트 / 하루취소 / 날짜변경)
  const [expandedId, setExpandedId] = useState<string>("");
  const [memoDraft, setMemoDraft] = useState<Record<string, string>>({});
  const [savingLessonId, setSavingLessonId] = useState<string>("");
  const [cancelDate, setCancelDate] = useState<Record<string, string>>({});
  const [changeOld, setChangeOld] = useState<Record<string, string>>({});
  const [changeNew, setChangeNew] = useState<Record<string, string>>({});

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2400);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [tRes, lRes] = await Promise.all([
      supabase.from("tutors").select("id, name").order("name"),
      supabase.from("tutor_lessons").select("*").order("created_at", { ascending: false }),
    ]);
    if (tRes.error) console.error("튜터 조회 실패:", tRes.error);
    if (lRes.error) console.error("수업 조회 실패:", lRes.error);
    const tutorList = (tRes.data || []) as Tutor[];
    const lessonList = (lRes.data || []) as Lesson[];
    setTutors(tutorList);

    const lessonIds = lessonList.map(l => l.id);
    let aggRows: { lesson_id: string; status: string }[] = [];
    if (lessonIds.length > 0) {
      const { data, error } = await supabase
        .from("tutor_lesson_sessions")
        .select("lesson_id, status")
        .in("lesson_id", lessonIds);
      if (error) console.error("회차 집계 실패:", error);
      aggRows = (data || []) as typeof aggRows;
    }
    const grouped = new Map<string, { status: string }[]>();
    for (const id of lessonIds) grouped.set(id, []);
    for (const r of aggRows) grouped.get(r.lesson_id)?.push({ status: r.status });

    const tutorMap = new Map(tutorList.map(t => [t.id, t.name]));
    const rows: LessonRow[] = lessonList.map(l => ({
      ...l,
      tutor_name: l.tutor_id ? (tutorMap.get(l.tutor_id) || null) : null,
      counts: countStatus(grouped.get(l.id) || []),
    }));
    setLessons(rows);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = lessons.filter(l => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (tutorFilter === "__unassigned__") { if (l.tutor_id) return false; }
    else if (tutorFilter !== "all" && l.tutor_id !== tutorFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${l.house_or_reserver} ${l.student_names}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // class_days(요일 array) + start/end + skip_dates 로 자연 수업일 목록 생성
  function generateLessonDates(lesson: LessonRow): string[] {
    if (!lesson.start_date || !lesson.end_date) return [];
    const dayCodes = (lesson.class_days || []).map(d => (d || "").toLowerCase().trim());
    if (dayCodes.length === 0) return [];
    const codeToIdx: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const wanted = new Set(dayCodes.map(c => codeToIdx[c]).filter(i => i !== undefined));
    const skips = new Set(Array.isArray(lesson.skip_dates) ? lesson.skip_dates : []);
    const out: string[] = [];
    const d = new Date(lesson.start_date + "T00:00:00");
    const end = new Date(lesson.end_date + "T00:00:00");
    while (d <= end) {
      if (wanted.has(d.getDay())) {
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (!skips.has(ds) && isLessonDateAllowed(d, ds)) out.push(ds);
      }
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  async function openAttendance(lesson: LessonRow) {
    setSelectedLesson(lesson);
    setSessions([]);
    // 저장된 attendance_log → draft 시드
    const log = (lesson.attendance_log || {}) as Record<string, "O" | "X" | "△">;
    setAttendanceDraft({ ...log });
  }
  function closeAttendance() {
    setSelectedLesson(null);
    setSessions([]);
    setAttendanceDraft({});
  }

  function cycleAttendance(date: string) {
    setAttendanceDraft(prev => {
      const cur = prev[date] || "";
      const next: "O" | "X" | "△" | "" =
        cur === "" ? "O" :
        cur === "O" ? "X" :
        cur === "X" ? "△" :
        "";
      return { ...prev, [date]: next };
    });
  }

  async function saveAttendance() {
    if (!selectedLesson) return;
    // 빈 문자열은 제거, OX△만 저장
    const log: Record<string, "O" | "X" | "△"> = {};
    for (const [k, v] of Object.entries(attendanceDraft)) {
      if (v === "O" || v === "X" || v === "△") log[k] = v;
    }
    setAttendanceSaving(true);
    const { error } = await supabase
      .from("tutor_lessons")
      .update({ attendance_log: log })
      .eq("id", selectedLesson.id);
    setAttendanceSaving(false);
    if (error) { showToast("출결 저장 실패: " + error.message); return; }
    setLessons(ls => ls.map(l => l.id === selectedLesson.id ? { ...l, attendance_log: log } : l));
    setSelectedLesson(sl => sl ? { ...sl, attendance_log: log } : sl);
    showToast("✅ 출결이 저장되었습니다");
  }

  async function refreshLessonCounts(lessonId: string) {
    const { data, error } = await supabase
      .from("tutor_lesson_sessions")
      .select("status")
      .eq("lesson_id", lessonId);
    if (error) { console.error("회차 집계 새로고침 실패:", error); return; }
    const next = countStatus((data || []) as { status: string }[]);
    setLessons(ls => ls.map(l => l.id === lessonId ? { ...l, counts: next } : l));
    setSelectedLesson(sl => sl && sl.id === lessonId ? { ...sl, counts: next } : sl);
  }

  async function updateSessionStatus(sessionId: string, newStatus: string) {
    const prev = sessions;
    setSavingSessionId(sessionId);
    setSessions(ss => ss.map(s => s.id === sessionId ? { ...s, status: newStatus } : s));
    const { error } = await supabase.from("tutor_lesson_sessions").update({ status: newStatus }).eq("id", sessionId);
    setSavingSessionId(null);
    if (error) {
      console.error("상태 변경 실패:", error);
      setSessions(prev);
      showToast("변경 실패: " + error.message);
      return;
    }
    showToast("상태 변경됨");
    if (selectedLesson) await refreshLessonCounts(selectedLesson.id);
  }

  // ── 인라인 관리 액션 ──
  async function saveMemo(lessonId: string) {
    setSavingLessonId(lessonId);
    const { error } = await supabase.from("tutor_lessons")
      .update({ tutor_memo: memoDraft[lessonId] ?? null })
      .eq("id", lessonId);
    setSavingLessonId("");
    if (error) { showToast("코멘트 저장 실패: " + error.message); return; }
    setLessons(ls => ls.map(l => l.id === lessonId ? { ...l, tutor_memo: memoDraft[lessonId] ?? null } : l));
    showToast("✅ 코멘트가 저장되었습니다");
  }
  async function cancelOneDate(lesson: LessonRow) {
    const d = (cancelDate[lesson.id] || "").trim();
    if (!d) { showToast("취소할 날짜를 선택해주세요"); return; }
    const current: string[] = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
    if (current.includes(d)) { showToast("이미 취소된 날짜입니다"); return; }
    setSavingLessonId(lesson.id);
    const nextSkips = [...current, d];
    const { error } = await supabase.from("tutor_lessons")
      .update({ skip_dates: nextSkips }).eq("id", lesson.id);
    setSavingLessonId("");
    if (error) { showToast("취소 실패: " + error.message); return; }
    setCancelDate(prev => ({ ...prev, [lesson.id]: "" }));
    setLessons(ls => ls.map(l => l.id === lesson.id ? { ...l, skip_dates: nextSkips } : l));
    showToast(`✅ ${d} 수업이 취소되었습니다`);
  }
  async function rescheduleDate(lesson: LessonRow) {
    const oldD = (changeOld[lesson.id] || "").trim();
    const newD = (changeNew[lesson.id] || "").trim();
    if (!oldD || !newD) { showToast("기존/새 날짜를 모두 선택해주세요"); return; }
    if (oldD === newD) { showToast("기존 날짜와 새 날짜가 같습니다"); return; }
    const current: string[] = Array.isArray(lesson.skip_dates) ? lesson.skip_dates : [];
    const nextSkips = current.includes(oldD) ? current : [...current, oldD];
    const note = `변경: ${oldD}→${newD}`;
    const nextMemo = lesson.tutor_memo ? `${lesson.tutor_memo}\n${note}` : note;
    setSavingLessonId(lesson.id);
    const { error } = await supabase.from("tutor_lessons")
      .update({ skip_dates: nextSkips, tutor_memo: nextMemo }).eq("id", lesson.id);
    setSavingLessonId("");
    if (error) { showToast("변경 실패: " + error.message); return; }
    setChangeOld(prev => ({ ...prev, [lesson.id]: "" }));
    setChangeNew(prev => ({ ...prev, [lesson.id]: "" }));
    setLessons(ls => ls.map(l => l.id === lesson.id ? { ...l, skip_dates: nextSkips, tutor_memo: nextMemo } : l));
    showToast(`✅ ${oldD} → ${newD} 변경 기록`);
  }

  async function deleteLesson(lessonId: string) {
    if (!confirm("이 수업을 삭제할까요? 되돌릴 수 없습니다")) return;
    setSavingLessonId(lessonId);
    const { error } = await supabase.from("tutor_lessons").delete().eq("id", lessonId);
    setSavingLessonId("");
    if (error) { toastErr("삭제 실패: " + error.message); return; }
    setLessons(ls => ls.filter(l => l.id !== lessonId));
    if (expandedId === lessonId) setExpandedId("");
    showToast("🗑 수업이 삭제되었습니다");
  }

  async function updateSessionNote(sessionId: string, note: string) {
    setSavingSessionId(sessionId);
    const { error } = await supabase.from("tutor_lesson_sessions").update({ session_note: note || null }).eq("id", sessionId);
    setSavingSessionId(null);
    if (error) {
      console.error("노트 저장 실패:", error);
      showToast("노트 저장 실패: " + error.message);
      return;
    }
    setSessions(ss => ss.map(s => s.id === sessionId ? { ...s, session_note: note || null } : s));
    showToast("노트 저장됨");
  }

  return (<>
    <style>{`
.tll-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}
.tll-toolbar input,.tll-toolbar select{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff}
.tll-toolbar input{flex:1;min-width:200px}
.tll-toolbar select{min-width:150px}
.tll-toolbar .cnt{margin-left:auto;font-size:12.5px;color:#475569;font-weight:700;padding:6px 10px;background:#eff6ff;border-radius:8px}

.tll-card{background:#fff;border-radius:14px;padding:14px;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow-x:auto;border:1px solid #f3f4f6}
.tll-tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:1100px}
.tll-tbl th{background:#f8fafc;padding:10px 10px;text-align:left;font-weight:700;font-size:11.5px;color:#6b7c93;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.tll-tbl td{padding:10px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.tll-tbl tr:hover td{background:#eff6ff}

.tll-badge-type{display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700}
.tll-type-11{background:#1a6fc4;color:#fff}
.tll-type-12{background:#dbeafe;color:#1e40af}
.tll-badge-time{display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:800}
.tll-time-1{background:#f1f5f9;color:#475569}
.tll-time-2{background:#dbeafe;color:#1e40af}
.tll-badge{display:inline-block;padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700}
.tll-chip-remain{display:inline-block;padding:3px 10px;background:#dcfce7;color:#166534;border-radius:999px;font-size:11.5px;font-weight:800;min-width:28px;text-align:center}
.tll-muted{color:#94a3b8;font-style:italic}

.tll-act-btn{padding:5px 10px;border:1px solid #e2e8f0;background:#fff;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;margin-right:4px;transition:all 120ms}
.tll-act-btn:hover:not(:disabled){background:#f1f5f9;border-color:#cbd5e1}
.tll-act-btn.primary{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.tll-act-btn.primary:hover:not(:disabled){background:#155aa0;border-color:#155aa0}
.tll-act-btn:disabled{background:#f8fafc;color:#cbd5e1;cursor:not-allowed;border-color:#e2e8f0}

.tll-empty{text-align:center;padding:52px 20px;color:#94a3b8;font-size:13.5px;line-height:1.9;white-space:pre-line}
.tll-loading{text-align:center;padding:40px;color:#94a3b8;font-size:13px}

.tll-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 22px;border-radius:10px;font-size:13.5px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,0.18);z-index:300;animation:tllToastIn 250ms ease-out}
@keyframes tllToastIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}

.tll-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:200;padding:24px}
.tll-m{background:#fff;border-radius:16px;width:100%;max-width:820px;max-height:88vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
.tll-m-head{position:sticky;top:0;background:#fff;padding:16px 22px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:10px;z-index:2}
.tll-m-head h3{font-size:15.5px;font-weight:800;margin:0}
.tll-m-head h3 .sub{font-size:11.5px;color:#6b7c93;font-weight:600;margin-left:8px}
.tll-close{background:none;border:none;font-size:22px;cursor:pointer;color:#6b7c93;padding:4px 10px;border-radius:6px;line-height:1}.tll-close:hover{background:#f1f5f9;color:#1a1a2e}

.tll-m-sum{display:flex;flex-wrap:wrap;gap:8px;padding:14px 22px;border-bottom:1px solid #e2e8f0;background:#f8fafc}
.tll-m-sum .s{padding:6px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:700;color:#475569;display:flex;align-items:center;gap:6px}
.tll-m-sum .s b{font-size:13px;color:#1a1a2e}

.tll-m-body{padding:4px 0 16px}
.tll-srow{display:grid;grid-template-columns:50px 140px 90px 130px 1fr;gap:10px;align-items:center;padding:10px 22px;border-bottom:1px solid #f1f5f9}
.tll-srow:hover{background:#f8fafc}
.tll-srow .idx{font-weight:800;color:#1a6fc4;font-size:12.5px}
.tll-srow .dt{font-size:12.5px;color:#475569;white-space:nowrap}
.tll-srow .tm{font-size:12px;color:#6b7c93;white-space:nowrap}
.tll-srow select{padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:inherit;background:#fff;width:100%;outline:none}
.tll-srow select:focus{border-color:#1a6fc4}
.tll-srow input{padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:inherit;background:#fff;width:100%;outline:none}
.tll-srow input:focus{border-color:#1a6fc4}

@media(max-width:900px){
  .tll-tbl{min-width:auto}
  .tll-tbl th:nth-child(8),.tll-tbl td:nth-child(8),
  .tll-tbl th:nth-child(10),.tll-tbl td:nth-child(10){display:none}
}
@media(max-width:700px){
  .tll-toolbar input{min-width:140px}
  .tll-toolbar .cnt{margin-left:0}
  .tll-srow{grid-template-columns:40px 1fr 110px;row-gap:6px}
  .tll-srow .tm{display:none}
  .tll-srow input{grid-column:1 / -1}
}
    `}</style>

    <div className="tll-toolbar">
      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="학생명 또는 예약자명 검색"
        aria-label="검색"
      />
      <select value={tutorFilter} onChange={e => setTutorFilter(e.target.value)} aria-label="튜터 필터">
        <option value="all">전체 튜터</option>
        <option value="__unassigned__">(미배정)</option>
        {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="상태 필터">
        <option value="all">전체 상태</option>
        <option value="active">수업중</option>
        <option value="completed">완료</option>
        <option value="suspended">중단</option>
        <option value="cancelled">취소</option>
      </select>
      <div className="cnt">{filtered.length}건</div>
    </div>

    <div className="tll-card">
      {loading ? (
        <div className="tll-loading">로딩 중...</div>
      ) : filtered.length === 0 ? (
        lessons.length === 0 ? (
          <div className="tll-empty">📭 확정된 수업이 없습니다{"\n"}신청 수신함에서 상태를 &apos;확정&apos;으로 변경하면{"\n"}여기에 자동으로 수강생이 등록됩니다</div>
        ) : (
          <div className="tll-empty">필터 조건에 맞는 수강생이 없습니다</div>
        )
      ) : (
        <table className="tll-tbl">
          <thead>
            <tr>
              <th>접수</th>
              <th>예약자</th>
              <th>수강자</th>
              <th>담당 T</th>
              <th>유형</th>
              <th>타임</th>
              <th>요일</th>
              <th>시간</th>
              <th>기간</th>
              <th style={{ textAlign: "center" }}>회차</th>
              <th style={{ textAlign: "center" }}>잔여</th>
              <th>상태</th>
              <th style={{ textAlign: "center" }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const st = LESSON_STATUS[l.status] || LESSON_STATUS.active;
              const typeMatch = (l.class_type || "").match(/1\s*[:：]\s*[12]/);
              const typeBase = typeMatch ? typeMatch[0].replace(/\s+/g, "") : (l.class_type || "-");
              const isType11 = typeBase.includes("1:1");
              const daysStr = (l.class_days || []).map(d => DAY_KR[d] || d).join("/");
              const totalDisplay = l.total_sessions ?? l.counts.total;
              const skips: string[] = Array.isArray(l.skip_dates) ? l.skip_dates : [];
              const totalNum = Number(l.total_sessions || l.counts.total || 0);
              // skip_dates 기준 잔여 (총회차 - 취소된 날짜 수). 0 미만 방지.
              const remaining = totalNum > 0 ? Math.max(0, totalNum - skips.length) : l.counts.scheduled;
              const expanded = expandedId === l.id;
              return (
                <Fragment key={l.id}>
                  <tr>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "#6b7c93" }}>{fmtMD(l.created_at)}</td>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{l.house_or_reserver}</td>
                    <td style={{ fontWeight: 700 }}>{l.student_names}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {l.tutor_name ? l.tutor_name : <span className="tll-muted">(미배정)</span>}
                    </td>
                    <td><span className={`tll-badge-type ${isType11 ? "tll-type-11" : "tll-type-12"}`}>{typeBase}</span></td>
                    <td>
                      <span className={`tll-badge-time ${l.sessions_per_day === 2 ? "tll-time-2" : "tll-time-1"}`}>
                        {l.sessions_per_day === 2 ? "2T (100m)" : "1T (50m)"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{daysStr || "-"}</td>
                    <td style={{ fontSize: 12, lineHeight: 1.3 }}>
                      {(() => {
                        const formatted = formatLessonTime(l.confirmed_time || l.class_time, l.time_overrides, l.class_days, 'ko');
                        const isFallback = !l.confirmed_time;
                        if (formatted === '-' || formatted === (l.confirmed_time || l.class_time)) {
                          return l.confirmed_time
                            ? l.confirmed_time
                            : (l.class_time ? <span className="tll-muted">{l.class_time}</span> : "-");
                        }
                        return <span className={isFallback ? "tll-muted" : ""}>{formatted}</span>;
                      })()}
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtRange(l.start_date, l.end_date)}</td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{totalDisplay}</td>
                    <td style={{ textAlign: "center" }}>
                      <span className="tll-chip-remain" title={skips.length > 0 ? `취소 ${skips.length}건 제외` : ""}>{remaining}</span>
                      {skips.length > 0 && <div style={{ fontSize: 10, color: "#dc2626", fontWeight: 700, marginTop: 2 }}>취소 {skips.length}</div>}
                    </td>
                    <td><span className="tll-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      <button className="tll-act-btn primary" onClick={() => router.push(`/admin/tutor-class/${l.id}/attendance`)}>출결</button>
                      <button
                        className="tll-act-btn"
                        onClick={() => {
                          setExpandedId(expanded ? "" : l.id);
                          if (!expanded) setMemoDraft(prev => ({ ...prev, [l.id]: l.tutor_memo || "" }));
                        }}
                        title="코멘트 / 하루 취소 / 날짜 변경"
                        style={expanded ? { background: "#1a6fc4", color: "#fff", borderColor: "#1a6fc4" } : undefined}
                      >
                        {expanded ? "▲ 닫기" : "🗒 관리"}
                      </button>
                      <button
                        className="tll-act-btn"
                        onClick={() => router.push("/admin/tutor-class?tab=invoice&lesson_id=" + l.id)}
                        title="인보이스 보기"
                      >
                        인보이스
                      </button>
                      <button
                        className="tll-act-btn"
                        onClick={() => deleteLesson(l.id)}
                        disabled={savingLessonId === l.id}
                        title="이 수업 행 삭제 (되돌릴 수 없음)"
                        style={{ background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={13} style={{ background: "#f8fafc", padding: "14px 16px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                          {/* 코멘트 */}
                          <div style={{ background: "#fff", borderRadius: 9, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#1a6fc4", marginBottom: 8 }}>🗒 튜터 코멘트 (tutor_memo)</div>
                            <textarea
                              value={memoDraft[l.id] ?? (l.tutor_memo || "")}
                              onChange={e => setMemoDraft(prev => ({ ...prev, [l.id]: e.target.value }))}
                              placeholder="수업 진행 관련 메모..."
                              style={{ width: "100%", minHeight: 80, padding: "9px 11px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", outline: "none", resize: "vertical" }}
                            />
                            <button
                              onClick={() => saveMemo(l.id)}
                              disabled={savingLessonId === l.id}
                              style={{ marginTop: 8, padding: "7px 14px", border: "none", borderRadius: 7, background: "#1a6fc4", color: "#fff", fontWeight: 700, fontSize: 12, cursor: savingLessonId === l.id ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                            >💾 {savingLessonId === l.id ? "저장중..." : "코멘트 저장"}</button>
                          </div>

                          {/* 하루 취소 */}
                          <div style={{ background: "#fff", borderRadius: 9, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#dc2626", marginBottom: 8 }}>❌ 하루 취소 (skip_dates 추가)</div>
                            <input
                              type="date"
                              value={cancelDate[l.id] || ""}
                              min={l.start_date || undefined}
                              max={l.end_date || undefined}
                              onChange={e => setCancelDate(prev => ({ ...prev, [l.id]: e.target.value }))}
                              style={{ width: "100%", padding: "8px 11px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", outline: "none" }}
                            />
                            <button
                              onClick={() => cancelOneDate(l)}
                              disabled={savingLessonId === l.id || !cancelDate[l.id]}
                              style={{ marginTop: 8, padding: "7px 14px", border: "none", borderRadius: 7, background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 12, cursor: (savingLessonId === l.id || !cancelDate[l.id]) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (savingLessonId === l.id || !cancelDate[l.id]) ? 0.6 : 1 }}
                            >취소 처리</button>
                            {skips.length > 0 && (
                              <div style={{ marginTop: 10, fontSize: 11, color: "#475569" }}>
                                <div style={{ fontWeight: 700, marginBottom: 3 }}>취소된 날짜 ({skips.length})</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {skips.map(d => (
                                    <span key={d} style={{ padding: "2px 7px", borderRadius: 5, background: "#fef2f2", color: "#b91c1c", fontSize: 10.5, fontWeight: 700 }}>{d}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 날짜 변경 */}
                          <div style={{ gridColumn: "1 / span 2", background: "#fff", borderRadius: 9, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginBottom: 8 }}>🔄 날짜 변경 (skip_dates + tutor_memo 기록)</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                              <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "flex", flexDirection: "column", gap: 3 }}>
                                원래 날짜
                                <input
                                  type="date"
                                  value={changeOld[l.id] || ""}
                                  min={l.start_date || undefined}
                                  max={l.end_date || undefined}
                                  onChange={e => setChangeOld(prev => ({ ...prev, [l.id]: e.target.value }))}
                                  style={{ padding: "8px 11px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", outline: "none" }}
                                />
                              </label>
                              <span style={{ fontSize: 18, color: "#94a3b8", paddingBottom: 6 }}>→</span>
                              <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "flex", flexDirection: "column", gap: 3 }}>
                                새 날짜
                                <input
                                  type="date"
                                  value={changeNew[l.id] || ""}
                                  onChange={e => setChangeNew(prev => ({ ...prev, [l.id]: e.target.value }))}
                                  style={{ padding: "8px 11px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", outline: "none" }}
                                />
                              </label>
                              <button
                                onClick={() => rescheduleDate(l)}
                                disabled={savingLessonId === l.id || !changeOld[l.id] || !changeNew[l.id]}
                                style={{ padding: "8px 14px", border: "none", borderRadius: 7, background: "#f59e0b", color: "#fff", fontWeight: 700, fontSize: 12, cursor: (savingLessonId === l.id || !changeOld[l.id] || !changeNew[l.id]) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (savingLessonId === l.id || !changeOld[l.id] || !changeNew[l.id]) ? 0.6 : 1 }}
                              >변경 기록</button>
                            </div>
                            <div style={{ marginTop: 8, fontSize: 10.5, color: "#94a3b8" }}>※ 원래 날짜는 skip_dates에 추가되고, tutor_memo에 “변경: 원래→새” 한 줄이 append됩니다.</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>

    {selectedLesson && (() => {
      const dates = generateLessonDates(selectedLesson);
      const counts = { O: 0, X: 0, T: 0 }; // T = △
      for (const d of dates) {
        const v = attendanceDraft[d];
        if (v === "O") counts.O++;
        else if (v === "X") counts.X++;
        else if (v === "△") counts.T++;
      }
      const baseTotal = dates.length;
      const total = baseTotal + counts.T; // △는 총회차 +1 연장
      const remaining = total - counts.O - counts.X - counts.T;
      return (
        <div className="tll-overlay" onClick={closeAttendance}>
          <div className="tll-m" onClick={e => e.stopPropagation()}>
            <div className="tll-m-head">
              <h3>
                📋 {selectedLesson.house_or_reserver} · {selectedLesson.student_names}
                <span className="sub">{selectedLesson.tutor_name || "(미배정)"}</span>
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={saveAttendance}
                  disabled={attendanceSaving}
                  style={{ padding: "8px 16px", border: "none", borderRadius: 7, background: "#1a6fc4", color: "#fff", fontSize: 13, fontWeight: 700, cursor: attendanceSaving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: attendanceSaving ? 0.6 : 1 }}
                >💾 {attendanceSaving ? "저장중..." : "저장"}</button>
                <button className="tll-close" onClick={closeAttendance} aria-label="닫기">✕</button>
              </div>
            </div>

            <div className="tll-m-sum">
              <div className="s">총 <b>{total}회</b></div>
              <div className="s">O 출석 <b style={{ color: "#166534" }}>{counts.O}</b></div>
              <div className="s">X 결석 <b style={{ color: "#dc2626" }}>{counts.X}</b></div>
              <div className="s">△ 메이크업 <b style={{ color: "#c2410c" }}>{counts.T}</b></div>
              <div className="s">남은 <b style={{ color: "#1a6fc4" }}>{remaining}회</b></div>
            </div>

            <div className="tll-m-body" style={{ padding: "14px 22px" }}>
              {dates.length === 0 ? (
                <div className="tll-empty">생성할 수업일이 없습니다 (start/end + class_days 확인)</div>
              ) : (
                <>
                  <div style={{ fontSize: 11.5, color: "#6b7c93", marginBottom: 10, lineHeight: 1.6 }}>
                    박스 클릭으로 출결 순환: <b style={{ color: "#94a3b8" }}>빈칸</b> → <b style={{ color: "#166534" }}>O 출석</b> → <b style={{ color: "#dc2626" }}>X 결석</b> → <b style={{ color: "#c2410c" }}>△ 메이크업</b> → 빈칸
                    <br />
                    <span style={{ fontSize: 10.5, color: "#94a3b8" }}>△ 표시는 총 회차를 +1 연장합니다. 저장 버튼으로 일괄 DB 업데이트.</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 8 }}>
                    {dates.map((d, i) => {
                      const dt = new Date(d + "T00:00:00");
                      const md = `${dt.getMonth() + 1}/${dt.getDate()}`;
                      const dayStr = WEEKDAYS_KR[dt.getDay()];
                      const v = attendanceDraft[d] || "";
                      const cfg =
                        v === "O" ? { bg: "#dcfce7", color: "#15803d", border: "#86efac" } :
                        v === "X" ? { bg: "#fef2f2", color: "#b91c1c", border: "#fca5a5" } :
                        v === "△" ? { bg: "#fff7ed", color: "#c2410c", border: "#fdba74" } :
                        { bg: "#fff", color: "#94a3b8", border: "#e2e8f0" };
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => cycleAttendance(d)}
                          title={`${d} (${dayStr}) — ${v || "빈칸"}`}
                          style={{
                            padding: "10px 6px",
                            background: cfg.bg,
                            color: cfg.color,
                            border: `1.5px solid ${cfg.border}`,
                            borderRadius: 9,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 3,
                            transition: "all 120ms",
                          }}
                        >
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#6b7c93" }}>{i + 1}회</span>
                          <span style={{ fontSize: 12.5, fontWeight: 800 }}>{md}<span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", marginLeft: 3 }}>({dayStr})</span></span>
                          <span style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, minHeight: 22 }}>{v || ""}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      );
    })()}

    {toast && <div className="tll-toast" role="status" aria-live="polite">{toast}</div>}
  </>);
}
