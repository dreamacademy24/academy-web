"use client";

import React, { useEffect, useMemo, useState } from "react";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

/* ───────── 날짜 헬퍼 (로컬 타임존 안전 — toISOString 금지) ───────── */
const pD = (s: string) => { const [a, b, c] = s.slice(0, 10).split("-").map(Number); return new Date(a, b - 1, c); };
const fD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addD = (s: string, n: number) => { const d = pD(s); d.setDate(d.getDate() + n); return fD(d); };
const diffDays = (a: string, b: string) => Math.round((pD(b).getTime() - pD(a).getTime()) / 86400000);
const MONS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const fShort = (s: string) => `${MONS[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)}`;
const mondayOf = (s: string) => { const d = pD(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fD(d); };
/* 체크인이 월요일이면 그대로, 아니면 다음 월요일 (주차 기산점) */
const firstMonday = (s: string) => { const d = pD(s); const dow = d.getDay(); if (dow === 1) return s; const add = dow === 0 ? 1 : 8 - dow; d.setDate(d.getDate() + add); return fD(d); };

/* 2026 드림센터 휴무 (식사는 제공, 점심 아이 포함) */
const MEAL_HOLIDAYS = new Set([
  "2026-01-01", "2026-01-02", "2026-03-20", "2026-04-02", "2026-04-03", "2026-04-04",
  "2026-05-01", "2026-05-29", "2026-06-12", "2026-08-09", "2026-09-24", "2026-09-25", "2026-09-26",
  "2026-10-09", "2026-10-30", "2026-10-31", "2026-11-27",
  "2026-12-24", "2026-12-25", "2026-12-26", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31",
]);

type GuardianStay = { name: string; from: string; to: string };
type Bk = Record<string, any>;

/* 기본규정: 올인원 드림하우스/제이파크 = 식사 O, 큐브나인 = 식사 X */
type MealSeg = { from: string; to: string; loc: "DH" | "JPARK" };

function segLoc(t: string | null | undefined): "DH" | "JPARK" | null {
  if (t === "dreamhouse") return "DH";
  if (t === "jaypark") return "JPARK";
  return null; // cubenine 등 → 식사 없음
}

/* 식사 제공 구간 목록 (콤보는 구간별, 환승일은 둘째 숙소 소속) */
function mealSegs(b: Bk): MealSeg[] {
  if (b.seg1_type || b.seg2_type) {
    const segs: MealSeg[] = [];
    const l1 = segLoc(b.seg1_type), l2 = segLoc(b.seg2_type);
    if (l1 && b.seg1_checkin && b.seg1_checkout)
      segs.push({ from: b.seg1_checkin.slice(0, 10), to: b.seg2_type ? addD(b.seg1_checkout.slice(0, 10), -1) : b.seg1_checkout.slice(0, 10), loc: l1 });
    if (l2 && b.seg2_checkin && b.seg2_checkout)
      segs.push({ from: b.seg2_checkin.slice(0, 10), to: b.seg2_checkout.slice(0, 10), loc: l2 });
    return segs;
  }
  if (!b.checkin_date || !b.checkout_date) return [];
  const at = String(b.accom_type || "");
  if (at.includes("큐브")) return [];
  const loc: "DH" | "JPARK" = at.includes("제이파크") ? "JPARK" : "DH";
  return [{ from: b.checkin_date.slice(0, 10), to: b.checkout_date.slice(0, 10), loc }];
}

function parseRoom(b: Bk): { bld: number; lot: number; label: string } {
  const raw = String(b.house_no || b.accom_room || "");
  const m = raw.match(/b?\s*(\d{2})\s*[-_ ]?\s*L?\s*(\d+)/i);
  if (!m) return { bld: 99, lot: 999, label: raw || "미정" };
  const bld = +m[1], lot = +m[2];
  return { bld, lot, label: `${bld === 17 ? "DH " : ""}B${bld} L${lot}` };
}

function parseStays(b: Bk): GuardianStay[] {
  const raw = b.guardian_stays;
  if (!raw) return [];
  try { const a = typeof raw === "string" ? JSON.parse(raw) : raw; return Array.isArray(a) ? a.filter((g: any) => g && g.from && g.to) : []; } catch { return []; }
}

function kidsCount(b: Bk): number {
  if (b.children != null) return Number(b.children) || 0;
  try { const a = typeof b.students === "string" ? JSON.parse(b.students) : b.students; return Array.isArray(a) ? a.length : 0; } catch { return 0; }
}

/* 특정 날짜의 성인 수: guardian_stays가 있으면 그 기준, 없으면 예약 adults */
function adultsOn(b: Bk, date: string): number {
  const stays = parseStays(b);
  if (stays.length > 0) return stays.filter(g => g.from <= date && date <= g.to).length;
  return Number(b.adults) || 1;
}

const STAFF_INSTRUCTIONS: [string, string, string][] = [
  ["✏", "RECORD NEATLY", "All entries must be written clearly and legibly. Print names and numbers in block letters."],
  ["📦", "FRESH BOX — ABSENT GUESTS", "Even without a Fresh Box request, if a guest is ABSENT at meal time → place their meal in a Fresh Box automatically."],
  ["🏠", "MEAL LEFT AT ANOTHER HOUSE / DREAM CENTER", "If a guest is absent and the meal is left at another house or the Dream Center → MUST notify the group chat immediately with the house address and location."],
  ["✔", "CONFIRM ATTENDANCE BEFORE SERVICE", "Check each guest's attendance column before preparing plates. Mark ✔ only after confirming in person or by message."],
  ["📝", "CANCELLATIONS", "If anyone receives a cancellation in the group chat → mark the Cancel column immediately. Notify the kitchen as early as possible."],
];

export default function MealPlanPage() {
  const [authed, setAuthed] = useState(false);
  const [bookings, setBookings] = useState<Bk[]>([]);
  const [loading, setLoading] = useState(true);
  const [baseDate, setBaseDate] = useState(() => fD(new Date()));
  const [view, setView] = useState<"list" | "daily" | "labels">("list");
  const [labelDate, setLabelDate] = useState("");
  const [holidayOv, setHolidayOv] = useState<Record<string, boolean>>({});
  /* 보호자 체류 편집 모달 */
  const [gsTarget, setGsTarget] = useState<Bk | null>(null);
  const [gsRows, setGsRows] = useState<GuardianStay[]>([]);
  const [gsSaving, setGsSaving] = useState(false);
  const [gsInvOn, setGsInvOn] = useState(false);
  const [gsInvName, setGsInvName] = useState("보호자 추가 체류");
  const [gsInvAmt, setGsInvAmt] = useState<string>("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  useEffect(() => { if (authed) load(); }, [authed]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("id,reservation_no,booker_name,booker_english,status,checkin_date,checkout_date,house_no,accom_room,accom_type,booking_type,adults,children,students,guardian_stays,additions,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout")
      .eq("is_all_in_one", true);
    if (error) { setToast("로딩 실패: " + error.message); setLoading(false); return; }
    setBookings(data || []);
    setLoading(false);
  }

  /* 이번 주 월~금 */
  const weekMon = mondayOf(baseDate);
  const weekDates = useMemo(() => Array.from({ length: 5 }, (_, i) => addD(weekMon, i)), [weekMon]);
  const weekFri = weekDates[4];
  useEffect(() => { if (!labelDate || labelDate < weekDates[0] || labelDate > weekFri) setLabelDate(weekDates[0]); }, [weekMon]); // eslint-disable-line

  const isHoliday = (d: string) => holidayOv[d] !== undefined ? holidayOv[d] : MEAL_HOLIDAYS.has(d);

  /* 이번 주 식단 대상 게스트 */
  const guests = useMemo(() => {
    const rows = bookings.map(b => {
      if (String(b.status || "").includes("취소")) return null;
      if (b.booking_type === "commute" || String(b.accom_type || "").includes("통학")) return null;
      const segs = mealSegs(b);
      if (segs.length === 0) return null;
      const mIn = segs[0].from, mOut = segs[segs.length - 1].to;
      if (!mIn || !mOut || mIn > weekFri || mOut < weekMon) return null; // 이번 주 식사 없음
      const base = firstMonday(mIn);
      const total = Math.max(1, Math.ceil((diffDays(base, mOut) + 1) / 7));
      const cur = Math.min(total, Math.max(1, Math.floor(diffDays(base, weekMon) / 7) + 1));
      const room = parseRoom(b);
      /* 날짜별 식사 위치: JPARK or 드하 호수 라벨 (없으면 null) */
      const locByDay = weekDates.map(d => {
        const s = segs.find(sg => d >= sg.from && d <= sg.to);
        return s ? (s.loc === "JPARK" ? "JPARK" : room.label) : null;
      });
      if (locByDay.every(l => !l)) return null;
      const kids = kidsCount(b);
      const adultsByDay = weekDates.map((d, i) => locByDay[i] ? adultsOn(b, d) : 0);
      const adultsSet = [...new Set(adultsByDay.filter(n => n > 0))];
      const addr = [...new Set(locByDay.filter(Boolean))].join(" → ");
      const notes: string[] = [];
      if (cur >= total) notes.push("⚠ Last week");
      else if (cur === 1) notes.push("🆕 New");
      if (segs.length > 1) notes.push(`콤보 · ${fShort(segs[1].from)} ${segs[1].loc === "DH" ? "드하" : "제이파크"} 이동`);
      /* 정렬: 이번 주 JPARK만 체류하는 집은 맨 뒤 */
      const sortBld = locByDay.some(l => l && l !== "JPARK") ? room.bld : 50;
      return { b, room, sortBld, segs, mIn, mOut, cur, total, kids, locByDay, adultsByDay, adultsSet, addr, note: notes.join(" · "), stay: `${cur}w / ${total}w` };
    }).filter(Boolean) as Array<{ b: Bk; room: { bld: number; lot: number; label: string }; sortBld: number; segs: MealSeg[]; mIn: string; mOut: string; cur: number; total: number; kids: number; locByDay: (string | null)[]; adultsByDay: number[]; adultsSet: number[]; addr: string; note: string; stay: string }>;
    rows.sort((x, y) => x.sortBld - y.sortBld || x.room.lot - y.room.lot);
    return rows;
  }, [bookings, weekMon, weekFri, weekDates]);

  /* 다음 주 입퇴소 예고 */
  const upcoming = useMemo(() => {
    const nextMon = addD(weekMon, 7), nextFri = addD(weekMon, 11);
    const incoming: string[] = [], outgoing: string[] = [];
    bookings.forEach(b => {
      if (String(b.status || "").includes("취소")) return;
      const segs = mealSegs(b); if (segs.length === 0) return;
      const mIn = segs[0].from, mOut = segs[segs.length - 1].to;
      if (mIn > weekFri && mIn <= nextFri) incoming.push(`${b.booker_name}(${fShort(mIn)})`);
      if (mOut >= weekMon && mOut < nextMon) outgoing.push(`${b.booker_name}(${fShort(mOut)})`);
    });
    return { incoming, outgoing };
  }, [bookings, weekMon, weekFri]);

  const weekLabel = `${fShort(weekDates[0])} – ${fShort(weekFri)}, ${weekDates[0].slice(0, 4)}`;
  const engName = (b: Bk) => (b.booker_english || "").trim() || b.booker_name;

  function shiftWeek(n: number) { setBaseDate(addD(baseDate, n * 7)); }

  /* ───── 보호자 체류 편집 ───── */
  function openGs(b: Bk) {
    const segs = mealSegs(b);
    const from = segs[0]?.from || (b.checkin_date || "").slice(0, 10);
    const to = segs[segs.length - 1]?.to || (b.checkout_date || "").slice(0, 10);
    const stays = parseStays(b);
    setGsRows(stays.length > 0 ? stays : Array.from({ length: Math.max(1, Number(b.adults) || 1) }, (_, i) => ({ name: i === 0 ? "보호자1 (상주)" : `보호자${i + 1}`, from, to })));
    setGsInvOn(false); setGsInvName("보호자 추가 체류"); setGsInvAmt("");
    setGsTarget(b);
  }
  async function saveGs() {
    if (!gsTarget) return;
    const valid = gsRows.filter(g => g.from && g.to && g.from <= g.to);
    if (valid.length === 0) { setToast("보호자 1명 이상 필요해요"); return; }
    const patch: Record<string, unknown> = { guardian_stays: valid };
    if (gsInvOn) {
      const amt = Number(gsInvAmt) || 0;
      if (!gsInvName.trim() || amt <= 0) { setToast("인보이스 항목명과 금액을 입력해주세요"); return; }
      const cur = (() => { try { const a = typeof gsTarget.additions === "string" ? JSON.parse(gsTarget.additions) : gsTarget.additions; return Array.isArray(a) ? a : []; } catch { return []; } })();
      patch.additions = [...cur.filter((a: any) => a && a.name), { id: Date.now(), name: gsInvName.trim(), amount: amt }];
    }
    setGsSaving(true);
    const { error } = await supabase.from("bookings").update(patch).eq("id", gsTarget.id);
    setGsSaving(false);
    if (error) { setToast("저장 실패: " + error.message); return; }
    setToast(gsInvOn ? "보호자 체류 + 인보이스 항목 저장 완료" : "보호자 체류 저장 완료");
    setGsTarget(null);
    load();
  }

  /* ───── 엑셀 다운로드 (모리인폼 양식) ───── */
  function downloadXlsx() {
    const wb = XLSX.utils.book_new();
    const totA = guests.reduce((s, g) => s + (g.adultsByDay.find(n => n > 0) || 0), 0);
    const totK = guests.reduce((s, g) => s + g.kids, 0);
    const lastNames = guests.filter(g => g.note.includes("Last")).map(g => engName(g.b));
    const newNames = guests.filter(g => g.note.includes("New")).map(g => engName(g.b));
    const holiNote = weekDates.filter(isHoliday).map(d => `${fShort(d)} = 휴무 (Holiday)`).join(", ");
    const foot = [holiNote, lastNames.length ? lastNames.join(" & ") + ": last week" : "", newNames.length ? newNames.join(" & ") + ": new" : ""].filter(Boolean).join("  |  ");

    const ovAoa: any[][] = [
      [`Dream Academy  |  Meal Attendance Overview  |  ${weekLabel}`], [],
      ["GUEST REFERENCE LIST"],
      ["Name", "Address", "Adults", "Kids", "Stay", "Note"],
      ...guests.map(g => [engName(g.b), g.addr, g.adultsSet.join("→"), g.kids, g.stay, g.note]),
      ["TOTAL", "", totA, totK, "", ""],
      [`  ※ ${foot}`],
    ];
    const ov = XLSX.utils.aoa_to_sheet(ovAoa);
    ov["!cols"] = [{ wch: 18 }, { wch: 13 }, { wch: 7 }, { wch: 6 }, { wch: 10 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, ov, "OVERVIEW");

    weekDates.forEach((d, di) => {
      const holi = isHoliday(d);
      const dayRows = guests.filter(g => g.adultsByDay[di] > 0);
      const aoa: any[][] = [
        [`Dream Academy  |  Meal Attendance  |  ${fShort(d)}, ${d.slice(0, 4)}${holi ? "  ※ 휴무" : ""}`],
        ["  ✔ = attending    Cancel = meal cancelled    Fresh Box = pack for absent guest"],
        ["GUEST INFO", "", "", "", "BREAKFAST", "", "", "", `LUNCH${holi ? "  ★아이포함" : ""}`, "", "", "", "DINNER", "", "", "", "NOTE"],
        ["Name", "Address", "Adults", "Kids", "Adults ✔", "Kids ✔", "Cancel", "Fresh Box", "Adults ✔", "Kids ✔", "Cancel", "Fresh Box", "Adults ✔", "Kids ✔", "Cancel", "Fresh Box", ""],
        ...dayRows.map(g => [engName(g.b), g.locByDay[di], g.adultsByDay[di], g.kids, "", "", "", "", "", "", "", "", "", "", "", "", g.note]),
      ];
      aoa.push(["TOTAL", "", dayRows.reduce((s, g) => s + g.adultsByDay[di], 0), dayRows.reduce((s, g) => s + g.kids, 0)]);
      aoa.push([]);
      aoa.push(["", "", "", "", "CHECKED BY — BREAKFAST", "", "", "", "CHECKED BY — LUNCH", "", "", "", "CHECKED BY — DINNER"]);
      aoa.push(["STAFF NAME :"]);
      aoa.push([]);
      aoa.push(["  STAFF INSTRUCTIONS — Please read before each meal service"]);
      STAFF_INSTRUCTIONS.forEach(([ic, t, body]) => aoa.push([ic, t, "", "", body]));
      aoa.push(["Dream Academy · Internal Staff Reference · Do not distribute"]);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [{ wch: 17 }, { wch: 13 }, { wch: 7 }, { wch: 6 }, { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 9 }, { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 9 }, { wch: 10 }, { wch: 9 }, { wch: 12 }, { wch: 9 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, fShort(d));
    });
    XLSX.writeFile(wb, `아카데미 식단 모리인폼_${fShort(weekDates[0]).replace(" ", "")}-${+weekFri.slice(8, 10)}.xlsx`);
  }

  if (!authed) return null;

  return (<>
    <style>{`
      .mp-w{max-width:1280px;margin:0 auto;padding:24px 20px;font-family:'Pretendard','Apple SD Gothic Neo',sans-serif;color:#1f2937}
      .mp-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
      .mp-top h1{font-size:20px;font-weight:800;margin:0}
      .mp-back{font-size:13px;color:#1a6fc4;cursor:pointer;text-decoration:none}
      .mp-nav{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap}
      .mp-nav button{padding:7px 14px;border:1px solid #d6dee8;background:#fff;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
      .mp-nav .cur{font-size:15px;font-weight:800;min-width:200px;text-align:center}
      .mp-tabs{display:flex;gap:6px;margin-bottom:16px;border-bottom:2px solid #e2e8f0}
      .mp-tab{padding:9px 16px;background:none;border:none;border-bottom:3px solid transparent;font-size:14px;font-weight:700;color:#6b7c93;cursor:pointer;font-family:inherit;margin-bottom:-2px}
      .mp-tab.on{color:#0d9488;border-bottom-color:#0d9488}
      .mp-actions{margin-left:auto;display:flex;gap:8px}
      .mp-btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
      .mp-btn.teal{background:#0d9488;color:#fff}.mp-btn.navy{background:#1e3a5f;color:#fff}
      table.mp{width:100%;border-collapse:collapse;background:#fff}
      table.mp th,table.mp td{border:1px solid #cbd5e1;padding:7px 8px;font-size:13px;text-align:center}
      table.mp th{background:#f1f5f9;font-weight:700}
      table.mp td.nm{text-align:left;font-weight:700}
      table.mp td.nm .kr{font-weight:500;color:#64748b;font-size:11.5px;margin-left:6px}
      .badge{display:inline-block;font-size:11px;padding:1px 7px;border-radius:10px;font-weight:700;white-space:nowrap}
      .b-last{background:#fee2e2;color:#b91c1c}.b-new{background:#dcfce7;color:#15803d}.b-combo{background:#ede9fe;color:#6d28d9}
      .adult-edit{cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px;color:#1a6fc4}
      .mp-sec-note{font-size:12.5px;color:#64748b;margin:10px 0}
      .day-block{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:22px}
      .day-title{font-size:16px;font-weight:800;text-align:center;margin-bottom:4px}
      .day-sub{font-size:11.5px;color:#64748b;text-align:center;margin-bottom:10px}
      .holi{color:#dc2626}
      table.day{width:100%;border-collapse:collapse}
      table.day th,table.day td{border:1px solid #94a3b8;padding:5px 4px;font-size:11.5px;text-align:center}
      table.day th{background:#f8fafc}
      table.day td.nm{text-align:left;font-weight:700;font-size:12px;white-space:nowrap}
      table.day .wide{min-width:54px}
      .checked-row td{font-size:10.5px;font-weight:700;color:#475569;background:#f8fafc}
      .instr{margin-top:12px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;font-size:11px;color:#475569}
      .instr b{display:inline-block;min-width:230px}
      .instr-line{margin:3px 0}
      .day-foot{text-align:center;font-size:10px;color:#aaa;margin-top:8px}
      .lbl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .lbl-col-h{text-align:center;font-weight:800;font-size:14px;padding:8px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px}
      .lbl-card{border:1.5px solid #334155;border-radius:8px;padding:10px 8px;text-align:center;margin-top:8px}
      .lbl-card .h{font-size:10px;font-weight:800;letter-spacing:1px;color:#0d9488}
      .lbl-card .rm{font-size:20px;font-weight:900;margin:2px 0}
      .lbl-card .ct{font-size:17px;font-weight:800}
      .lbl-note{font-size:13px;font-weight:700;color:#b45309;background:#fef3c7;border-radius:8px;padding:8px 12px;margin:10px 0}
      .gs-modal-bg{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:50}
      .gs-modal{background:#fff;border-radius:14px;padding:22px;width:min(560px,92vw);max-height:86vh;overflow:auto}
      .gs-modal h3{margin:0 0 4px;font-size:16px}
      .gs-row{display:flex;gap:6px;align-items:center;margin:7px 0}
      .gs-row input{border:1px solid #d6dee8;border-radius:7px;padding:7px 9px;font-size:13px;font-family:inherit}
      .gs-row .nm-in{flex:1;min-width:90px}
      .gs-del{background:#fee2e2;color:#b91c1c;border:none;border-radius:7px;padding:7px 10px;cursor:pointer;font-weight:700}
      .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:10px 22px;border-radius:10px;font-size:13.5px;z-index:60}
      @media print{
        body{background:#fff!important}
        .mp-top,.mp-nav,.mp-tabs,.mp-actions,.mp-sec-note,.no-print{display:none!important}
        .mp-w{max-width:100%;padding:0}
        .day-block{border:none;padding:0;margin:0;page-break-after:always}
        @page{size:A4 landscape;margin:10mm}
      }
      @media(max-width:700px){.mp-w{padding:14px 8px}.lbl-grid{grid-template-columns:1fr}table.mp th,table.mp td{font-size:11px;padding:5px 4px}}
    `}</style>

    <div className="mp-w">
      <div className="mp-top">
        <a className="mp-back" href="/admin/hub">← 관리자 홈</a>
        <h1>🍽 식단 모리인폼</h1>
        <span style={{ fontSize: 12.5, color: "#64748b" }}>올인원 패키지 · 드림하우스 체류 구간 자동 추출</span>
      </div>

      <div className="mp-nav">
        <button onClick={() => shiftWeek(-1)}>← 이전 주</button>
        <span className="cur">{weekLabel}</span>
        <button onClick={() => shiftWeek(1)}>다음 주 →</button>
        <button onClick={() => setBaseDate(fD(new Date()))}>이번 주</button>
        <div className="mp-actions">
          <button className="mp-btn navy" onClick={() => window.print()}>🖨 인쇄</button>
          <button className="mp-btn teal" onClick={downloadXlsx}>📥 엑셀 다운로드</button>
        </div>
      </div>

      <div className="mp-tabs">
        <button className={`mp-tab ${view === "list" ? "on" : ""}`} onClick={() => setView("list")}>📋 주간 명단</button>
        <button className={`mp-tab ${view === "daily" ? "on" : ""}`} onClick={() => setView("daily")}>✅ 일별 체크리스트</button>
        <button className={`mp-tab ${view === "labels" ? "on" : ""}`} onClick={() => setView("labels")}>🏷 라벨</button>
      </div>

      {loading ? <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>불러오는 중...</div> : <>

        {/* ───── 주간 명단 ───── */}
        {view === "list" && (
          <div className="day-block">
            <div className="day-title">Dream Academy  |  Meal Attendance Overview  |  {weekLabel}</div>
            <div className="day-sub">GUEST REFERENCE LIST · 보호자 숫자 클릭 → 체류 기간 수정</div>
            <table className="mp">
              <thead><tr><th style={{ minWidth: 150 }}>Name</th><th>Address</th><th>Adults</th><th>Kids</th><th>Stay</th><th>Note</th></tr></thead>
              <tbody>
                {guests.map(g => (
                  <tr key={g.b.id}>
                    <td className="nm">{engName(g.b)}<span className="kr">{g.b.booker_name}</span></td>
                    <td>{g.addr}</td>
                    <td><span className="adult-edit no-print-style" onClick={() => openGs(g.b)} title="보호자 체류 기간 수정">{g.adultsSet.join(" → ")}</span></td>
                    <td>{g.kids}</td>
                    <td>{g.stay}</td>
                    <td style={{ fontSize: 11.5 }}>
                      {g.note.includes("Last") && <span className="badge b-last">⚠ Last week</span>}{" "}
                      {g.note.includes("New") && <span className="badge b-new">🆕 New</span>}{" "}
                      {g.note.includes("콤보") && <span className="badge b-combo">{g.note.split("·").find(s => s.includes("콤보"))?.trim()}</span>}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 800, background: "#f8fafc" }}>
                  <td>TOTAL</td><td>{guests.length} houses</td>
                  <td>{guests.reduce((s, g) => s + (g.adultsByDay.find(n => n > 0) || 0), 0)}</td>
                  <td>{guests.reduce((s, g) => s + g.kids, 0)}</td><td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
            {(upcoming.incoming.length > 0 || upcoming.outgoing.length > 0 || weekDates.some(isHoliday)) && (
              <div className="mp-sec-note">
                {weekDates.filter(isHoliday).map(d => <div key={d}>※ <b className="holi">{fShort(d)} 휴무</b> — 식사 제공, 점심 아이 포함</div>)}
                {upcoming.outgoing.length > 0 && <div>📤 이번/다음 주 퇴소: {upcoming.outgoing.join(", ")}</div>}
                {upcoming.incoming.length > 0 && <div>📥 다음 주 입소: {upcoming.incoming.join(", ")}</div>}
              </div>
            )}
          </div>
        )}

        {/* ───── 일별 체크리스트 ───── */}
        {view === "daily" && weekDates.map((d, di) => {
          const holi = isHoliday(d);
          const dayGuests = guests.filter(g => g.adultsByDay[di] > 0);
          return (
            <div className="day-block" key={d}>
              <div className="day-title">Dream Academy  |  Meal Attendance  |  {fShort(d)} ({DAYS_EN[pD(d).getDay()]}), {d.slice(0, 4)} {holi && <span className="holi">※ 휴무</span>}
                <label className="no-print" style={{ fontSize: 11, fontWeight: 500, marginLeft: 10, color: "#64748b" }}>
                  <input type="checkbox" checked={holi} onChange={e => setHolidayOv({ ...holidayOv, [d]: e.target.checked })} /> 휴무
                </label>
              </div>
              <div className="day-sub">✔ = attending&nbsp;&nbsp;&nbsp;Cancel = meal cancelled&nbsp;&nbsp;&nbsp;Fresh Box = pack for absent guest</div>
              <table className="day">
                <thead>
                  <tr>
                    <th colSpan={4}>GUEST INFO</th><th colSpan={4}>BREAKFAST</th>
                    <th colSpan={4}>LUNCH{holi && " ★아이포함"}</th><th colSpan={4}>DINNER</th><th rowSpan={2} style={{ minWidth: 80 }}>NOTE</th>
                  </tr>
                  <tr>
                    <th style={{ minWidth: 110 }}>Name</th><th style={{ minWidth: 80 }}>Address</th><th>Adults</th><th>Kids</th>
                    {[0, 1, 2].map(i => (<React.Fragment key={i}><th className="wide">Adults ✔</th><th className="wide">Kids ✔</th><th className="wide">Cancel</th><th className="wide">Fresh Box</th></React.Fragment>))}
                  </tr>
                </thead>
                <tbody>
                  {dayGuests.map(g => (
                    <tr key={g.b.id} style={{ height: 30 }}>
                      <td className="nm">{engName(g.b)}</td><td>{g.locByDay[di]}</td>
                      <td style={{ fontWeight: 700 }}>{g.adultsByDay[di]}</td><td style={{ fontWeight: 700 }}>{g.kids}</td>
                      {Array.from({ length: 12 }).map((_, i) => <td key={i}></td>)}
                      <td style={{ fontSize: 10.5 }}>{g.note.includes("Last") ? "⚠ Last week" : g.note.includes("New") ? "🆕 New" : ""}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 800, background: "#f8fafc" }}>
                    <td>TOTAL</td><td></td>
                    <td>{dayGuests.reduce((s, g) => s + g.adultsByDay[di], 0)}</td>
                    <td>{dayGuests.reduce((s, g) => s + g.kids, 0)}</td>
                    <td colSpan={13}></td>
                  </tr>
                  <tr className="checked-row">
                    <td colSpan={4} style={{ background: "#fff", border: "1px solid transparent" }}></td>
                    <td colSpan={4}>CHECKED BY — BREAKFAST</td><td colSpan={4}>CHECKED BY — LUNCH</td><td colSpan={5}>CHECKED BY — DINNER</td>
                  </tr>
                  <tr style={{ height: 42 }}>
                    <td colSpan={4} style={{ textAlign: "right", fontWeight: 800, fontSize: 12, paddingRight: 10, background: "#fff", border: "1px solid transparent" }}>STAFF NAME :</td>
                    <td colSpan={4}></td><td colSpan={4}></td><td colSpan={5}></td>
                  </tr>
                </tbody>
              </table>
              <div className="instr">
                <div style={{ fontWeight: 800, marginBottom: 4 }}>STAFF INSTRUCTIONS — Please read before each meal service</div>
                {STAFF_INSTRUCTIONS.map(([ic, t, body]) => <div className="instr-line" key={t}>{ic} <b>{t}</b> {body}</div>)}
              </div>
              <div className="day-foot">Dream Academy · Internal Staff Reference · Do not distribute</div>
            </div>
          );
        })}

        {/* ───── 라벨 ───── */}
        {view === "labels" && (() => {
          const di = weekDates.indexOf(labelDate);
          const idx = di >= 0 ? di : 0;
          const d = weekDates[idx];
          const holi = isHoliday(d);
          const dayGuests = guests.filter(g => g.adultsByDay[idx] > 0);
          return (
            <div className="day-block">
              <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                {weekDates.map(wd => (
                  <button key={wd} className="mp-btn" style={{ background: wd === d ? "#0d9488" : "#e2e8f0", color: wd === d ? "#fff" : "#475569" }} onClick={() => setLabelDate(wd)}>
                    {fShort(wd)} ({DAYS_EN[pD(wd).getDay()]})
                  </button>
                ))}
                <label style={{ fontSize: 12.5, color: "#64748b" }}>
                  <input type="checkbox" checked={holi} onChange={e => setHolidayOv({ ...holidayOv, [d]: e.target.checked })} /> 휴무 (점심 아이 포함)
                </label>
              </div>
              <div className="day-title">Dream Academy  |  Meal Labels  |  {fShort(d)} ({DAYS_EN[pD(d).getDay()]}){holi && <span className="holi"> ※ 휴무 — 점심 아이 포함</span>}, {d.slice(0, 4)}</div>
              {holi && <div className="lbl-note">★ 오늘은 점심에 아이 인원 포함  /  Kids included in LUNCH today</div>}
              <div className="lbl-grid">
                {(["BREAKFAST", holi ? "LUNCH  ★아이포함" : "LUNCH (adults)", "DINNER"]).map((meal, mi) => (
                  <div key={meal}>
                    <div className="lbl-col-h">{meal}</div>
                    {dayGuests.map(g => {
                      const loc = g.locByDay[idx];
                      const isJp = loc === "JPARK";
                      return (
                        <div className="lbl-card" key={g.b.id}>
                          {!isJp && g.room.bld === 17 && <div className="h">DREAMHOUSE</div>}
                          {isJp && <div className="h" style={{ color: "#6d28d9" }}>JPARK</div>}
                          <div className="rm">{isJp ? "JPARK" : `B${g.room.bld}  L${g.room.lot}`}</div>
                          <div className="ct">{mi === 1 && !holi ? `${g.adultsByDay[idx]}` : `${g.adultsByDay[idx]} + ${g.kids}`}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </>}

      {/* ───── 보호자 체류 모달 ───── */}
      {gsTarget && (() => {
        const segs = mealSegs(gsTarget);
        const rFrom = segs[0]?.from || "", rTo = segs[segs.length - 1]?.to || "";
        return (
          <div className="gs-modal-bg" onClick={() => setGsTarget(null)}>
            <div className="gs-modal" onClick={e => e.stopPropagation()}>
              <h3>보호자 체류 기간 — {gsTarget.booker_name}</h3>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                식사 제공 기간: {rFrom} ~ {rTo} · 기간이 겹치는 보호자 수만큼 해당 주차 식단 인원에 반영됩니다.
              </div>
              {gsRows.map((g, i) => (
                <div className="gs-row" key={i}>
                  <input className="nm-in" value={g.name} placeholder={`보호자${i + 1}`} onChange={e => setGsRows(gsRows.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input type="date" value={g.from} onChange={e => setGsRows(gsRows.map((x, j) => j === i ? { ...x, from: e.target.value } : x))} />
                  <span style={{ color: "#94a3b8" }}>~</span>
                  <input type="date" value={g.to} onChange={e => setGsRows(gsRows.map((x, j) => j === i ? { ...x, to: e.target.value } : x))} />
                  <button className="gs-del" onClick={() => setGsRows(gsRows.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <button className="mp-btn" style={{ background: "#e2e8f0", marginTop: 6 }} onClick={() => setGsRows([...gsRows, { name: `보호자${gsRows.length + 1}`, from: rFrom, to: rTo }])}>＋ 보호자 추가</button>
              <div style={{ marginTop: 12, padding: "8px 10px", background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  <input type="checkbox" checked={gsInvOn} onChange={e => setGsInvOn(e.target.checked)} />
                  💰 인보이스 추가 항목으로 요금 등록
                </label>
                {gsInvOn && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <input style={{ border: "1px solid #d6dee8", borderRadius: 7, padding: "7px 9px", fontSize: 13, fontFamily: "inherit", maxWidth: 200 }} value={gsInvName} onChange={e => setGsInvName(e.target.value)} placeholder="항목명 (예: 보호자 추가 6/22~6/28)" />
                    <input type="number" style={{ border: "1px solid #d6dee8", borderRadius: 7, padding: "7px 9px", fontSize: 13, fontFamily: "inherit", maxWidth: 120 }} value={gsInvAmt} onChange={e => setGsInvAmt(e.target.value)} placeholder="금액(원)" />
                    <span style={{ fontSize: 11, color: "#0f766e" }}>주당: 드하 17만 · 제이파크 18만 · 큐브나인 15만</span>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                <button className="mp-btn" style={{ background: "#e2e8f0" }} onClick={() => setGsTarget(null)}>취소</button>
                <button className="mp-btn teal" disabled={gsSaving} onClick={saveGs}>{gsSaving ? "저장 중..." : "💾 저장"}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {toast && <div className="toast" onClick={() => setToast("")}>{toast}</div>}
    </div>
  </>);
}
