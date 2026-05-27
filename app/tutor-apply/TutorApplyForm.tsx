"use client";
import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const DAY_OPTIONS = [
  { value: "mon", label: "월" },
  { value: "tue", label: "화" },
  { value: "wed", label: "수" },
  { value: "thu", label: "목" },
  { value: "fri", label: "금" },
  { value: "sat", label: "토" },
];

const OVERALL_LEVELS = [
  { value: "zero",         title: "제로 베이스 (기초)", desc: "영어를 처음 접함" },
  { value: "beginner",     title: "비기너",            desc: "알파벳 / 파닉스 / 단어" },
  { value: "intermediate", title: "미디엄",            desc: "문장 소통 가능" },
  { value: "advanced",     title: "어드밴스",          desc: "원서 리딩 / 토론 가능" },
];

const SPEAKING_LEVELS = [
  { value: "zero",          title: "제로 베이스 (기초)", desc: "" },
  { value: "beginner1",     title: "비기너1 (초급1)",    desc: "알파벳을 말할 수 있음" },
  { value: "beginner2",     title: "비기너2 (초급2)",    desc: "파닉스 및 기본 단어 발화" },
  { value: "intermediate1", title: "미디엄1 (중급1)",    desc: "자기소개, 짧게 영어 문장으로 말할 수 있음" },
  { value: "intermediate2", title: "미디엄2 (중급2)",    desc: "원활하게 영어로 소통 가능" },
  { value: "advanced1",     title: "어드밴스1 (고급)",   desc: "주제를 가지고 프리토킹 가능" },
  { value: "advanced2",     title: "어드밴스2 (심화)",   desc: "토론수업 참여, 의견 표현 가능" },
];

const READING_LEVELS = [
  { value: "zero",          title: "제로 베이스",       desc: "" },
  { value: "beginner1",     title: "비기너1 (초급1)",   desc: "알파벳을 읽을 수 있음" },
  { value: "beginner2",     title: "비기너2 (초급2)",   desc: "기본 단어 / 단모음 리딩 (예: can, fan)" },
  { value: "intermediate1", title: "미디엄1 (중급1)",   desc: "짧은 문장 / 이중모음 (예: cane, rain)" },
  { value: "intermediate2", title: "미디엄2 (중급2)",   desc: "긴 문장 (예: I can walk with a cane)" },
  { value: "advanced1",     title: "어드밴스1 (고급)",  desc: "원서 리딩 가능" },
  { value: "advanced2",     title: "어드밴스2 (심화)",  desc: "원서 리딩 / 독해 / 심화 Q&A 가능" },
];

const WRITING_LEVELS = [
  { value: "zero",          title: "제로 베이스",       desc: "" },
  { value: "beginner1",     title: "비기너1 (초급1)",   desc: "알파벳을 쓸 수 있음" },
  { value: "beginner2",     title: "비기너2 (초급2)",   desc: "기본 단어 쓰기 (CVC)" },
  { value: "intermediate1", title: "미디엄1 (중급1)",   desc: "짧은 영어 문장 쓰기" },
  { value: "intermediate2", title: "미디엄2 (중급2)",   desc: "긴 문장 쓰기" },
  { value: "advanced1",     title: "어드밴스1 (고급)",  desc: "기본 원서 롸이팅 가능" },
  { value: "advanced2",     title: "어드밴스2 (심화)",  desc: "심화 원서 롸이팅 가능" },
];

const CLASS_STYLES = [
  { value: "play",     title: "놀이식 (Play-based class)",        desc: "놀이 중심의 즐거운 영어 수업" },
  { value: "study",    title: "학습식 (Study-based class)",       desc: "체계적인 학습 중심 수업" },
  { value: "combined", title: "놀이+학습 (Combines both)",         desc: "놀이와 학습을 균형 있게" },
];

const CLASS_FOCUS = [
  { value: "speaking",   label: "스피킹 — Focus on the speaking drill" },
  { value: "reading",    label: "리딩 — Focus on the reading drill" },
  { value: "vocabulary", label: "보카 — Focus on the vocabulary drill" },
  { value: "writing",    label: "롸이팅 — Focus on the writing drill" },
  { value: "phonics",    label: "파닉스 — Focus on the phonics" },
  { value: "activity",   label: "액티비티 — Prefer fun activities" },
];

