"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { resolvePortalSession } from "@/lib/portalSession";

interface Session { booking_id: string; booking_number: string; guest_name: string; expires: number }
interface Flight { airline: string; date: string; time: string }
interface FlightData { locked: boolean; days_left: number | null; check_in: string; flight_in: Flight; flight_out: Flight }

export default function PortalFlightPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<FlightData | null>(null);
  const [fIn, setFIn] = useState<Flight>({ airline: "", date: "", time: "" });
  const [fOut, setFOut] = useState<Flight>({ airline: "", date: "", time: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const s = await resolvePortalSession();
      if (!s) { router.replace("/portal"); return; }
      setSession(s as Session);
    })();
  }, [router]);

  const load = useCallback(async () => {
    if (!session) return;
    const res = await fetch(`/api/portal/flight?booking_id=${session.booking_id}`);
    if (res.ok) {
      const d = await res.json();
      setData(d);
      setFIn(d.flight_in || { airline: "", date: "", time: "" });
      setFOut(d.flight_out || { airline: "", date: "", time: "" });
    }
  }, [session]);

  useEffect(() => { if (session) load(); }, [session, load]);

  async function save() {
    if (!session) return;
    setSaving(true); setMsg("");
    const res = await fetch("/api/portal/flight", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: session.booking_id, flight_in: fIn, flight_out: fOut }),
    });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) { setMsg(result.error || "저장 실패"); return; }
    setMsg("저장되었습니다. 관리자에게 알림이 전송되었습니다.");
    load();
  }

  if (!session) return null;

  const locked = data?.locked || false;

  return (<>
    <style>{`
.fl-w{max-width:640px;margin:0 auto;padding:24px 24px 40px}
.fl-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:12px}.fl-back:hover{color:#1a6fc4}
.fl-head{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:16px;padding:20px;color:#fff;margin-bottom:12px}
.fl-head h1{font-size:18px;font-weight:800;margin-bottom:2px}
.fl-head p{font-size:12px;opacity:0.8}
.sec{background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 8px rgba(0,0,0,0.04);margin-bottom:10px}
.sec h2{font-size:14px;font-weight:800;color:#1a6fc4;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:6px}
.lbl{display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px}
.inp{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px}.inp:focus{border-color:#1a6fc4}
.inp:disabled{background:#f1f5f9;color:#94a3b8;cursor:not-allowed}
.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.locked{background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px;color:#92400e;font-weight:600;line-height:1.5}
.info{background:#f0f7ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#1e40af;line-height:1.5}
.btn{width:100%;padding:14px;background:linear-gradient(135deg,#1a6fc4,#7c3aed);color:#fff;font-size:15px;font-weight:700;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:8px}.btn:hover{opacity:0.9}.btn:disabled{opacity:0.5;cursor:not-allowed}
.msg{margin-top:12px;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;text-align:center}
.msg-ok{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}
.msg-err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
@media(max-width:500px){.fl-w{padding:20px 16px}.row{grid-template-columns:1fr}}
    `}</style>
    <div className="fl-w">
      <button className="fl-back" onClick={() => router.push("/portal/dashboard")}>← 대시보드로</button>

      <div className="fl-head">
        <h1>✈️ 항공편 등록</h1>
        <p>{session.guest_name}님의 입/출국 항공편</p>
      </div>

      {locked ? (
        <div className="locked">
          🔒 체크인 {data?.days_left !== null ? data?.days_left : "?"}일 전입니다. 수정이 제한됩니다.<br/>
          변경이 필요하시면 관리자에게 문의해주세요.
        </div>
      ) : data?.days_left !== null && data?.days_left !== undefined && (
        <div className="info">체크인까지 <b>{data.days_left}일</b> 남았습니다. 체크인 7일 전까지 수정 가능합니다.</div>
      )}

      <div className="sec">
        <h2>🛬 입국 항공편</h2>
        <label className="lbl">항공편명</label>
        <input className="inp" placeholder="예: KE631" value={fIn.airline}
          onChange={e => setFIn({ ...fIn, airline: e.target.value })} disabled={locked} />
        <div className="row">
          <div>
            <label className="lbl">날짜</label>
            <input className="inp" type="date" value={fIn.date}
              onChange={e => setFIn({ ...fIn, date: e.target.value })} disabled={locked} />
          </div>
          <div>
            <label className="lbl">시간</label>
            <input className="inp" type="time" value={fIn.time}
              onChange={e => setFIn({ ...fIn, time: e.target.value })} disabled={locked} />
          </div>
        </div>
      </div>

      <div className="sec">
        <h2>🛫 출국 항공편</h2>
        <label className="lbl">항공편명</label>
        <input className="inp" placeholder="예: KE632" value={fOut.airline}
          onChange={e => setFOut({ ...fOut, airline: e.target.value })} disabled={locked} />
        <div className="row">
          <div>
            <label className="lbl">날짜</label>
            <input className="inp" type="date" value={fOut.date}
              onChange={e => setFOut({ ...fOut, date: e.target.value })} disabled={locked} />
          </div>
          <div>
            <label className="lbl">시간</label>
            <input className="inp" type="time" value={fOut.time}
              onChange={e => setFOut({ ...fOut, time: e.target.value })} disabled={locked} />
          </div>
        </div>
      </div>

      {!locked && (
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "저장 중..." : "저장하기"}
        </button>
      )}

      {msg && <div className={`msg ${msg.includes("실패") || msg.includes("없습니다") || msg.includes("관리자") ? "msg-err" : "msg-ok"}`}>{msg}</div>}
    </div>
  </>);
}
