"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type Bk = {
  id: string; reservation_no: string | null; booker_name: string | null;
  accom_type: string | null; accom_weeks: number | null;
  checkin_date: string | null; checkout_date: string | null;
  adults: number | null; children: number | null;
  payment_status: string | null; paid_amount: number | null; final_price: number | null;
  daon_stage: string | null; created_at: string | null; status: string | null;
};

const STAGE_C: Record<string, { c: string; bg: string }> = {
  "신청서 접수": { c: "#64748b", bg: "#f1f5f9" },
  "예약금 입금": { c: "#1d4ed8", bg: "#eff6ff" },
  "확정예약 진행중": { c: "#7c3aed", bg: "#f5f3ff" },
  "예약 확정": { c: "#047857", bg: "#ecfdf5" },
  "취소": { c: "#b91c1c", bg: "#fef2f2" },
};
const SEL_STAGES = ["신청서 접수", "예약금 입금", "확정예약 진행중", "취소"];

function shortNo(no: string | null) { return no ? no.split("-").pop() : "-"; }
function mask(name: string | null) { return (name || "-").trim() || "-"; }
function tail4(p: string | null | undefined) { const d = String(p || "").replace(/\D/g, ""); return d ? d.slice(-4) : ""; }
function won(n: number | null | undefined) { const v = Number(n) || 0; return v ? v.toLocaleString("ko-KR") + "원" : "-"; }

