"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface OccupiedEntry { tutor_id: string; tutor_name: string; student_name: string }
interface DayCell { available: number; total: number; status: string; occupied: OccupiedEntry[] }
interface Slot { time_kr: string; time_ph: string; days: Record<string, DayCell> }

const DAY_KR: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토" };
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat"];

export default function AvailabilityPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tutors, setTutors] = useState<{ id: string; name: string }[]>([]);
  const [modal, setModal] = useState<{ time: string; day: string; cell: DayCell } | null>(null);

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/online-class/availability/slots");
    if (res.ok) {
      const d = await res.json();
      setSlots(d.slots || []);
      setTutors(d.tutors || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  if (!authed) return null;

  function cellStyle(cell: DayCell) {
    if (cell.status === "closed") return { bg: "#f8fafc", color: "#cbd5e1", text: "-" };
    if (cell.status === "full") return { bg: "#fef2f2", color: "#dc2626", text: "마감" };
    if (cell.status === "last") return { bg: "#fef3c7", color: "#92400e", text: `${cell.available}/${cell.total}` };
    return { bg: "#dcfce7", color: "#166534", text: `${cell.available}/${cell.total}` };
  }

  return (<>
    <style>{`
*{box-sizing:border-box}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;margin:0}
.av-w{max-width:1100px;margin:0 auto;padding:24px 20px}
.top{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.back{padding:6px 10px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;color:#1a1a2e}
.title{font-size:20px;font-weight:800;flex:1}
.legend{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;font-size:12px}
.legend .lg{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;background:#fff;border-radius:7px;box-shadow:0 1px 4px rgba(0,0,0,0.04)}
.legend .sw{width:12px;height:12px;border-radius:3px}
.grid-wrap{background:#fff;border-radius:12px;padding:12px;box-shadow:0 1px 8px rgba(0,0,0,0.05);overflow-x:auto}
table{border-collapse:collapse;width:100%;min-width:680px}
th,td{border:1px solid #e2e8f0;padding:6px 4px;text-align:center;font-size:12px}
th{background:#f8fafc;font-weight:700}
th.time{background:#1e40af;color:#fff;min-width:80px}
td.time{background:#f1f5f9;font-weight:700;white-space:nowrap;min-width:90px}
td.cell{cursor:pointer;font-weight:700;min-width:72px;transition:filter .12s}
td.cell:hover{filter:brightness(0.94)}
td.cell.closed{cursor:default}
.empty{text-align:center;padding:40px;color:#94a3b8}

.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:50;padding:16px}
.modal{background:#fff;border-radius:14px;padding:22px;max-width:420px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,0.2)}
.modal h3{font-size:15px;font-weight:800;margin:0 0 4px}
.modal .sub{font-size:12px;color:#6b7c93;margin-bottom:14px}
.modal .row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;background:#f8fafc;margin-bottom:6px;font-size:13px}
.modal .row.busy{background:#fef2f2}
.modal .row .nm{font-weight:700}
.modal .row .st{font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px}
.modal .row .st.ok{background:#dcfce7;color:#166534}
.modal .row .st.no{background:#fee2e2;color:#991b1b}
.modal .row .stu{font-size:11px;color:#6b7c93;margin-left:8px}
.modal .close{width:100%;margin-top:10px;padding:10px;background:#1a6fc4;color:#fff;border:none;border-radius:8px;font-family:inherit;font-weight:700;cursor:pointer}
    `}</style>

    <div className="av-w">
      <div className="top">
        <button className="back" onClick={() => router.push("/admin/online-class")}>←</button>
        <div className="title">📊 시간대별 가용 현황</div>
      </div>
      <div className="legend">
        <span className="lg"><span className="sw" style={{ background: "#dcfce7" }} /> 가용</span>
        <span className="lg"><span className="sw" style={{ background: "#fef3c7" }} /> 마지막 1자리</span>
        <span className="lg"><span className="sw" style={{ background: "#fef2f2" }} /> 마감</span>
        <span className="lg"><span className="sw" style={{ background: "#f8fafc" }} /> 운영시간 외</span>
        <span className="lg">총 튜터 {tutors.length}명</span>
      </div>

      {loading ? <div className="empty">불러오는 중...</div> : (
        <div className="grid-wrap">
          <table>
            <thead>
              <tr>
                <th className="time">시간(한국)</th>
                {DAYS.map(d => <th key={d}>{DAY_KR[d]}</th>)}
              </tr>
            </thead>
            <tbody>
              {slots.map(s => (
                <tr key={s.time_kr}>
                  <td className="time">{s.time_kr} <span style={{ color: "#94a3b8", fontSize: 10, fontWeight: 400 }}>({s.time_ph} PH)</span></td>
                  {DAYS.map(d => {
                    const c = s.days[d];
                    const st = cellStyle(c);
                    const isClosed = c.status === "closed";
                    return (
                      <td
                        key={d}
                        className={`cell ${isClosed ? "closed" : ""}`}
                        style={{ background: st.bg, color: st.color }}
                        onClick={() => { if (!isClosed) setModal({ time: s.time_kr, day: d, cell: c }); }}
                      >
                        {st.text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {modal && (
      <div className="modal-bg" onClick={() => setModal(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>{DAY_KR[modal.day]}요일 {modal.time}</h3>
          <div className="sub">가용 {modal.cell.available}/{modal.cell.total}명</div>
          {tutors.map(t => {
            const busy = modal.cell.occupied.find(o => o.tutor_id === t.id);
            return (
              <div key={t.id} className={`row ${busy ? "busy" : ""}`}>
                <div className="nm">{t.name}{busy && <span className="stu">— {busy.student_name}</span>}</div>
                <span className={`st ${busy ? "no" : "ok"}`}>{busy ? "사용중" : "가용"}</span>
              </div>
            );
          })}
          <button className="close" onClick={() => setModal(null)}>닫기</button>
        </div>
      </div>
    )}
  </>);
}
