"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthed } from "@/lib/adminAuth";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface Tutor { id: string; name: string; hourly_rate: number }
interface Lesson { id: string; student_name: string; tutor_name: string; lesson_date: string; lesson_time: string; lesson_type: string; status: string }

function fmt(n: number) { return n.toLocaleString(); }

export default function TutorInvoicePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [selTutor, setSelTutor] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [lessons, setLessons] = useState<Lesson[]>([]);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else if (typeof window !== "undefined") window.location.href = "/admin"; }, []);

  const loadTutors = useCallback(async () => {
    const { data } = await supabase.from("tutors").select("id, name, hourly_rate").eq("is_active", true).order("name");
    if (data) { setTutors(data as Tutor[]); if (data.length > 0 && !selTutor) setSelTutor(data[0].name); }
  }, []);

  useEffect(() => { if (authed) loadTutors(); }, [authed, loadTutors]);

  const loadLessons = useCallback(async () => {
    if (!selTutor || !month) return;
    const start = month + "-01";
    const end = month + "-31";
    const { data } = await supabase.from("online_class_enrollments").select("*")
      .eq("tutor_name", selTutor).gte("lesson_date", start).lte("lesson_date", end)
      .order("lesson_date").order("lesson_time");
    if (data) setLessons(data as Lesson[]);
  }, [selTutor, month]);

  useEffect(() => { if (authed && selTutor) loadLessons(); }, [authed, selTutor, month, loadLessons]);

  const tutor = tutors.find(t => t.name === selTutor);
  const rate = tutor?.hourly_rate || 0;
  const attended = lessons.filter(l => l.status === "attended");
  const totalAmount = attended.length * rate;

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.ti-w{max-width:800px;margin:0 auto;padding:32px 24px}
.ti-top{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.ti-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.ti-back:hover{background:#e2e8f0}
.ti-top h1{font-size:22px;font-weight:800;flex:1}
.toolbar{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center}
.toolbar select,.toolbar input{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff}.toolbar select:focus,.toolbar input:focus{border-color:#1a6fc4}
.sec{background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.05);margin-bottom:20px;overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{background:#f8fafc;padding:10px 12px;text-align:left;font-weight:700;font-size:12px;color:#6b7c93;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:10px 12px;border-bottom:1px solid #f1f5f9}
.tbl tr:hover{background:#f8fafc}
.tbl .sum td{font-weight:800;font-size:14px;background:#f0f7ff;border-top:2px solid #1a6fc4}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.b-att{background:#dcfce7;color:#166534}.b-abs{background:#fef2f2;color:#dc2626}.b-sch{background:#f1f5f9;color:#64748b}
.inv-box{padding:24px;border:2px solid #e2e8f0;border-radius:12px;margin-bottom:20px}
.inv-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1a1a2e}
.inv-title{font-size:20px;font-weight:900;letter-spacing:0.05em}
.inv-sub{font-size:11px;color:#6b7c93;margin-top:4px}
.inv-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px}
.inv-grid .lbl{font-weight:700;color:#6b7c93}.inv-grid .val{font-weight:600}
.inv-total{font-size:22px;font-weight:900;color:#1a6fc4;text-align:right;padding-top:12px;border-top:2px solid #1a6fc4;margin-top:12px}
.btn-print{padding:10px 24px;border:none;border-radius:8px;background:#1a6fc4;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}.btn-print:hover{background:#0d3d7a}
.empty{text-align:center;padding:32px;color:#94a3b8;font-size:14px}
@media print{body{background:#fff!important}.ti-top,.toolbar,.btn-print,.ti-back{display:none!important}.ti-w{padding:0;max-width:100%}.sec,.inv-box{box-shadow:none;border-radius:0}}
@media(max-width:600px){.ti-w{padding:20px 12px}.toolbar{flex-direction:column;align-items:stretch}.inv-grid{grid-template-columns:1fr}}
    `}</style>
    <div className="ti-w">
      <div className="ti-top">
        <button className="ti-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>튜터 인보이스</h1>
      </div>

      <div className="toolbar">
        <select value={selTutor} onChange={e => setSelTutor(e.target.value)}>
          {tutors.map(t => <option key={t.id} value={t.name}>{t.name} (₱{fmt(t.hourly_rate)}/hr)</option>)}
        </select>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
        <button className="btn-print" onClick={() => window.print()}>🖨 인쇄/PDF</button>
      </div>

      {/* 인보이스 출력 영역 */}
      <div className="inv-box">
        <div className="inv-head">
          <div>
            <div className="inv-title">TUTOR INVOICE</div>
            <div className="inv-sub">Dream Academy Philippines</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{month}</div>
            <div style={{ fontSize: 11, color: "#6b7c93" }}>발행일: {new Date().toLocaleDateString("ko-KR")}</div>
          </div>
        </div>
        <div className="inv-grid">
          <div><span className="lbl">튜터: </span><span className="val">{selTutor || "-"}</span></div>
          <div><span className="lbl">시급: </span><span className="val">₱{fmt(rate)}</span></div>
          <div><span className="lbl">총 수업: </span><span className="val">{lessons.length}건</span></div>
          <div><span className="lbl">출석 수업: </span><span className="val">{attended.length}건</span></div>
        </div>
        <div className="inv-total">총 금액: ₱{fmt(totalAmount)}</div>
      </div>

      {/* 수업 내역 */}
      <div className="sec">
        {lessons.length === 0 ? (
          <div className="empty">해당 월 수업 내역이 없습니다</div>
        ) : (
          <table className="tbl">
            <thead><tr><th>날짜</th><th>학생</th><th>유형</th><th>시간</th><th>상태</th><th style={{ textAlign: "right" }}>단가 (₱)</th><th style={{ textAlign: "right" }}>금액 (₱)</th></tr></thead>
            <tbody>
              {lessons.map(l => {
                const isAtt = l.status === "attended";
                return (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{l.lesson_date || "-"}</td>
                    <td style={{ fontWeight: 600 }}>{l.student_name || "-"}</td>
                    <td>{l.lesson_type || "-"}</td>
                    <td>{l.lesson_time || "-"}</td>
                    <td><span className={`badge ${isAtt ? "b-att" : l.status === "absent" ? "b-abs" : "b-sch"}`}>
                      {isAtt ? "출석" : l.status === "absent" ? "결석" : "예정"}
                    </span></td>
                    <td style={{ textAlign: "right" }}>{isAtt ? fmt(rate) : "-"}</td>
                    <td style={{ textAlign: "right", fontWeight: isAtt ? 700 : 400 }}>{isAtt ? fmt(rate) : "-"}</td>
                  </tr>
                );
              })}
              <tr className="sum">
                <td colSpan={5} style={{ textAlign: "right" }}>합계 ({attended.length}건)</td>
                <td></td>
                <td style={{ textAlign: "right" }}>₱{fmt(totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  </>);
}
