"use client";
import { useState, useEffect, useMemo } from "react";
import { ensureUniqueBookerName } from "@/lib/bookerName";
import { supabase } from "@/lib/supabase";
import RefundPolicyModal from "@/components/RefundPolicyModal";
import { getRefundPolicyKeys, REFUND_POLICY_VERSION } from "@/lib/refundPolicy";
import { fetchDeployedHolidays, holidaysInRange, type HolidayItem } from "@/lib/holidays";
import { HolidayBanner, HolidayPopup } from "@/components/HolidayNotice";
import {
  COMMON_EXCLUSIONS,
  getInclusionsByAccom,
  type AccomType,
} from "@/lib/packageInfo";
import { PUBLIC_BOOKING_TYPES as BOOKING_TYPES, type BookingTypeValue as BookingType } from "@/lib/bookingTypes";
interface Student { id: number; korName: string; engName: string; age: string; grade: string; photo: string }
interface Flight { airline: string; flightNo: string; date: string; time: string; place: string; undecided: boolean }

const todayCompact = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const emptyFlight: Flight = { airline: "", flightNo: "", date: "", time: "", place: "", undecided: false };

function addDaysISO(dateStr: string, n: number): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function deriveAcademyStart(checkin: string): string {
  if (!checkin) return "";
  const d = new Date(checkin);
  const day = d.getDay();
  return addDaysISO(checkin, (8 - day) % 7);
}
function deriveAcademyEnd(checkin: string, weeks: number | string | null | undefined): string {
  const start = deriveAcademyStart(checkin);
  const w = Number(weeks);
  if (!start || !w || w < 1) return "";
  return addDaysISO(start, (w - 1) * 7 + 4);
}

const DH_WEEKS = [1, 2, 3, 4, 6, 8, 10];
const CN_PERIODS = ["1주", "2주", "4주", "6일"];

// BookingType → 표시할 패키지 박스 accom 키 배열
function getPackageAccoms(bType: string): AccomType[] {
  const lower = bType.toLowerCase();
  const isDH = lower.includes("dream") || lower.includes("dh") || bType.includes("드림");
  const isJP = lower.includes("jpark") || lower.includes("jaypark") || bType.includes("제이파크");
  const isC9 = lower.includes("cube") || bType.includes("큐브");

  if (isDH && isJP) return ["dreamhouse", "jpark"];
  if (isDH && isC9) return ["dreamhouse", "cubenine"];
  if (isJP) return ["jpark"];
  if (isC9) return ["cubenine"];
  return ["dreamhouse"]; // 드림하우스 단독, 통학형, 룸오프리 등 기본
}

const ACC_KR: Record<string, string> = { jaypark: "제이파크", dreamhouse: "드림하우스", cubenine: "큐브나인" };

