"use client";
import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";

/* ── Class Schedule System v2 ──
   Groups (time+students+teacher) + 1:1 matrix → auto-composed Master.
   Editors: app_settings.class_sched_editors + admin-ceo/admin-jun */

interface Sess { slot: number; subject: string; teacher: string }
interface Grp { id: string; name: string; room: string; members: string[]; sessions: Sess[] }
interface StuV2 { name: string; sessions: Sess[] }
interface BaseV2 { v: 2; teachers: string[]; groups: Grp[]; students: StuV2[] }
interface Row { id: string; week_start: string; base: unknown; overrides: Record<string, unknown> }

const SLOTS = ["9:00–9:40", "9:45–10:25", "10:30–11:15", "11:20–12:00", "12:50–13:30", "13:35–14:20", "14:40–15:15", "15:20–16:00"];
const GRP_SUBJ = ["BTS", "SOLOMON", "DREAM", "FUN"];
const ONE_SUBJ = ["SPEAKING", "LISTENING", "READING", "WRITING"];
const SUBJ_OPT = [...ONE_SUBJ, ...GRP_SUBJ, "PHONICS", "REVIEW", "TEST", "ETC"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SLOT_RANGE = [[540, 580], [585, 625], [630, 675], [680, 720], [770, 810], [815, 860], [880, 915], [920, 960]];
function nowSlotPH(): { cur: number; next: number; mins: number } {
  const ph = new Date(Date.now() + (8 * 60 + new Date().getTimezoneOffset()) * 60000);
  const m = ph.getHours() * 60 + ph.getMinutes();
  let cur = -1, next = -1;
  for (let i = 0; i < SLOT_RANGE.length; i++) {
    if (m >= SLOT_RANGE[i][0] && m <= SLOT_RANGE[i][1]) { cur = i; break }
    if (m < SLOT_RANGE[i][0]) { next = i; break }
  }
  return { cur, next, mins: m };
}
const uid = () => Math.random().toString(36).slice(2, 10);
const pad2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const mondayOf = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x };
const addD = (s: string, n: number) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d) };
const normRoom = (r: string) => (r || "").toUpperCase().replace(/\s+/g, " ").trim();

/* v1 → v2 migration (old: students[{name,phase,room,grp[4],one[4]}]) */
function toV2(raw: unknown): BaseV2 {
  const b = (raw || {}) as { v?: number; teachers?: string[]; groups?: Grp[]; students?: unknown[] };
  if (b.v === 2) return b as unknown as BaseV2;
  const teachers = Array.isArray(b.teachers) ? b.teachers : [];
  const oldStu = (Array.isArray(b.students) ? b.students : []) as { name: string; phase: "junior" | "lower"; room: string; grp: string[]; one: string[] }[];
  if (!oldStu.length || !oldStu[0]?.grp) return { v: 2, teachers, groups: [], students: [] };
  const groups: Grp[] = []; const students: StuV2[] = [];
  const keys = [...new Set(oldStu.map(s => s.phase + "|" + normRoom(s.room)))];
  keys.forEach((k, i) => {
    const [ph, rm] = k.split("|");
    const mem = oldStu.filter(s => s.phase + "|" + normRoom(s.room) === k);
    const gslots = ph === "junior" ? [0, 2, 4, 6] : [1, 3, 5, 7];
    groups.push({
      id: uid(), name: "Group " + (i + 1) + (ph === "junior" ? " (JR)" : " (KD)"), room: rm,
      members: mem.map(s => s.name),
      sessions: gslots.map((sl, gi) => ({ slot: sl, subject: GRP_SUBJ[gi], teacher: mem[0]?.grp?.[gi] || "" })),
    });
  });
  oldStu.forEach(s => {
    const oslots = s.phase === "junior" ? [1, 3, 5, 7] : [0, 2, 4, 6];
    students.push({ name: s.name, sessions: oslots.map((sl, oi) => ({ slot: sl, subject: ONE_SUBJ[oi], teacher: s.one?.[oi] || "" })).filter(x => x.teacher) });
  });
  return { v: 2, teachers, groups, students };
}

interface Ev { slot: number; teacher: string; kind: "Group" | "1:1"; subject: string; who: string; room: string; gname: string; cover: string | null }
function splitT(t: string): [string, string | null] {
  const s = (t || "").replace(/\s+/g, " ").trim(); const m = s.split(/\s*-\s*/);
  return m.length === 2 && m[1] ? [m[0].trim(), m[1].trim()] : [s, null];
}
function buildEvents(b: BaseV2): Ev[] {
  const out: Ev[] = [];
  const push = (slot: number, raw: string, kind: "Group" | "1:1", subject: string, who: string, room: string, gname: string) => {
    if (!raw) return; const [p, cov] = splitT(raw); if (!p) return;
    out.push({ slot, teacher: p, kind, subject, who, room, gname, cover: cov });
    if (cov) out.push({ slot, teacher: cov, kind, subject, who, room, gname, cover: "covering " + p });
  };
  b.groups.forEach(g => g.sessions.forEach(se => g.members.forEach(m => push(se.slot, se.teacher, "Group", se.subject, m, normRoom(g.room), g.name))));
  b.students.forEach(s => s.sessions.forEach(se => push(se.slot, se.teacher, "1:1", se.subject, s.name, "", "")));
  return out;
}

