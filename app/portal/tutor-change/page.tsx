"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Sess { session_date: string; status?: string }
interface Lesson {
  id: string; tutor_name?: string | null; class_type?: string | null;
  start_date?: string | null; end_date?: string | null;
  student_names?: string | null; tutor_id?: string | null;
  application_id?: string | null; admin_memo?: string | null;
  sessions?: Sess[]; billed_sessions?: number; billed_amount?: number;
  confirmed_time?: string | null; class_time?: string | null;
}
const peso = (n?: number) => (n ? "₱" + Number(n).toLocaleString() : "-");
function fmt(d?: string | null) { if (!d) return ""; const t = new Date(String(d) + "T00:00:00"); return isNaN(t.getTime()) ? String(d) : `${t.getMonth() + 1}/${t.getDate()}`; }

const TYPES = [
  { v: "cancel", label: "하루 취소" },
  { v: "time_change", label: "시간 변경" },
  { v: "date_change", label: "날짜 변경" },
  { v: "full_cancel", label: "전체 취소" },
];

export default function TutorChangePage() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string>("");
  const [form, setForm] = useState({ type: "cancel", date: "", newTime: "", newDate: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async (bid: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/portal/tutor-invoice?booking_id=${encodeURIComponent(bid)}`);
      const d = await r.json();
      setLessons((d.lessons || []) as Lesson[]);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("portalSession");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.booking_id && Date.now() < s.expires) { setBookingId(s.booking_id); setStudentName(s.guest_name || ""); load(s.booking_id); return; }
      }
    } catch { /* */ }
    router.replace("/portal");
  }, [router, load]);

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(""), 2800); }
  function openPanel(l: Lesson) {
    setOpenId(openId === l.id ? "" : l.id);
    const firstDate = (l.sessions || []).map(s => s.session_date).filter(Boolean).sort()[0] || "";
    setForm({ type: "cancel", date: firstDate, newTime: "", newDate: "", reason: "" });
  }

  async function submit(l: Lesson) {
    if (form.type !== "full_cancel" && !form.date) { showToast("날짜를 선택해주세요"); return; }
    if (form.type === "time_change" && !form.newTime) { showToast("변경할 시간을 입력해주세요"); return; }
    if (form.type === "date_change" && !form.newDate) { showToast("옮길 날짜를 선택해주세요"); return; }
    setSubmitting(true);
    try {
      if (form.type === "full_cancel") {
        const appId = l.application_id || (l.admin_memo ? (l.admin_memo.match(/request_id:\s*([a-f0-9-]+)/i) || [])[1] : null);
        if (!appId) { showToast("전체 취소는 신청 연결이 필요합니다. 매니저에게 문의해주세요."); setSubmitting(false); return; }
        const r = await fetch("/api/portal/cancel-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "tutor_requests", id: appId, reason: form.reason || "전체 취소 요청", booking_id: bookingId }) });
        if (!r.ok) { const e = await r.json().catch(() => ({})); showToast(e.error || "요청 실패"); setSubmitting(false); return; }
      } else {
        let reason = form.reason || "";
        if (form.type === "time_change") reason = `시간 변경 요청: ${form.newTime}${reason ? ` · ${reason}` : ""}`;
        else if (form.type === "date_change") reason = `날짜 변경 요청 → ${form.newDate}${reason ? ` · ${reason}` : ""}`;
        const r = await fetch("/api/portal/tutor/cancel-day", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lesson_id: l.id, cancel_date: form.date, req_type: form.type, reason, booking_id: bookingId, requested_by: studentName, student_name: l.student_names, tutor_id: l.tutor_id, application_id: l.application_id }) });
        if (!r.ok) { const e = await r.json().catch(() => ({})); showToast(e.error || "요청 실패"); setSubmitting(false); return; }
      }
      showToast("✅ 요청이 접수되었습니다. 매니저 확인 후 반영됩니다.");
      setOpenId("");
    } catch { showToast("네트워크 오류"); }
    setSubmitting(false);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "22px 16px 60px", fontFamily: "'Noto Sans KR',sans-serif", color: "#1a1a2e" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button onClick={() => router.push("/portal/dashboard")} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontWeight: 600 }}>← 마이페이지</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>✏️ 튜터 수업 변경요청</h1>
      </div>
      <p style={{ fontSize: 13, color: "#6b7c93", marginBottom: 16 }}>신청하신 수업을 선택해 취소 · 시간 변경 · 날짜 변경을 요청하세요. 요청은 매니저 확인 후 반영됩니다.</p>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>불러오는 중…</div>
      ) : lessons.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12, padding: 44, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>확정된 튜터 수업이 없습니다.</div>
      ) : lessons.map(l => {
        const dates = (l.sessions || []).map(s => s.session_date).filter(Boolean).sort();
        const open = openId === l.id;
        return (
          <div key={l.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>{l.student_names || "수업"} <span style={{ fontSize: 12, color: "#1a6fc4", fontWeight: 700 }}>· {l.class_type || ""}</span></div>
                <div style={{ fontSize: 12.5, color: "#6b7c93", marginTop: 3 }}>
                  {l.tutor_name ? `${l.tutor_name} 선생님 · ` : ""}{fmt(l.start_date)}~{fmt(l.end_date)}{l.confirmed_time || l.class_time ? ` · ${l.confirmed_time || l.class_time}` : ""}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>회차 {l.billed_sessions ?? dates.length}회 · {peso(l.billed_amount)}</div>
              </div>
              <button onClick={() => openPanel(l)} style={{ flexShrink: 0, padding: "8px 12px", borderRadius: 8, border: "1px solid #1a6fc4", background: open ? "#1a6fc4" : "#fff", color: open ? "#fff" : "#1a6fc4", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{open ? "닫기" : "변경요청"}</button>
            </div>

            {open && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {TYPES.map(t => (
                    <button key={t.v} onClick={() => setForm(f => ({ ...f, type: t.v }))}
                      style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${form.type === t.v ? "#1a6fc4" : "#e2e8f0"}`, background: form.type === t.v ? "#eff6ff" : "#fff", color: form.type === t.v ? "#1a6fc4" : "#64748b" }}>{t.label}</button>
                  ))}
                </div>

                {form.type !== "full_cancel" && (
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>대상 날짜
                    <select value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "#fff" }}>
                      <option value="">날짜 선택…</option>
                      {dates.map(d => <option key={d} value={d}>{fmt(d)} ({["일","월","화","수","목","금","토"][new Date(d + "T00:00:00").getDay()]})</option>)}
                    </select>
                  </label>
                )}
                {form.type === "time_change" && (
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", margin: "8px 0 4px" }}>변경할 시작 시간
                    <input type="time" value={form.newTime} onChange={e => setForm(f => ({ ...f, newTime: e.target.value }))} style={{ display: "block", marginTop: 4, padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
                  </label>
                )}
                {form.type === "date_change" && (
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", margin: "8px 0 4px" }}>옮길 날짜
                    <input type="date" value={form.newDate} onChange={e => setForm(f => ({ ...f, newDate: e.target.value }))} style={{ display: "block", marginTop: 4, padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
                  </label>
                )}
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={form.type === "full_cancel" ? "전체 취소 사유" : "추가 요청/사유 (선택)"} style={{ width: "100%", minHeight: 56, marginTop: 8, padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
                <button onClick={() => submit(l)} disabled={submitting} style={{ marginTop: 8, width: "100%", padding: "11px", border: "none", borderRadius: 8, background: form.type === "full_cancel" || form.type === "cancel" ? "#dc2626" : "#1a6fc4", color: "#fff", fontWeight: 800, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: submitting ? 0.6 : 1 }}>{submitting ? "접수 중…" : "변경요청 보내기"}</button>
              </div>
            )}
          </div>
        );
      })}

      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1a2e", color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, zIndex: 300, maxWidth: "90%", textAlign: "center" }}>{toast}</div>}
    </div>
  );
}