export default function BookingPage() {
  const [bType, setBType] = useState<BookingType>("dreamhouse");
  const [booker, setBooker] = useState({ name: "", nameEng: "", phone: "" });
  const [extraGuardians, setExtraGuardians] = useState<{kor: string; eng: string}[]>([]);
  const [accom, setAccom] = useState({ dh_weeks: 4, jp_weeks: 2, cn_period: "1주", jp_room_type: "디럭스", cn_room_type: "디럭스" });
  // 콤보 예약 숙소 구간(순서대로). seg[0]=먼저 묵는 숙소, seg[1]=다음 숙소
  const [segs, setSegs] = useState<{ type: string; checkin: string; checkout: string }[]>([
    { type: "jaypark", checkin: "", checkout: "" },
    { type: "dreamhouse", checkin: "", checkout: "" },
  ]);
  const [dates, setDates] = useState({ checkIn: "", checkOut: "", pickupPlace: "공항" });
  const [flightIn, setFlightIn] = useState<Flight>({ ...emptyFlight });
  const [flightOut, setFlightOut] = useState<Flight>({ ...emptyFlight });
  const [students, setStudents] = useState<Student[]>([{ id: 1, korName: "", engName: "", age: "", grade: "주니어", photo: "O" }]);
  const [specialRequest, setSpecialRequest] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [reservationNo, setReservationNo] = useState("");
  const [agreed, setAgreed] = useState<boolean>(false);
  const [payMethod, setPayMethod] = useState<string>("");
  const [isDaon, setIsDaon] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("src") === "daonmam") setIsDaon(true);
    // 다온맘 신청 폼에서 넘어온 프리필 (pf = base64 JSON)
    const pf = sp.get("pf");
    if (!pf) return;
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(pf.replace(/-/g, "+").replace(/_/g, "/")))));
      if (d.name || d.phone) setBooker(prev => ({ ...prev, name: d.name || "", phone: d.phone || "" }));
      const lodging = String(d.lodging || "");
      const w = parseInt(String(d.duration_weeks || ""), 10) || 0;
      if (lodging.includes("드림하우스")) {
        setBType("dreamhouse");
        if (w && DH_WEEKS.includes(w)) setAccom(prev => ({ ...prev, dh_weeks: w }));
      } else if (lodging.includes("제이파크")) {
        setBType("jaypark");
        if (w >= 1 && w <= 4) setAccom(prev => ({ ...prev, jp_weeks: w }));
      } else if (lodging.includes("큐브나인")) {
        setBType("cubenine");
        if (CN_PERIODS.includes(w + "주")) setAccom(prev => ({ ...prev, cn_period: w + "주" }));
      }
      if (d.depart_date) setDates(prev => ({ ...prev, checkIn: String(d.depart_date) }));
      const n = parseInt(String(d.children || ""), 10) || 0;
      if (n > 0) {
        const ages = String(d.ages || "").split(/[,/·\s]+/).filter(Boolean);
        setStudents(Array.from({ length: Math.min(n, 5) }, (_, i) => ({ id: Date.now() + i, korName: "", engName: "", age: ages[i] || "", grade: "주니어", photo: "O" })));
      }
      const notes: string[] = ["[다온맘 신청 정보]"];
      if (d.adults) notes.push(`보호자 ${d.adults}명`);
      if (d.children) notes.push(`아이 ${d.children}명${d.ages ? ` (${d.ages})` : ""}`);
      if (d.duration_weeks) notes.push(`희망 기간 ${d.duration_weeks}주`);
      if (d.oceanview) notes.push("오션뷰 변경 희망");
      if (notes.length > 1) setSpecialRequest(prev => prev ? prev : notes.join(" · "));
    } catch { /* 무시 */ }
  }, []);
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
  const [policyOpen, setPolicyOpen] = useState<boolean>(false);

  // 자동 체크아웃 계산
  const isCombo = bType === "dreamhouse_jaypark" || bType === "dreamhouse_cubenine" || bType === "jaypark_cubenine";
  const comboAccs = bType === "jaypark_cubenine" ? ["jaypark", "cubenine"] : bType === "dreamhouse_cubenine" ? ["cubenine", "dreamhouse"] : ["jaypark", "dreamhouse"];

  // 콤보 전환 시 구간 숙소 기본값(패키지 먼저 → 드림하우스)
  useEffect(() => {
    if (!isCombo) return;
    setSegs(prev => [{ ...prev[0], type: comboAccs[0] }, { ...prev[1], type: comboAccs[1] }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bType]);

  // 콤보: 구간 날짜가 전체 체크인/체크아웃의 source
  useEffect(() => {
    if (!isCombo) return;
    setDates(prev => ({ ...prev, checkIn: segs[0].checkin || "", checkOut: segs[1].checkout || "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCombo, segs]);

  useEffect(() => {
    if (bType === "commute" || isCombo || !dates.checkIn) return;
    let totalWeeks = 0;
    // 콤보(dreamhouse_jaypark/cubenine)는 위 isCombo 가드로 early-return → 여기 분기 불필요
    if (bType === "dreamhouse") totalWeeks = accom.dh_weeks;
    else if (bType === "jaypark") totalWeeks = accom.jp_weeks;
    else if (bType === "cubenine") {
      const cnDays = accom.cn_period === "6일" ? 6 : parseInt(accom.cn_period) * 7;
      totalWeeks = cnDays / 7;
    }
    const d = new Date(dates.checkIn);
    d.setDate(d.getDate() + Math.round(totalWeeks * 7));
    setDates(prev => ({ ...prev, checkOut: d.toISOString().slice(0, 10) }));
  }, [bType, dates.checkIn, accom]);

  function addStudent() { if (students.length < 5) setStudents([...students, { id: Date.now(), korName: "", engName: "", age: "", grade: "주니어", photo: "O" }]); }
  function rmStudent(id: number) { setStudents(students.filter(s => s.id !== id)); }
  function upStudent(id: number, f: string, v: string) { setStudents(students.map(s => s.id === id ? { ...s, [f]: v } : s)); }

  async function submit() {
    if (!booker.name.trim()) { alert("예약자명을 입력해주세요."); return; }
    if (!booker.nameEng.trim()) { alert("예약자 영문명을 입력해주세요."); return; }
    for (let i = 0; i < extraGuardians.length; i++) {
      const g = extraGuardians[i];
      if (!g.kor.trim() || !g.eng.trim()) {
        alert(`보호자 ${i + 2}번의 한글/영문 이름을 모두 입력해주세요.`);
        return;
      }
    }
    if (!students.some(s => s.korName.trim())) { alert("학생 이름을 1명 이상 입력해주세요."); return; }
    if (!dates.checkIn) { alert(bType === "commute" ? "수업시작 날짜를 입력해주세요." : "체크인 날짜를 입력해주세요."); return; }
    if (bType === "commute" && !dates.checkOut) { alert("수업종료 날짜를 입력해주세요."); return; }
    if (!agreed) { alert("포함/불포함 사항 및 환불규정 확인 동의가 필요합니다."); return; }
    if (!payMethod) { alert("결제 방식을 선택해주세요."); return; }
    if (isCombo && (!segs[0].checkin || !segs[0].checkout || !segs[1].checkin || !segs[1].checkout)) {
      alert("콤보 예약은 각 숙소 구간의 체크인/체크아웃을 모두 입력해주세요."); return;
    }

    setLoading(true);
    const rno = "DA-" + todayCompact + "-" + Math.floor(Math.random() * 900000 + 100000);
    let accomType = "";
    let accomWeeks = 0;
    if (bType === "dreamhouse") { accomType = "드림하우스"; accomWeeks = accom.dh_weeks; }
    else if (bType === "dreamhouse_jaypark") { accomType = "드림하우스+제이파크"; accomWeeks = accom.dh_weeks + accom.jp_weeks; }
    else if (bType === "dreamhouse_cubenine") { accomType = "드림하우스+큐브나인"; accomWeeks = accom.dh_weeks + (accom.cn_period === "6일" ? 1 : parseInt(accom.cn_period)); }
    else if (bType === "jaypark") { accomType = "제이파크 패키지"; accomWeeks = accom.jp_weeks; }
    else if (bType === "cubenine") { accomType = "큐브나인 패키지"; accomWeeks = accom.cn_period === "6일" ? 1 : parseInt(accom.cn_period); }
    else if (bType === "jaypark_cubenine") { accomType = "제이파크+큐브나인"; accomWeeks = accom.jp_weeks + (accom.cn_period === "6일" ? 1 : parseInt(accom.cn_period)); }
    else { accomType = "통학형"; accomWeeks = 0; }

    const flightInStr = flightIn.undecided ? "미정" : [flightIn.airline, flightIn.flightNo, flightIn.date, flightIn.time].filter(Boolean).join(" ");
    const flightOutStr = flightOut.undecided ? "미정" : [flightOut.airline, flightOut.flightNo, flightOut.date, flightOut.time].filter(Boolean).join(" ");

    const academyStart = deriveAcademyStart(dates.checkIn);
    const academyEnd = deriveAcademyEnd(dates.checkIn, accomWeeks);
    const enrichedStudents = students.filter(s => s.korName.trim()).map(s => ({
      ...s,
      academyStart,
      academyEnd,
      academyWeeks: String(accomWeeks),
    }));

    const cleanGuardians = extraGuardians.filter(g => g.kor.trim() && g.eng.trim()).map(g => ({kor: g.kor.trim(), eng: g.eng.trim()}));
    const childrenCount = students.filter(s => s.korName.trim()).length;
    const usesDH = bType === "dreamhouse" || bType === "dreamhouse_jaypark" || bType === "dreamhouse_cubenine";
    const usesJP = bType === "jaypark" || bType === "dreamhouse_jaypark" || bType === "jaypark_cubenine";
    const usesCN = bType === "cubenine" || bType === "dreamhouse_cubenine" || bType === "jaypark_cubenine";

    // 🏠 드림하우스 만실 체크 — 접수 단계에서 오버부킹 예방
    if (usesDH && dates.checkIn && dates.checkOut) {
      try {
        const av = await fetch(`/api/dreamhouse/availability?ci=${dates.checkIn}&co=${dates.checkOut}`).then(r => r.json());
        if (Array.isArray(av.fullDates) && av.fullDates.length > 0) {
          const list = av.fullDates.slice(0, 5).map((d: string) => d.slice(5).replace("-", "/")).join(", ") + (av.fullDates.length > 5 ? ` 외 ${av.fullDates.length - 5}일` : "");
          alert(`⚠️ 죄송합니다 — 선택하신 기간 중 아래 날짜는 드림하우스 예약이 가득 찼습니다.\n\n만실: ${list}\n\n접수 전에 관리자에게 확인을 부탁드려요.\n(카카오 채널 또는 드림아카데미 상담 창구로 문의해주세요)`);
          setLoading(false);
          return;
        }
      } catch { /* 확인 실패 시 접수는 진행 (차단하지 않음) */ }
    }
    // 동명이인 자동 구분 (활성 예약에 같은 이름 있으면 B, C… 자동 부여)
    const uniq = await ensureUniqueBookerName(supabase as never, booker.name);
    if (uniq.changed) alert(`같은 이름의 예약이 이미 있어 "${uniq.name}"(으)로 접수됩니다.\n(동명이인 구분용 — 서비스는 동일하게 제공돼요)`);
    const { data: booking, error } = await supabase.from("bookings").insert({
      reservation_no: rno,
      booker_name: uniq.name,
      booker_english: booker.nameEng.trim(),
      booker_phone: booker.phone.trim() || null,
      extra_guardians: cleanGuardians,
      adults: 1 + cleanGuardians.length,
      children: childrenCount,
      students: JSON.stringify(enrichedStudents),
      accom_type: accomType,
      accom_weeks: accomWeeks,
      dh_weeks: usesDH ? accom.dh_weeks : null,
      jp_weeks: usesJP ? accom.jp_weeks : null,
      cn_period: usesCN ? accom.cn_period : null,
      jp_room_type: usesJP ? accom.jp_room_type : null,
      cn_room_type: usesCN ? accom.cn_room_type : null,
      seg1_type: isCombo ? segs[0].type : null,
      seg1_checkin: isCombo ? (segs[0].checkin || null) : null,
      seg1_checkout: isCombo ? (segs[0].checkout || null) : null,
      seg2_type: isCombo ? segs[1].type : null,
      seg2_checkin: isCombo ? (segs[1].checkin || null) : null,
      seg2_checkout: isCombo ? (segs[1].checkout || null) : null,
      checkin_date: isCombo ? (segs[0].checkin || null) : (dates.checkIn || null),
      checkout_date: isCombo ? (segs[1].checkout || null) : (dates.checkOut || null),
      pickup: bType === "commute" ? "불필요함" : "필요함",
      drop_off: bType === "commute" ? "불필요함" : "필요함",
      pickup_place: dates.pickupPlace,
      flight_in: flightInStr,
      flight_out: flightOutStr,
      special_request: specialRequest,
      status: "접수",
      payment_method: payMethod || null,
      agency: isDaon ? "다온맘" : null,
    }).select().single();

    if (error) { setLoading(false); alert("접수 실패: " + error.message); return; }

    // 동의 내역 보관 (증거용) — 실패해도 접수에는 영향 없음
    try {
      await supabase.from("booking_consents").insert({
        booking_id: booking?.id || null,
        reservation_no: rno,
        booker_name: booker.name.trim(),
        booking_type: bType,
        policy_version: REFUND_POLICY_VERSION,
        policy_keys: getRefundPolicyKeys(bType),
        agreed_text: "포함/불포함 사항을 확인하였고, 환불규정도 확인하였으며, 예약에 동의합니다.",
        holidays_notified: holidayHits.length > 0 ? holidayHits : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
    } catch { /* best-effort */ }

    // students 테이블에도 저장
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
      if (studentRows.length > 0) {
        await supabase.from("students").insert(studentRows);
      }
    }

    try {
      const pmLabel = payMethod === "cash_full" ? "현금 전액입금" : payMethod === "card_deposit" ? "카드 예약금 50만" : payMethod === "card_full" ? "카드 전액" : "예약금 후 상담";
      fetch("/api/notify/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "booking", payload: { name: uniq.name, accomType, weeks: accomWeeks, payMethod: pmLabel, daon: isDaon, rno } }) });
    } catch { /* noop */ }

    setLoading(false);
    setReservationNo(rno);
    setDone(true);
  }

  if (done) return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9}
.dw{max-width:500px;margin:0 auto;padding:60px 24px;text-align:center}
.dc{font-size:64px;margin-bottom:16px}
.dh{font-size:24px;font-weight:800;margin-bottom:12px}
.drn{font-size:20px;font-weight:700;color:#7c3aed;background:#f5f3ff;padding:12px 24px;border-radius:10px;display:inline-block;margin-bottom:16px}
.dp{font-size:14px;color:#6b7c93;line-height:1.8;margin-bottom:24px}
.dk{display:inline-block;padding:12px 28px;background:#fee500;color:#3c1e1e;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none}
    `}</style>
    <div className="dw">
      <div className="dc">✅</div>
      <div className="dh">예약 접수 완료!</div>
      <div className="drn">{reservationNo}</div>
      {payMethod === "cash_full" && (
        <div style={{ textAlign: "left", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "18px 18px", margin: "0 0 18px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#8a6414", letterSpacing: 0.5, marginBottom: 8 }}>PAYMENT INFORMATION · 입금 계좌</div>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.9 }}>카카오뱅크 3333-11-3947821<br/><span style={{ fontWeight: 600, fontSize: 13.5, color: "#4a5468" }}>예금주 : 오초희 (드림아카데미 대표)</span></div>
          <button type="button" onClick={() => { navigator.clipboard?.writeText("카카오뱅크 3333-11-3947821 오초희"); alert("계좌가 복사됐어요"); }} style={{ marginTop: 10, background: "#1f2937", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>📋 계좌번호 복사</button>
          <div style={{ fontSize: 13, color: "#b91c1c", fontWeight: 700, marginTop: 12, lineHeight: 1.7 }}>⚠️ 입금자명은 반드시 예약자명과 동일해야 해요.</div>
          <div style={{ fontSize: 12.5, color: "#6b7c93", marginTop: 6, lineHeight: 1.7 }}>정확한 결제 금액과 입금 확인은 카카오 채널로 안내드립니다.<br/>해외법인 사업자 자료(사업허가증·법인등록·대표자 여권)가 필요하시면 채널로 요청해주세요.</div>
        </div>
      )}
      {(payMethod === "card_deposit" || payMethod === "consult") && (
        <div style={{ textAlign: "left", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "18px 18px", margin: "0 0 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>💳 예약금 50만원 결제 안내</div>
          <div style={{ fontSize: 13, color: "#4a5468", lineHeight: 1.8 }}>스마트스토어에서 예약금 50만원을 카드로 결제해주세요.<br/>결제 링크는 카카오 채널로 바로 보내드려요.{payMethod === "consult" ? " 결제 후 매니저 상담으로 일정·인원·숙소를 확정합니다." : " 잔금은 인보이스로 안내드립니다."}</div>
        </div>
      )}
      {payMethod === "card_full" && (
        <div style={{ textAlign: "left", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, padding: "18px 18px", margin: "0 0 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>💳 카드 전액결제 안내</div>
          <div style={{ fontSize: 13, color: "#4a5468", lineHeight: 1.8 }}>전액 카드결제 링크를 카카오 채널로 바로 보내드려요.<br/>결제 확인 후 예약이 확정됩니다.</div>
        </div>
      )}
      <div className="dp">담당자가 확인 후 상세 안내를 드립니다.<br/>문의사항은 카카오톡으로 연락주세요.</div>
      <a className="dk" href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">카카오톡 문의하기</a>
    </div>
  </>);

  const showAccom = bType !== "commute";

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
.type-card:hover{border-color:#cbd5e1}
.type-card.on{border-color:#7c3aed;background:#f5f3ff}
.type-card .icon{font-size:26px;margin-bottom:4px}
.type-card .title{font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:2px}
.type-card.on .title{color:#7c3aed}
.type-card .desc{font-size:11px;color:#6b7c93}
.fr{display:flex;gap:8px;margin-bottom:10px}.fg{flex:1}
.fl{display:block;font-size:11px;font-weight:700;color:#6b7c93;margin-bottom:4px}.fl .req{color:#dc2626;margin-left:2px}
.fi,.fsl,.fta{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;background:#fff}
.fi:focus,.fsl:focus,.fta:focus{border-color:#7c3aed}
.fta{resize:vertical;min-height:70px}
.fhint{font-size:10px;color:#94a3b8;margin-top:3px}
.fl-checkbox{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#475569;cursor:pointer;margin-bottom:6px}
.fl-checkbox input{width:14px;height:14px;accent-color:#7c3aed}
.sc{position:relative;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:10px}
.sc-del{position:absolute;top:8px;right:8px;padding:4px 10px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700}
.sc-num{font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:8px}
.ab{padding:8px 16px;font-size:12px;font-weight:700;background:#f5f3ff;color:#7c3aed;border:1px solid #ddd6fe;border-radius:7px;cursor:pointer}.ab:hover{background:#ede9fe}
.flight-sec{background:#f0f7ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px;margin-bottom:10px}
.flight-sec .ft{font-size:13px;font-weight:700;color:#1e40af;margin-bottom:8px}
.warn{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:10px;font-size:12px;color:#374151;line-height:1.6}
.warn .wt{color:#dc2626;font-weight:800;font-size:13px;margin-bottom:4px}
.sb{width:100%;padding:15px;background:linear-gradient(135deg,#1a6fc4,#7c3aed);color:#fff;font-size:15px;font-weight:800;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:16px}
.sb:hover{opacity:0.95}.sb:disabled{opacity:0.5;cursor:not-allowed}
@media(max-width:500px){.type-grid{grid-template-columns:1fr}.fr{flex-direction:column;gap:10px}}
    `}</style>

    <div className="bw">
      <div className="bh"><h1>드림아카데미 예약 접수</h1><p>Dream Academy Reservation</p></div>
      <div className="bc">

        {/* 1. 예약 유형 */}
        <div className="bs">
          <h2>1️⃣ 예약 유형</h2>
          <div className="type-grid">
            {BOOKING_TYPES.map(t => (
              <div key={t.value} className={`type-card${bType === t.value ? " on" : ""}`} onClick={() => setBType(t.value as BookingType)}>
                <div className="icon">{t.icon}</div>
                <div className="title">{t.label}</div>
                <div className="desc">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. 숙소 상세 */}
        {showAccom && (
          <div className="bs">
            <h2>2️⃣ 숙소 기간</h2>
            <div className="fr">
              {(bType === "dreamhouse" || bType === "dreamhouse_jaypark" || bType === "dreamhouse_cubenine") && (
                <div className="fg">
                  <label className="fl">드림하우스 기간</label>
                  <select className="fsl" value={accom.dh_weeks} onChange={e => setAccom({ ...accom, dh_weeks: parseInt(e.target.value) })}>
                    {DH_WEEKS.map(w => <option key={w} value={w}>{w}주</option>)}
                  </select>
                </div>
              )}
              {(bType === "dreamhouse_jaypark" || bType === "jaypark" || bType === "jaypark_cubenine") && (
                <div className="fg">
                  <label className="fl">제이파크 기간</label>
                  <select className="fsl" value={accom.jp_weeks} onChange={e => setAccom({ ...accom, jp_weeks: parseInt(e.target.value) })}>
                    {[1, 2, 3, 4].map(w => <option key={w} value={w}>{w}주</option>)}
                  </select>
                </div>
              )}
              {(bType === "dreamhouse_jaypark" || bType === "jaypark" || bType === "jaypark_cubenine") && (
                <div className="fg">
                  <label className="fl">제이파크 룸타입</label>
                  <select className="fsl" value={accom.jp_room_type} onChange={e => setAccom({ ...accom, jp_room_type: e.target.value })}>
                    {["디럭스", "프리미어", "막탄스윗"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}
              {(bType === "dreamhouse_cubenine" || bType === "cubenine" || bType === "jaypark_cubenine") && (
                <div className="fg">
                  <label className="fl">큐브나인 기간</label>
                  <select className="fsl" value={accom.cn_period} onChange={e => setAccom({ ...accom, cn_period: e.target.value })}>
                    {CN_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
              {(bType === "dreamhouse_cubenine" || bType === "cubenine" || bType === "jaypark_cubenine") && (
                <div className="fg">
                  <label className="fl">큐브나인 룸타입</label>
                  <select className="fsl" value={accom.cn_room_type} onChange={e => setAccom({ ...accom, cn_room_type: e.target.value })}>
                    {["디럭스", "풀억세스룸"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              )}
            </div>

            {isCombo && (
              <div style={{ marginTop: 14, borderTop: "1px solid #eef2f7", paddingTop: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                  <label className="fl" style={{ margin: 0 }}>숙소 구간별 체크인·체크아웃 (순서대로)<span className="req">*</span></label>
                  <button type="button" onClick={() => setSegs([{ ...segs[1] }, { ...segs[0] }])} style={{ padding: "4px 10px", background: "#fff", border: "1px solid #3b82f6", color: "#3b82f6", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⇅ 순서 바꾸기</button>
                </div>
                {segs.map((sg, i) => (
                  <div key={i} className="fr" style={{ alignItems: "flex-end", marginBottom: 8 }}>
                    <div className="fg" style={{ maxWidth: 150 }}>
                      <label className="fl">{i + 1}번째 숙소</label>
                      <div style={{ padding: "9px 11px", background: "#eff6ff", borderRadius: 8, fontWeight: 700, fontSize: 14, color: "#1e40af" }}>{ACC_KR[sg.type] || sg.type}</div>
                    </div>
                    <div className="fg">
                      <label className="fl">체크인</label>
                      <input className="fi" type="date" value={sg.checkin} onChange={e => { const n = [...segs]; n[i] = { ...n[i], checkin: e.target.value }; setSegs(n); }} />
                    </div>
                    <div className="fg">
                      <label className="fl">체크아웃</label>
                      <input className="fi" type="date" value={sg.checkout} onChange={e => { const n = [...segs]; n[i] = { ...n[i], checkout: e.target.value }; setSegs(n); }} />
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: "#6b7c93" }}>예: 제이파크 6/13~7/11(4주) → 드림하우스 7/11~7/25(2주). 픽드랍·셔틀이 이 구간에 맞춰 연결됩니다.</div>
              </div>
            )}
          </div>
        )}

        {/* 3. 예약자 정보 */}
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
              <span style={{fontWeight: 400, fontSize: 12, color: "#6b7280", marginLeft: 8}}>
                — 예약자 외 동행 보호자가 있으면 입력해주세요
              </span>
            </div>
            {extraGuardians.map((g, idx) => (
              <div key={idx} className="fr" style={{marginBottom: 8, alignItems: "flex-end"}}>
                <div className="fg">
                  <label className="fl">보호자 {idx + 2} 한글<span className="req">*</span></label>
                  <input className="fi" value={g.kor} onChange={e => {
                    const next = [...extraGuardians];
                    next[idx] = {...next[idx], kor: e.target.value};
                    setExtraGuardians(next);
                  }} placeholder="홍길자" />
                </div>
                <div className="fg">
                  <label className="fl">보호자 {idx + 2} 영문<span className="req">*</span></label>
                  <input className="fi" value={g.eng} onChange={e => {
                    const next = [...extraGuardians];
                    next[idx] = {...next[idx], eng: e.target.value};
                    setExtraGuardians(next);
                  }} placeholder="Hong Gilja" />
                </div>
                <button type="button"
                  onClick={() => setExtraGuardians(extraGuardians.filter((_, i) => i !== idx))}
                  style={{padding: "8px 12px", background: "#fff", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 6, cursor: "pointer", fontSize: 12, marginBottom: 2}}>
                  제거
                </button>
              </div>
            ))}
            {extraGuardians.length < 2 && (
              <button type="button"
                onClick={() => setExtraGuardians([...extraGuardians, {kor: "", eng: ""}])}
                style={{padding: "6px 12px", background: "#fff", border: "1px solid #3b82f6", color: "#3b82f6", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600}}>
                + 보호자 추가 (현재 {1 + extraGuardians.length}명)
              </button>
            )}
          </div>
        </div>

        {/* 4. 통학형: 수업 일정만 / 그 외: 체크인 + 항공편 */}
        {bType === "commute" ? (
          <div className="bs">
            <h2>4️⃣ 수업 일정</h2>
            <div className="fr">
              <div className="fg">
                <label className="fl">수업시작<span className="req">*</span></label>
                <input className="fi" type="date" value={dates.checkIn} onChange={e => setDates({ ...dates, checkIn: e.target.value })} />
              </div>
              <div className="fg">
                <label className="fl">수업종료<span className="req">*</span></label>
                <input className="fi" type="date" value={dates.checkOut} onChange={e => setDates({ ...dates, checkOut: e.target.value })} />
              </div>
            </div>
            <div style={{fontSize:12,color:"#6b7c93",marginTop:4}}>* 통학형은 픽업/항공편이 없습니다.</div>
          </div>
        ) : (
          <div className="bs">
            <h2>4️⃣ 체크인 · 항공편</h2>
            <div className="fr">
              <div className="fg">
                <label className="fl">체크인{!isCombo && <span className="req">*</span>}</label>
                <input className="fi" type="date" value={dates.checkIn} readOnly={isCombo} onChange={e => { if (!isCombo) setDates({ ...dates, checkIn: e.target.value }); }} style={isCombo ? { background: "#f3f4f6" } : undefined} />
                {isCombo && <div style={{ fontSize: 11, color: "#6b7c93", marginTop: 3 }}>콤보는 위 &apos;숙소 구간&apos;에서 입력합니다</div>}
              </div>
              <div className="fg">
                <label className="fl">체크아웃 (자동)</label>
                <input className="fi" type="date" value={dates.checkOut} readOnly style={{ background: "#f3f4f6" }} />
              </div>
            </div>
            <div className="fg" style={{ marginBottom: 10 }}>
              <label className="fl">픽업 장소</label>
              <select className="fsl" value={dates.pickupPlace} onChange={e => setDates({ ...dates, pickupPlace: e.target.value })}>
                <option value="공항">공항</option>
                <option value="기타">기타</option>
              </select>
            </div>

            {/* 입국편 */}
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

            {/* 출국편 */}
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

        {/* 5. 학생 정보 */}
        <div className="bs">
          <h2>5️⃣ 학생 정보 ({students.length}/5)</h2>
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

        {/* 6. 특이사항 */}
        <div className="bs">
          <h2>6️⃣ 특이사항</h2>
          <div className="warn">
            <div className="wt">⚠️ 주의</div>
            아이의 특이사항(알레르기, 약 복용 등)은 꼭 기재해주세요. 미 안내 시 발생하는 문제에 대해 보호자가 책임지게 됩니다.
          </div>
          <textarea className="fta" placeholder="예) ADHD 약 복용 중, 특정 음식 알레르기, 기타 요청사항" value={specialRequest} onChange={e => setSpecialRequest(e.target.value)} />
        </div>

        {/* 패키지 포함/불포함 박스 */}
        <div style={{
          marginTop: 24,
          padding: 16,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
        }}>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#111",
            marginBottom: 12,
          }}>
            📦 패키지 안내
          </div>
          <div style={{display:"flex", gap:12, flexWrap:"wrap"}}>
            {getPackageAccoms(bType).map((accom, idx) => {
              const items = getInclusionsByAccom(accom);
              const label = accom === "dreamhouse" ? "드림하우스"
                          : accom === "jpark" ? "제이파크"
                          : "큐브나인";
              return (
                <div key={idx} style={{
                  flex: "1 1 280px",
                  minWidth: 240,
                  padding: 14,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                }}>
                  <div style={{fontSize:13, fontWeight:700, marginBottom:10, color:"#111"}}>
                    📦 {label} 패키지 포함 사항
                  </div>
                  {items.map((it, i) => (
                    <div key={i} style={{display:"flex", gap:8, marginBottom:8, alignItems:"flex-start"}}>
                      <span style={{fontSize:14, lineHeight:"18px", flexShrink:0}}>{it.icon}</span>
                      <div style={{fontSize:11.5, lineHeight:"17px"}}>
                        <span style={{fontWeight:600, color:"#111"}}>{it.title}</span>
                        {it.desc && <span style={{color:"#6b7280"}}> · {it.desc}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            <div style={{
              flex: "1 1 280px",
              minWidth: 240,
              padding: 14,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderLeft: "4px solid #ef4444",
              borderRadius: 10,
            }}>
              <div style={{fontSize:13, fontWeight:700, marginBottom:10, color:"#991b1b"}}>
                ⚠️ 불포함 사항 <span style={{fontSize:11, fontWeight:500}}>(별도 비용)</span>
              </div>
              {COMMON_EXCLUSIONS.map((it, i) => (
                <div key={i} style={{display:"flex", gap:8, marginBottom:8, alignItems:"flex-start"}}>
                  <span style={{fontSize:14, lineHeight:"18px", flexShrink:0}}>{it.icon}</span>
                  <div style={{fontSize:11.5, lineHeight:"17px"}}>
                    <span style={{fontWeight:600, color:"#991b1b"}}>{it.title}</span>
                    <span style={{color:"#7f1d1d"}}> · {it.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 기간 내 휴무일 안내 배너 (공용 컴포넌트) */}
        <HolidayBanner hits={holidayHits} />

        {/* 결제 방식 선택 */}
        <div className="bs">
          <h2>💳 결제 방식 선택<span className="req">*</span></h2>
          <div className="type-grid">
            <button type="button" className={"type-card" + (payMethod === "cash_full" ? " on" : "")} onClick={() => setPayMethod("cash_full")}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>💵 현금 전액입금</div>
              <div style={{ fontSize: 12, color: "#6b7c93", marginTop: 4 }}>현금가 + 전액입금 할인 최대 적용 · 접수 후 입금 계좌 안내</div>
            </button>
            <button type="button" className={"type-card" + (payMethod === "card_full" ? " on" : "")} onClick={() => setPayMethod("card_full")}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>💳 카드 전액결제</div>
              <div style={{ fontSize: 12, color: "#6b7c93", marginTop: 4 }}>전액을 카드로 · 결제 링크 안내</div>
            </button>
            <button type="button" className={"type-card" + (payMethod === "card_deposit" ? " on" : "")} onClick={() => setPayMethod("card_deposit")}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>💳 카드 예약금 (50만원)</div>
              <div style={{ fontSize: 12, color: "#6b7c93", marginTop: 4 }}>예약금만 카드로 · 잔금은 인보이스 안내</div>
            </button>
            <button type="button" className={"type-card" + (payMethod === "consult" ? " on" : "")} onClick={() => setPayMethod("consult")}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>🗓 예약금 결제 후 상담</div>
              <div style={{ fontSize: 12, color: "#6b7c93", marginTop: 4 }}>예약금 50만원 결제 후 매니저 상담으로 확정</div>
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#6b7c93", marginTop: 10, lineHeight: 1.7 }}>
            💡 현금(계좌이체) 결제는 <b>전액입금 할인</b>이 추가 적용돼요. 정확한 금액은 접수 후 안내드립니다.
          </div>
        </div>

        {/* 동의 체크박스 + 환불규정 보기 */}
        <div style={{
          marginTop: 16,
          padding: 14,
          background: "#fff",
          border: agreed ? "1px solid #10b981" : "1px solid #d1d5db",
          borderRadius: 10,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          transition: "border-color 0.15s",
        }}>
          <input
            type="checkbox"
            id="agreed-checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{
              width: 18,
              height: 18,
              marginTop: 2,
              flexShrink: 0,
              cursor: "pointer",
            }}
          />
          <label htmlFor="agreed-checkbox" style={{
            flex: 1,
            fontSize: 13,
            lineHeight: 1.5,
            color: "#374151",
            cursor: "pointer",
          }}>
            <strong style={{color:"#111"}}>포함/불포함 사항을 확인하였고, 환불규정도 확인하였으며, 예약에 동의합니다.</strong>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setPolicyOpen(true); }}
              style={{
                marginLeft: 8,
                padding: "3px 10px",
                fontSize: 12,
                background: "#fff",
                border: "1px solid #3b82f6",
                color: "#3b82f6",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              환불규정 보기 →
            </button>
          </label>
        </div>

        <button className="sb" onClick={submit} disabled={loading || !agreed}>
          {loading ? "접수 중..." : "예약 접수하기"}
        </button>
      </div>
    </div>

    <RefundPolicyModal
      open={policyOpen}
      onClose={() => setPolicyOpen(false)}
      policyKeys={getRefundPolicyKeys(bType)}
    />

    {/* 휴무일 안내 팝업 (공용 컴포넌트) */}
    <HolidayPopup hits={holidayPopup} onClose={() => setHolidayPopup(null)} />
  </>);
}
