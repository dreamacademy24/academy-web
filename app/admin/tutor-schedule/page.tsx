"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthed } from "@/lib/adminAuth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface Tutor { id: string; name: string }
interface Lesson { id: string; student_name: string; tutor_name: string; lesson_date: string; lesson_time: string; lesson_type: string; status: string }

const DAYS = ["월","화","수","목","금","토","일"];

function weekDates(base: Date): string[] {
  const d = new Date(base);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(d); dd.setDate(d.getDate() + i); return dd.toISOString().slice(0, 10); });
}
function fShort(d: string) { const dt = new Date(d + "T00:00:00"); return `${dt.getMonth() + 1}/${dt.getDate()}(${DAYS[(dt.getDay() + 6) % 7]})`; }

export default function TutorSchedulePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [baseDate, setBaseDate] = useState(new Date());
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [popup, setPopup] = useState<{ tutor: string; date: string; items: Lesson[] } | null>(null);

  const dates = weekDates(baseDate);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    const [t, l] = await Promise.all([
      supabase.from("tutors").select("id, name").eq("is_active", true).order("name"),
      supabase.from("online_class_enrollments").select("*").gte("lesson_date", dates[0]).lte("lesson_date", dates[6]).order("lesson_time"),
    ]);
    if (t.data) setTutors(t.data as Tutor[]);
    if (l.data) setLessons(l.data as Lesson[]);
  }, [dates[0], dates[6]]);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else if (typeof window !== "undefined") window.location.href = "/admin"; }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  function shift(n: number) { const d = new Date(baseDate); d.setDate(d.getDate() + n * 7); setBaseDate(d); }

  function cellLessons(tutorName: string, date: string) {
    return lessons.filter(l => l.tutor_name === tutorName && l.lesson_date === date);
  }

  const todayLessons = lessons.filter(l => l.lesson_date === today).sort((a, b) => (a.lesson_time || "").localeCompare(b.lesson_time || ""));

  const ST: Record<string, { label: string; bg: string; color: string }> = {
    scheduled: { label: "예정", bg: "#f1f5f9", color: "#64748b" },
    attended:  { label: "출석", bg: "#dcfce7", color: "#166534" },
    absent:    { label: "결석", bg: "#fef2f2", color: "#dc2626" },
  };

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.ts-w{max-width:1100px;margin:0 auto;padding:32px 20px}
.ts-top{display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap}
.ts-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.ts-back:hover{background:#e2e8f0}
.ts-top h1{font-size:22px;font-weight:800;flex:1}
.nav{display:flex;align-items:center;gap:6px}
.nav button{padding:6px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}.nav button:hover{background:#e2e8f0}
.nav .cur{font-size:14px;font-weight:700;min-width:180px;text-align:center}
.sec{background:#fff;border-radius:14px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow-x:auto;margin-bottom:20px}
.grid{width:100%;border-collapse:collapse;font-size:12px;min-width:600px}
.grid th{background:#f8fafc;padding:10px 6px;font-size:12px;font-weight:700;color:#6b7c93;border:1px solid #e2e8f0;text-align:center;white-space:nowrap}
.grid td{border:1px solid #e2e8f0;padding:6px;vertical-align:top;text-align:center;min-width:80px;height:50px}
.grid .tutor-cell{background:#f8fafc;font-weight:700;text-align:left;padding:8px 10px;min-width:80px}
.chip{display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;margin:1px}
.chip:hover{opacity:0.8}
.chip-0{color:#cbd5e1}
.today-sec h3{font-size:15px;font-weight:700;margin-bottom:12px}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{background:#f8fafc;padding:8px 10px;text-align:left;font-weight:700;font-size:12px;color:#6b7c93;border-bottom:2px solid #e2e8f0}
.tbl td{padding:8px 10px;border-bottom:1px solid #f1f5f9}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.empty{text-align:center;padding:24px;color:#94a3b8;font-size:13px}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px}
.modal{background:#fff;border-radius:16px;padding:24px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
.modal h3{font-size:16px;font-weight:800;margin-bottom:14px}
.modal-close{margin-top:12px;width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;background:#f1f5f9;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px}
@media(max-width:700px){.ts-w{padding:20px 12px}.nav{flex-wrap:wrap}}
    `}</style>
    <div className="ts-w">
      <div className="ts-top">
        <button className="ts-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>튜터 스케줄</h1>
        <div className="nav">
          <button onClick={() => shift(-1)}>← 이전</button>
          <span className="cur">{fShort(dates[0])} ~ {fShort(dates[6])}</span>
          <button onClick={() => shift(1)}>다음 →</button>
          <button onClick={() => setBaseDate(new Date())}>이번 주</button>
        </div>
      </div>

      <div className="sec">
        <table className="grid">
          <thead>
            <tr><th>튜터</th>{dates.map(d => <th key={d} style={d === today ? { background: "#eff6ff", color: "#1a6fc4" } : {}}>{fShort(d)}</th>)}</tr>
          </thead>
          <tbody>
            {tutors.map(t => (
              <tr key={t.id}>
                <td className="tutor-cell">{t.name}</td>
                {dates.map(d => {
                  const items = cellLessons(t.name, d);
                  return (
                    <td key={d} style={d === today ? { background: "#f0f7ff" } : {}}
                      onClick={() => items.length > 0 && setPopup({ tutor: t.name, date: d, items })}>
                      {items.length === 0 ? <span className="chip-0">-</span> :
                        <span className="chip" style={{ background: "#dbeafe", color: "#1e40af" }}>{items.length}건</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {tutors.length === 0 && <tr><td colSpan={8} className="empty">등록된 튜터가 없습니다</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="sec today-sec">
        <h3>오늘의 수업 ({today})</h3>
        {todayLessons.length === 0 ? <div className="empty">오늘 수업이 없습니다</div> : (
          <table className="tbl">
            <thead><tr><th>시간</th><th>학생</th><th>튜터</th><th>유형</th><th>상태</th></tr></thead>
            <tbody>
              {todayLessons.map(l => {
                const st = ST[l.status] || ST.scheduled;
                return (
                  <tr key={l.id}>
                    <td>{l.lesson_time || "-"}</td>
                    <td style={{ fontWeight: 600 }}>{l.student_name || "-"}</td>
                    <td>{l.tutor_name || "-"}</td>
                    <td>{l.lesson_type || "-"}</td>
                    <td><span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>

    {popup && (
      <div className="overlay" onClick={() => setPopup(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>{popup.tutor} — {fShort(popup.date)}</h3>
          <table className="tbl">
            <thead><tr><th>시간</th><th>학생</th><th>유형</th><th>상태</th></tr></thead>
            <tbody>
              {popup.items.map(l => {
                const st = ST[l.status] || ST.scheduled;
                return (
                  <tr key={l.id}>
                    <td>{l.lesson_time || "-"}</td>
                    <td style={{ fontWeight: 600 }}>{l.student_name || "-"}</td>
                    <td>{l.lesson_type || "-"}</td>
                    <td><span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="modal-close" onClick={() => setPopup(null)}>닫기</button>
        </div>
      </div>
    )}
  </>);
}
