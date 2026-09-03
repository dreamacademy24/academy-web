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
  const [view, setView] = useState<"home" | "projects">("home");
  const [selProj, setSelProj] = useState<string | null>(null);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [cmts, setCmts] = useState<Record<string, Cmt[]>>({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let raw = "";
    try { raw = localStorage.getItem("teacherSession") || ""; } catch { /* */ }
    if (!raw) { router.replace("/admineng/hub"); return; }
    try {
      const s = JSON.parse(raw);
      setMe({ username: s.username, name: s.name || s.username, color: s.color, initial: s.initial });
    } catch { router.replace("/admineng/hub"); return; }
    setReady(true);
  }, [router]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("project_nodes").select("*").order("sort_idx", { ascending: true });
    setNodes((data as Node[]) || []);
  }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const myU = me?.username || "___";

  // 공유 노드 + 그 조상까지 트리에 표시
  const visible = useMemo(() => {
    const vis = new Set<string>();
    for (const n of nodes) {
      if (n.teacher_shared) {
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

  if (!ready || !me) return null;

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
          <span style={{ marginLeft: "auto", fontSize: 13, color: "#64748b" }}>Hi, {me.name}</span>
        </div>
        <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 14px" }}>Projects and tasks shared by the Korean team. Check off what you finish and leave comments.</p>

        <div style={{ display: "inline-flex", background: "#eef2f7", borderRadius: 11, padding: 3, marginBottom: 16 }}>
          {([["home", "🏠 Home"], ["projects", "📁 Projects"]] as const).map(([k, label]) => (
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
                {projects.map(p => {
                  const cnt = nodes.filter(n => n.project_id === p.id && n.kind === "task" && visible.has(n.id));
                  const doneN = cnt.filter(n => n.done).length;
                  return (
                    <div key={p.id} onClick={() => { setSelProj(p.id); setSelNode(null); }}
                      style={{ background: "#fff", border: "1px solid #e8ecf3", borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{p.title_en || p.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{cnt.length} tasks · {doneN} done</div>
                    </div>
                  );
                })}
                {projects.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: "50px 0" }}>No shared projects yet.</div>}
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
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", textDecoration: sel.done ? "line-through" : "none" }}>{sel.title_en || sel.title}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 10px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: STA_COLOR[sel.status || "todo"], background: STA_COLOR[sel.status || "todo"] + "1a", borderRadius: 7, padding: "3px 9px" }}>{STA[sel.status || "todo"] || sel.status}</span>
                        {sel.due && <span style={{ fontSize: 11, fontWeight: 700, color: sel.due < today && !sel.done ? "#dc2626" : "#64748b", background: "#f1f5f9", borderRadius: 7, padding: "3px 9px" }}>📅 {sel.due}</span>}
                        {isMine(sel) && <span style={{ fontSize: 11, fontWeight: 700, color: "#0e7490", background: "#ecfeff", borderRadius: 7, padding: "3px 9px" }}>Assigned to me</span>}
                      </div>
                      {(sel.body_en || sel.body) && <div style={{ fontSize: 14, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.6, background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>{sel.body_en || sel.body}</div>}

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
      </div>
    </div>
  );
}
