"use client";
import { useState, useEffect, useCallback } from "react";
import { toastOk, toastErr } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Tutor { id: string; name_display: string; name_en: string }
interface Enrollment {
  id: string; student_name: string; student_name_en: string | null;
  student_birth_year: string | null; tutor_id: string | null;
  tutor: Tutor | null;
  enrollment_type: string; level: string | null;
  days_of_week: string[]; class_time_kr: string | null; class_time_ph: string | null;
  start_date: string; end_date: string | null;
  duration_weeks: number | null; class_duration_weeks: number | null;
  class_period: string; sessions_per_week: number;
  total_sessions: number; pre_sessions: number; post_sessions: number;
  used_sessions: number; remaining_sessions: number | null;
  status: string; notes: string | null;
}
interface Session {
  id: string; enrollment_id: string; session_number: number;
  scheduled_date: string; scheduled_time_ph: string | null; scheduled_time_kr: string | null;
  status: string; is_makeup_added: boolean; note: string | null;
  session_note: string | null;
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

const DAYS = ["월", "화", "수", "목", "금", "토"];

export default function OnlineClassPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"list" | "register" | "requests">("list");

  // 변경요청 수신함
  const [changeReqs, setChangeReqs] = useState<any[]>([]);
  const [reqFilter, setReqFilter] = useState<"pending" | "all">("pending");
  const [reqProcessing, setReqProcessing] = useState<string | null>(null);

