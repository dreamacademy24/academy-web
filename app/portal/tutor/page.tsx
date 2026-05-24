"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Session { booking_id: string; booking_number: string; guest_name: string; expires: number; check_in_date?: string; status?: string }
interface TutorReq {
  id: string; student_name_kr: string | null; student_name_en: string | null;
  class_type: string | null; start_date: string | null; end_date: string | null;
  preferred_days_arr: string[] | null; preferred_time: string | null;
  status: string; created_at: string;
}

const DAYS = ["월","화","수","목","금","토"];

interface LevelOpt { value: string; kr: string; en: string }

const LEVELS_ENGLISH: LevelOpt[] = [
  { value: "제로베이스", kr: "제로베이스(기초) - 영어를 처음 접함", en: "Zero-Based - New to English" },
  { value: "비기너",     kr: "비기너 - 알파벳, 파닉스, 단어를 알고있음", en: "Beginner - Knows alphabet, phonics, basic words" },
  { value: "미디엄",     kr: "미디엄 - 문장을 이용한 원활한 영어 소통이 가능함", en: "Intermediate - Communicate smoothly in English by using sentences" },
  { value: "어드밴스",   kr: "어드밴스 - 원서 리딩 독해 토론 등 심화 수업이 가능함", en: "Advanced - In-depth reading and discussion sessions are available" },
];
const LEVELS_SPEAKING: LevelOpt[] = [
  { value: "제로베이스", kr: "제로 베이스(기초) - 영어를 처음 접함", en: "Zero-Based - New to English" },
  { value: "비기너1",   kr: "비기너1(초급1) - 알파벳을 말할 수 있음", en: "Beginner 1 - Able to recite the alphabet" },
  { value: "비기너2",   kr: "비기너2(초급2) - 파닉스 및 기본적인 단어를 말할 수 있음", en: "Beginner 2 - Able to pronounce phonics and basic words" },
  { value: "미디엄1",   kr: "미디엄1(중급1) - 자기소개 및 짧게 영어 문장으로 말할 수 있음", en: "Intermediate 1 - Able to speak in complete sentences" },
  { value: "미디엄2",   kr: "미디엄2(중급2) - 스피킹, 리스닝이 원활한 팀 티쳐와 원활하게 영어로 소통이 가능함", en: "Intermediate 2 - Able to communicate smoothly in English with the teacher" },
  { value: "어드밴스1", kr: "어드밴스1(고급) - 원서 리딩이 가능함. 주제를 가지고 프리토킹이 가능함", en: "Advanced 1 - Able to engage in free conversation on a given subject" },
  { value: "어드밴스2", kr: "어드밴스2(심화) - 토론수업에 참여하여 자신의 의견을 명확하게 표현 및 전달이 가능함", en: "Advanced 2 - Able to participate in discussion classes, clearly expressing and communicating their opinions" },
];
const LEVELS_READING: LevelOpt[] = [
  { value: "제로베이스", kr: "제로 베이스 - 영어를 처음 접함", en: "Zero-Based - New to English" },
  { value: "비기너1",   kr: "비기너1(초급1) - 알파벳을 읽을 수 있음", en: "Beginner 1 - Able to read the alphabet" },
  { value: "비기너2",   kr: "비기너2(초급2) - 기본적인 단어를 읽을 수 있음 / 단모음 리딩이 가능함 (예: can, fan)", en: "Beginner 2 - Able to read basic words (CVC, short vowels)" },
  { value: "미디엄1",   kr: "미디엄1(중급1) - 짧은 영어 문장을 읽을 수 있음 / 이중모음 리딩이 가능함 (예: cane, rain)", en: "Intermediate 1 - Able to read short English sentences" },
  { value: "미디엄2",   kr: "미디엄2(중급2) - 긴 문장을 읽을 수 있음 (예: I can walk with a cane)", en: "Intermediate 2 - Able to read longer English sentences (double vowels)" },
  { value: "어드밴스1", kr: "어드밴스1(고급) - 원서 리딩이 가능함", en: "Advanced 1 - Able to read English-written books" },
  { value: "어드밴스2", kr: "어드밴스2(심화) - 원서 리딩, 독해 및 심화 문제풀이가 가능함", en: "Advanced 2 - Able to read English-written books and also answer in-depth Q&As" },
];
const LEVELS_WRITING: LevelOpt[] = [
  { value: "제로베이스", kr: "제로 베이스 - 영어를 처음 접함", en: "Zero-Based - New to English" },
  { value: "비기너1",   kr: "비기너1(초급1) - 알파벳을 쓸 수 있음", en: "Beginner 1 - Able to write the alphabet" },
  { value: "비기너2",   kr: "비기너2(초급2) - 기본적인 단어를 쓸 수 있음", en: "Beginner 2 - Able to write basic words (CVC words)" },
  { value: "미디엄1",   kr: "미디엄1(중급1) - 짧은 영어 문장을 쓸 수 있음", en: "Intermediate 1 - Able to write short English sentences" },
  { value: "미디엄2",   kr: "미디엄2(중급2) - 긴 문장을 쓸 수 있음", en: "Intermediate 2 - Able to write longer English sentences" },
  { value: "어드밴스1", kr: "어드밴스1(고급) - 기본적인 원서 롸이팅이 가능함", en: "Advanced 1 - Able to write basic English-written books" },
  { value: "어드밴스2", kr: "어드밴스2(심화) - 심화된 원서 롸이팅이 가능함", en: "Advanced 2 - Able to write in-depth English-written books" },
];

const STYLES = ["놀이식","학습식","놀이+학습"];
const FOCUS = ["스피킹","리딩","보카","라이팅","파닉스","액티비티"];

