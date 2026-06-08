"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  loadDeployedSchedule, mergeWithFallback, resolveProgram, buildScheduleByMd, mdFromDate,
  type DeployedScheduleItem,
} from "@/lib/fieldtripPrograms";

interface FApp {
  id: number; name: string | null; room_number: string | null;
  date: string | null; status: string | null; booking_id: string | null; portal_name: string | null;
}
interface Signup { name: string; room: string; status: string; }

const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

export default function AfterschoolLocalPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<DeployedScheduleItem[]>([]);
  const [apps, setApps] = useState<FApp[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string>>({}); // bookingId__KRname → ENname
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [cursor, setCursor] = useState<Date>(() => { const d = new Date(); d.setDate(1); return d; });

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("teacherSession") : null;
    if (!raw) { router.replace("/admineng/hub"); return; }
    setAuthed(true);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const deployed = await loadDeployedSchedule(supabase).catch(() => []);
    setItems(mergeWithFallback(deployed));
    const { data } = await supabase
      .from("fieldtrip_applications")
      .select("id, name, room_number, date, status, booking_id, portal_name");
    const rows = (data || []) as FApp[];
    setApps(rows);
    // 학생 한글이름 → 영어이름 (현지직원은 영어이름으로 표시)
    const ids = Array.from(new Set(rows.map((a) => a.booking_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: st } = await supabase.from("students").select("name_kr, name_en, booking_id").in("booking_id", ids);
      const nm: Record<string, string> = {};
      (st || []).forEach((s: { name_kr: string | null; name_en: string | null; booking_id: string | null }) => {
        if (s.name_en && s.name_en.trim()) nm[`${s.booking_id}__${(s.name_kr || "").trim()}`] = s.name_en.trim();
      });
      setNameMap(nm);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  const byMd = useMemo(() => buildScheduleByMd(items), [items]);

  // "M-D" → 신청자 (취소 제외, 영어이름 우선)
  const signupsByMd = useMemo(() => {
    const map: Record<string, Signup[]> = {};
    for (const a of apps) {
      if ((a.status || "") === "cancelled") continue;
      (a.date || "").split(",").map((t) => t.trim()).filter(Boolean).forEach((tok) => {
        const r = resolveProgram(tok, byMd); if (!r) return;
        const key = `${r.month}-${r.day}`;
        const kr = (a.name || "").trim();
        const en = nameMap[`${a.booking_id}__${kr}`];
        (map[key] ||= []).push({ name: en || kr || "-", room: (a.room_number || "").trim(), status: a.status || "pending" });
      });
    }
    return map;
  }, [apps, byMd, nameMap]);

  // 배포 항목 → 월별 그룹 (리스트)
  const monthGroups = useMemo(() => {
    const m = new Map<string, DeployedScheduleItem[]>();
    for (const it of [...items].sort((a, b) => a.date.localeCompare(b.date))) {
      const mk = it.date.slice(0, 7);
      if (!m.has(mk)) m.set(mk, []);
      m.get(mk)!.push(it);
    }
    return Array.from(m.entries());
  }, [items]);

  const calCells = useMemo(() => {
    const y = cursor.getFullYear(), mo = cursor.getMonth();
    const first = new Date(y, mo, 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push({ date: d, inMonth: d.getMonth() === mo }); }
    return cells;
  }, [cursor]);

  if (!authed) return null;
  const shiftMonth = (delta: number) => { const d = new Date(cursor); d.setMonth(d.getMonth() + delta); d.setDate(1); setCursor(d); };
  const todayKey = ymd(new Date());

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',system-ui,sans-serif;background:#f1f5f9;color:#1a1a2e}
.w{max-width:980px;margin:0 auto;padding:24px 16px 60px}
.top{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.back:hover{background:#e2e8f0}
.top h1{font-size:20px;font-weight:800;flex:1}
.sub{font-size:13px;color:#6b7c93;margin:0 0 16px 46px}
.seg{display:inline-flex;background:#e2e8f0;border-radius:10px;padding:4px;gap:4px;margin-bottom:16px}
.seg button{border:none;background:transparent;padding:8px 18px;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;color:#64748b;font-family:inherit}
.seg button[data-on="true"]{background:#16a34a;color:#fff}
.mhead{background:#16a34a;color:#fff;border-radius:12px;padding:12px 16px;margin:14px 0 10px;font-size:16px;font-weight:800}
.card{background:#fff;border:1px solid #eef2f7;border-radius:13px;box-shadow:0 1px 6px rgba(0,0,0,0.05);margin-bottom:10px;overflow:hidden}
.chead{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid #f1f5f9;flex-wrap:wrap}
.chead.ft{background:#fff7ed;border-bottom-color:#fed7aa}.chead.as{background:#eff6ff}
.chead.today{box-shadow:inset 3px 0 0 #16a34a}
.dt{font-size:14px;font-weight:800}
.pn{font-size:14px;font-weight:700}
.ftb{font-size:10px;font-weight:800;background:#c2410c;color:#fff;padding:2px 8px;border-radius:999px}
.tdy{font-size:10px;font-weight:800;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:999px}
.cnt{margin-left:auto;font-size:12.5px;font-weight:700;background:#fff;border:1px solid #cbd5e1;border-radius:999px;padding:3px 11px}
.kids{display:flex;flex-wrap:wrap;gap:6px;padding:12px 16px}
.chip{font-size:12.5px;font-weight:600;background:#f1f5f9;border-radius:8px;padding:4px 10px}
.chip b{font-weight:800}.chip .rm{color:#1a6fc4;font-weight:700;margin-left:4px}.chip .pd{color:#b45309;margin-left:4px}
.none{padding:11px 16px;color:#cbd5e1;font-size:13px}
.empty{color:#cbd5e1;text-align:center;padding:50px 0;font-size:14px}
.calnav{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.calnav button{border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:7px 13px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.calnav b{font-size:16px;margin-left:4px}
.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.gdow{text-align:center;font-size:11px;font-weight:700;color:#94a3b8;padding:4px 0}
.cell{min-height:80px;border:1px solid #eef2f7;border-radius:9px;padding:5px 6px;background:#fff}
.cell.out{background:#fafbfc;opacity:0.5}.cell.tdy{border-color:#16a34a;box-shadow:0 0 0 1px #16a34a}
.cell .d{font-weight:700;color:#475569;font-size:11px}
.cell .pg{margin-top:3px;font-weight:700;line-height:1.25;font-size:11px}
.cell .pg.ft{color:#c2410c}.cell .pg.as{color:#1d4ed8}
.cell .nb{display:inline-block;margin-top:3px;background:#16a34a;color:#fff;border-radius:999px;font-size:10px;font-weight:800;padding:1px 7px}
    `}</style>
    <div className="w">
      <div className="top">
        <button className="back" onClick={() => router.push("/admineng/hub")}>←</button>
        <h1>🌿 After School / Field Trip</h1>
        <button className="back" title="Reload" onClick={load}>🔄</button>
      </div>
      <div className="sub">Deployed schedule &amp; sign-ups — prepare ahead.</div>

      <div className="seg">
        <button data-on={view === "list"} onClick={() => setView("list")}>📋 List</button>
        <button data-on={view === "calendar"} onClick={() => setView("calendar")}>📅 Calendar</button>
      </div>

      {loading ? <div className="empty">Loading…</div> : view === "list" ? (
        monthGroups.length === 0 ? <div className="empty">No deployed schedule yet.</div> :
        monthGroups.map(([mk, list]) => {
          const [yy, mm] = mk.split("-").map(Number);
          return (
            <div key={mk}>
              <div className="mhead">📅 {MON_EN[mm - 1]} {yy}</div>
              {list.map((it) => {
                const dt = new Date(it.date + "T00:00:00");
                const isFt = it.type === "fieldtrip";
                const kids = signupsByMd[mdFromDate(it.date)] || [];
                const isToday = it.date === todayKey;
                return (
                  <div className="card" key={it.id}>
                    <div className={`chead ${isFt ? "ft" : "as"}${isToday ? " today" : ""}`}>
                      <span className="dt">{dt.getMonth() + 1}/{dt.getDate()} ({DOW_EN[dt.getDay()]})</span>
                      <span className="pn">{it.title}</span>
                      {isFt && <span className="ftb">FIELD TRIP</span>}
                      {isToday && <span className="tdy">TODAY</span>}
                      <span className="cnt">{kids.length} signed up</span>
                    </div>
                    {kids.length === 0 ? <div className="none">No sign-ups yet.</div> : (
                      <div className="kids">
                        {kids.map((k, i) => (
                          <span className="chip" key={i}>
                            <b>{k.name}</b>{k.room ? <span className="rm">🏠 {k.room}</span> : null}
                            {k.status === "pending" ? <span className="pd">· pending</span> : null}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      ) : (
        <>
          <div className="calnav">
            <button onClick={() => shiftMonth(-1)}>◀ Prev</button>
            <button onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>Today</button>
            <button onClick={() => shiftMonth(1)}>Next ▶</button>
            <b>{MON_EN[cursor.getMonth()]} {cursor.getFullYear()}</b>
          </div>
          <div className="grid">
            {DOW_EN.map((d) => <div className="gdow" key={d}>{d}</div>)}
            {calCells.map((c, i) => {
              const it = byMd[`${c.date.getMonth() + 1}-${c.date.getDate()}`];
              const matches = it && it.date === ymd(c.date);
              const kids = matches ? (signupsByMd[mdFromDate(it.date)] || []) : [];
              const isToday = ymd(c.date) === todayKey;
              return (
                <div className={`cell ${c.inMonth ? "" : "out"}${isToday ? " tdy" : ""}`} key={i}>
                  <div className="d">{c.date.getDate()}</div>
                  {matches && (<>
                    <div className={`pg ${it.type === "fieldtrip" ? "ft" : "as"}`}>{it.title}</div>
                    {kids.length > 0 && <span className="nb">{kids.length}</span>}
                  </>)}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  </>);
}