type FormState = {
  reserver_type: "" | "house" | "name";
  house_or_reserver: string;
  children_names: string;
  children_ages: string;
  class_type: "" | "1:1" | "1:2";
  sessions_per_day: 1 | 2;
  start_date: string;
  end_date: string;
  class_days: string[];
  excluded_dates: string;
  class_time: string;
  overall_level: string;
  speaking_level: string;
  reading_level: string;
  writing_level: string;
  textbook: string;
  class_style: string;
  class_focus: string[];
  child_notes: string;
  agreed_privacy: boolean;
  agreed_tutor_rules: boolean;
};

const INIT: FormState = {
  reserver_type: "",
  house_or_reserver: "",
  children_names: "",
  children_ages: "",
  class_type: "",
  sessions_per_day: 1,
  start_date: "",
  end_date: "",
  class_days: [],
  excluded_dates: "",
  class_time: "",
  overall_level: "",
  speaking_level: "",
  reading_level: "",
  writing_level: "",
  textbook: "",
  class_style: "",
  class_focus: [],
  child_notes: "",
  agreed_privacy: false,
  agreed_tutor_rules: false,
};

function isSunday(dateStr: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr + "T00:00:00").getDay() === 0;
}

export default function TutorApplyForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INIT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const hourlyRate = form.class_type === "1:1" ? 300 : form.class_type === "1:2" ? 350 : 0;
  const perSessionCost = hourlyRate * form.sessions_per_day;
  const canSubmit = useMemo(
    () => form.agreed_privacy && form.agreed_tutor_rules && !submitting,
    [form.agreed_privacy, form.agreed_tutor_rules, submitting],
  );

  const reserverPlaceholder = form.reserver_type === "house"
    ? "B17L15"
    : form.reserver_type === "name"
      ? "홍길동"
      : "드림하우스 번호 또는 예약자 성함";
  const reserverLabel = form.reserver_type === "house"
    ? "드림하우스 호실 번호"
    : form.reserver_type === "name"
      ? "예약자 성함"
      : "드림하우스 넘버 또는 예약자명";

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k as string]) setErrors(e => { const n = { ...e }; delete n[k as string]; return n; });
  }

  function toggleDay(v: string) {
    setForm(f => ({ ...f, class_days: f.class_days.includes(v) ? f.class_days.filter(d => d !== v) : [...f.class_days, v] }));
    if (errors.class_days) setErrors(e => { const n = { ...e }; delete n.class_days; return n; });
  }

  function toggleFocus(v: string) {
    setForm(f => {
      if (f.class_focus.includes(v)) return { ...f, class_focus: f.class_focus.filter(x => x !== v) };
      if (f.class_focus.length >= 2) return f;
      return { ...f, class_focus: [...f.class_focus, v] };
    });
    if (errors.class_focus) setErrors(e => { const n = { ...e }; delete n.class_focus; return n; });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.reserver_type) e.reserver_type = "예약자 구분을 선택해주세요";
    if (!form.house_or_reserver.trim()) e.house_or_reserver = "필수 항목입니다";
    if (!form.children_names.trim()) e.children_names = "필수 항목입니다";
    if (!form.children_ages.trim()) e.children_ages = "필수 항목입니다";
    if (!form.class_type) e.class_type = "수업 유형을 선택해주세요";
    if (!form.start_date) e.start_date = "필수 항목입니다";
    else if (isSunday(form.start_date)) e.start_date = "일요일은 수업 불가합니다";
    if (!form.end_date) e.end_date = "필수 항목입니다";
    else if (isSunday(form.end_date)) e.end_date = "일요일은 수업 불가합니다";
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      e.end_date = "종료일은 시작일 이후여야 합니다";
    }
    if (form.class_days.length === 0) e.class_days = "수업 요일을 1개 이상 선택해주세요";
    if (!form.class_time.trim()) e.class_time = "필수 항목입니다";
    if (!form.overall_level) e.overall_level = "필수 항목입니다";
    if (!form.speaking_level) e.speaking_level = "필수 항목입니다";
    if (!form.reading_level) e.reading_level = "필수 항목입니다";
    if (!form.writing_level) e.writing_level = "필수 항목입니다";
    if (!form.class_style) e.class_style = "필수 항목입니다";
    if (form.class_focus.length === 0) e.class_focus = "수업 포커스를 1개 이상 선택해주세요";
    if (!form.agreed_privacy) e.agreed_privacy = "동의가 필요합니다";
    if (!form.agreed_tutor_rules) e.agreed_tutor_rules = "동의가 필요합니다";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit() {
    setTopError("");
    if (!validate()) {
      setTopError("입력하지 않은 필수 항목이 있습니다. 빨갛게 표시된 부분을 확인해주세요.");
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSubmitting(true);
    const payload = {
      reserver_type: form.reserver_type,
      house_or_reserver: form.house_or_reserver.trim(),
      children_names: form.children_names.trim(),
      children_ages: form.children_ages.trim(),
      class_type: form.class_type,
      sessions_per_day: form.sessions_per_day,
      hourly_rate: hourlyRate,
      start_date: form.start_date,
      end_date: form.end_date,
      class_days: form.class_days,
      excluded_dates: form.excluded_dates.trim() || null,
      class_time: form.class_time.trim(),
      overall_level: form.overall_level,
      speaking_level: form.speaking_level,
      reading_level: form.reading_level,
      writing_level: form.writing_level,
      textbook: form.textbook.trim() || null,
      class_style: form.class_style,
      class_focus: form.class_focus,
      child_notes: form.child_notes.trim() || null,
      agreed_privacy: form.agreed_privacy,
      agreed_tutor_rules_bool: form.agreed_tutor_rules,
    };
    const res = await fetch("/api/tutor-apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      setTopError("신청 제출에 실패했습니다: " + (r.error || "알 수 없는 오류"));
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    router.push("/tutor-apply/success");
  }

  return (
    <>
      <style>{`
:root{--p:#1a6fc4;--pu:#7c3aed;--err:#dc2626;--muted:#94a3b8;--bd:#e2e8f0;--ink:#1a1a2e;--ink2:#475569}
.ap-w{max-width:720px;margin:0 auto;padding:16px 16px 120px;color:var(--ink)}
.ap-head{background:linear-gradient(135deg,var(--p),var(--pu));border-radius:16px;padding:22px 20px;color:#fff;margin-bottom:14px}
.ap-head h1{font-size:20px;font-weight:800;margin:0 0 4px}.ap-head p{font-size:12.5px;opacity:0.9;line-height:1.6;margin:0}
.ap-prog{display:flex;gap:4px;margin:14px 0 10px}
.ap-prog div{flex:1;height:4px;border-radius:2px;background:#dbeafe}
.ap-prog div.on{background:linear-gradient(90deg,var(--p),var(--pu))}
.sec{background:#fff;border-radius:14px;padding:20px 18px;box-shadow:0 1px 8px rgba(0,0,0,0.04);margin-bottom:12px;scroll-margin-top:16px}
.sec h2{font-size:15px;font-weight:800;color:var(--p);margin:0 0 4px;padding:0}
.sec .sec-sub{font-size:12px;color:var(--muted);margin:0 0 14px;padding:0 0 10px;border-bottom:1px solid var(--bd)}
.q{margin-bottom:18px}
.q:last-child{margin-bottom:0}
.q-label{display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:700;color:var(--ink);margin-bottom:6px}
.q-label .num{width:22px;height:22px;border-radius:50%;background:var(--p);color:#fff;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.q-label .req{color:var(--err)}
.q-hint{display:block;font-size:11.5px;color:var(--muted);margin:-2px 0 8px 28px}
.inp,.area{width:100%;padding:11px 12px;border:1px solid var(--bd);border-radius:9px;font-size:13.5px;font-family:inherit;outline:none;background:#fff;color:var(--ink)}
.area{resize:vertical;min-height:72px;line-height:1.5}
.inp:focus,.area:focus{border-color:var(--p);box-shadow:0 0 0 3px rgba(26,111,196,0.1)}
.inp.err,.area.err{border-color:var(--err);background:#fff5f5}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.opts{display:flex;flex-wrap:wrap;gap:6px}
.opt{padding:9px 14px;border:1px solid var(--bd);border-radius:9px;font-size:13px;cursor:pointer;background:#fff;font-family:inherit;font-weight:600;color:var(--ink2);user-select:none;transition:all 120ms}
.opt:hover{border-color:#64748b}
.opt.on{background:var(--p);color:#fff;border-color:var(--p)}
.opt.dim{opacity:0.4;cursor:not-allowed;background:#f8fafc}
.cards{display:flex;flex-direction:column;gap:8px}
.card-opt{padding:13px 14px;border:1.5px solid var(--bd);border-radius:10px;background:#fff;cursor:pointer;font-family:inherit;text-align:left;transition:all 120ms}
.card-opt:hover{border-color:#64748b}
.card-opt.on{border-color:var(--p);background:#eff6ff}
.card-opt .t{font-size:13.5px;font-weight:800;color:var(--ink);display:flex;align-items:center;gap:6px}
.card-opt .t .dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--bd);flex-shrink:0;transition:all 120ms}
.card-opt.on .t .dot{border-color:var(--p);background:var(--p);box-shadow:inset 0 0 0 3px #fff}
.card-opt .d{font-size:12px;color:var(--ink2);margin:4px 0 0 22px;line-height:1.5}
.fld-err{margin-top:5px;font-size:12px;color:var(--err);font-weight:600}
.cost-box{margin-top:10px;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;font-size:13px;color:#1e40af;font-weight:700;display:flex;align-items:center;gap:8px}
.cost-box .big{font-size:17px;font-weight:900}
.cost-box .sm{font-size:11.5px;color:#475569;font-weight:600}
.agree-box{border:1px solid var(--bd);border-radius:10px;padding:14px;background:#f8fafc;margin-bottom:10px}
.agree-box .tt{font-size:12.5px;font-weight:700;color:var(--ink2);margin-bottom:6px}
.agree-box .bd{font-size:12px;color:var(--ink2);line-height:1.6}
.agree-box .bd .row{display:flex;gap:8px;margin-bottom:2px}
.agree-box .bd .row .k{color:#6b7c93;min-width:100px;flex-shrink:0}
.agree-chk{display:flex;align-items:flex-start;gap:10px;padding:12px;background:#fff;border:1.5px solid var(--bd);border-radius:10px;cursor:pointer;transition:all 120ms}
.agree-chk:hover{border-color:#64748b}
.agree-chk.on{border-color:var(--p);background:#eff6ff}
.agree-chk input{width:20px;height:20px;margin:1px 0 0;accent-color:var(--p);flex-shrink:0;cursor:pointer}
.agree-chk span{font-size:13.5px;color:var(--ink);font-weight:600}
.rules-acc{margin-top:8px}
.rules-acc summary{cursor:pointer;font-size:12px;color:var(--p);font-weight:700;padding:8px 10px;background:#eff6ff;border-radius:8px;list-style:none;user-select:none}
.rules-acc summary::-webkit-details-marker{display:none}
.rules-acc[open] summary{margin-bottom:10px}
.rules-acc .rules-body{font-size:11.5px;color:var(--ink2);line-height:1.7;padding:12px 14px;background:#fff;border:1px solid var(--bd);border-radius:8px;white-space:pre-wrap}
.top-err{background:#fef2f2;border:1px solid #fecaca;color:var(--err);padding:13px 16px;border-radius:10px;font-size:13px;font-weight:600;margin-bottom:14px;line-height:1.5}
.footer-bar{position:fixed;bottom:0;left:0;right:0;background:rgba(255,255,255,0.96);backdrop-filter:blur(10px);border-top:1px solid var(--bd);padding:12px 16px;z-index:10;box-shadow:0 -4px 20px rgba(0,0,0,0.04)}
.footer-inner{max-width:720px;margin:0 auto}
.btn-submit{width:100%;padding:15px;background:linear-gradient(135deg,var(--p),var(--pu));color:#fff;font-size:15px;font-weight:800;border:none;border-radius:11px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px}
.btn-submit:disabled{opacity:0.5;cursor:not-allowed}
.btn-submit:hover:not(:disabled){opacity:0.94}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.focus-counter{font-size:11.5px;color:var(--muted);margin-left:6px;font-weight:600}
.focus-counter.full{color:var(--err)}
.ap-foot-note{font-size:11px;color:var(--muted);text-align:center;margin-top:8px}
@media(max-width:500px){.ap-w{padding:12px 12px 120px}.row2{grid-template-columns:1fr}.sec{padding:18px 16px}.ap-head{padding:18px 16px}}
      `}</style>
      <main className="ap-w">
        <div ref={topRef} />
        <header className="ap-head">
          <h1>👩‍🏫 드림아카데미 튜터 신청</h1>
          <p>드림하우스 투숙객 대상 방문 수업 신청서입니다. 작성 후 담당자가 확인하여 배정해드립니다.</p>
        </header>

        {topError && (
          <div className="top-err" role="alert" aria-live="assertive">⚠️ {topError}</div>
        )}

        {/* 섹션 1: 기본 정보 */}
        <section className="sec" aria-labelledby="s1">
          <h2 id="s1">1. 기본 정보</h2>
          <p className="sec-sub">신청자 및 자녀 정보</p>

          <div className="q">
            <label className="q-label"><span className="num">1</span>예약자 구분<span className="req">*</span></label>
            <div className="opts" role="radiogroup" aria-required="true" aria-invalid={!!errors.reserver_type}>
              <button
                type="button"
                role="radio"
                aria-checked={form.reserver_type === "house"}
                className={`opt${form.reserver_type === "house" ? " on" : ""}`}
                onClick={() => setField("reserver_type", "house")}
              >🏠 드림하우스 투숙객</button>
              <button
                type="button"
                role="radio"
                aria-checked={form.reserver_type === "name"}
                className={`opt${form.reserver_type === "name" ? " on" : ""}`}
                onClick={() => setField("reserver_type", "name")}
              >👤 외부 신청</button>
            </div>
            {errors.reserver_type && <div className="fld-err">{errors.reserver_type}</div>}
          </div>

          <div className="q">
            <label className="q-label" htmlFor="f-house"><span className="num">2</span>{reserverLabel}<span className="req">*</span></label>
            <input
              id="f-house"
              className={`inp${errors.house_or_reserver ? " err" : ""}`}
              value={form.house_or_reserver}
              onChange={e => setField("house_or_reserver", e.target.value)}
              placeholder={reserverPlaceholder}
              aria-required="true"
              aria-invalid={!!errors.house_or_reserver}
              maxLength={100}
            />
            {errors.house_or_reserver && <div className="fld-err">{errors.house_or_reserver}</div>}
          </div>

          <div className="q">
            <label className="q-label" htmlFor="f-names"><span className="num">3</span>수강자 이름 (한글 + 영문)<span className="req">*</span></label>
            <span className="q-hint">여러 명은 / 로 구분해주세요</span>
            <input
              id="f-names"
              className={`inp${errors.children_names ? " err" : ""}`}
              value={form.children_names}
              onChange={e => setField("children_names", e.target.value)}
              placeholder="김사랑, kim sa rang (여러 명: / 로 구분)"
              aria-required="true"
              aria-invalid={!!errors.children_names}
              maxLength={200}
            />
            {errors.children_names && <div className="fld-err">{errors.children_names}</div>}
          </div>

          <div className="q">
            <label className="q-label" htmlFor="f-ages"><span className="num">4</span>수강자 나이<span className="req">*</span></label>
            <span className="q-hint">예: 2019.09.03 만 5세 / 현재 나이로 기재 가능</span>
            <input
              id="f-ages"
              className={`inp${errors.children_ages ? " err" : ""}`}
              value={form.children_ages}
              onChange={e => setField("children_ages", e.target.value)}
              placeholder="2019.09.03 만 5세"
              aria-required="true"
              aria-invalid={!!errors.children_ages}
              maxLength={200}
            />
            {errors.children_ages && <div className="fld-err">{errors.children_ages}</div>}
          </div>
        </section>

        {/* 섹션 2: 수업 유형 */}
        <section className="sec" aria-labelledby="s2">
          <h2 id="s2">2. 수업 유형</h2>
          <p className="sec-sub">타임 수에 따라 회당 요금이 결정됩니다 (1타임 = 50분 수업)</p>

          <div className="q">
            <label className="q-label"><span className="num">5</span>수업 유형<span className="req">*</span></label>
            <div className="opts" role="radiogroup" aria-required="true" aria-invalid={!!errors.class_type}>
              <button
                type="button"
                role="radio"
                aria-checked={form.class_type === "1:1"}
                className={`opt${form.class_type === "1:1" ? " on" : ""}`}
                onClick={() => setField("class_type", "1:1")}
              >1:1 (₱300/타임)</button>
              <button
                type="button"
                role="radio"
                aria-checked={form.class_type === "1:2"}
                className={`opt${form.class_type === "1:2" ? " on" : ""}`}
                onClick={() => setField("class_type", "1:2")}
              >1:2 (₱350/타임)</button>
            </div>
            {errors.class_type && <div className="fld-err">{errors.class_type}</div>}
          </div>

          <div className="q">
            <label className="q-label"><span className="num">6</span>타임 수 (1회 수업당)<span className="req">*</span></label>
            <span className="q-hint">1일 최대 2타임까지 가능합니다</span>
            <div className="opts" role="radiogroup" aria-required="true">
              <button
                type="button"
                role="radio"
                aria-checked={form.sessions_per_day === 1}
                className={`opt${form.sessions_per_day === 1 ? " on" : ""}`}
                onClick={() => setField("sessions_per_day", 1)}
              >1타임 (50분)</button>
              <button
                type="button"
                role="radio"
                aria-checked={form.sessions_per_day === 2}
                className={`opt${form.sessions_per_day === 2 ? " on" : ""}`}
                onClick={() => setField("sessions_per_day", 2)}
              >2타임 (100분)</button>
            </div>
            {form.class_type && (
              <div className="cost-box" aria-live="polite">
                💰 <span>회당</span>
                <span className="big">₱{perSessionCost.toLocaleString()}</span>
                <span className="sm">= ₱{hourlyRate} × {form.sessions_per_day}타임</span>
              </div>
            )}
          </div>
        </section>

        {/* 섹션 3: 일정 */}
        <section className="sec" aria-labelledby="s3">
          <h2 id="s3">3. 일정</h2>
          <p className="sec-sub">오전 10시 ~ 오후 8시 사이 가능, 일요일 제외</p>

          <div className="q">
            <div className="row2">
              <div>
                <label className="q-label" htmlFor="f-start"><span className="num">7</span>시작일<span className="req">*</span></label>
                <input
                  id="f-start"
                  className={`inp${errors.start_date ? " err" : ""}`}
                  type="date"
                  value={form.start_date}
                  onChange={e => setField("start_date", e.target.value)}
                  aria-required="true"
                  aria-invalid={!!errors.start_date}
                />
                {errors.start_date && <div className="fld-err">{errors.start_date}</div>}
              </div>
              <div>
                <label className="q-label" htmlFor="f-end"><span className="num">8</span>종료일<span className="req">*</span></label>
                <input
                  id="f-end"
                  className={`inp${errors.end_date ? " err" : ""}`}
                  type="date"
                  value={form.end_date}
                  onChange={e => setField("end_date", e.target.value)}
                  aria-required="true"
                  aria-invalid={!!errors.end_date}
                />
                {errors.end_date && <div className="fld-err">{errors.end_date}</div>}
              </div>
            </div>
          </div>

          <div className="q">
            <label className="q-label"><span className="num">9</span>수업 요일<span className="req">*</span></label>
            <span className="q-hint">복수 선택 가능 (일요일 제외)</span>
            <div className="opts">
              {DAY_OPTIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  role="checkbox"
                  aria-checked={form.class_days.includes(d.value)}
                  className={`opt${form.class_days.includes(d.value) ? " on" : ""}`}
                  onClick={() => toggleDay(d.value)}
                >{d.label}</button>
              ))}
            </div>
            {errors.class_days && <div className="fld-err">{errors.class_days}</div>}
          </div>

          <div className="q">
            <label className="q-label" htmlFor="f-excl"><span className="num">10</span>빠지는 날짜 / 변경 날짜</label>
            <textarea
              id="f-excl"
              className="area"
              value={form.excluded_dates}
              onChange={e => setField("excluded_dates", e.target.value)}
              placeholder="예: 10월 15일(화) 빠짐 / 10월 16일(수)→10월 18일(금) 변경"
              maxLength={2000}
            />
          </div>

          <div className="q">
            <label className="q-label" htmlFor="f-time"><span className="num">11</span>수업 시간대<span className="req">*</span></label>
            <span className="q-hint">오전 10시 ~ 오후 8시 사이 가능 (일요일 불가)<br />※ 확정 시간은 담당자가 연락 후 조율합니다</span>
            <input
              id="f-time"
              className={`inp${errors.class_time ? " err" : ""}`}
              value={form.class_time}
              onChange={e => setField("class_time", e.target.value)}
              placeholder="예: 오전 10시 ~ 오후 12시 (2시간 수업)"
              aria-required="true"
              aria-invalid={!!errors.class_time}
              maxLength={100}
            />
            {errors.class_time && <div className="fld-err">{errors.class_time}</div>}
          </div>
        </section>

        {/* 섹션 4: 영어 레벨 */}
        <section className="sec" aria-labelledby="s4">
          <h2 id="s4">4. 영어 레벨</h2>
          <p className="sec-sub">튜터 매칭 및 수업 준비를 위해 꼭 필요합니다</p>

          <LevelGroup
            num={12} label="전체 영어 레벨" required
            value={form.overall_level} error={errors.overall_level}
            options={OVERALL_LEVELS}
            onPick={v => setField("overall_level", v)}
          />
          <LevelGroup
            num={13} label="스피킹 레벨" required
            value={form.speaking_level} error={errors.speaking_level}
            options={SPEAKING_LEVELS}
            onPick={v => setField("speaking_level", v)}
          />
          <LevelGroup
            num={14} label="리딩 레벨" required
            value={form.reading_level} error={errors.reading_level}
            options={READING_LEVELS}
            onPick={v => setField("reading_level", v)}
          />
          <LevelGroup
            num={15} label="롸이팅 레벨" required
            value={form.writing_level} error={errors.writing_level}
            options={WRITING_LEVELS}
            onPick={v => setField("writing_level", v)}
          />
        </section>

        {/* 섹션 5: 수업 방향 */}
        <section className="sec" aria-labelledby="s5">
          <h2 id="s5">5. 수업 방향</h2>
          <p className="sec-sub">어떤 스타일의 수업을 원하시는지 알려주세요</p>

          <div className="q">
            <label className="q-label" htmlFor="f-textbook"><span className="num">16</span>사용 중인 영어 교재</label>
            <input
              id="f-textbook"
              className="inp"
              value={form.textbook}
              onChange={e => setField("textbook", e.target.value)}
              placeholder="예) 브릭스 50, 리딩스트리트 2.1, 멀티플리딩스킬"
              maxLength={100}
            />
          </div>

          <LevelGroup
            num={17} label="수업 방향" required
            value={form.class_style} error={errors.class_style}
            options={CLASS_STYLES}
            onPick={v => setField("class_style", v)}
          />

          <div className="q">
            <label className="q-label"><span className="num">18</span>수업 포커스<span className="req">*</span>
              <span className={`focus-counter${form.class_focus.length >= 2 ? " full" : ""}`}>
                {form.class_focus.length}/2 선택
              </span>
            </label>
            <span className="q-hint">최소 1개, 최대 2개까지 선택 가능합니다</span>
            <div className="opts">
              {CLASS_FOCUS.map(f => {
                const on = form.class_focus.includes(f.value);
                const dim = !on && form.class_focus.length >= 2;
                return (
                  <button
                    key={f.value}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={dim}
                    className={`opt${on ? " on" : ""}${dim ? " dim" : ""}`}
                    onClick={() => toggleFocus(f.value)}
                  >{f.label}</button>
                );
              })}
            </div>
            {errors.class_focus && <div className="fld-err">{errors.class_focus}</div>}
          </div>

          <div className="q">
            <label className="q-label" htmlFor="f-notes"><span className="num">19</span>수강자 성향 / 흥미</label>
            <textarea
              id="f-notes"
              className="area"
              value={form.child_notes}
              onChange={e => setField("child_notes", e.target.value)}
              placeholder="예) 낯을 많이 가려요 / 티니핑을 좋아해요 / 공룡 이야기에 흥미"
              maxLength={2000}
            />
          </div>
        </section>

        {/* 섹션 6: 동의 */}
        <section className="sec" aria-labelledby="s6">
          <h2 id="s6">6. 동의사항</h2>
          <p className="sec-sub">신청 접수를 위해 필수입니다</p>

          <div className="q">
            <label className="q-label" htmlFor="f-privacy"><span className="num">20</span>개인정보 수집 및 이용 동의<span className="req">*</span></label>
            <div className="agree-box">
              <div className="tt">📋 개인정보 수집 및 이용 안내</div>
              <div className="bd">
                <div className="row"><span className="k">수집 항목</span><span>이름, 연락처</span></div>
                <div className="row"><span className="k">수집·이용 목적</span><span>수업 관련 정보 안내</span></div>
                <div className="row"><span className="k">보유·이용 기간</span><span>수업 종료 후 1개월</span></div>
              </div>
            </div>
            <label htmlFor="f-privacy" className={`agree-chk${form.agreed_privacy ? " on" : ""}`}>
              <input
                id="f-privacy"
                type="checkbox"
                checked={form.agreed_privacy}
                onChange={e => setField("agreed_privacy", e.target.checked)}
                aria-required="true"
                aria-invalid={!!errors.agreed_privacy}
              />
              <span>위 개인정보 수집·이용에 동의합니다</span>
            </label>
            {errors.agreed_privacy && <div className="fld-err">{errors.agreed_privacy}</div>}
          </div>

          <div className="q">
            <label className="q-label" htmlFor="f-rules"><span className="num">21</span>튜터 규정 확인<span className="req">*</span></label>
            <div className="agree-box">
              <div className="tt">📌 튜터 수업 운영 규정</div>
              <div className="bd" style={{ fontSize: 11.5, lineHeight: 1.75 }}>
                아래 전체 규정을 확인하신 뒤 동의해주세요.
              </div>
              <details className="rules-acc">
                <summary>규정 전문 펼치기 ▼</summary>
                <div className="rules-body">{RULES_TEXT}</div>
              </details>
            </div>
            <label htmlFor="f-rules" className={`agree-chk${form.agreed_tutor_rules ? " on" : ""}`}>
              <input
                id="f-rules"
                type="checkbox"
                checked={form.agreed_tutor_rules}
                onChange={e => setField("agreed_tutor_rules", e.target.checked)}
                aria-required="true"
                aria-invalid={!!errors.agreed_tutor_rules}
              />
              <span>튜터 규정을 확인하였고, 이에 동의합니다</span>
            </label>
            {errors.agreed_tutor_rules && <div className="fld-err">{errors.agreed_tutor_rules}</div>}
          </div>
        </section>

        <div className="ap-foot-note">
          신청 후 담당자가 카카오톡 또는 연락처로 배정 안내를 드립니다.
        </div>
      </main>

      <div className="footer-bar">
        <div className="footer-inner">
          <button
            type="button"
            className="btn-submit"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (<><span className="spinner" aria-hidden="true"></span>제출 중...</>) : "튜터 수업 신청하기"}
          </button>
        </div>
      </div>
    </>
  );
}

