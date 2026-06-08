"use client";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resolvePortalSession } from "@/lib/portalSession";
import { loadDeployedSchedule, mergeWithFallback, tokenForItem, timeOfDate, KR_DOW, type DeployedScheduleItem } from "@/lib/fieldtripPrograms";

export default function AfterSchoolFieldtripPage() {
  const [activeMonth, setActiveMonth] = useState("5");
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({
    "5-1": true,
    "5-2": false,
    "5-3": false,
    "5-4": false,
    "5-5": false,
    "6-1": true,
    "6-2": false,
    "6-3": false,
    "6-4": false,
    "6-5": false,
  });
  const [modalHidden, setModalHidden] = useState(false);
  const [modalHiding, setModalHiding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<{ token: string; label: string; fieldtrip: boolean }[]>([]); // 선택한 일정 라이브 요약
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [session, setSession] = useState<{ booking_id: string } | null>(null);
  const [children, setChildren] = useState<string[]>([]);
  const [bookingMeta, setBookingMeta] = useState<{ checkin: string; checkout: string; name: string; room: string } | null>(null);
  const [deployItems, setDeployItems] = useState<DeployedScheduleItem[]>([]);

  // 배포된 일정 로드 → 하드코딩 5·6월 베이스라인과 병합 (배포가 우선, 월 추가 시 자동 노출)
  useEffect(() => {
    loadDeployedSchedule(supabase)
      .then((d) => setDeployItems(mergeWithFallback(d)))
      .catch(() => setDeployItems(mergeWithFallback([])));
  }, []);

  // 배포 일정 → 월 → 주차(월~일) 구조 (하드코딩 대체)
  const monthData = useMemo(() => {
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const mondayOf = (base: Date) => { const d = new Date(base); const w = d.getDay(); d.setDate(d.getDate() + (w === 0 ? -6 : 1 - w)); d.setHours(0, 0, 0, 0); return d; };
    const months = new Map<number, Map<string, DeployedScheduleItem[]>>();
    for (const it of [...deployItems].sort((a, b) => a.date.localeCompare(b.date))) {
      const dt = new Date(it.date + "T00:00:00");
      const m = dt.getMonth() + 1;
      const mk = ymd(mondayOf(dt));
      if (!months.has(m)) months.set(m, new Map());
      const wk = months.get(m)!;
      if (!wk.has(mk)) wk.set(mk, []);
      wk.get(mk)!.push(it);
    }
    return Array.from(months.entries()).sort((a, b) => a[0] - b[0]).map(([month, wkMap]) => ({
      month,
      weeks: Array.from(wkMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([mk, its], i) => {
        const mon = new Date(mk + "T00:00:00"); const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
        return { key: `${month}-${i + 1}`, idx: i + 1, label: `${mon.getMonth() + 1}/${mon.getDate()} – ${sun.getMonth() + 1}/${sun.getDate()}`, items: its };
      }),
    }));
  }, [deployItems]);

  // 포털 세션 체크 (shuttle 폼과 동일 패턴)
  useEffect(() => {
    (async () => {
      const s = await resolvePortalSession();
      if (!s) { router.replace("/portal"); return; }
      setSession(s as { booking_id: string });
    })();
  }, [router]);

  // 예약 정보 로드 — 자녀 목록(students.name_kr) + 체크인/체크아웃(STEP 2에서 사용)
  useEffect(() => {
    if (!session?.booking_id) return;
    fetch(`/api/bookings/${session.booking_id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const b = d.booking || d;
        const kids = Array.isArray(d.students)
          ? d.students.map((s: { name_kr?: string }) => String(s?.name_kr || "").trim()).filter(Boolean)
          : [];
        setChildren(kids);
        const ci = String(b.check_in || b.checkin_date || "").slice(0, 10);
        const co = String(b.check_out || b.checkout_date || "").slice(0, 10);
        const room = String(b.house_no || b.accom_room || "").replace(/\s+/g, "").replace(/^dh/i, "").toUpperCase();
        setBookingMeta({ checkin: ci, checkout: co, name: String(b.booker_name || "").trim(), room });
      })
      .catch(() => {});
  }, [session]);

  // 예약 기간 내 월만 노출 (배포된 월에서 자동 도출 — 하드코딩 제거)
  const ALL_MONTHS = monthData.map((md) => String(md.month));
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

  // activeMonth가 visibleMonths에 없으면 첫 월로 자동 설정
  useEffect(() => {
    if (visibleMonths.length === 0) return;
    if (!activeMonth || !visibleMonths.includes(activeMonth)) {
      setActiveMonth(visibleMonths[0]);
    }
  }, [visibleMonths.join(','), activeMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const STORAGE_KEY = "afterschool_rules_confirmed";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && Date.now() < parseInt(saved, 10)) {
      setModalHidden(true);
    }
  }, []);

  useEffect(() => {
    disableExpiredSchedules();
    restrictScheduleRange();
    recomputeSelected();
  }, [activeMonth, bookingMeta, deployItems]); // eslint-disable-line react-hooks/exhaustive-deps

  function getPHTNow() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 8 * 3600000);
  }

  function disableExpiredSchedules() {
    const pht = getPHTNow();
    document.querySelectorAll(".schedule-item").forEach((item) => {
      const cb = item.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (!cb) return;
      const parts = cb.value.split("-");
      if (parts.length < 2) return;
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      const scheduleDate = new Date(pht.getFullYear(), month - 1, day);
      const scheduleDow = scheduleDate.getDay();
      const isFieldtrip = item.classList.contains("fieldtrip");
      let deadline: Date;
      if (isFieldtrip) {
        // 필드트립: 7일 전 16:50 마감
        deadline = new Date(scheduleDate);
        deadline.setDate(deadline.getDate() - 7);
        deadline.setHours(16, 50, 0, 0);
      } else if (scheduleDow === 1) {
        deadline = new Date(scheduleDate);
        deadline.setDate(deadline.getDate() - 3);
        deadline.setHours(16, 50, 0, 0);
      } else {
        deadline = new Date(scheduleDate);
        deadline.setDate(deadline.getDate() - 1);
        deadline.setHours(16, 50, 0, 0);
      }
      if (pht >= deadline) {
        cb.disabled = true;
        (item as HTMLElement).style.opacity = "0.38";
        (item as HTMLElement).style.cursor = "not-allowed";
        (item as HTMLElement).style.transform = "none";
        (item as HTMLElement).title = "신청 마감된 일정입니다";
        cb.checked = false;
      }
    });
  }

  // 예약 기간(checkin~checkout) 밖 날짜는 숨김 + 전부 숨겨진 주차도 숨김
  function restrictScheduleRange() {
    const ci = bookingMeta?.checkin;
    const co = bookingMeta?.checkout;
    document.querySelectorAll(".schedule-item").forEach((item) => {
      const el = item as HTMLElement;
      const cb = item.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (!cb) return;
      // 예약정보 없으면 전체 노출
      if (!ci || !co) { el.style.display = ""; return; }
      const parts = cb.value.split("-");
      if (parts.length < 2) return;
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      // 스케줄은 2026년 (visibleMonths와 동일 피벗)
      const ymd = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (ymd >= ci && ymd <= co) {
        el.style.display = "";
      } else {
        el.style.display = "none";
        cb.checked = false;
      }
    });
    // 항목이 전부 숨겨진 주차 아코디언도 숨김
    document.querySelectorAll(".week-accordion").forEach((wk) => {
      const items = wk.querySelectorAll(".schedule-item");
      let anyVisible = false;
      items.forEach((it) => { if ((it as HTMLElement).style.display !== "none") anyVisible = true; });
      (wk as HTMLElement).style.display = (items.length > 0 && !anyVisible) ? "none" : "";
    });
  }

  function closeModal() {
    setModalHiding(true);
    setTimeout(() => {
      setModalHidden(true);
      setModalHiding(false);
    }, 200);
  }

  function handleConfirm() {
    const noShowCheck = document.getElementById("no-show-check") as HTMLInputElement | null;
    if (noShowCheck?.checked) {
      localStorage.setItem(
        "afterschool_rules_confirmed",
        (Date.now() + 30 * 24 * 60 * 60 * 1000).toString()
      );
    }
    closeModal();
  }

  function toggleWeek(key: string) {
    setOpenWeeks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // 체크된 일정 → 라이브 요약 재계산 (셔틀 폼의 "선택한 투어" 요약과 동일 컨셉)
  const recomputeSelected = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const checked = Array.from(form.querySelectorAll('input[name="schedule"]:checked')) as HTMLInputElement[];
    setSelected(checked.map((cb) => {
      const item = cb.closest(".schedule-item");
      const main = (item?.querySelector(".schedule-main")?.textContent || cb.value).trim();
      return {
        token: cb.value,
        label: main.replace(/\s*필드트립\s*$/, "").trim(),
        fieldtrip: !!item?.classList.contains("fieldtrip"),
      };
    }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = formRef.current;
    if (!form || !form.reportValidity()) return;

    const checked = form.querySelectorAll('input[name="schedule"]:checked');
    if (checked.length === 0) {
      alert("날짜를 최소 1개 이상 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    const scheduleValues = Array.from(checked).map((cb) => (cb as HTMLInputElement).value).join(", ");
    const childName = (form.querySelector('[name="childName"]') as HTMLInputElement | HTMLSelectElement | null)?.value || "";
    const memo = (form.querySelector('[name="memo"]') as HTMLTextAreaElement | null)?.value || "";
    try {
      // 1) Supabase 저장 = 앱의 source of truth. 구글시트 성공 여부와 무관하게 먼저 확실히 저장.
      const { error: insErr } = await supabase.from("fieldtrip_applications").insert({
        name: childName,
        date: scheduleValues,
        message: memo,
        request: memo,
        booking_id: session?.booking_id || null,
        portal_name: bookingMeta?.name || null,
        room_number: bookingMeta?.room || null,
      });
      if (insErr) { console.error(insErr); alert("저장에 실패했습니다: " + insErr.message); setSubmitting(false); return; }

      // 2) 구글시트 백업 (best-effort — 실패해도 신청은 정상 처리)
      try {
        const FORM_ENDPOINT = "https://script.google.com/macros/s/AKfycbwqK13BTYKhX4HqJHxJCotHP2X2lbtdRptQkW-j9A6-ZffkRtt1B8v1IKwIZ6uMBM4/exec";
        const formData = new FormData(form);
        formData.delete("schedule");
        formData.append("schedule", scheduleValues);
        await fetch(FORM_ENDPOINT, { method: "POST", body: formData, mode: "no-cors" });
      } catch (e) { console.warn("구글시트 백업 실패(무시):", e); }

      alert("신청이 완료되었습니다! 드림센터를 통해 확인 안내를 드릴 예정입니다.");
      form.reset();
    } catch (err) {
      console.error(err);
      alert("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{`
      :root {
        --bg: #fbfaf7; --card: #ffffff; --text: #1f1f1f; --muted: #8f8f8f;
        --accent: #16a34a; --accent-soft: #dcfce7;
        --stroke: rgba(17,24,39,0.06); --shadow: 0 18px 40px rgba(17,24,39,0.08);
        --focus: rgba(22,163,74,0.4); --danger: #e11d48;
        --fieldtrip: #f97316; --fieldtrip-soft: #fff7ed; --fieldtrip-border: #fed7aa;
      }
      * { box-sizing: border-box; }
      a { color: inherit; }

      .wrap { min-height: 100%; display: flex; justify-content: center; padding: 32px 18px 40px; }
      .page { width: min(960px, 100%); display: grid; gap: 18px; }

      .top-bar { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--muted); }
      .back-link { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 999px; background: rgba(255,255,255,0.9); border: 1px solid rgba(148,163,184,0.35); text-decoration: none; font-weight: 500; transition: background 140ms, transform 140ms, box-shadow 140ms; }
      .back-link:hover { background: #f8fafc; transform: translateY(-0.5px); box-shadow: 0 10px 22px rgba(15,23,42,0.12); }

      .title { margin-top: 6px; }
      .title h1 { margin: 0; font-size: clamp(26px,3.3vw,34px); font-weight: 800; letter-spacing: -0.03em; }
      .title p { margin: 10px 0 0; color: var(--muted); font-size: 14px; }

      .layout { display: grid; grid-template-columns: minmax(0,1.6fr) minmax(0,1.1fr); gap: 20px; margin-top: 10px; }
      .card { background: var(--card); border-radius: 20px; padding: 22px 22px 20px; box-shadow: var(--shadow); border: 1px solid var(--stroke); }
      .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
      .card-title { font-size: 16px; font-weight: 700; }
      .chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 999px; background: var(--accent-soft); color: #15803d; font-size: 11px; font-weight: 600; }

      .notice { margin: 0 0 14px; font-size: 13px; color: var(--muted); line-height: 1.5; }
      .notice strong { color: #4b5563; }

      form { display: grid; gap: 14px; }
      .field { display: grid; gap: 6px; }
      label span.required { color: var(--danger); margin-left: 2px; }
      .label-main { font-size: 13px; font-weight: 600; letter-spacing: -0.01em; }
      .label-sub { margin-top: 2px; font-size: 12px; color: var(--muted); }

      input[type="text"], input[type="number"], textarea, select {
        width: 100%; padding: 9px 11px; border-radius: 11px;
        border: 1px solid rgba(148,163,184,0.6); background: #f9fafb;
        font-size: 13px; font-family: inherit;
        transition: border-color 120ms, box-shadow 120ms, background 120ms;
      }
      input[type="text"]:focus-visible, textarea:focus-visible, select:focus-visible {
        outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px var(--focus); background: #fff;
      }
      textarea { min-height: 70px; resize: vertical; }

      .agree { margin-top: 2px; display: flex; gap: 8px; font-size: 12px; color: #4b5563; align-items: flex-start; }
      .agree input[type="checkbox"] { margin-top: 2px; width: 14px; height: 14px; }

      /* month tabs */
      .month-toggle { margin-top: 8px; display: inline-flex; padding: 3px; border-radius: 999px; background: #f3f4f6; gap: 3px; }
      .month-toggle button { border: none; background: transparent; padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; transition: background 120ms, color 120ms, box-shadow 120ms, transform 120ms; font-family: inherit; }
      .month-toggle button[data-active="true"] { background: #fff; color: #1f2937; box-shadow: 0 8px 18px rgba(15,23,42,0.12); transform: translateY(-0.5px); }

      /* accordion */
      .month-panel { display: none; }
      .month-panel[data-visible="true"] { display: block; }
      .month-hint { margin-top: 6px; font-size: 12px; color: #9ca3af; }

      .week-accordion { margin-top: 6px; border-radius: 14px; border: 1px solid rgba(148,163,184,0.4); overflow: hidden; }
      .week-accordion-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; background: #f8fafc; border: none; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700; color: #374151; transition: background 120ms; }
      .week-accordion-btn:hover { background: #f1f5f9; }
      .week-accordion-btn[data-open="true"] { background: #f0fdf4; color: #15803d; }
      .week-acc-title em { font-style: normal; font-weight: 400; color: #9ca3af; margin-left: 6px; font-size: 12px; }
      .week-acc-arrow { font-size: 12px; transition: transform 200ms ease; display: inline-block; }
      .week-accordion-btn[data-open="true"] .week-acc-arrow { transform: rotate(180deg); }
      .week-accordion-body { display: none; padding: 10px 12px 12px; }
      .week-accordion-body[data-open="true"] { display: block; }

      /* schedule grid */
      .schedule-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
      .week-divider { display: flex; align-items: center; gap: 8px; margin: 8px 0 6px; }
      .week-divider span { font-size: 11px; font-weight: 600; color: #9ca3af; white-space: nowrap; }
      .week-divider::after { content: ''; flex: 1; height: 1px; background: rgba(148,163,184,0.3); }

      .schedule-item { border-radius: 12px; border: 1px solid rgba(148,163,184,0.7); padding: 8px 10px; display: flex; align-items: flex-start; gap: 8px; background: #f9fafb; cursor: pointer; font-size: 12px; transition: background 120ms, border-color 120ms, box-shadow 120ms, transform 120ms; }
      .schedule-item:hover { background: #fff; border-color: var(--accent); box-shadow: 0 10px 22px rgba(15,23,42,0.08); transform: translateY(-1px); }
      .schedule-item input { margin-top: 3px; flex-shrink: 0; accent-color: var(--accent); }
      .schedule-label { display: grid; gap: 2px; }
      .schedule-main { font-weight: 600; }
      .schedule-sub { color: #6b7280; line-height: 1.4; }

      /* fieldtrip highlight */
      .schedule-item.fieldtrip { background: var(--fieldtrip-soft); border-color: var(--fieldtrip-border); }
      .schedule-item.fieldtrip:hover { background: #fff; border-color: var(--fieldtrip); }
      .schedule-item.fieldtrip .schedule-main { color: #c2410c; }
      .fieldtrip-badge { display: inline-block; font-size: 10px; font-weight: 700; background: #f97316; color: #fff; padding: 1px 5px; border-radius: 4px; margin-left: 4px; vertical-align: middle; }

      /* checkbox style */
      .schedule-item input[type="checkbox"] {
        width: 15px; height: 15px; border-radius: 4px;
        accent-color: #16a34a; flex-shrink: 0; margin-top: 3px; cursor: pointer;
      }
      .schedule-item:has(input[type="checkbox"]:checked) {
        background: #f0fdf4; border-color: #16a34a;
        box-shadow: 0 4px 12px rgba(22,163,74,0.15);
      }
      .schedule-item.fieldtrip:has(input[type="checkbox"]:checked) {
        background: #fff7ed; border-color: #f97316;
      }

      /* checkbox style override */
      .schedule-item:has(input[type="checkbox"]:checked) {
        background: #f0fdf4 !important; border-color: #16a34a !important;
        box-shadow: 0 4px 12px rgba(22,163,74,0.15);
      }
      .schedule-item.fieldtrip:has(input[type="checkbox"]:checked) {
        background: #fff7ed !important; border-color: #f97316 !important;
      }

      /* closed style */
      .schedule-item:has(input[type="checkbox"]:disabled) { opacity: 0.38 !important; cursor: not-allowed !important; transform: none !important; pointer-events: none; }
      .schedule-item:has(input[type="checkbox"]:disabled) .schedule-main::after { content: " \\B7  마감"; font-size: 10px; font-weight: 600; color: #9ca3af; background: #f3f4f6; padding: 1px 5px; border-radius: 4px; margin-left: 4px; vertical-align: middle; }

      .submit-row { margin-top: 4px; display: flex; justify-content: flex-end; gap: 8px; }
      .btn { border: none; border-radius: 999px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; transition: background 140ms, transform 140ms, box-shadow 140ms, opacity 120ms; }
      .btn-primary { background: var(--accent); color: #fff; box-shadow: 0 14px 30px rgba(22,163,74,0.35); }
      .btn-primary:hover { background: #15803d; transform: translateY(-1px); box-shadow: 0 18px 40px rgba(22,163,74,0.4); }
      .btn-secondary { background: rgba(15,23,42,0.03); color: #4b5563; }
      .btn-secondary:hover { background: rgba(15,23,42,0.06); }
      .btn:disabled { opacity: 0.7; cursor: default; transform: none; box-shadow: none; }

      /* right rules */
      .rules { font-size: 13px; color: #4b5563; line-height: 1.6; }
      .rules h2 { margin: 0 0 8px; font-size: 15px; }
      .rules-section + .rules-section { margin-top: 14px; padding-top: 12px; border-top: 1px dashed rgba(148,163,184,0.6); }
      .rules ul { margin: 4px 0 0; padding-left: 18px; }
      .rules li { margin: 2px 0; }
      .rules .tagline { font-size: 12px; color: var(--muted); }
      .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 999px; background: #dcfce7; color: #15803d; font-size: 11px; margin-bottom: 8px; }

      /* program list */
      .program-list { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
      .program-tag { font-size: 11px; padding: 3px 8px; border-radius: 999px; background: #f3f4f6; color: #374151; font-weight: 500; }
      .program-tag.ft { background: #fff7ed; color: #c2410c; }

      /* popup modal */
      .modal-backdrop { position: fixed; inset: 0; z-index: 999; background: rgba(15,23,42,0.45); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; opacity: 1; transition: opacity 200ms ease; }
      .modal-backdrop.hiding { opacity: 0; pointer-events: none; }
      .modal { background: #fff; border-radius: 24px; padding: 28px 28px 24px; width: min(520px, 100%); max-height: 80vh; overflow-y: auto; box-shadow: 0 32px 64px rgba(15,23,42,0.2); border: 1px solid var(--stroke); transform: translateY(0); transition: transform 200ms ease; }
      .modal-backdrop.hiding .modal { transform: translateY(12px); }
      .modal-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
      .modal-title { font-size: 18px; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
      .modal-subtitle { font-size: 13px; color: var(--muted); margin: 4px 0 0; }
      .modal-icon { width: 40px; height: 40px; border-radius: 12px; background: #dcfce7; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
      .modal-rules { font-size: 13px; color: #4b5563; line-height: 1.65; }
      .modal-rules h3 { margin: 14px 0 4px; font-size: 13px; font-weight: 700; color: #1f2937; padding-bottom: 4px; border-bottom: 1px dashed rgba(148,163,184,0.4); }
      .modal-rules h3:first-child { margin-top: 0; }
      .modal-rules ul { margin: 4px 0 0; padding-left: 16px; }
      .modal-rules li { margin: 3px 0; }
      .modal-footer { margin-top: 20px; display: flex; flex-direction: column; gap: 10px; }
      .modal-no-show { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #6b7280; cursor: pointer; user-select: none; }
      .modal-no-show input { width: 14px; height: 14px; cursor: pointer; }
      .modal-confirm { width: 100%; padding: 13px; border: none; border-radius: 999px; background: var(--accent); color: #fff; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; box-shadow: 0 14px 30px rgba(22,163,74,0.35); transition: background 140ms, transform 140ms; }
      .modal-confirm:hover { background: #15803d; transform: translateY(-1px); }

      @media (max-width: 840px) { .layout { grid-template-columns: minmax(0,1fr); } .wrap { padding-top: 20px; } }
      @media (max-width: 480px) { .schedule-grid { grid-template-columns: minmax(0,1fr); } }
      `}</style>

      {/* Modal */}
      {!modalHidden && (
        <div
          className={`modal-backdrop${modalHiding ? " hiding" : ""}`}
          id="rules-modal"
          role="dialog"
          aria-modal="true"
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="modal-title">신청 전 꼭 확인해 주세요</p>
                <p className="modal-subtitle">아래 규정을 확인하신 후 신청이 가능합니다.</p>
              </div>
              <div className="modal-icon">🌿</div>
            </div>
            <div className="modal-rules">
              <h3>📋 신청 안내</h3>
              <ul>
                <li><strong>월~금 오후 4시 50분까지</strong> 신청 가능하며, <strong>토·일 및 당일 신청은 불가</strong>합니다.</li>
                <li>당일 신청 불가 — 자리 여유가 있어도 미예약 시 수업 불가합니다.</li>
              </ul>
              <h3>⚠️ 취소 및 이용 제한</h3>
              <ul>
                <li><strong>당일 무단 취소 시</strong> → 이후 수업 신청 불가</li>
                <li><strong>취소 2회 누적 시</strong> → 이후 수업 신청 불가</li>
              </ul>
              <h3>💛 비 패키지 고객</h3>
              <ul>
                <li>현장학습(Field Trip)만 유료로 신청 가능합니다. <strong>(3,000페소)</strong></li>
              </ul>
              <h3>🚌 토요일 필드트립</h3>
              <ul>
                <li style={{ color: "#dc2626" }}><strong>필드트립은 7일 전까지 신청 가능합니다.</strong></li>
                <li>픽업: 10:15~20 / 드롭: 4:20~25 (집 앞으로 픽드랍)</li>
                <li>전날 픽업 안내 발송됩니다.</li>
              </ul>
            </div>
            <div className="modal-footer">
              <label className="modal-no-show">
                <input type="checkbox" id="no-show-check" />
                다시 보지 않기 (30일간)
              </label>
              <button className="modal-confirm" id="modal-confirm-btn" onClick={handleConfirm}>
                ✓ 확인했습니다. 신청하러 가기
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="wrap">
        <section className="page">
          <header className="top-bar">
            <a href="/portal/dashboard" className="back-link">← 마이페이지로 돌아가기</a>
            <span>드림아카데미 애프터스쿨 &amp; 현장학습</span>
          </header>

          <div className="title">
            <h1>애프터스쿨 &amp; 현장학습 신청</h1>
            <p>참여하실 날짜와 아이 이름을 남겨 주세요. 사전 예약제로 운영됩니다.</p>
          </div>

          <div className="layout">
            {/* Form */}
            <section className="card">
              <header className="card-header">
                <div>
                  <p className="card-title">신청 정보 입력</p>
                  <p className="notice"><strong>월~금 오후 4시 50분까지</strong> 접수된 신청만 확인 가능하며, <strong>당일 신청은 불가</strong>합니다.</p>
                </div>
                <div className="chip">● 사전 예약제</div>
              </header>

              <form id="afterschool-form" ref={formRef} onSubmit={handleSubmit} onChange={recomputeSelected}>
                {/* Child name */}
                <div className="field">
                  <label className="label-main" htmlFor="child-name">아이 이름<span className="required">*</span></label>
                  <select key={children.join("|")} id="child-name" name="childName" required defaultValue={children.length === 1 ? children[0] : ""}>
                    {children.length === 0 ? (
                      <option value="" disabled>예약에 등록된 아이가 없습니다</option>
                    ) : (
                      <>
                        {children.length > 1 && <option value="" disabled>아이를 선택해 주세요</option>}
                        {children.map((c, i) => (
                          <option key={i} value={c}>{c}</option>
                        ))}
                      </>
                    )}
                  </select>
                  {children.length === 0 && (
                    <p className="label-sub" style={{ color: "var(--danger)", marginTop: 6 }}>
                      예약에 등록된 아이가 없습니다.
                    </p>
                  )}
                </div>

                {/* Schedule selection */}
                <div className="field">
                  <p className="label-main">참여 날짜 선택<span className="required">*</span></p>
                  <p className="label-sub">참여하실 날짜를 <strong>복수 선택</strong>할 수 있습니다. <span style={{ color: '#c2410c', fontWeight: 600 }}>주황색</span>은 토요일 필드트립입니다.</p>

                  <div className="month-toggle">
                    {monthData.filter((md) => visibleMonths.includes(String(md.month))).map((md) => (
                      <button
                        key={md.month}
                        type="button"
                        data-month={md.month}
                        data-active={activeMonth === String(md.month) ? "true" : "false"}
                        onClick={() => setActiveMonth(String(md.month))}
                      >
                        {md.month}월
                      </button>
                    ))}
                  </div>

                  <div className="month-schedules">
                    {monthData.length === 0 && (
                      <p className="label-sub" style={{ padding: "18px 4px" }}>아직 공개된 일정이 없습니다. 곧 업데이트됩니다.</p>
                    )}
                    {monthData.map((md) => (
                      <div key={md.month} className="month-panel" data-month-panel={md.month} data-visible={activeMonth === String(md.month) ? "true" : "false"}>
                        {md.weeks.map((wk) => (
                          <div key={wk.key} className="week-accordion">
                            <button type="button" className="week-accordion-btn" data-open={(openWeeks[wk.key] ?? wk.idx === 1) ? "true" : "false"} onClick={() => toggleWeek(wk.key)}>
                              <span className="week-acc-title">{wk.idx}주차 <em>{wk.label}</em></span>
                              <span className="week-acc-arrow">▾</span>
                            </button>
                            <div className="week-accordion-body" data-open={(openWeeks[wk.key] ?? wk.idx === 1) ? "true" : "false"}>
                              <div className="schedule-grid">
                                {wk.items.map((it) => {
                                  const dt = new Date(it.date + "T00:00:00");
                                  const isFt = it.type === "fieldtrip";
                                  return (
                                    <label key={it.id} className={`schedule-item${isFt ? " fieldtrip" : ""}`}>
                                      <input type="checkbox" name="schedule" value={tokenForItem(it)} />
                                      <div className="schedule-label">
                                        <span className="schedule-main">{dt.getMonth() + 1}/{dt.getDate()} ({KR_DOW[dt.getDay()]}) · {it.title}{isFt && <span className="fieldtrip-badge">필드트립</span>}</span>
                                        <span className="schedule-sub">{timeOfDate(it.date, it.type)}{it.description ? ` · ${it.description}` : ""}</span>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <p className="month-hint">※ 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.</p>
                </div>

                {/* Memo */}
                <div className="field">
                  <label className="label-main" htmlFor="memo">추가 요청 / 메모 (선택)</label>
                  <textarea id="memo" name="memo" placeholder="알레르기, 준비물 관련 문의, 기타 요청 사항을 적어주세요."></textarea>
                </div>

                {/* Agreement */}
                <div className="field">
                  <div className="agree">
                    <input id="agree" name="agree" type="checkbox" required />
                    <label htmlFor="agree">신청 및 이용 규정을 모두 읽고 이해했으며, 위 내용에 동의합니다.<span className="required">*</span></label>
                  </div>
                </div>

                <div style={{ margin: "14px 0", padding: "12px 14px", border: "1px solid var(--stroke)", borderRadius: 12, background: "#fff" }}>
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>📋 선택한 일정</span>
                    <span style={{ color: "var(--accent)", fontWeight: 800 }}>{selected.length}건</span>
                  </div>
                  {selected.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>위에서 신청할 일정을 선택하면 여기에 표시됩니다.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {selected.map((s) => (
                        <div key={s.token} style={{ fontSize: 12.5, fontWeight: 600, color: s.fieldtrip ? "#c2410c" : "#1f2937", display: "flex", gap: 6, alignItems: "center" }}>
                          <span>{s.fieldtrip ? "🟠" : "🔵"}</span><span>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="submit-row">
                  <button type="button" className="btn btn-secondary" onClick={() => history.back()}>취소</button>
                  <button type="submit" className="btn btn-primary" id="submit-button" disabled={submitting}>
                    {submitting ? "전송 중..." : "신청 내용 저장하기"}
                  </button>
                </div>
              </form>
            </section>

            {/* Right sidebar rules */}
            <aside className="card rules">
              <div className="pill">🌿 프로그램 안내 및 이용 규정</div>

              <div className="rules-section">
                <h2>📚 After School 프로그램</h2>
                <div className="program-list">
                  <span className="program-tag">Eco Planting &amp; Herb</span>
                  <span className="program-tag">Mini Olympics</span>
                  <span className="program-tag">Nature Walk</span>
                  <span className="program-tag">Water Gun Fun</span>
                  <span className="program-tag">Balloon Tennis</span>
                  <span className="program-tag">Book Hunt &amp; Puzzle</span>
                  <span className="program-tag">Hand Baseball</span>
                  <span className="program-tag">Flower Arrangement</span>
                  <span className="program-tag">Traffic Light Game</span>
                  <span className="program-tag">Snack Grabbing Game</span>
                  <span className="program-tag">Origami Activity</span>
                  <span className="program-tag">Plant Observation</span>
                  <span className="program-tag">Hula Hoop &amp; Jump Rope</span>
                </div>
              </div>

              <div className="rules-section">
                <h2>🚌 Field Trip 프로그램</h2>
                <div className="program-list">
                  <span className="program-tag ft">Shrine Tour</span>
                  <span className="program-tag ft">Nimo Brew</span>
                  <span className="program-tag ft">Crocolandia</span>
                  <span className="program-tag ft">Kids Caf&eacute;</span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#6b7280' }}>픽업 10:15~20 / 드롭 4:20~25 (집 앞 픽드랍)<br/>전날 픽업 안내 발송</p>
              </div>

              <div className="rules-section">
                <h2>📋 신청 안내</h2>
                <ul>
                  <li><strong>월~금 오후 4시 50분까지</strong> 신청 가능합니다.</li>
                  <li><strong>토·일 및 당일 신청은 불가</strong>합니다.</li>
                  <li>자리 여유가 있어도 미예약 시 수업 참여 불가합니다.</li>
                  <li style={{ color: "#dc2626" }}><strong>🚌 필드트립은 7일 전까지 신청 가능합니다.</strong></li>
                </ul>
              </div>

              <div className="rules-section">
                <h2>⚠️ 취소 및 이용 제한</h2>
                <ul>
                  <li><strong>당일 무단 취소 시</strong> → 이후 수업 신청 불가</li>
                  <li><strong>취소 2회 누적 시</strong> → 이후 수업 신청 불가</li>
                </ul>
              </div>

              <div className="rules-section">
                <h2>💛 비 패키지 고객</h2>
                <ul>
                  <li>현장학습(Field Trip)만 유료로 신청 가능합니다.</li>
                  <li>비용: <strong>3,000페소</strong></li>
                </ul>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </>
  );
}
