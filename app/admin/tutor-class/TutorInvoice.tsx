"use client";
import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { stripTimeSuffix } from "@/lib/scheduleBlocks";

interface Lesson {
  id: string; created_at: string;
  house_or_reserver: string; student_names: string; student_ages: string | null;
  tutor_id: string | null;
  class_type: string; sessions_per_day: number | null; hourly_rate: number;
  start_date: string; end_date: string;
  class_days: string[] | null; class_time: string | null; confirmed_time: string | null;
  overall_level: string | null;
  total_sessions: number | null; total_amount: number | null;
  status: string;
  skip_dates: string[] | null;
  child_personality: string | null;
  class_focus_arr: string[] | null;
  class_style: string | null;
  time_overrides?: Record<string, string> | null;
}
interface SessionRow {
  id: string; lesson_id: string;
  session_date: string; session_idx: number;
  status: string;
}

const DAY_KR: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };

const DAY_SHORT: Record<string, string> = {
  mon:"M", tue:"T", wed:"W", thu:"Th", fri:"F", sat:"Sa", sun:"Su",
  "월":"M", "화":"T", "수":"W", "목":"Th", "금":"F", "토":"Sa", "일":"Su",
};

const LEVEL_LABELS: Record<string, { ko: string; en: string }> = {
  zero:         { ko: "제로 베이스(기초) - 영어를 처음 접함", en: "Zero-Based - New to English" },
  beginner:     { ko: "비기너 - 기초 영어 학습",              en: "Beginner - Basic English" },
  intermediate: { ko: "미디엄 - 중간 영어",                    en: "Medium - Intermediate English" },
  advanced:     { ko: "어드밴스 - 고급 영어",                  en: "Advanced - Advanced English" },
};

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function fmtMD(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function fmtDayMon(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getDate()}-${EN_MONTHS[d.getMonth()]}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function getWeeksBetween(startDate: string, endDate: string): Array<Array<string | null>> {
  if (!startDate || !endDate) return [];
  const s = new Date(startDate + "T00:00:00");
  const e = new Date(endDate + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return [];
  const weekStart = new Date(s);
  weekStart.setDate(s.getDate() - s.getDay());
  const weeks: Array<Array<string | null>> = [];
  const cur = new Date(weekStart);
  while (cur <= e) {
    const week: Array<string | null> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cur);
      week.push(d >= s && d <= e ? fmtDate(d) : null);
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function parseSessionTime(preferredTime: string | null | undefined): string {
  if (!preferredTime) return "tutor time";
  const trimmed = preferredTime.trim();
  const matches = trimmed.match(/(\d+)\s*시(?:\s*(\d+)\s*분)?[~\-\s]*(\d+)\s*시(?:\s*(\d+)\s*분)?/);
  if (!matches) return trimmed;
  const isAfternoon = /오후|저녁|밤/.test(trimmed);
  const isMorning = /오전|아침/.test(trimmed);
  const sHr = Number(matches[1]);
  const sMin = matches[2] || "00";
  const eHr = Number(matches[3]);
  const eMin = matches[4] || "00";
  const ampm = (h: number) => {
    if (isAfternoon && h < 12) return "pm";
    if (isMorning && h < 12) return "am";
    return h >= 12 ? "pm" : "am";
  };
  return `${sHr}:${sMin}${ampm(sHr)}-${eHr}:${eMin}${ampm(eHr)}`;
}

function filenameSafe(s: string): string {
  return (s || "lesson").replace(/[\\/:"*?<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 80);
}

export default function TutorInvoice({ lessonId: propLessonId, englishMode }: { lessonId?: string; englishMode?: boolean } = {}) {
  const searchParams = useSearchParams();
  const urlLessonId = propLessonId || searchParams?.get("lesson_id") || "";
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedId, setSelectedId] = useState<string>(urlLessonId);

  useEffect(() => {
    if (urlLessonId) setSelectedId(urlLessonId);
  }, [urlLessonId]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [tutorReq, setTutorReq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    // 1) tutor_lessons + 2) lesson 미생성된 confirmed tutor_requests 합성 → 함께 표시
    const [lRes, rRes] = await Promise.all([
      supabase.from("tutor_lessons").select("*")
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false }),
      supabase.from("tutor_requests").select("*")
        .neq("status", "cancelled")
        .order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    if (lRes.error) console.error("수업 목록 로드 실패:", lRes.error);
    if (rRes.error) console.error("confirmed 신청 로드 실패:", rRes.error);

    const lessonList = (lRes.data || []) as Lesson[];
    const reqList = (rRes.data || []) as any[];

    // lesson과 이미 연결된 request_id 추출 (admin_memo의 "request_id: XXX" 패턴)
    const linkedReqIds = new Set<string>();
    for (const l of lessonList) {
      const m = /request_id:\s*([a-f0-9-]+)/i.exec((l as any).admin_memo || "");
      if (m) linkedReqIds.add(m[1]);
    }
    // 연결 안 된 confirmed 신청을 합성 Lesson으로 변환
    const synthetic: Lesson[] = reqList
      .filter(r => !linkedReqIds.has(r.id))
      .map(r => ({
        id: `req:${r.id}`,
        created_at: r.created_at,
        house_or_reserver: r.guest_name || "",
        student_names: [r.student_name_kr, r.student_name_en].filter(Boolean).join(" / ") || "",
        student_ages: r.student_age || null,
        tutor_id: r.assigned_tutor_id || null,
        class_type: r.class_type || "",
        sessions_per_day: r.sessions_per_day || 1,
        hourly_rate: (r as any).price_per_session || ((r.class_type || "").includes("1:2") ? 350 : 300),
        start_date: r.start_date || "",
        end_date: r.end_date || "",
        class_days: (r.preferred_days || "").split(",").map((s: string) => s.trim()).filter(Boolean),
        class_time: r.preferred_time || null,
        confirmed_time: null,
        overall_level: r.level_english || null,
        total_sessions: r.total_sessions || null,
        total_amount: r.total_amount || null,
        status: "active",
      })) as Lesson[];

    const list: Lesson[] = [...lessonList, ...synthetic];
    setLessons(list);
    if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
  }, [selectedId]);

  useEffect(() => { loadLessons(); }, [loadLessons]);

  useEffect(() => {
    if (!selectedId) { setSessions([]); setTutorReq(null); return; }
    let cancelled = false;
    (async () => {
      // 합성 lesson (req:UUID) 은 tutor_lesson_sessions 행이 없음 → 조회 스킵
      if (selectedId.startsWith("req:")) {
        setSessions([]);
      } else {
        const { data, error } = await supabase
          .from("tutor_lesson_sessions")
          .select("*")
          .eq("lesson_id", selectedId)
          .order("session_date", { ascending: true });
        if (cancelled) return;
        if (error) {
          console.error("회차 로드 실패:", error);
          setSessions([]);
        } else {
          setSessions((data || []) as SessionRow[]);
        }
      }
      // 연결된 tutor_request 조회 (엄마 요청사항용)
      const currentLesson = lessons.find(l => l.id === selectedId);
      const reqId = selectedId.startsWith("req:")
        ? selectedId.replace("req:", "")
        : (() => {
            const m = /request_id:\s*([a-f0-9-]+)/i.exec((currentLesson as any)?.admin_memo || "");
            return m ? m[1] : null;
          })();
      if (reqId) {
        const { data: rq } = await supabase.from("tutor_requests").select("*").eq("id", reqId).maybeSingle();
        if (!cancelled) setTutorReq(rq || null);
      } else {
        if (!cancelled) setTutorReq(null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, lessons]);

  const lesson = useMemo(() => lessons.find(l => l.id === selectedId) || null, [lessons, selectedId]);

  const sessionByDate = useMemo(() => {
    const map = new Map<string, SessionRow>();
    for (const s of sessions) map.set(s.session_date, s);
    return map;
  }, [sessions]);

  const weeks = useMemo(
    () => (lesson ? getWeeksBetween(lesson.start_date, lesson.end_date) : []),
    [lesson],
  );

  const skipDates = useMemo(
    () => Array.isArray((lesson as any)?.skip_dates) ? (lesson as any).skip_dates as string[] : [],
    [lesson]
  );

  const DAY_CODE_INV: Record<string, number> = {
    sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6,
    "일":0, "월":1, "화":2, "수":3, "목":4, "금":5, "토":6,
  };

  const classSession = lesson?.sessions_per_day || 1;
  const classFee = lesson?.hourly_rate || 0;

  const days = (() => {
    // 실제 출결 세션이 있으면 그 수 사용
    if (sessions.length > 0) return sessions.length;
    // 없으면 class_days 기반으로 계산 (skip_dates 제외)
    let count = 0;
    for (const week of weeks) {
      for (const date of week) {
        if (!date) continue;
        if (skipDates.includes(date)) continue;
        const dow = new Date(date + "T00:00:00").getDay();
        if (Array.isArray(lesson?.class_days) && lesson.class_days.some(
          (d: string) => DAY_CODE_INV[String(d).trim()] === dow
        )) count++;
      }
    }
    return count || lesson?.total_sessions || 0;
  })();

  const total = classFee * classSession * days;
  const levelInfo = lesson?.overall_level ? LEVEL_LABELS[lesson.overall_level] : null;
  const sessionTime = parseSessionTime(stripTimeSuffix(lesson?.confirmed_time || lesson?.class_time));

  // 출결(attendance) 페이지와 동일 우선순위: 날짜 override → 요일 override → 기본
  const _KR_DOW = ['일','월','화','수','목','금','토'];
  const resolveTimeForDate = (dateStr: string | null | undefined): string => {
    if (!dateStr || !lesson) return sessionTime;
    const ov = lesson.time_overrides || undefined;
    const dow = new Date(dateStr + 'T00:00:00').getDay();
    const krKey = _KR_DOW[dow];
    const raw = (ov && (ov[dateStr] || ov[krKey])) || lesson.confirmed_time || lesson.class_time || '';
    return parseSessionTime(stripTimeSuffix(raw));
  };

  const optionLabel = (l: Lesson) => {
    const typeMatch = (l.class_type || "").match(/1\s*[:：]\s*[12]/);
    const typeBase = typeMatch ? typeMatch[0].replace(/\s+/g, "") : (l.class_type || "-");
    const t = l.sessions_per_day === 2 ? "2T" : "1T";
    const isSynthetic = String(l.id).startsWith("req:");
    const tag = isSynthetic ? (englishMode ? " · Request-based" : " · 신청서 기반") : "";
    if (englishMode) {
      return `${l.student_names.split("/").reverse().join("/ ").trim()} · ${l.class_type} · ${l.start_date?.slice(5)}~${l.end_date?.slice(5)}${tag}`;
    }
    return `${l.house_or_reserver} · ${l.student_names} (${typeBase} ${t}, ${fmtMD(l.start_date)}~${fmtMD(l.end_date)})${tag}`;
  };

  // A4 1페이지에 맞춰 scale-to-fit 적용 후 인쇄
  function handlePrint() {
    const el = invoiceRef.current;
    if (!el) { window.print(); return; }
    const usableH = 1040; // A4 portrait, 8mm 여백 기준 가용 높이(px) 근사
    const naturalH = el.scrollHeight;
    const naturalW = el.offsetWidth;
    const s = Math.min(1, usableH / Math.max(1, naturalH));
    const prevTransform = el.style.transform;
    const prevOrigin = el.style.transformOrigin;
    const prevWidth = el.style.width;
    if (s < 1) {
      el.style.transformOrigin = "top left";
      el.style.transform = `scale(${s})`;
      // 가로 폭 보정 — scale 축소만큼 width를 늘려서 페이지 가로 채움
      el.style.width = `${Math.round(naturalW / s)}px`;
    }
    const restore = () => {
      el.style.transform = prevTransform;
      el.style.transformOrigin = prevOrigin;
      el.style.width = prevWidth;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    // 안전망: 일부 브라우저는 afterprint 늦거나 미발화
    setTimeout(restore, 4000);
    window.print();
  }

  async function saveAsImage() {
    if (!invoiceRef.current || !lesson) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const base = filenameSafe(lesson.student_names);
      link.download = `TutorInfo_${base}_${lesson.start_date || todayStr()}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("이미지 저장 실패:", e);
      alert("이미지 저장 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (<>
    <style>{`
.ti-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}
.ti-bar select{flex:1;min-width:280px;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;background:#fff;outline:none}
.ti-bar select:focus{border-color:#1a6fc4}
.ti-btn{padding:10px 16px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 120ms;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.ti-btn-print{background:#fff;color:#1a6fc4;border:1px solid #1a6fc4}
.ti-btn-print:hover:not(:disabled){background:#eff6ff}
.ti-btn-print:disabled{color:#cbd5e1;border-color:#e2e8f0;cursor:not-allowed}
.ti-btn-img{background:#1a6fc4;color:#fff}
.ti-btn-img:hover:not(:disabled){background:#155aa0}
.ti-btn-img:disabled{background:#cbd5e1;cursor:not-allowed}

.ti-empty{background:#fff;border-radius:14px;padding:56px 28px;box-shadow:0 2px 12px rgba(0,0,0,0.05);border:1px solid #f3f4f6;text-align:center;color:#94a3b8;font-size:14px;line-height:1.8}

.tutor-info-container{background:#fff;border-radius:14px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.05);border:1px solid #f3f4f6;max-width:960px;margin:0 auto;color:#1a1a2e}

.ti-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:24px}
.ti-logo{display:flex;flex-direction:column;line-height:1}
.ti-logo .dream{color:#3b82f6;font-size:32px;font-weight:900;letter-spacing:-0.02em}
.ti-logo .academy{color:#eab308;font-size:32px;font-weight:900;letter-spacing:-0.02em;margin-top:-2px}
.ti-logo .tag{color:#94a3b8;font-size:11px;margin-top:6px;font-weight:500}
.ti-title{font-size:24px;font-weight:800;letter-spacing:0.06em;color:#1a1a2e}

.ti-info{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}
.ti-info table{width:100%;border-collapse:collapse;border:1px solid #000;font-size:12.5px}
.ti-info td{border:1px solid #000;padding:8px 10px;vertical-align:top}
.ti-info td.k{background:#e2e8f0;font-weight:800;width:120px;white-space:nowrap;letter-spacing:0.02em}
.ti-info td.v{background:#fff;font-weight:600;line-height:1.5;word-break:break-word}
.ti-info td.total{background:#fef9c3;font-weight:900}
@media(max-width:640px){.ti-info{grid-template-columns:1fr}}

.ti-wtable{width:100%;border-collapse:collapse;border:1px solid #000;font-size:11px;margin-bottom:24px}
.ti-wtable th{background:#fef9c3;border:1px solid #000;padding:6px 4px;font-weight:800;text-align:center;letter-spacing:0.04em}
.ti-wtable td{border:1px solid #000;padding:4px;text-align:center;vertical-align:middle;width:14.285%}
.ti-wtable tr.date-row td{height:26px;font-size:10.5px;color:#475569;font-weight:600}
.ti-wtable tr.content-row td{height:56px;padding:3px}
.ti-wsess{background:#dbeafe;padding:6px 3px;border-radius:5px;font-size:10.5px;line-height:1.35;color:#1e3a8a;font-weight:700}
.ti-wsess .ct{font-weight:800}
.ti-wsess .tm{color:#1e40af;margin-top:2px;font-size:10px;font-weight:600}

.ti-rules{font-size:13px;line-height:1.65;color:#1a1a2e}
.ti-rules .title{font-size:15px;font-weight:800;margin:0 0 8px;text-align:center}
.ti-rules .warn{font-weight:800;margin:0 0 12px}
.ti-rules .red{color:#dc2626;margin:0 0 6px}
.ti-rules .gray{color:#64748b;margin:0 0 4px}
.ti-rules p{margin:0 0 6px}

@media print{
  @page { size: A4 portrait; margin: 8mm; }
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{background:#fff!important;margin:0}
  .no-print{display:none!important}
  .tutor-info-container{box-shadow:none!important;padding:0!important;max-width:100%;border-radius:0;border:none}
  .tc-tabs,.tc-top{display:none!important}
  /* 페이지 분할 방지 */
  .tutor-info-container, table, tr { break-inside: avoid; page-break-inside: avoid; }
  /* 컴팩트화 */
  .ti-title{font-size:18px}
  .ti-head{margin-bottom:14px}
  .ti-info{margin-bottom:14px}
  .ti-info table td{padding:3px 6px;font-size:11px}
  .ti-wtable{font-size:9px;margin-bottom:14px}
  .ti-wtable th{padding:3px 2px}
  .ti-wtable td{padding:2px}
  .ti-wtable tr.date-row td{height:18px;font-size:9px}
  .ti-wtable tr.content-row td{height:38px;padding:2px}
  .ti-wsess{font-size:8px;padding:2px;line-height:1.2}
  .ti-wsess .tm{font-size:8px;margin-top:1px}
  .ti-rules{font-size:10px;line-height:1.45}
  .ti-rules .title{font-size:12px;margin:0 0 4px}
  .ti-rules p{margin:0 0 3px}
}
@media(max-width:700px){
  .tutor-info-container{padding:20px}
  .ti-head{flex-direction:column;align-items:flex-start;gap:10px}
  .ti-title{font-size:20px}
  .ti-wtable{font-size:10px}
  .ti-wsess{font-size:9.5px;padding:4px 2px}
}
    `}</style>

    <div className="ti-bar no-print">
      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        disabled={loading || lessons.length === 0}
        aria-label="수강생 선택"
      >
        {lessons.length === 0 ? (
          <option value="">{loading ? "로딩 중..." : "수업 없음"}</option>
        ) : (
          lessons.map(l => (
            <option key={l.id} value={l.id}>{optionLabel(l)}</option>
          ))
        )}
      </select>
      <button className="ti-btn ti-btn-print" onClick={handlePrint} disabled={!lesson}>
        📄 {englishMode ? "Print/PDF" : "인쇄/PDF"}
      </button>
      <button className="ti-btn ti-btn-img" onClick={saveAsImage} disabled={!lesson || saving}>
        {saving ? (englishMode ? "Saving..." : "저장 중...") : `🖼️ ${englishMode ? "Save Image" : "이미지 저장"}`}
      </button>
    </div>

    {loading ? (
      <div className="ti-empty">로딩 중...</div>
    ) : !lesson ? (
      <div className="ti-empty">확정된 수업이 없습니다.<br />수강생 목록 탭에서 신청을 확정 처리해주세요.</div>
    ) : (
      <div className="tutor-info-container" ref={invoiceRef}>
        <div className="ti-head">
          <div className="ti-logo">
            <span className="dream">Dream</span>
            <span className="academy">Academy</span>
            <span className="tag">by Dream company</span>
          </div>
          <div className="ti-title">TUTOR INFORMATION</div>
        </div>

        <div className="ti-info">
          <table>
            <tbody>
              <tr>
                <td className="k">NAME</td>
                <td className="v">{lesson.student_names || "-"}</td>
              </tr>
              <tr>
                <td className="k">CLASS</td>
                <td className="v">{lesson.class_type} TUTOR</td>
              </tr>
              <tr>
                <td className="k">LEVEL</td>
                <td className="v">
                  {levelInfo ? (
                    <>
                      {levelInfo.ko}<br />
                      <span style={{ color: "#64748b", fontSize: 11.5 }}>{levelInfo.en}</span>
                    </>
                  ) : (lesson.overall_level || "-")}
                </td>
              </tr>
            </tbody>
          </table>

          <table>
            <tbody>
              <tr>
                <td className="k">Class fee</td>
                <td className="v">₱{classFee.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="k">class session</td>
                <td className="v">{classSession === 2 ? "2 sessions (100 min)" : "1 session (50 min)"}</td>
              </tr>
              <tr>
                <td className="k">days</td>
                <td className="v">
                  {days}
                  {Array.isArray(lesson?.class_days) && lesson.class_days.length > 0 && (
                    <span style={{marginLeft:6,fontSize:11,color:"#6b7280"}}>
                      ({lesson.class_days.map((d:string) => DAY_SHORT[d] || DAY_SHORT[d.toLowerCase()] || d).join("/")})
                    </span>
                  )}
                  {skipDates.length > 0 && (
                    <span style={{marginLeft:6,fontSize:11,color:"#dc2626"}}>
                      (-{skipDates.length} cancelled)
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="k">Total</td>
                <td className="v total">₱{total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="ti-wtable">
          <thead>
            <tr>
              <th>SUN</th><th>MON</th><th>TUE</th><th>WED</th><th>THU</th><th>FRI</th><th>SAT</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <Fragment key={`w-${wi}`}>
                <tr className="date-row">
                  {week.map((date, di) => (
                    <td key={`d-${wi}-${di}`}>{date ? fmtDayMon(date) : ""}</td>
                  ))}
                </tr>
                <tr className="content-row">
                  {week.map((date, di) => {
                    const s = date ? sessionByDate.get(date) : null;
                    const DAY_CODE: Record<string, number> = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6, "일":0, "월":1, "화":2, "수":3, "목":4, "금":5, "토":6 };
                    let scheduled = false;
                    if (date && !s && Array.isArray(lesson.class_days) && lesson.class_days.length > 0) {
                      const dow = new Date(date + "T00:00:00").getDay();
                      scheduled = lesson.class_days.some(d => DAY_CODE[String(d).trim()] === dow);
                    }
                    const isSkipped = date ? skipDates.includes(date) : false;
                    const show = (!!s || scheduled) && !isSkipped;
                    const blockBg = lesson.class_type === "1:2" ? "#ede9fe" : "#dbeafe";
                    return (
                      <td key={`c-${wi}-${di}`}>
                        {isSkipped ? (
                          <div className="ti-wsess" style={{background:"#fee2e2",opacity:0.7}}>
                            <div className="ct" style={{textDecoration:"line-through",color:"#dc2626"}}>취소</div>
                          </div>
                        ) : show ? (
                          <div className="ti-wsess" style={{ background: blockBg }} title={s ? `${date} · ${s.session_idx}회차 · ${s.status}` : `${date} · 예정`}>
                            <div className="ct">{lesson.class_type} tutor</div>
                            <div className="tm">{resolveTimeForDate(date)}</div>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>

        {tutorReq && (tutorReq.child_personality || tutorReq.class_style || (tutorReq.class_focus_arr || []).length > 0) && (
          <table className="ti-info" style={{marginTop:12}}>
            <tbody>
              {tutorReq.class_style && (
                <tr><td className="k">Class Style</td><td className="v">{tutorReq.class_style}</td></tr>
              )}
              {(tutorReq.class_focus_arr || []).length > 0 && (
                <tr><td className="k">Focus</td><td className="v">{(tutorReq.class_focus_arr || []).join(", ")}</td></tr>
              )}
              {tutorReq.child_personality && (
                <tr><td className="k">Notes</td><td className="v">{tutorReq.child_personality}</td></tr>
              )}
            </tbody>
          </table>
        )}

        <div className="ti-rules">
          <p className="title">★ {englishMode ? "Tutor Class Rules" : "튜터수업 규정 안내"} ★</p>
          {englishMode ? (
            <>
              <p className="warn">Please read the rules carefully. Any violations are the sole responsibility of the guest.</p>
              <p className="red">Changes/cancellations allowed 4+ days before class. After that, no refunds or changes.</p>
              <p>* Same-day no-show and 2+ same-day changes: class forfeited</p>
              <p style={{ marginTop: 10 }}>* Tutor change requests must be made before 5PM</p>
              <p className="gray">(e.g.) For Friday class cancellation: before Monday 5PM = possible / after Monday 5PM = not possible</p>
              <p className="gray">5PM-after requests apply from 3 days later; changes after 5PM not applicable</p>
            </>
          ) : (
            <>
              <p className="warn">규정 미 확인으로 인한 불이익은 센터에서 책임지지 않습니다. 꼭 !! 확인 해주세요.</p>
              <p className="red">최소 4일 전 인폼 시 변경 및 취소 가능 / 그 외의 변경 및 취소는 회차 차감, 변경 및 환불 불가</p>
              <p>* 당일 노쇼 및 당일 변경 2회 이상 시 튜터수업 불가</p>
              <p style={{ marginTop: 10 }}>* 튜터 변경 및 취소 문의는 5시 이전 가능</p>
              <p className="gray">(예시) 금요일 수업 취소 원할 시, 월요일 5시 이전: 변경 및 취소 가능 / 월요일 5시 이후: 변경 및 취소 불가</p>
              <p className="gray">5시 이후 문의시, 3일 전으로 적용되어, 변경 및 취소 불가</p>
            </>
          )}
        </div>
      </div>
    )}
  </>);
}
