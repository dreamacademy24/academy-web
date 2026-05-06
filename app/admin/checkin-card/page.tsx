"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Booking {
  booker_name?: string;
  booker_english?: string;
  accom_type?: string;
  accom_room?: string;
  house_no?: string;
  checkin_date?: string;
  flight_in?: string;
  flight_in_airline?: string;
  flight_in_date?: string;
  flight_in_time?: string;
}

const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function fmtMonthDay(d: string): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return `${MONTHS[dt.getMonth()]}-${dt.getDate()}`;
}

function accomLabel(accom_type: string): string {
  const t = accom_type || "";
  if (t.includes("+")) {
    const parts: string[] = [];
    if (t.includes("드림하우스") || t.includes("드하")) parts.push("Dream House");
    if (t.includes("제이파크")) parts.push("J-Park");
    if (t.includes("큐브나인") || t.includes("큐브")) parts.push("Cube9");
    return parts.join(" + ") || t;
  }
  if (t.includes("드림하우스")) return "Dream House";
  if (t.includes("제이파크")) return "J-Park";
  if (t.includes("큐브나인") || t.includes("큐브")) return "Cube9";
  if (t.includes("통학")) return "Commute";
  return t;
}

function roomLabel(accom_room: string, house_no: string): string {
  const raw = (house_no || accom_room || "").toString();
  if (!raw) return "";
  const cleaned = raw.replace(/^dh/i, "").replace(/\s+/g, "").toUpperCase();
  // 숫자 다음에 오는 영문자 앞에 공백: B17L14 → B17 L14
  return cleaned.replace(/(\d+)([A-Z])/g, "$1 $2");
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
  const accom = accomLabel(b.accom_type || "");
  const room = roomLabel(b.accom_room || "", b.house_no || "");
  // 날짜: 항공편 입국일 우선, 없으면 체크인 날짜
  const dateStr = fmtMonthDay(b.flight_in_date || b.checkin_date || "");
  const flightTime = b.flight_in_time || "";
  const flightCode = b.flight_in_airline || b.flight_in || "";
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
          @page { size: A4 portrait; margin: 0; }
          .no-print { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
      <div className="no-print" style={{position:"fixed",top:20,left:20,right:20,display:"flex",justifyContent:"space-between",zIndex:100}}>
        <button onClick={()=>router.back()} style={{padding:"10px 20px",fontSize:14,fontWeight:600,background:"#f1f5f9",color:"#475569",border:"1px solid #e2e8f0",borderRadius:8,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>← 뒤로</button>
        <button onClick={()=>window.print()} style={{padding:"10px 24px",fontSize:14,fontWeight:700,background:"#1a6fc4",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>🖨️ 인쇄</button>
      </div>
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#fff",padding:40,textAlign:"center"}}>
        <div style={{fontSize:120,fontWeight:900,color:"#1a1a2e",lineHeight:1.1,marginBottom:24,wordBreak:"keep-all"}}>
          {korName} <span style={{fontWeight:400}}>님</span>
        </div>
        {engName && <div style={{fontSize:48,color:"#475569",marginBottom:40}}>{engName}</div>}
        {accom && <div style={{fontSize:40,color:"#1a6fc4",fontWeight:700,marginBottom:8}}>{accom}</div>}
        {room && <div style={{fontSize:40,color:"#1a6fc4",fontWeight:700,marginBottom:40}}>{room}</div>}
        {flightLine && <div style={{fontSize:32,color:"#1a1a2e",fontWeight:600}}>{flightLine}</div>}
      </div>
    </>
  );
}

export default function CheckinCardPage() {
  return <Suspense fallback={null}><CheckinCardInner/></Suspense>;
}
