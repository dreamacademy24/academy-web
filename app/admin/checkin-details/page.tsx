"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Booking {
  id: string; booker_name: string; booker_english?: string;
  accom_type?: string; accom_room?: string; house_no?: string;
  checkin_date: string; checkout_date: string;
  pickup_place?: string; drop_off?: string;
  flight_in?: string; flight_out?: string;
  adults?: number; children?: number;
  special_request?: string; reservation_no?: string;
}

interface Detail {
  id?: string;
  booking_id: string;
  booker_name: string;
  checkin_date: string;
  guest_names_en: string;
  bed_setting: string;        // JSON string {room1,room2,room3}
  usim_request: string;       // JSON string [{plan}]
  extra_pickups: string;      // JSON array string [{type,date,airline,flight,time}]
  extra_requests: string;
  public_token: string;
  submitted_at?: string | null;     // 손님 공개폼 제출 시각
  admin_saved_at?: string | null;   // 어드민 저장 완료 시각
}

const SIM_PLANS = [
  "2GB / 3일 / ₱75",
  "6GB / 7일 / ₱149",
  "24GB / 30일 / ₱499",
  "36GB / 30일 / ₱599",
  "48GB / 30일 / ₱699",
];

type BedConfig = { room1: string; room2: string; room3: string };
type SimCard = { plan: string };
type ExtraPickup = { type: string; date: string; airline: string; flight: string; time: string };

