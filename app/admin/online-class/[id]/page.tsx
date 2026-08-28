"use client";
// 화상영어 — 학생(수강권) 상세 관리 페이지 (2026-08-25)
// 리스트의 슬라이드 패널 대신 전용 페이지에서 수강 정보 + 출석부 + 계정 연결까지 관리
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchDeployedHolidays } from "@/lib/holidays";
import { buildOnlineSessionDates } from "@/lib/onlineClassSchedule";

const DAYS = ["월", "화", "수", "목", "금"];
const TIME_SLOTS: string[] = [];
for (let h = 15; h <= 21; h++) { TIME_SLOTS.push(`${h}:00`); TIME_SLOTS.push(`${h}:30`); }
const subHour = (t: string) => { if(!t||!/^\d{1,2}:\d{2}/.test(t))return ""; const [h, m] = t.split(":").map(Number); return `${String((h + 23) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`; };

interface Tutor { id: string; name_display: string; name_en?: string | null }
interface Enr {
  id: string; student_name: string; student_name_en: string | null; student_birth_year: string | null;
  tutor_id: string | null; tutor?: Tutor | null; level: string | null; enrollment_type: string;
  days_of_week: string[]; class_time_kr: string | null; class_time_ph: string | null;
  day_times: Record<string, string> | null;
  start_date: string; end_date: string | null; duration_weeks: number | null; class_duration_weeks: number | null;
  class_period: string; sessions_per_week: number; total_sessions: number; used_sessions: number;
  pre_sessions: number; post_sessions: number; status: string; notes: string | null;
  portal_open?: boolean | null; customer_user_id?: string | null;
}
interface Ses {
  id: string; session_number: number; scheduled_date: string; scheduled_time_kr: string | null;
  status: string; session_note: string | null; cancel_days_before?: number | null;
  attitude?: string | null; attitude_note?: string | null;
}
const SES_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  scheduled: { label: "예정", bg: "#f1f5f9", color: "#64748b" },
  attended: { label: "O", bg: "#dcfce7", color: "#166534" },
  no_show: { label: "✗", bg: "#fef2f2", color: "#dc2626" },
  absent: { label: "✗", bg: "#fef2f2", color: "#dc2626" },
  cancelled: { label: "X", bg: "#fee2e2", color: "#dc2626" },
  makeup: { label: "△", bg: "#fef3c7", color: "#b45309" },
};
const STATUS_OPT = [["active", "수업중"], ["scheduled", "예정"], ["completed", "종료"], ["paused", "일시중지"], ["cancelled", "취소"]];

