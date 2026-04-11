"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Shuttle {
  id: string; booking_id: string;
  request_date: string; request_time: string; destination: string;
  num_people: number; round_trip: boolean;
  driver_id: string | null; status: string; notes: string;
  bookings_new: { booker_name: string; num_adults: number; num_children: number } | null;
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

type Filter = "all" | "pending" | "confirmed" | "cancelled";

export default function ShuttlePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [shuttles, setShuttles] = useState<Shuttle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/shuttle");
    if (res.ok) { const d = await res.json(); setShuttles(d.shuttles); setDrivers(d.drivers); }
  }, []);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else window.location.href = "/admin"; }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function patch(id: string, updates: Record<string, unknown>) {
    await fetch("/api/admin/shuttle", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    load();
  }

  function driverDateTotal(driverId: string | null, date: string) {
    if (!driverId) return 0;
    return shuttles
      .filter(s => s.driver_id === driverId && s.request_date === date && s.status !== "cancelled")
      .reduce((sum, s) => sum + (s.num_people || 0) * (s.round_trip ? 2 : 1), 0);
  }

  const filtered = shuttles.filter(s => filter === "all" || s.status === filter);

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.sh-w{max-width:1000px;margin:0 auto;padding:40px 24px}
.sh-top{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.sh-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.sh-back:hover{background:#e2e8f0}
.sh-top h1{font-size:24px;font-weight:800;flex:1}
.toolbar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.btn{padding:10px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 150ms}
.btn-sm{padding:6px 12px;font-size:12px;border:1px solid #e2e8f0}
.btn-gray{background:#f1f5f9;color:#475569}.btn-gray:hover{background:#e2e8f0}
.btn-on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.cnt{font-size:13px;color:#6b7c93;margin-left:auto}
.sec{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:700px}
.tbl th{background:#f8fafc;padding:10px 8px;text-align:left;font-weight:700;font-size:12px;color:#6b7c93;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.tbl tr:hover{background:#f8fafc}
.tbl tr.over{background:#fef2f2}
.tbl tr.over:hover{background:#fee2e2}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.b-rt{background:#e0e7ff;color:#3730a3}.b-ow{background:#fef3c7;color:#92400e}
.sel{padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:inherit;outline:none;background:#fff;min-width:90px}.sel:focus{border-color:#1a6fc4}
.warn{color:#dc2626;font-weight:700;font-size:11px;white-space:nowrap}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px}
@media(max-width:700px){.sh-w{padding:24px 12px}.toolbar{flex-direction:column;align-items:stretch}}
    `}</style>
    <div className="sh-w">
      <div className="sh-top">
        <button className="sh-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>셔틀 관리</h1>
      </div>

      <div className="toolbar">
        {([["all","전체"],["pending","대기"],["confirmed","확정"],["cancelled","취소"]] as const).map(([k,v]) => (
          <button key={k} className={`btn btn-sm ${filter === k ? "btn-on" : "btn-gray"}`} onClick={() => setFilter(k as Filter)}>{v}</button>
        ))}
        <span className="cnt">{filtered.length}건</span>
      </div>

      <div className="sec">
        {filtered.length === 0 ? (
          <div className="empty">셔틀 신청이 없습니다</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>날짜</th><th>시간</th><th>손님</th><th>목적지</th><th>인원</th><th>왕복</th><th>기사 배정</th><th>상태</th><th>메모</th></tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const total = driverDateTotal(s.driver_id, s.request_date);
                const over = !!s.driver_id && total > 12;
                const st = ST[s.status] || ST.pending;
                return (
                  <tr key={s.id} className={over ? "over" : ""}>
                    <td style={{ whiteSpace: "nowrap" }}>{fDate(s.request_date)}</td>
                    <td>{s.request_time || "-"}</td>
                    <td>{s.bookings_new?.booker_name || "-"}</td>
                    <td>{s.destination || "-"}</td>
                    <td>
                      {s.num_people || 0}명
                      {over && <div className="warn">합산 {total}명!</div>}
                    </td>
                    <td><span className={`badge ${s.round_trip ? "b-rt" : "b-ow"}`}>{s.round_trip ? "왕복" : "편도"}</span></td>
                    <td>
                      <select className="sel" value={s.driver_id || ""}
                        onChange={e => patch(s.id, { driver_id: e.target.value || null })}>
                        <option value="">미배정</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="sel" style={{ background: st.bg, color: st.color, fontWeight: 700, fontSize: 11 }}
                        value={s.status} onChange={e => patch(s.id, { status: e.target.value })}>
                        <option value="pending">대기</option>
                        <option value="confirmed">확정</option>
                        <option value="cancelled">취소</option>
                      </select>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.notes || "-"}</td>
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
