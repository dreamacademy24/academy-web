"use client";
import { useState, useEffect } from "react";
import { toastOk, toastErr } from "@/lib/toast";
import FieldtripWorkspace from "./FieldtripWorkspace";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SUB_TABS = [
  { key: "afterschool", label: "🎨 애프터스쿨·필드트립" },
  { key: "holiday",     label: "🏖️ 휴일" },
] as const;
type SubTab = (typeof SUB_TABS)[number]["key"];

export default function AfterFieldDeploy() {
  const [subTab, setSubTab] = useState<SubTab>("afterschool");

  // 휴일 탭 상태
  type Holiday = { id?: string; date: string; name: string; year: number; is_deployed: boolean };
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHoliDate, setNewHoliDate] = useState("");
  const [newHoliName, setNewHoliName] = useState("");
  const [holiYear, setHoliYear] = useState<number>(new Date().getFullYear());
  const [holiLoading, setHoliLoading] = useState(false);
  const [holiBusy, setHoliBusy] = useState<"" | "add" | "deploy" | "delete">("");

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
    if (!d || !n) { toastErr("날짜와 휴일명을 모두 입력해주세요."); return; }
    const year = Number(d.slice(0, 4));
    if (!year) { toastErr("날짜 형식이 올바르지 않습니다."); return; }
    if (holidays.some(h => h.date === d)) { toastErr("이미 등록된 날짜입니다."); return; }
    setHoliBusy("add");
    const { data, error } = await supabase
      .from("holidays")
      .insert({ date: d, name: n, year, is_deployed: false })
      .select().single();
    setHoliBusy("");
    if (error) { toastErr("추가 실패: " + error.message); return; }
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
    if (error) { toastErr("삭제 실패: " + error.message); return; }
    setHolidays(prev => prev.filter(h => h.id !== id));
  }

  async function deployHolidays() {
    if (holidays.length === 0) { toastErr("배포할 휴일이 없습니다."); return; }
    if (!confirm(`${holiYear}년 휴일 ${holidays.length}건을 전체 배포합니다. 계속할까요?`)) return;
    setHoliBusy("deploy");
    const { error } = await supabase
      .from("holidays")
      .update({ is_deployed: true })
      .eq("year", holiYear);
    setHoliBusy("");
    if (error) { toastErr("배포 실패: " + error.message); return; }
    setHolidays(prev => prev.map(h => ({ ...h, is_deployed: true })));
    toastOk(`${holiYear}년 휴일 전체 배포 완료!`);
  }

  return (
    <div>
      {/* 서브탭 */}
      <div style={{display:"flex",gap:6,background:"#fff",padding:4,borderRadius:10,marginBottom:14,boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}>
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { if (!(window as unknown as {fieldtripUnsaved?:boolean}).fieldtripUnsaved || confirm("저장하지 않은 내용을 버리고 이동할까요?")) setSubTab(t.key); }}
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
      ) : <FieldtripWorkspace />}
    </div>
  );
}
