"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";

interface TutorReq {
  id: string;
  created_at: string;
  guest_name: string | null;
  house_number: string | null;
  student_name_kr: string | null;
  student_name_en: string | null;
  student_age: string | null;
  class_type: string | null;
  sessions_per_day: number | null;
  start_date: string | null;
  end_date: string | null;
  preferred_days: string | null;
  preferred_time: string | null;
  level_english: string | null;
  level_speaking: string | null;
  level_reading: string | null;
  level_writing: string | null;
  textbook: string | null;
  class_style: string | null;
  class_focus_arr: string[] | null;
  child_personality: string | null;
  status: string;
  assigned_tutor_id: string | null;
  tutor_id: string | null;
}

interface Tutor { id: string; name: string }
interface Comment { id: string; request_id: string; tutor_name: string; comment: string; created_at: string }

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "Pending",   bg: "#dbeafe", color: "#1d4ed8" },
  reviewing: { label: "Reviewing", bg: "#fef3c7", color: "#92400e" },
  assigned:  { label: "Assigned",  bg: "#e0e7ff", color: "#3730a3" },
  confirmed: { label: "Confirmed", bg: "#dcfce7", color: "#15803d" },
  completed: { label: "Completed", bg: "#d1fae5", color: "#065f46" },
  cancelled: { label: "Cancelled", bg: "#fee2e2", color: "#dc2626" },
};

const STATUS_FILTERS = ["all", "pending", "reviewing", "assigned", "confirmed", "completed", "cancelled"];

