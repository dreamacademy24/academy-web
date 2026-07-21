"use client";
import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties } from "react";
import { toastErr } from "@/lib/toast";
import { createClient } from "@supabase/supabase-js";
import { getShSlots, SHUTTLE_SPECIAL_MSG, type ShSlot } from "@/lib/shuttleTours";
import { fetchDeployedHolidays } from "@/lib/holidays";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  ret: string;
  note: string;
  isPattern: boolean;
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
  const [apps, setApps] = useState<ShuttleApp[]>([]);
  const [extraHolidays, setExtraHolidays] = useState<Set<string>>(new Set());
  const [bookingNames, setBookingNames] = useState<Record<string, string>>({});
  const [bookingRooms, setBookingRooms] = useState<Record<string, RoomInfo>>({});
  const [loading, setLoading] = useState(true);
  const [selKey, setSelKey] = useState<string>("");
  const panelRef = useRef<HTMLDivElement | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", time: "" });
  const [editSaving, setEditSaving] = useState(false);

  const [appOpen, setAppOpen] = useState(false);
  const [appForm, setAppForm] = useState({ tour_date: "", tour_name: "", depart_time: "", portal_name: "", room_number: "", riders: "", people_count: 1, request: "" });
  const [appSaving, setAppSaving] = useState(false);

  useEffect(() => {
    fetchDeployedHolidays().then(list => {
      if (list.length > 0) setExtraHolidays(new Set(list.map(h => h.date)));
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shuttle_applications").select("*")
      .gte("tour_date", `${month}-01`).lte("tour_date", `${month}-31`)
      .order("created_at");
    if (error) console.error("[ops] apps load 실패:", error);
    const appData = (data || []) as ShuttleApp[];
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

  const { groups, holidaySet } = useMemo(() => {
    const map = new Map<string, TourGroup>();
    const holi = new Set<string>();
    const mk = (date: string, title: string) => `${date}|${title.trim()}`;
    const [y, mm] = month.split("-").map(Number);
    const lastDay = new Date(y, mm, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const ds = `${month}-${pad2(d)}`;
      const slots = getShSlots(ds, extraHolidays);
      if (slots === "holiday") { holi.add(ds); continue; }
      for (const sl of slots) {
        const key = mk(ds, sl.name);
        map.set(key, { key, date: ds, title: sl.name, time: sl.time, ret: sl.return, note: sl.note || "", isPattern: true, active: [], cancelReq: [], cancelled: [], people: 0 });
      }
    }
    for (const a of apps) {
      if (!(a.tour_name || "").trim() || !(a.tour_date || "").trim()) continue;
      const key = mk(a.tour_date!, a.tour_name!);
      let g = map.get(key);
      if (!g) {
        g = { key, date: a.tour_date!, title: a.tour_name!.trim(), time: (a.depart_time || "").trim(), ret: "", note: "", isPattern: false, active: [], cancelReq: [], cancelled: [], people: 0 };
        map.set(key, g);
      }
      if (!g.time && (a.depart_time || "").trim()) g.time = a.depart_time!.trim();
      const st = String(a.status || "").toLowerCase();
      if (st === "cancel_requested") g.cancelReq.push(a);
      else if (st === "cancelled" || st === "cancel") g.cancelled.push(a);
      else { g.active.push(a); g.people += a.people_count || 0; }
    }
    return { groups: map, holidaySet: holi };
  }, [apps, month, extraHolidays]);

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
    return { recruiting, zero, cancelReq, people };
  }, [groups]);

  const sel = selKey ? groups.get(selKey) || null : null;

  function pickTour(key: string) {
    setSelKey(k => (k === key ? "" : key));
    setTimeout(() => { panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 60);
  }

  function openEdit(g: TourGroup) {
    setEditForm({ title: g.title, time: g.time });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!sel) return;
    const newTitle = editForm.title.trim();
    if (!newTitle) { toastErr("투어명은 필수입니다."); return; }
    const appCount = sel.active.length + sel.cancelReq.length + sel.cancelled.length;
    if (appCount === 0) { toastErr("이동할 신청 내역이 없습니다. (기본 투어 패턴은 코드 규칙이라 여기서 바뀌지 않아요)"); return; }
    if (!confirm(`신청 ${appCount}건을 "${sel.title}" → "${newTitle}" 으로 이동합니다.\n⚠️ 손님 신청 화면의 기본 투어 목록은 고정 규칙이라 바뀌지 않습니다. 계속할까요?`)) return;
    setEditSaving(true);
    const { error } = await supabase.from("shuttle_applications")
      .update({ tour_name: newTitle, depart_time: editForm.time.trim() || null })
      .eq("tour_date", sel.date).eq("tour_name", sel.title);
    setEditSaving(false);
    if (error) { toastErr("저장 실패: " + error.message); return; }
    setEditOpen(false);
    setSelKey(`${sel.date}|${newTitle}`);
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

  function openAddApp(date: string, tourName: string, time: string) {
    setAppForm({ tour_date: date, tour_name: tourName, depart_time: time, portal_name: "", room_number: "", riders: "", people_count: 1, request: "" });
    setAppOpen(true);
  }

  async function saveAddApp() {
    if (!appForm.tour_name.trim() || !appForm.tour_date || !appForm.portal_name.trim()) {
      toastErr("투어명, 날짜, 예약자명은 필수입니다."); return;
    }
    setAppSaving(true);
    const { error } = await supabase.from("shuttle_applications").insert({
      tour_name: appForm.tour_name.trim(), tour_date: appForm.tour_date,
      depart_time: appForm.depart_time.trim() || null,
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
    if (appForm.tour_date.slice(0, 7) !== month) setMonth(appForm.tour_date.slice(0, 7));
    else await load();
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
<div class="sub">${fmtDateKR(g.date)}${g.time ? " · 출발 " + g.time : ""}${g.ret ? " · 복귀 " + g.ret : ""} · Dream Academy 투어셔틀</div>
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

  function chipStyle(g: TourGroup): CSSProperties {
    const isSel = g.key === selKey;
    let bg = "#f1f5f9", fg = "#64748b";
    if (g.people > 0) { bg = "#dcfce7"; fg = "#15803d"; }
    if (!g.isPattern) { bg = "#f5f3ff"; fg = "#6d28d9"; }
    return {
      background: bg, color: fg,
      border: isSel ? "2px solid #1a6fc4" : "2px solid transparent",
      borderRadius: 6, padding: "3px 5px", fontSize: 10.5, fontWeight: 700,
      textAlign: "left", cursor: "pointer", fontFamily: "inherit", lineHeight: 1.3,
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      display: "block", width: "100%",
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
          <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>손님 신청 화면과 동일 규칙 · 휴무 자동 반영</span>
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
              const isHoliday = c.inMonth && holidaySet.has(c.date);
              return (
                <div key={i} style={{ minHeight: 100, background: c.inMonth ? (isHoliday ? "#fffbeb" : "#fff") : "#f8fafc", border: isToday ? "1.5px solid #1a6fc4" : "1px solid #e2e8f0", borderRadius: 8, padding: 5, opacity: c.inMonth ? 1 : 0.45, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: dow === 0 ? "#dc2626" : dow === 6 ? "#1a6fc4" : "#1a1a2e" }}>{dayNum}</span>
                    {c.inMonth && !isHoliday && (
                      <button onClick={() => openAddApp(c.date, "", "")} title="이 날짜에 신청 직접 추가" style={{ border: "none", background: "transparent", color: "#cbd5e1", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", padding: "0 2px", lineHeight: 1 }}>＋</button>
                    )}
                  </div>
                  {isHoliday && (
                    <div title={SHUTTLE_SPECIAL_MSG[c.date] || "셔틀 휴무"} style={{ fontSize: 10.5, fontWeight: 700, color: "#b45309", background: "#fef3c7", borderRadius: 6, padding: "3px 5px", textAlign: "center" }}>🚫 휴무</div>
                  )}
                  {dayGroups.map(g => (
                    <button key={g.key} onClick={() => pickTour(g.key)} title={`${g.title} · 출발 ${g.time || "-"}${g.ret ? " · 복귀 " + g.ret : ""}${g.note ? " · " + g.note : ""} · ${g.people}명`} style={chipStyle(g)}>
                      {g.cancelReq.length > 0 && <span style={{ color: "#dc2626" }}>● </span>}
                      {g.title.length > 8 ? g.title.slice(0, 8) + "…" : g.title} <b>{g.people}명</b>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8", display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#dcfce7", borderRadius: 3, marginRight: 4 }} />신청 있음</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 3, marginRight: 4 }} />신청 0명</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 3, marginRight: 4 }} />수동 추가 (손님 화면 밖)</span>
          <span><span style={{ color: "#dc2626" }}>●</span> 취소요청 있음</span>
          <span>🚫 휴무 = 손님 화면에서도 자동 차단</span>
        </div>
      </div>

      {sel && (
        <div ref={panelRef} style={{ marginTop: 14, background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "13px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1a2e" }}>
              📅 {fmtDateKR(sel.date)} · {sel.title}
              {sel.time && <span style={{ fontWeight: 600, color: "#475569", marginLeft: 6 }}>· 출발 {sel.time}</span>}
              {sel.ret && <span style={{ fontWeight: 600, color: "#94a3b8", marginLeft: 6, fontSize: 13 }}>· 복귀 {sel.ret}</span>}
            </div>
            {sel.note && <span style={{ fontSize: 12, fontWeight: 600, color: "#b45309", background: "#fef3c7", padding: "2px 9px", borderRadius: 999 }}>{sel.note}</span>}
            {!sel.isPattern && <span style={{ fontSize: 12, fontWeight: 700, color: "#6d28d9", background: "#f5f3ff", padding: "3px 10px", borderRadius: 999 }}>수동 추가</span>}
            <span style={{ fontSize: 12.5, fontWeight: 700, padding: "3px 11px", borderRadius: 999, background: sel.people > 0 ? "#dcfce7" : "#f1f5f9", color: sel.people > 0 ? "#15803d" : "#64748b" }}>
              {sel.people > 0 ? `${sel.people}명 · ${sel.active.length}팀` : "신청 0명"}
            </span>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => openAddApp(sel.date, sel.title, sel.time)} style={btnBase}>＋ 신청 추가</button>
              {(sel.active.length + sel.cancelReq.length + sel.cancelled.length) > 0 && (
                <button onClick={() => openEdit(sel)} style={btnBase} title="신청 내역을 다른 투어명/시간으로 이동">✏️ 신청 이동</button>
              )}
              <button onClick={() => printRoster(sel)} style={btnBase}>🖨 기사 명단</button>
              <button onClick={() => setSelKey("")} style={btnBase}>✕</button>
            </div>
          </div>

          {sel.people === 0 && sel.cancelReq.length === 0 && sel.cancelled.length === 0 && (
            <div style={{ padding: "12px 16px", fontSize: 13, color: "#94a3b8", background: "#fafafa" }}>
              아직 신청자가 없습니다. 필요하면 <b>＋ 신청 추가</b>로 직접 등록할 수 있어요.
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
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>✏️ 신청 이동</h3>
              <button onClick={() => setEditOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7c93" }}>✕</button>
            </div>
            <div style={{ fontSize: 11.5, color: "#6b7c93", marginBottom: 10, lineHeight: 1.5 }}>
              {fmtDateKR(sel.date)}의 신청 내역을 다른 투어명·시간으로 옮깁니다.<br />
              ⚠️ 손님 신청 화면의 기본 투어 목록은 고정 규칙이라 여기서 바뀌지 않아요.
            </div>
            <label style={lbl}>투어명</label>
            <input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} style={{ ...inp, marginBottom: 12 }} />
            <label style={lbl}>출발시간 (예: 10:00am)</label>
            <input value={editForm.time} onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))} style={{ ...inp, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditOpen(false)} disabled={editSaving} style={btnBase}>취소</button>
              <button onClick={saveEdit} disabled={editSaving || !editForm.title.trim()} style={{ ...btnBase, background: "#1a6fc4", borderColor: "#1a6fc4", color: "#fff", opacity: (editSaving || !editForm.title.trim()) ? 0.6 : 1 }}>{editSaving ? "저장중..." : "💾 이동"}</button>
            </div>
          </div>
        </div>
      )}

      {appOpen && (
        <div onClick={() => setAppOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 460, padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>＋ 신청 직접 추가</h3>
              <button onClick={() => setAppOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#6b7c93" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1 / 3" }}>
                <label style={lbl}>투어명 <span style={{ color: "#dc2626" }}>*</span></label>
                <input value={appForm.tour_name} onChange={e => setAppForm(p => ({ ...p, tour_name: e.target.value }))} placeholder="예: 세부 사파리" style={inp} />
              </div>
              <div>
                <label style={lbl}>날짜 <span style={{ color: "#dc2626" }}>*</span></label>
                <input type="date" value={appForm.tour_date} onChange={e => setAppForm(p => ({ ...p, tour_date: e.target.value }))} style={inp} />
              </div>
              <div>
                <label style={lbl}>출발 시간</label>
                <input value={appForm.depart_time} onChange={e => setAppForm(p => ({ ...p, depart_time: e.target.value }))} placeholder="예: 8:30am" style={inp} />
              </div>
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
              <button onClick={saveAddApp} disabled={appSaving || !appForm.tour_name.trim() || !appForm.portal_name.trim()} style={{ ...btnBase, background: "#1a6fc4", borderColor: "#1a6fc4", color: "#fff", opacity: (appSaving || !appForm.tour_name.trim() || !appForm.portal_name.trim()) ? 0.6 : 1 }}>{appSaving ? "저장중..." : "💾 저장"}</button>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#94a3b8" }}>기본 패턴에 없는 투어명으로 저장하면 달력에 보라색 &quot;수동 추가&quot; 칩으로 표시됩니다. (손님 화면에는 안 보임)</div>
          </div>
        </div>
      )}
    </div>
  );
}
