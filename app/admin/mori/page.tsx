"use client";

/* 모리칸 — 주간 식단 조합 생성기 v2
   · 회피 기준: 이번 주 식사 손님(올인원)의 체류 기간 — 손님이 먹은 메뉴만 회피
   · 손님이 전원 신규면 과거 회차 재사용 추천
   · 저녁은 어른(매운)/아동(순한) 2열 */

import React, { useEffect, useMemo, useState } from "react";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import {
  Item, FixedSet, Serving, WeekPlan, DayPlan, MEALS, DUP_WINDOW,
  addD, diffDays, mondayOf, dowOf, nk, genWeek, genBreakfast, genDinner, planOccurrences,
  emptyDay, migrateDay, mildOf,
} from "./gen";

const ROUND_EPOCH = "2026-05-04"; // 1회차 시작 월요일
const fD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nextMonday = () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return fD(d); };

const ROLE_LABEL: Record<string, string> = {
  base: "주식(밥)", soup: "국·찌개", main: "메인", side: "반찬", salad: "샐러드",
  fruit: "과일", dairy: "유제품·음료", breakfast_main: "아침주식", staple: "기본찬",
};
const PROTEINS = ["닭", "돼지", "소", "생선해물", "계란", "두부"];
const MEAL_COLS = ["아침", "점심", "저녁어른", "저녁아동"] as const;
const MEAL_LABEL: Record<string, string> = { 아침: "아침", 점심: "점심 (픽스)", 저녁어른: "저녁 · 어른", 저녁아동: "저녁 · 아동" };