const ST: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기중", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정",   bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
};
const APP_STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "📋 신청완료", bg: "#dbeafe", color: "#1d4ed8" },
  reviewing: { label: "🔍 검토중",   bg: "#fef3c7", color: "#92400e" },
  assigned:  { label: "🔍 검토중",   bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "✅ 신청승인", bg: "#dcfce7", color: "#15803d" },
  completed: { label: "✅ 완료",     bg: "#d1fae5", color: "#065f46" },
  cancelled: { label: "❌ 취소",     bg: "#fee2e2", color: "#dc2626" },
};

interface InvSession { id: string; session_idx: number; session_date: string; session_time: string | null; status: string }
interface InvLesson {
  id: string;
  student_names: string | null;
  tutor_name: string | null;
  class_type: string | null;
  class_time: string | null;
  confirmed_time: string | null;
  start_date: string | null;
  end_date: string | null;
  class_days: string[] | null;
  total_sessions: number | null;
  total_amount: number | null;
  sessions: InvSession[];
}

const DAY_KR: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };
const SESS_ST: Record<string, { label: string; bg: string; color: string }> = {
  scheduled:            { label: "예정",    bg: "#f1f5f9", color: "#64748b" },
  attended:             { label: "✅ 출석", bg: "#dcfce7", color: "#166534" },
  no_show:              { label: "노쇼",    bg: "#fee2e2", color: "#b91c1c" },
  cancelled:            { label: "취소",    bg: "#fef2f2", color: "#dc2626" },
  cancelled_by_student: { label: "취소",    bg: "#fef2f2", color: "#dc2626" },
  cancelled_by_tutor:   { label: "취소",    bg: "#fef2f2", color: "#dc2626" },
  rescheduled:          { label: "재조정",  bg: "#fef3c7", color: "#92400e" },
};
function daysKr(arr: string[] | null): string {
  if (!Array.isArray(arr) || arr.length === 0) return "-";
  return arr.map(d => DAY_KR[d] || d).join(", ");
}

function studentName(s: any): { kr: string; en: string; age: string } {
  return {
    kr: s?.name_kr || s?.korName || "",
    en: s?.name_en || s?.engName || "",
    age: (s?.age || s?.birthYear) ? String(s?.birthYear || s?.age || "") : "",
  };
}

function formatBirthAge(birth: string): string {
  if (!birth) return "";
  const digits = birth.replace(/\D/g, "");
  if (digits.length < 8) return birth;
  const y = parseInt(digits.substring(0, 4));
  const m = parseInt(digits.substring(4, 6));
  const d = parseInt(digits.substring(6, 8));
  if (!y || !m || !d) return birth;
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return `${y}.${String(m).padStart(2,'0')}.${String(d).padStart(2,'0')} 만${age}세`;
}

const INIT_FORM = {
  student_name_kr: "", student_name_en: "", student_age: "",
  student1_name_kr: "", student1_name_en: "", student1_idx: -1,
  student2_name_kr: "", student2_name_en: "", student2_idx: -1,
  class_type: "", start_date: "", end_date: "",
  preferred_days_arr: [] as string[], skip_dates: "", preferred_time: "",
  is_enrolled: false,
  level_english: "", level_speaking: "", level_reading: "", level_writing: "",
  textbook: "", class_style: "", class_focus_arr: [] as string[],
  child_personality: "",
  privacy_agreed: false, agreed_rules: false,
};

