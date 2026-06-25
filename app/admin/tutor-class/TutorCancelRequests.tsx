"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CancelReq {
  id: string;
  lesson_id: string;
  application_id: string | null;
  booking_id: string | null;
  cancel_date: string;
  reason: string | null;
  is_refundable: boolean;
  status: string;
  resolution: string | null;
  admin_note: string | null;
  processed_by: string | null;
  processed_at: string | null;
  requested_by: string | null;
  student_name: string | null;
  tutor_id: string | null;
  req_type: string | null;
  created_at: string;
}

const ST: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: "대기중", bg: "#fef3c7", color: "#92400e" },
  approved: { label: "승인", bg: "#dcfce7", color: "#166534" },
  rejected: { label: "거절", bg: "#fef2f2", color: "#dc2626" },
};

export default function TutorCancelRequests({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const [items, setItems] = useState<CancelReq[]>([]);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [processId, setProcessId] = useState<string>("");
  const [resolution, setResolution] = useState<"deduct" | "makeup" | "no_deduct">("deduct");
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [processAction, setProcessAction] = useState<"approve" | "reject">("approve");
  const [tutorMap, setTutorMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tutor/cancel-requests?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data || []);
      }
    } catch { /* */ }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // 튜터 이름 매핑
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("tutors").select("id,name");
      if (data) {
        const m: Record<string, string> = {};
        data.forEach((t: any) => { m[t.id] = t.name; });
        setTutorMap(m);
      }
    })();
  }, []);

  // pending 카운트 전달
  useEffect(() => {
    if (onCountChange) {
      (async () => {
        const res = await fetch("/api/admin/tutor/cancel-requests?status=pending");
        if (res.ok) {
          const data = await res.json();
          onCountChange(data?.length || 0);
        }
      })();
    }
  }, [onCountChange]);

  function openProcess(cr: CancelReq, action: "approve" | "reject") {
    setProcessId(cr.id);
    setProcessAction(action);
    setResolution(cr.is_refundable ? "deduct" : "deduct");
    setAdminNote("");
  }

  async function submitProcess() {
    if (!processId) return;
    setSaving(true);
    try {
      const adminName = typeof window !== "undefined" ? localStorage.getItem("admin_user") || "admin" : "admin";
      const res = await fetch("/api/admin/tutor/cancel-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: processId,
          status: processAction === "approve" ? "approved" : "rejected",
          resolution: processAction === "approve" ? resolution : null,
          admin_note: adminNote || null,
          processed_by: adminName,
        }),
      });
      if (res.ok) {
        setProcessId("");
        load();
        // 카운트 갱신
        if (onCountChange) {
          const cRes = await fetch("/api/admin/tutor/cancel-requests?status=pending");
          if (cRes.ok) { const d = await cRes.json(); onCountChange(d?.length || 0); }
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "처리 실패");
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setSaving(false);
    }
  }

  const processItem = items.find(i => i.id === processId);

  return (<>
    <style>{`
.tcr-w{background:#fff;border-radius:14px;padding:24px 22px;box-shadow:0 2px 12px rgba(0,0,0,0.05)}
.tcr-top{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.tcr-top h2{font-size:17px;font-weight:800;flex:1}
.tcr-chips{display:flex;gap:4px}
.tcr-chip{padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;font-family:inherit;transition:all 120ms;color:#64748b}
.tcr-chip:hover{background:#f1f5f9}.tcr-chip.on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.tcr-empty{text-align:center;padding:48px 20px;color:#94a3b8;font-size:14px;font-weight:600}
.tcr-card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:10px;transition:all 120ms}
.tcr-card:hover{border-color:#bfdbfe;box-shadow:0 2px 8px rgba(0,0,0,0.04)}
.tcr-row{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}
.tcr-main{flex:1;min-width:200px}
.tcr-date{font-size:18px;font-weight:800;color:#dc2626}
.tcr-stu{font-size:14px;font-weight:700;color:#1a1a2e;margin-top:2px}
.tcr-meta{font-size:12px;color:#64748b;margin-top:4px;line-height:1.7}
.tcr-meta b{color:#374151}
.tcr-reason{margin-top:6px;padding:6px 10px;background:#f8fafc;border-radius:6px;font-size:12px;color:#475569;border-left:3px solid #cbd5e1}
.tcr-refund{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;margin-top:4px}
.tcr-actions{display:flex;gap:6px;align-items:center;flex-shrink:0}
.tcr-btn{padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:700;border:none;cursor:pointer;font-family:inherit;transition:all 120ms}
.tcr-approve{background:#dcfce7;color:#166534}.tcr-approve:hover{background:#bbf7d0}
.tcr-reject{background:#fef2f2;color:#dc2626}.tcr-reject:hover{background:#fecaca}
.tcr-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700}
.tcr-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:100;display:flex;align-items:center;justify-content:center}
.tcr-modal{background:#fff;border-radius:16px;padding:24px;max-width:440px;width:94%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
.tcr-modal h3{font-size:16px;font-weight:800;margin-bottom:12px}
@media(max-width:600px){.tcr-w{padding:16px 14px}.tcr-row{flex-direction:column}.tcr-actions{width:100%;justify-content:flex-end}}
    `}</style>

    <div className="tcr-w">
      <div className="tcr-top">
        <h2>🚫 수업 취소 요청</h2>
        <div className="tcr-chips">
          {(["pending","approved","rejected","all"] as const).map(f => (
            <button key={f} className={`tcr-chip${filter === f ? " on" : ""}`} onClick={() => setFilter(f)}>
              {f === "pending" ? "대기중" : f === "approved" ? "승인" : f === "rejected" ? "거절" : "전체"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="tcr-empty">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="tcr-empty">{filter === "pending" ? "대기 중인 취소 요청이 없습니다." : "해당 항목이 없습니다."}</div>
      ) : (
        items.map(cr => {
          const st = ST[cr.status] || ST.pending;
          return (
            <div key={cr.id} className="tcr-card">
              <div className="tcr-row">
                <div className="tcr-main">
                  <div className="tcr-date">{cr.cancel_date}
                    {cr.req_type && cr.req_type !== "cancel" && <span style={{marginLeft:8,fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:6,background:"#eff6ff",color:"#1d4ed8",verticalAlign:"middle"}}>{cr.req_type === "time_change" ? "시간변경 요청" : cr.req_type === "date_change" ? "날짜변경 요청" : cr.req_type}</span>}
                  </div>
                  <div className="tcr-stu">{cr.student_name || "-"}</div>
                  <div className="tcr-meta">
                    <b>요청자:</b> {cr.requested_by || "-"} · <b>선생님:</b> {(cr.tutor_id && tutorMap[cr.tutor_id]) || "-"}<br />
                    <b>요청 시각:</b> {cr.created_at ? new Date(cr.created_at).toLocaleString("ko-KR") : "-"}
                  </div>
                  {cr.reason && <div className="tcr-reason">{cr.reason}</div>}
                  <div className="tcr-refund" style={{
                    background: cr.is_refundable ? "#eff6ff" : "#fef2f2",
                    color: cr.is_refundable ? "#1e40af" : "#991b1b"
                  }}>
                    {cr.is_refundable ? "환불 가능 (4일 전)" : "⚠️ 환불 불가 (4일 이내)"}
                  </div>
                  {cr.status !== "pending" && (
                    <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                      <b>처리:</b>{" "}
                      <span className="tcr-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      {cr.resolution && <span style={{ marginLeft: 6 }}>({cr.resolution === "deduct" ? "차감" : cr.resolution === "no_deduct" ? "미차감" : "보강"})</span>}
                      {cr.processed_by && <span style={{ marginLeft: 6 }}>· {cr.processed_by}</span>}
                      {cr.admin_note && <div style={{ marginTop: 4, fontStyle: "italic" }}>메모: {cr.admin_note}</div>}
                    </div>
                  )}
                </div>
                <div className="tcr-actions">
                  {cr.status === "pending" && (<>
                    <button className="tcr-btn tcr-approve" onClick={() => openProcess(cr, "approve")}>✅ 승인</button>
                    <button className="tcr-btn tcr-reject" onClick={() => openProcess(cr, "reject")}>❌ 거절</button>
                  </>)}
                  {cr.status !== "pending" && (
                    <span className="tcr-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>

    {/* 처리 모달 */}
    {processId && processItem && (
      <div className="tcr-modal-bg" onClick={() => !saving && setProcessId("")}>
        <div className="tcr-modal" onClick={e => e.stopPropagation()}>
          <h3>{processAction === "approve" ? "✅ 취소 승인" : "❌ 취소 거절"}</h3>
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>
            <div><b>학생:</b> {processItem.student_name || "-"}</div>
            <div><b>취소일:</b> <span style={{ color: "#dc2626", fontWeight: 700 }}>{processItem.cancel_date}</span></div>
            <div><b>환불 가능:</b> {processItem.is_refundable ? "예 (4일 전 취소)" : "아니오 (4일 이내)"}</div>
            {processItem.reason && <div><b>사유:</b> {processItem.reason}</div>}
          </div>

          {processAction === "approve" && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>처리 방법</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setResolution("deduct")}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: resolution === "deduct" ? "2px solid #dc2626" : "1px solid #e2e8f0",
                    background: resolution === "deduct" ? "#fef2f2" : "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    color: resolution === "deduct" ? "#dc2626" : "#64748b"
                  }}
                >
                  📉 차감<br /><span style={{ fontSize: 11, fontWeight: 500 }}>회차 1회 차감</span>
                </button>
                <button
                  onClick={() => setResolution("makeup")}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: resolution === "makeup" ? "2px solid #1a6fc4" : "1px solid #e2e8f0",
                    background: resolution === "makeup" ? "#eff6ff" : "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    color: resolution === "makeup" ? "#1a6fc4" : "#64748b"
                  }}
                >
                  🔄 보강<br /><span style={{ fontSize: 11, fontWeight: 500 }}>다른 날 보강 예정</span>
                </button>
                <button
                  onClick={() => setResolution("no_deduct")}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: resolution === "no_deduct" ? "2px solid #059669" : "1px solid #e2e8f0",
                    background: resolution === "no_deduct" ? "#ecfdf5" : "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                    color: resolution === "no_deduct" ? "#059669" : "#64748b"
                  }}
                >
                  💚 미차감<br /><span style={{ fontSize: 11, fontWeight: 500 }}>차감 없이 취소</span>
                </button>
              </div>
              {!processItem.is_refundable && resolution === "deduct" && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: "#991b1b", fontWeight: 600, background: "#fef2f2", padding: "6px 10px", borderRadius: 6 }}>
                  ⚠️ 4일 이내 취소 — 차감 처리가 권장됩니다.
                </div>
              )}
              {resolution === "no_deduct" && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: "#065f46", fontWeight: 600, background: "#ecfdf5", padding: "6px 10px", borderRadius: 6 }}>
                  💚 회차 차감 없이 취소됩니다. (아픈 경우 등 특별 사유)
                </div>
              )}
            </div>
          )}

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>관리자 메모 (선택)</label>
          <textarea
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            placeholder="내부 메모"
            style={{ width: "100%", minHeight: 60, padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }}
          />

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button
              onClick={() => setProcessId("")}
              disabled={saving}
              style={{ padding: "9px 14px", background: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            >닫기</button>
            <button
              onClick={submitProcess}
              disabled={saving}
              style={{
                padding: "9px 18px",
                background: processAction === "approve" ? "#166534" : "#dc2626",
                color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                opacity: saving ? 0.6 : 1
              }}
            >{saving ? "처리 중..." : processAction === "approve" ? "승인 확정" : "거절 확정"}</button>
          </div>
        </div>
      </div>
    )}
  </>);
}
