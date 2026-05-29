"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { resolvePortalSession } from "@/lib/portalSession";

interface Session { booking_id: string; booking_number: string; guest_name: string; expires: number }
interface PickupReq {
  id: string; request_date: string; request_time: string | null;
  location: string; destination: string; num_people: number; flight_info: string | null; status: string;
}

const ST: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기중", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정",   bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
};

export default function PortalPickupPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [requests, setRequests] = useState<PickupReq[]>([]);
  const [form, setForm] = useState({ request_date: "", request_time: "", location: "", destination: "", num_people: 1, flight_info: "" });
  const [msg, setMsg] = useState(""); const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await resolvePortalSession();
      if (!s) { router.replace("/portal"); return; }
      setSession(s as Session);
    })();
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch(`/api/portal/pickup?booking_id=${session.booking_id}`);
      if (res.ok) { const d = await res.json(); setRequests(d.requests || []); }
    })();
  }, [session]);

  async function reload() {
    if (!session) return;
    const res = await fetch(`/api/portal/pickup?booking_id=${session.booking_id}`);
    if (res.ok) { const d = await res.json(); setRequests(d.requests || []); }
  }

  async function submit() {
    if (!session) return;
    if (!form.request_date || !form.location || !form.destination) { setMsg("날짜, 출발지, 목적지를 입력해주세요."); return; }
    setSaving(true); setMsg("");
    const res = await fetch("/api/portal/pickup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: session.booking_id, ...form }),
    });
    setSaving(false);
    if (!res.ok) { const r = await res.json(); setMsg(r.error || "신청 실패"); return; }
    setMsg("신청이 완료되었습니다. 관리자 확정 후 안내드리겠습니다.");
    setForm({ request_date: "", request_time: "", location: "", destination: "", num_people: 1, flight_info: "" });
    reload();
  }

  async function cancel(id: string) {
    if (!confirm("신청을 취소하시겠습니까?")) return;
    const res = await fetch(`/api/portal/pickup?id=${id}`, { method: "DELETE" });
    if (!res.ok) { const r = await res.json(); alert(r.error || "취소 실패"); return; }
    reload();
  }

  if (!session) return null;

  return (<>
    <style>{`
.pk-w{max-width:640px;margin:0 auto;padding:24px 24px 40px}
.pk-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:12px}.pk-back:hover{color:#1a6fc4}
.pk-head{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:16px;padding:20px;color:#fff;margin-bottom:12px}
.pk-head h1{font-size:18px;font-weight:800;margin-bottom:2px}.pk-head p{font-size:12px;opacity:0.8}
.sec{background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 8px rgba(0,0,0,0.04);margin-bottom:10px}
.sec h2{font-size:14px;font-weight:800;color:#1a6fc4;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.lbl{display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px}
.inp{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px}.inp:focus{border-color:#1a6fc4}
.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.btn{width:100%;padding:14px;background:linear-gradient(135deg,#1a6fc4,#7c3aed);color:#fff;font-size:15px;font-weight:700;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:4px}.btn:hover{opacity:0.9}.btn:disabled{opacity:0.5;cursor:not-allowed}
.msg{margin-top:10px;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;text-align:center}
.msg-ok{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}.msg-err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:8px;background:#f8fafc}
.card.cancelled{opacity:0.5}
.card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.card-date{font-size:14px;font-weight:700}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.info{display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;color:#475569;margin-bottom:8px}
.info .k{font-weight:700;color:#6b7c93}
.cancel{padding:6px 14px;font-size:12px;font-weight:600;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;border-radius:7px;cursor:pointer;font-family:inherit}.cancel:hover{background:#fee2e2}
.empty{text-align:center;padding:32px;color:#94a3b8;font-size:13px}
@media(max-width:500px){.pk-w{padding:20px 16px}.row,.info{grid-template-columns:1fr}}
    `}</style>
    <div className="pk-w">
      <button className="pk-back" onClick={() => router.push("/portal/dashboard")}>← 대시보드로</button>
      <div className="pk-head"><h1>🛬 추가 픽드랍 신청</h1><p>{session.guest_name}님</p></div>

      <div className="sec">
        <h2>신청하기</h2>
        <label className="lbl">날짜</label>
        <input className="inp" type="date" value={form.request_date}
          onChange={e => setForm({ ...form, request_date: e.target.value })} />
        <label className="lbl">시간 (선택)</label>
        <input className="inp" type="time" value={form.request_time}
          onChange={e => setForm({ ...form, request_time: e.target.value })} />
        <div className="row">
          <div>
            <label className="lbl">출발지</label>
            <input className="inp" placeholder="예: 공항" value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })} />
          </div>
          <div>
            <label className="lbl">목적지</label>
            <input className="inp" placeholder="예: 드림하우스" value={form.destination}
              onChange={e => setForm({ ...form, destination: e.target.value })} />
          </div>
        </div>
        <div className="row">
          <div>
            <label className="lbl">인원</label>
            <input className="inp" type="number" min={1} max={12} value={form.num_people}
              onChange={e => setForm({ ...form, num_people: parseInt(e.target.value) || 1 })} />
          </div>
          <div>
            <label className="lbl">항공편 (선택)</label>
            <input className="inp" placeholder="KE631" value={form.flight_info}
              onChange={e => setForm({ ...form, flight_info: e.target.value })} />
          </div>
        </div>
        <button className="btn" onClick={submit} disabled={saving}>{saving ? "신청 중..." : "신청하기"}</button>
        {msg && <div className={`msg ${msg.includes("완료") ? "msg-ok" : "msg-err"}`}>{msg}</div>}
      </div>

      <div className="sec">
        <h2>신청 내역 ({requests.length}건)</h2>
        {requests.length === 0 ? <div className="empty">아직 신청 내역이 없습니다</div> :
          requests.map(r => {
            const st = ST[r.status] || ST.pending;
            return (
              <div key={r.id} className={`card${r.status === "cancelled" ? " cancelled" : ""}`}>
                <div className="card-top">
                  <div className="card-date">{r.request_date} {r.request_time || ""}</div>
                  <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <div className="info">
                  <div><span className="k">출발:</span> {r.location}</div>
                  <div><span className="k">도착:</span> {r.destination}</div>
                  <div><span className="k">인원:</span> {r.num_people}명</div>
                  {r.flight_info && <div><span className="k">항공:</span> {r.flight_info}</div>}
                </div>
                {r.status === "pending" && <button className="cancel" onClick={() => cancel(r.id)}>신청 취소</button>}
              </div>
            );
          })
        }
      </div>
    </div>
  </>);
}
