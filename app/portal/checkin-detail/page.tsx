'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolvePortalSession } from "@/lib/portalSession";
import { toastOk, toastErr } from "@/lib/toast";

interface FormState {
  q1: string; q2: string; q6: string;
}

const SIM_PLANS = ["2GB / 3일 / ₱75","6GB / 7일 / ₱149","24GB / 30일 / ₱499","36GB / 30일 / ₱599","48GB / 30일 / ₱699"];

export default function PortalCheckinDetailPage() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({ q1:'', q2:'', q6:'' });
  const [bedConfig, setBedConfig] = useState({room1:"",room2:"",room3:"더블베드 1개 (1~2인 스테이)"});
  const [simCards, setSimCards] = useState<{plan:string}[]>([]);
  const [extraPickups, setExtraPickups] = useState<{type:string;date:string;airline:string;flight:string;time:string}[]>([]);
  const [flightForm, setFlightForm] = useState({
    flight_in_airline:"", flight_in_no:"", flight_in_date:"", flight_in_time:"", flight_in_origin:"", flight_in_undecided:false,
    flight_out_airline:"", flight_out_no:"", flight_out_date:"", flight_out_time:"", flight_out_destination:"", flight_out_undecided:false,
  });
  const flightFileRef = useRef<HTMLInputElement>(null);
  const [flightOcrLoading, setFlightOcrLoading] = useState(false);
  const [flightOcrMsg, setFlightOcrMsg] = useState("");

  // 탭 + 픽드랍 신청 상태
  const [tab, setTab] = useState<"flight" | "checkin" | "extra">("checkin");
  type PR = { id?: string; request_type: "arrival" | "departure" | "extra" | "extra_pickup" | "extra_drop"; request_date: string; request_time: string | null; location: string | null; destination: string | null; num_people: number | null; flight_info: string | null; notes: string | null; status: string };
  const [pickups, setPickups] = useState<PR[]>([]);
  const [arrPickup, setArrPickup] = useState<PR>({ request_type: "arrival", request_date: "", request_time: "", location: "", destination: "", num_people: 1, flight_info: "", notes: "", status: "pending" });
  const [depPickup, setDepPickup] = useState<PR>({ request_type: "departure", request_date: "", request_time: "", location: "", destination: "", num_people: 1, flight_info: "", notes: "", status: "pending" });
  const [savingArr, setSavingArr] = useState(false);
  const [savingDep, setSavingDep] = useState(false);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraForm, setExtraForm] = useState<PR>({ request_type: "extra", request_date: "", request_time: "", location: "", destination: "", num_people: 1, flight_info: "", notes: "", status: "pending" });
  const [savingExtra, setSavingExtra] = useState(false);
  // 추가 픽업/드랍 — 매번 신규 행
  const [showExtraPickupForm, setShowExtraPickupForm] = useState(false);
  const [extraPickupForm, setExtraPickupForm] = useState<PR>({ request_type: "extra_pickup", request_date: "", request_time: "", location: "", destination: "드림하우스", num_people: 1, flight_info: "", notes: "", status: "pending" });
  const [savingExtraPickup, setSavingExtraPickup] = useState(false);
  const epOcrRef = useRef<HTMLInputElement>(null);
  const [epOcrLoading, setEpOcrLoading] = useState(false);
  const [epOcrMsg, setEpOcrMsg] = useState("");
  const [showExtraDropForm, setShowExtraDropForm] = useState(false);
  const [extraDropForm, setExtraDropForm] = useState<PR>({ request_type: "extra_drop", request_date: "", request_time: "", location: "드림하우스", destination: "", num_people: 1, flight_info: "", notes: "", status: "pending" });
  const [savingExtraDrop, setSavingExtraDrop] = useState(false);

  async function handleExtraPickupOcr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEpOcrLoading(true);
    setEpOcrMsg("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/ocr/flight", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "failed");
      const f = data.fields || {};
      setExtraPickupForm(p => ({
        ...p,
        request_date: f.in_date || p.request_date,
        request_time: f.in_time || p.request_time,
        flight_info: [f.in_airline, f.in_no].filter(Boolean).join(" ") || p.flight_info,
      }));
      setEpOcrMsg("✅ 자동입력 완료! 내용을 확인해주세요.");
    } catch {
      setEpOcrMsg("❌ 인식 실패. 직접 입력해주세요.");
    } finally {
      setEpOcrLoading(false);
      if (e.target) e.target.value = "";
    }
  }

  async function loadPickups(bid: string) {
    if (!bid) return;
    try {
      const res = await fetch(`/api/portal/pickup-request?booking_id=${encodeURIComponent(bid)}`);
      if (!res.ok) return;
      const j = await res.json();
      const list = (j.requests || []) as PR[];
      setPickups(list);
      const arr = list.find(p => p.request_type === "arrival");
      if (arr) setArrPickup({ ...arr });
      const dep = list.find(p => p.request_type === "departure");
      if (dep) setDepPickup({ ...dep });
    } catch {/* noop */}
  }

  async function savePickup(type: "arrival" | "departure" | "extra" | "extra_pickup" | "extra_drop") {
    if (!bookingId) { toastErr("예약 정보를 불러오는 중입니다."); return; }
    const src =
      type === "arrival" ? arrPickup :
      type === "departure" ? depPickup :
      type === "extra_pickup" ? extraPickupForm :
      type === "extra_drop" ? extraDropForm :
      extraForm;
    if (!src.request_date) { toastErr("날짜를 입력해 주세요."); return; }
    const setSaving =
      type === "arrival" ? setSavingArr :
      type === "departure" ? setSavingDep :
      type === "extra_pickup" ? setSavingExtraPickup :
      type === "extra_drop" ? setSavingExtraDrop :
      setSavingExtra;
    setSaving(true);
    try {
      const res = await fetch("/api/portal/pickup-request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          request_type: type,
          request_date: src.request_date,
          request_time: src.request_time || null,
          location: src.location || null,
          destination: src.destination || null,
          num_people: src.num_people || 1,
          flight_info: src.flight_info || null,
          notes: src.notes || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) { toastErr("저장 실패: " + (j.error || "")); setSaving(false); return; }
      await loadPickups(bookingId);
      if (type === "extra") {
        setShowExtraForm(false);
        setExtraForm({ request_type: "extra", request_date: "", request_time: "", location: "", destination: "", num_people: 1, flight_info: "", notes: "", status: "pending" });
      } else if (type === "extra_pickup") {
        setShowExtraPickupForm(false);
        setExtraPickupForm({ request_type: "extra_pickup", request_date: "", request_time: "", location: "", destination: "드림하우스", num_people: 1, flight_info: "", notes: "", status: "pending" });
      } else if (type === "extra_drop") {
        setShowExtraDropForm(false);
        setExtraDropForm({ request_type: "extra_drop", request_date: "", request_time: "", location: "드림하우스", destination: "", num_people: 1, flight_info: "", notes: "", status: "pending" });
      }
      toastOk("신청이 저장되었습니다.");
    } finally { setSaving(false); }
  }

  async function handleFlightOcr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFlightOcrLoading(true);
    setFlightOcrMsg("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/ocr/flight", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "failed");
      const f = data.fields || {};
      setFlightForm(p => ({
        ...p,
        flight_in_airline: f.in_airline || p.flight_in_airline,
        flight_in_no: f.in_no || p.flight_in_no,
        flight_in_date: f.in_date || p.flight_in_date,
        flight_in_time: f.in_time || p.flight_in_time,
        flight_in_origin: f.in_origin || p.flight_in_origin,
        flight_out_airline: f.out_airline || p.flight_out_airline,
        flight_out_no: f.out_no || p.flight_out_no,
        flight_out_date: f.out_date || p.flight_out_date,
        flight_out_time: f.out_time || p.flight_out_time,
        flight_out_destination: f.out_destination || p.flight_out_destination,
      }));
      setFlightOcrMsg("✅ 자동입력 완료! 내용을 확인해주세요.");
    } catch {
      setFlightOcrMsg("❌ 인식 실패. 직접 입력해주세요.");
    } finally {
      setFlightOcrLoading(false);
      if (e.target) e.target.value = "";
    }
  }

  useEffect(() => {
    (async () => {
    const s = await resolvePortalSession();
    if (!s) { router.replace('/portal'); return; }
    const bid = s.booking_id;
    setBookingId(bid);
    loadPickups(bid);
    // 예약자 성함·입실일자 자동 채움 (입력칸 제거 — 예약현황 정보 사용)
    const sAny = s as typeof s & { check_in_date?: string };
    setForm(prev => prev.q1 ? prev : { ...prev, q1: `${s.guest_name || ""}${sAny.check_in_date ? `, ${sAny.check_in_date} 입실` : ""}`.trim() });

    fetch(`/api/checkin-portal?bookingId=${bid}`)
      .then(r => r.json())
      .then(d => {
        const det = d.detail || {};
        if (det.submitted_at) setAlreadySubmitted(true);
        if (det.submitted_at || det.booker_name) {
          setForm({
            q1: det.booker_name || '',
            q2: det.guest_names_en || '',
            q6: det.extra_requests || '',
          });
          try {
            const b = JSON.parse(det.bed_setting || "{}");
            if (b.room1 || b.room2) setBedConfig({room1:b.room1||"", room2:b.room2||"", room3:b.room3||"더블베드 1개 (1~2인 스테이)"});
          } catch {}
          try {
            const s = JSON.parse(det.usim_request || "[]");
            if (Array.isArray(s)) setSimCards(s);
          } catch {}
          try {
            const ep = JSON.parse(det.extra_pickups || "[]");
            if (Array.isArray(ep)) setExtraPickups(ep);
          } catch {}
          setFlightForm({
            flight_in_airline: det.flight_in_airline || "",
            flight_in_no: det.flight_in_no || "",
            flight_in_date: (det.flight_in_date || "").split("T")[0] || "",
            flight_in_time: det.flight_in_time || "",
            flight_in_origin: det.flight_in_origin || "",
            flight_in_undecided: !!det.flight_in_undecided,
            flight_out_airline: det.flight_out_airline || "",
            flight_out_no: det.flight_out_no || "",
            flight_out_date: (det.flight_out_date || "").split("T")[0] || "",
            flight_out_time: det.flight_out_time || "",
            flight_out_destination: det.flight_out_destination || "",
            flight_out_undecided: !!det.flight_out_undecided,
          });
        }
        setLoading(false);
      })
      .catch(() => { setError('불러오기 실패'); setLoading(false); });
    })();
  }, [router]);

  function up<K extends keyof FormState>(k: K, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function submit() {
    // 예약자 성함·입실일자는 예약 정보에서 자동 포함 (입력 제거됨)
    setSubmitting(true);
    const res = await fetch('/api/checkin-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        booker_name: form.q1,
        guest_names_en: form.q2,
        bed_setting: JSON.stringify(bedConfig),
        usim_request: JSON.stringify(simCards),
        extra_pickups: JSON.stringify(extraPickups),
        extra_requests: form.q6,
        ...flightForm,
      }),
    });
    setSubmitting(false);
    if (!res.ok) { const j = await res.json().catch(()=>({})); toastErr('제출 실패: ' + (j.error||'')); return; }
    setDone(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (<>
    <style>{`
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Noto Sans KR',sans-serif;background:#f7f9fc;color:#1a1a2e;line-height:1.6}
      .cf-w{max-width:680px;margin:0 auto;padding:32px 20px 60px}
      .cf-h{text-align:center;padding:20px 0 28px;border-bottom:2px solid #e2e8f0;margin-bottom:24px}
      .cf-h .brand{font-size:14px;font-weight:700;color:#1a6fc4;letter-spacing:.05em;margin-bottom:4px}
      .cf-h h1{font-size:22px;font-weight:800;color:#1a1a2e;line-height:1.4}
      .cf-h .desc{font-size:13px;color:#6b7c93;margin-top:8px}
      .q{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.04);margin-bottom:14px;border:1px solid #e2e8f0}
      .q-num{display:inline-block;background:#1a6fc4;color:#fff;width:24px;height:24px;border-radius:50%;text-align:center;font-size:13px;font-weight:800;line-height:24px;margin-right:8px}
      .q-title{font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:6px}
      .q-hint{font-size:12px;color:#6b7c93;margin-bottom:10px;line-height:1.5}
      .q-hint b{color:#1a6fc4}
      .fi{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff}
      .fi:focus{border-color:#1a6fc4}
      .ta{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;resize:vertical;min-height:100px}
      .ta:focus{border-color:#1a6fc4}
      .btn-submit{display:block;width:100%;padding:16px;background:#1a6fc4;color:#fff;font-size:16px;font-weight:800;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:20px;box-shadow:0 4px 14px rgba(26,111,196,0.25)}
      .btn-submit:hover{background:#0d3d7a}.btn-submit:disabled{background:#94a3b8;cursor:not-allowed}
      .notice{padding:32px;text-align:center;background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,0.05);font-size:15px;color:#475569;line-height:1.7}
      .notice.ok{color:#166534;background:#f0fdf4;border:1px solid #bbf7d0}
      .notice.err{color:#dc2626;background:#fef2f2;border:1px solid #fecaca}
      .edit-btn{display:block;margin:14px auto 0;padding:10px 24px;background:none;border:1px solid #1a6fc4;color:#1a6fc4;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600}
    `}</style>
    <div className="cf-w">
      <button onClick={() => router.back()} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',marginBottom:16,fontSize:13}}>← 마이페이지로</button>
      <div className="cf-h">
        <div className="brand">DREAM ACADEMY · DREAM HOUSE</div>
        <h1>드림하우스 체크인 사전 정보</h1>
        <div className="desc">아래 6가지 정보를 입력해 주세요. 입실 준비에 활용됩니다.</div>
      </div>

      {loading && <div className="notice">로딩 중...</div>}
      {!loading && error && <div className="notice err">{error}</div>}
      {!loading && done && <div className="notice ok">제출 완료! 감사합니다 🙏<br/>곧 세부에서 만나요 ^^</div>}
      {!loading && !error && alreadySubmitted && !done && (
        <div>
          <div className="notice ok">✅ 이미 제출하셨습니다. 아래에서 내용을 수정할 수 있습니다.</div>
        </div>
      )}

      {!loading && !error && !done && (
        <>
          {alreadySubmitted && <div style={{height:12}}/>}

          {/* ── 탭 ── */}
          <div style={{display:"flex",gap:6,marginBottom:14,background:"#fff",borderRadius:12,padding:5,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
            <button onClick={()=>setTab("flight")} style={{flex:1,padding:"10px 8px",border:"none",borderRadius:8,fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit",background:tab==="flight"?"#1a6fc4":"transparent",color:tab==="flight"?"#fff":"#6b7c93",lineHeight:1.4}}>✈️ 항공권등록<br/><span style={{fontSize:10,fontWeight:600,opacity:0.85}}>(입실 픽드랍)</span></button>
            <button onClick={()=>setTab("checkin")} style={{flex:1,padding:"10px 8px",border:"none",borderRadius:8,fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit",background:tab==="checkin"?"#1a6fc4":"transparent",color:tab==="checkin"?"#fff":"#6b7c93",lineHeight:1.4}}>🏨 체크인디테일</button>
            <button onClick={()=>setTab("extra")} style={{flex:1,padding:"10px 8px",border:"none",borderRadius:8,fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit",background:tab==="extra"?"#1a6fc4":"transparent",color:tab==="extra"?"#fff":"#6b7c93",lineHeight:1.4}}>🚐 추가픽드랍<br/><span style={{fontSize:10,fontWeight:600,opacity:0.85}}>신청</span></button>
          </div>

          {tab === "checkin" && (<>
          {/* 예약자 성함·입실일자는 예약현황에 이미 있어 입력 제거 (제출 시 자동 포함) */}
          <div className="q">
            <div className="q-title"><span className="q-num">1</span>투숙자 전체인원 영문이름</div>
            <div className="q-hint">예: <b>kim ooo / yoo ooo ooo</b> (가족 전원의 영문이름)</div>
            <p style={{fontSize:12,color:"#888",marginBottom:6}}>※ 이전에 작성하신 경우 다시 작성하지 않아도 됩니다.</p>
            <input className="fi" value={form.q2} onChange={e=>up('q2',e.target.value)} placeholder="kim ooo / yoo ooo ooo"/>
          </div>

          {/* ① 베드 세팅 */}
          <div className="q">
            <div className="q-title"><span className="q-num">2</span>원하시는 베드 세팅</div>
            <div className="q-hint">보통 <b>2~3인: 마스터룸 베드2개</b> / <b>4인 이상: 마스터룸 베드2개 + 작은방 베드1개</b></div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{border:"1px solid #e0e4ef",borderRadius:10,padding:"12px 16px"}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:10,color:"#334"}}>룸 1 — 마스터룸 (큰방)</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["더블베드 1개 (2인 스테이)","더블베드 2개 (3~4인 스테이)"].map(opt=>(
                    <button key={opt} type="button"
                      onClick={()=>setBedConfig(p=>({...p,room1:opt}))}
                      style={{padding:"8px 16px",borderRadius:20,border:"2px solid",fontSize:13,cursor:"pointer",
                        borderColor:bedConfig.room1===opt?"#4f6ef7":"#dde3f0",
                        background:bedConfig.room1===opt?"#4f6ef7":"#fff",
                        color:bedConfig.room1===opt?"#fff":"#556"}}>{opt}</button>
                  ))}
                </div>
              </div>
              <div style={{border:"1px solid #e0e4ef",borderRadius:10,padding:"12px 16px"}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:10,color:"#334"}}>룸 2 — 2층방 (작은방)</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["더블베드 1개 (2인 스테이)","더블베드+싱글 (3인 스테이)","사용하지 않음"].map(opt=>(
                    <button key={opt} type="button"
                      onClick={()=>setBedConfig(p=>({...p,room2:opt}))}
                      style={{padding:"8px 16px",borderRadius:20,border:"2px solid",fontSize:13,cursor:"pointer",
                        borderColor:bedConfig.room2===opt?"#4f6ef7":"#dde3f0",
                        background:bedConfig.room2===opt?"#4f6ef7":"#fff",
                        color:bedConfig.room2===opt?"#fff":"#556"}}>{opt}</button>
                  ))}
                </div>
              </div>
              <div style={{border:"1px solid #e0e4ef",borderRadius:10,padding:"12px 16px"}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:10,color:"#334"}}>룸 3 — 1층방</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["더블베드 1개 (1~2인 스테이)","사용하지 않음"].map(opt=>(
                    <button key={opt} type="button"
                      onClick={()=>setBedConfig(p=>({...p,room3:opt}))}
                      style={{padding:"8px 16px",borderRadius:20,border:"2px solid",fontSize:13,cursor:"pointer",
                        borderColor:bedConfig.room3===opt?"#4f6ef7":"#dde3f0",
                        background:bedConfig.room3===opt?"#4f6ef7":"#fff",
                        color:bedConfig.room3===opt?"#fff":"#556"}}>{opt}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ② 유심 대여 */}
          <div className="q">
            <div className="q-title"><span className="q-num">3</span>유심 대여 신청</div>
            <div className="q-hint">필요하신 유심 수량과 요금제를 선택해 주세요. (필요 없으시면 비워두세요)</div>
            <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"9px 12px",fontSize:12.5,color:"#1d4ed8",fontWeight:600,marginBottom:8}}>
              ✅ 유심 대여 서비스에 신청해 주시면 요금제가 세팅된 상태로 드리고 있습니다.
            </div>
            <div style={{background:'#f8f9fa',border:'1px solid #e2e8f0',borderRadius:8,padding:16,marginBottom:12,fontSize:12.5,lineHeight:1.7,color:'#374151'}}>
              <div style={{fontWeight:800,fontSize:14,marginBottom:8,color:'#1a1a2e'}}>📱 유심 대여 서비스</div>
              <div style={{fontWeight:700,color:'#1a6fc4',marginTop:6,marginBottom:4}}>#기본 안내</div>
              <ul style={{paddingLeft:18,margin:0}}>
                <li>제공 요금제 → <b>Smart 올데이터+ 요금제</b></li>
                <li>통신사 관계 없이 <b>무제한 통화</b></li>
                <li>이용 가능 요금제 기간: <b>3일 / 7일 / 30일</b></li>
              </ul>
              <div style={{fontWeight:700,marginTop:10,marginBottom:4,color:'#1a1a2e'}}>요금</div>
              <ul style={{paddingLeft:18,margin:0}}>
                <li>2GB / 3일 → <b>₱75</b></li>
                <li>6GB / 7일 → <b>₱149</b></li>
                <li>24GB / 30일 → <b>₱499</b></li>
                <li>36GB / 30일 → <b>₱599</b></li>
                <li>48GB / 30일 → <b>₱699</b></li>
              </ul>
              <div style={{marginTop:10,padding:'8px 10px',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:6,fontSize:12,color:'#92400e',fontWeight:600}}>
                ⚠️ 유심 반납 안내: 퇴실 시 반드시 반납해 주세요.
              </div>
            </div>
            <div style={{marginTop:12}}>
              <div style={{background:"#fff8e1",borderRadius:8,padding:"8px 14px",fontSize:13,color:"#856404",marginBottom:10}}>
                💡 유심 비용은 보증금에서 차감됩니다. 퇴실 시 반드시 반납해 주세요.
              </div>
              {simCards.map((sim,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:13,color:"#667",minWidth:52,fontWeight:600}}>유심 {i+1}</span>
                  <select value={sim.plan}
                    onChange={e=>setSimCards(prev=>{const n=[...prev];n[i]={plan:e.target.value};return n;})}
                    style={{flex:1,padding:"8px 12px",borderRadius:8,border:"1.5px solid #dde3f0",fontSize:14}}>
                    <option value="">— 요금제 선택 —</option>
                    {SIM_PLANS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                  <button type="button"
                    onClick={()=>setSimCards(prev=>prev.filter((_,j)=>j!==i))}
                    style={{padding:"6px 12px",borderRadius:8,border:"1px solid #fcc",background:"#fff5f5",color:"#e53",fontSize:13,cursor:"pointer"}}>
                    삭제
                  </button>
                </div>
              ))}
              {simCards.length<6 && (
                <button type="button"
                  onClick={()=>setSimCards(prev=>[...prev,{plan:""}])}
                  style={{width:"100%",padding:"10px",borderRadius:8,border:"2px dashed #4f6ef7",background:"#f5f7ff",color:"#4f6ef7",fontSize:14,cursor:"pointer",marginTop:4}}>
                  + 유심 추가 (최대 6개)
                </button>
              )}
            </div>
          </div>

          </>)}

          {tab === "flight" && (<>
          <div className="q">
            <div className="q-title">✈️ 항공편 등록</div>
            <div className="q-hint">입국·출국 항공편 정보를 입력해 주세요. 미정인 경우 체크박스를 선택해 주세요.</div>
            <div style={{marginBottom:12}}>
              <input ref={flightFileRef} type="file" accept="image/*" onChange={handleFlightOcr} style={{display:"none"}}/>
              <button type="button" onClick={()=>flightFileRef.current?.click()} disabled={flightOcrLoading}
                style={{display:"inline-flex",alignItems:"center",gap:6,padding:"10px 14px",background:"#4f6ef7",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:flightOcrLoading?"wait":"pointer",opacity:flightOcrLoading?0.7:1}}>
                {flightOcrLoading?"⏳ 분석 중...":"📷 항공권 사진으로 자동입력"}
              </button>
              {flightOcrMsg && <div style={{marginTop:6,fontSize:12,color:flightOcrMsg.startsWith("✅")?"#16a34a":"#dc2626"}}>{flightOcrMsg}</div>}
            </div>
            {([
              ['in','🛬 입국편','출발지','인천','flight_in'] as const,
              ['out','🛫 출국편','도착지','인천','flight_out'] as const,
            ]).map(([key,label,placeLabel,placeholder,prefix]) => {
              const und = (flightForm as any)[prefix+'_undecided'] as boolean;
              const get = (suffix:string) => (flightForm as any)[prefix+'_'+suffix] as string;
              const set = (suffix:string, v:string|boolean) => setFlightForm(p=>({...p,[prefix+'_'+suffix]:v}));
              return (
                <div key={key} style={{border:"1px solid #e0e4ef",borderRadius:10,padding:14,marginBottom:10,background:"#fafafe"}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:"#334"}}>{label}</div>
                  <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,marginBottom:10}}>
                    <input type="checkbox" checked={und} onChange={e=>set('undecided',e.target.checked)}/>
                    미정(추후 입력)
                  </label>
                  <fieldset disabled={und} style={{border:"none",padding:0,margin:0,opacity:und?0.4:1}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div>
                        <div style={{fontSize:11,color:"#889",marginBottom:3}}>항공사</div>
                        <input type="text" value={get('airline')} onChange={e=>set('airline',e.target.value)} placeholder="예: 대한항공"
                          style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                      </div>
                      <div>
                        <div style={{fontSize:11,color:"#889",marginBottom:3}}>편명</div>
                        <input type="text" value={get('no')} onChange={e=>set('no',e.target.value)} placeholder={key==='in'?'예: KE601':'예: KE602'}
                          style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                      </div>
                      <div>
                        <div style={{fontSize:11,color:"#889",marginBottom:3}}>날짜</div>
                        <input type="date" value={get('date')} onChange={e=>set('date',e.target.value)}
                          style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                      </div>
                      <div>
                        <div style={{fontSize:11,color:"#889",marginBottom:3}}>시간</div>
                        <input type="time" value={get('time')} onChange={e=>set('time',e.target.value)}
                          style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                      </div>
                      <div style={{gridColumn:"1/3"}}>
                        <div style={{fontSize:11,color:"#889",marginBottom:3}}>{placeLabel}</div>
                        <input type="text" value={get(key==='in'?'origin':'destination')} onChange={e=>set(key==='in'?'origin':'destination',e.target.value)} placeholder={placeholder}
                          style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                      </div>
                    </div>
                  </fieldset>
                </div>
              );
            })}
          </div>

          {/* 입국 픽업 / 출국 드랍 — pickup_requests */}
          <div className="q">
            <div className="q-title">🛬 공항 외 픽업 신청</div>
            <div className="q-hint">공항 외 별도 일정으로 픽업이 필요한 경우 신청해주세요.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>날짜</div><input type="date" value={arrPickup.request_date} onChange={e=>setArrPickup(p=>({...p,request_date:e.target.value}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
              <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>시간</div><input type="time" value={arrPickup.request_time||""} onChange={e=>setArrPickup(p=>({...p,request_time:e.target.value}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
              <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>출발지(픽업장소)</div><input type="text" value={arrPickup.location||""} onChange={e=>setArrPickup(p=>({...p,location:e.target.value}))} placeholder="막탄공항 도착 게이트" style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
              <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>도착지</div><input type="text" value={arrPickup.destination||""} onChange={e=>setArrPickup(p=>({...p,destination:e.target.value}))} placeholder="드림하우스" style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
              <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>인원수</div><input type="number" min={1} value={arrPickup.num_people||1} onChange={e=>setArrPickup(p=>({...p,num_people:Number(e.target.value)||1}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
              <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>항공편 정보</div><input type="text" value={arrPickup.flight_info||""} onChange={e=>setArrPickup(p=>({...p,flight_info:e.target.value}))} placeholder="예: KE601" style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
              <div style={{gridColumn:"1/3"}}><div style={{fontSize:11,color:"#889",marginBottom:3}}>요청사항</div><input type="text" value={arrPickup.notes||""} onChange={e=>setArrPickup(p=>({...p,notes:e.target.value}))} placeholder="추가 안내사항 (선택)" style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
            </div>
            <button type="button" onClick={()=>savePickup("arrival")} disabled={savingArr||!bookingId} style={{marginTop:10,padding:"9px 18px",background:"#1a6fc4",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:(savingArr||!bookingId)?"not-allowed":"pointer",fontFamily:"inherit",opacity:(savingArr||!bookingId)?0.6:1}}>💾 {savingArr?"저장중...":"입국 픽업 저장"}</button>
          </div>

          <div className="q">
            <div className="q-title">🛫 출국 드랍 신청</div>
            <div className="q-hint">숙소에서 공항까지 드랍 일정을 신청해주세요.</div>
            <div style={{padding:"12px 14px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,fontSize:12.5,color:"#1e40af",lineHeight:1.7,marginBottom:12}}>
              <div style={{fontWeight:700,marginBottom:4}}>🕐 숙소 출발 시간을 선택해주세요.</div>
              공항까지 약 20~30분 소요됩니다.<br/>
              국제선은 통상 출발 2시간 전 공항 도착을 권장합니다.<br/>
              예) 항공편 출발 09:00 → 공항 도착 07:00 → 숙소 출발 06:30~06:40
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div>
                <div style={{fontSize:11,color:"#889",marginBottom:3}}>날짜</div>
                <input type="date" value={depPickup.request_date} onChange={e=>setDepPickup(p=>({...p,request_date:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13,fontFamily:"inherit"}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:"#889",marginBottom:3}}>숙소 출발 희망 시간</div>
                <input type="time" value={depPickup.request_time||""} onChange={e=>setDepPickup(p=>({...p,request_time:e.target.value}))} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13,fontFamily:"inherit"}}/>
              </div>
              <div>
                <div style={{fontSize:11,color:"#889",marginBottom:3}}>인원수</div>
                <input type="number" min={1} value={depPickup.num_people||1} onChange={e=>setDepPickup(p=>({...p,num_people:Number(e.target.value)||1}))} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13,fontFamily:"inherit"}}/>
              </div>
              <div style={{gridColumn:"1/3"}}>
                <div style={{fontSize:11,color:"#889",marginBottom:3}}>요청사항</div>
                <input type="text" value={depPickup.notes||""} onChange={e=>setDepPickup(p=>({...p,notes:e.target.value}))} placeholder="추가 안내사항 (선택)" style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13,fontFamily:"inherit"}}/>
              </div>
            </div>
            <button
              type="button"
              onClick={()=>{
                // 날짜는 사용자 입력 우선, 비어있으면 항공편 OUT 날짜 자동 채움
                const outDate = depPickup.request_date || flightForm.flight_out_date;
                if (!outDate) { toastErr("드랍 날짜를 입력해주세요."); return; }
                setDepPickup(p=>({...p,request_date:outDate,location:p.location||"드림하우스",destination:p.destination||"막탄공항"}));
                // 다음 마이크로태스크에서 save 호출 (state 반영 후)
                setTimeout(()=>savePickup("departure"), 0);
              }}
              disabled={savingDep||!bookingId||!depPickup.request_time}
              style={{marginTop:10,padding:"9px 18px",background:"#1a6fc4",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:(savingDep||!bookingId||!depPickup.request_time)?"not-allowed":"pointer",fontFamily:"inherit",opacity:(savingDep||!bookingId||!depPickup.request_time)?0.6:1}}
            >💾 {savingDep?"저장중...":"출국 드랍 저장"}</button>
          </div>
          </>)}

          {tab === "extra" && (<>
          {/* ── 추가 픽업 신청 (extra_pickup) ── */}
          <div className="q">
            <div className="q-title">🛬 추가 픽업 신청</div>
            <div style={{padding:"12px 14px",background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,fontSize:13,color:"#92400e",lineHeight:1.8,marginBottom:12}}>
              <div style={{fontWeight:700,color:"#b45309"}}>💰 추가 픽업 요금: <span style={{color:"#dc2626"}}>₱1,000/회</span></div>
              <div>📍 공항 픽업 또는 막탄 내 픽업만 가능합니다. 막탄 외 지역은 신청이 어렵습니다.</div>
              <div style={{color:"#b91c1c",fontWeight:600}}>⚠️ 패키지에 포함된 기본 드랍을 추가 픽업으로 변경하는 것은 불가합니다.</div>
            </div>

            {pickups.filter(p=>p.request_type==="extra_pickup").length > 0 && (
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
                {pickups.filter(p=>p.request_type==="extra_pickup").map((p,i)=>{
                  const meta = p.status==="confirmed"?{label:"확정",bg:"#dcfce7",color:"#15803d"}:p.status==="cancelled"?{label:"취소",bg:"#fef2f2",color:"#dc2626"}:{label:"대기",bg:"#fef3c7",color:"#92400e"};
                  return (
                    <div key={p.id||i} style={{border:"1px solid #e2e8f0",borderRadius:9,padding:12,background:"#fafafe"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <span style={{fontWeight:700,fontSize:13,color:"#1a1a2e"}}>{p.request_date} {p.request_time||""}</span>
                        <span style={{display:"inline-block",padding:"3px 10px",borderRadius:6,fontSize:11,fontWeight:700,background:meta.bg,color:meta.color}}>{meta.label}</span>
                      </div>
                      <div style={{fontSize:12.5,color:"#475569",lineHeight:1.7}}>
                        <div>📍 {p.location||"-"} → {p.destination||"-"}</div>
                        <div>👥 {p.num_people||1}명{p.flight_info?` · ✈ ${p.flight_info}`:""}</div>
                        {p.notes && <div style={{color:"#6b7280",marginTop:2}}>📝 {p.notes}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!showExtraPickupForm && (
              <button type="button" onClick={()=>setShowExtraPickupForm(true)} style={{width:"100%",padding:"10px",borderRadius:8,border:"2px dashed #4f6ef7",background:"#f5f7ff",color:"#4f6ef7",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ 추가픽업 신청</button>
            )}
            {showExtraPickupForm && (
              <div style={{border:"1px solid #cbd5e1",borderRadius:9,padding:12,background:"#fff"}}>
                <div style={{marginBottom:10}}>
                  <input ref={epOcrRef} type="file" accept="image/*" onChange={handleExtraPickupOcr} style={{display:"none"}}/>
                  <button type="button" onClick={()=>epOcrRef.current?.click()} disabled={epOcrLoading}
                    style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 12px",background:"#4f6ef7",color:"#fff",border:"none",borderRadius:7,fontSize:12.5,fontWeight:600,cursor:epOcrLoading?"wait":"pointer",opacity:epOcrLoading?0.7:1}}>
                    {epOcrLoading?"⏳ 분석 중...":"📷 항공권 사진으로 자동입력 (선택)"}
                  </button>
                  {epOcrMsg && <div style={{marginTop:6,fontSize:12,color:epOcrMsg.startsWith("✅")?"#16a34a":"#dc2626"}}>{epOcrMsg}</div>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>날짜</div><input type="date" value={extraPickupForm.request_date} onChange={e=>setExtraPickupForm(p=>({...p,request_date:e.target.value}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                  <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>시간</div><input type="time" value={extraPickupForm.request_time||""} onChange={e=>setExtraPickupForm(p=>({...p,request_time:e.target.value}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                  <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>출발지</div><input type="text" value={extraPickupForm.location||""} onChange={e=>setExtraPickupForm(p=>({...p,location:e.target.value}))} placeholder="예: 막탄공항" style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                  <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>목적지(숙소)</div><input type="text" value={extraPickupForm.destination||""} onChange={e=>setExtraPickupForm(p=>({...p,destination:e.target.value}))} placeholder="드림하우스" style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                  <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>인원수</div><input type="number" min={1} value={extraPickupForm.num_people||1} onChange={e=>setExtraPickupForm(p=>({...p,num_people:Number(e.target.value)||1}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                  <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>항공편 정보</div><input type="text" value={extraPickupForm.flight_info||""} onChange={e=>setExtraPickupForm(p=>({...p,flight_info:e.target.value}))} placeholder="예: KE601 (선택)" style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                  <div style={{gridColumn:"1/3"}}><div style={{fontSize:11,color:"#889",marginBottom:3}}>메모</div><textarea value={extraPickupForm.notes||""} onChange={e=>setExtraPickupForm(p=>({...p,notes:e.target.value}))} placeholder="요청사항 (선택)" style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13,minHeight:60,fontFamily:"inherit",resize:"vertical"}}/></div>
                </div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
                  <button type="button" onClick={()=>setShowExtraPickupForm(false)} style={{padding:"8px 16px",background:"#fff",color:"#475569",border:"1px solid #cbd5e1",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
                  <button type="button" onClick={()=>savePickup("extra_pickup")} disabled={savingExtraPickup||!bookingId} style={{padding:"8px 18px",background:"#1a6fc4",color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:(savingExtraPickup||!bookingId)?"not-allowed":"pointer",fontFamily:"inherit",opacity:(savingExtraPickup||!bookingId)?0.6:1}}>{savingExtraPickup?"저장중...":"💾 신청"}</button>
                </div>
              </div>
            )}
          </div>

          {/* ── 추가 드랍 신청 (extra_drop) ── */}
          <div className="q">
            <div className="q-title">🚐 추가 드랍 신청</div>
            <div style={{padding:"12px 14px",background:"#fefce8",border:"1px solid #fde68a",borderRadius:8,fontSize:13,color:"#92400e",lineHeight:1.8,marginBottom:12}}>
              <div style={{fontWeight:700,color:"#b45309"}}>💰 추가 드랍 요금: <span style={{color:"#dc2626"}}>₱800/회</span></div>
              <div>🏠 숙소에서 출발하는 드랍만 신청 가능합니다.</div>
            </div>

            {pickups.filter(p=>p.request_type==="extra_drop").length > 0 && (
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
                {pickups.filter(p=>p.request_type==="extra_drop").map((p,i)=>{
                  const meta = p.status==="confirmed"?{label:"확정",bg:"#dcfce7",color:"#15803d"}:p.status==="cancelled"?{label:"취소",bg:"#fef2f2",color:"#dc2626"}:{label:"대기",bg:"#fef3c7",color:"#92400e"};
                  return (
                    <div key={p.id||i} style={{border:"1px solid #e2e8f0",borderRadius:9,padding:12,background:"#fafafe"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <span style={{fontWeight:700,fontSize:13,color:"#1a1a2e"}}>{p.request_date} {p.request_time||""}</span>
                        <span style={{display:"inline-block",padding:"3px 10px",borderRadius:6,fontSize:11,fontWeight:700,background:meta.bg,color:meta.color}}>{meta.label}</span>
                      </div>
                      <div style={{fontSize:12.5,color:"#475569",lineHeight:1.7}}>
                        <div>📍 {p.location||"-"} → {p.destination||"-"}</div>
                        <div>👥 {p.num_people||1}명</div>
                        {p.notes && <div style={{color:"#6b7280",marginTop:2}}>📝 {p.notes}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!showExtraDropForm && (
              <button type="button" onClick={()=>setShowExtraDropForm(true)} style={{width:"100%",padding:"10px",borderRadius:8,border:"2px dashed #4f6ef7",background:"#f5f7ff",color:"#4f6ef7",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ 추가드랍 신청</button>
            )}
            {showExtraDropForm && (
              <div style={{border:"1px solid #cbd5e1",borderRadius:9,padding:12,background:"#fff"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>날짜</div><input type="date" value={extraDropForm.request_date} onChange={e=>setExtraDropForm(p=>({...p,request_date:e.target.value}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                  <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>숙소 출발 시간</div><input type="time" value={extraDropForm.request_time||""} onChange={e=>setExtraDropForm(p=>({...p,request_time:e.target.value}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                  <div style={{gridColumn:"1/3"}}><div style={{fontSize:11,color:"#889",marginBottom:3}}>목적지</div><input type="text" value={extraDropForm.destination||""} onChange={e=>setExtraDropForm(p=>({...p,destination:e.target.value}))} placeholder="예: SM 시티" style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                  <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>인원수</div><input type="number" min={1} value={extraDropForm.num_people||1} onChange={e=>setExtraDropForm(p=>({...p,num_people:Number(e.target.value)||1}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                  <div style={{gridColumn:"1/3"}}><div style={{fontSize:11,color:"#889",marginBottom:3}}>메모</div><textarea value={extraDropForm.notes||""} onChange={e=>setExtraDropForm(p=>({...p,notes:e.target.value}))} placeholder="요청사항 (선택)" style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13,minHeight:60,fontFamily:"inherit",resize:"vertical"}}/></div>
                </div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
                  <button type="button" onClick={()=>setShowExtraDropForm(false)} style={{padding:"8px 16px",background:"#fff",color:"#475569",border:"1px solid #cbd5e1",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
                  <button type="button" onClick={()=>savePickup("extra_drop")} disabled={savingExtraDrop||!bookingId} style={{padding:"8px 18px",background:"#1a6fc4",color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:(savingExtraDrop||!bookingId)?"not-allowed":"pointer",fontFamily:"inherit",opacity:(savingExtraDrop||!bookingId)?0.6:1}}>{savingExtraDrop?"저장중...":"💾 신청"}</button>
                </div>
              </div>
            )}
          </div>

          <div style={{padding:"10px 14px",background:"#fef3c7",border:"1px solid #fde68a",borderRadius:8,fontSize:12,color:"#92400e",fontWeight:600,textAlign:"center"}}>
            ℹ️ 취소는 스탭에게 문의해주세요.
          </div>
          </>)}

          {tab === "checkin" && (<>
          <div className="q">
            <div className="q-title"><span className="q-num">4</span>기타 요청사항</div>
            <div className="q-hint">추가 픽드랍, 알러지 등 자유롭게 작성해 주세요. (선택)</div>
            <textarea className="ta" value={form.q6} onChange={e=>up('q6',e.target.value)} placeholder="자유롭게 작성"/>
          </div>
          </>)}

          <button className="btn-submit" onClick={submit} disabled={submitting}>
            {submitting ? '제출 중...' : alreadySubmitted ? '수정 내용 저장하기' : '체크인 정보 제출하기'}
          </button>
        </>
      )}
    </div>
  </>);
}
