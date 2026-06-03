"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resolvePortalSession } from "@/lib/portalSession";

// ── 셔틀 자동 생성 헬퍼 (public/shuttle 와 동일) ────────────────────
const SHUTTLE_HOLIDAYS = new Set([
  '2026-05-01','2026-05-29',
  '2026-06-12',
  '2026-08-09',
  '2026-10-30','2026-10-31',
  '2026-11-01','2026-11-27',
  '2026-12-24','2026-12-25','2026-12-31',
]);

const SHUTTLE_SPECIAL_MSG: Record<string,string> = {
  '2026-08-09': '⚠️ 아이언맨 도로통제로 투어셔틀 불가',
};

interface ShSlot { time: string; name: string; return: string; note?: string; }

function nthWeekday(d: Date) { return Math.ceil(d.getDate() / 7); }

function getShSlots(dateStr: string): ShSlot[] | 'holiday' {
  if (SHUTTLE_HOLIDAYS.has(dateStr)) return 'holiday';
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  const odd = nthWeekday(d) % 2 === 1;
  const S_HMART    = { time:'10:00am', return:'11:00',          note:'' };
  const S_ILCORSO  = { time:'4:00pm',  return:'2시간 30분 후',   note:'' };
  const S_ANJO     = { time:'1:00pm',  return:'20:00',           note:'' };
  const S_FUNPARK  = { time:'2:00pm',  return:'20:00',           note:'' };
  const S_SAFARI   = { time:'8:30am',  return:'15:00',           note:'유료 200페소' };
  const S_SHRINE   = { time:'5:30pm',  return:'40분 후',         note:'' };
  const S_LANTAW   = { time:'4:00pm',  return:'2시간 30분 후',   note:'' };
  const S_PAROLA   = { time:'4:40pm',  return:'식사 후',         note:'별도 출발시간 없음' };
  const S_SMSEASIDE= { time:'10:30am', return:'-',               note:'개별 복귀' };

  const hmart: ShSlot[] = [{ name:'H-Mart 쇼핑', ...S_HMART }];
  if (dow===1||dow===3||dow===5) return hmart;
  if (dow===2) return odd
    ? [{ name:'파롤라 (Parola)',       ...S_PAROLA }]
    : [{ name:'SM 씨사이드 쇼핑',      ...S_SMSEASIDE }];
  if (dow===4) return odd
    ? [{ name:'SM 씨사이드 쇼핑',      ...S_SMSEASIDE }]
    : [{ name:'막탄 쉬라인',           ...S_SHRINE }];
  if (dow===6) return odd
    ? [{ name:'세부 사파리',           ...S_SAFARI },
       { name:'일콜소 (Il Corso)',     ...S_ILCORSO }]
    : [{ name:'펀파크 (Fun Park)',     ...S_FUNPARK },
       { name:'란타우 (Lantaw)',       ...S_LANTAW }];
  if (dow===0) return odd
    ? [{ name:'안조 월드 (Anjo World)',...S_ANJO },
       { name:'란타우 (Lantaw)',       ...S_LANTAW }]
    : [{ name:'세부 사파리',           ...S_SAFARI },
       { name:'일콜소 (Il Corso)',     ...S_ILCORSO }];
  return [];
}

function slotSlug(name: string): string {
  if (name.startsWith('H-Mart')) return 'hmart';
  if (name.startsWith('파롤라')) return 'parola';
  if (name.startsWith('SM')) return 'smseaside';
  if (name.startsWith('막탄')) return 'shrine';
  if (name.startsWith('세부')) return 'safari';
  if (name.startsWith('펀파크')) return 'funpark';
  if (name.startsWith('란타우')) return 'lantaw';
  if (name.startsWith('안조')) return 'anjo';
  if (name.startsWith('일콜소')) return 'ilcorso';
  return 'shuttle';
}

// slug → 투어명 역매핑 (data-* 폴백용)
const SLUG_TO_NAME: Record<string, string> = {
  hmart: 'H-Mart 쇼핑',
  parola: '파롤라 (Parola)',
  smseaside: 'SM 씨사이드 쇼핑',
  shrine: '막탄 쉬라인',
  safari: '세부 사파리',
  funpark: '펀파크 (Fun Park)',
  lantaw: '란타우 (Lantaw)',
  anjo: '안조 월드 (Anjo World)',
  ilcorso: '일콜소 (Il Corso)',
};

const DAY_KR = ['일','월','화','수','목','금','토'];

