"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthed } from "@/lib/adminAuth";
import AfterFieldDeploy from "./AfterFieldDeploy";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface FieldtripApp {
  id: number;
  created_at: string;
  name: string | null;          // 아이 이름
  date: string | null;          // 선택 일정 토큰(콤마 결합) 예: "5-9-nimobrew, 6-13-shrine"
  message: string | null;
  room_number: string | null;
  request: string | null;
  status: string | null;
  booking_id: string | null;    // 예약 연결키 (픽업·셔틀·튜터와 동일)
  portal_name: string | null;   // 신청 시점 예약자명 스냅샷
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기중", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정",   bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
};

// ─────────────────────────────────────────────────────────────
// 일정 토큰 → 프로그램 메타 매핑
//   토큰 형식: "월-일-키" (예: "5-9-nimobrew")
//   토큰 자체가 (날짜 + 프로그램)을 인코딩하므로 그룹 키로 사용.
//   ※ 손님 신청폼(app/after-school-fieldtrip)에 새 일정이 추가되면 이 표도 갱신 필요.
//      미등록 토큰은 키를 그대로 표시하는 폴백으로 처리됨.
// ─────────────────────────────────────────────────────────────
const FT_PROGRAMS: Record<string, { name: string; isFieldtrip: boolean; time: string }> = {
  // May
  "5-4-origami":      { name: "Origami Activity & Paper Airplane",        isFieldtrip: false, time: "4:20~5:10pm" },
  "5-6-snack":        { name: "Snack Grabbing Game + Obstacle Course",    isFieldtrip: false, time: "4:30~5:20pm" },
  "5-9-nimobrew":     { name: "Nimo Brew",                                isFieldtrip: true,  time: "픽업 10:15~20" },
  "5-11-ecoplanting": { name: "Eco Planting & Herb",                      isFieldtrip: false, time: "4:20~5:10pm" },
  "5-13-olympics":    { name: "Mini Olympics",                            isFieldtrip: false, time: "4:30~5:20pm" },
  "5-18-pinwheel":    { name: "Pinwheel Activity",                        isFieldtrip: false, time: "4:20~5:10pm" },
  "5-20-naturewalk":  { name: "Nature Walk & Jackfruit Maze",            isFieldtrip: false, time: "4:30~5:20pm" },
  "5-23-smskating":   { name: "SM Seaside — SM Skating",                  isFieldtrip: true,  time: "픽업 10:15~20" },
  "5-25-watergun":    { name: "Water Gun Fun",                            isFieldtrip: false, time: "4:20~5:10pm" },
  "5-27-hulahoop":    { name: "Hula Hoop & Jump Rope",                    isFieldtrip: false, time: "4:30~5:20pm" },
  // June
  "6-1-flower":       { name: "Flower Arrangement",                       isFieldtrip: false, time: "4:20~5:10pm" },
  "6-3-grossmotor":   { name: "Gross Motor",                              isFieldtrip: false, time: "4:30~5:20pm" },
  "6-8-baseball":     { name: "Hand Baseball",                            isFieldtrip: false, time: "4:20~5:10pm" },
  "6-10-trafficlight":{ name: "Red Light Green Light & Team Treasure Hunt", isFieldtrip: false, time: "4:30~5:20pm" },
  "6-13-shrine":      { name: "Shrine Tour",                              isFieldtrip: true,  time: "픽업 10:15~20" },
  "6-15-watergun":    { name: "Water Gun Fun",                            isFieldtrip: false, time: "4:20~5:10pm" },
  "6-17-olympics":    { name: "Mini Olympics",                            isFieldtrip: false, time: "4:30~5:20pm" },
  "6-22-natureart":   { name: "Art with Leaves, Grass & Flowers",        isFieldtrip: false, time: "4:20~5:10pm" },
  "6-24-naturewalk":  { name: "Nature Walk & Jackfruit Maze",            isFieldtrip: false, time: "4:30~5:20pm" },
  "6-27-magellan":    { name: "Magellan's Cross",                         isFieldtrip: true,  time: "픽업 10:15~20" },
  "6-29-watergun":    { name: "Water Gun Fun",                            isFieldtrip: false, time: "4:20~5:10pm" },
};

const KR_DOW = ["일", "월", "화", "수", "목", "금", "토"];

// 토큰 파싱 → {month, day, key}
function parseToken(token: string): { month: number; day: number; key: string } | null {
  const m = token.trim().match(/^(\d{1,2})-(\d{1,2})-(.+)$/);
  if (!m) return null;
  return { month: Number(m[1]), day: Number(m[2]), key: m[3] };
}

