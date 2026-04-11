"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams } from "next/navigation";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface Pickup {
  id: string; request_type: string; request_date: string; request_time: string;
  location: string; destination: string; num_people: number; flight_info: string; status: string;
  bookings_new: { booker_name: string } | null;
}

const DAYS = ["일","월","화","수","목","금","토"];
function fDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth()+1}/${dt.getDate()}(${DAYS[dt.getDay()]})`;
}
function weekRange() {
  const d = new Date(); d.setHours(0,0,0,0);
  const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { start: mon.toISOString().slice(0,10), end: sun.toISOString().slice(0,10) };
}

type Tab = "today" | "tomorrow" | "week";

export default function DriverMobilePage() {
  const params = useParams();
  const token = params.token as string;
  const [driver, setDriver] = useState<{ id: string; name: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [tab, setTab] = useState<Tab>("today");

  const today = new Date().toISOString().slice(0,10);
  const tmr = (() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })();
  const week = weekRange();

  const loadDriver = useCallback(async () => {
    const { data } = await supabase.from("drivers").select("id, name").eq("share_token", token).maybeSingle();
    if (!data) { setInvalid(true); return; }
    setDriver(data);
  }, [token]);

  const loadPickups = useCallback(async () => {
    if (!driver) return;
    const { data } = await supabase
      .from("pickup_requests")
      .select("id, request_type, request_date, request_time, location, destination, num_people, flight_info, status, bookings_new(booker_name)")
      .eq("driver_id", driver.id)
      .gte("request_date", week.start)
      .lte("request_date", week.end)
      .neq("status", "cancelled")
      .order("request_date")
      .order("request_time");
    if (data) setPickups(data as unknown as Pickup[]);
  }, [driver, week.start, week.end]);

  useEffect(() => { loadDriver(); }, [loadDriver]);
  useEffect(() => { if (driver) loadPickups(); }, [driver, loadPickups]);

  if (invalid) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "'Noto Sans KR',sans-serif", background: "#f1f5f9", padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", maxWidth: 360, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>유효하지 않은 링크입니다</div>
        <div style={{ fontSize: 13, color: "#6b7c93" }}>관리자에게 새 링크를 요청해주세요.</div>
      </div>
    </div>
  );

  if (!driver) return null;

  const filtered = pickups.filter(p => {
    if (tab === "today") return p.request_date === today;
    if (tab === "tomorrow") return p.request_date === tmr;
    return true;
  });

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.dw{max-width:480px;margin:0 auto;padding:20px 16px;min-height:100vh}
.dh{background:linear-gradient(135deg,#1a6fc4,#0d3d7a);border-radius:16px;padding:24px 20px;color:#fff;margin-bottom:16px}
.dh h1{font-size:20px;font-weight:800;margin-bottom:4px}
.dh p{font-size:12px;opacity:0.8}
.tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:12px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
.tab{flex:1;padding:12px 8px;font-size:14px;font-weight:700;text-align:center;border:none;border-radius:10px;cursor:pointer;font-family:inherit;background:transparent;color:#6b7c93;transition:all 150ms}
.tab.ac{background:#1a6fc4;color:#fff}
.tab .cnt{display:inline-block;margin-left:4px;background:rgba(255,255,255,0.3);padding:1px 7px;border-radius:10px;font-size:11px}
.tab.ac .cnt{background:rgba(255,255,255,0.3)}
.pk{background:#fff;border-radius:14px;padding:20px;margin-bottom:12px;box-shadow:0 2px 10px rgba(0,0,0,0.05);border-left:4px solid #1a6fc4}
.pk.drop{border-left-color:#16a34a}
.pk-time{font-size:24px;font-weight:900;color:#1a1a2e;margin-bottom:6px}
.pk-guest{font-size:16px;font-weight:700;margin-bottom:8px}
.pk-row{display:flex;gap:6px;align-items:center;font-size:13px;color:#475569;margin-bottom:4px}
.pk-row .lbl{font-weight:700;color:#6b7c93;min-width:40px}
.pk-badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.pk-pickup{background:#dbeafe;color:#1e40af}
.pk-dropoff{background:#dcfce7;color:#166534}
.empty{text-align:center;padding:48px 20px;color:#94a3b8;font-size:14px}
.empty-icon{font-size:40px;margin-bottom:8px}
    `}</style>
    <div className="dw">
      <div className="dh">
        <h1>🚗 {driver.name}</h1>
        <p>{fDate(today)} · Dream Academy Philippines</p>
      </div>

      <div className="tabs">
        {([["today","오늘",pickups.filter(p=>p.request_date===today).length],
           ["tomorrow","내일",pickups.filter(p=>p.request_date===tmr).length],
           ["week","이번주",pickups.length]] as const).map(([k,v,c])=>(
          <button key={k} className={`tab${tab===k?" ac":""}`} onClick={()=>setTab(k as Tab)}>
            {v}<span className="cnt">{c}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">✅</div>
          {tab === "today" ? "오늘 일정이 없습니다" : tab === "tomorrow" ? "내일 일정이 없습니다" : "이번 주 일정이 없습니다"}
        </div>
      ) : filtered.map(p => (
        <div key={p.id} className={`pk${p.request_type==="dropoff"?" drop":""}`}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div className="pk-time">{p.request_time || "시간 미정"}</div>
            <span className={`pk-badge pk-${p.request_type}`}>
              {p.request_type==="pickup"?"픽업":"드랍"}
            </span>
          </div>
          <div className="pk-guest">{(p.bookings_new as unknown as {booker_name:string}|null)?.booker_name || "-"}</div>
          <div className="pk-row"><span className="lbl">날짜</span>{fDate(p.request_date)}</div>
          <div className="pk-row"><span className="lbl">인원</span>{p.num_people || 0}명</div>
          <div className="pk-row"><span className="lbl">출발</span>{p.location || "-"}</div>
          <div className="pk-row"><span className="lbl">도착</span>{p.destination || "-"}</div>
          {p.flight_info && <div className="pk-row"><span className="lbl">항공</span>{p.flight_info}</div>}
        </div>
      ))}
    </div>
  </>);
}