function fDate(d: string | null) {
  if (!d) return "-";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d as string;
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,"0")}.${String(dt.getDate()).padStart(2,"0")}`;
}

// 베드 세팅 한글 → 침대 수 숫자 ("더블베드 2개"→2, "더블베드 1개"→1, "더블베드+싱글"→2, "사용하지 않음"→0)
function bedNum(v: string): string {
  const s = v || "";
  if (!s || s.includes("사용하지 않음")) return "0";
  let n = 0;
  const m = s.match(/더블베드\s*(\d+)개/);
  if (m) n += Number(m[1]);
  else if (s.includes("더블베드")) n += 1;
  if (s.includes("싱글")) n += 1;
  return n > 0 ? String(n) : "-";
}

// 유심 요금제 "24GB / 30일 / ₱499" → 컴팩트 "24GB/30d"
function simCompact(plan: string): string {
  const parts = String(plan || "").split("/").map(x => x.trim());
  const gb = parts.find(p => /GB/i.test(p)) || "";
  const days = parts.find(p => /일|day/i.test(p)) || "";
  const d = days.replace(/\s*일/, "d").replace(/\s*days?/i, "d");
  return [gb, d].filter(Boolean).join("/");
}

// accom_type이 패키지 계열(콤보/올인원)인지 판별
function isPackage(t?: string): boolean {
  const s = t || "";
  return s.includes("+") || s.includes("올인원") || s.includes("패키지");
}

export default function CheckinDetailsPage() {
  return <Suspense fallback={null}><CheckinDetailsInner/></Suspense>;
}

function CheckinDetailsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBookingId = searchParams.get("bookingId");
  const autoSelectedRef = useRef(false);
  const [authed, setAuthed] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [bedConfig, setBedConfig] = useState<BedConfig>({room1:"",room2:"",room3:"더블베드 1개 (1~2인 스테이)"});
  const [simCards, setSimCards] = useState<SimCard[]>([]);
  const [extraPickups, setExtraPickups] = useState<ExtraPickup[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(true); // true=편집 폼, false=인쇄 미리보기 뷰
  const [savedAt, setSavedAt] = useState("");    // 어드민 저장 완료 일시
  const [printHtml, setPrintHtml] = useState("");
  const [localItems, setLocalItems] = useState<{name:string;amount:string}[]>([]);

  const loadBookings = useCallback(async () => {
    const res = await fetch("/api/admin/checkin-details");
    if (res.ok) { const d = await res.json(); setBookings(d.bookings || []); }
  }, []);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else window.location.href = "/login"; }, []);
  useEffect(() => { if (authed) loadBookings(); }, [authed, loadBookings]);

  const selectBooking = useCallback(async (id: string) => {
    setSelId(id);
    setMsg("");
    // 우선 list에서 booking 표시 (응답 대기 중에도 헤더 노출)
    const fromList = bookings.find(x => x.id === id) || null;
    if (fromList) setBooking(fromList);
    const res = await fetch(`/api/admin/checkin-details?bookingId=${id}`);
    if (res.ok) {
      const d = await res.json();
      if (d.booking) setBooking(d.booking);
      if (d.detail) {
        setDetail(d.detail);
        // invoice_snapshot에서 현지지불 항목 로드
        fetch(`/api/admin/invoice-snapshot?bookingId=${id}`)
          .then(r=>r.ok?r.json():null)
          .then(snap=>{
            if(snap?.saved_data){
              try{
                const data = typeof snap.saved_data==="string"?JSON.parse(snap.saved_data):snap.saved_data;
                setLocalItems((data.billing?.locals||[]).filter((l:{name?:string;amount?:string})=>l.name&&l.amount));
              }catch{}
            }
          });
        try { const b = JSON.parse(d.detail.bed_setting || "{}"); setBedConfig({room1:b.room1||"", room2:b.room2||"", room3:b.room3||"더블베드 1개 (1~2인 스테이)"}); } catch { setBedConfig({room1:"",room2:"",room3:"더블베드 1개 (1~2인 스테이)"}); }
        try { const arr = JSON.parse(d.detail.usim_request || "[]"); setSimCards(Array.isArray(arr) ? arr : []); } catch { setSimCards([]); }
        try { const arr = JSON.parse(d.detail.extra_pickups || "[]"); setExtraPickups(Array.isArray(arr) ? arr : []); } catch { setExtraPickups([]); }
        // 저장 상태 판별: 타임스탬프(admin_saved_at/submitted_at/localStorage) 또는
        // 실제 저장 흔적(bed_setting/usim_request/extra_pickups는 저장 시에만 채워짐)
        const ts = d.detail.admin_saved_at || d.detail.submitted_at || (typeof window!=="undefined" ? localStorage.getItem("checkin_saved_"+id) : "") || "";
        const hasSaved = !!ts || !!(d.detail.bed_setting || d.detail.usim_request || d.detail.extra_pickups);
        setSavedAt(ts);
        setEditing(!hasSaved); // 저장된 데이터 있으면 인쇄 미리보기 뷰로
      }
      if (d.error) setMsg("저장 경고: " + d.error);
    } else {
      const j = await res.json().catch(()=>({}));
      setMsg("로드 실패: " + (j.error || "알 수 없는 오류"));
    }
  }, [bookings]);

  useEffect(() => {
    if (autoSelectedRef.current || !authed || !initialBookingId || bookings.length === 0) return;
    if (bookings.find(b => b.id === initialBookingId)) {
      autoSelectedRef.current = true;
      selectBooking(initialBookingId);
    }
  }, [authed, bookings, initialBookingId, selectBooking]);

  function field(key: keyof Detail, val: string) {
    if (!detail) return;
    setDetail({ ...detail, [key]: val });
  }

  async function save() {
    if (!detail || !selId) return;
    setSaving(true); setMsg("");
    const res = await fetch("/api/admin/checkin-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_id: selId,
        booker_name: detail.booker_name,
        checkin_date: detail.checkin_date,
        guest_names_en: detail.guest_names_en,
        bed_setting: JSON.stringify(bedConfig),
        usim_request: JSON.stringify(simCards),
        extra_pickups: JSON.stringify(extraPickups),
        extra_requests: detail.extra_requests,
      }),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(()=>({})); setMsg("저장 실패: " + (j.error || "")); return; }
    const d = await res.json();
    if (d.detail) setDetail(d.detail);
    const ts = d.detail?.admin_saved_at || new Date().toISOString();
    setSavedAt(ts);
    if (typeof window!=="undefined" && selId) localStorage.setItem("checkin_saved_"+selId, ts);
    setEditing(false); // 저장 완료 → 인쇄 미리보기 뷰로 전환
    setMsg("저장 완료!");
    setTimeout(() => setMsg(""), 2500);
  }

  // 한글 값 → 영문 변환 (EN 인쇄용). 미매핑 값은 원문 그대로 유지
  function enText(v: any): string {
    let s = (v === null || v === undefined) ? "" : String(v);
    if (!s) return s;
    const map: [string, string][] = [
      // 베드 세팅 (긴 문자열 먼저)
      ["더블베드 2개 (3~4인 스테이)", "Double Bed x2 (3-4 guests)"],
      ["더블베드+싱글 (3인 스테이)", "Double+Single Bed (3 guests)"],
      ["더블베드 1개 (1~2인 스테이)", "Double Bed x1 (1-2 guests)"],
      ["더블베드 1개 (2인 스테이)", "Double Bed x1 (2 guests)"],
      ["사용하지 않음", "Not in use"],
      // 숙소/장소 ("막탄공항"을 "공항"보다 먼저)
      ["드림하우스", "Dream House"],
      ["막탄공항", "Mactan Airport"],
      ["공항", "Airport"],
      ["필요함", "Required"],
      ["불필요", "Not required"],
      ["미정", "TBD"],
      ["픽업", "Pick-up"],
      ["드랍", "Drop"],
    ];
    for (const [ko, en] of map) s = s.split(ko).join(en);
    // 기간 "N일" → "N days" (날짜 문자열은 tr 미적용이므로 안전)
    s = s.replace(/(\d+)\s*일/g, "$1 days");
    return s;
  }

  // 인쇄 팝업 열기
  function openPrintWindow(html: string) {
    const w = window.open("", "_blank");
    if (!w) { alert("팝업이 차단되었습니다. 팝업을 허용해주세요."); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // ── GUEST DETAILS 인쇄 시트 (EN/KR 공용, 인보이스 스타일 컬러) ──
  function printGuestDetails(lang: "en" | "kr", b: Booking, d: Partial<Detail>, dash: (v: any) => string) {
    const isEn = lang === "en";
    const L = isEn
      ? { title:"GUEST DETAILS", name:"NAME", house:"HOUSE NO", cin:"CHECK IN", cout:"CHECK OUT",
          pick:"PICK UP", drop:"DROP", bed:"BED SETTING", master:"2F MASTER", small:"2F SMALL", first:"1F",
          sim:"SIM", load:"LOAD", guest:"ALL GUEST", add:"ADD PICKUP", memo:"MEMO", settle:"SETTLEMENT",
          deposit:"DEPOSIT", date:"DATE", item:"ITEM", amount:"AMOUNT", note:"NOTE",
          deduct:"TOTAL DEDUCTION", refund:"REFUND AMOUNT", pkg:"ALL-INCLUSIVE PACKAGE" }
      : { title:"GUEST DETAILS", name:"예약자", house:"하우스번호", cin:"체크인", cout:"체크아웃",
          pick:"픽업", drop:"드랍", bed:"베드 세팅", master:"2F 마스터", small:"2F 작은방", first:"1F",
          sim:"유심", load:"수량", guest:"투숙객 전체", add:"추가 픽드랍", memo:"메모", settle:"정산",
          deposit:"보증금", date:"날짜", item:"항목", amount:"금액", note:"비고",
          deduct:"차감 합계", refund:"환불 금액", pkg:"올인원 패키지" };

    const logo = (typeof window !== "undefined" ? window.location.origin : "") + "/dream-academy-logo.png";
    const nameLine = `${dash(b.booker_name)}${b.booker_english ? ` (${b.booker_english})` : ""}`;
    const houseNo = dash(b.house_no || b.accom_room);
    const checkIn = dash(d.checkin_date || b.checkin_date);
    const checkOut = dash(b.checkout_date);
    const pickFlight = dash(b.pickup_place);
    const dropFlight = dash(b.drop_off);
    const m1 = bedNum(bedConfig.room1), m2 = bedNum(bedConfig.room2), m3 = bedNum(bedConfig.room3);
    const simList = simCards.map(s => simCompact(s.plan)).filter(Boolean);
    const simText = simList.length ? simList.join(", ") : "-";
    const loadText = simList.length ? String(simList.length) : "-";
    const guests = dash(d.guest_names_en);
    let addText = "-";
    try {
      const arr = JSON.parse(d.extra_pickups || "[]");
      if (Array.isArray(arr) && arr.length > 0) {
        addText = arr.map((p: { type?: string; date?: string; time?: string; airline?: string; flight?: string }) => {
          const line = `[${p.type || ""}] ${p.date || ""} ${p.time || ""} ${p.airline || ""} ${p.flight || ""}`.replace(/\s+/g, " ").trim();
          return isEn ? enText(line) : line;
        }).join("  |  ");
      }
    } catch {}
    const etc = d.extra_requests ? String(d.extra_requests) : "";
    const isPkg = isPackage(b.accom_type);
    const pkgBadge = isPkg ? `<span class="pkg">${L.pkg}</span>` : "";
    const memoLines = Array.from({length:4}).map(()=>`<div class="mline"></div>`).join("");
    const memoHtml = (etc ? `<div class="metxt">${etc}</div>` : "") + memoLines;

    // 정산 섹션 - 보증금 항목 찾기
    const depositItem = localItems.find(l => l.name?.includes("보증금") || l.name?.toLowerCase().includes("deposit"));
    let depositAmt = "_______ PHP";
    if(depositItem && depositItem.amount){
      depositAmt = `${Number(String(depositItem.amount).replace(/[,\s]/g,"")).toLocaleString()} PHP`;
    } else {
      // 체크인~체크아웃 주수로 자동 계산 (Dream House 기준: 4주=8000, 3주=6000, 2주=4000)
      const cin = new Date(b.checkin_date||""); const cout = new Date(b.checkout_date||"");
      if(!isNaN(cin.getTime()) && !isNaN(cout.getTime())){
        const days = Math.round((cout.getTime()-cin.getTime())/(1000*60*60*24));
        const weeks = Math.round(days/7);
        const depMap:{[k:number]:number} = {2:4000,3:6000,4:8000};
        if(depMap[weeks]) depositAmt = `${depMap[weeks].toLocaleString()} PHP`;
        else if(weeks>4) depositAmt = `8,000 PHP`;
        else if(weeks>=1) depositAmt = `${weeks*2000} PHP`;
      }
    }
    const otherLocals = localItems.filter(l => !l.name?.includes("보증금") && !l.name?.toLowerCase().includes("deposit"));
    const blankRows = 5;
    const settleRows = Array.from({length:blankRows}).map(()=>
      `<tr><td class="sdate"></td><td class="sitem"></td><td class="samt"></td><td class="snote"></td></tr>`
    ).join("");

    const html = `<!doctype html>
