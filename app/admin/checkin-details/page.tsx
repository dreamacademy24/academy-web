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
  bed_setting: string;
  usim_request: string;
  after_trip_request: string;
  extra_requests: string;
  public_token: string;
  submitted_at?: string | null;
}

function fDate(d: string | null) {
  if (!d) return "-";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d as string;
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,"0")}.${String(dt.getDate()).padStart(2,"0")}`;
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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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
      if (d.detail) setDetail(d.detail);
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
        bed_setting: detail.bed_setting,
        usim_request: detail.usim_request,
        after_trip_request: detail.after_trip_request,
        extra_requests: detail.extra_requests,
      }),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(()=>({})); setMsg("저장 실패: " + (j.error || "")); return; }
    const d = await res.json();
    if (d.detail) setDetail(d.detail);
    setMsg("저장 완료!");
    setTimeout(() => setMsg(""), 2500);
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
      </div>

      <div className="sec">
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
      </div>

      {detail && booking && (<>
        <div className="sec">
          <h2>예약 정보</h2>
          <div className="row"><span className="lbl">예약자</span><span className="val">{booking.booker_name} {booking.booker_english ? `(${booking.booker_english})` : ""}</span></div>
          <div className="row"><span className="lbl">체크인 ~ 체크아웃</span><span className="val">{fDate(booking.checkin_date)} ~ {fDate(booking.checkout_date)}</span></div>
          <div className="row"><span className="lbl">숙소 / 룸</span><span className="val">{booking.accom_type || "-"} {booking.accom_room || booking.house_no || ""}</span></div>
          <div className="row"><span className="lbl">인원</span><span className="val">성인 {booking.adults || 0}명 + 아이 {booking.children || 0}명</span></div>
          <div className="row"><span className="lbl">픽업 / 드랍</span><span className="val">{booking.pickup_place || "-"} / {booking.drop_off || "-"}</span></div>
          <div className="row"><span className="lbl">항공편 (IN/OUT)</span><span className="val">{booking.flight_in || "-"} / {booking.flight_out || "-"}</span></div>
        </div>

        <div className="sec">
          <h2>체크인 디테일 입력</h2>
          <div className="fr">
            <div className="fg"><label className="fl">예약자 성함</label><input className="fi" value={detail.booker_name||""} onChange={e=>field("booker_name",e.target.value)}/></div>
            <div className="fg"><label className="fl">입실 일자</label><input className="fi" value={detail.checkin_date||""} onChange={e=>field("checkin_date",e.target.value)} placeholder="2026-05-09 또는 2026년 5월 9일"/></div>
          </div>
          <div className="fg" style={{marginBottom:10}}><label className="fl">투숙자 전체 영문이름</label><textarea className="ta" value={detail.guest_names_en||""} onChange={e=>field("guest_names_en",e.target.value)} placeholder="kim ooo / yoo ooo ooo / ..."/></div>
          <div className="fg" style={{marginBottom:10}}><label className="fl">베드 세팅</label><textarea className="ta" value={detail.bed_setting||""} onChange={e=>field("bed_setting",e.target.value)} placeholder="2~3인: 마스터룸 베드2개 / 4인이상: 마스터룸 베드2개+작은방 베드1개"/></div>
          <div className="fg" style={{marginBottom:10}}><label className="fl">유심 대여 (GB 수량)</label><textarea className="ta" value={detail.usim_request||""} onChange={e=>field("usim_request",e.target.value)} placeholder="예: 2명, 5GB / 1명, 10GB"/></div>
          <div className="fg" style={{marginBottom:10}}><label className="fl">애프터스쿨 / 필드트립 사전신청</label><textarea className="ta" value={detail.after_trip_request||""} onChange={e=>field("after_trip_request",e.target.value)} placeholder="원하는 프로그램 및 날짜 작성"/></div>
          <div className="fg" style={{marginBottom:10}}><label className="fl">기타 요청사항</label><textarea className="ta" value={detail.extra_requests||""} onChange={e=>field("extra_requests",e.target.value)} placeholder="추가 픽드랍, 가족 추가 픽업 등"/></div>

          <div className="actions" style={{marginTop:14}}>
            <button className="btn btn-blue" onClick={save} disabled={saving}>{saving?"저장 중...":"💾 저장"}</button>
            {detail.public_token && <button className="btn btn-green" onClick={copyPublicLink}>🔗 손님 폼 링크 복사</button>}
            {msg && <span className={`msg ${msg.includes("실패")?"msg-err":"msg-ok"}`}>{msg}</span>}
          </div>
          {detail.public_token && <div className="token-info">/checkin/{detail.public_token}{detail.submitted_at?` · 제출됨: ${new Date(detail.submitted_at).toLocaleString("ko-KR")}`:" · 손님 미제출"}</div>}
        </div>
      </>)}
    </div>
  </>);
}
