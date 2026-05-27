"use client";
import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
}
interface SessionRow {
  id: string; lesson_id: string;
  session_date: string; session_idx: number;
  status: string;
}

const DAY_KR: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토", sun: "일" };

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

export default function TutorInvoice() {
  const searchParams = useSearchParams();
  const urlLessonId = searchParams?.get("lesson_id") || "";
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedId, setSelectedId] = useState<string>(urlLessonId);

  useEffect(() => {
    if (urlLessonId) setSelectedId(urlLessonId);
  }, [urlLessonId]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tutor_lessons")
      .select("*")
      .in("status", ["active", "completed"])
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      console.error("수업 목록 로드 실패:", error);
      return;
    }
    const list = (data || []) as Lesson[];
    setLessons(list);
    if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
  }, [selectedId]);

  useEffect(() => { loadLessons(); }, [loadLessons]);

  useEffect(() => {
    if (!selectedId) { setSessions([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("tutor_lesson_sessions")
        .select("*")
        .eq("lesson_id", selectedId)
        .order("session_date", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("회차 로드 실패:", error);
        setSessions([]);
        return;
      }
      setSessions((data || []) as SessionRow[]);
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

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

  const days = sessions.length;
  const classSession = lesson?.sessions_per_day || 1;
  const classFee = lesson?.hourly_rate || 0;
  const total = classFee * classSession * days;
  const levelInfo = lesson?.overall_level ? LEVEL_LABELS[lesson.overall_level] : null;
  const sessionTime = parseSessionTime(lesson?.confirmed_time || lesson?.class_time);

  const optionLabel = (l: Lesson) => {
    const typeMatch = (l.class_type || "").match(/1\s*[:：]\s*[12]/);
    const typeBase = typeMatch ? typeMatch[0].replace(/\s+/g, "") : (l.class_type || "-");
    const t = l.sessions_per_day === 2 ? "2T" : "1T";
    return `${l.house_or_reserver} · ${l.student_names} (${typeBase} ${t}, ${fmtMD(l.start_date)}~${fmtMD(l.end_date)})`;
  };

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
  body{background:#fff!important;margin:0}
  .no-print{display:none!important}
  .tutor-info-container{box-shadow:none;padding:20px;max-width:100%;border-radius:0}
  .tc-tabs,.tc-top{display:none!important}
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
      <button className="ti-btn ti-btn-print" onClick={() => window.print()} disabled={!lesson}>
        📄 인쇄/PDF
      </button>
      <button className="ti-btn ti-btn-img" onClick={saveAsImage} disabled={!lesson || saving}>
        {saving ? "저장 중..." : "🖼️ 이미지 저장"}
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
                <td className="v">{classSession}</td>
              </tr>
              <tr>
                <td className="k">days</td>
                <td className="v">{days}</td>
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
                    const show = !!s || scheduled;
                    const blockBg = lesson.class_type === "1:2" ? "#ede9fe" : "#dbeafe";
                    return (
                      <td key={`c-${wi}-${di}`}>
                        {show ? (
                          <div className="ti-wsess" style={{ background: blockBg }} title={s ? `${date} · ${s.session_idx}회차 · ${s.status}` : `${date} · 예정`}>
                            <div className="ct">{lesson.class_type} tutor</div>
                            <div className="tm">{sessionTime}</div>
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

        <div className="ti-rules">
          <p className="title">★ 튜터수업 규정 안내 ★</p>
          <p className="warn">규정 미 확인으로 인한 불이익은 센터에서 책임지지 않습니다. 꼭 !! 확인 해주세요.</p>
          <p className="red">최소 4일 전 인폼 시 변경 및 취소 가능 / 그 외의 변경 및 취소는 회차 차감, 변경 및 환불 불가</p>
          <p>* 당일 노쇼 및 당일 변경 2회 이상 시 튜터수업 불가</p>
          <p style={{ marginTop: 10 }}>* 튜터 변경 및 취소 문의는 5시 이전 가능</p>
          <p className="gray">(예시) 금요일 수업 취소 원할 시, 월요일 5시 이전: 변경 및 취소 가능 / 월요일 5시 이후: 변경 및 취소 불가</p>
          <p className="gray">5시 이후 문의시, 3일 전으로 적용되어, 변경 및 취소 불가</p>
        </div>
      </div>
    )}
  </>);
}
