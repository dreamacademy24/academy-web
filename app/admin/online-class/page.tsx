"use client";
import { getTutorColor } from "@/lib/tutorColors";
import { useState, useEffect, useCallback, useRef } from "react";
import { toastOk, toastErr } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { fetchDeployedHolidays } from "@/lib/holidays";
import { buildOnlineSessionDates } from "@/lib/onlineClassSchedule";

interface Tutor { id: string; name_display: string; name_en: string }
interface Enrollment {
  id: string; student_name: string; student_name_en: string | null;
  student_birth_year: string | null; tutor_id: string | null;
  customer_user_id?: string | null;
  tutor: Tutor | null;
  enrollment_type: string; level: string | null;
  days_of_week: string[]; class_time_kr: string | null; class_time_ph: string | null;
  start_date: string; end_date: string | null;
  duration_weeks: number | null; class_duration_weeks: number | null;
  class_period: string; sessions_per_week: number;
  total_sessions: number; pre_sessions: number; post_sessions: number;
  used_sessions: number; remaining_sessions: number | null;
  status: string; notes: string | null;
  portal_open?: boolean | null;
}
interface Session {
  id: string; enrollment_id: string; session_number: number;
  scheduled_date: string; scheduled_time_ph: string | null; scheduled_time_kr: string | null;
  status: string; is_makeup_added: boolean; note: string | null;
  session_note: string | null;
  attitude?: string | null; attitude_note?: string | null;
  cancel_days_before?: number | null;
}

const STATUS_LABEL: Record<string, string> = { active: "수업중", completed: "완료", paused: "일시중지" };
const STATUS_BG: Record<string, string> = { active: "#dcfce7", completed: "#f1f5f9", paused: "#fef3c7" };
const STATUS_COLOR: Record<string, string> = { active: "#166534", completed: "#64748b", paused: "#92400e" };

const DAY_KR: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일", "월": "월", "화": "화", "수": "수", "목": "목", "금": "금", "토": "토" };
function daysToKr(days: string[]) { return (days || []).map(d => DAY_KR[d.toLowerCase()] || d).join("/"); }

const SES_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  scheduled:  { label: "-",  bg: "#f1f5f9", color: "#94a3b8" },
  attended:   { label: "O",  bg: "#dcfce7", color: "#166534" },
  absent:     { label: "X",  bg: "#fef2f2", color: "#dc2626" },
  no_show:    { label: "X",  bg: "#fef2f2", color: "#dc2626" },
  cancelled:  { label: "X",  bg: "#fef2f2", color: "#dc2626" },
  makeup:     { label: "△", bg: "#fef9c3", color: "#92400e" },
};

const DAYS = ["월", "화", "수", "목", "금"]; // 평일만 (2026-08 개편)

