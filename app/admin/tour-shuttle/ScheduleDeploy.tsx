"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
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
  { key: "shuttle",    label: "🚌 투어셔틀" },
  { key: "afterschool", label: "🎨 애프터스쿨·필드트립" },
  { key: "holiday",    label: "🏖️ 휴일" },
] as const;
type SubTab = (typeof SUB_TABS)[number]["key"];

// ─────────────────────────────────────────────────────────────
// A/B 주차 패턴
// ─────────────────────────────────────────────────────────────
const BASE_A = new Date("2026-05-04T00:00:00"); // A주 기준 월요일

function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function mondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}
function getPattern(date: Date): "A" | "B" {
  const mon = mondayOf(date);
  const weeks = Math.floor((mon.getTime() - BASE_A.getTime()) / (7 * 86400000));
  const mod = ((weeks % 2) + 2) % 2;
  return mod === 0 ? "A" : "B";
}

const PATTERN_A: { dow: number; title: string; desc: string }[] = [
  { dow: 2, title: "파롤라 (Parola)",  desc: "04:40pm" },
  { dow: 4, title: "SM 씨사이드 쇼핑", desc: "10:30am" },
  { dow: 6, title: "펀파크 (Fun Park)", desc: "02:00pm" },
  { dow: 6, title: "란타우 (Lantaw)",   desc: "04:00pm" },
  { dow: 0, title: "세부 사파리",       desc: "08:30am" },
  { dow: 0, title: "일콜소 (Il Corso)", desc: "04:00pm" },
];
const PATTERN_B: { dow: number; title: string; desc: string }[] = [
  { dow: 2, title: "SM 씨사이드 쇼핑", desc: "10:30am" },
  { dow: 4, title: "막탄 쉬라인",       desc: "05:30pm" },
  { dow: 6, title: "세부 사파리",       desc: "08:30am" },
  { dow: 6, title: "일콜소 (Il Corso)", desc: "04:00pm" },
  { dow: 0, title: "안조 월드 (Anjo World)", desc: "01:00pm" },
  { dow: 0, title: "란타우 (Lantaw)",   desc: "04:00pm" },
];
const HMART_DOWS = [1, 3, 5]; // 월/수/금
const HMART_TITLE = "H-Mart 쇼핑";
const HMART_DESC = "10:00am";

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