export default function ClassSchedule() {
  const [authed, setAuthed] = useState(false);
  const [me, setMe] = useState("");
  const [editors, setEditors] = useState<string[]>([]);
  const [weekStart, setWeekStart] = useState(() => ymd(mondayOf(new Date())));
  const [row, setRow] = useState<Row | null>(null);
  const [day, setDay] = useState<string>("base");
  const [nav, setNav] = useState<"groups" | "one" | "master">("master");
  const [mview, setMview] = useState<"now" | "timeline" | "teacher" | "student" | "room" | "grid">("now");
  const [findQ, setFindQ] = useState("");
  const [slotOv, setSlotOv] = useState<number | null>(null);
  const [selT, setSelT] = useState(""); const [selStu, setSelStu] = useState(""); const [selR, setSelR] = useState("");
  const [draft, setDraft] = useState<BaseV2 | null>(null);
  const [busy, setBusy] = useState(""); const [printAll, setPrintAll] = useState<null | "t" | "s">(null);
  const [loading, setLoading] = useState(true);
  const [openG, setOpenG] = useState<string>("");
  const [oneG, setOneG] = useState<string>("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { const raw = localStorage.getItem("teacherSession"); if (raw && JSON.parse(raw)?.username) { setMe(String(JSON.parse(raw).username || "")); setAuthed(true); return } } catch { }
    window.location.href = "/admineng/hub";
  }, []);
  useEffect(() => { supabase.from("app_settings").select("value").eq("key", "class_sched_editors").maybeSingle().then(({ data }) => { if (Array.isArray(data?.value)) setEditors(data!.value as string[]) }) }, []);
  const [adminOk, setAdminOk] = useState(false);
  useEffect(() => { try { setAdminOk(isAdminAuthed()) } catch { } }, []);
  const meN = (me || "").toLowerCase().trim();
  const canEdit = adminOk || editors.map(x => String(x).toLowerCase().trim()).includes(meN) || ["admin-ceo", "ceo", "admin-jun", "jun", "admin-eric", "eric"].includes(meN) || meN.includes("ceo");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("class_schedules").select("*").eq("week_start", weekStart).maybeSingle();
    setRow((data as Row) || null); setDraft(null); setLoading(false);
  }, [weekStart]);
  useEffect(() => { if (authed) load() }, [authed, load]);

  const effRaw = useMemo(() => {
    if (!row) return null;
    if (day !== "base" && row.overrides && (row.overrides as Record<string, unknown>)[day]) return (row.overrides as Record<string, unknown>)[day];
    return row.base;
  }, [row, day]);
  const saved: BaseV2 | null = useMemo(() => effRaw ? toV2(effRaw) : null, [effRaw]);
  const data: BaseV2 | null = draft || saved;
  const hasData = !!(data && (data.groups.length || data.students.length));
  const events = useMemo(() => data ? buildEvents(data) : [], [data]);
  const teachers = useMemo(() => { const s = new Set<string>(data?.teachers || []); events.forEach(e => s.add(e.teacher)); return [...s].sort() }, [data, events]);
  const rooms = useMemo(() => [...new Set(events.filter(e => e.room).map(e => e.room))].sort(), [events]);
  const stuNames = useMemo(() => data ? data.students.map(s => s.name) : [], [data]);
  useEffect(() => { if (!selT && teachers.length) setSelT(teachers[0]) }, [teachers, selT]);
  useEffect(() => { if (!selStu && stuNames.length) setSelStu(stuNames[0]) }, [stuNames, selStu]);
  useEffect(() => { if (!selR && rooms.length) setSelR(rooms[0]) }, [rooms, selR]);

  const ed: BaseV2 | null = draft; // editing copy
  function beginEdit() { if (!draft) setDraft(saved ? JSON.parse(JSON.stringify(saved)) : { v: 2, teachers: [], groups: [], students: [] }) }
  function upd(fn: (d: BaseV2) => void) { if (!draft) return; const d = JSON.parse(JSON.stringify(draft)); fn(d); setDraft(d) }

  async function save() {
    if (!draft) return;
    setBusy("Saving…");
    const payload: Record<string, unknown> = {};
    if (day === "base") payload.base = draft;
    else payload.overrides = { ...((row?.overrides as Record<string, unknown>) || {}), [day]: draft };
    let error;
    if (row) ({ error } = await supabase.from("class_schedules").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", row.id));
    else ({ error } = await supabase.from("class_schedules").insert({ week_start: weekStart, base: day === "base" ? draft : { v: 2, teachers: draft.teachers, groups: [], students: [] }, overrides: day === "base" ? {} : { [day]: draft } }));
    setBusy("");
    if (error) { alert("Save failed: " + error.message); return }
    await load(); setNav("master");
  }
  async function copyLastWeek() {
    setBusy("Copying…");
    const { data: p } = await supabase.from("class_schedules").select("base").eq("week_start", addD(weekStart, -7)).maybeSingle();
    setBusy("");
    if (!p?.base) { alert("No schedule last week"); return }
    if (row) await supabase.from("class_schedules").update({ base: p.base, updated_at: new Date().toISOString() }).eq("id", row.id);
    else await supabase.from("class_schedules").insert({ week_start: weekStart, base: p.base, overrides: {} });
    await load();
  }
  async function importSeed() {
    setBusy("Importing…");
    try {
      const seed = await fetch("/class-sched-seed.json").then(r => r.json());
      const v2 = toV2(seed);
      if (row) await supabase.from("class_schedules").update({ base: v2, updated_at: new Date().toISOString() }).eq("id", row.id);
      else await supabase.from("class_schedules").insert({ week_start: weekStart, base: v2, overrides: {} });
      await load();
    } catch { alert("Import failed") }
    setBusy("");
  }
  async function resetDay() {
    if (day === "base" || !row) return;
    if (!confirm("Remove this day's custom schedule and use Base Week?")) return;
    const ov = { ...((row.overrides as Record<string, unknown>) || {}) }; delete ov[day];
    await supabase.from("class_schedules").update({ overrides: ov, updated_at: new Date().toISOString() }).eq("id", row.id);
    await load();
  }

  /* ── shared render ── */
  const bySlot = (list: Ev[]) => { const m: Record<number, Ev[]> = {}; list.forEach(e => { (m[e.slot] = m[e.slot] || []).push(e) }); return m };
  function teacherTable(t: string) {
    const m = bySlot(events.filter(e => e.teacher === t));
    return (<table className="ct"><thead><tr><th style={{ width: 116 }}>Time</th><th>Assignment</th></tr></thead><tbody>
      {SLOTS.map((s, i) => {
        const es = m[i] || []; const gset: Record<string, Ev[]> = {}; const ones: Ev[] = [];
        es.forEach(e => { if (e.kind === "Group") { const k = e.gname + "|" + e.subject + "|" + e.room + "|" + (e.cover || ""); (gset[k] = gset[k] || []).push(e) } else ones.push(e) });
        const cells: ReactNode[] = [];
        Object.entries(gset).forEach(([k, arr], gi) => { const [gn, subj, room, cov] = k.split("|"); cells.push(<div key={"g" + gi}><span className="pill pg">{gn || "GROUP"}</span><b>{subj}</b><span className="rm"> {room}</span> — {arr.map(x => x.who).join(", ")}{cov && <span className="cov"> ({cov})</span>}</div>) });
        ones.forEach((e, oi) => cells.push(<div key={"o" + oi}><span className="pill p1">1:1</span><b>{e.subject}</b> — {e.who}{e.cover && <span className="cov"> ({e.cover})</span>}</div>));
        const conflict = Object.keys(gset).length + ones.length > 1;
        return <tr key={i} className={conflict ? "conf" : ""}><td className="tm">{s}{conflict ? " ⚠" : ""}</td><td>{cells.length ? cells : <span className="free">—</span>}</td></tr>;
      })}
    </tbody></table>);
  }
  function studentTable(name: string) {
    const list = events.filter(e => e.who === name && !(e.cover || "").startsWith("covering"));
    const m = bySlot(list);
    return (<table className="ct"><thead><tr><th style={{ width: 116 }}>Time</th><th>Type</th><th>Subject</th><th>Teacher</th><th>Room</th></tr></thead><tbody>
      {SLOTS.map((s, i) => {
        const es = m[i] || [];
        if (!es.length) return <tr key={i}><td className="tm">{s}</td><td colSpan={4} className="free">—</td></tr>;
        return es.map((e, j) => <tr key={i + "_" + j} className={e.kind === "Group" ? "grow" : ""}><td className="tm">{j === 0 ? s : ""}</td><td>{e.kind === "Group" ? e.gname || "Group" : "1:1"}</td><td><b>{e.subject}</b></td><td>{e.teacher}{e.cover ? " -" + e.cover : ""}</td><td>{e.room || "-"}</td></tr>);
      })}
    </tbody></table>);
  }
  const dayLabel = day === "base" ? "Base Week" : day + " (" + DAYS[(new Date(day + "T00:00:00").getDay() + 6) % 7] + ")";
  const hasOv = (d: string) => !!(row?.overrides && (row.overrides as Record<string, unknown>)[d]);
  const grpOcc = useMemo(() => { // student slot occupied by group
    const m: Record<string, Record<number, string>> = {};
    (ed || data)?.groups.forEach(g => g.sessions.forEach(se => g.members.forEach(mm => { (m[mm] = m[mm] || {})[se.slot] = g.name + " · " + se.subject })));
    return m;
  }, [ed, data]);

  if (!authed) return null;
  return (
    <div className="wrap">
      <style>{`
      *{box-sizing:border-box}.wrap{font-family:'Segoe UI','Noto Sans KR',sans-serif;background:#f4f6fa;min-height:100vh}
      .top{background:#fff;border-bottom:1px solid #e2e8f0;padding:12px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;position:sticky;top:0;z-index:20}
      .top h1{font-size:17px;margin:0;color:#1e293b}.top a{color:#3b5bdb;text-decoration:none;font-weight:700;font-size:13px}
      .lay{display:flex;min-height:calc(100vh - 57px)}
      .side{width:190px;background:#fff;border-right:1px solid #e2e8f0;padding:14px 10px;flex-shrink:0}
      .sitem{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;font-weight:800;font-size:13.5px;color:#475569;cursor:pointer;margin-bottom:4px}
      .sitem.on{background:#eef2ff;color:#3730a3}
      .side .sec{font-size:10.5px;font-weight:800;color:#94a3b8;letter-spacing:.08em;margin:14px 8px 6px}
      .main{flex:1;padding:16px 20px;min-width:0}
      .btn{background:#fff;border:1.5px solid #d7e0ea;border-radius:8px;padding:7px 13px;font-weight:800;font-size:12.5px;cursor:pointer;color:#334155}
      .btn.on{background:#3b5bdb;color:#fff;border-color:#3b5bdb}
      .btn.grn{background:#0e9f6e;color:#fff;border-color:#0e9f6e}
      .btn.warn{background:#fff7e6;border-color:#f0c36d;color:#92400e}
      .bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
      .tb{background:#fff;border:1.5px solid #d7e0ea;border-radius:8px;padding:5px 11px;font-weight:800;font-size:12px;cursor:pointer;color:#334155}
      .tb.on{background:#3b5bdb;color:#fff;border-color:#3b5bdb}
      table.ct{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 5px rgba(15,23,42,.06);margin-bottom:16px}
      .ct th{background:#eef2f7;color:#334155;padding:9px 12px;font-size:12.5px;text-align:left;border-bottom:2px solid #cbd5e1}
      .ct td{padding:9px 12px;border-bottom:1px solid #edf2f7;font-size:13.5px;vertical-align:top;color:#1e293b}
      .tm{white-space:nowrap;font-weight:800;color:#334155}
      .pill{display:inline-block;padding:1px 8px;border-radius:20px;font-size:10.5px;font-weight:800;margin-right:6px}
      .pg{background:#dbeafe;color:#1d4ed8}.p1{background:#dcfce7;color:#15803d}
      .rm{color:#b45309;font-weight:800;font-size:12px}.cov{color:#dc2626;font-weight:800;font-size:11.5px}
      .conf td{background:#fee2e2}.free{color:#cbd5e1}.grow td{background:#f5f8fd}
      .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;box-shadow:0 1px 5px rgba(15,23,42,.05)}
      .gcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}
      .ghead{display:flex;align-items:center;gap:8px;margin-bottom:8px}
      .ghead input{font-weight:800;font-size:14px;border:none;border-bottom:1.5px dashed #cbd5e1;padding:2px 4px;width:120px;font-family:inherit;outline:none}
      .mini{font-size:11px;color:#64748b;font-weight:700}
      .sesrow{display:flex;gap:5px;align-items:center;margin-bottom:5px}
      .sesrow select,.sesrow input{border:1px solid #dde5ee;border-radius:7px;padding:5px 6px;font-size:12px;font-family:inherit;background:#fff}
      .memwrap{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
      .memchip{font-size:11px;font-weight:700;border:1px solid #dde5ee;border-radius:14px;padding:2px 9px;cursor:pointer;background:#fff;color:#475569}
      .memchip.on{background:#3b5bdb;color:#fff;border-color:#3b5bdb}
      .ox{overflow-x:auto}
      .m11{border-collapse:collapse;background:#fff;font-size:11.5px;min-width:1050px}
      .m11 th{background:#eef2f7;color:#334155;padding:6px;border:1px solid #dde5ee;font-size:11px;position:sticky;top:0}
      .m11 td{border:1px solid #e6ecf3;padding:2px;vertical-align:top;min-width:108px}
      .m11 .stn{font-weight:800;white-space:nowrap;padding:6px 8px;background:#fafcff;position:sticky;left:0}
      .gocc{background:#f1f5f9;color:#94a3b8;font-size:10.5px;font-weight:700;padding:5px 6px;border-radius:5px;text-align:center}
      .cellsel{width:100%;border:none;font-size:11px;padding:3px 2px;background:transparent;font-family:inherit}
      .oneCell{background:#f0fdf4;border-radius:6px;padding:2px}
      .pa{display:none}
      @media print{
        .top,.side,.bar,.noprint{display:none!important}.wrap{background:#fff}.main{padding:0}
        .pa{display:block}.pa .tpage{page-break-after:always;padding:0}
        .pa .half{padding:4px 0 8px}.pa .half h3{margin:2px 0 6px;font-size:15px;color:#000}
        .pa .pmeta{font-weight:600;font-size:11.5px;color:#555}
        .pa .half .ct{margin-bottom:6px}.pa .half .ct td{padding:4px 9px;font-size:11.5px}.pa .half .ct th{padding:5px 9px;font-size:11px}
        table.ct{box-shadow:none}
        .ct th{background:#fff!important;color:#222!important;border:1px solid #999;font-weight:900}
        .ct td{border:1px solid #bbb;color:#222}
        .conf td,.grow td{background:#fff!important}
        .pill{background:#fff!important;color:#333!important;border:1px solid #999}
        .rm,.cov,.tm{color:#222!important}h2{color:#000}
      }
      `}</style>

      <div className="top">
        <h1>🗓 Class Schedule System</h1>
        <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>Week {weekStart} · {dayLabel}</span>
        <span style={{ marginLeft: "auto" }} />
        {canEdit && <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 800 }}>EDITOR</span>}
        <a href="/admineng/hub">← Hub</a>
      </div>

      <div className="lay">
        <div className="side noprint">
          <div className="sec">BUILD</div>
          <div className={"sitem" + (nav === "groups" ? " on" : "")} onClick={() => { setNav("groups"); if (canEdit) beginEdit() }}>👥 Groups</div>
          <div className={"sitem" + (nav === "one" ? " on" : "")} onClick={() => { setNav("one"); if (canEdit) beginEdit() }}>🧑‍🏫 1:1 Matrix</div>
          <div className="sec">RESULT</div>
          <div className={"sitem" + (nav === "master" ? " on" : "")} onClick={() => setNav("master")}>🗂 Master</div>
          {draft && canEdit && <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            <button className="btn grn" onClick={save}>{busy || "💾 Save & Compose"}</button>
            <button className="btn" onClick={() => { setDraft(null) }}>Discard changes</button>
          </div>}
        </div>

        <div className="main">
          <div className="bar noprint">
            <button className="btn" onClick={() => { setWeekStart(addD(weekStart, -7)); setDay("base") }}>◀</button>
            <b style={{ fontSize: 13.5 }}>{weekStart} ~ {addD(weekStart, 5)}</b>
            <button className="btn" onClick={() => { setWeekStart(addD(weekStart, 7)); setDay("base") }}>▶</button>
            <span style={{ width: 8 }} />
            <button className={"btn" + (day === "base" ? " on" : "")} onClick={() => { setDay("base"); setDraft(null) }}>Base Week</button>
            {DAYS.map((d, i) => { const ds = addD(weekStart, i); return <button key={d} className={"btn" + (day === ds ? " on" : "")} onClick={() => { setDay(ds); setDraft(null) }}>{d}{hasOv(ds) ? " ✱" : ""}</button> })}
            <span style={{ marginLeft: "auto" }} />
            {canEdit && day !== "base" && hasOv(day) && <button className="btn warn" onClick={resetDay}>↩ Reset day</button>}
            <button className="btn" onClick={() => { setPrintAll(null); setTimeout(() => window.print(), 60) }}>🖨 Print this view</button>
            <button className="btn grn" onClick={() => { setPrintAll("t"); setTimeout(() => { window.print(); setPrintAll(null) }, 150) }}>🖨 ALL teachers (2/page)</button>
            <button className="btn grn" onClick={() => { setPrintAll("s"); setTimeout(() => { window.print(); setPrintAll(null) }, 150) }}>🖨 ALL students (2/page)</button>
          </div>

          {loading ? <div style={{ padding: 30, color: "#94a3b8" }}>Loading…</div> : !hasData && !draft ? (
            <div className="card" style={{ textAlign: "center", padding: 34 }}>
              <p style={{ fontWeight: 800, fontSize: 15 }}>No schedule for this week yet.</p>
              {canEdit && <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn grn" onClick={copyLastWeek}>{busy || "📋 Copy last week"}</button>
                <button className="btn" onClick={importSeed}>⬇ Import AUG 4 master</button>
                <button className="btn" onClick={() => { beginEdit(); setNav("groups") }}>✏️ Start empty</button>
              </div>}
            </div>
          ) : (<>

            {/* ─── GROUPS ─── */}
            {nav === "groups" && (canEdit && ed ? (
              <>
                <div className="bar">
                  <button className="btn grn" onClick={() => upd(d => d.groups.push({ id: uid(), name: "Group " + (d.groups.length + 1), room: "ROOM 1", members: [], sessions: [] }))}>+ New group</button>
                  <span className="mini">Group = time + students + teacher → goes into every member&apos;s & teacher&apos;s schedule automatically.</span>
                </div>
                <div className="card" style={{ marginBottom: 12 }}>
                  <span className="mini">TEACHERS (comma separated)</span>
                  <input style={{ width: "100%", border: "1px solid #dde5ee", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, marginTop: 4, fontFamily: "inherit" }} value={(ed.teachers || []).join(", ")} onChange={e => upd(d => { d.teachers = e.target.value.split(",").map(x => x.trim().toUpperCase()).filter(Boolean) })} />
                  <div style={{ marginTop: 10 }}>
                    <span className="mini">STUDENT POOL ({ed.students.length}) — click ✕ to remove, type to add</span>
                    <div className="memwrap">
                      {ed.students.map((s, i) => <span key={i} className="memchip">{s.name} <span style={{ cursor: "pointer", color: "#dc2626", fontWeight: 900 }} onClick={() => { if (confirm("Remove " + s.name + "?")) upd(d => { d.students.splice(i, 1); d.groups.forEach(g => g.members = g.members.filter(m => m !== s.name)) }) }}>✕</span></span>)}
                      <input placeholder="+ add student, Enter" style={{ border: "1px dashed #cbd5e1", borderRadius: 14, padding: "2px 10px", fontSize: 11.5, fontFamily: "inherit", width: 150 }} onKeyDown={e => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim().toUpperCase(); if (v) { upd(d => d.students.push({ name: v, sessions: [] })); (e.target as HTMLInputElement).value = "" } } }} />
                    </div>
                  </div>
                </div>
                <div className="gcards">
                  {ed.groups.map((g, gi) => (
                    <div className="card" key={g.id}>
                      <div className="ghead">
                        <input value={g.name} onChange={e => upd(d => { d.groups[gi].name = e.target.value })} />
                        <select style={{ border: "1px solid #dde5ee", borderRadius: 7, padding: "4px 6px", fontSize: 12 }} value={g.room} onChange={e => upd(d => { d.groups[gi].room = e.target.value })}>
                          {["ROOM 1", "ROOM 2", "ROOM 3", "ROOM 4", "ROOM 5", "ROOM 6"].map(r => <option key={r}>{r}</option>)}
                        </select>
                        <span style={{ marginLeft: "auto" }} />
                        <button className="tb" style={{ color: "#dc2626" }} onClick={() => { if (confirm("Delete " + g.name + "?")) upd(d => d.groups.splice(gi, 1)) }}>🗑</button>
                      </div>
                      <span className="mini">MEMBERS ({g.members.length})</span>
                      <div className="memwrap">
                        {g.members.map(m => <span key={m} className="memchip on" onClick={() => { if (confirm("Remove " + m + " from " + g.name + "?")) upd(d => { d.groups[gi].members = d.groups[gi].members.filter(x => x !== m) }) }}>{m} ✕</span>)}
                        <select style={{ border: "1px dashed #cbd5e1", borderRadius: 14, padding: "2px 8px", fontSize: 11.5, fontFamily: "inherit", background: "#fff", color: "#64748b", maxWidth: 150 }} value="" onChange={e => { const v = e.target.value; if (v) upd(d => { if (!d.groups[gi].members.includes(v)) d.groups[gi].members.push(v) }) }}>
                          <option value="">+ add member</option>
                          {ed.students.filter(s => !g.members.includes(s.name)).map(s => {
                            const other = ed.groups.find(G2 => G2.id !== g.id && G2.members.includes(s.name));
                            return <option key={s.name} value={s.name}>{s.name}{other ? "  (in " + other.name + ")" : ""}</option>;
                          })}
                        </select>
                      </div>
                      <span className="mini">CLASS TIMES</span>
                      {g.sessions.map((se, si) => (
                        <div className="sesrow" key={si}>
                          <select value={se.slot} onChange={e => upd(d => { d.groups[gi].sessions[si].slot = Number(e.target.value) })}>{SLOTS.map((s, i) => <option key={i} value={i}>{s}</option>)}</select>
                          <select value={se.subject} onChange={e => upd(d => { d.groups[gi].sessions[si].subject = e.target.value })}>{SUBJ_OPT.map(x => <option key={x}>{x}</option>)}{!SUBJ_OPT.includes(se.subject) && se.subject && <option>{se.subject}</option>}</select>
                          <select value={se.teacher} onChange={e => upd(d => { d.groups[gi].sessions[si].teacher = e.target.value })}><option value=""></option>{(ed.teachers || []).map(t => <option key={t}>{t}</option>)}{se.teacher && !(ed.teachers || []).includes(se.teacher) && <option>{se.teacher}</option>}</select>
                          <button className="tb" style={{ color: "#dc2626", padding: "2px 7px" }} onClick={() => upd(d => d.groups[gi].sessions.splice(si, 1))}>✕</button>
                        </div>
                      ))}
                      <button className="tb" onClick={() => upd(d => d.groups[gi].sessions.push({ slot: 0, subject: GRP_SUBJ[d.groups[gi].sessions.length % 4], teacher: "" }))}>+ time</button>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="card">Read only — ask AXL / SUZY / ERICA to edit. <span style={{ color: "#94a3b8" }}>(you: {me || "?"})</span></div>)}

            {/* ─── 1:1 MATRIX ─── */}
            {nav === "one" && (canEdit && ed ? (
              <>
                <span className="mini">Grey = taken by a group class. Green = 1:1 (choose subject &amp; teacher). Blank = free.</span>
                <div className="bar" style={{ marginTop: 8 }}>
                  <button className={"tb" + (oneG === "all" ? " on" : "")} onClick={() => setOneG("all")}>All ({ed.students.length})</button>
                  {ed.groups.map(g => <button key={g.id} className={"tb" + (oneG === g.id ? " on" : "")} onClick={() => setOneG(g.id)}>{g.name} ({g.members.length})</button>)}
                  {(() => { const inG = new Set(ed.groups.flatMap(g => g.members)); const no = ed.students.filter(s => !inG.has(s.name)).length; return no > 0 ? <button className={"tb" + (oneG === "none" ? " on" : "")} onClick={() => setOneG("none")}>No group ({no})</button> : null })()}
                </div>
                <div className="ox card" style={{ padding: 6, marginTop: 4 }}>
                  <table className="m11"><thead><tr><th style={{ minWidth: 110 }}>Student</th>{SLOTS.map(s => <th key={s}>{s}</th>)}</tr></thead><tbody>
                    {ed.students.map((s, si) => {
                      if (oneG !== "all") {
                        if (oneG === "none") { if (ed.groups.some(g => g.members.includes(s.name))) return null }
                        else { const G = ed.groups.find(g => g.id === oneG); if (!G || !G.members.includes(s.name)) return null }
                      }
                      return (
                      <tr key={s.name}>
                        <td className="stn">{s.name}</td>
                        {SLOTS.map((_, sl) => {
                          const occ = grpOcc[s.name]?.[sl];
                          if (occ) return <td key={sl}><div className="gocc">{occ}</div></td>;
                          const sesIdx = s.sessions.findIndex(x => x.slot === sl);
                          const ses = sesIdx >= 0 ? s.sessions[sesIdx] : null;
                          return <td key={sl} className={ses ? "oneCell" : ""}>
                            <select className="cellsel" value={ses?.subject || ""} onChange={e => upd(d => { const st = d.students[si]; const v = e.target.value; const ix = st.sessions.findIndex(x => x.slot === sl); if (!v) { if (ix >= 0) st.sessions.splice(ix, 1) } else if (ix >= 0) st.sessions[ix].subject = v; else st.sessions.push({ slot: sl, subject: v, teacher: "" }) })}>
                              <option value="">—</option>{SUBJ_OPT.map(x => <option key={x}>{x}</option>)}
                            </select>
                            {ses && <select className="cellsel" value={ses.teacher} onChange={e => upd(d => { const st = d.students[si]; const ix = st.sessions.findIndex(x => x.slot === sl); if (ix >= 0) st.sessions[ix].teacher = e.target.value })}>
                              <option value="">teacher?</option>{(ed.teachers || []).map(t => <option key={t}>{t}</option>)}{ses.teacher && !(ed.teachers || []).includes(ses.teacher) && <option>{ses.teacher}</option>}
                            </select>}
                          </td>;
                        })}
                      </tr>
                    )})}
                  </tbody></table>
                </div>
              </>
            ) : <div className="card">Read only — ask AXL / SUZY / ERICA to edit. <span style={{ color: "#94a3b8" }}>(you: {me || "?"})</span></div>)}

            {/* ─── MASTER ─── */}
            {nav === "master" && !printAll && (
              <>
                {draft && <div className="card noprint" style={{ marginBottom: 10, background: "#fff7e6", borderColor: "#f0c36d", fontWeight: 700, fontSize: 12.5 }}>⚠ You have unsaved edits — press 💾 Save &amp; Compose (left) to apply.</div>}
                <div className="bar noprint">
                  {(["now", "timeline", "teacher", "student", "room", "grid"] as const).map(v => <button key={v} className={"tb" + (mview === v ? " on" : "")} onClick={() => setMview(v)}>{v === "now" ? "⏰ Now" : v === "timeline" ? "📊 Timeline" : v === "teacher" ? "👩‍🏫 By Teacher" : v === "student" ? "🧒 By Student" : v === "room" ? "🚪 By Room" : "🗂 Grid"}</button>)}
                </div>
                {mview === "now" && (() => {
                  const { cur, next } = nowSlotPH();
                  const autoSlot = cur >= 0 ? cur : next >= 0 ? next : 0;
                  const showSlot = slotOv !== null ? slotOv : autoSlot;
                  const isBreak = cur < 0 && slotOv === null;
                  const es = events.filter(e => e.slot === showSlot && !(e.cover || "").startsWith("covering"));
                  const q = findQ.trim().toUpperCase();
                  const match = (e: Ev) => !q || e.who.toUpperCase().includes(q) || e.teacher.toUpperCase().includes(q);
                  const gset: Record<string, Ev[]> = {}; const ones: Ev[] = [];
                  es.forEach(e => { if (e.kind === "Group") { const k = e.gname + "|" + e.subject + "|" + e.room + "|" + e.teacher; (gset[k] = gset[k] || []).push(e) } else ones.push(e) });
                  return (<>
                    <div className="card" style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 20, fontWeight: 800 }}>⏰ {SLOTS[showSlot]}</span>
                      <span style={{ background: isBreak ? "#fff7e6" : "#dcfce7", color: isBreak ? "#92400e" : "#166534", borderRadius: 20, padding: "3px 12px", fontSize: 12.5, fontWeight: 800 }}>{isBreak ? "Break — next class" : "In class now"}</span>
                      <input placeholder="🔍 student or teacher name…" value={findQ} onChange={e => setFindQ(e.target.value)} style={{ marginLeft: "auto", border: "1.5px solid #d7e0ea", borderRadius: 9, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", minWidth: 220 }} />
                      <div style={{ display: "flex", gap: 4 }}>
                        {SLOTS.map((_, i) => <button key={i} className={"tb" + (i === showSlot ? " on" : "")} style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => setSlotOv(i === autoSlot ? null : i)} title={SLOTS[i]}>{i + 1}</button>)}
                      </div>
                    </div>
                    <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>Group classes</h2>
                    <div className="gcards" style={{ marginBottom: 16 }}>
                      {Object.entries(gset).filter(([, arr]) => arr.some(match)).map(([k, arr]) => { const [gn, subj, room, t] = k.split("|");
                        return <div className="card" key={k} style={{ borderLeft: "4px solid #7F77DD", borderRadius: 10 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}><b style={{ fontSize: 14 }}>{gn || "Group"}</b><span className="pill pg">{subj}</span><span className="rm">{room}</span><span style={{ marginLeft: "auto", fontWeight: 800, color: "#3730a3" }}>{t}</span></div>
                          <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.7 }}>{arr.map(x => <span key={x.who} style={{ marginRight: 8, fontWeight: q && x.who.toUpperCase().includes(q) ? 900 : 500, background: q && x.who.toUpperCase().includes(q) ? "#fef08a" : "transparent", borderRadius: 4, padding: "0 2px" }}>{x.who}</span>)}</div>
                        </div>; })}
                    </div>
                    <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>1:1 classes</h2>
                    <div className="card" style={{ padding: 0 }}>
                      <table className="ct" style={{ margin: 0, boxShadow: "none" }}><thead><tr><th>Teacher</th><th>Student</th><th>Subject</th></tr></thead><tbody>
                        {ones.filter(match).sort((a, b) => a.teacher < b.teacher ? -1 : 1).map((e, i) => <tr key={i}>
                          <td style={{ fontWeight: 800, background: q && e.teacher.toUpperCase().includes(q) ? "#fef08a" : undefined }}>{e.teacher}</td>
                          <td style={{ fontWeight: 700, background: q && e.who.toUpperCase().includes(q) ? "#fef08a" : undefined }}>{e.who}</td>
                          <td><span className="pill p1">{e.subject}</span></td>
                        </tr>)}
                        {ones.filter(match).length === 0 && <tr><td colSpan={3} className="free">—</td></tr>}
                      </tbody></table>
                    </div>
                  </>);
                })()}
                {mview === "timeline" && (() => {
                  const { cur } = nowSlotPH();
                  const grpBy: Record<string, Record<number, Ev[]>> = {};
                  events.filter(e => e.kind === "Group" && !(e.cover || "").startsWith("covering")).forEach(e => { const r = e.room || "?"; (grpBy[r] = grpBy[r] || {}); (grpBy[r][e.slot] = grpBy[r][e.slot] || []).push(e) });
                  const roomsT = Object.keys(grpBy).sort();
                  const oneCnt: Record<number, number> = {}; events.filter(e => e.kind === "1:1" && !(e.cover || "").startsWith("covering")).forEach(e => oneCnt[e.slot] = (oneCnt[e.slot] || 0) + 1);
                  return (<div className="ox"><table className="ct" style={{ minWidth: 1050 }}><thead><tr><th style={{ width: 90 }}>Room</th>{SLOTS.map((sl, i) => <th key={i} style={i === cur ? { background: "#fde68a", color: "#78350f" } : {}}>{sl}{i === cur ? " ⏰" : ""}</th>)}</tr></thead><tbody>
                    {roomsT.map(r => <tr key={r}><td style={{ fontWeight: 800 }}>{r}</td>
                      {SLOTS.map((_, i) => { const arr = grpBy[r][i] || []; const seen: Record<string, Ev[]> = {}; arr.forEach(e => { const k = e.gname + "|" + e.subject + "|" + e.teacher; (seen[k] = seen[k] || []).push(e) });
                        return <td key={i} style={i === cur ? { background: "#fffbeb" } : {}}>{Object.entries(seen).map(([k, a2], j) => { const [gn, subj, t] = k.split("|"); return <div key={j} style={{ background: "#eef2ff", borderRadius: 6, padding: "3px 6px", marginBottom: 2, fontSize: 11.5 }}><b>{gn}</b> {subj}<br /><span style={{ color: "#3730a3", fontWeight: 800 }}>{t}</span> · {a2.length}명</div> }) || <span className="free">—</span>}</td>; })}
                    </tr>)}
                    <tr><td style={{ fontWeight: 800, color: "#15803d" }}>1:1</td>{SLOTS.map((_, i) => <td key={i} style={i === cur ? { background: "#fffbeb" } : {}}>{oneCnt[i] ? <span className="pill p1">{oneCnt[i]}건</span> : <span className="free">—</span>}</td>)}</tr>
                  </tbody></table></div>);
                })()}
                {mview === "teacher" && <>
                  <div className="bar noprint">{teachers.map(t => <button key={t} className={"tb" + (selT === t ? " on" : "")} onClick={() => setSelT(t)}>{t}</button>)}</div>
                  <h2 style={{ margin: "4px 0 10px" }}>{selT}</h2>{selT && teacherTable(selT)}
                </>}
                {mview === "student" && <>
                  <div className="bar noprint">{stuNames.map(n => <button key={n} className={"tb" + (selStu === n ? " on" : "")} onClick={() => setSelStu(n)}>{n}</button>)}</div>
                  <h2 style={{ margin: "4px 0 10px" }}>{selStu}</h2>{selStu && studentTable(selStu)}
                </>}
                {mview === "room" && <>
                  <div className="bar noprint">{rooms.map(r => <button key={r} className={"tb" + (selR === r ? " on" : "")} onClick={() => setSelR(r)}>{r}</button>)}</div>
                  <h2 style={{ margin: "4px 0 10px" }}>{selR}</h2>
                  <table className="ct"><thead><tr><th style={{ width: 116 }}>Time</th><th>Class</th></tr></thead><tbody>
                    {SLOTS.map((s, i) => {
                      const es = events.filter(e => e.room === selR && e.kind === "Group" && e.slot === i && !(e.cover || "").startsWith("covering"));
                      const g: Record<string, Ev[]> = {}; es.forEach(e => { const k = e.gname + "|" + e.subject + "|" + e.teacher; (g[k] = g[k] || []).push(e) });
                      return <tr key={i}><td className="tm">{s}</td><td>{Object.keys(g).length ? Object.entries(g).map(([k, arr], gi) => { const [gn, subj, t] = k.split("|"); return <div key={gi}><span className="pill pg">{gn}</span><b>{subj}</b> · {t} — {arr.map(x => x.who).join(", ")}</div> }) : <span className="free">—</span>}</td></tr>;
                    })}
                  </tbody></table>
                </>}
                {mview === "grid" && <div className="ox">
                  <table className="ct" style={{ minWidth: 1100 }}><thead><tr><th>Teacher</th>{SLOTS.map(s => <th key={s}>{s}</th>)}</tr></thead><tbody>
                    {teachers.map(t => {
                      const m = bySlot(events.filter(e => e.teacher === t));
                      return <tr key={t}><td style={{ fontWeight: 800, whiteSpace: "nowrap" }}>{t}</td>
                        {SLOTS.map((_, i) => {
                          const es = m[i] || []; if (!es.length) return <td key={i} className="free">—</td>;
                          const g = es.filter(e => e.kind === "Group"); const o = es.filter(e => e.kind === "1:1");
                          const conf = (g.length ? 1 : 0) + o.length > 1;
                          return <td key={i} style={conf ? { background: "#fee2e2" } : {}}>
                            {g.length > 0 && <div style={{ background: "#eef4fb", fontSize: 11, fontWeight: 700 }}>{g[0].gname} {g[0].subject} {g[0].room}</div>}
                            {o.map((e, oi) => <div key={oi} style={{ background: "#f0fdf4", fontSize: 11 }}>{e.subject.slice(0, 4)} · {e.who}</div>)}
                          </td>;
                        })}</tr>;
                    })}
                  </tbody></table>
                </div>}
              </>
            )}

            <div className="pa">
              {printAll === "t" && Array.from({ length: Math.ceil(teachers.length / 2) }, (_, i) => teachers.slice(i * 2, i * 2 + 2)).map((pair, pi) => (
                <div className="tpage" key={pi}>
                  {pair.map(t => <div className="half" key={t}><h3>{t} <span className="pmeta">— {dayLabel} · Week {weekStart}</span></h3>{teacherTable(t)}</div>)}
                </div>
              ))}
              {printAll === "s" && Array.from({ length: Math.ceil(stuNames.length / 2) }, (_, i) => stuNames.slice(i * 2, i * 2 + 2)).map((pair, pi) => (
                <div className="tpage" key={pi}>
                  {pair.map(n => <div className="half" key={n}><h3>{n} <span className="pmeta">— {dayLabel} · Week {weekStart}</span></h3>{studentTable(n)}</div>)}
                </div>
              ))}
            </div>
          </>)}
        </div>
      </div>
    </div>
  );
}
