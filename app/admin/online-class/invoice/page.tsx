"use client";
import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Tutor { id: string; name_display: string; name_en: string }
interface Enrollment {
  id: string; student_name: string; student_name_en: string | null;
  student_birth_year: string | null;
  tutor_id: string | null; tutor: Tutor | null;
  enrollment_type: string; level: string | null;
  days_of_week: string[]; class_time_kr: string | null; class_time_ph: string | null;
  start_date: string; end_date: string | null;
  duration_weeks: number | null; class_duration_weeks: number | null;
  class_period: string; sessions_per_week: number;
  total_sessions: number; pre_sessions: number; post_sessions: number;
  used_sessions: number; remaining_sessions: number | null;
  status: string; notes: string | null;
}
interface Session {
  id: string; enrollment_id: string; session_number: number;
  scheduled_date: string; scheduled_time_kr: string | null; scheduled_time_ph: string | null;
  status: string;
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PERIOD_TITLE: Record<string, string> = {
  pre: "연수 전",
  post: "연수 종료 후",
  ssp: "SSP 과정",
};

function pad2(n: number) { return n < 10 ? "0" + n : "" + n }
function localStr(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}` }
function parseLocal(s: string): Date { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d) }

function parseTimeKr(timeStr: string | null): { h: number; m: number } | null {
  if (!timeStr) return null;
  const m = timeStr.match(/(\d{1,2})[:시](\d{2})/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

function fmt12h(h24: number, m: number): string {
  const pm = h24 >= 12;
  let h12 = h24 % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${pad2(m)} ${pm ? "pm" : "am"}`;
}

function fmtClassTime(timeKr: string | null, lengthMin = 25): string {
  const t = parseTimeKr(timeKr);
  if (!t) return timeKr || "";
  const startH = t.h, startM = t.m;
  let endM = startM + lengthMin;
  let endH = startH;
  while (endM >= 60) { endM -= 60; endH += 1 }
  const pmSuffix = startH >= 12 ? "pm" : "am";
  let sH = startH % 12; if (sH === 0) sH = 12;
  let eH = endH % 12; if (eH === 0) eH = 12;
  return `${sH}:${pad2(startM)}-${eH}:${pad2(endM)} ${pmSuffix}`;
}

function fmtDayLabel(d: Date): string {
  return `${pad2(d.getDate())}-${MONTH_ABBR[d.getMonth()]}`;
}

export default function OnlineInvoicePage() {
  return (
    <Suspense fallback={null}>
      <OnlineInvoiceInner />
    </Suspense>
  );
}

function OnlineInvoiceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const enrollmentId = searchParams.get("enrollment_id");

  const [authed, setAuthed] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  const load = useCallback(async () => {
    if (!enrollmentId) { setLoading(false); return; }
    setLoading(true);
    const res = await fetch(`/api/online-class/enrollments/${enrollmentId}`);
    if (res.ok) {
      const d = await res.json();
      setEnrollment(d.enrollment || null);
      setSessions(d.sessions || []);
    }
    setLoading(false);
  }, [enrollmentId]);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  const sessionMap = useMemo(() => {
    const map: Record<string, Session> = {};
    for (const s of sessions) map[s.scheduled_date] = s;
    return map;
  }, [sessions]);

  const weeks = useMemo(() => {
    if (!enrollment) return [];
    const start = parseLocal(enrollment.start_date);
    const endStr = enrollment.end_date || (() => {
      const last = [...sessions].sort((a,b) => b.scheduled_date.localeCompare(a.scheduled_date))[0];
      return last ? last.scheduled_date : enrollment.start_date;
    })();
    const end = parseLocal(endStr);

    const calStart = new Date(start); calStart.setDate(calStart.getDate() - calStart.getDay());
    const calEnd = new Date(end); calEnd.setDate(calEnd.getDate() + (6 - calEnd.getDay()));

    const out: Array<Array<{ date: Date; dateStr: string; inRange: boolean }>> = [];
    const cur = new Date(calStart);
    while (cur <= calEnd) {
      const week: Array<{ date: Date; dateStr: string; inRange: boolean }> = [];
      for (let i = 0; i < 7; i++) {
        const dt = new Date(cur);
        const inRange = dt >= start && dt <= end;
        week.push({ date: dt, dateStr: localStr(dt), inRange });
        cur.setDate(cur.getDate() + 1);
      }
      out.push(week);
    }
    return out;
  }, [enrollment, sessions]);

  async function savePdf() {
    if (typeof window !== "undefined") window.print();
  }

  async function saveToDb() {
    if (!enrollment) return;
    setSaving(true);
    try {
      const html = document.querySelector(".invoice-wrap")?.outerHTML || "";
      const res = await fetch("/api/online-class/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollment_id: enrollment.id, invoice_html: html }),
      });
      const r = await res.json();
      if (!res.ok) { setMsg({ text: r.error || "저장 실패", type: "err" }); return; }
      setMsg({ text: "✅ 저장되었습니다", type: "ok" });
    } finally {
      setSaving(false);
    }
  }

  if (!authed) return null;
  if (!enrollmentId) return <div style={{ padding: 40 }}>enrollment_id 가 필요합니다.</div>;
  if (loading) return <div style={{ padding: 40 }}>불러오는 중...</div>;
  if (!enrollment) return <div style={{ padding: 40 }}>수강 정보를 찾을 수 없습니다.</div>;

  const periodTitle = PERIOD_TITLE[enrollment.class_period] || "수업 일정";
  const levelText = enrollment.level || "-";
  const nameLine = enrollment.student_name_en
    ? `${enrollment.student_name} (${enrollment.student_name_en.toUpperCase()})`
    : enrollment.student_name;
  const periodLine = enrollment.start_date && enrollment.end_date
    ? `${enrollment.start_date} ~ ${enrollment.end_date}`
    : (enrollment.start_date || "-");
  const availableCount = (enrollment.total_sessions ?? 0) - (enrollment.used_sessions ?? 0);

  return (<>
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;margin:0}
.toolbar{max-width:900px;margin:0 auto;padding:16px 20px 0;display:flex;gap:8px;flex-wrap:wrap}
.toolbar button{padding:8px 14px;border-radius:8px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;border:1px solid #e2e8f0;background:#fff;color:#1a1a2e}
.toolbar button.primary{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.toolbar button.success{background:#16a34a;color:#fff;border-color:#16a34a}
.toolbar button:hover{filter:brightness(0.95)}
.toolbar button:disabled{opacity:0.6;cursor:not-allowed}
.msg{position:fixed;top:16px;left:50%;transform:translateX(-50%);padding:10px 18px;border-radius:10px;font-size:13px;font-weight:700;z-index:100;box-shadow:0 4px 14px rgba(0,0,0,0.15)}
.msg.ok{background:#dcfce7;color:#166534}
.msg.err{background:#fef2f2;color:#dc2626}

.invoice-wrap{max-width:900px;margin:16px auto;padding:28px;background:#fff;font-family:'Noto Sans KR',sans-serif;font-size:12px;color:#1a1a2e;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
.hdr-tbl{width:100%;border-collapse:collapse;margin-bottom:0}
.hdr-tbl td{border:1px solid #333;padding:10px 12px;vertical-align:middle}
.hdr-logo{background:#f8fafc;width:55%}
.hdr-logo .brand{font-family:'Montserrat','Noto Sans KR',sans-serif;font-size:22px;font-weight:900;color:#1a6fc4;letter-spacing:0.5px}
.hdr-logo .sub{font-size:14px;font-weight:700;color:#1a1a2e;margin-top:4px}
.hdr-meta{width:45%;padding:0 !important}
.hdr-meta .row{display:flex;border-bottom:1px solid #333}
.hdr-meta .row:last-child{border-bottom:none}
.hdr-meta .row .k{width:45%;background:#f1f5f9;padding:8px 10px;font-weight:700;font-size:11px;border-right:1px solid #333}
.hdr-meta .row .v{flex:1;padding:8px 10px;font-size:11px}
.info-tbl{width:100%;border-collapse:collapse;margin-bottom:20px;border-top:none}
.info-tbl td{border:1px solid #333;padding:8px 12px}
.info-tbl .k{width:90px;background:#f1f5f9;font-weight:700;font-size:11px}
.info-tbl .v{font-size:12px}

.section-title{font-size:15px;font-weight:800;margin:18px 0 8px;padding:8px 12px;background:#1e40af;color:#fff;border-radius:4px;display:inline-block}

.cal-tbl{width:100%;border-collapse:collapse;table-layout:fixed}
.cal-tbl th{border:1px solid #333;padding:6px 4px;background:#1e40af;color:#fff;font-size:12px;font-weight:700;text-align:center}
.cal-tbl th.sun{background:#b91c1c}
.cal-tbl th.sat{background:#1d4ed8}
.cal-tbl td{border:1px solid #333;padding:0;vertical-align:top;height:62px;width:14.2857%}
.cal-tbl td .d{padding:4px 6px;font-size:11px;font-weight:700;background:#f1f5f9;border-bottom:1px solid #cbd5e1;color:#1a1a2e}
.cal-tbl td.out .d{color:#94a3b8;background:#f8fafc}
.cal-tbl td .t{padding:10px 6px;font-size:11px;text-align:center;color:#1a1a2e}
.cal-tbl td.holiday{background:#fef9c3}
.cal-tbl td.holiday .t{color:#92400e;font-weight:700}
.cal-tbl td.makeup{background:#fff7ed}
.cal-tbl td.makeup .t{color:#c2410c;font-weight:700}
.cal-tbl td.attended .t{color:#166534;font-weight:700}

.rules{margin-top:22px;padding:14px 16px;background:#fef9c3;border:1px solid #fde047;border-radius:6px;font-size:11.5px;line-height:1.75}
.rules .title{font-weight:800;text-align:center;font-size:13px;color:#92400e;margin-bottom:6px}
.rules .warn{text-align:center;font-size:11px;color:#b45309;margin-bottom:8px}
.rules ul{margin:0;padding:0;list-style:none}
.rules li{padding:2px 0;color:#1a1a2e}
.rules li:before{content:'* ';color:#92400e;font-weight:900}
.rules .example{margin-left:14px;color:#6b7c93;font-size:11px}

@media print {
  .no-print{display:none !important}
  body{margin:0;background:#fff}
  .invoice-wrap{box-shadow:none;margin:0;padding:16px;max-width:100%}
  @page{size:A4;margin:12mm}
}
    `}</style>

    {msg && <div className={`msg ${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

    <div className="toolbar no-print">
      <button onClick={() => router.push("/admin/online-class")}>← 목록으로</button>
      <button className="primary" onClick={savePdf}>🖨️ PDF 출력</button>
      <button className="success" onClick={saveToDb} disabled={saving}>💾 {saving ? "저장중..." : "저장"}</button>
    </div>

    <div className="invoice-wrap">
      <table className="hdr-tbl">
        <tbody>
          <tr>
            <td className="hdr-logo">
              <div className="brand">DREAM ACADEMY</div>
              <div className="sub">Online Class</div>
            </td>
            <td className="hdr-meta">
              <div className="row"><div className="k">연수 등록 기간</div><div className="v">{periodLine}</div></div>
              <div className="row"><div className="k">수업 가능 기간</div><div className="v">{periodLine}</div></div>
              <div className="row"><div className="k">화상영어 가능 횟수</div><div className="v">총 {enrollment.total_sessions}회 / 잔여 {availableCount}회</div></div>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="info-tbl">
        <tbody>
          <tr>
            <td className="k">NAME</td>
            <td className="v" colSpan={3}>{nameLine}</td>
          </tr>
          <tr>
            <td className="k">CLASS</td>
            <td className="v" colSpan={3}>Online Class {enrollment.tutor?.name_display ? `· ${enrollment.tutor.name_display}` : ""}</td>
          </tr>
          <tr>
            <td className="k">LEVEL</td>
            <td className="v" colSpan={3}>{levelText}</td>
          </tr>
        </tbody>
      </table>

      <div className="section-title">{periodTitle}</div>
      <table className="cal-tbl">
        <thead>
          <tr>
            {WEEKDAYS.map((w, i) => (
              <th key={w} className={i === 0 ? "sun" : i === 6 ? "sat" : ""}>{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map(cell => {
                const s = sessionMap[cell.dateStr];
                const classes: string[] = [];
                if (!cell.inRange) classes.push("out");
                let timeLabel = "";
                if (s) {
                  if (s.status === "cancelled") { classes.push("holiday"); timeLabel = "휴강"; }
                  else if (s.status === "makeup") { classes.push("makeup"); timeLabel = "보강"; }
                  else if (s.status === "attended") { classes.push("attended"); timeLabel = fmtClassTime(s.scheduled_time_kr || enrollment.class_time_kr); }
                  else if (s.status === "absent" || s.status === "no_show") { classes.push("holiday"); timeLabel = "결석"; }
                  else { timeLabel = fmtClassTime(s.scheduled_time_kr || enrollment.class_time_kr); }
                }
                return (
                  <td key={cell.dateStr} className={classes.join(" ")}>
                    <div className="d">{cell.inRange ? fmtDayLabel(cell.date) : cell.date.getDate()}</div>
                    {timeLabel && <div className="t">{timeLabel}</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rules">
        <div className="title">★ 화상 영어 수업 규정 안내 ★</div>
        <div className="warn">규정 미 확인으로 인한 불이익은 센터에서 책임지지 않습니다. 꼭 !! 확인 해주세요.</div>
        <ul>
          <li>최소 4일 전 인폼 시 회차 차감 없이 변경 및 취소 가능 / 그 외의 변경 및 취소는 회차 차감, 변경 및 환불 불가</li>
          <li className="example">(예시) 금요일 수업 변경은 월요일 자정까지 완료해야 함</li>
          <li>별도의 연락이 없이 미접속시 회차 차감</li>
        </ul>
      </div>
    </div>
  </>);
}
