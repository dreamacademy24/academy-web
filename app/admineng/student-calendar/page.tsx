"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isCommuteBooking } from "@/lib/bookingTypes";

interface Booking {
  check_in: string | null;
  checkout_date: string | null;
  booking_type: string | null;
}
interface Student {
  id: string;
  name_kr: string | null;
  name_en: string | null;
  age: string | null;
  level: string | null;
  class_type: string | null;
  academy_start: string | null;
  academy_end: string | null;
  bookings_new?: Booking | null;
}

const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function getNextMonday(d: string) {
  const dt = new Date(d + "T00:00:00");
  const day = dt.getDay();
  if (day === 1) return d;
  const diff = day === 0 ? 1 : 8 - day;
  dt.setDate(dt.getDate() + diff);
  return ymd(dt); // timezone-safe (toISOString은 PHT/KST에서 하루 밀림)
}

// ── 한국인 학생관리 탭(admin/bookings)과 동일한 파생 공식 ──
function nextMondayOf(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr.split("T")[0]);
  if (isNaN(d.getTime())) return "";
  const day = d.getDay();
  const offset = (8 - day) % 7;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
function academyEndOf(startStr: string, weeks: number): string {
  if (!startStr || !weeks || weeks < 1) return "";
  const d = new Date(startStr);
  d.setDate(d.getDate() + (weeks - 1) * 7 + 4);
  return d.toISOString().slice(0, 10);
}

// 학생의 실제 종료일 (commute는 booking.checkout_date 우선)
function getEndDate(s: Student): string | null {
  if (s.class_type === "commute") {
    return s.bookings_new?.checkout_date || s.academy_end || null;
  }
  return s.academy_end || null;
}

function calcWeeks(start: string | null, end: string | null): string {
  if (!start || !end) return "-";
  const sM = getNextMonday(start);
  const e = new Date(end + "T00:00:00");
  const s = new Date(sM + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return "-";
  const w = Math.ceil((e.getTime() - s.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
  return w > 0 ? String(w) : "-";
}

// 나이 추출: YYYYMMDD/YYYY → 현재 연도 - 출생연도, 만N세 → N, 그 외 숫자 그대로
function getAge(s: Student): string {
  const a = String(s.age || "").trim();
  if (!a) return "";
  const y = a.match(/^(\d{4})/);
  if (y) {
    const age = new Date().getFullYear() - Number(y[1]);
    return age > 0 && age < 120 ? String(age) : "";
  }
  const man = a.match(/만\s*(\d{1,2})/);
  if (man) return man[1];
  const num = parseInt(a, 10);
  return isNaN(num) ? "" : String(num);
}

function genCalWeeks(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const cursor = new Date(firstDay);
  while (cursor.getDay() !== 1) cursor.setDate(cursor.getDate() - 1);
  const weeks: Date[][] = [];
  while (cursor <= lastDay) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(cursor)); cursor.setDate(cursor.getDate() + 1); }
    weeks.push(week);
  }
  return weeks;
}

const _now = new Date();

