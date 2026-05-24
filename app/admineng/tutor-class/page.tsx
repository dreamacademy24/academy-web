"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

interface Tutor { id: string; name: string; }
interface TutorReq {
  id: string; created_at: string;
  house_number: string; guest_name: string;
  student_name_kr: string; student_name_en: string;
  student_age: string;
  class_type: string; sessions_per_day: number;
  start_date: string; end_date: string;
  preferred_days: string;
  preferred_time: string;
  level_english: string; level_speaking: string; level_reading: string; level_writing: string;
  class_style: string; class_focus_arr: string[] | null;
  child_personality: string | null;
  status: string; assigned_tutor_id: string | null;
  admin_memo: string | null;
}

const LEVEL_EN: Record<string, string> = {
  zero: "Zero (Absolute Beginner)",
  beginner1: "Beginner 1", beginner2: "Beginner 2",
  intermediate1: "Intermediate 1", intermediate2: "Intermediate 2",
  advanced1: "Advanced 1", advanced2: "Advanced 2",
};
const STYLE_EN: Record<string, string> = { play: "Play-based", study: "Study-focused", combined: "Play + Study" };
const FOCUS_EN: Record<string, string> = {
  speaking: "Speaking", reading: "Reading", writing: "Writing",
  phonics: "Phonics", vocabulary: "Vocabulary", activity: "Activity",
};
const DAY_EN: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };
const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "Pending",   bg: "#f1f5f9", color: "#475569" },
  reviewing: { label: "Reviewing", bg: "#fef3c7", color: "#92400e" },
  assigned:  { label: "Assigned",  bg: "#dbeafe", color: "#1e40af" },
  confirmed: { label: "Confirmed", bg: "#dcfce7", color: "#166534" },
  completed: { label: "Completed", bg: "#d1fae5", color: "#065f46" },
  cancelled: { label: "Cancelled", bg: "#fef2f2", color: "#dc2626" },
};

function fmtDate(s: string) { return s ? s.slice(5).replace('-', '/') : '-'; }