// 토큰의 프로그램 표시명 (매핑 없으면 키를 보기 좋게 변환)
function programNameOf(token: string, key: string): string {
  const meta = FT_PROGRAMS[token];
  if (meta) return meta.name;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// 토큰 단위로 펼친 행
interface FlatRow {
  appId: number;
  childName: string;
  reserver: string;
  room: string;
  request: string;
  status: string;
  token: string;
  month: number;
  day: number;
  programName: string;
  isFieldtrip: boolean;
  time: string;
}

export default function AfterschoolFieldtripAdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [mainTab, setMainTab] = useState<"list" | "deploy">("list");
  const [apps, setApps] = useState<FieldtripApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set());
  const [monthsInitDone, setMonthsInitDone] = useState(false);
  const [bookerNames, setBookerNames] = useState<Record<string, string>>({}); // booking_id → 예약자 실명

  useEffect(() => {
    if (!isAdminAuthed()) { router.replace("/login"); return; }
    setAuthed(true);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fieldtrip_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setApps(data as FieldtripApp[]);
      // booking_id → 예약자 실명 매핑 (픽업·셔틀과 동일하게 실명 표시)
      const ids = Array.from(new Set((data as FieldtripApp[]).map(a => a.booking_id).filter(Boolean))) as string[];
      if (ids.length > 0) {
        const { data: bks } = await supabase.from("bookings").select("id, booker_name").in("id", ids);
        const map: Record<string, string> = {};
        (bks || []).forEach((b: { id: string; booker_name: string | null }) => { map[b.id] = (b.booker_name || "").trim(); });
        setBookerNames(map);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function changeStatus(appId: number, status: string) {
    const prev = apps;
    setApps(apps.map(a => a.id === appId ? { ...a, status } : a));
    const { error } = await supabase.from("fieldtrip_applications").update({ status }).eq("id", appId);
    if (error) { alert("상태 변경 실패: " + error.message); setApps(prev); }
  }

  function toggleMonth(m: number) {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  }

  // 펼친 행 + 미분류 분리
  const flat: FlatRow[] = [];
  const legacy: FieldtripApp[] = [];
  for (const a of apps) {
    const tokens = (a.date || "").split(",").map(t => t.trim()).filter(Boolean);
    const childName = (a.name || "").trim();
    const reserver = (a.booking_id && bookerNames[a.booking_id]) || (a.portal_name || "").trim();
    const room = (a.room_number || "").trim();
    const request = (a.request || a.message || "").trim();
    const status = a.status || "pending";
    let pushedAny = false;
    for (const token of tokens) {
      const p = parseToken(token);
      if (!p) continue;
      const meta = FT_PROGRAMS[token];
      flat.push({
        appId: a.id, childName, reserver, room, request, status, token,
        month: p.month, day: p.day,
        programName: programNameOf(token, p.key),
        isFieldtrip: meta ? meta.isFieldtrip : false,
        time: meta ? meta.time : "",
      });
      pushedAny = true;
    }
    if (!pushedAny) legacy.push(a);
  }

  // 토큰(=날짜+프로그램) 단위 그룹
  const groupMap = new Map<string, FlatRow[]>();
  for (const r of flat) {
    const arr = groupMap.get(r.token) || [];
    arr.push(r);
    groupMap.set(r.token, arr);
  }
  // 월 → 그룹들
  const monthMap = new Map<number, [string, FlatRow[]][]>();
  for (const [token, rows] of groupMap.entries()) {
    const m = rows[0].month;
    const arr = monthMap.get(m) || [];
    arr.push([token, rows]);
    monthMap.set(m, arr);
  }
  // 각 월 내부 그룹은 일→프로그램명 순 정렬
  for (const arr of monthMap.values()) {
    arr.sort((a, b) => (a[1][0].day - b[1][0].day) || a[1][0].programName.localeCompare(b[1][0].programName));
  }
  const monthChapters = Array.from(monthMap.entries()).sort((a, b) => a[0] - b[0]);

  // 기본 펼침 월 초기화 (현재 월 또는 가장 가까운 미래 월)
  useEffect(() => {
    if (monthsInitDone) return;
    if (apps.length === 0) return;
    const months = new Set<number>();
    for (const a of apps) {
      for (const token of (a.date || "").split(",").map(t => t.trim()).filter(Boolean)) {
        const p = parseToken(token);
        if (p) months.add(p.month);
      }
    }
    if (months.size === 0) { setMonthsInitDone(true); return; }
    const sorted = Array.from(months).sort((a, b) => a - b);
    const curM = new Date().getMonth() + 1;
    const pick = sorted.find(m => m === curM) || sorted.find(m => m > curM) || sorted[sorted.length - 1];
    setExpandedMonths(new Set([pick]));
    setMonthsInitDone(true);
  }, [apps, monthsInitDone]);

  if (!authed) return null;

  const totalRows = flat.length + legacy.length;

  return (<>
    <style>{`
*{box-sizing:border-box}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.af-w{max-width:1400px;margin:0 auto;padding:24px}
.af-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.af-back{background:none;border:1px solid #cbd5e1;color:#475569;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit;font-weight:600}.af-back:hover{background:#fff;color:#1a6fc4}
.af-title{font-size:20px;font-weight:800;color:#1a1a2e}
.af-sub{font-size:13px;color:#6b7c93;margin-left:10px}
.af-card{background:#fff;border-radius:14px;padding:0;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow:hidden}
.af-tbl{width:100%;border-collapse:collapse;font-size:13px}
.af-tbl th{background:#f8fafc;text-align:left;padding:12px 14px;font-weight:700;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;white-space:nowrap}
.af-tbl td{padding:12px 14px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.af-tbl tr:hover td{background:#f8fafc}
.af-sel{padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit;background:#fff;cursor:pointer;font-weight:600}
.af-empty{padding:60px;text-align:center;color:#94a3b8;font-size:14px}
.af-loading{padding:40px;text-align:center;color:#3b82f6;font-size:14px}
.af-notes{max-width:280px;font-size:12px;color:#475569;white-space:pre-wrap}
    `}</style>
    <div className="af-w">
      <div className="af-head">
        <button className="af-back" onClick={() => router.push("/admin/hub")}>← 어드민 홈</button>
        <div>
          <span className="af-title">🎒 애프터스쿨/필드트립 관리</span>
          <span className="af-sub">총 {totalRows}건</span>
        </div>
        <div style={{ width: 100 }} />
      </div>

      <div style={{display:"flex",gap:6,background:"#fff",padding:4,borderRadius:12,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
        <button
          onClick={() => setMainTab("list")}
          style={{flex:1,padding:"10px 14px",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:mainTab==="list"?"#1a6fc4":"transparent",color:mainTab==="list"?"#fff":"#6b7c93"}}
        >📋 신청목록</button>
        <button
          onClick={() => setMainTab("deploy")}
          style={{flex:1,padding:"10px 14px",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:mainTab==="deploy"?"#1a6fc4":"transparent",color:mainTab==="deploy"?"#fff":"#6b7c93"}}
        >📅 배포</button>
      </div>

      {mainTab === "deploy" ? (
        <AfterFieldDeploy />
      ) : loading ? (
        <div className="af-card"><div className="af-loading">불러오는 중...</div></div>
      ) : (monthChapters.length === 0 && legacy.length === 0) ? (
        <div className="af-card"><div className="af-empty">신청 내역이 없습니다.</div></div>
      ) : (
        <div style={{display:"flex", flexDirection:"column", gap:14}}>
          {monthChapters.map(([month, mGroups]) => {
            const open = expandedMonths.has(month);
            const mPeople = mGroups.reduce((s, [, rows]) => s + rows.length, 0);
            const mCount = mGroups.length;
            return (
              <div key={month}>
                <div
                  onClick={() => toggleMonth(month)}
                  style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:"#16a34a", color:"#fff", borderRadius:12, cursor:"pointer", boxShadow:"0 2px 8px rgba(22,163,74,0.18)"}}
                >
                  <div style={{fontSize:16, fontWeight:800, display:"flex", alignItems:"center", gap:8}}>
                    <span style={{fontSize:13}}>{open ? "▼" : "▶"}</span>📅 {month}월 <span style={{fontWeight:600, opacity:0.85}}>({mCount}건)</span>
                  </div>
                  <div style={{fontSize:13, fontWeight:700, color:"#15803d", background:"#fff", padding:"4px 14px", borderRadius:999}}>총 {mPeople}명</div>
                </div>
                {open && (
                <div style={{display:"flex", flexDirection:"column", gap:14, marginTop:12}}>
                  {mGroups.map(([token, rows]) => {
                    const r0 = rows[0];
                    const total = rows.length;
                    const dt = new Date(new Date().getFullYear(), r0.month - 1, r0.day);
                    const dowStr = isNaN(dt.getTime()) ? "" : ` (${KR_DOW[dt.getDay()]})`;
                    return (
                      <div key={token} className="af-card">
                        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background: r0.isFieldtrip ? "#fff7ed" : "#eff6ff", borderBottom: r0.isFieldtrip ? "1px solid #fed7aa" : "1px solid #bfdbfe"}}>
                          <div style={{fontSize:15, fontWeight:800, color:"#1a1a2e", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
                            📅 {r0.month}/{r0.day}{dowStr} · {r0.programName}
                            {r0.isFieldtrip && <span style={{fontSize:11, fontWeight:700, background:"#c2410c", color:"#fff", padding:"2px 8px", borderRadius:999}}>필드트립</span>}
                            {r0.time && <span style={{fontWeight:600, color:"#475569"}}>· {r0.time}</span>}
                          </div>
                          <div style={{fontSize:13, fontWeight:700, color: r0.isFieldtrip ? "#c2410c" : "#1d4ed8", background:"#fff", border: r0.isFieldtrip ? "1px solid #fed7aa" : "1px solid #bfdbfe", padding:"4px 12px", borderRadius:999}}>
                            총 {total}명
                          </div>
                        </div>
                        <table className="af-tbl">
                          <thead>
                            <tr>
                              <th style={{width:130}}>아이 이름</th>
                              <th style={{width:130}}>예약자</th>
                              <th style={{width:120}}>방 번호</th>
                              <th style={{width:70, textAlign:"center"}}>인원</th>
                              <th>요청사항</th>
                              <th style={{width:120}}>상태</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => {
                              const meta = STATUS_META[r.status] || STATUS_META.pending;
                              return (
                                <tr key={r.appId + "-" + r.token + "-" + i}>
                                  <td style={{fontWeight:600}}>{r.childName || "-"}</td>
                                  <td style={{color:"#475569"}}>{r.reserver || "-"}</td>
                                  <td style={{color:"#475569"}}>{r.room || "-"}</td>
                                  <td style={{textAlign:"center", fontWeight:700}}>1명</td>
                                  <td className="af-notes" title={r.request}>{r.request || "-"}</td>
                                  <td>
                                    <select
                                      className="af-sel"
                                      style={{background:meta.bg, color:meta.color, borderColor:meta.bg}}
                                      value={r.status}
                                      onChange={e => changeStatus(r.appId, e.target.value)}
                                    >
                                      <option value="pending">대기중</option>
                                      <option value="confirmed">확정</option>
                                      <option value="cancelled">취소</option>
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            );
          })}

          {legacy.length > 0 && (
            <div className="af-card">
              <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", background:"#f1f5f9", borderBottom:"1px solid #cbd5e1"}}>
                <div style={{fontSize:15, fontWeight:800, color:"#475569"}}>📦 미분류 (일정 미확인)</div>
                <div style={{fontSize:13, fontWeight:700, color:"#475569", background:"#fff", border:"1px solid #cbd5e1", padding:"4px 12px", borderRadius:999}}>총 {legacy.length}건</div>
              </div>
              <table className="af-tbl">
                <thead>
                  <tr>
                    <th style={{width:130}}>아이 이름</th>
                    <th style={{width:130}}>예약자</th>
                    <th style={{width:120}}>방 번호</th>
                    <th style={{width:160}}>선택 일정(원본)</th>
                    <th>요청사항</th>
                    <th style={{width:120}}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {legacy.map(a => {
                    const status = a.status || "pending";
                    const meta = STATUS_META[status] || STATUS_META.pending;
                    const req = (a.request || a.message || "").trim();
                    return (
                      <tr key={a.id}>
                        <td style={{fontWeight:600}}>{(a.name || "").trim() || "-"}</td>
                        <td style={{color:"#475569"}}>{((a.booking_id && bookerNames[a.booking_id]) || (a.portal_name || "").trim()) || "-"}</td>
                        <td style={{color:"#475569"}}>{(a.room_number || "").trim() || "-"}</td>
                        <td style={{color:"#475569", fontSize:12}}>{(a.date || "").trim() || "-"}</td>
                        <td className="af-notes" title={req}>{req || "-"}</td>
                        <td>
                          <select
                            className="af-sel"
                            style={{background:meta.bg, color:meta.color, borderColor:meta.bg}}
                            value={status}
                            onChange={e => changeStatus(a.id, e.target.value)}
                          >
                            <option value="pending">대기중</option>
                            <option value="confirmed">확정</option>
                            <option value="cancelled">취소</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  </>);
}
