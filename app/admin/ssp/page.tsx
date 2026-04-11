"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthed } from "@/lib/adminAuth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface SSP {
  id: string; booking_id: string; student_name: string; booker_name: string;
  checkin_date: string; status: string; applied_date: string; notes: string;
}

const STATUS_CYCLE = ["pending", "applied", "issued"] as const;
const ST: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "미신청", bg: "#f1f5f9", color: "#64748b" },
  applied: { label: "신청완료", bg: "#fef3c7", color: "#92400e" },
  issued:  { label: "발급완료", bg: "#dcfce7", color: "#166534" },
};

export default function SSPPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [records, setRecords] = useState<SSP[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("ssp_records").select("*").order("checkin_date", { ascending: true });
    if (data) setRecords(data as SSP[]);
  }, []);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else if (typeof window !== "undefined") window.location.href = "/admin"; }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function toggleStatus(r: SSP) {
    const idx = STATUS_CYCLE.indexOf(r.status as typeof STATUS_CYCLE[number]);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    const updates: Record<string, unknown> = { status: next };
    if (next === "applied" && !r.applied_date) updates.applied_date = new Date().toISOString().slice(0, 10);
    await supabase.from("ssp_records").update(updates).eq("id", r.id);
    setRecords(prev => prev.map(x => x.id === r.id ? { ...x, status: next, applied_date: (updates.applied_date as string) || x.applied_date } : x));
  }

  const filtered = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.student_name?.toLowerCase().includes(q) || r.booker_name?.toLowerCase().includes(q) || r.booking_id?.toLowerCase().includes(q);
  });

  const cntAll = records.length;
  const cntApplied = records.filter(r => r.status === "applied").length;
  const cntIssued = records.filter(r => r.status === "issued").length;
  const cntPending = records.filter(r => r.status === "pending").length;

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.sp-w{max-width:900px;margin:0 auto;padding:32px 24px}
.sp-top{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.sp-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.sp-back:hover{background:#e2e8f0}
.sp-top h1{font-size:22px;font-weight:800;flex:1}
.stats{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.stat{padding:10px 18px;border-radius:10px;font-size:12px;border:1px solid #e2e8f0}
.stat .num{font-size:18px;font-weight:800;margin-top:2px}
.toolbar{display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap}
.toolbar input{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;flex:1;min-width:180px}.toolbar input:focus{border-color:#1a6fc4}
.cnt{font-size:13px;color:#6b7c93;margin-left:auto}
.sec{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:700px}
.tbl th{background:#f8fafc;padding:10px 10px;text-align:left;font-weight:700;font-size:12px;color:#6b7c93;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:10px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.tbl tr:hover{background:#f8fafc}
.badge{display:inline-block;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;user-select:none;transition:all 100ms}.badge:hover{opacity:0.8}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px}
@media(max-width:600px){.sp-w{padding:20px 12px}.stats{flex-direction:column}.toolbar{flex-direction:column;align-items:stretch}}
    `}</style>
    <div className="sp-w">
      <div className="sp-top">
        <button className="sp-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>SSP 관리</h1>
      </div>

      <div className="stats">
        <div className="stat" style={{ background: "#fff" }}><div style={{ color: "#6b7c93" }}>전체</div><div className="num">{cntAll}</div></div>
        <div className="stat" style={{ background: "#fef3c7", borderColor: "#fde68a" }}><div style={{ color: "#92400e" }}>신청완료</div><div className="num" style={{ color: "#92400e" }}>{cntApplied}</div></div>
        <div className="stat" style={{ background: "#dcfce7", borderColor: "#bbf7d0" }}><div style={{ color: "#166534" }}>발급완료</div><div className="num" style={{ color: "#166534" }}>{cntIssued}</div></div>
        <div className="stat" style={{ background: "#f1f5f9", borderColor: "#e2e8f0" }}><div style={{ color: "#64748b" }}>미신청</div><div className="num" style={{ color: "#64748b" }}>{cntPending}</div></div>
      </div>

      <div className="toolbar">
        <input placeholder="학생이름, 예약자명, 예약번호 검색" value={search} onChange={e => setSearch(e.target.value)} />
        <span className="cnt">{filtered.length}건</span>
      </div>

      <div className="sec">
        {filtered.length === 0 ? (
          <div className="empty">SSP 기록이 없습니다</div>
        ) : (
          <table className="tbl">
            <thead><tr><th>예약번호</th><th>학생이름</th><th>예약자명</th><th>체크인</th><th>상태</th><th>신청일</th><th>메모</th></tr></thead>
            <tbody>
              {filtered.map(r => {
                const st = ST[r.status] || ST.pending;
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, color: "#1a6fc4" }}>{r.booking_id || "-"}</td>
                    <td style={{ fontWeight: 600 }}>{r.student_name || "-"}</td>
                    <td>{r.booker_name || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.checkin_date || "-"}</td>
                    <td>
                      <span className="badge" style={{ background: st.bg, color: st.color }}
                        onClick={() => toggleStatus(r)} title="클릭하여 상태 변경">
                        {st.label}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.applied_date || "-"}</td>
                    <td style={{ fontSize: 12, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.notes || "-"}</td>
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
