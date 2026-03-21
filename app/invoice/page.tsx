"use client";
import { useState } from "react";

interface Discount {
  id: number;
  name: string;
  amount: number;
}

interface LocalCharge {
  id: number;
  name: string;
  amount: string;
}

export default function InvoicePage() {
  const [customer, setCustomer] = useState({
    name: "", reservationNo: "", reservationDate: "", checkInDate: "", checkInTime: "15:00",
    checkOutDate: "", checkOutTime: "12:00", packageType: "", people: "", englishName: "",
  });
  const [billing, setBilling] = useState({ basePrice: 0 });
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [localCharges, setLocalCharges] = useState<LocalCharge[]>([]);
  const [checkIn, setCheckIn] = useState({
    pickup: "O", drop: "O", flightIn: "", flightOut: "", bedSetting: "", usim: "", houseNo: "", specialRequest: "",
  });
  const [showPreview, setShowPreview] = useState(false);
  let discountIdCounter = Date.now();
  let localIdCounter = Date.now() + 1;

  function addDiscount() {
    setDiscounts([...discounts, { id: discountIdCounter++, name: "", amount: 0 }]);
  }
  function removeDiscount(id: number) {
    setDiscounts(discounts.filter((d) => d.id !== id));
  }
  function updateDiscount(id: number, field: string, value: string | number) {
    setDiscounts(discounts.map((d) => d.id === id ? { ...d, [field]: value } : d));
  }
  function addLocalCharge() {
    setLocalCharges([...localCharges, { id: localIdCounter++, name: "", amount: "" }]);
  }
  function removeLocalCharge(id: number) {
    setLocalCharges(localCharges.filter((c) => c.id !== id));
  }
  function updateLocalCharge(id: number, field: string, value: string) {
    setLocalCharges(localCharges.map((c) => c.id === id ? { ...c, [field]: value } : c));
  }

  const totalDiscount = discounts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const finalPrice = billing.basePrice - totalDiscount;

  function handleGenerate() {
    if (!customer.name) { alert("예약자명을 입력해주세요."); return; }
    setShowPreview(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
  }

  function fmt(n: number) { return n.toLocaleString("ko-KR"); }

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
        a{text-decoration:none;color:inherit;}

        /* FORM */
        .form-wrap{max-width:800px;margin:0 auto;padding:40px 24px 60px;}
        .form-header{text-align:center;margin-bottom:32px;}
        .form-header h1{font-size:28px;font-weight:800;margin-bottom:6px;}
        .form-header p{font-size:14px;color:#6b7c93;}
        .form-section{background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:20px;}
        .form-section h2{font-size:16px;font-weight:800;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #1a1a2e;display:flex;align-items:center;gap:8px;}
        .f-row{display:flex;gap:12px;margin-bottom:12px;}
        .f-group{flex:1;}
        .f-label{display:block;font-size:11px;font-weight:600;color:#6b7c93;margin-bottom:4px;}
        .f-input,.f-select,.f-textarea{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:'Noto Sans KR',sans-serif;outline:none;}
        .f-input:focus,.f-select:focus,.f-textarea:focus{border-color:#1a6fc4;}
        .f-textarea{resize:vertical;min-height:60px;}
        .f-select{background:#fff;}
        .disc-row{display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;}
        .disc-row .f-group{flex:2;}
        .disc-row .f-group:last-of-type{flex:1;}
        .btn-sm{padding:6px 14px;font-size:12px;font-weight:700;border-radius:6px;border:none;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
        .btn-add{background:#eaf3fb;color:#1a6fc4;border:1px solid #bfdbfe;}
        .btn-add:hover{background:#dbeafe;}
        .btn-rm{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:6px 10px;}
        .btn-rm:hover{background:#fee2e2;}
        .btn-generate{width:100%;padding:14px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:10px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-top:8px;}
        .btn-generate:hover{background:#0d3d7a;}
        .back-link{display:block;text-align:center;margin-top:16px;font-size:13px;color:#6b7c93;}
        .back-link:hover{color:#1a6fc4;}

        /* INVOICE PREVIEW */
        .invoice-wrap{max-width:800px;margin:0 auto;padding:40px 24px 60px;}
        .invoice{background:#fff;padding:48px 40px;border-radius:0;box-shadow:0 2px 20px rgba(0,0,0,0.08);}
        .inv-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #1a1a2e;}
        .inv-logo{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:900;letter-spacing:0.02em;color:#1a1a2e;}
        .inv-logo-sub{font-size:11px;color:#6b7c93;font-weight:400;letter-spacing:0.05em;}
        .inv-title{text-align:right;}
        .inv-title h1{font-family:'Montserrat',sans-serif;font-size:28px;font-weight:900;letter-spacing:0.08em;color:#1a6fc4;}
        .inv-title p{font-size:11px;color:#6b7c93;margin-top:2px;}

        .inv-section{margin-bottom:28px;}
        .inv-section-title{font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#1a6fc4;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;}
        .inv-table{width:100%;border-collapse:collapse;}
        .inv-table th{font-size:11px;font-weight:700;color:#6b7c93;padding:8px 12px;text-align:left;background:#f8fafc;border:1px solid #e2e8f0;letter-spacing:0.03em;}
        .inv-table td{font-size:13px;padding:10px 12px;border:1px solid #e2e8f0;color:#1a1a2e;}
        .inv-table .label{font-weight:600;background:#fafbfc;width:30%;color:#374151;font-size:12px;}
        .inv-table .discount{color:#dc2626;font-weight:600;}
        .inv-table .total-row td{font-weight:800;font-size:14px;background:#f0f7ff;}
        .inv-table .final-row td{font-weight:800;font-size:15px;background:#1a6fc4;color:#fff;}

        .inv-footer{margin-top:32px;padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#6b7c93;line-height:1.8;word-break:keep-all;}

        .print-btns{display:flex;gap:10px;justify-content:center;margin-top:24px;}
        .btn-print{padding:12px 32px;background:#1a6fc4;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
        .btn-print:hover{background:#0d3d7a;}
        .btn-back{padding:12px 32px;background:#f1f5f9;color:#1a1a2e;font-size:14px;font-weight:600;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
        .btn-back:hover{background:#e2e8f0;}

        @media print{
          body{background:#fff !important;}
          .no-print{display:none !important;}
          .invoice-wrap{padding:0 !important;}
          .invoice{box-shadow:none !important;padding:24px !important;}
        }
        @media(max-width:600px){
          .f-row{flex-direction:column;gap:12px;}
          .inv-top{flex-direction:column;gap:12px;}
          .invoice{padding:24px 16px;}
          .disc-row{flex-direction:column;gap:8px;}
        }
      `}</style>

      {!showPreview ? (
        <div className="form-wrap">
          <div className="form-header">
            <h1>인보이스 생성</h1>
            <p>정보를 입력하면 인쇄 가능한 인보이스가 생성됩니다.</p>
          </div>

          {/* 고객 정보 */}
          <div className="form-section">
            <h2>고객 정보</h2>
            <div className="f-row">
              <div className="f-group">
                <label className="f-label">예약자명</label>
                <input className="f-input" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              </div>
              <div className="f-group">
                <label className="f-label">영문이름</label>
                <input className="f-input" placeholder="HONG GILDONG" value={customer.englishName} onChange={(e) => setCustomer({ ...customer, englishName: e.target.value })} />
              </div>
            </div>
            <div className="f-row">
              <div className="f-group">
                <label className="f-label">예약번호</label>
                <input className="f-input" value={customer.reservationNo} onChange={(e) => setCustomer({ ...customer, reservationNo: e.target.value })} />
              </div>
              <div className="f-group">
                <label className="f-label">예약일</label>
                <input className="f-input" type="date" value={customer.reservationDate} onChange={(e) => setCustomer({ ...customer, reservationDate: e.target.value })} />
              </div>
            </div>
            <div className="f-row">
              <div className="f-group">
                <label className="f-label">체크인 날짜</label>
                <input className="f-input" type="date" value={customer.checkInDate} onChange={(e) => setCustomer({ ...customer, checkInDate: e.target.value })} />
              </div>
              <div className="f-group">
                <label className="f-label">체크인 시간</label>
                <input className="f-input" type="time" value={customer.checkInTime} onChange={(e) => setCustomer({ ...customer, checkInTime: e.target.value })} />
              </div>
            </div>
            <div className="f-row">
              <div className="f-group">
                <label className="f-label">체크아웃 날짜</label>
                <input className="f-input" type="date" value={customer.checkOutDate} onChange={(e) => setCustomer({ ...customer, checkOutDate: e.target.value })} />
              </div>
              <div className="f-group">
                <label className="f-label">체크아웃 시간</label>
                <input className="f-input" type="time" value={customer.checkOutTime} onChange={(e) => setCustomer({ ...customer, checkOutTime: e.target.value })} />
              </div>
            </div>
            <div className="f-row">
              <div className="f-group">
                <label className="f-label">패키지 종류</label>
                <input className="f-input" placeholder="예) 드림하우스 4주" value={customer.packageType} onChange={(e) => setCustomer({ ...customer, packageType: e.target.value })} />
              </div>
              <div className="f-group">
                <label className="f-label">인원 구성</label>
                <input className="f-input" placeholder="예) 보호자1 + 아이2" value={customer.people} onChange={(e) => setCustomer({ ...customer, people: e.target.value })} />
              </div>
            </div>
          </div>

          {/* 결제 정보 */}
          <div className="form-section">
            <h2>결제 정보</h2>
            <div className="f-row">
              <div className="f-group">
                <label className="f-label">패키지 정가 (원)</label>
                <input className="f-input" type="number" value={billing.basePrice || ""} onChange={(e) => setBilling({ basePrice: Number(e.target.value) })} />
              </div>
            </div>

            <label className="f-label" style={{ marginTop: "12px", marginBottom: "8px" }}>할인 항목</label>
            {discounts.map((d) => (
              <div className="disc-row" key={d.id}>
                <div className="f-group">
                  <input className="f-input" placeholder="할인 이름" value={d.name} onChange={(e) => updateDiscount(d.id, "name", e.target.value)} />
                </div>
                <div className="f-group">
                  <input className="f-input" type="number" placeholder="금액" value={d.amount || ""} onChange={(e) => updateDiscount(d.id, "amount", Number(e.target.value))} />
                </div>
                <button className="btn-sm btn-rm" onClick={() => removeDiscount(d.id)}>삭제</button>
              </div>
            ))}
            <button className="btn-sm btn-add" onClick={addDiscount}>+ 할인 추가</button>

            <label className="f-label" style={{ marginTop: "16px", marginBottom: "8px" }}>현지 지불 항목</label>
            {localCharges.map((c) => (
              <div className="disc-row" key={c.id}>
                <div className="f-group">
                  <input className="f-input" placeholder="항목명" value={c.name} onChange={(e) => updateLocalCharge(c.id, "name", e.target.value)} />
                </div>
                <div className="f-group">
                  <input className="f-input" placeholder="금액 (예: 7,000 pesos)" value={c.amount} onChange={(e) => updateLocalCharge(c.id, "amount", e.target.value)} />
                </div>
                <button className="btn-sm btn-rm" onClick={() => removeLocalCharge(c.id)}>삭제</button>
              </div>
            ))}
            <button className="btn-sm btn-add" onClick={addLocalCharge}>+ 현지 지불 항목 추가</button>
          </div>

          {/* 체크인 정보 */}
          <div className="form-section">
            <h2>체크인 정보</h2>
            <div className="f-row">
              <div className="f-group">
                <label className="f-label">픽업 여부</label>
                <select className="f-select" value={checkIn.pickup} onChange={(e) => setCheckIn({ ...checkIn, pickup: e.target.value })}>
                  <option value="O">O (있음)</option>
                  <option value="X">X (없음)</option>
                </select>
              </div>
              <div className="f-group">
                <label className="f-label">드롭 여부</label>
                <select className="f-select" value={checkIn.drop} onChange={(e) => setCheckIn({ ...checkIn, drop: e.target.value })}>
                  <option value="O">O (있음)</option>
                  <option value="X">X (없음)</option>
                </select>
              </div>
            </div>
            <div className="f-row">
              <div className="f-group">
                <label className="f-label">항공편 (인바운드)</label>
                <input className="f-input" placeholder="예) 5J 123" value={checkIn.flightIn} onChange={(e) => setCheckIn({ ...checkIn, flightIn: e.target.value })} />
              </div>
              <div className="f-group">
                <label className="f-label">항공편 (아웃바운드)</label>
                <input className="f-input" placeholder="예) 5J 456" value={checkIn.flightOut} onChange={(e) => setCheckIn({ ...checkIn, flightOut: e.target.value })} />
              </div>
            </div>
            <div className="f-row">
              <div className="f-group">
                <label className="f-label">베드 세팅</label>
                <input className="f-input" placeholder="예) 킹1 + 싱글1" value={checkIn.bedSetting} onChange={(e) => setCheckIn({ ...checkIn, bedSetting: e.target.value })} />
              </div>
              <div className="f-group">
                <label className="f-label">USIM</label>
                <input className="f-input" placeholder="예) 30일 요금제" value={checkIn.usim} onChange={(e) => setCheckIn({ ...checkIn, usim: e.target.value })} />
              </div>
            </div>
            <div className="f-row">
              <div className="f-group">
                <label className="f-label">하우스 번호</label>
                <input className="f-input" placeholder="예) 드림하우스 5호" value={checkIn.houseNo} onChange={(e) => setCheckIn({ ...checkIn, houseNo: e.target.value })} />
              </div>
            </div>
            <div className="f-group" style={{ marginTop: "4px" }}>
              <label className="f-label">특별 요청사항</label>
              <textarea className="f-textarea" value={checkIn.specialRequest} onChange={(e) => setCheckIn({ ...checkIn, specialRequest: e.target.value })} />
            </div>
          </div>

          <button className="btn-generate" onClick={handleGenerate}>인보이스 생성</button>
          <a href="/" className="back-link">← 홈으로 돌아가기</a>
        </div>
      ) : (
        <div className="invoice-wrap">
          {/* INVOICE */}
          <div className="invoice">
            <div className="inv-top">
              <div>
                <div className="inv-logo">DREAM COMPANY</div>
                <div className="inv-logo-sub">Philippines</div>
              </div>
              <div className="inv-title">
                <h1>INVOICE</h1>
                <p>{customer.reservationNo && `No. ${customer.reservationNo}`}</p>
              </div>
            </div>

            {/* Customer Information */}
            <div className="inv-section">
              <div className="inv-section-title">Customer Information</div>
              <table className="inv-table">
                <tbody>
                  <tr><td className="label">예약자명</td><td>{customer.name}</td><td className="label">영문이름</td><td>{customer.englishName}</td></tr>
                  <tr><td className="label">예약번호</td><td>{customer.reservationNo}</td><td className="label">예약일</td><td>{customer.reservationDate}</td></tr>
                  <tr><td className="label">체크인</td><td>{customer.checkInDate} {customer.checkInTime}</td><td className="label">체크아웃</td><td>{customer.checkOutDate} {customer.checkOutTime}</td></tr>
                  <tr><td className="label">패키지</td><td>{customer.packageType}</td><td className="label">인원 구성</td><td>{customer.people}</td></tr>
                </tbody>
              </table>
            </div>

            {/* Billing Details */}
            <div className="inv-section">
              <div className="inv-section-title">Billing Details</div>
              <table className="inv-table">
                <thead>
                  <tr><th style={{ width: "60%" }}>항목</th><th style={{ width: "40%", textAlign: "right" }}>금액</th></tr>
                </thead>
                <tbody>
                  <tr><td>패키지 정가</td><td style={{ textAlign: "right" }}>{fmt(billing.basePrice)}원</td></tr>
                  {discounts.filter((d) => d.name).map((d, i) => (
                    <tr key={i}><td className="discount">↓ {d.name}</td><td className="discount" style={{ textAlign: "right" }}>-{fmt(Number(d.amount))}원</td></tr>
                  ))}
                  <tr className="total-row"><td>총 할인</td><td style={{ textAlign: "right", color: "#dc2626" }}>-{fmt(totalDiscount)}원</td></tr>
                  <tr className="final-row"><td>청구 금액</td><td style={{ textAlign: "right" }}>{fmt(finalPrice)}원</td></tr>
                </tbody>
              </table>
              {localCharges.filter((c) => c.name).length > 0 && (
                <table className="inv-table" style={{ marginTop: "12px" }}>
                  <thead>
                    <tr><th style={{ width: "60%" }}>현지 지불 항목</th><th style={{ width: "40%", textAlign: "right" }}>금액</th></tr>
                  </thead>
                  <tbody>
                    {localCharges.filter((c) => c.name).map((c, i) => (
                      <tr key={i}><td>{c.name}</td><td style={{ textAlign: "right" }}>{c.amount}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Check In Details */}
            <div className="inv-section">
              <div className="inv-section-title">Check In Details</div>
              <table className="inv-table">
                <tbody>
                  <tr><td className="label">픽업</td><td>{checkIn.pickup}</td><td className="label">드롭</td><td>{checkIn.drop}</td></tr>
                  <tr><td className="label">항공편 (IN)</td><td>{checkIn.flightIn}</td><td className="label">항공편 (OUT)</td><td>{checkIn.flightOut}</td></tr>
                  <tr><td className="label">베드 세팅</td><td>{checkIn.bedSetting}</td><td className="label">USIM</td><td>{checkIn.usim}</td></tr>
                  <tr><td className="label">하우스 번호</td><td colSpan={3}>{checkIn.houseNo}</td></tr>
                  {checkIn.specialRequest && <tr><td className="label">특별 요청</td><td colSpan={3} style={{ whiteSpace: "pre-wrap" }}>{checkIn.specialRequest}</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Footer Notice */}
            <div className="inv-footer">
              안내받으신 총합안내 이용금액 및 환불규정을 꼭 확인 해 주세요.<br />
              미확인으로 인한 문제는 책임지지 않습니다.<br />
              추가 요청사항이 있다면 추후 안내 부탁드립니다.<br />
              해당 청구서에 대한 문의사항이 있으시면 드림아카데미로 문의주세요.<br />
              감사합니다.
            </div>
          </div>

          {/* Print Buttons */}
          <div className="print-btns no-print">
            <button className="btn-print" onClick={() => window.print()}>PDF 저장 / 인쇄</button>
            <button className="btn-back" onClick={() => setShowPreview(false)}>수정하기</button>
          </div>
        </div>
      )}
    </>
  );
}