export default function PortalTutorPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [requests, setRequests] = useState<TutorReq[]>([]);
  const [form, setForm] = useState(INIT_FORM);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [invLessons, setInvLessons] = useState<InvLesson[]>([]);
  const [expandedInv, setExpandedInv] = useState<Set<string>>(new Set());
  const [bookingInfo, setBookingInfo] = useState<any>(null);
  const [bookingStudents, setBookingStudents] = useState<any[]>([]);
  const [student2Age, setStudent2Age] = useState('');
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [pickerSlot, setPickerSlot] = useState<null | 'single' | '1' | '2'>(null);

  useEffect(() => {
    async function init() {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem("portalSession");
        if (raw) {
          const s: Session = JSON.parse(raw);
          if (s.expires > Date.now()) { setSession(s); return; }
          localStorage.removeItem("portalSession");
        }
      } catch {}
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setSession({
          booking_id: data.session.user.id,
          booking_number: "",
          guest_name: data.session.user.email?.split("@")[0] || "회원",
          expires: Date.now() + 86400000,
        });
        return;
      }
      router.replace("/portal");
    }
    init();
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch(`/api/portal/tutor?booking_id=${session.booking_id}`);
      if (res.ok) { const d = await res.json(); setRequests(d.requests || []); }
      const invRes = await fetch(`/api/portal/tutor-invoice?booking_id=${session.booking_id}`);
      if (invRes.ok) { const d = await invRes.json(); setInvLessons(d.lessons || []); }
      const appsRes = await fetch(`/api/portal/tutor-applications?booking_id=${session.booking_id}`);
      if (appsRes.ok) { const d = await appsRes.json(); setMyApplications(d.applications || []); }
      if (session.booking_id) {
        const bRes = await fetch(`/api/bookings/${session.booking_id}`);
        if (bRes.ok) {
          const bd = await bRes.json();
          setBookingInfo(bd?.booking || bd);
          const rawStudents = bd?.students || [];
          setBookingStudents(Array.isArray(rawStudents) ? rawStudents : []);
        }
      }
    })();
  }, [session]);

  // bookingStudents 우선, 비어있으면 bookingInfo.students 파싱 폴백
  const students = useMemo<any[]>(() => {
    if (bookingStudents.length > 0) return bookingStudents;
    if (!bookingInfo) return [];
    try {
      return Array.isArray(bookingInfo.students)
        ? bookingInfo.students
        : JSON.parse(bookingInfo.students || "[]");
    } catch { return []; }
  }, [bookingStudents, bookingInfo]);

  // 모달 표시용 — 보호자(예약자) + 자녀
  const modalStudents = useMemo<any[]>(() => {
    const list: any[] = [];
    if (bookingInfo) {
      const krG = bookingInfo.booker_name || bookingInfo.booker_kr || "";
      const enG = bookingInfo.booker_english || bookingInfo.booker_en || "";
      const ageG = bookingInfo.booker_birth || bookingInfo.booker_birthdate || "";
      if (krG || enG) list.push({ name_kr: krG, name_en: enG, age: ageG, _isGuardian: true });
    }
    list.push(...students);
    return list;
  }, [bookingInfo, students]);

  function pickStudentFromModal(idx: number) {
    const s = modalStudents[idx];
    const n = studentName(s);
    const rawAge = n.age || s?.age || s?.birthYear || '';
    const age = formatBirthAge(String(rawAge));
    if (pickerSlot === 'single') {
      setForm(f => ({ ...f, student_name_kr: n.kr, student_name_en: n.en, student_age: age }));
    } else if (pickerSlot === '1') {
      setForm(f => ({ ...f, student1_name_kr: n.kr, student1_name_en: n.en, student1_idx: idx, student_age: age }));
    } else if (pickerSlot === '2') {
      setForm(f => ({ ...f, student2_name_kr: n.kr, student2_name_en: n.en, student2_idx: idx }));
      setStudent2Age(age);
    }
    setPickerSlot(null);
  }

  function toggleInv(id: string) {
    setExpandedInv(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function reload() {
    if (!session) return;
    const res = await fetch(`/api/portal/tutor?booking_id=${session.booking_id}`);
    if (res.ok) { const d = await res.json(); setRequests(d.requests || []); }
  }

  function toggleDay(d: string) {
    setForm(f => ({ ...f, preferred_days_arr: f.preferred_days_arr.includes(d) ? f.preferred_days_arr.filter(x => x !== d) : [...f.preferred_days_arr, d] }));
  }
  function toggleFocus(d: string) {
    setForm(f => {
      if (f.class_focus_arr.includes(d)) return { ...f, class_focus_arr: f.class_focus_arr.filter(x => x !== d) };
      if (f.class_focus_arr.length >= 2) { setMsg("수업 방향 상세는 최대 2개까지 선택 가능합니다."); return f; }
      setMsg("");
      return { ...f, class_focus_arr: [...f.class_focus_arr, d] };
    });
  }

  async function submit() {
    if (!session) return;
    if (!form.class_type) { setMsg("수업 유형을 선택해주세요."); return; }
    if (form.class_type === '1:1') {
      if (!form.student_name_kr.trim() && !form.student_name_en.trim()) { setMsg("학생을 선택해주세요."); return; }
    } else if (form.class_type === '1:2') {
      if (!form.student1_name_kr.trim() && !form.student1_name_en.trim()) { setMsg("학생 1을 선택해주세요."); return; }
      if (!form.student2_name_kr.trim() && !form.student2_name_en.trim()) { setMsg("학생 2를 선택해주세요."); return; }
    }
    if (!form.privacy_agreed || !form.agreed_rules) { setMsg("개인정보 동의와 튜터 규정 동의를 체크해주세요."); return; }
    setSaving(true); setMsg("");

    const isFor2 = form.class_type === '1:2';
    const finalKr = isFor2
      ? [form.student1_name_kr, form.student2_name_kr].filter(Boolean).join(', ')
      : form.student_name_kr;
    const finalEn = isFor2
      ? [form.student1_name_en, form.student2_name_en].filter(Boolean).join(', ')
      : form.student_name_en;
    const finalAge = isFor2
      ? [form.student_age, student2Age].filter(Boolean).join(', ')
      : form.student_age;

    const levels = form.is_enrolled
      ? { level_english: 'enrolled', level_speaking: 'enrolled', level_reading: 'enrolled', level_writing: 'enrolled' }
      : { level_english: form.level_english, level_speaking: form.level_speaking, level_reading: form.level_reading, level_writing: form.level_writing };

    const res = await fetch("/api/portal/tutor", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_id: session.booking_id,
        guest_name: session.guest_name,
        ...form,
        student_name_kr: finalKr,
        student_name_en: finalEn,
        student_age: finalAge,
        ...levels,
        rules_agreed: form.agreed_rules,
      }),
    });
    setSaving(false);
    if (!res.ok) { const r = await res.json(); setMsg(r.error || "신청 실패"); return; }
    setDone(true);
    setForm(INIT_FORM);
    setStudent2Age('');
    reload();
    const appsRes = await fetch(`/api/portal/tutor-applications?booking_id=${session.booking_id}`);
    if (appsRes.ok) { const d = await appsRes.json(); setMyApplications(d.applications || []); }
  }

  async function cancel(id: string) {
    if (!confirm("신청을 취소하시겠습니까?")) return;
    const res = await fetch(`/api/portal/tutor?id=${id}`, { method: "DELETE" });
    if (!res.ok) { const r = await res.json(); alert(r.error || "취소 실패"); return; }
    reload();
  }

  if (!session) return null;

  const hasStudent = !!(form.student_name_kr || form.student_name_en);

  return (<>
    <style>{`
.tu-w{max-width:720px;margin:0 auto;padding:16px 20px 40px}
.tu-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:12px}.tu-back:hover{color:#1a6fc4}
.tu-head{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:16px;padding:20px;color:#fff;margin-bottom:10px}
.tu-head h1{font-size:19px;font-weight:800;margin-bottom:2px}.tu-head p{font-size:12px;opacity:0.8}
.notice{background:#fffbeb;border:1.5px solid #fbbf24;border-radius:12px;padding:16px 18px;margin-bottom:10px;line-height:1.65;color:#78350f}
.notice .ttl{font-size:14px;font-weight:800;color:#92400e;margin-bottom:12px}
.notice .grp{margin-bottom:10px}.notice .grp:last-child{margin-bottom:0}
.notice .grp-t{font-weight:800;color:#92400e;margin-bottom:4px;display:block;font-size:12.5px}
.notice ul{margin:0;padding-left:18px;font-size:12px}.notice li{margin-bottom:3px}
.sec{background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 8px rgba(0,0,0,0.04);margin-bottom:10px}
.sec h2{font-size:14px;font-weight:800;color:#1a6fc4;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.q{margin-bottom:16px}
.q-label{display:block;font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:6px}
.q-label .req{color:#dc2626;margin-left:3px}
.q-hint{display:block;font-size:11px;color:#94a3b8;margin-bottom:6px}
.inp,.sel,.area{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff;box-sizing:border-box}.inp:focus,.sel:focus,.area:focus{border-color:#1a6fc4}
.area{resize:vertical;min-height:60px}
.opts{display:flex;flex-wrap:wrap;gap:6px}
.opt{padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;cursor:pointer;background:#fff;font-family:inherit;font-weight:500;user-select:none}
.opt:hover{border-color:#94a3b8}
.opt.on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.opts-v{display:flex;flex-direction:column;gap:6px}
.opt-card{display:block;width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:9px;text-align:left;cursor:pointer;background:#fff;font-family:inherit;line-height:1.45;transition:all 0.15s;box-sizing:border-box}
.opt-card:hover{border-color:#94a3b8}
.opt-card.on{border-color:#1a6fc4;background:#eff6ff;border-width:2px;padding:10px 13px}
.opt-card .ko{font-size:13px;font-weight:700;color:#1a1a2e;display:block;margin-bottom:2px}
.opt-card .en{font-size:11px;color:#6b7c93;display:block}
.opt-card.on .ko{color:#1a6fc4}
.agree{margin-bottom:12px}
.agree label{display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:10px 12px;background:#f8fafc;border-radius:8px;font-size:13px;line-height:1.5}
.agree input{width:18px;height:18px;margin-top:1px;accent-color:#1a6fc4;flex-shrink:0}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.btn{width:100%;padding:14px;background:linear-gradient(135deg,#1a6fc4,#7c3aed);color:#fff;font-size:15px;font-weight:700;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:4px}.btn:hover{opacity:0.9}.btn:disabled{opacity:0.5;cursor:not-allowed}
.msg{margin-top:10px;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;text-align:center}
.msg-ok{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}.msg-err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.done-box{background:#dcfce7;border-radius:12px;padding:28px;text-align:center;border:1px solid #bbf7d0}
.done-box .icon{font-size:40px;margin-bottom:8px}
.done-box .ttl{font-size:17px;font-weight:800;color:#166534;margin-bottom:6px}
.done-box .sub{font-size:13px;color:#166534;opacity:0.9}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:8px;background:#f8fafc}
.card.cancelled{opacity:0.5}
.card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.card-title{font-size:14px;font-weight:700}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.info{font-size:12px;color:#475569;line-height:1.6}.info .k{font-weight:700;color:#6b7c93;margin-right:4px}
.cancel{margin-top:8px;padding:6px 14px;font-size:12px;font-weight:600;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;border-radius:7px;cursor:pointer;font-family:inherit}.cancel:hover{background:#fee2e2}
.empty{text-align:center;padding:24px;color:#94a3b8;font-size:13px}
.num{display:inline-block;width:20px;height:20px;border-radius:50%;background:#1a6fc4;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:20px;margin-right:6px}
.stu-pick{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.stu-pick .pick-btn{padding:11px 20px;background:#1a6fc4;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.stu-pick .pick-btn:hover{background:#155a9e}
.stu-pick .sel-name{flex:1;min-width:0;padding:11px 14px;background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:9px;font-size:13px;font-weight:700;color:#0c4a6e}
.stu-pick .change-btn{padding:8px 14px;background:#fff;color:#1a6fc4;border:1.5px solid #1a6fc4;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}
.stu-pick .change-btn:hover{background:#eff6ff}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}
.modal{background:#fff;border-radius:14px;padding:22px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 12px 48px rgba(0,0,0,0.2)}
.modal h3{font-size:15px;font-weight:800;color:#1a1a2e;margin-bottom:5px}
.modal-sub{font-size:12px;color:#6b7c93;margin-bottom:14px}
.modal-list{display:flex;flex-direction:column;gap:8px}
.modal-btn{padding:14px 16px;background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;text-align:left;cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;color:#1a1a2e;transition:all 0.15s}
.modal-btn:hover{border-color:#1a6fc4;background:#eff6ff;color:#1a6fc4}
.modal-close{margin-top:14px;width:100%;padding:10px;background:#f1f5f9;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#475569;font-family:inherit}
.modal-close:hover{background:#e2e8f0}
.modal-inp{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.rules-box{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;max-height:300px;overflow-y:auto;font-size:12px;line-height:1.75;color:#475569;margin-bottom:10px}
.rules-box .rh{font-weight:800;color:#1a1a2e;font-size:13px;margin:2px 0 8px;text-align:center;padding-bottom:6px;border-bottom:1px solid #e5e7eb}
.rules-box ul{margin:0 0 10px;padding-left:18px}.rules-box li{margin-bottom:3px}
.rules-box .warn-t{color:#b45309;font-weight:800;margin:12px 0 5px;display:block}
.ct-row{display:flex;gap:10px}
.ct-btn{flex:1;padding:18px;border:2px solid #e2e8f0;border-radius:12px;background:#fff;color:#475569;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;line-height:1.4;transition:all 0.15s;text-align:center}
.ct-btn:hover{border-color:#94a3b8}
.ct-btn.on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.ct-btn .price{display:block;font-size:12px;opacity:0.9;margin-top:4px;font-weight:600}
.stu-row2{display:flex;flex-direction:column;gap:10px}
.stu-row2 .slot-label{font-size:12px;font-weight:700;color:#475569;margin-bottom:4px;display:block}
.enr-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;border:2px solid #e2e8f0;border-radius:10px;background:#fff;color:#475569;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s;margin-bottom:12px}
.enr-btn:hover{border-color:#94a3b8}
.enr-btn.on{background:#16a34a;color:#fff;border-color:#16a34a}
.enr-info{background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:14px 16px;font-size:13px;color:#166534;font-weight:600;text-align:center;line-height:1.5}
.modal-btn:disabled{opacity:0.45;cursor:not-allowed;background:#f8fafc;color:#94a3b8;border-color:#e2e8f0}
.modal-btn:disabled:hover{border-color:#e2e8f0;background:#f8fafc;color:#94a3b8}
@media(max-width:500px){.tu-w{padding:20px 16px}.row2{grid-template-columns:1fr}.stu-pick .pick-btn{width:100%}.ct-row{flex-direction:column}}
    `}</style>
    <div className="tu-w">
      <button className="tu-back" onClick={() => router.push("/portal/dashboard")}>← 대시보드로</button>
      <div className="tu-head"><h1>👩‍🏫 튜터 수업 신청</h1><p>{session.guest_name}님 · 원어민 1:1 또는 1:2 수업</p></div>

      {/* 📋 수업 전 안내사항 */}
      <div className="notice">
        <div className="ttl">📋 수업 전 안내사항</div>
        <div className="grp">
          <span className="grp-t">✅ 기본 안내</span>
          <ul>
            <li>플레이드림 / 드림아카데미 티쳐가 숙소로 방문하여 수업 진행</li>
            <li>한타임 당 최대 튜터 선생님 2명까지 신청 가능</li>
            <li>한타임당 50분 수업 / 오전 10시 ~ 오후 8시 운영</li>
            <li>1일 최대 2타임 수업 가능 (3타임 불가)</li>
            <li>외부 활동 및 놀이터 등 외출은 불가</li>
            <li><span style={{color:'#b45309', fontWeight:600}}>수업은 최소 2주 전 사전 신청 필수 (성수기는 3주 전)</span></li>
            <li><span style={{color:'#dc2626', fontWeight:700}}>성수기의 경우 오후 5시부터 수업 가능</span></li>
          </ul>
        </div>
        <div className="grp">
          <span className="grp-t">📦 준비물 안내</span>
          <ul>
            <li>기본 워크지 등 학습 자료는 튜터가 준비</li>
            <li>별도로 원하는 교재가 있다면 직접 지참 필요 (단, 수업에 대한 개별적 피드백은 미제공)</li>
            <li>어린 아이의 경우 색종이, 보드게임, 플래시카드 등 추천 (직접 준비 필요)</li>
          </ul>
        </div>
        <div className="grp">
          <span className="grp-t">💰 비용 안내</span>
          <ul>
            <li>1:1 수업 ₱300 / 1:2 수업 ₱350 (1타임 기준)</li>
            <li>수업 확정 후 전액 선결제 필수</li>
          </ul>
        </div>
      </div>

      {invLessons.length > 0 && (
        <div className="sec">
          <h2>✅ 확정된 수업 ({invLessons.length}건)</h2>
          {invLessons.map(l => {
            const expanded = expandedInv.has(l.id);
            return (
              <div key={l.id} className="card" style={{ background: "#fff", borderColor: "#bbf7d0" }}>
                <div className="card-top">
                  <div className="card-title">{l.student_names || "-"}</div>
                  <span className="badge" style={{ background: "#dcfce7", color: "#166534" }}>확정</span>
                </div>
                <div className="info">
                  <div><span className="k">담당 선생님:</span>{l.tutor_name || "미배정"}</div>
                  <div><span className="k">수업 유형:</span>{l.class_type || "-"}</div>
                  <div><span className="k">수업 시간:</span>{l.confirmed_time || l.class_time || "-"}</div>
                  <div><span className="k">기간:</span>{l.start_date || "-"} ~ {l.end_date || "-"}</div>
                  <div><span className="k">요일:</span>{daysKr(l.class_days)}</div>
                  <div>
                    <span className="k">총 회차:</span>{l.total_sessions != null ? `${l.total_sessions}회` : "-"}
                    <span className="k" style={{ marginLeft: 10 }}>확정 금액:</span>
                    {l.total_amount != null ? `₱${l.total_amount.toLocaleString()}` : "-"}
                  </div>
                </div>
                {l.sessions.length > 0 && (
                  <button
                    className="cancel"
                    style={{ marginTop: 8, background: "#eff6ff", borderColor: "#bfdbfe", color: "#1a6fc4" }}
                    onClick={() => toggleInv(l.id)}
                  >
                    {expanded ? "세션 목록 접기 ▲" : `세션 목록 보기 (${l.sessions.length}) ▼`}
                  </button>
                )}
                {expanded && (
                  <div style={{ marginTop: 8, borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
                    {l.sessions.map(s => {
                      const st = SESS_ST[s.status] || SESS_ST.scheduled;
                      return (
                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 2px", fontSize: 12 }}>
                          <span style={{ color: "#475569" }}>{s.session_idx}회차 · {s.session_date}{s.session_time ? ` ${s.session_time}` : ""}</span>
                          <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {done ? (
        <div className="done-box">
          <div className="icon">✅</div>
          <div className="ttl">신청이 완료되었습니다</div>
          <div className="sub">담당자가 확인 후 연락드립니다.</div>
          <button onClick={() => setDone(false)} style={{ marginTop: 16, padding: "10px 20px", background: "#fff", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>추가 신청</button>
        </div>
      ) : (<>
      <div className="sec">
        <h2>기본 정보</h2>
        <div className="q">
          <label className="q-label"><span className="num">1</span>수업 유형<span className="req">*</span></label>
          <div className="ct-row">
            <button type="button" className={`ct-btn${form.class_type === "1:1" ? " on" : ""}`} onClick={() => setForm({ ...form, class_type: "1:1" })}>
              1:1 수업<span className="price">₱300 / 타임</span>
            </button>
            <button type="button" className={`ct-btn${form.class_type === "1:2" ? " on" : ""}`} onClick={() => setForm({ ...form, class_type: "1:2" })}>
              1:2 수업<span className="price">₱350 / 타임</span>
            </button>
          </div>
        </div>

        {form.class_type === '1:1' && (
          <div className="q">
            <label className="q-label"><span className="num">2</span>학생 선택<span className="req">*</span></label>
            <span className="q-hint">예약자: {session.guest_name}님의 학생을 선택해주세요.</span>
            {hasStudent ? (
              <div className="stu-pick">
                <div className="sel-name">
                  {form.student_name_kr}{form.student_name_en ? ` / ${form.student_name_en}` : ""}{form.student_age ? ` (${form.student_age})` : ""}
                </div>
                <button type="button" className="change-btn" onClick={() => setPickerSlot('single')}>변경</button>
              </div>
            ) : (
              <div className="stu-pick">
                <button type="button" className="pick-btn" onClick={() => setPickerSlot('single')}>👥 학생 선택하기</button>
              </div>
            )}
          </div>
        )}

        {form.class_type === '1:2' && (
          <div className="q">
            <label className="q-label"><span className="num">2</span>학생 선택 (2명)<span className="req">*</span></label>
            <span className="q-hint">예약자: {session.guest_name}님의 학생을 2명 선택해주세요.</span>
            <div className="stu-row2">
              <div>
                <span className="slot-label">학생 1</span>
                {(form.student1_name_kr || form.student1_name_en) ? (
                  <div className="stu-pick">
                    <div className="sel-name">{form.student1_name_kr}{form.student1_name_en ? ` / ${form.student1_name_en}` : ""}{form.student_age ? ` (${form.student_age})` : ""}</div>
                    <button type="button" className="change-btn" onClick={() => setPickerSlot('1')}>변경</button>
                  </div>
                ) : (
                  <div className="stu-pick">
                    <button type="button" className="pick-btn" onClick={() => setPickerSlot('1')}>👥 학생 1 선택하기</button>
                  </div>
                )}
              </div>
              <div>
                <span className="slot-label">학생 2</span>
                {(form.student2_name_kr || form.student2_name_en) ? (
                  <div className="stu-pick">
                    <div className="sel-name">{form.student2_name_kr}{form.student2_name_en ? ` / ${form.student2_name_en}` : ""}{student2Age ? ` (${student2Age})` : ""}</div>
                    <button type="button" className="change-btn" onClick={() => setPickerSlot('2')}>변경</button>
                  </div>
                ) : (
                  <div className="stu-pick">
                    <button type="button" className="pick-btn" onClick={() => setPickerSlot('2')}>👥 학생 2 선택하기</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="q">
          <label className="q-label"><span className="num">3</span>학생 나이</label>
          <span className="q-hint">예: 2019.09.03 만5세</span>
          <input className="inp" value={form.student_age} onChange={e => setForm({ ...form, student_age: e.target.value })} />
        </div>
      </div>

      <div className="sec">
        <h2>수업 일정</h2>
        <div className="q">
          <label className="q-label"><span className="num">4</span>수업 시작일</label>
          <input className="inp" type="date" value={form.start_date} onChange={e => {
            const v = e.target.value;
            setForm({ ...form, start_date: v });
            if (v && new Date(v) < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)) {
              window.alert("⚠️ 수업은 최소 2주 전 사전 신청이 필요합니다.\n선택하신 날짜는 신청이 불가할 수 있습니다.");
            }
          }} />
          {form.start_date && new Date(form.start_date) < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) && (
            <div style={{marginTop:8, padding:'10px 14px', background:'#fef3c7', border:'1px solid #f59e0b', borderRadius:8, fontSize:13, color:'#92400e'}}>
              ⚠️ 수업은 최소 <strong>2주 전</strong> 사전 신청이 필요합니다. 선택하신 날짜는 신청이 불가할 수 있습니다.
            </div>
          )}
        </div>
        <div className="q">
          <label className="q-label"><span className="num">5</span>수업 종료일</label>
          <input className="inp" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
        </div>
        <div className="q">
          <label className="q-label"><span className="num">6</span>원하는 수업 요일 (복수 선택)</label>
          <div className="opts">
            {DAYS.map(d => (
              <button key={d} type="button" className={`opt${form.preferred_days_arr.includes(d) ? " on" : ""}`} onClick={() => toggleDay(d)}>{d}</button>
            ))}
          </div>
        </div>
        <div className="q">
          <label className="q-label"><span className="num">7</span>빠지는 날짜 / 변경 날짜</label>
          <textarea className="area" value={form.skip_dates} onChange={e => setForm({ ...form, skip_dates: e.target.value })} placeholder="예: 4/15 결석, 4/17 오전→오후 변경" />
        </div>
        <div className="q">
          <label className="q-label"><span className="num">8</span>원하는 수업 시간</label>
          <input className="inp" value={form.preferred_time} onChange={e => setForm({ ...form, preferred_time: e.target.value })} placeholder="예: 오전10시~오후12시" />
        </div>
      </div>

      <div className="sec">
        <h2>학생 레벨</h2>
        <button type="button" className={`enr-btn${form.is_enrolled ? " on" : ""}`} onClick={() => setForm({ ...form, is_enrolled: !form.is_enrolled })}>
          🏫 현재 드림아카데미 재학중{form.is_enrolled ? " ✓" : ""}
        </button>
        {form.is_enrolled ? (
          <div className="enr-info">✅ 재학생의 경우 담당 선생님이 레벨을 확인합니다.</div>
        ) : (<>
          <div className="q">
            <label className="q-label"><span className="num">9</span>영어 레벨</label>
            <div className="opts-v">
              {LEVELS_ENGLISH.map(l => (
                <button key={l.value} type="button" className={`opt-card${form.level_english === l.value ? " on" : ""}`} onClick={() => setForm({ ...form, level_english: l.value })}>
                  <span className="ko">{l.kr}</span><span className="en">{l.en}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="q">
            <label className="q-label"><span className="num">10</span>스피킹 레벨</label>
            <div className="opts-v">
              {LEVELS_SPEAKING.map(l => (
                <button key={l.value} type="button" className={`opt-card${form.level_speaking === l.value ? " on" : ""}`} onClick={() => setForm({ ...form, level_speaking: l.value })}>
                  <span className="ko">{l.kr}</span><span className="en">{l.en}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="q">
            <label className="q-label"><span className="num">11</span>리딩 레벨</label>
            <div className="opts-v">
              {LEVELS_READING.map(l => (
                <button key={l.value} type="button" className={`opt-card${form.level_reading === l.value ? " on" : ""}`} onClick={() => setForm({ ...form, level_reading: l.value })}>
                  <span className="ko">{l.kr}</span><span className="en">{l.en}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="q">
            <label className="q-label"><span className="num">12</span>라이팅 레벨</label>
            <div className="opts-v">
              {LEVELS_WRITING.map(l => (
                <button key={l.value} type="button" className={`opt-card${form.level_writing === l.value ? " on" : ""}`} onClick={() => setForm({ ...form, level_writing: l.value })}>
                  <span className="ko">{l.kr}</span><span className="en">{l.en}</span>
                </button>
              ))}
            </div>
          </div>
        </>)}
      </div>

      <div className="sec">
        <h2>수업 방향</h2>
        <div className="q">
          <label className="q-label"><span className="num">13</span>사용 영어교재 (따로 원하는 교재가 있을 시 기재해주세요)</label>
          <input className="inp" value={form.textbook} onChange={e => setForm({ ...form, textbook: e.target.value })} placeholder="예 ) 브릭스 50, 리딩스트리트 2.1, 멀티플리딩스킬, 올어보드 4" />
        </div>
        <div className="q">
          <label className="q-label"><span className="num">14</span>수업 방향</label>
          <div className="opts">
            {STYLES.map(s => (
              <button key={s} type="button" className={`opt${form.class_style === s ? " on" : ""}`} onClick={() => setForm({ ...form, class_style: s })}>{s}</button>
            ))}
          </div>
        </div>
        <div className="q">
          <label className="q-label"><span className="num">15</span>수업 방향 상세 (최대 2개)</label>
          <div className="opts">
            {FOCUS.map(f => (
              <button key={f} type="button" className={`opt${form.class_focus_arr.includes(f) ? " on" : ""}`} onClick={() => toggleFocus(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="q">
          <label className="q-label"><span className="num">16</span>아이 성향/흥미 / 원하시는 요청 사항</label>
          <textarea className="area" value={form.child_personality} onChange={e => setForm({ ...form, child_personality: e.target.value })} placeholder="예: 활발하고 말이 많음, 스포츠/공룡 좋아함" />
        </div>
      </div>

      <div className="sec">
        <h2>동의<span style={{ color: "#dc2626", marginLeft: 4 }}>*</span></h2>
        <div className="agree">
          <label>
            <input type="checkbox" checked={form.privacy_agreed} onChange={e => setForm({ ...form, privacy_agreed: e.target.checked })} />
            <span><b>17. 개인정보 수집 및 이용 동의</b><br/><span style={{ fontSize: 11, color: "#6b7c93" }}>수업 매칭 및 튜터 배정 목적으로 수집한 정보를 활용합니다.</span></span>
          </label>
        </div>

        <div className="q" style={{ marginBottom: 8 }}>
          <label className="q-label"><span className="num">18</span>튜터 변경 및 환불 규정 동의<span className="req">*</span></label>
          <div className="rules-box">
            <div className="rh">🔖 튜터 변경 및 환불규정</div>
            <ul>
              <li>최소 2주 전 사전 예약 필수 (성수기는 3주 전)</li>
              <li>성수기 기간 오후 5시 이후 수업 가능</li>
              <li>변경은 수업일 4일 전까지만 가능</li>
            </ul>
            <span className="warn-t">⚠️ 아래 경우 변경 및 환불 불가</span>
            <ul>
              <li>당일 취소 및 일정 변경</li>
              <li>수업 시작 후 학생의 거부로 취소 요청</li>
              <li>수업 3일 전 이내 취소 시</li>
              <li>당일 2회 이상 변경 시</li>
              <li>당일 노쇼(무단 결석): 모든 수업 자동 취소, 환불 불가, 이후 재신청도 불가</li>
            </ul>
          </div>
          <div className="agree" style={{ marginBottom: 0 }}>
            <label>
              <input type="checkbox" checked={form.agreed_rules} onChange={e => setForm({ ...form, agreed_rules: e.target.checked })} />
              <span><b>위 튜터 규정을 모두 확인하였으며 동의합니다.</b></span>
            </label>
          </div>
        </div>

        <button className="btn" onClick={submit} disabled={saving || !form.agreed_rules}>{saving ? "신청 중..." : "튜터 수업 신청하기"}</button>
        {msg && <div className={`msg ${msg.includes("완료") ? "msg-ok" : "msg-err"}`}>{msg}</div>}
      </div>
      </>)}

      <div className="sec">
        <h2>📋 내 튜터 신청내역 ({myApplications.length}건)</h2>
        {myApplications.length === 0 ? <div className="empty">아직 신청 내역이 없습니다</div> :
          myApplications.map(a => {
            const meta = APP_STATUS_META[a.status] || APP_STATUS_META.pending;
            return (
              <div key={a.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{a.children_names || "-"}</div>
                  <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: meta.bg, color: meta.color }}>{meta.label}</span>
                </div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                  <div><span style={{ fontWeight: 700, color: "#6b7c93", marginRight: 4 }}>수업 유형:</span>{a.class_type || "-"}</div>
                  <div><span style={{ fontWeight: 700, color: "#6b7c93", marginRight: 4 }}>기간:</span>{a.start_date || "-"} ~ {a.end_date || "-"}</div>
                  <div><span style={{ fontWeight: 700, color: "#6b7c93", marginRight: 4 }}>신청일:</span>{a.created_at?.slice(0, 10) || "-"}</div>
                  {a.status === "confirmed" && (
                    <div><span style={{ fontWeight: 700, color: "#6b7c93", marginRight: 4 }}>배정 선생님:</span>{a.assigned_tutor_name || "미배정"}</div>
                  )}
                </div>
              </div>
            );
          })
        }
      </div>
    </div>

    {pickerSlot !== null && (
      <div className="modal-bg" onClick={() => setPickerSlot(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>학생 선택{pickerSlot === '1' ? ' — 학생 1' : pickerSlot === '2' ? ' — 학생 2' : ''}</h3>
          <div className="modal-sub">예약자: {session.guest_name}님의 학생 목록</div>
          {!bookingInfo ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>학생 정보를 불러오는 중...</div>
          ) : modalStudents.length > 0 ? (
            <div className="modal-list">
              {modalStudents.map((s: any, i: number) => {
                const n = studentName(s);
                const rawAge = n.age || s?.age || s?.birthYear || '';
                const ageDisplay = formatBirthAge(String(rawAge));
                const isGuard = !!s?._isGuardian;
                const label = `${isGuard ? '👩 (보호자) ' : ''}${n.kr || '-'}${n.en ? ` / ${n.en}` : ''}${ageDisplay ? ` (${ageDisplay})` : ''}`;
                const otherIdx = pickerSlot === '1' ? form.student2_idx : pickerSlot === '2' ? form.student1_idx : -1;
                const disabled = i === otherIdx;
                return (
                  <button key={i} type="button" className="modal-btn" disabled={disabled} onClick={() => !disabled && pickStudentFromModal(i)}>
                    {label}{disabled ? ' (선택됨)' : ''}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="modal-inp">
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>등록된 학생이 없어 직접 입력해주세요.</div>
              {pickerSlot === 'single' && (<>
                <input className="inp" value={form.student_name_kr} onChange={e => setForm({ ...form, student_name_kr: e.target.value })} placeholder="한글이름 (예: 김사랑)" />
                <input className="inp" value={form.student_name_en} onChange={e => setForm({ ...form, student_name_en: e.target.value })} placeholder="영문이름 (예: kim sa rang)" />
              </>)}
              {pickerSlot === '1' && (<>
                <input className="inp" value={form.student1_name_kr} onChange={e => setForm({ ...form, student1_name_kr: e.target.value })} placeholder="학생 1 한글이름" />
                <input className="inp" value={form.student1_name_en} onChange={e => setForm({ ...form, student1_name_en: e.target.value })} placeholder="학생 1 영문이름" />
              </>)}
              {pickerSlot === '2' && (<>
                <input className="inp" value={form.student2_name_kr} onChange={e => setForm({ ...form, student2_name_kr: e.target.value })} placeholder="학생 2 한글이름" />
                <input className="inp" value={form.student2_name_en} onChange={e => setForm({ ...form, student2_name_en: e.target.value })} placeholder="학생 2 영문이름" />
              </>)}
              <button type="button" className="pick-btn" style={{ width: "100%", marginTop: 6, padding: 11, background: "#1a6fc4", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setPickerSlot(null)}>확인</button>
            </div>
          )}
          <button type="button" className="modal-close" onClick={() => setPickerSlot(null)}>닫기</button>
        </div>
      </div>
    )}
  </>);
}
