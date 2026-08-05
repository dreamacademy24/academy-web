"use client";
import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

/* ── Class Schedule Builder (weekly base + per-day override) ──
   Editors: app_settings.class_sched_editors (admin-axl / admin-suzy / admin-erica) */

interface Stu { name: string; phase: "junior" | "lower"; room: string; cls: string; grp: string[]; one: string[] }
interface Base { teachers: string[]; students: Stu[] }
interface Row { id: string; week_start: string; base: Base; overrides: Record<string, Base> }

const SLOTS = ["9:00–9:40", "9:45–10:25", "10:30–11:15", "11:20–12:00", "12:50–13:30", "13:35–14:20", "14:40–15:15", "15:20–16:00"];
const GRP_SUBJ = ["BTS", "SOLOMON", "DREAM", "FUN"];
const ONE_SUBJ = ["SPEAKING", "LISTENING", "READING", "WRITING"];
const ROOMS_OPT = ["ROOM 1", "ROOM 2", "ROOM 3", "ROOM 4"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number) { return String(n).padStart(2, "0") }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function mondayOf(d: Date) { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x }
function addD(s: string, n: number) { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d) }
function normRoom(r: string) { return (r || "").toUpperCase().replace(/\s+/g, " ").trim() }
function splitTeacher(t: string): [string, string | null] {
  const s = (t || "").replace(/\s+/g, " ").trim();
  const m = s.split(/\s*-\s*/);
  if (m.length === 2 && m[1]) return [m[0].trim(), m[1].trim()];
  return [s, null];
}
interface Ev { slot: number; teacher: string; kind: "Group" | "1:1"; subj: string; who: string; room: string; cover: string | null }
function buildEvents(b: Base): Ev[] {
  const out: Ev[] = [];
  const push = (slot: number, raw: string, kind: "Group" | "1:1", subj: string, who: string, room: string) => {
    if (!raw) return;
    const [p, cov] = splitTeacher(raw);
    if (!p) return;
    out.push({ slot, teacher: p, kind, subj, who, room, cover: cov });
    if (cov) out.push({ slot, teacher: cov, kind, subj, who, room, cover: "covering " + p });
  };
  (b.students || []).forEach(s => {
    for (let g = 0; g < 4; g++) {
      if (s.phase === "junior") {
        push(g * 2, s.grp[g], "Group", GRP_SUBJ[g], s.name, normRoom(s.room));
        push(g * 2 + 1, s.one[g], "1:1", ONE_SUBJ[g], s.name, "");
      } else {
        push(g * 2, s.one[g], "1:1", ONE_SUBJ[g], s.name, "");
        push(g * 2 + 1, s.grp[g], "Group", GRP_SUBJ[g], s.name, normRoom(s.room));
      }
    }
  });
  return out;
}

