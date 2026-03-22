"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import html2canvas from "html2canvas";

interface StudentData { korName:string; engName:string; age:string; grade:string; classType:string; academyStart:string; academyEnd:string; academyWeeks:string; photo:string }
interface BillItem { label:string; price:number; season:string }
interface Disc { id:number; name:string; amount:number }
interface LC { id:number; name:string; amount:string }
interface InvoicePayload {
  name:string; englishName:string; reservationNo:string; reservationDate:string; balanceDate:string;
  accom:string; checkInDate:string; checkOutDate:string; people:string; houseNo:string;
  pickup:string; drop:string; pickupPlace:string; flightIn:string; flightOut:string;
  packageType:string; basePrice:number; totalDiscount:number; finalPrice:number;
  students:StudentData[]; note:string; agency?:string; ssp?:string;
  billingItems:BillItem[]; discounts:Disc[]; locals:LC[];
}

function fmt(n:number){return n.toLocaleString("ko-KR");}
function fmtDate(d:string){if(!d)return "";const dt=new Date(d);return `${dt.getMonth()+1}/${dt.getDate()}`;}

export default function ReceiptPageWrapper(){ return <Suspense><ReceiptPageInner/></Suspense>; }

function ReceiptPageInner(){
  const searchParams=useSearchParams();
  const bookingId=searchParams.get("id");
  const [data,setData]=useState<InvoicePayload|null>(null);
  const [sheetSaved,setSheetSaved]=useState(false);
  const today=new Date().toISOString().slice(0,10);

  useEffect(()=>{
    async function load(){
      if(bookingId){
        const {data:row}=await supabase.from("bookings").select("*").eq("id",bookingId).single();
        if(row){
          const sts=typeof row.students==="string"?JSON.parse(row.students):(row.students||[]);
          const items=typeof row.billing_items==="string"?JSON.parse(row.billing_items):(row.billing_items||[]);
          const discs=typeof row.discounts==="string"?JSON.parse(row.discounts):(row.discounts||[]);
          const locs=typeof row.locals==="string"?JSON.parse(row.locals):(row.locals||[]);
          setData({
            name:row.booker_name,englishName:row.booker_english||"",
            reservationNo:row.reservation_no,reservationDate:row.reservation_date,
            balanceDate:row.balance_date||"",accom:row.accom_type||"",
            checkInDate:row.checkin_date||"",checkOutDate:row.checkout_date||"",
            people:"",houseNo:row.house_no||"",
            pickup:row.pickup||"O",drop:row.drop_off||"O",pickupPlace:row.pickup_place||"",
            flightIn:row.flight_in||"",flightOut:row.flight_out||"",
            packageType:items.map((i:any)=>i.label).join(" + "),
            basePrice:row.base_price,totalDiscount:row.total_discount,finalPrice:row.final_price,
            students:sts,note:row.special_request||"",
            billingItems:items,discounts:discs,locals:locs,
          });
          await supabase.from("bookings").update({status:"영수증발행",updated_at:new Date().toISOString()}).eq("id",bookingId);
          return;
        }
      }
      try{const raw=sessionStorage.getItem("invoiceData");if(raw)setData(JSON.parse(raw));}catch{/* ignore */}
    }
    load();
  },[bookingId]);

  async function saveToSheet(){
    if(!data) return;
    try{
      const res=await fetch("/api/receipt",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
      if(!res.ok) throw new Error();
      setSheetSaved(true);
    }catch{alert("시트 기록 실패");}
  }

  async function saveAsImage(){
    const el=document.getElementById("receipt-content");
    if(!el) return;
    const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:"#ffffff"});
    const link=document.createElement("a");
    link.download=`영수증_${data?.reservationNo||"receipt"}.png`;
    link.href=canvas.toDataURL("image/png");
    link.click();
  }

  if(!data) return(
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",fontFamily:"'Noto Sans KR',sans-serif",color:"#6b7c93",fontSize:"16px"}}>
      인보이스 페이지에서 영수증 발행 버튼을 눌러주세요.
    </div>
  );

  const receiptNo="R-"+data.reservationNo;

  return(<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f8fafc;color:#1a1a2e;}
.rw{max-width:860px;margin:0 auto;padding:40px 24px 60px;}
.rv{background:#fff;padding:48px 40px;box-shadow:0 2px 20px rgba(0,0,0,0.08);}
.rh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #1a1a2e;}
.rh .logo{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:900;color:#1a1a2e;}
.rh .sub{font-size:11px;color:#6b7c93;letter-spacing:0.05em;margin-top:2px;}
.rh .rt-title{text-align:right;}
.rh .rt-title h1{font-family:'Montserrat',sans-serif;font-size:26px;font-weight:900;letter-spacing:0.12em;color:#1a6fc4;}
.rh .rt-title h1 span{font-size:18px;letter-spacing:0.06em;}
.rm{display:flex;justify-content:space-between;margin-bottom:24px;font-size:12px;color:#6b7c93;}.rm strong{color:#1a1a2e;}
.rs{margin-bottom:24px;}
.rst{font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#1a6fc4;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;}
.rt{width:100%;border-collapse:collapse;}
.rt th{font-size:11px;font-weight:700;color:#6b7c93;padding:8px 12px;text-align:left;background:#f8fafc;border:1px solid #e2e8f0;}
.rt td{font-size:13px;padding:10px 12px;border:1px solid #e2e8f0;color:#1a1a2e;}
.rt .lb{font-weight:600;background:#fafbfc;width:28%;color:#374151;font-size:12px;}
.rt .dc{color:#dc2626;font-weight:600;}
.rt .fr td{font-weight:800;font-size:15px;background:#1a6fc4;color:#fff;}
.rf{margin-top:36px;text-align:center;padding:28px;}
.rf p{font-size:15px;font-weight:600;color:#374151;margin-bottom:20px;}
.stamp{display:inline-block;width:120px;height:120px;border:3px solid #dc2626;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#dc2626;transform:rotate(-8deg);opacity:0.85;}
.stamp .s1{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:900;letter-spacing:0.08em;}
.stamp .s2{font-size:9px;color:#dc2626;opacity:0.7;margin-top:1px;}
.stamp .s3{font-size:8px;font-weight:600;margin-top:4px;letter-spacing:0.05em;}
.rb{display:flex;gap:10px;justify-content:center;margin-top:24px;}
.rbn{padding:12px 32px;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
.rbn.pr{background:#1a6fc4;color:#fff;}.rbn.pr:hover{background:#0d3d7a;}
.rbn.sh{background:#16a34a;color:#fff;}.rbn.sh:hover{background:#15803d;}.rbn.sh:disabled{background:#86efac;cursor:not-allowed;}
.rbn.img{background:#7c3aed;color:#fff;}.rbn.img:hover{background:#6d28d9;}
.rbn.cl{background:#f1f5f9;color:#1a1a2e;border:1px solid #e2e8f0;}.rbn.cl:hover{background:#e2e8f0;}
@media print{body{background:#fff!important;}.no-print{display:none!important;}.rw{padding:0!important;}.rv{box-shadow:none!important;padding:24px!important;}}
@media(max-width:600px){.rv{padding:24px 16px;}.rh{flex-direction:column;gap:12px;}.rm{flex-direction:column;gap:4px;}}
    `}</style>

    <div className="rw">
      <div className="rv" id="receipt-content">
        <div className="rh">
          <div><div className="logo">DREAM ACADEMY</div><div className="sub">Philippines</div></div>
          <div className="rt-title"><h1><span>영 수 증</span>  RECEIPT</h1></div>
        </div>

        <div className="rm">
          <div>영수증 번호: <strong>{receiptNo}</strong></div>
          <div>발행일: <strong>{today}</strong></div>
        </div>

        <div className="rs"><div className="rst">Customer Information</div>
          <table className="rt"><tbody>
            <tr><td className="lb">예약자명</td><td>{data.name}</td><td className="lb">영문이름</td><td>{data.englishName}</td></tr>
            <tr><td className="lb">예약번호</td><td>{data.reservationNo}</td><td className="lb">체크인</td><td>{data.checkInDate}</td></tr>
            <tr><td className="lb">체크아웃</td><td>{data.checkOutDate}</td><td className="lb">패키지</td><td>{data.packageType}</td></tr>
            <tr><td className="lb">인원 구성</td><td>{data.people}</td><td className="lb">잔금납부일</td><td>{data.balanceDate||"미정"}</td></tr>
          </tbody></table>
        </div>

        {data.students&&data.students.length>0&&(
          <div className="rs"><div className="rst">Student Information</div>
            <table className="rt"><thead><tr><th>이름(한글)</th><th>영문이름</th><th>나이</th><th>킨더/주니어</th><th>오전/종일</th><th>아카데미 기간</th><th>사진허용</th></tr></thead><tbody>
              {data.students.map((s,i)=><tr key={i}><td>{s.korName}</td><td>{s.engName}</td><td>{s.age}</td><td>{s.grade}</td><td>{s.classType}</td><td>{s.academyStart?`${fmtDate(s.academyStart)}~${fmtDate(s.academyEnd)} (${s.academyWeeks}주)`:s.academyWeeks+"주"}</td><td>{s.photo}</td></tr>)}
            </tbody></table>
          </div>
        )}

        <div className="rs"><div className="rst">Billing Details</div>
          <table className="rt"><thead><tr><th style={{width:"60%"}}>항목</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr></thead><tbody>
            {data.billingItems&&data.billingItems.length>0
              ?data.billingItems.map((item,i)=><tr key={i}><td>{item.label}{item.season?` (${item.season})`:""}</td><td style={{textAlign:"right"}}>{fmt(item.price)}원</td></tr>)
              :<tr><td>패키지 금액</td><td style={{textAlign:"right"}}>{fmt(data.basePrice)}원</td></tr>}
            {data.discounts&&data.discounts.map((d,i)=><tr key={`d${i}`}><td className="dc">↓ {d.name}</td><td className="dc" style={{textAlign:"right"}}>-{fmt(Number(d.amount))}원</td></tr>)}
            {data.totalDiscount>0&&<tr><td style={{fontWeight:600}}>총 할인</td><td style={{textAlign:"right",color:"#dc2626",fontWeight:600}}>-{fmt(data.totalDiscount)}원</td></tr>}
            <tr className="fr"><td>청구 금액</td><td style={{textAlign:"right"}}>{fmt(data.finalPrice)}원</td></tr>
          </tbody></table>
        </div>

        {data.locals&&data.locals.length>0&&(
          <div className="rs"><div className="rst">Local Payment</div>
            <table className="rt"><thead><tr><th style={{width:"60%"}}>현지 지불 항목</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr></thead><tbody>
              {data.locals.map((c,i)=><tr key={i}><td>{c.name}</td><td style={{textAlign:"right"}}>{c.amount}</td></tr>)}
            </tbody></table>
          </div>
        )}

        <div className="rs"><div className="rst">Check-in Details</div>
          <table className="rt"><tbody>
            <tr><td className="lb">픽업</td><td>{data.pickup}</td><td className="lb">드롭</td><td>{data.drop}</td></tr>
            <tr><td className="lb">픽업 장소</td><td>{data.pickupPlace||"미정"}</td><td className="lb">하우스 번호</td><td>{data.houseNo||"미정"}</td></tr>
            <tr><td className="lb">항공편 (IN)</td><td>{data.flightIn||"미정"}</td><td className="lb">항공편 (OUT)</td><td>{data.flightOut||"미정"}</td></tr>
          </tbody></table>
        </div>

        <div className="rf">
          <p>위 금액을 정히 영수합니다.</p>
          <div className="stamp">
            <div className="s1">DREAM ACADEMY</div>
            <div className="s2">Philippines</div>
            <div className="s3">Official Receipt</div>
          </div>
        </div>
      </div>

      <div className="rb no-print">
        <button className="rbn sh" onClick={saveToSheet} disabled={sheetSaved}>{sheetSaved?"✅ 시트 기록 완료":"📊 구글 시트 기록"}</button>
        <button className="rbn img" onClick={saveAsImage}>📷 이미지 저장</button>
        <button className="rbn pr" onClick={()=>window.print()}>🖨 PDF 저장 / 인쇄</button>
        <button className="rbn cl" onClick={()=>window.close()}>닫기</button>
      </div>
    </div>
  </>);
}
