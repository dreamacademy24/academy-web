"use client";
// 다온맘 예약현황 (어드민) — 구 예약관리 💛 다온맘 탭을 별도 페이지로 이전
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";

interface B { id: string; reservation_no: string | null; booker_name: string | null; students: unknown; accom_type: string | null; checkin_date: string | null; created_at: string | null; status: string | null; paid_amount?: number | null; daon_stage?: string | null; daon_memo?: string | null; }

function stuNames(students: unknown) { try { const s = typeof students === "string" ? JSON.parse(students) : students; if (Array.isArray(s)) return s.map((x: { korName?: string; name_kr?: string }) => x.korName || x.name_kr || "").filter(Boolean).join(", "); } catch { } return ""; }
function shortNo(no: string | null) { return String(no || "").replace(/^DA-\d{8}-/, ""); }
function fDT(v: string | null) { if (!v) return "-"; const d = new Date(v); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear().toString().slice(2)}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }
const bn = (n: string | null | undefined) => String(n || "").replace(/\s/g, "").replace(/[A-Z]$/, "");

export default function DaonAdminPage() {
  const router = useRouter();
  const [rows, setRows] = useState<B[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (typeof window !== "undefined" && !isAdminAuthed()) router.replace("/login"); }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("bookings")
      .select("id,reservation_no,booker_name,students,accom_type,checkin_date,created_at,status,paid_amount,daon_stage,daon_memo")
      .eq("agency", "다온맘").order("created_at");
    setRows((data || []) as B[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const nc: Record<string, number> = {};
  rows.forEach(b => { const k = bn(b.booker_name); if (k) nc[k] = (nc[k] || 0) + 1; });
  const filtered = rows.filter(b => { if (!q) return true; const s = q.toLowerCase(); return [b.booker_name, stuNames(b.students), b.reservation_no].some(v => v && String(v).toLowerCase().includes(s)); });
  const active = filtered.filter(b => !String(b.status || "").includes("취소"));
  const cancelled = filtered.filter(b => String(b.status || "").includes("취소"));
  const stage = (b: B) => String(b.status || "").includes("취소") ? "취소" : /영수증발행|결제완료|완료/.test(String(b.status || "")) ? "예약 확정" : String(b.daon_stage || (Number(b.paid_amount) > 0 ? "예약금 입금" : "신청서 접수"));

  const th: React.CSSProperties = { padding: "9px 8px", fontSize: 12, fontWeight: 800, color: "#92400e", background: "#fef9ec", borderBottom: "2px solid #f1e2b8", textAlign: "left", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "9px 8px", fontSize: 12.5, borderBottom: "1px solid #f5f0e0", verticalAlign: "middle" };

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "22px 24px", fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>💛 다온맘 예약현황 <span style={{ fontSize: 12.5, fontWeight: 700, color: "#92400e", background: "#fef3c7", borderRadius: 8, padding: "2px 9px" }}>공구 종료 · 접수 순</span></h1>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 예약자, 학생, 예약번호" style={{ fontSize: 12.5, padding: "6px 11px", border: "1px solid #d1d5db", borderRadius: 8, width: 210, outline: "none" }} />
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>확정·진행 {active.length}건 · 취소 {cancelled.length}건</span>
        <a href="/daonmam-status" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: "#4338ca", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 8, padding: "6px 12px", textDecoration: "none" }}>공개 현황·정산 페이지 ↗</a>
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>불러오는 중…</div> : (<>
        <div style={{ background: "#fff", border: "1px solid #f1e2b8", borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
            <thead><tr>
              <th style={th}>순번</th><th style={th}>예약번호</th><th style={th}>예약자명</th><th style={th}>학생이름</th><th style={th}>숙소</th><th style={th}>체크인</th><th style={th}>접수일시</th><th style={th}>진행</th><th style={th}>액션</th><th style={{ ...th, minWidth: 150 }}>비고</th>
            </tr></thead>
            <tbody>
              {active.map((b, ix) => (
                <tr key={b.id} style={{ cursor: "pointer" }} onClick={() => router.push("/admin/bookings/" + b.id)}>
                  <td style={{ ...td, fontWeight: 800, color: "#92400e" }}>{ix + 1}</td>
                  <td style={{ ...td, fontWeight: 700, color: "#5b6cf8", whiteSpace: "nowrap" }}>{shortNo(b.reservation_no)}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", fontWeight: 700 }}>{b.booker_name || "-"}{nc[bn(b.booker_name)] > 1 && <span style={{ marginLeft: 5, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "1px 6px" }}>중복</span>}</td>
                  <td style={{ ...td, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={stuNames(b.students)}>{stuNames(b.students)}</td>
                  <td style={{ ...td, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.accom_type || ""}>{b.accom_type || "-"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{b.checkin_date || "-"}</td>
                  <td style={{ ...td, whiteSpace: "nowrap", color: "#64748b" }}>{fDT(b.created_at)}</td>
                  <td style={{ ...td, fontWeight: 800, whiteSpace: "nowrap", color: stage(b) === "예약 확정" ? "#166534" : stage(b) === "예약금 입금" ? "#1e40af" : "#92400e" }}>{stage(b)}</td>
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => router.push("/invoice?id=" + b.id)} style={{ border: "1px solid #c7d2fe", background: "#eef2ff", color: "#4338ca", borderRadius: 6, padding: "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>인보이스</button>
                      <button onClick={() => router.push("/admin/bookings/" + b.id)} style={{ border: "1px solid #cbd5e1", background: "#f8fafc", color: "#475569", borderRadius: 6, padding: "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>상세</button>
                    </div>
                  </td>
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <input key={b.id + "_" + String(b.daon_memo || "")} defaultValue={String(b.daon_memo || "")} placeholder="메모"
                      onBlur={async e => { const v = e.target.value.trim(); if (v === String(b.daon_memo || "")) return; await supabase.from("bookings").update({ daon_memo: v || null }).eq("id", b.id); load(); }}
                      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      style={{ width: 150, padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                  </td>
                </tr>
              ))}
              {active.length === 0 && <tr><td colSpan={10} style={{ ...td, textAlign: "center", padding: 40, color: "#94a3b8" }}>표시할 예약이 없습니다</td></tr>}
            </tbody>
          </table>
        </div>

        {cancelled.length > 0 && (
          <div style={{ marginTop: 18, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#b91c1c", marginBottom: 8 }}>🗑 취소된 예약 ({cancelled.length}건) — 기록 보존</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {cancelled.map(b => (
                <span key={b.id} onClick={() => router.push("/admin/bookings/" + b.id)} style={{ fontSize: 12, color: "#7f1d1d", background: "#fff", border: "1px solid #fecaca", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
                  {b.booker_name || shortNo(b.reservation_no)} <span style={{ color: "#b91c1c" }}>· {fDT(b.created_at).slice(0, 8)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}