export default function ClassSchedule() {
  const [authed, setAuthed] = useState(false);
  const [me, setMe] = useState("");
  const [editors, setEditors] = useState<string[]>([]);
  const [weekStart, setWeekStart] = useState(() => ymd(mondayOf(new Date())));
  const [row, setRow] = useState<Row | null>(null);
  const [day, setDay] = useState<string>("base"); // 'base' | YYYY-MM-DD
  const [view, setView] = useState<"teacher" | "student" | "room" | "master" | "edit">("teacher");
  const [selT, setSelT] = useState("");
  const [selR, setSelR] = useState("ROOM 1");
  const [selStu, setSelStu] = useState("");
  const [draft, setDraft] = useState<Base | null>(null);
  const [busy, setBusy] = useState("");
  const [printAll, setPrintAll] = useState<null | "t" | "s">(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("teacherSession");
      if (raw && JSON.parse(raw)?.username) { setMe(String(JSON.parse(raw).username || "")); setAuthed(true); return; }
    } catch { }
    window.location.href = "/admineng/hub";
  }, []);
  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "class_sched_editors").maybeSingle()
      .then(({ data }) => { if (Array.isArray(data?.value)) setEditors(data!.value as string[]) });
  }, []);
  const canEdit = editors.includes(me) || me === "admin-ceo" || me === "admin-jun"; // CEO·관리자 상시 허용

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("class_schedules").select("*").eq("week_start", weekStart).maybeSingle();
    setRow((data as Row) || null); setDraft(null); setLoading(false);
  }, [weekStart]);
  useEffect(() => { if (authed) load() }, [authed, load]);

  const effBase: Base | null = useMemo(() => {
    if (!row) return null;
    if (day !== "base" && row.overrides && row.overrides[day]) return row.overrides[day];
    return row.base && row.base.students ? row.base : null;
  }, [row, day]);
  const data: Base | null = draft || effBase;
  const events = useMemo(() => data ? buildEvents(data) : [], [data]);
  const teachers = useMemo(() => {
    const set = new Set<string>(data?.teachers || []);
    events.forEach(e => set.add(e.teacher));
    return [...set].sort();
  }, [data, events]);
  const rooms = useMemo(() => [...new Set(events.filter(e => e.room).map(e => e.room))].sort(), [events]);
  useEffect(() => { if (!selT && teachers.length) setSelT(teachers[0]) }, [teachers, selT]);
  useEffect(() => { if (!selStu && data?.students?.length) setSelStu(data.students[0].name) }, [data, selStu]);

  /* ── save helpers ── */
  async function saveDraft() {
    if (!draft || !row && day !== "base") { }
    setBusy("Saving…");
    const payload: Partial<Row> = {};
    if (day === "base") payload.base = draft!;
    else payload.overrides = { ...(row?.overrides || {}), [day]: draft! };
    let error;
    if (row) ({ error } = await supabase.from("class_schedules").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", row.id));
    else ({ error } = await supabase.from("class_schedules").insert({ week_start: weekStart, base: day === "base" ? draft : { teachers: draft!.teachers, students: [] }, overrides: day === "base" ? {} : { [day]: draft } }));
    setBusy("");
    if (error) { alert("Save failed: " + error.message); return }
    await load(); alert("Saved ✓");
  }
  async function copyLastWeek() {
    setBusy("Copying…");
    const prev = addD(weekStart, -7);
    const { data: p } = await supabase.from("class_schedules").select("base").eq("week_start", prev).maybeSingle();
    setBusy("");
    if (!p?.base?.students?.length) { alert("No schedule found for last week (" + prev + ")"); return }
    if (row) await supabase.from("class_schedules").update({ base: p.base, updated_at: new Date().toISOString() }).eq("id", row.id);
    else await supabase.from("class_schedules").insert({ week_start: weekStart, base: p.base, overrides: {} });
    await load();
  }
  async function importSeed() {
    setBusy("Importing…");
    try {
      const seed = await fetch("/class-sched-seed.json").then(r => r.json());
      if (row) await supabase.from("class_schedules").update({ base: seed, updated_at: new Date().toISOString() }).eq("id", row.id);
      else await supabase.from("class_schedules").insert({ week_start: weekStart, base: seed, overrides: {} });
      await load();
    } catch (e) { alert("Import failed") }
    setBusy("");
  }
  async function resetDay() {
    if (day === "base" || !row) return;
    if (!confirm("Remove the custom schedule for this day and use the base week?")) return;
    const ov = { ...(row.overrides || {}) }; delete ov[day];
    await supabase.from("class_schedules").update({ overrides: ov, updated_at: new Date().toISOString() }).eq("id", row.id);
    await load();
  }
  function setRoomGrp(ph: "junior" | "lower", room: string, gi: number, val: string) {
    if (!draft) return;
    setDraft({ ...draft, students: draft.students.map(s => (s.phase === ph && normRoom(s.room) === room) ? { ...s, grp: s.grp.map((g, i) => i === gi ? val : g) } : s) });
  }
  function roomGrpOf(ph: "junior" | "lower", room: string): string[] {
    const s = (draft?.students || []).find(x => x.phase === ph && normRoom(x.room) === room);
    return s ? s.grp : ["", "", "", ""];
  }
  function moveStudentRoom(si: number, room: string) {
    if (!draft) return;
    const s = draft.students[si];
    const donor = draft.students.find(x => x.phase === s.phase && normRoom(x.room) === room && x !== s);
    const st = [...draft.students];
    st[si] = { ...s, room, grp: donor ? [...donor.grp] : s.grp };
    setDraft({ ...draft, students: st });
  }
  function startEdit() {
    if (!effBase) { setDraft({ teachers: [], students: [] }); setView("edit"); return }
    setDraft(JSON.parse(JSON.stringify(effBase))); setView("edit");
  }

  /* ── render helpers ── */
  const bySlot = (list: Ev[]) => { const m: Record<number, Ev[]> = {}; list.forEach(e => { (m[e.slot] = m[e.slot] || []).push(e) }); return m };
  function teacherTable(t: string) {
    const m = bySlot(events.filter(e => e.teacher === t));
    return (
      <table className="ct"><thead><tr><th style={{ width: 118 }}>Time</th><th>Assignment</th></tr></thead><tbody>
        {SLOTS.map((s, i) => {
          const es = m[i] || [];
          const groups: Record<string, Ev[]> = {}; const ones: Ev[] = [];
          es.forEach(e => { if (e.kind === "Group") { const k = e.subj + "|" + e.room + "|" + (e.cover || ""); (groups[k] = groups[k] || []).push(e) } else ones.push(e) });
          const cells: ReactNode[] = [];
          Object.entries(groups).forEach(([k, arr], gi) => {
            const [subj, room, cov] = k.split("|");
            cells.push(<div key={"g" + gi}><span className="pill pg">GROUP</span><b>{subj}</b><span className="rm"> {room}</span> — {arr.map(x => x.who).join(", ")}{cov && <span className="cov"> ({cov})</span>}</div>);
          });
          ones.forEach((e, oi) => cells.push(<div key={"o" + oi}><span className="pill p1">1:1</span><b>{e.subj}</b> — {e.who}{e.cover && <span className="cov"> ({e.cover})</span>}</div>));
          const conflict = Object.keys(groups).length + ones.length > 1;
          return <tr key={i} className={conflict ? "conf" : ""}><td className="tm">{s}{conflict ? " ⚠" : ""}</td><td>{cells.length ? cells : <span className="free">—</span>}</td></tr>;
        })}
      </tbody></table>
    );
  }
  function studentTable(s: Stu) {
    const rowsX: { tm: string; ty: string; subj: string; teacher: string; room: string }[] = [];
    for (let g = 0; g < 4; g++) {
      if (s.phase === "junior") {
        rowsX.push({ tm: SLOTS[g * 2], ty: "Group", subj: GRP_SUBJ[g], teacher: s.grp[g] || "-", room: normRoom(s.room) });
        rowsX.push({ tm: SLOTS[g * 2 + 1], ty: "1:1", subj: ONE_SUBJ[g], teacher: s.one[g] || "-", room: "" });
      } else {
        rowsX.push({ tm: SLOTS[g * 2], ty: "1:1", subj: ONE_SUBJ[g], teacher: s.one[g] || "-", room: "" });
        rowsX.push({ tm: SLOTS[g * 2 + 1], ty: "Group", subj: GRP_SUBJ[g], teacher: s.grp[g] || "-", room: normRoom(s.room) });
      }
    }
    return (
      <table className="ct"><thead><tr><th>Time</th><th>Type</th><th>Subject</th><th>Teacher</th><th>Room</th></tr></thead><tbody>
        {rowsX.map((r2, i) => <tr key={i} className={r2.ty === "Group" ? "grow" : ""}><td className="tm">{r2.tm}</td><td>{r2.ty}</td><td><b>{r2.subj}</b></td><td>{r2.teacher}</td><td>{r2.room || "-"}</td></tr>)}
      </tbody></table>
    );
  }
  const dayLabel = day === "base" ? "Base Week" : day + " (" + DAYS[(new Date(day + "T00:00:00").getDay() + 6) % 7] + ")";
  const hasOv = (d: string) => !!(row?.overrides && row.overrides[d]);

  if (!authed) return null;
  return (
    <div className="wrap">
      <style>{`
      *{box-sizing:border-box}.wrap{font-family:'Segoe UI','Noto Sans KR',sans-serif;background:#f1f5f9;min-height:100vh;padding-bottom:60px}
      .top{background:#fff;color:#1e293b;padding:14px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid #e2e8f0}
      .top h1{font-size:18px;margin:0}.top a{color:#3b5bdb;text-decoration:none;font-weight:700;font-size:13px}
      .bar{max-width:1250px;margin:14px auto 0;padding:0 16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .btn{background:#fff;border:1.5px solid #d7e0ea;border-radius:8px;padding:7px 14px;font-weight:800;font-size:13px;cursor:pointer}
      .btn.on{background:#3b5bdb;color:#fff;border-color:#3b5bdb}
      .btn.grn{background:#0e9f6e;color:#fff;border-color:#0e9f6e}.btn.amb{background:#fff7e6;border-color:#f0c36d;color:#92400e}
      .main{max-width:1250px;margin:14px auto;padding:0 16px}
      .tbtns{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
      .tb{background:#fff;border:1.5px solid #d7e0ea;border-radius:8px;padding:6px 12px;font-weight:800;font-size:12.5px;cursor:pointer}
      .tb.on{background:#3b5bdb;color:#fff;border-color:#3b5bdb}
      table.ct{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 6px rgba(0,0,0,.06);margin-bottom:16px}
      .ct th{background:#eef2f7;color:#334155;padding:9px 12px;font-size:12.5px;text-align:left;border-bottom:2px solid #cbd5e1}
      .ct td{padding:9px 12px;border-bottom:1px solid #edf2f7;font-size:13.5px;vertical-align:top}
      .tm{white-space:nowrap;font-weight:800;color:#334155}
      .pill{display:inline-block;padding:1px 8px;border-radius:20px;font-size:10.5px;font-weight:800;margin-right:6px}
      .pg{background:#dbeafe;color:#1d4ed8}.p1{background:#dcfce7;color:#15803d}
      .rm{color:#b45309;font-weight:800;font-size:12px}.cov{color:#dc2626;font-weight:800;font-size:11.5px}
      .conf td{background:#fee2e2}.free{color:#cbd5e1}.grow td{background:#eef4fb}
      .ed table{width:100%;border-collapse:collapse;background:#fff;font-size:12px}
      .ed th{background:#eef2f7;color:#334155;padding:6px;font-size:11px;position:sticky;top:0;border-bottom:2px solid #cbd5e1}
      .ed td{border:1px solid #e2e8f0;padding:2px}
      .ed select,.ed input{width:100%;border:none;font-size:11.5px;padding:4px 2px;background:transparent;font-family:inherit}
      .ed .sec td{background:#e0e7ff;color:#3730a3;font-weight:800;padding:6px 8px}
      .pa{display:none}
      @media print{
        .top,.bar,.tbtns,.noprint{display:none!important}.wrap{background:#fff}
        .pa{display:block}.pa .tpage{page-break-after:always;padding:10px 0}
        .screenview.hideonprint{display:none}
        /* ink saver: no dark fills, black text + borders only */
        table.ct{box-shadow:none}
        .ct th{background:#fff!important;color:#222!important;border:1px solid #999;font-weight:900}
        .ct td{border:1px solid #bbb;color:#222}
        .conf td,.grow td{background:#fff!important}
        .pill{background:#fff!important;color:#333!important;border:1px solid #999}
        .rm,.cov,.tm{color:#222!important}
        h2{color:#000}
      }
      .pa .tpage h2{margin:4px 0 10px}
      `}</style>
      <div className="top">
        <h1>📅 Class Schedule</h1>
        <span style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>Week of {weekStart} · {dayLabel}</span>
        <span style={{ marginLeft: "auto" }} />
        {canEdit && <span style={{ background: "#3ddbb8", color: "#0d3340", borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 800 }}>EDITOR</span>}
        <a href="/admineng/hub">← Hub</a>
      </div>

      <div className="bar noprint">
        <button className="btn" onClick={() => { setWeekStart(addD(weekStart, -7)); setDay("base") }}>◀ Prev</button>
        <b style={{ fontSize: 14 }}>{weekStart} ~ {addD(weekStart, 5)}</b>
        <button className="btn" onClick={() => { setWeekStart(addD(weekStart, 7)); setDay("base") }}>Next ▶</button>
        <span style={{ width: 10 }} />
        <button className={"btn" + (day === "base" ? " on" : "")} onClick={() => { setDay("base"); setDraft(null) }}>Base Week</button>
        {DAYS.map((d, i) => { const ds = addD(weekStart, i); return <button key={d} className={"btn" + (day === ds ? " on" : "")} onClick={() => { setDay(ds); setDraft(null) }}>{d}{hasOv(ds) ? " ✱" : ""}</button> })}
        <span style={{ marginLeft: "auto" }} />
        <button className="btn" onClick={() => { setPrintAll(null); setTimeout(() => window.print(), 50) }}>🖨 Print view</button>
        <button className="btn grn" onClick={() => { setPrintAll("t"); setTimeout(() => { window.print(); setPrintAll(null); }, 150) }}>🖨 Print ALL teachers</button>
        <button className="btn grn" onClick={() => { setPrintAll("s"); setTimeout(() => { window.print(); setPrintAll(null); }, 150) }}>🖨 Print ALL students</button>
      </div>

      <div className="main">
        {loading ? <div style={{ padding: 30, color: "#94a3b8" }}>Loading…</div> : !data ? (
          <div style={{ background: "#fff", borderRadius: 12, padding: 30, textAlign: "center" }}>
            <p style={{ fontWeight: 800, fontSize: 15 }}>No schedule for this week yet.</p>
            {canEdit && <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button className="btn grn" onClick={copyLastWeek}>{busy || "📋 Copy from last week"}</button>
              <button className="btn" onClick={importSeed}>⬇ Import AUG 4 master</button>
              <button className="btn" onClick={startEdit}>✏️ Start empty</button>
            </div>}
          </div>
        ) : (
          <>
            <div className="tbtns noprint">
              {(["teacher", "student", "room", "master"] as const).map(v => (
                <button key={v} className={"tb" + (view === v ? " on" : "")} onClick={() => { setView(v); setDraft(null) }}>{v === "teacher" ? "👩‍🏫 By Teacher" : v === "student" ? "🧒 By Student" : v === "room" ? "🚪 By Room" : "🗂 Master Grid"}</button>
              ))}
              {canEdit && <button className={"tb" + (view === "edit" ? " on" : "")} onClick={startEdit}>✏️ Edit</button>}
              {canEdit && day !== "base" && !hasOv(day) && view !== "edit" && <button className="tb" style={{ borderColor: "#f0c36d", background: "#fff7e6", color: "#92400e" }} onClick={startEdit}>✱ Customize this day</button>}
              {canEdit && day !== "base" && hasOv(day) && <button className="tb" style={{ color: "#dc2626" }} onClick={resetDay}>↩ Reset day to base</button>}
            </div>

            {view === "teacher" && !printAll && (
              <div className="screenview">
                <div className="tbtns noprint">{teachers.map(t => <button key={t} className={"tb" + (selT === t ? " on" : "")} onClick={() => setSelT(t)}>{t}</button>)}</div>
                <h2 style={{ margin: "4px 0 10px" }}>{selT}</h2>
                {selT && teacherTable(selT)}
              </div>
            )}
            {view === "student" && !printAll && (
              <div>
                <div className="tbtns noprint">{data.students.map((s2, i) => <button key={i} className={"tb" + (selStu === s2.name ? " on" : "")} onClick={() => setSelStu(s2.name)}>{s2.name}</button>)}</div>
                {data.students.filter(s2 => s2.name === selStu).map((s2, i) => (
                  <div key={i}>
                    <h2 style={{ margin: "4px 0 10px" }}>{s2.name} <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: 13 }}>{s2.cls}</span></h2>
                    {studentTable(s2)}
                  </div>
                ))}
              </div>
            )}
            {view === "room" && !printAll && (
              <div>
                <div className="tbtns noprint">{rooms.map(r2 => <button key={r2} className={"tb" + (selR === r2 ? " on" : "")} onClick={() => setSelR(r2)}>{r2}</button>)}</div>
                <h2 style={{ margin: "4px 0 10px" }}>{selR}</h2>
                <table className="ct"><thead><tr><th style={{ width: 118 }}>Time</th><th>Class</th></tr></thead><tbody>
                  {SLOTS.map((s, i) => {
                    const es = events.filter(e => e.room === selR && e.kind === "Group" && e.slot === i && !(e.cover || "").startsWith("covering"));
                    const g: Record<string, Ev[]> = {}; es.forEach(e => { const k = e.subj + "|" + e.teacher; (g[k] = g[k] || []).push(e) });
                    return <tr key={i}><td className="tm">{s}</td><td>{Object.keys(g).length ? Object.entries(g).map(([k, arr], gi) => { const [subj, t] = k.split("|"); return <div key={gi}><span className="pill pg">{subj}</span><b>{t}</b> — {arr.map(x => x.who).join(", ")}</div> }) : <span className="free">—</span>}</td></tr>;
                  })}
                </tbody></table>
              </div>
            )}
            {view === "master" && !printAll && (
              <div style={{ overflowX: "auto" }}>
                <table className="ct" style={{ minWidth: 1100 }}><thead><tr><th>Teacher</th>{SLOTS.map(s => <th key={s}>{s}</th>)}</tr></thead><tbody>
                  {teachers.map(t => {
                    const m = bySlot(events.filter(e => e.teacher === t));
                    return <tr key={t}><td style={{ fontWeight: 800, whiteSpace: "nowrap" }}>{t}</td>
                      {SLOTS.map((s, i) => {
                        const es = m[i] || [];
                        if (!es.length) return <td key={i} className="free">—</td>;
                        const g = es.filter(e => e.kind === "Group"); const o = es.filter(e => e.kind === "1:1");
                        const conf = (g.length ? 1 : 0) + o.length > 1;
                        return <td key={i} style={conf ? { background: "#fee2e2" } : {}}>
                          {g.length > 0 && <div style={{ background: "#eef4fb", fontSize: 11, fontWeight: 700 }}>{g[0].subj} {g[0].room}</div>}
                          {o.map((e, oi) => <div key={oi} style={{ background: "#f0fdf4", fontSize: 11 }}>{e.subj.slice(0, 4)} · {e.who}</div>)}
                        </td>;
                      })}</tr>;
                  })}
                </tbody></table>
              </div>
            )}
            {view === "edit" && draft && !printAll && (
              <div className="ed">
                <div className="tbtns noprint" style={{ alignItems: "center" }}>
                  <b>Editing: {dayLabel}</b>
                  <button className="tb" style={{ background: "#0e9f6e", color: "#fff", borderColor: "#0e9f6e" }} onClick={saveDraft}>{busy || "💾 Save"}</button>
                  <button className="tb" onClick={() => { setDraft(null); setView("teacher") }}>Cancel</button>
                  <span style={{ marginLeft: 12, fontSize: 12, color: "#64748b" }}>Teachers:</span>
                  <input style={{ flex: 1, minWidth: 260, border: "1.5px solid #d7e0ea", borderRadius: 8, padding: "6px 10px", fontSize: 12 }} value={(draft.teachers || []).join(", ")} onChange={e => setDraft({ ...draft, teachers: e.target.value.split(",").map(x => x.trim().toUpperCase()).filter(Boolean) })} />
                </div>
                {/* Group class assignment — set once per room, applies to all students in the room */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
                  <b style={{ fontSize: 13 }}>👥 Group Classes (per room — applies to every student in the room)</b>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 12 }}><thead><tr>
                    <th style={{ textAlign: "left", padding: 4 }}>Room</th>{GRP_SUBJ.map(g => <th key={g} style={{ padding: 4, background: "#dbeafe", color: "#1d4ed8" }}>{g}</th>)}
                  </tr></thead><tbody>
                    {(["junior", "lower"] as const).map(ph => {
                      const roomsOf = [...new Set(draft.students.filter(x => x.phase === ph).map(x => normRoom(x.room)))].sort();
                      return roomsOf.map(rm => (
                        <tr key={ph + rm}>
                          <td style={{ padding: 4, fontWeight: 800 }}>{ph === "junior" ? "JR" : "KD"} · {rm} <span style={{ color: "#94a3b8", fontWeight: 600 }}>({draft.students.filter(x => x.phase === ph && normRoom(x.room) === rm).length})</span></td>
                          {([0, 1, 2, 3] as const).map(gi => (
                            <td key={gi} style={{ padding: 2, border: "1px solid #e2e8f0" }}>
                              <select style={{ width: "100%", border: "none", fontSize: 12, padding: 4, background: "transparent" }} value={roomGrpOf(ph, rm)[gi] || ""} onChange={e => setRoomGrp(ph, rm, gi, e.target.value)}>
                                <option value=""></option>{(draft.teachers || []).map(t => <option key={t} value={t}>{t}</option>)}
                                {roomGrpOf(ph, rm)[gi] && !(draft.teachers || []).includes(roomGrpOf(ph, rm)[gi]) && <option value={roomGrpOf(ph, rm)[gi]}>{roomGrpOf(ph, rm)[gi]}</option>}
                              </select>
                            </td>
                          ))}
                        </tr>
                      ));
                    })}
                  </tbody></table>
                </div>
                <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
                  <table><thead><tr>
                    <th style={{ minWidth: 110 }}>Student</th><th>Phase</th><th>Room</th>
                    {ONE_SUBJ.map(s => <th key={s} style={{ background: "#dcfce7", color: "#15803d" }}>1:1·{s}</th>)}
                    <th></th>
                  </tr></thead><tbody>
                    {(["junior", "lower"] as const).map(ph => (<>
                      <tr key={ph + "h"} className="sec"><td colSpan={8}>{ph === "junior" ? "JUNIOR (Group first: 9:00 G / 9:45 1:1 …)" : "KINDER · LOWER (1:1 first: 9:00 1:1 / 9:45 G …)"}
                        <button className="tb noprint" style={{ marginLeft: 10, padding: "2px 8px" }} onClick={() => setDraft({ ...draft, students: [...draft.students, { name: "NEW STUDENT", phase: ph, room: "ROOM 1", cls: "", grp: ["", "", "", ""], one: ["", "", "", ""] }] })}>+ Add student</button></td></tr>
                      {draft.students.map((s, si) => s.phase !== ph ? null : (
                        <tr key={si}>
                          <td><input value={s.name} onChange={e => { const st = [...draft.students]; st[si] = { ...s, name: e.target.value }; setDraft({ ...draft, students: st }) }} /></td>
                          <td><select value={s.phase} onChange={e => { const st = [...draft.students]; st[si] = { ...s, phase: e.target.value as Stu["phase"] }; setDraft({ ...draft, students: st }) }}><option value="junior">JR</option><option value="lower">KD</option></select></td>
                          <td><select value={normRoom(s.room)} onChange={e => moveStudentRoom(si, e.target.value)}>{ROOMS_OPT.concat(ROOMS_OPT.includes(normRoom(s.room)) ? [] : [normRoom(s.room)]).map(r2 => <option key={r2} value={r2}>{r2}</option>)}</select></td>
                          {([0, 1, 2, 3] as const).map(g => (
                            <td key={"o" + g}><select value={s.one[g] || ""} onChange={e => { const st = [...draft.students]; const oo = [...s.one]; oo[g] = e.target.value; st[si] = { ...s, one: oo }; setDraft({ ...draft, students: st }) }}>
                              <option value=""></option>{(draft.teachers || []).map(t => <option key={t} value={t}>{t}</option>)}{s.one[g] && !(draft.teachers || []).includes(s.one[g]) && <option value={s.one[g]}>{s.one[g]}</option>}
                            </select></td>
                          ))}
                          <td><button className="tb" style={{ color: "#dc2626", padding: "2px 7px" }} onClick={() => { if (!confirm("Remove " + s.name + "?")) return; setDraft({ ...draft, students: draft.students.filter((_, xi) => xi !== si) }) }}>✕</button></td>
                        </tr>
                      ))}
                    </>))}
                  </tbody></table>
                </div>
                <p style={{ fontSize: 12, color: "#64748b" }}>Tip: substitute teacher = select main teacher, then type is not needed — use the master upload format "TEACHER -SUB" via name field if required.</p>
              </div>
            )}

            {/* Print-ALL area */}
            <div className="pa">
              {printAll === "t" && teachers.map(t => (
                <div className="tpage" key={t}>
                  <h2>{t} — {dayLabel} (Week {weekStart})</h2>
                  {teacherTable(t)}
                </div>
              ))}
              {printAll === "s" && (["junior", "lower"] as const).map(ph => data.students.filter(s2 => s2.phase === ph).map((s2, i) => (
                <div className="tpage" key={ph + i}>
                  <h2>{s2.name} <span style={{ fontWeight: 600, fontSize: 14 }}>{s2.cls}</span> — {ph === "junior" ? "JUNIOR" : "KINDER"} · Week {weekStart}</h2>
                  {studentTable(s2)}
                </div>
              )))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
