"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Entry {
  id: string; date: string; driver_id: string | null; type: string;
  guest: string; time: string; location: string; destination: string;
  num_people: number; flight_info: string; status: string; round_trip?: boolean;
}
interface Driver { id: string; name: string }

const DAYS = ["일","월","화","수","목","금","토"];
const TYPE_STYLE: Record<string, { emoji: string; bg: string; color: string; label: string }> = {
  pickup:  { emoji: "🔵", bg: "#dbeafe", color: "#1e40af", label: "픽업" },
  dropoff: { emoji: "🟢", bg: "#dcfce7", color: "#166534", label: "드랍" },
  shuttle: { emoji: "🟠", bg: "#fef3c7", color: "#92400e", label: "셔틀" },
};

function weekDates(base: Date): string[] {
  const d = new Date(base);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7)); // Monday
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(d); dd.setDate(d.getDate() + i);
    dates.push(`${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

function fDateShort(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()}(${DAYS[dt.getDay()]})`;
}

export default function DriverSchedulePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [baseDate, setBaseDate] = useState(new Date());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [popup, setPopup] = useState<Entry | null>(null);

  const dates = weekDates(baseDate);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/driver-schedule?start=${dates[0]}&end=${dates[6]}`);
    if (res.ok) { const d = await res.json(); setEntries(d.entries); setDrivers(d.drivers); }
  }, [dates[0], dates[6]]);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else window.location.href = "/login"; }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  function shiftWeek(n: number) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + n * 7);
    setBaseDate(d);
  }

  function cellEntries(date: string, driverId: string) {
    return entries.filter(e => e.date === date && e.driver_id === driverId);
  }

  // "미배정" 엔트리
  const unassigned = entries.filter(e => !e.driver_id);

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.ds-w{max-width:1200px;margin:0 auto;padding:32px 20px}
.ds-top{display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap}
.ds-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.ds-back:hover{background:#e2e8f0}
.ds-top h1{font-size:22px;font-weight:800;flex:1}
.nav{display:flex;align-items:center;gap:6px}
.nav button{padding:6px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}.nav button:hover{background:#e2e8f0}
.nav .cur{font-size:14px;font-weight:700;min-width:180px;text-align:center}
.print-btn{padding:8px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}.print-btn:hover{background:#e2e8f0}
.grid-wrap{background:#fff;border-radius:14px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow-x:auto}
.grid{width:100%;border-collapse:collapse;font-size:12px;min-width:600px}
.grid th{background:#f8fafc;padding:10px 6px;font-size:12px;font-weight:700;color:#6b7c93;border:1px solid #e2e8f0;text-align:center;white-space:nowrap}
.grid td{border:1px solid #e2e8f0;padding:4px;vertical-align:top;min-width:120px;height:70px}
.grid .date-cell{background:#f8fafc;font-weight:700;text-align:center;padding:8px 4px;min-width:70px;white-space:nowrap}
.chip{display:block;padding:3px 6px;border-radius:5px;margin-bottom:3px;font-size:11px;line-height:1.4;cursor:pointer;transition:opacity 150ms}
.chip:hover{opacity:0.8}
.chip .tm{font-weight:700}
.chip .nm{opacity:0.85}
.unassigned{margin-top:20px}
.unassigned h3{font-size:14px;font-weight:700;color:#dc2626;margin-bottom:8px}
.ua-list{display:flex;gap:6px;flex-wrap:wrap}
.ua-chip{padding:4px 10px;border-radius:6px;font-size:11px;background:#fef2f2;color:#dc2626;font-weight:600}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px}
.modal{background:#fff;border-radius:16px;padding:28px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
.modal h3{font-size:17px;font-weight:800;margin-bottom:16px}
.modal-row{display:flex;gap:8px;margin-bottom:8px;font-size:13px}
.modal-row .lbl{font-weight:700;color:#6b7c93;min-width:60px}
.modal-close{margin-top:16px;padding:8px 20px;border:none;border-radius:8px;background:#f1f5f9;font-weight:700;cursor:pointer;font-family:inherit;font-size:13px}
@media print{body{background:#fff!important}.ds-top,.nav,.print-btn,.ds-back,.unassigned,.overlay{display:none!important}.ds-w{padding:0;max-width:100%}.grid-wrap{box-shadow:none;padding:0;border-radius:0}.grid{font-size:10px}.grid td{height:auto}}
@media(max-width:700px){.ds-w{padding:20px 12px}}
    `}</style>
    <div className="ds-w">
      <div className="ds-top">
        <button className="ds-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>기사 스케줄</h1>
        <div className="nav">
          <button onClick={() => shiftWeek(-1)}>← 이전</button>
          <span className="cur">{fDateShort(dates[0])} ~ {fDateShort(dates[6])}</span>
          <button onClick={() => shiftWeek(1)}>다음 →</button>
          <button onClick={() => setBaseDate(new Date())}>이번 주</button>
        </div>
        <button className="print-btn" onClick={() => window.print()}>인쇄</button>
      </div>

      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>날짜</th>
              {drivers.map(d => <th key={d.id}>{d.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {dates.map(date => (
              <tr key={date}>
                <td className="date-cell">{fDateShort(date)}</td>
                {drivers.map(d => {
                  const items = cellEntries(date, d.id);
                  return (
                    <td key={d.id}>
                      {items.map(e => {
                        const ts = TYPE_STYLE[e.type] || TYPE_STYLE.pickup;
                        return (
                          <div key={e.id} className="chip" style={{ background: ts.bg, color: ts.color }}
                            onClick={() => setPopup(e)}>
                            <span className="tm">{ts.emoji} {e.time || ""}</span>{" "}
                            <span className="nm">{e.guest}</span>
                            <span style={{ fontSize: 10 }}> {e.num_people}명</span>
                          </div>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unassigned.length > 0 && (
        <div className="unassigned">
          <h3>미배정 ({unassigned.length}건)</h3>
          <div className="ua-list">
            {unassigned.map(e => (
              <span key={e.id} className="ua-chip">
                {fDateShort(e.date)} {TYPE_STYLE[e.type]?.emoji} {e.guest} {e.num_people}명
              </span>
            ))}
          </div>
        </div>
      )}
    </div>

    {popup && (
      <div className="overlay" onClick={() => setPopup(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>{TYPE_STYLE[popup.type]?.emoji} {TYPE_STYLE[popup.type]?.label} 상세</h3>
          <div className="modal-row"><span className="lbl">손님</span><span>{popup.guest}</span></div>
          <div className="modal-row"><span className="lbl">날짜</span><span>{fDateShort(popup.date)}</span></div>
          <div className="modal-row"><span className="lbl">시간</span><span>{popup.time || "-"}</span></div>
          <div className="modal-row"><span className="lbl">출발</span><span>{popup.location || "-"}</span></div>
          <div className="modal-row"><span className="lbl">도착</span><span>{popup.destination || "-"}</span></div>
          <div className="modal-row"><span className="lbl">인원</span><span>{popup.num_people}명</span></div>
          {popup.flight_info && <div className="modal-row"><span className="lbl">항공편</span><span>{popup.flight_info}</span></div>}
          {popup.round_trip !== undefined && <div className="modal-row"><span className="lbl">왕복</span><span>{popup.round_trip ? "왕복" : "편도"}</span></div>}
          <div className="modal-row"><span className="lbl">상태</span><span>{popup.status}</span></div>
          <button className="modal-close" onClick={() => setPopup(null)}>닫기</button>
        </div>
      </div>
    )}
  </>);
}
