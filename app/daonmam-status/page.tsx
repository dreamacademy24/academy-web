"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type Bk = {
  id: string; reservation_no: string | null; booker_name: string | null;
  accom_type: string | null; accom_weeks: number | null;
  checkin_date: string | null; checkout_date: string | null;
  adults: number | null; children: number | null;
  payment_status: string | null; paid_amount: number | null;
  daon_stage: string | null; created_at: string | null; status: string | null;
};

const STAGES = ["신청서 접수", "예약금 입금", "확정예약 진행중", "예약 확정"];
const STAGE_C: Record<string, { c: string; bg: string }> = {
  "신청서 접수": { c: "#92400e", bg: "#fef3c7" },
  "예약금 입금": { c: "#1e40af", bg: "#dbeafe" },
  "확정예약 진행중": { c: "#6b21a8", bg: "#f3e8ff" },
  "예약 확정": { c: "#166534", bg: "#dcfce7" },
};

function shortNo(no: string | null) { return no ? no.split("-").pop() : "-"; }
function mask(name: string | null) { const n = (name || "").trim(); return n.length <= 1 ? (n || "-") : n[0] + "*" + n.slice(2); }

export default function DaonmamStatusPage() {
  const [rows, setRows] = useState<Bk[]>([]);
  const [loaded, setLoaded] = useState(false);
  async function load() {
    const { data } = await supabase.from("bookings")
      .select("id,reservation_no,booker_name,accom_type,accom_weeks,checkin_date,checkout_date,adults,children,payment_status,paid_amount,daon_stage,created_at,status")
      .eq("agency", "다온맘").order("created_at", { ascending: false });
    setRows((data as Bk[]) || []); setLoaded(true);
  }
  useEffect(() => { load(); }, []);
  async function setStage(id: string, v: string) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, daon_stage: v } : r));
    const { error } = await supabase.from("bookings").update({ daon_stage: v }).eq("id", id);
    if (error) { alert("저장 실패: " + error.message); load(); }
  }
  const effStage = (r: Bk) => String(r.status || "").includes("취소") ? "취소" : /영수증발행|결제완료|완료/.test(String(r.status || "")) ? "예약 확정" : (r.daon_stage || "신청서 접수");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCnt = rows.filter(r => r.created_at && new Date(r.created_at) >= today).length;
  const paidCnt = rows.filter(r => effStage(r) !== "취소" && (effStage(r) !== "신청서 접수" || (r.paid_amount || 0) > 0)).length;
  const confirmedCnt = rows.filter(r => effStage(r) === "예약 확정").length;
  return (
    <div style={{ fontFamily: "'Noto Sans KR',sans-serif", background: "#faf6ef", minHeight: "100vh", padding: "30px 16px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{ background: "#1f2937", color: "#fde68a", borderRadius: 999, padding: "6px 16px", fontSize: 12, fontWeight: 800 }}>다온맘 X 드림아카데미 공동구매</span>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: "12px 0 4px", color: "#1f2937" }}>공구 예약 현황</h1>
          <p style={{ fontSize: 13, color: "#8a7c5e" }}>실시간 접수 현황이에요 · 개인정보 보호를 위해 이름은 일부 가려져 있어요</p>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 18, flexWrap: "wrap" }}>
          {[["총 접수", rows.length + "건"], ["오늘 접수", todayCnt + "건"], ["예약금 확인", paidCnt + "건"], ["예약 확정", confirmedCnt + "건"]].map(([k, v]) => (
            <div key={k} style={{ background: "#fff", border: "1px solid #eee4cf", borderRadius: 12, padding: "12px 22px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#8a7c5e", fontWeight: 700 }}>{k}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#1f2937" }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", border: "1px solid #eee4cf", borderRadius: 14, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 860 }}>
            <thead><tr style={{ background: "#f7efdc", color: "#6b5b3e" }}>
              {["번호", "예약자", "숙소", "기간", "체크인", "체크아웃", "인원", "진행 상태", "접수일"].map(h => <th key={h} style={{ padding: "10px 8px", fontWeight: 800 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {!loaded ? (<tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "#a89a78" }}>불러오는 중…</td></tr>)
              : rows.length === 0 ? (<tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "#a89a78" }}>아직 접수된 예약이 없어요</td></tr>)
              : rows.map(b => { const st = effStage(b); const cancelled = String(b.status || "").includes("취소"); const confirmed = !cancelled && /영수증발행|결제완료|완료/.test(String(b.status || "")); const sc = cancelled ? { bg: "#fee2e2", c: "#dc2626" } : (STAGE_C[st] || STAGE_C["신청서 접수"]); return (
                <tr key={b.id} style={{ borderTop: "1px solid #f5edd9", textAlign: "center", opacity: cancelled ? 0.55 : 1 }}>
                  <td style={{ padding: "9px 6px", fontWeight: 700, color: "#8a6414" }}>{shortNo(b.reservation_no)}</td>
                  <td style={{ padding: "9px 6px", fontWeight: 700, textDecoration: cancelled ? "line-through" : "none" }}>{mask(b.booker_name)}</td>
                  <td style={{ padding: "9px 6px" }}>{b.accom_type || "-"}</td>
                  <td style={{ padding: "9px 6px", fontWeight: 700 }}>{b.accom_weeks ? b.accom_weeks + "주" : "-"}</td>
                  <td style={{ padding: "9px 6px" }}>{b.checkin_date || "-"}</td>
                  <td style={{ padding: "9px 6px" }}>{b.checkout_date || "-"}</td>
                  <td style={{ padding: "9px 6px" }}>{(b.adults || 0) + (b.children || 0)}명</td>
                  <td style={{ padding: "9px 6px" }}>
                    {cancelled
                      ? <span style={{ display: "inline-block", background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 800 }}>취소</span>
                      : confirmed
                      ? <span style={{ display: "inline-block", background: sc.bg, color: sc.c, border: "1px solid " + sc.c + "33", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 800 }}>✅ 예약 확정</span>
                      : <select value={st} onChange={e => setStage(b.id, e.target.value)}
                          style={{ background: sc.bg, color: sc.c, border: "1px solid " + sc.c + "33", borderRadius: 8, padding: "4px 8px", fontSize: 12, fontWeight: 800, fontFamily: "inherit" }}>
                          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>}
                  </td>
                  <td style={{ padding: "9px 6px", color: "#a89a78", fontSize: 12 }}>{(b.created_at || "").slice(5, 10)}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: "#a89a78", marginTop: 16 }}>신청서 접수 → 예약금 입금 → 확정예약 진행중 → 예약 확정 · 새로고침하면 최신 현황 · 문의 pf.kakao.com/_Yuhxhn</p>
      </div>
    </div>
  );
}