// 주차 단위: 화요일 시작 ~ 다음주 월요일 종료. rangeStart/End 안에서만 포함.
function buildShWeeks(year: number, month: number, rangeStart?: string, rangeEnd?: string) {
  type Item = { dateStr:string; dayLabel:string; slots: ShSlot[]|'holiday'; special?:string };
  const days = new Date(year, month, 0).getDate();
  const weeks: { label: string; items: Item[] }[] = [];
  let week: Item[] = [];
  const flush = () => {
    if (week.length === 0) return;
    const first = week[0], last = week[week.length-1];
    const fD = new Date(first.dateStr + 'T00:00:00');
    const lD = new Date(last.dateStr + 'T00:00:00');
    const label = `${fD.getMonth()+1}/${fD.getDate()} ${DAY_KR[fD.getDay()]} ~ ${lD.getMonth()+1}/${lD.getDate()} ${DAY_KR[lD.getDay()]}`;
    weeks.push({ label, items: week });
    week = [];
  };
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month-1, d);
    const dow = date.getDay();
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (rangeStart && dateStr < rangeStart) continue;
    if (rangeEnd && dateStr > rangeEnd) continue;
    // 화요일(=2)에 도달하면 직전 주차 마감
    if (dow === 2 && week.length > 0) flush();
    week.push({ dateStr, dayLabel:`${month}/${d} (${DAY_KR[dow]})`, slots: getShSlots(dateStr), special: SHUTTLE_SPECIAL_MSG[dateStr] });
    if (d === days) flush();
  }
  return weeks;
}

const ALL_MONTHS = ['5','6','7','8','9','10','11','12'];

interface PortalSession { booking_id: string; guest_name: string; expires: number }

type SelectedTour = { value: string; tourName: string; date: string; departTime: string; people: number };