function fmtDate(s: string | null) {
  if (!s) return "-";
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export default function EngTutorClassPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [reqs, setReqs] = useState<TutorReq[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actingTutor, setActingTutor] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [commentsById, setCommentsById] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState<string>("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    setAuthed(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("admineng_tutor_name") || "";
      setActingTutor(saved);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqRes, tutorRes] = await Promise.all([
      supabase.from("tutor_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("tutors").select("id, name").eq("is_active", true).order("name"),
    ]);
    setLoading(false);
    if (reqRes.error) console.error("tutor_requests load failed:", reqRes.error);
    if (tutorRes.error) console.error("tutors load failed:", tutorRes.error);
    setReqs((reqRes.data || []) as TutorReq[]);
    setTutors((tutorRes.data || []) as Tutor[]);
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function loadComments(requestId: string) {
    const { data, error } = await supabase
      .from("tutor_class_comments")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });
    if (error) { console.error("comments load failed:", error); return; }
    setCommentsById(prev => ({ ...prev, [requestId]: (data || []) as Comment[] }));
  }

  function toggleExpand(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setNewComment("");
    if (!commentsById[id]) loadComments(id);
  }

  function pickActing(name: string) {
    setActingTutor(name);
    if (typeof window !== "undefined") localStorage.setItem("admineng_tutor_name", name);
  }

  async function postComment(requestId: string) {
    if (!actingTutor) { alert("Please select your name first (top right)."); return; }
    if (!newComment.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("tutor_class_comments").insert({
      request_id: requestId,
      tutor_name: actingTutor,
      comment: newComment.trim(),
    });
    setPosting(false);
    if (error) { alert("Failed to post comment: " + error.message); return; }
    setNewComment("");
    loadComments(requestId);
  }

  if (!authed) return null;

  const filtered = statusFilter === "all" ? reqs : reqs.filter(r => r.status === statusFilter);
  const tutorNameById = (id: string | null) => {
    if (!id) return "";
    return tutors.find(t => t.id === id)?.name || "";
  };

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.tc-w{max-width:1100px;margin:0 auto;padding:24px 20px}
.tc-top{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.tc-top h1{font-size:20px;font-weight:800;flex:1}
.tc-back{padding:7px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:700;color:#475569;cursor:pointer;font-family:inherit}.tc-back:hover{border-color:#1a6fc4;color:#1a6fc4}
.tc-sel{padding:7px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:12.5px;font-family:inherit;background:#fff;font-weight:600;color:#1a6fc4}
.tc-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.tc-chip{padding:6px 12px;border:1px solid #e2e8f0;border-radius:999px;background:#fff;font-size:12px;font-weight:600;color:#475569;cursor:pointer;font-family:inherit;text-transform:capitalize}
.tc-chip.on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.tc-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:10px;cursor:pointer;transition:all 150ms}
.tc-card:hover{border-color:#1a6fc4;box-shadow:0 4px 14px rgba(26,111,196,0.08)}
.tc-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.tc-card-title{font-size:14px;font-weight:700;color:#1a1a2e}
.tc-badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.tc-meta{font-size:12px;color:#6b7c93;margin-top:6px;line-height:1.7}
.tc-meta .k{font-weight:700;color:#475569;margin-right:4px}
.tc-detail{margin-top:12px;padding-top:12px;border-top:1px dashed #e2e8f0}
.tc-detail h3{font-size:12px;font-weight:800;color:#1a6fc4;margin:8px 0 6px;letter-spacing:0.3px;text-transform:uppercase}
.tc-detail .row{display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;border-bottom:1px dashed #f1f5f9}
.tc-detail .row:last-child{border-bottom:none}
.tc-detail .k{color:#6b7c93;font-weight:600}
.tc-detail .v{color:#1a1a2e;font-weight:500;text-align:right}
.tc-pre{font-size:12px;line-height:1.6;background:#f8fafc;padding:8px 10px;border-radius:6px;color:#475569;white-space:pre-wrap;margin-top:4px}
.tc-comments{margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0}
.tc-comments h3{font-size:12px;font-weight:800;color:#1a6fc4;margin-bottom:8px;letter-spacing:0.3px;text-transform:uppercase}
.tc-comment{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;margin-bottom:6px;font-size:12.5px;color:#1a1a2e;line-height:1.5}
.tc-comment .who{font-weight:700;color:#1a6fc4;margin-right:6px}
.tc-comment .when{font-size:10.5px;color:#94a3b8;margin-left:6px}
.tc-form{display:flex;gap:6px;margin-top:8px}
.tc-form input{flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:12.5px;font-family:inherit;outline:none}
.tc-form input:focus{border-color:#1a6fc4}
.tc-form button{padding:8px 14px;background:#1a6fc4;color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}.tc-form button:disabled{opacity:0.5}
.tc-empty{padding:40px;text-align:center;color:#94a3b8;font-size:14px;background:#fff;border-radius:12px}
.tc-loading{padding:40px;text-align:center;color:#3b82f6;font-size:14px}
    `}</style>

    <div className="tc-w">
      <div className="tc-top">
        <button className="tc-back" onClick={() => router.push("/admineng/hub")}>← Hub</button>
        <h1>🎓 Tutor Classes</h1>
        <select className="tc-sel" value={actingTutor} onChange={e => pickActing(e.target.value)}>
          <option value="">-- Select your name --</option>
          {tutors.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </div>

      <div className="tc-bar">
        {STATUS_FILTERS.map(s => (
          <button key={s} className={`tc-chip${statusFilter === s ? " on" : ""}`} onClick={() => setStatusFilter(s)}>
            {s === "all" ? "All" : (STATUS_META[s]?.label || s)}
          </button>
        ))}
        <span style={{ marginLeft: 4, fontSize: 12, color: "#6b7c93" }}>{filtered.length} request(s)</span>
      </div>

      {loading ? (
        <div className="tc-loading">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="tc-empty">No requests found.</div>
      ) : filtered.map(r => {
        const meta = STATUS_META[r.status] || STATUS_META.pending;
        const expanded = expandedId === r.id;
        const studentName = [r.student_name_kr, r.student_name_en].filter(Boolean).join(" / ") || "-";
        const tutorName = tutorNameById(r.assigned_tutor_id || r.tutor_id);
        const comments = commentsById[r.id] || [];
        return (
          <div key={r.id} className="tc-card" onClick={() => toggleExpand(r.id)}>
            <div className="tc-card-head">
              <div className="tc-card-title">
                {r.house_number ? <span style={{ color: "#1a6fc4", marginRight: 6 }}>[{r.house_number}]</span> : null}
                {studentName}
              </div>
              <span className="tc-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
            </div>
            <div className="tc-meta">
              <span className="k">Type:</span>{r.class_type || "-"}
              <span className="k" style={{ marginLeft: 12 }}>Period:</span>{fmtDate(r.start_date)} ~ {fmtDate(r.end_date)}
              <span className="k" style={{ marginLeft: 12 }}>Time:</span>{r.preferred_time || "-"}
              {tutorName && (<><span className="k" style={{ marginLeft: 12 }}>Tutor:</span>{tutorName}</>)}
            </div>

            {expanded && (
              <div className="tc-detail" onClick={e => e.stopPropagation()}>
                <h3>Basic Info</h3>
                <div className="row"><span className="k">Reserver</span><span className="v">{r.guest_name || "-"}</span></div>
                <div className="row"><span className="k">House</span><span className="v">{r.house_number || "-"}</span></div>
                <div className="row"><span className="k">Student (KR)</span><span className="v">{r.student_name_kr || "-"}</span></div>
                <div className="row"><span className="k">Student (EN)</span><span className="v">{r.student_name_en || "-"}</span></div>
                <div className="row"><span className="k">Age</span><span className="v">{r.student_age || "-"}</span></div>

                <h3>Schedule</h3>
                <div className="row"><span className="k">Class type</span><span className="v">{r.class_type || "-"}</span></div>
                <div className="row"><span className="k">Sessions/day</span><span className="v">{r.sessions_per_day === 2 ? "2 (100min)" : "1 (50min)"}</span></div>
                <div className="row"><span className="k">Period</span><span className="v">{fmtDate(r.start_date)} ~ {fmtDate(r.end_date)}</span></div>
                <div className="row"><span className="k">Days</span><span className="v">{r.preferred_days || "-"}</span></div>
                <div className="row"><span className="k">Time</span><span className="v">{r.preferred_time || "-"}</span></div>

                <h3>English Level</h3>
                <div className="row"><span className="k">Overall</span><span className="v">{r.level_english || "-"}</span></div>
                <div className="row"><span className="k">Speaking</span><span className="v">{r.level_speaking || "-"}</span></div>
                <div className="row"><span className="k">Reading</span><span className="v">{r.level_reading || "-"}</span></div>
                <div className="row"><span className="k">Writing</span><span className="v">{r.level_writing || "-"}</span></div>

                <h3>Class Direction</h3>
                <div className="row"><span className="k">Textbook</span><span className="v">{r.textbook || "-"}</span></div>
                <div className="row"><span className="k">Style</span><span className="v">{r.class_style || "-"}</span></div>
                <div className="row"><span className="k">Focus</span><span className="v">{Array.isArray(r.class_focus_arr) ? r.class_focus_arr.join(", ") : "-"}</span></div>
                {r.child_personality && (
                  <div style={{ marginTop: 4 }}>
                    <div className="k" style={{ fontSize: 12, color: "#6b7c93", fontWeight: 600, marginBottom: 4 }}>Personality / Requests</div>
                    <div className="tc-pre">{r.child_personality}</div>
                  </div>
                )}

                <div className="tc-comments">
                  <h3>💬 Comments ({comments.length})</h3>
                  {comments.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#94a3b8", padding: "6px 2px" }}>No comments yet.</div>
                  ) : comments.map(c => (
                    <div key={c.id} className="tc-comment">
                      <span className="who">{c.tutor_name}</span>{c.comment}
                      <span className="when">{c.created_at?.slice(0, 16).replace("T", " ")}</span>
                    </div>
                  ))}
                  <div className="tc-form">
                    <input
                      type="text"
                      placeholder={actingTutor ? `Comment as ${actingTutor}...` : "Select your name first (top right)"}
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") postComment(r.id); }}
                    />
                    <button onClick={() => postComment(r.id)} disabled={posting || !actingTutor || !newComment.trim()}>
                      {posting ? "..." : "Post"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  </>);
}