<html lang="${isEn ? "en" : "ko"}"><head><meta charset="utf-8"/>
<title>${L.title} — ${dash(b.booker_name)}</title>
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
  body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:0;padding:18px 22px;background:#fff;}

  /* ── HEADER ── */
  .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
  .hd img{height:44px;width:auto;}
  .hd-right{text-align:right;}
  .hd-title{font-size:26px;font-weight:900;color:#0f172a;letter-spacing:1.5px;}
  .pkg-badge{display:inline-block;box-shadow:inset 0 0 0 1000px #4f46e5 !important;color:#fff !important;font-size:10px;font-weight:800;letter-spacing:0.06em;padding:3px 10px;border-radius:20px;margin-top:4px;}
  .rule{height:3px;box-shadow:inset 0 0 0 1000px #4f46e5 !important;border-radius:2px;margin-bottom:16px;}

  /* ── INFO TABLE ── */
  .info-tbl{width:100%;border-collapse:collapse;margin-bottom:10px;}
  .info-tbl td{padding:7px 10px;border:1px solid #e2e8f0;font-size:12px;vertical-align:middle;}
  .il{box-shadow:inset 0 0 0 1000px #f8fafc !important;color:#6366f1;font-size:9px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;width:90px;}
  .iv{color:#0f172a;font-size:13px;font-weight:600;}
  .iv-name{font-size:15px;font-weight:800;}
  .iv-house{font-size:20px;font-weight:900;text-align:center;color:#4f46e5;letter-spacing:1px;}

  /* ── BED / SIM ── */
  .bed-tbl{width:100%;border-collapse:collapse;margin-bottom:10px;}
  .bed-tbl td,.bed-tbl th{border:1px solid #e2e8f0;padding:6px 8px;text-align:center;vertical-align:middle;}
  .bhd{box-shadow:inset 0 0 0 1000px #4f46e5 !important;color:#fff !important;font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;}
  .bsub{box-shadow:inset 0 0 0 1000px #ede9fe !important;color:#4338ca !important;font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;}
  .bnum{font-size:24px;font-weight:900;color:#0f172a;}
  .bsim{font-size:12px;font-weight:800;color:#0f172a;}

  /* ── GUEST / PICKUP ── */
  .row-tbl{width:100%;border-collapse:collapse;margin-bottom:10px;}
  .row-tbl td{border:1px solid #e2e8f0;padding:8px 10px;font-size:12px;vertical-align:middle;}
  .rl{background:#fff !important;color:#4f46e5 !important;font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;width:90px;border-right:3px solid #4f46e5 !important;}
  .rv{color:#0f172a;font-size:12px;font-weight:600;}

  /* ── MEMO ── */
  .memo-tbl{width:100%;border-collapse:collapse;margin-bottom:14px;}
  .memo-tbl td{border:1px solid #e2e8f0;padding:8px 10px;vertical-align:top;}
  .ml{background:#fff !important;color:#475569 !important;font-size:9px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;width:90px;border-right:3px solid #cbd5e1 !important;}
  .mc{min-height:80px;}
  .metxt{font-size:11px;color:#1e293b;margin-bottom:6px;font-weight:600;}
  .mline{border-bottom:1px dashed #cbd5e1;height:18px;margin-bottom:2px;}

  /* ── SETTLEMENT ── */
  .settle-hd{background:#fff !important;color:#0f172a !important;font-size:10px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;padding:7px 12px;border-radius:6px 6px 0 0;border-bottom:2px solid #0f172a !important;}
  .settle-wrap{border:1.5px solid #e2e8f0;border-top:none;border-radius:0 0 6px 6px;overflow:hidden;}
  .settle-tbl{width:100%;border-collapse:collapse;}
  .settle-tbl td,.settle-tbl th{border:1px solid #e2e8f0;padding:7px 10px;font-size:11px;vertical-align:middle;}
  .dep-lbl{box-shadow:inset 0 0 0 1000px #fef3c7 !important;color:#92400e !important;font-size:10px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;width:120px;}
  .dep-val{font-size:14px;font-weight:900;color:#0f172a;}
  .sh{box-shadow:inset 0 0 0 1000px #f1f5f9 !important;color:#475569 !important;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-align:center;}
  .sdate{width:80px;}
  .sitem{width:40%;}
  .samt{width:18%;text-align:right;}
  .snote{width:20%;}
  .stotal{box-shadow:inset 0 0 0 1000px #f1f5f9 !important;font-size:11px;font-weight:700;color:#475569;text-align:right;}
  .srefund{box-shadow:inset 0 0 0 1000px #dcfce7 !important;font-size:12px;font-weight:900;color:#166534 !important;text-align:right;}

  @media print{
    @page{size:A4;margin:10mm 12mm;}
    body{padding:0;}
    .rule,.bhd,.rl,.ml,.settle-hd,.srefund,.dep-lbl{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
  }
</style></head>
<body>
  <div class="hd">
    <img src="${logo}" onerror="this.style.display='none'"/>
    <div class="hd-right">
      <div class="hd-title">${L.title}</div>
      ${isPkg ? `<div><span class="pkg-badge">${L.pkg}</span></div>` : ""}
    </div>
  </div>
  <div class="rule"></div>

  <!-- INFO -->
  <table class="info-tbl">
    <tr>
      <td class="il">${L.name}</td>
      <td class="iv iv-name" colspan="3">${nameLine}</td>
      <td class="il" style="width:80px">${L.house}</td>
      <td class="iv iv-house" style="width:110px">${houseNo}</td>
    </tr>
    <tr>
      <td class="il">${L.cin}</td>
      <td class="iv" style="width:160px">${checkIn}</td>
      <td class="il" style="width:80px">${L.cout}</td>
      <td class="iv" style="width:160px">${checkOut}</td>
      <td class="il">${L.pick}</td>
      <td class="iv">${pickFlight}</td>
    </tr>
    <tr>
      <td class="il">${L.drop}</td>
      <td class="iv" colspan="5">${dropFlight}</td>
    </tr>
  </table>

  <!-- BED / SIM -->
  <table class="bed-tbl">
    <tr>
      <th class="bhd" colspan="3">${L.bed}</th>
      <th class="bhd" rowspan="2">${L.sim}</th>
      <th class="bhd" rowspan="2">${L.load}</th>
    </tr>
    <tr>
      <th class="bsub">${L.master}</th>
      <th class="bsub">${L.small}</th>
      <th class="bsub">${L.first}</th>
    </tr>
    <tr>
      <td class="bnum">${m1}</td>
      <td class="bnum">${m2}</td>
      <td class="bnum">${m3}</td>
      <td class="bsim">${simText}</td>
      <td class="bnum">${loadText}</td>
    </tr>
  </table>

  <!-- GUESTS / ADD -->
  <table class="row-tbl">
    <tr>
      <td class="rl">${L.guest}</td>
      <td class="rv">${guests}</td>
    </tr>
    <tr>
      <td class="rl">${L.add}</td>
      <td class="rv">${addText}</td>
    </tr>
  </table>

  <!-- MEMO -->
  <table class="memo-tbl">
    <tr>
      <td class="ml">${L.memo}</td>
      <td class="mc">${memoHtml}</td>
    </tr>
  </table>

  <!-- SETTLEMENT -->
  <div class="settle-hd">🔐 ${L.settle}</div>
  <div class="settle-wrap">
    <table class="settle-tbl">
      <tr>
        <td class="dep-lbl">${L.deposit}</td>
        <td class="dep-val" colspan="3">${depositAmt}</td>
      </tr>
      <tr>
        <th class="sh sdate">${L.date}</th>
        <th class="sh sitem">${L.item}</th>
        <th class="sh samt">${L.amount}</th>
        <th class="sh snote">${L.note}</th>
      </tr>
      ${settleRows}
      <tr>
        <td class="stotal" colspan="2">${L.deduct}</td>
        <td class="stotal samt"></td>
        <td></td>
      </tr>
      <tr>
        <td class="srefund" colspan="2">${L.refund}</td>
        <td class="srefund samt"></td>
        <td></td>
      </tr>
    </table>
  </div>
  <script>window.onload=function(){window.print();};</script>
</body></html>`;
    // <script>autoprint 제거 후 state에 저장 → 오버레이 iframe으로 표시
    setPrintHtml(html.replace(/<script>window\.onload[^<]*<\/script>/g, ""));
  }

  function handlePrint(lang: "en" | "kr" = "en") {
    if (!booking) { alert("예약을 먼저 선택하세요."); return; }
    const d = detail || ({} as Partial<Detail>);
    const dash = (v: any) => (v === null || v === undefined || v === "") ? "-" : String(v);
    printGuestDetails(lang, booking, d, dash);
  }

  function copyPublicLink() {
    if (!detail?.public_token) { setMsg("토큰이 없습니다. 먼저 저장해주세요."); return; }
    const url = `${window.location.origin}/checkin/${detail.public_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setMsg("손님 폼 링크가 클립보드에 복사되었습니다");
      setTimeout(() => setMsg(""), 2500);
    });
  }

  if (!authed) return null;

  if (printHtml) return (
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",flexDirection:"column",background:"#334155"}}>
      <div style={{padding:"10px 16px",background:"#1e293b",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={()=>setPrintHtml("")} style={{padding:"7px 16px",background:"#475569",color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✕ 닫기</button>
        <span style={{color:"#94a3b8",fontSize:13,flex:1}}>GUEST DETAILS 미리보기 — 내용 확인 후 인쇄하세요</span>
        <button onClick={()=>{(document.getElementById("gd-iframe") as HTMLIFrameElement)?.contentWindow?.print();}} style={{padding:"7px 20px",background:"#4f46e5",color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🖨 인쇄 / PDF</button>
      </div>
      <iframe id="gd-iframe" srcDoc={printHtml} style={{flex:1,border:"none",background:"#fff"}} title="Guest Details Print Preview" />
    </div>
  );

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.cd-w{max-width:900px;margin:0 auto;padding:40px 24px}
.cd-top{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.cd-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.cd-back:hover{background:#e2e8f0}
.cd-top h1{font-size:24px;font-weight:800;flex:1}
.sec{background:#fff;border-radius:14px;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,0.05);margin-bottom:14px}
.sec h2{font-size:15px;font-weight:800;color:#1a6fc4;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
.sel-row{margin-bottom:14px}.sel-row select{width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff}.sel-row select:focus{border-color:#1a6fc4}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.fg{display:flex;flex-direction:column;gap:4px}
.fl{font-size:11px;font-weight:700;color:#475569}
.fi{padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none}.fi:focus{border-color:#1a6fc4}
.ta{padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;resize:vertical;min-height:62px}.ta:focus{border-color:#1a6fc4}
.row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #f1f5f9}.row:last-child{border:none}.lbl{color:#6b7c93;font-weight:600}.val{color:#1a1a2e}
.btn{padding:11px 20px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#0d3d7a}
.btn-green{background:#16a34a;color:#fff}.btn-green:hover{background:#15803d}
.btn-gray{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}.btn-gray:hover{background:#e2e8f0}
.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.msg{font-size:13px;font-weight:700}.msg-ok{color:#166534}.msg-err{color:#dc2626}
.token-info{font-size:11px;color:#94a3b8;font-family:monospace;margin-top:6px}
@media(max-width:700px){.cd-w{padding:24px 12px}.fr{grid-template-columns:1fr}}
    `}</style>
    <div className="cd-w">
      <div className="cd-top">
        <button className="cd-back" onClick={()=>router.push("/admin/hub")}>←</button>
        <h1>체크인 디테일</h1>
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button onClick={()=>handlePrint("kr")} disabled={!booking}
            style={{padding:"6px 12px",border:"1px solid #cbd5e1",background:"#fff",color:"#475569",borderRadius:6,fontSize:12,fontWeight:600,cursor:booking?"pointer":"not-allowed",fontFamily:"inherit",opacity:booking?1:0.5}}>
            🖨️ 인쇄 (KR)
          </button>
          <button onClick={()=>handlePrint("en")} disabled={!booking}
            style={{padding:"6px 12px",border:"1px solid #cbd5e1",background:"#fff",color:"#475569",borderRadius:6,fontSize:12,fontWeight:600,cursor:booking?"pointer":"not-allowed",fontFamily:"inherit",opacity:booking?1:0.5}}>
            🖨️ Print (EN)
          </button>
        </div>
      </div>

      {(editing || !detail || !booking) && (<div className="sec">
        <h2>예약 선택</h2>
        <div className="sel-row">
          <select value={selId || ""} onChange={e => { if (e.target.value) selectBooking(e.target.value); }}>
            <option value="">— 예약 선택 —</option>
            {bookings.map(b => (
              <option key={b.id} value={b.id}>
                {fDate(b.checkin_date)} ~ {fDate(b.checkout_date)} | {b.booker_name} | {b.accom_type || "-"}
              </option>
            ))}
          </select>
        </div>
      </div>)}

      {detail && booking && (<>
        {!editing && (
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:14,padding:"12px 16px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10}}>
            <span style={{fontSize:13,fontWeight:700,color:"#166534"}}>✅ 저장완료{savedAt?` · ${new Date(savedAt).toLocaleString("ko-KR")}`:""}</span>
            <button onClick={()=>setEditing(true)} style={{padding:"7px 16px",background:"#fff",color:"#1a6fc4",border:"1px solid #bfdbfe",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>✏️ 수정하기</button>
          </div>
        )}
        <div className="sec">
          <h2>예약 정보</h2>
          <div className="row"><span className="lbl">예약자</span><span className="val">{booking.booker_name} {booking.booker_english ? `(${booking.booker_english})` : ""}</span></div>
          <div className="row"><span className="lbl">체크인 ~ 체크아웃</span><span className="val">{fDate(booking.checkin_date)} ~ {fDate(booking.checkout_date)}</span></div>
          <div className="row"><span className="lbl">숙소 / 룸</span><span className="val">{booking.accom_type || "-"} {booking.accom_room || booking.house_no || ""}</span></div>
          <div className="row"><span className="lbl">인원</span><span className="val">성인 {booking.adults || 0}명 + 아이 {booking.children || 0}명</span></div>
          <div className="row"><span className="lbl">픽업 / 드랍</span><span className="val">{booking.pickup_place || "-"} / {booking.drop_off || "-"}</span></div>
          <div className="row"><span className="lbl">항공편 (IN/OUT)</span><span className="val">{booking.flight_in || "-"} / {booking.flight_out || "-"}</span></div>
        </div>

        {editing && (<div className="sec">
          <h2>체크인 디테일 입력</h2>
          <div className="fr">
            <div className="fg"><label className="fl">예약자 성함</label><input className="fi" value={detail.booker_name||""} onChange={e=>field("booker_name",e.target.value)}/></div>
            <div className="fg"><label className="fl">입실 일자</label><input className="fi" value={detail.checkin_date||""} onChange={e=>field("checkin_date",e.target.value)} placeholder="2026-05-09 또는 2026년 5월 9일"/></div>
          </div>
          <div className="fg" style={{marginBottom:10}}><label className="fl">투숙자 전체 영문이름</label><textarea className="ta" value={detail.guest_names_en||""} onChange={e=>field("guest_names_en",e.target.value)} placeholder="kim ooo / yoo ooo ooo / ..."/></div>

          {/* ① 베드 세팅 — 룸별 카드 선택 */}
          <div className="fg" style={{marginBottom:14}}>
            <label className="fl" style={{marginBottom:8}}>🛏 베드 세팅</label>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{border:"1px solid #dde",borderRadius:8,padding:"10px 14px"}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:"#334"}}>룸 1 — 마스터룸 (큰방)</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["더블베드 1개 (2인 스테이)","더블베드 2개 (3~4인 스테이)"].map(opt=>(
                    <button key={opt} type="button"
                      onClick={()=>setBedConfig(p=>({...p,room1:opt}))}
                      style={{padding:"6px 14px",borderRadius:20,border:"1.5px solid",fontSize:12,cursor:"pointer",
                        borderColor:bedConfig.room1===opt?"#5b6cf8":"#ccd",
                        background:bedConfig.room1===opt?"#5b6cf8":"#fff",
                        color:bedConfig.room1===opt?"#fff":"#556"}}>{opt}</button>
                  ))}
                </div>
              </div>
              <div style={{border:"1px solid #dde",borderRadius:8,padding:"10px 14px"}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:"#334"}}>룸 2 — 2층방 (작은방)</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["더블베드 1개 (2인 스테이)","더블베드+싱글 (3인 스테이)","사용하지 않음"].map(opt=>(
                    <button key={opt} type="button"
                      onClick={()=>setBedConfig(p=>({...p,room2:opt}))}
                      style={{padding:"6px 14px",borderRadius:20,border:"1.5px solid",fontSize:12,cursor:"pointer",
                        borderColor:bedConfig.room2===opt?"#5b6cf8":"#ccd",
                        background:bedConfig.room2===opt?"#5b6cf8":"#fff",
                        color:bedConfig.room2===opt?"#fff":"#556"}}>{opt}</button>
                  ))}
                </div>
              </div>
              <div style={{border:"1px solid #dde",borderRadius:8,padding:"10px 14px"}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:8,color:"#334"}}>룸 3 — 1층방</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["더블베드 1개 (1~2인 스테이)","사용하지 않음"].map(opt=>(
                    <button key={opt} type="button"
                      onClick={()=>setBedConfig(p=>({...p,room3:opt}))}
                      style={{padding:"6px 14px",borderRadius:20,border:"1.5px solid",fontSize:12,cursor:"pointer",
                        borderColor:bedConfig.room3===opt?"#5b6cf8":"#ccd",
                        background:bedConfig.room3===opt?"#5b6cf8":"#fff",
                        color:bedConfig.room3===opt?"#fff":"#556"}}>{opt}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ② 유심 대여 — 구조화 */}
          <div className="fg" style={{marginBottom:14}}>
            <label className="fl" style={{marginBottom:8}}>📱 유심 대여</label>
            <div style={{background:"#fff8e1",borderRadius:6,padding:"6px 12px",fontSize:12,color:"#856404",marginBottom:8}}>
              💡 유심 비용은 보증금에서 차감됩니다. 퇴실 시 반납 필수.
            </div>
            {simCards.map((sim,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:12,color:"#667",minWidth:40}}>유심 {i+1}</span>
                <select value={sim.plan} onChange={e=>setSimCards(prev=>{const n=[...prev];n[i]={plan:e.target.value};return n;})}
                  style={{flex:1,padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}>
                  <option value="">— 요금제 선택 —</option>
                  {SIM_PLANS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
                <button type="button" onClick={()=>setSimCards(prev=>prev.filter((_,j)=>j!==i))}
                  style={{padding:"4px 10px",borderRadius:6,border:"1px solid #fcc",background:"#fff5f5",color:"#e53",fontSize:12,cursor:"pointer"}}>삭제</button>
              </div>
            ))}
            {simCards.length < 6 &&
              <button type="button" onClick={()=>setSimCards(prev=>[...prev,{plan:""}])}
                style={{padding:"6px 16px",borderRadius:6,border:"1.5px dashed #5b6cf8",background:"#f5f6ff",color:"#5b6cf8",fontSize:12,cursor:"pointer",marginTop:4}}>
                + 유심 추가 (최대 6개)
              </button>
            }
          </div>

          {/* ③ 추가 픽드랍 */}
          <div className="fg" style={{marginBottom:14}}>
            <label className="fl" style={{marginBottom:8}}>🚗 추가 픽드랍 신청</label>
            <div>
              {extraPickups.map((ep,i)=>(
                <div key={i} style={{border:"1px solid #dde",borderRadius:8,padding:10,marginBottom:8,background:"#fafafe"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{display:"flex",gap:6}}>
                      {["픽업","드랍"].map(t=>(
                        <button key={t} type="button"
                          onClick={()=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],type:t};return n;})}
                          style={{padding:"4px 12px",borderRadius:16,border:"1.5px solid",fontSize:12,cursor:"pointer",
                            borderColor:ep.type===t?"#5b6cf8":"#ccd",
                            background:ep.type===t?"#5b6cf8":"#fff",
                            color:ep.type===t?"#fff":"#556"}}>{t}</button>
                      ))}
                    </div>
                    <button type="button" onClick={()=>setExtraPickups(prev=>prev.filter((_,j)=>j!==i))}
                      style={{fontSize:11,color:"#e53",background:"none",border:"none",cursor:"pointer"}}>✕ 삭제</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <div style={{fontSize:11,color:"#889",marginBottom:3}}>날짜</div>
                      <input type="date" value={ep.date}
                        onChange={e=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],date:e.target.value};return n;})}
                        style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid #dde",fontSize:13}} />
                    </div>
                    <div>
                      <div style={{fontSize:11,color:"#889",marginBottom:3}}>시간</div>
                      <input type="time" value={ep.time}
                        onChange={e=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],time:e.target.value};return n;})}
                        style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid #dde",fontSize:13}} />
                    </div>
                    <div>
                      <div style={{fontSize:11,color:"#889",marginBottom:3}}>항공사</div>
                      <input type="text" value={ep.airline} placeholder="예: 대한항공"
                        onChange={e=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],airline:e.target.value};return n;})}
                        style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid #dde",fontSize:13}} />
                    </div>
                    <div>
                      <div style={{fontSize:11,color:"#889",marginBottom:3}}>편명</div>
                      <input type="text" value={ep.flight} placeholder="예: KE601"
                        onChange={e=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],flight:e.target.value};return n;})}
                        style={{width:"100%",padding:"5px 8px",borderRadius:6,border:"1px solid #dde",fontSize:13}} />
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={()=>setExtraPickups(prev=>[...prev,{type:"픽업",date:"",airline:"",flight:"",time:""}])}
                style={{padding:"6px 16px",borderRadius:6,border:"1.5px dashed #5b6cf8",background:"#f5f6ff",color:"#5b6cf8",fontSize:12,cursor:"pointer"}}>
                + 픽드랍 추가
              </button>
            </div>
          </div>

          <div className="fg" style={{marginBottom:10}}><label className="fl">기타 요청사항</label><textarea className="ta" value={detail.extra_requests||""} onChange={e=>field("extra_requests",e.target.value)} placeholder="추가 요청사항"/></div>

          <div className="actions" style={{marginTop:14}}>
            <button className="btn btn-blue" onClick={save} disabled={saving}>{saving?"저장 중...":"💾 저장"}</button>
            {detail.public_token && <button className="btn btn-green" onClick={copyPublicLink}>🔗 손님 폼 링크 복사</button>}
            {msg && <span className={`msg ${msg.includes("실패")?"msg-err":"msg-ok"}`}>{msg}</span>}
          </div>
          {detail.public_token && <div className="token-info">/checkin/{detail.public_token}{detail.submitted_at?` · 제출됨: ${new Date(detail.submitted_at).toLocaleString("ko-KR")}`:" · 손님 미제출"}</div>}
        </div>)}

        {!editing && (<div className="sec">
          <h2>체크인 디테일 (저장 완료)</h2>
          <div className="row"><span className="lbl">예약자 성함</span><span className="val">{detail.booker_name||"-"}</span></div>
          <div className="row"><span className="lbl">입실 일자</span><span className="val">{detail.checkin_date||"-"}</span></div>
          <div className="row"><span className="lbl">투숙자 전체 영문이름</span><span className="val" style={{textAlign:"right",maxWidth:"62%"}}>{detail.guest_names_en||"-"}</span></div>
          <div className="row"><span className="lbl">베드 세팅</span><span className="val" style={{textAlign:"right",maxWidth:"62%"}}>{[bedConfig.room1&&`룸1: ${bedConfig.room1}`,bedConfig.room2&&`룸2: ${bedConfig.room2}`,bedConfig.room3&&`룸3: ${bedConfig.room3}`].filter(Boolean).join(" / ")||"-"}</span></div>
          <div className="row"><span className="lbl">유심 대여</span><span className="val" style={{textAlign:"right",maxWidth:"62%"}}>{simCards.map(s=>s.plan).filter(Boolean).join(" / ")||"없음"}</span></div>
          <div className="row"><span className="lbl">추가 픽드랍</span><span className="val" style={{textAlign:"right",maxWidth:"62%"}}>{extraPickups.length>0?extraPickups.map(p=>`[${p.type}] ${p.date} ${p.time} ${p.airline} ${p.flight}`.replace(/\s+/g," ").trim()).join(" / "):"없음"}</span></div>
          <div className="row"><span className="lbl">기타 요청사항</span><span className="val" style={{textAlign:"right",maxWidth:"62%",whiteSpace:"pre-wrap"}}>{detail.extra_requests||"-"}</span></div>
          {detail.public_token && <div className="token-info">/checkin/{detail.public_token}{detail.submitted_at?` · 손님 제출됨: ${new Date(detail.submitted_at).toLocaleString("ko-KR")}`:" · 손님 미제출"}</div>}
          <div className="actions" style={{marginTop:14}}>
            <button className="btn btn-blue" onClick={()=>handlePrint("en")}>🖨️ Print (EN)</button>
            <button className="btn btn-gray" onClick={()=>handlePrint("kr")}>🖨️ 인쇄 (KR)</button>
            {detail.public_token && <button className="btn btn-green" onClick={copyPublicLink}>🔗 손님 폼 링크 복사</button>}
            {msg && <span className={`msg ${msg.includes("실패")?"msg-err":"msg-ok"}`}>{msg}</span>}
          </div>
        </div>)}
      </>)}
    </div>
  </>);
}
