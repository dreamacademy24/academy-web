"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthed } from "@/lib/adminAuth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Row {
  id: string;
  reservation_no: string;
  booker_name: string;
  accom_type: string;
  room: string;
  checkin_date: string;
  checkout_date: string;
  academy_option: boolean;
  students: { kor: string; eng: string }[];
}
type SubMap = Record<string, { at: string; by?: string }>;

const KEY = "med_form_submitted";

function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function fmtMD(s: string) { if (!s) return "-"; const d = new Date(s + "T00:00:00"); return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`; }
function dday(s: string) {
  if (!s) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = Math.round((new Date(s + "T00:00:00").getTime() - t.getTime()) / 86400000);
  return d;
}

export default function MedFormsAdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [sub, setSub] = useState<SubMap>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"pending" | "done" | "all">("all");

  useEffect(() => {
    if (!isAdminAuthed()) { router.replace("/login"); return; }
    setAuthed(true);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const today = ymd(new Date());
    const [bRes, sRes] = await Promise.all([
      supabase.from("bookings")
        .select("id,reservation_no,booker_name,students,accom_type,house_no,accom_room,checkin_date,checkout_date,status,academy_option")
        .gte("checkout_date", today)
        .order("checkin_date", { ascending: true }),
      supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle(),
    ]);
    const out: Row[] = [];
    (bRes.data || []).forEach((b: any) => {
      if (String(b.status || "").includes("취소")) return;
      let sts: { kor: string; eng: string }[] = [];
      try {
        const arr = typeof b.students === "string" ? JSON.parse(b.students) : b.students;
        if (Array.isArray(arr)) {
          sts = arr
            .filter((s: any) => String(s?.korName || s?.name_kr || s?.engName || s?.name_en || "").trim())
            .map((s: any) => ({ kor: (s.korName || s.name_kr || "").trim(), eng: (s.engName || s.name_en || "").trim() }));
        }
      } catch { /* ignore */ }
      if (sts.length === 0) return; // 학생 없는 예약은 상비약 대상 아님
      const room = String(b.house_no || b.accom_room || "").trim().replace(/^DH[\s-]*/i, "").toUpperCase();
      out.push({
        id: b.id, reservation_no: b.reservation_no || "", booker_name: b.booker_name || "",
        accom_type: b.accom_type || "", room,
        checkin_date: (b.checkin_date || "").slice(0, 10), checkout_date: (b.checkout_date || "").slice(0, 10),
        academy_option: !!b.academy_option, students: sts,
      });
    });
    setRows(out);
    if (sRes.data && sRes.data.value && typeof sRes.data.value === "object") setSub(sRes.data.value as SubMap);
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function saveSub(next: SubMap) {
    setSub(next);
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/app_settings?on_conflict=key`, {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ key: KEY, value: next, updated_at: new Date().toISOString() }),
    }).catch(() => {});
  }

  function toggle(r: Row) {
    const next = { ...sub };
    if (next[r.id]) delete next[r.id];
    else next[r.id] = { at: new Date().toISOString() };
    saveSub(next);
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter(r => {
      const done = !!sub[r.id];
      if (tab === "pending" && done) return false;
      if (tab === "done" && !done) return false;
      if (!query) return true;
      return [r.booker_name, r.reservation_no, ...r.students.map(s => s.kor), ...r.students.map(s => s.eng)]
        .some(v => v && v.toLowerCase().includes(query));
    });
  }, [rows, sub, q, tab]);

  const doneCount = rows.filter(r => !!sub[r.id]).length;
  const pendingCount = rows.length - doneCount;

  const byMonth = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of filtered) {
      const k = r.checkin_date.slice(0, 7) || "기타";
      const arr = m.get(k) || []; arr.push(r); m.set(k, arr);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.mw{max-width:1100px;margin:0 auto;padding:24px}
.mh{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.mh h1{font-size:20px;font-weight:800;margin:0}
.chip{padding:5px 13px;border-radius:999px;font-size:12.5px;font-weight:700}
.tabs{display:flex;gap:6px}
.tabs button{padding:8px 16px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#64748b;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.tabs button.ac{background:#1a6fc4;border-color:#1a6fc4;color:#fff}
.srch{padding:9px 13px;border:1px solid #cbd5e1;border-radius:9px;font-size:13px;font-family:inherit;width:220px;outline:none}
.mon{font-size:14px;font-weight:800;color:#334155;margin:18px 0 8px}
.card{background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.05);overflow:hidden;margin-bottom:8px}
.row{display:flex;align-items:center;gap:14px;padding:12px 16px;flex-wrap:wrap}
.dd{min-width:44px;font-weight:800;font-size:13px}
.dd.red{color:#dc2626}.dd.org{color:#d97706}.dd.grn{color:#16a34a}
.bk{min-width:90px;font-weight:800;font-size:14.5px}
.rm{min-width:120px;font-size:12.5px;color:#475569;font-weight:600}
.stu{flex:1;display:flex;gap:5px;flex-wrap:wrap}
.stu span{font-size:12px;background:#eef2ff;color:#4338ca;border-radius:7px;padding:3px 9px;font-weight:700}
.st-done{background:#dcfce7;color:#166534}
.st-pend{background:#fef2f2;color:#dc2626}
.btn{padding:7px 13px;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid #cbd5e1;background:#fff;color:#475569;white-space:nowrap}
.btn.pr{background:#0f766e;border-color:#0f766e;color:#fff}
.empty{padding:50px;text-align:center;color:#94a3b8;font-size:14px;background:#fff;border-radius:12px}
    `}</style>
    <div className="mw">
      <div className="mh">
        <button className="btn" onClick={() => router.push("/admin/hub")}>← 어드민 홈</button>
        <h1>💊 상비약 관리</h1>
        <span className="chip" style={{ background: "#fef2f2", color: "#dc2626" }}>미제출 {pendingCount}</span>
        <span className="chip" style={{ background: "#dcfce7", color: "#166534" }}>제출완료 {doneCount}</span>
        <div style={{ flex: 1 }} />
        <div className="tabs">
          <button className={tab === "all" ? "ac" : ""} onClick={() => setTab("all")}>전체</button>
          <button className={tab === "pending" ? "ac" : ""} onClick={() => setTab("pending")}>미제출</button>
          <button className={tab === "done" ? "ac" : ""} onClick={() => setTab("done")}>제출완료</button>
        </div>
        <input className="srch" placeholder="🔍 예약자·학생 이름 검색" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
        체크인(수업 시작) 예정~진행 중이면서 학생이 있는 예약만 표시됩니다 · [안내서 출력] = 아이별 1장 자동 생성
      </div>

      {loading ? (
        <div className="empty">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="empty">해당하는 예약이 없습니다.</div>
      ) : byMonth.map(([mon, list]) => (
        <div key={mon}>
          <div className="mon">📅 {Number(mon.slice(0, 4))}년 {Number(mon.slice(5, 7))}월 · {list.length}가족</div>
          {list.map(r => {
            const d = dday(r.checkin_date);
            const started = d != null && d <= 0;
            const ddCls = d == null ? "" : d <= 7 ? "red" : d <= 30 ? "org" : "grn";
            const done = !!sub[r.id];
            return (
              <div className="card" key={r.id}>
                <div className="row">
                  <span className={`dd ${ddCls}`}>{d == null ? "-" : started ? "체류중" : `D-${d}`}</span>
                  <span className="bk" title={r.reservation_no}>{r.booker_name || "-"}</span>
                  <span className="rm">🏠 {r.room || r.accom_type}{r.academy_option ? " · 🏫" : ""}</span>
                  <div className="stu">
                    {r.students.map((s, i) => <span key={i}>{s.kor || s.eng}</span>)}
                  </div>
                  <span className="chip" style={{ fontSize: 11.5 }} >
                    <span className={`chip ${done ? "st-done" : "st-pend"}`} style={{ padding: "4px 12px" }}>
                      {done ? `✓ 제출완료${sub[r.id]?.at ? " · " + fmtMD(sub[r.id].at.slice(0, 10)) : ""}` : "미제출"}
                    </span>
                  </span>
                  <button className="btn" onClick={() => toggle(r)}>{done ? "↩ 미제출로" : "✓ 제출 처리"}</button>
                  <button className="btn pr" onClick={() => window.open(`/admin/med-form?bookingId=${r.id}`, "_blank")}>🖨 안내서 출력</button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  </>);
}
