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
  const [error, setError] = useState("");
  const [detailed, setDetailed] = useState(true);
  const [teacher, setTeacher] = useState("");
  const [updated, setUpdated] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tutors, setTutors] = useState<{ id: string; name: string }[]>([]);
  const [modal, setModal] = useState<{ time: string; day: string; cell: DayCell } | null>(null);

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");setModal(null);
    try {
    const res = await fetch("/api/online-class/availability/slots", {cache:"no-store"});
    if (!res.ok) throw new Error("가용 현황을 불러오지 못했습니다. 새로고침을 눌러 다시 확인해주세요.");
    {
      const d = await res.json();
      setSlots(d.slots || []);
      setTutors(d.tutors || []);
      setUpdated(new Date().toLocaleTimeString("ko-KR"));
    }
    } catch(e) {setError(e instanceof Error?e.message:"연결을 확인해주세요.");}
    finally {setLoading(false);}
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
.av-w{max-width:1600px;margin:0 auto;padding:24px 20px}
.av-tools{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:16px 0}.av-tools select,.av-tools button{padding:10px;border:1px solid #cbd5e1;border-radius:8px;background:white;font:inherit}.av-note{line-height:1.7;color:#475569;background:#eaf0ff;padding:14px 18px;border-radius:10px;font-size:13px}.av-cell-button{display:block;width:100%;min-height:42px;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:8px}.av-cell-button:focus-visible{outline:3px solid #4f46e5;outline-offset:-3px}.av-names{display:flex;flex-wrap:wrap;justify-content:center;gap:4px;margin-top:8px}.av-name{font-size:11px;background:#ffffffb8;padding:3px 6px;border-radius:5px;font-weight:500}.av-used{font-size:11px;font-weight:400;margin-top:6px}.av-selected{box-shadow:inset 0 0 0 2px #4f46e5}.av-error{color:#b42318;padding:16px;background:#fff1f2}.av-detail-title{font-size:13px;margin:16px 0 8px}.av-dialog-list{overflow:auto;max-height:55vh}
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
.modal{background:#fff;border-radius:14px;padding:22px;max-width:520px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,0.2)}
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
        <span className="lg">등록된 활성 티쳐 {tutors.length}명</span>
      </div>
      <p className="av-note">숫자는 <strong>배정 가능한 티쳐 / 전체 활성 티쳐</strong>입니다. 각 칸을 누르면 티쳐별 배정 학생을 확인할 수 있습니다.<br/>수강 중인 학생의 정규 요일·시간 기준입니다. 특정 날짜의 휴가·보강·취소를 반영한 확정 예약 가능 여부는 주간 스케줄에서 함께 확인해주세요.</p>
      <div className="av-tools"><label>티쳐별 보기 <select aria-label="티쳐별 보기" value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="">전체 티쳐</option>{tutors.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label><input type="checkbox" checked={detailed} onChange={e=>setDetailed(e.target.checked)}/> 티쳐 이름 자세히 보기</label><button disabled={loading} onClick={()=>void load()}>새로고침</button>{updated&&<span style={{fontSize:12,color:'#64748b'}}>조회 {updated}</span>}</div>
      {error&&<p role="alert" className="av-error">{error}</p>}

      {loading ? <div className="empty">불러오는 중...</div> : !error&&(
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
                    const free = tutors.filter(t=>!c.occupied.some(o=>o.tutor_id===t.id));
                    const selectedBusy = teacher ? c.occupied.find(o=>o.tutor_id===teacher) : null;
                    const selectedName = tutors.find(t=>t.id===teacher)?.name;
                    return (
                      <td
                        key={d}
                        className={`cell ${isClosed ? "closed" : ""}`}
                        style={{ background: st.bg, color: st.color }}
                      >
                        {isClosed?<span>운영 없음</span>:<button className={'av-cell-button'+(teacher&&!selectedBusy?' av-selected':'')} aria-label={`${DAY_KR[d]}요일 ${s.time_kr} 가용 ${c.available}명 상세`} onClick={()=>setModal({time:s.time_kr,day:d,cell:c})}>
                          <strong>{teacher?(selectedBusy?'수업 배정':'배정 가능'):`가용 ${c.available} / ${c.total}명`}</strong>
                          {teacher?<div className="av-used">{selectedName}{selectedBusy&&<> · {selectedBusy.student_name}</>}</div>:<div className="av-used">배정 {c.occupied.length}명 · 상세 보기 ›</div>}
                          {detailed&&!teacher&&<div className="av-names">{free.length?free.map(t=><span key={t.id} className="av-name">{t.name}</span>):<span>가능한 티쳐 없음</span>}</div>}
                        </button>}
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
        <div className="modal" role="dialog" aria-modal="true" aria-label="시간대 상세" onKeyDown={e=>{if(e.key==='Escape')setModal(null);}} onClick={e => e.stopPropagation()}>
          <h3>{DAY_KR[modal.day]}요일 {modal.time}</h3>
          <div className="sub">한국 {modal.time} · 필리핀 {slots.find(s=>s.time_kr===modal.time)?.time_ph}<br/>배정 가능 {modal.cell.available}명 · 수업 배정 {modal.cell.occupied.length}명 · 전체 {modal.cell.total}명</div>
          <div className="av-dialog-list">{[false,true].map(occupied=><section key={String(occupied)}><h4 className="av-detail-title">{occupied?'수업이 배정된 티쳐 · 학생':'배정 가능한 티쳐'}</h4>{tutors.filter(t=>modal.cell.occupied.some(o=>o.tutor_id===t.id)===occupied).map(t => {
            const busy = modal.cell.occupied.find(o => o.tutor_id === t.id);
            return (
              <div key={t.id} className={`row ${busy ? "busy" : ""}`}>
                <div className="nm">{t.name}{busy && <span className="stu">— {busy.student_name}</span>}</div>
                <span className={`st ${busy ? "no" : "ok"}`}>{busy ? "사용중" : "가용"}</span>
              </div>
            );
          })}{!tutors.some(t=>modal.cell.occupied.some(o=>o.tutor_id===t.id)===occupied)&&<p style={{fontSize:12}}>해당 티쳐가 없습니다.</p>}</section>)}</div>
          <button autoFocus className="close" onClick={() => setModal(null)}>닫기</button>
        </div>
      </div>
    )}
  </>);
}
