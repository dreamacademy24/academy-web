"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface BookingMeta {
  booker_name: string; booker_phone?: string;
  flight_in?: string; flight_out?: string;
  adults?: number; children?: number;
  accom_type?: string; reservation_no?: string;
}
interface Pickup {
  id: string; booking_id: string; request_type: string;
  request_date: string; request_time: string; location: string; destination: string;
  num_people: number; flight_info: string; driver_id: string | null;
  status: string; notes: string;
  bookings: BookingMeta | null;
}
interface Driver { id: string; name: string }

const ST: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정", bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소", bg: "#fef2f2", color: "#dc2626" },
};

function fDate(d: string | null) {
  if (!d) return "-";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d as string;
  return `${dt.getMonth() + 1}/${dt.getDate()}(${["일","월","화","수","목","금","토"][dt.getDay()]})`;
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function genCalWeeks(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const cursor = new Date(firstDay);
  while (cursor.getDay() !== 1) cursor.setDate(cursor.getDate() - 1);
  const weeks: Date[][] = [];
  while (cursor <= lastDay) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(cursor)); cursor.setDate(cursor.getDate() + 1); }
    weeks.push(week);
  }
  return weeks;
}

type Filter = "all" | "pickup" | "dropoff" | "unassigned";
type View = "list" | "cal";

