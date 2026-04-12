"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Session { booking_id: string; booking_number: string; guest_name: string; expires: number }
interface Student { id: string; name_kr: string; name_en: string }
interface Tutor { id: string; name: string; specialty: string | null }
interface TutorReq {
  id: string; student_id: string; tutor_id: string | null;
  preferred_days: string | null; preferred_time: string | null;
  status: string; notes: string | null; created_at: string; student_name?: string;
}

const ST: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기중", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정",   bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default function PortalTutorPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [requests, setRequests] = useState<TutorReq[]>([]);
  const [form, setForm] = useState({ student_id: "", tutor_id: "", preferred_days: "", preferred_time: "", notes: "" });
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("portalSession");
      if (!raw) { router.replace("/portal"); return; }
      const s: Session = JSON.parse(raw);
      if (s.expires < Date.now()) { localStorage.removeItem("portalSession"); router.replace("/portal"); return; }
      setSession(s);
    } catch { router.replace("/portal"); }
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch(`/api/portal/tutor?booking_id=${session.booking_id}`);
      if (res.ok) {
        const d = await res.json();
        setStudents(d.students || []);
        setTutors(d.tutors || []);
        setRequests(d.requests || []);
        if (d.students?.length > 0 && !form.student_id) setForm(f => ({ ...f, student_id: d.students[0].id }));
      }
    })();
  }, [session]);

  async function reload() {
    if (!session) return;
    const res = await fetch(`/api/portal/tutor?booking_id=${session.booking_id}`);
    if (res.ok) { const d = await res.json(); setRequests(d.requests || []); }
  }

  async function submit() {
    if (!session) return;
    if (!form.student_id) { setMsg("학생을 선택해주세요."); return; }
    setSaving(true); setMsg("");
    const res = await fetch("/api/portal/tutor", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: session.booking_id, ...form }),
    });
    setSaving(false);
    if (!res.ok) { const r = await res.json(); setMsg(r.error || "신청 실패"); return; }
    setMsg("신청이 완료되었습니다. 튜터 배정 후 안내드리겠습니다.");
    setForm({ student_id: form.student_id, tutor_id: "", preferred_days: "", preferred_time: "", notes: "" });
    reload();
  }

  async function cancel(id: string) {
    if (!confirm("신청을 취소하시겠습니까?")) return;
    const res = await fetch(`/api/portal/tutor?id=${id}`, { method: "DELETE" });
    if (!res.ok) { const r = await res.json(); alert(r.error || "취소 실패"); return; }
    reload();
  }

  if (!session) return null;

  return (<>
    <style>{`
.tu-w{max-width:640px;margin:0 auto;padding:24px 24px 40px}
.tu-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:12px}.tu-back:hover{color:#1a6fc4}
.tu-head{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:16px;padding:20px;color:#fff;margin-bottom:12px}
.tu-head h1{font-size:18px;font-weight:800;margin-bottom:2px}.tu-head p{font-size:12px;opacity:0.8}
.sec{background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 8px rgba(0,0,0,0.04);margin-bottom:10px}
.sec h2{font-size:14px;font-weight:800;color:#1a6fc4;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.lbl{display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px}
.inp,.sel,.area{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;background:#fff}
.inp:focus,.sel:focus,.area:focus{border-color:#1a6fc4}
.area{resize:vertical;min-height:60px}
.notice{background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#92400e;line-height:1.6}
.btn{width:100%;padding:14px;background:linear-gradient(135deg,#1a6fc4,#7c3aed);color:#fff;font-size:15px;font-weight:700;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:4px}.btn:hover{opacity:0.9}.btn:disabled{opacity:0.5;cursor:not-allowed}
.msg{margin-top:10px;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;text-align:center}
.msg-ok{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}.msg-err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:8px;background:#f8fafc}
.card.cancelled{opacity:0.5}
.card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.card-title{font-size:14px;font-weight:700}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.info{font-size:12px;color:#475569;margin-bottom:8px;line-height:1.6}
.info .k{font-weight:700;color:#6b7c93;margin-right:4px}
.cancel{padding:6px 14px;font-size:12px;font-weight:600;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;border-radius:7px;cursor:pointer;font-family:inherit}.cancel:hover{background:#fee2e2}
.cancel:disabled{opacity:0.5;cursor:not-allowed;background:#f1f5f9;color:#94a3b8;border-color:#e2e8f0}
.empty{text-align:center;padding:32px;color:#94a3b8;font-size:13px}
@media(max-width:500px){.tu-w{padding:20px 16px}}
    `}</style>
    <div className="tu-w">
      <button className="tu-back" onClick={() => router.push("/portal/dashboard")}>← 대시보드로</button>
      <div className="tu-head"><h1>👩‍🏫 튜터 수업 신청</h1><p>{session.guest_name}님 · 원어민 1:1 수업</p></div>

      <div className="sec">
        <h2>수업 신청</h2>
        <div className="notice">
          💡 신청 후 <b>4일 이내</b>에만 취소 가능합니다. 이후에는 관리자에게 문의해주세요.
        </div>
        {students.length === 0 ? (
          <div className="empty">등록된 학생이 없습니다.<br/>먼저 관리자에게 학생 등록을 요청해주세요.</div>
        ) : (<>
          <label className="lbl">학생</label>
          <select className="sel" value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}>
            {students.map(s => <option key={s.id} value={s.id}>{s.name_kr}{s.name_en ? ` (${s.name_en})` : ""}</option>)}
          </select>
          <label className="lbl">희망 튜터 (선택)</label>
          <select className="sel" value={form.tutor_id} onChange={e => setForm({ ...form, tutor_id: e.target.value })}>
            <option value="">배정 요청</option>
            {tutors.map(t => <option key={t.id} value={t.id}>{t.name}{t.specialty ? ` — ${t.specialty}` : ""}</option>)}
          </select>
          <label className="lbl">희망 요일</label>
          <input className="inp" placeholder="예: 월/수/금" value={form.preferred_days}
            onChange={e => setForm({ ...form, preferred_days: e.target.value })} />
          <label className="lbl">희망 시간</label>
          <input className="inp" placeholder="예: 17:00 ~ 18:00" value={form.preferred_time}
            onChange={e => setForm({ ...form, preferred_time: e.target.value })} />
          <label className="lbl">메모 (선택)</label>
          <textarea className="area" placeholder="특별 요청사항" value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })} />
          <button className="btn" onClick={submit} disabled={saving}>{saving ? "신청 중..." : "튜터 수업 신청하기"}</button>
          {msg && <div className={`msg ${msg.includes("완료") ? "msg-ok" : "msg-err"}`}>{msg}</div>}
        </>)}
      </div>

      <div className="sec">
        <h2>신청 내역 ({requests.length}건)</h2>
        {requests.length === 0 ? <div className="empty">아직 신청 내역이 없습니다</div> :
          requests.map(r => {
            const st = ST[r.status] || ST.pending;
            const canCancel = r.status === "pending" && daysSince(r.created_at) < 4;
            return (
              <div key={r.id} className={`card${r.status === "cancelled" ? " cancelled" : ""}`}>
                <div className="card-top">
                  <div className="card-title">{r.student_name || "-"} 학생</div>
                  <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <div className="info">
                  <div><span className="k">희망 요일:</span>{r.preferred_days || "-"}</div>
                  <div><span className="k">희망 시간:</span>{r.preferred_time || "-"}</div>
                  {r.notes && <div><span className="k">메모:</span>{r.notes}</div>}
                  <div><span className="k">신청일:</span>{r.created_at?.slice(0, 10)}</div>
                </div>
                {r.status === "pending" && (
                  <button className="cancel" onClick={() => cancel(r.id)} disabled={!canCancel}>
                    {canCancel ? "신청 취소" : "취소 불가 (4일 경과)"}
                  </button>
                )}
              </div>
            );
          })
        }
      </div>
    </div>
  </>);
}
