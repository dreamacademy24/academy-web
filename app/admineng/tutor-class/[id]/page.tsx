"use client";
import { useEffect, useState, useCallback } from "react";
import { toastErr } from "@/lib/toast";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface TutorReq {
  id: string;
  created_at: string;
  house_number: string | null;
  guest_name: string | null;
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
  schedule_blocks?: Array<{ days: string[]; time: string; sessions_per_day: number }> | null;
}

interface Tutor { id: string; name: string }
interface Comment { id: string; tutor_name: string; comment: string; created_at: string }

const LEVEL_EN: Record<string, string> = {
  zero: "Zero (Absolute Beginner)",
  beginner1: "Beginner 1", beginner2: "Beginner 2",
  intermediate1: "Intermediate 1", intermediate2: "Intermediate 2",
  advanced1: "Advanced 1", advanced2: "Advanced 2",
  enrolled: "Not assessed (enrolled student)",
  "비기너": "Beginner",
  "비기너1": "Beginner 1", "비기너2": "Beginner 2", "비기너3": "Beginner 3",
  "미디엄": "Medium",
  "미디엄1": "Medium 1", "미디엄2": "Medium 2", "미디엄3": "Medium 3",
  "어드밴스": "Advanced",
  "어드밴스1": "Advanced 1", "어드밴스2": "Advanced 2", "어드밴스3": "Advanced 3",
};
const STYLE_EN: Record<string, string> = {
  play: "Play-based", study: "Textbook-based", combined: "Mixed",
  "놀이식": "Play-based", "학습식": "Textbook-based", "교과서식": "Textbook-based",
  "혼합": "Mixed", "놀이+학습": "Mixed",
};
const FOCUS_EN: Record<string, string> = {
  speaking: "Speaking", reading: "Reading", writing: "Writing",
  phonics: "Phonics", vocabulary: "Vocabulary", activity: "Activity",
  listening: "Listening", comprehensive: "Comprehensive",
  "스피킹": "Speaking", "리딩": "Reading", "라이팅": "Writing",
  "리스닝": "Listening", "보카": "Vocabulary", "파닉스": "Phonics",
  "액티비티": "Activity", "종합": "Comprehensive",
};
function fmtAgeEn(s: string | null | undefined): string {
  if (!s) return "-";
  const today = new Date();
  const parts = s.split(",").map(p => p.trim()).filter(Boolean);
  const out = parts.map(p => {
    // YYYYMMDD 형식 (8자리 숫자)
    const dm = p.match(/^\d{8}$/);
    if (dm) {
      const y = parseInt(p.substring(0, 4));
      const m = parseInt(p.substring(4, 6));
      const d = parseInt(p.substring(6, 8));
      let age = today.getFullYear() - y;
      if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
      return `${age} years old`;
    }
    // 만N세 패턴
    const km = p.match(/만\s*(\d+)\s*세/);
    if (km) return `${km[1]} years old`;
    // YYYY.MM.DD 만N세 패턴
    const cleaned = p.replace(/\d{4}\.\d{2}\.\d{2}\s*/g, "");
    const km2 = cleaned.match(/만\s*(\d+)\s*세/);
    if (km2) return `${km2[1]} years old`;
    return cleaned || p;
  });
  return out.join(", ");
}
function computeRate(classType: string | null | undefined, sessionsPerDay: number | null | undefined): number {
  const is2 = classType === "1:2";
  const isDouble = sessionsPerDay === 2;
  if (is2 && isDouble) return 700;
  if (is2) return 350;
  if (isDouble) return 600;
  return 300;
}
function computeWeeks(start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  const diff = e.getTime() - s.getTime();
  if (isNaN(diff) || diff < 0) return 0;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, Math.ceil(days / 7));
}
function countDays(preferredDays: string | null | undefined): number {
  if (!preferredDays) return 0;
  return preferredDays.split(",").map(s => s.trim()).filter(Boolean).length;
}
const DAY_EN: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
  "월": "Mon", "화": "Tue", "수": "Wed", "목": "Thu", "금": "Fri", "토": "Sat", "일": "Sun",
};

