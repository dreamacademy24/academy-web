"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ScheduleItem {
  id: string;
  type: "shuttle" | "afterschool" | "fieldtrip";
  date: string;
  title: string;
  description: string | null;
  is_deployed: boolean;
  deploy_month: string | null;
  created_at?: string;
}

const SUB_TABS = [
  { key: "afterschool", label: "🎨 애프터스쿨·필드트립" },
  { key: "holiday",     label: "🏖️ 휴일" },
] as const;
type SubTab = (typeof SUB_TABS)[number]["key"];

function pad2(n: number) { return String(n).padStart(2, "0"); }

// ─────────────────────────────────────────────────────────────
// 애프터스쿨 / 필드트립 활동 목록
// ─────────────────────────────────────────────────────────────
const AS_LIST = [
  "물총놀이", "미니 올림픽", "꽃꽂이", "체육 수업 (Gross Motor)",
  "손 야구 (Hand Baseball)", "신호등 게임 + 보물찾기", "산책 & 열대 과일 미로",
  "훌라후프·줄넘기", "풍선 테니스", "바람개비", "종이접기·비행기",
  "간식 잡기·장애물 코스", "책 탐색·퍼즐", "식물 관찰",
  "친환경 식물 심기·허브", "자연 미술 (나뭇잎·풀·꽃)", "배드민턴·피구",
];
const FT_LIST = [
  "쉬라인 투어", "니모 브류", "크로코랜디아", "키즈 카페",
  "SM 스케이팅", "마젤란 십자가", "기타 필드트립",
];
const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];