interface LevelOption { value: string; title: string; desc: string }
interface LevelGroupProps {
  num: number;
  label: string;
  required?: boolean;
  value: string;
  error?: string;
  options: LevelOption[];
  onPick: (v: string) => void;
}

function LevelGroup({ num, label, required, value, error, options, onPick }: LevelGroupProps) {
  return (
    <div className="q">
      <label className="q-label"><span className="num">{num}</span>{label}{required && <span className="req">*</span>}</label>
      <div className="cards" role="radiogroup" aria-required={required} aria-invalid={!!error}>
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`card-opt${value === o.value ? " on" : ""}`}
            onClick={() => onPick(o.value)}
          >
            <div className="t"><span className="dot" aria-hidden="true"></span>{o.title}</div>
            {o.desc && <div className="d">{o.desc}</div>}
          </button>
        ))}
      </div>
      {error && <div className="fld-err">{error}</div>}
    </div>
  );
}

const RULES_TEXT = `#기본 안내
· 한 타임당 최대 튜터 선생님 2명까지 신청 가능
· 플레이드림 / 드림아카데미 티쳐가 집으로 방문 수업
· 외부 활동 및 놀이터 등 외출은 불가
· 기본적인 워크지 등 학습 자료는 튜터가 준비
· 별도로 원하는 교재 → 개별 지참 필요
· (수업에 대한 개별적 피드백은 미제공)
· 아이가 어린 경우, 색종이 / 보드게임 / 플래시카드 등 추천

#운영시간 / 비용
· 월요일 ~ 토요일
· 한 타임당 50분 수업
· 오전 10시 ~ 오후 8시 (수업 종료 시간)
· 1일 최대 2타임 수업 가능 (3타임 불가)
· 튜터서비스 비용: 1:1 ₱300 / 1:2 ₱350

#튜터 변경 및 환불 규정
· 성수기 기간 5시 시작부터 수업 가능
· 최소 2주 전 사전 예약 필수 / 성수기 3주 전
· 변경은 수업일 4일 전까지 가능

⚠️ 아래 경우에는 변경 및 환불 불가
· 당일 취소 및 일정 변경
· 수업 시작 후 학생 거부로 취소 요청
· 수업 3일 전 이내 취소 시
· 당일 2회 이상 변경 시
· 당일 노쇼 (무단 결석)
  → 모든 수업은 자동 취소되며, 환불이 불가합니다
  → 또한, 이후 수업에 대한 재신청도 불가하오니 꼭 유의해주세요`;