export default function EngTutorRequestDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [authed, setAuthed] = useState(false);
  const [row, setRow] = useState<TutorReq | null>(null);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedToast, setSavedToast] = useState(false);
  const [actingTutor, setActingTutor] = useState<string>("");
  const [taking, setTaking] = useState(false);
  const [managerTutorId, setManagerTutorId] = useState<string>("");
  const [savingAssign, setSavingAssign] = useState(false);
  const [newComment, setNewComment] = useState<string>("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let staffName = "";
    try {
      const raw = localStorage.getItem("teacherSession");
      if (raw) {
        const s = JSON.parse(raw);
        if (s?.username) { setAuthed(true); staffName = s.name || ""; }
      }
    } catch {}
    if (!staffName && !localStorage.getItem("teacherSession")) {
      window.location.href = "/admineng/hub";
      return;
    }
    setActingTutor(localStorage.getItem("admineng_tutor_name") || staffName);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [reqRes, tutorRes] = await Promise.all([
      supabase.from("tutor_requests").select("*").eq("id", id).maybeSingle(),
      supabase.from("tutors").select("id, name").eq("is_active", true).order("name"),
    ]);
    setLoading(false);
    if (reqRes.error) { console.error("load failed:", reqRes.error); return; }
    const r = reqRes.data as TutorReq | null;
    if (r && (r as any).booking_id) {
      const { data: bs } = await supabase
        .from("bookings")
        .select("house_no, accom_room")
        .eq("id", (r as any).booking_id)
        .maybeSingle();
      const combined = [bs?.house_no, bs?.accom_room].filter(Boolean).join("");
      if (combined) (r as any).house_number = combined;
    }
    setRow(r);
    if (r?.assigned_tutor_id) setManagerTutorId(r.assigned_tutor_id);
    setTutors((tutorRes.data || []) as Tutor[]);
    loadComments();
  }, [id]);

  const loadComments = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("tutor_class_comments")
      .select("id, tutor_name, comment, created_at")
      .eq("request_id", id)
      .order("created_at", { ascending: true });
    setComments((data || []) as Comment[]);
  }, [id]);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  function showToast() {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 1800);
  }

  function paymentPayload() {
    if (!row) return {};
    const rate = computeRate(row.class_type, row.sessions_per_day);
    const weeks = computeWeeks(row.start_date, row.end_date);
    const dpw = countDays(row.preferred_days);
    const totalClasses = weeks * dpw;
    const totalAmount = totalClasses * rate;
    return {
      total_sessions: totalClasses || null,
      total_amount: totalAmount || null,
      price_per_session: rate || null,
    };
  }

  async function takeThisClass() {
    if (!row) return;
    if (!actingTutor) { toastErr("Please select your name first on the previous page (top right)."); return; }
    const me = tutors.find(t => t.name === actingTutor);
    if (!me) { toastErr(`Tutor "${actingTutor}" not found in active tutor list.`); return; }
    setTaking(true);
    const { error } = await supabase.from("tutor_requests")
      .update({ assigned_tutor_id: me.id, status: "assigned", ...paymentPayload() })
      .eq("id", row.id);
    setTaking(false);
    if (error) { toastErr("Failed: " + error.message); return; }
    showToast();
    load();
  }

  async function saveAssign() {
    if (!row) return;
    setSavingAssign(true);
    const { error } = await supabase.from("tutor_requests")
      .update({ assigned_tutor_id: managerTutorId || null, status: managerTutorId ? "assigned" : row.status, ...paymentPayload() })
      .eq("id", row.id);
    setSavingAssign(false);
    if (error) { toastErr("Failed: " + error.message); return; }
    showToast();
    load();
  }

  async function postComment() {
    if (!row) return;
    if (!actingTutor) { toastErr("Please select your name first on the previous page (top right)."); return; }
    if (!newComment.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("tutor_class_comments").insert({
      request_id: row.id,
      tutor_name: actingTutor,
      comment: newComment.trim(),
    });
    setPosting(false);
    if (error) { toastErr("Failed to post: " + error.message); return; }
    setNewComment("");
    loadComments();
  }

  if (!authed) return null;

  const daysFmt = row?.preferred_days
    ? row.preferred_days.split(",").map(d => DAY_EN[d.trim()] || d.trim()).filter(Boolean).join(", ")
    : "-";
  const focusFmt = Array.isArray(row?.class_focus_arr) && row!.class_focus_arr!.length > 0
    ? row!.class_focus_arr!.map(f => FOCUS_EN[f] || f).join(", ")
    : "-";

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.dw{max-width:900px;margin:0 auto;padding:24px 20px}
.dtop{display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.dback{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:7px 13px;font-size:12px;font-weight:700;color:#475569;cursor:pointer;font-family:inherit}.dback:hover{border-color:#1a6fc4;color:#1a6fc4}
.dtitle{font-size:20px;font-weight:800;flex:1}
.dactor{font-size:11px;color:#6b7c93;background:#fff;padding:6px 12px;border:1px solid #e2e8f0;border-radius:999px;font-weight:600}
.dgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
@media(max-width:760px){.dgrid{grid-template-columns:1fr}}
.dcard{background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 12px rgba(0,0,0,0.05)}
.dcard h2{font-size:12px;font-weight:800;color:#1a6fc4;margin-bottom:12px;padding-bottom:5px;border-bottom:1.5px solid #e2e8f0;letter-spacing:0.04em;text-transform:uppercase}
.drow{display:flex;justify-content:space-between;gap:10px;padding:6px 0;font-size:12.5px;border-bottom:1px dashed #f1f5f9}
.drow:last-child{border-bottom:none}
.drow .k{color:#6b7c93;font-weight:600;flex-shrink:0}
.drow .v{color:#1a1a2e;font-weight:500;text-align:right;word-break:break-word}
.dpre{font-size:12px;line-height:1.6;background:#f8fafc;padding:8px 10px;border-radius:6px;color:#475569;white-space:pre-wrap;margin-top:4px}
.daction{background:#fff;border-radius:14px;padding:16px 18px;box-shadow:0 2px 12px rgba(0,0,0,0.05);margin-bottom:14px}
.daction h3{font-size:13px;font-weight:800;color:#1a1a2e;margin-bottom:10px}
.daction .sub{font-size:11.5px;color:#94a3b8;margin-bottom:10px}
.daction-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.daction-row select{flex:1;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff}
.daction-row select:focus{border-color:#1a6fc4}
.dbtn{padding:9px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;background:#1a6fc4;color:#fff}
.dbtn:hover{background:#155fa0}.dbtn:disabled{opacity:0.5;cursor:not-allowed}
.dbtn-green{background:#16a34a}.dbtn-green:hover{background:#15803d}
.dempty{padding:60px;text-align:center;color:#94a3b8;font-size:14px;background:#fff;border-radius:12px}
.dcomments{background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 12px rgba(0,0,0,0.05)}
.dcomments h3{font-size:13px;font-weight:800;color:#1a6fc4;margin-bottom:10px;padding-bottom:5px;border-bottom:1.5px solid #e2e8f0;letter-spacing:0.04em;text-transform:uppercase}
.dcmsg{background:#f8fafc;border-radius:8px;padding:8px 12px;margin-bottom:6px;font-size:12.5px}
.dcmsg .who{font-weight:700;color:#1a6fc4;margin-right:8px;font-size:11.5px}
.dcmsg .when{color:#94a3b8;font-size:10.5px;margin-left:6px}
.dcmsg .text{color:#1a1a2e;margin-top:3px;line-height:1.5}
.dcform{display:flex;gap:6px;margin-top:10px}
.dcform input{flex:1;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-family:inherit;outline:none}
.dcform input:focus{border-color:#1a6fc4}
.toast{position:fixed;top:24px;left:50%;transform:translateX(-50%);background:#16a34a;color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;font-weight:700;box-shadow:0 6px 20px rgba(22,163,74,0.35);z-index:9999}
    `}</style>

    <div className="dw">
      <div className="dtop">
        <button className="dback" onClick={() => router.push("/admineng/tutor-class")}>← Back</button>
        <span className="dtitle">🎓 Request Detail</span>
        <span className="dactor">{actingTutor ? `Acting as: ${actingTutor}` : "Name not set"}</span>
      </div>

      {loading ? (
        <div className="dempty">Loading...</div>
      ) : !row ? (
        <div className="dempty">Request not found.</div>
      ) : (<>
        <div className="dgrid">
          <div className="dcard">
            <h2>Student Info</h2>
            <div className="drow"><span className="k">House</span><span className="v" style={{ color: "#1a6fc4", fontWeight: 700 }}>{row.house_number || "-"}</span></div>
            <div className="drow"><span className="k">Reserver</span><span className="v">{row.guest_name || "-"}</span></div>
            <div className="drow"><span className="k">Student</span><span className="v">{row.student_name_en || row.student_name_kr || "-"}</span></div>
            <div className="drow"><span className="k">Age</span><span className="v">{fmtAgeEn(row.student_age)}</span></div>
          </div>

          <div className="dcard">
            <h2>Schedule</h2>
            <div className="drow"><span className="k">Class Type</span><span className="v">{row.class_type || "-"}</span></div>
            <div className="drow"><span className="k">Period</span><span className="v">{row.start_date || "-"} ~ {row.end_date || "-"}</span></div>
            {Array.isArray(row.schedule_blocks) && row.schedule_blocks.length > 0 ? (
              row.schedule_blocks.map((b, i) => {
                const daysStr = Array.isArray(b.days)
                  ? b.days.map(d => DAY_EN[d.trim()] || DAY_EN[d.trim().toLowerCase()] || d.trim()).filter(Boolean).join('·')
                  : '';
                const timeStr = (b.time || '-').replace(/\(1타임\)/g, '(1 session)').replace(/\(2타임\)/g, '(2 sessions)');
                const spd = Number(b.sessions_per_day) === 2 ? '2 sessions' : '1 session';
                return (
                  <div key={i} className="drow">
                    <span className="k">Block {i+1}</span>
                    <span className="v">{daysStr || '-'} — {timeStr} ({spd})</span>
                  </div>
                );
              })
            ) : (
              <>
                <div className="drow"><span className="k">Sessions/day</span><span className="v">{row.sessions_per_day === 2 ? "2 sessions (100 min)" : "1 session (50 min)"}</span></div>
                <div className="drow"><span className="k">Days</span><span className="v">{daysFmt}</span></div>
                <div className="drow"><span className="k">Preferred Time</span><span className="v">{(row.preferred_time || "-").replace(/\(1타임\)/g, "(1 session)").replace(/\(2타임\)/g, "(2 sessions)")}</span></div>
              </>
            )}
          </div>

          <div className="dcard">
            <h2>English Level</h2>
            <div className="drow"><span className="k">Overall</span><span className="v">{LEVEL_EN[row.level_english || ""] || row.level_english || "-"}</span></div>
            <div className="drow"><span className="k">Speaking</span><span className="v">{LEVEL_EN[row.level_speaking || ""] || row.level_speaking || "-"}</span></div>
            <div className="drow"><span className="k">Reading</span><span className="v">{LEVEL_EN[row.level_reading || ""] || row.level_reading || "-"}</span></div>
            <div className="drow"><span className="k">Writing</span><span className="v">{LEVEL_EN[row.level_writing || ""] || row.level_writing || "-"}</span></div>
          </div>

          <div className="dcard">
            <h2>Class Direction</h2>
            <div className="drow"><span className="k">Style</span><span className="v">{STYLE_EN[row.class_style || ""] || row.class_style || "-"}</span></div>
            <div className="drow"><span className="k">Focus</span><span className="v">{focusFmt}</span></div>
            <div className="drow"><span className="k">Textbook</span><span className="v">{row.textbook || "-"}</span></div>
            <div className="drow" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <span className="k">Personality / Notes</span>
              <div className="dpre">{row.child_personality || "-"}</div>
            </div>
          </div>
        </div>

        {(() => {
          const rate = computeRate(row.class_type, row.sessions_per_day);
          const weeks = computeWeeks(row.start_date, row.end_date);
          const dpw = countDays(row.preferred_days);
          const totalClasses = weeks * dpw;
          const totalAmount = totalClasses * rate;
          return (
            <div style={{ background: "#fff", border: "2px solid #16a34a", borderRadius: 14, padding: "18px 20px", marginBottom: 14, boxShadow: "0 4px 16px rgba(22,163,74,0.12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>💰</span>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: "#15803d", letterSpacing: 0.3 }}>PAYMENT (collect directly from student)</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7c93", fontWeight: 700, marginBottom: 4 }}>Rate (₱/class)</div>
                  <input type="number" value={rate} readOnly style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, fontWeight: 700, background: "#f1f5f9", color: "#1a1a2e", fontFamily: "inherit" }} />
                  <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4 }}>{row.class_type || "1:1"} · {row.sessions_per_day === 2 ? "2 sessions" : "1 session"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7c93", fontWeight: 700, marginBottom: 4 }}>Total Classes</div>
                  <input type="number" value={totalClasses} readOnly style={{ width: "100%", padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, fontWeight: 700, background: "#f1f5f9", color: "#1a1a2e", fontFamily: "inherit" }} />
                  <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4 }}>{weeks} weeks × {dpw} day(s)/week</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7c93", fontWeight: 700, marginBottom: 4 }}>Total Amount (₱)</div>
                  <input type="number" value={totalAmount} readOnly style={{ width: "100%", padding: "9px 12px", border: "2px solid #16a34a", borderRadius: 8, fontSize: 16, fontWeight: 800, background: "#f0fdf4", color: "#15803d", fontFamily: "inherit" }} />
                  <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4 }}>= {totalClasses} × ₱{rate}</div>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="daction">
          <h3>🙋 Take This Class</h3>
          {actingTutor ? (
            <div className="sub">Assign this request to you ({actingTutor}). Status will become &ldquo;assigned&rdquo;.</div>
          ) : (
            <div className="sub" style={{ color: "#dc2626" }}>⚠️ Select your name first on the previous page (top right) to take a class.</div>
          )}
          <div className="daction-row">
            <button className="dbtn dbtn-green" disabled={taking || !actingTutor} onClick={takeThisClass}>
              {taking ? "Saving..." : "✋ I'll take this class"}
            </button>
          </div>
        </div>

        <div className="daction">
          <h3>👤 Assign to Tutor (Manager)</h3>
          <div className="sub">Manager can assign this request to any active tutor.</div>
          <div className="daction-row">
            <select value={managerTutorId} onChange={e => setManagerTutorId(e.target.value)}>
              <option value="">— Not assigned —</option>
              {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="dbtn" disabled={savingAssign} onClick={saveAssign}>
              {savingAssign ? "Saving..." : "💾 Save"}
            </button>
          </div>
        </div>

        <div className="dcomments">
          <h3>💬 Comments ({comments.length})</h3>
          {comments.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94a3b8", padding: "6px 2px" }}>No comments yet.</div>
          ) : comments.map(c => (
            <div className="dcmsg" key={c.id}>
              <span className="who">{c.tutor_name}</span>
              <span className="when">{new Date(c.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              <div className="text">{c.comment}</div>
            </div>
          ))}
          <div className="dcform">
            <input
              type="text"
              placeholder={actingTutor ? `Comment as ${actingTutor}...` : "Select your name first (top right)"}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") postComment(); }}
            />
            <button className="dbtn" onClick={postComment} disabled={posting || !actingTutor || !newComment.trim()}>
              {posting ? "..." : "Post"}
            </button>
          </div>
        </div>
      </>)}
    </div>

    {savedToast && <div className="toast">✅ Saved!</div>}
  </>);
}
