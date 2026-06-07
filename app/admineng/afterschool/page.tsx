"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { parseToken, programNameOf, FT_PROGRAMS } from "@/lib/fieldtripPrograms";

function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function mondayOf(base: Date) {
  const d = new Date(base); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); d.setHours(0, 0, 0, 0); return d;
}
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface FApp { id: number; name: string | null; room_number: string | null; date: string | null; status: string | null; booking_id: string | null; portal_name: string | null; }
interface Student { name: string; room: string; }
interface ProgEntry { prog: string; isFt: boolean; time: string; students: Student[]; }

export default function AfterschoolLocalPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [apps, setApps] = useState<FApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("teacherSession") : null;
    if (!raw) { router.replace("/admineng/hub"); return; }
    setAuthed(true);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fieldtrip_applications")
      .select("id, name, room_number, date, status, booking_id, portal_name");
    setApps((data || []) as FApp[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  const days = useMemo(() => {
    const arr: { date: Date; key: string; label: string; programs: Map<string, ProgEntry> }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart); d.setDate(d.getDate() + i);
      arr.push({ date: d, key: ymd(d), label: `${DOW_EN[d.getDay()]}, ${MON_EN[d.getMonth()]} ${d.getDate()}`, programs: new Map() });
    }
    const year = weekStart.getFullYear();
    apps.forEach((a) => {
      if ((a.status || "") === "cancelled") return;
      (a.date || "").split(",").map((t) => t.trim()).filter(Boolean).forEach((tok) => {
        const p = parseToken(tok); if (!p) return;
        const k = ymd(new Date(year, p.month - 1, p.day));
        const day = arr.find((x) => x.key === k); if (!day) return;
        const meta = FT_PROGRAMS[tok];
        const entry = day.programs.get(tok) || { prog: programNameOf(tok, p.key), isFt: meta?.isFieldtrip || false, time: meta?.time || "", students: [] };
        entry.students.push({ name: (a.name || "").trim() || "-", room: (a.room_number || "").trim() || "-" });
        day.programs.set(tok, entry);
      });
    });
    return arr;
  }, [apps, weekStart]);

  const totalThisWeek = days.reduce((s, d) => s + Array.from(d.programs.values()).reduce((x, e) => x + e.students.length, 0), 0);
  const range = `${MON_EN[weekStart.getMonth()]} ${weekStart.getDate()} – ${MON_EN[days[6].date.getMonth()]} ${days[6].date.getDate()}`;
  const todayKey = ymd(new Date());

  function shiftWeek(delta: number) { const d = new Date(weekStart); d.setDate(d.getDate() + delta * 7); setWeekStart(mondayOf(d)); }

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.w{max-width:920px;margin:0 auto;padding:26px 18px 60px}
.top{display:flex;align-items:center;gap:12px;margin-bottom:4px}
.back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.back:hover{background:#e2e8f0}
.top h1{font-size:20px;font-weight:800;flex:1}
.sub{font-size:13px;color:#6b7c93;margin:0 0 16px 46px}
.nav{display:flex;align-items:center;gap:8px;margin-bottom:18px;flex-wrap:wrap}
.nav button{padding:7px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}.nav button:hover{background:#e2e8f0}
.nav .rg{font-size:15px;font-weight:800;min-width:170px;text-align:center}
.nav .cnt{margin-left:auto;font-size:13px;color:#6b7c93;font-weight:600}
.day{background:#fff;border-radius:14px;padding:16px 18px;box-shadow:0 2px 12px rgba(0,0,0,0.05);margin-bottom:12px}
.day.today{border:2px solid #16a34a}
.day-h{font-size:15px;font-weight:800;margin-bottom:10px;display:flex;align-items:center;gap:8px}
.day-h .tdy{font-size:11px;font-weight:800;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px}
.prog{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:8px}
.prog:last-child{margin-bottom:0}
.prog.ft{background:#fff7ed;border-color:#fed7aa}
.prog-t{font-size:13.5px;font-weight:800;margin-bottom:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.prog.ft .prog-t{color:#c2410c}
.prog-t .tm{font-size:11px;font-weight:600;color:#6b7c93}
.prog-t .ftb{font-size:10px;font-weight:800;background:#c2410c;color:#fff;padding:2px 7px;border-radius:999px}
.stu{display:flex;flex-wrap:wrap;gap:6px}
.chip{font-size:12.5px;font-weight:600;background:#f1f5f9;border-radius:8px;padding:4px 10px}
.chip b{font-weight:800}
.chip .rm{color:#1a6fc4;font-weight:700;margin-left:4px}
.empty{color:#cbd5e1;font-size:13px;text-align:center;padding:30px}
    `}</style>
    <div className="w">
      <div className="top">
        <button className="back" onClick={() => router.push("/admineng/hub")}>←</button>
        <h1>🌿 After School / Field Trip</h1>
        <button className="back" title="Reload" onClick={load}>🔄</button>
      </div>
      <div className="sub">Weekly prep list — class · house · students.</div>

      <div className="nav">
        <button onClick={() => shiftWeek(-1)}>◀ Prev</button>
        <button onClick={() => setWeekStart(mondayOf(new Date()))}>This Week</button>
        <button onClick={() => shiftWeek(1)}>Next ▶</button>
        <span className="rg">{range}</span>
        <span className="cnt">{totalThisWeek} student-sessions</span>
      </div>

      {loading ? <div className="day"><div className="empty">Loading...</div></div>
        : totalThisWeek === 0 ? <div className="day"><div className="empty">No after-school / field trip this week.</div></div>
        : days.filter((d) => d.programs.size > 0).map((d) => (
          <div key={d.key} className={`day${d.key === todayKey ? " today" : ""}`}>
            <div className="day-h">{d.label}{d.key === todayKey && <span className="tdy">TODAY</span>}</div>
            {Array.from(d.programs.values()).map((e, i) => (
              <div key={i} className={`prog${e.isFt ? " ft" : ""}`}>
                <div className="prog-t">
                  <span>{e.prog}</span>
                  {e.isFt && <span className="ftb">FIELD TRIP</span>}
                  {e.time && <span className="tm">{e.time}</span>}
                  <span className="tm">· {e.students.length}</span>
                </div>
                <div className="stu">
                  {e.students.map((s, j) => (
                    <span key={j} className="chip"><b>{s.name}</b>{s.room !== "-" && <span className="rm">🏠 {s.room}</span>}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  </>);
}
