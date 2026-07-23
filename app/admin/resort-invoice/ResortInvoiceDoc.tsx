"use client";
// 리조트 인보이스 문서 (공용) — 인보이스 생성 페이지 미리보기 + 결제내역 보기 모달에서 사용
// 컨펌넘버(confirm_no)가 있으면 Confirmation No 행이 표시된 "최종 인보이스"가 된다.

export interface ResortInvDocRow {
  invoice_no: string; resort: string; guest_name: string;
  room_type: string; period_start: string; period_end: string; nights: number;
  amount: number; currency: string; created_at: string;
  items?: { label: string; amount: number }[] | null;
  guests_kr?: string | null; guests_en?: string | null;
  reservation_no?: string | null; res_status?: string | null;
  special_request?: string | null; confirm_no?: string | null;
}

const RESORT_X: Record<string, string> = { jaypark: "Dream Academy X J-park", cubenine: "Dream Academy X Cube Nine" };

function num(n: number) { return Number(n || 0).toLocaleString(); }

export default function ResortInvoiceDoc({ inv, domId, guestMode }: { inv: ResortInvDocRow; domId?: string; guestMode?: boolean }) {
  const items = Array.isArray(inv.items) && inv.items.length > 0
    ? inv.items
    : [{ label: `${inv.nights} nights in a ${inv.room_type} Room`, amount: inv.amount }];
  return (<>
    <style>{`
.inv-doc{background:#fff;padding:36px 40px;max-width:820px;margin:0 auto;font-family:'Noto Sans KR',Arial,sans-serif;color:#111}
.inv-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;gap:12px}
.inv-title{background:#fdf6dd;padding:12px 34px;font-size:30px;font-weight:800;letter-spacing:4px;font-family:Georgia,serif}
.inv-x{font-size:14px;font-weight:800;margin-bottom:4px}
.inv-h2{font-size:24px;font-weight:900;margin-bottom:8px}
.ci{width:100%;border-collapse:collapse;font-size:13.5px}
.ci th{background:#f3f4f6;border:1px solid #94a3b8;padding:9px 10px;font-weight:800;width:170px;text-align:center}
.ci td{border:1px solid #94a3b8;padding:9px 12px;text-align:center}
.po{border:1px solid #94a3b8;margin-top:8px}
.po-h{border-bottom:1px solid #94a3b8;padding:9px 12px;font-size:17px;font-weight:900}
.po-items{min-height:130px;padding:12px}
.po-item{display:flex;justify-content:space-between;font-size:14px;padding:4px 2px}
.po-foot{display:grid;grid-template-columns:170px 1fr 170px 1fr;border-top:1px solid #94a3b8;font-size:14px}
.po-foot .k{background:#f3f4f6;padding:10px;font-weight:800;text-align:center;border-right:1px solid #94a3b8}
.po-foot .v{padding:10px 14px;text-align:right;font-weight:700;border-right:1px solid #94a3b8}
.oc{display:grid;grid-template-columns:170px 1fr;border:1px solid #94a3b8;margin-top:8px;font-size:14px}
.oc .k{background:#f3f4f6;padding:12px;font-weight:800;text-align:center;border-right:1px solid #94a3b8}
.oc .v{padding:12px 14px}
    `}</style>
    <div className="inv-doc" id={domId || "resort-inv-doc"}>
      <div className="inv-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dream-academy-logo.png" alt="Dream Company" style={{ height: 54, width: "auto" }} />
        <div className="inv-title">INVOICE{guestMode && <div style={{ fontSize: 12, letterSpacing: 2, fontWeight: 700, textAlign: "center", color: "#92400e" }}>GUEST COPY</div>}</div>
      </div>
      <div className="inv-x">{RESORT_X[inv.resort] || ""}</div>
      <div className="inv-h2">Customer Information</div>
      <table className="ci"><tbody>
        <tr><th>Reservation Name</th><td>{inv.guest_name}</td><th>Reservation Number</th><td style={inv.confirm_no ? { fontWeight: 900, fontSize: 15, color: "#b45309", background: "#fffbeb" } : {}}>{inv.confirm_no || ""}</td></tr>
        <tr><th>Reservation Date</th><td>{inv.created_at?.slice(0, 10)}</td><th>Reservation Status</th><td style={{ fontWeight: 800 }}>{inv.confirm_no ? "confirmed" : (inv.res_status || "tentatively")}</td></tr>
        <tr><th>Check-In</th><td>{inv.period_start}</td><th>time</th><td>오후 3:00</td></tr>
        <tr><th>Check-Out</th><td>{inv.period_end}</td><th>time</th><td style={{ color: "#dc2626", fontWeight: 700 }}>12:00 noon</td></tr>
        <tr><th>Room Type</th><td>{inv.room_type}</td><th>Nights</th><td>{inv.nights} nights</td></tr>
        <tr><th>Guest Name(korean)</th><td colSpan={3} style={{ textAlign: "left" }}>{inv.guests_kr || ""}</td></tr>
        <tr><th>Guest Name(En)</th><td colSpan={3} style={{ textAlign: "left" }}>{inv.guests_en || ""}</td></tr>
      </tbody></table>
      <div className="inv-h2" style={{ marginTop: 26 }}>Invoice Details</div>
      <div className="po">
        <div className="po-h">Purchase Order</div>
        <div className="po-items">
          {items.map((it, i) => (
            <div key={i} className="po-item"><span>{it.label}</span>{!guestMode && <span style={{ fontWeight: i === 0 ? 500 : 800 }}>{num(it.amount)}</span>}</div>
          ))}
        </div>
        {guestMode ? (
          <div className="po-foot" style={{ gridTemplateColumns: "170px 1fr" }}>
            <div className="k">Payment</div><div className="v" style={{ textAlign: "left", borderRight: "none" }}>Fully settled by Dream Company (Travel Agency)</div>
          </div>
        ) : (
          <div className="po-foot">
            <div className="k">Total Amount</div><div className="v">{num(inv.amount)}</div>
            <div className="k">Payment Amount</div><div className="v" style={{ borderRight: "none" }}>{num(inv.amount)}</div>
          </div>
        )}
      </div>
      <div className="inv-h2" style={{ marginTop: 26, fontSize: 19 }}>Other Confirmation Items</div>
      <div className="oc">
        <div className="k">Special Requests</div>
        <div className="v">{inv.special_request || "-"}</div>
      </div>
    </div>
  </>);
}
