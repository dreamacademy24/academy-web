"use client";

/* 모리칸 — 주간 식단 조합 생성기
   과거 제공 이력(mori_servings) 기반으로 최근 3주 중복을 피해 아침·저녁 조합을 자동 생성.
   점심·간식은 픽스 세트(mori_fixed_sets)를 오래 안 쓴 순서로 자동 배치. */

import React, { useEffect, useMemo, useState } from "react";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import {
  Item, FixedSet, Serving, WeekPlan, DayPlan, MEALS, DUP_WINDOW,
  addD, diffDays, mondayOf, dowOf, nk, genWeek, genBreakfast, genDinner, planOccurrences,
} from "./gen";

const ROUND_EPOCH = "2026-05-04"; // 1회차 시작 월요일
const fD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nextMonday = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return fD(d); };

const ROLE_LABEL: Record<string, string> = {
  base: "주식(밥)", soup: "국·찌개", main: "메인", side: "반찬", salad: "샐러드",
  fruit: "과일", dairy: "유제품·음료", breakfast_main: "아침주식", staple: "기본찬",
};
const PROTEINS = ["닭", "돼지", "소", "생선해물", "계란", "두부"];

type Picker = { date: string; meal: string; index: number | null } | null; // index null = 추가

export default function MoriPage() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"plan" | "items">("plan");
  const [items, setItems] = useState<Item[]>([]);
  const [sets, setSets] = useState<FixedSet[]>([]);
  const [servings, setServings] = useState<Serving[]>([]);
  const [weekStart, setWeekStart] = useState(nextMonday());
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [status, setStatus] = useState<"none" | "draft" | "confirmed">("none");
  const [weekId, setWeekId] = useState<string | null>(null);
  const [allWeeks, setAllWeeks] = useState<{ week_start: string; plan: WeekPlan }[]>([]);
  const [picker, setPicker] = useState<Picker>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [itemFilter, setItemFilter] = useState({ q: "", role: "" });
  const [newItem, setNewItem] = useState({ name: "", role: "side", protein: "", meals: ["저녁"] as string[] });

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  useEffect(() => { if (authed) loadBase(); }, [authed]);
  useEffect(() => { if (authed) loadWeek(weekStart); }, [authed, weekStart]);

  async function loadBase() {
    const [it, fs, sv, wk] = await Promise.all([
      supabase.from("mori_items").select("*").order("name"),
      supabase.from("mori_fixed_sets").select("*").order("set_no"),
      supabase.from("mori_servings").select("serve_date, meal, item_name").order("serve_date", { ascending: false }).limit(3000),
      supabase.from("mori_weeks").select("week_start, plan"),
    ]);
    setItems((it.data || []) as Item[]);
    setSets((fs.data || []).map((s: any) => ({ ...s, lunch: Array.isArray(s.lunch) ? s.lunch : JSON.parse(s.lunch) })));
    setServings((sv.data || []) as Serving[]);
    setAllWeeks((wk.data || []) as any);
  }

  async function loadWeek(ws: string) {
    const { data } = await supabase.from("mori_weeks").select("*").eq("week_start", ws).maybeSingle();
    if (data) { setPlan(data.plan as WeekPlan); setStatus(data.status); setWeekId(data.id); }
    else { setPlan(null); setStatus("none"); setWeekId(null); }
  }

  const roundNo = useMemo(() => Math.floor(diffDays(ROUND_EPOCH, weekStart) / 7) + 1, [weekStart]);
  const dates = useMemo(() => [0, 1, 2, 3, 4].map(d => addD(weekStart, d)), [weekStart]);

  /* 아이템별 제공일 목록 (내림차순) — "n일 전" 계산용 */
  const servedDates = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of servings) {
      const k = nk(s.item_name);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s.serve_date);
    }
    m.forEach(v => v.sort().reverse());
    return m;
  }, [servings]);

  const agoFor = (name: string, onDate: string): number | null => {
    const arr = servedDates.get(nk(name));
    if (!arr) return null;
    const d = arr.find(x => x < onDate);
    return d ? diffDays(d, onDate) : null;
  };

  /* 픽스 세트 마지막 사용일 추정: 세트의 비(非)기본찬 점심 2개 이상이 같은 날 점심에 나왔으면 사용으로 간주 */
  const setLastUsed = useMemo(() => {
    const lunchByDate = new Map<string, Set<string>>();
    for (const s of servings) {
      if (s.meal !== "점심") continue;
      if (!lunchByDate.has(s.serve_date)) lunchByDate.set(s.serve_date, new Set());
      lunchByDate.get(s.serve_date)!.add(nk(s.item_name));
    }
    const m = new Map<number, string>();
    for (const fs of sets) {
      const key = fs.lunch.map(nk);
      lunchByDate.forEach((names, date) => {
        const hit = key.filter(k => names.has(k)).length;
        if (hit >= 2 && (!m.has(fs.set_no) || m.get(fs.set_no)! < date)) m.set(fs.set_no, date);
      });
    }
    for (const w of allWeeks) {
      for (const [date, day] of Object.entries(w.plan || {})) {
        const sn = (day as DayPlan).fixedSet;
        if (sn && (!m.has(sn) || m.get(sn)! < date)) m.set(sn, date);
      }
    }
    return m;
  }, [servings, sets, allWeeks]);

  const occ = useMemo(() => (plan ? planOccurrences(plan) : new Map()), [plan]);

  /* ───────── 액션 ───────── */
  function generate() {
    const p = genWeek(weekStart, items, servings, sets, setLastUsed);
    setPlan(p);
  }

  function regenCell(date: string, meal: "아침" | "저녁") {
    if (!plan) return;
    const used = new Set<string>();
    const usedProteinByDate = new Map<string, Set<string>>();
    for (const [d, day] of Object.entries(plan)) {
      for (const m of MEALS) {
        if (d === date && m === meal) continue;
        for (const it of day[m] || []) {
          used.add(nk(it));
          const f = items.find(i => nk(i.name) === nk(it));
          if (f?.protein) {
            if (!usedProteinByDate.has(d)) usedProteinByDate.set(d, new Set());
            usedProteinByDate.get(d)!.add(f.protein);
          }
        }
      }
    }
    const last = new Map<string, string>();
    for (const s of servings) if (s.serve_date < weekStart) { const k = nk(s.item_name); if (!last.has(k) || last.get(k)! < s.serve_date) last.set(k, s.serve_date); }
    const ctx = { items, last, used, usedProteinByDate };
    const lunchProteins = new Set<string>();
    for (const it of plan[date].점심) { const f = items.find(i => nk(i.name) === nk(it)); if (f?.protein) lunchProteins.add(f.protein); }
    const next = { ...plan, [date]: { ...plan[date], [meal]: meal === "아침" ? genBreakfast(ctx as any, date) : genDinner(ctx as any, date, lunchProteins) } };
    setPlan(next);
  }

  function setFixedSet(date: string, setNo: number) {
    if (!plan) return;
    const fs = sets.find(s => s.set_no === setNo);
    if (!fs) return;
    setPlan({ ...plan, [date]: { ...plan[date], 점심: [...fs.lunch, "김치"], 간식: fs.snack ? [fs.snack] : [], fixedSet: setNo } });
  }

  function removeItem(date: string, meal: string, idx: number) {
    if (!plan) return;
    const arr = [...(plan[date] as any)[meal]]; arr.splice(idx, 1);
    setPlan({ ...plan, [date]: { ...plan[date], [meal]: arr } });
  }

  function applyPick(name: string) {
    if (!plan || !picker) return;
    const { date, meal, index } = picker;
    const arr = [...(plan[date] as any)[meal]];
    if (index === null) arr.push(name); else arr[index] = name;
    setPlan({ ...plan, [date]: { ...plan[date], [meal]: arr } });
    setPicker(null); setSearch("");
  }

  async function save(newStatus?: "draft" | "confirmed") {
    if (!plan) return;
    setBusy("저장 중…");
    const st = newStatus || (status === "confirmed" ? "confirmed" : "draft");
    const row = { week_start: weekStart, round_no: roundNo, plan, status: st, updated_at: new Date().toISOString() };
    const { data, error } = weekId
      ? await supabase.from("mori_weeks").update(row).eq("id", weekId).select("id").single()
      : await supabase.from("mori_weeks").insert(row).select("id").single();
    if (error) { alert("저장 실패: " + error.message); setBusy(""); return; }
    setWeekId(data.id); setStatus(st);

    if (st === "confirmed") {
      await supabase.from("mori_servings").delete().eq("source", "plan").gte("serve_date", weekStart).lte("serve_date", addD(weekStart, 4));
      const rows: any[] = [];
      for (const [date, day] of Object.entries(plan)) {
        for (const meal of MEALS) {
          const seen = new Set<string>();
          for (const it of day[meal] || []) {
            if (seen.has(nk(it))) continue; seen.add(nk(it));
            rows.push({ serve_date: date, meal, item_name: it, source: "plan" });
          }
        }
      }
      const { error: e2 } = await supabase.from("mori_servings").insert(rows);
      if (e2) alert("이력 반영 실패: " + e2.message);
      await loadBase();
    }
    setBusy("");
  }

  function exportXlsx() {
    if (!plan) return;
    const header = ["날짜", "아침", "점심 (픽스)", "간식", "저녁"];
    const rows = dates.map(d => {
      const day = plan[d];
      return [
        `${d.slice(5).replace("-", "/")} (${dowOf(d)})`,
        (day?.아침 || []).join("\n"),
        (day?.점심 || []).join("\n"),
        (day?.간식 || []).join("\n"),
        (day?.저녁 || []).join("\n"),
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([[`${roundNo}회 식단표 (${weekStart} ~ ${addD(weekStart, 4)})`], header, ...rows]);
    ws["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 28 }, { wch: 18 }, { wch: 28 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${roundNo}회`);
    XLSX.writeFile(wb, `${roundNo}회 식단표_${weekStart}.xlsx`);
  }

  /* ───────── 아이템 풀 관리 ───────── */
  async function updateItem(id: string, patch: Partial<Item>) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
    await supabase.from("mori_items").update(patch).eq("id", id);
  }
  async function addNewItem() {
    if (!newItem.name.trim()) return;
    const row = { name: newItem.name.trim(), role: newItem.role, protein: newItem.protein || null, meals: newItem.meals, is_staple: newItem.role === "staple" };
    const { data, error } = await supabase.from("mori_items").insert(row).select("*").single();
    if (error) { alert(error.message); return; }
    setItems(prev => [...prev, data as Item].sort((a, b) => a.name.localeCompare(b.name)));
    setNewItem({ name: "", role: "side", protein: "", meals: ["저녁"] });
  }

  if (!authed) return null;

  /* ───────── 스타일 ───────── */
  const btn = (bg: string): React.CSSProperties => ({ background: bg, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" });
  const chipWarnStyle = (warn: number | null, dupInWeek: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 4, margin: "2px 4px 2px 0", padding: "3px 8px",
    borderRadius: 12, fontSize: 12.5, cursor: "pointer", border: "1px solid",
    background: dupInWeek ? "#ffe3e3" : warn !== null && warn <= DUP_WINDOW ? "#fff3d6" : "#f1f3fa",
    borderColor: dupInWeek ? "#e88" : warn !== null && warn <= DUP_WINDOW ? "#e6b84c" : "#d5d9ee",
    color: "#333",
  });

  const pickerCandidates = () => {
    if (!picker) return [];
    const cur = picker.index !== null && plan ? (plan[picker.date] as any)[picker.meal][picker.index] : null;
    const curItem = cur ? items.find(i => nk(i.name) === nk(cur)) : null;
    return items
      .filter(i => i.active)
      .filter(i => !search ? (curItem ? i.role === curItem.role : i.meals.includes(picker.meal)) : i.name.includes(search))
      .map(i => ({ i, ago: agoFor(i.name, picker.date) }))
      .sort((a, b) => (b.ago ?? 9999) - (a.ago ?? 9999))
      .slice(0, 60);
  };

  return (
    <div style={{ padding: 20, fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", maxWidth: 1300 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🍱 모리칸 — 식단 조합</h1>
        <div style={{ display: "flex", gap: 6 }}>
          {(["plan", "items"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...btn(tab === t ? "#3a47a8" : "#aab"), padding: "6px 12px" }}>
              {t === "plan" ? "주간 조합" : `메뉴 풀 (${items.length})`}
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#667", marginBottom: 14 }}>
        최근 {DUP_WINDOW}일 내 나온 메뉴는 피해서 자동 조합해요. 노란 칩 = 최근 {DUP_WINDOW}일 내 제공, 빨간 칩 = 이번 주 안에서 중복. 칩을 누르면 교체할 수 있어요.
      </div>

      {tab === "plan" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <button onClick={() => setWeekStart(addD(weekStart, -7))} style={btn("#8892c8")}>◀ 전주</button>
            <input type="date" value={weekStart} onChange={e => setWeekStart(mondayOf(e.target.value))} style={{ padding: "7px 10px", border: "1px solid #ccd", borderRadius: 8, fontSize: 14 }} />
            <button onClick={() => setWeekStart(addD(weekStart, 7))} style={btn("#8892c8")}>다음주 ▶</button>
            <span style={{ fontWeight: 800, fontSize: 16 }}>{roundNo}회차</span>
            <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 10, background: status === "confirmed" ? "#d9f2dd" : status === "draft" ? "#fff3d6" : "#eee", color: "#333" }}>
              {status === "confirmed" ? "✅ 확정됨" : status === "draft" ? "📝 임시저장" : "미작성"}
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={generate} style={btn("#3a47a8")}>⚡ 자동 생성</button>
            {plan && <button onClick={() => save()} style={btn("#5a67c8")}>{busy || "저장"}</button>}
            {plan && status !== "confirmed" && <button onClick={() => { if (confirm("확정하면 제공 이력에 반영되어 이후 주차 중복 검사에 사용돼요. 확정할까요?")) save("confirmed"); }} style={btn("#2e9e52")}>확정</button>}
            {plan && <button onClick={exportXlsx} style={btn("#1d6f42")}>📥 엑셀</button>}
          </div>

          {!plan && (
            <div style={{ padding: 60, textAlign: "center", color: "#889", border: "2px dashed #ccd", borderRadius: 14, fontSize: 15 }}>
              아직 이 주차 식단이 없어요. <b>⚡ 자동 생성</b>을 누르면 과거 이력을 피해 초안을 만들어줘요.
            </div>
          )}

          {plan && (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 90, background: "#3a47a8", color: "#fff", padding: 8, fontSize: 14 }}>날짜</th>
                  {["아침", "점심", "간식", "저녁"].map(m => (
                    <th key={m} style={{ background: "#3a47a8", color: "#fff", padding: 8, fontSize: 14 }}>{m}{m === "점심" && " (픽스)"}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map(d => {
                  const day = plan[d] || { 아침: [], 점심: [], 간식: [], 저녁: [], fixedSet: null };
                  return (
                    <tr key={d}>
                      <td style={{ border: "1px solid #dde", padding: 8, textAlign: "center", fontWeight: 800, fontSize: 14, background: "#f7f8fd" }}>
                        {d.slice(5).replace("-", "/")}<br /><span style={{ fontSize: 12, color: "#667" }}>({dowOf(d)})</span>
                      </td>
                      {MEALS.map(meal => (
                        <td key={meal} style={{ border: "1px solid #dde", padding: 8, verticalAlign: "top", minWidth: 180 }}>
                          {meal === "점심" && (
                            <select value={day.fixedSet ?? ""} onChange={e => setFixedSet(d, +e.target.value)}
                              style={{ width: "100%", marginBottom: 6, padding: "4px 6px", fontSize: 12.5, border: "1px solid #ccd", borderRadius: 6 }}>
                              <option value="">픽스 세트 선택…</option>
                              {sets.map(s => {
                                const lu = setLastUsed.get(s.set_no);
                                return <option key={s.set_no} value={s.set_no}>{s.set_no}회 — {s.lunch[1] || s.lunch[0]}{lu ? ` (${lu.slice(5)})` : " (미사용)"}</option>;
                              })}
                            </select>
                          )}
                          {((day as any)[meal] || []).map((it: string, idx: number) => {
                            const ago = agoFor(it, d);
                            const item = items.find(x => nk(x.name) === nk(it));
                            const isStaple = item?.is_staple;
                            const dupInWeek = !isStaple && (occ.get(nk(it)) || []).length > 1;
                            const warn = isStaple ? null : ago;
                            return (
                              <span key={idx} style={chipWarnStyle(warn, dupInWeek)} title={ago !== null ? `마지막 제공: ${ago}일 전` : "제공 이력 없음"}
                                onClick={() => { setPicker({ date: d, meal, index: idx }); setSearch(""); }}>
                                {it}
                                {warn !== null && warn <= DUP_WINDOW && <b style={{ color: "#b8860b", fontSize: 11 }}>{warn}d</b>}
                                {dupInWeek && <b style={{ color: "#c33", fontSize: 11 }}>중복</b>}
                                <span onClick={e => { e.stopPropagation(); removeItem(d, meal, idx); }} style={{ color: "#99a", fontWeight: 700 }}>×</span>
                              </span>
                            );
                          })}
                          <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                            <button onClick={() => { setPicker({ date: d, meal, index: null }); setSearch(""); }}
                              style={{ background: "none", border: "1px dashed #aab", borderRadius: 8, padding: "2px 8px", fontSize: 12, cursor: "pointer", color: "#667" }}>+ 추가</button>
                            {(meal === "아침" || meal === "저녁") && (
                              <button onClick={() => regenCell(d, meal)} title="이 끼니만 다시 추천"
                                style={{ background: "none", border: "1px solid #aab", borderRadius: 8, padding: "2px 8px", fontSize: 12, cursor: "pointer", color: "#667" }}>🔄</button>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      )}

      {tab === "items" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="검색" value={itemFilter.q} onChange={e => setItemFilter(f => ({ ...f, q: e.target.value }))} style={{ padding: "7px 10px", border: "1px solid #ccd", borderRadius: 8, fontSize: 14 }} />
            <select value={itemFilter.role} onChange={e => setItemFilter(f => ({ ...f, role: e.target.value }))} style={{ padding: "7px 10px", border: "1px solid #ccd", borderRadius: 8, fontSize: 14 }}>
              <option value="">전체 분류</option>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div style={{ flex: 1 }} />
            <input placeholder="새 메뉴 이름" value={newItem.name} onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))} style={{ padding: "7px 10px", border: "1px solid #ccd", borderRadius: 8, fontSize: 14 }} />
            <select value={newItem.role} onChange={e => setNewItem(n => ({ ...n, role: e.target.value }))} style={{ padding: "7px 8px", border: "1px solid #ccd", borderRadius: 8, fontSize: 13 }}>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={addNewItem} style={btn("#3a47a8")}>+ 추가</button>
          </div>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5 }}>
            <thead>
              <tr>{["메뉴", "분류", "단백질", "끼니", "기본찬", "사용", "마지막 제공"].map(h => <th key={h} style={{ background: "#f0f2fa", border: "1px solid #dde", padding: 6 }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {items
                .filter(i => (!itemFilter.q || i.name.includes(itemFilter.q)) && (!itemFilter.role || i.role === itemFilter.role))
                .slice(0, 300)
                .map(i => {
                  const ago = agoFor(i.name, fD(new Date()));
                  return (
                    <tr key={i.id} style={{ opacity: i.active ? 1 : 0.45 }}>
                      <td style={{ border: "1px solid #e3e6f2", padding: "4px 8px" }}>{i.name}</td>
                      <td style={{ border: "1px solid #e3e6f2", padding: 4 }}>
                        <select value={i.role} onChange={e => updateItem(i.id, { role: e.target.value, is_staple: e.target.value === "staple" })} style={{ border: "none", background: "none", fontSize: 13 }}>
                          {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td style={{ border: "1px solid #e3e6f2", padding: 4 }}>
                        <select value={i.protein || ""} onChange={e => updateItem(i.id, { protein: e.target.value || null })} style={{ border: "none", background: "none", fontSize: 13 }}>
                          <option value="">—</option>
                          {PROTEINS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td style={{ border: "1px solid #e3e6f2", padding: 4, textAlign: "center" }}>
                        {["아침", "점심", "저녁", "간식"].map(m => (
                          <label key={m} style={{ marginRight: 6, fontSize: 12, whiteSpace: "nowrap" }}>
                            <input type="checkbox" checked={i.meals.includes(m)} onChange={e => updateItem(i.id, { meals: e.target.checked ? [...i.meals, m] : i.meals.filter(x => x !== m) })} />{m}
                          </label>
                        ))}
                      </td>
                      <td style={{ border: "1px solid #e3e6f2", padding: 4, textAlign: "center" }}>
                        <input type="checkbox" checked={i.is_staple} onChange={e => updateItem(i.id, { is_staple: e.target.checked })} />
                      </td>
                      <td style={{ border: "1px solid #e3e6f2", padding: 4, textAlign: "center" }}>
                        <input type="checkbox" checked={i.active} onChange={e => updateItem(i.id, { active: e.target.checked })} />
                      </td>
                      <td style={{ border: "1px solid #e3e6f2", padding: "4px 8px", textAlign: "center", color: "#667" }}>{ago !== null ? `${ago}일 전` : "—"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {picker && (
        <div onClick={() => setPicker(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 18, width: 460, maxHeight: "72vh", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {picker.date.slice(5).replace("-", "/")} {picker.meal} — {picker.index === null ? "메뉴 추가" : "메뉴 교체"}
            </div>
            <input autoFocus placeholder="검색 (비우면 같은 분류 추천순)" value={search} onChange={e => setSearch(e.target.value)}
              style={{ padding: "8px 10px", border: "1px solid #ccd", borderRadius: 8, fontSize: 14 }} />
            <div style={{ overflowY: "auto", flex: 1 }}>
              {pickerCandidates().map(({ i, ago }) => (
                <div key={i.id} onClick={() => applyPick(i.name)}
                  style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", borderBottom: "1px solid #eef", cursor: "pointer", fontSize: 14 }}>
                  <span>{i.name} <span style={{ fontSize: 11.5, color: "#99a" }}>{ROLE_LABEL[i.role]}{i.protein ? ` · ${i.protein}` : ""}</span></span>
                  <span style={{ fontSize: 12.5, color: ago !== null && ago <= DUP_WINDOW ? "#c60" : "#7a9", fontWeight: 700 }}>
                    {ago !== null ? `${ago}일 전` : "처음"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