export default function DaonmamStatusPage() {
  const [rows, setRows] = useState<Bk[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  async function load() {
    const { data } = await supabase.from("bookings")
      .select("id,reservation_no,booker_name,booker_phone,accom_type,accom_weeks,checkin_date,checkout_date,adults,children,payment_status,paid_amount,final_price,daon_stage,created_at,status")
      .eq("agency", "다온맘").order("created_at", { ascending: false });
    setRows((data as Bk[]) || []); setLoaded(true);
  }
  useEffect(() => { load(); }, []);
  async function setStage(id: string, v: string) {
    if (v === "취소") {
      if (!confirm("이 예약을 취소 처리할까요?\n예약 기록은 보존되고 자리는 반환됩니다.")) { load(); return; }
      setRows(rs => rs.map(r => r.id === id ? { ...r, daon_stage: "취소", status: "취소" } : r));
      const { error } = await supabase.from("bookings").update({ daon_stage: "취소", status: "취소" }).eq("id", id);
      if (error) { alert("저장 실패: " + error.message); load(); return; }
      try {
        const { data: st } = await supabase.from("app_settings").select("value").eq("key", "cube9_room_blocks").maybeSingle();
        const bl = (Array.isArray(st?.value) ? st!.value : []) as { booking_id?: string }[];
        if (bl.some(x => x.booking_id === id)) { await supabase.from("app_settings").upsert({ key: "cube9_room_blocks", value: bl.filter(x => x.booking_id !== id) }, { onConflict: "key" }); }
      } catch { /* noop */ }
      return;
    }
    setRows(rs => rs.map(r => r.id === id ? { ...r, daon_stage: v } : r));
    const { error } = await supabase.from("bookings").update({ daon_stage: v }).eq("id", id);
    if (error) { alert("저장 실패: " + error.message); load(); }
  }
  const isCancelled = (r: Bk) => String(r.status || "").includes("취소");
  const isConfirmed = (r: Bk) => !isCancelled(r) && /영수증발행|결제완료|완료/.test(String(r.status || ""));
  const effStage = (r: Bk) => isCancelled(r) ? "취소" : isConfirmed(r) ? "예약 확정" : (r.daon_stage || "신청서 접수");
  const baseName = (n: string | null) => String(n || "").replace(/\s/g, "").replace(/[A-Z]$/, "");
  const nameCnt: { [k: string]: number } = {};
  rows.forEach(r => { if (!isCancelled(r)) { const k = baseName(r.booker_name); if (k) nameCnt[k] = (nameCnt[k] || 0) + 1; } });

  const active = rows.filter(r => !isCancelled(r) && !isConfirmed(r));
  const confirmed = rows.filter(isConfirmed);
  const cancelled = rows.filter(isCancelled);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCnt = rows.filter(r => !isCancelled(r) && r.created_at && new Date(r.created_at) >= today).length;
  const paidCnt = rows.filter(r => !isCancelled(r) && ((r.paid_amount || 0) > 0 || effStage(r) !== "신청서 접수")).length;
  const sumFinal = confirmed.reduce((s, r) => s + (Number(r.final_price) || 0), 0);
  const sumPaid = confirmed.reduce((s, r) => s + (Number(r.paid_amount) || 0), 0);

  const th: React.CSSProperties = { padding: "10px 8px", fontSize: 12, fontWeight: 700, color: "#475569", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "center", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "10px 8px", fontSize: 13, textAlign: "center", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 26 };
  const secTitle = (t: string, n: number, color: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 16px", borderBottom: "1px solid #e2e8f0", background: "#fff" }}>
      <span style={{ width: 4, height: 16, background: color, borderRadius: 2, display: "inline-block" }} />
      <span style={{ fontSize: 14.5, fontWeight: 800, color: "#0f172a" }}>{t}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color, background: color + "14", borderRadius: 8, padding: "1px 8px" }}>{n}건</span>
    </div>
  );
  const nameCell = (b: Bk) => (<span style={{ fontWeight: 700 }}>{mask(b.booker_name)}{tail4((b as unknown as { booker_phone?: string }).booker_phone) && <span style={{ marginLeft: 5, color: "#64748b", fontWeight: 600, fontSize: 11.5 }}>({tail4((b as unknown as { booker_phone?: string }).booker_phone)})</span>}{nameCnt[baseName(b.booker_name)] > 1 && <span style={{ marginLeft: 4, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 5, padding: "0 5px", fontSize: 10, fontWeight: 800 }}>중복</span>}</span>);
  const period = (b: Bk) => <>{b.accom_weeks ? b.accom_weeks + "주" : "-"}</>;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f6f8", fontFamily: "\'Pretendard\',\'Noto Sans KR\',sans-serif", color: "#0f172a" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 16px 80px" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <span style={{ display: "inline-block", background: "#0f172a", color: "#fff", fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "5px 14px", letterSpacing: 0.3 }}>다온맘 X 드림아카데미 공동구매</span>
          <h1 style={{ fontSize: 25, fontWeight: 900, margin: "12px 0 6px" }}>공구 예약 현황</h1>
          <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>실시간 접수 현황 · 이름 옆 괄호 = 연락처 뒷 4자리</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 28 }}>
          {[["총 접수", (rows.length - cancelled.length) + "건", "#0f172a"], ["오늘 접수", todayCnt + "건", "#1d4ed8"], ["예약금 확인", paidCnt + "건", "#7c3aed"], ["예약 확정", confirmed.length + "건", "#047857"], ["취소", cancelled.length + "건", "#b91c1c"]].map(([t, v, c]) => (
            <div key={t as string} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{t}</div>
              <div style={{ fontSize: 21, fontWeight: 900, color: c as string, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* ── 예약 확정 (영수증 발급) ── */}
        <div style={card}>
          {secTitle("예약 확정 (영수증 발급 완료)", confirmed.length, "#047857")}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead><tr><th style={th}>#</th><th style={th}>번호</th><th style={th}>예약자</th><th style={th}>숙소</th><th style={th}>기간</th><th style={th}>체크인</th><th style={th}>전체 금액</th><th style={th}>입금액</th><th style={th}>납부 현황</th></tr></thead>
              <tbody>
                {!loaded ? <tr><td colSpan={10} style={{ ...td, padding: 30, color: "#94a3b8" }}>불러오는 중…</td></tr>
                : confirmed.length === 0 ? <tr><td colSpan={9} style={{ ...td, padding: 30, color: "#94a3b8" }}>확정된 예약이 없습니다</td></tr>
                : confirmed.map((b, _i) => {
                  const fp = Number(b.final_price) || 0, paid = Number(b.paid_amount) || 0;
                  const bal = Math.max(0, fp - paid);
                  const full = fp > 0 && paid >= fp;
                  return (
                    <tr key={b.id}>
                      <td style={{ ...td, fontWeight: 800, color: "#0f172a" }}>{_i + 1}</td>
                      <td style={{ ...td, color: "#94a3b8", fontSize: 12 }}>{shortNo(b.reservation_no)}</td>
                      <td style={td}>{nameCell(b)}</td>
                      <td style={td}>{b.accom_type || "-"}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{period(b)}</td>
                      <td style={td}>{b.checkin_date || "-"}</td>
                      <td style={{ ...td, fontWeight: 800 }}>{won(fp)}</td>
                      <td style={{ ...td, fontWeight: 800, color: "#1d4ed8" }}>{won(paid)}</td>
                      <td style={td}>{fp <= 0
                        ? <span style={{ fontSize: 12, color: "#94a3b8" }}>금액 확인 중</span>
                        : full
                        ? <span style={{ background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", borderRadius: 7, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>완납 ✓</span>
                        : <span style={{ background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", borderRadius: 7, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>잔금 {won(bal)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {confirmed.length > 0 && <div style={{ display: "flex", justifyContent: "flex-end", gap: 22, padding: "11px 16px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", fontSize: 13 }}>
            <span style={{ color: "#475569" }}>확정 합계 <b style={{ color: "#0f172a" }}>{won(sumFinal)}</b></span>
            <span style={{ color: "#475569" }}>입금 합계 <b style={{ color: "#1d4ed8" }}>{won(sumPaid)}</b></span>
            <span style={{ color: "#475569" }}>잔금 합계 <b style={{ color: "#c2410c" }}>{won(Math.max(0, sumFinal - sumPaid))}</b></span>
          </div>}
        </div>

        {/* ── 진행 중 ── */}
        <div style={card}>
          {secTitle("진행 중 (접수 · 상담)", active.length, "#1d4ed8")}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead><tr><th style={th}>#</th><th style={th}>번호</th><th style={th}>예약자</th><th style={th}>숙소</th><th style={th}>기간</th><th style={th}>체크인</th><th style={th}>체크아웃</th><th style={th}>인원</th><th style={th}>진행 상태</th><th style={th}>접수일</th></tr></thead>
              <tbody>
                {!loaded ? <tr><td colSpan={9} style={{ ...td, padding: 30, color: "#94a3b8" }}>불러오는 중…</td></tr>
                : active.length === 0 ? <tr><td colSpan={10} style={{ ...td, padding: 30, color: "#94a3b8" }}>진행 중 예약이 없습니다</td></tr>
                : active.map((b, _i) => { const st = effStage(b); const sc = STAGE_C[st] || STAGE_C["신청서 접수"]; return (
                  <tr key={b.id}>
                    <td style={{ ...td, fontWeight: 800, color: "#0f172a" }}>{_i + 1}</td>
                    <td style={{ ...td, color: "#94a3b8", fontSize: 12 }}>{shortNo(b.reservation_no)}</td>
                    <td style={td}>{nameCell(b)}</td>
                    <td style={td}>{b.accom_type || "-"}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{period(b)}</td>
                    <td style={td}>{b.checkin_date || "-"}</td>
                    <td style={td}>{b.checkout_date || "-"}</td>
                    <td style={td}>{(b.adults || 0) + (b.children || 0)}명</td>
                    <td style={td}>
                      <select value={st} onChange={e => setStage(b.id, e.target.value)}
                        style={{ background: sc.bg, color: sc.c, border: "1px solid " + sc.c + "33", borderRadius: 7, padding: "4px 8px", fontSize: 12, fontWeight: 800, fontFamily: "inherit" }}>
                        {SEL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, color: "#94a3b8", fontSize: 12 }}>{(b.created_at || "").slice(5, 10)}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 취소 ── */}
        {cancelled.length > 0 && (
          <div style={{ ...card, borderColor: "#fecaca" }}>
            <button onClick={() => setShowCancel(v => !v)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", fontFamily: "inherit" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 16px" }}>
                <span style={{ width: 4, height: 16, background: "#b91c1c", borderRadius: 2, display: "inline-block" }} />
                <span style={{ fontSize: 14.5, fontWeight: 800, color: "#0f172a" }}>취소된 예약</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c", background: "#fef2f2", borderRadius: 8, padding: "1px 8px" }}>{cancelled.length}건</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8" }}>{showCancel ? "접기 ▲" : "펼치기 ▼"}</span>
              </div>
            </button>
            {showCancel && <div style={{ overflowX: "auto", borderTop: "1px solid #fecaca" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead><tr><th style={th}>#</th><th style={th}>번호</th><th style={th}>예약자</th><th style={th}>숙소</th><th style={th}>기간</th><th style={th}>체크인</th><th style={th}>접수일</th></tr></thead>
                <tbody>{cancelled.map((b, _i) => (
                  <tr key={b.id} style={{ opacity: 0.6 }}>
                    <td style={{ ...td, fontWeight: 700, color: "#94a3b8" }}>{_i + 1}</td>
                    <td style={{ ...td, color: "#94a3b8", fontSize: 12 }}>{shortNo(b.reservation_no)}</td>
                    <td style={{ ...td, textDecoration: "line-through", color: "#6b7280" }}>{mask(b.booker_name)}</td>
                    <td style={td}>{b.accom_type || "-"}</td>
                    <td style={td}>{period(b)}</td>
                    <td style={td}>{b.checkin_date || "-"}</td>
                    <td style={{ ...td, color: "#94a3b8", fontSize: 12 }}>{(b.created_at || "").slice(5, 10)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>}
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11.5, color: "#94a3b8", marginTop: 10 }}>본 현황판은 드림아카데미 관리 시스템과 실시간 연동됩니다.</p>
      </div>
    </div>
  );
}
