"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthed } from "@/lib/adminAuth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Stu { key: string; kor: string; eng: string; }
interface Fam {
  booking_id: string;
  reservation_no: string;
  booker: string;
  accom_type: string;
  room: string;
  checkin_date: string;
  students: Stu[];
}
type SubMap = Record<string, { at: string; by?: string }>;

const KEY = "med_form_submitted";

function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function fmtMD(s: string) { if (!s) return "-"; const d = new Date(s + "T00:00:00"); return `${d.getMonth() + 1}.${d.getDate()}`; }
function dday(s: string) {
  if (!s) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((new Date(s + "T00:00:00").getTime() - t.getTime()) / 86400000);
}

export default function MedFormsAdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [fams, setFams] = useState<Fam[]>([]);
  const [sub, setSub] = useState<SubMap>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const curMonthKey = ymd(new Date()).slice(0, 7);

  useEffect(() => {
    if (!isAdminAuthed()) { router.replace("/login"); return; }
    setAuthed(true);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const today = ymd(new Date());
    const [bRes, sRes] = await Promise.all([
      supabase.from("bookings")
        .select("id,reservation_no,booker_name,students,accom_type,house_no,accom_room,checkin_date,checkout_date,status")
        .gte("checkout_date", today)
        .order("checkin_date", { ascending: true }),
      supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle(),
    ]);
    const out: Fam[] = [];
    (bRes.data || []).forEach((b: any) => {
      if (String(b.status || "").includes("취소")) return;
      let sts: Stu[] = [];
      try {
        const arr = typeof b.students === "string" ? JSON.parse(b.students) : b.students;
        if (Array.isArray(arr)) {
          sts = arr
            .filter((s: any) => String(s?.korName || s?.name_kr || s?.engName || s?.name_en || "").trim())
            .map((s: any) => {
              const kor = (s.korName || s.name_kr || "").trim();
              const eng = (s.engName || s.name_en || "").trim();
              return { key: `${b.id}|${kor || eng}`, kor, eng };
            });
        }
      } catch { /* ignore */ }
      if (sts.length === 0) return;
      const room = String(b.house_no || b.accom_room || "").trim().replace(/^DH[\s-]*/i, "").toUpperCase();
      out.push({
        booking_id: b.id, reservation_no: b.reservation_no || "", booker: b.booker_name || "",
        accom_type: b.accom_type || "", room,
        checkin_date: (b.checkin_date || "").slice(0, 10), students: sts,
      });
    });
    setFams(out);
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

  function toggleStu(key: string) {
    const next = { ...sub };
    if (next[key]) delete next[key];
    else next[key] = { at: new Date().toISOString() };
    saveSub(next);
  }

  const searched = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return fams;
    return fams.filter(f =>
      [f.booker, f.reservation_no, f.room, ...f.students.map(s => s.kor), ...f.students.map(s => s.eng)]
        .some(v => v && v.toLowerCase().includes(query)));
  }, [fams, q]);

  const famDone = useCallback((f: Fam) => f.students.every(s => !!sub[s.key]), [sub]);

  const pendingFams = useMemo(() => searched.filter(f => !famDone(f)), [searched, famDone]);
  const doneFams = useMemo(() => searched.filter(f => famDone(f)), [searched, famDone]);
  const submittedStus = useMemo(() => {
    const out: { fam: Fam; stu: Stu }[] = [];
    for (const f of fams) for (const st of f.students) if (sub[st.key]) out.push({ fam: f, stu: st });
    out.sort((a, b) => (sub[b.stu.key]?.at || "").localeCompare(sub[a.stu.key]?.at || ""));
    return out;
  }, [fams, sub]);

  const totalStu = fams.reduce((n, f) => n + f.students.length, 0);
  const doneStu = fams.reduce((n, f) => n + f.students.filter(s => !!sub[s.key]).length, 0);
  const pendStu = totalStu - doneStu;
  const weekPendStu = fams.reduce((n, f) => {
    const d = dday(f.checkin_date);
    if (d == null || d < 0 || d > 7) return n;
    return n + f.students.filter(s => !sub[s.key]).length;
  }, 0);

  const byMonth = useMemo(() => {
    const m = new Map<string, Fam[]>();
    for (const f of pendingFams) {
      const k = f.checkin_date.slice(0, 7) || "기타";
      const arr = m.get(k) || []; arr.push(f); m.set(k, arr);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pendingFams]);

  if (!authed) return null;

  function famCard(f: Fam) {
    const d = dday(f.checkin_date);
    const started = d != null && d <= 0;
    const urgent = d != null && d > 0 && d <= 7;
    return (
      <div className={`fam${urgent ? " urg" : ""}`} key={f.booking_id}>
        <div className="fh">
          <b>{f.booker || "-"}</b>
          <span className="rm">🏠 {f.room || f.accom_type}</span>
          <span className={`dd ${started ? "red" : urgent ? "org" : "grn"}`}>
            {d == null ? "" : started ? "체류중" : `D-${d}`}{urgent ? " ⚠ 체크인 임박" : ""}
          </span>
          <span style={{ flex: 1 }} />
          <button className="pbtn" onClick={() => window.open(`/admin/med-form?bookingId=${f.booking_id}`, "_blank")}>
            🖨 안내서 {f.students.length}장
          </button>
        </div>
        {f.students.map(s => {
          const done = !!sub[s.key];
          return (
            <div className={`srow${done ? " ok" : ""}`} key={s.key}>
              <b>{s.kor || s.eng}</b>
              {s.eng && <span className="en">{s.eng}</span>}
              <span style={{ flex: 1 }} />
              {done ? (<>
                <span className="st ok">✓ {sub[s.key]?.at ? fmtMD(sub[s.key].at.slice(0, 10)) + " 제출완료" : "제출완료"}</span>
                <button className="ubtn" onClick={() => toggleStu(s.key)}>↩ 되돌리기</button>
              </>) : (<>
                <span className="st no">미제출</span>
                <button className="sbtn" onClick={() => toggleStu(s.key)}>✓ 제출완료</button>
              </>)}
            </div>
          );
        })}
      </div>
    );
  }

  return (<>
    <style>{`
*{box-sizing:border-box}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.mw{max-width:900px;margin:0 auto;padding:24px}
.mh{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.mh h1{font-size:20px;font-weight:800;margin:0}
.srch{padding:9px 13px;border:1px solid #cbd5e1;border-radius:9px;font-size:13px;font-family:inherit;width:220px;outline:none;margin-left:auto}
.btn{padding:8px 13px;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid #cbd5e1;background:#fff;color:#475569}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
.stat{border-radius:11px;padding:12px;text-align:center}
.stat .n{font-size:24px;font-weight:800;line-height:1.2}
.stat .l{font-size:11.5px;font-weight:700}
.mon{font-size:13.5px;font-weight:800;color:#334155;margin:16px 0 8px}
.monBtn{display:flex;align-items:center;justify-content:space-between;width:100%;margin:14px 0 8px;padding:10px 14px;border:1px solid #dbe1ea;border-radius:10px;background:#fff;font-size:13.5px;font-weight:800;color:#334155;cursor:pointer;font-family:inherit}
.monBtn:hover{background:#f8fafc}
.monBtn .mc{font-size:12px;font-weight:700;color:#64748b}
.fam{background:#fff;border:1px solid #e2e8f0;border-radius:11px;margin-bottom:8px;overflow:hidden}
.fam.urg{border-color:#fecaca;border-left:3.5px solid #dc2626}
.fh{display:flex;align-items:center;gap:10px;padding:9px 14px;background:#f8fafc;border-bottom:1px solid #eef0f4;flex-wrap:wrap}
.fh b{font-size:14px}
.fh .rm{font-size:12px;color:#475569;font-weight:600}
.dd{font-size:11.5px;font-weight:800}
.dd.red{color:#dc2626}.dd.org{color:#d97706}.dd.grn{color:#16a34a}
.pbtn{padding:5px 11px;border-radius:7px;border:1px solid #99b8b3;background:#fff;color:#0f766e;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.srow{display:flex;align-items:center;gap:10px;padding:6px 14px;border-top:1px solid #f6f7fa}
.srow:first-of-type{border-top:none}
.srow.ok{background:#f7fdf9}
.srow input{width:17px;height:17px;accent-color:#16a34a;cursor:pointer;flex-shrink:0}
.srow b{font-size:13.5px}
.srow.ok b{color:#64748b}
.srow .en{font-size:11px;color:#6366f1}
.srow.ok .en{color:#94a3b8}
.st{font-size:11.5px;font-weight:700}
.st.ok{color:#16a34a}
.st.no{color:#dc2626}
.sbtn{padding:5px 12px;border-radius:7px;border:none;background:#16a34a;color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.sbtn:hover{background:#15803d}
.ubtn{padding:4px 9px;border-radius:7px;border:1px solid #e2e8f0;background:#fff;color:#94a3b8;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit}
.doneSec{margin-top:20px;background:#fff;border:1px solid #e2e8f0;border-radius:11px;padding:12px 16px}
.doneHd{display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:700;color:#166534}
.doneHd .names{font-weight:400;color:#94a3b8;font-size:12px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.empty{padding:40px;text-align:center;color:#94a3b8;font-size:14px;background:#fff;border-radius:12px}
    `}</style>
    <div className="mw">
      <div className="mh">
        <button className="btn" onClick={() => router.push("/admin/hub")}>← 어드민 홈</button>
        <h1>💊 상비약 관리</h1>
        <input className="srch" placeholder="🔍 학생·예약자·룸 검색" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="stats">
        <div className="stat" style={{ background: "#fef2f2" }}><div className="n" style={{ color: "#dc2626" }}>{pendStu}</div><div className="l" style={{ color: "#991b1b" }}>미제출 학생</div></div>
        <div className="stat" style={{ background: "#fff7ed" }}><div className="n" style={{ color: "#d97706" }}>{weekPendStu}</div><div className="l" style={{ color: "#92400e" }}>이번주 체크인 미제출</div></div>
        <div className="stat" style={{ background: "#f0fdf4", cursor: "pointer" }} onClick={() => { setShowDone(true); setTimeout(() => document.getElementById("doneSec")?.scrollIntoView({ behavior: "smooth" }), 80); }}><div className="n" style={{ color: "#16a34a" }}>{doneStu}</div><div className="l" style={{ color: "#166534" }}>제출완료 (클릭해서 보기)</div></div>
      </div>

      {loading ? (
        <div className="empty">불러오는 중...</div>
      ) : pendingFams.length === 0 ? (
        <div className="empty">🎉 미제출 학생이 없습니다.</div>
      ) : byMonth.map(([mon, list]) => {
        const isOpen = openMonths[mon] !== undefined ? openMonths[mon] : mon === curMonthKey;
        const pendCnt = list.reduce((n, f) => n + f.students.filter(st => !sub[st.key]).length, 0);
        return (
          <div key={mon}>
            <button className="monBtn" onClick={() => setOpenMonths(p => ({ ...p, [mon]: !isOpen }))}>
              <span>{isOpen ? "▾" : "▸"} 📅 {Number(mon.slice(0, 4))}년 {Number(mon.slice(5, 7))}월 체크인</span>
              <span className="mc">{list.length}가족 · <span style={{ color: "#dc2626" }}>미제출 {pendCnt}명</span></span>
            </button>
            {isOpen && list.map(famCard)}
          </div>
        );
      })}

      {doneStu > 0 && (
        <div className="doneSec" id="doneSec">
          <div className="doneHd" onClick={() => setShowDone(v => !v)}>
            <span>✓ 제출완료 학생 {doneStu}명</span>
            <span className="names">— {submittedStus.slice(0, 10).map(x => x.stu.kor || x.stu.eng).join(" · ")}{submittedStus.length > 10 ? " 외" : ""}</span>
            <span style={{ color: "#64748b", fontSize: 12 }}>{showDone ? "▲ 접기" : "▼ 펼치기"}</span>
          </div>
          {showDone && (
            <div style={{ marginTop: 10 }}>
              {submittedStus.map(x => (
                <div className="srow ok" key={x.stu.key} style={{ borderTop: "1px solid #eef0f4" }}>
                  <b>{x.stu.kor || x.stu.eng}</b>
                  {x.stu.eng && <span className="en">{x.stu.eng}</span>}
                  <span style={{ fontSize: 11.5, color: "#64748b" }}>👩 {x.fam.booker} · 🏠 {x.fam.room || x.fam.accom_type}</span>
                  <span style={{ flex: 1 }} />
                  <span className="st ok">✓ {sub[x.stu.key]?.at ? fmtMD(sub[x.stu.key].at.slice(0, 10)) + " 제출완료" : "제출완료"}</span>
                  <button className="ubtn" onClick={() => toggleStu(x.stu.key)}>↩ 되돌리기</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  </>);
}