export default function EngStudentCalendarPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "cal">("cal");
  const [search, setSearch] = useState("");
  const [stuYear, setStuYear] = useState<string>(String(_now.getFullYear()));
  const [stuMonth, setStuMonth] = useState<string>(pad2(_now.getMonth() + 1));
  const [listLevel, setListLevel] = useState<"all" | "kinder" | "junior">("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("teacherSession");
      if (raw && JSON.parse(raw)?.username) { setAuthed(true); return; }
    } catch {}
    window.location.href = "/admineng/hub";
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    // 한국인 학생관리 탭(admin/bookings)과 동일 소스: bookings.students JSONB 평탄화
    // (기존 bookings_new 조인은 폐기된 테이블이라 항상 0건이었음)
    const { data } = await supabase
      .from("bookings")
      .select("id, status, students, checkin_date, checkout_date, accom_type, booking_type, accom_weeks, academy_start, academy_end")
      .in("status", ["영수증발행", "결제완료", "완료"]);
    const rows: Student[] = [];
    (data || []).forEach((b: any) => {
      let arr: any[] = [];
      try {
        const parsed = typeof b.students === "string" ? JSON.parse(b.students) : b.students;
        if (Array.isArray(parsed)) arr = parsed;
      } catch { return; }
      const isCommute = isCommuteBooking(b);
      arr.forEach((st: any, i: number) => {
        const weeks = Number(st.academyWeeks || b.accom_weeks || 0);
        const storedStart = String(st.academyStart || st.academy_start || b.academy_start || "").split("T")[0];
        const storedEnd = String(st.academyEnd || st.academy_end || b.academy_end || "").split("T")[0];
        const calStart = storedStart || (isCommute ? String(b.checkin_date || "").split("T")[0] : nextMondayOf(String(b.checkin_date || "")));
        const calEnd = storedEnd || (isCommute ? String(b.checkout_date || "").split("T")[0] : (weeks > 0 ? academyEndOf(calStart, weeks) : ""));
        const grade = st.grade || (st.level === "kinder" ? "킨더" : st.level === "junior" ? "주니어" : "");
        const korName = st.korName || st.name_kr || st.name || "";
        const engName = st.engName || st.name_en || "";
        if (!korName && !engName) return;
        rows.push({
          id: b.id + "_" + i,
          name_kr: korName,
          name_en: engName,
          age: st.age || "",
          level: grade === "킨더" ? "kinder" : "junior",
          class_type: isCommute ? "commute" : "",
          academy_start: calStart || null,
          academy_end: calEnd || null,
          bookings_new: {
            check_in: String(b.checkin_date || "").split("T")[0] || null,
            checkout_date: String(b.checkout_date || "").split("T")[0] || null,
            booking_type: b.booking_type || null,
          },
        });
      });
    });
    rows.sort((a, b) => (a.academy_start || "9999").localeCompare(b.academy_start || "9999"));
    setStudents(rows);
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  // 검색 + 레벨 필터
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(s => {
      if (q) {
        const hay = `${s.name_kr || ""} ${s.name_en || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (view === "list" && listLevel !== "all") {
        const lv = (s.level || "junior").toLowerCase();
        if (listLevel === "kinder" && lv !== "kinder") return false;
        if (listLevel === "junior" && lv !== "junior") return false;
      }
      return true;
    });
  }, [students, search, view, listLevel]);

  // 학생 표시 라벨 만들기 (캘린더용)
  const studentLabel = (s: Student) => {
    const en = s.name_en || s.name_kr || "";
    const kr = s.name_kr || "";
    const a = getAge(s);
    const ageStr = a ? `${a}y` : "-";
    const wkStr = `${calcWeeks(s.academy_start, getEndDate(s))}w`;
    return { en, kr, ageStr, wkStr, isKinder: (s.level || "").toLowerCase() === "kinder" };
  };

  if (!authed) return null;

  const calYear = Number(stuYear) || _now.getFullYear();
  const calMonth = Number(stuMonth) || (_now.getMonth() + 1);
  const weeks = genCalWeeks(calYear, calMonth);

  // 통과: 학생 startMonday + endDate 캐시
  const enriched = filtered
    .filter(s => s.name_en || s.name_kr)
    .map(s => {
      const start = s.academy_start ? getNextMonday(s.academy_start) : null;
      const end = getEndDate(s);
      return { s, start, end };
    });

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.sc-w{max-width:1500px;margin:0 auto;padding:24px 18px 60px}
.sc-top{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
@media(max-width:600px){.sc-w{padding:12px 8px 40px;overflow-x:auto}}
.sc-back{padding:7px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;font-weight:700;color:#475569;cursor:pointer;font-family:inherit}
.sc-back:hover{border-color:#1a6fc4;color:#1a6fc4}
.sc-title{font-size:20px;font-weight:800;flex:1}

.sc-ctrl{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.sc-search{flex:1;min-width:200px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff}
.sc-search:focus{border-color:#1a6fc4}
.sc-view{display:flex;gap:0;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:3px}
.sc-view button{padding:6px 14px;border:none;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;background:transparent;color:#475569}
.sc-view button.ac{background:#1a6fc4;color:#fff}
.sc-print{padding:8px 14px;background:#dbeafe;color:#1e40af;border:none;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}
.sc-print:hover{background:#bfdbfe}

.sc-filter{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px;font-size:12.5px}
.sc-filter .lbl{font-size:11px;font-weight:700;color:#6b7280;margin-right:4px}
.sc-chip{padding:5px 11px;background:#f1f5f9;color:#475569;border:1px solid transparent;border-radius:6px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit}
.sc-chip:hover{background:#e2e8f0}
.sc-chip.ac{background:#1a6fc4;color:#fff}

.sc-card{background:#fff;border-radius:12px;border:1px solid #f3f4f6;box-shadow:0 1px 4px rgba(0,0,0,0.05);padding:14px;margin-top:10px}
.sc-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.sc-nav button{padding:6px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:7px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;color:#475569}
.sc-nav button:hover{border-color:#1a6fc4;color:#1a6fc4}
.sc-month-title{font-size:16px;font-weight:800;color:#1a1a2e}

.cal-tbl{width:100%;border-collapse:collapse;table-layout:fixed}
.cal-tbl th{background:#f8fafc;font-size:11.5px;font-weight:700;color:#475569;padding:8px 6px;border:1px solid #e5e7eb;text-align:center}
.cal-tbl .cal-side{width:120px;background:#f8fafc;font-weight:800;color:#1a1a2e}
.cal-tbl td{border:1px solid #f1f5f9;padding:8px;font-size:11px;vertical-align:top;min-height:80px;height:80px;background:#fff}
.cal-tbl td.cal-side{background:#f8fafc;font-size:11.5px;line-height:1.6;color:#475569}
.cal-tbl td.cal-side .cal-total{font-size:14px;font-weight:900;color:#1a1a2e;margin-top:4px}
.cal-tbl td.out-month{background:#fafafa;color:#cbd5e1}
.cal-d{font-size:12px;font-weight:700;color:#374151;margin-bottom:3px}
.cal-newin{display:inline-block;padding:1px 6px;background:#dcfce7;color:#15803d;border-radius:4px;font-size:10px;font-weight:800;margin-bottom:4px}
.cal-out{display:inline-block;padding:1px 6px;background:#ede9fe;color:#6d28d9;border-radius:4px;font-size:10px;font-weight:800;margin-bottom:4px}
.cal-stu-in,.cal-stu-out{font-size:10.5px;line-height:1.5;color:#1f2937;margin-bottom:1px;word-break:keep-all}
.cal-stu-out{color:#6d28d9}

.tbl{width:100%;border-collapse:collapse;font-size:12.5px;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #f3f4f6}
.tbl th{background:#f8fafc;text-align:left;padding:9px 10px;font-size:11.5px;font-weight:700;color:#475569;border-bottom:1px solid #e5e7eb}
.tbl td{padding:9px 10px;border-bottom:1px solid #f3f4f6;color:#1a1a2e}
.tbl tr:hover td{background:#eff6ff}

.empty{text-align:center;padding:40px;color:#9ca3af;font-size:13px}

@media print{
  body{background:#fff!important}
  .no-print{display:none!important}
  .sc-w{padding:0!important;max-width:none!important}
  .sc-card{box-shadow:none!important;border:none!important;padding:0!important}
  .cal-tbl td,.cal-tbl th{border:1px solid #999!important}
  .cal-newin,.cal-out{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4 landscape;margin:10mm}
}
    `}</style>

    <div className="sc-w">
      <div className="sc-top no-print">
        <button className="sc-back" onClick={() => router.push("/admineng/hub")}>← Back to Hub</button>
        <h1 className="sc-title">📅 Student Calendar</h1>
      </div>

      <div className="sc-ctrl no-print">
        <input className="sc-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by name" />
        <div className="sc-view">
          <button className={view === "list" ? "ac" : ""} onClick={() => setView("list")}>List</button>
          <button className={view === "cal" ? "ac" : ""} onClick={() => setView("cal")}>Calendar</button>
        </div>
        <button className="sc-print" onClick={() => window.print()}>🖨️ Print (A4 Landscape)</button>
      </div>

      <div className="sc-filter no-print">
        <span className="lbl">Year</span>
        {["", "2025", "2026", "2027"].map(y => (
          <button key={y || "all-y"} className={`sc-chip${stuYear === y ? " ac" : ""}`} onClick={() => setStuYear(y)}>{y || "All"}</button>
        ))}
      </div>
      <div className="sc-filter no-print">
        <span className="lbl">Month</span>
        {["", "01","02","03","04","05","06","07","08","09","10","11","12"].map(m => (
          <button key={m || "all-m"} className={`sc-chip${stuMonth === m ? " ac" : ""}`} onClick={() => setStuMonth(m)}>{m ? MONTHS_EN[parseInt(m) - 1] : "All"}</button>
        ))}
      </div>

      {loading ? (
        <div className="sc-card empty">Loading...</div>
      ) : view === "cal" ? (
        <div className="sc-card">
          <div className="sc-nav">
            <button className="no-print" onClick={() => {
              let y = calYear, m = calMonth - 1;
              if (m < 1) { y -= 1; m = 12; }
              setStuYear(String(y)); setStuMonth(pad2(m));
            }}>← Prev Month</button>
            <div className="sc-month-title">{calYear} {MONTHS_EN[calMonth - 1]} Student Calendar</div>
            <button className="no-print" onClick={() => {
              let y = calYear, m = calMonth + 1;
              if (m > 12) { y += 1; m = 1; }
              setStuYear(String(y)); setStuMonth(pad2(m));
            }}>Next Month →</button>
          </div>
          <table className="cal-tbl">
            <thead>
              <tr>
                <th className="cal-side">Week Summary</th>
                <th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => {
                const wsStr = ymd(week[0]);
                const weStr = ymd(week[6]);
                // 해당 주에 재원 중인 학생 (startMonday <= weekFri && endDate >= weekMon)
                const friStr = ymd(week[4]);
                const active = enriched.filter(({ start, end }) => {
                  if (!start) return false;
                  const e = end || start;
                  return start <= friStr && e >= wsStr;
                });
                const kCount = active.filter(({ s }) => (s.level || "").toLowerCase() === "kinder").length;
                const jCount = active.length - kCount;
                const newIns = enriched.filter(({ start }) => start && start >= wsStr && start <= weStr);
                const outs = enriched.filter(({ end }) => end && end >= wsStr && end <= weStr);
                return (
                  <tr key={wi}>
                    <td className="cal-side">
                      <div>Kinder-{kCount}</div>
                      <div>Junior-{jCount}</div>
                      <div className="cal-total">Total: {jCount}/{kCount}</div>
                    </td>
                    {week.slice(0, 6).map((day, di) => {
                      const dStr = ymd(day);
                      const inMonth = day.getMonth() === calMonth - 1;
                      const isMon = day.getDay() === 1;
                      const isFri = day.getDay() === 5;
                      const startList = enriched.filter(({ start }) => start === dStr);
                      const endList = enriched.filter(({ end }) => end === dStr);
                      return (
                        <td key={di} className={`${inMonth ? "" : "out-month"}`}>
                          <div className="cal-d">{day.getMonth() + 1}/{day.getDate()}</div>
                          {isMon && newIns.length > 0 && <span className="cal-newin">{newIns.length} New in</span>}
                          {isFri && outs.length > 0 && <span className="cal-out">Graduation / {outs.length} out</span>}
                          {startList.map(({ s }, i) => {
                            const lab = studentLabel(s);
                            return (
                              <div key={`in${s.id}-${i}`} className="cal-stu-in" title={`${lab.en} ${lab.kr}`.trim()}>
                                + {lab.isKinder && <span style={{ color: "#1a1a2e", fontWeight: 800 }}>K-</span>}{lab.en}{lab.kr && lab.kr !== lab.en ? `/${lab.kr}` : ""}/{lab.ageStr}/{lab.wkStr}
                              </div>
                            );
                          })}
                          {endList.map(({ s }, i) => {
                            const lab = studentLabel(s);
                            return (
                              <div key={`out${s.id}-${i}`} className="cal-stu-out" title={`${lab.en} ${lab.kr}`.trim()}>
                                · {lab.isKinder && <span style={{ color: "#1a1a2e", fontWeight: 800 }}>K-</span>}{lab.en}{lab.kr && lab.kr !== lab.en ? `/${lab.kr}` : ""}/{lab.ageStr}/{lab.wkStr}
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="sc-filter no-print" style={{ marginBottom: 8 }}>
            <span className="lbl">Level</span>
            {(["all","kinder","junior"] as const).map(lv => (
              <button key={lv} className={`sc-chip${listLevel === lv ? " ac" : ""}`} onClick={() => setListLevel(lv)}>{lv === "all" ? "All" : lv === "kinder" ? "Kinder" : "Junior"}</button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{filtered.length} students</span>
          </div>
          {filtered.length === 0 ? (
            <div className="sc-card empty">No students.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Name</th>
                  <th style={{ width: 60 }}>Age</th>
                  <th style={{ width: 80 }}>Level</th>
                  <th style={{ width: 110 }}>Check-in</th>
                  <th style={{ width: 110 }}>Academy Start</th>
                  <th style={{ width: 110 }}>Academy End</th>
                  <th style={{ width: 90 }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const end = getEndDate(s);
                  const lv = (s.level || "junior").toLowerCase();
                  return (
                    <tr key={s.id}>
                      <td style={{ color: "#9ca3af" }}>{i + 1}</td>
                      <td style={{ fontWeight: 700 }}>{s.name_en || s.name_kr || "-"}</td>
                      <td>{getAge(s) || "-"}</td>
                      <td>
                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700, background: lv === "kinder" ? "#ede9fe" : "#fef3c7", color: lv === "kinder" ? "#7c3aed" : "#b45309" }}>
                          {lv === "kinder" ? "Kinder" : "Junior"}
                        </span>
                      </td>
                      <td>{s.bookings_new?.check_in || "-"}</td>
                      <td>{s.academy_start || "-"}</td>
                      <td>{end || "-"}</td>
                      <td>{calcWeeks(s.academy_start, end)}w</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  </>);
}
