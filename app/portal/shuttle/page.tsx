"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Session { booking_id: string; booking_number: string; guest_name: string; expires: number }
interface ShuttleReq {
  id: string; request_date: string; request_time: string | null; destination: string;
  num_people: number; round_trip: boolean; status: string; created_at: string;
}

const PLACES = ["SM City", "Ayala Mall", "IT Park", "JY Square"];
const ST: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기중", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정",   bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
};

export default function PortalShuttlePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [requests, setRequests] = useState<ShuttleReq[]>([]);
  const [form, setForm] = useState({ request_date: "", request_time: "", destination: PLACES[0], num_people: 1, round_trip: false });
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
      const res = await fetch(`/api/portal/shuttle?booking_id=${session.booking_id}`);
      if (res.ok) { const d = await res.json(); setRequests(d.requests || []); }
    })();
  }, [session]);

  async function reload() {
    if (!session) return;
    const res = await fetch(`/api/portal/shuttle?booking_id=${session.booking_id}`);
    if (res.ok) { const d = await res.json(); setRequests(d.requests || []); }
  }

  async function submit() {
    if (!session) return;
    if (!form.request_date) { setMsg("날짜를 선택해주세요."); return; }
    if (!form.num_people || form.num_people < 1) { setMsg("인원을 입력해주세요."); return; }
    setSaving(true); setMsg("");
    const res = await fetch("/api/portal/shuttle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: session.booking_id, ...form }),
    });
    setSaving(false);
    if (!res.ok) { const r = await res.json(); setMsg(r.error || "신청 실패"); return; }
    setMsg("신청이 완료되었습니다. 관리자 확정 후 안내드리겠습니다.");
    setForm({ request_date: "", request_time: "", destination: PLACES[0], num_people: 1, round_trip: false });
    reload();
  }

  async function cancelRequest(id: string) {
    if (!confirm("이 신청을 취소하시겠습니까?")) return;
    const res = await fetch(`/api/portal/shuttle?id=${id}`, { method: "DELETE" });
    if (!res.ok) { const r = await res.json(); alert(r.error || "취소 실패"); return; }
    reload();
  }

  if (!session) return null;

  return (<>
    <style>{`
.sh-w{max-width:640px;margin:0 auto;padding:24px 24px 40px}
.sh-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:12px}.sh-back:hover{color:#1a6fc4}
.sh-head{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:16px;padding:20px;color:#fff;margin-bottom:12px}
.sh-head h1{font-size:18px;font-weight:800;margin-bottom:2px}
.sh-head p{font-size:12px;opacity:0.8}
.sec{background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 8px rgba(0,0,0,0.04);margin-bottom:10px}
.sec h2{font-size:14px;font-weight:800;color:#1a6fc4;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.lbl{display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px}
.inp,.sel{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;background:#fff}.inp:focus,.sel:focus{border-color:#1a6fc4}
.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rt{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;color:#475569;cursor:pointer;user-select:none}
.rt input{width:18px;height:18px;accent-color:#1a6fc4}
.btn{width:100%;padding:14px;background:linear-gradient(135deg,#1a6fc4,#7c3aed);color:#fff;font-size:15px;font-weight:700;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:4px}.btn:hover{opacity:0.9}.btn:disabled{opacity:0.5;cursor:not-allowed}
.msg{margin-top:10px;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;text-align:center}
.msg-ok{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}
.msg-err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:8px;background:#f8fafc}
.card.cancelled{opacity:0.5}
.card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.card-date{font-size:14px;font-weight:700}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.card-info{display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;color:#475569;margin-bottom:8px}
.card-info .k{font-weight:700;color:#6b7c93}
.card-cancel{padding:6px 14px;font-size:12px;font-weight:600;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;border-radius:7px;cursor:pointer;font-family:inherit}.card-cancel:hover{background:#fee2e2}
.empty{text-align:center;padding:32px;color:#94a3b8;font-size:13px}
@media(max-width:500px){.sh-w{padding:20px 16px}.row{grid-template-columns:1fr}.card-info{grid-template-columns:1fr}}
    `}</style>
    <div className="sh-w">
      <button className="sh-back" onClick={() => router.push("/portal/dashboard")}>← 대시보드로</button>

      <div className="sh-head">
        <h1>🚌 셔틀 신청</h1>
        <p>{session.guest_name}님 · 지정 장소 무료 셔틀</p>
      </div>

      <div className="sec">
        <h2>셔틀 신청하기</h2>
        <label className="lbl">날짜</label>
        <input className="inp" type="date" value={form.request_date}
          onChange={e => setForm({ ...form, request_date: e.target.value })} />
        <label className="lbl">시간 (선택)</label>
        <input className="inp" type="time" value={form.request_time}
          onChange={e => setForm({ ...form, request_time: e.target.value })} />
        <label className="lbl">장소</label>
        <select className="sel" value={form.destination}
          onChange={e => setForm({ ...form, destination: e.target.value })}>
          {PLACES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="row">
          <div>
            <label className="lbl">인원</label>
            <input className="inp" type="number" min={1} max={12} value={form.num_people}
              onChange={e => setForm({ ...form, num_people: parseInt(e.target.value) || 1 })} />
          </div>
        </div>
        <label className="rt">
          <input type="checkbox" checked={form.round_trip}
            onChange={e => setForm({ ...form, round_trip: e.target.checked })} />
          <span>왕복 신청</span>
        </label>
        <button className="btn" onClick={submit} disabled={saving}>
          {saving ? "신청 중..." : "셔틀 신청하기"}
        </button>
        {msg && <div className={`msg ${msg.includes("완료") ? "msg-ok" : "msg-err"}`}>{msg}</div>}
      </div>

      <div className="sec">
        <h2>신청 내역 ({requests.length}건)</h2>
        {requests.length === 0 ? (
          <div className="empty">아직 신청 내역이 없습니다</div>
        ) : requests.map(r => {
          const st = ST[r.status] || ST.pending;
          return (
            <div key={r.id} className={`card${r.status === "cancelled" ? " cancelled" : ""}`}>
              <div className="card-top">
                <div className="card-date">{r.request_date} {r.request_time || ""}</div>
                <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              </div>
              <div className="card-info">
                <div><span className="k">장소:</span> {r.destination}</div>
                <div><span className="k">인원:</span> {r.num_people}명</div>
                <div><span className="k">왕복:</span> {r.round_trip ? "왕복" : "편도"}</div>
              </div>
              {r.status === "pending" && (
                <button className="card-cancel" onClick={() => cancelRequest(r.id)}>신청 취소</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </>);
}