export default function OnlineClassStudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [enr, setEnr] = useState<Enr | null>(null);
  const [sessions, setSessions] = useState<Ses[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [holidaySet, setHolidaySet] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [form, setForm] = useState<any>(null);
  const [dayTimesOn, setDayTimesOn] = useState(false);
  const [dayTimes, setDayTimes] = useState<Record<string, string>>({});
  // 시간 선택
  const [tp, setTp] = useState<{ label: string; cb: (t: string) => void } | null>(null);
  const [pick, setPick] = useState<Ses | null>(null);
  // 계정 검색
  const [acctOpen, setAcctOpen] = useState(false);
  const [acctQ, setAcctQ] = useState("");
  const [acctRes, setAcctRes] = useState<any[]>([]);
  const [acctLoading, setAcctLoading] = useState(false);
  const [acctLabel, setAcctLabel] = useState("");

  const show = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3200); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/online-class/enrollments/${id}`),
        fetch(`/api/online-class/tutors`).catch(() => null),
      ]);
      if (r1.ok) {
        const d = await r1.json();
        setEnr(d.enrollment); setSessions(d.sessions || []);
        const e = d.enrollment as Enr;
        setForm({
          student_name: e.student_name || "", student_name_en: e.student_name_en || "",
          student_birth_year: e.student_birth_year || "", level: e.level || "",
          tutor_id: e.tutor?.id || e.tutor_id || "",
          days_of_week: e.days_of_week || [], class_time_kr: e.class_time_kr || "", class_time_ph: e.class_time_ph || "",
          start_date: e.start_date || "", end_date: e.end_date || "",
          duration_weeks: e.duration_weeks ?? "", class_duration_weeks: e.class_duration_weeks ?? "",
          sessions_per_week: String(e.sessions_per_week || 3), total_sessions: e.total_sessions ?? 0,
          pre_sessions: e.pre_sessions ?? 0, post_sessions: e.post_sessions ?? 0,
          class_period: e.class_period || "standalone", status: e.status || "active", notes: e.notes || "",
          portal_open: e.portal_open === true, customer_user_id: e.customer_user_id || "",
        });
        const dt = e.day_times && typeof e.day_times === "object" ? e.day_times : null;
        setDayTimesOn(!!dt && Object.keys(dt).length > 0);
        setDayTimes(dt || {});
      }
      if (r2 && r2.ok) { const t = await r2.json(); setTutors(t.tutors || []); }
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("focus") !== "attendance") return;
    if (!sessions.length) return;
    const t = setTimeout(() => document.getElementById("attendance-sec")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    return () => clearTimeout(t);
  }, [sessions.length]);
  useEffect(() => { fetchDeployedHolidays().then(h => setHolidaySet(new Set((h || []).map((x: any) => x.date)))).catch(() => {}); }, []);
  const [tutorAvail, setTutorAvail] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    const days = (form?.days_of_week || []) as string[];
    const time = form?.class_time_kr as string;
    if (!days.length || !time) { setTutorAvail(null); return; }
    let dead = false;
    fetch(`/api/online-class/availability?days=${encodeURIComponent(days.join(","))}&time=${encodeURIComponent(time)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (dead || !d) return; const m: Record<string, boolean> = {}; (d.tutors || []).forEach((t: any) => { m[t.id] = t.available; }); setTutorAvail(m); })
      .catch(() => {});
    return () => { dead = true; };
  }, [form?.days_of_week, form?.class_time_kr]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const body: any = {
        id,
        ...form,
        sessions_per_week: Number(form.sessions_per_week) || 3,
        total_sessions: Number(form.total_sessions) || 0,
        duration_weeks: form.duration_weeks === "" ? null : Number(form.duration_weeks),
        class_duration_weeks: form.class_duration_weeks === "" ? null : Number(form.class_duration_weeks),
        customer_user_id: form.customer_user_id || null,
        class_time_ph: subHour(form.class_time_kr) || null,
        day_times: dayTimesOn ? Object.fromEntries(form.days_of_week.filter((d: string) => (dayTimes[d] || "").trim()).map((d: string) => [d, dayTimes[d].trim()])) : null,
      };
      const res = await fetch("/api/online-class/enrollments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const r = await res.json();
      if (!res.ok) { show(r.error || "저장 실패", false); return; }
      show("저장 완료 ✅" + (r.sessions_tutor_synced ? ` · 세션 튜터 ${r.sessions_tutor_synced}개 동기화` : ""));
      await load();
    } finally { setSaving(false); }
  }

  async function regenerate() {
    if (!confirm("예정(scheduled) 세션을 삭제하고 현재 요일/시간 설정으로 재생성합니다.\n출석/취소 이력은 보존됩니다. 진행할까요?")) return;
    const res = await fetch("/api/online-class/enrollments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, regenerate_sessions: true }) });
    const r = await res.json();
    if (!res.ok) { show(r.error || "재생성 실패", false); return; }
    show(`세션 재생성 완료 (${r.sessions_created ?? ""}개)`);
    await load();
  }

  async function setSesStatus(s: Ses, st: string, force?: boolean) {
    const res = await fetch("/api/online-class/sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: s.id, status: st, ...(force ? { force_makeup: true } : {}) }) });
    const r = await res.json().catch(() => ({}));
    setPick(null);
    if (!res.ok) { show((r as any).error || "변경 실패", false); return; }
    show((r as any).message || "변경되었습니다 ✅"); await load();
  }

  async function searchAccounts() {
    if (acctQ.trim().length < 2) return;
    setAcctLoading(true);
    try { const r = await fetch(`/api/admin/portal-users?q=${encodeURIComponent(acctQ.trim())}`); const d = await r.json(); setAcctRes(d.users || []); }
    finally { setAcctLoading(false); }
  }

  if (loading || !form) return <div style={{ padding: 60, textAlign: "center", color: "#94a3b8", fontFamily: "'Noto Sans KR',sans-serif" }}>불러오는 중…</div>;
  if (!enr) return <div style={{ padding: 60, textAlign: "center", color: "#dc2626" }}>수강 정보를 찾을 수 없어요</div>;

  const total = Number(form.total_sessions) || enr.total_sessions || 0;
  const used = enr.used_sessions || 0;
  const rem = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const byMonth: Record<string, Ses[]> = {};
  sessions.forEach(s => { const m = (s.scheduled_date || "").slice(0, 7); if (!byMonth[m]) byMonth[m] = []; byMonth[m].push(s); });
  const months = Object.keys(byMonth).sort();
  const inp = { width: "100%", boxSizing: "border-box" as const, padding: "9px 11px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit" };
  const lbl = { fontSize: 11.5, fontWeight: 700 as const, color: "#64748b", marginBottom: 4, display: "block" };

  return (
    <div style={{ fontFamily: "'Noto Sans KR',sans-serif", background: "#f4f6fa", minHeight: "100vh", padding: "26px 24px" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <button onClick={() => router.push("/admin/online-class")} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← 수강생 목록</button>
          <h1 style={{ fontSize: 21, fontWeight: 800, margin: 0 }}>{enr.student_name} <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>{enr.student_name_en}</span></h1>
          <span style={{ fontSize: 12, fontWeight: 800, background: "#dcfce7", color: "#166534", borderRadius: 8, padding: "3px 10px" }}>{STATUS_OPT.find(o => o[0] === enr.status)?.[1] || enr.status}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => window.open(`/admin/online-class/invoice?enrollment_id=${id}`, "_blank")} style={{ border: "1px solid #93c5fd", background: "#fff", color: "#1a6fc4", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🧾 인보이스</button>
          <button onClick={regenerate} style={{ border: "1px solid #fcd34d", background: "#fff", color: "#d97706", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🔄 세션 재생성</button>
        </div>

        {/* 잔여 바 */}
        <div style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 7 }}>
            <span>사용 {used}회 / 전체 {total}회 <span style={{ color: "#94a3b8", fontWeight: 600 }}>· {enr.tutor?.name_display || "튜터 미배정"} · {(form.days_of_week || []).join("/")} {form.class_time_kr}</span></span>
            <span style={{ color: rem <= 3 ? "#dc2626" : "#166534" }}>잔여 {rem}회</span>
          </div>
          <div style={{ height: 10, background: "#e2e8f0", borderRadius: 5, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: rem <= 3 ? "#ef4444" : "#1a6fc4" }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "440px minmax(0,1fr)", gap: 18, alignItems: "start" }}>
          {/* ── 좌: 수강 정보 편집 ── */}
          <div style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>✏️ 수강 정보</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>학생명</label><input style={inp} value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })} /></div>
              <div><label style={lbl}>영문명</label><input style={inp} value={form.student_name_en} onChange={e => setForm({ ...form, student_name_en: e.target.value })} /></div>
              <div><label style={lbl}>출생연도</label><input style={inp} value={form.student_birth_year} onChange={e => setForm({ ...form, student_birth_year: e.target.value })} /></div>
              <div><label style={lbl}>레벨</label><input style={inp} value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} placeholder="beginner…" /></div>
            </div>
            <div style={{ marginBottom: 10 }}><label style={lbl}>담당 튜터</label>
              <select style={inp} value={form.tutor_id} onChange={e => setForm({ ...form, tutor_id: e.target.value })}>
                <option value="">미배정</option>
                {tutors.map(t => {
                  const free = tutorAvail ? tutorAvail[t.id] : undefined;
                  const mine = form.tutor_id === t.id;
                  return <option key={t.id} value={t.id}>{t.name_display}{free === false && !mine ? " — ⛔ 이 시간 수업 있음" : free === true ? " ✓" : ""}</option>;
                })}
              </select>
              {tutorAvail && (() => {
                const frees = tutors.filter(t => tutorAvail[t.id]);
                return (
                  <div style={{ fontSize: 11.5, marginTop: 5, color: frees.length ? "#166534" : "#dc2626", lineHeight: 1.5 }}>
                    {(form.days_of_week || []).join("/")} {form.class_time_kr} 가능: {frees.length ? frees.map(t => t.name_display).join(", ") : "없음 — 시간대 마감"}
                  </div>
                );
              })()}
            </div>
            <div style={{ marginBottom: 10 }}><label style={lbl}>수강 요일 (평일만)</label>
              <div style={{ display: "flex", gap: 6 }}>
                {DAYS.map(d => {
                  const on = (form.days_of_week || []).includes(d);
                  return <button key={d} onClick={() => setForm({ ...form, days_of_week: on ? form.days_of_week.filter((x: string) => x !== d) : [...form.days_of_week, d] })} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: on ? "1px solid #1a6fc4" : "1px solid #e2e8f0", background: on ? "#1a6fc4" : "#fff", color: on ? "#fff" : "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{d}</button>;
                })}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
              <div><label style={lbl}>한국 시간</label><input style={{ ...inp, cursor: "pointer", background: dayTimesOn ? "#f8fafc" : "#fff" }} readOnly value={form.class_time_kr} onClick={() => { if (!dayTimesOn) setTp({ label: "한국 수업 시간", cb: t => setForm((f: any) => ({ ...f, class_time_kr: t, class_time_ph: subHour(t) })) }); }} placeholder="시간 선택" /></div>
              <div><label style={lbl}>필리핀 시간</label><input style={{ ...inp, background: "#f8fafc" }} readOnly value={subHour(form.class_time_kr) || form.class_time_ph} /></div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginBottom: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={dayTimesOn} onChange={e => setDayTimesOn(e.target.checked)} /> 요일별 시간 다르게 (예: 월 18:30 / 수 19:30)
            </label>
            {dayTimesOn && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                {(form.days_of_week || []).map((d: string) => (
                  <div key={d}><label style={lbl}>{d}요일 (한국시간)</label>
                    <input style={{ ...inp, cursor: "pointer" }} readOnly value={dayTimes[d] || ""} onClick={() => setTp({ label: `${d}요일 수업 시간`, cb: t => setDayTimes(prev => ({ ...prev, [d]: t })) })} placeholder="시간 선택" /></div>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>시작일</label><input type="date" style={inp} value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><label style={lbl}>종료일 (마지막 회차 · 자동)</label>
                {(() => {
                  const r = buildOnlineSessionDates(form.start_date, form.days_of_week, Number(form.total_sessions) || 0, holidaySet);
                  const sV = r.skipped.filter(s => s.reason === "방학").length, sH = r.skipped.filter(s => s.reason === "휴일").length;
                  return (<>
                    <input type="date" style={{ ...inp, background: "#f0fdf4", fontWeight: 700 }} value={r.endDate || form.end_date || ""} readOnly title="시작일·요일·회차 기준 자동 (성수기/방학·휴일 제외)" />
                    {r.endDate ? <div style={{ fontSize: 11, color: "#166534", marginTop: 3 }}>✅ 마지막 수업 <b>{r.endDate}</b>{(sV || sH) ? ` · 건너뜀 ${sV ? `방학 ${sV}일` : ""}${sV && sH ? "·" : ""}${sH ? `휴일 ${sH}일` : ""}` : ""}</div> : null}
                  </>);
                })()}
              </div>
              <div><label style={lbl}>주 수업 횟수</label>
                <select style={inp} value={form.sessions_per_week} onChange={e => { const spw = Number(e.target.value) || 3; const t = Number(form.total_sessions) || 0; setForm({ ...form, sessions_per_week: e.target.value, ...(t > 0 ? { duration_weeks: Math.ceil(t / spw) } : {}) }); }}>
                  <option value="2">2회 (최소)</option><option value="3">3회 (기본)</option><option value="5">5회</option>
                </select>
              </div>
              <div><label style={lbl}>총 회차 (어드민 조정 가능)</label><input type="number" style={{ ...inp, fontWeight: 800 }} value={String(form.total_sessions)} onChange={e => setForm({ ...form, total_sessions: e.target.value })} /></div>
              <div><label style={lbl}>기간 (주)</label><input type="number" style={inp} value={String(form.duration_weeks)} onChange={e => setForm({ ...form, duration_weeks: e.target.value })} /></div>
              <div><label style={lbl}>상태</label>
                <select style={inp} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>손님 앱(계정) 연결</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ ...inp, flex: 1, background: form.customer_user_id ? "#f0fdf4" : "#fff" }} readOnly value={form.customer_user_id ? (acctLabel || String(form.customer_user_id).slice(0, 8) + "…") : ""} placeholder="미연결 — 🔍로 검색" />
                <button onClick={() => { setAcctOpen(true); setAcctQ(""); setAcctRes([]); }} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>🔍 계정 찾기</button>
                {form.customer_user_id ? <button onClick={() => { setForm({ ...form, customer_user_id: "", portal_open: false }); setAcctLabel(""); }} style={{ border: "1px solid #fecaca", background: "#fff", color: "#dc2626", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>해제</button> : null}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginTop: 8, cursor: "pointer", fontWeight: 700, color: form.portal_open ? "#166534" : "#64748b" }}>
                <input type="checkbox" checked={form.portal_open === true} onChange={e => setForm({ ...form, portal_open: e.target.checked })} />
                📱 손님 앱(포털) 공개 — 체크한 수강권만 손님 화상영어 탭에 표시
              </label>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>특이사항 메모</label>
              <textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <button onClick={save} disabled={saving} style={{ width: "100%", padding: "12px 0", background: "#1a6fc4", color: "#fff", border: "none", borderRadius: 10, fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "저장 중…" : "💾 저장"}</button>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>요일 변경 후에는 [🔄 세션 재생성]으로 예정 세션을 갱신하세요 (이력은 보존)</div>
          </div>

          {/* ── 우: 출석부 ── */}
          <div style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 12, padding: 20 }}>
            <div id="attendance-sec" style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>🗓 출석부 <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>세션 {sessions.length}개</span></div>
            {months.length === 0 ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>세션이 없습니다</div> : months.map(m => (
              <div key={m} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1a6fc4", marginBottom: 7 }}>{m.replace("-", "년 ")}월</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {byMonth[m].map(s => {
                    let st = SES_STYLE[s.status] || SES_STYLE.scheduled;
                    if (s.status === "cancelled" && s.cancel_days_before != null && s.cancel_days_before >= 4) st = SES_STYLE.makeup;
                    const d = s.scheduled_date ? `${Number(s.scheduled_date.split("-")[1])}/${Number(s.scheduled_date.split("-")[2])}` : "";
                    return (
                      <div key={s.id} onClick={() => setPick(s)} title={`#${s.session_number} ${s.scheduled_date} ${s.scheduled_time_kr || ""} · ${s.status} — 클릭해서 출석/보강/취소 선택`}
                        style={{ position: "relative", width: 64, borderRadius: 9, padding: "8px 4px 7px", textAlign: "center", background: st.bg, color: st.color, border: "1px solid rgba(0,0,0,0.05)", cursor: "pointer" }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700 }}>{d}</div>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>{st.label}</div>
                        {s.session_note && <span style={{ position: "absolute", top: 2, right: 3, fontSize: 10 }}>💬</span>}
                        {s.attitude === "issue" && <span style={{ position: "absolute", bottom: 2, right: 3, fontSize: 10 }}>⚠️</span>}

                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4 }}>O 출석 · ✗ 결석 · X 차감취소 · △ 보강 · ⚠️ 태도기록 — 예정 칸 ×=취소 · X 칸 ↩=보강 전환(차감 복구)</div>
            {/* 메모·태도 목록 */}
            {sessions.some(s => s.session_note || s.attitude === "issue") && (
              <div style={{ marginTop: 16, borderTop: "1px solid #eef2f7", paddingTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>📝 티쳐 메모 · 수업태도</div>
                {sessions.filter(s => s.session_note || s.attitude === "issue").map(s => (
                  <div key={s.id} style={{ fontSize: 12.5, padding: "7px 10px", background: s.attitude === "issue" ? "#fef2f2" : "#f8fafc", borderRadius: 8, marginBottom: 6, lineHeight: 1.55 }}>
                    <b>#{s.session_number} {s.scheduled_date}</b>
                    {s.attitude === "issue" && <span style={{ color: "#dc2626", fontWeight: 700 }}> ⚠️ {s.attitude_note || "태도 문제 기록"}</span>}
                    {s.session_note && <span style={{ color: "#475569" }}> · {s.session_note}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 시간 선택 모달 */}
      {tp && (
        <div onClick={() => setTp(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: "min(420px,92vw)" }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>{tp.label} <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>(세부 -1시간 · 운영 세부 14:00~21:00)</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
              {TIME_SLOTS.map(t => <button key={t} onClick={() => { tp.cb(t); setTp(null); }} style={{ padding: "9px 0", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t}</button>)}
            </div>
          </div>
        </div>
      )}

      {/* 출석/보강/취소 상태 선택 모달 */}
      {pick && (
        <div onClick={() => setPick(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: "min(360px,92vw)" }}>
            <div style={{ fontWeight: 800, marginBottom: 3 }}>#{pick.session_number} · {pick.scheduled_date}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>{pick.scheduled_time_kr || ""} · 이 수업 상태를 선택하세요</div>
            <div style={{ display: "grid", gap: 8 }}>
              <button onClick={() => setSesStatus(pick, "attended")} style={{ padding: "11px 12px", borderRadius: 9, border: "1px solid #bbf7d0", background: "#f0fdf4", color: "#166534", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>⭕ 출석 <span style={{ fontWeight: 600, color: "#64748b" }}>· 회차 차감</span></button>
              <button onClick={() => setSesStatus(pick, "no_show")} style={{ padding: "11px 12px", borderRadius: 9, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>✗ 결석 <span style={{ fontWeight: 600, color: "#94a3b8" }}>· 회차 차감</span></button>
              <button onClick={() => setSesStatus(pick, "makeup", true)} style={{ padding: "11px 12px", borderRadius: 9, border: "1px solid #fcd34d", background: "#fffbeb", color: "#b45309", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>△ 보강 <span style={{ fontWeight: 600, color: "#94a3b8" }}>· 무차감 · 마지막에 1회 추가 (티쳐 결근 등)</span></button>
              <button onClick={() => setSesStatus(pick, "cancelled")} style={{ padding: "11px 12px", borderRadius: 9, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", fontWeight: 800, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>✕ 취소 <span style={{ fontWeight: 600, color: "#94a3b8" }}>· 4일 전 이내면 차감</span></button>
              <button onClick={() => setSesStatus(pick, "scheduled")} style={{ padding: "11px 12px", borderRadius: 9, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>↩ 예정으로 되돌리기</button>
            </div>
          </div>
        </div>
      )}

      {/* 계정 검색 모달 */}
      {acctOpen && (
        <div onClick={() => setAcctOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(480px,92vw)", padding: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>🔍 손님 앱 계정 찾기</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <input autoFocus style={{ ...inp, flex: 1 }} value={acctQ} onChange={e => setAcctQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") searchAccounts(); }} placeholder="이름 또는 아이디 (2글자 이상)" />
              <button onClick={searchAccounts} disabled={acctLoading} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{acctLoading ? "검색중…" : "검색"}</button>
            </div>
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {acctRes.length === 0 ? <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 12.5, padding: 20 }}>이름이나 아이디로 검색하세요</div> : acctRes.map((u: any) => (
                <div key={u.id} onClick={() => { setForm({ ...form, customer_user_id: u.id, portal_open: true }); setAcctLabel(`${u.name || "?"} (${u.username || u.id.slice(0, 8)})`); setAcctOpen(false); }}
                  style={{ padding: "9px 12px", borderRadius: 9, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #eef2f7", marginBottom: 6 }}>
                  <span><b>{u.name || "(이름 없음)"}</b> <span style={{ color: "#64748b", fontSize: 12 }}>{u.username}</span></span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{u.email || ""}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 8 }}>선택하면 계정이 연결되고 📱 앱 공개가 자동으로 켜져요 (아래 💾 저장 필수)</div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", background: toast.ok ? "#166534" : "#dc2626", color: "#fff", borderRadius: 10, padding: "11px 22px", fontSize: 13.5, fontWeight: 700, zIndex: 10000 }}>{toast.msg}</div>}
    </div>
  );
}
