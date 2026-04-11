"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Pickup {
  id: string; booking_id: string; request_type: string;
  request_date: string; request_time: string; location: string; destination: string;
  num_people: number; flight_info: string; driver_id: string | null;
  status: string; notes: string;
  bookings_new: { booker_name: string; booker_phone: string; flight_in_airline: string; num_adults: number; num_children: number } | null;
}
interface Driver { id: string; name: string }

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기",  bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정",  bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소",  bg: "#fef2f2", color: "#dc2626" },
};

function fDate(d: string | null) {
  if (!d) return "-";
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()}(${["일","월","화","수","목","금","토"][dt.getDay()]})`;
}

export default function PickupsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [extractMsg, setExtractMsg] = useState("");
  const [filter, setFilter] = useState<"all" | "pickup" | "dropoff">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/pickups");
    if (res.ok) {
      const d = await res.json();
      setPickups(d.pickups);
      setDrivers(d.drivers);
    }
  }, []);

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true); else window.location.href = "/admin";
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function extract() {
    setLoading(true);
    setExtractMsg("");
    const res = await fetch("/api/admin/pickups", { method: "POST" });
    const d = await res.json();
    if (d.error) { setExtractMsg("오류: " + d.error); }
    else { setExtractMsg(`${d.inserted}건 추출 완료`); }
    setLoading(false);
    load();
  }

  async function assignDriver(pickupId: string, driverId: string | null) {
    await fetch("/api/admin/pickups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pickupId, driver_id: driverId || null }),
    });
    load();
  }

  async function changeStatus(pickupId: string, status: string) {
    await fetch("/api/admin/pickups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pickupId, status }),
    });
    load();
  }

  // 날짜별 인원 합산 (같은 기사)
  function getDriverDateTotal(driverId: string | null, date: string) {
    if (!driverId) return 0;
    return pickups
      .filter(p => p.driver_id === driverId && p.request_date === date && p.status !== "cancelled")
      .reduce((sum, p) => sum + (p.num_people || 0), 0);
  }

  const filtered = pickups.filter(p => {
    if (filter !== "all" && p.request_type !== filter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.pk-w{max-width:960px;margin:0 auto;padding:40px 24px}
.pk-top{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.pk-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.pk-back:hover{background:#e2e8f0}
.pk-top h1{font-size:24px;font-weight:800}
.toolbar{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center}
.btn{padding:10px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 150ms}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#0d3d7a}
.btn-sm{padding:6px 12px;font-size:12px}
.btn-gray{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}.btn-gray:hover{background:#e2e8f0}
.btn-active{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.msg{font-size:13px;color:#166534;font-weight:600;margin-left:8px}
.msg-err{color:#dc2626}
.sec{background:#fff;border-radius:14px;padding:20px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,0.05)}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{background:#f8fafc;padding:10px 8px;text-align:left;font-weight:700;font-size:12px;color:#6b7c93;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.tbl tr:hover{background:#f8fafc}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.type-pickup{background:#dbeafe;color:#1e40af}
.type-dropoff{background:#fce7f3;color:#9d174d}
.type-additional{background:#fef3c7;color:#92400e}
.sel{padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:inherit;outline:none;background:#fff}
.sel:focus{border-color:#1a6fc4}
.warn{color:#dc2626;font-weight:700;font-size:11px}
.stat-sel{padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;font-family:inherit;outline:none;cursor:pointer}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px}
.cnt{font-size:13px;color:#6b7c93;margin-left:auto}
@media(max-width:700px){.pk-w{padding:24px 12px}.tbl{font-size:12px}.tbl th,.tbl td{padding:8px 4px}.toolbar{flex-direction:column;align-items:stretch}}
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
        {extractMsg && <span className={`msg ${extractMsg.startsWith("오류") ? "msg-err" : ""}`}>{extractMsg}</span>}
        <span className="cnt">{filtered.length}건</span>
      </div>

      <div className="toolbar">
        {(["all", "pickup", "dropoff"] as const).map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? "btn-active" : "btn-gray"}`}
            onClick={() => setFilter(f)}>
            {f === "all" ? "전체" : f === "pickup" ? "픽업" : "드랍"}
          </button>
        ))}
        <span style={{ width: 8 }} />
        {(["all", "pending", "confirmed", "cancelled"] as const).map(s => (
          <button key={s} className={`btn btn-sm ${statusFilter === s ? "btn-active" : "btn-gray"}`}
            onClick={() => setStatusFilter(s)}>
            {s === "all" ? "전체상태" : STATUS_MAP[s]?.label || s}
          </button>
        ))}
      </div>

      <div className="sec">
        {filtered.length === 0 ? (
          <div className="empty">픽드랍 일정이 없습니다. 예약에서 자동 추출 버튼을 눌러주세요.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>유형</th>
                <th>날짜</th>
                <th>시간</th>
                <th>손님</th>
                <th>출발</th>
                <th>도착</th>
                <th>인원</th>
                <th>기사 배정</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const dTotal = getDriverDateTotal(p.driver_id, p.request_date);
                const overCap = p.driver_id && dTotal > 12;
                const st = STATUS_MAP[p.status] || STATUS_MAP.pending;
                return (
                  <tr key={p.id}>
                    <td>
                      <span className={`badge type-${p.request_type}`}>
                        {p.request_type === "pickup" ? "픽업" : p.request_type === "dropoff" ? "드랍" : "추가"}
                      </span>
                    </td>
                    <td>{fDate(p.request_date)}</td>
                    <td>{p.request_time || "-"}</td>
                    <td>{p.bookings_new?.booker_name || "-"}</td>
                    <td>{p.location || "-"}</td>
                    <td>{p.destination || "-"}</td>
                    <td>
                      {p.num_people || 0}명
                      {overCap && <div className="warn">합산 {dTotal}명 초과!</div>}
                    </td>
                    <td>
                      <select className="sel" value={p.driver_id || ""}
                        onChange={e => assignDriver(p.id, e.target.value || null)}>
                        <option value="">미배정</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select className="stat-sel"
                        style={{ background: st.bg, color: st.color }}
                        value={p.status}
                        onChange={e => changeStatus(p.id, e.target.value)}>
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
