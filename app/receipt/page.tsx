"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import html2canvas from "html2canvas";

interface StudentData { korName:string; engName:string; age:string; grade:string; classType:string; academyStart:string; academyEnd:string; academyWeeks:string; photo:string }
interface BillItem { label:string; price:number; season:string }
interface Disc { id:number; name:string; amount:number }
interface LC { id:number; name:string; amount:string }
interface Payment { id:number; type:string; date:string; amount:string }
interface InvoicePayload {
  name:string; englishName:string; reservationNo:string; reservationDate:string; balanceDate:string;
  accom:string; checkInDate:string; checkOutDate:string; houseNo:string; people:string;
  pickup:string; drop:string; pickupPlace:string; flightIn:string; flightOut:string;
  packageType:string; basePrice:number; totalDiscount:number; finalPrice:number;
  deposit:number; balance:number;
  students:StudentData[]; note:string; agency?:string; ssp?:string; assignee?:string;
  billingItems:BillItem[]; discounts:Disc[]; locals:LC[];
}

function fmt(n:number){return n.toLocaleString("ko-KR");}
function fmtDate(d:string){if(!d)return "";const dt=new Date(d);return `${dt.getMonth()+1}/${dt.getDate()}`;}
function fmtFull(d:string){if(!d)return "";const[y,m,dd]=d.split("-");return `${y}년 ${Number(m)}월 ${Number(dd)}일`;}

export default function ReceiptPageWrapper(){ return <Suspense><ReceiptPageInner/></Suspense>; }