export default function PickupsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [extractMsg, setExtractMsg] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("list");
  const _now = new Date();
  const [calYear, setCalYear] = useState<number>(_now.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(_now.getMonth() + 1);
  const [selDay, setSelDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/pickups");
    if (res.ok) { const d = await res.json(); setPickups(d.pickups); setDrivers(d.drivers); }
  }, []);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else window.location.href = "/login"; }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function extract() {
    setLoading(true); setExtractMsg("");
    const res = await fetch("/api/admin/pickups", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "extract" }),
    });
    const d = await res.json();
    setExtractMsg(d.error ? "오류: " + d.error : `${d.inserted}건 추출 완료${d.skipped ? ` (취소예약 ${d.skipped}건 제외)` : ""}`);
    setLoading(false); load();
  }

  async function patch(id: string, updates: Record<string, unknown>) {
    await fetch("/api/admin/pickups", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    load();
  }

  function driverDateTotal(driverId: string | null, date: string) {
    if (!driverId) return 0;
    return pickups
      .filter(p => p.driver_id === driverId && p.request_date === date && p.status !== "cancelled")
      .reduce((s, p) => s + (p.num_people || 0), 0);
  }
  function wouldExceed(pickupId: string, newDriverId: string | null, date: string, people: number) {
    if (!newDriverId) return 0;
    const otherTotal = pickups
      .filter(p => p.driver_id === newDriverId && p.request_date === date && p.status !== "cancelled" && p.id !== pickupId)
      .reduce((s, p) => s + (p.num_people || 0), 0);
    return otherTotal + people;
  }
  async function assignDriver(pickupId: string, newDriverId: string | null, date: string, people: number) {
    if (newDriverId) {
      const projected = wouldExceed(pickupId, newDriverId, date, people);
      if (projected > 12) {
        const dName = drivers.find(d => d.id === newDriverId)?.name || "기사";
        const ok = confirm(`⚠️ 12인승 초과!\n\n${dName} 기사 ${fDate(date)} 합산: ${projected}명\n(정원 12명 초과)\n\n그래도 배정하시겠습니까?`);
        if (!ok) return;
      }
    }
    patch(pickupId, { driver_id: newDriverId || null });
  }
  function driverName(id: string | null) {
    if (!id) return "";
    return drivers.find(d => d.id === id)?.name || "";
  }
  function bookerOf(p: Pickup) {
    return p.bookings?.booker_name || "-";
  }

  const filtered = useMemo(() => pickups.filter(p => {
    if (filter === "pickup") return p.request_type === "pickup";
    if (filter === "dropoff") return p.request_type === "dropoff";
    if (filter === "unassigned") return !p.driver_id;
    return true;
  }), [pickups, filter]);

  const weeks = useMemo(() => genCalWeeks(calYear, calMonth), [calYear, calMonth]);
  const selDayPickups = useMemo(() => selDay ? pickups.filter(p => p.request_date === selDay) : [], [selDay, pickups]);

  function prevMonth() { let y = calYear, m = calMonth - 1; if (m < 1) { y--; m = 12; } setCalYear(y); setCalMonth(m); setSelDay(null); }
  function nextMonth() { let y = calYear, m = calMonth + 1; if (m > 12) { y++; m = 1; } setCalYear(y); setCalMonth(m); setSelDay(null); }

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.pk-w{max-width:1100px;margin:0 auto;padding:40px 24px}
.pk-top{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.pk-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.pk-back:hover{background:#e2e8f0}
.pk-top h1{font-size:24px;font-weight:800;flex:1}
.toolbar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.btn{padding:10px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 150ms}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#0d3d7a}
.btn-sm{padding:6px 12px;font-size:12px;border:1px solid #e2e8f0}
.btn-gray{background:#f1f5f9;color:#475569}.btn-gray:hover{background:#e2e8f0}
.btn-on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.msg{font-size:13px;font-weight:600;margin-left:8px}.msg-ok{color:#166534}.msg-err{color:#dc2626}
.cnt{font-size:13px;color:#6b7c93;margin-left:auto}
.sec{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:900px}
.tbl th{background:#f8fafc;padding:10px 8px;text-align:left;font-weight:700;font-size:12px;color:#6b7c93;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.tbl tr:hover{background:#f8fafc}
.tbl tr.over{background:#fef2f2}
.tbl tr.over:hover{background:#fee2e2}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.t-pickup{background:#dbeafe;color:#1e40af}.t-dropoff{background:#fce7f3;color:#9d174d}.t-additional{background:#fef3c7;color:#92400e}.t-transfer{background:#e0e7ff;color:#4338ca}
.sel{padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;font-family:inherit;outline:none;background:#fff;min-width:90px}.sel:focus{border-color:#1a6fc4}
.warn{color:#dc2626;font-weight:700;font-size:11px;white-space:nowrap}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px}
.ico-btn{padding:4px 8px;font-size:13px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-family:inherit}
.ico-btn:hover{background:#dbeafe;border-color:#93c5fd}
.cal-tbl{width:100%;border-collapse:collapse;table-layout:fixed;min-width:700px}
.cal-tbl th{font-size:11px;font-weight:700;color:#475569;padding:8px 4px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center}
.cal-tbl td{vertical-align:top;padding:6px;border:1px solid #e2e8f0;font-size:11px;height:78px;cursor:pointer}
.cal-tbl td:hover{background:#f8fafc}
.cal-tbl td.out-month{background:#fafafa;cursor:default}.cal-tbl td.out-month:hover{background:#fafafa}
.cal-tbl td.sel{background:#dbeafe !important;outline:2px solid #1a6fc4;outline-offset:-2px}
.cal-d{font-weight:700;color:#1a1a2e;font-size:12px;margin-bottom:4px}
.cal-tbl td.out-month .cal-d{color:#cbd5e1}
.cal-pin{display:inline-block;background:#dcfce7;color:#166534;font-weight:700;font-size:10px;padding:1px 5px;border-radius:4px;margin-right:3px}
.cal-pout{display:inline-block;background:#fef2f2;color:#dc2626;font-weight:700;font-size:10px;padding:1px 5px;border-radius:4px}
.cal-ptr{display:inline-block;background:#e0e7ff;color:#4338ca;font-weight:700;font-size:10px;padding:1px 5px;border-radius:4px}
.cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.day-detail{margin-top:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px}
.day-row{display:grid;grid-template-columns:80px 1fr 1fr 100px 60px;gap:8px;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:12px;align-items:center}
.day-row:last-child{border-bottom:none}
@media(max-width:700px){.pk-w{padding:24px 12px}.toolbar{flex-direction:column;align-items:stretch}.day-row{grid-template-columns:60px 1fr 1fr;gap:6px}}
    `}</style>
    <div className="pk-w">
      <div className="pk-top">
        <button className="pk-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>픽드랍 관리</h1>
      </div>

      <div className="toolbar">
        <button className="btn btn-blue" onClick={extract} disabled={loading}>
          {loading ? "추출 중..." : "예약에서 자동 추출"}
        </button>
        {extractMsg && <span className={`msg ${extractMsg.startsWith("오류") ? "msg-err" : "msg-ok"}`}>{extractMsg}</span>}
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          <button className={`btn btn-sm ${view === "list" ? "btn-on" : "btn-gray"}`} onClick={() => setView("list")}>📋 리스트</button>
          <button className={`btn btn-sm ${view === "cal" ? "btn-on" : "btn-gray"}`} onClick={() => setView("cal")}>📅 달력</button>
        </div>
        <span className="cnt">{view === "list" ? `${filtered.length}건` : ""}</span>
      </div>

      {view === "list" && (
        <div className="toolbar">
          {([["all","전체"],["pickup","픽업"],["dropoff","드랍"],["unassigned","미배정"]] as const).map(([k,v]) => (
            <button key={k} className={`btn btn-sm ${filter === k ? "btn-on" : "btn-gray"}`} onClick={() => setFilter(k as Filter)}>{v}</button>
          ))}
        </div>
      )}

      {view === "list" ? (
        <div className="sec">
          {filtered.length === 0 ? (
            <div className="empty">픽드랍 일정이 없습니다</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr><th>유형</th><th>날짜</th><th>시간</th><th>예약자</th><th>항공편</th><th>출발</th><th>도착</th><th>인원</th><th>기사 배정</th><th>상태</th><th>카드</th></tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const total = driverDateTotal(p.driver_id, p.request_date);
                  const over = !!p.driver_id && total > 12;
                  const st = ST[p.status] || ST.pending;
                  // bookings 텍스트 flight 필드(flight_in/flight_out) → flight_info fallback
                  const flightTxt = p.request_type === "transfer"
                    ? ""
                    : p.request_type === "pickup"
                    ? (p.bookings?.flight_in || p.flight_info)
                    : (p.bookings?.flight_out || p.flight_info);
                  return (
                    <tr key={p.id} className={over ? "over" : ""}>
                      <td><span className={`badge t-${p.request_type}`}>{p.request_type === "pickup" ? "✈️IN 픽업" : p.request_type === "dropoff" ? "✈️OUT 드랍" : p.request_type === "transfer" ? "🔄 환승" : "추가"}</span></td>
                      <td style={{ whiteSpace: "nowrap" }}>{fDate(p.request_date)}</td>
                      <td>{p.request_time || "-"}</td>
                      <td>{bookerOf(p)}</td>
                      <td style={{ fontSize: 12, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={flightTxt || ""}>{flightTxt || "-"}{p.ticket_url && <a href={p.ticket_url} target="_blank" rel="noreferrer" title="항공권 보기" style={{ marginLeft: 4, textDecoration: "none" }}>🎫</a>}</td>
                      <td>{p.location || "-"}</td>
                      <td>{p.destination || "-"}</td>
                      <td>
                        {p.num_people || 0}명
                        {over && <div className="warn">합산 {total}명!</div>}
                      </td>
                      <td>
                        <select className="sel" value={p.driver_id || ""}
                          onChange={e => assignDriver(p.id, e.target.value || null, p.request_date, p.num_people || 0)}>
                          <option value="">미배정</option>
                          {drivers.map(d => {
                            const proj = wouldExceed(p.id, d.id, p.request_date, p.num_people || 0);
                            return <option key={d.id} value={d.id}>{d.name}{proj > 12 ? ` (${proj}명!)` : ""}</option>;
                          })}
                        </select>
                        {p.driver_id && <div style={{ fontSize: 11, color: "#6b7c93", marginTop: 2 }}>{driverName(p.driver_id)}</div>}
                      </td>
                      <td>
                        <select className="sel" style={{ background: st.bg, color: st.color, fontWeight: 700, fontSize: 11 }}
                          value={p.status} onChange={e => patch(p.id, { status: e.target.value })}>
                          <option value="pending">대기</option>
                          <option value="confirmed">확정</option>
                          <option value="cancelled">취소</option>
                        </select>
                      </td>
                      <td>
                        <button className="ico-btn" title="체크인 카드 열기"
                          onClick={() => window.open(`/admin/checkin-card?bookingId=${p.booking_id}`, "_blank")}>🪧</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="sec">
          <div className="cal-nav">
            <button className="btn btn-sm btn-gray" onClick={prevMonth}>← 이전달</button>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{calYear}년 {calMonth}월</div>
            <button className="btn btn-sm btn-gray" onClick={nextMonth}>다음달 →</button>
          </div>
          <table className="cal-tbl">
            <thead>
              <tr>{["월","화","수","목","금","토","일"].map(d => <th key={d}>{d}</th>)}</tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((day, di) => {
                    const dStr = ymd(day);
                    const inMonth = day.getMonth() === calMonth - 1;
                    const dayPickups = pickups.filter(p => p.request_date === dStr && p.request_type === "pickup");
                    const dayDrops = pickups.filter(p => p.request_date === dStr && p.request_type === "dropoff");
                    const dayTransfers = pickups.filter(p => p.request_date === dStr && p.request_type === "transfer");
                    const isSel = selDay === dStr;
                    const cls = `${!inMonth ? "out-month" : ""}${isSel ? " sel" : ""}`.trim();
                    return (
                      <td key={di} className={cls} onClick={() => inMonth && setSelDay(isSel ? null : dStr)}>
                        <div className="cal-d">{day.getMonth() + 1}/{day.getDate()}</div>
                        {dayPickups.length > 0 && <div className="cal-pin">✈️IN {dayPickups.length}</div>}
                        {dayDrops.length > 0 && <div className="cal-pout">✈️OUT {dayDrops.length}</div>}
                        {dayTransfers.length > 0 && <div className="cal-ptr">🔄 {dayTransfers.length}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {selDay && selDayPickups.length > 0 && (
            <div className="day-detail">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "#1a6fc4" }}>{fDate(selDay)} 일정 ({selDayPickups.length}건)</div>
              {selDayPickups.map(p => {
                const flightTxt = p.request_type === "transfer" ? "" : p.request_type === "pickup" ? (p.bookings?.flight_in || p.flight_info) : (p.bookings?.flight_out || p.flight_info);
                return (
                  <div key={p.id} className="day-row">
                    <span className={`badge t-${p.request_type}`}>{p.request_type === "pickup" ? "✈️IN" : p.request_type === "dropoff" ? "✈️OUT" : p.request_type === "transfer" ? "🔄" : "추가"}</span>
                    <span style={{ fontWeight: 700 }}>{bookerOf(p)}</span>
                    <span style={{ fontSize: 11, color: "#475569" }}>{p.request_time || "시간미정"} · {flightTxt || "항공편미정"}</span>
                    <span style={{ fontSize: 11, color: "#475569" }}>{p.location || "-"} → {p.destination || "-"}</span>
                    <button className="ico-btn" onClick={() => window.open(`/admin/checkin-card?bookingId=${p.booking_id}`, "_blank")}>🪧</button>
                  </div>
                );
              })}
            </div>
          )}
          {selDay && selDayPickups.length === 0 && (
            <div className="day-detail" style={{ textAlign: "center", color: "#94a3b8" }}>{fDate(selDay)} 일정 없음</div>
          )}
        </div>
      )}
    </div>
  </>);
}
