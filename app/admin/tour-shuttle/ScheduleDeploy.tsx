"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { toastErr } from "@/lib/toast";
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

// ─────────────────────────────────────────────────────────────
// 투어 패턴 — ⚠️ 손님 신청 화면(app/portal/shuttle, app/shuttle)과 동일 규칙 유지 필수!
// 규칙: "그 달의 몇 번째 요일"(nthWeekday) 홀/짝 — 격주 기준주(BASE_A) 방식 아님
// ─────────────────────────────────────────────────────────────
function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
// 손님 화면과 동일: 그 달의 n번째 요일이 홀수/짝수인지로 판별
function nthWeekday(d: Date) { return Math.ceil(d.getDate() / 7); }
function tourSlotsFor(d: Date): { title: string; desc: string }[] {
  const dow = d.getDay();
  const odd = nthWeekday(d) % 2 === 1;
  if (dow === 2) return odd
    ? [{ title: "파롤라 (Parola)", desc: "04:40pm" }]
    : [{ title: "SM 씨사이드 쇼핑", desc: "10:30am" }];
  if (dow === 4) return odd
    ? [{ title: "SM 씨사이드 쇼핑", desc: "10:30am" }]
    : [{ title: "막탄 쉬라인", desc: "05:30pm" }];
  if (dow === 6) return odd
    ? [{ title: "세부 사파리", desc: "08:30am" }, { title: "일콜소 (Il Corso)", desc: "04:00pm" }]
    : [{ title: "펀파크 (Fun Park)", desc: "02:00pm" }, { title: "란타우 (Lantaw)", desc: "04:00pm" }];
  if (dow === 0) return odd
    ? [{ title: "안조 월드 (Anjo World)", desc: "01:00pm" }, { title: "란타우 (Lantaw)", desc: "04:00pm" }]
    : [{ title: "세부 사파리", desc: "08:30am" }, { title: "일콜소 (Il Corso)", desc: "04:00pm" }];
  return [];
}
const HMART_DOWS = [1, 3, 5]; // 월/수/금
const HMART_TITLE = "H-Mart 쇼핑";
const HMART_DESC = "10:00am";

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
    for (const p of tourSlotsFor(d)) {
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
// 메인 컴포넌트 (투어셔틀 배포 캘린더 전용)
// ─────────────────────────────────────────────────────────────
export default function ScheduleDeploy() {
  const [month, setMonth] = useState<string>(curMonth(0));
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"" | "generate" | "deploy">("");
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // 장소 직접 추가 모달 상태
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeForm, setPlaceForm] = useState({ date: "", title: "", desc: "", back: "" });
  const [placeSaving, setPlaceSaving] = useState(false);

  async function saveAddPlace() {
    if (!placeForm.date || !placeForm.title.trim()) { toastErr("날짜와 장소명은 필수입니다."); return; }
    setPlaceSaving(true);
    const dm = placeForm.date.slice(0, 7); // YYYY-MM
    const depart = placeForm.desc.trim();
    const back = placeForm.back.trim();
    // desc 컬럼에 출발/복귀를 함께 저장 (예: "출발 08:30am · 복귀 15:00")
    let description: string | null = null;
    if (depart && back) description = `출발 ${depart} · 복귀 ${back}`;
    else if (depart) description = depart;
    else if (back) description = `복귀 ${back}`;
    const { error } = await supabase.from("schedule_items").insert({
      type: "shuttle",
      date: placeForm.date,
      title: placeForm.title.trim(),
      description,
      is_deployed: true,
      deploy_month: dm,
    });
    setPlaceSaving(false);
    if (error) { toastErr("저장 실패: " + error.message); return; }
    setPlaceOpen(false);
    setPlaceForm({ date: "", title: "", desc: "", back: "" });
    if (dm !== month) setMonth(dm); // 다른 달이면 그 달로 이동 (load는 useEffect가 처리)
    else await load();
  }

  const load = useCallback(async () => {
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
  }, [month]);

  useEffect(() => { load(); }, [load]);

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
    if (gen.length === 0) { toastErr("생성할 항목이 없습니다."); return; }
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
      toastErr("기존 항목 삭제 실패: " + delErr.message);
      return;
    }
    const { error: insErr } = await supabase.from("schedule_items").insert(gen);
    setBusy("");
    if (insErr) { toastErr("생성 실패: " + insErr.message); return; }
    await load();
  }

  async function runDeploy() {
    if (busy) return;
    if (items.length === 0) { toastErr("배포할 항목이 없습니다. 먼저 자동 생성하세요."); return; }
    const ok = confirm(`${monthLabel(month)} 투어셔틀 ${items.length}건을 배포합니다. 포털에서 보이게 됩니다. 계속할까요?`);
    if (!ok) return;
    setBusy("deploy");
    const { error } = await supabase
      .from("schedule_items")
      .update({ is_deployed: true })
      .eq("deploy_month", month)
      .eq("type", "shuttle");
    setBusy("");
    if (error) { toastErr("배포 실패: " + error.message); return; }
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
    if (error) { toastErr("저장 실패: " + error.message); return; }
    closeEdit();
    await load();
  }
  async function deleteEdit() {
    if (!editing) return;
    if (!confirm("이 항목을 삭제할까요?")) return;
    setEditSaving(true);
    const { error } = await supabase.from("schedule_items").delete().eq("id", editing.id);
    setEditSaving(false);
    if (error) { toastErr("삭제 실패: " + error.message); return; }
    closeEdit();
    await load();
  }

  const cells = useMemo(() => calendarCells(month), [month]);
  const today = ymd(new Date());

  return (
    <div>
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

          <button
            onClick={() => { setPlaceForm({ date: "", title: "", desc: "", back: "" }); setPlaceOpen(true); }}
            style={{padding:"9px 14px",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:"#1a6fc4",color:"#fff"}}
          >+ 장소 직접 추가</button>

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

      {/* 장소 직접 추가 모달 */}
      {placeOpen && (
        <div
          onClick={() => setPlaceOpen(false)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{background:"#fff",borderRadius:14,width:"100%",maxWidth:420,padding:20,boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}
          >
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h3 style={{fontSize:15,fontWeight:800,margin:0}}>📍 장소 직접 추가</h3>
              <button onClick={() => setPlaceOpen(false)} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#6b7c93"}}>✕</button>
            </div>
            <label style={{display:"block",fontSize:11.5,fontWeight:700,color:"#475569",marginBottom:5}}>날짜 <span style={{color:"#dc2626"}}>*</span></label>
            <input
              type="date"
              value={placeForm.date}
              onChange={e => setPlaceForm(p => ({ ...p, date: e.target.value }))}
              style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"inherit",marginBottom:12,outline:"none"}}
            />
            <label style={{display:"block",fontSize:11.5,fontWeight:700,color:"#475569",marginBottom:5}}>장소명 <span style={{color:"#dc2626"}}>*</span></label>
            <input
              value={placeForm.title}
              onChange={e => setPlaceForm(p => ({ ...p, title: e.target.value }))}
              placeholder="예: 세부 사파리"
              style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"inherit",marginBottom:12,outline:"none"}}
            />
            <label style={{display:"block",fontSize:11.5,fontWeight:700,color:"#475569",marginBottom:5}}>출발시간 / 설명</label>
            <input
              value={placeForm.desc}
              onChange={e => setPlaceForm(p => ({ ...p, desc: e.target.value }))}
              placeholder="예: 08:30am"
              style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"inherit",marginBottom:12,outline:"none"}}
            />
            <label style={{display:"block",fontSize:11.5,fontWeight:700,color:"#475569",marginBottom:5}}>돌아오는 시간 / 복귀</label>
            <input
              value={placeForm.back}
              onChange={e => setPlaceForm(p => ({ ...p, back: e.target.value }))}
              placeholder='예: "15:00" 또는 "2시간 30분 후"'
              style={{width:"100%",padding:"9px 11px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"inherit",marginBottom:16,outline:"none"}}
            />
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button
                onClick={() => setPlaceOpen(false)}
                disabled={placeSaving}
                style={{padding:"9px 14px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontWeight:700,cursor:placeSaving?"not-allowed":"pointer",fontFamily:"inherit",background:"#fff",color:"#475569"}}
              >취소</button>
              <button
                onClick={saveAddPlace}
                disabled={placeSaving || !placeForm.date || !placeForm.title.trim()}
                style={{padding:"9px 18px",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:(placeSaving||!placeForm.date||!placeForm.title.trim())?"not-allowed":"pointer",fontFamily:"inherit",background:"#1a6fc4",color:"#fff",opacity:(placeSaving||!placeForm.date||!placeForm.title.trim())?0.6:1}}
              >{placeSaving ? "저장중..." : "💾 저장"}</button>
            </div>
            <div style={{marginTop:12,fontSize:11,color:"#94a3b8",lineHeight:1.5}}>
              추가된 장소는 즉시 <b>배포됨</b> 상태로 셔틀 캘린더에 표시됩니다.
            </div>
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
