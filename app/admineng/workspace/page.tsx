"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Node = {
  id: string;
  project_id: string | null;
  parent_id: string | null;
  title: string;
  body: string | null;
  kind: string;
  assignees: string[] | null;
  status: string | null;
  done: boolean;
  teacher_shared: boolean;
  origin?: string | null;
  team_shared?: boolean;
  title_en: string | null;
  body_en: string | null;
  due: string | null;
  sort_idx: number | null;
  updated_at: string | null;
};
type Cmt = { id: number; node_id: string; from_id: string; text: string; text_en: string | null; lang: string | null; ts: string };
type Me = { username: string; name: string; color?: string; initial?: string };

const STA: Record<string, string> = { todo: "To do", doing: "In progress", done: "Done" };
const STA_COLOR: Record<string, string> = { todo: "#94a3b8", doing: "#2563eb", done: "#16a34a" };

function ymd(d: Date) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export default function TeacherWorkspace() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [view, setView] = useState<"home" | "projects" | "notices" | "tasks" | "weekly">("home");
  const [selProj, setSelProj] = useState<string | null>(null);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [cmts, setCmts] = useState<Record<string, Cmt[]>>({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);
  const [noticeEn, setNoticeEn] = useState<Record<string, { t?: string; b?: string }>>({});
  const [openNotice, setOpenNotice] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<{ id: string; name: string; color: string }[]>([]);
  const [koreans, setKoreans] = useState<{ id: string; name: string; color: string }[]>([]);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [newProj, setNewProj] = useState(false);
  const [npName, setNpName] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [selTask, setSelTask] = useState<string | null>(null);
  const [taskFilter, setTaskFilter] = useState<"all" | "mine">("all");
  const [newTask, setNewTask] = useState(false);
  const [ntTitle, setNtTitle] = useState("");
  const [taskAssignFor, setTaskAssignFor] = useState<string | null>(null);
  const [tcmts, setTcmts] = useState<Record<string, any[]>>({});
  const [tdraft, setTdraft] = useState("");
  const [weekly, setWeekly] = useState<any[]>([]);
  const [wchecks, setWchecks] = useState<any[]>([]);
  const [newWk, setNewWk] = useState(false);
  const [nwTitle, setNwTitle] = useState("");
  const [wkAssignFor, setWkAssignFor] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // 1) 현지직원(티쳐) 세션
      try {
        const raw = localStorage.getItem("teacherSession");
        if (raw) { const s = JSON.parse(raw); setMe({ username: s.username, name: s.name || s.username, color: s.color, initial: s.initial }); setReady(true); return; }
      } catch { /* */ }
      // 2) 한국 어드민 세션 (같은 회사 계정 — 그대로 열람/편집)
      try {
        const { getAdminInfo } = await import("@/lib/adminAuth");
        const inf = getAdminInfo();
        if (inf && (inf.staffId || inf.name)) {
          const uid = (inf.staffId || "").replace(/^admin-/, "");
          setMe({ username: uid || "admin", name: inf.name || uid || "Admin" });
          setReady(true); return;
        }
      } catch { /* */ }
      // 3) 로그인 없이도 열람 허용 (읽기 전용)
      setMe(null); setReady(true);
    })();
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase.from("project_nodes").select("*").order("sort_idx", { ascending: true });
    setNodes((data as Node[]) || []);
  }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const trKo2En = useCallback(async (text: string) => {
    if (!text || !text.trim()) return "";
    try {
      const r = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, dir: "ko2en" }) });
      if (!r.ok) return "";
      const d = await r.json();
      return d.translated || "";
    } catch { return ""; }
  }, []);
  const loadNotices = useCallback(async () => {
    const { data } = await supabase.from("staff_notices").select("*").order("date", { ascending: false });
    const arr = data || [];
    setNotices(arr);
    for (const n of arr) {
      const t = (n.title || n.text || "").slice(0, 140);
      if (t) trKo2En(t).then(en => { if (en) setNoticeEn(prev => ({ ...prev, [n.id]: { ...(prev[n.id] || {}), t: en } })); });
    }
  }, [trKo2En]);
  useEffect(() => { if (ready && view === "notices" && notices.length === 0) loadNotices(); }, [ready, view, notices.length, loadNotices]);

  const loadTasks = useCallback(async () => {
    const { data } = await supabase.from("teacher_tasks").select("*").order("sort_idx", { ascending: false }).order("created_at", { ascending: false });
    setTasks(data || []);
  }, []);
  useEffect(() => { if (ready) loadTasks(); }, [ready, loadTasks]);

  async function createTask() {
    const t = ntTitle.trim(); if (!t || !me) return;
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    await supabase.from("teacher_tasks").insert({ id, title: t, body: "", assignees: [], due: null, status: "todo", done: false, team_shared: false, created_by: me.username, created_at: now, updated_at: now, sort_idx: Date.now() % 1000000 });
    setNtTitle(""); setNewTask(false); await loadTasks(); setSelTask(id);
  }
  async function saveTaskField(id: string, field: string, value: any) {
    setTasks(prev => prev.map(x => x.id === id ? { ...x, [field]: value } : x));
    await supabase.from("teacher_tasks").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", id);
  }
  async function toggleTaskDone(t: any) {
    const nd = !t.done;
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done: nd, status: nd ? "done" : "doing" } : x));
    await supabase.from("teacher_tasks").update({ done: nd, status: nd ? "done" : "doing", updated_at: new Date().toISOString() }).eq("id", t.id);
  }
  async function delTask(t: any) {
    if (!confirm("Delete this task?")) return;
    await supabase.from("teacher_tasks").delete().eq("id", t.id);
    if (selTask === t.id) setSelTask(null);
    await loadTasks();
  }
  async function saveTaskAssignees(id: string, sel: string[]) {
    const hasKorean = sel.some(x => koreans.find(k => k.id === x));
    setTasks(prev => prev.map(x => x.id === id ? { ...x, assignees: sel, team_shared: hasKorean } : x));
    await supabase.from("teacher_tasks").update({ assignees: sel, team_shared: hasKorean, updated_at: new Date().toISOString() }).eq("id", id);
  }
  async function loadTcmts(taskId: string) {
    const { data } = await supabase.from("teacher_task_comments").select("*").eq("task_id", taskId).order("ts", { ascending: true });
    setTcmts(prev => ({ ...prev, [taskId]: data || [] }));
  }
  async function addTcmt(taskId: string) {
    const t = tdraft.trim(); if (!t || !me) return;
    const { error } = await supabase.from("teacher_task_comments").insert({ task_id: taskId, from_id: me.username, text: t, ts: new Date().toISOString() });
    if (error) { alert("Failed: " + error.message); return; }
    setTdraft(""); loadTcmts(taskId);
  }

  const loadWeekly = useCallback(async () => {
    const { data: items } = await supabase.from("teacher_weekly_items").select("*").eq("active", true).order("sort_idx", { ascending: true });
    setWeekly(items || []);
    const { data: ch } = await supabase.from("teacher_weekly_checks").select("*").eq("check_date", ymd(new Date()));
    setWchecks(ch || []);
  }, []);
  useEffect(() => { if (ready && view === "weekly") loadWeekly(); }, [ready, view, loadWeekly]);

  async function createWeekly() {
    const t = nwTitle.trim(); if (!t || !me) return;
    const id = crypto.randomUUID();
    await supabase.from("teacher_weekly_items").insert({ id, title: t, assignees: [], weekdays: [], active: true, created_by: me.username, created_at: new Date().toISOString(), sort_idx: Date.now() % 1000000 });
    setNwTitle(""); setNewWk(false); await loadWeekly();
  }
  async function saveWeeklyField(id: string, field: string, value: any) {
    setWeekly(prev => prev.map(x => x.id === id ? { ...x, [field]: value } : x));
    await supabase.from("teacher_weekly_items").update({ [field]: value }).eq("id", id);
  }
  async function delWeekly(id: string) {
    if (!confirm("Delete this recurring item?")) return;
    await supabase.from("teacher_weekly_items").delete().eq("id", id);
    await loadWeekly();
  }
  async function saveWeeklyAssignees(id: string, sel: string[]) {
    setWeekly(prev => prev.map(x => x.id === id ? { ...x, assignees: sel } : x));
    await supabase.from("teacher_weekly_items").update({ assignees: sel }).eq("id", id);
  }
  async function toggleWeekday(item: any, wd: number) {
    const cur: number[] = item.weekdays || [];
    const nx = cur.includes(wd) ? cur.filter(x => x !== wd) : [...cur, wd].sort();
    await saveWeeklyField(item.id, "weekdays", nx);
  }
  async function toggleWeeklyCheck(item: any) {
    if (!me) return;
    const td = ymd(new Date());
    const mine = wchecks.find(c => c.item_id === item.id && c.by_id === me.username);
    if (mine) {
      await supabase.from("teacher_weekly_checks").delete().eq("id", mine.id);
      setWchecks(prev => prev.filter(c => c.id !== mine.id));
    } else {
      const { data } = await supabase.from("teacher_weekly_checks").insert({ item_id: item.id, check_date: td, by_id: me.username }).select();
      if (data && data[0]) setWchecks(prev => [...prev, data[0]]);
    }
  }

  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const myU = me?.username || "___";

  // 공유 노드 + 그 조상까지 트리에 표시
  const visible = useMemo(() => {
    const vis = new Set<string>();
    for (const n of nodes) {
      if (n.teacher_shared || n.origin === "teacher") {
        vis.add(n.id);
        let cur: Node | undefined = n.parent_id ? byId.get(n.parent_id) : undefined;
        let g = 0;
        while (cur && g++ < 30) { vis.add(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
        if (n.project_id) vis.add(n.project_id);
      }
    }
    return vis;
  }, [nodes, byId]);

  const shared = useMemo(() => nodes.filter(n => n.teacher_shared && n.kind !== "project"), [nodes]);
  const projects = useMemo(() => nodes.filter(n => n.kind === "project" && visible.has(n.id)), [nodes, visible]);
  const isMine = useCallback((n: Node) => (n.assignees || []).includes(myU), [myU]);

  const today = ymd(new Date());
  const wk = ymd(new Date(Date.now() + 7 * 864e5));
  const myTasks = useMemo(() => shared.filter(n => isMine(n) && !n.done), [shared, isMine]);
  const overdue = myTasks.filter(n => n.due && n.due < today);
  const dueToday = myTasks.filter(n => n.due === today);
  const thisWeek = myTasks.filter(n => n.due && n.due > today && n.due <= wk);
  const inProgress = myTasks.filter(n => n.status === "doing");
  const recent = useMemo(() => [...shared].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))).slice(0, 6), [shared]);

  function pathOf(n: Node): string {
    const parts: string[] = [];
    let cur: Node | undefined = n.parent_id ? byId.get(n.parent_id) : undefined;
    let g = 0;
    while (cur && g++ < 20) { parts.unshift(cur.title_en || cur.title || ""); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
    return parts.filter(Boolean).join(" › ");
  }

  // 담당자 명단 로드 (현지 티쳐 + 한국 직원)
  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const r = await fetch("/api/admin/staff-accounts?active=true");
        if (!r.ok) return;
        const d = await r.json();
        const st = d.staff || [];
        setTeachers(st.filter((x: any) => x.role !== "korean_admin" && x.username !== "admin-ceo").map((x: any) => ({ id: x.username, name: x.name, color: x.color || "#0ea5e9" })));
        setKoreans(st.filter((x: any) => x.role === "korean_admin").map((x: any) => ({ id: (x.username || "").replace(/^admin-/, ""), name: x.name, color: x.color || "#1e3a5f" })));
      } catch { /* */ }
    })();
  }, [ready]);

  const canEdit = (n: Node) => n.origin === "teacher";
  const personName = (id: string) => teachers.find(t => t.id === id)?.name || koreans.find(k => k.id === id)?.name || id;
  const personColor = (id: string) => teachers.find(t => t.id === id)?.color || koreans.find(k => k.id === id)?.color || "#94a3b8";

  async function createProject() {
    const name = npName.trim(); if (!name || !me) return;
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    await supabase.from("project_nodes").insert({ id, project_id: id, parent_id: null, title: name, kind: "project", origin: "teacher", assignees: [], status: "todo", done: false, teacher_shared: false, team_shared: false, sort_idx: 0, created_by: me.username, created_at: now, updated_at: now });
    setNpName(""); setNewProj(false); await load(); setSelProj(id); setSelNode(null);
  }
  async function addChild(parent: Node, kind: "folder" | "task") {
    if (!me) return;
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    await supabase.from("project_nodes").insert({ id, project_id: parent.project_id || parent.id, parent_id: parent.id, title: kind === "folder" ? "New folder" : "New task", kind, origin: "teacher", assignees: [], status: "todo", done: false, teacher_shared: false, team_shared: false, sort_idx: Date.now() % 100000, created_by: me.username, created_at: now, updated_at: now });
    await load(); setOpenMap(m => ({ ...m, [parent.id]: true })); if (kind === "task") setSelNode(id);
  }
  async function saveField(id: string, field: string, value: any) {
    setNodes(prev => prev.map(x => x.id === id ? { ...x, [field]: value } : x));
    await supabase.from("project_nodes").update({ [field]: value, updated_at: new Date().toISOString() }).eq("id", id);
  }
  async function delNode(n: Node) {
    if (!confirm("Delete this item" + (n.kind !== "task" ? " and everything inside it" : "") + "?")) return;
    const ids: string[] = [n.id];
    const collect = (pid: string) => { nodes.filter(x => x.parent_id === pid).forEach(c => { ids.push(c.id); collect(c.id); }); };
    collect(n.id);
    await supabase.from("project_nodes").delete().in("id", ids);
    if (selNode && ids.includes(selNode)) setSelNode(null);
    if (selProj && ids.includes(selProj)) setSelProj(null);
    await load();
  }
  async function saveAssignees(id: string, sel: string[]) {
    const hasKorean = sel.some(x => koreans.find(k => k.id === x));
    setNodes(prev => prev.map(x => x.id === id ? { ...x, assignees: sel, team_shared: hasKorean } : x));
    await supabase.from("project_nodes").update({ assignees: sel, team_shared: hasKorean, updated_at: new Date().toISOString() }).eq("id", id);
  }

  async function toggleDone(n: Node) {
    const nd = !n.done;
    setNodes(prev => prev.map(x => x.id === n.id ? { ...x, done: nd, status: nd ? "done" : "doing" } : x));
    await supabase.from("project_nodes").update({ done: nd, status: nd ? "done" : "doing", updated_at: new Date().toISOString() }).eq("id", n.id);
  }
  async function loadCmts(nodeId: string) {
    const { data } = await supabase.from("project_node_comments").select("*").eq("node_id", nodeId).order("ts", { ascending: true });
    setCmts(prev => ({ ...prev, [nodeId]: (data as Cmt[]) || [] }));
  }
  async function addCmt(nodeId: string) {
    const t = draft.trim();
    if (!t || !me) return;
    setBusy(true);
    const { error } = await supabase.from("project_node_comments").insert({ node_id: nodeId, from_id: me.username, text: t, text_en: t, lang: "en", ts: new Date().toISOString() });
    setBusy(false);
    if (error) { alert("Failed: " + error.message); return; }
    setDraft(""); loadCmts(nodeId);
  }
  const nameOf = (fromId: string) => (fromId === me?.username ? (me?.name || "Me") : fromId);

  function openNode(n: Node) {
    if (n.kind === "folder" || n.kind === "project") { setOpenMap(m => ({ ...m, [n.id]: m[n.id] === false })); return; }
    setSelNode(n.id);
    if (!cmts[n.id]) loadCmts(n.id);
  }

  if (!ready) return null;

  const childrenOf = (pid: string | null) =>
    nodes.filter(n => n.parent_id === pid && visible.has(n.id)).sort((a, b) => (a.sort_idx || 0) - (b.sort_idx || 0));

  function TreeRow({ n, depth }: { n: Node; depth: number }) {
    const kids = childrenOf(n.id);
    const isBranch = n.kind === "folder" || n.kind === "project";
    const open = openMap[n.id] !== false;
    const title = n.title_en || n.title || "(untitled)";
    const mine = isMine(n);
    return (
      <div>
        <div onClick={() => openNode(n)}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 8px", paddingLeft: 8 + depth * 16, borderRadius: 8, cursor: "pointer",
            background: selNode === n.id ? "#e0f2fe" : "transparent", fontWeight: isBranch ? 700 : 500, color: n.done ? "#94a3b8" : "#1f2937" }}>
          {isBranch ? <span style={{ fontSize: 11, color: "#94a3b8", width: 12 }}>{open ? "▼" : "▶"}</span> : <span style={{ width: 12 }} />}
          {n.kind === "task" && (
            <input type="checkbox" checked={n.done} disabled={!mine} onClick={e => e.stopPropagation()} onChange={() => toggleDone(n)}
              title={mine ? "Mark done" : "Only the assigned teacher can check"} style={{ width: 16, height: 16, accentColor: "#16a34a", cursor: mine ? "pointer" : "not-allowed" }} />
          )}
          <span style={{ fontSize: 14, textDecoration: n.done ? "line-through" : "none", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          {mine && n.kind === "task" && <span style={{ fontSize: 9, fontWeight: 800, color: "#0e7490", background: "#ecfeff", borderRadius: 6, padding: "1px 5px" }}>ME</span>}
          {n.due && n.kind === "task" && <span style={{ fontSize: 10, color: n.due < today && !n.done ? "#dc2626" : "#94a3b8" }}>{n.due.slice(5)}</span>}
          {canEdit(n) && isBranch && (
            <span style={{ display: "flex", gap: 3, flexShrink: 0 }}>
              <button onClick={e => { e.stopPropagation(); addChild(n, "folder"); }} title="Add folder" style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "1px 6px", fontSize: 11, cursor: "pointer" }}>📁+</button>
              <button onClick={e => { e.stopPropagation(); addChild(n, "task"); }} title="Add task" style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, padding: "1px 6px", fontSize: 11, cursor: "pointer" }}>✓+</button>
            </span>
          )}
        </div>
        {isBranch && open && kids.map(k => <TreeRow key={k.id} n={k} depth={depth + 1} />)}
      </div>
    );
  }

  const sel = selNode ? byId.get(selNode) : null;

  const Card = ({ label, list, color }: { label: string; list: Node[]; color: string }) => (
    <div style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 12, padding: 14, flex: "1 1 180px", minWidth: 160 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color, margin: "2px 0 6px" }}>{list.length}</div>
      {list.slice(0, 4).map(n => (
        <div key={n.id} onClick={() => { setView("projects"); setSelProj(n.project_id); setSelNode(n.id); if (!cmts[n.id]) loadCmts(n.id); }}
          style={{ fontSize: 12, color: "#475569", padding: "3px 0", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>• {n.title_en || n.title}</div>
      ))}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8fb", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 16px 60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <button onClick={() => router.push("/admineng/hub")} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 9, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Hub</button>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0f172a" }}>💼 Workspace</h1>
          <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>{me ? "Hi, " + me.name : "Viewing (read-only)"}</span>
        </div>
        <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 14px" }}>Projects and tasks shared by the Korean team. Check off what you finish and leave comments.</p>

        <div style={{ display: "inline-flex", background: "#eef2f7", borderRadius: 11, padding: 3, marginBottom: 16 }}>
          {([["home", "🏠 Home"], ["projects", "📁 Projects"], ["tasks", "✅ Tasks"], ["weekly", "🔁 Weekly"], ["notices", "💬 Notices"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setView(k)} style={{ border: "none", background: view === k ? "#fff" : "transparent", color: view === k ? "#0f172a" : "#64748b", borderRadius: 9, padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: view === k ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>{label}</button>
          ))}
        </div>

        {view === "home" && (
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              <Card label="Overdue" list={overdue} color="#dc2626" />
              <Card label="Due today" list={dueToday} color="#ea580c" />
              <Card label="This week" list={thisWeek} color="#2563eb" />
              <Card label="In progress" list={inProgress} color="#0e7490" />
            </div>
            {myTasks.length === 0 && (
              <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12, padding: "22px 16px", textAlign: "center", color: "#64748b", fontSize: 13, marginBottom: 18 }}>
                Nothing is assigned to you yet. Ask the Korean team to add you as an assignee — your tasks will show up here.
              </div>
            )}
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: "6px 0 8px" }}>🆕 Recently shared</div>
            <div style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 12, padding: 8 }}>
              {recent.map(n => (
                <div key={n.id} onClick={() => { setView("projects"); setSelProj(n.project_id); setSelNode(n.kind === "task" ? n.id : null); if (n.kind === "task" && !cmts[n.id]) loadCmts(n.id); }}
                  style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#334155", display: "flex", gap: 8 }}>
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>{pathOf(n) || "Project"}</span>
                  <span style={{ fontWeight: 600 }}>{n.title_en || n.title}</span>
                </div>
              ))}
              {recent.length === 0 && <div style={{ padding: 14, color: "#94a3b8", fontSize: 13 }}>No shared items yet.</div>}
            </div>
          </div>
        )}

        {view === "projects" && (
          <div>
            {!selProj && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {newProj ? (
                  <div style={{ background: "#fff", border: "1px solid #67e8f9", borderRadius: 12, padding: 12, display: "flex", gap: 8 }}>
                    <input autoFocus value={npName} onChange={e => setNpName(e.target.value)} placeholder="New project name…" onKeyDown={e => { if (e.key === "Enter") createProject(); }}
                      style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit" }} />
                    <button onClick={createProject} style={{ border: "none", background: "#0e7490", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Create</button>
                    <button onClick={() => { setNewProj(false); setNpName(""); }} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setNewProj(true)} style={{ alignSelf: "flex-start", border: "1px solid #0e7490", background: "#ecfeff", color: "#0e7490", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ New Project</button>
                )}
                {projects.map(p => {
                  const cnt = nodes.filter(n => n.project_id === p.id && n.kind === "task" && visible.has(n.id));
                  const doneN = cnt.filter(n => n.done).length;
                  const mineProj = p.origin === "teacher";
                  return (
                    <div key={p.id} onClick={() => { setSelProj(p.id); setSelNode(null); }}
                      style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 12, padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{p.title_en || p.title}
                          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "2px 7px", color: mineProj ? "#0e7490" : "#64748b", background: mineProj ? "#ecfeff" : "#f1f5f9" }}>{mineProj ? "OUR TEAM" : "SHARED FROM KOREA"}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{cnt.length} tasks · {doneN} done</div>
                      </div>
                      {canEdit(p) && <button onClick={e => { e.stopPropagation(); delNode(p); }} title="Delete project" style={{ border: "1px solid #fecaca", background: "#fff", color: "#dc2626", borderRadius: 8, padding: "5px 9px", fontSize: 12, cursor: "pointer" }}>🗑</button>}
                    </div>
                  );
                })}
                {projects.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>No projects yet. Create one with “+ New Project”.</div>}
              </div>
            )}
            {selProj && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: "1 1 340px", minWidth: 300, background: "#fff", border: "1px solid #e8ecf3", borderRadius: 12, padding: 10 }}>
                  <button onClick={() => { setSelProj(null); setSelNode(null); }} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>← Projects</button>
                  {(() => { const p = byId.get(selProj); return p ? <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", padding: "0 4px 8px" }}>{p.title_en || p.title}</div> : null; })()}
                  {childrenOf(selProj).map(c => <TreeRow key={c.id} n={c} depth={0} />)}
                </div>
                <div style={{ flex: "1 1 340px", minWidth: 300, background: "#fff", border: "1px solid #e8ecf3", borderRadius: 12, padding: 16, position: "sticky", top: 12 }}>
                  {!sel && <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "40px 0" }}>👈 Select a task to see details</div>}
                  {sel && (
                    <div>
                      {pathOf(sel) && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>{pathOf(sel)}</div>}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <input type="checkbox" checked={sel.done} disabled={!isMine(sel)} onChange={() => toggleDone(sel)} style={{ width: 20, height: 20, marginTop: 3, accentColor: "#16a34a", cursor: isMine(sel) ? "pointer" : "not-allowed" }} />
                        {canEdit(sel)
                          ? <input value={sel.title || ""} onChange={e => setNodes(prev => prev.map(x => x.id === sel.id ? { ...x, title: e.target.value } : x))} onBlur={e => saveField(sel.id, "title", e.target.value)} style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", border: "none", borderBottom: "1px solid #e2e8f0", outline: "none", flex: 1, padding: "2px 0", background: "transparent" }} />
                          : <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", textDecoration: sel.done ? "line-through" : "none" }}>{sel.title_en || sel.title}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "8px 0 10px" }}>
                        {canEdit(sel) ? (
                          <>
                            <select value={sel.status || "todo"} onChange={e => saveField(sel.id, "status", e.target.value)} style={{ fontSize: 12, fontWeight: 700, border: "1px solid #e2e8f0", borderRadius: 7, padding: "4px 8px", color: STA_COLOR[sel.status || "todo"] }}>
                              {["todo", "doing", "done"].map(k => <option key={k} value={k}>{STA[k]}</option>)}
                            </select>
                            <input type="date" value={sel.due || ""} onChange={e => saveField(sel.id, "due", e.target.value || null)} style={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 7, padding: "4px 8px" }} />
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: 11, fontWeight: 700, color: STA_COLOR[sel.status || "todo"], background: STA_COLOR[sel.status || "todo"] + "1a", borderRadius: 7, padding: "3px 9px" }}>{STA[sel.status || "todo"] || sel.status}</span>
                            {sel.due && <span style={{ fontSize: 11, fontWeight: 700, color: sel.due < today && !sel.done ? "#dc2626" : "#64748b", background: "#f1f5f9", borderRadius: 7, padding: "3px 9px" }}>📅 {sel.due}</span>}
                          </>
                        )}
                        {isMine(sel) && <span style={{ fontSize: 11, fontWeight: 700, color: "#0e7490", background: "#ecfeff", borderRadius: 7, padding: "3px 9px" }}>Assigned to me</span>}
                      </div>
                      {/* Assignees */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Assignees:</span>
                        {(sel.assignees || []).length === 0 && <span style={{ fontSize: 12, color: "#94a3b8" }}>none</span>}
                        {(sel.assignees || []).map(id => (
                          <span key={id} style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: personColor(id), borderRadius: 999, padding: "2px 9px" }}>{personName(id)}</span>
                        ))}
                        {canEdit(sel) && <button onClick={() => setAssignFor(sel.id)} style={{ border: "1px solid #0e7490", background: "#ecfeff", color: "#0e7490", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Assign</button>}
                        {sel.team_shared && <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", borderRadius: 6, padding: "2px 7px" }}>↔ shared to Korea</span>}
                      </div>
                      {canEdit(sel)
                        ? <textarea value={sel.body || ""} onChange={e => setNodes(prev => prev.map(x => x.id === sel.id ? { ...x, body: e.target.value } : x))} onBlur={e => saveField(sel.id, "body", e.target.value)} rows={5} placeholder="Details / description…" style={{ width: "100%", boxSizing: "border-box", fontSize: 14, color: "#334155", lineHeight: 1.6, border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", fontFamily: "inherit" }} />
                        : (sel.body_en || sel.body) && <div style={{ fontSize: 14, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.6, background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>{sel.body_en || sel.body}</div>}
                      {canEdit(sel) && <button onClick={() => delNode(sel)} style={{ marginTop: 10, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🗑 Delete task</button>}

                      <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 14, paddingTop: 12 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>💬 Comments</div>
                        {(cmts[sel.id] || []).map(c => (
                          <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#0e7490", flexShrink: 0 }}>{nameOf(c.from_id)}</div>
                            <div style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>{c.text}</div>
                          </div>
                        ))}
                        {(cmts[sel.id] || []).length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>No comments yet.</div>}
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a comment…" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCmt(sel.id); } }}
                            style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit" }} />
                          <button onClick={() => addCmt(sel.id)} disabled={busy} style={{ border: "none", background: "#0e7490", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Post</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {view === "notices" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notices.map(n => {
              const en = noticeEn[n.id] || {};
              const open = openNotice === n.id;
              return (
                <div key={n.id} style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 12, padding: "12px 14px" }}>
                  <div onClick={() => { const willOpen = !open; setOpenNotice(willOpen ? n.id : null); if (willOpen && !en.b) { trKo2En(n.text || "").then(bx => setNoticeEn(prev => ({ ...prev, [n.id]: { ...(prev[n.id] || {}), b: bx } }))); } }}
                    style={{ cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>{n.date}</span>
                    {n.require_read && <span style={{ fontSize: 9, fontWeight: 800, color: "#dc2626", background: "#fef2f2", borderRadius: 6, padding: "1px 6px", flexShrink: 0 }}>MUST READ</span>}
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", flex: 1, minWidth: 0 }}>{en.t || n.title || (n.text || "").slice(0, 40)}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{open ? "▲" : "▼"}</span>
                  </div>
                  {open && (
                    <div style={{ marginTop: 10, fontSize: 13, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                      {en.b || "Translating…"}
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: "pointer", fontSize: 11, color: "#94a3b8" }}>Show original (한국어)</summary>
                        <div style={{ marginTop: 6, color: "#64748b", whiteSpace: "pre-wrap" }}>{n.text}</div>
                      </details>
                    </div>
                  )}
                </div>
              );
            })}
            {notices.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>No notices.</div>}
          </div>
        )}

        {view === "tasks" && (
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ display: "inline-flex", background: "#eef2f7", borderRadius: 9, padding: 3 }}>
                {([["all", "All (" + tasks.length + ")"], ["mine", "Mine (" + tasks.filter(t => (t.assignees || []).includes(myU) && !t.done).length + ")"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setTaskFilter(k)} style={{ border: "none", background: taskFilter === k ? "#fff" : "transparent", color: taskFilter === k ? "#0f172a" : "#64748b", borderRadius: 7, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{label}</button>
                ))}
              </div>
              {!newTask
                ? <button onClick={() => setNewTask(true)} style={{ marginLeft: "auto", border: "1px solid #0e7490", background: "#ecfeff", color: "#0e7490", borderRadius: 9, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ New Task</button>
                : null}
            </div>
            {newTask && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12, background: "#fff", border: "1px solid #67e8f9", borderRadius: 12, padding: 10 }}>
                <input autoFocus value={ntTitle} onChange={e => setNtTitle(e.target.value)} placeholder="New task…" onKeyDown={e => { if (e.key === "Enter") createTask(); }} style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit" }} />
                <button onClick={createTask} style={{ border: "none", background: "#0e7490", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Add</button>
                <button onClick={() => { setNewTask(false); setNtTitle(""); }} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tasks.filter(t => taskFilter === "all" ? true : (t.assignees || []).includes(myU)).sort((a, b) => Number(a.done) - Number(b.done)).map(t => {
                const open = selTask === t.id;
                const list = tcmts[t.id] || [];
                return (
                  <div key={t.id} style={{ background: "#fff", border: "1px solid " + (t.done ? "#d1fae5" : "#e8ecf3"), borderRadius: 12, padding: "12px 14px", opacity: t.done ? 0.75 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="checkbox" checked={t.done} onClick={e => e.stopPropagation()} onChange={() => toggleTaskDone(t)} style={{ width: 19, height: 19, accentColor: "#16a34a", cursor: "pointer", flexShrink: 0 }} />
                      <div onClick={() => { const w = !open; setSelTask(w ? t.id : null); if (w && !tcmts[t.id]) loadTcmts(t.id); }} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", textDecoration: t.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: open ? "normal" : "nowrap" }}>{t.title}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: STA_COLOR[t.status || "todo"], background: STA_COLOR[t.status || "todo"] + "1a", borderRadius: 6, padding: "1px 7px" }}>{STA[t.status || "todo"]}</span>
                          {t.due && <span style={{ fontSize: 10, color: t.due < today && !t.done ? "#dc2626" : "#94a3b8" }}>📅 {t.due}</span>}
                          {(t.assignees || []).map((id: string) => <span key={id} style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: personColor(id), borderRadius: 999, padding: "1px 7px" }}>{personName(id)}</span>)}
                          {t.team_shared && <span style={{ fontSize: 9, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", borderRadius: 6, padding: "1px 6px" }}>↔ Korea</span>}
                        </div>
                      </div>
                      <span onClick={() => { const w = !open; setSelTask(w ? t.id : null); if (w && !tcmts[t.id]) loadTcmts(t.id); }} style={{ fontSize: 12, color: "#94a3b8", cursor: "pointer" }}>{open ? "▲" : "▼"}</span>
                    </div>
                    {open && (
                      <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 10, paddingTop: 10 }}>
                        <input value={t.title || ""} onChange={e => setTasks(prev => prev.map(x => x.id === t.id ? { ...x, title: e.target.value } : x))} onBlur={e => saveTaskField(t.id, "title", e.target.value)} style={{ fontSize: 15, fontWeight: 700, width: "100%", boxSizing: "border-box", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 8px", marginBottom: 8, fontFamily: "inherit" }} />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                          <select value={t.status || "todo"} onChange={e => saveTaskField(t.id, "status", e.target.value)} style={{ fontSize: 12, fontWeight: 700, border: "1px solid #e2e8f0", borderRadius: 7, padding: "4px 8px", color: STA_COLOR[t.status || "todo"] }}>
                            {["todo", "doing", "done"].map(k => <option key={k} value={k}>{STA[k]}</option>)}
                          </select>
                          <input type="date" value={t.due || ""} onChange={e => saveTaskField(t.id, "due", e.target.value || null)} style={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 7, padding: "4px 8px" }} />
                          <button onClick={() => setTaskAssignFor(t.id)} style={{ border: "1px solid #0e7490", background: "#ecfeff", color: "#0e7490", borderRadius: 999, padding: "3px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Assign</button>
                        </div>
                        <textarea value={t.body || ""} onChange={e => setTasks(prev => prev.map(x => x.id === t.id ? { ...x, body: e.target.value } : x))} onBlur={e => saveTaskField(t.id, "body", e.target.value)} rows={3} placeholder="Details…" style={{ width: "100%", boxSizing: "border-box", fontSize: 13, color: "#334155", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontFamily: "inherit", lineHeight: 1.5 }} />
                        <button onClick={() => delTask(t)} style={{ marginTop: 8, border: "1px solid #fecaca", background: "#fff", color: "#dc2626", borderRadius: 8, padding: "4px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🗑 Delete</button>
                        <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 12, paddingTop: 10 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>💬 Comments</div>
                          {list.map((c: any) => (
                            <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#0e7490", flexShrink: 0 }}>{personName(c.from_id)}</span>
                              <span style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>{c.text}</span>
                            </div>
                          ))}
                          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                            <input value={tdraft} onChange={e => setTdraft(e.target.value)} placeholder="Write a comment…" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTcmt(t.id); } }} style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit" }} />
                            <button onClick={() => addTcmt(t.id)} style={{ border: "none", background: "#0e7490", color: "#fff", borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Post</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {tasks.filter(t => taskFilter === "all" ? true : (t.assignees || []).includes(myU)).length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>No tasks yet. Create one with “+ New Task”.</div>}
            </div>
          </div>
        )}

        {view === "weekly" && (() => {
          const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
          const todayWd = new Date().getDay();
          const td = ymd(new Date());
          const forToday = weekly.filter(it => !(it.weekdays || []).length || (it.weekdays || []).includes(todayWd));
          const checkedBy = (id: string) => wchecks.filter(c => c.item_id === id).map(c => c.by_id);
          const iChecked = (id: string) => wchecks.some(c => c.item_id === id && c.by_id === myU);
          return (
            <div>
              <div style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 12, padding: 14, marginBottom: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>✅ Today — {WD[todayWd]} {td}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Recurring tasks to check off today</div>
                {forToday.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13, padding: "10px 0" }}>Nothing scheduled for today.</div>}
                {forToday.map(it => {
                  const done = iChecked(it.id);
                  const others = checkedBy(it.id);
                  return (
                    <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: "1px solid #f6f8fb" }}>
                      <input type="checkbox" checked={done} onChange={() => toggleWeeklyCheck(it)} style={{ width: 19, height: 19, accentColor: "#16a34a", cursor: "pointer", flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: done ? "#94a3b8" : "#1f2937", textDecoration: done ? "line-through" : "none" }}>{it.title}</span>
                      {(it.assignees || []).map((id: string) => <span key={id} style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: personColor(id), borderRadius: 999, padding: "1px 7px" }}>{personName(id)}</span>)}
                      {others.length > 0 && <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>✓ {others.map(personName).join(", ")}</span>}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>🔁 Recurring items</div>
                {!newWk && <button onClick={() => setNewWk(true)} style={{ marginLeft: "auto", border: "1px solid #0e7490", background: "#ecfeff", color: "#0e7490", borderRadius: 9, padding: "6px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>+ New item</button>}
              </div>
              {newWk && (
                <div style={{ display: "flex", gap: 8, marginBottom: 10, background: "#fff", border: "1px solid #67e8f9", borderRadius: 12, padding: 10 }}>
                  <input autoFocus value={nwTitle} onChange={e => setNwTitle(e.target.value)} placeholder="e.g. Check classroom supplies" onKeyDown={e => { if (e.key === "Enter") createWeekly(); }} style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit" }} />
                  <button onClick={createWeekly} style={{ border: "none", background: "#0e7490", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Add</button>
                  <button onClick={() => { setNewWk(false); setNwTitle(""); }} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {weekly.map(it => (
                  <div key={it.id} style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input value={it.title || ""} onChange={e => setWeekly(prev => prev.map(x => x.id === it.id ? { ...x, title: e.target.value } : x))} onBlur={e => saveWeeklyField(it.id, "title", e.target.value)} style={{ flex: 1, fontSize: 14, fontWeight: 600, border: "none", borderBottom: "1px solid #eef2f7", outline: "none", padding: "3px 0", fontFamily: "inherit" }} />
                      <button onClick={() => delWeekly(it.id)} style={{ border: "1px solid #fecaca", background: "#fff", color: "#dc2626", borderRadius: 7, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>🗑</button>
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {WD.map((d, i) => { const on = (it.weekdays || []).includes(i); return (
                        <button key={i} onClick={() => toggleWeekday(it, i)} style={{ border: "1px solid " + (on ? "#0e7490" : "#e2e8f0"), background: on ? "#0e7490" : "#fff", color: on ? "#fff" : "#94a3b8", borderRadius: 7, width: 34, padding: "4px 0", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{d[0]}</button>
                      ); })}
                      <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>{(it.weekdays || []).length ? "" : "Every day"}</span>
                      <span style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
                        {(it.assignees || []).map((id: string) => <span key={id} style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: personColor(id), borderRadius: 999, padding: "1px 7px" }}>{personName(id)}</span>)}
                        <button onClick={() => setWkAssignFor(it.id)} style={{ border: "1px solid #0e7490", background: "#ecfeff", color: "#0e7490", borderRadius: 999, padding: "2px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Assign</button>
                      </span>
                    </div>
                  </div>
                ))}
                {weekly.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: "40px 0" }}>No recurring items yet. Add one with “+ New item”.</div>}
              </div>
            </div>
          );
        })()}
      </div>

      {assignFor && (() => {
        const node = byId.get(assignFor);
        const cur = (node?.assignees || []);
        const toggle = (id: string) => { const nx = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]; saveAssignees(assignFor, nx); };
        return (
          <div onClick={() => setAssignFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 5000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(460px,94vw)", maxHeight: "80vh", overflowY: "auto", padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Assign people</div>
              <div style={{ fontSize: 11, color: "#0e7490", fontWeight: 700, margin: "4px 0 6px" }}>🌏 Teachers</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {teachers.map(t => { const on = cur.includes(t.id); return (
                  <button key={t.id} onClick={() => toggle(t.id)} style={{ border: "1px solid " + (on ? t.color : "#e2e8f0"), background: on ? t.color : "#fff", color: on ? "#fff" : "#334155", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{t.name}</button>
                ); })}
                {teachers.length === 0 && <span style={{ fontSize: 12, color: "#94a3b8" }}>No teachers</span>}
              </div>
              <div style={{ fontSize: 11, color: "#1e3a5f", fontWeight: 700, margin: "14px 0 6px" }}>🇰🇷 Korea team <span style={{ color: "#94a3b8", fontWeight: 400 }}>(assigning shares this to Korea)</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {koreans.map(k => { const on = cur.includes(k.id); return (
                  <button key={k.id} onClick={() => toggle(k.id)} style={{ border: "1px solid " + (on ? k.color : "#e2e8f0"), background: on ? k.color : "#fff", color: on ? "#fff" : "#334155", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{k.name}</button>
                ); })}
              </div>
              <div style={{ textAlign: "right", marginTop: 16 }}>
                <button onClick={() => setAssignFor(null)} style={{ border: "none", background: "#0e7490", color: "#fff", borderRadius: 9, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Done</button>
              </div>
            </div>
          </div>
        );
      })()}

      {taskAssignFor && (() => {
        const t = tasks.find(x => x.id === taskAssignFor);
        const cur = (t?.assignees || []);
        const toggle = (id: string) => { const nx = cur.includes(id) ? cur.filter((x: string) => x !== id) : [...cur, id]; saveTaskAssignees(taskAssignFor, nx); };
        return (
          <div onClick={() => setTaskAssignFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 5000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(460px,94vw)", maxHeight: "80vh", overflowY: "auto", padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Assign people</div>
              <div style={{ fontSize: 11, color: "#0e7490", fontWeight: 700, margin: "4px 0 6px" }}>🌏 Teachers</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {teachers.map(tt => { const on = cur.includes(tt.id); return (
                  <button key={tt.id} onClick={() => toggle(tt.id)} style={{ border: "1px solid " + (on ? tt.color : "#e2e8f0"), background: on ? tt.color : "#fff", color: on ? "#fff" : "#334155", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{tt.name}</button>
                ); })}
                {teachers.length === 0 && <span style={{ fontSize: 12, color: "#94a3b8" }}>No teachers</span>}
              </div>
              <div style={{ fontSize: 11, color: "#1e3a5f", fontWeight: 700, margin: "14px 0 6px" }}>🇰🇷 Korea team <span style={{ color: "#94a3b8", fontWeight: 400 }}>(assigning shares this to Korea)</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {koreans.map(k => { const on = cur.includes(k.id); return (
                  <button key={k.id} onClick={() => toggle(k.id)} style={{ border: "1px solid " + (on ? k.color : "#e2e8f0"), background: on ? k.color : "#fff", color: on ? "#fff" : "#334155", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{k.name}</button>
                ); })}
              </div>
              <div style={{ textAlign: "right", marginTop: 16 }}>
                <button onClick={() => setTaskAssignFor(null)} style={{ border: "none", background: "#0e7490", color: "#fff", borderRadius: 9, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Done</button>
              </div>
            </div>
          </div>
        );
      })()}

      {wkAssignFor && (() => {
        const it = weekly.find(x => x.id === wkAssignFor);
        const cur = (it?.assignees || []);
        const toggle = (id: string) => { const nx = cur.includes(id) ? cur.filter((x: string) => x !== id) : [...cur, id]; saveWeeklyAssignees(wkAssignFor, nx); };
        return (
          <div onClick={() => setWkAssignFor(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 5000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "min(460px,94vw)", maxHeight: "80vh", overflowY: "auto", padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Assign people</div>
              <div style={{ fontSize: 11, color: "#0e7490", fontWeight: 700, margin: "4px 0 6px" }}>🌏 Teachers</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {teachers.map(tt => { const on = cur.includes(tt.id); return (
                  <button key={tt.id} onClick={() => toggle(tt.id)} style={{ border: "1px solid " + (on ? tt.color : "#e2e8f0"), background: on ? tt.color : "#fff", color: on ? "#fff" : "#334155", borderRadius: 999, padding: "5px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{tt.name}</button>
                ); })}
                {teachers.length === 0 && <span style={{ fontSize: 12, color: "#94a3b8" }}>No teachers</span>}
              </div>
              <div style={{ textAlign: "right", marginTop: 16 }}>
                <button onClick={() => setWkAssignFor(null)} style={{ border: "none", background: "#0e7490", color: "#fff", borderRadius: 9, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Done</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