export default function EngTutorClassPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"inbox" | "mine" | "weekly">("inbox");
  const [reqs, setReqs] = useState<TutorReq[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<TutorReq | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignTutorId, setAssignTutorId] = useState("");
  const [comment, setComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [comments, setComments] = useState<{id:string;tutor_name:string;comment:string;created_at:string}[]>([]);

  const [actingTutor, setActingTutor] = useState<string>("");

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else window.location.href = "/login";
    if (typeof window !== "undefined") {
      setActingTutor(localStorage.getItem("admineng_tutor_name") || "");
    }
  }, []);

  function pickActing(name: string) {
    setActingTutor(name);
    if (typeof window !== "undefined") localStorage.setItem("admineng_tutor_name", name);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("tutor_requests").select("*").order("created_at", { ascending: false });
    setReqs((data || []) as TutorReq[]);
    setLoading(false);
  }, []);

  const loadTutors = useCallback(async () => {
    const { data } = await supabase.from("tutors").select("id,name").eq("is_active", true).order("name");
    setTutors((data || []) as Tutor[]);
  }, []);

  useEffect(() => { load(); loadTutors(); }, [load, loadTutors]);

  async function loadComments(reqId: string) {
    const { data } = await supabase
      .from("tutor_class_comments")
      .select("id,tutor_name,comment,created_at")
      .eq("request_id", reqId)
      .order("created_at", { ascending: true });
    setComments(data || []);
  }

  function openDetail(r: TutorReq) {
    setDetail(r);
    setAssignTutorId(r.assigned_tutor_id || "");
    setComment("");
    loadComments(r.id);
  }

  async function saveAssign() {
    if (!detail) return;
    setAssigning(true);
    await supabase.from("tutor_requests").update({
      assigned_tutor_id: assignTutorId || null,
      status: assignTutorId ? "assigned" : detail.status,
    }).eq("id", detail.id);
    setAssigning(false);
    setDetail(null);
    load();
  }

  async function submitComment() {
    if (!detail || !comment.trim()) return;
    setSavingComment(true);
    const tutorName = tutors.find(t => t.id === assignTutorId)?.name || "Staff";
    await supabase.from("tutor_class_comments").insert({
      request_id: detail.id,
      tutor_name: tutorName,
      comment: comment.trim(),
    });
    setComment("");
    loadComments(detail.id);
    setSavingComment(false);
  }

  if (!authed) return null;

  const days = (r: TutorReq) => (r.preferred_days || "").split(",").map(d => DAY_EN[d.trim()] || d.trim()).filter(Boolean).join("/");
  const tutorName = (id: string | null) => tutors.find(t => t.id === id)?.name || "-";

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.ew{max-width:1400px;margin:0 auto;padding:24px 20px}
.etop{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.etop h1{font-size:20px;font-weight:800;flex:1}
.eback{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:7px 13px;font-size:12px;font-weight:700;color:#475569;cursor:pointer;font-family:inherit}.eback:hover{border-color:#1a6fc4;color:#1a6fc4}
.etabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:12px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
.etab{flex:1;padding:10px 8px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:9px;cursor:pointer;font-family:inherit;background:transparent;color:#6b7c93;transition:all 120ms}.etab:hover:not(.ac){background:#f1f5f9}.etab.ac{background:#1a6fc4;color:#fff}
.tbl-w{background:#fff;border-radius:12px;overflow-x:auto;box-shadow:0 2px 12px rgba(0,0,0,0.06)}
.tbl{width:100%;border-collapse:collapse;table-layout:fixed}
.tbl th{font-size:11px;font-weight:700;color:#6b7c93;padding:11px 10px;text-align:left;background:#f8fafc;border-bottom:1px solid #e2e8f0;white-space:nowrap}
.tbl td{font-size:12.5px;padding:10px 10px;border-bottom:1px solid #f1f5f9;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tbl tbody tr:hover td{background:#f8fafc;cursor:pointer}
.ebadge{display:inline-block;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700}
.eoverlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px}
.emodal{background:#fff;border-radius:16px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.18)}
.ehead{position:sticky;top:0;background:#fff;padding:16px 20px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center}
.ehead h3{font-size:16px;font-weight:800}
.eclose{background:none;border:none;font-size:22px;cursor:pointer;color:#6b7c93;padding:4px 8px;border-radius:6px}.eclose:hover{background:#f1f5f9}
.ebody{padding:18px 20px;display:flex;flex-direction:column;gap:16px}
.esec h4{font-size:11px;font-weight:800;color:#1a6fc4;margin-bottom:8px;padding-bottom:4px;border-bottom:1.5px solid #e2e8f0;letter-spacing:0.03em}
.ekv{display:grid;grid-template-columns:130px 1fr;gap:4px 10px;font-size:12.5px}
.ekv .k{color:#6b7c93;font-weight:600}.ekv .v{color:#1a1a2e;word-break:break-word}
.eassign{display:flex;gap:8px;align-items:center;margin-top:4px}
.eassign select{flex:1;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none}
.eassign select:focus{border-color:#1a6fc4}
.ebtn{padding:9px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.ebtn-blue{background:#1a6fc4;color:#fff}.ebtn-blue:hover{background:#155fa0}.ebtn-blue:disabled{opacity:0.5}
.ecomments{display:flex;flex-direction:column;gap:8px}
.ecmsg{background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:12.5px}
.ecmsg .ecwho{font-weight:700;color:#1a6fc4;font-size:11px;margin-bottom:3px}
.ecmsg .ectime{color:#94a3b8;font-size:10.5px;margin-left:6px}
.ecmsg .ectxt{color:#1a1a2e;line-height:1.5}
.ecinput{display:flex;gap:8px;margin-top:4px}
.ecinput textarea{flex:1;padding:9px 11px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;resize:none;outline:none;height:64px}.ecinput textarea:focus{border-color:#1a6fc4}
.eempty{text-align:center;padding:40px;color:#94a3b8;font-size:13px}
    `}</style>
    <div className="ew">
      <div className="etop">
        <button className="eback" onClick={() => router.push("/admineng/hub")}>← Hub</button>
        <h1>🎓 Tutor Classes</h1>
        <select
          value={actingTutor}
          onChange={e => pickActing(e.target.value)}
          style={{ padding: "7px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12.5, fontFamily: "inherit", background: "#fff", fontWeight: 600, color: "#1a6fc4" }}
        >
          <option value="">-- Select your name --</option>
          {tutors.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
      </div>

      <div className="etabs">
        <button className={`etab${tab==="inbox"?" ac":""}`} onClick={() => setTab("inbox")}>📬 Requests Inbox</button>
        <button className={`etab${tab==="mine"?" ac":""}`} onClick={() => setTab("mine")}>📅 My Schedule</button>
        <button className={`etab${tab==="weekly"?" ac":""}`} onClick={() => setTab("weekly")}>🗓 Weekly View</button>
      </div>

      {tab === "inbox" && (
        <div className="tbl-w">
          {loading ? <div className="eempty">Loading...</div> : reqs.length === 0 ? <div className="eempty">No requests yet.</div> : (
            <table className="tbl">
              <thead><tr>
                <th style={{width:"5%"}}>Date</th>
                <th style={{width:"8%"}}>House</th>
                <th style={{width:"10%"}}>Reserver</th>
                <th style={{width:"14%"}}>Student</th>
                <th style={{width:"6%"}}>Age</th>
                <th style={{width:"5%"}}>Type</th>
                <th style={{width:"5%"}}>Time</th>
                <th style={{width:"13%"}}>Period</th>
                <th style={{width:"7%"}}>Days</th>
                <th style={{width:"10%"}}>Tutor</th>
                <th style={{width:"8%"}}>Status</th>
                <th style={{width:"9%",textAlign:"center"}}>Action</th>
              </tr></thead>
              <tbody>
                {reqs.map(r => {
                  const st = STATUS_META[r.status] || STATUS_META.pending;
                  return (
                    <tr key={r.id} onClick={() => openDetail(r)}>
                      <td style={{color:"#6b7c93",fontSize:11}}>{fmtDate(r.created_at)}</td>
                      <td style={{color:"#1a6fc4",fontWeight:700}}>{r.house_number || "-"}</td>
                      <td>{r.guest_name || "-"}</td>
                      <td style={{fontWeight:600}}>{[r.student_name_kr, r.student_name_en].filter(Boolean).join(" / ")}</td>
                      <td style={{color:"#475569"}}>{r.student_age?.replace(/\d{4}\.\d{2}\.\d{2}\s*/g,"") || "-"}</td>
                      <td><span className="ebadge" style={{background:"#eff6ff",color:"#1a6fc4"}}>{r.class_type}</span></td>
                      <td><span className="ebadge" style={{background:r.sessions_per_day===2?"#dbeafe":"#f1f5f9",color:r.sessions_per_day===2?"#1e40af":"#475569"}}>{r.sessions_per_day===2?"2T":"1T"}</span></td>
                      <td style={{fontSize:11}}>{fmtDate(r.start_date)}~{fmtDate(r.end_date)}</td>
                      <td style={{fontSize:11}}>{days(r) || "-"}</td>
                      <td style={{fontSize:11}}>{tutorName(r.assigned_tutor_id)}</td>
                      <td><span className="ebadge" style={{background:st.bg,color:st.color}}>{st.label}</span></td>
                      <td style={{textAlign:"center"}}><button className="ebtn ebtn-blue" style={{padding:"5px 12px",fontSize:11}} onClick={e=>{e.stopPropagation();router.push('/admineng/tutor-class/' + r.id);}}>Detail</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "mine" && (() => {
        const me = tutors.find(t => t.name === actingTutor);
        if (!actingTutor || !me) {
          return <div className="eempty" style={{background:"#fff",borderRadius:12,marginTop:8}}>Please select your name from the top right dropdown.</div>;
        }
        const mine = reqs.filter(r => r.assigned_tutor_id === me.id);
        if (mine.length === 0) {
          return <div className="eempty" style={{background:"#fff",borderRadius:12,marginTop:8}}>No requests assigned to you yet.</div>;
        }
        return (
          <div className="tbl-w">
            <table className="tbl">
              <thead><tr>
                <th style={{width:"5%"}}>Date</th>
                <th style={{width:"8%"}}>House</th>
                <th style={{width:"11%"}}>Reserver</th>
                <th style={{width:"15%"}}>Student</th>
                <th style={{width:"7%"}}>Age</th>
                <th style={{width:"6%"}}>Type</th>
                <th style={{width:"5%"}}>Time</th>
                <th style={{width:"14%"}}>Period</th>
                <th style={{width:"8%"}}>Days</th>
                <th style={{width:"10%"}}>Status</th>
                <th style={{width:"11%",textAlign:"center"}}>Action</th>
              </tr></thead>
              <tbody>
                {mine.map(r => {
                  const st = STATUS_META[r.status] || STATUS_META.pending;
                  return (
                    <tr key={r.id} onClick={() => router.push('/admineng/tutor-class/' + r.id)}>
                      <td style={{color:"#6b7c93",fontSize:11}}>{fmtDate(r.created_at)}</td>
                      <td style={{color:"#1a6fc4",fontWeight:700}}>{r.house_number || "-"}</td>
                      <td>{r.guest_name || "-"}</td>
                      <td style={{fontWeight:600}}>{[r.student_name_kr, r.student_name_en].filter(Boolean).join(" / ")}</td>
                      <td style={{color:"#475569"}}>{r.student_age?.replace(/\d{4}\.\d{2}\.\d{2}\s*/g,"") || "-"}</td>
                      <td><span className="ebadge" style={{background:"#eff6ff",color:"#1a6fc4"}}>{r.class_type}</span></td>
                      <td><span className="ebadge" style={{background:r.sessions_per_day===2?"#dbeafe":"#f1f5f9",color:r.sessions_per_day===2?"#1e40af":"#475569"}}>{r.sessions_per_day===2?"2T":"1T"}</span></td>
                      <td style={{fontSize:11}}>{fmtDate(r.start_date)}~{fmtDate(r.end_date)}</td>
                      <td style={{fontSize:11}}>{days(r) || "-"}</td>
                      <td><span className="ebadge" style={{background:st.bg,color:st.color}}>{st.label}</span></td>
                      <td style={{textAlign:"center"}}><button className="ebtn ebtn-blue" style={{padding:"5px 12px",fontSize:11}} onClick={e=>{e.stopPropagation();router.push('/admineng/tutor-class/' + r.id);}}>Detail</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
      {tab === "weekly" && <div className="eempty" style={{background:"#fff",borderRadius:12,marginTop:8}}>Weekly View — coming soon</div>}
    </div>

    {detail && (
      <div className="eoverlay" onClick={() => setDetail(null)}>
        <div className="emodal" onClick={e => e.stopPropagation()}>
          <div className="ehead">
            <h3>🎓 Request Detail</h3>
            <button className="eclose" onClick={() => setDetail(null)}>×</button>
          </div>
          <div className="ebody">
            <div className="esec">
              <h4>STUDENT INFO</h4>
              <div className="ekv">
                <span className="k">House</span><span className="v" style={{color:"#1a6fc4",fontWeight:700}}>{detail.house_number || "-"}</span>
                <span className="k">Reserver</span><span className="v">{detail.guest_name || "-"}</span>
                <span className="k">Student</span><span className="v">{[detail.student_name_kr, detail.student_name_en].filter(Boolean).join(" / ")}</span>
                <span className="k">Age</span><span className="v">{detail.student_age?.replace(/\d{4}\.\d{2}\.\d{2}\s*/g,"") || "-"}</span>
              </div>
            </div>
            <div className="esec">
              <h4>CLASS INFO</h4>
              <div className="ekv">
                <span className="k">Type</span><span className="v">{detail.class_type} · {detail.sessions_per_day===2?"2 sessions/day":"1 session/day"}</span>
                <span className="k">Period</span><span className="v">{detail.start_date} ~ {detail.end_date}</span>
                <span className="k">Days</span><span className="v">{days(detail) || "-"}</span>
                <span className="k">Preferred Time</span><span className="v">{detail.preferred_time || "-"}</span>
              </div>
            </div>
            <div className="esec">
              <h4>ENGLISH LEVEL</h4>
              <div className="ekv">
                <span className="k">Overall</span><span className="v">{LEVEL_EN[detail.level_english] || detail.level_english || "-"}</span>
                <span className="k">Speaking</span><span className="v">{LEVEL_EN[detail.level_speaking] || detail.level_speaking || "-"}</span>
                <span className="k">Reading</span><span className="v">{LEVEL_EN[detail.level_reading] || detail.level_reading || "-"}</span>
                <span className="k">Writing</span><span className="v">{LEVEL_EN[detail.level_writing] || detail.level_writing || "-"}</span>
              </div>
            </div>
            <div className="esec">
              <h4>CLASS STYLE</h4>
              <div className="ekv">
                <span className="k">Style</span><span className="v">{STYLE_EN[detail.class_style] || detail.class_style || "-"}</span>
                <span className="k">Focus</span><span className="v">{(detail.class_focus_arr||[]).map(f=>FOCUS_EN[f]||f).join(", ") || "-"}</span>
                <span className="k">Notes</span><span className="v" style={{whiteSpace:"pre-wrap"}}>{detail.child_personality || "-"}</span>
              </div>
            </div>
            <div className="esec">
              <h4>ASSIGN TUTOR</h4>
              <div className="eassign">
                <select value={assignTutorId} onChange={e => setAssignTutorId(e.target.value)}>
                  <option value="">— Not assigned —</option>
                  {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button className="ebtn ebtn-blue" disabled={assigning} onClick={saveAssign}>
                  {assigning ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
            <div className="esec">
              <h4>INTERNAL COMMENTS</h4>
              <div className="ecomments">
                {comments.length === 0 && <div style={{color:"#94a3b8",fontSize:12}}>No comments yet.</div>}
                {comments.map(c => (
                  <div className="ecmsg" key={c.id}>
                    <div className="ecwho">{c.tutor_name}<span className="ectime">{new Date(c.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span></div>
                    <div className="ectxt">{c.comment}</div>
                  </div>
                ))}
              </div>
              <div className="ecinput" style={{marginTop:10}}>
                <textarea placeholder="Write a comment (staff only)..." value={comment} onChange={e=>setComment(e.target.value)} />
                <button className="ebtn ebtn-blue" disabled={savingComment||!comment.trim()} onClick={submitComment} style={{alignSelf:"flex-end"}}>
                  {savingComment?"...":"Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
  </>);
}