  // list tab
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tutorFilter, setTutorFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ session: Session; daysBefore: number } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [editTarget, setEditTarget] = useState<Enrollment | null>(null);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [editSaving, setEditSaving] = useState(false);

  // register tab
  const [periodTag, setPeriodTag] = useState<"standalone" | "pre" | "post">("standalone"); // 시기 구분 (등록 1건 = 수강권 1개)
  const [dayTimesOn, setDayTimesOn] = useState(false); // 요일별 시간 다르게
  const [dayTimes, setDayTimes] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    student_name: "", student_name_en: "", student_birth_year: "", customer_user_id: "",
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
    const res = await fetch("/api/online-class/enrollments");
    if (res.ok) { const d = await res.json(); setEnrollments(d.enrollments || []); }
  }, []);

  const loadTutors = useCallback(async () => {
    const res = await fetch("/api/online-class/tutors");
    if (res.ok) { const d = await res.json(); setTutors(d.tutors || []); }
  }, []);

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
      if (!window.confirm("승인하면 적용일 이후 예정 수업이 새 요일·시간으로 자동 재생성됩니다. 진행할까요?")) return;
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
      tutor_id: e.tutor?.id || "",
      days_of_week: [...(e.days_of_week || [])],
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
    });
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
      const res = await fetch("/api/online-class/enrollments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editTarget.id, ...editForm }),
      });
      const r = await res.json();
      if (!res.ok) { toastErr(r.error || "저장 실패"); return; }
      toastOk("수정 완료 ✅");
      setEditTarget(null);
      await loadEnrollments();
    } catch (e) {
      toastErr("저장 실패: " + (e instanceof Error ? e.message : "unknown"));
    } finally { setEditSaving(false); }
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
          class_period: periodTag,
          day_times: dt && Object.keys(dt).length > 0 ? dt : null,
          days_of_week: form.days_of_week,
          duration_weeks: Number(form.duration_weeks) || null,
          class_duration_weeks: Number(form.class_duration_weeks) || null,
          sessions_per_week: Number(form.sessions_per_week) || 3,
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

  const filtered = enrollments.filter(e => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (tutorFilter !== "all" && e.tutor?.name_display !== tutorFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.student_name?.toLowerCase().includes(q) && !e.student_name_en?.toLowerCase().includes(q)) return false;
    }
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
        <button className="tab" onClick={() => router.push("/admin/online-class-attendance")}>📅 주간 스케줄</button>
        <button className="tab" onClick={() => router.push("/admin/online-class/availability")}>📊 가용 현황</button>
      </div>

      {/* ═══ TAB 1: 수강생 목록 ═══ */}
      {tab === "list" && <>
        <div className="toolbar">
          <input placeholder="학생명/영문명 검색" value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: 160 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">전체 상태</option>
            <option value="active">수업중</option>
            <option value="completed">완료</option>
            <option value="paused">일시중지</option>
          </select>
          <select value={tutorFilter} onChange={e => setTutorFilter(e.target.value)}>
            <option value="all">전체 튜터</option>
            {tutors.map(t => <option key={t.id} value={t.name_display}>{t.name_display}</option>)}
          </select>
          <span className="cnt">{filtered.length}명</span>
        </div>

        <div className="sec">
          {filtered.length === 0 ? (
            <div className="empty">등록된 수강생이 없습니다</div>
          ) : (
            <table className="tbl">
              <thead><tr>
                <th>학생명</th><th>영문명</th><th>담당T</th><th>요일</th><th>한국시간</th>
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
                    <tr key={e.id} style={{ cursor: "pointer", background: expandedId === e.id ? "#eff6ff" : undefined }} onClick={() => loadSessions(e.id)}>
                      <td style={{ fontWeight: 700 }}>{e.student_name}
                        {isSplit && <span title="연수전/연수후 분리 수강 (구버전)" style={{ marginLeft: 4, fontSize: 9, background: "#ede9fe", color: "#6d28d9", padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>전·후</span>}
                        {e.class_period === "pre" && <span style={{ marginLeft: 4, fontSize: 9, background: "#e1f5ee", color: "#085041", padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>연수전</span>}
                        {e.class_period === "standalone" && <span style={{ marginLeft: 4, fontSize: 9, background: "#f1f5f9", color: "#475569", padding: "1px 5px", borderRadius: 8, fontWeight: 700 }}>단독</span>}
                      </td>
                      <td>{e.student_name_en || "-"}</td>
                      <td>{e.tutor?.name_display || "-"}</td>
                      <td>{daysToKr(e.days_of_week)}</td>
                      <td>{e.class_time_kr || "-"}</td>
                      <td style={{ fontSize: 11 }}>{e.start_date || "-"} ~ {e.end_date || "-"}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ flex: 1, height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden", minWidth: 60 }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: rem <= 3 ? "#ef4444" : "#1a6fc4", borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: rem <= 3 ? "#dc2626" : "#166534", whiteSpace: "nowrap" }}>{rem} / {total}</span>
                        </div>
                      </td>
                      <td><span className="badge" style={{ background: stBg, color: stColor }}>{stLabel}</span></td>
                      <td style={{ whiteSpace: "nowrap" }} onClick={ev => ev.stopPropagation()}>
                        <button className="btn-sm" onClick={() => loadSessions(e.id)}>출결</button>
                        {" "}
                        <button className="btn-sm" style={{ color: "#1a6fc4", borderColor: "#93c5fd" }} onClick={() => openEditModal(e)}>수정</button>
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
      </>}

      {/* ═══ TAB 2: 수강 등록 ═══ */}
      {tab === "register" && <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div className="form-card">
          <div className="section-title">학생 정보</div>
          <div className="form-row">
            <div><label className="form-label">학생명 (한국어) *</label><input className="form-input" value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })} placeholder="홍길동" /></div>
            <div><label className="form-label">영문명</label><input className="form-input" value={form.student_name_en} onChange={e => setForm({ ...form, student_name_en: e.target.value })} placeholder="Gildong" /></div>
          </div>
          <div className="form-row">
            <div><label className="form-label">출생연도</label><input className="form-input" value={form.student_birth_year} onChange={e => setForm({ ...form, student_birth_year: e.target.value })} placeholder="18년생" /></div>
            <div><label className="form-label">손님 계정 ID</label><input className="form-input" value={form.customer_user_id} onChange={e => setForm({ ...form, customer_user_id: e.target.value })} placeholder="선택" /></div>
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
            <div><label className="form-label">한국 수업 시간</label><input className="form-input" value={form.class_time_kr} onChange={e => setForm({ ...form, class_time_kr: e.target.value })} placeholder="21:00" disabled={dayTimesOn} style={dayTimesOn ? { background: "#f8fafc", opacity: 0.6 } : undefined} /></div>
            <div><label className="form-label">필리핀 수업 시간</label><input className="form-input" value={form.class_time_ph} onChange={e => setForm({ ...form, class_time_ph: e.target.value })} placeholder="20:00" disabled={dayTimesOn} style={dayTimesOn ? { background: "#f8fafc", opacity: 0.6 } : undefined} /></div>
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
                  <input className="form-input" value={dayTimes[d] || ""} onChange={e => setDayTimes(t => ({ ...t, [d]: e.target.value }))} placeholder="17:00" />
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
            <div><label className="form-label">종료일</label><input type="date" className="form-input" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div><label className="form-label">기간 (주)</label><input type="number" className="form-input" value={form.duration_weeks} onChange={e => setForm({ ...form, duration_weeks: e.target.value })} placeholder="자동계산" /></div>
            <div><label className="form-label">화상수업기간 (주)</label><input type="number" className="form-input" value={form.class_duration_weeks} onChange={e => setForm({ ...form, class_duration_weeks: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div>
              <label className="form-label">주 수업 횟수</label>
              <select className="form-input" value={form.sessions_per_week} onChange={e => setForm({ ...form, sessions_per_week: e.target.value })}>
                <option value="1">1회</option>
                <option value="2">2회</option>
                <option value="3">3회</option>
                <option value="5">5회</option>
              </select>
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

        <button className="submit-btn" onClick={submitEnrollment} disabled={submitting}>{submitting ? "등록 중..." : "수강 등록"}</button>
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center", background: "#f8fafc", borderRadius: 8, padding: "10px 12px", fontSize: 12.5 }}>
                    <div>
                      <div style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 700, marginBottom: 2 }}>현재</div>
                      {daysToKr(en.days_of_week || [])} {en.class_time_kr || ""}
                    </div>
                    <div style={{ fontSize: 16, color: "#1a6fc4" }}>→</div>
                    <div>
                      <div style={{ fontSize: 10.5, color: "#1a6fc4", fontWeight: 700, marginBottom: 2 }}>요청 (적용일 {r.effective_from})</div>
                      <b>{r.req_days_of_week?.length ? daysToKr(r.req_days_of_week) : daysToKr(en.days_of_week || [])} {r.req_time_kr || en.class_time_kr || ""}</b>
                    </div>
                  </div>
                  {r.memo && <div style={{ fontSize: 12, color: "#475569", marginTop: 8 }}>💬 {r.memo}</div>}
                  {r.admin_note && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>관리자: {r.admin_note}</div>}
                  {r.status === "pending" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button className="btn-sm" disabled={reqProcessing === r.id} style={{ background: "#0d9488", color: "#fff", borderColor: "#0d9488", padding: "7px 16px" }} onClick={() => processReq(r.id, "approve")}>
                        {reqProcessing === r.id ? "처리 중..." : "✓ 승인 (세션 재생성 + 튜터 알림)"}
                      </button>
                      <button className="btn-sm" disabled={reqProcessing === r.id} style={{ color: "#dc2626", borderColor: "#fecaca", padding: "7px 16px" }} onClick={() => processReq(r.id, "reject")}>거절</button>
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
                        {s.status === "scheduled" && (
                          <button className="cancel-btn" onClick={() => openCancelModal(s)} title="취소">×</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14 }}>O 출석 · X 결석/차감취소 · △ 보강 · 예정 칸에 마우스 올리면 × 취소 버튼</div>
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
            <div><label className="form-label" style={{ fontSize: 11 }}>한국 시간</label><input className="form-input" value={String(editForm.class_time_kr ?? "")} onChange={e => setEditForm(f => ({ ...f, class_time_kr: e.target.value }))} /></div>
            <div><label className="form-label" style={{ fontSize: 11 }}>필리핀 시간</label><input className="form-input" value={String(editForm.class_time_ph ?? "")} onChange={e => setEditForm(f => ({ ...f, class_time_ph: e.target.value }))} /></div>
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
  </>);
}
