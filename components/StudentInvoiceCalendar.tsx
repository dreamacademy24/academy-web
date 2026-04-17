"use client";
import { useEffect, useState, useMemo } from "react";

interface Enrollment {
  id: string;
  student_name: string;
  student_name_en: string | null;
  tutor?: { name_display: string; name_en: string } | null;
  class_time_kr: string | null;
  class_period: string | null;
  start_date: string | null;
  end_date: string | null;
  total_sessions: number | null;
  used_sessions: number | null;
  notes: string | null;
}
interface Session {
  id: string;
  scheduled_date: string;
  scheduled_time_kr: string | null;
  status: string;
  session_number: number;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  scheduled: { bg: "#f1f5f9", fg: "#64748b", label: "-" },
  attended:  { bg: "#dcfce7", fg: "#166534", label: "✓" },
  no_show:   { bg: "#fef2f2", fg: "#dc2626", label: "✗" },
  absent:    { bg: "#fef2f2", fg: "#dc2626", label: "✗" },
  cancelled: { bg: "#fef2f2", fg: "#dc2626", label: "✗" },
  makeup:    { bg: "#fef9c3", fg: "#92400e", label: "△" },
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD_HEAD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StudentInvoiceCalendar({ enrollmentId, onClose }: { enrollmentId: string; onClose: () => void }) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/online-class/enrollments/${enrollmentId}`);
      if (res.ok) {
        const d = await res.json();
        setEnrollment(d.enrollment || null);
        setSessions(d.sessions || []);
      }
      setLoading(false);
    })();
  }, [enrollmentId]);

  const sessionByDate = useMemo(() => {
    const m: Record<string, Session> = {};
    sessions.forEach(s => { m[s.scheduled_date] = s; });
    return m;
  }, [sessions]);

  const months = useMemo(() => {
    if (!enrollment?.start_date || !enrollment?.end_date) return [];
    const start = new Date(enrollment.start_date + "T00:00:00");
    const end = new Date(enrollment.end_date + "T00:00:00");
    const out: Array<{ year: number; month: number; cells: Array<{ date: Date | null; inRange: boolean }> }> = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const y = cur.getFullYear(), m = cur.getMonth();
      const first = new Date(y, m, 1);
      const startWd = first.getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const cells: Array<{ date: Date | null; inRange: boolean }> = [];
      for (let i = 0; i < startWd; i++) cells.push({ date: null, inRange: false });
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(y, m, d);
        cells.push({ date: dt, inRange: dt >= start && dt <= end });
      }
      while (cells.length % 7 !== 0) cells.push({ date: null, inRange: false });
      out.push({ year: y, month: m, cells });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }, [enrollment]);

  function fmtD(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const total = enrollment?.total_sessions || 0;
  const used = enrollment?.used_sessions || 0;
  const remaining = Math.max(0, total - used);

  return (<>
    <style>{`
.sic-bg{position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:flex-start;justify-content:center;z-index:500;padding:32px 16px;overflow-y:auto}
.sic-modal{background:#fff;border-radius:14px;max-width:1100px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.sic-head{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid #e2e8f0}
.sic-head h2{font-size:18px;font-weight:800}
.sic-actions{display:flex;gap:8px}
.sic-btn{padding:8px 14px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;color:#334155;font-family:inherit}
.sic-btn:hover{background:#f8fafc}
.sic-btn.close{background:#f1f5f9}
.sic-body{padding:24px;max-height:70vh;overflow-y:auto}
.sic-info{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.sic-info .k{font-size:11px;font-weight:700;color:#64748b;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px}
.sic-info .v{font-size:14px;font-weight:700;color:#1a1a2e}
.sic-legend{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;font-size:12px;color:#64748b}
.sic-legend .lg{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:6px;background:#fff;border:1px solid #e2e8f0}
.sic-legend .sw{width:14px;height:14px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800}
.sic-months{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.sic-month{background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
.sic-month-head{background:#1e40af;color:#fff;padding:8px 12px;font-size:13px;font-weight:800;text-align:center}
.sic-wd-row{display:grid;grid-template-columns:repeat(7,1fr);background:#f8fafc;border-bottom:1px solid #e2e8f0}
.sic-wd{text-align:center;padding:5px 0;font-size:10px;font-weight:700;color:#64748b}
.sic-wd.sun{color:#dc2626}
.sic-wd.sat{color:#1d4ed8}
.sic-cells{display:grid;grid-template-columns:repeat(7,1fr)}
.sic-cell{aspect-ratio:1/1;border-right:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;position:relative;padding:2px}
.sic-cell.empty{background:#fafbfc}
.sic-cell.out{color:#cbd5e1}
.sic-cell.in{color:#1a1a2e;font-weight:600}
.sic-cell .day{font-size:11px}
.sic-cell .sess{font-size:9px;margin-top:1px;padding:1px 4px;border-radius:3px;font-weight:800}
.sic-empty{text-align:center;padding:40px;color:#94a3b8}
@media print {
  .sic-bg{position:static;background:#fff;padding:0}
  .sic-modal{box-shadow:none;max-width:100%}
  .no-print{display:none !important}
}
    `}</style>

    <div className="sic-bg" onClick={onClose}>
      <div className="sic-modal" onClick={e => e.stopPropagation()}>
        <div className="sic-head">
          <h2>{enrollment?.student_name_en?.toUpperCase() || enrollment?.student_name || "Student"} — Online Class Calendar</h2>
          <div className="sic-actions no-print">
            <button className="sic-btn" onClick={() => window.print()}>🖨️ Print</button>
            <button className="sic-btn close" onClick={onClose}>✕ Close</button>
          </div>
        </div>

        <div className="sic-body">
          {loading ? <div className="sic-empty">Loading...</div> : !enrollment ? <div className="sic-empty">Not found</div> : (<>
            <div className="sic-info">
              <div><div className="k">Student</div><div className="v">{enrollment.student_name}{enrollment.student_name_en ? ` (${enrollment.student_name_en})` : ""}</div></div>
              <div><div className="k">Tutor</div><div className="v">{enrollment.tutor?.name_display || "-"}</div></div>
              <div><div className="k">Period</div><div className="v">{enrollment.start_date || "-"} ~ {enrollment.end_date || "-"}</div></div>
              <div><div className="k">Sessions</div><div className="v">{used} / {total} · Remaining {remaining}</div></div>
            </div>

            <div className="sic-legend">
              <span className="lg"><span className="sw" style={{ background: "#dcfce7", color: "#166534" }}>✓</span> Attended</span>
              <span className="lg"><span className="sw" style={{ background: "#fef2f2", color: "#dc2626" }}>✗</span> Absent</span>
              <span className="lg"><span className="sw" style={{ background: "#fef9c3", color: "#92400e" }}>△</span> Makeup</span>
              <span className="lg"><span className="sw" style={{ background: "#f1f5f9", color: "#64748b" }}>-</span> Scheduled</span>
            </div>

            <div className="sic-months">
              {months.map(m => (
                <div key={`${m.year}-${m.month}`} className="sic-month">
                  <div className="sic-month-head">{MONTH_NAMES[m.month]} {m.year}</div>
                  <div className="sic-wd-row">
                    {WD_HEAD.map((w, i) => (
                      <div key={w} className={`sic-wd ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}>{w.slice(0, 1)}</div>
                    ))}
                  </div>
                  <div className="sic-cells">
                    {m.cells.map((c, idx) => {
                      if (!c.date) return <div key={idx} className="sic-cell empty" />;
                      const ds = fmtD(c.date);
                      const s = sessionByDate[ds];
                      const cls = c.inRange ? "in" : "out";
                      return (
                        <div key={idx} className={`sic-cell ${cls}`}>
                          <div className="day">{c.date.getDate()}</div>
                          {s && (
                            <div className="sess" style={{ background: STATUS_COLORS[s.status]?.bg || "#f1f5f9", color: STATUS_COLORS[s.status]?.fg || "#64748b" }}>
                              {STATUS_COLORS[s.status]?.label || "?"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>)}
        </div>
      </div>
    </div>
  </>);
}