function ReceiptPageInner(){
  const searchParams=useSearchParams();
  const router=useRouter();
  const bookingId=searchParams.get("id");
  const [data,setData]=useState<InvoicePayload|null>(null);
  const [sheetSaved,setSheetSaved]=useState(false);
  const [payments,setPayments]=useState<Payment[]>([
    {id:1,type:"예약금",date:new Date().toISOString().slice(0,10),amount:""}
  ]);
  const today=new Date().toISOString().slice(0,10);

  useEffect(()=>{
    async function load(){
      if(bookingId){
        const {data:row}=await supabase.from("bookings").select("*").eq("id",bookingId).single();
        if(row){
          const sts:StudentData[]=typeof row.students==="string"?JSON.parse(row.students):(row.students||[]);
          const items:BillItem[]=typeof row.billing_items==="string"?JSON.parse(row.billing_items):(row.billing_items||[]);
          const discs:Disc[]=typeof row.discounts==="string"?JSON.parse(row.discounts):(row.discounts||[]);
          const locs:LC[]=typeof row.locals==="string"?JSON.parse(row.locals):(row.locals||[]);
          const deposit=1000000;
          const balance=(row.final_price||0)-deposit;
          setData({
            name:row.booker_name, englishName:row.booker_english||"",
            reservationNo:row.reservation_no, reservationDate:row.reservation_date,
            balanceDate:row.balance_date||"", accom:row.accom_type||"",
            checkInDate:row.checkin_date||"", checkOutDate:row.checkout_date||"",
            people:row.accom_people||"", houseNo:"미정",
            pickup:row.pickup||"O", drop:row.drop_off||"O", pickupPlace:row.pickup_place||"",
            flightIn:row.flight_in||"", flightOut:row.flight_out||"",
            packageType:items.map((i:BillItem)=>i.label).join(" + "),
            basePrice:row.base_price, totalDiscount:row.total_discount, finalPrice:row.final_price,
            deposit, balance,
            students:sts, note:row.special_request||"",
            agency:row.agency||"", ssp:row.ssp||"", assignee:row.assignee||"",
            billingItems:items, discounts:discs, locals:locs,
          });
          // 초기 지불내역에 예약금 자동 세팅
          setPayments([{id:1,type:"예약금",date:today,amount:"1,000,000"}]);
          await supabase.from("bookings").update({status:"영수증발행",updated_at:new Date().toISOString()}).eq("id",bookingId);
          return;
        }
      }
      try{const raw=sessionStorage.getItem("invoiceData");if(raw)setData(JSON.parse(raw));}catch{}
    }
    load();
  },[bookingId]);

  function addPayment(){setPayments(prev=>[...prev,{id:Date.now(),type:"잔금",date:today,amount:""}]);}
  function removePayment(id:number){if(payments.length>1)setPayments(prev=>prev.filter(p=>p.id!==id));}
  function upd(id:number,field:keyof Payment,value:string){setPayments(prev=>prev.map(p=>p.id===id?{...p,[field]:value}:p));}

  const DH_ROOMS=['b13L10','b16L19','b17L4','b17L5','b17L6','b17L7','b17L8','b17L9','b17L10','b17L11','b17L12','b17L13','b17L14','b17L15','b17L16','b17L17','b17L18'];
  async function saveToDreamhouse(){
    if(!bookingId||!data)return;
    const ci=data.checkInDate?.trim()||null;
    const co=data.checkOutDate?.trim()||null;
    if(!ci||!co){alert("⚠️ 체크인/체크아웃 날짜가 필요합니다.");return;}
    const{data:ov}=await supabase.from("bookings").select("accom_room").neq("id",bookingId).not("accom_room","is",null).neq("accom_room","").lt("checkin_date",co).gt("checkout_date",ci);
    const occ=(ov||[]).map((b:any)=>b.accom_room);
    const avail=DH_ROOMS.filter(r=>!occ.includes(r));
    if(!avail.length){alert("⚠️ 가용 룸이 없습니다!");return;}
    const assigned=avail[Math.floor(Math.random()*avail.length)];
    const{error}=await supabase.from("bookings").update({accom_room:assigned,checkin_date:ci,checkout_date:co,status:"영수증발행"}).eq("id",bookingId);
    if(error){alert("등록 실패: "+error.message);return;}
    setSheetSaved(true);
    setData(prev=>prev?{...prev,houseNo:assigned}:prev);
    alert("✅ 드림하우스 예약 완료!\n배정 룸: "+assigned);
  }

  async function saveAsImage(){
    const el=document.getElementById("receipt-content");
    if(!el)return;
    const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:"#ffffff"});
    const link=document.createElement("a");
    link.download=`영수증_${data?.reservationNo||"receipt"}.png`;
    link.href=canvas.toDataURL("image/png");
    link.click();
  }

  if(!data)return(
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",fontFamily:"'Noto Sans KR',sans-serif",color:"#6b7c93"}}>
      인보이스 페이지에서 영수증 발행 버튼을 눌러주세요.
    </div>
  );

  const receiptNo="R-"+data.reservationNo;
  const filledPayments=payments.filter(p=>p.amount.trim()!=="");
  // 인원구성: DB값 우선, 없으면 students로 계산
  const studentCount=data.students?.length||0;
  const peopleStr=data.people&&data.people.trim()!==""
    ?data.people
    :studentCount>0?`학생 ${studentCount}명`:"-";

  return(<>
    <style>{`
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Noto Sans KR',sans-serif;background:#f8fafc;color:#1a1a2e;}
      .rw{max-width:860px;margin:0 auto;padding:40px 24px 60px;}
      .rv{background:#fff;padding:48px 40px;box-shadow:0 2px 20px rgba(0,0,0,0.08);}
      .rh{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #1a1a2e;}
      .logo{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:900;color:#1a1a2e;}
      .sub{font-size:11px;color:#6b7c93;letter-spacing:0.05em;margin-top:2px;}
      .rt-title h1{font-family:'Montserrat',sans-serif;font-size:24px;font-weight:900;letter-spacing:0.1em;color:#1a6fc4;text-align:right;}
      .rno{display:flex;justify-content:space-between;margin-bottom:24px;font-size:12px;color:#6b7c93;}
      .rno strong{color:#1a1a2e;}
      .rs{margin-bottom:24px;}
      .rst{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#1a6fc4;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;}
      .rt{width:100%;border-collapse:collapse;}
      .rt th{font-size:11px;font-weight:700;color:#6b7c93;padding:8px 12px;text-align:left;background:#f8fafc;border:1px solid #e2e8f0;}
      .rt td{font-size:13px;padding:9px 12px;border:1px solid #e2e8f0;color:#1a1a2e;}
      .lb{font-weight:600;background:#fafbfc;width:22%;color:#374151;font-size:12px;}
      .dc{color:#dc2626;font-weight:600;}
      .fr td{font-weight:800;font-size:15px;background:#1a6fc4;color:#fff;}
      .dep-row td{background:#f0fdf4;color:#16a34a;font-weight:700;}
      .bal-row td{background:#fff7ed;color:#ea580c;font-weight:600;}
      .now-row td{background:#eff6ff;color:#1a6fc4;font-weight:800;font-size:14px;}
      .rf{margin-top:32px;text-align:center;padding:24px;}
      .rf p{font-size:14px;font-weight:600;color:#374151;margin-bottom:16px;}
      .notice{font-size:12px;color:#6b7c93;line-height:1.9;margin-top:20px;text-align:center;}
      .stamp{display:inline-flex;width:110px;height:110px;border:3px solid #dc2626;border-radius:50%;flex-direction:column;align-items:center;justify-content:center;color:#dc2626;transform:rotate(-8deg);opacity:0.85;}
      .stamp .s1{font-family:'Montserrat',sans-serif;font-size:10px;font-weight:900;letter-spacing:0.08em;}
      .stamp .s2{font-size:9px;opacity:0.7;margin-top:1px;}
      .stamp .s3{font-size:8px;font-weight:600;margin-top:4px;}
      .pay-editor{background:#fff;padding:24px 32px;box-shadow:0 2px 20px rgba(0,0,0,0.08);margin-bottom:24px;border-left:4px solid #1a6fc4;}
      .pay-editor-title{font-size:15px;font-weight:800;color:#1a1a2e;margin-bottom:6px;}
      .pay-editor-sub{font-size:12px;color:#6b7c93;margin-bottom:16px;}
      .pay-row{display:grid;grid-template-columns:130px 160px 1fr auto;gap:8px;align-items:center;margin-bottom:8px;}
      .pay-input{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:'Noto Sans KR',sans-serif;outline:none;}
      .pay-input:focus{border-color:#1a6fc4;}
      .pay-select{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:'Noto Sans KR',sans-serif;outline:none;background:#fff;cursor:pointer;}
      .pay-select:focus{border-color:#1a6fc4;}
      .pay-del{background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:8px 12px;cursor:pointer;font-size:14px;}
      .pay-add{background:#f0f9ff;color:#1a6fc4;border:1px dashed #93c5fd;border-radius:8px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Noto Sans KR',sans-serif;width:100%;margin-top:4px;}
      .pay-header{display:grid;grid-template-columns:130px 160px 1fr auto;gap:8px;margin-bottom:6px;}
      .pay-header span{font-size:11px;color:#6b7c93;font-weight:600;}
      .rb{display:flex;gap:10px;justify-content:center;margin-top:24px;flex-wrap:wrap;}
      .rbn{padding:12px 28px;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;min-height:44px;}
      .rbn.pr{background:#1a6fc4;color:#fff;}
      .rbn.sh{background:#16a34a;color:#fff;}
      .rbn.sh:disabled{background:#86efac;cursor:not-allowed;}
      .rbn.img{background:#7c3aed;color:#fff;}
      .rbn.cl{background:#f1f5f9;color:#1a1a2e;border:1px solid #e2e8f0;}
      @media print{
        body{background:#fff!important;}
        .no-print{display:none!important;}
        .rw{padding:0!important;}
        .rv{box-shadow:none!important;padding:24px!important;}
      }
      @media(max-width:600px){
        .rv{padding:24px 16px;}
        .rh{flex-direction:column;gap:12px;}
        .pay-row{grid-template-columns:1fr 1fr;grid-template-rows:auto auto;}
        .pay-header{display:none;}
        .rb .rbn{flex:1 1 45%;}
        .rw{padding:16px 0 40px;}
      }
    `}</style>
    <div className="rw">

      {/* ── 지불내역 에디터 (화면 전용) ── */}
      <div className="pay-editor no-print">
        <div className="pay-editor-title">💰 지불내역 입력</div>
        <div className="pay-editor-sub">입금받은 내역을 입력하세요. 영수증 하단에 자동으로 표시됩니다.</div>
        <div className="pay-header">
          <span>구분</span><span>날짜</span><span>금액 (원)</span><span></span>
        </div>
        {payments.map(p=>(
          <div key={p.id} className="pay-row">
            <select className="pay-select" value={p.type} onChange={e=>upd(p.id,"type",e.target.value)}>
              <option value="예약금">예약금</option>
              <option value="잔금">잔금</option>
              <option value="추가입금">추가입금</option>
              <option value="현지결제">현지결제</option>
            </select>
            <input className="pay-input" type="date" value={p.date} onChange={e=>upd(p.id,"date",e.target.value)}/>
            <input className="pay-input" type="text" placeholder="예: 1,000,000" value={p.amount} onChange={e=>upd(p.id,"amount",e.target.value)}/>
            <button className="pay-del" onClick={()=>removePayment(p.id)} disabled={payments.length===1}>✕</button>
          </div>
        ))}
        <button className="pay-add" onClick={addPayment}>+ 입금 항목 추가</button>
      </div>

      {/* ── 영수증 본문 ── */}
      <div className="rv" id="receipt-content">
        {/* 헤더 */}
        <div className="rh">
          <div><div className="logo">DREAM ACADEMY</div><div className="sub">Philippines</div></div>
          <div className="rt-title"><h1>영 수 증 <span style={{fontSize:14,letterSpacing:"0.05em",color:"#6b7c93"}}>RECEIPT</span></h1></div>
        </div>
        <div className="rno">
          <span>영수증 번호: <strong>{receiptNo}</strong></span>
          <span>발행일: <strong>{fmtFull(today)}</strong></span>
        </div>

        {/* 고객 정보 */}
        <div className="rs"><div className="rst">Customer Information</div>
          <table className="rt"><tbody>
            <tr><td className="lb">예약자명</td><td>{data.name}</td><td className="lb">영문이름</td><td>{data.englishName}</td></tr>
            <tr><td className="lb">예약번호</td><td>{data.reservationNo}</td><td className="lb">예약일</td><td>{fmtFull(data.reservationDate)}</td></tr>
            <tr><td className="lb">체크인</td><td>{fmtFull(data.checkInDate)}</td><td className="lb">체크아웃</td><td>{fmtFull(data.checkOutDate)}</td></tr>
            <tr><td className="lb">패키지</td><td>{data.packageType}</td><td className="lb">인원 구성</td><td>{peopleStr}</td></tr>
            <tr><td className="lb">잔금납부일</td><td colSpan={3}>{fmtFull(data.balanceDate)||"미정"}</td></tr>
            {data.note&&<tr><td className="lb">특이사항</td><td colSpan={3}>{data.note}</td></tr>}
          </tbody></table>
        </div>

        {/* 학생 정보 */}
        {data.students&&data.students.length>0&&(
          <div className="rs"><div className="rst">Student Information</div>
            <table className="rt"><thead>
              <tr><th>이름(한글)</th><th>영문이름</th><th>나이</th><th>킨더/주니어</th><th>아카데미 기간</th><th>사진허용</th></tr>
            </thead><tbody>
              {data.students.map((s,i)=>(
                <tr key={i}>
                  <td>{s.korName}</td><td>{s.engName}</td><td>{s.age}</td><td>{s.grade}</td>
                  <td>{s.academyStart?`${fmtDate(s.academyStart)}~${fmtDate(s.academyEnd)} (${s.academyWeeks}주)`:s.academyWeeks+"주"}</td>
                  <td>{s.photo}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        )}

        {/* 청구 내역 */}
        <div className="rs"><div className="rst">Billing Details</div>
          <table className="rt"><thead>
            <tr><th style={{width:"60%"}}>항목</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr>
          </thead><tbody>
            {data.billingItems&&data.billingItems.length>0
              ?data.billingItems.map((item,i)=><tr key={i}><td>{item.label}{item.season?` (${item.season})`:""}</td><td style={{textAlign:"right"}}>{fmt(item.price)}원</td></tr>)
              :<tr><td>패키지 금액</td><td style={{textAlign:"right"}}>{fmt(data.basePrice)}원</td></tr>}
            {data.discounts&&data.discounts.map((d,i)=><tr key={`d${i}`}><td className="dc">↓ {d.name}</td><td className="dc" style={{textAlign:"right"}}>-{fmt(Number(d.amount))}원</td></tr>)}
            {data.totalDiscount>0&&<tr><td style={{fontWeight:600}}>총 할인</td><td style={{textAlign:"right",color:"#dc2626",fontWeight:600}}>-{fmt(data.totalDiscount)}원</td></tr>}
            {/* 총 청구금액 */}
            <tr className="fr"><td>총 청구금액</td><td style={{textAlign:"right"}}>{fmt(data.finalPrice)}원</td></tr>
            {/* 예약금 */}
            <tr className="dep-row">
              <td>예약금 <span style={{fontSize:11,fontWeight:400}}>(입금 시 예약 확정)</span></td>
              <td style={{textAlign:"right"}}>{fmt(data.deposit)}원</td>
            </tr>
            {/* 잔금 */}
            <tr className="bal-row">
              <td>잔금 <span style={{fontSize:11,fontWeight:400}}>{data.balanceDate?`(납부일: ${data.balanceDate})`:""}</span></td>
              <td style={{textAlign:"right"}}>{fmt(data.balance)}원</td>
            </tr>
          </tbody></table>
          {data.deposit>0&&(
            <div style={{fontSize:12,color:"#6b7c93",marginTop:8,paddingLeft:4}}>
              ※ 예약금 {fmt(data.deposit)}원 입금 후 예약이 확정되며, 잔금은 입실 2달 전까지 납부해 주세요.
            </div>
          )}
        </div>

        {/* 현지 지불 */}
        {data.locals&&data.locals.length>0&&(
          <div className="rs"><div className="rst">Local Payment</div>
            <table className="rt"><thead><tr><th style={{width:"60%"}}>현지 지불 항목</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr></thead><tbody>
              {data.locals.map((c,i)=><tr key={i}><td>{c.name}</td><td style={{textAlign:"right"}}>{c.amount}</td></tr>)}
            </tbody></table>
          </div>
        )}

        {/* 지불 내역 */}
        <div className="rs"><div className="rst">지불내역</div>
          <table className="rt"><thead>
            <tr><th style={{width:"25%"}}>구분</th><th style={{width:"35%"}}>결제일</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr>
          </thead><tbody>
            {filledPayments.length>0
              ?filledPayments.map((p)=>(
                <tr key={p.id}>
                  <td style={{fontWeight:700}}>{p.type}</td>
                  <td>{fmtFull(p.date)}</td>
                  <td style={{textAlign:"right",fontWeight:700,color:"#1a6fc4"}}>{p.amount}원</td>
                </tr>
              ))
              :<tr><td colSpan={3} style={{textAlign:"center",color:"#94a3b8",fontSize:12,padding:"16px"}}>
                위 입력란에서 지불내역을 입력해주세요
              </td></tr>
            }
          </tbody></table>
        </div>

        {/* 도장 + 안내문 */}
        <div className="rf">
          <p>위 금액을 정히 영수합니다.</p>
          <div className="stamp">
            <div className="s1">DREAM ACADEMY</div>
            <div className="s2">Philippines</div>
            <div className="s3">Official Receipt</div>
          </div>
          <div className="notice">
            안내받으신 종합안내 이용금액 및 환불 규정을 꼭 확인해주세요<br/>
            미확인으로 인한 문제는 책임 지지않습니다<br/>
            드림하우스 숙박료등 전체 결제하였음을 증명합니다<br/>
            해당영수증에 대한 문의사항이 있으시면 드림하우스로 문의주세요<br/>
            감사합니다
          </div>
        </div>
      </div>

      {/* ── 버튼 ── */}
      <div className="rb no-print">
        <button className="rbn cl" onClick={()=>{bookingId?router.push("/invoice?id="+bookingId):window.history.back();}}>← 인보이스로</button>
        <button className="rbn sh" onClick={saveToDreamhouse} disabled={sheetSaved}>{sheetSaved?"✅ 등록 완료":"🏠 드림하우스 등록"}</button>
        <button className="rbn img" onClick={saveAsImage}>📷 이미지 저장</button>
        <button className="rbn pr" onClick={()=>window.print()}>🖨 PDF / 인쇄</button>
        <button className="rbn cl" onClick={()=>router.push("/admin/bookings")}>예약관리</button>
      </div>
    </div>
  </>);
}