// 수업 시간 선택 모달용 — KR 14:00~21:30 시작 (세부 13:00~20:30, 마지막 수업 KR 21:30, 2026-09 확정)
const TIME_SLOTS: string[] = [];
for (let h = 14; h <= 21; h++) {
  TIME_SLOTS.push(`${h}:00`);
  TIME_SLOTS.push(`${h}:30`);
}
function subtractHour(t: string): string {
  if (!t || !/^\d{1,2}:\d{2}/.test(t)) return "";
  {
  const [h, m] = t.split(":").map(Number);
  return `${String((h + 23) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
}

const _DAY_ENG2KR: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
function normDays(days: string[] | null | undefined): string[] {
  return [...new Set((days || []).map(d => _DAY_ENG2KR[String(d).toLowerCase()] || d))];
}
// 기간 컬럼 헬퍼
function fmtMD(dateStr: string): string {
  if (!dateStr) return "?";
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function PeriodCell({ e }: { e: Enrollment }) {
  const sd = e.start_date || "";
  const ed = e.end_date || "";
  const today = new Date().toISOString().slice(0, 10);
  const isNow = sd && sd <= today && (!ed || ed >= today);
  const stays: { from: string; to: string }[] = (e as any).stays || [];
  const nowBadge = <span style={{ marginLeft: 3, fontSize: 9, fontWeight: 800, color: "#059669", background: "#d1fae5", padding: "1px 5px", borderRadius: 6 }}>현재</span>;
  return (
    <div style={{ lineHeight: 1.7, whiteSpace: "nowrap" }}>
      <div>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#1d4ed8", background: "#dbeafe", padding: "1px 5px", borderRadius: 4, marginRight: 4 }}>화상</span>
        <span style={{ fontSize: 11 }}>{fmtMD(sd)}~{ed ? fmtMD(ed) : "?"}</span>{isNow && nowBadge}
      </div>
      {stays.slice(0, 2).map((st, i) => (
        <div key={i}>
          <span style={{ fontSize: 10, fontWeight: 800, color: "#b45309", background: "#fef3c7", padding: "1px 5px", borderRadius: 4, marginRight: 4 }}>연수</span>
          <span style={{ fontSize: 11, color: "#64748b" }}>{fmtMD(st.from)}~{fmtMD(st.to)}</span>
          {today >= st.from && today <= st.to && nowBadge}
        </div>
      ))}
    </div>
  );
}

export default function OnlineClassPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"list" | "register" | "requests" | "targets" | "weekly">("targets");
  const [targets, setTargets] = useState<any[]>([]);
  const [tgQ, setTgQ] = useState("");
  const [tgShowExcluded, setTgShowExcluded] = useState(false);
  const [wkOffset, setWkOffset] = useState(0);
  const [wkSessions, setWkSessions] = useState<any[]>([]);
  const [wkLoading, setWkLoading] = useState(false);
  useEffect(() => {
    if (tab !== "weekly") return;
    const now = new Date(); const dow = (now.getDay() + 6) % 7; // 월=0
    const mon = new Date(now); mon.setDate(now.getDate() - dow + wkOffset * 7);
    const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const sat = new Date(mon); sat.setDate(mon.getDate() + 5);
    setWkLoading(true);
    fetch(`/api/online-class/sessions?start=${f(mon)}&end=${f(sat)}`).then(r => r.ok ? r.json() : { sessions: [] })
      .then((d: any) => setWkSessions(d.sessions || [])).catch(() => {}).finally(() => setWkLoading(false));
  }, [tab, wkOffset]);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());
  useEffect(() => { fetch("/api/online-class/confirm").then(r => r.ok ? r.json() : {}).then((d: any) => { setConfirmedIds(new Set<string>(d.confirm || d.ids || [])); setClosedIds(new Set<string>(d.close || [])); }).catch(() => {}); }, []);
  async function toggleClose(id: string) {
    const on = !closedIds.has(id);
    const r = await fetch("/api/online-class/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, on, kind: "close" }) });
    if (r.ok) setClosedIds(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });
  }
  async function toggleConfirm(id: string) {
    const on = !confirmedIds.has(id);
    const r = await fetch("/api/online-class/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, on }) });
    if (r.ok) setConfirmedIds(prev => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n; });
  }

  // 변경요청 수신함
  const [changeReqs, setChangeReqs] = useState<any[]>([]);
  const [reqFilter, setReqFilter] = useState<"pending" | "all">("pending");
  const [reqProcessing, setReqProcessing] = useState<string | null>(null);

  // list tab
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [holidaySet, setHolidaySet] = useState<Set<string>>(new Set());
  useEffect(() => { fetchDeployedHolidays().then(h => setHolidaySet(new Set((h || []).map(x => x.date)))).catch(() => {}); }, []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tutorFilter, setTutorFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "current" | "upcoming" | "past">("current");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 출석부(한눈에) 뷰
  const [listMode, setListMode] = useState<"list" | "sheet">("list");
  const [sheetMonth, setSheetMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [sheetSessions, setSheetSessions] = useState<any[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  // 손님 계정 검색 모달
  const [acctModal, setAcctModal] = useState<null | "form" | "edit">(null);
  const [acctQ, setAcctQ] = useState("");
  const [acctResults, setAcctResults] = useState<any[]>([]);
  const [acctLoading, setAcctLoading] = useState(false);
  const [acctLabels, setAcctLabels] = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ session: Session; daysBefore: number } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [editTarget, setEditTarget] = useState<Enrollment | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [editSaving, setEditSaving] = useState(false);

  // 시간 선택 모달
  const [tpShow, setTpShow] = useState(false);
  const [tpLabel, setTpLabel] = useState("");
  const tpCb = useRef<((time: string) => void) | null>(null);
  async function loadSheet(month: string) {
    setSheetLoading(true);
    try {
      const [y, m] = month.split("-").map(Number);
      const last = new Date(y, m, 0).getDate();
      const res = await fetch(`/api/online-class/sessions?start=${month}-01&end=${month}-${String(last).padStart(2, "0")}`);
      if (res.ok) { const d = await res.json(); setSheetSessions(d.sessions || []); }
    } finally { setSheetLoading(false); }
  }
  function shiftSheetMonth(diff: number) {
    const [y, m] = sheetMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + diff, 1);
    const nm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setSheetMonth(nm); loadSheet(nm);
  }
  async function searchAccounts() {
    const q = acctQ.trim();
    if (q.length < 2) return;
    setAcctLoading(true);
    try {
      const res = await fetch(`/api/admin/portal-users?q=${encodeURIComponent(q)}`);
      const d = await res.json();
      setAcctResults(d.users || []);
    } finally { setAcctLoading(false); }
  }
  function pickAccount(u: { id: string; username?: string; name?: string }) {
    const label = `${u.name || "?"} (${u.username || u.id.slice(0, 8)})`;
    setAcctLabels(prev => ({ ...prev, [u.id]: label }));
    if (acctModal === "form") setForm(f => ({ ...f, customer_user_id: u.id, portal_open: true }));
    if (acctModal === "edit") setEditForm(f => ({ ...f, customer_user_id: u.id, portal_open: true }));
    setAcctModal(null); setAcctQ(""); setAcctResults([]);
  }
  function openTimePicker(label: string, cb: (time: string) => void) {
    setTpLabel(label);
    tpCb.current = cb;
    setTpShow(true);
  }
  function selectTime(time: string) {
    tpCb.current?.(time);
    setTpShow(false);
  }

  // register tab
  const [periodTag, setPeriodTag] = useState<"standalone" | "pre" | "post">("standalone"); // 시기 구분 (등록 1건 = 수강권 1개)
  const [dayTimesOn, setDayTimesOn] = useState(false); // 요일별 시간 다르게
  const [dayTimes, setDayTimes] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    student_name: "", student_name_en: "", student_birth_year: "", customer_user_id: "",
    portal_open: false,
    tutor_id: "", enrollment_type: "free_package", level: "",
    days_of_week: [] as string[],
    class_time_kr: "", class_time_ph: "",
    start_date: "", end_date: "", duration_weeks: "", class_duration_weeks: "",
    class_period: "post", sessions_per_week: "3",
    pre_sessions: "0", post_sessions: "0", total_sessions: "0",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  const loadEnrollments = useCallback(async () => {
    const res = await fetch("/api/online-class/enrollments?include_stays=1");
    if (res.ok) { const d = await res.json(); setEnrollments(d.enrollments || []); }
  }, []);

  const loadTutors = useCallback(async () => {
    const res = await fetch("/api/online-class/tutors");
    if (res.ok) { const d = await res.json(); setTutors(d.tutors || []); }
  }, []);

  const loadTargets = useCallback(async () => {
    const res = await fetch("/api/online-class/targets");
    if (res.ok) { const d = await res.json(); setTargets(d.targets || []); }
  }, []);
  useEffect(() => { if (tab === "targets" && targets.length === 0) loadTargets(); }, [tab, targets.length, loadTargets]);

  async function toggleTarget(key: string, excluded: boolean) {
    const res = await fetch("/api/online-class/targets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: excluded ? "restore" : "exclude", key }) });
    if (res.ok) setTargets(prev => prev.map(t => t.key === key ? { ...t, excluded: !excluded } : t));
  }
  function registerFromTarget(t: any) {
    setForm((f: any) => ({ ...f, student_name: t.name_kr, student_name_en: t.name_en || "", student_birth_year: t.birth || "", customer_user_id: t.portal_user_id || "" }));
    setTab("register");
  }

  const loadChangeReqs = useCallback(async () => {
    const res = await fetch("/api/online-class/change-requests");
    if (res.ok) { const d = await res.json(); setChangeReqs(d.requests || []); }
  }, []);

  useEffect(() => { if (authed) { loadEnrollments(); loadTutors(); loadChangeReqs(); } }, [authed, loadEnrollments, loadTutors, loadChangeReqs]);

  async function processReq(id: string, action: "approve" | "reject") {
    let admin_note: string | null = null;
    if (action === "reject") {
      admin_note = window.prompt("거절 사유 (엄마 포털에 표시됩니다)") || null;
      if (admin_note === null) return;
    } else {
      if (!window.confirm("최종 승인하면 실제 수업 일정이 변경됩니다 (1회차=해당 수업 이동 / 전체=적용일 이후 재생성). 진행할까요?")) return;
    }
    setReqProcessing(id);
    const res = await fetch("/api/online-class/change-requests", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, admin_note }),
    });
    const r = await res.json();
    setReqProcessing(null);
    if (!res.ok) { toastErr(r.error || "처리 실패"); return; }
    toastOk(action === "approve" ? `승인 완료 — 세션 ${r.regenerated}개 재생성, 튜터 알림 전송됨 ✅` : "거절 처리됨");
    loadChangeReqs(); loadEnrollments();
  }


  // auto-calc duration
  useEffect(() => {
    if (form.start_date && form.end_date) {
      const diff = Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (7 * 24 * 60 * 60 * 1000));
      setForm(f => ({ ...f, duration_weeks: String(diff > 0 ? diff : "") }));
    }
  }, [form.start_date, form.end_date]);

  async function loadSessions(enrollmentId: string) {
    setExpandedId(enrollmentId);
    setSessionsLoading(true);
    const res = await fetch(`/api/online-class/sessions?enrollment_id=${enrollmentId}`);
    if (res.ok) { const d = await res.json(); setSessions(d.sessions || []); }
    setSessionsLoading(false);
  }

  async function deleteEnrollment(e: Enrollment) {
    const label = `${e.student_name} (${e.student_name_en || ""})`;
    if (!window.confirm(`정말 삭제하시겠습니까?\n\n${label}\n기간: ${e.start_date} ~ ${e.end_date || "미정"}\n\n⚠️ 연결된 출결 세션·변경요청·알림이 모두 삭제됩니다.`)) return;
    const res = await fetch(`/api/online-class/enrollments/${e.id}`, { method: "DELETE" });
    if (!res.ok) { const r = await res.json().catch(() => ({})); toastErr(r.error || "삭제 실패"); return; }
    toastOk(`${e.student_name} 수강 삭제 완료`);
    if (expandedId === e.id) { setExpandedId(null); setSessions([]); }
    loadEnrollments(); loadChangeReqs();
  }

  function openCancelModal(s: Session) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sched = new Date((s.scheduled_date || "") + "T00:00:00");
    const daysBefore = Math.round((sched.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    setCancelTarget({ session: s, daysBefore });
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    const { session, daysBefore } = cancelTarget;
    const targetStatus = daysBefore >= 4 ? "makeup" : "cancelled";
    setCancelling(true);
    try {
      const res = await fetch("/api/online-class/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          status: targetStatus,
          cancel_noticed_at: new Date().toISOString(),
        }),
      });
      const r = await res.json();
      if (!res.ok) { toastErr(r.error || "취소 실패"); return; }
      toastOk(r.message || (r.makeup_added ? "보강 처리되었습니다." : "취소되었습니다."));
      setCancelTarget(null);
      if (expandedId) {
        const res2 = await fetch(`/api/online-class/sessions?enrollment_id=${expandedId}`);
        if (res2.ok) { const d = await res2.json(); setSessions(d.sessions || []); }
      }
      await loadEnrollments();
    } catch (e) {
      toastErr("취소 실패: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setCancelling(false);
    }
  }

  function openEditModal(e: Enrollment) {
    setEditTarget(e);
    setEditForm({
      student_name: e.student_name,
      student_name_en: e.student_name_en || "",
      student_birth_year: e.student_birth_year || "",
      customer_user_id: e.customer_user_id || null,
      tutor_id: e.tutor?.id || "",
      days_of_week: normDays(e.days_of_week),
      class_time_kr: e.class_time_kr || "",
      class_time_ph: e.class_time_ph || "",
      start_date: e.start_date || "",
      end_date: e.end_date || "",
      duration_weeks: e.duration_weeks ?? "",
      class_duration_weeks: e.class_duration_weeks ?? "",
      pre_sessions: e.pre_sessions ?? 0,
      post_sessions: e.post_sessions ?? 0,
      total_sessions: e.total_sessions ?? 0,
      sessions_per_week: e.sessions_per_week ?? 3,
      status: e.status || "active",
      notes: e.notes || "",
      portal_open: e.portal_open === true,
    });
  }
  async function adminMakeup(s: Session) {
    if (!window.confirm(`#${s.session_number} (${s.scheduled_date}) 차감 취소를 보강(무차감)으로 전환할까요?\n\n회차 1회가 복구되고 마지막 회차 뒤 보강이 추가돼요. (아이 아픔 등 부득이한 사정)`)) return;
    try {
      const res = await fetch("/api/online-class/sessions", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: s.id, admin_makeup: true }),
      });
      const r = await res.json();
      if (!res.ok) { toastErr(r.error || "전환 실패"); return; }
      toastOk("보강으로 전환했어요 (회차 복구)");
      if (expandedId) {
        const res2 = await fetch(`/api/online-class/sessions?enrollment_id=${expandedId}`);
        if (res2.ok) { const d = await res2.json(); setSessions(d.sessions || []); }
      }
      await loadEnrollments();
    } catch (e) { toastErr("전환 실패: " + (e instanceof Error ? e.message : "unknown")); }
  }
  function toggleEditDay(d: string) {
    setEditForm(f => {
      const days = (f.days_of_week as string[]) || [];
      return { ...f, days_of_week: days.includes(d) ? days.filter(x => x !== d) : [...days, d] };
    });
  }
  async function saveEdit() {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      // 요일이 변경되었는지 감지
      const oldDays = [...(editTarget.days_of_week || [])].sort().join(",");
      const newDays = [...((editForm.days_of_week as string[]) || [])].sort().join(",");
      const daysChanged = oldDays !== newDays;

      const res = await fetch("/api/online-class/enrollments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editTarget.id, ...editForm, class_time_ph: subtractHour(String(editForm.class_time_kr ?? "")) || editForm.class_time_ph || null }),
      });
      const r = await res.json();
      if (!res.ok) { toastErr(r.error || "저장 실패"); return; }

      // 변경 안내
      const tutorChanged = editForm.tutor_id !== editTarget.tutor_id;
      const msgs: string[] = ["수정 완료 ✅"];
      if (tutorChanged && r.sessions_tutor_synced) msgs.push(`튜터 변경 → 세션 ${r.sessions_tutor_synced}개 자동 동기화`);
      if (daysChanged) msgs.push("요일 변경 → 🔄 세션 재생성 버튼으로 세션을 갱신하세요.");
      toastOk(msgs.join(" · "));
      setEditTarget(null);
      await loadEnrollments();
    } catch (e) {
      toastErr("저장 실패: " + (e instanceof Error ? e.message : "unknown"));
    } finally { setEditSaving(false); }
  }

  const [regenerating, setRegenerating] = useState(false);
  async function regenerateSessions(enrollmentId: string) {
    if (!window.confirm("예정(scheduled) 세션을 삭제하고 현재 요일/시간 설정으로 재생성합니다.\n\n출석/취소 이력은 보존됩니다. 진행할까요?")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/online-class/enrollments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: enrollmentId, regenerate_sessions: true }),
      });
      const r = await res.json();
      if (!res.ok) { toastErr(r.error || "재생성 실패"); return; }
      toastOk(`세션 ${r.sessions_regenerated}개 재생성 완료 ✅`);
      await loadEnrollments();
      if (expandedId === enrollmentId) loadSessions(enrollmentId);
    } catch (e) {
      toastErr("재생성 실패: " + (e instanceof Error ? e.message : "unknown"));
    } finally { setRegenerating(false); }
  }
  function toggleDay(d: string) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter(x => x !== d) : [...f.days_of_week, d],
    }));
  }

  async function submitEnrollment() {
    if (!form.student_name.trim()) { toastErr("학생명을 입력해주세요"); return; }
    if (!form.start_date) { toastErr("시작일을 입력해주세요"); return; }
    if (!form.days_of_week.length) { toastErr("수강 요일을 선택해주세요"); return; }
    if (Number(form.total_sessions) < 1) { toastErr("총 회차를 입력해주세요"); return; }
    const total = Number(form.total_sessions);
    // 등록 1건 = 수강권 1개. 시기는 태그만 (연수전+연수후면 각각 따로 등록)
    const pre = periodTag === "pre" ? total : 0;
    const post = periodTag === "pre" ? 0 : total;
    const dt = dayTimesOn
      ? Object.fromEntries(form.days_of_week.filter(d => (dayTimes[d] || "").trim()).map(d => [d, dayTimes[d].trim()]))
      : null;
    setSubmitting(true);
    try {
      const res = await fetch("/api/online-class/enrollments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          class_time_ph: subtractHour(form.class_time_kr) || null,
          class_period: periodTag,
          day_times: dt && Object.keys(dt).length > 0 ? dt : null,
          days_of_week: form.days_of_week,
          duration_weeks: Number(form.duration_weeks) || null,
          class_duration_weeks: Number(form.class_duration_weeks) || null,
          sessions_per_week: Number(form.sessions_per_week) || 3,
          portal_open: form.portal_open === true,
          total_sessions: total,
          pre_sessions: pre,
          post_sessions: post,
          tutor_id: form.tutor_id || null,
        }),
      });
      if (!res.ok) { const r = await res.json(); toastErr(r.error || "등록 실패"); return; }
      const r = await res.json();
      toastOk(`등록 완료! 세션 ${r.sessions_created}개 생성됨 ✅`);
      setPeriodTag("standalone"); setDayTimesOn(false); setDayTimes({});
      setForm({
        student_name: "", student_name_en: "", student_birth_year: "", customer_user_id: "",
        portal_open: false,
        tutor_id: "", enrollment_type: "free_package", level: "",
        days_of_week: [], class_time_kr: "", class_time_ph: "",
        start_date: "", end_date: "", duration_weeks: "", class_duration_weeks: "",
        class_period: "post", sessions_per_week: "3",
        pre_sessions: "0", post_sessions: "0", total_sessions: "0", notes: "",
      });
      await loadEnrollments();
      setTab("list");
    } catch (e) { toastErr("등록 실패: " + (e instanceof Error ? e.message : "unknown")); }
    finally { setSubmitting(false); }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  // 필터 칩 = 전체 활성 티쳐 (배정 없는 새 티쳐도 표시 — 배정용) + 수업만 남은 비활성 티쳐
  const LV_KR: Record<string, string> = { beginner: "비기너", intermediate: "인터", advanced: "어드밴", coordinator: "코디" };
  const tutorLevelMap: Record<string, string> = {};
  tutors.forEach((t: any) => { if (t.name_display) tutorLevelMap[t.name_display] = LV_KR[t.level] || ""; });
  // 활성 튜터만 필터 칩에 노출 (비활성 옛 튜터 제외). 비활성에 배정된 학생은 'all' 뷰에서 보임
  const tutorNames = [...new Set(tutors.map((t: any) => t.name_display).filter(Boolean))] as string[];
  const hasNoTutor = enrollments.some(e => !e.tutor);

  const filtered = enrollments.filter(e => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (tutorFilter === "미배정") { if (e.tutor) return false; }
    else if (tutorFilter !== "all" && e.tutor?.name_display !== tutorFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.student_name?.toLowerCase().includes(q) && !e.student_name_en?.toLowerCase().includes(q)) return false;
    }
    // 기간 필터
    const sd = e.start_date || "";
    const ed = e.end_date || "";
    if (periodFilter === "all") return true;
    if (periodFilter === "current") return e.status === "active" && sd <= todayStr;
    if (periodFilter === "upcoming") return e.status === "active" && sd > todayStr;
    if (periodFilter === "past") return e.status !== "active" || (!!ed && ed < todayStr);
    return true;
  });

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.oc-w{max-width:1500px;margin:0 auto;padding:28px 24px}
.oc-top{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.oc-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.oc-back:hover{background:#e2e8f0}
.oc-top h1{font-size:22px;font-weight:800;flex:1}
.tabs{display:flex;gap:0;background:#fff;border-radius:10px;margin-bottom:18px;border:1px solid #e2e8f0;overflow:hidden}
.tab{flex:1;padding:12px;font-size:14px;font-weight:700;text-align:center;border:none;cursor:pointer;font-family:inherit;background:transparent;color:#6b7c93;transition:all .2s}
.tab.ac{background:#1a6fc4;color:#fff}
.toolbar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
.toolbar input,.toolbar select{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff}.toolbar input:focus,.toolbar select:focus{border-color:#1a6fc4}
.cnt{font-size:12px;color:#6b7c93;margin-left:auto}
.sec{background:#fff;border-radius:14px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-size:12px;min-width:1000px}
.tbl th{background:#f8fafc;padding:8px 6px;text-align:left;font-weight:700;font-size:11px;color:#6b7c93;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:7px 6px;border-bottom:1px solid #f1f5f9;vertical-align:middle;white-space:nowrap}
.tbl tr:hover{background:#f8fafc}
.badge{display:inline-block;padding:3px 10px;border-radius:5px;font-size:10px;font-weight:700}
.btn-sm{padding:5px 10px;border:1px solid #e2e8f0;background:#fff;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:#475569}.btn-sm:hover{background:#f1f5f9}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px}
.ses-row{display:flex;gap:4px;flex-wrap:nowrap;overflow-x:auto;padding:10px 0}
.ses-cell{position:relative;min-width:44px;height:44px;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;cursor:default}
.ses-cell .num{font-size:8px;opacity:0.7}
.ses-cell .cancel-btn{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#ef4444;color:#fff;border:none;font-size:11px;cursor:pointer;display:none;align-items:center;justify-content:center;line-height:1;padding:0;font-weight:700}
.ses-cell:hover .cancel-btn{display:flex}
.panel-bg{position:fixed;inset:0;background:rgba(15,23,42,0.35);z-index:900}
.panel{position:fixed;top:0;right:0;width:min(540px,94vw);height:100vh;background:#fff;box-shadow:-10px 0 36px rgba(0,0,0,0.18);z-index:910;overflow-y:auto;padding:22px;animation:slideIn .18s ease-out}
@keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:#fff;border-radius:14px;max-width:420px;width:100%;padding:24px}
.modal h3{font-size:18px;font-weight:800;margin-bottom:12px;color:#1a1a2e}
.modal p{font-size:14px;color:#475569;line-height:1.6;margin-bottom:16px}
.modal .btns{display:flex;gap:8px}
.modal .btn{flex:1;padding:12px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;border:none;font-family:inherit}
.modal .btn.cancel{background:#f1f5f9;color:#475569}
.modal .btn.confirm{background:#1a6fc4;color:#fff}
.modal .btn.danger{background:#ef4444;color:#fff}
.modal .btn:disabled{opacity:0.5;cursor:not-allowed}
.form-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin-bottom:16px}
.form-label{font-size:13px;font-weight:700;color:#374151;margin-bottom:6px;display:block}
.form-input{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;min-height:42px;background:#fff}
.form-input:focus{border-color:#1a6fc4}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.form-mb{margin-bottom:14px}
.day-chips{display:flex;gap:6px;flex-wrap:wrap}
.day-chip{padding:8px 14px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:#fff;color:#6b7c93;transition:all .15s;font-family:inherit}
.day-chip.on{border-color:#1a6fc4;background:#1a6fc4;color:#fff}
.submit-btn{width:100%;padding:14px;background:#1a6fc4;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit}
.submit-btn:disabled{opacity:0.5;cursor:not-allowed}
.section-title{font-size:14px;font-weight:800;color:#1a6fc4;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
@media(max-width:700px){.oc-w{padding:16px 10px}.form-row{grid-template-columns:1fr}.toolbar{flex-direction:column;align-items:stretch}}
    `}</style>
    <div className="oc-w">
      <div className="oc-top">
        <button className="oc-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>화상영어 관리</h1>
      </div>

      <div className="tabs">
        <button className={`tab${tab === "targets" ? " ac" : ""}`} onClick={() => setTab("targets")}>🎯 대상 목록</button>
        <button className={`tab${tab === "list" ? " ac" : ""}`} onClick={() => setTab("list")}>📋 수강생 목록</button>
        <button className={`tab${tab === "register" ? " ac" : ""}`} onClick={() => setTab("register")}>➕ 수강 등록</button>
        <button className={`tab${tab === "requests" ? " ac" : ""}`} onClick={() => setTab("requests")} style={{ position: "relative" }}>
          📬 변경요청
          {changeReqs.filter(r => r.status === "pending").length > 0 && (
            <span style={{ marginLeft: 5, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 9, padding: "1px 6px", verticalAlign: "middle" }}>
              {changeReqs.filter(r => r.status === "pending").length}
            </span>
          )}
        </button>
        <button className={`tab${tab === "weekly" ? " ac" : ""}`} onClick={() => setTab("weekly")}>📅 주간 스케줄</button>
        <button className="tab" onClick={() => router.push("/admin/online-class/availability")}>📊 가용 현황</button>
      </div>

      {/* ═══ TAB 1: 수강생 목록 ═══ */}
      {tab === "list" && <>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <input placeholder="🔍 학생명, 영문명 검색..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginLeft: "auto", padding: "7px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, width: 240, outline: "none", fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#1a6fc4", width: 44, flexShrink: 0 }}>담당T</span>
            {["all", ...tutorNames, ...(hasNoTutor ? ["미배정"] : [])].map(name => {
              const lv = tutorLevelMap[name];
              const on = tutorFilter === name;
              const label = name === "all" ? "전체" : name;
              return <button key={name} onClick={() => setTutorFilter(name)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: on ? "1px solid #1a6fc4" : "1px solid #dbeafe", background: on ? "#1a6fc4" : "#fff", color: on ? "#fff" : "#1a6fc4" }}>{label}{lv && <span style={{ fontSize: 10, opacity: 0.75, marginLeft: 3 }}>({lv})</span>}</button>;
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#0d9488", width: 44, flexShrink: 0 }}>기간</span>
            {([["all", "전체"], ["current", "현재 수업중"], ["upcoming", "예정"], ["past", "종료·기타"]] as const).map(([key, label]) => {
              const on = periodFilter === key;
              return <button key={key} onClick={() => setPeriodFilter(key as typeof periodFilter)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: on ? "1px solid #0d9488" : "1px solid #ccfbf1", background: on ? "#0d9488" : "#fff", color: on ? "#fff" : "#0d9488" }}>{label}</button>;
            })}
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <span className="cnt">{filtered.length}명</span>
        </div>

        <div style={{ display: "flex", gap: 6, margin: "0 0 10px" }}>
          <button className="btn-sm" style={listMode === "list" ? { background: "#1a6fc4", color: "#fff", borderColor: "#1a6fc4" } : {}} onClick={() => setListMode("list")}>📋 리스트</button>
          <button className="btn-sm" style={listMode === "sheet" ? { background: "#1a6fc4", color: "#fff", borderColor: "#1a6fc4" } : {}} onClick={() => { setListMode("sheet"); loadSheet(sheetMonth); }}>🗓 출석부 (한눈에)</button>
          {listMode === "sheet" && (
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center", marginLeft: 10 }}>
              <button className="btn-sm" onClick={() => shiftSheetMonth(-1)}>◀</button>
              <b style={{ fontSize: 14 }}>{sheetMonth.replace("-", "년 ")}월</b>
              <button className="btn-sm" onClick={() => shiftSheetMonth(1)}>▶</button>
              {sheetLoading && <span style={{ fontSize: 12, color: "#94a3b8" }}>불러오는 중…</span>}
            </span>
          )}
        </div>
        {listMode === "sheet" ? (() => {
          const [sy, sm] = sheetMonth.split("-").map(Number);
          const lastDay = new Date(sy, sm, 0).getDate();
          const days = Array.from({ length: lastDay }, (_, i) => i + 1);
          const WD = ["일", "월", "화", "수", "목", "금", "토"];
          const cellMap = new Map<string, any>();
          sheetSessions.forEach((s: any) => {
            const eid = s.enrollment_id || (s.enrollment && s.enrollment.id);
            if (eid && s.scheduled_date) cellMap.set(`${eid}_${s.scheduled_date}`, s);
          });
          const SYM: Record<string, { t: string; c: string; bg: string }> = {
            scheduled: { t: "·", c: "#94a3b8", bg: "transparent" },
            attended: { t: "O", c: "#166534", bg: "#dcfce7" },
            no_show: { t: "✗", c: "#dc2626", bg: "#fef2f2" },
            absent: { t: "✗", c: "#dc2626", bg: "#fef2f2" },
            cancelled: { t: "X", c: "#dc2626", bg: "#fee2e2" },
            makeup: { t: "△", c: "#b45309", bg: "#fef3c7" },
          };
          return (
            <div className="sec" style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={{ position: "sticky", left: 0, background: "#f8fafc", zIndex: 2, padding: "6px 10px", border: "1px solid #e2e8f0", textAlign: "left", minWidth: 130 }}>학생</th>
                    <th style={{ padding: "6px 8px", border: "1px solid #e2e8f0", minWidth: 60 }}>잔여</th>
                    {days.map(d => {
                      const wd = new Date(sy, sm - 1, d).getDay();
                      const wk = wd === 0 || wd === 6;
                      return <th key={d} style={{ padding: "4px 2px", border: "1px solid #e2e8f0", minWidth: 26, background: wk ? "#f1f5f9" : "#fff", color: wk ? "#cbd5e1" : wd === 5 ? "#2563eb" : "#334155", fontSize: 10.5 }}>{d}<br />{WD[wd]}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const total = e.total_sessions || 0;
                    const used = e.used_sessions || 0;
                    const rem = e.remaining_sessions ?? Math.max(0, total - used);
                    return (
                      <tr key={e.id}>
                        <td onClick={() => router.push(`/admin/online-class/${e.id}`)} style={{ position: "sticky", left: 0, background: "#fff", zIndex: 1, padding: "5px 10px", border: "1px solid #e2e8f0", cursor: "pointer", whiteSpace: "nowrap" }}>
                          <b>{e.student_name}</b> <span style={{ color: "#94a3b8", fontSize: 10.5 }}>{e.tutor?.name_display || "미배정"}</span>
                        </td>
                        <td style={{ textAlign: "center", border: "1px solid #e2e8f0", fontWeight: 700, color: rem <= 3 ? "#dc2626" : "#166534" }}>{rem}/{total}</td>
                        {days.map(d => {
                          const dateStr = `${sheetMonth}-${String(d).padStart(2, "0")}`;
                          const s = cellMap.get(`${e.id}_${dateStr}`);
                          const wd = new Date(sy, sm - 1, d).getDay();
                          const wk = wd === 0 || wd === 6;
                          if (!s) return <td key={d} style={{ border: "1px solid #eef2f7", background: wk ? "#f8fafc" : undefined }} />;
                          const sym = SYM[s.status] || SYM.scheduled;
                          const tt = `${e.student_name} · ${s.scheduled_date} ${s.scheduled_time_kr || ""} · ${s.status}` + (s.attitude === "issue" ? `\n⚠️ 태도: ${s.attitude_note || ""}` : "") + (s.session_note ? `\n📝 ${s.session_note}` : "");
                          return (
                            <td key={d} onClick={() => router.push(`/admin/online-class/${e.id}`)} title={tt} style={{ textAlign: "center", border: "1px solid #e2e8f0", background: sym.bg, color: sym.c, fontWeight: 800, cursor: "pointer", position: "relative" }}>
                              {sym.t}{s.attitude === "issue" && <span style={{ position: "absolute", top: -2, right: 0, fontSize: 8 }}>⚠️</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>· 예정 O 출석 ✗ 결석 X 차감취소 △ 보강 ⚠️ 태도기록 — 칸/이름 클릭 = 학생 상세 페이지</div>
            </div>
          );
        })() : (
        <div className="sec">
          {filtered.length === 0 ? (
            <div className="empty">해당 조건의 수강생이 없습니다</div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th>학생명</th><th>영문명</th><th>담당T</th><th>요일</th><th>시간 (KR/PH)</th>
                <th>기간</th><th style={{ minWidth: 140 }}>잔여 회차</th>
                <th>상태</th><th>관리</th>
              </tr></thead>
              <tbody>
                {filtered.map(e => {
                  const stLabel = STATUS_LABEL[e.status] || e.status;
                  const stBg = STATUS_BG[e.status] || "#f1f5f9";
                  const stColor = STATUS_COLOR[e.status] || "#64748b";
                  const total = e.total_sessions || 0;
                  const used = e.used_sessions || 0;
                  const rem = e.remaining_sessions ?? Math.max(0, total - used);
                  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                  const isSplit = e.class_period === "both" || (e.pre_sessions > 0 && e.post_sessions > 0);
                  return (
                    <tr key={e.id} style={{ cursor: "pointer", background: expandedId === e.id ? "#eff6ff" : undefined }} onClick={() => router.push(`/admin/online-class/${e.id}`)}>
                      <td style={{ fontWeight: 700 }}>{e.student_name}
                        {(e as any).notes?.includes("엄마 앱 신청") && !closedIds.has(e.id) && <span title={(e as any).notes} style={{ marginLeft: 4, fontSize: 9, background: "#fdf4ff", color: "#a21caf", border: "1px solid #f0abfc", padding: "1px 5px", borderRadius: 8, fontWeight: 800 }}>📱 엄마신청</span>}
                        {(e as any).notes?.includes("엄마 앱 신청") && !confirmedIds.has(e.id) && <span title="아직 확정 안 함 — 상태 셀의 [확정] 버튼으로 확인 처리" style={{ marginLeft: 3, fontSize: 11, color: "#dc2626", fontWeight: 900 }}>❗</span>}
                        {isSplit && <span title="연수전/연수후 분리 수강 (구버전)" style={{ marginLeft: 4, fontSize: 9, background: "#ede9fe", color: "#6d28d9", padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>전·후</span>}
                        {e.class_period === "pre" && <span style={{ marginLeft: 4, fontSize: 9, background: "#e1f5ee", color: "#085041", padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>연수전</span>}
                        {e.class_period === "standalone" && <span style={{ marginLeft: 4, fontSize: 9, background: "#f1f5f9", color: "#475569", padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>단독</span>}
                      </td>
                      <td>{e.student_name_en || "-"}</td>
                      <td>{e.tutor?.name_display || "-"}</td>
                      <td>{daysToKr(e.days_of_week)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 700 }}>KR {e.class_time_kr || "-"}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>PH {e.class_time_ph || "-"}</div>
                      </td>
                      <td><PeriodCell e={e} /></td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ flex: 1, height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden", minWidth: 60 }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: rem <= 3 ? "#ef4444" : "#1a6fc4", borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: rem <= 3 ? "#dc2626" : "#166534", whiteSpace: "nowrap" }}>{rem} / {total}</span>
                        </div>
                      </td>
                      <td onClick={ev => ev.stopPropagation()}>
                        <span className="badge" style={{ background: stBg, color: stColor }}>{stLabel}</span>
                        {closedIds.has(e.id) ? (
                          <button onClick={() => toggleClose(e.id)} title="마감됨 — 클릭하면 마감 해제"
                            style={{ marginLeft: 5, padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", border: "1px solid #334155", background: "#1e293b", color: "#fff" }}>
                            🔒 마감
                          </button>
                        ) : (<>
                          <button onClick={() => toggleConfirm(e.id)} title={confirmedIds.has(e.id) ? "확정 해제" : "확인 완료로 표시"}
                            style={{ marginLeft: 5, padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                              border: confirmedIds.has(e.id) ? "1px solid #16a34a" : "1px dashed #cbd5e1",
                              background: confirmedIds.has(e.id) ? "#dcfce7" : "#fff", color: confirmedIds.has(e.id) ? "#166534" : "#94a3b8" }}>
                            {confirmedIds.has(e.id) ? "✔ 확정" : "확정"}
                          </button>
                          {confirmedIds.has(e.id) && (
                            <button onClick={() => toggleClose(e.id)} title="최종 확인 완료 — 일정 마감"
                              style={{ marginLeft: 3, padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", border: "1px solid #94a3b8", background: "#f8fafc", color: "#475569" }}>
                              마감
                            </button>
                          )}
                        </>)}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }} onClick={ev => ev.stopPropagation()}>
                        <button className="btn-sm" onClick={() => router.push(`/admin/online-class/${e.id}?focus=attendance`)}>출결</button>
                        {" "}
                        <button className="btn-sm" style={{ color: "#1a6fc4", borderColor: "#93c5fd" }} onClick={() => router.push(`/admin/online-class/${e.id}`)}>수정</button>
                        {" "}
                        <button className="btn-sm" style={{ color: "#d97706", borderColor: "#fcd34d" }} onClick={() => regenerateSessions(e.id)} disabled={regenerating}>🔄</button>
                        {" "}
                        <button className="btn-sm" onClick={() => router.push(`/admin/online-class/invoice?enrollment_id=${e.id}`)}>인보이스</button>
                        {" "}
                        <button className="btn-sm" style={{ color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => deleteEnrollment(e)}>삭제</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        )}
      </>}

      {/* ═══ TAB: 주간 스케줄 (한국어 자체 화면) ═══ */}
      {tab === "weekly" && (() => {
        const now = new Date(); const dow = (now.getDay() + 6) % 7;
        const mon = new Date(now); mon.setDate(now.getDate() - dow + wkOffset * 7);
        const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const days = Array.from({ length: 6 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
        const todayStr2 = f(new Date());
        const byDate: Record<string, any[]> = {};
        wkSessions.forEach(x => { const k = x.scheduled_date; (byDate[k] = byDate[k] || []).push(x); });
        Object.values(byDate).forEach(arr => arr.sort((a, b) => (a.scheduled_time_kr || "").localeCompare(b.scheduled_time_kr || "")));
        const DN = ["월", "화", "수", "목", "금", "토"];
        return (
          <div style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>📅 주간 스케줄 <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{f(days[0]).slice(5).replace("-", "/")} ~ {f(days[5]).slice(5).replace("-", "/")}</span></div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <button onClick={() => setWkOffset(o => o - 1)} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>◀ 이전 주</button>
                <button onClick={() => setWkOffset(0)} style={{ border: "1px solid #93c5fd", background: wkOffset === 0 ? "#1a6fc4" : "#fff", color: wkOffset === 0 ? "#fff" : "#1a6fc4", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>이번 주</button>
                <button onClick={() => setWkOffset(o => o + 1)} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>다음 주 ▶</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {tutors.map(t => <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#475569", border: "1px solid #e2e8f0", borderRadius: 8, padding: "3px 9px" }}><span style={{ width: 9, height: 9, borderRadius: 5, background: getTutorColor(t.name_display) }} />{t.name_display}</span>)}
            </div>
            {wkLoading ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>불러오는 중...</div> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", gap: 8 }}>
                {days.map((d, i) => {
                  const k = f(d); const list = byDate[k] || [];
                  const isToday = k === todayStr2;
                  return (
                    <div key={k} style={{ border: isToday ? "2px solid #1a6fc4" : "1px solid #eef2f7", borderRadius: 12, background: isToday ? "#f0f7ff" : "#fafbfd", minHeight: 200, padding: 8 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: isToday ? "#1a6fc4" : "#475569", marginBottom: 8, textAlign: "center" }}>{DN[i]} <span style={{ fontWeight: 600, color: "#94a3b8" }}>{k.slice(5).replace("-", "/")}</span>{list.length > 0 && <span style={{ marginLeft: 4, fontSize: 10.5, color: "#1a6fc4" }}>({list.length})</span>}</div>
                      {list.map(x => {
                        const col = getTutorColor(x.tutor?.name_display);
                        const done = x.status === "attended"; const bad = x.status === "cancelled" || x.status === "no_show" || x.status === "absent";
                        return (
                          <div key={x.id} onClick={() => x.enrollment?.id && router.push(`/admin/online-class/${x.enrollment.id}?focus=attendance`)}
                            style={{ background: "#fff", borderLeft: `4px solid ${col}`, border: "1px solid #eef2f7", borderLeftWidth: 4, borderLeftColor: col, borderRadius: 8, padding: "6px 8px", marginBottom: 6, cursor: "pointer", opacity: bad ? 0.55 : 1 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#1e293b" }}>{x.scheduled_time_kr || "-"} <span style={{ fontWeight: 600, color: "#94a3b8" }}>(PH {x.scheduled_time_ph || "-"})</span></div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", textDecoration: bad ? "line-through" : "none" }}>{x.enrollment?.student_name || "?"}{done ? " ✓" : ""}</div>
                            <div style={{ fontSize: 10.5, color: col, fontWeight: 700 }}>{x.tutor?.name_display || "미배정"}</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 10 }}>카드를 클릭하면 그 학생의 출석부로 이동해요 · 취소/결석은 흐리게 표시</div>
          </div>
        );
      })()}

      {/* ═══ TAB: 대상 목록 (올해 다녀간 아이 전체 — 확인하며 등록/제외) ═══ */}
      {tab === "targets" && (() => {
        const visible = targets.filter(t => (tgShowExcluded ? true : !t.excluded))
          .filter(t => !tgQ || [t.name_kr, t.name_en, t.booker_name, t.house].some(v => v && String(v).toLowerCase().includes(tgQ.toLowerCase())));
        return (
          <div style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>🎯 화상영어 대상 목록 <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>올해 다녀간 아이 {visible.length}명</span></div>
              <input value={tgQ} onChange={e => setTgQ(e.target.value)} placeholder="이름·예약자·하우스 검색" style={{ marginLeft: "auto", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 9, fontSize: 13, fontFamily: "inherit", width: 220 }} />
              <label style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <input type="checkbox" checked={tgShowExcluded} onChange={e => setTgShowExcluded(e.target.checked)} /> 제외된 아이 보기
              </label>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 860 }}>
                <thead><tr style={{ color: "#6b7c93", fontSize: 12, textAlign: "left" }}>
                  {["학생", "출생", "예약자", "하우스", "체류기간", "화상영어", "액션"].map(h => <th key={h} style={{ padding: "9px 12px", borderBottom: "1px solid #eef2f7", whiteSpace: "nowrap" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {visible.map(t => (
                    <tr key={t.key} style={{ borderBottom: "1px solid #f5f7fa", opacity: t.excluded ? 0.45 : 1 }}>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}><b>{t.name_kr}</b> <span style={{ color: "#94a3b8", fontSize: 11.5 }}>{t.name_en}</span></td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{t.birth || "-"}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{t.booker_name}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{t.house}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap", fontSize: 12.5 }}>{t.ci?.slice(5)}~{t.co?.slice(5)}</td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        {t.enrolled === "active" ? <span style={{ fontSize: 11, fontWeight: 800, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 8 }}>수강중</span>
                          : t.enrolled === "past" ? <span style={{ fontSize: 11, fontWeight: 700, background: "#f1f5f9", color: "#64748b", padding: "2px 8px", borderRadius: 8 }}>이력 있음</span>
                          : <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        <button onClick={() => registerFromTarget(t)} style={{ border: "1px solid #93c5fd", background: "#eff6ff", color: "#1d4ed8", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", marginRight: 6 }}>➕ 수강 등록</button>
                        <button onClick={() => toggleTarget(t.key, t.excluded)} style={{ border: "1px solid " + (t.excluded ? "#bbf7d0" : "#fecaca"), background: "#fff", color: t.excluded ? "#166534" : "#dc2626", borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t.excluded ? "↩ 복구" : "🗑 제외"}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 8 }}>제외해도 삭제되는 건 아니에요 — "제외된 아이 보기"로 언제든 복구 가능. [➕ 수강 등록]을 누르면 이름·계정이 채워진 등록 폼으로 이동해요.</div>
          </div>
        );
      })()}

      {/* ═══ TAB 2: 수강 등록 ═══ */}
      {tab === "register" && <div style={{ maxWidth: 1150, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        <div className="form-card">
          <div className="section-title">학생 정보</div>
          <div className="form-row">
            <div><label className="form-label">학생명 (한국어) *</label><input className="form-input" value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })} placeholder="홍길동" /></div>
            <div><label className="form-label">영문명</label><input className="form-input" value={form.student_name_en} onChange={e => setForm({ ...form, student_name_en: e.target.value })} placeholder="Gildong" /></div>
          </div>
          <div className="form-row">
            <div><label className="form-label">출생연도</label><input className="form-input" value={form.student_birth_year} onChange={e => setForm({ ...form, student_birth_year: e.target.value })} placeholder="18년생" /></div>
            <div><label className="form-label">손님 앱(계정) 연결</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="form-input" value={form.customer_user_id ? (acctLabels[form.customer_user_id] || form.customer_user_id.slice(0, 8) + "…") : ""} readOnly placeholder="미연결 — 🔍로 검색" style={{ flex: 1, background: form.customer_user_id ? "#f0fdf4" : undefined, cursor: "default" }} />
                <button type="button" className="btn-sm" onClick={() => { setAcctModal("form"); setAcctQ(""); setAcctResults([]); }} style={{ whiteSpace: "nowrap" }}>🔍 계정 찾기</button>
                {form.customer_user_id && <button type="button" className="btn-sm" style={{ color: "#dc2626" }} onClick={() => setForm(f => ({ ...f, customer_user_id: "", portal_open: false }))}>해제</button>}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginTop: 6, cursor: "pointer", color: form.portal_open ? "#166534" : "#64748b", fontWeight: 700 }}>
                <input type="checkbox" checked={form.portal_open} onChange={e => setForm({ ...form, portal_open: e.target.checked })} />
                📱 손님 앱(포털)에 공개 — 지정 손님만 화상영어 탭이 열려요
              </label>
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="section-title">수업 정보</div>
          <div className="form-row">
            <div>
              <label className="form-label">담당 튜터</label>
              <select className="form-input" value={form.tutor_id} onChange={e => setForm({ ...form, tutor_id: e.target.value })}>
                <option value="">선택</option>
                {tutors.map(t => <option key={t.id} value={t.id}>{t.name_display}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">수강 유형</label>
              <select className="form-input" value={form.enrollment_type} onChange={e => setForm({ ...form, enrollment_type: e.target.value })}>
                <option value="free_package">무료 (패키지연계)</option>
                <option value="paid">유료</option>
              </select>
            </div>
          </div>
          <div className="form-mb">
            <label className="form-label">영어 레벨</label>
            <select className="form-input" value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>
              <option value="">선택</option>
              <option value="beginner">비기너</option>
              <option value="intermediate">인터미디엇</option>
              <option value="advanced">어드밴스드</option>
            </select>
          </div>
          <div className="form-mb">
            <label className="form-label">수강 요일 *</label>
            <div className="day-chips">
              {DAYS.map(d => (
                <button key={d} className={`day-chip${form.days_of_week.includes(d) ? " on" : ""}`} onClick={() => toggleDay(d)}>{d}</button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <div><label className="form-label">한국 수업 시간</label><input className="form-input" value={form.class_time_kr} readOnly onClick={() => { if (!dayTimesOn) openTimePicker("한국 수업 시간", t => setForm(f => ({ ...f, class_time_kr: t, class_time_ph: subtractHour(t) }))); }} placeholder="시간 선택" style={{ cursor: dayTimesOn ? "not-allowed" : "pointer", ...(dayTimesOn ? { background: "#f8fafc", opacity: 0.6 } : {}) }} /></div>
            <div><label className="form-label">필리핀 수업 시간</label><input className="form-input" value={subtractHour(form.class_time_kr) || form.class_time_ph} readOnly style={{ background: "#f8fafc", opacity: 0.7 }} placeholder="자동 계산" title="한국 시간 -1시간 자동" /></div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={dayTimesOn} onChange={e => setDayTimesOn(e.target.checked)} />
            요일별 시간 다르게 (예: 수 17:00 / 금 18:00)
          </label>
          {dayTimesOn && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 8, marginBottom: 14, padding: "10px 12px", background: "#f8fafc", borderRadius: 8 }}>
              {form.days_of_week.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", gridColumn: "1/-1" }}>먼저 위에서 수강 요일을 선택해주세요</div>}
              {form.days_of_week.map(d => (
                <div key={d}>
                  <label className="form-label" style={{ fontSize: 11 }}>{d}요일 (한국시간)</label>
                  <input className="form-input" value={dayTimes[d] || ""} readOnly onClick={() => openTimePicker(`${d}요일 수업 시간`, t => setDayTimes(prev => ({ ...prev, [d]: t })))} placeholder="시간 선택" style={{ cursor: "pointer" }} />
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#94a3b8", gridColumn: "1/-1" }}>필리핀 시간은 자동으로 1시간 빼서 저장됩니다</div>
            </div>
          )}
        </div>

        <div className="form-card">
          <div className="section-title">기간 & 회차</div>
          <div className="form-row">
            <div><label className="form-label">시작일 *</label><input type="date" className="form-input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label className="form-label">종료일 (마지막 회차 · 자동)</label>
              {(() => {
                const r = buildOnlineSessionDates(form.start_date, form.days_of_week, Number(form.total_sessions) || 0, holidaySet);
                const skipHoli = r.skipped.filter(s => s.reason === "휴일").length;
                const skipVac = r.skipped.filter(s => s.reason === "방학").length;
                return (<>
                  <input type="date" className="form-input" value={r.endDate || form.end_date} readOnly style={{ background: "#f0fdf4", fontWeight: 700 }} title="시작일·요일·회차 기준 자동 계산 (성수기/방학·휴일 제외)" />
                  {r.endDate ? <div style={{ fontSize: 11, color: "#166534", marginTop: 4 }}>✅ 총 {form.total_sessions}회 → 마지막 수업 <b>{r.endDate}</b>{(skipHoli || skipVac) ? ` · 건너뜀: ${skipVac ? `방학 ${skipVac}일` : ""}${skipVac && skipHoli ? " · " : ""}${skipHoli ? `휴일 ${skipHoli}일` : ""}` : ""}</div>
                    : <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>시작일·요일·회차를 입력하면 자동 계산돼요 (성수기/방학·휴일 제외)</div>}
                </>);
              })()}
            </div>
          </div>
          <div className="form-row">
            <div><label className="form-label">기간 (주)</label><input type="number" className="form-input" value={form.duration_weeks} onChange={e => setForm({ ...form, duration_weeks: e.target.value })} placeholder="자동계산" /></div>
            <div><label className="form-label">화상수업기간 (주)</label><input type="number" className="form-input" value={form.class_duration_weeks} onChange={e => setForm({ ...form, class_duration_weeks: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div>
              <label className="form-label">주 수업 횟수</label>
              <select className="form-input" value={form.sessions_per_week} onChange={e => {
                const spw = Number(e.target.value) || 3;
                const total = Number(form.total_sessions) || 0;
                setForm({ ...form, sessions_per_week: e.target.value, ...(total > 0 ? { duration_weeks: String(Math.ceil(total / spw)) } : {}) });
              }}>
                <option value="2">2회 (최소)</option>
                <option value="3">3회 (기본)</option>
                <option value="5">5회</option>
              </select>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>주1회 불가 · 주2회 선택 시 총 회차 유지, 기간 연장 (예: 12회 = 6주)</div>
            </div>
            <div>
              <label className="form-label">총 회차 *</label>
              <input type="number" className="form-input" value={form.total_sessions}
                onChange={e => setForm({ ...form, total_sessions: e.target.value })}
                style={{ fontWeight: 700 }}
                placeholder={form.duration_weeks && form.sessions_per_week ? `예: ${Number(form.duration_weeks) * Number(form.sessions_per_week)}` : ""} />
            </div>
          </div>
          <div className="form-mb">
            <label className="form-label">시기 구분</label>
            <div className="day-chips">
              {([["standalone", "단독 (화상수업만)"], ["pre", "연수전"], ["post", "연수후"]] as const).map(([v, label]) => (
                <button key={v} className={`day-chip${periodTag === v ? " on" : ""}`} onClick={() => setPeriodTag(v)}>{label}</button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 5 }}>연수전 + 연수후 둘 다 있으면 → 각각 따로 등록 (승인·잔여횟수·인보이스 독립)</div>
          </div>
        </div>

        <div className="form-card">
          <div className="section-title">특이사항</div>
          <textarea className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="특이사항 메모" style={{ resize: "vertical", minHeight: 80 }} />
        </div>

        <button className="submit-btn" style={{ gridColumn: "1 / -1" }} onClick={submitEnrollment} disabled={submitting}>{submitting ? "등록 중..." : "수강 등록"}</button>
      </div>}

      {/* ═══ TAB 3: 변경요청 수신함 ═══ */}
      {tab === "requests" && (() => {
        const shown = changeReqs.filter(r => reqFilter === "all" || r.status === "pending");
        const ST: Record<string, { label: string; bg: string; c: string }> = {
          pending: { label: "검토 대기", bg: "#fef3c7", c: "#92400e" },
          approved: { label: "승인됨", bg: "#dcfce7", c: "#166534" },
          rejected: { label: "거절됨", bg: "#fef2f2", c: "#dc2626" },
        };
        return (
          <div className="sec" style={{ overflowX: "visible" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
              <button className="btn-sm" style={reqFilter === "pending" ? { background: "#1a6fc4", color: "#fff", borderColor: "#1a6fc4" } : {}} onClick={() => setReqFilter("pending")}>대기 중</button>
              <button className="btn-sm" style={reqFilter === "all" ? { background: "#1a6fc4", color: "#fff", borderColor: "#1a6fc4" } : {}} onClick={() => setReqFilter("all")}>전체</button>
              <span className="cnt">{shown.length}건</span>
            </div>
            {shown.length === 0 ? (
              <div className="empty">{reqFilter === "pending" ? "대기 중인 변경 요청이 없습니다" : "변경 요청 내역이 없습니다"}</div>
            ) : shown.map(r => {
              const en = r.enrollment || {};
              const st = ST[r.status] || ST.pending;
              return (
                <div key={r.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <span className="badge" style={{ background: st.bg, color: st.c }}>{st.label}</span>
                    <b style={{ fontSize: 14 }}>{en.student_name}</b>
                    <span style={{ fontSize: 12, color: "#6b7c93" }}>{en.tutor?.name_display || "튜터 미지정"}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>{(r.created_at || "").slice(0, 16).replace("T", " ")}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, padding: "2px 8px", background: r.req_type === "single" ? "#eff6ff" : "#f5f3ff", color: r.req_type === "single" ? "#1a6fc4" : "#7c3aed" }}>{r.req_type === "single" ? "1회차 변경" : "전체 요일 변경"}</span>
                    {en.tutor_id ? (
                    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: r.teacher_status === "approved" ? "#dcfce7" : r.teacher_status === "rejected" ? "#fef2f2" : "#fef9c3", color: r.teacher_status === "approved" ? "#166534" : r.teacher_status === "rejected" ? "#dc2626" : "#92400e" }}>현지T {r.teacher_status === "approved" ? "승인✓" : r.teacher_status === "rejected" ? "거절" : "대기"}</span>
                    ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: "#e0e7ff", color: "#4338ca" }}>미배정 · 바로 승인</span>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center", background: "#f8fafc", borderRadius: 8, padding: "10px 12px", fontSize: 12.5 }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 700, marginBottom: 2 }}>현재</div>
                      {r.req_type === "single" ? "이 수업" : daysToKr(en.days_of_week || [])} {r.req_type === "single" ? "" : (en.class_time_kr || "")}
                    </div>
                    <div style={{ fontSize: 16, color: "#1a6fc4" }}>→</div>
                    <div>
                      <div style={{ fontSize: 10.5, color: "#1a6fc4", fontWeight: 700, marginBottom: 2 }}>{r.req_type === "single" ? "새 날짜/시간" : `요청 (적용일 ${r.effective_from})`}</div>
                      <b>{r.req_type === "single" ? `${r.req_date || "(날짜 유지)"} ${r.req_time_kr || ""}` : `${r.req_days_of_week?.length ? daysToKr(r.req_days_of_week) : daysToKr(en.days_of_week || [])} ${r.req_time_kr || en.class_time_kr || ""}`}</b>
                    </div>
                  </div>
                  {r.memo && <div style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>💬 {r.memo}</div>}
                  {r.admin_note && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>관리자: {r.admin_note}</div>}
                  {r.status === "pending" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                      {(() => { const canApprove = !en.tutor_id || r.teacher_status === "approved"; return (
                      <button className="btn-sm" disabled={reqProcessing === r.id || !canApprove} title={!canApprove ? "현지 선생님 승인 후 최종 승인 가능" : ""} style={{ background: canApprove ? "#0d9488" : "#cbd5e1", color: "#fff", borderColor: canApprove ? "#0d9488" : "#cbd5e1", padding: "7px 16px", cursor: canApprove ? "pointer" : "not-allowed" }} onClick={() => processReq(r.id, "approve")}>
                        {reqProcessing === r.id ? "처리 중..." : "✓ 최종 승인 (적용)"}
                      </button>
                      ); })()}
                      <button className="btn-sm" disabled={reqProcessing === r.id} style={{ color: "#dc2626", borderColor: "#fecaca", padding: "7px 16px" }} onClick={() => processReq(r.id, "reject")}>거절</button>
                      {en.tutor_id && r.teacher_status !== "approved" && <span style={{ fontSize: 11, color: "#92400e" }}>⏳ 현지 선생님 승인 대기 중</span>}
                      {!en.tutor_id && <span style={{ fontSize: 11, color: "#4338ca" }}>담당 티쳐 미배정 — 승인하면 바로 적용됩니다</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>

    {/* ───── 출결 우측 슬라이드 패널 ───── */}
    {expandedId && (() => {
      const en = enrollments.find(e => e.id === expandedId);
      if (!en) return null;
      const total = en.total_sessions || 0;
      const used = en.used_sessions || 0;
      const rem = en.remaining_sessions ?? Math.max(0, total - used);
      const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
      /* 월별 그룹 */
      const byMonth: Record<string, Session[]> = {};
      sessions.forEach(s => { const k = (s.scheduled_date || "").slice(0, 7); (byMonth[k] = byMonth[k] || []).push(s); });
      const months = Object.keys(byMonth).sort();
      return (
        <div className="panel-bg" onClick={() => setExpandedId(null)}>
          <div className="panel" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, flex: 1 }}>{en.student_name} <span style={{ fontSize: 13, fontWeight: 500, color: "#64748b" }}>{en.student_name_en}</span></h3>
              <button onClick={() => openEditModal(en)} className="btn-sm" style={{ color: "#1a6fc4", borderColor: "#93c5fd" }}>✏️ 수정</button>
              <button onClick={() => setExpandedId(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#64748b", padding: "0 4px" }}>✕</button>
            </div>
            <div style={{ fontSize: 12.5, color: "#475569", marginBottom: 12, lineHeight: 1.7 }}>
              {en.tutor?.name_display || "튜터 미지정"} · {daysToKr(en.days_of_week)} {en.class_time_kr || ""}{en.class_time_ph ? ` (PH ${en.class_time_ph})` : ""}<br />
              {en.start_date} ~ {en.end_date || "미정"}{(en.class_period === "both" || (en.pre_sessions > 0 && en.post_sessions > 0)) && <span style={{ marginLeft: 6, fontSize: 10, background: "#ede9fe", color: "#6d28d9", padding: "1px 6px", borderRadius: 8, fontWeight: 700 }}>연수전 {en.pre_sessions} + 연수후 {en.post_sessions}</span>}
            </div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
                <span>사용 {used}회 / 전체 {total}회</span>
                <span style={{ color: rem <= 3 ? "#dc2626" : "#166534" }}>잔여 {rem}회</span>
              </div>
              <div style={{ height: 10, background: "#e2e8f0", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: rem <= 3 ? "#ef4444" : "#1a6fc4" }} />
              </div>
            </div>
            {sessionsLoading ? (
              <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>로딩 중...</div>
            ) : sessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>세션이 없습니다</div>
            ) : months.map(m => (
              <div key={m} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1a6fc4", marginBottom: 6 }}>{m.replace("-", "년 ")}월</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {byMonth[m].map(s => {
                    let st = SES_STYLE[s.status] || SES_STYLE.scheduled;
                    if (s.status === "cancelled") {
                      const dB = s.cancel_days_before;
                      st = (dB != null && dB >= 4) ? SES_STYLE.makeup : SES_STYLE.cancelled;
                    }
                    const d = s.scheduled_date ? `${Number(s.scheduled_date.split("-")[1])}/${Number(s.scheduled_date.split("-")[2])}` : "";
                    const tt = `#${s.session_number} ${s.scheduled_date} ${s.status}` + (s.cancel_days_before != null ? ` (${s.cancel_days_before}d)` : "") + (s.session_note ? `\n📝 ${s.session_note}` : "");
                    return (
                      <div key={s.id} className="ses-cell" style={{ background: st.bg, color: st.color }} title={tt}>
                        <div className="num">{d}</div>
                        <div>{st.label}</div>
                        {s.session_note && <span style={{ position: "absolute", top: 2, right: 2, fontSize: 10 }}>💬</span>}
                        {s.attitude === "issue" && <span style={{ position: "absolute", bottom: 2, right: 2, fontSize: 10 }} title={`수업태도: ${s.attitude_note || "문제 기록"}`}>⚠️</span>}
                        {s.status === "scheduled" && (
                          <button className="cancel-btn" onClick={() => openCancelModal(s)} title="취소">×</button>
                        )}
                        {s.status === "cancelled" && (s.cancel_days_before == null || s.cancel_days_before < 4) && (
                          <button className="cancel-btn" style={{ background: "#dcfce7", color: "#166534" }} onClick={() => adminMakeup(s)} title="보강 전환 (차감 복구)">↩</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14 }}>O 출석 · X 결석/차감취소 · △ 보강 · ⚠️ 태도기록 · 예정 칸 ×=취소 · X 칸 ↩=보강 전환(차감 복구)</div>
            {sessions.some(s => s.session_note) && (
              <div style={{ padding: 14, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#78350f", marginBottom: 10 }}>📝 튜터 메모</div>
                {sessions.filter(s => s.session_note).map(s => (
                  <div key={s.id} style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>#{s.session_number} · {s.scheduled_date}{s.scheduled_time_kr ? ` · ${s.scheduled_time_kr}` : ""}</div>
                    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{s.session_note}</div>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "#a16207", marginTop: 4 }}>읽기 전용 — 튜터만 수정 가능</div>
              </div>
            )}
          </div>
        </div>
      );
    })()}

    {editTarget && (
      <div className="modal-bg" onClick={() => !editSaving && setEditTarget(null)}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
          <h3>✏️ 수강 정보 수정</h3>
          <p style={{ marginBottom: 16, fontSize: 13, color: "#64748b" }}>{editTarget.student_name}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label className="form-label" style={{ fontSize: 11 }}>학생명</label><input className="form-input" value={String(editForm.student_name ?? "")} onChange={e => setEditForm(f => ({ ...f, student_name: e.target.value }))} /></div>
            <div><label className="form-label" style={{ fontSize: 11 }}>영문명</label><input className="form-input" value={String(editForm.student_name_en ?? "")} onChange={e => setEditForm(f => ({ ...f, student_name_en: e.target.value }))} /></div>
            <div><label className="form-label" style={{ fontSize: 11 }}>출생연도</label><input className="form-input" value={String(editForm.student_birth_year ?? "")} onChange={e => setEditForm(f => ({ ...f, student_birth_year: e.target.value }))} /></div>
            <div>
              <label className="form-label" style={{ fontSize: 11 }}>담당 튜터</label>
              <select className="form-input" value={String(editForm.tutor_id ?? "")} onChange={e => setEditForm(f => ({ ...f, tutor_id: e.target.value }))}>
                <option value="">미지정</option>
                {tutors.map(t => <option key={t.id} value={t.id}>{t.name_display}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ fontSize: 11 }}>수강 요일</label>
            <div className="day-chips">
              {DAYS.map(d => (
                <button key={d} className={`day-chip${((editForm.days_of_week as string[]) || []).includes(d) ? " on" : ""}`} onClick={() => toggleEditDay(d)}>{d}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label className="form-label" style={{ fontSize: 11 }}>한국 시간</label><input className="form-input" value={String(editForm.class_time_kr ?? "")} readOnly onClick={() => openTimePicker("한국 수업 시간", t => setEditForm(f => ({ ...f, class_time_kr: t, class_time_ph: subtractHour(t) })))} style={{ cursor: "pointer" }} /></div>
            <div><label className="form-label" style={{ fontSize: 11 }}>필리핀 시간</label><input className="form-input" value={subtractHour(String(editForm.class_time_kr ?? "")) || String(editForm.class_time_ph ?? "")} readOnly style={{ background: "#f8fafc", opacity: 0.7 }} title="한국 시간 -1시간 자동" /></div>
            <div><label className="form-label" style={{ fontSize: 11 }}>시작일</label><input type="date" className="form-input" value={String(editForm.start_date ?? "")} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} /></div>
            <div><label className="form-label" style={{ fontSize: 11 }}>종료일</label><input type="date" className="form-input" value={String(editForm.end_date ?? "")} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            <div><label className="form-label" style={{ fontSize: 11 }}>연수 기간 (주)</label><input type="number" className="form-input" value={String(editForm.duration_weeks ?? "")} onChange={e => setEditForm(f => ({ ...f, duration_weeks: e.target.value }))} /></div>
            <div><label className="form-label" style={{ fontSize: 11 }}>화상수업 기간 (주)</label><input type="number" className="form-input" value={String(editForm.class_duration_weeks ?? "")} onChange={e => setEditForm(f => ({ ...f, class_duration_weeks: e.target.value }))} /></div>
          </div>
          {(editTarget.class_period === "both" || (editTarget.pre_sessions > 0 && editTarget.post_sessions > 0)) ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div><label className="form-label" style={{ fontSize: 11 }}>연수전 회차</label><input type="number" className="form-input" value={String(editForm.pre_sessions ?? "")} onChange={e => setEditForm(f => ({ ...f, pre_sessions: Number(e.target.value) }))} /></div>
              <div><label className="form-label" style={{ fontSize: 11 }}>연수후 회차</label><input type="number" className="form-input" value={String(editForm.post_sessions ?? "")} onChange={e => setEditForm(f => ({ ...f, post_sessions: Number(e.target.value) }))} /></div>
              <div><label className="form-label" style={{ fontSize: 11 }}>총 회차</label><input type="number" className="form-input" value={String(editForm.total_sessions ?? "")} onChange={e => setEditForm(f => ({ ...f, total_sessions: Number(e.target.value) }))} /></div>
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ fontSize: 11 }}>총 회차</label>
              <input type="number" className="form-input" value={String(editForm.total_sessions ?? "")} onChange={e => setEditForm(f => ({ ...f, total_sessions: Number(e.target.value), post_sessions: Number(e.target.value), pre_sessions: 0 }))} />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ fontSize: 11 }}>손님 앱(계정) 연결</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input className="form-input" value={editForm.customer_user_id ? (acctLabels[String(editForm.customer_user_id)] || String(editForm.customer_user_id).slice(0, 8) + "…") : ""} readOnly placeholder="미연결 — 🔍로 검색" style={{ flex: 1, background: editForm.customer_user_id ? "#f0fdf4" : undefined, cursor: "default" }} />
              <button type="button" className="btn-sm" onClick={() => { setAcctModal("edit"); setAcctQ(""); setAcctResults([]); }} style={{ whiteSpace: "nowrap" }}>🔍 계정 찾기</button>
              {editForm.customer_user_id ? <button type="button" className="btn-sm" style={{ color: "#dc2626" }} onClick={() => setEditForm(f => ({ ...f, customer_user_id: null, portal_open: false }))}>해제</button> : null}
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginBottom: 12, cursor: "pointer", fontWeight: 700, color: editForm.portal_open ? "#166534" : "#64748b" }}>
            <input type="checkbox" checked={editForm.portal_open === true} onChange={e => setEditForm(f => ({ ...f, portal_open: e.target.checked }))} />
            📱 손님 앱(포털) 공개 — 체크한 수강권만 손님 화상영어 탭에 표시
          </label>
          <div style={{ marginBottom: 12 }}>
            <label className="form-label" style={{ fontSize: 11 }}>상태</label>
            <select className="form-input" value={String(editForm.status ?? "active")} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
              <option value="active">수업중</option>
              <option value="completed">완료</option>
              <option value="paused">일시중지</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontSize: 11 }}>특이사항</label>
            <textarea className="form-input" value={String(editForm.notes ?? "")} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: "vertical", minHeight: 60 }} />
          </div>
          <div className="btns">
            <button className="btn cancel" disabled={editSaving} onClick={() => setEditTarget(null)}>취소</button>
            <button className="btn confirm" disabled={editSaving} onClick={saveEdit}>{editSaving ? "저장 중..." : "저장"}</button>
          </div>
        </div>
      </div>
    )}

    {cancelTarget && (() => {
      const { session, daysBefore } = cancelTarget;
      const isMakeup = daysBefore >= 4;
      return (
        <div className="modal-bg" onClick={() => !cancelling && setCancelTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{isMakeup ? "보강 처리" : "⚠️ 회차 차감 안내"}</h3>
            <p>
              <b>#{session.session_number}</b> · {session.scheduled_date} {session.scheduled_time_kr ? `· ${session.scheduled_time_kr}` : ""}<br />
              취소까지 <b>{daysBefore}일</b> 남음
            </p>
            <p>
              {isMakeup
                ? "보강으로 처리됩니다. 마지막 회차에 1회 자동 추가됩니다."
                : "3일 이내 취소는 회차가 차감됩니다. 계속하시겠습니까?"}
            </p>
            <div className="btns">
              <button className="btn cancel" disabled={cancelling} onClick={() => setCancelTarget(null)}>닫기</button>
              <button className={`btn ${isMakeup ? "confirm" : "danger"}`} disabled={cancelling} onClick={confirmCancel}>
                {cancelling ? "처리 중..." : isMakeup ? "보강 처리" : "차감하고 취소"}
              </button>
            </div>
          </div>
        </div>
      );
    })()}

      {acctModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setAcctModal(null)}>
          <div style={{ background: "#fff", borderRadius: 14, width: "min(480px, 92vw)", padding: 22 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>🔍 손님 앱 계정 찾기</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <input className="form-input" autoFocus value={acctQ} onChange={e => setAcctQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") searchAccounts(); }} placeholder="이름 또는 아이디 (2글자 이상)" style={{ flex: 1 }} />
              <button className="btn-sm" onClick={searchAccounts} disabled={acctLoading}>{acctLoading ? "검색중…" : "검색"}</button>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {acctResults.length === 0 ? (
                <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 12.5, padding: 20 }}>이름이나 아이디로 검색하세요<br/>(회원가입한 손님 계정)</div>
              ) : acctResults.map((u: any) => (
                <div key={u.id} onClick={() => pickAccount(u)} style={{ padding: "9px 12px", borderRadius: 9, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #eef2f7", marginBottom: 6 }}>
                  <span><b>{u.name || "(이름 없음)"}</b> <span style={{ color: "#64748b", fontSize: 12 }}>{u.username}</span></span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{u.email || ""}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 8 }}>선택하면 계정이 연결되고 📱 앱 공개가 자동으로 켜져요. 우리가 대신 등록·변경해줄 때도 여기서 연결만 하면 손님 앱에 바로 보여요.</div>
          </div>
        </div>
      )}

    {/* 시간 선택 모달 */}
    {tpShow && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setTpShow(false)}>
        <div style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", minWidth: 340, maxWidth: 420, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 16, textAlign: "center" }}>{tpLabel}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {TIME_SLOTS.map(t => (
              <button
                key={t}
                onClick={() => selectTime(t)}
                style={{
                  padding: "10px 0", borderRadius: 10, border: "1px solid #e2e8f0",
                  background: "#f8fafc", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  color: "#334155", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#1e40af"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#1e40af"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#334155"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >{t}</button>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button onClick={() => setTpShow(false)} style={{ padding: "8px 24px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#64748b" }}>닫기</button>
          </div>
        </div>
      </div>
    )}
  </>);
}