function getAfterFieldDates(month: string): { date: string; type: "afterschool" | "fieldtrip"; dow: number }[] {
  const [y, m] = month.split("-").map(Number);
  const result: { date: string; type: "afterschool" | "fieldtrip"; dow: number }[] = [];
  const lastDay = new Date(y, m, 0).getDate();
  let satCount = 0;
  for (let d = 1; d <= lastDay; d++) {
    const dt = new Date(y, m - 1, d);
    const dow = dt.getDay();
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dow === 1 || dow === 3) {
      result.push({ date: dateStr, type: "afterschool", dow });
    }
    if (dow === 6) {
      satCount++;
      if (satCount === 2 || satCount === 4) {
        result.push({ date: dateStr, type: "fieldtrip", dow });
      }
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// 월 네비게이션 유틸
// ─────────────────────────────────────────────────────────────
function curMonth(offset = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function monthShift(m: string, delta: number): string {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(y, mm - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function monthLabel(m: string): string {
  const [y, mm] = m.split("-").map(Number);
  return `${y}년 ${mm}월`;
}

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트 (애프터스쿨·필드트립 + 휴일 배포 캘린더)
// ─────────────────────────────────────────────────────────────
export default function AfterFieldDeploy() {
  const [subTab, setSubTab] = useState<SubTab>("afterschool");
  const [month, setMonth] = useState<string>(curMonth(0));

  // 애프터스쿨·필드트립 상태
  const [afRows, setAfRows] = useState<Record<string, string>>({});
  const [afItems, setAfItems] = useState<ScheduleItem[]>([]);
  const [afDeployed, setAfDeployed] = useState(false);
  const [afLoading, setAfLoading] = useState(false);
  const [afBusy, setAfBusy] = useState<"" | "save" | "deploy">("");

  // 휴일 탭 상태
  type Holiday = { id?: string; date: string; name: string; year: number; is_deployed: boolean };
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHoliDate, setNewHoliDate] = useState("");
  const [newHoliName, setNewHoliName] = useState("");
  const [holiYear, setHoliYear] = useState<number>(new Date().getFullYear());
  const [holiLoading, setHoliLoading] = useState(false);
  const [holiBusy, setHoliBusy] = useState<"" | "add" | "deploy" | "delete">("");

  // 애프터스쿨·필드트립 로드
  useEffect(() => {
    if (subTab !== "afterschool") return;
    let cancelled = false;
    (async () => {
      setAfLoading(true);
      const { data, error } = await supabase
        .from("schedule_items")
        .select("*")
        .eq("deploy_month", month)
        .in("type", ["afterschool", "fieldtrip"]);
      if (cancelled) return;
      if (error) {
        console.error("[schedule_items af] load 실패:", error);
        setAfItems([]); setAfRows({}); setAfDeployed(false);
      } else {
        const loaded = (data || []) as ScheduleItem[];
        setAfItems(loaded);
        const map: Record<string, string> = {};
        loaded.forEach(it => { map[it.date] = it.title; });
        setAfRows(map);
        setAfDeployed(loaded.some(i => i.is_deployed));
      }
      setAfLoading(false);
    })();
    return () => { cancelled = true; };
  }, [month, subTab]);

  async function saveAfRows() {
    if (afBusy) return;
    setAfBusy("save");
    const dates = getAfterFieldDates(month);
    const { error: delErr } = await supabase
      .from("schedule_items").delete()
      .eq("deploy_month", month)
      .in("type", ["afterschool", "fieldtrip"]);
    if (delErr) { setAfBusy(""); alert("기존 항목 삭제 실패: " + delErr.message); return; }
    const inserts = dates
      .filter(d => (afRows[d.date] || "").trim())
      .map(d => ({
        type: d.type,
        date: d.date,
        title: afRows[d.date],
        description: "",
        is_deployed: false,
        deploy_month: month,
      }));
    if (inserts.length > 0) {
      const { error: insErr } = await supabase.from("schedule_items").insert(inserts);
      if (insErr) { setAfBusy(""); alert("저장 실패: " + insErr.message); return; }
    }
    const { data } = await supabase
      .from("schedule_items").select("*")
      .eq("deploy_month", month).in("type", ["afterschool", "fieldtrip"]);
    const loaded = (data || []) as ScheduleItem[];
    setAfItems(loaded);
    setAfDeployed(loaded.some(i => i.is_deployed));
    setAfBusy("");
    alert("저장됐어요!");
  }

  async function deployAfRows() {
    if (afBusy) return;
    if (afItems.length === 0) { alert("배포할 항목이 없습니다. 먼저 저장하세요."); return; }
    if (!confirm(`${monthLabel(month)} 애프터스쿨·필드트립 ${afItems.length}건을 배포합니다. 계속할까요?`)) return;
    setAfBusy("deploy");
    const { error } = await supabase
      .from("schedule_items").update({ is_deployed: true })
      .eq("deploy_month", month)
      .in("type", ["afterschool", "fieldtrip"]);
    setAfBusy("");
    if (error) { alert("배포 실패: " + error.message); return; }
    setAfDeployed(true);
    setAfItems(prev => prev.map(i => ({ ...i, is_deployed: true })));
    alert("배포 완료!");
  }

  // ── 휴일 탭 로직 ──
  useEffect(() => {
    if (subTab !== "holiday") return;
    let cancelled = false;
    (async () => {
      setHoliLoading(true);
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .eq("year", holiYear)
        .order("date", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[holidays] load 실패:", error);
        setHolidays([]);
      } else {
        setHolidays((data || []) as Holiday[]);
      }
      setHoliLoading(false);
    })();
    return () => { cancelled = true; };
  }, [subTab, holiYear]);

  async function addHoliday() {
    const d = (newHoliDate || "").trim();
    const n = (newHoliName || "").trim();
    if (!d || !n) { alert("날짜와 휴일명을 모두 입력해주세요."); return; }
    const year = Number(d.slice(0, 4));
    if (!year) { alert("날짜 형식이 올바르지 않습니다."); return; }
    if (holidays.some(h => h.date === d)) { alert("이미 등록된 날짜입니다."); return; }
    setHoliBusy("add");
    const { data, error } = await supabase
      .from("holidays")
      .insert({ date: d, name: n, year, is_deployed: false })
      .select().single();
    setHoliBusy("");
    if (error) { alert("추가 실패: " + error.message); return; }
    if (data) {
      setHolidays(prev => [...prev, data as Holiday].sort((a, b) => a.date.localeCompare(b.date)));
      setNewHoliDate(""); setNewHoliName("");
      // 다른 연도면 연도 이동도 함께
      if (year !== holiYear) setHoliYear(year);
    }
  }

  async function deleteHoliday(id?: string) {
    if (!id) return;
    if (!confirm("이 휴일을 삭제할까요?")) return;
    setHoliBusy("delete");
    const { error } = await supabase.from("holidays").delete().eq("id", id);
    setHoliBusy("");
    if (error) { alert("삭제 실패: " + error.message); return; }
    setHolidays(prev => prev.filter(h => h.id !== id));
  }

  async function deployHolidays() {
    if (holidays.length === 0) { alert("배포할 휴일이 없습니다."); return; }
    if (!confirm(`${holiYear}년 휴일 ${holidays.length}건을 전체 배포합니다. 계속할까요?`)) return;
    setHoliBusy("deploy");
    const { error } = await supabase
      .from("holidays")
      .update({ is_deployed: true })
      .eq("year", holiYear);
    setHoliBusy("");
    if (error) { alert("배포 실패: " + error.message); return; }
    setHolidays(prev => prev.map(h => ({ ...h, is_deployed: true })));
    alert(`✅ ${holiYear}년 휴일 전체 배포 완료!`);
  }

  return (
    <div>
      {/* 서브탭 */}
      <div style={{display:"flex",gap:6,background:"#fff",padding:4,borderRadius:10,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{flex:1,padding:"9px 12px",border:"none",borderRadius:7,fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:subTab===t.key?"#eff6ff":"transparent",color:subTab===t.key?"#1a6fc4":"#6b7c93"}}
          >{t.label}</button>
        ))}
      </div>

      {subTab === "holiday" ? (
        <div style={{background:"#fff",borderRadius:14,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.05)"}}>
          {/* 상단바: 연도 네비 + 배포 상태 + 전체 배포 */}
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",gap:4,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:3}}>
              <button onClick={() => setHoliYear(y => y - 1)} style={{padding:"7px 12px",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"transparent",color:"#475569"}}>◀</button>
              <button onClick={() => setHoliYear(new Date().getFullYear())} style={{padding:"7px 14px",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"#1a6fc4",color:"#fff",minWidth:90,textAlign:"center"}}>{holiYear}년</button>
              <button onClick={() => setHoliYear(y => y + 1)} style={{padding:"7px 12px",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"transparent",color:"#475569"}}>▶</button>
            </div>

            {(() => {
              const someDeployed = holidays.some(h => h.is_deployed);
              return (
                <span style={{padding:"6px 12px",borderRadius:999,fontSize:12,fontWeight:700,background:someDeployed?"#dcfce7":"#f1f5f9",color:someDeployed?"#15803d":"#64748b"}}>
                  {someDeployed ? "✅ 배포됨" : "⏸ 미배포"}
                </span>
              );
            })()}

            <div style={{flex:1}} />

            <button
              onClick={deployHolidays}
              disabled={!!holiBusy || holidays.length === 0}
              style={{padding:"9px 16px",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:(holiBusy||holidays.length===0)?"not-allowed":"pointer",fontFamily:"inherit",background:"#16a34a",color:"#fff",opacity:(holiBusy||holidays.length===0)?0.6:1}}
            >🚀 {holiBusy==="deploy" ? "배포중..." : "전체 배포"}</button>
          </div>

          {/* 휴일 추가 폼 */}
          <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <input
              type="date"
              value={newHoliDate}
              onChange={e => setNewHoliDate(e.target.value)}
              style={{padding:"8px 12px",border:"1px solid #cbd5e1",borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",background:"#fff"}}
            />
            <input
              type="text"
              placeholder="휴일명 (예: 독립기념일)"
              value={newHoliName}
              onChange={e => setNewHoliName(e.target.value)}
              style={{flex:1,minWidth:200,padding:"8px 12px",border:"1px solid #cbd5e1",borderRadius:7,fontSize:13,fontFamily:"inherit",outline:"none",background:"#fff"}}
            />
            <button
              onClick={addHoliday}
              disabled={!!holiBusy || !newHoliDate || !newHoliName.trim()}
              style={{padding:"9px 18px",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:(holiBusy||!newHoliDate||!newHoliName.trim())?"not-allowed":"pointer",fontFamily:"inherit",background:"#1a6fc4",color:"#fff",opacity:(holiBusy||!newHoliDate||!newHoliName.trim())?0.6:1}}
            >+ {holiBusy==="add" ? "추가중..." : "추가"}</button>
          </div>

          {/* 휴일 테이블 */}
          {holiLoading ? (
            <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>불러오는 중...</div>
          ) : holidays.length === 0 ? (
            <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13,background:"#fafafa",border:"1px dashed #e2e8f0",borderRadius:10}}>
              등록된 휴일이 없어요. 위에서 추가해줘요!
            </div>
          ) : (
            <div style={{overflow:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr style={{background:"#f8fafc"}}>
                    <th style={{padding:"11px 14px",textAlign:"left",fontWeight:700,color:"#475569",fontSize:12,borderBottom:"1px solid #e2e8f0",width:130}}>날짜</th>
                    <th style={{padding:"11px 14px",textAlign:"center",fontWeight:700,color:"#475569",fontSize:12,borderBottom:"1px solid #e2e8f0",width:60}}>요일</th>
                    <th style={{padding:"11px 14px",textAlign:"left",fontWeight:700,color:"#475569",fontSize:12,borderBottom:"1px solid #e2e8f0"}}>이름</th>
                    <th style={{padding:"11px 14px",textAlign:"center",fontWeight:700,color:"#475569",fontSize:12,borderBottom:"1px solid #e2e8f0",width:110}}>배포 상태</th>
                    <th style={{padding:"11px 14px",textAlign:"center",fontWeight:700,color:"#475569",fontSize:12,borderBottom:"1px solid #e2e8f0",width:70}}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map(h => {
                    const dt = new Date(h.date + "T00:00:00");
                    const dow = isNaN(dt.getTime()) ? -1 : dt.getDay();
                    const dowKr = dow >= 0 ? ["일","월","화","수","목","금","토"][dow] : "-";
                    return (
                      <tr key={h.id || h.date} style={{borderBottom:"1px solid #f1f5f9"}}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                        <td style={{padding:"10px 14px",fontWeight:600,color:"#1a1a2e",whiteSpace:"nowrap"}}>{h.date}</td>
                        <td style={{padding:"10px 14px",textAlign:"center",fontWeight:700,color:dow===0?"#dc2626":dow===6?"#1a6fc4":"#475569"}}>{dowKr}</td>
                        <td style={{padding:"10px 14px",fontWeight:600,color:"#1a1a2e"}}>{h.name}</td>
                        <td style={{padding:"10px 14px",textAlign:"center"}}>
                          <span style={{display:"inline-block",padding:"3px 10px",borderRadius:999,fontSize:11,fontWeight:700,background:h.is_deployed?"#dcfce7":"#f1f5f9",color:h.is_deployed?"#15803d":"#64748b"}}>
                            {h.is_deployed ? "✅ 배포됨" : "⏸ 미배포"}
                          </span>
                        </td>
                        <td style={{padding:"10px 14px",textAlign:"center"}}>
                          <button
                            onClick={() => deleteHoliday(h.id)}
                            disabled={!!holiBusy}
                            title="삭제"
                            style={{padding:"6px 10px",border:"none",borderRadius:6,fontSize:13,cursor:holiBusy?"not-allowed":"pointer",fontFamily:"inherit",background:"#fef2f2",color:"#dc2626",opacity:holiBusy?0.6:1}}
                          >🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 휴일 안내 박스 */}
          <div style={{marginTop:14,padding:"14px 18px",background:"#fef9c3",border:"1px solid #fde68a",borderLeft:"4px solid #f59e0b",borderRadius:10,fontSize:12.5,color:"#92400e",lineHeight:1.7}}>
            <div style={{fontWeight:800,marginBottom:6}}>ℹ️ 배포된 휴일에는:</div>
            <div>· 식사 제공만 있음</div>
            <div>· 드림센터·수업·투어셔틀·헬퍼 없음</div>
            <div>· 환불 없음</div>
            <div style={{marginTop:6,fontSize:11.5,fontWeight:500,color:"#a16207"}}>이 안내가 예약자 포털에 자동 표시됩니다.</div>
          </div>
        </div>
      ) : (
        <div style={{background:"#fff",borderRadius:14,padding:16,boxShadow:"0 2px 12px rgba(0,0,0,0.05)"}}>
          {/* 상단바 */}
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",gap:4,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:3}}>
              <button onClick={() => setMonth(m => monthShift(m, -1))} style={{padding:"7px 12px",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"transparent",color:"#475569"}}>◀</button>
              <button onClick={() => setMonth(curMonth(0))} style={{padding:"7px 14px",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"#1a6fc4",color:"#fff",minWidth:130,textAlign:"center"}}>{monthLabel(month)}</button>
              <button onClick={() => setMonth(m => monthShift(m, 1))} style={{padding:"7px 12px",border:"none",borderRadius:7,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"transparent",color:"#475569"}}>▶</button>
            </div>

            <button
              onClick={saveAfRows}
              disabled={!!afBusy}
              style={{padding:"9px 14px",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:afBusy?"not-allowed":"pointer",fontFamily:"inherit",background:"#1a6fc4",color:"#fff",opacity:afBusy?0.6:1}}
            >💾 {afBusy==="save" ? "저장중..." : "저장"}</button>

            <span
              style={{
                padding:"6px 12px",
                borderRadius:999,
                fontSize:12,
                fontWeight:700,
                background:afDeployed?"#dcfce7":"#f1f5f9",
                color:afDeployed?"#15803d":"#64748b",
              }}
            >{afDeployed ? "✅ 배포됨" : "⏸ 미배포"}</span>

            <div style={{flex:1}} />

            <button
              onClick={deployAfRows}
              disabled={!!afBusy || afItems.length === 0}
              style={{padding:"9px 16px",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:(afBusy||afItems.length===0)?"not-allowed":"pointer",fontFamily:"inherit",background:"#16a34a",color:"#fff",opacity:(afBusy||afItems.length===0)?0.6:1}}
            >🚀 {afBusy==="deploy" ? "배포중..." : "이번 달 배포"}</button>
          </div>

          {afLoading ? (
            <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>불러오는 중...</div>
          ) : (() => {
            const rows = getAfterFieldDates(month);
            if (rows.length === 0) {
              return <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>이 달엔 해당 날짜가 없습니다.</div>;
            }
            return (
              <div style={{overflow:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr style={{background:"#f8fafc"}}>
                      <th style={{padding:"11px 14px",textAlign:"left",fontWeight:700,color:"#475569",fontSize:12,borderBottom:"1px solid #e2e8f0",width:120}}>날짜</th>
                      <th style={{padding:"11px 14px",textAlign:"center",fontWeight:700,color:"#475569",fontSize:12,borderBottom:"1px solid #e2e8f0",width:60}}>요일</th>
                      <th style={{padding:"11px 14px",textAlign:"left",fontWeight:700,color:"#475569",fontSize:12,borderBottom:"1px solid #e2e8f0",width:130}}>유형</th>
                      <th style={{padding:"11px 14px",textAlign:"left",fontWeight:700,color:"#475569",fontSize:12,borderBottom:"1px solid #e2e8f0"}}>활동 선택</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const list = r.type === "afterschool" ? AS_LIST : FT_LIST;
                      const typeBg = r.type === "afterschool" ? "#dbeafe" : "#dcfce7";
                      const typeFg = r.type === "afterschool" ? "#1e40af" : "#15803d";
                      const typeLabel = r.type === "afterschool" ? "애프터스쿨" : "필드트립";
                      const selected = (afRows[r.date] || "").trim();
                      const rowBg = selected ? "#f0f9ff" : "#fff";
                      return (
                        <tr
                          key={r.date + "-" + r.type}
                          style={{background:rowBg,borderBottom:"1px solid #f1f5f9"}}
                          onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                        >
                          <td style={{padding:"10px 14px",fontWeight:600,color:"#1a1a2e",whiteSpace:"nowrap"}}>{r.date}</td>
                          <td style={{padding:"10px 14px",textAlign:"center",fontWeight:700,color:r.dow===0?"#dc2626":r.dow===6?"#1a6fc4":"#475569"}}>{DOW_KR[r.dow]}</td>
                          <td style={{padding:"10px 14px"}}>
                            <span style={{display:"inline-block",padding:"3px 10px",borderRadius:999,background:typeBg,color:typeFg,fontSize:11,fontWeight:700}}>{typeLabel}</span>
                          </td>
                          <td style={{padding:"10px 14px"}}>
                            <select
                              value={afRows[r.date] || ""}
                              onChange={e => setAfRows(prev => ({ ...prev, [r.date]: e.target.value }))}
                              style={{padding:"7px 11px",border:"1px solid #cbd5e1",borderRadius:7,fontSize:13,fontFamily:"inherit",background:"#fff",cursor:"pointer",fontWeight:600,minWidth:220,outline:"none"}}
                            >
                              <option value="">-- 선택 --</option>
                              {list.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

          <div style={{marginTop:10,fontSize:11,color:"#94a3b8"}}>
            애프터스쿨 = 매주 월/수 · 필드트립 = 매월 2째주·4째주 토요일
          </div>
        </div>
      )}
    </div>
  );
}
