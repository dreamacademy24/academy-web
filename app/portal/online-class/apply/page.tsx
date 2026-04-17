"use client";
import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
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
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"];

export default function ApplyPage() {
  return (
    <Suspense fallback={null}>
      <ApplyInner />
    </Suspense>
  );
}

function ApplyInner() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [authUser, setAuthUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
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
      if (!data.session) {
        if (typeof window !== "undefined") router.replace("/login");
        return;
      }
      setAuthUser(data.session.user);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", data.session.user.id).single();
      setProfile(prof);
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

  async function submit() {
    if (!suggested || !authUser || !selectedDays.length || !selectedTime) return;
    setSubmitting(true);
    try {
      const studentName = profile?.name || profile?.full_name || authUser.email?.split("@")[0] || "신청자";
      const startDate = new Date();
      const endDate = new Date(); endDate.setMonth(endDate.getMonth() + 3);
      const pad = (n: number) => n < 10 ? "0" + n : "" + n;
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      const res = await fetch("/api/online-class/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: studentName,
          customer_user_id: authUser.id,
          tutor_id: suggested.id,
          enrollment_type: "free_package",
          days_of_week: selectedDays,
          class_time_kr: selectedTime,
          start_date: fmt(startDate),
          end_date: fmt(endDate),
          sessions_per_week: selectedDays.length,
          total_sessions: selectedDays.length * 12,
          pre_sessions: 0,
          post_sessions: selectedDays.length * 12,
          class_period: "post",
          status: "pending",
        }),
      });
      const r = await res.json();
      if (!res.ok) { setMsg({ text: r.error || "신청 실패", type: "err" }); return; }
      setMsg({ text: "✅ 신청되었습니다. 관리자 확인 후 확정됩니다.", type: "ok" });
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

      <div className="steps">
        <div className={`sp ${step===1?"ac":step>1?"done":""}`}>1. 요일</div>
        <div className={`sp ${step===2?"ac":step>2?"done":""}`}>2. 시간</div>
        <div className={`sp ${step===3?"ac":""}`}>3. 확인</div>
      </div>

      {step === 1 && (
        <div className="sec">
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
          <div className="hint">{selectedDays.length}/3 선택됨 · 주 {selectedDays.length}회 수업</div>
          <button className="btn-p" disabled={selectedDays.length === 0} onClick={() => setStep(2)}>
            다음 단계
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="sec">
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
          <div className="confirm">
            <div className="t">수업 요일</div>
            <div className="v">{selectedDays.map(d => DAY_KR[d]).join(" · ")}요일</div>
          </div>
          <div className="confirm">
            <div className="t">수업 시간 (한국)</div>
            <div className="v">{selectedTime}</div>
          </div>
          <div className="confirm" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
            <div className="t">담당 선생님</div>
            <div className="v">{suggested?.name} 배정 예정</div>
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
