"use client";
import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Tutor { id: string; name_display: string; name_en: string }
interface Enrollment {
  id: string; student_name: string; student_name_en: string | null;
  customer_user_id: string | null;
  tutor_id: string | null; tutor: Tutor | null;
  enrollment_type: string; level: string | null;
  days_of_week: string[]; class_time_kr: string | null; class_time_ph: string | null;
  start_date: string; end_date: string | null;
  class_period: string; sessions_per_week: number;
  total_sessions: number; pre_sessions: number; post_sessions: number;
  used_sessions: number;
  status: string; notes: string | null;
}
interface Session {
  id: string; enrollment_id: string; session_number: number;
  scheduled_date: string; scheduled_time_kr: string | null; scheduled_time_ph: string | null;
  status: string; note: string | null; cancel_days_before?: number | null;
}

const DAY_KR: Record<string, string> = {
  mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일",
  "월": "월", "화": "화", "수": "수", "목": "목", "금": "금", "토": "토", "일": "일",
};
function daysToKr(days: string[]) { return (days || []).map(d => DAY_KR[d.toLowerCase()] || d).join("/"); }

const PERIOD_LABEL: Record<string, string> = { pre: "연수전", post: "연수후", both: "연수전후", standalone: "화상수업", ssp: "SSP" };

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  scheduled:  { label: "예정",   bg: "#dbeafe", color: "#1e40af" },
  attended:   { label: "출석",   bg: "#dcfce7", color: "#166534" },
  absent:     { label: "결석",   bg: "#fef2f2", color: "#dc2626" },
  no_show:    { label: "결석",   bg: "#fef2f2", color: "#dc2626" },
  cancelled:  { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
  makeup:     { label: "보강",   bg: "#fef9c3", color: "#92400e" },
};

