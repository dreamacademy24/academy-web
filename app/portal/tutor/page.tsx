"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isLessonDateAllowed } from "@/lib/lessonDates";
import { toastErr } from "@/lib/toast";

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

// 일요일은 의도적으로 제외 — 튜터 수업 불가
const DAYS = ["월","화","수","목","금","토"];
const KR_DAY_LIST = ['일','월','화','수','목','금','토'];

// 기간 + 유효 블록 → 수업일 목록 [{date, day, time, spd}]
function generateClassDates(
  blocks: { days: string[]; time: string; sessions_per_day: 1 | 2 }[],
  startStr: string,
  endStr: string,
): Array<{ date: string; day: string; time: string; spd: number }> {
  if (!startStr || !endStr) return [];
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return [];
  const KR_TO_IDX: Record<string, number> = {'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6};
  const valid = blocks.filter(b => Array.isArray(b.days) && b.days.length > 0 && (b.time || '').trim() !== '');
  const out: Array<{ date: string; day: string; time: string; spd: number }> = [];
  for (const b of valid) {
    const idxSet = new Set(b.days.map(d => KR_TO_IDX[d]).filter(i => i !== undefined));
    const d = new Date(s);
    while (d <= e) {
      if (idxSet.has(d.getDay())) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        // 휴일(6/12)·1·3·5번째 토요일 제외 → 회차/금액에서 자동 제외
        if (isLessonDateAllowed(d, dateStr)) out.push({ date: dateStr, day: KR_DAY_LIST[d.getDay()], time: b.time, spd: b.sessions_per_day });
      }
      d.setDate(d.getDate() + 1);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

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

function isPeakSeason(dateStr: string): boolean {
  if (!dateStr || dateStr.length < 10) return false;
  const md = dateStr.slice(5, 10);
  return md >= '07-15' && md <= '08-30';
}
// 시작 시각을 "HH:MM" 형식으로 받아 종료 시각 계산 (1타임 = 50분)
function formatTimeRange(start: string | number, sessions: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  let hh = 0, mm = 0;
  if (typeof start === "number") { hh = start; mm = 0; }
  else {
    const [hStr, mStr] = String(start).split(":");
    hh = parseInt(hStr, 10) || 0;
    mm = parseInt(mStr || "0", 10) || 0;
  }
  const duration = sessions * 50; // 1타임 = 50분
  const total = hh * 60 + mm + duration;
  const endH = Math.floor(total / 60);
  const endM = total % 60;
  return `${pad(hh)}:${pad(mm)} ~ ${pad(endH)}:${pad(endM)} (${sessions}타임, ${duration}분)`;
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
  student_name_kr: "", student_name_en: "",
  student1_name_kr: "", student1_name_en: "", student1_idx: -1,
  student2_name_kr: "", student2_name_en: "", student2_idx: -1,
  class_type: "", start_date: "", end_date: "",
  preferred_days_arr: [] as string[], skip_dates: "", preferred_time: "",
  sessions_per_day: 1,
  is_enrolled: false,
  level_english: "", level_speaking: "", level_reading: "", level_writing: "",
  textbook: "", class_style: "", class_focus_arr: [] as string[],
  child_personality: "",
  privacy_agreed: false, agreed_rules: false,
};

const INIT_FORM2 = {
  class_type: "" as string,
  student_name_kr: "", student_name_en: "",
  student1_name_kr: "", student1_name_en: "", student1_idx: -1,
  student2_name_kr: "", student2_name_en: "", student2_idx: -1,
  sessions_per_day: 1,
  start_date: "", end_date: "", preferred_days_arr: [] as string[],
  preferred_time: "", skip_dates: "",
};

type ScheduleBlock = { days: string[]; time: string; sessions_per_day: 1 | 2 };
const INIT_BLOCK: ScheduleBlock = { days: [], time: "", sessions_per_day: 1 };

export default function PortalTutorPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [requests, setRequests] = useState<TutorReq[]>([]);
  const [lessonMap, setLessonMap] = useState<Record<string, any>>({});
  const [notesMap, setNotesMap] = useState<Record<string, Array<{ date: string; note: string; status: string }>>>({});
  const [noteTranslations, setNoteTranslations] = useState<Record<string, string>>({});
  const [translatingKey, setTranslatingKey] = useState<string>("");
  const [form, setForm] = useState(INIT_FORM);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [cancelReqId, setCancelReqId] = useState<string>("");
  const [cancelReqReason, setCancelReqReason] = useState("");
  const [cancelReqSaving, setCancelReqSaving] = useState(false);
  const [tutorToast, setTutorToast] = useState("");
  const [editingId, setEditingId] = useState<string>("");
  const [invLessons, setInvLessons] = useState<InvLesson[]>([]);
  const [expandedInv, setExpandedInv] = useState<Set<string>>(new Set());
  const [bookingInfo, setBookingInfo] = useState<any>(null);
  const [bookingStudents, setBookingStudents] = useState<any[]>([]);
  const [bookerInfo, setBookerInfo] = useState<{ name_kr: string; name_en: string; age: string } | null>(null);
  const [form2, setForm2] = useState<typeof INIT_FORM2 | null>(null);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([{ ...INIT_BLOCK }]);
  const [timeBlockIdx, setTimeBlockIdx] = useState<number>(0);
  const [scheduleMode, setScheduleMode] = useState<'same' | 'byday'>('same');
  const [skipDates, setSkipDates] = useState<string[]>([]);
  const [student2Age2, setStudent2Age2] = useState('');
  const [student2Age, setStudent2Age] = useState('');
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [pickerSlot, setPickerSlot] = useState<null | 'single' | '1' | '2'>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  // 하루 취소 신청
  const [cancelDayOpen, setCancelDayOpen] = useState(false);
  const [cancelDayLesson, setCancelDayLesson] = useState<InvLesson | null>(null);
  const [cancelDaySession, setCancelDaySession] = useState<InvSession | null>(null);
  const [cancelDayReason, setCancelDayReason] = useState("");
  const [cancelDaySaving, setCancelDaySaving] = useState(false);
  const [cancelRequests, setCancelRequests] = useState<any[]>([]);

  // 배포 휴일 → 수업일 전개에서 자동 제외
  const [, setHolidayTick] = useState(0);
  useEffect(() => {
    import("@/lib/holidays").then(m => m.applyDeployedHolidaysToLessons(supabase)).then(l => { if (l.length > 0) setHolidayTick(t => t + 1); }).catch(() => {});
  }, []);

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
          booking_id: data.session.user.user_metadata?.booking_id || data.session.user.id,
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
      if (res.ok) { const d = await res.json(); setRequests(d.requests || []); setLessonMap(d.lessonMap || {}); setNotesMap(d.notesMap || {}); }
      const invRes = await fetch(`/api/portal/tutor-invoice?booking_id=${session.booking_id}`);
      if (invRes.ok) { const d = await invRes.json(); setInvLessons(d.lessons || []); }
      const appsRes = await fetch(`/api/portal/tutor-applications?booking_id=${session.booking_id}`);
      if (appsRes.ok) { const d = await appsRes.json(); setMyApplications(d.applications || []); }
      // 취소 요청 목록
      const crRes = await fetch(`/api/portal/tutor/cancel-day?booking_id=${session.booking_id}`);
      if (crRes.ok) { const d = await crRes.json(); setCancelRequests(d || []); }
      if (session.booking_id) {
        const sRes = await fetch(`/api/portal/students?booking_id=${session.booking_id}`);
        if (sRes.ok) {
          const sd = await sRes.json();
          setBookingStudents(sd.students || []);
          if (sd.booker) setBookerInfo(sd.booker);
          // 튜터 가능 구간 = 드림하우스 체류 구간 (제이파크·큐브 리조트 단독은 방문 튜터 불가)
          let tStart = sd.checkin_date || "", tEnd = sd.checkout_date || "", tAllowed = true;
          try {
            const bRes = await fetch(`/api/bookings/${session.booking_id}`);
            if (bRes.ok) {
              const bj = await bRes.json();
              const b = bj.booking || bj;
              const at = String(b.accom_type || "");
              const segs = [
                [b.seg1_type, b.seg1_checkin, b.seg1_checkout],
                [b.seg2_type, b.seg2_checkin, b.seg2_checkout],
              ].filter((x: any[]) => x[0]);
              if (segs.length) {
                const dh = segs.find((x: any[]) => String(x[0]) === "dreamhouse");
                if (dh) { tStart = String(dh[1] || tStart).slice(0, 10); tEnd = String(dh[2] || tEnd).slice(0, 10); }
                else tAllowed = false; // 콤보인데 드림하우스 구간 없음 = 리조트 단독
              } else if (at.includes("제이파크") || at.includes("큐브")) {
                tAllowed = false; // 리조트 단독 투숙
              }
            }
          } catch { /* 확인 실패 시 기존 규칙(투숙 기간) 유지 */ }
          setBookingInfo({ _loaded: true, checkin_date: sd.checkin_date, checkout_date: sd.checkout_date, tutor_allowed: tAllowed, tutor_start: tStart, tutor_end: tEnd });
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
    if (bookerInfo && (bookerInfo.name_kr || bookerInfo.name_en)) {
      list.push({ name_kr: bookerInfo.name_kr, name_en: bookerInfo.name_en, age: bookerInfo.age, _isGuardian: true });
    }
    list.push(...students);
    return list;
  }, [bookerInfo, students]);

  function pickStudentFromModal(idx: number) {
    const s = modalStudents[idx];
    const n = studentName(s);
    const rawAge = n.age || s?.age || s?.birthYear || '';
    const age = formatBirthAge(String(rawAge));
    if (pickerSlot === 'single') {
      setForm(f => ({ ...f, student_name_kr: n.kr, student_name_en: n.en }));
    } else if (pickerSlot === '1') {
      setForm(f => ({ ...f, student1_name_kr: n.kr, student1_name_en: n.en, student1_idx: idx }));
    } else if (pickerSlot === '2') {
      setForm(f => ({ ...f, student2_name_kr: n.kr, student2_name_en: n.en, student2_idx: idx }));
      setStudent2Age(age);
    } else if (pickerSlot === ('single2' as any)) {
      setForm2(f => f ? { ...f, student_name_kr: n.kr, student_name_en: n.en } : f);
    }
    // age는 booking 데이터로부터 자동 인식 (form 저장 불필요)
    void age;
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
    if (res.ok) { const d = await res.json(); setRequests(d.requests || []); setLessonMap(d.lessonMap || {}); setNotesMap(d.notesMap || {}); }
    // 취소 요청도 새로고침
    const crRes = await fetch(`/api/portal/tutor/cancel-day?booking_id=${session.booking_id}`);
    if (crRes.ok) { const d = await crRes.json(); setCancelRequests(d || []); }
  }

  // 해당 세션에 대한 취소 요청 상태 확인
  function getCancelStatus(lessonId: string, sessionDate: string): { status: string; resolution?: string } | null {
    const cr = cancelRequests.find((r: any) => r.lesson_id === lessonId && r.cancel_date === sessionDate);
    if (!cr) return null;
    return { status: cr.status, resolution: cr.resolution };
  }

  // 하루 취소 모달 열기
  function openCancelDay(lesson: InvLesson, sess: InvSession) {
    setCancelDayLesson(lesson);
    setCancelDaySession(sess);
    setCancelDayReason("");
    setCancelDayOpen(true);
  }

  // 하루 취소 제출
  async function submitCancelDay() {
    if (!cancelDayLesson || !cancelDaySession || !session) return;
    setCancelDaySaving(true);
    try {
      const res = await fetch("/api/portal/tutor/cancel-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson_id: cancelDayLesson.id,
          cancel_date: cancelDaySession.session_date,
          reason: cancelDayReason || null,
          booking_id: session.booking_id,
          requested_by: session.guest_name,
          student_name: cancelDayLesson.student_names || "",
          tutor_id: null, // 서버에서 lesson 기준 조회 가능
        }),
      });
      if (res.ok) {
        const cr = await res.json();
        setCancelRequests(prev => [cr, ...prev]);
        setCancelDayOpen(false);
        setTutorToast("취소 요청이 접수되었습니다.");
        setTimeout(() => setTutorToast(""), 3000);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "취소 요청에 실패했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setCancelDaySaving(false);
    }
  }

  async function translateNote(reqId: string, date: string, note: string) {
    const key = `${reqId}:${date}`;
    if (noteTranslations[key]) return; // 캐시 사용
    if (translatingKey === key) return; // 중복 호출 방지
    setTranslatingKey(key);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: note }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.translated) {
        setNoteTranslations(prev => ({ ...prev, [key]: d.translated }));
      } else {
        toastErr("번역 실패: " + (d.error || "알 수 없는 오류"));
      }
    } catch (e) {
      toastErr("번역 실패: " + (e instanceof Error ? e.message : "네트워크 오류"));
    } finally {
      setTranslatingKey("");
    }
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

    // schedule_blocks 검증: 최소 1블록에 요일≥1 + 시간 있어야
    const validBlocks = blocks.filter(b => Array.isArray(b.days) && b.days.length > 0 && (b.time || "").trim() !== "");
    if (validBlocks.length === 0) { setMsg("수업 일정에 요일과 시간을 최소 1개 입력해주세요."); return; }

    // 튜터 가능 기간(드림하우스 체류 구간) + 종료일<시작일 가드
    {
      if (bookingInfo && bookingInfo.tutor_allowed === false) { setMsg("리조트(제이파크·큐브나인) 단독 투숙은 방문 튜터 수업 신청이 불가해요."); return; }
      const bs = bookingInfo?.tutor_start || bookingInfo?.check_in || bookingInfo?.checkin_date || "";
      const be = bookingInfo?.tutor_end || bookingInfo?.check_out || bookingInfo?.checkout_date || "";
      if (!form.start_date || !form.end_date) { setMsg("수업 시작일과 종료일을 모두 선택해주세요."); return; }
      if (form.end_date < form.start_date) { setMsg("종료일은 시작일 이후여야 해요."); return; }
      if ((bs && form.start_date < bs) || (be && form.end_date > be)) {
        setMsg(`튜터 수업은 드림하우스 체류 기간(${bs} ~ ${be}) 안에서만 신청할 수 있어요.`); return;
      }
    }

    setSaving(true); setMsg("");

    const isFor2 = form.class_type === '1:2';
    const finalKr = isFor2
      ? [form.student1_name_kr, form.student2_name_kr].filter(Boolean).join(', ')
      : form.student_name_kr;
    const finalEn = isFor2
      ? [form.student1_name_en, form.student2_name_en].filter(Boolean).join(', ')
      : form.student_name_en;

    const levels = form.is_enrolled
      ? { level_english: 'enrolled', level_speaking: 'enrolled', level_reading: 'enrolled', level_writing: 'enrolled' }
      : { level_english: form.level_english, level_speaking: form.level_speaking, level_reading: form.level_reading, level_writing: form.level_writing };

    // 하위호환: blocks → 기존 단일 필드
    const allDays = Array.from(new Set(validBlocks.flatMap(b => b.days)));
    const compatPreferredTime = validBlocks[0].time;
    const compatSessions = validBlocks[0].sessions_per_day;

    // 통일 정의: 회차 = 실제 수업 "일수"(타임 곱 X), 총액 = 단가(기본×타임) × 일수.
    const _generated = generateClassDates(validBlocks, form.start_date || '', form.end_date || '');
    const _sortedSkips = [...skipDates].filter(d => _generated.some(o => o.date === d)).sort();
    const _kept = _generated.filter(o => !_sortedSkips.includes(o.date));
    const _unitPrice = form.class_type === '1:2' ? 350 : 300;                  // 기본단가(타임 1)
    const _totalSessions = new Set(_kept.map(o => o.date)).size;               // 회차 = 일수
    const _totalAmount = _kept.reduce((s, o) => s + _unitPrice * o.spd, 0);    // Σ(기본×타임) = 단가×일수

    // 학생 나이(원본값) — modalStudents에서 이름 매칭으로 lookup
    const _targetKr = isFor2 ? form.student1_name_kr : form.student_name_kr;
    const _targetEn = isFor2 ? form.student1_name_en : form.student_name_en;
    let _studentAge = '';
    for (const s of modalStudents) {
      const n = studentName(s);
      if ((n.kr || '') === (_targetKr || '') && (n.en || '') === (_targetEn || '')) {
        _studentAge = n.age || String(s?.age || s?.birthYear || '');
        break;
      }
    }
    // 둘째 학생 나이 — 1:2일 때만
    let _student2Age = '';
    if (isFor2) {
      const _t2Kr = form.student2_name_kr;
      const _t2En = form.student2_name_en;
      for (const s of modalStudents) {
        const n = studentName(s);
        if ((n.kr || '') === (_t2Kr || '') && (n.en || '') === (_t2En || '')) {
          _student2Age = n.age || String(s?.age || s?.birthYear || '');
          break;
        }
      }
    }

    if (editingId) {
      const res = await fetch("/api/portal/tutor-edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          student_name_kr: finalKr,
          student_name_en: finalEn,
          class_type: form.class_type,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          preferred_days: allDays,
          skip_dates: _sortedSkips,
          change_notes: form.skip_dates || null,
          preferred_time: compatPreferredTime || null,
          sessions_per_day: compatSessions,
          schedule_blocks: validBlocks,
          total_sessions: _totalSessions,
          total_amount: _totalAmount,
          ...levels,
          textbook: form.textbook || null,
          class_style: form.class_style || null,
          class_focus_arr: form.class_focus_arr || null,
          child_personality: form.child_personality || null,
        }),
      });
      setSaving(false);
      if (!res.ok) { const r = await res.json().catch(() => ({})); setMsg(r.error || "수정 실패"); return; }
      setEditingId("");
      setForm({ ...INIT_FORM });
      setBlocks([{ ...INIT_BLOCK }]);
      setSkipDates([]);
      setTutorToast("수정이 완료되었습니다.");
      setTimeout(() => setTutorToast(""), 2500);
      reload();
      return;
    }

    const res = await fetch("/api/portal/tutor", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_id: session.booking_id,
        guest_name: session.guest_name,
        ...form,
        student_name_kr: finalKr,
        student_name_en: finalEn,
        student_age: _studentAge || null,
        student2_age: _student2Age || null,
        ...levels,
        preferred_days_arr: allDays,
        preferred_time: compatPreferredTime,
        sessions_per_day: compatSessions,
        schedule_blocks: validBlocks,
        skip_dates: _sortedSkips,
        change_notes: form.skip_dates || null,
        total_sessions: _totalSessions,
        total_amount: _totalAmount,
        privacy_agreed: true,
        rules_agreed: true,
        slot_label: null,
      }),
    });
    setSaving(false);
    if (!res.ok) { const r = await res.json(); setMsg(r.error || "신청 실패"); return; }
    setForm({ ...INIT_FORM });
    setBlocks([{ ...INIT_BLOCK }]);
    setSkipDates([]);
    setStudent2Age('');
    setDone(true);
    reload();
  }

  async function cancel(id: string) {
    if (!confirm("신청을 취소하시겠습니까?")) return;
    const res = await fetch(`/api/portal/tutor?id=${id}`, { method: "DELETE" });
    if (!res.ok) { const r = await res.json(); toastErr(r.error || "취소 실패"); return; }
    reload();
  }

  function openEdit(r: TutorReq) {
    const daysArr = Array.isArray(r.preferred_days_arr)
      ? r.preferred_days_arr
      : ((r as any).preferred_days ? String((r as any).preferred_days).split(",").map(s => s.trim()).filter(Boolean) : []);
    const enrolled = (r as any).level_english === 'enrolled';
    const is12 = r.class_type === '1:2';
    const krNames = String(r.student_name_kr || '').split(',').map(s => s.trim());
    const enNames = String(r.student_name_en || '').split(',').map(s => s.trim());
    setForm({
      ...INIT_FORM,
      student_name_kr: is12 ? '' : (r.student_name_kr || ''),
      student_name_en: is12 ? '' : (r.student_name_en || ''),
      student1_name_kr: is12 ? (krNames[0] || '') : '',
      student1_name_en: is12 ? (enNames[0] || '') : '',
      student2_name_kr: is12 ? (krNames[1] || '') : '',
      student2_name_en: is12 ? (enNames[1] || '') : '',
      class_type: r.class_type || '',
      start_date: r.start_date || '',
      end_date: r.end_date || '',
      preferred_days_arr: daysArr,
      skip_dates: (r as any).change_notes || (typeof (r as any).skip_dates === 'string' ? (r as any).skip_dates : '') || '',
      preferred_time: r.preferred_time || '',
      is_enrolled: enrolled,
      level_english: enrolled ? '' : ((r as any).level_english || ''),
      level_speaking: enrolled ? '' : ((r as any).level_speaking || ''),
      level_reading:  enrolled ? '' : ((r as any).level_reading || ''),
      level_writing:  enrolled ? '' : ((r as any).level_writing || ''),
      textbook: (r as any).textbook || '',
      class_style: (r as any).class_style || '',
      class_focus_arr: Array.isArray((r as any).class_focus_arr) ? (r as any).class_focus_arr : [],
      child_personality: (r as any).child_personality || '',
      privacy_agreed: true,
      agreed_rules: true,
    });
    // schedule_blocks 복원: 우선 r.schedule_blocks 그대로, 없으면 단일 블록으로 구성
    const rawBlocks = (r as any).schedule_blocks;
    if (Array.isArray(rawBlocks) && rawBlocks.length > 0) {
      setBlocks(rawBlocks.map((b: any) => ({
        days: Array.isArray(b.days) ? b.days : [],
        time: String(b.time || ''),
        sessions_per_day: (b.sessions_per_day === 2 ? 2 : 1) as 1 | 2,
      })));
      setScheduleMode(rawBlocks.length > 1 ? 'byday' : 'same');
    } else {
      setBlocks([{
        days: daysArr,
        time: r.preferred_time || '',
        sessions_per_day: ((r as any).sessions_per_day === 2 ? 2 : 1) as 1 | 2,
      }]);
      setScheduleMode('same');
    }
    // skip_dates 배열 복원 (text[] 마이그레이션 후 array, 옛 text 값은 제외)
    const rawSkip = (r as any).skip_dates;
    setSkipDates(Array.isArray(rawSkip) ? rawSkip.filter((x: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(x))) : []);
    setEditingId(r.id);
    setTimeout(() => document.getElementById('tutor-apply-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  async function submitCancelReq() {
    if (!cancelReqId) return;
    setCancelReqSaving(true);
    const res = await fetch("/api/portal/cancel-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "tutor_requests", id: cancelReqId, reason: cancelReqReason }),
    });
    setCancelReqSaving(false);
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      toastErr("취소 요청 실패: " + (r.error || ""));
      return;
    }
    setCancelReqId("");
    setCancelReqReason("");
    setTutorToast("취소 요청이 접수되었습니다.");
    setTimeout(() => setTutorToast(""), 2500);
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
                    <span className="k">총 회차:</span>{((l as unknown as { billed_sessions?: number; billed_amount?: number }).billed_sessions ?? l.total_sessions) != null ? `${(l as unknown as { billed_sessions?: number; billed_amount?: number }).billed_sessions ?? l.total_sessions}회` : "-"}
                    <span className="k" style={{ marginLeft: 10 }}>확정 금액:</span>
                    {((l as unknown as { billed_sessions?: number; billed_amount?: number }).billed_amount ?? l.total_amount) != null ? `₱${Number((l as unknown as { billed_sessions?: number; billed_amount?: number }).billed_amount ?? l.total_amount).toLocaleString()}` : "-"}
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
                      const cr = getCancelStatus(l.id, s.session_date);
                      const canCancel = s.status === "scheduled" && !cr;
                      return (
                        <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 2px", fontSize: 12, gap: 6 }}>
                          <span style={{ color: "#475569", flex: 1 }}>{s.session_idx}회차 · {s.session_date}{s.session_time ? ` ${s.session_time}` : ""}</span>
                          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                            {cr ? (
                              <span className="badge" style={{
                                background: cr.status === "pending" ? "#fef3c7" : cr.status === "approved" ? "#fef2f2" : "#f1f5f9",
                                color: cr.status === "pending" ? "#92400e" : cr.status === "approved" ? "#dc2626" : "#64748b",
                                fontSize: 11
                              }}>
                                {cr.status === "pending" ? "취소 대기중" : cr.status === "approved" ? (cr.resolution === "deduct" ? "취소(차감)" : "취소(보강)") : "취소 거절"}
                              </span>
                            ) : (
                              <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                            )}
                            {canCancel && (
                              <button
                                onClick={() => openCancelDay(l, s)}
                                style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                              >취소 신청</button>
                            )}
                          </div>
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
      <div id="tutor-apply-form" />
      {editingId && <div style={{background:'#eff6ff',border:'1.5px solid #bfdbfe',borderRadius:10,padding:'12px 16px',marginBottom:14,fontSize:13,fontWeight:700,color:'#1d4ed8'}}>✏️ 신청 수정 중 — 기존 신청 내용이 채워졌습니다. 바꿀 부분(레벨 포함)만 수정 후 아래 &quot;수정 저장&quot;을 눌러주세요.</div>}
      {editingId && <div style={{background:'#fef3c7',border:'1px solid #f59e0b',borderLeft:'4px solid #f59e0b',borderRadius:10,padding:'10px 14px',marginBottom:14,fontSize:12.5,fontWeight:700,color:'#92400e',lineHeight:1.5}}>⚠️ 인보이스가 발행되고 수정하시는 경우에는 반영이 불가할 수 있습니다.</div>}
      <div style={{fontSize:13,fontWeight:800,color:"#7c3aed",marginBottom:8,padding:"4px 12px",background:"#f5f3ff",borderRadius:8,display:"inline-block"}}>📋 신청 1</div>
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
                  {form.student_name_kr}{form.student_name_en ? ` / ${form.student_name_en}` : ""}
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
                    <div className="sel-name">{form.student1_name_kr}{form.student1_name_en ? ` / ${form.student1_name_en}` : ""}</div>
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

      </div>

      <div className="sec">
        <h2>수업 일정</h2>
        <div className="q">
          <label className="q-label"><span className="num">3</span>수업 시작일</label>
          <input className="inp" type="date" value={form.start_date}
            min={bookingInfo?.tutor_start || bookingInfo?.check_in || bookingInfo?.checkin_date || undefined}
            max={bookingInfo?.tutor_end || bookingInfo?.check_out || bookingInfo?.checkout_date || undefined}
            onChange={e => {
              const v = e.target.value;
              setForm({ ...form, start_date: v });
              if (v && new Date(v) < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)) {
                toastErr("수업은 최소 2주 전 사전 신청이 필요합니다.\n선택하신 날짜는 신청이 불가할 수 있습니다.");
              }
            }} />
          {form.start_date && new Date(form.start_date) < new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) && (
            <div style={{marginTop:8, padding:'10px 14px', background:'#fef3c7', border:'1px solid #f59e0b', borderRadius:8, fontSize:13, color:'#92400e'}}>
              ⚠️ 수업은 최소 <strong>2주 전</strong> 사전 신청이 필요합니다. 선택하신 날짜는 신청이 불가할 수 있습니다.
            </div>
          )}
        </div>
        <div className="q">
          <label className="q-label"><span className="num">4</span>수업 종료일</label>
          <input className="inp" type="date" value={form.end_date}
            min={form.start_date || bookingInfo?.tutor_start || bookingInfo?.check_in || bookingInfo?.checkin_date || undefined}
            max={bookingInfo?.tutor_end || bookingInfo?.check_out || bookingInfo?.checkout_date || undefined}
            onChange={e => setForm({ ...form, end_date: e.target.value })} />
        </div>

        {/* 예약 기간 외 / 종료일 < 시작일 차단 안내 */}
        {(() => {
          const bs = bookingInfo?.check_in || bookingInfo?.checkin_date || "";
          const be = bookingInfo?.check_out || bookingInfo?.checkout_date || "";
          const sBefore = !!form.start_date && !!bs && form.start_date < bs;
          const eAfter  = !!form.end_date   && !!be && form.end_date   > be;
          const eBeforeS = !!form.start_date && !!form.end_date && form.end_date < form.start_date;
          if (!sBefore && !eAfter && !eBeforeS) return null;
          const fmtMD = (iso: string) => iso ? iso.slice(5).replace('-', '/') : '-';
          return (
            <div style={{marginTop:8,padding:'10px 14px',background:'#fef2f2',border:'1px solid #fca5a5',borderLeft:'4px solid #ef4444',borderRadius:8,fontSize:13,color:'#991b1b',fontWeight:600,lineHeight:1.5}}>
              {(sBefore || eAfter) && <>⚠️ 예약(투숙) 기간 안에서만 선택할 수 있어요 ({fmtMD(bs)} ~ {fmtMD(be)}).</>}
              {sBefore && <div style={{marginTop:4,fontWeight:500}}>· 수업 시작일이 체크인보다 빠릅니다.</div>}
              {eAfter && <div style={{marginTop:4,fontWeight:500}}>· 수업 종료일이 체크아웃 이후입니다.</div>}
              {eBeforeS && <div style={{marginTop:(sBefore||eAfter)?4:0}}>⚠️ 종료일은 시작일 이후여야 해요.</div>}
            </div>
          );
        })()}
        <div className="q">
          <label className="q-label">
            <span className="num">5</span>수업 일정 (요일 + 시간)
            {(() => {
              const ci = bookingInfo?.check_in || bookingInfo?.checkin_date;
              const co = bookingInfo?.check_out || bookingInfo?.checkout_date;
              if (!ci || !co) return null;
              return (
                <span style={{marginLeft:8, fontSize:11, fontWeight:700, color:'#1d4ed8', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:6, padding:'2px 8px', display:'inline-block'}}>
                  🔒 예약 기간 {ci} ~ {co}
                </span>
              );
            })()}
          </label>

          <div style={{display:'flex', gap:6, marginBottom:10, flexWrap:'wrap'}}>
            {([
              { v:'same' as const, label:'매주 같아요' },
              { v:'byday' as const, label:'요일마다 시간 달라요' },
            ]).map(p => {
              const on = scheduleMode === p.v;
              return (
                <button key={p.v} type="button"
                  onClick={() => {
                    if (p.v === 'same' && scheduleMode !== 'same') {
                      setBlocks(prev => prev.length > 0 ? [prev[0]] : [{ ...INIT_BLOCK }]);
                    }
                    setScheduleMode(p.v);
                  }}
                  style={{padding:'6px 14px', border:`1.5px solid ${on?'#1a6fc4':'#e2e8f0'}`, borderRadius:999, background:on?'#eff6ff':'#fff', color:on?'#1a6fc4':'#475569', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit'}}>
                  {p.label}
                </button>
              );
            })}
            <button type="button" disabled
              style={{padding:'6px 14px', border:'1.5px solid #e5e7eb', borderRadius:999, background:'#f9fafb', color:'#9ca3af', fontSize:12, fontWeight:700, cursor:'not-allowed', fontFamily:'inherit'}}>
              주마다 달라요 (곧)
            </button>
          </div>

          {blocks.map((b, idx) => (
            <div key={idx} style={{padding:14, border:'1.5px solid #e2e8f0', borderRadius:10, marginBottom:10, background:'#f8fafc'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
                <span style={{fontSize:12, fontWeight:800, color:'#1a6fc4'}}>일정 {idx+1}</span>
                {blocks.length > 1 && (
                  <button type="button" onClick={() => setBlocks(prev => prev.filter((_,i) => i !== idx))}
                    style={{background:'none', border:'none', color:'#94a3b8', fontSize:18, cursor:'pointer', fontFamily:'inherit'}}>✕</button>
                )}
              </div>

              <div style={{marginBottom:10}}>
                <div style={{fontSize:12, fontWeight:700, color:'#475569', marginBottom:6}}>원하는 타임 수</div>
                <div className="ct-row">
                  <button type="button" className={`ct-btn${b.sessions_per_day === 1 ? ' on' : ''}`}
                    onClick={() => setBlocks(prev => prev.map((x,i) => i===idx ? {...x, sessions_per_day: 1, time: ''} : x))}>
                    1타임<span className="price">50분</span>
                  </button>
                  <button type="button" className={`ct-btn${b.sessions_per_day === 2 ? ' on' : ''}`}
                    onClick={() => setBlocks(prev => prev.map((x,i) => i===idx ? {...x, sessions_per_day: 2, time: ''} : x))}>
                    2타임<span className="price">100분</span>
                  </button>
                </div>
              </div>

              <div style={{marginBottom:10}}>
                <div style={{fontSize:12, fontWeight:700, color:'#475569', marginBottom:6}}>요일 (복수 선택)</div>
                <div className="opts" style={{alignItems:'center'}}>
                  {DAYS.map(d => {
                    const on = b.days.includes(d);
                    return (
                      <button key={d} type="button" className={`opt${on ? " on" : ""}`}
                        onClick={() => setBlocks(prev => prev.map((x,i) => i===idx ? {...x, days: on ? x.days.filter(y=>y!==d) : [...x.days, d]} : x))}>{d}</button>
                    );
                  })}
                  <span style={{fontSize:11, color:'#92400e', marginLeft:4, fontWeight:600}}>※ 토요일은 매달 2·4주차만 가능</span>
                </div>
                {b.days.includes('토') && (
                  <div style={{marginTop:8, padding:'10px 14px', background:'#fef3c7', border:'1px solid #f59e0b', borderRadius:8, fontSize:12, color:'#92400e', lineHeight:1.5}}>
                    ⚠️ 토요일은 <strong>필드트립이 있는 주에만 가능합니다 (매월 둘째·넷째 주 토요일)</strong>. 다른 토요일은 자동 제외됩니다.
                  </div>
                )}
              </div>

              <div>
                <div style={{fontSize:12, fontWeight:700, color:'#475569', marginBottom:6}}>원하는 수업 시간
                  {isPeakSeason(form.start_date) && (
                    <span style={{color:'#92400e', marginLeft:6, fontSize:11, fontWeight:600}}>※ 성수기(7/15~8/30)는 17:00 이후만 가능합니다.</span>
                  )}
                </div>
                {b.time ? (
                  <div className="stu-pick">
                    <div className="sel-name">{b.time}</div>
                    <button type="button" className="change-btn" onClick={() => { setTimeBlockIdx(idx); setTimePickerOpen(true); }}>변경</button>
                  </div>
                ) : (
                  <div className="stu-pick">
                    <button type="button" className="pick-btn" onClick={() => { setTimeBlockIdx(idx); setTimePickerOpen(true); }}>🕐 시간 선택하기</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {scheduleMode === 'byday' && (
            <button type="button" onClick={() => setBlocks(prev => [...prev, { ...INIT_BLOCK }])}
              style={{padding:'10px 24px', border:'2px dashed #1a6fc4', borderRadius:10, background:'#eff6ff', color:'#1a6fc4', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', width:'100%'}}>
              ➕ 다른 시간/요일 추가
            </button>
          )}
        </div>

        {(() => {
          const validBlocks = blocks.filter(b => b.days.length > 0 && (b.time || '').trim() !== '');
          if (validBlocks.length === 0 || !form.start_date || !form.end_date) return null;
          const KR_TO_IDX: Record<string, number> = {'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6};
          const occInRange = (days: string[]) => {
            const s = new Date(form.start_date + 'T00:00:00');
            const e = new Date(form.end_date + 'T00:00:00');
            if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;
            const idxSet = new Set(days.map(d => KR_TO_IDX[d]).filter(i => i !== undefined));
            let cnt = 0;
            const d = new Date(s);
            while (d <= e) {
              if (idxSet.has(d.getDay())) cnt++;
              d.setDate(d.getDate() + 1);
            }
            return cnt;
          };
          const N = validBlocks.reduce((s, b) => s + b.days.length * b.sessions_per_day, 0);
          const K_gross = validBlocks.reduce((s, b) => s + occInRange(b.days) * b.sessions_per_day, 0);
          // skipDates 차감: 빠지는 날짜 1건당 해당 블록의 sessions_per_day 차감
          const _gen = generateClassDates(validBlocks, form.start_date, form.end_date);
          const skipDeduct = _gen.filter(o => skipDates.includes(o.date)).reduce((s, o) => s + o.spd, 0);
          const K = Math.max(0, K_gross - skipDeduct);
          // 회차 = 실제 수업 "일수"(타임 곱 X) — 표시용
          const daysCount = new Set(_gen.filter(o => !skipDates.includes(o.date)).map(o => o.date)).size;
          const skippedDays = skipDates.filter(d => _gen.some(o => o.date === d)).length;
          const ms = new Date(form.end_date + 'T00:00:00').getTime() - new Date(form.start_date + 'T00:00:00').getTime();
          const days = Math.floor(ms / 86400000) + 1;
          const M = Math.max(1, Math.ceil(days / 7));
          const unit = form.class_type === '1:2' ? 350 : 300;
          const amount = K * unit;
          const DAY_ORDER = ['월','화','수','목','금','토','일'];
          return (
            <div className="q" style={{padding:14, border:'1.5px solid #bfdbfe', borderRadius:10, background:'#eff6ff'}}>
              <div style={{fontSize:13, fontWeight:800, color:'#1d4ed8', marginBottom:10}}>📅 미리보기</div>
              <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, marginBottom:12}}>
                {DAY_ORDER.map(d => {
                  const times = validBlocks.filter(b => b.days.includes(d)).map(b => b.time);
                  const isWeekend = d === '토' || d === '일';
                  return (
                    <div key={d} style={{padding:'8px 4px', background:'#fff', borderRadius:6, textAlign:'center', minHeight:60, display:'flex', flexDirection:'column', justifyContent:'center', border:'1px solid #e2e8f0'}}>
                      <div style={{fontSize:11, fontWeight:800, color: isWeekend ? '#dc2626' : '#475569'}}>{d}</div>
                      {times.length > 0
                        ? times.map((t, i) => <div key={i} style={{fontSize:10, fontWeight:700, color:'#1d4ed8', marginTop:2, lineHeight:1.2, wordBreak:'keep-all'}}>{t}</div>)
                        : <div style={{fontSize:14, color:'#cbd5e1', marginTop:2}}>—</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{display:'flex', flexWrap:'wrap', gap:10, fontSize:12.5, color:'#374151', alignItems:'center'}}>
                <span style={{fontWeight:800, color:'#1d4ed8'}}>주 {N}회</span>
                <span style={{color:'#94a3b8'}}>·</span>
                <span>전체 {M}주</span>
                {skippedDays > 0 && (<><span style={{color:'#94a3b8'}}>·</span><span style={{color:'#dc2626', fontWeight:700}}>빠짐 {skippedDays}일</span></>)}
                <span style={{flex:1}} />
                <span style={{fontWeight:800, color:'#1a6fc4'}}>총 {daysCount}회</span>
                <span style={{fontWeight:800, color:'#16a34a'}}>₱{amount.toLocaleString()}</span>
              </div>
            </div>
          );
        })()}

        <div className="q">
          <label className="q-label"><span className="num">6</span>빠지는 날짜 (결석)</label>
          {(() => {
            const generated = generateClassDates(blocks, form.start_date, form.end_date);
            const available = generated.filter(o => !skipDates.includes(o.date));
            if (generated.length === 0) {
              return <div style={{fontSize:12, color:'#94a3b8', padding:'8px 0'}}>먼저 위에서 요일·시간·기간을 입력하면 빠지는 날짜를 고를 수 있어요.</div>;
            }
            return (
              <>
                <select
                  className="inp"
                  value=""
                  onChange={e => { const v = e.target.value; if (v) setSkipDates(prev => [...prev, v].sort()); }}
                >
                  <option value="">{available.length === 0 ? "(모든 수업일이 선택됨)" : "+ 빠질 날짜 선택"}</option>
                  {available.map(o => {
                    const mm = o.date.slice(5,7).replace(/^0/, '');
                    const dd = o.date.slice(8,10).replace(/^0/, '');
                    return <option key={o.date + o.time} value={o.date}>{mm}/{dd}({o.day}) {o.time.replace(/\s*\([^)]*\)\s*$/,'')}</option>;
                  })}
                </select>
                {skipDates.length > 0 && (
                  <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:8}}>
                    {skipDates.map(d => {
                      const found = generated.find(o => o.date === d);
                      const dw = found?.day || '';
                      const mm = d.slice(5,7).replace(/^0/, '');
                      const dd = d.slice(8,10).replace(/^0/, '');
                      return (
                        <span key={d} style={{display:'inline-flex', alignItems:'center', gap:4, padding:'4px 10px', background:'#fef2f2', color:'#b91c1c', border:'1px solid #fecaca', borderRadius:999, fontSize:12, fontWeight:700}}>
                          {mm}/{dd}{dw ? `(${dw})` : ''}
                          <button type="button" onClick={() => setSkipDates(prev => prev.filter(x => x !== d))}
                            style={{background:'none', border:'none', color:'#b91c1c', cursor:'pointer', padding:0, marginLeft:4, fontSize:14, lineHeight:1, fontFamily:'inherit'}}>✕</button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
        <div className="q">
          <label className="q-label">변경·요청 사항 (선택)</label>
          <textarea className="area" value={form.skip_dates} onChange={e => setForm({ ...form, skip_dates: e.target.value })} placeholder="예: 4/17 오전→오후 변경 요청, 6/12 휴일 보강 요청 등" />
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
            <label className="q-label"><span className="num">8</span>영어 레벨</label>
            <div className="opts-v">
              {LEVELS_ENGLISH.map(l => (
                <button key={l.value} type="button" className={`opt-card${form.level_english === l.value ? " on" : ""}`} onClick={() => setForm({ ...form, level_english: l.value })}>
                  <span className="ko">{l.kr}</span><span className="en">{l.en}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="q">
            <label className="q-label"><span className="num">9</span>스피킹 레벨</label>
            <div className="opts-v">
              {LEVELS_SPEAKING.map(l => (
                <button key={l.value} type="button" className={`opt-card${form.level_speaking === l.value ? " on" : ""}`} onClick={() => setForm({ ...form, level_speaking: l.value })}>
                  <span className="ko">{l.kr}</span><span className="en">{l.en}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="q">
            <label className="q-label"><span className="num">10</span>리딩 레벨</label>
            <div className="opts-v">
              {LEVELS_READING.map(l => (
                <button key={l.value} type="button" className={`opt-card${form.level_reading === l.value ? " on" : ""}`} onClick={() => setForm({ ...form, level_reading: l.value })}>
                  <span className="ko">{l.kr}</span><span className="en">{l.en}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="q">
            <label className="q-label"><span className="num">11</span>라이팅 레벨</label>
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
          <label className="q-label"><span className="num">12</span>사용 영어교재 (따로 원하는 교재가 있을 시 기재해주세요)</label>
          <input className="inp" value={form.textbook} onChange={e => setForm({ ...form, textbook: e.target.value })} placeholder="예 ) 브릭스 50, 리딩스트리트 2.1, 멀티플리딩스킬, 올어보드 4" />
        </div>
        <div className="q">
          <label className="q-label"><span className="num">13</span>수업 방향</label>
          <div className="opts">
            {STYLES.map(s => (
              <button key={s} type="button" className={`opt${form.class_style === s ? " on" : ""}`} onClick={() => setForm({ ...form, class_style: s })}>{s}</button>
            ))}
          </div>
        </div>
        <div className="q">
          <label className="q-label"><span className="num">14</span>수업 방향 상세 (최대 2개)</label>
          <div className="opts">
            {FOCUS.map(f => (
              <button key={f} type="button" className={`opt${form.class_focus_arr.includes(f) ? " on" : ""}`} onClick={() => toggleFocus(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="q">
          <label className="q-label"><span className="num">15</span>아이 성향/흥미 / 원하시는 요청 사항</label>
          <textarea className="area" value={form.child_personality} onChange={e => setForm({ ...form, child_personality: e.target.value })} placeholder="예: 활발하고 말이 많음, 스포츠/공룡 좋아함" />
        </div>
      </div>

      {form2 !== null && (
        <div style={{marginTop:8,padding:"16px",background:"#f5f3ff",borderRadius:14,border:"2px solid #c4b5fd"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <span style={{fontSize:13,fontWeight:800,color:"#7c3aed"}}>📋 신청 2</span>
            <button type="button" onClick={() => setForm2(null)}
              style={{background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
          </div>

          {/* 수업 유형 */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:6}}>수업 유형</div>
            <div style={{display:"flex",gap:8}}>
              {["1:1","1:2"].map(t => (
                <button key={t} type="button"
                  onClick={() => setForm2(f => f ? {...f, class_type: t} : f)}
                  style={{flex:1,padding:"10px",border:`2px solid ${form2.class_type===t?"#7c3aed":"#e5e7eb"}`,borderRadius:8,background:form2.class_type===t?"#ede9fe":"#fff",color:form2.class_type===t?"#7c3aed":"#374151",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                  {t} 수업
                </button>
              ))}
            </div>
          </div>

          {/* 학생 선택 — 기존 학생 목록 재사용 */}
          {form2.class_type === '1:1' && (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:6}}>학생 선택</div>
              {form2.student_name_kr ? (
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"#ede9fe",borderRadius:8}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#7c3aed"}}>{form2.student_name_kr}{form2.student_name_en ? ` / ${form2.student_name_en}` : ''}</span>
                  <button type="button" onClick={() => setPickerSlot('single2' as any)}
                    style={{marginLeft:"auto",padding:"4px 10px",border:"1px solid #7c3aed",borderRadius:6,background:"#fff",color:"#7c3aed",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>변경</button>
                </div>
              ) : (
                <button type="button" onClick={() => setPickerSlot('single2' as any)}
                  style={{padding:"10px 16px",border:"2px dashed #c4b5fd",borderRadius:8,background:"#fff",color:"#7c3aed",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                  👨‍👩‍👧 학생 선택하기
                </button>
              )}
            </div>
          )}

          {/* 원하는 요일 */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:6}}>원하는 수업 요일</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["월","화","수","목","금","토"].map(d => {
                const on = form2.preferred_days_arr.includes(d);
                return (
                  <button key={d} type="button"
                    onClick={() => setForm2(f => f ? {...f, preferred_days_arr: on ? f.preferred_days_arr.filter(x=>x!==d) : [...f.preferred_days_arr, d]} : f)}
                    style={{padding:"7px 14px",border:`2px solid ${on?"#7c3aed":"#e5e7eb"}`,borderRadius:8,background:on?"#ede9fe":"#fff",color:on?"#7c3aed":"#374151",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 원하는 시간 */}
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:6}}>원하는 시간</div>
            <input type="text" placeholder="예: 10:00" value={form2.preferred_time}
              onChange={e => setForm2(f => f ? {...f, preferred_time: e.target.value} : f)}
              style={{width:"100%",padding:"9px 12px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
          </div>

          {/* 시작일/종료일 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:4}}>수업 시작일</div>
              <input type="date" value={form2.start_date}
                onChange={e => setForm2(f => f ? {...f, start_date: e.target.value} : f)}
                style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:4}}>수업 종료일</div>
              <input type="date" value={form2.end_date}
                onChange={e => setForm2(f => f ? {...f, end_date: e.target.value} : f)}
                style={{width:"100%",padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
            </div>
          </div>
        </div>
      )}

      <div className="sec">
        <h2>동의<span style={{ color: "#dc2626", marginLeft: 4 }}>*</span></h2>
        <div className="agree">
          <label>
            <input type="checkbox" checked={form.privacy_agreed} onChange={e => setForm({ ...form, privacy_agreed: e.target.checked })} />
            <span><b>16. 개인정보 수집 및 이용 동의</b><br/><span style={{ fontSize: 11, color: "#6b7c93" }}>수업 매칭 및 튜터 배정 목적으로 수집한 정보를 활용합니다.</span></span>
          </label>
        </div>

        <div className="q" style={{ marginBottom: 8 }}>
          <label className="q-label"><span className="num">17</span>튜터 변경 및 환불 규정 동의<span className="req">*</span></label>
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

        {(() => {
          const notAllowed = bookingInfo && bookingInfo.tutor_allowed === false;
          const bs = bookingInfo?.tutor_start || bookingInfo?.check_in || bookingInfo?.checkin_date || "";
          const be = bookingInfo?.tutor_end || bookingInfo?.check_out || bookingInfo?.checkout_date || "";
          const outOfRange =
            (!!form.start_date && !!bs && form.start_date < bs) ||
            (!!form.end_date   && !!be && form.end_date   > be) ||
            (!!form.start_date && !!form.end_date && form.end_date < form.start_date);
          const isCombo = !!bookingInfo && bookingInfo.tutor_allowed !== false && !!bookingInfo.tutor_start && (bookingInfo.tutor_start !== (bookingInfo.checkin_date || "") || bookingInfo.tutor_end !== (bookingInfo.checkout_date || ""));
          return (<>
            {notAllowed && (
              <div style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 12, padding: "12px 16px", fontSize: 13.5, fontWeight: 700, color: "#991b1b", marginBottom: 10 }}>
                🙏 방문 튜터 수업은 <b>드림하우스 체류 중에만</b> 진행돼요.<br />
                <span style={{ fontWeight: 500 }}>리조트(제이파크·큐브나인) 단독 투숙은 신청이 불가합니다. 궁금하신 점은 카카오 채널로 문의해주세요.</span>
              </div>
            )}
            {isCombo && (
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, fontWeight: 700, color: "#1e40af", marginBottom: 10 }}>
                ℹ️ 콤보 예약은 <b>드림하우스 체류 기간({bs} ~ {be})</b>에만 튜터 수업을 신청할 수 있어요.
              </div>
            )}
            <button className="btn" onClick={submit} disabled={saving || !form.agreed_rules || outOfRange || notAllowed}>
              {notAllowed ? "리조트 단독 투숙은 신청 불가" : saving ? (editingId ? "수정 중..." : "신청 중...") : outOfRange ? "드림하우스 체류 기간을 벗어났습니다" : (editingId ? "✏️ 수정 저장" : "튜터 수업 신청하기")}
            </button>
            {editingId && <button className="btn" style={{background:'#e2e8f0',color:'#475569',marginTop:8}} onClick={() => { setEditingId(''); setForm({ ...INIT_FORM }); setBlocks([{ ...INIT_BLOCK }]); setSkipDates([]); }}>수정 취소</button>}
          </>);
        })()}
        {msg && <div className={`msg ${msg.includes("완료") ? "msg-ok" : "msg-err"}`}>{msg}</div>}
      </div>
      </>)}

      <div className="sec">
        <h2>📋 내 튜터 신청내역 ({requests.length}건)</h2>
        {requests.length === 0 ? <div className="empty">아직 신청 내역이 없습니다</div> :
          requests.map(r => {
            const studentName = [r.student_name_kr, r.student_name_en].filter(Boolean).join(" / ") || "-";
            const daysVal = Array.isArray(r.preferred_days_arr)
              ? r.preferred_days_arr.join(", ")
              : ((r as any).preferred_days || "");
            return (
              <div key={r.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>
                    {studentName}
                    {(() => {
                      const s = r.status;
                      const cfg: Record<string, {label:string;bg:string;color:string}> = {
                        pending:   {label:"검토중",  bg:"#f1f5f9", color:"#475569"},
                        reviewing: {label:"검토중",  bg:"#f1f5f9", color:"#475569"},
                        assigned:  {label:"배정완료", bg:"#dbeafe", color:"#1e40af"},
                        confirmed: {label:"✅ 확정", bg:"#dcfce7", color:"#166534"},
                        cancelled: {label:"취소됨",  bg:"#fee2e2", color:"#dc2626"},
                      };
                      const c = cfg[s] || {label:s, bg:"#f1f5f9", color:"#475569"};
                      return (
                        <span style={{
                          display:"inline-block", padding:"2px 10px",
                          background:c.bg, color:c.color,
                          borderRadius:20, fontSize:11, fontWeight:700,
                          marginLeft:8
                        }}>{c.label}</span>
                      );
                    })()}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                  <div><span style={{ fontWeight: 700, color: "#6b7c93", marginRight: 4 }}>수업 유형:</span>{r.class_type || "-"}</div>
                  <div><span style={{ fontWeight: 700, color: "#6b7c93", marginRight: 4 }}>기간:</span>{r.start_date || "-"} ~ {r.end_date || "-"}</div>
                  <div><span style={{ fontWeight: 700, color: "#6b7c93", marginRight: 4 }}>요일:</span>{daysVal || "-"}</div>
                  <div><span style={{ fontWeight: 700, color: "#6b7c93", marginRight: 4 }}>시간:</span>{r.preferred_time || "-"}</div>
                </div>
                {(r.status === 'pending' || r.status === 'confirmed') && (
                  <div style={{ display:"flex", justifyContent:"flex-end", gap:6, marginTop:10 }}>
                    {r.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        style={{ padding:"6px 14px", background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                      >✏️ 수정</button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setCancelReqId(r.id); setCancelReqReason(""); }}
                      style={{ padding:"6px 14px", background:"#fef2f2", color:"#b91c1c", border:"1px solid #fecaca", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                    >취소요청</button>
                  </div>
                )}
                {r.status === 'confirmed' && lessonMap[r.id] && (() => {
                  const l = lessonMap[r.id];
                  const days = Array.isArray(l.class_days)
                    ? l.class_days.join(', ')
                    : (l.class_days || '-');
                  return (
                    <div style={{
                      marginTop:10, padding:"12px 14px",
                      background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",
                      borderRadius:10, border:"1.5px solid #86efac"
                    }}>
                      <div style={{fontSize:12,fontWeight:800,color:"#15803d",marginBottom:8}}>
                        ✅ 수업 확정 인보이스
                      </div>
                      <div style={{fontSize:12,color:"#166534",lineHeight:1.9}}>
                        {l.tutor_name && <div>👩‍🏫 <b>담당 튜터:</b> {l.tutor_name}</div>}
                        {l.confirmed_time && <div>🕐 <b>확정 시간:</b> {l.confirmed_time}</div>}
                        {days && days !== '-' && <div>📅 <b>수업 요일:</b> {days}</div>}
                        <div style={{
                          marginTop:8, paddingTop:8,
                          borderTop:"1px solid #bbf7d0",
                          display:"flex", gap:16
                        }}>
                          {((l as unknown as { billed_sessions?: number; billed_amount?: number }).billed_sessions ?? l.total_sessions) != null && (
                            <div style={{textAlign:"center"}}>
                              <div style={{fontSize:18,fontWeight:900,color:"#15803d"}}>{String((l as unknown as { billed_sessions?: number; billed_amount?: number }).billed_sessions ?? l.total_sessions)}회</div>
                              <div style={{fontSize:10,color:"#16a34a",fontWeight:700}}>총 수업</div>
                            </div>
                          )}
                          {Number((l as unknown as { billed_sessions?: number; billed_amount?: number }).billed_amount ?? l.total_amount) > 0 && (
                            <div style={{textAlign:"center"}}>
                              <div style={{fontSize:18,fontWeight:900,color:"#15803d"}}>₱{Number((l as unknown as { billed_sessions?: number; billed_amount?: number }).billed_amount ?? l.total_amount).toLocaleString()}</div>
                              <div style={{fontSize:10,color:"#16a34a",fontWeight:700}}>총 금액</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {r.status === 'confirmed' && Array.isArray(notesMap[r.id]) && notesMap[r.id].length > 0 && (
                  <div style={{
                    marginTop:10, padding:"12px 14px",
                    background:"#f8fafc", borderRadius:10, border:"1px solid #e2e8f0"
                  }}>
                    <div style={{fontSize:12,fontWeight:800,color:"#1a6fc4",marginBottom:8}}>
                      📝 데일리 노트 ({notesMap[r.id].length}건)
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {notesMap[r.id].map((n) => {
                        const md = n.date ? `${n.date.slice(5,7)}/${n.date.slice(8,10)}` : '-';
                        const key = `${r.id}:${n.date}`;
                        const tr = noteTranslations[key];
                        const isTranslating = translatingKey === key;
                        return (
                          <div key={key} style={{padding:"8px 10px",background:"#fff",borderRadius:8,border:"1px solid #e2e8f0"}}>
                            <div style={{fontSize:12,color:"#475569",lineHeight:1.5}}>
                              <b style={{color:"#1a6fc4",marginRight:6}}>{md}:</b>{n.note}
                            </div>
                            {tr ? (
                              <div style={{marginTop:6,padding:"6px 8px",background:"#eff6ff",borderRadius:6,fontSize:12,color:"#1e3a8a",lineHeight:1.5}}>
                                🇰🇷 {tr}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => translateNote(r.id, n.date, n.note)}
                                disabled={isTranslating}
                                style={{marginTop:6,padding:"4px 10px",background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",borderRadius:6,fontSize:11,fontWeight:700,cursor:isTranslating?"not-allowed":"pointer",fontFamily:"inherit",opacity:isTranslating?0.6:1}}
                              >{isTranslating ? "번역 중..." : "🇰🇷 한국어로 번역"}</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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

    {timePickerOpen && (() => {
      const peak = isPeakSeason(form.start_date);
      const curBlock = blocks[timeBlockIdx] || INIT_BLOCK;
      const curSessions = curBlock.sessions_per_day;
      // 현재 블록 time에서 시작 시각 파싱, 없으면 기본값
      const m = (curBlock.time || "").match(/^(\d{1,2}):(\d{2})/);
      const initial = m ? `${m[1].padStart(2,"0")}:${m[2]}` : (peak ? "17:00" : "10:00");
      return (
        <div className="modal-bg" onClick={() => setTimePickerOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>수업 시간 선택</h3>
            <div className="modal-sub">
              {curSessions}타임 ({curSessions * 50}분) 시작 시간을 입력하세요. (10:00 ~ 20:00)
              {peak && <><br/><span style={{color:'#dc2626',fontWeight:700}}>※ 성수기는 17:00 이후만 가능합니다.</span></>}
            </div>
            <input
              id="tutor-time-input"
              type="time"
              min="10:00"
              max="20:00"
              step={600}
              defaultValue={initial}
              style={{width:"100%",padding:"14px 16px",border:"1.5px solid #e2e8f0",borderRadius:10,fontSize:18,fontWeight:700,fontFamily:"inherit",color:"#1a1a2e",outline:"none",textAlign:"center"}}
            />
            <div style={{marginTop:12,fontSize:11,color:"#6b7c93",fontWeight:600}}>빠른 선택</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginTop:6}}>
              {["10:00","13:00","14:00","15:30","17:00","17:30","18:00","19:00"].map(t => {
                const [h] = t.split(":").map(Number);
                const disabled = peak && h < 17;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={disabled}
                    onClick={() => { const el = document.getElementById("tutor-time-input") as HTMLInputElement | null; if (el) el.value = t; }}
                    style={{padding:"9px 4px",border:"1px solid #e2e8f0",borderRadius:8,background:disabled?"#f1f5f9":"#fff",color:disabled?"#94a3b8":"#1a1a2e",cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",fontSize:12.5,fontWeight:700}}
                    title={disabled?"성수기 불가":""}
                  >{t}</button>
                );
              })}
            </div>
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <button
                type="button"
                onClick={() => setTimePickerOpen(false)}
                style={{flex:1,padding:"12px",border:"1px solid #e2e8f0",borderRadius:10,background:"#fff",color:"#6b7c93",cursor:"pointer",fontFamily:"inherit",fontSize:13.5,fontWeight:700}}
              >취소</button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("tutor-time-input") as HTMLInputElement | null;
                  const v = (el?.value || "").trim();
                  if (!/^\d{2}:\d{2}$/.test(v)) { toastErr("시간 형식이 올바르지 않습니다 (예: 14:30)"); return; }
                  const [hh, mm] = v.split(":").map(Number);
                  if (hh < 10 || hh > 20 || (hh === 20 && mm > 0)) { toastErr("시작 시간은 10:00 ~ 20:00 범위 내여야 합니다."); return; }
                  if (peak && hh < 17) { toastErr("성수기에는 17:00 이후 시작만 가능합니다."); return; }
                  setBlocks(prev => prev.map((x, i) => i === timeBlockIdx ? { ...x, time: formatTimeRange(v, x.sessions_per_day) } : x));
                  setTimePickerOpen(false);
                }}
                style={{flex:1,padding:"12px",border:"none",borderRadius:10,background:"#1a6fc4",color:"#fff",cursor:"pointer",fontFamily:"inherit",fontSize:13.5,fontWeight:700}}
              >적용</button>
            </div>
          </div>
        </div>
      );
    })()}

    {cancelReqId && (
      <div className="modal-bg" onClick={() => !cancelReqSaving && setCancelReqId("")}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
          <h3>취소 요청</h3>
          <div className="modal-sub">취소 요청 후에는 스탭이 확인 후 처리합니다.</div>
          <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#374151", margin:"8px 0 6px" }}>사유 (선택)</label>
          <textarea
            value={cancelReqReason}
            onChange={e => setCancelReqReason(e.target.value)}
            placeholder="취소 사유를 입력해주세요"
            style={{ width:"100%", minHeight:80, padding:"9px 11px", border:"1px solid #e5e7eb", borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical" }}
          />
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:14 }}>
            <button
              type="button"
              onClick={() => setCancelReqId("")}
              disabled={cancelReqSaving}
              style={{ padding:"9px 14px", background:"#fff", color:"#475569", border:"1px solid #cbd5e1", borderRadius:7, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
            >닫기</button>
            <button
              type="button"
              onClick={submitCancelReq}
              disabled={cancelReqSaving}
              style={{ padding:"9px 18px", background:"#dc2626", color:"#fff", border:"none", borderRadius:7, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:cancelReqSaving?0.6:1 }}
            >{cancelReqSaving ? "처리 중..." : "취소요청 확인"}</button>
          </div>
        </div>
      </div>
    )}

    {/* 하루 취소 모달 */}
    {cancelDayOpen && cancelDayLesson && cancelDaySession && (() => {
      const cancelD = new Date(cancelDaySession.session_date + "T00:00:00+08:00");
      const diffMs = cancelD.getTime() - Date.now();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      const isRefundable = diffDays >= 4;
      return (
        <div className="modal-bg" onClick={() => !cancelDaySaving && setCancelDayOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3>🚫 수업 하루 취소 신청</h3>
            <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 14px", margin:"10px 0", fontSize:13 }}>
              <div><strong>학생:</strong> {cancelDayLesson.student_names || "-"}</div>
              <div><strong>선생님:</strong> {cancelDayLesson.tutor_name || "미배정"}</div>
              <div><strong>취소 요청일:</strong> <span style={{ color:"#dc2626", fontWeight:700 }}>{cancelDaySession.session_date}</span> ({cancelDaySession.session_idx}회차)</div>
            </div>
            {!isRefundable && (
              <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderLeft:"4px solid #dc2626", borderRadius:8, padding:"10px 14px", margin:"10px 0", fontSize:12.5, fontWeight:700, color:"#991b1b", lineHeight:1.5 }}>
                ⚠️ 수업일 4일 이내 취소는 <u>환불 및 보강이 불가</u>합니다.<br/>
                해당 수업일의 비용은 차감 처리됩니다.
              </div>
            )}
            {isRefundable && (
              <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, padding:"10px 14px", margin:"10px 0", fontSize:12.5, fontWeight:600, color:"#1e40af", lineHeight:1.5 }}>
                ℹ️ 수업일 4일 전 취소 — 담당자가 확인 후 차감 또는 보강으로 처리해 드립니다.
              </div>
            )}
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#374151", margin:"12px 0 6px" }}>취소 사유 (선택)</label>
            <textarea
              value={cancelDayReason}
              onChange={e => setCancelDayReason(e.target.value)}
              placeholder="취소 사유를 입력해주세요 (예: 아이 컨디션 문제, 일정 변경 등)"
              style={{ width:"100%", minHeight:80, padding:"9px 11px", border:"1px solid #e5e7eb", borderRadius:7, fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box" }}
            />
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:14 }}>
              <button
                type="button"
                onClick={() => setCancelDayOpen(false)}
                disabled={cancelDaySaving}
                style={{ padding:"9px 14px", background:"#fff", color:"#475569", border:"1px solid #cbd5e1", borderRadius:7, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
              >닫기</button>
              <button
                type="button"
                onClick={submitCancelDay}
                disabled={cancelDaySaving}
                style={{ padding:"9px 18px", background:"#dc2626", color:"#fff", border:"none", borderRadius:7, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:cancelDaySaving?0.6:1 }}
              >{cancelDaySaving ? "처리 중..." : "취소 신청"}</button>
            </div>
          </div>
        </div>
      );
    })()}

    {tutorToast && (
      <div role="status" aria-live="polite" style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", background:"#1a1a2e", color:"#fff", padding:"12px 22px", borderRadius:10, fontSize:13.5, fontWeight:700, boxShadow:"0 10px 30px rgba(0,0,0,0.2)", zIndex:200 }}>
        {tutorToast}
      </div>
    )}
  </>);
}