export default function PortalShuttlePage() {
  const router = useRouter();
  const [session, setSession] = useState<PortalSession | null>(null);
  const [bookingMeta, setBookingMeta] = useState<{ checkin: string; checkout: string; room: string } | null>(null);
  const [modalHidden, setModalHidden] = useState(false);
  const [modalHiding, setModalHiding] = useState(false);
  const [activeMonth, setActiveMonth] = useState("");
  const [accordionState, setAccordionState] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [selectedTours, setSelectedTours] = useState<SelectedTour[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  // 예약 기간 + 숙소 정보 로드 (room_number 자동기입 + 월/주차 필터용)
  useEffect(() => {
    if (!session?.booking_id) return;
    fetch(`/api/bookings/${session.booking_id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const b = d?.booking || d;
        if (!b) return;
        const ci = String(b.check_in || b.checkin_date || '').slice(0, 10);
        const co = String(b.check_out || b.checkout_date || '').slice(0, 10);
        const room = String(b.house_no || b.accom_room || b.accom_type || '').trim();
        setBookingMeta({ checkin: ci, checkout: co, room });
      })
      .catch(() => {});
  }, [session]);

  // 예약 기간 내 월만 노출 + 첫 월 기본 선택
  const visibleMonths = (() => {
    if (!bookingMeta?.checkin || !bookingMeta?.checkout) return ALL_MONTHS;
    const sM = parseInt(bookingMeta.checkin.slice(5, 7), 10);
    const eM = parseInt(bookingMeta.checkout.slice(5, 7), 10);
    const sY = parseInt(bookingMeta.checkin.slice(0, 4), 10);
    const eY = parseInt(bookingMeta.checkout.slice(0, 4), 10);
    return ALL_MONTHS.filter(m => {
      const mi = parseInt(m, 10);
      const inS = sY < 2026 || (sY === 2026 && mi >= sM);
      const inE = eY > 2026 || (eY === 2026 && mi <= eM);
      return inS && inE;
    });
  })();

  useEffect(() => {
    if (visibleMonths.length === 0) return;
    if (!activeMonth || !visibleMonths.includes(activeMonth)) {
      setActiveMonth(visibleMonths[0]);
    }
  }, [visibleMonths.join(','), activeMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const STORAGE_KEY = "shuttle_rules_confirmed";
  const FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbwqK13BTYKhX4HqJHxJCotHP2X2lbtdRptQkW-j9A6-ZffkRtt1B8v1IKwIZ6uMBM4/exec";

  // 포털 세션 체크
  useEffect(() => {
    (async () => {
      const s = await resolvePortalSession();
      if (!s) { router.replace("/portal"); return; }
      setSession(s as PortalSession);
    })();
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && Date.now() < parseInt(saved, 10)) {
      setModalHidden(true);
    }
  }, []);

  // Disable expired schedules
  useEffect(() => {
    function getPHTNow() {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      return new Date(utc + 8 * 3600000);
    }

    const pht = getPHTNow();

    document.querySelectorAll(".schedule-item").forEach((item) => {
      const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (!checkbox) return;
      const val = checkbox.value;
      const parts = val.split("-");
      if (parts.length < 2) return;
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      const year = pht.getFullYear();
      const scheduleDate = new Date(year, month - 1, day);
      const scheduleDow = scheduleDate.getDay();

      let isExpired = false;

      if (scheduleDow === 1) {
        const deadline = new Date(scheduleDate);
        deadline.setDate(deadline.getDate() - 3);
        deadline.setHours(16, 50, 0, 0);
        isExpired = pht >= deadline;
      } else {
        const deadline = new Date(scheduleDate);
        deadline.setDate(deadline.getDate() - 1);
        deadline.setHours(16, 50, 0, 0);
        isExpired = pht >= deadline;
      }

      if (isExpired) {
        checkbox.disabled = true;
        (item as HTMLElement).style.opacity = "0.38";
        (item as HTMLElement).style.cursor = "not-allowed";
        (item as HTMLElement).style.transform = "none";
        (item as HTMLElement).title = scheduleDow === 1
          ? "신청 마감 (금요일 16:50 PHT 기준)"
          : "신청 마감 (전날 16:50 PHT 기준)";
        checkbox.checked = false;
      }
    });
  }, [activeMonth, accordionState]);

  // 월 변경 시 1주차 자동 펼침
  useEffect(() => {
    setAccordionState(prev => {
      const key = `${activeMonth}-1`;
      if (prev[key] !== undefined) return prev;
      return { ...prev, [key]: true };
    });
  }, [activeMonth]);

  const closeModal = useCallback((noShow: boolean) => {
    if (noShow) {
      localStorage.setItem(STORAGE_KEY, (Date.now() + 30 * 24 * 60 * 60 * 1000).toString());
    }
    setModalHiding(true);
    setTimeout(() => {
      setModalHidden(true);
      setModalHiding(false);
    }, 200);
  }, []);

  const toggleAccordion = (key: string) => {
    setAccordionState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return;

    if (selectedTours.length === 0) {
      alert("투어를 최소 1개 이상 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData(form);
      formData.delete("schedule");
      const scheduleString = selectedTours.map(t => t.value).join(", ");
      formData.append("schedule", scheduleString);
      formData.set("guestName", session.guest_name);
      const res = await fetch(FORM_ENDPOINT, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Network error");

      // Supabase 동시 저장 — selectedTours 1개당 row 1개씩 INSERT
      const memo = (formData.get("memo") as string) || "";
      const rows = selectedTours.map(t => ({
        booking_id: session.booking_id,
        portal_name: session.guest_name,
        name: session.guest_name,
        tour_name: t.tourName,
        tour_date: t.date,
        depart_time: t.departTime,
        people_count: t.people,
        room_number: bookingMeta?.room || "",
        message: memo,
        request: memo,
        status: "pending",
      }));
      console.log("[shuttle insert] rows:", rows);
      const { error: insErr } = await supabase.from("shuttle_applications").insert(rows);
      if (insErr) console.warn("[shuttle insert] failed:", insErr);

      alert("신청 완료! 예약현황에서 확인하세요.");
      if (formRef.current) formRef.current.reset();
      setSelectedTours([]);
    } catch (err) {
      console.error(err);
      alert("전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const noShowRef = useRef<HTMLInputElement>(null);

  if (!session) return null;

  return (
    <>
      <style>{`
      :root {
        --bg: #fbfaf7; --card: #ffffff; --text: #1f1f1f; --muted: #8f8f8f;
        --accent: #2563eb; --accent-soft: #ebf2ff;
        --stroke: rgba(17,24,39,0.06); --shadow: 0 18px 40px rgba(17,24,39,0.08);
        --focus: rgba(37,99,235,0.4); --danger: #e11d48;
      }
      * { box-sizing: border-box; }
      .wrap { min-height: 100%; display: flex; justify-content: center; padding: 32px 18px 40px; }
      .page { width: min(960px, 100%); display: grid; gap: 18px; }
      .top-bar { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--muted); }
      .back-link { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,0.9); border: 1px solid rgba(148,163,184,0.35); text-decoration: none; font-weight: 500; transition: background 140ms, transform 140ms, box-shadow 140ms; cursor: pointer; font-family: inherit; color: inherit; }
      .back-link:hover { background: #f8fafc; transform: translateY(-0.5px); box-shadow: 0 10px 22px rgba(15,23,42,0.12); }
      .title { margin-top: 6px; }
      .title h1 { margin: 0; font-size: clamp(26px,3.3vw,34px); font-weight: 800; letter-spacing: -0.03em; }
      .title p { margin: 10px 0 0; color: var(--muted); font-size: 14px; }
      .greeting { margin-top: 14px; padding: 14px 18px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 14px; font-size: 14px; color: #1e3a8a; font-weight: 600; }
      .layout { display: grid; grid-template-columns: minmax(0,1.6fr) minmax(0,1.1fr); gap: 20px; margin-top: 10px; }
      .card { background: var(--card); border-radius: 20px; padding: 22px 22px 20px; box-shadow: var(--shadow); border: 1px solid var(--stroke); }
      .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
      .card-title { font-size: 16px; font-weight: 700; }
      .chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 999px; background: var(--accent-soft); color: #1d4ed8; font-size: 11px; font-weight: 600; }
      .notice { margin: 0 0 14px; font-size: 13px; color: var(--muted); line-height: 1.5; }
      .notice strong { color: #4b5563; }
      form { display: grid; gap: 14px; }
      .field { display: grid; gap: 6px; }
      .field-row { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
      label span.required { color: var(--danger); margin-left: 2px; }
      .label-main { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; }
      .label-sub { margin-top: 2px; font-size: 12px; color: var(--muted); }
      input[type="text"], input[type="number"], select, textarea { width: 100%; padding: 9px 11px; border-radius: 11px; border: 1px solid rgba(148,163,184,0.6); background: #f9fafb; font-size: 13px; font-family: inherit; transition: border-color 120ms, box-shadow 120ms, background 120ms; }
      input:focus-visible, select:focus-visible, textarea:focus-visible { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px var(--focus); background: #fff; }
      textarea { min-height: 80px; resize: vertical; }
      .radio-group { display: flex; flex-wrap: wrap; gap: 8px; }
      .radio-pill { position: relative; display: inline-flex; align-items: center; gap: 4px; padding: 7px 11px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.7); background: #f9fafb; font-size: 12px; cursor: pointer; transition: background 120ms, border-color 120ms; }
      .radio-pill input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
      .radio-pill span.bullet { width: 8px; height: 8px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.9); background: #fff; flex-shrink: 0; }
      .radio-pill input:checked ~ span.bullet { background: #2563eb; border-color: #2563eb; }
      .radio-pill input:checked ~ span.text { color: #1d4ed8; font-weight: 600; }
      .helper { margin-top: 4px; font-size: 12px; color: #9ca3af; }
      .agree { margin-top: 2px; display: flex; gap: 8px; font-size: 12px; color: #4b5563; align-items: flex-start; }
      .agree input[type="checkbox"] { margin-top: 2px; width: 14px; height: 14px; }
      .month-toggle { margin-top: 8px; display: inline-flex; padding: 3px; border-radius: 999px; background: #f3f4f6; gap: 3px; }
      .month-toggle button { border: none; background: transparent; padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; transition: background 120ms, color 120ms, box-shadow 120ms, transform 120ms; font-family: inherit; }
      .month-toggle button[data-active="true"] { background: #fff; color: #1f2937; box-shadow: 0 8px 18px rgba(15,23,42,0.12); transform: translateY(-0.5px); }
      .month-panel { display: none; }
      .month-panel[data-visible="true"] { display: block; }
      .month-label { margin-top: 8px; font-size: 12px; font-weight: 600; color: #6b7280; }
      .month-hint { margin-top: 6px; font-size: 12px; color: #9ca3af; }
      .week-section { margin-top: 10px; }
      .week-divider { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
      .week-divider span { font-size: 11px; font-weight: 600; color: #9ca3af; white-space: nowrap; }
      .week-divider::after { content: ''; flex: 1; height: 1px; background: rgba(148,163,184,0.3); }
      .schedule-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
      .schedule-item { border-radius: 12px; border: 1px solid rgba(148,163,184,0.7); padding: 8px 10px; display: flex; align-items: flex-start; gap: 8px; background: #f9fafb; cursor: pointer; font-size: 12px; transition: background 120ms, border-color 120ms, box-shadow 120ms, transform 120ms; }
      .schedule-item:hover { background: #fff; border-color: #2563eb; box-shadow: 0 10px 22px rgba(15,23,42,0.08); transform: translateY(-1px); }
      .schedule-item input { margin-top: 3px; flex-shrink: 0; }
      .schedule-label { display: grid; gap: 2px; }
      .schedule-main { font-weight: 600; }
      .schedule-sub { color: #6b7280; line-height: 1.4; }
      .schedule-item.weekend { background: #fff7ed; border-color: #fed7aa; }
      .schedule-item.weekend:hover { background: #fff; border-color: #f97316; }
      .schedule-item.weekend .schedule-main { color: #c2410c; }
      .submit-row { margin-top: 4px; display: flex; justify-content: flex-end; gap: 8px; }
      .btn { border: none; border-radius: 999px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; transition: background 140ms, transform 140ms, box-shadow 140ms, opacity 120ms; }
      .btn-primary { background: #2563eb; color: #fff; box-shadow: 0 14px 30px rgba(37,99,235,0.35); }
      .btn-primary:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 18px 40px rgba(37,99,235,0.4); }
      .btn-secondary { background: rgba(15,23,42,0.03); color: #4b5563; }
      .btn-secondary:hover { background: rgba(15,23,42,0.06); }
      .btn:disabled { opacity: 0.7; cursor: default; transform: none; box-shadow: none; }
      .rules { font-size: 13px; color: #4b5563; line-height: 1.6; }
      .rules h2 { margin: 0 0 8px; font-size: 15px; }
      .rules-section + .rules-section { margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(148,163,184,0.6); }
      .rules ul { margin: 4px 0 0; padding-left: 18px; }
      .rules li { margin: 2px 0; }
      .rules .tagline { font-size: 12px; color: var(--muted); }
      .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 999px; background: #fef3c7; color: #92400e; font-size: 11px; margin-bottom: 4px; }
      @media (max-width: 840px) { .layout { grid-template-columns: minmax(0,1fr); } .wrap { padding-top: 20px; } }
      @media (max-width: 480px) { .field-row, .schedule-grid { grid-template-columns: minmax(0,1fr); } }

      .week-accordion { margin-top: 6px; border-radius: 14px; border: 1px solid rgba(148,163,184,0.4); overflow: hidden; }
      .week-accordion-btn {
        width: 100%; display: flex; align-items: center; justify-content: space-between;
        padding: 11px 14px; background: #f8fafc; border: none; cursor: pointer;
        font-family: inherit; font-size: 13px; font-weight: 700; color: #374151;
        transition: background 120ms;
      }
      .week-accordion-btn:hover { background: #f1f5f9; }
      .week-accordion-btn[data-open="true"] { background: #eff6ff; color: #1d4ed8; }
      .week-acc-title em { font-style: normal; font-weight: 400; color: #9ca3af; margin-left: 6px; font-size: 12px; }
      .week-acc-arrow { font-size: 12px; transition: transform 200ms ease; display: inline-block; }
      .week-accordion-btn[data-open="true"] .week-acc-arrow { transform: rotate(180deg); }
      .week-accordion-body { display: none; padding: 10px 12px 12px; }
      .week-accordion-body[data-open="true"] { display: block; }

      .schedule-item input[type="checkbox"] {
        width: 15px; height: 15px; border-radius: 4px;
        accent-color: #2563eb; flex-shrink: 0; margin-top: 3px; cursor: pointer;
      }
      .schedule-item:has(input[type="checkbox"]:checked) {
        background: #eff6ff !important; border-color: #2563eb !important;
        box-shadow: 0 4px 12px rgba(37,99,235,0.15);
      }
      .schedule-item.weekend:has(input[type="checkbox"]:checked) {
        background: #fff7ed !important; border-color: #f97316 !important;
      }

      .schedule-item:has(input:disabled) {
        opacity: 0.38 !important;
        cursor: not-allowed !important;
        transform: none !important;
        pointer-events: none;
      }
      .schedule-item:has(input:disabled) .schedule-main::after {
        content: " \\b7  마감";
        font-size: 10px;
        font-weight: 600;
        color: #9ca3af;
        background: #f3f4f6;
        padding: 1px 5px;
        border-radius: 4px;
        margin-left: 4px;
        vertical-align: middle;
      }

      .modal-backdrop {
        position: fixed; inset: 0; z-index: 999;
        background: rgba(15,23,42,0.45);
        backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        opacity: 1; transition: opacity 200ms ease;
      }
      .modal-backdrop.hiding { opacity: 0; pointer-events: none; }

      .modal {
        background: #fff; border-radius: 24px;
        padding: 28px 28px 24px;
        width: min(520px, 100%);
        max-height: 80vh; overflow-y: auto;
        box-shadow: 0 32px 64px rgba(15,23,42,0.2);
        border: 1px solid var(--stroke);
        transform: translateY(0); transition: transform 200ms ease;
      }
      .modal-backdrop.hiding .modal { transform: translateY(12px); }

      .modal-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
      .modal-title { font-size: 18px; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
      .modal-subtitle { font-size: 13px; color: var(--muted); margin: 4px 0 0; }

      .modal-icon { width: 40px; height: 40px; border-radius: 12px; background: #fff7ed; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }

      .modal-rules { font-size: 13px; color: #4b5563; line-height: 1.65; }
      .modal-rules h3 { margin: 14px 0 4px; font-size: 13px; font-weight: 700; color: #1f2937; padding-bottom: 4px; border-bottom: 1px dashed rgba(148,163,184,0.4); }
      .modal-rules h3:first-child { margin-top: 0; }
      .modal-rules ul { margin: 4px 0 0; padding-left: 16px; }
      .modal-rules li { margin: 3px 0; }

      .modal-footer { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
      .modal-no-show { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #6b7280; cursor: pointer; user-select: none; }
      .modal-no-show input { width: 14px; height: 14px; cursor: pointer; }
      .modal-confirm { width: 100%; padding: 13px; border: none; border-radius: 999px; background: #2563eb; color: #fff; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; box-shadow: 0 14px 30px rgba(37,99,235,0.35); transition: background 140ms, transform 140ms, box-shadow 140ms; }
      .modal-confirm:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 18px 40px rgba(37,99,235,0.4); }
      .modal-confirm:active { transform: translateY(0); }
      `}</style>

      {!modalHidden && (
        <div className={`modal-backdrop${modalHiding ? " hiding" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="modal-title" id="modal-title">셔틀 이용 전 꼭 확인해 주세요</p>
                <p className="modal-subtitle">아래 규정을 확인하신 후 신청이 가능합니다.</p>
              </div>
              <div className="modal-icon">🚌</div>
            </div>
            <div className="modal-rules">
              <h3>📋 신청 및 운영 안내</h3>
              <ul>
                <li>드림아카데미 패키지에는 투어 셔틀 서비스가 포함되어 있습니다.</li>
                <li>모든 셔틀 신청은 <strong>사전 예약제</strong>로 운영됩니다.</li>
                <li><strong>월–금 오후 4시 50분까지 신청 가능</strong>하며, <strong>토·일 및 당일 신청은 불가</strong>합니다.</li>
                <li>탑승 전날 16:50까지 신청해야 하며, 주말이 낀 경우 안내된 기준을 따릅니다.</li>
                <li>셔틀 스케쥴은 <strong>현지 사정에 따라 변경될 수 있으며</strong>, 최신 일정은 사이트 공지를 기준으로 합니다.</li>
              </ul>
              <h3>🏠 드림하우스 / 제이파크 / 큐브나인</h3>
              <ul>
                <li>이 신청 페이지와 드림센터/공식 채널을 통해 접수된 내용만 셔틀 예약에 반영됩니다.</li>
                <li>체크인 시 안내된 숙소 투숙객만 신청할 수 있습니다.</li>
                <li>일정 변경/취소는 사이트에서 직접만 가능하며, 헬퍼/현지 매니저/채널로는 불가합니다.</li>
              </ul>
              <h3>⚠️ 취소 및 이용 제한</h3>
              <ul>
                <li><strong>당일 무단 취소 1회</strong> 시, 이후 셔틀 신청이 제한될 수 있습니다.</li>
                <li><strong>취소 2회 누적</strong> 시, 이후 셔틀 신청 불가 기준이 적용됩니다.</li>
              </ul>
              <h3>🚗 탑승 중 유의사항</h3>
              <ul>
                <li>정해진 픽업·드롭 장소 외 중도 승·하차는 불가합니다.</li>
                <li>가는 차량을 탑승하지 않고 돌아오는 차량만 탑승하는 것은 불가합니다.</li>
                <li>가는 차량만 탑승하는 것은 가능합니다.</li>
                <li>최대 정원 내에서만 베이비시터 동반 탑승이 가능합니다.</li>
                <li>투어 셔틀은 <strong>투숙객 전용 서비스</strong>로, 외부인은 탑승이 불가합니다.</li>
                <li>정원 외 탑승은 안전상 절대 허용되지 않습니다.</li>
              </ul>
              <p style={{fontSize:12, color:"var(--muted)", marginTop:12}}>자세한 셔틀 시간표는 드림센터 내부 공지를 기준으로 합니다.</p>
            </div>
            <div className="modal-footer">
              <label className="modal-no-show">
                <input type="checkbox" ref={noShowRef} />
                다시 보지 않기 (30일간)
              </label>
              <button className="modal-confirm" onClick={() => closeModal(noShowRef.current?.checked ?? false)}>✓ 확인했습니다. 신청하러 가기</button>
            </div>
          </div>
        </div>
      )}

      <main className="wrap">
        <section className="page">
          <header className="top-bar">
            <button type="button" className="back-link" onClick={() => router.push("/portal/dashboard")}>← 마이페이지로 돌아가기</button>
            <span>드림아카데미 투어 셔틀 신청</span>
          </header>
          <div className="title">
            <h1>투어 셔틀 신청</h1>
            <p>이용하실 날짜와 장소, 인원 정보를 간단히 남겨 주세요. 규정 확인 후 사전 예약제로 운영됩니다.</p>
          </div>
          <div className="greeting">안녕하세요, {session.guest_name}님 👋</div>
          <div className="layout">
            <section className="card">
              <div style={{
                display:"flex",
                alignItems:"center",
                gap:14,
                padding:"14px 16px",
                background:"#eff6ff",
                border:"1px solid #bfdbfe",
                borderRadius:14,
                marginBottom:18,
              }}>
                <div style={{fontSize:24, lineHeight:1}}>📋</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:14, fontWeight:700, color:"#1e3a8a", marginBottom:3, lineHeight:1.3}}>월~금 오후 4시 50분까지 신청 가능</div>
                  <div style={{fontSize:12, color:"#475569", lineHeight:1.4}}>토·일 및 당일 신청 불가 · 탑승 전날 16:50까지</div>
                </div>
                <div className="chip" style={{flexShrink:0}}>● 사전 예약제</div>
              </div>
              <form id="shuttle-form" ref={formRef} onSubmit={handleSubmit}>
                <div className="field">
                  <p className="label-main" style={{fontSize:16, fontWeight:600}}>셔틀 스케쥴에서 선택<span className="required">*</span></p>
                  <p className="label-sub">이용하실 날짜와 장소를 <strong>복수 선택</strong>할 수 있습니다. <span style={{ color: '#c2410c', fontWeight: 600 }}>주황색</span>은 주말 일정입니다.</p>
                  <div className="month-toggle">
                    {visibleMonths.map(m => (
                      <button key={m} type="button" data-active={activeMonth === m ? "true" : "false"} onClick={() => setActiveMonth(m)}>{m}월</button>
                    ))}
                  </div>
                  <div className="month-schedules">
                    {visibleMonths.includes(activeMonth) && buildShWeeks(2026, parseInt(activeMonth, 10), bookingMeta?.checkin, bookingMeta?.checkout).map((wk, wi) => {
                      const key = `${activeMonth}-${wi+1}`;
                      const isOpen = !!accordionState[key];
                      const m = parseInt(activeMonth, 10);
                      if (wk.items.length === 0) return null;
                      return (
                        <div key={key} className="week-accordion">
                          <button type="button" className="week-accordion-btn" data-open={isOpen ? "true" : "false"} onClick={() => toggleAccordion(key)}>
                            <span className="week-acc-title">{wk.label}</span>
                            <span className="week-acc-arrow">▾</span>
                          </button>
                          <div className="week-accordion-body" data-open={isOpen ? "true" : "false"}>
                            <div className="schedule-grid">
                              {wk.items.flatMap((item, ii) => {
                                if (item.slots === 'holiday') {
                                  return [(
                                    <div key={`h-${ii}`} className="schedule-item" style={{background:'#fef2f2',border:'1px solid #fecaca',opacity:0.85,cursor:'default'}}>
                                      <div>
                                        <div style={{fontWeight:700,color:'#dc2626',fontSize:13}}>{item.dayLabel} · 🚫 휴무</div>
                                        {item.special && <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{item.special}</div>}
                                        <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>셔틀 미운영 · 식사 정상 제공</div>
                                      </div>
                                    </div>
                                  )];
                                }
                                const d = parseInt(item.dateStr.slice(8,10), 10);
                                const isWeekend = item.dayLabel.includes('(토)') || item.dayLabel.includes('(일)');
                                const isMulti = item.slots.length > 1;
                                return item.slots.map((sl, si) => (
                                  <label key={`${item.dateStr}-${si}`} className={`schedule-item${isWeekend ? ' weekend' : ''}`}>
                                    <input
                                      type="checkbox"
                                      name="schedule"
                                      value={`${m}-${d}-${si}-${slotSlug(sl.name)}`}
                                      data-tour-name={sl.name}
                                      data-date={item.dateStr}
                                      onChange={(e) => {
                                        const target = e.currentTarget;
                                        const myValue = target.value;
                                        // selectedTours 업데이트
                                        if (target.checked) {
                                          setSelectedTours(prev => prev.some(t => t.value === myValue) ? prev : [...prev, {
                                            value: myValue,
                                            tourName: sl.name,
                                            date: item.dateStr,
                                            departTime: sl.time,
                                            people: 1,
                                          }]);
                                        } else {
                                          setSelectedTours(prev => prev.filter(t => t.value !== myValue));
                                        }
                                        // 같은 날짜 sibling 잠금 (multi-slot 날짜만)
                                        if (!isMulti) return;
                                        const grid = target.closest('.schedule-grid');
                                        if (!grid) return;
                                        const siblings = grid.querySelectorAll<HTMLInputElement>(`input[name="schedule"][value^="${m}-${d}-"]`);
                                        siblings.forEach(cb => {
                                          if (cb === target) return;
                                          if (target.checked) {
                                            if (!cb.disabled) {
                                              cb.disabled = true;
                                              cb.dataset.lockedBySibling = '1';
                                            }
                                          } else if (cb.dataset.lockedBySibling === '1') {
                                            cb.disabled = false;
                                            delete cb.dataset.lockedBySibling;
                                          }
                                        });
                                      }}
                                    />
                                    <div className="schedule-label">
                                      <span className="schedule-main">{item.dayLabel} · {sl.name}</span>
                                      <span className="schedule-sub">출발 {sl.time.replace(/(am|pm)$/i, '')} · 복귀 {sl.return}</span>
                                      {sl.note && <span style={{color:'#dc2626', fontSize:11, fontWeight:600, marginTop:2}}>❗ {sl.note}</span>}
                                    </div>
                                  </label>
                                ));
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="month-hint">※ 자세한 일정과 변경 사항은 드림센터 공지 및 현지 안내를 기준으로 합니다.</p>
                </div>

                <div className="field">
                  <label className="label-main" style={{fontSize:16, fontWeight:600}}>선택한 투어<span className="required">*</span></label>
                  {selectedTours.length === 0 ? (
                    <div style={{padding:"14px 16px", background:"#f9fafb", border:"1px dashed #cbd5e1", borderRadius:10, fontSize:13, color:"#94a3b8", textAlign:"center"}}>위에서 투어를 선택해주세요</div>
                  ) : (
                    <div style={{display:"flex", flexDirection:"column", gap:8}}>
                      {selectedTours.map(t => {
                        const dt = new Date(t.date + "T00:00:00");
                        const dow = isNaN(dt.getTime()) ? "" : ["일","월","화","수","목","금","토"][dt.getDay()];
                        const md = isNaN(dt.getTime()) ? t.date : `${dt.getMonth()+1}/${dt.getDate()}`;
                        return (
                          <div key={t.value} style={{display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:10}}>
                            <div style={{flex:1, minWidth:0}}>
                              <div style={{fontSize:13, fontWeight:700, color:"#1a1a2e"}}>{md}{dow && ` (${dow})`} · {t.tourName}</div>
                              <div style={{fontSize:11, color:"#6b7280", marginTop:2}}>출발 {t.departTime.replace(/(am|pm)$/i, '')}</div>
                            </div>
                            <input
                              type="number"
                              min={1}
                              max={6}
                              value={t.people}
                              onChange={e => {
                                const n = Math.max(1, Math.min(6, Number(e.target.value) || 1));
                                setSelectedTours(prev => prev.map(x => x.value === t.value ? { ...x, people: n } : x));
                              }}
                              style={{ width:60, padding:"6px 8px", border:"1px solid #cbd5e1", borderRadius:6, fontSize:13, fontFamily:"inherit", textAlign:"center", outline:"none" }}
                            />
                            <span style={{fontSize:12, color:"#475569", fontWeight:600}}>명</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="field">
                  <label className="label-main" htmlFor="memo">추가 요청 / 메모</label>
                  <textarea id="memo" name="memo" placeholder="유모차/카시트 지참 여부, 기타 요청 사항을 적어주세요."></textarea>
                </div>

                <div className="field">
                  <div className="agree">
                    <input id="agree" name="agree" type="checkbox" required />
                    <label htmlFor="agree">셔틀 신청 및 이용 규정을 모두 읽고 이해했으며, 위 내용에 동의합니다.<span className="required">*</span></label>
                  </div>
                </div>

                <div className="submit-row">
                  <button type="button" className="btn btn-secondary" onClick={() => router.push("/portal/dashboard")}>취소</button>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "전송 중..." : "신청 내용 저장하기"}</button>
                </div>
              </form>
            </section>

            <aside className="card rules">
              <div className="pill"><span>!</span> 셔틀 스케쥴 및 이용 규정 요약</div>
              <div className="rules-section">
                <h2>신청 및 운영 안내</h2>
                <ul>
                  <li>드림아카데미 패키지에는 투어 셔틀 서비스가 포함되어 있습니다.</li>
                  <li>모든 셔틀 신청은 <strong>사전 예약제</strong>로 운영됩니다.</li>
                  <li><strong>월–금 오후 4시 50분까지 신청 가능</strong>하며, <strong>토·일 및 당일 신청은 불가</strong>합니다.</li>
                  <li>탑승 전날 16:50까지 신청해야 하며, 주말이 낀 경우 안내된 기준을 따릅니다.</li>
                  <li>셔틀 스케쥴은 <strong>현지 사정에 따라 변경될 수 있으며</strong>, 최신 일정은 사이트 공지를 기준으로 합니다.</li>
                </ul>
              </div>
              <div className="rules-section">
                <h2>드림하우스 / 제이파크 / 큐브나인</h2>
                <ul>
                  <li>이 신청 페이지와 드림센터/공식 채널을 통해 접수된 내용만 셔틀 예약에 반영됩니다.</li>
                  <li>체크인 시 안내된 숙소 투숙객만 신청할 수 있습니다.</li>
                  <li>일정 변경/취소는 사이트에서 직접만 가능하며, 헬퍼/현지 매니저/채널로는 불가합니다.</li>
                </ul>
              </div>
              <div className="rules-section">
                <h2>취소 및 이용 제한</h2>
                <ul>
                  <li><strong>당일 무단 취소 1회</strong> 시, 이후 셔틀 신청이 제한될 수 있습니다.</li>
                  <li><strong>취소 2회 누적</strong> 시, 이후 셔틀 신청 불가 기준이 적용됩니다.</li>
                </ul>
              </div>
              <div className="rules-section">
                <h2>탑승 중 유의사항</h2>
                <ul>
                  <li>정해진 픽업·드롭 장소 외 중도 승·하차는 불가합니다.</li>
                  <li>가는 차량을 탑승하지 않고 돌아오는 차량만 탑승하는 것은 불가합니다.</li>
                  <li>가는 차량만 탑승하는 것은 가능합니다.</li>
                  <li>최대 정원 내에서만 베이비시터 동반 탑승이 가능합니다.</li>
                  <li>투어 셔틀은 <strong>투숙객 전용 서비스</strong>로, 외부인은 탑승이 불가합니다.</li>
                  <li>정원 외 탑승은 안전상 절대 허용되지 않습니다.</li>
                </ul>
                <p className="tagline">자세한 셔틀 시간표는 드림센터 내부 공지를 기준으로 합니다.</p>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </>
  );
}
