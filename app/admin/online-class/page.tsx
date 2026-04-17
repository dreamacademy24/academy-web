"use client";
import { useState, useEffect, useCallback } from "react";
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
  const [tab, setTab] = useState<"list" | "register">("list");

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

  // register tab
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

  useEffect(() => { if (authed) { loadEnrollments(); loadTutors(); } }, [authed, loadEnrollments, loadTutors]);

  // auto-calc total
  useEffect(() => {
    const pre = Number(form.pre_sessions) || 0;
    const post = Number(form.post_sessions) || 0;
    setForm(f => ({ ...f, total_sessions: String(pre + post) }));
  }, [form.pre_sessions, form.post_sessions]);

  // auto-calc duration
  useEffect(() => {
    if (form.start_date && form.end_date) {
      const diff = Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / (7 * 24 * 60 * 60 * 1000));
      setForm(f => ({ ...f, duration_weeks: String(diff > 0 ? diff : "") }));
    }
  }, [form.start_date, form.end_date]);

  async function loadSessions(enrollmentId: string) {
    if (expandedId === enrollmentId) { setExpandedId(null); return; }
    setExpandedId(enrollmentId);
    setSessionsLoading(true);
    const res = await fetch(`/api/online-class/sessions?enrollment_id=${enrollmentId}`);
    if (res.ok) { const d = await res.json(); setSessions(d.sessions || []); }
    setSessionsLoading(false);
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
      if (!res.ok) { alert(r.error || "취소 실패"); return; }
      alert(r.message || (r.makeup_added ? "보강 처리되었습니다." : "취소되었습니다."));
      setCancelTarget(null);
      if (expandedId) {
        const res2 = await fetch(`/api/online-class/sessions?enrollment_id=${expandedId}`);
        if (res2.ok) { const d = await res2.json(); setSessions(d.sessions || []); }
      }
      await loadEnrollments();
    } catch (e) {
      alert("취소 실패: " + (e instanceof Error ? e.message : "unknown"));
    } finally {
      setCancelling(false);
    }
  }

  function toggleDay(d: string) {
    setForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(d) ? f.days_of_week.filter(x => x !== d) : [...f.days_of_week, d],
    }));
  }

  async function submitEnrollment() {
    if (!form.student_name.trim()) { alert("학생명을 입력해주세요"); return; }
    if (!form.start_date) { alert("시작일을 입력해주세요"); return; }
    if (!form.days_of_week.length) { alert("수강 요일을 선택해주세요"); return; }
    if (Number(form.total_sessions) < 1) { alert("총 회차를 입력해주세요"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/online-class/enrollments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          days_of_week: form.days_of_week,
          duration_weeks: Number(form.duration_weeks) || null,
          class_duration_weeks: Number(form.class_duration_weeks) || null,
          sessions_per_week: Number(form.sessions_per_week) || 3,
          total_sessions: Number(form.total_sessions),
          pre_sessions: Number(form.pre_sessions) || 0,
          post_sessions: Number(form.post_sessions) || 0,
          tutor_id: form.tutor_id || null,
        }),
      });
      if (!res.ok) { const r = await res.json(); alert(r.error || "등록 실패"); return; }
      const r = await res.json();
      alert(`등록 완료! 세션 ${r.sessions_created}개 생성됨 ✅`);
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
    } catch (e) { alert("등록 실패: " + (e instanceof Error ? e.message : "unknown")); }
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
.oc-w{max-width:1100px;margin:0 auto;padding:28px 20px}
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
        <h1>화상영어 출결 관리</h1>
        <button
          onClick={() => router.push("/admin/online-class/availability")}
          style={{ marginLeft: "auto", padding: "8px 14px", background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >📊 시간대별 가용 현황</button>
      </div>

      <div className="tabs">
        <button className={`tab${tab === "list" ? " ac" : ""}`} onClick={() => setTab("list")}>📋 수강생 목록</button>
        <button className={`tab${tab === "register" ? " ac" : ""}`} onClick={() => setTab("register")}>➕ 수강 등록</button>
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
                <th>시작일</th><th>종료일</th><th>기간</th>
                <th>전</th><th>후</th><th>총</th><th>사용</th><th>잔여</th>
                <th>상태</th><th>관리</th>
              </tr></thead>
              <tbody>
                {filtered.map(e => {
                  const stLabel = STATUS_LABEL[e.status] || e.status;
                  const stBg = STATUS_BG[e.status] || "#f1f5f9";
                  const stColor = STATUS_COLOR[e.status] || "#64748b";
                  const isOpen = expandedId === e.id;
                  return (
                    <tr key={e.id} style={{ cursor: "default" }}>
                      <td style={{ fontWeight: 700 }}>{e.student_name}</td>
                      <td>{e.student_name_en || "-"}</td>
                      <td>{e.tutor?.name_display || "-"}</td>
                      <td>{daysToKr(e.days_of_week)}</td>
                      <td>{e.class_time_kr || "-"}</td>
                      <td>{e.start_date || "-"}</td>
                      <td>{e.end_date || "-"}</td>
                      <td>{e.duration_weeks ? `${e.duration_weeks}주` : "-"}</td>
                      <td>{e.pre_sessions}</td>
                      <td>{e.post_sessions}</td>
                      <td style={{ fontWeight: 700 }}>{e.total_sessions}</td>
                      <td>{e.used_sessions}</td>
                      <td style={{ fontWeight: 700, color: (e.remaining_sessions ?? 0) <= 3 ? "#dc2626" : "#166534" }}>{e.remaining_sessions ?? "-"}</td>
                      <td><span className="badge" style={{ background: stBg, color: stColor }}>{stLabel}</span></td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn-sm" onClick={() => loadSessions(e.id)}>{isOpen ? "접기" : "출결"}</button>
                        {" "}
                        <button className="btn-sm" onClick={() => router.push(`/admin/online-class/invoice?enrollment_id=${e.id}`)}>인보이스</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* 출결 현황 accordion */}
          {expandedId && (
            <div style={{ padding: "12px 4px", borderTop: "2px solid #e2e8f0", marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "#374151" }}>
                출결 현황 — {enrollments.find(e => e.id === expandedId)?.student_name}
              </div>
              {sessionsLoading ? (
                <div style={{ textAlign: "center", padding: 20, color: "#94a3b8" }}>로딩 중...</div>
              ) : sessions.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "#94a3b8" }}>세션이 없습니다</div>
              ) : (
                <div className="ses-row">
                  {sessions.map(s => {
                    let st = SES_STYLE[s.status] || SES_STYLE.scheduled;
                    // cancelled within 3 days = red X (deducted), 4+ days = yellow △ (makeup)
                    if (s.status === "cancelled") {
                      const dB = s.cancel_days_before;
                      st = (dB != null && dB >= 4) ? SES_STYLE.makeup : SES_STYLE.cancelled;
                    }
                    const d = s.scheduled_date ? `${Number(s.scheduled_date.split("-")[1])}/${Number(s.scheduled_date.split("-")[2])}` : "";
                    const tt = `#${s.session_number} ${s.scheduled_date} ${s.status}` + (s.cancel_days_before != null ? ` (${s.cancel_days_before}d)` : "");
                    return (
                      <div key={s.id} className="ses-cell" style={{ background: st.bg, color: st.color }} title={tt}>
                        <div className="num">{d}</div>
                        <div>{st.label}</div>
                        {s.status === "scheduled" && (
                          <button className="cancel-btn" onClick={() => openCancelModal(s)} title="취소">×</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
            <div><label className="form-label">한국 수업 시간</label><input className="form-input" value={form.class_time_kr} onChange={e => setForm({ ...form, class_time_kr: e.target.value })} placeholder="21:00" /></div>
            <div><label className="form-label">필리핀 수업 시간</label><input className="form-input" value={form.class_time_ph} onChange={e => setForm({ ...form, class_time_ph: e.target.value })} placeholder="20:00" /></div>
          </div>
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
              <label className="form-label">수업 구분</label>
              <select className="form-input" value={form.class_period} onChange={e => setForm({ ...form, class_period: e.target.value })}>
                <option value="pre">전 (pre)</option>
                <option value="post">후 (post)</option>
                <option value="both">전후 (both)</option>
              </select>
            </div>
            <div>
              <label className="form-label">주 수업 횟수</label>
              <select className="form-input" value={form.sessions_per_week} onChange={e => setForm({ ...form, sessions_per_week: e.target.value })}>
                <option value="2">2회</option>
                <option value="3">3회</option>
                <option value="5">5회</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div><label className="form-label">수업 전 회차</label><input type="number" className="form-input" value={form.pre_sessions} onChange={e => setForm({ ...form, pre_sessions: e.target.value })} /></div>
            <div><label className="form-label">수업 후 회차</label><input type="number" className="form-input" value={form.post_sessions} onChange={e => setForm({ ...form, post_sessions: e.target.value })} /></div>
          </div>
          <div className="form-mb">
            <label className="form-label">총 회차 (자동계산)</label>
            <input type="number" className="form-input" value={form.total_sessions} readOnly style={{ background: "#f8fafc", fontWeight: 700 }} />
          </div>
        </div>

        <div className="form-card">
          <div className="section-title">특이사항</div>
          <textarea className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="특이사항 메모" style={{ resize: "vertical", minHeight: 80 }} />
        </div>

        <button className="submit-btn" onClick={submitEnrollment} disabled={submitting}>{submitting ? "등록 중..." : "수강 등록"}</button>
      </div>}
    </div>

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
