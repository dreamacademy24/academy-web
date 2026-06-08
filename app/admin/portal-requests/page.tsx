"use client";
import { useState, useEffect, useCallback } from "react";
import { toastErr } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

type TabType = "shuttle" | "pickup" | "tutor";
type StatusFilter = "all" | "pending" | "confirmed" | "cancelled";

interface ShuttleReq {
  id: string; booking_id: string | null; request_date: string; request_time: string | null;
  destination: string; num_people: number; round_trip: boolean; status: string;
  notes: string | null; created_at: string; booker_name?: string; reservation_no?: string | null;
}
interface PickupReq {
  id: string; booking_id: string; request_type: string; request_date: string; request_time: string | null;
  location: string; destination: string; num_people: number; flight_info: string; status: string;
  bookings_new: { booker_name: string } | null;
}
interface TutorReq {
  id: string; student_id: string; preferred_days: string; preferred_time: string; status: string; notes: string;
  created_at: string;
  students: { name_kr: string; booking_id: string } | null;
}

const ST: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기중", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정",   bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
};

export default function PortalRequestsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<TabType>("shuttle");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [requests, setRequests] = useState<Array<ShuttleReq | PickupReq | TutorReq>>([]);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else if (typeof window !== "undefined") window.location.href = "/login"; }, []);

  const load = useCallback(async () => {
    if (!authed) return;
    const res = await fetch(`/api/admin/portal-requests?type=${tab}`);
    if (res.ok) { const d = await res.json(); setRequests(d.requests || []); }
  }, [authed, tab]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    const label = status === "confirmed" ? "승인" : "거절";
    if (!confirm(`이 신청을 ${label}하시겠습니까?`)) return;
    const res = await fetch("/api/admin/portal-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: tab, id, status }),
    });
    if (!res.ok) { const r = await res.json(); toastErr(r.error || "처리 실패"); return; }
    load();
  }

  const filtered = requests.filter(r => filter === "all" || r.status === filter);
  const pendingCount = requests.filter(r => r.status === "pending").length;

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.pr-w{max-width:900px;margin:0 auto;padding:32px 24px}
.pr-top{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.pr-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.pr-back:hover{background:#e2e8f0}
.pr-top h1{font-size:22px;font-weight:800;flex:1}
.pr-pending{background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700}
.tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:12px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
.tab{flex:1;padding:12px 8px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:10px;cursor:pointer;font-family:inherit;background:transparent;color:#6b7c93;transition:all 150ms}
.tab.ac{background:#1a6fc4;color:#fff}
.toolbar{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.fbtn{padding:6px 14px;font-size:12px;font-weight:600;border:1px solid #e2e8f0;border-radius:7px;cursor:pointer;font-family:inherit;background:#fff;color:#475569}.fbtn.on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 8px rgba(0,0,0,0.04);margin-bottom:10px;border-left:4px solid #fbbf24}
.card.confirmed{border-left-color:#16a34a}.card.cancelled{border-left-color:#94a3b8;opacity:0.6}
.card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:6px}
.card-guest{font-size:15px;font-weight:800}
.card-rn{font-size:11px;color:#6b7c93;font-weight:600}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:13px;color:#475569;margin-bottom:10px}
.grid .k{font-weight:700;color:#6b7c93;margin-right:4px}
.acts{display:flex;gap:6px;flex-wrap:wrap}
.btn{padding:7px 14px;font-size:12px;font-weight:700;border:none;border-radius:7px;cursor:pointer;font-family:inherit}
.btn-ok{background:#16a34a;color:#fff}.btn-ok:hover{background:#15803d}
.btn-no{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}.btn-no:hover{background:#fee2e2}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px;background:#fff;border-radius:12px;box-shadow:0 1px 8px rgba(0,0,0,0.04)}
@media(max-width:600px){.pr-w{padding:20px 12px}.grid{grid-template-columns:1fr}}
    `}</style>
    <div className="pr-w">
      <div className="pr-top">
        <button className="pr-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>손님 신청 관리</h1>
        {pendingCount > 0 && <span className="pr-pending">대기 {pendingCount}건</span>}
      </div>

      <div className="tabs">
        {([["shuttle","🚌 셔틀"],["pickup","🛬 픽업"],["tutor","👩‍🏫 튜터"]] as const).map(([k,v]) => (
          <button key={k} className={`tab${tab === k ? " ac" : ""}`} onClick={() => { setTab(k as TabType); setFilter("all"); }}>{v}</button>
        ))}
      </div>

      <div className="toolbar">
        {([["all","전체"],["pending","대기중"],["confirmed","확정"],["cancelled","취소"]] as const).map(([k,v]) => (
          <button key={k} className={`fbtn${filter === k ? " on" : ""}`} onClick={() => setFilter(k as StatusFilter)}>{v}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">신청 내역이 없습니다</div>
      ) : filtered.map(r => {
        const st = ST[r.status] || ST.pending;
        const cls = r.status === "confirmed" ? "confirmed" : r.status === "cancelled" ? "cancelled" : "";

        if (tab === "shuttle") {
          const s = r as ShuttleReq;
          return (
            <div key={s.id} className={`card ${cls}`}>
              <div className="card-top">
                <div>
                  <div className="card-guest">{s.booker_name || "-"}</div>
                  {s.reservation_no && <div className="card-rn">{s.reservation_no}</div>}
                </div>
                <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              </div>
              <div className="grid">
                <div><span className="k">날짜:</span>{s.request_date} {s.request_time || ""}</div>
                <div><span className="k">장소:</span>{s.destination}</div>
                <div><span className="k">인원:</span>{s.num_people}명</div>
                <div><span className="k">왕복:</span>{s.round_trip ? "왕복" : "편도"}</div>
              </div>
              {s.status === "pending" && (
                <div className="acts">
                  <button className="btn btn-ok" onClick={() => updateStatus(s.id, "confirmed")}>✓ 승인</button>
                  <button className="btn btn-no" onClick={() => updateStatus(s.id, "cancelled")}>✕ 거절</button>
                </div>
              )}
            </div>
          );
        }

        if (tab === "pickup") {
          const p = r as PickupReq;
          const booker = (p.bookings_new as unknown as { booker_name: string } | null)?.booker_name || "-";
          return (
            <div key={p.id} className={`card ${cls}`}>
              <div className="card-top">
                <div className="card-guest">{booker}</div>
                <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              </div>
              <div className="grid">
                <div><span className="k">유형:</span>{p.request_type === "pickup" ? "픽업" : "드랍"}</div>
                <div><span className="k">날짜:</span>{p.request_date} {p.request_time || ""}</div>
                <div><span className="k">출발:</span>{p.location || "-"}</div>
                <div><span className="k">도착:</span>{p.destination || "-"}</div>
                <div><span className="k">인원:</span>{p.num_people}명</div>
                <div><span className="k">항공:</span>{p.flight_info || "-"}</div>
              </div>
              {p.status === "pending" && (
                <div className="acts">
                  <button className="btn btn-ok" onClick={() => updateStatus(p.id, "confirmed")}>✓ 승인</button>
                  <button className="btn btn-no" onClick={() => updateStatus(p.id, "cancelled")}>✕ 거절</button>
                </div>
              )}
            </div>
          );
        }

        if (tab === "tutor") {
          const t = r as TutorReq;
          const studentName = (t.students as unknown as { name_kr: string } | null)?.name_kr || "-";
          return (
            <div key={t.id} className={`card ${cls}`}>
              <div className="card-top">
                <div className="card-guest">{studentName} 학생</div>
                <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
              </div>
              <div className="grid">
                <div><span className="k">요일:</span>{t.preferred_days || "-"}</div>
                <div><span className="k">시간:</span>{t.preferred_time || "-"}</div>
                {t.notes && <div style={{ gridColumn: "1/3" }}><span className="k">메모:</span>{t.notes}</div>}
              </div>
              {t.status === "pending" && (
                <div className="acts">
                  <button className="btn btn-ok" onClick={() => updateStatus(t.id, "confirmed")}>✓ 승인</button>
                  <button className="btn btn-no" onClick={() => updateStatus(t.id, "cancelled")}>✕ 거절</button>
                </div>
              )}
            </div>
          );
        }
        return null;
      })}
    </div>
  </>);
}
