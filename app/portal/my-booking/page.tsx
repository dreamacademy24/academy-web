"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Session { booking_id: string; booking_number: string; guest_name: string; check_in_date: string; expires: number }

const PAY: Record<string, { label: string; bg: string; color: string }> = {
  unpaid:  { label: "미납", bg: "#fef2f2", color: "#dc2626" },
  partial: { label: "부분납", bg: "#fef3c7", color: "#92400e" },
  paid:    { label: "완료", bg: "#dcfce7", color: "#166534" },
};

function fDate(d: string | null) { return d || "-"; }
function fAmt(n: number | null) { return n ? n.toLocaleString() + "원" : "-"; }

function addDaysISO(dateStr: string, n: number): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function getNextMonday(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const day = d.getDay(); // 0=Sun..6=Sat
  // 월요일이면 그대로, 아니면 다음 월요일
  const offset = day === 1 ? 0 : (8 - day) % 7;
  return addDaysISO(dateStr, offset);
}
function deriveAcademyStartFB(b: Record<string, any>): string {
  if (b?.academy_start) return String(b.academy_start).split("T")[0];
  const ci = b?.check_in || b?.checkin_date || "";
  return getNextMonday(String(ci).split("T")[0]);
}
function deriveAcademyEndFB(b: Record<string, any>): string {
  if (b?.academy_end) return String(b.academy_end).split("T")[0];
  const start = deriveAcademyStartFB(b);
  const w = Number(b?.accom_weeks);
  if (!start || !w || w < 1) return "";
  return addDaysISO(start, w * 7 - 1);
}

interface FlightForm {
  flight_in_airline: string; flight_in_no: string; flight_in_date: string; flight_in_time: string; flight_in_origin: string; flight_in_undecided: boolean;
  flight_out_airline: string; flight_out_no: string; flight_out_date: string; flight_out_time: string; flight_out_destination: string; flight_out_undecided: boolean;
}
const EMPTY_FLIGHT: FlightForm = {
  flight_in_airline: '', flight_in_no: '', flight_in_date: '', flight_in_time: '', flight_in_origin: '', flight_in_undecided: false,
  flight_out_airline: '', flight_out_no: '', flight_out_date: '', flight_out_time: '', flight_out_destination: '', flight_out_undecided: false,
};

