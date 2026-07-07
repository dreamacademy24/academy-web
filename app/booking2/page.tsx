"use client";
import { useState, useEffect, useMemo } from "react";
import { ensureUniqueBookerName } from "@/lib/bookerName";
import { supabase } from "@/lib/supabase";
import { fetchDeployedHolidays, holidaysInRange, type HolidayItem } from "@/lib/holidays";
import { HolidayBanner, HolidayPopup } from "@/components/HolidayNotice";

interface Student { id: number; korName: string; engName: string; age: string; grade: string; photo: string }
interface Flight { airline: string; flightNo: string; date: string; time: string; place: string; undecided: boolean }

type NPType = "dh_only" | "jp_only" | "cn_only" | "commute";
const NP_TYPES: { value: NPType; icon: string; label: string; desc: string }[] = [
  { value: "dh_only",  icon: "🏠", label: "드림하우스", desc: "숙소만 이용" },
  { value: "jp_only",  icon: "🏨", label: "제이파크",   desc: "숙소만 이용" },
  { value: "cn_only",  icon: "🏢", label: "큐브나인",   desc: "숙소만 이용" },
  { value: "commute",  icon: "🚶", label: "통학형",     desc: "숙소 없이 학원만" },
];

const todayCompact = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const emptyFlight: Flight = { airline: "", flightNo: "", date: "", time: "", place: "", undecided: false };

