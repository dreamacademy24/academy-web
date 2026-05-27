"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";
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

const TUTOR_PALETTE = [
  "#ec4899", "#a855f7", "#3b82f6", "#22c55e", "#eab308",
  "#f97316", "#ef4444", "#06b6d4", "#84cc16", "#6366f1",
];
const UNASSIGNED_COLOR = "#94a3b8";
function tutorColor(tutorId: string | null | undefined): string {
  if (!tutorId) return UNASSIGNED_COLOR;
  let hash = 0;
  for (let i = 0; i < tutorId.length; i++) hash = (hash * 31 + tutorId.charCodeAt(i)) >>> 0;
  return TUTOR_PALETTE[hash % TUTOR_PALETTE.length];
}

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
// 한글/영문/약어 요일 → 표준 키(sun..sat) 매핑.
// DB에는 ["월","수","금"] 같은 한글 또는 ["mon","wed","fri"] 영문이 섞여 있어 둘 다 처리.
function normalizeWeekday(input: string): string {
  if (!input) return "";
  const s = String(input).toLowerCase().trim();
  switch (s) {
    case "일": case "일요일": return "sun";
    case "월": case "월요일": return "mon";
    case "화": case "화요일": return "tue";
    case "수": case "수요일": return "wed";
    case "목": case "목요일": return "thu";
    case "금": case "금요일": return "fri";
    case "토": case "토요일": return "sat";
  }
  if (s.startsWith("sun")) return "sun";
  if (s.startsWith("mon")) return "mon";
  if (s.startsWith("tue")) return "tue";
  if (s.startsWith("wed")) return "wed";
  if (s.startsWith("thu")) return "thu";
  if (s.startsWith("fri")) return "fri";
  if (s.startsWith("sat")) return "sat";
  return s;
}
const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function sundayWeek(offset = 0): { dates: string[]; startDate: Date; endDate: Date } {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun..6=Sat
  const sun = new Date(now);
  sun.setDate(now.getDate() - dow);
  sun.setHours(0, 0, 0, 0);
  sun.setDate(sun.getDate() + offset * 7);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sun);
    d.setDate(sun.getDate() + i);
    dates.push(ymd(d));
  }
  const sat = new Date(sun);
  sat.setDate(sun.getDate() + 6);
  return { dates, startDate: sun, endDate: sat };
}
function fmtRange(s: Date, e: Date) {
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opt)} – ${e.toLocaleDateString("en-US", opt)}, ${e.getFullYear()}`;
}

export default function EngTutorClassPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"inbox" | "mine" | "classes" | "weekly" | "invoice">("inbox");
  const [myLessons, setMyLessons] = useState<any[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [mineWeekOffset, setMineWeekOffset] = useState(0);
  const [allLessons, setAllLessons] = useState<any[]>([]);
  const [loadingAllLessons, setLoadingAllLessons] = useState(false);

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else window.location.href = "/login";
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("admineng_tutor_name") || "";
      const info = getAdminInfo();
      setActingTutor(saved || (info?.name || ""));
    }
  }, []);

  function pickActing(name: string) {
    setActingTutor(name);
    if (typeof window !== "undefined") localStorage.setItem("admineng_tutor_name", name);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("tutor_requests").select("*").order("created_at", { ascending: false });
    const list = (data || []) as any[];
    const bookingIds = Array.from(new Set(list.map(r => r.booking_id).filter(Boolean)));
    if (bookingIds.length > 0) {
      const { data: bs } = await supabase.from("bookings").select("id, house_no, accom_room").in("id", bookingIds);
      const bm: Record<string, { house_no?: string; accom_room?: string }> = {};
      (bs || []).forEach((b: any) => { bm[b.id] = { house_no: b.house_no, accom_room: b.accom_room }; });
      list.forEach(r => {
        const b = bm[r.booking_id] || {};
        const combined = [b.house_no, b.accom_room].filter(Boolean).join('');
        if (combined) r.house_number = combined;
      });
    }
    setReqs(list as TutorReq[]);
    setLoading(false);
  }, []);

  const loadTutors = useCallback(async () => {
    const { data } = await supabase.from("tutors").select("id,name").eq("is_active", true).order("name");
    setTutors((data || []) as Tutor[]);
  }, []);

  useEffect(() => { load(); loadTutors(); }, [load, loadTutors]);

  // Resolve "me" — first try exact match on actingTutor, then case-insensitive against admin name
  const me = useMemo(() => {
    if (!tutors.length) return null;
    const want = (actingTutor || "").trim();
    if (!want) return null;
    return (
      tutors.find(t => t.name === want) ||
      tutors.find(t => (t.name || "").toLowerCase() === want.toLowerCase()) ||
      null
    );
  }, [actingTutor, tutors]);

  // My Classes (tutor_lessons) 로드 — tutor_id 매칭 + 미배정(null) 중 tutor_requests로 연결된 수업도 포함
  useEffect(() => {
    if (!me) { setMyLessons([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingLessons(true);
      const myReqIds = reqs.filter(r => r.assigned_tutor_id === me.id).map(r => r.id);
      const [{ data: direct }, { data: nullRows }] = await Promise.all([
        supabase
          .from("tutor_lessons")
          .select("*")
          .eq("tutor_id", me.id)
          .order("created_at", { ascending: false }),
        myReqIds.length > 0
          ? supabase
              .from("tutor_lessons")
              .select("*")
              .is("tutor_id", null)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      const matchedNull = (nullRows || []).filter((l: any) =>
        myReqIds.some(rid => (l.admin_memo || "").includes(`request_id: ${rid}`))
      );
      const map = new Map<string, any>();
      [...(direct || []), ...matchedNull].forEach(l => map.set(l.id, l));
      const merged = Array.from(map.values()).sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
      if (!cancelled) {
        setMyLessons(merged);
        setLoadingLessons(false);
      }
    })();
    return () => { cancelled = true; };
  }, [me, reqs]);

  // Weekly View — 모든 active 수업 로드 (탭 진입 시)
  useEffect(() => {
    if (tab !== "weekly") return;
    let cancelled = false;
    (async () => {
      setLoadingAllLessons(true);
      const { data } = await supabase
        .from("tutor_lessons")
        .select("*")
        .eq("status", "active")
        .order("class_time", { ascending: true });
      if (!cancelled) {
        setAllLessons(data || []);
        setLoadingAllLessons(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab]);

  const week = useMemo(() => sundayWeek(weekOffset), [weekOffset]);

  // Map: dateStr → lessons that occur on that day (filtered by date range overlap + class_days)
  const weekLessonsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const d of week.dates) map.set(d, []);
    for (const l of allLessons) {
      const start = l.start_date || "";
      const end = l.end_date || "";
      const rawDays: string[] = Array.isArray(l.class_days)
        ? l.class_days
        : typeof l.class_days === "string"
          ? l.class_days.split(",")
          : [];
      const days = rawDays.map((d: string) => normalizeWeekday(d)).filter(Boolean);
      for (let i = 0; i < week.dates.length; i++) {
        const ds = week.dates[i];
        if (start && ds < start) continue;
        if (end && ds > end) continue;
        const key = WEEKDAY_KEYS[i];
        if (days.length === 0 || days.includes(key)) {
          map.get(ds)!.push(l);
        }
      }
    }
    return map;
  }, [allLessons, week.dates]);

  const weekTutorLegend = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; color: string }>();
    for (const arr of weekLessonsByDate.values()) {
      for (const l of arr) {
        const id = l.tutor_id;
        if (!id) continue;
        if (seen.has(id)) continue;
        const name = tutors.find(t => t.id === id)?.name || "(unknown)";
        seen.set(id, { id, name, color: tutorColor(id) });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [weekLessonsByDate, tutors]);

  const weekHasUnassigned = useMemo(() => {
    for (const arr of weekLessonsByDate.values()) {
      if (arr.some(l => !l.tutor_id)) return true;
    }
    return false;
  }, [weekLessonsByDate]);

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
        <button className={`etab${tab==="classes"?" ac":""}`} onClick={() => setTab("classes")}>🎓 My Classes</button>
        <button className={`etab${tab==="weekly"?" ac":""}`} onClick={() => setTab("weekly")}>🗓 Weekly View</button>
        <button className={`etab${tab==="invoice"?" ac":""}`} onClick={() => setTab("invoice")}>💰 Invoice</button>
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
        if (!me) {
          return <div className="eempty" style={{background:"#fff",borderRadius:12,marginTop:8}}>No classes assigned yet</div>;
        }
        if (loadingLessons) {
          return <div className="eempty" style={{background:"#fff",borderRadius:12,marginTop:8}}>Loading...</div>;
        }
        // 데이터 소스 병합: tutor_requests(confirmed, 내 assignment) + myLessons(tutor_lessons 직접/null+memo)
        // myLessons는 useEffect에서 이미 병합된 상태. 추가로 tutor_requests에서 confirmed인데 lesson이 없는 건도 포함.
        type ScheduleEntry = {
          id: string; source: "lesson" | "request";
          start: string; end: string; days: string[];
          time: string; student: string; classType: string;
          rowId: string;
        };
        const entries: ScheduleEntry[] = [];
        const seenReqIds = new Set<string>();
        for (const l of myLessons) {
          const rawDays = Array.isArray(l.class_days)
            ? l.class_days
            : typeof l.class_days === "string"
              ? l.class_days.split(",")
              : [];
          const days = rawDays.map((d: string) => normalizeWeekday(d)).filter(Boolean);
          // admin_memo에서 request_id 추출 (있다면 dedupe용)
          const m = /request_id:\s*([a-f0-9-]+)/i.exec(l.admin_memo || "");
          if (m) seenReqIds.add(m[1]);
          entries.push({
            id: "L:" + l.id,
            source: "lesson",
            start: l.start_date || "",
            end: l.end_date || "",
            days,
            time: l.confirmed_time || l.class_time || "",
            student: (l.student_names || "").split(/[\/,]/)[0].trim() || "-",
            classType: l.class_type || "",
            rowId: l.id,
          });
        }
        const confirmedReqs = reqs.filter(r => r.assigned_tutor_id === me.id && r.status === "confirmed");
        for (const r of confirmedReqs) {
          if (seenReqIds.has(r.id)) continue; // lesson 쪽에서 이미 표시
          const days = (r.preferred_days || "").split(",").map((d: string) => normalizeWeekday(d)).filter(Boolean);
          entries.push({
            id: "R:" + r.id,
            source: "request",
            start: r.start_date || "",
            end: r.end_date || "",
            days,
            time: r.preferred_time || "",
            student: [r.student_name_kr, r.student_name_en].filter(Boolean).join(" / ") || "-",
            classType: r.class_type || "",
            rowId: r.id,
          });
        }

        if (entries.length === 0) {
          return <div className="eempty" style={{background:"#fff",borderRadius:12,marginTop:8}}>No classes assigned yet</div>;
        }

        const wk = sundayWeek(mineWeekOffset);
        const cellMap = new Map<string, ScheduleEntry[]>();
        for (const d of wk.dates) cellMap.set(d, []);
        for (const e of entries) {
          for (let i = 0; i < wk.dates.length; i++) {
            const ds = wk.dates[i];
            if (e.start && ds < e.start) continue;
            if (e.end && ds > e.end) continue;
            const key = WEEKDAY_KEYS[i];
            if (e.days.length === 0 || e.days.includes(key)) {
              cellMap.get(ds)!.push(e);
            }
          }
        }

        const todayIso = ymd(new Date());
        const myColor = tutorColor(me.id);

        return (
          <div style={{background:"#fff",borderRadius:12,padding:16,marginTop:8,boxShadow:"0 2px 12px rgba(0,0,0,0.05)"}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",marginBottom:12}}>
              <div style={{display:"flex",gap:4,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:3}}>
                <button onClick={() => setMineWeekOffset(o => o - 1)} style={{padding:"7px 14px",border:"none",borderRadius:7,fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"transparent",color:"#475569"}}>◀ Prev</button>
                <button onClick={() => setMineWeekOffset(0)} style={{padding:"7px 14px",border:"none",borderRadius:7,fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:mineWeekOffset===0?"#1a6fc4":"transparent",color:mineWeekOffset===0?"#fff":"#475569"}}>This Week</button>
                <button onClick={() => setMineWeekOffset(o => o + 1)} style={{padding:"7px 14px",border:"none",borderRadius:7,fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"transparent",color:"#475569"}}>Next ▶</button>
              </div>
              <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e",padding:"7px 12px",background:"#eff6ff",borderRadius:8}}>
                {fmtRange(wk.startDate, wk.endDate)}
              </div>
              <div style={{flex:1}} />
              <div style={{fontSize:12,color:"#6b7c93",fontWeight:600}}>
                {me.name} · {entries.length} {entries.length === 1 ? "class" : "classes"}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(140px,1fr))",gap:8,overflowX:"auto"}}>
              {wk.dates.map((date, i) => {
                const dt = new Date(date + "T00:00:00");
                const dayNum = dt.getDate();
                const isToday = date === todayIso;
                const isWeekend = i === 0 || i === 6;
                const list = cellMap.get(date) || [];
                return (
                  <div key={date} style={{background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0",padding:8,minHeight:280,display:"flex",flexDirection:"column"}}>
                    <div style={{textAlign:"center",paddingBottom:8,marginBottom:8,borderBottom:"1px solid #e2e8f0"}}>
                      <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.04em",color:isWeekend?"#dc2626":(isToday?"#1a6fc4":"#94a3b8"),marginBottom:3}}>{WEEKDAY_LABELS[i]}</div>
                      <div style={{fontSize:14,fontWeight:800,color:"#1a1a2e"}}>
                        {isToday
                          ? <span style={{display:"inline-block",background:"#1a6fc4",color:"#fff",borderRadius:999,width:26,height:26,lineHeight:"26px"}}>{dayNum}</span>
                          : dayNum
                        }
                      </div>
                    </div>
                    {list.length === 0 ? (
                      <div style={{textAlign:"center",color:"#cbd5e1",fontSize:11,padding:"20px 4px",fontWeight:600}}>No class</div>
                    ) : (
                      list.map(e => (
                        <div
                          key={e.id + ":" + date}
                          onClick={() => router.push('/admineng/tutor-class/' + (e.source === "request" ? e.rowId : ""))}
                          style={{borderLeft:`4px solid ${myColor}`,borderRadius:7,padding:"6px 8px",marginBottom:6,background:"#fff",boxShadow:"0 1px 2px rgba(0,0,0,0.04)",cursor:e.source==="request"?"pointer":"default"}}
                        >
                          <div style={{fontSize:12.5,fontWeight:700,color:"#1a1a2e",lineHeight:1.3,wordBreak:"keep-all"}}>{e.student}</div>
                          {e.time && <div style={{fontSize:10.5,color:"#6b7c93",fontWeight:700,marginTop:2}}>{e.time}</div>}
                          {e.classType && <div style={{fontSize:10,color:myColor,fontWeight:700,marginTop:2}}>{e.classType}{e.source==="request"?" · pending":""}</div>}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{marginTop:10,fontSize:11,color:"#94a3b8"}}>
              Sources: tutor_lessons (assigned to you) + tutor_requests (confirmed assignments)
            </div>
          </div>
        );
      })()}
      {tab === "classes" && (() => {
        if (!me) {
          return <div className="eempty" style={{background:"#fff",borderRadius:12,marginTop:8}}>No classes assigned yet</div>;
        }
        if (loadingLessons) {
          return <div className="eempty" style={{background:"#fff",borderRadius:12,marginTop:8}}>Loading...</div>;
        }
        if (myLessons.length === 0) {
          return <div className="eempty" style={{background:"#fff",borderRadius:12,marginTop:8}}>No classes assigned yet</div>;
        }
        return (
          <div className="tbl-w">
            <table className="tbl">
              <thead><tr>
                <th style={{width:"15%"}}>Student</th>
                <th style={{width:"5%"}}>Type</th>
                <th style={{width:"6%"}}>Sessions/day</th>
                <th style={{width:"10%"}}>Days</th>
                <th style={{width:"10%"}}>Time</th>
                <th style={{width:"14%"}}>Period</th>
                <th style={{width:"7%"}}>Classes</th>
                <th style={{width:"9%"}}>Amount</th>
                <th style={{width:"8%"}}>Status</th>
                <th style={{width:"16%",textAlign:"center"}}>Actions</th>
              </tr></thead>
              <tbody>
                {myLessons.map((l: any) => {
                  const statusLabel = l.status === "active" ? "In Progress" : l.status === "completed" ? "Completed" : (l.status || "-");
                  const statusBg = l.status === "active" ? "#dcfce7" : l.status === "completed" ? "#dbeafe" : "#f1f5f9";
                  const statusFg = l.status === "active" ? "#15803d" : l.status === "completed" ? "#1e40af" : "#475569";
                  const daysStr = Array.isArray(l.class_days) ? l.class_days.join(", ") : (l.class_days || "-");
                  return (
                    <tr key={l.id}>
                      <td style={{fontWeight:600}}>{l.student_names || "-"}</td>
                      <td><span className="ebadge" style={{background:"#eff6ff",color:"#1a6fc4"}}>{l.class_type || "-"}</span></td>
                      <td style={{textAlign:"center"}}>{l.sessions_per_day || 1}</td>
                      <td style={{fontSize:11}}>{daysStr}</td>
                      <td style={{fontSize:11}}>{l.class_time || "-"}</td>
                      <td style={{fontSize:11}}>{fmtDate(l.start_date)}~{fmtDate(l.end_date)}</td>
                      <td style={{textAlign:"center"}}>{l.total_sessions ?? "-"}</td>
                      <td style={{fontWeight:700,color:"#15803d"}}>{l.total_amount != null ? `₱${l.total_amount.toLocaleString()}` : "-"}</td>
                      <td><span className="ebadge" style={{background:statusBg,color:statusFg}}>{statusLabel}</span></td>
                      <td style={{textAlign:"center"}}>
                        <button className="ebtn" style={{padding:"5px 10px",fontSize:11,background:"#3b82f6",color:"#fff",marginRight:4}} onClick={() => router.push("/admin/tutor-class?tab=students")}>Attendance</button>
                        <button className="ebtn" style={{padding:"5px 10px",fontSize:11,background:"#16a34a",color:"#fff"}} onClick={() => router.push("/admin/tutor-class?tab=invoice&lesson_id=" + l.id)}>Invoice</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {tab === "weekly" && (
        <div style={{background:"#fff",borderRadius:12,padding:16,marginTop:8,boxShadow:"0 2px 12px rgba(0,0,0,0.05)"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",marginBottom:12}}>
            <div style={{display:"flex",gap:4,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:3}}>
              <button onClick={() => setWeekOffset(o => o - 1)} style={{padding:"7px 14px",border:"none",borderRadius:7,fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"transparent",color:"#475569"}}>◀ Prev</button>
              <button onClick={() => setWeekOffset(0)} style={{padding:"7px 14px",border:"none",borderRadius:7,fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:weekOffset===0?"#1a6fc4":"transparent",color:weekOffset===0?"#fff":"#475569"}}>This Week</button>
              <button onClick={() => setWeekOffset(o => o + 1)} style={{padding:"7px 14px",border:"none",borderRadius:7,fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"transparent",color:"#475569"}}>Next ▶</button>
            </div>
            <div style={{fontSize:13,fontWeight:700,color:"#1a1a2e",padding:"7px 12px",background:"#eff6ff",borderRadius:8}}>
              {fmtRange(week.startDate, week.endDate)}
            </div>
            <div style={{flex:1}} />
            <div style={{fontSize:12,color:"#6b7c93",fontWeight:600}}>
              {loadingAllLessons ? "Loading..." : `${allLessons.length} active lessons`}
            </div>
          </div>

          {(weekTutorLegend.length > 0 || weekHasUnassigned) && (
            <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:12,fontSize:11.5,color:"#475569",fontWeight:700,padding:"8px 12px",background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0"}}>
              {weekTutorLegend.map(t => (
                <span key={t.id} style={{display:"inline-flex",alignItems:"center",gap:5}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:t.color,display:"inline-block"}} />
                  {t.name}
                </span>
              ))}
              {weekHasUnassigned && (
                <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:UNASSIGNED_COLOR,display:"inline-block"}} />
                  Unassigned
                </span>
              )}
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(140px,1fr))",gap:8,overflowX:"auto"}}>
            {week.dates.map((date, i) => {
              const dt = new Date(date + "T00:00:00");
              const dayNum = dt.getDate();
              const isToday = date === ymd(new Date());
              const isWeekend = i === 0 || i === 6;
              const list = weekLessonsByDate.get(date) || [];
              return (
                <div key={date} style={{background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0",padding:8,minHeight:380,display:"flex",flexDirection:"column"}}>
                  <div style={{textAlign:"center",paddingBottom:8,marginBottom:8,borderBottom:"1px solid #e2e8f0"}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.04em",color:isWeekend?"#dc2626":(isToday?"#1a6fc4":"#94a3b8"),marginBottom:3}}>{WEEKDAY_LABELS[i]}</div>
                    <div style={{fontSize:14,fontWeight:800,color:"#1a1a2e"}}>
                      {isToday
                        ? <span style={{display:"inline-block",background:"#1a6fc4",color:"#fff",borderRadius:999,width:26,height:26,lineHeight:"26px"}}>{dayNum}</span>
                        : dayNum
                      }
                    </div>
                  </div>
                  {list.length === 0 ? (
                    <div style={{textAlign:"center",color:"#cbd5e1",fontSize:11,padding:"30px 4px",fontWeight:600}}>No class</div>
                  ) : (
                    list.map((l: any) => {
                      const tname = l.tutor_id ? (tutors.find(t => t.id === l.tutor_id)?.name || "(unknown)") : "Unassigned";
                      const color = tutorColor(l.tutor_id);
                      const sname = (l.student_names || "-").split(/[\/,]/)[0].trim() || "-";
                      const time = l.confirmed_time || l.class_time || "--:--";
                      return (
                        <div
                          key={l.id}
                          style={{borderLeft:`4px solid ${color}`,borderRadius:7,padding:"6px 8px",marginBottom:6,background:"#fff",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}
                        >
                          <div style={{fontSize:11.5,fontWeight:800,color:l.tutor_id?color:"#dc2626",lineHeight:1.3}}>{tname}</div>
                          <div style={{fontSize:12.5,fontWeight:700,color:"#1a1a2e",marginTop:2,lineHeight:1.3,wordBreak:"keep-all"}}>{sname}</div>
                          <div style={{fontSize:10.5,color:"#6b7c93",fontWeight:700,marginTop:2}}>{time}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "invoice" && (() => {
        if (!me) {
          return <div className="eempty" style={{background:"#fff",borderRadius:12,marginTop:8}}>No classes assigned yet</div>;
        }
        if (myLessons.length === 0) {
          return <div className="eempty" style={{background:"#fff",borderRadius:12,marginTop:8}}>No classes assigned yet</div>;
        }
        return (
          <div style={{background:"#fff",borderRadius:12,padding:24,marginTop:8,boxShadow:"0 2px 12px rgba(0,0,0,0.05)"}}>
            <h2 style={{fontSize:14,fontWeight:800,color:"#1a6fc4",marginBottom:12,paddingBottom:6,borderBottom:"1px solid #e2e8f0"}}>💰 Select a class to view the invoice</h2>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {myLessons.map((l: any) => (
                <button key={l.id} type="button"
                  onClick={() => router.push("/admin/tutor-class?tab=invoice&lesson_id=" + l.id)}
                  style={{padding:"12px 16px",border:"1px solid #e2e8f0",borderRadius:9,textAlign:"left",cursor:"pointer",fontFamily:"inherit",background:"#fff",fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}
                >
                  <span style={{fontWeight:700,color:"#1a1a2e"}}>{l.student_names || "-"} <span style={{fontWeight:400,color:"#6b7c93",marginLeft:6}}>· {l.class_type || ""} · {fmtDate(l.start_date)}~{fmtDate(l.end_date)}</span></span>
                  <span style={{color:"#16a34a",fontWeight:700}}>{l.total_amount != null ? `₱${l.total_amount.toLocaleString()}` : ""} →</span>
                </button>
              ))}
            </div>
            <div style={{marginTop:14,fontSize:11.5,color:"#94a3b8"}}>Calendar, print and image-save buttons are available on the admin invoice page.</div>
          </div>
        );
      })()}
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
