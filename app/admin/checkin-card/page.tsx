"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";
import { firstAccomRoomLabel, firstAccomName, isCombo, type ComboBooking } from "@/lib/checkinCard";

type Booking = ComboBooking & {
  booker_name?: string;
  booker_english?: string;
  checkin_date?: string;
  flight_in?: string;
  flight_in_airline?: string;
  flight_in_no?: string;
  flight_in_date?: string;
  flight_in_time?: string;
};

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function fmtMonthDay(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return `${MONTHS[dt.getMonth()]}-${dt.getDate()}`;
}

function CheckinCardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const [authed, setAuthed] = useState(false);
  const [b, setB] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed || !bookingId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
      setB(data as Booking | null);
      setLoading(false);
    })();
  }, [authed, bookingId]);

  if (!authed || loading) return <div style={{padding:40,textAlign:"center",fontFamily:"'Noto Sans KR',sans-serif"}}>로딩 중...</div>;
  if (!bookingId) return <div style={{padding:40,textAlign:"center",fontFamily:"'Noto Sans KR',sans-serif"}}>bookingId 파라미터가 필요합니다</div>;
  if (!b) return <div style={{padding:40,textAlign:"center",fontFamily:"'Noto Sans KR',sans-serif"}}>예약을 찾을 수 없습니다</div>;

  const korName = b.booker_name || "-";
  const engName = b.booker_english || "";
  // 콤보예약(제이파크+드림하우스 등)이면 첫 숙소(seg1) 기준 — 양지나=제이파크 먼저
  const { accom, room } = firstAccomRoomLabel(b);
  const combo = isCombo(b);
  const firstName = firstAccomName(b);
  // 날짜: 콤보면 seg1 체크인, 아니면 항공편 입국일 → 체크인
  const dateStr = fmtMonthDay((combo ? b.seg1_checkin : "") || b.flight_in_date || b.checkin_date || "");
  const flightTime = b.flight_in_time || "";
  const flightCode = [b.flight_in_airline, b.flight_in_no].filter(Boolean).join(" ") || b.flight_in || "";
  // "MAY-9 / 23:30 (KE601)" 또는 "MAY-9 (KE601 5/9 23:30)" 또는 "MAY-9"
  let flightLine = "";
  if (dateStr) {
    flightLine = dateStr;
    if (flightTime) flightLine += ` / ${flightTime}`;
    if (flightCode && flightCode !== "미정") {
      flightLine += flightTime ? ` (${flightCode})` : ` / ${flightCode}`;
    }
  }

  return (
    <>
      <style>{`
        body { background: #fff; font-family: 'Noto Sans KR', sans-serif; margin: 0; }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
      <div className="no-print" style={{position:"fixed",top:20,left:20,right:20,display:"flex",justifyContent:"space-between",zIndex:100}}>
        <button onClick={()=>router.back()} style={{padding:"10px 20px",fontSize:14,fontWeight:600,background:"#f1f5f9",color:"#475569",border:"1px solid #e2e8f0",borderRadius:8,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>← 뒤로</button>
        <button onClick={()=>window.print()} style={{padding:"10px 24px",fontSize:14,fontWeight:700,background:"#1a6fc4",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>🖨️ 인쇄</button>
      </div>
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#fff",padding:40,textAlign:"center"}}>
        <div style={{fontSize:160,fontWeight:900,color:"#1a1a2e",lineHeight:1.05,marginBottom:28,wordBreak:"keep-all"}}>
          {korName} <span style={{fontWeight:400}}>님</span>
        </div>
        {engName && <div style={{fontSize:56,color:"#475569",marginBottom:48}}>{engName}</div>}
        {accom && <div style={{fontSize:48,color:"#1a6fc4",fontWeight:700,marginBottom:8}}>{accom}</div>}
        {room && <div style={{fontSize:48,color:"#1a6fc4",fontWeight:700,marginBottom:44}}>{room}</div>}
        {flightLine && <div style={{fontSize:40,color:"#1a1a2e",fontWeight:600}}>{flightLine}</div>}
        {combo && <div style={{fontSize:22,color:"#6d28d9",fontWeight:700,marginTop:28,background:"#ede9fe",padding:"10px 24px",borderRadius:999}}>입국 시 {firstName}로 이동</div>}
      </div>
    </>
  );
}

export default function CheckinCardPage() {
  return <Suspense fallback={null}><CheckinCardInner/></Suspense>;
}
