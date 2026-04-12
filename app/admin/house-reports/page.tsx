"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Item { content: string; status: "done" | "progress" | "check" }
interface Room { room_no: string; visit_type: "first" | "revisit"; items: Item[] }
interface Report {
  id: string; reporter: string; report_date: string;
  time_slot: "morning" | "afternoon" | "checkin";
  rooms: Room[]; memo: string | null; created_at: string;
}

const SLOT_LABEL: Record<string, string> = { morning: "🌅 오전", afternoon: "☀️ 오후", checkin: "🌙 체크인" };
const SLOT_BG: Record<string, string> = { morning: "#fef3c7", afternoon: "#fed7aa", checkin: "#ddd6fe" };
const SLOT_COLOR: Record<string, string> = { morning: "#92400e", afternoon: "#9a3412", checkin: "#5b21b6" };

const STATUS: Record<string, { label: string; bg: string; color: string; bold: boolean }> = {
  done:     { label: "✅ 완료",     bg: "#dcfce7", color: "#166534", bold: false },
  progress: { label: "🔄 조치중",   bg: "#fed7aa", color: "#9a3412", bold: true  },
  check:    { label: "❗ 확인필요", bg: "#fecaca", color: "#991b1b", bold: true  },
};

function fDate(d: string | null) { return d || "-"; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function addDays(s: string, n: number) { const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

export default function HouseReportsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [slot, setSlot] = useState<"all" | "morning" | "afternoon" | "checkin">("all");
  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else if (typeof window !== "undefined") window.location.href = "/login"; }, []);

  const load = useCallback(async () => {
    if (!authed) return;
    const res = await fetch(`/api/house-reports?from=${dateFrom}&to=${dateTo}&slot=${slot}`);
    if (res.ok) { const d = await res.json(); setReports(d.reports || []); }
  }, [authed, dateFrom, dateTo, slot]);

  useEffect(() => { load(); }, [load]);

  function setDateRange(type: "today" | "yesterday" | "week") {
    const t = todayStr();
    if (type === "today") { setDateFrom(t); setDateTo(t); }
    else if (type === "yesterday") { const y = addDays(t, -1); setDateFrom(y); setDateTo(y); }
    else { setDateFrom(addDays(t, -6)); setDateTo(t); }
  }

  async function createTask(room_no: string, item: Item, reporter: string, report_date: string, key: string) {
    setCreating(key);
    const res = await fetch("/api/house-reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_no, content: item.content, status: item.status, reporter, report_date }),
    });
    setCreating(null);
    if (!res.ok) { const r = await res.json(); alert(r.error || "생성 실패"); return; }
    alert("✓ 업무가 생성되었습니다 (직원업무 > 전체 업무)");
  }

  // 통계
  const todayReports = reports.filter(r => r.report_date === todayStr());
  let progressCount = 0, checkCount = 0;
  reports.forEach(r => r.rooms?.forEach(rm => rm.items?.forEach(it => {
    if (it.status === "progress") progressCount++;
    if (it.status === "check") checkCount++;
  })));

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f9fafb;color:#111827}
.hr-w{max-width:900px;margin:0 auto;padding:28px 20px}
.hr-top{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.hr-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.hr-back:hover{background:#e5e7eb}
.hr-top h1{font-size:22px;font-weight:800;flex:1}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
.stat{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px}
.stat .lbl{font-size:11px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px}
.stat .val{font-size:22px;font-weight:800;color:#111827}
.stat.warn{background:#fff7ed;border-color:#fdba74}.stat.warn .val{color:#9a3412}
.stat.danger{background:#fef2f2;border-color:#fca5a5}.stat.danger .val{color:#991b1b}
.toolbar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
.date-quick{display:flex;gap:4px}
.date-quick button{padding:6px 12px;border:1px solid #d1d5db;border-radius:7px;background:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}.date-quick button:hover{background:#f3f4f6}
.date-input{padding:6px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:12px;font-family:inherit;outline:none}
.tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:10px;margin-bottom:16px;border:1px solid #e5e7eb}
.tab{flex:1;padding:10px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:8px;cursor:pointer;font-family:inherit;background:transparent;color:#6b7280}
.tab.ac{background:#2563eb;color:#fff}
.report{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin-bottom:12px}
.report-head{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #e5e7eb;flex-wrap:wrap}
.report-date{font-size:15px;font-weight:800}
.badge{display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700}
.report-meta{margin-left:auto;font-size:11px;color:#9ca3af}
.room{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:10px}
.room-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.room-no{font-size:14px;font-weight:800}
.visit{font-size:11px;padding:2px 8px;background:#e0e7ff;color:#3730a3;border-radius:4px;font-weight:700}
.item{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px}
.item .badge-sm{padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;flex-shrink:0}
.item .content{flex:1}
.item .task-btn{padding:4px 10px;font-size:11px;font-weight:700;border:1px solid #d1d5db;background:#fff;color:#374151;border-radius:5px;cursor:pointer;font-family:inherit}
.item .task-btn:hover{background:#f3f4f6}
.item .task-btn:disabled{opacity:0.5;cursor:not-allowed}
.memo{margin-top:12px;padding:10px 12px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e;line-height:1.5}
.empty{text-align:center;padding:40px;color:#9ca3af;background:#fff;border:1px dashed #e5e7eb;border-radius:12px}
@media(max-width:600px){.hr-w{padding:20px 12px}.stats{grid-template-columns:1fr}.toolbar{flex-direction:column;align-items:stretch}}
    `}</style>
    <div className="hr-w">
      <div className="hr-top">
        <button className="hr-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>🏠 하우스 보고</h1>
      </div>

      <div className="stats">
        <div className="stat"><div className="lbl">오늘 보고</div><div className="val">{todayReports.length}건</div></div>
        <div className={`stat${progressCount > 0 ? " warn" : ""}`}><div className="lbl">🔄 조치중</div><div className="val">{progressCount}개</div></div>
        <div className={`stat${checkCount > 0 ? " danger" : ""}`}><div className="lbl">❗ 확인필요</div><div className="val">{checkCount}개</div></div>
      </div>

      <div className="toolbar">
        <div className="date-quick">
          <button onClick={() => setDateRange("today")}>오늘</button>
          <button onClick={() => setDateRange("yesterday")}>어제</button>
          <button onClick={() => setDateRange("week")}>이번주</button>
        </div>
        <input className="date-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ color: "#9ca3af", fontSize: 12 }}>~</span>
        <input className="date-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>{reports.length}건</span>
      </div>

      <div className="tabs">
        {([["all", "전체"], ["morning", "🌅 오전"], ["afternoon", "☀️ 오후"], ["checkin", "🌙 체크인"]] as const).map(([k, v]) => (
          <button key={k} className={`tab${slot === k ? " ac" : ""}`} onClick={() => setSlot(k as typeof slot)}>{v}</button>
        ))}
      </div>

      {reports.length === 0 ? (
        <div className="empty">📭 해당 기간 보고 내역이 없습니다</div>
      ) : reports.map(r => {
        const slotBg = SLOT_BG[r.time_slot] || "#f3f4f6";
        const slotColor = SLOT_COLOR[r.time_slot] || "#374151";
        const submitTime = new Date(r.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
        return (
          <div key={r.id} className="report">
            <div className="report-head">
              <div className="report-date">{fDate(r.report_date)}</div>
              <span className="badge" style={{ background: slotBg, color: slotColor }}>{SLOT_LABEL[r.time_slot] || r.time_slot}</span>
              <span className="badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>👤 {r.reporter}</span>
              <div className="report-meta">제출 {submitTime}</div>
            </div>

            {(r.rooms || []).map((rm, rIdx) => (
              <div key={rIdx} className="room">
                <div className="room-head">
                  <span className="room-no">{rm.room_no || "-"}</span>
                  <span className="visit">{rm.visit_type === "first" ? "첫방문" : "재방문"}</span>
                </div>
                {(rm.items || []).map((it, iIdx) => {
                  const st = STATUS[it.status] || STATUS.done;
                  const canCreate = it.status === "progress" || it.status === "check";
                  const key = `${r.id}-${rIdx}-${iIdx}`;
                  return (
                    <div key={iIdx} className="item">
                      <span className="badge-sm" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      <span className="content" style={{ fontWeight: st.bold ? 700 : 400, color: st.bold ? st.color : "#374151" }}>{it.content}</span>
                      {canCreate && (
                        <button className="task-btn" onClick={() => createTask(rm.room_no, it, r.reporter, r.report_date, key)} disabled={creating === key}>
                          {creating === key ? "생성 중..." : "📝 업무 생성"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {r.memo && <div className="memo">📝 <b>메모:</b> {r.memo}</div>}
          </div>
        );
      })}
    </div>
  </>);
}
