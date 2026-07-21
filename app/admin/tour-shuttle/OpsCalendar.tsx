"use client";
import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties } from "react";
import { toastErr } from "@/lib/toast";
import { createClient } from "@supabase/supabase-js";
import { generateItems } from "./ScheduleDeploy";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ScheduleItem {
  id: string;
  type: string;
  date: string;
  title: string;
  description: string | null;
  is_deployed: boolean;
  deploy_month: string | null;
}
interface ShuttleApp {
  id: string;
  created_at: string;
  booking_id: string | null;
  portal_name: string | null;
  name: string | null;
  room_number: string | null;
  tour_name: string | null;
  tour_date: string | null;
  depart_time: string | null;
  riders: string | null;
  people_count: number | null;
  request: string | null;
  message: string | null;
  status: string;
  cancel_reason: string | null;
}
type RoomInfo = { room: string; seg1_type?: string; seg2_type?: string; seg2_checkin?: string; accom_type?: string };

const ACC_KR: Record<string, string> = { jaypark: "제이파크", dreamhouse: "드림하우스", cubenine: "큐브나인" };
function resolveComboRoom(tourDate: string | null, info: RoomInfo): string {
  if (!info) return "";
  const isCombo = info.seg1_type && info.seg2_type;
  if (!isCombo) return info.room || "";
  const td = (tourDate || "").slice(0, 10);
  const s2 = (info.seg2_checkin || "").slice(0, 10);
  if (td && s2 && td >= s2) return ACC_KR[info.seg2_type!] || info.seg2_type || info.room;
  return ACC_KR[info.seg1_type!] || info.seg1_type || info.room;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function curMonth(offset = 0): string {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset);
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
  const startDow = first.getDay();
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
const KR_DOW = ["일", "월", "화", "수", "목", "금", "토"];
function fmtDateKR(s: string) {
  const dt = new Date(s + "T00:00:00");
  if (isNaN(dt.getTime())) return s;
  return `${dt.getMonth() + 1}/${dt.getDate()} (${KR_DOW[dt.getDay()]})`;
}

interface TourGroup {
  key: string;
  date: string;
  title: string;
  time: string;
  item: ScheduleItem | null;
  active: ShuttleApp[];
  cancelReq: ShuttleApp[];
  cancelled: ShuttleApp[];
  people: number;
}

const inp: CSSProperties = { width: "100%", padding: "9px 11px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" };
const lbl: CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 5 };
const btnBase: CSSProperties = { padding: "8px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "1px solid #cbd5e1", background: "#fff", color: "#475569" };

export default function OpsCalendar() {
  const [month, setMonth] = useState<string>(curMonth(0));
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [apps, setApps] = useState<ShuttleApp[]>([]);
  const [bookingNames, setBookingNames] = useState<Record<string, string>>({});
  const [bookingRooms, setBookingRooms] = useState<Record<string, RoomInfo>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"" | "generate" | "deploy">("");
  const [selKey, setSelKey] = useState<string>("");
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", desc: "" });
  const [editSaving, setEditSaving] = useState(false);

  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeForm, setPlaceForm] = useState({ date: "", title: "", desc: "", back: "" });
  const [placeSaving, setPlaceSaving] = useState(false);

  const [appOpen, setAppOpen] = useState(false);
  const [appForm, setAppForm] = useState({ portal_name: "", room_number: "", riders: "", people_count: 1, request: "" });
  const [appSaving, setAppSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-31`;
    const [itemRes, appRes] = await Promise.all([
      supabase.from("schedule_items").select("*").eq("deploy_month", month).eq("type", "shuttle").order("date"),
      supabase.from("shuttle_applications").select("*").gte("tour_date", monthStart).lte("tour_date", monthEnd).order("created_at"),
    ]);
    if (itemRes.error) console.error("[ops] items load 실패:", itemRes.error);
    if (appRes.error) console.error("[ops] apps load 실패:", appRes.error);
    const appData = (appRes.data || []) as ShuttleApp[];
    setItems((itemRes.data || []) as ScheduleItem[]);
    setApps(appData);
    const ids = Array.from(new Set(appData.map(d => d.booking_id).filter(Boolean) as string[]));
    if (ids.length > 0) {
      const { data: bs } = await supabase.from("bookings").select("id, booker_name, students, house_no, accom_room, accom_type, seg1_type, seg2_type, seg2_checkin").in("id", ids);
      const nameMap: Record<string, string> = {};
      const roomMap: Record<string, RoomInfo> = {};
      (bs || []).forEach((b: any) => {
        let nm = (b.booker_name || "").trim();
        if (!nm && b.students) {
          try {
            const arr = typeof b.students === "string" ? JSON.parse(b.students) : b.students;
            if (Array.isArray(arr) && arr.length > 0) {
              const s0 = arr[0] || {};
              nm = (s0.korName || s0.name_kr || s0.name || s0.engName || s0.name_en || "").trim();
            }
          } catch { /* ignore */ }
        }
        if (nm) nameMap[b.id] = nm;
        const rm = (b.house_no || b.accom_room || "").trim().replace(/^DH[\s-]*/i, "").toUpperCase();
        roomMap[b.id] = { room: rm, seg1_type: b.seg1_type, seg2_type: b.seg2_type, seg2_checkin: b.seg2_checkin, accom_type: b.accom_type };
      });
      setBookingNames(nameMap);
      setBookingRooms(roomMap);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelKey(""); }, [month]);

  const groups = useMemo(() => {
    const map = new Map<string, TourGroup>();
    const mk = (date: string, title: string) => `${date}|${title.trim()}`;
    for (const it of items) {
      const key = mk(it.date, it.title);
      map.set(key, { key, date: it.date, title: it.title.trim(), time: (it.description || "").split("·")[0].trim(), item: it, active: [], cancelReq: [], cancelled: [], people: 0 });
    }
    for (const a of apps) {
      if (!(a.tour_name || "").trim() || !(a.tour_date || "").trim()) continue;
      const key = mk(a.tour_date!, a.tour_name!);
      let g = map.get(key);
      if (!g) {
        g = { key, date: a.tour_date!, title: a.tour_name!.trim(), time: (a.depart_time || "").trim(), item: null, active: [], cancelReq: [], cancelled: [], people: 0 };
        map.set(key, g);
      }
      if (!g.time && (a.depart_time || "").trim()) g.time = a.depart_time!.trim();
      const st = String(a.status || "").toLowerCase();
      if (st === "cancel_requested") g.cancelReq.push(a);
      else if (st === "cancelled" || st === "cancel") g.cancelled.push(a);
      else { g.active.push(a); g.people += a.people_count || 0; }
    }
    return map;
  }, [items, apps]);

  const groupsByDate = useMemo(() => {
    const m = new Map<string, TourGroup[]>();
    for (const g of groups.values()) {
      const arr = m.get(g.date) || [];
      arr.push(g);
      m.set(g.date, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.time || "zz").localeCompare(b.time || "zz"));
    return m;
  }, [groups]);

  const stats = useMemo(() => {
    let recruiting = 0, zero = 0, cancelReq = 0, people = 0;
    for (const g of groups.values()) {
      if (g.people > 0) { recruiting++; people += g.people; } else zero++;
      cancelReq += g.cancelReq.length;
    }
    return { recruiting, zero, cancelReq, people, tours: groups.size };
  }, [groups]);

  const sel = selKey ? groups.get(selKey) || null : null;

  function pickTour(key: string) {
    setSelKey(k => (k === key ? "" : key));
    setTimeout(() => { panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 60);
  }

  async function runGenerate() {
    if (busy) return;
    const gen = generateItems(month);
    if (gen.length === 0) { toastErr("생성할 항목이 없습니다."); return; }
    if (!confirm(`${monthLabel(month)} 투어셔틀 ${gen.length}건을 자동 생성합니다.\n해당 월의 기존 셔틀 항목은 모두 삭제됩니다. (신청 내역은 유지) 계속할까요?`)) return;
    setBusy("generate");
    const { error: delErr } = await supabase.from("schedule_items").delete().eq("deploy_month", month).eq("type", "shuttle");
    if (delErr) { setBusy(""); toastErr("기존 항목 삭제 실패: " + delErr.message); return; }
    const { error: insErr } = await supabase.from("schedule_items").insert(gen);
    setBusy("");
    if (insErr) { toastErr("생성 실패: " + insErr.message); return; }
    await load();
  }

  async function runDeployAll() {
    if (busy) return;
    if (items.length === 0) { toastErr("배포할 항목이 없습니다. 먼저 자동 생성하세요."); return; }
    if (!confirm(`${monthLabel(month)} 투어셔틀 ${items.length}건을 배포합니다. 포털에서 보이게 됩니다. 계속할까요?`)) return;
    setBusy("deploy");
    const { error } = await supabase.from("schedule_items").update({ is_deployed: true }).eq("deploy_month", month).eq("type", "shuttle");
    setBusy("");
    if (error) { toastErr("배포 실패: " + error.message); return; }
    await load();
  }

  async function deployOne(g: TourGroup) {
    if (!g.item) return;
    const { error } = await supabase.from("schedule_items").update({ is_deployed: true }).eq("id", g.item.id);
    if (error) { toastErr("배포 실패: " + error.message); return; }
    await load();
  }

  function openEdit(g: TourGroup) {
    setEditForm({ title: g.title, desc: g.item ? (g.item.description || "") : g.time });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!sel) return;
    const newTitle = editForm.title.trim();
    if (!newTitle) { toastErr("투어명은 필수입니다."); return; }
    const appCount = sel.active.length + sel.cancelReq.length + sel.cancelled.length;
    if (appCount > 0 && newTitle !== sel.title) {
      if (!confirm(`이미 신청 ${appCount}건이 있는 투어입니다.\n"${sel.title}" → "${newTitle}" 으로 교체하면 신청 내역도 새 투어명으로 함께 이동합니다. 계속할까요?`)) return;
    }
    setEditSaving(true);
    let err: string | null = null;
    if (sel.item) {
      const { error } = await supabase.from("schedule_items").update({ title: newTitle, description: editForm.desc.trim() || null }).eq("id", sel.item.id);
      if (error) err = error.message;
    }
    if (!err && appCount > 0) {
      const newTime = editForm.desc.trim().split("·")[0].trim() || null;
      const { error } = await supabase.from("shuttle_applications").update({ tour_name: newTitle, depart_time: newTime }).eq("tour_date", sel.date).eq("tour_name", sel.title);
      if (error) err = error.message;
    }
    setEditSaving(false);
    if (err) { toastErr("저장 실패: " + err); return; }
    setEditOpen(false);
    setSelKey(`${sel.date}|${newTitle}`);
    await load();
  }

  async function deleteTour(g: TourGroup) {
    const appCount = g.active.length + g.cancelReq.length;
    const msg = appCount > 0
      ? `⚠️ 이 투어에 신청 ${appCount}건이 있습니다.\n투어 일정만 삭제되고 신청 내역은 남습니다. 정말 삭제할까요?`
      : "이 투어 일정을 삭제할까요?";
    if (!confirm(msg)) return;
    if (g.item) {
      const { error } = await supabase.from("schedule_items").delete().eq("id", g.item.id);
      if (error) { toastErr("삭제 실패: " + error.message); return; }
    }
    setSelKey("");
    await load();
  }

  async function changeStatus(id: string, status: string) {
    const { error } = await supabase.from("shuttle_applications").update({ status }).eq("id", id);
    if (error) { toastErr("상태 변경 실패: " + error.message); return; }
    await load();
  }

  async function deleteApp(id: string) {
    if (!confirm("이 신청 내역을 삭제할까요?")) return;
    const { error } = await supabase.from("shuttle_applications").delete().eq("id", id);
    if (error) { toastErr("삭제 실패: " + error.message); return; }
    await load();
  }

  function openAddPlace(date: string) {
    setPlaceForm({ date, title: "", desc: "", back: "" });
    setPlaceOpen(true);
  }

  async function saveAddPlace() {
    if (!placeForm.date || !placeForm.title.trim()) { toastErr("날짜와 장소명은 필수입니다."); return; }
    setPlaceSaving(true);
    const dm = placeForm.date.slice(0, 7);
    const depart = placeForm.desc.trim();
    const back = placeForm.back.trim();
    let description: string | null = null;
    if (depart && back) description = `출발 ${depart} · 복귀 ${back}`;
    else if (depart) description = depart;
    else if (back) description = `복귀 ${back}`;
    const { error } = await supabase.from("schedule_items").insert({
      type: "shuttle", date: placeForm.date, title: placeForm.title.trim(),
      description, is_deployed: true, deploy_month: dm,
    });
    setPlaceSaving(false);
    if (error) { toastErr("저장 실패: " + error.message); return; }
    setPlaceOpen(false);
    if (dm !== month) setMonth(dm);
    else await load();
  }

  function openAddApp() {
    setAppForm({ portal_name: "", room_number: "", riders: "", people_count: 1, request: "" });
    setAppOpen(true);
  }

  async function saveAddApp() {
    if (!sel) return;
    if (!appForm.portal_name.trim()) { toastErr("예약자명은 필수입니다."); return; }
    setAppSaving(true);
    const { error } = await supabase.from("shuttle_applications").insert({
      tour_name: sel.title, tour_date: sel.date, depart_time: sel.time || null,
      portal_name: appForm.portal_name.trim(), name: appForm.portal_name.trim(),
      room_number: appForm.room_number.trim() || null,
      riders: appForm.riders.trim() || null,
      people_count: Number(appForm.people_count) || 1,
      request: appForm.request.trim() || null, message: appForm.request.trim() || null,
      status: "confirmed",
    });
    setAppSaving(false);
    if (error) { toastErr("저장 실패: " + error.message); return; }
    setAppOpen(false);
    await load();
  }

  function printRoster(g: TourGroup) {
    const rows = g.active.map(a => {
      const liveRoom = a.booking_id && bookingRooms[a.booking_id] ? resolveComboRoom(a.tour_date, bookingRooms[a.booking_id]) : "";
      const room = liveRoom || a.room_number || "-";
      const nm = (a.booking_id && bookingNames[a.booking_id]) || a.portal_name || a.name || "-";
      const req = a.request || a.message || "";
      return `<tr><td>${room}</td><td>${nm}</td><td style="text-align:center">${a.people_count ?? "-"}명</td><td>${a.riders || ""}</td><td>${req}</td></tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${g.title} 명단</title>
<style>body{font-family:'Malgun Gothic',sans-serif;padding:24px;color:#111}h1{font-size:20px;margin:0 0 4px}
.sub{font-size:13px;color:#555;margin-bottom:16px}table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #999;padding:8px 10px;text-align:left}th{background:#f1f5f9}
.tot{margin-top:12px;font-size:14px;font-weight:bold}</style></head><body>
<h1>🚌 ${g.title}</h1>
<div class="sub">${fmtDateKR(g.date)}${g.time ? " · 출발 " + g.time : ""} · Dream Academy 투어셔틀</div>
<table><thead><tr><th style="width:110px">픽업(룸)</th><th style="width:90px">예약자</th><th style="width:60px">인원</th><th>탑승자</th><th>요청사항</th></tr></thead>
<tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#999">신청자 없음</td></tr>'}</tbody></table>
<div class="tot">총 ${g.people}명 · ${g.active.length}팀</div>
<script>window.onload=function(){window.print()}<\/script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toastErr("팝업이 차단되었습니다."); return; }
    w.document.write(html);
    w.document.close();
  }

  const cells = useMemo(() => calendarCells(month), [month]);
  const today = ymd(new Date());
  const isDeployedMonth = items.some(i => i.is_deployed);

  function chipStyle(g: TourGroup): CSSProperties {
    const isSel = g.key === selKey;
    let bg = "#f1f5f9", fg = "#64748b";
    if (g.item && !g.item.is_deployed) { bg = "#dbeafe"; fg = "#1e40af"; }
    else if (g.people > 0) { bg = "#dcfce7"; fg = "#15803d"; }
    return {
      background: bg, color: fg,
      border: isSel ? "2px solid #1a6fc4" : "2px solid transparent",
      borderRadius: 6, padding: "3px 5px", fontSize: 10.5, fontWeight: 700,
      textAlign: "left", cursor: "pointer", fontFamily: "inherit", lineHeight: 1.3,
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      display: "block", width: "100%", position: "relative",
    };
  }

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 4, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 3 }}>
            <button onClick={() => setMonth(m => monthShift(m, -1))} style={{ padding: "7px 12px", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "#475569" }}>◀</button>
            <button onClick={() => setMonth(curMonth(0))} style={{ padding: "7px 14px", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "#1a6fc4", color: "#fff", minWidth: 120, textAlign: "center" }}>{monthLabel(month)}</button>
            <button onClick={() => setMonth(m => monthShift(m, 1))} style={{ padding: "7px 12px", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "transparent", color: "#475569" }}>▶</button>
          </div>
          <span style={{ padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "#dcfce7", color: "#15803d" }}>모집중 {stats.recruiting}</span>
          <span style={{ padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "#f1f5f9", color: "#64748b" }}>신청 0명 {stats.zero}</span>
          {stats.cancelReq > 0 && <span style={{ padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "#fef2f2", color: "#dc2626" }}>취소요청 {stats.cancelReq}</span>}
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>이달 총 {stats.people}명</span>
          <div style={{ flex: 1 }} />
          <button onClick={runGenerate} disabled={!!busy} style={{ ...btnBase, background: "#fff7ed", borderColor: "#fed7aa", color: "#c2410c", opacity: busy ? 0.6 : 1 }}>⚡ {busy === "generate" ? "생성중..." : "자동생성"}</button>
          {!isDeployedMonth && items.length > 0 && (
            <button onClick={runDeployAll} disabled={!!busy} style={{ ...btnBase, background: "#16a34a", borderColor: "#16a34a", color: "#fff", opacity: busy ? 0.6 : 1 }}>🚀 {busy === "deploy" ? "배포중..." : "이번 달 배포"}</button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 5 }}>
          {KR_DOW.map((d, i) => (
            <div key={d} style={{ textAlign: "center", fontSize: 11.5, fontWeight: 800, padding: "5px 0", color: i === 0 ? "#dc2626" : i === 6 ? "#1a6fc4" : "#475569" }}>{d}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 13 }}>불러오는 중...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
            {cells.map((c, i) => {
              const dt = new Date(c.date + "T00:00:00");
              const dayNum = dt.getDate();
              const isToday = c.date === today;
              const dow = dt.getDay();
              const dayGroups = c.inMonth ? (groupsByDate.get(c.date) || []) : [];
              return (
                <div key={i} style={{ minHeight: 100, background: c.inMonth ? "#fff" : "#f8fafc", border: isToday ? "1.5px solid #1a6fc4" : "1px solid #e2e8f0", borderRadius: 8, padding: 5, opacity: c.inMonth ? 1 : 0.45, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: dow === 0 ? "#dc2626" : dow === 6 ? "#1a6fc4" : "#1a1a2e" }}>{dayNum}</span>
                    {c.inMonth && (
                      <button onClick={() => openAddPlace(c.date)} title="이 날짜에 투어 배포" style={{ border: "none", background: "transparent", color: "#cbd5e1", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", padding: "0 2px", lineHeight: 1 }}>＋</button>
                    )}
                  </div>
                  {dayGroups.map(g => (
                    <button key={g.key} onClick={() => pickTour(g.key)} title={`${g.title}${g.time ? " · " + g.time : ""} · ${g.people}명`} style={chipStyle(g)}>
                      {g.cancelReq.length > 0 && <span style={{ color: "#dc2626" }}>● </span>}
                      {g.title.length > 8 ? g.title.slice(0, 8) + "…" : g.title} <b>{g.people}명</b>
                      {g.item && !g.item.is_deployed && <span style={{ fontWeight: 600, opacity: 0.8 }}> (미배포)</span>}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8", display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#dcfce7", borderRadius: 3, marginRight: 4 }} />신청 있음</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 3, marginRight: 4 }} />신청 0명 (교체 가능)</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#dbeafe", borderRadius: 3, marginRight: 4 }} />미배포</span>
          <span><span style={{ color: "#dc2626" }}>●</span> 취소요청 있음</span>
          <span>날짜의 ＋ = 그 날에 투어 추가 배포</span>
        </div>
      </div>

      {sel && (
        <div ref={panelRef} style={{ marginTop: 14, background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "13px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1a2e" }}>
              📅 {fmtDateKR(sel.date)} · {sel.title}
              {sel.time && <span style={{ fontWeight: 600, color: "#475569", marginLeft: 6 }}>· 출발 {sel.time}</span>}
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, padding: "3px 11px", borderRadius: 999, background: sel.people > 0 ? "#dcfce7" : "#f1f5f9", color: sel.people > 0 ? "#15803d" : "#64748b" }}>
              {sel.people > 0 ? `${sel.people}명 · ${sel.active.length}팀` : "신청 0명"}
            </span>
            {sel.item && !sel.item.is_deployed && <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#dbeafe", color: "#1e40af" }}>미배포</span>}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {sel.item && !sel.item.is_deployed && (
                <button onClick={() => deployOne(sel)} style={{ ...btnBase, background: "#16a34a", borderColor: "#16a34a", color: "#fff" }}>🚀 배포</button>
              )}
              <button onClick={() => openEdit(sel)} style={btnBase}>✏️ 수정·교체</button>
              <button onClick={openAddApp} style={btnBase}>＋ 신청 추가</button>
              <button onClick={() => printRoster(sel)} style={btnBase}>🖨 기사 명단</button>
              <button onClick={() => deleteTour(sel)} style={{ ...btnBase, background: "#fef2f2", borderColor: "#fecaca", color: "#dc2626" }}>삭제</button>
              <button onClick={() => setSelKey("")} style={btnBase}>✕</button>
            </div>
          </div>

          {sel.people === 0 && sel.cancelReq.length === 0 && sel.cancelled.length === 0 && (
            <div style={{ padding: "12px 16px", fontSize: 13, color: "#94a3b8", background: "#fafafa" }}>
              아직 신청자가 없습니다. 인기가 없으면 <b>✏️ 수정·교체</b>로 다른 투어(장소·시간)로 바꿀 수 있어요.
            </div>
          )}

          {sel.active.map(a => {
            const liveRoom = a.booking_id && bookingRooms[a.booking_id] ? resolveComboRoom(a.tour_date, bookingRooms[a.booking_id]) : "";
            const displayRoom = liveRoom || a.room_number || "-";
            const bookerName = (a.booking_id && bookingNames[a.booking_id]) || a.portal_name || a.name || "";
            const req = a.request || a.message || "";
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid #f1f5f9", fontSize: 13.5 }}>
                <span style={{ minWidth: 88, fontWeight: 700, color: "#1a1a2e" }}>🏠 {displayRoom}</span>
                <span style={{ minWidth: 64, color: "#6366f1", fontWeight: 600 }} title={bookerName}>{bookerName.length > 5 ? bookerName.slice(0, 5) + "…" : bookerName}</span>
                <span style={{ minWidth: 42, color: "#475569", fontWeight: 700 }}>{a.people_count != null ? `${a.people_count}명` : "-"}</span>
                {a.riders && <span style={{ color: "#64748b", fontSize: 12.5 }} title={a.riders}>👥 {a.riders.length > 16 ? a.riders.slice(0, 16) + "…" : a.riders}</span>}
                <span style={{ flex: 1, color: req ? "#475569" : "#cbd5e1", fontSize: 12.5 }}>{req ? `📝 ${req}` : "—"}</span>
                <button onClick={() => deleteApp(a.id)} title="신청 삭제" style={{ border: "none", background: "transparent", color: "#cbd5e1", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>🗑</button>
              </div>
            );
          })}

          {sel.cancelReq.map(a => {
            const liveRoom = a.booking_id && bookingRooms[a.booking_id] ? resolveComboRoom(a.tour_date, bookingRooms[a.booking_id]) : "";
            const displayRoom = liveRoom || a.room_number || "-";
            const bookerName = (a.booking_id && bookingNames[a.booking_id]) || a.portal_name || a.name || "";
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderTop: "1px solid #f1f5f9", background: "#fffbeb", fontSize: 13.5 }}>
                <span style={{ minWidth: 88, fontWeight: 700, color: "#92400e" }}>🏠 {displayRoom}</span>
                <span style={{ minWidth: 64, color: "#92400e", fontWeight: 600 }}>{bookerName.length > 5 ? bookerName.slice(0, 5) + "…" : bookerName}</span>
                <span style={{ minWidth: 42, color: "#92400e", fontWeight: 700 }}>{a.people_count != null ? `${a.people_count}명` : "-"}</span>
                <span style={{ flex: 1, color: "#92400e", fontSize: 12.5 }}>취소요청{a.cancel_reason ? ` · 사유: ${a.cancel_reason}` : ""}</span>
                <button onClick={() => changeStatus(a.id, "cancelled")} style={{ ...btnBase, padding: "6px 11px", fontSize: 12 }}>취소 확정</button>
              </div>
            );
          })}

          {sel.cancelled.map(a => {
            const liveRoom = a.booking_id && bookingRooms[a.booking_id] ? resolveComboRoom(a.tour_date, bookingRooms[a.booking_id]) : "";
            const displayRoom = liveRoom || a.room_number || "-";
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", borderTop: "1px solid #f1f5f9", fontSize: 12.5, color: "#94a3b8" }}>
                <span style={{ minWidth: 88, textDecoration: "line-through" }}>{displayRoom}</span>
                <span style={{ minWidth: 42, textDecoration: "line-through" }}>{a.people_count != null ? `${a.people_count}명` : "-"}</span>
                <span style={{ flex: 1 }}>취소됨</span>
                <button onClick={() => changeStatus(a.id, "confirmed")} style={{ ...btnBase, padding: "5px 10px", fontSize: 11.5, color: "#64748b" }}>되돌리기</button>
              </div>
            );
          })}
        </div>
      )}

      {editOpen && sel && (
        <div onClick={() => setEditOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 420, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>✏️ 투어 수정·교체</h3>
              <button onClick={() => setEditOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7c93" }}>✕</button>
            </div>
            <div style={{ fontSize: 11.5, color: "#6b7c93", marginBottom: 10 }}>날짜: <b style={{ color: "#1a1a2e" }}>{fmtDateKR(sel.date)}</b> · 투어명을 바꾸면 다른 투어로 교체됩니다.</div>
            <label style={lbl}>투어명</label>
            <input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} style={{ ...inp, marginBottom: 12 }} />
            <label style={lbl}>출발시간 / 설명 (예: 10:00am)</label>
            <input value={editForm.desc} onChange={e => setEditForm(p => ({ ...p, desc: e.target.value }))} style={{ ...inp, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditOpen(false)} disabled={editSaving} style={btnBase}>취소</button>
              <button onClick={saveEdit} disabled={editSaving || !editForm.title.trim()} style={{ ...btnBase, background: "#1a6fc4", borderColor: "#1a6fc4", color: "#fff", opacity: (editSaving || !editForm.title.trim()) ? 0.6 : 1 }}>{editSaving ? "저장중..." : "💾 저장"}</button>
            </div>
          </div>
        </div>
      )}

      {placeOpen && (
        <div onClick={() => setPlaceOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 420, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>📍 투어 배포 — {fmtDateKR(placeForm.date)}</h3>
              <button onClick={() => setPlaceOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7c93" }}>✕</button>
            </div>
            <label style={lbl}>날짜 <span style={{ color: "#dc2626" }}>*</span></label>
            <input type="date" value={placeForm.date} onChange={e => setPlaceForm(p => ({ ...p, date: e.target.value }))} style={{ ...inp, marginBottom: 12 }} />
            <label style={lbl}>장소명 <span style={{ color: "#dc2626" }}>*</span></label>
            <input value={placeForm.title} onChange={e => setPlaceForm(p => ({ ...p, title: e.target.value }))} placeholder="예: 세부 사파리" style={{ ...inp, marginBottom: 12 }} />
            <label style={lbl}>출발시간</label>
            <input value={placeForm.desc} onChange={e => setPlaceForm(p => ({ ...p, desc: e.target.value }))} placeholder="예: 08:30am" style={{ ...inp, marginBottom: 12 }} />
            <label style={lbl}>복귀 시간 (선택)</label>
            <input value={placeForm.back} onChange={e => setPlaceForm(p => ({ ...p, back: e.target.value }))} placeholder='예: "15:00"' style={{ ...inp, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setPlaceOpen(false)} disabled={placeSaving} style={btnBase}>취소</button>
              <button onClick={saveAddPlace} disabled={placeSaving || !placeForm.date || !placeForm.title.trim()} style={{ ...btnBase, background: "#1a6fc4", borderColor: "#1a6fc4", color: "#fff", opacity: (placeSaving || !placeForm.date || !placeForm.title.trim()) ? 0.6 : 1 }}>{placeSaving ? "저장중..." : "🚀 즉시 배포"}</button>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8" }}>저장 즉시 배포되어 손님 신청 화면에 표시됩니다.</div>
          </div>
        </div>
      )}

      {appOpen && sel && (
        <div onClick={() => setAppOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>＋ 신청 직접 추가</h3>
              <button onClick={() => setAppOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7c93" }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: "#6b7c93", marginBottom: 12 }}>{fmtDateKR(sel.date)} · <b style={{ color: "#1a1a2e" }}>{sel.title}</b>{sel.time ? ` · ${sel.time}` : ""}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>예약자 <span style={{ color: "#dc2626" }}>*</span></label>
                <input value={appForm.portal_name} onChange={e => setAppForm(p => ({ ...p, portal_name: e.target.value }))} placeholder="홍길동" style={inp} />
              </div>
              <div>
                <label style={lbl}>픽업 (룸/숙소)</label>
                <input value={appForm.room_number} onChange={e => setAppForm(p => ({ ...p, room_number: e.target.value }))} placeholder="예: B16L19" style={inp} />
              </div>
              <div>
                <label style={lbl}>인원</label>
                <input type="number" min={1} max={12} value={appForm.people_count} onChange={e => setAppForm(p => ({ ...p, people_count: Number(e.target.value) || 1 }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>탑승자</label>
                <input value={appForm.riders} onChange={e => setAppForm(p => ({ ...p, riders: e.target.value }))} placeholder="김지아, 김지우" style={inp} />
              </div>
              <div style={{ gridColumn: "1 / 3" }}>
                <label style={lbl}>요청사항</label>
                <textarea value={appForm.request} onChange={e => setAppForm(p => ({ ...p, request: e.target.value }))} style={{ ...inp, minHeight: 60, resize: "vertical" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setAppOpen(false)} disabled={appSaving} style={btnBase}>취소</button>
              <button onClick={saveAddApp} disabled={appSaving || !appForm.portal_name.trim()} style={{ ...btnBase, background: "#1a6fc4", borderColor: "#1a6fc4", color: "#fff", opacity: (appSaving || !appForm.portal_name.trim()) ? 0.6 : 1 }}>{appSaving ? "저장중..." : "💾 저장"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
