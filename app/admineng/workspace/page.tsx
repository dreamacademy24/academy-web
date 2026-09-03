"use client";

import { useState, useEffect, useCallback } from "react";
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
  updated_at: string | null;
};
type Cmt = { id: number; node_id: string; from_id: string; text: string; text_en: string | null; lang: string | null; ts: string };
type Me = { username: string; name: string; color?: string; initial?: string };

const STA: Record<string, string> = { todo: "To do", doing: "In progress", done: "Done" };
const STA_COLOR: Record<string, string> = { todo: "#94a3b8", doing: "#2563eb", done: "#16a34a" };

export default function TeacherWorkspace() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [openCmt, setOpenCmt] = useState<string | null>(null);
  const [cmts, setCmts] = useState<Record<string, Cmt[]>>({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  // 세션 게이트
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

  const byId = new Map(nodes.map(n => [n.id, n]));
  const shared = nodes.filter(n => n.teacher_shared && n.kind !== "project");
  const mineList = shared.filter(n => (n.assignees || []).includes(me?.username || "___"));

  // 부모 경로(프로젝트→폴더) 영어 우선
  function pathOf(n: Node): string {
    const parts: string[] = [];
    let cur: Node | undefined = n.parent_id ? byId.get(n.parent_id) : undefined;
    let guard = 0;
    while (cur && guard++ < 20) {
      parts.unshift(cur.title_en || cur.title || "");
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return parts.filter(Boolean).join(" › ");
  }

  const isMine = (n: Node) => (n.assignees || []).includes(me?.username || "___");

  async function toggleDone(n: Node) {
    const nd = !n.done;
    setNodes(prev => prev.map(x => x.id === n.id ? { ...x, done: nd, status: nd ? "done" : "doing" } : x));
    await supabase.from("project_nodes").update({ done: nd, status: nd ? "done" : "doing", updated_at: new Date().toISOString() }).eq("id", n.id);
  }

  async function loadCmts(nodeId: string) {
    const { data } = await supabase.from("project_node_comments").select("*").eq("node_id", nodeId).order("ts", { ascending: true });
    setCmts(prev => ({ ...prev, [nodeId]: (data as Cmt[]) || [] }));
  }
  function toggleCmt(nodeId: string) {
    if (openCmt === nodeId) { setOpenCmt(null); return; }
    setOpenCmt(nodeId); setDraft("");
    if (!cmts[nodeId]) loadCmts(nodeId);
  }
  async function addCmt(nodeId: string) {
    const t = draft.trim();
    if (!t || !me) return;
    setBusy(true);
    const row = { node_id: nodeId, from_id: me.username, text: t, text_en: t, lang: "en", ts: new Date().toISOString() };
    const { error } = await supabase.from("project_node_comments").insert(row);
    setBusy(false);
    if (error) { alert("Failed to post: " + error.message); return; }
    setDraft(""); loadCmts(nodeId);
  }

  const nameOf = (fromId: string) => {
    const n = nodes.find(() => false); void n;
    if (fromId === me?.username) return me?.name || "Me";
    return fromId;
  };

  if (!ready || !me) return null;

  const listToShow = tab === "mine" ? mineList : shared;
  // 프로젝트별 그룹
  const groups: { pid: string; ptitle: string; items: Node[] }[] = [];
  for (const n of listToShow) {
    const pid = n.project_id || "none";
    let g = groups.find(x => x.pid === pid);
    if (!g) {
      const proj = n.project_id ? byId.get(n.project_id) : undefined;
      g = { pid, ptitle: proj ? (proj.title_en || proj.title) : "Project", items: [] };
      groups.push(g);
    }
    g.items.push(n);
  }
  // 미완료 우선 정렬
  groups.forEach(g => g.items.sort((a, b) => Number(a.done) - Number(b.done)));

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8fb", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px 60px" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <button onClick={() => router.push("/admineng/hub")} style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 9, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>← Hub</button>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: "#0f172a" }}>💼 Workspace</h1>
        </div>
        <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 16px" }}>Projects and tasks shared with you by the Korean team. Check off what you finish and leave comments.</p>

        {/* tabs */}
        <div style={{ display: "inline-flex", background: "#eef2f7", borderRadius: 11, padding: 3, marginBottom: 16 }}>
          {([["mine", `My Tasks (${mineList.filter(n => !n.done).length})`], ["all", `All Shared (${shared.length})`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ border: "none", background: tab === k ? "#fff" : "transparent", color: tab === k ? "#0f172a" : "#64748b", borderRadius: 9, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: tab === k ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>{label}</button>
          ))}
        </div>

        {groups.length === 0 && (
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "60px 0", fontSize: 14 }}>
            {tab === "mine" ? "Nothing assigned to you yet." : "No shared projects yet."}
          </div>
        )}

        {groups.map(g => (
          <div key={g.pid} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0e7490", margin: "0 0 8px", letterSpacing: 0.2 }}>📁 {g.ptitle}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {g.items.map(n => {
                const title = n.title_en || n.title || "(no title)";
                const body = n.body_en || "";
                const path = pathOf(n);
                const mine = isMine(n);
                const list = cmts[n.id] || [];
                return (
                  <div key={n.id} style={{ background: "#fff", border: "1px solid " + (n.done ? "#d1fae5" : "#e8ecf3"), borderRadius: 12, padding: "12px 14px", opacity: n.done ? 0.72 : 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <input type="checkbox" checked={n.done} disabled={!mine} onChange={() => toggleDone(n)}
                        title={mine ? "Mark done" : "Only the assigned teacher can check this"}
                        style={{ width: 20, height: 20, marginTop: 2, cursor: mine ? "pointer" : "not-allowed", accentColor: "#16a34a", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {path && <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>{path}</div>}
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", textDecoration: n.done ? "line-through" : "none" }}>{title}</div>
                        {body && <div style={{ fontSize: 13, color: "#475569", marginTop: 5, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{body}</div>}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: STA_COLOR[n.status || "todo"], background: (STA_COLOR[n.status || "todo"]) + "1a", borderRadius: 7, padding: "2px 8px" }}>{STA[n.status || "todo"] || n.status}</span>
                          {mine && <span style={{ fontSize: 11, fontWeight: 700, color: "#0e7490", background: "#ecfeff", borderRadius: 7, padding: "2px 8px" }}>Assigned to me</span>}
                          <button onClick={() => toggleCmt(n.id)} style={{ marginLeft: "auto", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#475569", cursor: "pointer" }}>💬 Comments{list.length ? ` (${list.length})` : ""}</button>
                        </div>

                        {openCmt === n.id && (
                          <div style={{ marginTop: 10, borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                            {(cmts[n.id] || []).map(c => (
                              <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 7 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#0e7490", flexShrink: 0 }}>{nameOf(c.from_id)}</div>
                                <div style={{ fontSize: 13, color: "#334155", whiteSpace: "pre-wrap" }}>{c.text}</div>
                              </div>
                            ))}
                            {(cmts[n.id] || []).length === 0 && <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>No comments yet.</div>}
                            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                              <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a comment…" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCmt(n.id); } }}
                                style={{ flex: 1, border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit" }} />
                              <button onClick={() => addCmt(n.id)} disabled={busy} style={{ border: "none", background: "#0e7490", color: "#fff", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Post</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
