"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthed } from "@/lib/adminAuth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Lesson {
  id: string; student_name: string; tutor_name: string;
  lesson_date: string; lesson_time: string; lesson_type: string;
  status: string; notes: string;
}

const STATUS_CYCLE = ["scheduled", "attended", "absent"] as const;
const STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  scheduled: { label: "예정", bg: "#f1f5f9", color: "#64748b" },
  attended:  { label: "출석", bg: "#dcfce7", color: "#166534" },
  absent:    { label: "결석", bg: "#fef2f2", color: "#dc2626" },
};

export default function OnlineClassPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ student_name: "", tutor_name: "", lesson_date: "", lesson_time: "", lesson_type: "일반", notes: "" });

  const load = useCallback(async () => {
    const startDate = month + "-01";
    const endDate = month + "-31";
    const { data } = await supabase
      .from("online_class_enrollments")
      .select("*")
      .gte("lesson_date", startDate)
      .lte("lesson_date", endDate)
      .order("lesson_date")
      .order("lesson_time");
    if (data) setLessons(data as Lesson[]);
  }, [month]);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else if (typeof window !== "undefined") window.location.href = "/login"; }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function addLesson() {
    if (!form.student_name.trim()) { alert("학생 이름을 입력하세요."); return; }
    await supabase.from("online_class_enrollments").insert({
      student_name: form.student_name.trim(),
      tutor_name: form.tutor_name.trim(),
      lesson_date: form.lesson_date || null,
      lesson_time: form.lesson_time || null,
      lesson_type: form.lesson_type,
      status: "scheduled",
      notes: form.notes.trim(),
    });
    setModal(false);
    setForm({ student_name: "", tutor_name: "", lesson_date: "", lesson_time: "", lesson_type: "일반", notes: "" });
    load();
  }

  async function toggleStatus(lesson: Lesson) {
    const idx = STATUS_CYCLE.indexOf(lesson.status as typeof STATUS_CYCLE[number]);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    await supabase.from("online_class_enrollments").update({ status: next }).eq("id", lesson.id);
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, status: next } : l));
  }

  const filtered = lessons.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.student_name?.toLowerCase().includes(q) || l.tutor_name?.toLowerCase().includes(q);
  });

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.oc-w{max-width:900px;margin:0 auto;padding:32px 24px}
.oc-top{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.oc-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.oc-back:hover{background:#e2e8f0}
.oc-top h1{font-size:22px;font-weight:800;flex:1}
.toolbar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.toolbar input{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none}.toolbar input:focus{border-color:#1a6fc4}
.btn{padding:10px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 150ms}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#0d3d7a}
.cnt{font-size:13px;color:#6b7c93;margin-left:auto}
.sec{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:700px}
.tbl th{background:#f8fafc;padding:10px 10px;text-align:left;font-weight:700;font-size:12px;color:#6b7c93;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:10px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.tbl tr:hover{background:#f8fafc}
.badge{display:inline-block;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;user-select:none;transition:all 100ms}
.badge:hover{opacity:0.8}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px}
.modal{background:#fff;border-radius:16px;padding:28px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
.modal h3{font-size:18px;font-weight:800;margin-bottom:20px}
.modal label{display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:4px}
.modal input,.modal select,.modal textarea{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;margin-bottom:14px}
.modal input:focus,.modal select:focus,.modal textarea:focus{border-color:#1a6fc4}
.modal textarea{resize:vertical;min-height:50px}
.modal select{background:#fff}
.modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
.btn-gray{background:#f1f5f9;color:#475569}.btn-gray:hover{background:#e2e8f0}
@media(max-width:600px){.oc-w{padding:20px 12px}.toolbar{flex-direction:column;align-items:stretch}}
    `}</style>
    <div className="oc-w">
      <div className="oc-top">
        <button className="oc-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>화상영어 출석 관리</h1>
        <button className="btn btn-blue" onClick={() => setModal(true)}>+ 수업 일정 추가</button>
      </div>

      <div className="toolbar">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
        <input placeholder="학생/튜터 검색" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <span className="cnt">{filtered.length}건</span>
      </div>

      <div className="sec">
        {filtered.length === 0 ? (
          <div className="empty">수업 일정이 없습니다</div>
        ) : (
          <table className="tbl">
            <thead><tr><th>날짜</th><th>시간</th><th>학생</th><th>튜터</th><th>유형</th><th>상태</th><th>메모</th></tr></thead>
            <tbody>
              {filtered.map(l => {
                const st = STATUS_STYLE[l.status] || STATUS_STYLE.scheduled;
                return (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{l.lesson_date || "-"}</td>
                    <td>{l.lesson_time || "-"}</td>
                    <td style={{ fontWeight: 600 }}>{l.student_name || "-"}</td>
                    <td>{l.tutor_name || "-"}</td>
                    <td>{l.lesson_type || "-"}</td>
                    <td>
                      <span className="badge" style={{ background: st.bg, color: st.color }}
                        onClick={() => toggleStatus(l)} title="클릭하여 상태 변경">
                        {st.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.notes || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>

    {modal && (
      <div className="overlay" onClick={() => setModal(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>수업 일정 추가</h3>
          <label>학생 이름 *</label>
          <input value={form.student_name} onChange={e => setForm({ ...form, student_name: e.target.value })} placeholder="홍길동" autoFocus />
          <label>튜터</label>
          <input value={form.tutor_name} onChange={e => setForm({ ...form, tutor_name: e.target.value })} placeholder="Amelyn" />
          <label>날짜</label>
          <input type="date" value={form.lesson_date} onChange={e => setForm({ ...form, lesson_date: e.target.value })} />
          <label>시간</label>
          <input type="time" value={form.lesson_time} onChange={e => setForm({ ...form, lesson_time: e.target.value })} />
          <label>수업 유형</label>
          <select value={form.lesson_type} onChange={e => setForm({ ...form, lesson_type: e.target.value })}>
            <option value="일반">일반</option>
            <option value="특별">특별</option>
            <option value="보충">보충</option>
          </select>
          <label>메모</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="선택사항" />
          <div className="modal-foot">
            <button className="btn btn-gray" onClick={() => setModal(false)}>취소</button>
            <button className="btn btn-blue" onClick={addLesson}>저장</button>
          </div>
        </div>
      </div>
    )}
  </>);
}
