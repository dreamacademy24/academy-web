"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function AfterSchoolFieldtripPage() {
  const [activeMonth, setActiveMonth] = useState("3");
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({
    "3-1": true,
    "3-2": false,
    "3-3": false,
    "3-4": false,
    "4-1": true,
    "4-2": false,
    "4-3": false,
    "4-4": false,
    "4-5": false,
  });
  const [modalHidden, setModalHidden] = useState(false);
  const [modalHiding, setModalHiding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const STORAGE_KEY = "afterschool_rules_confirmed";
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && Date.now() < parseInt(saved, 10)) {
      setModalHidden(true);
    }
  }, []);

  useEffect(() => {
    disableExpiredSchedules();
  }, [activeMonth]);

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
      let deadline: Date;
      if (scheduleDow === 1) {
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
    try {
      const FORM_ENDPOINT =
        "https://script.google.com/macros/s/AKfycbwqK13BTYKhX4HqJHxJCotHP2X2lbtdRptQkW-j9A6-ZffkRtt1B8v1IKwIZ6uMBM4/exec";
      const formData = new FormData(form);
      formData.delete("schedule");
      const scheduleValues = Array.from(checked)
        .map((cb) => (cb as HTMLInputElement).value)
        .join(", ");
      formData.append("schedule", scheduleValues);
      const res = await fetch(FORM_ENDPOINT, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Network error");

      // Supabase 동시 저장
      await supabase.from("fieldtrip_applications").insert({
        name: formData.get("childName") as string,
        date: formData.get("schedule") as string,
        message: formData.get("memo") as string,
      }).then(() => {});

      alert("신청이 완료되었습니다! 드림센터를 통해 확인 안내를 드릴 예정입니다.");
      form.reset();
    } catch (err) {
      console.error(err);
      alert("전송에 실패했습니다. 잠시 후 다시 시도해 주세요.");
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

      input[type="text"], input[type="number"], textarea {
        width: 100%; padding: 9px 11px; border-radius: 11px;
        border: 1px solid rgba(148,163,184,0.6); background: #f9fafb;
        font-size: 13px; font-family: inherit;
        transition: border-color 120ms, box-shadow 120ms, background 120ms;
      }
      input[type="text"]:focus-visible, textarea:focus-visible {
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
            <a href="/apply" className="back-link">← 드림아카데미 신청서로 돌아가기</a>
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

              <form id="afterschool-form" ref={formRef} onSubmit={handleSubmit}>
                {/* Child name */}
                <div className="field">
                  <label className="label-main" htmlFor="child-name">아이 이름<span className="required">*</span></label>
                  <input id="child-name" name="childName" type="text" required placeholder="예) 김드림" />
                </div>

                {/* Schedule selection */}
                <div className="field">
                  <p className="label-main">참여 날짜 선택<span className="required">*</span></p>
                  <p className="label-sub">참여하실 날짜를 <strong>복수 선택</strong>할 수 있습니다. <span style={{ color: '#c2410c', fontWeight: 600 }}>주황색</span>은 토요일 필드트립입니다.</p>

                  <div className="month-toggle">
                    <button
                      type="button"
                      data-month="3"
                      data-active={activeMonth === "3" ? "true" : "false"}
                      onClick={() => setActiveMonth("3")}
                    >
                      3월
                    </button>
                    <button
                      type="button"
                      data-month="4"
                      data-active={activeMonth === "4" ? "true" : "false"}
                      onClick={() => setActiveMonth("4")}
                    >
                      4월
                    </button>
                  </div>

                  <div className="month-schedules">

                    {/* March */}
                    <div className="month-panel" data-month-panel="3" data-visible={activeMonth === "3" ? "true" : "false"}>

                      {/* March Week 1 */}
                      <div className="week-accordion">
                        <button type="button" className="week-accordion-btn" data-open={openWeeks["3-1"] ? "true" : "false"} onClick={() => toggleWeek("3-1")}>
                          <span className="week-acc-title">1주차 <em>3/2 – 3/9</em></span>
                          <span className="week-acc-arrow">▾</span>
                        </button>
                        <div className="week-accordion-body" data-open={openWeeks["3-1"] ? "true" : "false"}>
                          <div className="schedule-grid">
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="3-2-badminton" />
                              <div className="schedule-label"><span className="schedule-main">3/2 (월) · Badminton &amp; Dodge Ball</span><span className="schedule-sub">4:20~5:10pm · Academy · 배드민턴 및 피구 게임</span></div>
                            </label>
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="3-4-naturewalk" />
                              <div className="schedule-label"><span className="schedule-main">3/4 (수) · Nature Walk &amp; Jackfruit Maze</span><span className="schedule-sub">4:30~5:20pm · Dream house Office · 베이스워터 산책 및 열대과일 테마 미로</span></div>
                            </label>
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="3-9-baseball" />
                              <div className="schedule-label"><span className="schedule-main">3/9 (월) · Hand Baseball</span><span className="schedule-sub">4:20~5:10pm · Academy · 손 야구 게임</span></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* March Week 2 */}
                      <div className="week-accordion">
                        <button type="button" className="week-accordion-btn" data-open={openWeeks["3-2"] ? "true" : "false"} onClick={() => toggleWeek("3-2")}>
                          <span className="week-acc-title">2주차 <em>3/10 – 3/16</em></span>
                          <span className="week-acc-arrow">▾</span>
                        </button>
                        <div className="week-accordion-body" data-open={openWeeks["3-2"] ? "true" : "false"}>
                          <div className="schedule-grid">
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="3-11-olympics" />
                              <div className="schedule-label"><span className="schedule-main">3/11 (수) · Mini Olympics</span><span className="schedule-sub">4:30~5:20pm · Club House in Bayswater · 미니 올림픽</span></div>
                            </label>
                            <label className="schedule-item fieldtrip">
                              <input type="checkbox" name="schedule" value="3-14-nimobrew" />
                              <div className="schedule-label"><span className="schedule-main">3/14 (토) · Nimo Brew <span className="fieldtrip-badge">필드트립</span></span><span className="schedule-sub">10:30~4:30pm · Bayswater (집 앞 픽드랍) · 파충류 체험</span></div>
                            </label>
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="3-16-ecoplanting" />
                              <div className="schedule-label"><span className="schedule-main">3/16 (월) · Eco Planting and Herb</span><span className="schedule-sub">4:20~5:10pm · Academy · 친환경 식물 심기 및 허브 심기</span></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* March Week 3 */}
                      <div className="week-accordion">
                        <button type="button" className="week-accordion-btn" data-open={openWeeks["3-3"] ? "true" : "false"} onClick={() => toggleWeek("3-3")}>
                          <span className="week-acc-title">3주차 <em>3/17 – 3/23</em></span>
                          <span className="week-acc-arrow">▾</span>
                        </button>
                        <div className="week-accordion-body" data-open={openWeeks["3-3"] ? "true" : "false"}>
                          <div className="schedule-grid">
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="3-18-snack" />
                              <div className="schedule-label"><span className="schedule-main">3/18 (수) · Snack Grabbing &amp; Obstacle Course</span><span className="schedule-sub">4:30~5:20pm · Club House in Bayswater · 간식 잡기 및 장애물 코스 게임</span></div>
                            </label>
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="3-23-watergun" />
                              <div className="schedule-label"><span className="schedule-main">3/23 (월) · Water Gun Fun</span><span className="schedule-sub">4:20~5:10pm · Academy · 물총놀이 (젖는 옷·신발 착용, 수건 지참)</span></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* March Week 4 */}
                      <div className="week-accordion">
                        <button type="button" className="week-accordion-btn" data-open={openWeeks["3-4"] ? "true" : "false"} onClick={() => toggleWeek("3-4")}>
                          <span className="week-acc-title">4주차 <em>3/24 – 3/30</em></span>
                          <span className="week-acc-arrow">▾</span>
                        </button>
                        <div className="week-accordion-body" data-open={openWeeks["3-4"] ? "true" : "false"}>
                          <div className="schedule-grid">
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="3-25-ballon" />
                              <div className="schedule-label"><span className="schedule-main">3/25 (수) · Balloon Tennis</span><span className="schedule-sub">4:30~5:20pm · Club House in Bayswater · 풍선 테니스</span></div>
                            </label>
                            <label className="schedule-item fieldtrip">
                              <input type="checkbox" name="schedule" value="3-28-shrine" />
                              <div className="schedule-label"><span className="schedule-main">3/28 (토) · Shrine Tour <span className="fieldtrip-badge">필드트립</span></span><span className="schedule-sub">10:30~4:30pm · Bayswater (집 앞 픽드랍) · 막탄의 대표 명소 쉬라인 투어</span></div>
                            </label>
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="3-30-origami" />
                              <div className="schedule-label"><span className="schedule-main">3/30 (월) · Origami &amp; Paper Airplane</span><span className="schedule-sub">4:20~5:10pm · Academy · 종이접기 및 비행기 날리기</span></div>
                            </label>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* April */}
                    <div className="month-panel" data-month-panel="4" data-visible={activeMonth === "4" ? "true" : "false"}>

                      {/* April Week 1 */}
                      <div className="week-accordion">
                        <button type="button" className="week-accordion-btn" data-open={openWeeks["4-1"] ? "true" : "false"} onClick={() => toggleWeek("4-1")}>
                          <span className="week-acc-title">1주차 <em>4/1 – 4/6</em></span>
                          <span className="week-acc-arrow">▾</span>
                        </button>
                        <div className="week-accordion-body" data-open={openWeeks["4-1"] ? "true" : "false"}>
                          <div className="schedule-grid">
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="4-1-hulahoop" />
                              <div className="schedule-label"><span className="schedule-main">4/1 (수) · Hula Hoop &amp; Jump Rope</span><span className="schedule-sub">4:30~5:20pm · Club House in Bayswater · 훌라후프 및 줄넘기 활동</span></div>
                            </label>
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="4-6-bookhunt" />
                              <div className="schedule-label"><span className="schedule-main">4/6 (월) · Interactive Book Hunt &amp; Puzzle</span><span className="schedule-sub">4:20~5:10pm · Academy · 책 탐색 활동 및 퍼즐게임</span></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* April Week 2 */}
                      <div className="week-accordion">
                        <button type="button" className="week-accordion-btn" data-open={openWeeks["4-2"] ? "true" : "false"} onClick={() => toggleWeek("4-2")}>
                          <span className="week-acc-title">2주차 <em>4/7 – 4/13</em></span>
                          <span className="week-acc-arrow">▾</span>
                        </button>
                        <div className="week-accordion-body" data-open={openWeeks["4-2"] ? "true" : "false"}>
                          <div className="schedule-grid">
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="4-8-trafficlight" />
                              <div className="schedule-label"><span className="schedule-main">4/8 (수) · Red Light Green Light &amp; Treasure Hunt</span><span className="schedule-sub">4:30~5:20pm · Club House in Bayswater · 신호등 게임 및 보물 찾기</span></div>
                            </label>
                            <label className="schedule-item fieldtrip">
                              <input type="checkbox" name="schedule" value="4-11-crocolandia" />
                              <div className="schedule-label"><span className="schedule-main">4/11 (토) · Crocolandia <span className="fieldtrip-badge">필드트립</span></span><span className="schedule-sub">10:30~4:30pm · Bayswater (집 앞 픽드랍) · 악어 및 파충류 관찰</span></div>
                            </label>
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="4-13-flower" />
                              <div className="schedule-label"><span className="schedule-main">4/13 (월) · Flower Arrangement</span><span className="schedule-sub">4:20~5:10pm · Academy · 꽃꽂이 활동 수업</span></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* April Week 3 */}
                      <div className="week-accordion">
                        <button type="button" className="week-accordion-btn" data-open={openWeeks["4-3"] ? "true" : "false"} onClick={() => toggleWeek("4-3")}>
                          <span className="week-acc-title">3주차 <em>4/14 – 4/20</em></span>
                          <span className="week-acc-arrow">▾</span>
                        </button>
                        <div className="week-accordion-body" data-open={openWeeks["4-3"] ? "true" : "false"}>
                          <div className="schedule-grid">
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="4-15-ballontennis" />
                              <div className="schedule-label"><span className="schedule-main">4/15 (수) · Balloon Tennis</span><span className="schedule-sub">4:30~5:20pm · Club House in Bayswater · 풍선 테니스</span></div>
                            </label>
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="4-20-plantobservation" />
                              <div className="schedule-label"><span className="schedule-main">4/20 (월) · Plant Observation with Handmade Magnifiers</span><span className="schedule-sub">4:20~5:10pm · Academy · 직접 만든 색깔 확대경으로 식물 관찰</span></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* April Week 4 */}
                      <div className="week-accordion">
                        <button type="button" className="week-accordion-btn" data-open={openWeeks["4-4"] ? "true" : "false"} onClick={() => toggleWeek("4-4")}>
                          <span className="week-acc-title">4주차 <em>4/21 – 4/27</em></span>
                          <span className="week-acc-arrow">▾</span>
                        </button>
                        <div className="week-accordion-body" data-open={openWeeks["4-4"] ? "true" : "false"}>
                          <div className="schedule-grid">
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="4-22-naturewalk" />
                              <div className="schedule-label"><span className="schedule-main">4/22 (수) · Nature Walk &amp; Jackfruit Maze</span><span className="schedule-sub">4:30~5:20pm · Dream house Office · 베이스워터 산책 및 열대과일 테마 미로</span></div>
                            </label>
                            <label className="schedule-item fieldtrip">
                              <input type="checkbox" name="schedule" value="4-25-kidscafe" />
                              <div className="schedule-label"><span className="schedule-main">4/25 (토) · Kids Caf&eacute; <span className="fieldtrip-badge">필드트립</span></span><span className="schedule-sub">10:30~4:30pm · Bayswater (집 앞 픽드랍) · 키즈 카페 방문</span></div>
                            </label>
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="4-27-watergun" />
                              <div className="schedule-label"><span className="schedule-main">4/27 (월) · Water Gun Fun</span><span className="schedule-sub">4:20~5:10pm · Academy · 물총놀이 (젖는 옷·신발 착용, 수건 지참)</span></div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* April Week 5 */}
                      <div className="week-accordion">
                        <button type="button" className="week-accordion-btn" data-open={openWeeks["4-5"] ? "true" : "false"} onClick={() => toggleWeek("4-5")}>
                          <span className="week-acc-title">5주차 <em>4/28 – 4/29</em></span>
                          <span className="week-acc-arrow">▾</span>
                        </button>
                        <div className="week-accordion-body" data-open={openWeeks["4-5"] ? "true" : "false"}>
                          <div className="schedule-grid">
                            <label className="schedule-item">
                              <input type="checkbox" name="schedule" value="4-29-olympics" />
                              <div className="schedule-label"><span className="schedule-main">4/29 (수) · Mini Olympics</span><span className="schedule-sub">4:30~5:20pm · Club House in Bayswater · 미니 올림픽</span></div>
                            </label>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>
                  <p className="month-hint">※ 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.</p>
                </div>

                {/* Room number */}
                <div className="field">
                  <label className="label-main" htmlFor="room">방 번호<span className="required">*</span></label>
                  <input id="room" name="room" type="text" required placeholder="예) 드하 5호 / C755 / 입실전" />
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
