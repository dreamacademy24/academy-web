"use client";
import { useState, useEffect } from "react";

interface BillItem { label: string; price: number; season: string }
interface Disc { id: number; name: string; amount: number }
interface LC { id: number; name: string; amount: string }
interface ReceiptPayload {
  cust: { name: string; englishName: string; reservationNo: string; reservationDate: string; checkInDate: string; checkInTime: string; checkOutDate: string; checkOutTime: string; packageType: string; people: string };
  bill: { basePrice: number; items: BillItem[] };
  discs: Disc[];
  locals: LC[];
  ci: { pickup: string; drop: string; flightIn: string; flightOut: string; bedSetting: string; usim: string; houseNo: string; specialRequest: string };
  totalDiscount: number;
  finalPrice: number;
}

function fmt(n: number) { return n.toLocaleString("ko-KR"); }

export default function ReceiptPage() {
  const [data, setData] = useState<ReceiptPayload | null>(null);
  const [sent, setSent] = useState(false);
  const [receiptNo] = useState(() => "R-" + String(Date.now()).slice(0, 8));
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("receiptData");
      if (raw) setData(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Google Sheets 기록
  useEffect(() => {
    if (!data || sent) return;
    const d = data;
    const accom = d.cust.packageType || "";
    fetch("/api/receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: d.cust.name, englishName: d.cust.englishName,
        checkInDate: d.cust.checkInDate, checkOutDate: d.cust.checkOutDate,
        flightIn: d.ci.flightIn, flightOut: d.ci.flightOut,
        accom, packageType: d.cust.packageType,
        people: d.cust.people, pickup: d.ci.pickup, drop: d.ci.drop,
        studentName: d.cust.name, studentEnglish: d.cust.englishName,
        studentAge: "", studentType: "", amOrFull: "",
        academyWeeks: d.cust.packageType, peopleCount: d.cust.people,
        houseNo: d.ci.houseNo,
        agency: "", balanceDate: "", note: d.ci.specialRequest,
        ssp: "", photoPermit: "",
        registrationDate: today,
      }),
    }).catch(e => console.error("시트 기록 실패:", e));
    setSent(true);
  }, [data, sent, today]);

  if (!data) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontFamily: "'Noto Sans KR',sans-serif", color: "#6b7c93", fontSize: "16px" }}>
      데이터가 없습니다
    </div>
  );

  const { cust, bill, discs, locals, totalDiscount, finalPrice } = data;

  return (
    <>
      <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f8fafc;color:#1a1a2e;}
.rw{max-width:700px;margin:0 auto;padding:40px 24px 60px;}
.rv{background:#fff;padding:48px 40px;box-shadow:0 2px 20px rgba(0,0,0,0.08);}
.rh{text-align:center;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #1a1a2e;}
.rh .logo{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:900;letter-spacing:0.05em;color:#1a1a2e;}
.rh .sub{font-size:11px;color:#6b7c93;letter-spacing:0.05em;margin-top:2px;}
.rh h1{font-family:'Montserrat',sans-serif;font-size:26px;font-weight:900;letter-spacing:0.1em;color:#1a6fc4;margin-top:12px;}
.rh h1 span{font-size:14px;font-weight:600;color:#6b7c93;letter-spacing:0.05em;}
.rm{display:flex;justify-content:space-between;margin-bottom:24px;font-size:12px;color:#6b7c93;}
.rm strong{color:#1a1a2e;}
.rs{margin-bottom:24px;}
.rst{font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#1a6fc4;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;}
.rt{width:100%;border-collapse:collapse;}
.rt th{font-size:11px;font-weight:700;color:#6b7c93;padding:8px 12px;text-align:left;background:#f8fafc;border:1px solid #e2e8f0;}
.rt td{font-size:13px;padding:10px 12px;border:1px solid #e2e8f0;color:#1a1a2e;}
.rt .lb{font-weight:600;background:#fafbfc;width:28%;color:#374151;font-size:12px;}
.rt .dc{color:#dc2626;font-weight:600;}
.rt .fr td{font-weight:800;font-size:15px;background:#1a6fc4;color:#fff;}
.rf{margin-top:32px;text-align:center;padding:24px;border:2px dashed #e2e8f0;border-radius:8px;}
.rf p{font-size:14px;font-weight:600;color:#374151;margin-bottom:16px;}
.stamp{display:inline-block;border:3px solid #dc2626;border-radius:8px;padding:10px 24px;color:#dc2626;font-size:16px;font-weight:900;letter-spacing:0.1em;transform:rotate(-5deg);opacity:0.85;}
.rb{display:flex;gap:10px;justify-content:center;margin-top:24px;}
.rbn{padding:12px 32px;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
.rbn.pr{background:#1a6fc4;color:#fff;}.rbn.pr:hover{background:#0d3d7a;}
.rbn.cl{background:#f1f5f9;color:#1a1a2e;border:1px solid #e2e8f0;}.rbn.cl:hover{background:#e2e8f0;}
@media print{body{background:#fff!important;}.no-print{display:none!important;}.rw{padding:0!important;}.rv{box-shadow:none!important;padding:24px!important;}}
@media(max-width:600px){.rv{padding:24px 16px;}.rm{flex-direction:column;gap:4px;}}
      `}</style>

      <div className="rw">
        <div className="rv">
          <div className="rh">
            <div className="logo">DREAM ACADEMY</div>
            <div className="sub">Philippines</div>
            <h1>RECEIPT <span>/ 영수증</span></h1>
          </div>

          <div className="rm">
            <div>발행일: <strong>{today}</strong></div>
            <div>영수증 번호: <strong>{receiptNo}</strong></div>
          </div>

          <div className="rs">
            <div className="rst">Customer Information</div>
            <table className="rt"><tbody>
              <tr><td className="lb">예약자명</td><td>{cust.name}</td><td className="lb">영문이름</td><td>{cust.englishName}</td></tr>
              <tr><td className="lb">체크인</td><td>{cust.checkInDate}</td><td className="lb">체크아웃</td><td>{cust.checkOutDate}</td></tr>
              <tr><td className="lb">패키지</td><td>{cust.packageType}</td><td className="lb">인원</td><td>{cust.people}</td></tr>
            </tbody></table>
          </div>

          <div className="rs">
            <div className="rst">Billing Details</div>
            <table className="rt">
              <thead><tr><th style={{ width: "60%" }}>항목</th><th style={{ width: "40%", textAlign: "right" }}>금액</th></tr></thead>
              <tbody>
                {bill.items.length > 0
                  ? bill.items.map((item, i) => (
                    <tr key={i}><td>{item.label}{item.season ? ` (${item.season})` : ""}</td><td style={{ textAlign: "right" }}>{fmt(item.price)}원</td></tr>
                  ))
                  : <tr><td>패키지 금액</td><td style={{ textAlign: "right" }}>{fmt(bill.basePrice)}원</td></tr>
                }
                {discs.filter(d => d.name).map((d, i) => (
                  <tr key={`d${i}`}><td className="dc">↓ {d.name}</td><td className="dc" style={{ textAlign: "right" }}>-{fmt(Number(d.amount))}원</td></tr>
                ))}
                {totalDiscount > 0 && (
                  <tr><td style={{ fontWeight: 600 }}>총 할인</td><td style={{ textAlign: "right", color: "#dc2626", fontWeight: 600 }}>-{fmt(totalDiscount)}원</td></tr>
                )}
                <tr className="fr"><td>청구 금액</td><td style={{ textAlign: "right" }}>{fmt(finalPrice)}원</td></tr>
              </tbody>
            </table>
          </div>

          {locals.filter(c => c.name && c.amount).length > 0 && (
            <div className="rs">
              <div className="rst">Local Payment</div>
              <table className="rt">
                <thead><tr><th style={{ width: "60%" }}>현지 지불 항목</th><th style={{ width: "40%", textAlign: "right" }}>금액</th></tr></thead>
                <tbody>
                  {locals.filter(c => c.name && c.amount).map((c, i) => (
                    <tr key={i}><td>{c.name}</td><td style={{ textAlign: "right" }}>{c.amount}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rf">
            <p>위 금액을 정히 영수합니다.</p>
            <div className="stamp">DREAM ACADEMY</div>
          </div>
        </div>

        <div className="rb no-print">
          <button className="rbn pr" onClick={() => window.print()}>PDF 저장 / 인쇄</button>
          <button className="rbn cl" onClick={() => window.close()}>닫기</button>
        </div>
      </div>
    </>
  );
}
