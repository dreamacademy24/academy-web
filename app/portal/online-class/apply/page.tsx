"use client";
import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface OccupiedEntry { tutor_id: string; tutor_name: string; student_name: string }
interface DayCell { available: number; total: number; status: string; occupied: OccupiedEntry[] }
interface Slot { time_kr: string; time_ph: string; days: Record<string, DayCell> }
interface TutorBrief { id: string; name: string }

const DAY_KR: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토" };
const DAYS = ["mon", "tue", "wed", "thu", "fri"]; // 평일만 (2026-08 개편)
const RESUME_DATE = "2026-09-07"; // 성수기 후 재개일 — 이 날짜 전으로는 시작 불가 (다음 시즌에 갱신)

export default function ApplyPage() {
  return (
    <Suspense fallback={null}>
      <ApplyInner />
    </Suspense>
  );
}

function ApplyInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewUid = searchParams.get("preview_uid") || "";
  const [authChecking, setAuthChecking] = useState(true);
  const [authUser, setAuthUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [level, setLevel] = useState("");
  const [children, setChildren] = useState<{ kor: string; en: string }[]>([]);
  const [enrolledNames, setEnrolledNames] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<"pre" | "post" | "">("");
  const [startDate, setStartDate] = useState("");
  const [bk, setBk] = useState<{ ci: string; co: string; weeks: number } | null>(null);
  const [childName, setChildName] = useState("");     // 선택된 아이 한글명
  const [childEn, setChildEn] = useState("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tutors, setTutors] = useState<TutorBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id || previewUid; // preview_uid = 어드민 미리보기 (제출 불가)
      if (!uid) {
        if (typeof window !== "undefined") router.replace("/login");
        return;
      }
      if (data.session) setAuthUser(data.session.user);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).single();
      setProfile(prof);
      // 이 계정에 연결된 예약의 자녀(최대 4명) 로드
      try {
        const { data: bks } = await supabase.from("bookings").select("students, checkin_date, checkout_date, accom_weeks, dh_weeks, accom_type, status").eq("portal_user_id", uid).neq("status", "취소").order("checkin_date", { ascending: false });
        const list: { kor: string; en: string }[] = [];
        const seen = new Set<string>();
        for (const b of (bks || [])) {
          let arr: any = b.students; if (typeof arr === "string") { try { arr = JSON.parse(arr); } catch { arr = []; } }
          for (const s of (Array.isArray(arr) ? arr : [])) {
            const kor = (s.korName || s.name_kr || s.name || "").trim();
            const en = (s.engName || s.name_en || "").trim();
            if (kor && !seen.has(kor)) { seen.add(kor); list.push({ kor, en }); }
          }
        }
        // 프로필 children 항상 병합 (예약 students에 없는 아이도 포함)
        if (prof?.children) {
          let ch: any = prof.children; if (typeof ch === "string") { try { ch = JSON.parse(ch); } catch { ch = []; } }
          for (const c of (Array.isArray(ch) ? ch : [])) { const kor = (c.name || c.kor || "").trim(); if (kor && !seen.has(kor)) { seen.add(kor); list.push({ kor, en: (c.name_en || c.en || "").trim() }); } }
        }
        // 가장 가까운(미래 우선) 예약으로 전/후 기준 잡기
        const _t = new Date().toISOString().slice(0, 10);
        const upcoming = (bks || []).filter((b: any) => (b.checkin_date || "") > _t).sort((a: any, b: any) => a.checkin_date.localeCompare(b.checkin_date))[0];
        const latest = upcoming || (bks || [])[0];
        if (latest?.checkin_date) {
          const wks = Number(latest.dh_weeks || latest.accom_weeks) || Math.max(1, Math.round((new Date(latest.checkout_date).getTime() - new Date(latest.checkin_date).getTime()) / (7 * 86400000)));
          setBk({ ci: latest.checkin_date, co: latest.checkout_date, weeks: wks });
          setPeriod((latest.checkin_date > _t) ? "" : "post"); // 미래 예약이면 선택하게, 지난 예약이면 바로 시작(후)
        }
        setChildren(list.slice(0, 6));
        // 이미 화상영어 등록된 아이 이름 (중복 신청 방지 표시)
        try {
          const er = await fetch(`/api/portal/online-class/enrollments?customer_user_id=${uid}`);
          if (er.ok) { const ed = await er.json(); const en = new Set<string>((ed.enrollments || []).map((e: any) => (e.student_name || "").trim()).filter(Boolean)); setEnrolledNames(en); }
        } catch { /* ignore */ }
        const notEnrolled = list.filter(c => true);
        if (notEnrolled.length === 1) { setChildName(notEnrolled[0].kor); setChildEn(notEnrolled[0].en); }
      } catch { /* ignore */ }
      setAuthChecking(false);
    })();
  }, [router]);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/online-class/availability/slots");
    if (res.ok) {
      const d = await res.json();
      setSlots(d.slots || []);
      setTutors(d.tutors || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (step === 2 && !slots.length) loadSlots(); }, [step, slots.length, loadSlots]);

  function toggleDay(d: string) {
    setSelectedDays(prev => {
      if (prev.includes(d)) return prev.filter(x => x !== d);
      if (prev.length >= 3) return prev;
      return [...prev, d];
    });
  }

  const dayAggregatedSlots = useMemo(() => {
    if (!selectedDays.length) return [];
    return slots.map(s => {
      let minAvail = 99, maxAvail = 0, totalOcc = 0, anyClosed = false;
      for (const d of selectedDays) {
        const c = s.days[d];
        if (!c || c.status === "closed") { anyClosed = true; break; }
        minAvail = Math.min(minAvail, c.available);
        maxAvail = Math.max(maxAvail, c.available);
        totalOcc += c.occupied.length;
      }
      const status = anyClosed ? "closed" : (minAvail === 0 ? "full" : minAvail === 1 ? "last" : "open");
      return { time_kr: s.time_kr, time_ph: s.time_ph, status, minAvail: anyClosed ? 0 : minAvail, total: tutors.length, totalOcc };
    });
  }, [slots, selectedDays, tutors.length]);

  async function selectTime(t: string) {
    setSelectedTime(t);
    const qs = selectedDays.map(d => `days[]=${d}`).join("&") + `&time=${t}`;
    const res = await fetch(`/api/online-class/availability?${qs}`);
    if (res.ok) {
      const d = await res.json();
      if (d.any_available) {
        setSuggested(d.suggested_tutor);
        setStep(3);
      } else {
        setMsg({ text: d.message || "해당 시간대는 마감되었습니다.", type: "err" });
      }
    }
  }

  useEffect(() => {
    const pad = (n: number) => n < 10 ? "0" + n : "" + n;
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const eff = period || "post";
    let st = new Date(); st.setDate(st.getDate() + 4);
    if (eff === "post" && bk && bk.co > fmt(new Date())) { st = new Date(bk.co + "T00:00:00"); st.setDate(st.getDate() + 1); }
    let ds = fmt(st);
    if (ds < RESUME_DATE) ds = RESUME_DATE; // 재개일 이전 시작 불가
    setStartDate(ds);
  }, [period, bk]);

  function planInfo() {
    const pad = (n: number) => n < 10 ? "0" + n : "" + n;
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const eff = period || "post";
    let start = new Date(); start.setDate(start.getDate() + 4);
    if (eff === "post" && bk && bk.co > fmt(new Date())) { start = new Date(bk.co + "T00:00:00"); start.setDate(start.getDate() + 1); }
    return { eff, startStr: startDate || fmt(start), total: (bk?.weeks || 4) * 3 };
  }

  async function submit() {
    if (!authUser || !selectedDays.length || !selectedTime) return;
    setSubmitting(true);
    try {
      const studentName = childName || profile?.name || authUser.email?.split("@")[0] || "신청자";
      const pad = (n: number) => n < 10 ? "0" + n : "" + n;
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      // 시작일: 전 = 4일 뒤부터 (준비 기간) / 후 = 체크아웃 다음 날부터
      const eff = period || "post";
      let start = new Date(); start.setDate(start.getDate() + 4);
      if (eff === "post" && bk && bk.co > fmt(new Date())) { start = new Date(bk.co + "T00:00:00"); start.setDate(start.getDate() + 1); }
      let startStr = startDate || fmt(start);
      if (startStr < RESUME_DATE) startStr = RESUME_DATE;
      // 회차 = 패키지 등록 주수 × 주 3회 (기본 규정)
      const totalSessions = (bk?.weeks || 4) * 3;
      const res = await fetch("/api/online-class/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: studentName,
          student_name_en: childEn || null,
          customer_user_id: authUser.id,
          tutor_id: null, // 미배정 — 티쳐가 Open Students에서 가져감
          enrollment_type: "free_package",
          level,
          days_of_week: selectedDays,
          class_time_kr: selectedTime,
          start_date: startStr,
          end_date: null,
          sessions_per_week: selectedDays.length,
          total_sessions: totalSessions,
          pre_sessions: eff === "pre" ? totalSessions : 0,
          post_sessions: eff === "post" ? totalSessions : 0,
          class_period: eff,
          status: "active",
        }),
      });
      const r = await res.json();
      if (!res.ok) { setMsg({ text: r.error || "신청 실패", type: "err" }); return; }
      setMsg({ text: "✅ 신청되었습니다. 선생님 배정 후 안내드릴게요!", type: "ok" });
      setTimeout(() => router.push("/portal/online-class"), 1500);
    } finally {
      setSubmitting(false);
    }
  }

  if (authChecking) return null;

  return (<>
    <style>{`
.ap-w{max-width:640px;margin:0 auto;padding:24px 20px 48px}
.back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:12px}
.back:hover{color:#1a6fc4}
.head{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:18px;padding:22px;color:#fff;margin-bottom:14px}
.head h1{font-size:20px;font-weight:800;margin-bottom:4px}
.head p{font-size:12px;opacity:0.88}
.steps{display:flex;gap:6px;margin-bottom:14px}
.sp{flex:1;padding:8px 10px;border-radius:8px;font-size:12px;font-weight:700;text-align:center;background:#f1f5f9;color:#94a3b8}
.sp.ac{background:#1a6fc4;color:#fff}
.sp.done{background:#dcfce7;color:#166534}
.sec{background:#fff;border-radius:14px;padding:18px;box-shadow:0 1px 8px rgba(0,0,0,0.05);margin-bottom:12px}
.sec h2{font-size:14px;font-weight:800;color:#1a6fc4;margin-bottom:12px}
.days{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
.dchip{padding:14px 0;text-align:center;border-radius:10px;border:2px solid #e2e8f0;background:#fff;cursor:pointer;font-weight:700;font-size:14px;transition:all .15s;font-family:inherit;color:#1a1a2e}
.dchip:hover{border-color:#1a6fc4}
.dchip.on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.dchip:disabled{opacity:0.5;cursor:not-allowed}
.hint{font-size:11px;color:#6b7c93;margin-top:8px;text-align:center}
.times{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.tchip{padding:12px 8px;text-align:center;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;cursor:pointer;font-weight:700;font-size:13px;transition:all .15s;font-family:inherit;display:flex;flex-direction:column;gap:2px}
.tchip .ph{font-size:10px;font-weight:400;color:#6b7c93}
.tchip .cnt{font-size:10px;font-weight:700;margin-top:2px}
.tchip.open{color:#166534}
.tchip.open:hover{background:#dcfce7;border-color:#16a34a}
.tchip.last{background:#fef3c7;border-color:#eab308;color:#92400e}
.tchip.full{background:#fef2f2;color:#dc2626;border-color:#fecaca;cursor:not-allowed}
.tchip.closed{background:#f8fafc;color:#cbd5e1;cursor:not-allowed;border-color:transparent}
.confirm{padding:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin-bottom:12px}
.confirm .t{font-size:12px;color:#6b7c93;margin-bottom:3px}
.confirm .v{font-size:15px;font-weight:800;color:#1a1a2e}
.btn-p{width:100%;padding:12px;background:#1a6fc4;color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;margin-top:6px}
.btn-p:disabled{opacity:0.6;cursor:not-allowed}
.btn-s{padding:10px 16px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}
.acts{display:flex;gap:8px;margin-top:10px}
.acts button{flex:1}
.msg{position:fixed;top:16px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:10px;font-size:13px;font-weight:700;z-index:100;box-shadow:0 4px 14px rgba(0,0,0,0.15)}
.msg.ok{background:#dcfce7;color:#166534}
.msg.err{background:#fef2f2;color:#dc2626}
@media(max-width:500px){.ap-w{padding:20px 14px}.times{grid-template-columns:repeat(2,1fr)}}
    `}</style>

    {msg && <div className={`msg ${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

    <div className="ap-w">
      <button className="back" onClick={() => router.push("/portal/online-class")}>← 화상영어로 돌아가기</button>
      <div className="head"><h1>화상영어 신청</h1><p>요일과 시간을 선택하면 담당 선생님이 자동 배정됩니다</p></div>

      <div style={{ background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 10, padding: "9px 13px", marginBottom: 12, fontSize: 12.5, color: "#4338ca", lineHeight: 1.55 }}>
        <b>🛠 베타 오픈 (수정 중)</b> — 화상영어 메뉴를 새로 단장하고 있어요. 일정·회차가 다소 변경될 수 있으며, 이상한 점은 채널로 문의해 주세요!
      </div>
      {!authUser && previewUid && <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 12.5, fontWeight: 700, color: "#92400e" }}>👁 어드민 미리보기 모드 — 실제 신청은 되지 않아요</div>}
      <div className="steps">
        <div className={`sp ${step===1?"ac":step>1?"done":""}`}>1. 요일</div>
        <div className={`sp ${step===2?"ac":step>2?"done":""}`}>2. 시간</div>
        <div className={`sp ${step===3?"ac":""}`}>3. 확인</div>
      </div>

      {step === 1 && (
        <div className="sec">
          {children.length > 0 && (<>
            <h2>어느 아이 수업인가요?</h2>
            <div className="days">
              {children.map(c => {
                const done = enrolledNames.has(c.kor);
                return (
                <button key={c.kor} className={`dchip ${childName === c.kor ? "on" : ""}`} disabled={done}
                  onClick={() => { if (done) return; setChildName(c.kor); setChildEn(c.en); }}
                  title={done ? "이미 화상영어를 신청한 아이예요" : ""}
                  style={{ minWidth: 90, position: "relative", opacity: done ? 0.5 : 1, cursor: done ? "not-allowed" : "pointer" }}>
                  {c.kor}{c.en ? <span style={{ fontSize: 10, opacity: 0.7, display: "block" }}>{c.en}</span> : null}
                  {done ? <span style={{ fontSize: 9.5, color: "#16a34a", fontWeight: 800, display: "block", marginTop: 2 }}>✓ 신청됨</span> : null}
                </button>
                );
              })}
            </div>
            <div className="hint">한 계정에 여러 아이가 있으면 아이마다 따로 신청해요 · <b style={{ color: "#16a34a" }}>✓ 신청됨</b>은 이미 신청한 아이예요</div>
            <div style={{ height: 14 }} />
          </>)}
          {bk && bk.ci > new Date().toISOString().slice(0, 10) && (<>
            <h2>언제 수업할까요?</h2>
            <div className="days">
              <button className={`dchip ${period === "pre" ? "on" : ""}`} onClick={() => setPeriod("pre")} style={{ minWidth: 150, flexDirection: "column", height: "auto", padding: "10px 14px" }}>
                <div style={{ fontWeight: 800 }}>연수 가기 전에</div>
                <div style={{ fontSize: 10.5, opacity: 0.8, marginTop: 2 }}>지금 시작 → 출국 전까지</div>
              </button>
              <button className={`dchip ${period === "post" ? "on" : ""}`} onClick={() => setPeriod("post")} style={{ minWidth: 150, flexDirection: "column", height: "auto", padding: "10px 14px" }}>
                <div style={{ fontWeight: 800 }}>다녀와서</div>
                <div style={{ fontSize: 10.5, opacity: 0.8, marginTop: 2 }}>귀국 후({bk.co?.slice(5).replace("-", "/")}~) 시작</div>
              </button>
            </div>
            <div className="hint">연수 기간({bk.ci?.slice(5).replace("-", "/")}~{bk.co?.slice(5).replace("-", "/")})에는 수업이 자동으로 쉬어가요 · 총 {(bk.weeks || 4) * 3}회 (등록 {bk.weeks}주 × 주 3회)</div>
            <div style={{ height: 14 }} />
          </>)}
          <h2>수업 요일 선택 (최대 3개)</h2>
          <div className="days">
            {DAYS.map(d => (
              <button key={d} className={`dchip ${selectedDays.includes(d)?"on":""}`}
                disabled={!selectedDays.includes(d) && selectedDays.length >= 3}
                onClick={() => toggleDay(d)}>
                {DAY_KR[d]}
              </button>
            ))}
          </div>
          <div className="hint">{selectedDays.length}/3 선택됨 · 주 {selectedDays.length}회 수업 <b style={{ color: "#b45309" }}>(최소 주 2회)</b></div>
          <h2 style={{ marginTop: 22 }}>아이 영어 레벨</h2>
          <div className="days">
            {([["beginner", "비기너", "알파벳·기초 단어 수준"], ["intermediate", "인터미디어", "간단한 문장으로 대화 가능"], ["advanced", "어드밴스드", "자유로운 대화 가능"]] as const).map(([v, l, d]) => (
              <button key={v} className={`dchip ${level === v ? "on" : ""}`} onClick={() => setLevel(v)} style={{ minWidth: 120, flexDirection: "column", height: "auto", padding: "10px 14px" }}>
                <div style={{ fontWeight: 800 }}>{l}</div>
                <div style={{ fontSize: 10.5, opacity: 0.8, marginTop: 2 }}>{d}</div>
              </button>
            ))}
          </div>
          <div className="hint">레벨에 맞는 선생님을 배정해 드려요 (배정 후 조정 가능)</div>
          <button className="btn-p" disabled={selectedDays.length < 2 || !level || (children.length > 0 && !childName) || (!!bk && bk.ci > new Date().toISOString().slice(0, 10) && !period)} onClick={() => setStep(2)}>
            다음 단계
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="sec">
          <h2>수업 시작일</h2>
          {(() => {
            const pad = (n: number) => n < 10 ? "0" + n : "" + n;
            const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
            const base = new Date(); base.setDate(base.getDate() + 4);
            let minD = fmt(base); if (minD < RESUME_DATE) minD = RESUME_DATE;
            let maxD: string | undefined = undefined;
            const today = fmt(new Date());
            const futureTrip = bk && bk.ci > today;
            if (futureTrip && period === "pre") { // 연수 전: 체크인 전날까지
              const d = new Date(bk!.ci + "T00:00:00"); d.setDate(d.getDate() - 1); maxD = fmt(d);
            }
            if (futureTrip && period === "post") { // 연수 후: 귀국 다음 날부터
              const d = new Date(bk!.co + "T00:00:00"); d.setDate(d.getDate() + 1); const m2 = fmt(d); if (m2 > minD) minD = m2;
            }
            return <input type="date" value={startDate} min={minD} max={maxD} onChange={e => setStartDate(e.target.value)}
              style={{ padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontFamily: "inherit", marginBottom: 4 }} />;
          })()}
          <div className="hint">
            {startDate ? `${startDate.slice(5).replace("-", "/")}(${"일월화수목금토"[new Date(startDate + "T00:00:00").getDay()]})부터` : ""} · {selectedDays.map(d => DAY_KR[d]).join("/")}요일 주 {selectedDays.length}회
            {period === "pre" && bk ? ` · 연수 전 수업: 출국(${bk.ci?.slice(5).replace("-", "/")}) 전까지` : period === "post" && bk && bk.co > new Date().toISOString().slice(0, 10) ? ` · 연수 후 수업: 귀국(${bk.co?.slice(5).replace("-", "/")}) 다음 날부터` : " · 최소 4일 뒤부터 시작 가능"}
          </div>
          <div style={{ height: 16 }} />
          <h2>수업 시간 선택 (한국시간)</h2>
          {loading ? <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>불러오는 중...</div> : (
            <>
              <div className="times">
                {dayAggregatedSlots.map(s => {
                  const cls = s.status === "closed" ? "closed" : s.status === "full" ? "full" : s.status === "last" ? "last" : "open";
                  const disabled = cls === "closed" || cls === "full";
                  return (
                    <button key={s.time_kr} className={`tchip ${cls}`} disabled={disabled}
                      onClick={() => { if (!disabled) selectTime(s.time_kr); }}>
                      <div>{s.time_kr}</div>
                      <div className="ph">({s.time_ph} PH)</div>
                      <div className="cnt">
                        {cls === "closed" ? "운영외" : cls === "full" ? "마감" : `${s.minAvail}/${s.total} 가용`}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="acts">
                <button className="btn-s" onClick={() => setStep(1)}>← 이전</button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="sec">
          <h2>신청 내용 확인</h2>
          {childName && (<div className="confirm" style={{ background: "#eff6ff", borderColor: "#bfdbfe" }}>
            <div className="t">신청 아이</div>
            <div className="v">{childName}{childEn ? " (" + childEn + ")" : ""}</div>
          </div>)}
          <div className="confirm">
            <div className="t">수업 요일</div>
            <div className="v">{selectedDays.map(d => DAY_KR[d]).join(" · ")}요일</div>
          </div>
          <div className="confirm">
            <div className="t">수업 시간 (한국)</div>
            <div className="v">{selectedTime}</div>
          </div>
          <div className="confirm" style={{ background: "#fffbeb", borderColor: "#fcd34d" }}>
            <div className="t">시작 예정일 · 총 회차</div>
            <div className="v">{(() => { const p = planInfo(); return `${p.startStr.slice(5).replace("-", "/")}부터 · 총 ${p.total}회 (등록 ${bk?.weeks || 4}주 × 주 3회)`; })()}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>선택한 요일 기준으로 시작돼요{bk && bk.ci > new Date().toISOString().slice(0, 10) ? " · 연수 기간에는 자동으로 쉬어가요" : ""}</div>
          </div>
          <div className="confirm" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
            <div className="t">담당 선생님</div>
            <div className="v">신청 후 선생님이 배정돼요 (가능: {suggested?.name || "확인 중"} 외)</div>
          </div>
          <div className="acts">
            <button className="btn-s" onClick={() => setStep(2)}>← 이전</button>
            <button className="btn-p" disabled={submitting} onClick={submit}>
              {submitting ? "신청중..." : "신청 완료"}
            </button>
          </div>
        </div>
      )}
    </div>
  </>);
}