export default function BookingNonPackagePage() {
  const [bType, setBType] = useState<NPType>("dh_only");
  const [booker, setBooker] = useState({ name: "", nameEng: "", phone: "" });
  const [extraGuardians, setExtraGuardians] = useState<{kor: string; eng: string}[]>([]);
  const [dates, setDates] = useState({ checkIn: "", checkOut: "", pickupPlace: "공항", pickupAddr: "", pickupUndecided: false });
  const [weeks, setWeeks] = useState(4); // 비통학형 숙소 이용 기간(주)
  const [flightIn, setFlightIn] = useState<Flight>({ ...emptyFlight });
  const [flightOut, setFlightOut] = useState<Flight>({ ...emptyFlight });
  const [students, setStudents] = useState<Student[]>([{ id: 1, korName: "", engName: "", age: "", grade: "주니어", photo: "O" }]);
  const [specialRequest, setSpecialRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [reservationNo, setReservationNo] = useState("");
  const [agreed, setAgreed] = useState(false);
  // 배포된 휴일 — 선택한 기간에 끼면 팝업 + 배너 안내
  const [deployedHolidays, setDeployedHolidays] = useState<HolidayItem[]>([]);
  const [holidayPopup, setHolidayPopup] = useState<HolidayItem[] | null>(null);
  const [holidayPopupKey, setHolidayPopupKey] = useState("");
  useEffect(() => { fetchDeployedHolidays(supabase).then(setDeployedHolidays); }, []);
  const holidayHits = useMemo(
    () => holidaysInRange(deployedHolidays, dates.checkIn, dates.checkOut),
    [deployedHolidays, dates.checkIn, dates.checkOut]
  );
  useEffect(() => {
    if (holidayHits.length === 0) return;
    const key = dates.checkIn + "~" + dates.checkOut;
    if (key === holidayPopupKey) return;
    setHolidayPopupKey(key);
    setHolidayPopup(holidayHits);
  }, [holidayHits, dates.checkIn, dates.checkOut, holidayPopupKey]);

  const isCommute = bType === "commute";

  // 비통학형: 체크인 + 기간(주) → 체크아웃 자동계산
  useEffect(() => {
    if (isCommute || !dates.checkIn) return;
    const d = new Date(dates.checkIn);
    d.setDate(d.getDate() + weeks * 7);
    setDates(prev => ({ ...prev, checkOut: d.toISOString().slice(0, 10) }));
  }, [isCommute, dates.checkIn, weeks]);

  function addStudent() { if (students.length < 5) setStudents([...students, { id: Date.now(), korName: "", engName: "", age: "", grade: "주니어", photo: "O" }]); }
  function rmStudent(id: number) { setStudents(students.filter(s => s.id !== id)); }
  function upStudent(id: number, f: string, v: string) { setStudents(students.map(s => s.id === id ? { ...s, [f]: v } : s)); }

  async function submit() {
    if (!booker.name.trim()) { alert("예약자명을 입력해주세요."); return; }
    if (!booker.nameEng.trim()) { alert("예약자 영문명을 입력해주세요."); return; }
    for (let i = 0; i < extraGuardians.length; i++) {
      const g = extraGuardians[i];
      if (!g.kor.trim() || !g.eng.trim()) { alert(`보호자 ${i + 2}번의 한글/영문 이름을 모두 입력해주세요.`); return; }
    }
    if (isCommute && !students.some(s => s.korName.trim())) { alert("학생 이름을 1명 이상 입력해주세요."); return; } // 숙소만 이용은 학생 불필요
    if (!dates.checkIn) { alert(isCommute ? "수업시작 날짜를 입력해주세요." : "체크인 날짜를 입력해주세요."); return; }
    if (!dates.checkOut) { alert(isCommute ? "수업종료 날짜를 입력해주세요." : "체크아웃 날짜를 입력해주세요."); return; }
    if (isCommute && !dates.pickupUndecided && !dates.pickupAddr.trim()) { alert("픽드랍 주소를 입력하거나 '미정'을 선택해주세요."); return; }
    if (!agreed) { alert("예약 동의가 필요합니다."); return; }

    setLoading(true);
    const rno = "DA-" + todayCompact + "-" + Math.floor(Math.random() * 900000 + 100000);
    let accomType = "";
    if (bType === "dh_only") accomType = "드림하우스 단독";
    else if (bType === "jp_only") accomType = "제이파크 단독";
    else if (bType === "cn_only") accomType = "큐브나인 단독";
    else accomType = "통학형";

    const flightInStr = isCommute ? "" : (flightIn.undecided ? "미정" : [flightIn.airline, flightIn.flightNo, flightIn.date, flightIn.time].filter(Boolean).join(" "));
    const flightOutStr = isCommute ? "" : (flightOut.undecided ? "미정" : [flightOut.airline, flightOut.flightNo, flightOut.date, flightOut.time].filter(Boolean).join(" "));

    // 통학형: 사용자 입력 그대로 academyStart/End. 비통학형: 단독 숙소도 사용자가 직접 입력한 날짜 사용.
    const academyStart = dates.checkIn;
    const academyEnd = dates.checkOut;
    const enrichedStudents = students.filter(s => s.korName.trim()).map(s => ({
      ...s, academyStart, academyEnd, academyWeeks: "",
    }));

    const cleanGuardians = extraGuardians.filter(g => g.kor.trim() && g.eng.trim()).map(g => ({kor: g.kor.trim(), eng: g.eng.trim()}));
    const childrenCount = students.filter(s => s.korName.trim()).length;

    // 🏠 드림하우스 만실 체크 — 접수 단계에서 오버부킹 예방
    if (bType === "dh_only" && dates.checkIn && dates.checkOut) {
      try {
        const av = await fetch(`/api/dreamhouse/availability?ci=${dates.checkIn}&co=${dates.checkOut}`).then(r => r.json());
        if (Array.isArray(av.fullDates) && av.fullDates.length > 0) {
          const list = av.fullDates.slice(0, 5).map((d: string) => d.slice(5).replace("-", "/")).join(", ") + (av.fullDates.length > 5 ? ` 외 ${av.fullDates.length - 5}일` : "");
          alert(`⚠️ 죄송합니다 — 선택하신 기간 중 아래 날짜는 드림하우스 예약이 가득 찼습니다.\n\n만실: ${list}\n\n접수 전에 관리자에게 확인을 부탁드려요.\n(카카오 채널 또는 드림아카데미 상담 창구로 문의해주세요)`);
          setLoading(false);
          return;
        }
      } catch { /* 확인 실패 시 접수는 진행 */ }
    }
    const uniq = await ensureUniqueBookerName(supabase as never, booker.name);
    if (uniq.changed) alert(`같은 이름의 예약이 이미 있어 "${uniq.name}"(으)로 접수됩니다.\n(동명이인 구분용 — 서비스는 동일하게 제공돼요)`);
    const payload: any = {
      reservation_no: rno,
      booker_name: uniq.name,
      booker_english: booker.nameEng.trim(),
      booker_phone: booker.phone.trim() || null,
      extra_guardians: cleanGuardians,
      adults: 1 + cleanGuardians.length,
      children: childrenCount,
      students: JSON.stringify(enrichedStudents),
      accom_type: accomType,
      accom_weeks: isCommute ? 0 : weeks,
      checkin_date: dates.checkIn || null,
      checkout_date: dates.checkOut || null,
      pickup: "필요함",
      drop_off: "필요함",
      pickup_place: isCommute ? (dates.pickupUndecided ? "미정" : (dates.pickupAddr.trim() || null)) : dates.pickupPlace,
      flight_in: flightInStr,
      flight_out: flightOutStr,
      special_request: specialRequest,
      holidays_notified: holidayHits.length > 0 ? holidayHits : null,
      status: "접수",
    };
    if (isCommute) payload.booking_type = "commute";

    const { data: booking, error } = await supabase.from("bookings").insert(payload).select().single();
    if (error) { setLoading(false); alert("접수 실패: " + error.message); return; }

    if (booking?.id) {
      const studentRows = students.filter(s => s.korName.trim()).map(s => ({
        booking_id: booking.id,
        name_kr: s.korName.trim(),
        name_en: s.engName.trim() || null,
        age: s.age || null,
        level: s.grade === "킨더" ? "kinder" : "junior",
        photo_allowed: s.photo === "O",
        academy_start: academyStart || null,
        academy_end: academyEnd || null,
      }));
      if (studentRows.length > 0) await supabase.from("students").insert(studentRows);
    }

    setLoading(false);
    setReservationNo(rno);
    setDone(true);
  }

  if (done) return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9}
.dw{max-width:500px;margin:0 auto;padding:60px 24px;text-align:center}
.dc{font-size:64px;margin-bottom:16px}.dh{font-size:24px;font-weight:800;margin-bottom:12px}
.drn{font-size:20px;font-weight:700;color:#7c3aed;background:#f5f3ff;padding:12px 24px;border-radius:10px;display:inline-block;margin-bottom:16px}
.dp{font-size:14px;color:#6b7c93;line-height:1.8;margin-bottom:24px}
.dk{display:inline-block;padding:12px 28px;background:#fee500;color:#3c1e1e;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none}
    `}</style>
    <div className="dw">
      <div className="dc">✅</div>
      <div className="dh">예약 접수 완료!</div>
      <div className="drn">{reservationNo}</div>
      <div className="dp">담당자가 확인 후 인보이스를 발송해드립니다.<br/>문의사항은 카카오톡으로 연락주세요.</div>
      <a className="dk" href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">카카오톡 문의하기</a>
    </div>
  </>);

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.bw{max-width:680px;margin:0 auto;padding:0 0 60px}
.bh{background:linear-gradient(135deg,#1a6fc4,#7c3aed);padding:28px 20px;text-align:center;color:#fff}
.bh h1{font-size:22px;font-weight:800}.bh p{font-size:12px;opacity:0.9;margin-top:4px}
.bc{padding:0 16px}
.bs{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-top:14px}
.bs h2{font-size:14px;font-weight:800;color:#7c3aed;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;gap:6px}
.type-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.type-card{border:2px solid #e2e8f0;border-radius:12px;padding:14px 12px;cursor:pointer;transition:all 150ms;background:#fff;text-align:left}
.type-card:hover{border-color:#cbd5e1}.type-card.on{border-color:#7c3aed;background:#f5f3ff}
.type-card .icon{font-size:26px;margin-bottom:4px}
.type-card .title{font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:2px}
.type-card.on .title{color:#7c3aed}.type-card .desc{font-size:11px;color:#6b7c93}
.fr{display:flex;gap:8px;margin-bottom:10px}.fg{flex:1}
.fl{display:block;font-size:11px;font-weight:700;color:#6b7c93;margin-bottom:4px}.fl .req{color:#dc2626;margin-left:2px}
.fi,.fsl,.fta{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;background:#fff}
.fi:focus,.fsl:focus,.fta:focus{border-color:#7c3aed}
.fta{resize:vertical;min-height:70px}
.fl-checkbox{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#475569;cursor:pointer;margin-bottom:6px}
.fl-checkbox input{width:14px;height:14px;accent-color:#7c3aed}
.sc{position:relative;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:10px}
.sc-del{position:absolute;top:8px;right:8px;padding:4px 10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700}
.sc-num{font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:8px}
.ab{padding:8px 16px;font-size:12px;font-weight:700;background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;border-radius:7px;cursor:pointer}
.flight-sec{background:#f0f7ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px;margin-bottom:10px}
.flight-sec .ft{font-size:13px;font-weight:700;color:#1e40af;margin-bottom:8px}
.warn{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:10px;font-size:12px;color:#374151;line-height:1.6}
.warn .wt{color:#dc2626;font-weight:800;font-size:13px;margin-bottom:4px}
.sb{width:100%;padding:15px;background:linear-gradient(135deg,#1a6fc4,#7c3aed);color:#fff;font-size:15px;font-weight:800;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:16px}
.sb:disabled{opacity:0.5;cursor:not-allowed}
@media(max-width:500px){.type-grid{grid-template-columns:1fr}.fr{flex-direction:column;gap:10px}}
    `}</style>

    <div className="bw">
      <div className="bh"><h1>드림아카데미 예약 접수 (비패키지)</h1><p>숙소 단독 또는 통학형 예약을 접수합니다.</p></div>
      <div className="bc">

        <div className="bs">
          <h2>1️⃣ 예약 유형</h2>
          <div className="type-grid">
            {NP_TYPES.map(t => (
              <div key={t.value} className={`type-card${bType === t.value ? " on" : ""}`} onClick={() => setBType(t.value)}>
                <div className="icon">{t.icon}</div>
                <div className="title">{t.label}</div>
                <div className="desc">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bs">
          <h2>2️⃣ {isCommute ? "수업 일정" : "체크인 · 체크아웃"}</h2>
          {!isCommute && (
            <div className="fg" style={{ marginBottom: 10 }}>
              <label className="fl">숙소 이용 기간<span className="req">*</span></label>
              <select className="fsl" value={weeks} onChange={e => setWeeks(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(w => <option key={w} value={w}>{w}주</option>)}
              </select>
            </div>
          )}
          <div className="fr">
            <div className="fg">
              <label className="fl">{isCommute ? "수업시작" : "체크인"}<span className="req">*</span></label>
              <input className="fi" type="date" value={dates.checkIn} onChange={e => setDates({ ...dates, checkIn: e.target.value })} />
            </div>
            <div className="fg">
              <label className="fl">{isCommute ? "수업종료" : "체크아웃 (자동)"}<span className="req">*</span></label>
              {isCommute
                ? <input className="fi" type="date" value={dates.checkOut} onChange={e => setDates({ ...dates, checkOut: e.target.value })} />
                : <input className="fi" type="date" value={dates.checkOut} readOnly style={{ background: "#f3f4f6" }} />}
            </div>
          </div>
          {isCommute && (<>
            <div style={{fontSize:12,color:"#6b7c93",marginTop:4}}>* 통학형은 항공편 정보가 없습니다. 픽드랍 받을 주소를 직접 적어주세요. (아직 안 정했으면 미정)</div>
            <div className="fg" style={{marginTop:10}}>
              <label className="fl">픽드랍 주소<span className="req">*</span></label>
              <input className="fi" placeholder="픽드랍 받을 주소를 직접 입력 (예: 막탄 OO콘도 1234호)" value={dates.pickupAddr} disabled={dates.pickupUndecided} onChange={e => setDates({ ...dates, pickupAddr: e.target.value })} style={dates.pickupUndecided ? { background: "#f3f4f6" } : {}} />
              <label className="fl-checkbox" style={{marginTop:6}}>
                <input type="checkbox" checked={dates.pickupUndecided} onChange={e => setDates({ ...dates, pickupUndecided: e.target.checked, pickupAddr: e.target.checked ? "" : dates.pickupAddr })} />
                <span>미정 (추후 입력)</span>
              </label>
            </div>
          </>)}
        </div>

        <div className="bs">
          <h2>3️⃣ 예약자 정보</h2>
          <div className="fr">
            <div className="fg">
              <label className="fl">예약자명 (한글)<span className="req">*</span></label>
              <input className="fi" placeholder="홍길동" value={booker.name} onChange={e => setBooker({ ...booker, name: e.target.value })} />
            </div>
            <div className="fg">
              <label className="fl">예약자명 (영문)<span className="req">*</span></label>
              <input className="fi" placeholder="Hong Gildong" value={booker.nameEng} onChange={e => setBooker({ ...booker, nameEng: e.target.value })} />
            </div>
          </div>
          <div className="fg" style={{marginTop: 10}}>
            <label className="fl">연락처</label>
            <input className="fi" placeholder="010-1234-5678" value={booker.phone} onChange={e => setBooker({ ...booker, phone: e.target.value })} />
          </div>

          <div style={{marginTop: 16, padding: 12, background: "#f9fafb", borderRadius: 8}}>
            <div style={{fontSize: 13, fontWeight: 600, marginBottom: 10, color: "#374151"}}>
              추가 보호자 ({1 + extraGuardians.length}/3명)
              <span style={{fontWeight: 400, fontSize: 12, color: "#6b7280", marginLeft: 8}}>— 동행 보호자가 있으면 입력</span>
            </div>
            {extraGuardians.map((g, idx) => (
              <div key={idx} className="fr" style={{marginBottom: 8, alignItems: "flex-end"}}>
                <div className="fg">
                  <label className="fl">보호자 {idx + 2} 한글<span className="req">*</span></label>
                  <input className="fi" value={g.kor} onChange={e => { const next=[...extraGuardians]; next[idx]={...next[idx], kor:e.target.value}; setExtraGuardians(next); }} placeholder="홍길자" />
                </div>
                <div className="fg">
                  <label className="fl">보호자 {idx + 2} 영문<span className="req">*</span></label>
                  <input className="fi" value={g.eng} onChange={e => { const next=[...extraGuardians]; next[idx]={...next[idx], eng:e.target.value}; setExtraGuardians(next); }} placeholder="Hong Gilja" />
                </div>
                <button type="button" onClick={() => setExtraGuardians(extraGuardians.filter((_, i) => i !== idx))} style={{padding:"8px 12px",background:"#fff",border:"1px solid #ef4444",color:"#ef4444",borderRadius:6,cursor:"pointer",fontSize:12,marginBottom:2}}>제거</button>
              </div>
            ))}
            {extraGuardians.length < 2 && (
              <button type="button" onClick={() => setExtraGuardians([...extraGuardians, {kor:"", eng:""}])} style={{padding:"6px 12px",background:"#fff",border:"1px solid #3b82f6",color:"#3b82f6",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:600}}>
                + 보호자 추가 (현재 {1 + extraGuardians.length}명)
              </button>
            )}
          </div>
        </div>

        {!isCommute && (
          <div className="bs">
            <h2>4️⃣ 픽업 · 항공편</h2>
            <div className="fg" style={{ marginBottom: 10 }}>
              <label className="fl">픽업 장소</label>
              <select className="fsl" value={dates.pickupPlace} onChange={e => setDates({ ...dates, pickupPlace: e.target.value })}>
                <option value="공항">공항</option>
                <option value="기타">기타</option>
              </select>
            </div>

            <div className="flight-sec">
              <div className="ft">🛬 입국편</div>
              <label className="fl-checkbox">
                <input type="checkbox" checked={flightIn.undecided} onChange={e => setFlightIn({ ...flightIn, undecided: e.target.checked })} />
                <span>미정 (추후 입력)</span>
              </label>
              {!flightIn.undecided && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <input className="fi" placeholder="항공사" value={flightIn.airline} onChange={e => setFlightIn({ ...flightIn, airline: e.target.value })} />
                  <input className="fi" placeholder="편명 (KE631)" value={flightIn.flightNo} onChange={e => setFlightIn({ ...flightIn, flightNo: e.target.value })} />
                  <input className="fi" type="date" value={flightIn.date} onChange={e => setFlightIn({ ...flightIn, date: e.target.value })} />
                  <input className="fi" type="time" value={flightIn.time} onChange={e => setFlightIn({ ...flightIn, time: e.target.value })} />
                  <input className="fi" placeholder="출발지 (인천)" value={flightIn.place} onChange={e => setFlightIn({ ...flightIn, place: e.target.value })} style={{ gridColumn: "1/3" }} />
                </div>
              )}
            </div>

            <div className="flight-sec" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
              <div className="ft" style={{ color: "#166534" }}>🛫 출국편</div>
              <label className="fl-checkbox">
                <input type="checkbox" checked={flightOut.undecided} onChange={e => setFlightOut({ ...flightOut, undecided: e.target.checked })} />
                <span>미정 (추후 입력)</span>
              </label>
              {!flightOut.undecided && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <input className="fi" placeholder="항공사" value={flightOut.airline} onChange={e => setFlightOut({ ...flightOut, airline: e.target.value })} />
                  <input className="fi" placeholder="편명" value={flightOut.flightNo} onChange={e => setFlightOut({ ...flightOut, flightNo: e.target.value })} />
                  <input className="fi" type="date" value={flightOut.date} onChange={e => setFlightOut({ ...flightOut, date: e.target.value })} />
                  <input className="fi" type="time" value={flightOut.time} onChange={e => setFlightOut({ ...flightOut, time: e.target.value })} />
                  <input className="fi" placeholder="도착지 (인천)" value={flightOut.place} onChange={e => setFlightOut({ ...flightOut, place: e.target.value })} style={{ gridColumn: "1/3" }} />
                </div>
              )}
            </div>
          </div>
        )}

        {isCommute && (
        <div className="bs">
          <h2>4️⃣ 학생 정보 ({students.length}/5)</h2>
          {students.map((s, idx) => (
            <div className="sc" key={s.id}>
              {students.length > 1 && <button className="sc-del" onClick={() => rmStudent(s.id)}>삭제</button>}
              <div className="sc-num">학생 {idx + 1}</div>
              <div className="fr">
                <div className="fg">
                  <label className="fl">한글이름<span className="req">*</span></label>
                  <input className="fi" placeholder="홍민준" value={s.korName} onChange={e => upStudent(s.id, "korName", e.target.value)} />
                </div>
                <div className="fg">
                  <label className="fl">영문이름</label>
                  <input className="fi" placeholder="HONG MINJUN" value={s.engName} onChange={e => upStudent(s.id, "engName", e.target.value.toUpperCase())} />
                </div>
              </div>
              <div className="fr">
                <div className="fg">
                  <label className="fl">생년월일/나이</label>
                  <input className="fi" placeholder="2019.09.03 만5세" value={s.age} onChange={e => upStudent(s.id, "age", e.target.value)} />
                </div>
                <div className="fg">
                  <label className="fl">킨더/주니어</label>
                  <select className="fsl" value={s.grade} onChange={e => upStudent(s.id, "grade", e.target.value)}>
                    <option value="킨더">킨더 (유치원)</option>
                    <option value="주니어">주니어 (초등 이상)</option>
                  </select>
                </div>
              </div>
              <div className="fg">
                <label className="fl">사진촬영 허용{s.photo === "X" && <span style={{marginLeft:8,fontSize:11,color:"#dc2626",fontWeight:500}}>⚠️ 사진촬영 자체가 없습니다</span>}</label>
                <select className="fsl" value={s.photo} onChange={e => upStudent(s.id, "photo", e.target.value)}>
                  <option value="O">O (SNS 활용 허용)</option>
                  <option value="X">X (미허용)</option>
                </select>
              </div>
            </div>
          ))}
          {students.length < 5 && <button className="ab" onClick={addStudent}>+ 학생 추가</button>}
        </div>
        )}

        <div className="bs">
          <h2>{isCommute ? "5️⃣" : "5️⃣"} 특이사항</h2>
          <div className="warn">
            <div className="wt">⚠️ 주의</div>
            아이의 특이사항(알레르기, 약 복용 등)은 꼭 기재해주세요. 미 안내 시 발생하는 문제에 대해 보호자가 책임지게 됩니다.
          </div>
          <textarea className="fta" placeholder="예) ADHD 약 복용 중, 특정 음식 알레르기, 기타 요청사항" value={specialRequest} onChange={e => setSpecialRequest(e.target.value)} />
        </div>

        {/* 기간 내 휴무일 안내 배너 (공용 컴포넌트) */}
        <HolidayBanner hits={holidayHits} />

        <div style={{
          marginTop: 16, padding: 14, background: "#fff",
          border: agreed ? "1px solid #10b981" : "1px solid #d1d5db",
          borderRadius: 10, display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <input type="checkbox" id="agreed-checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
            style={{width:18,height:18,marginTop:2,flexShrink:0,cursor:"pointer"}} />
          <label htmlFor="agreed-checkbox" style={{flex:1,fontSize:13,lineHeight:1.5,color:"#374151",cursor:"pointer"}}>
            <strong style={{color:"#111"}}>입력 내용을 확인하였고 예약에 동의합니다.</strong>
          </label>
        </div>

        <button className="sb" onClick={submit} disabled={loading || !agreed}>
          {loading ? "접수 중..." : "예약 접수하기"}
        </button>
      </div>
    </div>
    {/* 휴무일 안내 팝업 (공용 컴포넌트) */}
    <HolidayPopup hits={holidayPopup} onClose={() => setHolidayPopup(null)} />
  </>);
}