export default function MyBookingPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [flightEditing, setFlightEditing] = useState(false);
  const [flightForm, setFlightForm] = useState<FlightForm>(EMPTY_FLIGHT);
  // 학생 영문이름 입력
  const [engDraft, setEngDraft] = useState<Record<string, string>>({});
  const [engSaving, setEngSaving] = useState<string | null>(null);

  async function saveEng(s: any) {
    const key = s.id || s.name_kr;
    const en = (engDraft[key] || "").trim();
    if (!en) { alert("영문 혹은 사용하는 영어 이름을 입력해주세요."); return; }
    if (!session?.booking_id) return;
    setEngSaving(key);
    try {
      const res = await fetch("/api/portal/student-english", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: session.booking_id, student_id: s.id || null, name_kr: s.name_kr || null, name_en: en }),
      });
      if (!res.ok) { alert("저장에 실패했어요. 잠시 후 다시 시도해주세요."); return; }
      const r = await fetch(`/api/portal/booking?booking_id=${session.booking_id}`);
      if (r.ok) setData(await r.json());
    } finally { setEngSaving(null); }
  }
  const [flightSaving, setFlightSaving] = useState(false);
  const flightFileRef = useRef<HTMLInputElement>(null);
  const [flightOcrLoading, setFlightOcrLoading] = useState(false);
  const [flightOcrMsg, setFlightOcrMsg] = useState("");

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
    if (typeof window === "undefined") return;
    (async () => {
      try {
        const raw = localStorage.getItem("portalSession");
        if (!raw) {
          const { data: { session: authSession } } = await supabase.auth.getSession();
          if (!authSession) { router.replace("/portal"); return; }
          const res = await fetch('/api/portal/find-booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: authSession.user.id })
          });
          const d = res.ok ? await res.json() : null;
          const bk = d?.booking;
          if (bk) {
            setSession({
              booking_id: bk.id,
              booking_number: bk.reservation_no || '',
              guest_name: bk.booker_name || '',
              check_in_date: bk.check_in || '',
              expires: Date.now() + 24 * 60 * 60 * 1000
            });
          } else {
            router.replace("/portal/dashboard");
          }
          return;
        }
        const s: Session = JSON.parse(raw);
        if (s.expires < Date.now()) { localStorage.removeItem("portalSession"); router.replace("/portal"); return; }
        setSession(s);
      } catch { router.replace("/portal"); }
    })();
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch(`/api/portal/booking?booking_id=${session.booking_id}`);
      if (res.ok) setData(await res.json());
      setLoading(false);
    })();
  }, [session]);

  if (!session || loading) return null;

  const b = data?.booking;
  const students = data?.students || [];
  if (!b) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "'Noto Sans KR',sans-serif", background: "#f1f5f9" }}>
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>예약 정보를 찾을 수 없습니다</div>
        <button onClick={() => router.push("/portal/dashboard")} style={{ padding: "10px 24px", background: "#1a6fc4", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← 대시보드로</button>
      </div>
    </div>
  );

  // payment_status가 없으면 예약 status에서 유도: 영수증발행/결제완료/완료 = 결제완료
  const derivedPay = b.payment_status || (
    ["영수증발행","결제완료","완료"].includes(b.status) ? "paid" :
    b.status === "인보이스발행" ? "unpaid" : "unpaid"
  );
  const pay = PAY[derivedPay] || PAY.unpaid;
  const totalAmt = b.total_amount || b.final_price || b.base_price || 0;
  const paidAmt = b.paid_amount || 0;
  const balance = totalAmt - paidAmt;

  // 콤보 예약(숙소 2곳 순서) 표시용
  const ACC_KR: Record<string, string> = { jaypark: "제이파크", dreamhouse: "드림하우스", cubenine: "큐브나인" };
  const isCombo = !!(b.seg1_type && b.seg2_type);
  const comboLabel = isCombo ? `${ACC_KR[b.seg1_type] || b.seg1_type}+${ACC_KR[b.seg2_type] || b.seg2_type}` : "";
  const segs = isCombo
    ? [
        { type: b.seg1_type, ci: b.seg1_checkin, co: b.seg1_checkout },
        { type: b.seg2_type, ci: b.seg2_checkin, co: b.seg2_checkout },
      ]
    : [];

  return (<>
    <style>{`
.mb-w{max-width:640px;margin:0 auto;padding:24px 24px 40px}
.mb-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:12px}.mb-back:hover{color:#1a6fc4}
.mb-head{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:16px;padding:20px;color:#fff;margin-bottom:12px}
.mb-head h1{font-size:18px;font-weight:800;margin-bottom:2px}
.mb-head p{font-size:12px;opacity:0.8}
.sec{background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 8px rgba(0,0,0,0.04);margin-bottom:10px}
.sec h2{font-size:13px;font-weight:800;color:#1a6fc4;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.item{padding:10px;background:#f8fafc;border-radius:8px}
.item .lbl{font-size:10px;font-weight:700;color:#6b7c93;margin-bottom:2px}
.item .val{font-size:13px;font-weight:600}
.badge{display:inline-block;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700}
.stu{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:8px}
.stu .nm{font-size:15px;font-weight:700;margin-bottom:4px}
.stu .sub{font-size:12px;color:#6b7c93}
.empty{text-align:center;padding:20px;color:#94a3b8;font-size:13px}
@media(max-width:500px){.mb-w{padding:24px 16px}.grid{grid-template-columns:1fr}}
    `}</style>
    <div className="mb-w">
      <button className="mb-back" onClick={() => router.push("/portal/dashboard")}>← 대시보드로</button>

      <div className="mb-head">
        <h1>{session.guest_name}님의 예약</h1>
        <p>{session.booking_number}</p>
      </div>

      <div className="sec">
        <h2>예약 정보</h2>
        <div className="grid">
          <div className="item"><div className="lbl">예약번호</div><div className="val">{b.reservation_no || session.booking_number}</div></div>
          <div className="item"><div className="lbl">예약유형</div><div className="val">{isCombo ? comboLabel : (b.booking_type || b.accom_type || "-")}</div></div>
          <div className="item"><div className="lbl">체크인</div><div className="val">{fDate(isCombo ? b.seg1_checkin : (b.check_in || b.checkin_date))}</div></div>
          <div className="item"><div className="lbl">체크아웃</div><div className="val">{fDate(b.extra_stay_checkout || (isCombo ? b.seg2_checkout : (b.check_out || b.checkout_date)))}</div></div>
          <div className="item"><div className="lbl">아카데미 시작</div><div className="val">{fDate(deriveAcademyStartFB(b) || null)}</div></div>
          <div className="item"><div className="lbl">아카데미 종료</div><div className="val">{fDate(deriveAcademyEndFB(b) || null)}</div></div>
          <div className="item"><div className="lbl">픽업장소</div><div className="val">{b.pickup_place || "-"}</div></div>
          <div className="item"><div className="lbl">유학원</div><div className="val">{b.agency || "-"}</div></div>
        </div>

        {isCombo && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7c93", marginBottom: 8 }}>숙소 구간 (순서대로)</div>
            {segs.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: i === 0 ? "#1a6fc4" : "#0ea5a3", color: "#fff", fontWeight: 800, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{ACC_KR[s.type] || s.type}</div>
                  <div style={{ fontSize: 12, color: "#6b7c93", marginTop: 2 }}>{fDate(s.ci)} ~ {fDate(s.co)}</div>
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>공항 도착 시 ①번 숙소로 이동 후, {fDate(b.seg1_checkout)}에 ②번 숙소로 이동합니다.</div>
          </div>
        )}

        {/* 추가 투숙 안내 */}
        {b.extra_stay_checkin && b.extra_stay_checkout && (
          <div className="sec" style={{marginTop:16}}>
            <h3 style={{fontSize:15,fontWeight:700,color:"#92400e",marginBottom:10}}>🏠 추가 투숙 안내</h3>
            <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:"14px 18px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div>
                  <div style={{fontSize:11,color:"#92400e",fontWeight:600,marginBottom:2}}>추가 투숙 체크인</div>
                  <div style={{fontSize:15,fontWeight:700}}>{b.extra_stay_checkin}</div>
                </div>
                <div>
                  <div style={{fontSize:11,color:"#92400e",fontWeight:600,marginBottom:2}}>추가 투숙 체크아웃</div>
                  <div style={{fontSize:15,fontWeight:700}}>{b.extra_stay_checkout}</div>
                </div>
              </div>
              <div style={{fontSize:12.5,color:"#78350f",lineHeight:1.6,borderTop:"1px solid #fde68a",paddingTop:10}}>
                추가 투숙 기간에는 숙소만 제공되며,<br/>
                셔틀·애프터스쿨·헬퍼 서비스는 포함되지 않습니다.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 항공편 UI는 /checkin/[token] 페이지의 항공권등록 탭으로 이동됨 — 여기서는 표시하지 않음 */}
      {false && (() => {
        const hasInbound = b.flight_in_airline || b.flight_in_no;
        const hasOutbound = b.flight_out_airline || b.flight_out_no;
        const hasAny = hasInbound || hasOutbound || b.flight_in_undecided || b.flight_out_undecided;

        function startEditFlight() {
          setFlightForm({
            flight_in_airline: b.flight_in_airline || '',
            flight_in_no: b.flight_in_no || '',
            flight_in_date: (b.flight_in_date || '').split('T')[0] || '',
            flight_in_time: b.flight_in_time || '',
            flight_in_origin: b.flight_in_origin || '',
            flight_in_undecided: !!b.flight_in_undecided,
            flight_out_airline: b.flight_out_airline || '',
            flight_out_no: b.flight_out_no || '',
            flight_out_date: (b.flight_out_date || '').split('T')[0] || '',
            flight_out_time: b.flight_out_time || '',
            flight_out_destination: b.flight_out_destination || '',
            flight_out_undecided: !!b.flight_out_undecided,
          });
          setFlightEditing(true);
        }

        async function saveFlight() {
          if (!session) return;
          setFlightSaving(true);
          try {
            const res = await fetch('/api/portal/flight', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ booking_id: session.booking_id, ...flightForm }),
            });
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              alert('저장 실패: ' + (j.error || ''));
              return;
            }
            const r = await fetch(`/api/portal/booking?booking_id=${session.booking_id}`);
            if (r.ok) setData(await r.json());
            setFlightEditing(false);
          } finally { setFlightSaving(false); }
        }

        const fldRow = (label: string, input: React.ReactNode) => (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7c93', marginBottom: 4 }}>{label}</div>
            {input}
          </div>
        );
        const inp = (val: string, onCh: (v: string) => void, ph?: string, type = 'text') => (
          <input type={type} value={val} placeholder={ph || ''} onChange={e => onCh(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#fff' }} />
        );

        return (
          <div className="sec">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ border: 'none', margin: 0, padding: 0 }}>항공편</h2>
              {!flightEditing && hasAny && (
                <button onClick={startEditFlight} style={{ padding: '5px 12px', background: '#fff', border: '1px solid #1a6fc4', color: '#1a6fc4', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
              )}
            </div>

            {!flightEditing && !hasAny && (
              <button onClick={startEditFlight} style={{ width: '100%', padding: 14, background: '#f0f7ff', border: '1.5px dashed #1a6fc4', borderRadius: 10, color: '#1a6fc4', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ✈️ 항공편 추가하기
              </button>
            )}

            {!flightEditing && hasAny && (
              <div className="grid">
                <div className="item">
                  <div className="lbl">입국편</div>
                  {b.flight_in_undecided
                    ? <div className="val" style={{ color: '#94a3b8' }}>미정 (추후 입력)</div>
                    : <div className="val">{[b.flight_in_airline, b.flight_in_no].filter(Boolean).join(' ') || b.flight_in || '-'}</div>}
                </div>
                <div className="item">
                  <div className="lbl">입국 일시</div>
                  <div className="val">{b.flight_in_undecided ? '-' : `${fDate(b.flight_in_date)} ${b.flight_in_time || ''}`}</div>
                </div>
                <div className="item">
                  <div className="lbl">출발지</div>
                  <div className="val">{b.flight_in_undecided ? '-' : (b.flight_in_origin || '-')}</div>
                </div>
                <div className="item">
                  <div className="lbl">출국편</div>
                  {b.flight_out_undecided
                    ? <div className="val" style={{ color: '#94a3b8' }}>미정 (추후 입력)</div>
                    : <div className="val">{[b.flight_out_airline, b.flight_out_no].filter(Boolean).join(' ') || b.flight_out || '-'}</div>}
                </div>
                <div className="item">
                  <div className="lbl">출국 일시</div>
                  <div className="val">{b.flight_out_undecided ? '-' : `${fDate(b.flight_out_date)} ${b.flight_out_time || ''}`}</div>
                </div>
                <div className="item">
                  <div className="lbl">도착지</div>
                  <div className="val">{b.flight_out_undecided ? '-' : (b.flight_out_destination || '-')}</div>
                </div>
              </div>
            )}

            {flightEditing && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <input ref={flightFileRef} type="file" accept="image/*" onChange={handleFlightOcr} style={{ display: 'none' }} />
                  <button type="button" onClick={() => flightFileRef.current?.click()} disabled={flightOcrLoading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', background: '#4f6ef7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: flightOcrLoading ? 'wait' : 'pointer', opacity: flightOcrLoading ? 0.7 : 1, fontFamily: 'inherit' }}>
                    {flightOcrLoading ? '⏳ 분석 중...' : '📷 항공권 사진으로 자동입력'}
                  </button>
                  {flightOcrMsg && <div style={{ marginTop: 6, fontSize: 12, color: flightOcrMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{flightOcrMsg}</div>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a6fc4', margin: '8px 0' }}>🛬 입국편</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13 }}>
                  <input type="checkbox" checked={flightForm.flight_in_undecided} onChange={e => setFlightForm(p => ({ ...p, flight_in_undecided: e.target.checked }))} />
                  미정(추후 입력)
                </label>
                <fieldset disabled={flightForm.flight_in_undecided} style={{ border: 'none', padding: 0, margin: 0, opacity: flightForm.flight_in_undecided ? 0.4 : 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {fldRow('항공사', inp(flightForm.flight_in_airline, v => setFlightForm(p => ({ ...p, flight_in_airline: v })), '예: 대한항공'))}
                    {fldRow('편명', inp(flightForm.flight_in_no, v => setFlightForm(p => ({ ...p, flight_in_no: v })), '예: KE601'))}
                    {fldRow('날짜', inp(flightForm.flight_in_date, v => setFlightForm(p => ({ ...p, flight_in_date: v })), '', 'date'))}
                    {fldRow('시간', inp(flightForm.flight_in_time, v => setFlightForm(p => ({ ...p, flight_in_time: v })), '', 'time'))}
                  </div>
                  {fldRow('출발지', inp(flightForm.flight_in_origin, v => setFlightForm(p => ({ ...p, flight_in_origin: v })), '인천'))}
                </fieldset>

                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a6fc4', margin: '16px 0 8px' }}>🛫 출국편</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13 }}>
                  <input type="checkbox" checked={flightForm.flight_out_undecided} onChange={e => setFlightForm(p => ({ ...p, flight_out_undecided: e.target.checked }))} />
                  미정(추후 입력)
                </label>
                <fieldset disabled={flightForm.flight_out_undecided} style={{ border: 'none', padding: 0, margin: 0, opacity: flightForm.flight_out_undecided ? 0.4 : 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {fldRow('항공사', inp(flightForm.flight_out_airline, v => setFlightForm(p => ({ ...p, flight_out_airline: v })), '예: 대한항공'))}
                    {fldRow('편명', inp(flightForm.flight_out_no, v => setFlightForm(p => ({ ...p, flight_out_no: v })), '예: KE602'))}
                    {fldRow('날짜', inp(flightForm.flight_out_date, v => setFlightForm(p => ({ ...p, flight_out_date: v })), '', 'date'))}
                    {fldRow('시간', inp(flightForm.flight_out_time, v => setFlightForm(p => ({ ...p, flight_out_time: v })), '', 'time'))}
                  </div>
                  {fldRow('도착지', inp(flightForm.flight_out_destination, v => setFlightForm(p => ({ ...p, flight_out_destination: v })), '인천'))}
                </fieldset>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                  <button onClick={() => setFlightEditing(false)} disabled={flightSaving} style={{ padding: '8px 16px', background: '#fff', border: '1px solid #cbd5e1', color: '#475569', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                  <button onClick={saveFlight} disabled={flightSaving} style={{ padding: '8px 20px', background: '#1a6fc4', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{flightSaving ? '저장 중...' : '💾 저장'}</button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="sec">
        <h2>학생 ({students.length}명)</h2>
        {students.some((s: any) => !(s.name_en || "").trim()) && (
          <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 10, padding: "10px 13px", fontSize: 13, color: "#b91c1c", fontWeight: 700, marginBottom: 10 }}>
            ❗ 영문 혹은 사용하는 영어 이름을 입력해 주세요 — 수업·선생님 안내에 사용됩니다.
          </div>
        )}
        {students.length === 0 ? <div className="empty">등록된 학생이 없습니다</div> :
          students.map((s: any) => (
            <div key={s.id || s.name_kr} className="stu">
              <div className="nm">
                {s.name_kr || "-"} {s.name_en ? `(${s.name_en})` : <span style={{ color: "#dc2626", fontSize: 12, fontWeight: 800 }}>❗ 영문이름 미입력</span>}
              </div>
              <div className="sub">
                {s.age || "-"} · {s.level === "kinder" ? "킨더" : s.level === "junior" ? "주니어" : "-"} · {s.class_type === "morning" ? "오전반" : s.class_type === "fullday" ? "종일반" : "-"}
              </div>
              <div className="sub" style={{ marginTop: 3 }}>
                {s.photo_allowed
                  ? <span style={{ color: "#166534", fontWeight: 700 }}>📸 사진 SNS·공유폴더 공유 동의</span>
                  : <span style={{ color: "#b91c1c", fontWeight: 700 }}>📵 사진 비동의 — 사진 촬영 자체가 없습니다</span>}
              </div>
              {!(s.name_en || "").trim() && (
                <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
                  <input value={engDraft[s.id || s.name_kr] || ""} placeholder="예: Sally Kim (영문/영어이름)"
                    onChange={e => setEngDraft(p => ({ ...p, [s.id || s.name_kr]: e.target.value }))}
                    style={{ flex: 1, padding: "9px 11px", border: "1.5px solid #fecaca", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", outline: "none" }} />
                  <button disabled={engSaving === (s.id || s.name_kr)} onClick={() => saveEng(s)}
                    style={{ padding: "9px 14px", background: "#1a6fc4", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    {engSaving === (s.id || s.name_kr) ? "저장 중..." : "저장"}
                  </button>
                </div>
              )}
            </div>
          ))
        }
      </div>

      <div className="sec">
        <h2>결제 상태</h2>
        <div className="grid">
          <div className="item"><div className="lbl">결제상태</div><div className="val"><span className="badge" style={{ background: pay.bg, color: pay.color }}>{pay.label}</span></div></div>
          <div className="item"><div className="lbl">총 금액</div><div className="val">{fAmt(totalAmt)}</div></div>
          <div className="item"><div className="lbl">납입 금액</div><div className="val">{fAmt(paidAmt)}</div></div>
          <div className="item"><div className="lbl">잔금</div><div className="val" style={{ color: balance > 0 ? "#dc2626" : "#166534" }}>{fAmt(balance)}</div></div>
        </div>
      </div>

    </div>
  </>);
}
