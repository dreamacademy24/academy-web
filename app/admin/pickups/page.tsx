"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Pickup {
  id: string; booking_id: string; request_type: string;
  request_date: string; request_time: string; location: string; destination: string;
  num_people: number; flight_info: string; driver_id: string | null;
  status: string; notes: string;
  bookings_new: { booker_name: string; flight_in_airline: string; flight_out_airline: string; num_adults: number; num_children: number } | null;
}
interface Driver { id: string; name: string }

const ST: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정", bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소", bg: "#fef2f2", color: "#dc2626" },
};

function fDate(d: string | null) {
  if (!d) return "-";
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()}(${["일","월","화","수","목","금","토"][dt.getDay()]})`;
}

type Filter = "all" | "pickup" | "dropoff" | "unassigned";

export default function PickupsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [extractMsg, setExtractMsg] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/pickups");
    if (res.ok) { const d = await res.json(); setPickups(d.pickups); setDrivers(d.drivers); }
  }, []);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else window.location.href = "/admin"; }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function extract() {
    setLoading(true); setExtractMsg("");
    const res = await fetch("/api/admin/pickups", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "extract" }),
    });
    const d = await res.json();
    setExtractMsg(d.error ? "오류: " + d.error : `${d.inserted}건 추출 완료`);
    setLoading(false); load();
  }

  async function patch(id: string, updates: Record<string, unknown>) {
    await fetch("/api/admin/pickups", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    load();
  }

  function driverDateTotal(driverId: string | null, date: string) {
    if (!driverId) return 0;
    return pickups
      .filter(p => p.driver_id === driverId && p.request_date === date && p.status !== "cancelled")
      .reduce((s, p) => s + (p.num_people || 0), 0);
  }

  function driverName(id: string | null) {
    if (!id) return "";
    return drivers.find(d => d.id === id)?.name || "";
  }

  const filtered = pickups.filter(p => {
    if (filter === "pickup") return p.request_type === "pickup";
    if (filter === "dropoff") return p.request_type === "dropoff";
    if (filter === "unassigned") return !p.driver_id;
    return true;
  });

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.pk-w{max-width:1000px;margin:0 auto;padding:40px 24px}
.pk-top{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.pk-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.pk-back:hover{background:#e2e8f0}
.pk-top h1{font-size:24px;font-weight:800;flex:1}
.toolbar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.btn{padding:10px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 150ms}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#0d3d7a}
.btn-sm{padding:6px 12px;font-size:12px;border:1px solid #e2e8f0}
.btn-gray{background:#f1f5f9;color:#475569}.btn-gray:hover{background:#e2e8f0}
.btn-on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.msg{font-size:13px;font-weight:600;margin-left:8px}.msg-ok{color:#166534}.msg-err{color:#dc2626}
.cnt{font-size:13px;color:#6b7c93;margin-left:auto}
.sec{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:800px}
.tbl th{background:#f8fafc;padding:10px 8px;text-align:left;font-weight:700;font-size:12px;color:#6b7c93;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.tbl tr:hover{background:#f8fafc}
.tbl tr.over{background:#fef2f2}
.tbl tr.over:hover{background:#fee2e2}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.t-pickup{background:#dbeafe;color:#1e40af}.t-dropoff{background:#fce7f3;color:#9d174d}.t-additional{background:#fef3c7;color:#92400e}
.sel{padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:inherit;outline:none;background:#fff;min-width:90px}.sel:focus{border-color:#1a6fc4}
.warn{color:#dc2626;font-weight:700;font-size:11px;white-space:nowrap}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px}
@media(max-width:700px){.pk-w{padding:24px 12px}.toolbar{flex-direction:column;align-items:stretch}}
    `}</style>
    <div className="pk-w">
      <div className="pk-top">
        <button className="pk-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>픽드랍 관리</h1>
      </div>

      <div className="toolbar">
        <button className="btn btn-blue" onClick={extract} disabled={loading}>
          {loading ? "추출 중..." : "예약에서 자동 추출"}
        </button>
        {extractMsg && <span className={`msg ${extractMsg.startsWith("오류") ? "msg-err" : "msg-ok"}`}>{extractMsg}</span>}
        <span className="cnt">{filtered.length}건</span>
      </div>

      <div className="toolbar">
        {([["all","전체"],["pickup","픽업"],["dropoff","드랍"],["unassigned","미배정"]] as const).map(([k,v]) => (
          <button key={k} className={`btn btn-sm ${filter === k ? "btn-on" : "btn-gray"}`} onClick={() => setFilter(k as Filter)}>{v}</button>
        ))}
      </div>

      <div className="sec">
        {filtered.length === 0 ? (
          <div className="empty">픽드랍 일정이 없습니다</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>유형</th><th>날짜</th><th>시간</th><th>손님</th><th>항공편</th><th>출발</th><th>도착</th><th>인원</th><th>기사 배정</th><th>상태</th></tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const total = driverDateTotal(p.driver_id, p.request_date);
                const over = !!p.driver_id && total > 12;
                const st = ST[p.status] || ST.pending;
                const airline = p.request_type === "pickup"
                  ? p.bookings_new?.flight_in_airline
                  : p.bookings_new?.flight_out_airline;
                return (
                  <tr key={p.id} className={over ? "over" : ""}>
                    <td><span className={`badge t-${p.request_type}`}>{p.request_type === "pickup" ? "픽업" : p.request_type === "dropoff" ? "드랍" : "추가"}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>{fDate(p.request_date)}</td>
                    <td>{p.request_time || "-"}</td>
                    <td>{p.bookings_new?.booker_name || "-"}</td>
                    <td style={{ fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{airline || p.flight_info || "-"}</td>
                    <td>{p.location || "-"}</td>
                    <td>{p.destination || "-"}</td>
                    <td>
                      {p.num_people || 0}명
                      {over && <div className="warn">합산 {total}명!</div>}
                    </td>
                    <td>
                      <select className="sel" value={p.driver_id || ""}
                        onChange={e => patch(p.id, { driver_id: e.target.value || null })}>
                        <option value="">미배정</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      {p.driver_id && <div style={{ fontSize: 11, color: "#6b7c93", marginTop: 2 }}>{driverName(p.driver_id)}</div>}
                    </td>
                    <td>
                      <select className="sel" style={{ background: st.bg, color: st.color, fontWeight: 700, fontSize: 11 }}
                        value={p.status} onChange={e => patch(p.id, { status: e.target.value })}>
                        <option value="pending">대기</option>
                        <option value="confirmed">확정</option>
                        <option value="cancelled">취소</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  </>);
}
