"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface FormState {
  q1: string; // 예약자 성함 + 입실 일자
  q2: string; // 투숙자 영문이름
  q6: string; // 기타
}

// 항공편 합산 텍스트에서 날짜/시간 추출 ("대한항공 Ke601 2026-06-26 20:05" → date, time)
function parseFlightText(text: string) {
  const dateM = text.match(/(\d{4}-\d{2}-\d{2})/);
  const timeM = text.match(/(\d{1,2}:\d{2})/);
  return { date: dateM?.[1] || "", time: timeM?.[1] || "" };
}

const SIM_PLANS = ["2GB / 3일 / ₱75","6GB / 7일 / ₱149","24GB / 30일 / ₱499","36GB / 30일 / ₱599","48GB / 30일 / ₱699"];

export default function CheckinFormPage() {
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({ q1: "", q2: "", q6: "" });
  const [bedConfig, setBedConfig] = useState({room1:"",room2:"",room3:""});
  const [simCards, setSimCards] = useState<{plan:string}[]>([]);
  const [extraPickups, setExtraPickups] = useState<{type:string;date:string;airline:string;flight:string;time:string}[]>([]);
  const [flightForm, setFlightForm] = useState({
    flight_in_airline:"", flight_in_no:"", flight_in_date:"", flight_in_time:"", flight_in_origin:"", flight_in_undecided:false,
    flight_out_airline:"", flight_out_no:"", flight_out_date:"", flight_out_time:"", flight_out_destination:"", flight_out_undecided:false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const flightFileRef = useRef<HTMLInputElement>(null);
  const [flightOcrLoading, setFlightOcrLoading] = useState(false);
  const [flightOcrMsg, setFlightOcrMsg] = useState("");

  // 탭 + 픽드랍 신청 상태
  const [tab, setTab] = useState<"flight" | "checkin" | "extra">("checkin");
  const [bookingId, setBookingId] = useState<string>("");
  type PR = { id?: string; request_type: "arrival" | "departure" | "extra"; request_date: string; request_time: string | null; location: string | null; destination: string | null; num_people: number | null; flight_info: string | null; notes: string | null; status: string };
  const [pickups, setPickups] = useState<PR[]>([]);
  // arrival/departure 폼
  const [arrPickup, setArrPickup] = useState<PR>({ request_type: "arrival", request_date: "", request_time: "", location: "", destination: "", num_people: 1, flight_info: "", notes: "", status: "pending" });
  const [depPickup, setDepPickup] = useState<PR>({ request_type: "departure", request_date: "", request_time: "", location: "", destination: "", num_people: 1, flight_info: "", notes: "", status: "pending" });
  const [savingArr, setSavingArr] = useState(false);
  const [savingDep, setSavingDep] = useState(false);
  // 추가 픽드랍 신청 폼
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [extraForm, setExtraForm] = useState<PR>({ request_type: "extra", request_date: "", request_time: "", location: "", destination: "", num_people: 1, flight_info: "", notes: "", status: "pending" });
  const [savingExtra, setSavingExtra] = useState(false);

  async function loadPickups(bid: string) {
    if (!bid) return;
    try {
      const res = await fetch(`/api/portal/pickup-request?booking_id=${encodeURIComponent(bid)}`);
      if (!res.ok) return;
      const j = await res.json();
      const list = (j.requests || []) as PR[];
      setPickups(list);
      // 기존 arrival/departure 행 있으면 폼에 시드
      const arr = list.find(p => p.request_type === "arrival");
      if (arr) setArrPickup({ ...arr });
      const dep = list.find(p => p.request_type === "departure");
      if (dep) setDepPickup({ ...dep });
    } catch {/* noop */}
  }

  async function savePickup(type: "arrival" | "departure" | "extra") {
    if (!bookingId) { alert("예약 정보를 불러오는 중입니다."); return; }
    const src = type === "arrival" ? arrPickup : type === "departure" ? depPickup : extraForm;
    if (!src.request_date) { alert("날짜를 입력해 주세요."); return; }
    const setSaving = type === "arrival" ? setSavingArr : type === "departure" ? setSavingDep : setSavingExtra;
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
      if (!res.ok) { alert("저장 실패: " + (j.error || "")); setSaving(false); return; }
      await loadPickups(bookingId);
      if (type === "extra") {
        setShowExtraForm(false);
        setExtraForm({ request_type: "extra", request_date: "", request_time: "", location: "", destination: "", num_people: 1, flight_info: "", notes: "", status: "pending" });
      }
      alert("✅ 신청이 저장되었습니다.");
    } finally { setSaving(false); }
  }

  // 서버 API로 항공권 이미지 업로드 (service_role 사용)
  async function uploadFlightImageViaApi(file: File) {
    if (!token || !file) return;
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("token", token);
      const res = await fetch("/api/upload-flight-image", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error("flight image upload failed:", j.error);
      } else {
        const j = await res.json();
        if (j.flight_images) setFlightImages(j.flight_images);
      }
    } catch (err) { console.error("flight image save:", err); }
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
      // 항공권 사진 서버 API로 저장
      await uploadFlightImageViaApi(file);
    } catch {
      setFlightOcrMsg("❌ 인식 실패. 직접 입력해주세요.");
    } finally {
      setFlightOcrLoading(false);
      if (e.target) e.target.value = "";
    }
  }

  // 별도 사진 업로드 (OCR 없이)
  const flightUploadRef = useRef<HTMLInputElement>(null);
  const [flightUploading, setFlightUploading] = useState(false);
  const [flightImages, setFlightImages] = useState<string[]>([]);
  async function handleFlightImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !files.length) return;
    setFlightUploading(true);
    for (let i = 0; i < files.length; i++) {
      await uploadFlightImageViaApi(files[i]);
    }
    setFlightUploading(false);
    if (e.target) e.target.value = "";
  }

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/checkin/${token}`);
        if (!res.ok) {
          if (res.status === 404) setError("유효하지 않은 링크입니다");
          else setError("로딩 실패");
          setLoading(false);
          return;
        }
        const d = await res.json();
        const det = d.detail;
        if (det.submitted_at) {
          setSubmitted(true);
          setLoading(false);
          return;
        }
        // pre-fill from existing fields
        setForm({
          q1: det.booker_name || "",
          q2: det.guest_names_en || "",
          q6: det.extra_requests || "",
        });
        try {
          const b = JSON.parse(det.bed_setting || "{}");
          if (b.room1 || b.room2 || b.room3) setBedConfig({room1:b.room1||"", room2:b.room2||"", room3:b.room3||""});
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
        if (det.booking_id) {
          setBookingId(det.booking_id);
          loadPickups(det.booking_id);
        }
        // 기존 항공권 이미지 로드
        if (d.booking?.flight_images && Array.isArray(d.booking.flight_images)) {
          setFlightImages(d.booking.flight_images);
        }
        // 항공편 정보 pre-fill (booking 기본 데이터에서)
        if (d.booking) {
          const bk = d.booking;
          // 합산 텍스트에서 날짜/시간 폴백 파싱 (flight_in = "대한항공 Ke601 2026-06-26 20:05")
          const inParsed = parseFlightText(bk.flight_in || "");
          const outParsed = parseFlightText(bk.flight_out || "");
          setFlightForm(prev => ({
            ...prev,
            flight_in_airline: prev.flight_in_airline || bk.flight_in_airline || "",
            flight_in_no: prev.flight_in_no || bk.flight_in_no || "",
            flight_in_date: prev.flight_in_date || (bk.flight_in_date || "").split("T")[0] || inParsed.date,
            flight_in_time: prev.flight_in_time || bk.flight_in_time || inParsed.time,
            flight_in_origin: prev.flight_in_origin || bk.flight_in_origin || "",
            flight_in_undecided: prev.flight_in_undecided || !!bk.flight_in_undecided,
            flight_out_airline: prev.flight_out_airline || bk.flight_out_airline || "",
            flight_out_no: prev.flight_out_no || bk.flight_out_no || "",
            flight_out_date: prev.flight_out_date || (bk.flight_out_date || "").split("T")[0] || outParsed.date,
            flight_out_time: prev.flight_out_time || bk.flight_out_time || outParsed.time,
            flight_out_destination: prev.flight_out_destination || bk.flight_out_destination || "",
            flight_out_undecided: prev.flight_out_undecided || !!bk.flight_out_undecided,
          }));
        }
        setLoading(false);
      } catch {
        setError("네트워크 오류");
        setLoading(false);
      }
    })();
  }, [token]);

  function up<K extends keyof FormState>(k: K, v: string) { setForm(prev => ({ ...prev, [k]: v })); }

  async function submit() {
    // 2번(투숙자 전체 영문이름)만 필수 — 나머지(예약자명·항공편·유심 등)는 비워도 제출됩니다.
    if (!form.q2.trim()) { setTab("checkin"); alert("2번 '투숙자 전체인원 영문이름'을 입력해 주세요.\n나머지 항목은 비워두셔도 제출됩니다."); return; }
    setSubmitting(true);
    const res = await fetch(`/api/checkin/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      const raw = j.error || "";
      const msg = raw.includes("date") ? "항공편 날짜 형식에 문제가 있어요. 항공편 날짜를 비우거나 올바른 날짜로 입력해 주세요."
        : raw.includes("time") ? "항공편 시간 형식에 문제가 있어요. 시간을 비우거나 올바르게 입력해 주세요."
        : (raw || "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      alert("제출 실패: " + msg); return;
    }
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f7f9fc;color:#1a1a2e;line-height:1.6}
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
.fi{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff}.fi:focus{border-color:#1a6fc4}
.ta{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;resize:vertical;min-height:100px}.ta:focus{border-color:#1a6fc4}
.btn-submit{display:block;width:100%;padding:16px;background:#1a6fc4;color:#fff;font-size:16px;font-weight:800;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:20px;box-shadow:0 4px 14px rgba(26,111,196,0.25)}
.btn-submit:hover{background:#0d3d7a}.btn-submit:disabled{background:#94a3b8;cursor:not-allowed;box-shadow:none}
.notice{padding:32px;text-align:center;background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,0.05);font-size:15px;color:#475569;line-height:1.7}
.notice.ok{color:#166534;background:#f0fdf4;border:1px solid #bbf7d0}
.notice.err{color:#dc2626;background:#fef2f2;border:1px solid #fecaca}
@media(max-width:600px){.cf-w{padding:20px 14px 40px}.q{padding:16px}.cf-h h1{font-size:18px}}
    `}</style>
    <div className="cf-w">
      <div className="cf-h">
        <div className="brand">DREAM ACADEMY · DREAM HOUSE</div>
        <h1>드림하우스 체크인 사전 정보 수집 폼</h1>
        <div className="desc">아래 7가지 정보를 입력해 주세요. 입실 준비에 활용됩니다.</div>
      </div>

      {loading && <div className="notice">로딩 중...</div>}
      {!loading && error && <div className="notice err">{error}</div>}
      {!loading && !error && submitted && (
        <div className="notice ok" style={{textAlign:"center"}}>
          <div style={{marginBottom:12}}>✅ 이미 작성된 설문입니다. 감사합니다! 🙏</div>
          <button
            onClick={()=>setSubmitted(false)}
            style={{padding:"10px 24px",background:"#fff",color:"#1a6fc4",border:"1px solid #bfdbfe",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
          >
            ✏️ 재작성하기
          </button>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:8}}>※ 재작성 후 다시 제출하시면 최신 내용으로 업데이트됩니다.</div>
        </div>
      )}
      {!loading && !error && done && (
        <div className="notice ok">설문에 참여해 주셔서 감사합니다 ^^<br/>곧 세부에서 만나요 ^^</div>
      )}

      {!loading && !error && !submitted && !done && (<>
        {/* ── 탭 ── */}
        <div style={{display:"flex",gap:6,marginBottom:14,background:"#fff",borderRadius:12,padding:5,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
          <button onClick={()=>setTab("flight")} style={{flex:1,padding:"10px 8px",border:"none",borderRadius:8,fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit",background:tab==="flight"?"#1a6fc4":"transparent",color:tab==="flight"?"#fff":"#6b7c93",lineHeight:1.4}}>✈️ 항공권등록<br/><span style={{fontSize:10,fontWeight:600,opacity:0.85}}>(입실 픽드랍)</span></button>
          <button onClick={()=>setTab("checkin")} style={{flex:1,padding:"10px 8px",border:"none",borderRadius:8,fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit",background:tab==="checkin"?"#1a6fc4":"transparent",color:tab==="checkin"?"#fff":"#6b7c93",lineHeight:1.4}}>🏨 체크인디테일</button>
          <button onClick={()=>setTab("extra")} style={{flex:1,padding:"10px 8px",border:"none",borderRadius:8,fontSize:12.5,fontWeight:800,cursor:"pointer",fontFamily:"inherit",background:tab==="extra"?"#1a6fc4":"transparent",color:tab==="extra"?"#fff":"#6b7c93",lineHeight:1.4}}>🚐 추가픽드랍<br/><span style={{fontSize:10,fontWeight:600,opacity:0.85}}>신청</span></button>
        </div>

        {tab === "checkin" && (<>
        <div className="q">
          <div className="q-title"><span className="q-num">1</span>예약자 대표 성함과 입실 일자</div>
          <div className="q-hint">예: <b>홍길동, 2026년 5월 9일</b></div>
          <input className="fi" value={form.q1} onChange={e=>up("q1",e.target.value)} placeholder="홍길동, 2026년 5월 9일"/>
        </div>

        <div className="q">
          <div className="q-title"><span className="q-num">2</span>투숙자 전체인원 영문이름</div>
          <div className="q-hint">예: <b>kim ooo / yoo ooo ooo</b> (가족 전원의 영문이름)</div>
          <p style={{fontSize:12,color:"#888",marginBottom:6}}>※ 이전에 작성하신 경우 다시 작성하지 않아도 됩니다.</p>
          <input className="fi" value={form.q2} onChange={e=>up("q2",e.target.value)} placeholder="kim ooo / yoo ooo ooo"/>
        </div>

        <div className="q">
          <div className="q-title"><span className="q-num">3</span>🛏️ 베드 세팅</div>
          <div style={{background:"#f0f7ff",border:"1px solid #bfdbfe",borderRadius:10,padding:"14px 16px",marginBottom:14,lineHeight:1.7}}>
            <div style={{fontSize:14,fontWeight:800,color:"#1e40af",marginBottom:6}}>베드 세팅 안내</div>
            <div style={{fontSize:13,color:"#334155"}}>
              방마다 매트리스를 요청하시는 대로 넣어드리고 있습니다.<br/>
              <b>투숙 인원에 맞게 각 방별로 선택</b>해 주세요.
            </div>
            <div style={{fontSize:12,color:"#64748b",marginTop:6}}>
              보통 2~3인: 마스터룸 베드 2개 / 4인 이상: 마스터룸 베드 2개 + 작은방 베드 1개
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{border:"1px solid #e0e4ef",borderRadius:10,padding:"12px 16px"}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:"#334"}}>룸 1 — 마스터룸 (큰방)</div>
              <div style={{fontSize:12,color:"#64748b",marginBottom:8}}>화장실 연결된 메인 침실</div>
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
                      color:bedConfig.room3===opt?"#fff":"#556"}}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="q">
          <div className="q-title"><span className="q-num">4</span>유심 대여 신청 (GB 수량)</div>
          <div className="q-hint">대여를 원하시면 인원 수와 GB 수량을 작성해 주세요. (필요 없으시면 비워두세요)</div>

          <div style={{background:"#f8f9fa",border:"1px solid #e2e8f0",borderRadius:8,padding:16,marginBottom:12,fontSize:12.5,lineHeight:1.7,color:"#374151"}}>
            <div style={{fontWeight:800,fontSize:14,marginBottom:8,color:"#1a1a2e"}}>📱 유심 대여 서비스</div>

            <div style={{fontWeight:700,color:"#1a6fc4",marginTop:6,marginBottom:4}}>#기본 안내</div>
            <ul style={{paddingLeft:18,margin:0}}>
              <li>제공 요금제 → <b>Smart 올데이터+ 요금제</b></li>
              <li>통신사 관계 없이 <b>무제한 통화</b> <span style={{color:"#6b7c93"}}>(※ 유선전화 제외)</span></li>
              <li>데이터 포함</li>
              <li>이용 가능 요금제 기간: <b>3일 / 7일 / 30일</b> → 요금제: 유료
                <div style={{paddingLeft:8,color:"#475569",marginTop:2}}>→ 원하시는 기간(GB)을 선택해 알려주시면 해당 요금제로 세팅된 유심을 제공해드립니다.</div>
              </li>
            </ul>

            <div style={{fontWeight:700,marginTop:10,marginBottom:4,color:"#1a1a2e"}}>요금 (30일 기준)</div>
            <ul style={{paddingLeft:18,margin:0}}>
              <li>24GB → <b>P499</b></li>
              <li>36GB → <b>P599</b></li>
              <li>48GB → <b>P699</b></li>
            </ul>

            <div style={{fontWeight:700,color:"#dc2626",marginTop:10,marginBottom:4}}>#유의사항</div>
            <ul style={{paddingLeft:18,margin:0,color:"#475569"}}>
              <li>통신사 <b>smart</b> 유심만 제공합니다</li>
              <li>제공되는 유심은 투숙객의 편의를 위한 무상 서비스입니다</li>
              <li>기타 요금제, 국제전화 사용 등에 대한 안내는 지원하지 않습니다</li>
              <li>통신불량 관련 문의는 <b>Smart 고객센터 또는 대리점</b>에 직접 문의해 주세요</li>
            </ul>

            <div style={{marginTop:10,padding:"8px 10px",background:"#fef3c7",border:"1px solid #fde68a",borderRadius:6,fontSize:12,color:"#92400e",fontWeight:600}}>
              ⚠️ 유심 반납 안내: 퇴실 시, 지급된 유심은 <b>반드시 반납</b>해 주세요.
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
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <input ref={flightFileRef} type="file" accept="image/*" onChange={handleFlightOcr} style={{display:"none"}}/>
              <button type="button" onClick={()=>flightFileRef.current?.click()} disabled={flightOcrLoading}
                style={{display:"inline-flex",alignItems:"center",gap:6,padding:"10px 14px",background:"#4f6ef7",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:flightOcrLoading?"wait":"pointer",opacity:flightOcrLoading?0.7:1}}>
                {flightOcrLoading?"⏳ 분석 중...":"📷 항공권 사진으로 자동입력"}
              </button>
              <input ref={flightUploadRef} type="file" accept="image/*" multiple onChange={handleFlightImageUpload} style={{display:"none"}}/>
              <button type="button" onClick={()=>flightUploadRef.current?.click()} disabled={flightUploading}
                style={{display:"inline-flex",alignItems:"center",gap:6,padding:"10px 14px",background:"#fff",color:"#4f6ef7",border:"1.5px solid #4f6ef7",borderRadius:8,fontSize:13,fontWeight:600,cursor:flightUploading?"wait":"pointer",opacity:flightUploading?0.7:1}}>
                {flightUploading?"업로드중...":"🖼 항공권 사진 업로드"}
              </button>
            </div>
            {flightOcrMsg && <div style={{marginTop:6,fontSize:12,color:flightOcrMsg.startsWith("✅")?"#16a34a":"#dc2626"}}>{flightOcrMsg}</div>}
          </div>
          {/* 업로드된 항공권 이미지 갤러리 */}
          {flightImages.length > 0 && (
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:600,color:"#64748b",marginBottom:6}}>📎 업로드된 항공권 사진 ({flightImages.length}장)</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {flightImages.map((img,i) => (
                  <a key={i} href={img} target="_blank" rel="noopener noreferrer" style={{border:"1px solid #e0e4ef",borderRadius:8,overflow:"hidden"}}>
                    <img src={img} alt="" style={{width:120,height:90,objectFit:"cover",display:"block"}}/>
                  </a>
                ))}
              </div>
            </div>
          )}
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

        {/* 입국 픽업 / 출국 드랍 — pickup_requests (arrival/departure) */}
        <div className="q">
          <div className="q-title">🛬 입국 픽업 신청</div>
          <div className="q-hint">기본 픽업 외 별도 일정으로 입국 픽업을 원하시면 작성해 주세요.</div>
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
          <div className="q-hint">출국 시 공항 드랍 일정을 신청해 주세요.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>날짜</div><input type="date" value={depPickup.request_date} onChange={e=>setDepPickup(p=>({...p,request_date:e.target.value}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
            <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>시간</div><input type="time" value={depPickup.request_time||""} onChange={e=>setDepPickup(p=>({...p,request_time:e.target.value}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
            <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>출발지</div><input type="text" value={depPickup.location||""} onChange={e=>setDepPickup(p=>({...p,location:e.target.value}))} placeholder="드림하우스" style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
            <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>도착지(공항)</div><input type="text" value={depPickup.destination||""} onChange={e=>setDepPickup(p=>({...p,destination:e.target.value}))} placeholder="막탄공항" style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
            <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>인원수</div><input type="number" min={1} value={depPickup.num_people||1} onChange={e=>setDepPickup(p=>({...p,num_people:Number(e.target.value)||1}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
            <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>항공편 정보</div><input type="text" value={depPickup.flight_info||""} onChange={e=>setDepPickup(p=>({...p,flight_info:e.target.value}))} placeholder="예: KE602" style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
            <div style={{gridColumn:"1/3"}}><div style={{fontSize:11,color:"#889",marginBottom:3}}>요청사항</div><input type="text" value={depPickup.notes||""} onChange={e=>setDepPickup(p=>({...p,notes:e.target.value}))} placeholder="추가 안내사항 (선택)" style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
          </div>
          <button type="button" onClick={()=>savePickup("departure")} disabled={savingDep||!bookingId} style={{marginTop:10,padding:"9px 18px",background:"#1a6fc4",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:(savingDep||!bookingId)?"not-allowed":"pointer",fontFamily:"inherit",opacity:(savingDep||!bookingId)?0.6:1}}>💾 {savingDep?"저장중...":"출국 드랍 저장"}</button>
        </div>
        </>)}

        {tab === "extra" && (<>
        {/* 추가 픽드랍 신청 — pickup_requests (extra) */}
        <div className="q">
          <div className="q-title">🚐 추가 픽드랍 신청 내역</div>
          <div className="q-hint">기본 입실 픽업 외 추가로 필요한 픽드랍 일정입니다.</div>
          {pickups.filter(p=>p.request_type==="extra").length === 0 ? (
            <div style={{padding:"16px 0",fontSize:13,color:"#94a3b8",textAlign:"center"}}>등록된 추가 픽드랍 신청이 없습니다.</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {pickups.filter(p=>p.request_type==="extra").map((p,i)=>{
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
          <div style={{marginTop:10,padding:"8px 12px",background:"#fef3c7",border:"1px solid #fde68a",borderRadius:8,fontSize:11.5,color:"#92400e",fontWeight:600}}>
            ℹ️ 취소는 스탭에게 문의해주세요.
          </div>
          {!showExtraForm && (
            <button type="button" onClick={()=>setShowExtraForm(true)} style={{marginTop:10,width:"100%",padding:"10px",borderRadius:8,border:"2px dashed #4f6ef7",background:"#f5f7ff",color:"#4f6ef7",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ 추가신청</button>
          )}
          {showExtraForm && (
            <div style={{marginTop:12,border:"1px solid #cbd5e1",borderRadius:9,padding:12,background:"#fff"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>날짜</div><input type="date" value={extraForm.request_date} onChange={e=>setExtraForm(p=>({...p,request_date:e.target.value}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>시간</div><input type="time" value={extraForm.request_time||""} onChange={e=>setExtraForm(p=>({...p,request_time:e.target.value}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>출발지</div><input type="text" value={extraForm.location||""} onChange={e=>setExtraForm(p=>({...p,location:e.target.value}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>목적지</div><input type="text" value={extraForm.destination||""} onChange={e=>setExtraForm(p=>({...p,destination:e.target.value}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                <div><div style={{fontSize:11,color:"#889",marginBottom:3}}>인원수</div><input type="number" min={1} value={extraForm.num_people||1} onChange={e=>setExtraForm(p=>({...p,num_people:Number(e.target.value)||1}))} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/></div>
                <div style={{gridColumn:"1/3"}}><div style={{fontSize:11,color:"#889",marginBottom:3}}>메모</div><textarea value={extraForm.notes||""} onChange={e=>setExtraForm(p=>({...p,notes:e.target.value}))} placeholder="요청사항 (선택)" style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13,minHeight:60,fontFamily:"inherit",resize:"vertical"}}/></div>
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
                <button type="button" onClick={()=>setShowExtraForm(false)} style={{padding:"8px 16px",background:"#fff",color:"#475569",border:"1px solid #cbd5e1",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
                <button type="button" onClick={()=>savePickup("extra")} disabled={savingExtra||!bookingId} style={{padding:"8px 18px",background:"#1a6fc4",color:"#fff",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:(savingExtra||!bookingId)?"not-allowed":"pointer",fontFamily:"inherit",opacity:(savingExtra||!bookingId)?0.6:1}}>{savingExtra?"저장중...":"💾 신청"}</button>
              </div>
            </div>
          )}
        </div>

        {/* 기존 JSON 기반 Q6 — 호환 유지 */}
        <div className="q">
          <div className="q-title"><span className="q-num">6</span>추가 픽드랍 신청</div>
          <div className="q-hint">기본 픽업/드랍 외 추가 필요 시 작성해 주세요. (선택)</div>
          <div>
            {extraPickups.map((ep,i)=>(
              <div key={i} style={{border:"1px solid #e0e4ef",borderRadius:10,padding:12,marginBottom:10,background:"#fafafe"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={{display:"flex",gap:6}}>
                    {["픽업","드랍"].map(t=>(
                      <button key={t} type="button"
                        onClick={()=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],type:t};return n;})}
                        style={{padding:"6px 14px",borderRadius:18,border:"2px solid",fontSize:13,cursor:"pointer",
                          borderColor:ep.type===t?"#4f6ef7":"#dde3f0",
                          background:ep.type===t?"#4f6ef7":"#fff",
                          color:ep.type===t?"#fff":"#556"}}>{t}</button>
                    ))}
                  </div>
                  <button type="button" onClick={()=>setExtraPickups(prev=>prev.filter((_,j)=>j!==i))}
                    style={{fontSize:12,color:"#e53",background:"none",border:"none",cursor:"pointer"}}>✕ 삭제</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div>
                    <div style={{fontSize:11,color:"#889",marginBottom:3}}>날짜</div>
                    <input type="date" value={ep.date}
                      onChange={e=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],date:e.target.value};return n;})}
                      style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:"#889",marginBottom:3}}>시간</div>
                    <input type="time" value={ep.time}
                      onChange={e=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],time:e.target.value};return n;})}
                      style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:"#889",marginBottom:3}}>항공사</div>
                    <input type="text" value={ep.airline} placeholder="예: 대한항공"
                      onChange={e=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],airline:e.target.value};return n;})}
                      style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                  </div>
                  <div>
                    <div style={{fontSize:11,color:"#889",marginBottom:3}}>편명</div>
                    <input type="text" value={ep.flight} placeholder="예: KE601"
                      onChange={e=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],flight:e.target.value};return n;})}
                      style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" onClick={()=>setExtraPickups(prev=>[...prev,{type:"픽업",date:"",airline:"",flight:"",time:""}])}
              style={{width:"100%",padding:"10px",borderRadius:8,border:"2px dashed #4f6ef7",background:"#f5f7ff",color:"#4f6ef7",fontSize:14,cursor:"pointer"}}>
              + 픽드랍 추가
            </button>
          </div>
        </div>
        </>)}

        {tab === "checkin" && (<>
        <div className="q">
          <div className="q-title"><span className="q-num">7</span>기타 요청사항</div>
          <div className="q-hint">가족 추가 픽업, 알러지 등 자유롭게 작성해 주세요. (선택)</div>
          <textarea className="ta" value={form.q6} onChange={e=>up("q6",e.target.value)} placeholder="자유롭게 작성"/>
        </div>
        </>)}

        <button className="btn-submit" onClick={submit} disabled={submitting}>
          {submitting ? "제출 중..." : "체크인 정보 제출하기"}
        </button>
      </>)}
    </div>
  </>);
}