type Picker = { date: string; meal: string; index: number | null } | null;
type Guest = { name: string; from: string; to: string };

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
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestsLoaded, setGuestsLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"day" | "table">("table");
  const [dayIdx, setDayIdx] = useState(0);
  const [autoFixed, setAutoFixed] = useState(0);
  const [picker, setPicker] = useState<Picker>(null);
  const [pickerTab, setPickerTab] = useState<"suggest" | "fresh">("suggest");
  const [pickerPage, setPickerPage] = useState(0);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [itemFilter, setItemFilter] = useState({ q: "", role: "" });
  const [newItem, setNewItem] = useState({ name: "", role: "side", protein: "", meals: ["저녁"] as string[] });

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  useEffect(() => { if (authed) loadBase(); }, [authed]);
  useEffect(() => { if (authed) { loadWeek(weekStart); loadGuests(); } }, [authed, weekStart]);

  async function loadBase() {
    const [it, fs, sv, wk] = await Promise.all([
      supabase.from("mori_items").select("*").order("name"),
      supabase.from("mori_fixed_sets").select("*").order("set_no"),
      supabase.from("mori_servings").select("serve_date, meal, item_name").order("serve_date", { ascending: false }).limit(4000),
      supabase.from("mori_weeks").select("week_start, plan"),
    ]);
    setItems((it.data || []) as Item[]);
    setSets((fs.data || []).map((s: any) => ({ ...s, lunch: Array.isArray(s.lunch) ? s.lunch : JSON.parse(s.lunch) })));
    setServings((sv.data || []) as Serving[]);
    setAllWeeks((wk.data || []) as any);
  }

  async function loadWeek(ws: string) {
    const { data } = await supabase.from("mori_weeks").select("*").eq("week_start", ws).maybeSingle();
    if (data) {
      const migrated: WeekPlan = {};
      for (const [d, day] of Object.entries((data.plan || {}) as Record<string, any>)) migrated[d] = migrateDay(day) || emptyDay();
      setPlan(migrated); setStatus(data.status); setWeekId(data.id);
    }
    else { setPlan(null); setStatus("none"); setWeekId(null); }
  }

  /* 이번 주에 식사 나가는 손님 (올인원, 드하/제이파크 구간) — 식단 관련 업무와 같은 규칙 */
  async function loadGuests() {
    try {
      const { data } = await supabase.from("bookings").select("booker_name, checkin_date, checkout_date, accom_type, is_all_in_one, status, seg1_type, seg1_checkin, seg1_checkout, seg2_type, seg2_checkin, seg2_checkout");
      const weekEnd = addD(weekStart, 4);
      const gs: Guest[] = [];
      for (const b of (data || []) as any[]) {
        if (!b.is_all_in_one) continue;
        if (String(b.status || "").includes("취소")) continue;
        const eat = (t?: string | null) => t === "dreamhouse" || t === "jaypark";
        const segs: { from: string; to: string }[] = [];
        if (b.seg1_type || b.seg2_type) {
          if (eat(b.seg1_type) && b.seg1_checkin && b.seg1_checkout) segs.push({ from: String(b.seg1_checkin).slice(0, 10), to: String(b.seg1_checkout).slice(0, 10) });
          if (eat(b.seg2_type) && b.seg2_checkin && b.seg2_checkout) segs.push({ from: String(b.seg2_checkin).slice(0, 10), to: String(b.seg2_checkout).slice(0, 10) });
        } else if (b.checkin_date && b.checkout_date && !String(b.accom_type || "").includes("큐브")) {
          segs.push({ from: String(b.checkin_date).slice(0, 10), to: String(b.checkout_date).slice(0, 10) });
        }
        if (!segs.length) continue;
        if (!segs.some(s => s.from <= weekEnd && s.to >= weekStart)) continue;
        const from = segs.reduce((m, s) => (s.from < m ? s.from : m), segs[0].from);
        const to = segs.reduce((m, s) => (s.to > m ? s.to : m), segs[0].to);
        gs.push({ name: b.booker_name || "손님", from, to });
      }
      gs.sort((a, b) => (a.from < b.from ? -1 : 1));
      setGuests(gs);
    } catch { setGuests([]); }
    setGuestsLoaded(true);
  }

  const roundNo = useMemo(() => Math.floor(diffDays(ROUND_EPOCH, weekStart) / 7) + 1, [weekStart]);
  const dates = useMemo(() => [0, 1, 2, 3, 4].map(d => addD(weekStart, d)), [weekStart]);

  /* 회피 창: 이번 주 손님 중 가장 일찍 먹기 시작한 날부터 */
  const avoidStart = useMemo(() => {
    const olds = guests.filter(g => g.from < weekStart);
    if (!olds.length) return null;
    return olds.reduce((m, g) => (g.from < m ? g.from : m), olds[0].from);
  }, [guests, weekStart]);
  const windowDays = avoidStart ? Math.max(0, diffDays(avoidStart, weekStart)) : guests.length > 0 ? 0 : DUP_WINDOW;

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

  /* 재사용 가능한 과거 회차: 회차 전체 날짜가 회피 창 이전이면 OK. 오래 안 나온 순 추천 */
  const reuse = useMemo(() => {
    if (!guestsLoaded || !guests.length || !servings.length) return { rec: null as number | null, list: [] as number[] };
    const list: { r: number; avgAgo: number }[] = [];
    for (let r = 1; r < roundNo; r++) {
      const rs = addD(ROUND_EPOCH, (r - 1) * 7), re = addD(rs, 4);
      if (avoidStart && re >= avoidStart) continue;
      const names = new Set(servings.filter(s => s.serve_date >= rs && s.serve_date <= re).map(s => nk(s.item_name)));
      if (names.size < 5) continue;
      let sum = 0, n = 0;
      names.forEach(k => { const arr = servedDates.get(k); const d = arr?.find(x => x < weekStart); sum += d ? diffDays(d, weekStart) : 999; n++; });
      list.push({ r, avgAgo: sum / Math.max(1, n) });
    }
    list.sort((a, b) => b.avgAgo - a.avgAgo);
    return { rec: list.length ? list[0].r : null, list: list.map(x => x.r).sort((a, b) => a - b) };
  }, [guestsLoaded, guests, servings, roundNo, avoidStart, weekStart, servedDates]);

  /* ───────── 액션 ───────── */
  function generate() {
    setPlan(genWeek(weekStart, items, servings, sets, setLastUsed, windowDays));
    setAutoFixed(0); setViewMode("day"); setDayIdx(0);
  }

  async function loadRound(r: number) {
    const rs = addD(ROUND_EPOCH, (r - 1) * 7);
    let src: WeekPlan | null = null;
    try {
      const { data } = await supabase.from("mori_weeks").select("plan").eq("week_start", rs).maybeSingle();
      if (data?.plan && Object.keys(data.plan).length) src = data.plan as WeekPlan;
    } catch {}
    const newPlan: WeekPlan = {};
    for (let i = 0; i < 5; i++) {
      const from = addD(rs, i), to = addD(weekStart, i);
      if (src) newPlan[to] = migrateDay(src[from]) || emptyDay();
      else {
        const day = emptyDay();
        for (const s of servings.filter(x => x.serve_date === from)) {
          const m = s.meal === "저녁" ? "저녁어른" : s.meal;
          if ((day as any)[m]) (day as any)[m].push(s.item_name);
        }
        if (!day.저녁아동.length) day.저녁아동 = [...day.저녁어른];
        newPlan[to] = day;
      }
    }
    // 회피 창 안에서 이미 나온 메뉴는 자동 교체 (아침/저녁, 점심 픽스는 유지)
    let fixed = 0;
    if (windowDays > 0) {
      const inPlan = new Set<string>();
      for (const day of Object.values(newPlan)) for (const m of MEALS) for (const it of (day as any)[m] || []) inPlan.add(nk(it));
      for (const date of Object.keys(newPlan)) {
        const day = newPlan[date];
        for (const meal of ["아침", "저녁어른"] as const) {
          const arr = (day as any)[meal] as string[];
          for (let idx = 0; idx < arr.length; idx++) {
            const oldName = arr[idx];
            const raw = oldName.startsWith("밥/") ? oldName.slice(2) : oldName;
            const item = items.find(i => nk(i.name) === nk(raw));
            if (item?.is_staple) continue;
            const ago = agoFor(raw, date);
            if (ago === null || ago > windowDays) continue;
            const cands = items
              .filter(c => c.active && !c.is_staple && (item ? c.role === item.role : false) && !inPlan.has(nk(c.name)))
              .map(c => ({ c, a: agoFor(c.name, date) }))
              .filter(x => x.a === null || x.a > windowDays)
              .sort((x, y) => (y.a ?? 99999) - (x.a ?? 99999));
            if (!cands.length) continue;
            const nn = cands[0].c.name;
            inPlan.add(nk(nn));
            arr[idx] = oldName.startsWith("밥/") ? `밥/${nn}` : nn;
            fixed++;
            if (meal === "저녁어른") {
              const carr = day.저녁아동;
              const oldMild = mildOf(items, raw);
              const ci = carr.findIndex(x => nk(x.replace(/^밥\//, "")) === nk(raw) || nk(x.replace(/^밥\//, "")) === nk(oldMild));
              if (ci >= 0) {
                const nm = mildOf(items, nn);
                carr[ci] = arr[idx].startsWith("밥/") ? `밥/${nm}` : nm;
              }
            }
          }
        }
      }
    }
    setAutoFixed(fixed);
    setPlan(newPlan);
    setViewMode("day"); setDayIdx(0);
  }

  function regenCell(date: string, kind: "아침" | "저녁") {
    if (!plan) return;
    const used = new Set<string>();
    const usedProteinByDate = new Map<string, Set<string>>();
    for (const [d, day] of Object.entries(plan)) {
      for (const m of MEALS) {
        if (d === date && ((kind === "아침" && m === "아침") || (kind === "저녁" && m.startsWith("저녁")))) continue;
        for (const it of (day as any)[m] || []) {
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
    const ctx = { items, last, used, usedProteinByDate, dupWindow: windowDays };
    const lunchProteins = new Set<string>();
    for (const it of plan[date].점심) { const f = items.find(i => nk(i.name) === nk(it)); if (f?.protein) lunchProteins.add(f.protein); }
    if (kind === "아침") setPlan({ ...plan, [date]: { ...plan[date], 아침: genBreakfast(ctx as any, date) } });
    else {
      const dn = genDinner(ctx as any, date, lunchProteins);
      setPlan({ ...plan, [date]: { ...plan[date], 저녁어른: dn.adult, 저녁아동: dn.child } });
    }
  }

  function setFixedSet(date: string, setNo: number) {
    if (!plan) return;
    const fs = sets.find(s => s.set_no === setNo);
    if (!fs) return;
    setPlan({ ...plan, [date]: { ...plan[date], 점심: [...fs.lunch, "김치"], fixedSet: setNo } });
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
          for (const it of (day as any)[meal] || []) {
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
    const header = ["날짜", "아침", "점심 (픽스)", "저녁 (어른)", "저녁 (아동)"];
    const rows = dates.map(d => {
      const day = plan[d];
      return [
        `${d.slice(5).replace("-", "/")} (${dowOf(d)})`,
        (day?.아침 || []).join("\n"),
        (day?.점심 || []).join("\n"),
        (day?.저녁어른 || []).join("\n"),
        (day?.저녁아동 || []).join("\n"),
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([[`${roundNo}회 식단표 (${weekStart} ~ ${addD(weekStart, 4)})`], header, ...rows]);
    ws["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 28 }, { wch: 26 }, { wch: 26 }];
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

  const btn = (bg: string): React.CSSProperties => ({ background: bg, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" });
  const chipWarnStyle = (warn: number | null, dupInWeek: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 4, margin: "2px 4px 2px 0", padding: "3px 8px",
    borderRadius: 12, fontSize: 12.5, cursor: "pointer", border: "1px solid",
    background: dupInWeek ? "#ffe3e3" : warn !== null && windowDays > 0 && warn <= windowDays ? "#fff3d6" : "#f1f3fa",
    borderColor: dupInWeek ? "#e88" : warn !== null && windowDays > 0 && warn <= windowDays ? "#e6b84c" : "#d5d9ee",
    color: "#333",
  });

  const pickerPool = () => {
    if (!picker) return [];
    const mealKey = picker.meal.startsWith("저녁") ? "저녁" : picker.meal;
    const cur = picker.index !== null && plan ? (plan[picker.date] as any)[picker.meal][picker.index] : null;
    const curItem = cur ? items.find(i => nk(i.name) === nk(cur)) : null;
    const inPlan = new Set<string>();
    if (plan) for (const day of Object.values(plan)) for (const m of MEALS) for (const it of (day as any)[m] || []) inPlan.add(nk(it));
    return items
      .filter(i => i.active && !inPlan.has(nk(i.name)))
      .filter(i => (curItem ? i.role === curItem.role : i.meals.some(m => m === mealKey || m.startsWith(mealKey))))
      .map(i => ({ i, ago: agoFor(i.name, picker.date) }))
      .sort((a, b) => (b.ago ?? 99999) - (a.ago ?? 99999));
  };

  const openPicker = (p: Picker) => { setPicker(p); setPickerTab("suggest"); setPickerPage(0); setSearch(""); };
  const weekOf = (g: Guest) => { const w = Math.floor(diffDays(g.from, weekStart) / 7) + 1; return w <= 0 ? "신규" : `${w}주차`; };

  return (
    <div style={{ padding: 20, fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", maxWidth: 1400 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🍱 식단생성</h1>
        <div style={{ display: "flex", gap: 6 }}>
          {(["plan", "items"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...btn(tab === t ? "#3a47a8" : "#aab"), padding: "6px 12px" }}>
              {t === "plan" ? "주간 조합" : `메뉴 풀 (${items.length})`}
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#667", marginBottom: 14 }}>
        지금 묵는 손님이 먹은 메뉴만 피해요. 노란 칩 = 회피 범위 안에서 이미 나옴, 빨간 칩 = 이번 주 안에서 중복. 칩을 누르면 교체 후보가 떠요.
      </div>

      {tab === "plan" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <button onClick={() => setWeekStart(addD(weekStart, -7))} style={btn("#8892c8")}>◀ 전주</button>
            <input type="date" value={weekStart} onChange={e => setWeekStart(mondayOf(e.target.value))} style={{ padding: "7px 10px", border: "1px solid #ccd", borderRadius: 8, fontSize: 14 }} />
            <button onClick={() => setWeekStart(addD(weekStart, 7))} style={btn("#8892c8")}>다음주 ▶</button>
            <span style={{ fontWeight: 800, fontSize: 16 }}>{roundNo}회차</span>
            <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 10, background: status === "confirmed" ? "#d9f2dd" : status === "draft" ? "#fff3d6" : "#eee", color: "#333" }}>
              {status === "confirmed" ? "✅ 확정됨" : status === "draft" ? "📝 임시저장" : "미작성"}
            </span>
            {plan && (
              <span style={{ display: "inline-flex", gap: 4, marginLeft: 4 }}>
                <button onClick={() => setViewMode("day")} style={{ ...btn(viewMode === "day" ? "#3a47a8" : "#c3c8e4"), padding: "5px 10px", fontSize: 13 }}>📅 하루씩</button>
                <button onClick={() => setViewMode("table")} style={{ ...btn(viewMode === "table" ? "#3a47a8" : "#c3c8e4"), padding: "5px 10px", fontSize: 13 }}>📋 전체 표</button>
              </span>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={generate} style={btn("#3a47a8")}>⚡ 새로 조합</button>
            {plan && <button onClick={() => save()} style={btn("#5a67c8")}>{busy || "저장"}</button>}
            {plan && status !== "confirmed" && <button onClick={() => { if (confirm("확정하면 제공 이력에 반영되어 이후 주차 중복 검사에 사용돼요. 확정할까요?")) save("confirmed"); }} style={btn("#2e9e52")}>확정</button>}
            {plan && <button onClick={exportXlsx} style={btn("#1d6f42")}>📥 엑셀</button>}
          </div>

          <div style={{ background: "#fff", border: "1px solid #dde", borderRadius: 12, padding: "12px 16px", marginBottom: 10, fontSize: 13.5 }}>
            {guests.length > 0 ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <b>👥 이번 주({roundNo}회차) 식사 손님 {guests.length}팀</b>
                  <span style={{ background: windowDays > 0 ? "#fff3d6" : "#d9f2dd", padding: "2px 10px", borderRadius: 8, fontSize: 12.5 }}>
                    {windowDays > 0 ? `회피 범위: ${avoidStart} 이후 ${windowDays}일치 메뉴` : "전원 신규 — 과거 식단 그대로 재사용 가능"}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {guests.map((g, gi) => {
                    const total = Math.max(1, diffDays(g.from, g.to));
                    const eaten = Math.min(Math.max(diffDays(g.from, weekStart), 0), total);
                    const isNew = g.from >= weekStart;
                    return (
                      <div key={gi} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 130, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name} {Math.round(total / 7)}주</span>
                        <div style={{ flex: 1, height: 12, borderRadius: 6, background: "#eceef8", overflow: "hidden" }}>
                          <div style={{ width: `${Math.max((eaten / total) * 100, isNew ? 3 : 0)}%`, height: "100%", background: isNew ? "#2e9e52" : "#5a67c8" }} />
                        </div>
                        <span style={{ width: 140, fontSize: 12, color: isNew ? "#2e9e52" : "#667", fontWeight: isNew ? 700 : 400 }}>
                          {isNew ? "신규 · 이력 없음" : `${weekOf(g)} · ${Math.floor(eaten / 7)}주치 먹음`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : guestsLoaded ? (
              <>이번 주 식사 손님(올인원)을 찾지 못했어요 — 기본 {DUP_WINDOW}일 회피로 동작해요.</>
            ) : (
              <>손님 정보 불러오는 중…</>
            )}
          </div>

          {autoFixed > 0 && (
            <div style={{ background: "#eefaf0", border: "1px solid #bfe5c8", color: "#1d7a35", borderRadius: 10, padding: "8px 14px", marginBottom: 10, fontSize: 13.5 }}>
              ✅ 회피 범위 안에서 최근에 또 나왔던 메뉴 {autoFixed}개를 자동으로 교체했어요. 노란 칩이 남아 있으면 점심 픽스 세트 항목이에요.
            </div>
          )}

          {reuse.rec !== null && status !== "confirmed" && (
            <div style={{ border: "2px solid #3a47a8", background: "#eef2ff", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13.5, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <b>💡 {reuse.rec}회차 식단을 그대로 재사용할 수 있어요</b>
              <span style={{ color: "#556" }}>지금 손님 중 아무도 안 먹은 주간이에요 (가장 오래 안 나온 회차 순 추천)</span>
              <button onClick={() => loadRound(reuse.rec!)} style={btn("#3a47a8")}>{reuse.rec}회차 불러오기</button>
              {reuse.list.length > 1 && (
                <select defaultValue="" onChange={e => { if (e.target.value) loadRound(+e.target.value); }} style={{ padding: "6px 8px", border: "1px solid #ccd", borderRadius: 8, fontSize: 13 }}>
                  <option value="">다른 회차…</option>
                  {reuse.list.map(r => <option key={r} value={r}>{r}회차</option>)}
                </select>
              )}
            </div>
          )}

          {!plan && (
            <div style={{ padding: 60, textAlign: "center", color: "#889", border: "2px dashed #ccd", borderRadius: 14, fontSize: 15 }}>
              아직 이 주차 식단이 없어요. {reuse.rec !== null ? <>위의 <b>재사용 추천</b>을 쓰거나 </> : null}<b>⚡ 새로 조합</b>을 눌러 초안을 만들어보세요.
            </div>
          )}

          {plan && viewMode === "day" && (() => {
            const d = dates[Math.min(dayIdx, 4)];
            const day = plan[d] || emptyDay();
            const doneCnt = dates.filter(x => plan[x]?.done).length;
            const bigRow = (meal: string, it: string, idx: number) => {
              const raw = it.startsWith("밥/") ? it.slice(2) : it;
              const item = items.find(x => nk(x.name) === nk(raw));
              const ago = item?.is_staple ? null : agoFor(raw, d);
              const warn = ago !== null && windowDays > 0 && ago <= windowDays;
              return (
                <div key={idx} onClick={() => openPicker({ date: d, meal, index: idx })}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 16px", border: warn ? "1.5px solid #e6b84c" : "1.5px solid #d5d9ee", background: warn ? "#fffaf0" : "#fff", borderRadius: 12, cursor: "pointer", fontSize: 15, marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{item?.spicy ? "🌶 " : ""}{it}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: ago === null ? "#9aa" : warn ? "#c2660a" : "#64748b" }}>{item?.is_staple ? "기본찬" : ago === null ? "처음" : `${ago}일 만에`}</span>
                    <span onClick={e => { e.stopPropagation(); removeItem(d, meal, idx); }} style={{ color: "#bbc", fontWeight: 700 }}>×</span>
                  </span>
                </div>
              );
            };
            const section = (meal: string, label: string, regen?: boolean) => (
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: "#556" }}>{label}</span>
                  <button onClick={() => openPicker({ date: d, meal, index: null })} style={{ background: "none", border: "1px dashed #aab", borderRadius: 8, padding: "1px 8px", fontSize: 12, cursor: "pointer", color: "#667" }}>+ 추가</button>
                  {regen && <button onClick={() => regenCell(d, meal === "아침" ? "아침" : "저녁")} style={{ background: "none", border: "1px solid #aab", borderRadius: 8, padding: "1px 8px", fontSize: 12, cursor: "pointer", color: "#667" }}>🔄 다시 추천</button>}
                </div>
                {meal === "점심" && (
                  <select value={day.fixedSet ?? ""} onChange={e => setFixedSet(d, +e.target.value)}
                    style={{ width: "100%", marginBottom: 8, padding: "6px 8px", fontSize: 13, border: "1px solid #ccd", borderRadius: 8 }}>
                    <option value="">픽스 세트 선택…</option>
                    {sets.map(s => {
                      const lu = setLastUsed.get(s.set_no);
                      return <option key={s.set_no} value={s.set_no}>{s.set_no}회 — {s.lunch[1] || s.lunch[0]}{lu ? ` (${lu.slice(5)})` : " (미사용)"}</option>;
                    })}
                  </select>
                )}
                {((day as any)[meal] || []).map((it: string, idx: number) => bigRow(meal, it, idx))}
                {!((day as any)[meal] || []).length && <div style={{ color: "#aab", fontSize: 13, padding: "6px 2px" }}>비어 있음 — + 추가로 채워주세요</div>}
              </div>
            );
            return (
              <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", border: "1px solid #dde", borderRadius: 16, padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{d.slice(5).replace("-", "/")} ({dowOf(d)})</span>
                  <span style={{ fontSize: 13, color: "#667" }}>{doneCnt} / 5일 확정</span>
                </div>
                <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
                  {dates.map((x, i) => (
                    <div key={x} onClick={() => setDayIdx(i)} title={x}
                      style={{ flex: 1, height: 8, borderRadius: 4, cursor: "pointer", background: plan[x]?.done ? "#2e9e52" : i === dayIdx ? "#3a47a8" : "#dde" }} />
                  ))}
                </div>
                {section("아침", "아침")}
                {section("점심", "점심 (픽스 세트)")}
                {section("저녁어른", "저녁 · 어른", true)}
                {section("저녁아동", "저녁 · 아동 (어른 재추천 시 자동 연동)")}
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button onClick={() => setDayIdx(i => Math.max(0, i - 1))} disabled={dayIdx === 0}
                    style={{ flex: 1, border: "1px solid #ccd", background: "#fff", borderRadius: 10, padding: "12px 0", fontSize: 14.5, fontWeight: 700, color: dayIdx === 0 ? "#bbc" : "#3a47a8", cursor: "pointer" }}>◀ 이전 날</button>
                  <button onClick={() => {
                    const np = { ...plan, [d]: { ...day, done: true } };
                    setPlan(np);
                    if (dayIdx < 4) setDayIdx(dayIdx + 1);
                    else setViewMode("table");
                  }}
                    style={{ flex: 2, border: "none", background: "#3a47a8", color: "#fff", borderRadius: 10, padding: "12px 0", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>
                    {dayIdx < 4 ? "이 날 확정, 다음 날 ▶" : "다 됐어요 — 전체 검토하기 ▶"}
                  </button>
                </div>
              </div>
            );
          })()}

          {plan && viewMode === "table" && dates.every(x => plan[x]?.done) && status !== "confirmed" && (
            <div style={{ background: "#eef2ff", border: "1px solid #c5cdf0", borderRadius: 10, padding: "8px 14px", marginBottom: 10, fontSize: 13.5, color: "#3a47a8", fontWeight: 700 }}>
              5일 모두 하루 확정이 끝났어요 — 전체 표를 검토하고 위의 <b>확정</b> 버튼을 눌러 마무리하세요.
            </div>
          )}

          {plan && viewMode === "table" && (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 80, background: "#3a47a8", color: "#fff", padding: 8, fontSize: 14 }}>날짜</th>
                  {MEAL_COLS.map(m => (
                    <th key={m} style={{ background: m.startsWith("저녁") ? "#2f3b8f" : "#3a47a8", color: "#fff", padding: 8, fontSize: 14 }}>{MEAL_LABEL[m]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map(d => {
                  const day = plan[d] || emptyDay();
                  return (
                    <tr key={d}>
                      <td style={{ border: "1px solid #dde", padding: 8, textAlign: "center", fontWeight: 800, fontSize: 14, background: "#f7f8fd" }}>
                        {d.slice(5).replace("-", "/")}<br /><span style={{ fontSize: 12, color: "#667" }}>({dowOf(d)})</span>
                      </td>
                      {MEAL_COLS.map(meal => (
                        <td key={meal} style={{ border: "1px solid #dde", padding: 8, verticalAlign: "top", minWidth: 160 }}>
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
                                onClick={() => openPicker({ date: d, meal, index: idx })}>
                                {it}
                                {warn !== null && windowDays > 0 && warn <= windowDays && <b style={{ color: "#b8860b", fontSize: 11 }}>{warn}d</b>}
                                {dupInWeek && <b style={{ color: "#c33", fontSize: 11 }}>중복</b>}
                                <span onClick={e => { e.stopPropagation(); removeItem(d, meal, idx); }} style={{ color: "#99a", fontWeight: 700 }}>×</span>
                              </span>
                            );
                          })}
                          <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                            <button onClick={() => openPicker({ date: d, meal, index: null })}
                              style={{ background: "none", border: "1px dashed #aab", borderRadius: 8, padding: "2px 8px", fontSize: 12, cursor: "pointer", color: "#667" }}>+ 추가</button>
                            {(meal === "아침" || meal === "저녁어른") && (
                              <button onClick={() => regenCell(d, meal === "아침" ? "아침" : "저녁")} title={meal === "아침" ? "아침 다시 추천" : "저녁(어른+아동) 다시 추천"}
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
              <tr>{["메뉴", "분류", "단백질", "끼니", "순한 짝꿍(아동용)", "기본찬", "사용", "마지막 제공"].map(h => <th key={h} style={{ background: "#f0f2fa", border: "1px solid #dde", padding: 6 }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {items
                .filter(i => (!itemFilter.q || i.name.includes(itemFilter.q)) && (!itemFilter.role || i.role === itemFilter.role))
                .slice(0, 300)
                .map(i => {
                  const ago = agoFor(i.name, fD(new Date()));
                  return (
                    <tr key={i.id} style={{ opacity: i.active ? 1 : 0.45 }}>
                      <td style={{ border: "1px solid #e3e6f2", padding: "4px 8px" }}>{i.spicy ? "🌶 " : ""}{i.name}</td>
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
                        {["아침", "점심", "저녁"].map(m => (
                          <label key={m} style={{ marginRight: 6, fontSize: 12, whiteSpace: "nowrap" }}>
                            <input type="checkbox" checked={i.meals.some(x => x === m || (m === "저녁" && x.startsWith("저녁")))} onChange={e => updateItem(i.id, { meals: e.target.checked ? [...i.meals.filter(x => x !== m), m] : i.meals.filter(x => x !== m && !(m === "저녁" && x.startsWith("저녁"))) })} />{m}
                          </label>
                        ))}
                      </td>
                      <td style={{ border: "1px solid #e3e6f2", padding: 4 }}>
                        <input defaultValue={i.mild_pair || ""} placeholder="예: 간장제육볶음" onBlur={e => { const v = e.target.value.trim(); if (v !== (i.mild_pair || "")) updateItem(i.id, { mild_pair: v || null, spicy: !!v || i.spicy }); }}
                          style={{ width: "100%", border: "none", background: "none", fontSize: 13 }} />
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

      {picker && (() => {
        const pool = pickerPool();
        const pageCount = Math.max(1, Math.ceil(pool.length / 3));
        const suggests = pool.slice((pickerPage % pageCount) * 3, (pickerPage % pageCount) * 3 + 3);
        const freshList = (search ? items.filter(i => i.active && i.name.includes(search)).map(i => ({ i, ago: agoFor(i.name, picker.date) })).sort((a, b) => (b.ago ?? 99999) - (a.ago ?? 99999)) : pool).slice(0, 80);
        const agoBadge = (ago: number | null) => (
          <span style={{ fontSize: 13, fontWeight: 700, color: ago === null ? "#0f766e" : windowDays > 0 && ago <= windowDays ? "#c2660a" : "#64748b", flexShrink: 0 }}>
            {ago === null ? "처음" : `${ago}일 만에`}
          </span>
        );
        return (
          <div onClick={() => setPicker(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 20, width: 480, maxHeight: "76vh", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                {picker.date.slice(5).replace("-", "/")} ({dowOf(picker.date)}) {MEAL_LABEL[picker.meal] || picker.meal} — {picker.index === null ? "메뉴 추가" : "메뉴 교체"}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setPickerTab("suggest")} style={{ ...{ border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }, background: pickerTab === "suggest" ? "#3a47a8" : "#eef0f8", color: pickerTab === "suggest" ? "#fff" : "#556" }}>추천 후보</button>
                <button onClick={() => setPickerTab("fresh")} style={{ ...{ border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }, background: pickerTab === "fresh" ? "#3a47a8" : "#eef0f8", color: pickerTab === "fresh" ? "#fff" : "#556" }}>오래 안 나온 순</button>
              </div>

              {pickerTab === "suggest" && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {suggests.map(({ i, ago }) => (
                      <div key={i.id} onClick={() => applyPick(i.name)}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "13px 16px", border: "1.5px solid #d5d9ee", borderRadius: 12, cursor: "pointer", fontSize: 15 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#eef2ff"; (e.currentTarget as HTMLElement).style.borderColor = "#3a47a8"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; (e.currentTarget as HTMLElement).style.borderColor = "#d5d9ee"; }}>
                        <span style={{ fontWeight: 600 }}>{i.spicy ? "🌶 " : ""}{i.name} <span style={{ fontSize: 11.5, fontWeight: 400, color: "#99a" }}>{ROLE_LABEL[i.role]}{i.protein ? ` · ${i.protein}` : ""}</span></span>
                        {agoBadge(ago)}
                      </div>
                    ))}
                    {!suggests.length && <div style={{ padding: 20, textAlign: "center", color: "#99a", fontSize: 14 }}>후보가 없어요 — '오래 안 나온 순' 탭에서 골라보세요</div>}
                  </div>
                  <button onClick={() => setPickerPage(p => p + 1)}
                    style={{ border: "1px solid #ccd", background: "#fff", borderRadius: 10, padding: "10px 0", fontSize: 14, fontWeight: 700, color: "#3a47a8", cursor: "pointer" }}>
                    🔄 보기 변경 ({(pickerPage % pageCount) + 1}/{pageCount})
                  </button>
                </>
              )}

              {pickerTab === "fresh" && (
                <>
                  <input autoFocus placeholder="검색 (비우면 같은 분류만)" value={search} onChange={e => setSearch(e.target.value)}
                    style={{ padding: "9px 12px", border: "1px solid #ccd", borderRadius: 10, fontSize: 14 }} />
                  <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                    {freshList.map(({ i, ago }) => (
                      <div key={i.id} onClick={() => applyPick(i.name)}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderBottom: "1px solid #eef", cursor: "pointer", fontSize: 14 }}>
                        <span>{i.spicy ? "🌶 " : ""}{i.name} <span style={{ fontSize: 11.5, color: "#99a" }}>{ROLE_LABEL[i.role]}{i.protein ? ` · ${i.protein}` : ""}</span></span>
                        {agoBadge(ago)}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