const WEEKDAY_HEADS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTHS_KR = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function pad2(n: number) { return n < 10 ? "0" + n : "" + n }
function localStr(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }
function parseLocal(s: string): Date { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d) }
function fmtDateKr(s: string) {
  const d = parseLocal(s);
  const wd = ["일","월","화","수","목","금","토"][d.getDay()];
  return `${d.getMonth()+1}월 ${d.getDate()}일 ${wd}요일`;
}
function daysBefore(targetDate: string): number {
  const today = new Date(); today.setHours(0,0,0,0);
  const sched = parseLocal(targetDate); sched.setHours(0,0,0,0);
  return Math.round((sched.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function PortalOnlineClassPage() {
  return (
    <Suspense fallback={null}>
      <PortalOnlineClassInner />
    </Suspense>
  );
}

function PortalOnlineClassInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const testUser = searchParams.get("test_user") === "true";
  const previewUid = searchParams.get("preview_uid") || "";

  const [authChecking, setAuthChecking] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [calMonth, setCalMonth] = useState<Date>(() => { const d = new Date(); d.setDate(1); return d });
  const [cancelTarget, setCancelTarget] = useState<{ session: Session; info: any } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  // 변경 요청
  const [changeOpen, setChangeOpen] = useState(false);
  const [singleTarget, setSingleTarget] = useState<Session | null>(null); // 1회차 변경 대상
  const [sgDate, setSgDate] = useState("");
  const [sgTime, setSgTime] = useState("");
  const [sgMemo, setSgMemo] = useState("");
  const [sgSubmitting, setSgSubmitting] = useState(false);
  const [chDays, setChDays] = useState<string[]>([]);
  const [chTime, setChTime] = useState("");
  const [chEff, setChEff] = useState("");
  const [chMemo, setChMemo] = useState("");
  const [chSubmitting, setChSubmitting] = useState(false);
  const [myReqs, setMyReqs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      if (testUser) { setAuthChecking(false); return; }
      if (previewUid) { setAuthUserId(previewUid); setAuthChecking(false); return; }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (typeof window !== "undefined") router.replace("/login");
        return;
      }
      setAuthUserId(data.session.user.id);
      setAuthEmail(data.session.user.email || null);
      setAuthChecking(false);
    })();
  }, [router, testUser, previewUid]);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = testUser ? "test_user=true" : `customer_user_id=${authUserId}`;
    const res = await fetch(`/api/portal/online-class/enrollments?${qs}`);
    if (res.ok) {
      const d = await res.json();
      setEnrollments(d.enrollments || []);
      setSessions(d.sessions || []);
    }
    setLoading(false);
  }, [authUserId, testUser]);

  useEffect(() => { if (!authChecking && (authUserId || testUser)) load(); }, [authChecking, authUserId, testUser, load]);

  // 내 변경요청 조회 (검토 중 표시용)
  useEffect(() => {
    (async () => {
      const uid = authUserId || enrollments[0]?.customer_user_id;
      if (!uid) return;
      const res = await fetch(`/api/portal/online-class/change-request?customer_user_id=${uid}`);
      if (res.ok) {
        const d = await res.json();
        setMyReqs(d.requests || []);
        // 읽음 처리 — 대시보드 화상영어 빨간 뱃지용 상태 스냅샷 갱신
        try {
          const snap = JSON.parse(localStorage.getItem("apps_status_seen") || "{}");
          (d.requests || []).forEach((it: any) => { snap[`ocreq:${it.id}`] = String(it.status ?? ""); });
          localStorage.setItem("apps_status_seen", JSON.stringify(snap));
        } catch {}
      }
    })();
  }, [authUserId, enrollments]);

  async function submitChange() {
    if (!activeEnroll) return;
    const uid = testUser ? activeEnroll.customer_user_id : authUserId;
    if (!uid) { setMsg({ text: "계정 연결 정보가 없습니다. 관리자에게 문의해주세요.", type: "err" }); return; }
    if (!chEff) { setMsg({ text: "적용 시작일을 선택해주세요.", type: "err" }); return; }
    if (chDays.length === 0 && !chTime.trim()) { setMsg({ text: "변경할 요일 또는 시간을 입력해주세요.", type: "err" }); return; }
    setChSubmitting(true);
    try {
      const res = await fetch("/api/portal/online-class/change-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollment_id: activeEnroll.id, customer_user_id: uid,
          req_days_of_week: chDays, req_time_kr: chTime.trim() || null,
          effective_from: chEff, memo: chMemo.trim() || null,
        }),
      });
      const r = await res.json();
      if (!res.ok) { setMsg({ text: r.error || "신청에 실패했습니다.", type: "err" }); return; }
      setMsg({ text: "변경 요청이 접수되었습니다. 확인 후 안내드릴게요 😊", type: "ok" });
      setChangeOpen(false); setChDays([]); setChTime(""); setChEff(""); setChMemo("");
      setMyReqs(prev => [r.request, ...prev]);
    } finally { setChSubmitting(false); }
  }

  async function submitSingle() {
    if (!activeEnroll || !singleTarget) return;
    const uid = testUser ? activeEnroll.customer_user_id : authUserId;
    if (!uid) { setMsg({ text: "계정 연결 정보가 없습니다.", type: "err" }); return; }
    if (!sgDate && !sgTime.trim()) { setMsg({ text: "새 날짜 또는 시간을 입력해주세요.", type: "err" }); return; }
    setSgSubmitting(true);
    try {
      const res = await fetch("/api/portal/online-class/change-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollment_id: activeEnroll.id, customer_user_id: uid,
          req_type: "single", session_id: singleTarget.id,
          req_date: sgDate || null, req_time_kr: sgTime.trim() || null, memo: sgMemo.trim() || null,
        }),
      });
      const r = await res.json();
      if (!res.ok) { setMsg({ text: r.error || "신청에 실패했습니다.", type: "err" }); return; }
      setMsg({ text: "1회차 변경 요청이 접수되었습니다. 선생님·담당자 확인 후 반영돼요 😊", type: "ok" });
      setSingleTarget(null); setSgDate(""); setSgTime(""); setSgMemo("");
      setMyReqs(prev => [r.request, ...prev]);
    } finally { setSgSubmitting(false); }
  }

  const [selEnrollId, setSelEnrollId] = useState<string | null>(null);
  const activeEnroll = useMemo(
    () => enrollments.find(e => e.id === selEnrollId) || enrollments.find(e => e.status === "active") || enrollments[0] || null,
    [enrollments, selEnrollId]
  );
  const activeSessions = useMemo(
    () => activeEnroll ? sessions.filter(s => s.enrollment_id === activeEnroll.id) : [],
    [sessions, activeEnroll]
  );
  // 달력을 "다음 예정 수업(없으면 마지막 수업)"이 있는 달로 자동 이동 (수업이 미래 달에 있을 때 빈 달로 열려 비어 보이는 문제 방지)
  const _calInit = useRef(false);
  useEffect(() => {
    if (_calInit.current || activeSessions.length === 0) return;
    const today = localStr(new Date());
    const upcoming = [...activeSessions].filter(s => s.scheduled_date >= today).sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date))[0];
    const target = upcoming || [...activeSessions].sort((a,b)=>b.scheduled_date.localeCompare(a.scheduled_date))[0];
    if (target) { const d = new Date(target.scheduled_date + "T00:00:00"); d.setDate(1); setCalMonth(d); _calInit.current = true; }
  }, [activeSessions]);

  const upcomingSessions = useMemo(
    () => activeSessions.filter(s => s.status === "scheduled").sort((a,b) => a.scheduled_date.localeCompare(b.scheduled_date)),
    [activeSessions]
  );
  const pastSessions = useMemo(
    () => activeSessions.filter(s => ["attended", "absent", "no_show", "cancelled", "makeup"].includes(s.status))
      .sort((a,b) => b.scheduled_date.localeCompare(a.scheduled_date)),
    [activeSessions]
  );

  const sessionsByDate = useMemo(() => {
    const map: Record<string, Session[]> = {};
    for (const s of activeSessions) {
      if (!map[s.scheduled_date]) map[s.scheduled_date] = [];
      map[s.scheduled_date].push(s);
    }
    return map;
  }, [activeSessions]);

  const calendarCells = useMemo(() => {
    const y = calMonth.getFullYear();
    const m = calMonth.getMonth();
    const first = new Date(y, m, 1);
    const startWd = first.getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const cells: Array<{ date: Date | null; dateStr: string | null }> = [];
    for (let i = 0; i < startWd; i++) cells.push({ date: null, dateStr: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(y, m, d);
      cells.push({ date: dt, dateStr: localStr(dt) });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, dateStr: null });
    return cells;
  }, [calMonth]);

  function shiftMonth(delta: number) {
    const nm = new Date(calMonth);
    nm.setMonth(nm.getMonth() + delta);
    setCalMonth(nm);
  }

  async function openCancel(session: Session) {
    if (!activeEnroll) return;
    setCancelLoading(true);
    try {
      const res = await fetch("/api/portal/online-class/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          customer_user_id: testUser ? activeEnroll.customer_user_id : authUserId,
          confirm: false,
        }),
      });
      const info = await res.json();
      if (!res.ok) { setMsg({ text: info.error || "오류가 발생했습니다.", type: "err" }); return; }
      setCancelReason("");
      setCancelTarget({ session, info });
    } catch {
      setMsg({ text: "네트워크 오류가 발생했습니다.", type: "err" });
    } finally {
      setCancelLoading(false);
    }
  }

  async function confirmCancel() {
    if (!cancelTarget || !activeEnroll) return;
    setCancelLoading(true);
    try {
      const res = await fetch("/api/portal/online-class/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: cancelTarget.session.id,
          customer_user_id: testUser ? activeEnroll.customer_user_id : authUserId,
          confirm: true,
          reason: cancelReason.trim() || undefined,
        }),
      });
      const r = await res.json();
      if (!res.ok) { setMsg({ text: r.error || "취소에 실패했습니다.", type: "err" }); return; }
      setMsg({ text: r.message_ko || "취소 완료되었습니다.", type: "ok" });
      setCancelTarget(null);
      await load();
    } finally {
      setCancelLoading(false);
    }
  }

  if (authChecking) return null;

  return (<>
    <style>{`
.oc-w{max-width:680px;margin:0 auto;padding:24px 20px 48px}
.oc-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:12px}
.oc-back:hover{color:#1a6fc4}
.oc-head{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:18px;padding:22px;color:#fff;margin-bottom:14px}
.oc-head h1{font-size:20px;font-weight:800;margin-bottom:4px}
.oc-head p{font-size:12px;opacity:0.88}
.sec{background:#fff;border-radius:14px;padding:18px;box-shadow:0 1px 8px rgba(0,0,0,0.05);margin-bottom:12px}
.sec h2{font-size:13px;font-weight:800;color:#1a6fc4;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.item{padding:10px;background:#f8fafc;border-radius:8px}
.item .lbl{font-size:10px;font-weight:700;color:#6b7c93;margin-bottom:3px}
.item .val{font-size:13px;font-weight:600}
.sess-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}
.stat{padding:14px 8px;background:#f8fafc;border-radius:10px;text-align:center}
.stat .num{font-size:22px;font-weight:800;color:#1a1a2e}
.stat .lbl{font-size:11px;color:#6b7c93;font-weight:600;margin-top:2px}
.stat.remain{background:#dcfce7}
.stat.remain .num{color:#166534}
.stat.used{background:#fef3c7}
.stat.used .num{color:#92400e}
.cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cal-title{font-size:14px;font-weight:800}
.cal-nav{display:flex;gap:6px}
.cal-nav button{width:28px;height:28px;border:1px solid #e2e8f0;background:#fff;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px}
.cal-nav button:hover{background:#f1f5f9}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.cal-wd{text-align:center;font-size:11px;font-weight:700;color:#6b7c93;padding:4px 0}
.cal-wd.sun{color:#dc2626}
.cal-wd.sat{color:#1d4ed8}
.cal-cell{aspect-ratio:1/1;border-radius:8px;padding:4px;font-size:12px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;border:1px solid transparent;position:relative}
.cal-cell.empty{visibility:hidden}
.cal-cell.today{border-color:#1a6fc4;background:#eff6ff}
.cal-cell .d{font-weight:600;color:#1a1a2e}
.cal-cell.today .d{color:#1a6fc4}
.cal-cell .marks{display:flex;gap:2px;margin-top:auto;padding-top:2px;flex-wrap:wrap;justify-content:center}
.cal-dot{width:6px;height:6px;border-radius:50%}
.cal-dot.scheduled{background:#3b82f6}
.cal-dot.attended{background:#16a34a}
.cal-dot.absent,.cal-dot.no_show{background:#dc2626}
.cal-dot.cancelled{background:#dc2626}
.cal-dot.makeup{background:#eab308}
.cal-legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:11px;color:#6b7c93}
.cal-legend span{display:inline-flex;align-items:center;gap:4px}
.tabs{display:flex;gap:6px;margin-bottom:12px;background:#f1f5f9;padding:4px;border-radius:10px}
.tab{flex:1;padding:9px 10px;border:none;background:transparent;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;color:#6b7c93}
.tab.active{background:#fff;color:#1a1a2e;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
.row{display:flex;align-items:center;justify-content:space-between;padding:12px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px}
.row .info{flex:1;min-width:0}
.row .date{font-size:13px;font-weight:700;margin-bottom:3px}
.row .meta{font-size:11px;color:#6b7c93;line-height:1.5}
.row .act{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.cancel-btn{padding:6px 12px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer}
.cancel-btn:hover{background:#fee2e2}
.cancel-btn:disabled{opacity:0.5;cursor:not-allowed}
.empty{text-align:center;padding:24px;color:#94a3b8;font-size:13px}
.msg{position:fixed;top:16px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:10px;font-size:13px;font-weight:700;z-index:100;box-shadow:0 4px 14px rgba(0,0,0,0.15)}
.msg.ok{background:#dcfce7;color:#166534}
.msg.err{background:#fef2f2;color:#dc2626}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px}
.modal{background:#fff;border-radius:14px;padding:22px;max-width:400px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,0.2)}
.modal h3{font-size:16px;font-weight:800;margin-bottom:8px}
.modal .detail{font-size:13px;color:#475569;background:#f8fafc;padding:10px;border-radius:8px;margin-bottom:12px}
.modal .ques{font-size:13px;line-height:1.65;margin-bottom:16px;white-space:pre-wrap}
.modal .acts{display:flex;gap:8px}
.modal .acts button{flex:1;padding:10px;border-radius:8px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;border:none}
.modal .btn-cancel{background:#f1f5f9;color:#475569}
.modal .btn-confirm{background:#dc2626;color:#fff}
.modal .btn-confirm:disabled{opacity:0.6;cursor:not-allowed}
@media(max-width:500px){.oc-w{padding:20px 14px}.grid{grid-template-columns:1fr}.sess-stats{grid-template-columns:1fr 1fr 1fr}}
    `}</style>

    {msg && <div className={`msg ${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

    <div className="oc-w">
      <button className="oc-back" onClick={() => router.push("/portal/dashboard")}>← 마이페이지로 돌아가기</button>

      <div className="oc-head">
        <h1>화상영어 수업</h1>
        <p>내 수업 스케줄 및 출결 현황</p>
      </div>

      {loading ? <div className="sec"><div className="empty">불러오는 중...</div></div> : !activeEnroll ? (
        <div className="sec"><div className="empty" style={{ padding: "36px 20px" }}>아직 신청한 화상영어 수업이 없어요.<br/><br/><button onClick={() => router.push("/portal/online-class/apply")} style={{ padding: "12px 28px", background: "#1a6fc4", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>➕ 화상영어 신규 신청</button><div style={{ fontSize: 12, color: "#94a3b8", marginTop: 12 }}>아이별로 요일·시간·레벨을 선택해 신청해요 (한 계정 최대 4명)</div></div></div>
      ) : (
        <>
          {enrollments.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {enrollments.map(e => (
                <button key={e.id} onClick={() => setSelEnrollId(e.id)}
                  style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                    borderColor: activeEnroll?.id === e.id ? "#1a6fc4" : "#e2e8f0",
                    background: activeEnroll?.id === e.id ? "#1a6fc4" : "#fff",
                    color: activeEnroll?.id === e.id ? "#fff" : "#475569" }}>
                  {e.student_name} · {PERIOD_LABEL[e.class_period] || "화상수업"}{e.status === "completed" ? " (완료)" : ""}
                </button>
              ))}
            </div>
          )}
          {(() => {
            const todayStr = localStr(new Date());
            const remaining = activeEnroll.total_sessions - activeEnroll.used_sessions;
            const ended = activeEnroll.status === "completed" || remaining <= 0 || (activeEnroll.end_date && activeEnroll.end_date < todayStr);
            if (!ended) return null;
            return (
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 14, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1e40af", marginBottom: 4 }}>🔔 화상영어 수업이 새롭게 시작됩니다</div>
                <div style={{ fontSize: 12.5, color: "#1d4ed8", lineHeight: 1.6 }}>
                  이번 수강이 마무리되었어요. 계속 수업을 원하시면 새 일정으로 등록해 주세요.
                </div>
                <button onClick={() => alert("재등록 신청 기능이 곧 오픈됩니다 😊\n우선 관리자(카카오톡)에게 말씀해 주시면 바로 등록해드려요!")}
                  style={{ marginTop: 8, padding: "8px 16px", background: "#1a6fc4", color: "#fff", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  재등록 신청하기
                </button>
              </div>
            );
          })()}
          <div className="sec">
            <h2>수강 정보</h2>
            <div className="grid">
              <div className="item"><div className="lbl">담당 선생님</div><div className="val">{activeEnroll.tutor?.name_display || "-"}</div></div>
              <div className="item"><div className="lbl">수업 구분</div><div className="val">{PERIOD_LABEL[activeEnroll.class_period] || activeEnroll.class_period}</div></div>
              <div className="item"><div className="lbl">수업 요일</div><div className="val">{daysToKr(activeEnroll.days_of_week || [])}</div></div>
              <div className="item"><div className="lbl">수업 시간 (한국)</div><div className="val">{activeEnroll.class_time_kr || "-"}</div></div>
              <div className="item"><div className="lbl">수강 시작</div><div className="val">{activeEnroll.start_date || "-"}</div></div>
              <div className="item"><div className="lbl">수강 종료</div><div className="val">{activeEnroll.end_date || "-"}</div></div>
            </div>
            <div className="sess-stats">
              <div className="stat"><div className="num">{activeEnroll.total_sessions}</div><div className="lbl">총 회차</div></div>
              <div className="stat used"><div className="num">{activeEnroll.used_sessions}</div><div className="lbl">사용 회차</div></div>
              <div className="stat remain"><div className="num">{activeEnroll.total_sessions - activeEnroll.used_sessions}</div><div className="lbl">잔여 회차</div></div>
            </div>
            {(() => {
              const total = activeEnroll.total_sessions || 0;
              const used = activeEnroll.used_sessions || 0;
              const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
              const rem = total - used;
              return (
                <div style={{ marginTop: 12 }}>
                  <div style={{ height: 10, background: "#e2e8f0", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: rem <= 3 ? "#ef4444" : "#1a6fc4", borderRadius: 5, transition: "width .3s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#6b7c93", marginTop: 5, fontWeight: 600 }}>
                    <span>{pct}% 진행</span>
                    {activeEnroll.end_date && <span>종료 예정 {activeEnroll.end_date}</span>}
                  </div>
                </div>
              );
            })()}
            {(() => {
              const pendingReq = myReqs.find(r => r.enrollment_id === activeEnroll.id && r.status === "pending");
              const lastDone = myReqs.find(r => r.enrollment_id === activeEnroll.id && r.status !== "pending");
              return (
                <div style={{ marginTop: 12 }}>
                  {pendingReq ? (
                    <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, color: "#92400e", fontWeight: 600 }}>
                      ⏳ 변경 요청 검토 중 — {pendingReq.req_days_of_week?.length ? pendingReq.req_days_of_week.join("/") : ""} {pendingReq.req_time_kr || ""} (적용일 {pendingReq.effective_from})
                    </div>
                  ) : (
                    <button onClick={() => { setChangeOpen(true); setChDays([]); setChTime(""); setChEff(""); setChMemo(""); }}
                      style={{ width: "100%", padding: "11px", background: "#fff", color: "#1a6fc4", border: "1.5px solid #93c5fd", borderRadius: 10, fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                      🔄 전체 요일·시간 변경 신청
                    </button>
                  )}
                  {lastDone && lastDone.status === "rejected" && lastDone.admin_note && (
                    <div style={{ fontSize: 11.5, color: "#dc2626", marginTop: 6 }}>지난 요청이 반려되었어요: {lastDone.admin_note}</div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="sec">
            <div className="cal-head">
              <div className="cal-title">{calMonth.getFullYear()}년 {MONTHS_KR[calMonth.getMonth()]}</div>
              <div className="cal-nav">
                <button onClick={() => shiftMonth(-1)}>‹</button>
                <button onClick={() => setCalMonth(() => { const d = new Date(); d.setDate(1); return d })}>오늘</button>
                <button onClick={() => shiftMonth(1)}>›</button>
              </div>
            </div>
            <div className="cal-grid">
              {WEEKDAY_HEADS.map((w, i) => (
                <div key={w} className={`cal-wd ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{w}</div>
              ))}
              {calendarCells.map((c, idx) => {
                if (!c.date || !c.dateStr) return <div key={idx} className="cal-cell empty" />;
                const todayStr = localStr(new Date());
                const isToday = c.dateStr === todayStr;
                const dayS = sessionsByDate[c.dateStr] || [];
                return (
                  <div key={idx} className={`cal-cell ${isToday ? "today" : ""}`}>
                    <div className="d">{c.date.getDate()}</div>
                    <div className="marks">
                      {dayS.map(s => <span key={s.id} className={`cal-dot ${s.status}`} title={STATUS_STYLE[s.status]?.label} />)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cal-legend">
              <span><span className="cal-dot scheduled" /> 예정</span>
              <span><span className="cal-dot attended" /> 출석</span>
              <span><span className="cal-dot cancelled" /> 취소</span>
              <span><span className="cal-dot makeup" /> 보강</span>
            </div>
          </div>

          <div className="sec">
            <h2>수업 목록</h2>
            <div className="tabs">
              <button className={`tab ${tab === "upcoming" ? "active" : ""}`} onClick={() => setTab("upcoming")}>예정된 수업 ({upcomingSessions.length})</button>
              <button className={`tab ${tab === "past" ? "active" : ""}`} onClick={() => setTab("past")}>지난 수업 ({pastSessions.length})</button>
            </div>
            {(tab === "upcoming" ? upcomingSessions : pastSessions).length === 0 ? (
              <div className="empty">{tab === "upcoming" ? "예정된 수업이 없습니다." : "지난 수업 기록이 없습니다."}</div>
            ) : (
              (tab === "upcoming" ? upcomingSessions : pastSessions).map(s => {
                const st = STATUS_STYLE[s.status] || STATUS_STYLE.scheduled;
                return (
                  <div key={s.id} className="row">
                    <div className="info">
                      <div className="date">{fmtDateKr(s.scheduled_date)} <span style={{fontSize:11,color:"#6b7c93",fontWeight:600}}>#{s.session_number}</span></div>
                      <div className="meta">
                        {s.scheduled_time_kr || activeEnroll.class_time_kr || "-"} · {activeEnroll.tutor?.name_display || "-"}
                      </div>
                    </div>
                    <div className="act">
                      <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      {tab === "upcoming" && s.status === "scheduled" && (() => {
                        const dU = Math.round((new Date(s.scheduled_date + "T00:00:00").getTime() - new Date(localStr(new Date()) + "T00:00:00").getTime()) / 86400000);
                        return (<>
                          {dU >= 4 && (
                            <button className="cancel-btn" style={{ background: "#eff6ff", color: "#1a6fc4", borderColor: "#bfdbfe" }} onClick={() => { setSingleTarget(s); setSgDate(""); setSgTime(""); setSgMemo(""); }}>변경</button>
                          )}
                          <button className="cancel-btn" disabled={cancelLoading} onClick={() => openCancel(s)}>취소 신청</button>
                        </>);
                      })()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>

    {/* 변경 요청 모달 */}
    {changeOpen && activeEnroll && (
      <div className="modal-bg" onClick={() => !chSubmitting && setChangeOpen(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>요일·시간 변경 요청</h3>
          <div className="detail">
            <b>전체 남은 일정</b>의 요일·시간을 바꾸는 신청이에요.<br />현재: {daysToKr(activeEnroll.days_of_week || [])} {activeEnroll.class_time_kr || ""}<br />바꾸고 싶은 항목만 입력하세요. 적용일 <b>4일 전까지</b> 신청 가능해요.
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>새 요일 (그대로면 비워두세요)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["월", "화", "수", "목", "금", "토"].map(d => (
                <button key={d} onClick={() => setChDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])}
                  style={{ padding: "8px 13px", borderRadius: 8, border: "1.5px solid", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    borderColor: chDays.includes(d) ? "#1a6fc4" : "#e2e8f0",
                    background: chDays.includes(d) ? "#1a6fc4" : "#fff",
                    color: chDays.includes(d) ? "#fff" : "#6b7c93" }}>{d}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>새 시간 (한국)</div>
              <input value={chTime} onChange={e => setChTime(e.target.value)} placeholder="예: 20:00"
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>적용 시작일 *</div>
              <input type="date" value={chEff} onChange={e => setChEff(e.target.value)}
                min={(() => { const d = new Date(); d.setDate(d.getDate() + 4); return localStr(d); })()}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>메모 (선택)</div>
            <textarea value={chMemo} onChange={e => setChMemo(e.target.value)} placeholder="예: 학원 일정이 바뀌어서요"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: 56 }} />
          </div>
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 12 }}>현지 선생님 승인 → 한국인 담당자 최종 승인 후 적용일 이후 일정이 새로 생성돼요. (특정 1회만 바꾸려면 각 수업의 [변경] 버튼을 이용하세요)</div>
          <div className="acts">
            <button className="btn-cancel" disabled={chSubmitting} onClick={() => setChangeOpen(false)}>닫기</button>
            <button style={{ flex: 1, padding: 10, borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: "#1a6fc4", color: "#fff", opacity: chSubmitting ? 0.6 : 1 }}
              disabled={chSubmitting} onClick={submitChange}>{chSubmitting ? "신청 중..." : "변경 요청하기"}</button>
          </div>
        </div>
      </div>
    )}

    {singleTarget && activeEnroll && (
      <div className="modal-bg" onClick={() => !sgSubmitting && setSingleTarget(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>이 수업만 날짜·시간 변경</h3>
          <div className="detail">
            원래 수업: <b>{fmtDateKr(singleTarget.scheduled_date)}</b> · #{singleTarget.session_number}회차<br />
            {singleTarget.scheduled_time_kr || activeEnroll.class_time_kr || ""} · {activeEnroll.tutor?.name_display || ""}<br />
            이 <b>1회차만</b> 옮겨요. (수업 4일 전까지 신청 가능)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "10px 0" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>새 날짜</div>
              <input type="date" value={sgDate} onChange={e => setSgDate(e.target.value)}
                min={(() => { const d = new Date(); d.setDate(d.getDate() + 1); return localStr(d); })()}
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 5 }}>새 시간 (한국, 선택)</div>
              <input value={sgTime} onChange={e => setSgTime(e.target.value)} placeholder="그대로면 비워두세요"
                style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }} />
            </div>
          </div>
          <textarea value={sgMemo} onChange={e => setSgMemo(e.target.value)} placeholder="메모 (선택) — 예: 그날 병원 예약이 있어요"
            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", resize: "vertical", minHeight: 52, marginBottom: 12 }} />
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 12 }}>현지 선생님 승인 → 한국인 담당자 최종 승인 후 이 수업 날짜가 바뀌어요.</div>
          <div className="acts">
            <button className="btn-cancel" disabled={sgSubmitting} onClick={() => setSingleTarget(null)}>닫기</button>
            <button style={{ flex: 1, padding: 10, borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: "#1a6fc4", color: "#fff", opacity: sgSubmitting ? 0.6 : 1 }}
              disabled={sgSubmitting} onClick={submitSingle}>{sgSubmitting ? "신청 중..." : "1회차 변경 요청"}</button>
          </div>
        </div>
      </div>
    )}

    {cancelTarget && (
      <div className="modal-bg" onClick={() => !cancelLoading && setCancelTarget(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>수업 취소 확인</h3>
          <div className="detail">
            {fmtDateKr(cancelTarget.session.scheduled_date)} · #{cancelTarget.session.session_number}회차<br/>
            {cancelTarget.session.scheduled_time_kr || activeEnroll?.class_time_kr}
          </div>
          <div className="ques">
            {(() => {
              const db = cancelTarget.info.days_before;
              if (db >= 4) {
                // 무차감 → 마지막 예정 수업 다음 수업일로 1회 밀림. 예상 새 종료일 계산
                const future = activeSessions.filter(s => s.status === "scheduled").map(s => s.scheduled_date).sort();
                const lastDate = future[future.length - 1];
                const days = (activeEnroll?.days_of_week || []) as string[];
                const DKR: Record<string, number> = { "일":0,"월":1,"화":2,"수":3,"목":4,"금":5,"토":6 };
                let nd = "";
                if (lastDate && days.length) { const c = new Date(lastDate + "T00:00:00"); for (let i=0;i<40;i++){ c.setDate(c.getDate()+1); if (days.some(d=>DKR[d]===c.getDay())){ nd = `${c.getFullYear()}-${pad2(c.getMonth()+1)}-${pad2(c.getDate())}`; break; } } }
                return `이 날은 무료 취소(회차 차감 없음)예요.\n회차가 그대로 유지되어 수업이 1회 뒤로 밀려요${nd?` — 마지막 수업이 ${fmtDateKr(nd)}로 변경됩니다.`:"."}\n\n취소하시겠습니까?`;
              }
              if (db >= 1) return "⚠️ 3일 이내 취소로 회차가 1회 차감됩니다.\n그래도 취소하시겠습니까?";
              return "❌ 당일 취소입니다. 회차가 차감됩니다.\n그래도 취소하시겠습니까?";
            })()}
          </div>
          <textarea
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            placeholder="취소 사유 (선택) — 예: 아이가 아파요, 학교 행사"
            style={{ width: "100%", boxSizing: "border-box", minHeight: 64, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 10, fontFamily: "inherit", fontSize: 13, marginTop: 10, resize: "vertical" }}
          />
          {cancelTarget.info.days_before < 4 && (
            <div style={{ fontSize: 12, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px", marginTop: 8, lineHeight: 1.5 }}>
              💡 아이가 아픈 경우 등 부득이한 사정은 사유를 남겨주세요. 관리자가 확인 후 <b>보강(차감 없음)</b>으로 처리해드릴 수 있어요.
            </div>
          )}
          <div className="acts">
            <button className="btn-cancel" disabled={cancelLoading} onClick={() => setCancelTarget(null)}>닫기</button>
            <button className="btn-confirm" disabled={cancelLoading} onClick={confirmCancel}>{cancelLoading ? "처리중..." : "취소하기"}</button>
          </div>
        </div>
      </div>
    )}
  </>);
}