function generateItems(month: string): Omit<ScheduleItem, "id" | "created_at">[] {
  const [yStr, mStr] = month.split("-");
  const year = Number(yStr);
  const monthIdx = Number(mStr) - 1;
  const out: Omit<ScheduleItem, "id" | "created_at">[] = [];
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, monthIdx, day);
    const dow = d.getDay();
    const ds = ymd(d);
    if (HMART_DOWS.includes(dow)) {
      out.push({
        type: "shuttle",
        date: ds,
        title: HMART_TITLE,
        description: HMART_DESC,
        is_deployed: false,
        deploy_month: month,
      });
    }
    const pattern = getPattern(d) === "A" ? PATTERN_A : PATTERN_B;
    for (const p of pattern) {
      if (p.dow === dow) {
        out.push({
          type: "shuttle",
          date: ds,
          title: p.title,
          description: p.desc,
          is_deployed: false,
          deploy_month: month,
        });
      }
    }
  }
  return out;
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
function calendarCells(month: string): { date: string; inMonth: boolean }[] {
  const [y, mm] = month.split("-").map(Number);
  const first = new Date(y, mm - 1, 1);
  const startDow = first.getDay(); // 0=Sun
  const start = new Date(first);
  start.setDate(first.getDate() - startDow);
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: ymd(d), inMonth: d.getMonth() === mm - 1 });
  }
  return cells;
}

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────
export default function ScheduleDeploy() {
  const [subTab, setSubTab] = useState<SubTab>("shuttle");
  const [month, setMonth] = useState<string>(curMonth(0));
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"" | "generate" | "deploy">("");
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // 애프터스쿨·필드트립 상태
  const [afRows, setAfRows] = useState<Record<string, string>>({});
  const [afItems, setAfItems] = useState<ScheduleItem[]>([]);
  const [afDeployed, setAfDeployed] = useState(false);
  const [afLoading, setAfLoading] = useState(false);
  const [afBusy, setAfBusy] = useState<"" | "save" | "deploy">("");

  const load = useCallback(async () => {
    if (subTab !== "shuttle") return;
    setLoading(true);
    const { data, error } = await supabase
      .from("schedule_items")
      .select("*")
      .eq("deploy_month", month)
      .eq("type", "shuttle")
      .order("date", { ascending: true });
    if (error) {
      console.error("[schedule_items] load 실패:", error);
      setItems([]);
    } else {
      setItems((data || []) as ScheduleItem[]);
    }
    setLoading(false);
  }, [month, subTab]);

  useEffect(() => { load(); }, [load]);

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

  const itemsByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of items) {
      const arr = map.get(it.date) || [];
      arr.push(it);
      map.set(it.date, arr);
    }
    return map;
  }, [items]);

  const isDeployed = useMemo(() => items.some(i => i.is_deployed), [items]);

  async function runGenerate() {
    if (busy) return;
    const gen = generateItems(month);
    if (gen.length === 0) { alert("생성할 항목이 없습니다."); return; }
    const ok = confirm(`${monthLabel(month)} 투어셔틀 ${gen.length}건을 자동 생성합니다.\n해당 월의 기존 셔틀 항목은 모두 삭제됩니다. 계속할까요?`);
    if (!ok) return;
    setBusy("generate");
    const { error: delErr } = await supabase
      .from("schedule_items")
      .delete()
      .eq("deploy_month", month)
      .eq("type", "shuttle");
    if (delErr) {
      setBusy("");
      alert("기존 항목 삭제 실패: " + delErr.message);
      return;
    }
    const { error: insErr } = await supabase.from("schedule_items").insert(gen);
    setBusy("");
    if (insErr) { alert("생성 실패: " + insErr.message); return; }
    await load();
  }

  async function runDeploy() {
    if (busy) return;
    if (items.length === 0) { alert("배포할 항목이 없습니다. 먼저 자동 생성하세요."); return; }
    const ok = confirm(`${monthLabel(month)} 투어셔틀 ${items.length}건을 배포합니다. 포털에서 보이게 됩니다. 계속할까요?`);
    if (!ok) return;
    setBusy("deploy");
    const { error } = await supabase
      .from("schedule_items")
      .update({ is_deployed: true })
      .eq("deploy_month", month)
      .eq("type", "shuttle");
    setBusy("");
    if (error) { alert("배포 실패: " + error.message); return; }
    await load();
  }

  function openEdit(it: ScheduleItem) {
    setEditing(it);
    setEditTitle(it.title);
    setEditDesc(it.description || "");
  }
  function closeEdit() {
    setEditing(null); setEditTitle(""); setEditDesc("");
  }
  async function saveEdit() {
    if (!editing) return;
    setEditSaving(true);
    const { error } = await supabase
      .from("schedule_items")
      .update({ title: editTitle.trim(), description: editDesc.trim() || null })
      .eq("id", editing.id);
    setEditSaving(false);
    if (error) { alert("저장 실패: " + error.message); return; }
    closeEdit();
    await load();
  }
  async function deleteEdit() {
    if (!editing) return;
    if (!confirm("이 항목을 삭제할까요?")) return;
    setEditSaving(true);
    const { error } = await supabase.from("schedule_items").delete().eq("id", editing.id);
    setEditSaving(false);
    if (error) { alert("삭제 실패: " + error.message); return; }
    closeEdit();
    await load();
  }

  const cells = useMemo(() => calendarCells(month), [month]);
  const today = ymd(new Date());

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
        <div style={{background:"#fff",borderRadius:14,padding:60,textAlign:"center",color:"#94a3b8",fontSize:14,boxShadow:"0 2px 12px rgba(0,0,0,0.05)"}}>
          준비중
        </div>
      ) : subTab === "afterschool" ? (
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
              onClick={runGenerate}
              disabled={!!busy}
              style={{padding:"9px 14px",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:busy?"not-allowed":"pointer",fontFamily:"inherit",background:"#f59e0b",color:"#fff",opacity:busy?0.6:1}}
            >⚡ {busy==="generate" ? "생성중..." : "자동생성"}</button>

            <span
              style={{
                padding:"6px 12px",
                borderRadius:999,
                fontSize:12,
                fontWeight:700,
                background:isDeployed?"#dcfce7":"#f1f5f9",
                color:isDeployed?"#15803d":"#64748b",
              }}
            >{isDeployed ? "✅ 배포됨" : "⏸ 미배포"}</span>

            <div style={{flex:1}} />

            <button
              onClick={runDeploy}
              disabled={!!busy || items.length === 0}
              style={{padding:"9px 16px",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:(busy||items.length===0)?"not-allowed":"pointer",fontFamily:"inherit",background:"#16a34a",color:"#fff",opacity:(busy||items.length===0)?0.6:1}}
            >🚀 {busy==="deploy" ? "배포중..." : "이번 달 배포"}</button>
          </div>

          {/* 요일 헤더 */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:6}}>
            {["일","월","화","수","목","금","토"].map((d, i) => (
              <div key={d} style={{textAlign:"center",fontSize:11.5,fontWeight:800,padding:"6px 0",color:i===0?"#dc2626":i===6?"#1a6fc4":"#475569"}}>{d}</div>
            ))}
          </div>

          {/* 달력 */}
          {loading ? (
            <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>불러오는 중...</div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
              {cells.map((c, i) => {
                const dt = new Date(c.date + "T00:00:00");
                const dayNum = dt.getDate();
                const isToday = c.date === today;
                const dow = dt.getDay();
                const dayItems = itemsByDate.get(c.date) || [];
                return (
                  <div
                    key={i}
                    style={{
                      minHeight:96,
                      background:c.inMonth?"#fff":"#f8fafc",
                      border:"1px solid #e2e8f0",
                      borderRadius:8,
                      padding:6,
                      opacity:c.inMonth?1:0.55,
                      display:"flex",
                      flexDirection:"column",
                      gap:3,
                    }}
                  >
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span style={{
                        fontSize:11.5,fontWeight:800,
                        color:dow===0?"#dc2626":dow===6?"#1a6fc4":"#1a1a2e",
                      }}>{dayNum}</span>
                      {isToday && <span style={{fontSize:9,fontWeight:800,background:"#1a6fc4",color:"#fff",padding:"1px 5px",borderRadius:4}}>TODAY</span>}
                    </div>
                    {dayItems.map(it => {
                      const bg = it.is_deployed ? "#dcfce7" : "#dbeafe";
                      const fg = it.is_deployed ? "#15803d" : "#1e40af";
                      const time = (it.description || "").split("-")[0].trim();
                      const shortTitle = it.title.length > 9 ? it.title.slice(0, 9) + "…" : it.title;
                      return (
                        <button
                          key={it.id}
                          onClick={() => openEdit(it)}
                          title={`${it.description || ""} ${it.title}`}
                          style={{
                            background:bg,color:fg,border:"none",borderRadius:5,
                            padding:"3px 5px",fontSize:10.5,fontWeight:700,textAlign:"left",
                            cursor:"pointer",fontFamily:"inherit",lineHeight:1.25,
                            whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
                          }}
                        >
                          {time ? `${time} ` : ""}{shortTitle}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          <div style={{marginTop:10,fontSize:11,color:"#94a3b8"}}>
            총 {items.length}건 · A/B주 패턴은 2026-05-04(월) 기준 · 매주 월/수/금 H-Mart 자동 포함
          </div>
        </div>
      )}

      {/* 편집 모달 */}
      {editing && (
        <div
          onClick={closeEdit}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{background:"#fff",borderRadius:14,width:"100%",maxWidth:420,padding:20,boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}
          >
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h3 style={{fontSize:15,fontWeight:800,margin:0}}>✏️ 항목 편집</h3>
              <button onClick={closeEdit} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#6b7c93"}}>✕</button>
            </div>
            <div style={{fontSize:11.5,color:"#6b7c93",marginBottom:10}}>
              날짜: <b style={{color:"#1a1a2e"}}>{editing.date}</b>
            </div>
            <label style={{display:"block",fontSize:11.5,fontWeight:700,color:"#475569",marginBottom:5}}>제목</label>
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"inherit",marginBottom:12,outline:"none"}}
            />
            <label style={{display:"block",fontSize:11.5,fontWeight:700,color:"#475569",marginBottom:5}}>시간 (description, 예: 10:00am)</label>
            <input
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder="10:00am 또는 10:00am - 추가 설명"
              style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"inherit",marginBottom:16,outline:"none"}}
            />
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button
                onClick={deleteEdit}
                disabled={editSaving}
                style={{padding:"9px 14px",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:editSaving?"not-allowed":"pointer",fontFamily:"inherit",background:"#fef2f2",color:"#dc2626"}}
              >삭제</button>
              <button
                onClick={closeEdit}
                disabled={editSaving}
                style={{padding:"9px 14px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontWeight:700,cursor:editSaving?"not-allowed":"pointer",fontFamily:"inherit",background:"#fff",color:"#475569"}}
              >닫기</button>
              <button
                onClick={saveEdit}
                disabled={editSaving || !editTitle.trim()}
                style={{padding:"9px 16px",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:(editSaving||!editTitle.trim())?"not-allowed":"pointer",fontFamily:"inherit",background:"#1a6fc4",color:"#fff",opacity:(editSaving||!editTitle.trim())?0.6:1}}
              >{editSaving ? "저장중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
