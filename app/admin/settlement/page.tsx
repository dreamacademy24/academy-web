"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";
import { toastOk, toastErr } from "@/lib/toast";
import { cancelMap } from "@/lib/lessonCancellations";
import { tutorDailyRate } from "@/lib/lessonDates";

interface Booking { id: string; booker_name: string | null; reservation_no: string | null; checkin_date: string | null; checkout_date: string | null; house_no: string | null; accom_room?: string | null; students?: unknown; settlement_open?: boolean | null; }
function studentNames(b: Booking): string {
  const raw = b.students;
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") { try { const p = JSON.parse(raw); if (Array.isArray(p)) arr = p; } catch {} }
  const names = arr.map((s: any) => s?.name_kr || s?.korName || s?.name || s?.name_en || s?.engName || "").filter(Boolean);
  return names.join(", ");
}
type Kind = "deposit" | "deduct" | "refund" | "charge";
type Section = "deposit" | "class";
interface Item { id: string; booking_id: string; section: string; kind: string; label: string; amount: number; item_date: string | null; note: string | null; status: string; recorded_by: string | null; }
interface Preset { id: string; section: string; kind: string; label: string; default_amount: number | null; needs_dates: boolean; sort: number; active: boolean; }
interface Status { booking_id: string; academy_closed: boolean; academy_closed_at: string | null; final_closed: boolean; final_closed_at: string | null; }

const peso = (n: number) => "₱" + (n || 0).toLocaleString("en-US");
const today10 = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function SettlementPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [listFilter, setListFilter] = useState<"staying" | "upcoming" | "all">("staying");
  const [sel, setSel] = useState<Booking | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [printHtml, setPrintHtml] = useState("");

  // 항목 추가 모달
  const [addOpen, setAddOpen] = useState(false);
  const [aSection, setASection] = useState<Section>("class");
  const [aKind, setAKind] = useState<Kind>("charge");
  const [aLabel, setALabel] = useState("");
  const [aAmount, setAAmount] = useState("");
  const [aDate, setADate] = useState(today10());
  const [aNote, setANote] = useState("");
  const [aNeedsDates, setANeedsDates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [presetMgr, setPresetMgr] = useState(false);

  useEffect(() => { if (!isAdminAuthed()) { router.replace("/login"); return; } setAuthed(true); }, [router]);

  const loadBookings = useCallback(async () => {
    const { data } = await supabase.from("bookings").select("id, booker_name, reservation_no, checkin_date, checkout_date, house_no, accom_room, students, settlement_open").order("checkin_date", { ascending: false });
    const today = today10();
    const rank = (b: Booking) => {
      const ci = b.checkin_date || "", co = b.checkout_date || "";
      if (ci && ci <= today && (!co || co >= today)) return 0;
      if (ci && ci > today) return 1;
      return 2;
    };
    const sorted = ((data || []) as Booking[]).sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 1) return (a.checkin_date || "").localeCompare(b.checkin_date || "");
      return (b.checkin_date || "").localeCompare(a.checkin_date || "");
    });
    setBookings(sorted);
  }, []);
  useEffect(() => { if (authed) loadBookings(); }, [authed, loadBookings]);

  const loadPresets = useCallback(async () => {
    const { data } = await supabase.from("settlement_presets").select("*").eq("active", true).order("sort", { ascending: true });
    setPresets((data || []) as Preset[]);
  }, []);
  useEffect(() => { if (authed) loadPresets(); }, [authed, loadPresets]);

  const loadItems = useCallback(async (bid: string) => {
    setLoading(true);
    const { data } = await supabase.from("settlement_items").select("*").eq("booking_id", bid).order("item_date", { ascending: true });
    setItems((data || []) as Item[]);
    setLoading(false);
  }, []);
  const loadStatus = useCallback(async (bid: string) => {
    const { data } = await supabase.from("settlement_status").select("*").eq("booking_id", bid).maybeSingle();
    setStatus((data || null) as Status | null);
  }, []);
  useEffect(() => { if (sel?.id) { loadItems(sel.id); loadStatus(sel.id); } else { setItems([]); setStatus(null); } }, [sel?.id, loadItems, loadStatus]);

  const isStaying = (b: Booking) => { const t = today10(); return !!(b.checkin_date && b.checkin_date.slice(0, 10) <= t && (!b.checkout_date || b.checkout_date.slice(0, 10) >= t)); };
  const isUpcoming = (b: Booking) => { const t = today10(); return !!(b.checkin_date && b.checkin_date.slice(0, 10) > t); };
  const stayingCount = useMemo(() => bookings.filter(isStaying).length, [bookings]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = bookings;
    if (q) base = base.filter(b => `${b.booker_name || ""} ${b.reservation_no || ""} ${b.house_no || b.accom_room || ""} ${studentNames(b)}`.toLowerCase().includes(q));
    else if (listFilter === "staying") base = base.filter(isStaying);
    else if (listFilter === "upcoming") base = base.filter(isUpcoming);
    return base.slice(0, 60);
  }, [bookings, search, listFilter]);

  const sectionOf = (i: Item) => i.section || (["deposit", "deduct", "refund"].includes(i.kind) ? "deposit" : "class");
  const depositItems = items.filter(i => sectionOf(i) === "deposit");
  const classItems = items.filter(i => sectionOf(i) === "class");
  // 합계는 승인된 항목만 (엄마 화면과 일치) — 승인대기 항목은 제외
  const appr = (arr: Item[]) => arr.filter(i => i.status === "approved");
  const sumOf = (arr: Item[], kind: Kind) => appr(arr).filter(i => i.kind === kind).reduce((a, i) => a + Number(i.amount || 0), 0);
  const depRecv = sumOf(depositItems, "deposit");
  const depDeduct = sumOf(depositItems, "deduct");
  const depRefund = sumOf(depositItems, "refund");
  const depositRefund = depRecv - depDeduct + depRefund;
  // 수업·교재비: 청구(charge 등) = 받을 돈(+), 납부(payment) = 이미 받음(−) → 받을 잔액 = 청구 − 납부
  const classCharge = appr(classItems).filter(i => i.kind !== "payment").reduce((a, i) => a + Number(i.amount || 0), 0);
  const classPaid = appr(classItems).filter(i => i.kind === "payment").reduce((a, i) => a + Number(i.amount || 0), 0);
  const classDue = classCharge - classPaid; // 아직 받아야 할 수업·교재비
  const finalNet = depositRefund - classDue; // +면 환불, −면 납부

  // ── 항목 추가 ──
  function openAdd(section: Section) {
    setASection(section);
    setAKind(section === "deposit" ? "deduct" : "charge");
    setALabel(""); setAAmount(""); setADate(today10()); setANote(""); setANeedsDates(false);
    setAddOpen(true);
  }
  function pickPreset(p: Preset) {
    setASection(p.section as Section);
    setAKind(p.kind as Kind);
    setALabel(p.label);
    setAAmount(p.default_amount ? String(p.default_amount) : "");
    setANeedsDates(!!p.needs_dates);
  }
  async function saveItem() {
    if (!sel) return;
    const amt = Number(aAmount);
    if (!aLabel.trim()) { toastErr("항목명을 입력하세요"); return; }
    if (!amt || amt <= 0) { toastErr("금액을 입력하세요"); return; }
    setSaving(true);
    const { error } = await supabase.from("settlement_items").insert({
      booking_id: sel.id, section: aSection, kind: aKind, label: aLabel.trim(),
      amount: amt, item_date: aDate, note: aNote.trim() || null,
      status: "approved", recorded_by: "직원",
    });
    setSaving(false);
    if (error) { toastErr("저장 실패: " + error.message); return; }
    toastOk("추가됐어요");
    setAddOpen(false);
    loadItems(sel.id);
  }
  async function delItem(id: string) {
    if (!confirm("이 항목을 삭제할까요?")) return;
    const { error } = await supabase.from("settlement_items").delete().eq("id", id);
    if (error) { toastErr("삭제 실패: " + error.message); return; }
    if (sel) loadItems(sel.id);
  }

  // ── 인보이스 현지지불(locals) 불러오기 — bookings.locals 그대로 import (금액 일치 보장) ──
  function parseAmt(v: unknown): number {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
    return isFinite(n) ? n : 0;
  }
  async function importInvoice() {
    if (!sel) return;
    setImporting(true);
    try {
      const rows: Record<string, unknown>[] = [];
      let invCount = 0, tutCount = 0;

      // 중복 방지: state(items) 대신 DB에서 최신 항목을 다시 읽어 dedup (빠른 더블클릭/stale 방지)
      const { data: freshItems } = await supabase.from("settlement_items").select("id, label, amount, note, recorded_by").eq("booking_id", sel.id);
      const cur = (freshItems || []) as { id: string; label: string; amount: number; note: string | null; recorded_by: string | null }[];

      // ── 1) 게스트 인보이스 현지지불(bookings.locals) ──
      const { data: bk } = await supabase.from("bookings").select("locals").eq("id", sel.id).maybeSingle();
      let arr: any[] = [];
      const raw = bk?.locals;
      if (Array.isArray(raw)) arr = raw;
      else if (typeof raw === "string") { try { const p = JSON.parse(raw); if (Array.isArray(p)) arr = p; } catch {} }
      const invExisting = new Set(cur.filter(i => i.note === "인보이스").map(i => `${i.label}|${Number(i.amount)}`));
      arr.map((l: any) => ({ label: String(l?.name || "").trim(), amount: parseAmt(l?.amount) }))
        .filter(l => l.label && l.amount > 0 && !invExisting.has(`${l.label}|${l.amount}`))
        .forEach(l => {
          // 보증금 항목은 보증금 정산 섹션으로, 나머지는 수업·교재비
          const isDep = l.label.includes("보증금");
          rows.push({ booking_id: sel.id, section: isDep ? "deposit" : "class", kind: isDep ? "deposit" : "charge", label: l.label, amount: l.amount, item_date: today10(), note: "인보이스", status: "approved", recorded_by: "인보이스" });
          invCount++;
        });

      // ── 2) 튜터 인보이스(tutor_lessons) — 경로 A: tutor_requests.booking_id → application_id 경유 ──
      const lessonMap = new Map<string, any>();
      const { data: reqs } = await supabase.from("tutor_requests").select("id").eq("booking_id", sel.id);
      const reqIds = (reqs || []).map((r: any) => r.id);
      if (reqIds.length) {
        const { data: l2 } = await supabase.from("tutor_lessons").select("*").in("application_id", reqIds);
        (l2 || []).forEach((l: any) => lessonMap.set(String(l.id), l));
      }
      // ── 경로 B (폴백): booking_id 없는 신청 → 예약자명·학생명으로 tutor_lessons 직접 매칭 ──
      if (lessonMap.size === 0) {
        const bkName = (sel.booker_name || "").trim();
        const stuNames = studentNames(sel).split(",").map(s => s.trim()).filter(Boolean);
        const candidates = [bkName, ...stuNames].filter(Boolean);
        if (candidates.length) {
          const orFilters = candidates.map(n => `house_or_reserver.ilike.%${n}%,student_names.ilike.%${n}%`).join(",");
          let q = supabase.from("tutor_lessons").select("*").or(orFilters);
          // 체류기간 겹침 필터 — 동명이인 방지
          if (sel.checkin_date) q = q.gte("end_date", sel.checkin_date);
          if (sel.checkout_date) q = q.lte("start_date", sel.checkout_date);
          const { data: l3 } = await q;
          (l3 || []).forEach((l: any) => lessonMap.set(String(l.id), l));
        }
        // 경로 B-2: tutor_requests에서도 이름 매칭으로 재검색 → lesson 연결
        if (lessonMap.size === 0 && candidates.length) {
          const orF2 = candidates.map(n => `guest_name.ilike.%${n}%,student_name_kr.ilike.%${n}%`).join(",");
          const { data: reqs2 } = await supabase.from("tutor_requests").select("id").or(orF2);
          const rIds2 = (reqs2 || []).map((r: any) => r.id);
          if (rIds2.length) {
            const { data: l4 } = await supabase.from("tutor_lessons").select("*").in("application_id", rIds2);
            (l4 || []).forEach((l: any) => lessonMap.set(String(l.id), l));
          }
        }
      }
      // 기존 튜터 항목(노트키 기준) — 값 변동 시 갱신용
      const tutByNote = new Map<string, { id: string; amount: number; label: string }>();
      for (const i of cur) { if (i.note && i.note.startsWith("튜터:")) tutByNote.set(i.note, { id: i.id, amount: Number(i.amount), label: i.label }); }
      const autoCreatedSet = new Set(cur.filter(i => i.recorded_by === "시스템(튜터확정)").map(i => `${i.amount}`));
      const mdOf = (s2: string) => { const m = String(s2 || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[2])}/${Number(m[3])}` : ""; };
      const genClassDates = (l: any): string[] => {
        if (!l.start_date || !l.end_date) return [];
        const codeToIdx: Record<string, number> = { sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6,"일":0,"월":1,"화":2,"수":3,"목":4,"금":5,"토":6 };
        const codes = (Array.isArray(l.class_days) ? l.class_days : []).map((d: string) => (d || "").toLowerCase().trim());
        const wanted = new Set(codes.map((c: string) => codeToIdx[c]).filter((i: number) => i !== undefined));
        if (!wanted.size) return [];
        const out: string[] = []; const d = new Date(l.start_date + "T00:00:00"); const end = new Date(l.end_date + "T00:00:00");
        while (d <= end) { if (wanted.has(d.getDay())) out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`); d.setDate(d.getDate()+1); }
        return out;
      };
      const tutUpdates: { id: string; amount: number; label: string }[] = [];
      // 튜터 인보이스 — 실시간 계산: (취소 차감 제외한 실제 회차) × 하루 단가
      for (const l of lessonMap.values()) {
        const cm = cancelMap(l);
        let billedDates: string[];
        const { data: sess } = await supabase.from("tutor_lesson_sessions").select("session_date").eq("lesson_id", l.id);
        if (sess && sess.length > 0) {
          billedDates = (sess as { session_date: string }[]).map(x => x.session_date).filter(dd => cm[dd] !== "deduct").sort();
        } else {
          billedDates = genClassDates(l).filter(dd => cm[dd] !== "deduct");
        }
        const billed = billedDates.length;
        const rate = tutorDailyRate(l.class_type, l.sessions_per_day);
        const amt = rate * billed;
        if (amt <= 0) continue;
        const noteKey = `튜터:${String(l.id).slice(0, 12)}`;
        const dsStr = billedDates.map(mdOf).filter(Boolean).join("·");
        const label = `튜터비 ${billed}회${dsStr ? ` (${dsStr})` : ""}`;
        const ex = tutByNote.get(noteKey);
        if (ex) {
          if (Number(ex.amount) !== amt || ex.label !== label) { tutUpdates.push({ id: ex.id, amount: amt, label }); tutCount++; }
        } else if (autoCreatedSet.has(`${amt}`)) {
          // 이미 자동 생성된 동일 금액 항목 존재 → 스킵
        } else {
          rows.push({ booking_id: sel.id, section: "class", kind: "charge", label, amount: amt, item_date: today10(), note: noteKey, status: "approved", recorded_by: "튜터인보이스" });
          tutCount++;
        }
      }

      // 변경된 기존 튜터 항목 갱신
      for (const u of tutUpdates) {
        await supabase.from("settlement_items").update({ amount: u.amount, label: u.label, item_date: today10() }).eq("id", u.id);
      }

      if (rows.length === 0 && tutUpdates.length === 0) {
        setImporting(false);
        toastErr("새로 가져오거나 변경된 항목이 없습니다.");
        return;
      }
      let insErr = null;
      if (rows.length > 0) { const { error } = await supabase.from("settlement_items").insert(rows); insErr = error; }
      setImporting(false);
      if (insErr) { toastErr("불러오기 실패: " + insErr.message); return; }
      const total = rows.reduce((a, r) => a + Number(r.amount || 0), 0);
      toastOk(`불러오기 완료 — 인보이스 ${invCount}건 · 튜터 ${tutCount}건${tutUpdates.length ? ` (갱신 ${tutUpdates.length})` : ""}`);
      loadItems(sel.id);
    } catch (e) {
      setImporting(false);
      toastErr("불러오기 오류: " + ((e as Error)?.message || ""));
    }
  }
  async function approveItem(id: string) {
    const { error } = await supabase.from("settlement_items").update({ status: "approved" }).eq("id", id);
    if (error) { toastErr("승인 실패: " + error.message); return; }
    toastOk("승인됐어요 (엄마 화면에 표시)");
    if (sel) loadItems(sel.id);
  }
  // 데모 공개 토글 — 지정한 예약만 엄마 포털에 정산내역 노출
  async function toggleOpen() {
    if (!sel) return;
    const next = !sel.settlement_open;
    const { error } = await supabase.from("bookings").update({ settlement_open: next }).eq("id", sel.id);
    if (error) { toastErr("변경 실패: " + error.message); return; }
    setSel({ ...sel, settlement_open: next });
    setBookings(prev => prev.map(b => b.id === sel.id ? { ...b, settlement_open: next } : b));
    toastOk(next ? "엄마에게 공개됨 (베타 대상)" : "엄마 공개 해제됨");
  }

  // ── 마감 ──
  async function setClose(part: "academy" | "final") {
    if (!sel) return;
    if (part === "final" && !window.confirm(`최종 마감하면 ${sel.booker_name}님께 "정산이 완료되었습니다" 알림이 전송됩니다. 진행할까요?`)) return;
    if (part === "academy" && !window.confirm("아카데미(수업·교재비) 정산을 마감할까요?")) return;
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { booking_id: sel.id, updated_at: now };
    if (part === "academy") { patch.academy_closed = true; patch.academy_closed_at = now; patch.academy_closed_by = "직원"; }
    else { patch.final_closed = true; patch.final_closed_at = now; patch.final_closed_by = "직원"; }
    const { error } = await supabase.from("settlement_status").upsert(patch, { onConflict: "booking_id" });
    if (error) { toastErr("마감 실패: " + error.message); return; }
    if (part === "final") {
      try {
        await fetch("/api/portal/push/send", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audience: "selected", target_ids: [sel.id], title: "정산 완료 안내", body: "정산이 완료되었습니다. 확인해 주세요!", url: "/portal/settlement" }),
        });
        toastOk("최종 마감 + 엄마 알림 전송 완료");
      } catch { toastOk("최종 마감 완료 (알림 전송은 확인 필요)"); }
    } else toastOk("아카데미 마감 완료");
    loadStatus(sel.id);
  }
  async function reopen() {
    if (!sel || !window.confirm("마감을 해제할까요?")) return;
    const { error } = await supabase.from("settlement_status").upsert({ booking_id: sel.id, academy_closed: false, final_closed: false, updated_at: new Date().toISOString() }, { onConflict: "booking_id" });
    if (error) { toastErr("마감 해제 실패: " + error.message); return; }
    toastOk("마감 해제됨");
    loadStatus(sel.id);
  }

  // ── 인쇄 (1장 자동 축소) ──
  function buildPrint() {
    if (!sel) return;
    const dRows = depositItems.filter(i => i.status === "approved").map(i => { const tag = i.kind === "deduct" ? "차감" : i.kind === "refund" ? "환불" : "보증금"; return `<tr><td class="d">${i.item_date || ""}</td><td><b style="font-size:10px;color:${i.kind === "deduct" ? "#dc2626" : "#166534"}">[${tag}]</b> ${esc(i.label)}${i.note ? ` <span class="nt">${esc(i.note)}</span>` : ""}</td><td class="a ${i.kind === "deduct" ? "minus" : "plus"}">${i.kind === "deduct" ? "−" : "+"}${peso(Number(i.amount))}</td></tr>`; }).join("") || `<tr><td colspan="3" class="empty">내역 없음</td></tr>`;
    const cRows = classItems.filter(i => i.status === "approved").map(i => { const pay = i.kind === "payment"; return `<tr><td class="d">${i.item_date || ""}</td><td><b style="font-size:10px;color:${pay ? "#6d28d9" : "#1d4ed8"}">[${pay ? "납부" : "청구"}]</b> ${esc(i.label)}${i.note ? ` <span class="nt">${esc(i.note)}</span>` : ""}</td><td class="a ${pay ? "minus" : "plus"}">${pay ? "−" : "+"}${peso(Number(i.amount))}</td></tr>`; }).join("") || `<tr><td colspan="3" class="empty">내역 없음</td></tr>`;
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"/><title>정산내역 - ${esc(sel.booker_name || "")}</title>
<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
body{font-family:'Noto Sans KR',Arial,sans-serif;color:#1a1a2e;background:#fff}
#cdwrap{overflow:hidden}#cdsheet{padding:22px 26px;transform-origin:top center}
.hd{display:flex;align-items:baseline;gap:10px;border-bottom:3px solid #4f46e5;padding-bottom:10px;margin-bottom:16px}
.hd h1{font-size:22px;font-weight:900}.hd .sub{font-size:13px;color:#64748b}
.sec-t{font-size:13px;font-weight:800;margin:14px 0 6px;padding:6px 10px;border-radius:6px}
.sec-dep{background:#ecfdf5;color:#047857}.sec-cls{background:#eff6ff;color:#1d4ed8}
table{width:100%;border-collapse:collapse;font-size:13px}
td{border-bottom:1px solid #e2e8f0;padding:8px 10px;vertical-align:top}
td.d{width:80px;color:#94a3b8}td.a{width:120px;text-align:right;font-weight:700}
td.a.minus{color:#dc2626}td.a.plus{color:#166534}.nt{color:#94a3b8;font-size:11px}
td.empty{color:#cbd5e1;text-align:center}
.tot{display:flex;gap:14px;margin-top:16px}
.tot .box{flex:1;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px 14px}
.tot .lb{font-size:12px;color:#64748b}.tot .vl{font-size:20px;font-weight:900;margin-top:3px}
.refund .vl{color:#047857}
.foot{margin-top:18px;font-size:11px;color:#94a3b8;line-height:1.6}
@media print{@page{size:A4;margin:12mm}}
</style></head><body>
<div id="cdwrap"><div id="cdsheet">
<div class="hd"><h1>정산내역</h1><span class="sub">${esc(sel.booker_name || "")} · ${esc(sel.house_no || sel.accom_room || "")} · ${today10()}</span></div>
<div class="sec-t sec-dep">🏠 보증금 정산 (받은 보증금 ${peso(depRecv)})</div>
<table>${dRows}</table>
<div class="sec-t sec-cls">💰 수업 · 교재비 등</div>
<table>${cRows}</table>
<div class="tot">
  <div class="box refund"><div class="lb">① 보증금 환불 예정</div><div class="vl">${peso(depositRefund)}</div></div>
  <div class="box"><div class="lb">② 수업·교재비 받을 잔액 (청구 ${peso(classCharge)}${classPaid ? ` − 납부 ${peso(classPaid)}` : ""})</div><div class="vl">${peso(classDue)}</div></div>
  <div class="box final" style="background:${finalNet >= 0 ? "#0f5132" : "#7f1d1d"};color:#fff;border:none"><div class="lb" style="color:#fff;opacity:.85">최종 ${finalNet >= 0 ? "환불" : "납부"} (①−②)</div><div class="vl" style="color:#fff">${peso(Math.abs(finalNet))}</div></div>
</div>
<div class="foot">※ 본 정산내역은 현지 지불 금액 기준입니다. 보증금은 차감 항목을 제외하고 환급됩니다. 문의는 담당 매니저에게 연락 주세요.</div>
</div></div>
<script>(function(){function fit(){var w=document.getElementById('cdwrap'),s=document.getElementById('cdsheet');if(!w||!s)return;s.style.transform='';w.style.height='';var maxH=Math.round(273/25.4*96);var h=s.scrollHeight;if(h>maxH){var f=maxH/h;s.style.transform='scale('+f+')';w.style.height=(h*f)+'px';}}if(document.readyState!=='loading')fit();else document.addEventListener('DOMContentLoaded',fit);window.addEventListener('load',fit);})();</script>
</body></html>`;
    setPrintHtml(html);
  }

  if (!authed) return null;

  if (printHtml) return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: "column", background: "#334155" }}>
      <div style={{ padding: "10px 16px", background: "#1e293b", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={() => setPrintHtml("")} style={{ padding: "7px 16px", background: "#475569", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✕ 닫기</button>
        <span style={{ color: "#94a3b8", fontSize: 13, flex: 1 }}>정산내역 미리보기 — 자동으로 1장에 맞춰집니다</span>
        <button onClick={() => { (document.getElementById("st-iframe") as HTMLIFrameElement)?.contentWindow?.print(); }} style={{ padding: "7px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🖨 인쇄 / PDF</button>
      </div>
      <iframe id="st-iframe" srcDoc={printHtml} style={{ flex: 1, border: "none", background: "#fff" }} title="정산내역 인쇄 미리보기" />
    </div>
  );

  return (
    <div style={{ maxWidth: 1020, margin: "0 auto", padding: "28px 20px 60px", fontFamily: "'Noto Sans KR',sans-serif", color: "#1a1a2e" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <button onClick={() => router.push("/admin/hub")} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontWeight: 600 }}>← 관리자 홈</button>
        <h1 style={{ fontSize: 22, fontWeight: 800, flex: 1 }}>🧾 정산 관리</h1>
        <button onClick={() => setPresetMgr(true)} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>⚙️ 자주 쓰는 항목</button>
      </div>
      <p style={{ fontSize: 13, color: "#6b7c93", marginBottom: 18 }}>현지 지불 금액만 정산합니다 (원화 잔금입금 제외). 보증금 정산 / 수업·교재비를 기록하고, 최종 마감 시 엄마에게 알림이 전송됩니다. <b style={{ color: "#7c3aed" }}>※ 베타: 예약별 "엄마 공개" 토글을 켠 예약만 엄마 포털에 정산내역이 보입니다.</b></p>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
        {/* 예약 선택 */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", gap: 5, marginBottom: 9 }}>
              {([["staying", `🟢 투숙중${stayingCount ? ` ${stayingCount}` : ""}`], ["upcoming", "📅 예정"], ["all", "전체"]] as [typeof listFilter, string][]).map(([k, lbl]) => (
                <button key={k} onClick={() => setListFilter(k)} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "7px 0", borderRadius: 7, border: `1px solid ${listFilter === k ? "#16a34a" : "#e2e8f0"}`, background: listFilter === k ? "#dcfce7" : "#fff", color: listFilter === k ? "#15803d" : "#64748b", cursor: "pointer", fontFamily: "inherit" }}>{lbl}</button>
              ))}
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색 (이름·예약번호·방번호) — 검색 시 전체에서 찾음" style={{ width: "100%", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {filtered.map(b => {
              const today = today10();
              const staying = !!(b.checkin_date && b.checkin_date <= today && (!b.checkout_date || b.checkout_date >= today));
              return (
                <div key={b.id} onClick={() => setSel(b)} style={{ padding: "10px 13px", cursor: "pointer", borderBottom: "1px solid #f8fafc", background: sel?.id === b.id ? "#eff6ff" : "#fff" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    {b.booker_name || "(이름없음)"}
                    {staying && <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: "#dcfce7", color: "#15803d" }}>투숙중</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{b.house_no || b.accom_room || ""} {b.checkin_date ? `· ${b.checkin_date}` : ""}</div>
                  {studentNames(b) && <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>👦 {studentNames(b)}</div>}
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: 16, color: "#cbd5e1", fontSize: 13 }}>{search ? "검색 결과가 없습니다" : listFilter === "staying" ? "현재 투숙중인 예약이 없습니다 (전체 탭에서 확인)" : "예약이 없습니다"}</div>}
          </div>
        </div>

        {/* 정산 상세 */}
        <div>
          {!sel ? (
            <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12, padding: 50, textAlign: "center", color: "#94a3b8" }}>왼쪽에서 예약을 선택하세요</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{sel.booker_name} <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{sel.house_no || sel.accom_room || ""}</span></div>
                <button onClick={toggleOpen} title="지정한 예약만 엄마 포털에 정산내역이 보입니다 (데모)" style={{ marginLeft: "auto", background: sel.settlement_open ? "#dcfce7" : "#f1f5f9", border: `1px solid ${sel.settlement_open ? "#86efac" : "#e2e8f0"}`, color: sel.settlement_open ? "#15803d" : "#64748b", borderRadius: 8, padding: "7px 13px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{sel.settlement_open ? "👩‍👧 엄마 공개 ON (베타)" : "🔒 엄마 비공개"}</button>
                <button onClick={importInvoice} disabled={importing} style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", borderRadius: 8, padding: "7px 13px", cursor: "pointer", fontWeight: 700, fontSize: 13, opacity: importing ? 0.6 : 1 }}>{importing ? "불러오는 중…" : "📄 인보이스 불러오기"}</button>
                <button onClick={buildPrint} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 13px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>🖨 인쇄</button>
              </div>

              {/* 마감 바 */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
                <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 700 }}>정산 마감</span>
                {status?.academy_closed
                  ? <span style={{ fontSize: 11.5, background: "#dcfce7", color: "#166534", padding: "3px 10px", borderRadius: 8, fontWeight: 700 }}>✓ 아카데미 마감</span>
                  : <button onClick={() => setClose("academy")} style={{ fontSize: 12.5, background: "#fff", border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600 }}>아카데미 마감</button>}
                {status?.final_closed
                  ? <span style={{ fontSize: 11.5, background: "#dbeafe", color: "#1d4ed8", padding: "3px 10px", borderRadius: 8, fontWeight: 700 }}>🔒 최종 마감 완료 · 엄마 알림 전송됨</span>
                  : <button onClick={() => setClose("final")} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, background: "#0f172a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>🔒 드림하우스 최종마감 → 엄마 알림</button>}
                {(status?.academy_closed || status?.final_closed) && <button onClick={reopen} style={{ fontSize: 11.5, background: "none", border: "none", color: "#94a3b8", cursor: "pointer", textDecoration: "underline" }}>마감 해제</button>}
              </div>

              {/* 보증금 정산 */}
              <SectionBlock title="🏠 보증금 정산" color="#047857" sub={`받은 보증금 ${peso(depRecv)}`} items={depositItems} onAdd={() => openAdd("deposit")} onDel={delItem} onApprove={approveItem} />
              {/* 수업·교재비 */}
              <SectionBlock title="💰 수업 · 교재비 등" color="#1d4ed8" items={classItems} onAdd={() => openAdd("class")} onDel={delItem} onApprove={approveItem} />

              {/* 합계 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
                <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "13px 15px" }}>
                  <div style={{ fontSize: 12, color: "#047857", fontWeight: 700 }}>① 보증금 환불 예정</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#047857", marginTop: 3 }}>{peso(depositRefund)}</div>
                  <div style={{ fontSize: 11, color: "#6b7c93", marginTop: 4 }}>{peso(depRecv)} − 차감 {peso(depDeduct)}{depRefund ? ` + 환불 ${peso(depRefund)}` : ""}</div>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "13px 15px" }}>
                  <div style={{ fontSize: 12, color: "#6b7c93", fontWeight: 700 }}>② 수업·교재비 받을 잔액</div>
                  <div style={{ fontSize: 20, fontWeight: 900, marginTop: 3, color: classDue < 0 ? "#6d28d9" : "#1a1a2e" }}>{peso(classDue)}</div>
                  <div style={{ fontSize: 11, color: "#6b7c93", marginTop: 4 }}>청구 {peso(classCharge)}{classPaid ? ` − 납부 ${peso(classPaid)}` : ""}</div>
                </div>
              </div>
              {/* 최종 환불 / 납부 = ① − ② */}
              <div style={{ marginTop: 10, background: finalNet >= 0 ? "#0f5132" : "#7f1d1d", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, color: "#fff" }}>
                <div>
                  <div style={{ fontSize: 12.5, opacity: 0.85, fontWeight: 600 }}>최종 {finalNet >= 0 ? "환불" : "납부"} 금액 <span style={{ opacity: 0.7 }}>(① − ②)</span></div>
                  <div style={{ fontSize: 28, fontWeight: 900, marginTop: 2 }}>{peso(Math.abs(finalNet))}</div>
                </div>
                <div style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, background: "rgba(255,255,255,0.18)", padding: "8px 16px", borderRadius: 20 }}>
                  {finalNet >= 0 ? "⬅ 엄마에게 환불" : "➡ 엄마가 추가 납부"}
                </div>
              </div>
              {loading && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 10 }}>불러오는 중…</div>}
            </>
          )}
        </div>
      </div>

      {/* 항목 추가 모달 */}
      {addOpen && sel && (
        <div onClick={() => setAddOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, width: "100%", maxWidth: 480, maxHeight: "86vh", overflowY: "auto" }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>항목 추가 — {aSection === "deposit" ? "보증금 정산" : "수업·교재비"}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>자주 쓰는 항목을 누르면 자동 입력됩니다. 특이사항은 직접 입력하세요.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
              {presets.filter(p => p.section === aSection).map(p => (
                <button key={p.id} onClick={() => pickPreset(p)} style={{ fontSize: 12.5, background: aLabel === p.label ? "#eef2ff" : "#fff", border: `1px solid ${aLabel === p.label ? "#a5b4fc" : "#cbd5e1"}`, color: aLabel === p.label ? "#4338ca" : "#475569", padding: "7px 13px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit" }}>
                  {p.label}{p.default_amount ? ` ${peso(Number(p.default_amount))}` : ""}
                </button>
              ))}
              {presets.filter(p => p.section === aSection).length === 0 && <span style={{ fontSize: 12, color: "#cbd5e1" }}>등록된 자주 쓰는 항목이 없습니다 (⚙️에서 추가)</span>}
            </div>
            <div style={{ display: "grid", gap: 9 }}>
              {aSection === "deposit" ? (
                <div style={{ display: "flex", gap: 6 }}>
                  {(["deposit", "deduct", "refund"] as Kind[]).map(k => (
                    <button key={k} onClick={() => setAKind(k)} style={{ flex: 1, fontSize: 12.5, padding: "7px 0", borderRadius: 8, border: `1px solid ${aKind === k ? "#4f46e5" : "#e2e8f0"}`, background: aKind === k ? "#eef2ff" : "#fff", color: aKind === k ? "#4338ca" : "#64748b", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>{k === "deposit" ? "보증금 +" : k === "deduct" ? "차감 −" : "환불 +"}</button>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  {(["charge", "payment"] as Kind[]).map(k => (
                    <button key={k} onClick={() => setAKind(k)} style={{ flex: 1, fontSize: 12.5, padding: "7px 0", borderRadius: 8, border: `1px solid ${aKind === k ? "#4f46e5" : "#e2e8f0"}`, background: aKind === k ? "#eef2ff" : "#fff", color: aKind === k ? "#4338ca" : "#64748b", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>{k === "charge" ? "청구 + (받을 돈)" : "납부 − (받은 돈)"}</button>
                  ))}
                </div>
              )}
              <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>항목명{aNeedsDates && <span style={{ color: "#d97706", fontWeight: 600 }}> · 날짜 포함 권장 (예: 튜터 8회 (6/2·3·4·5·6))</span>}</label>
              <input value={aLabel} onChange={e => setALabel(e.target.value)} placeholder="예: 튜터 8회 (6/2·3·4·5·6·9·10·11)" style={{ padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <input value={aAmount} onChange={e => setAAmount(e.target.value)} type="number" placeholder="금액 ₱" style={{ flex: 1, padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
                <input value={aDate} onChange={e => setADate(e.target.value)} type="date" style={{ padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
              </div>
              <input value={aNote} onChange={e => setANote(e.target.value)} placeholder="메모 (선택)" style={{ padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setAddOpen(false)} style={{ flex: 1, padding: "10px 0", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>취소</button>
              <button onClick={saveItem} disabled={saving} style={{ flex: 2, padding: "10px 0", border: "none", background: "#2563eb", color: "#fff", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: saving ? 0.7 : 1 }}>{saving ? "저장 중…" : "추가"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 자주 쓰는 항목 관리 모달 */}
      {presetMgr && <PresetManager presets={presets} onClose={() => { setPresetMgr(false); loadPresets(); }} reload={loadPresets} />}
    </div>
  );
}

function esc(s: string) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

const KIND_TAG: Record<string, { lbl: string; bg: string; c: string; sign: string }> = {
  deposit: { lbl: "보증금", bg: "#dcfce7", c: "#166534", sign: "+" },
  deduct: { lbl: "차감", bg: "#fef2f2", c: "#dc2626", sign: "−" },
  refund: { lbl: "환불", bg: "#dcfce7", c: "#166534", sign: "+" },
  charge: { lbl: "청구", bg: "#eff6ff", c: "#1d4ed8", sign: "+" },
  payment: { lbl: "납부", bg: "#f5f3ff", c: "#6d28d9", sign: "−" },
};

function SectionBlock({ title, color, sub, items, onAdd, onDel, onApprove }: { title: string; color: string; sub?: string; items: Item[]; onAdd: () => void; onDel: (id: string) => void; onApprove: (id: string) => void }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid #f1f5f9" }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color }}>{title}</span>
        {sub && <span style={{ fontSize: 11.5, color: "#94a3b8" }}>{sub}</span>}
        <button onClick={onAdd} style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "#2563eb", background: "#eff6ff", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer" }}>+ 항목</button>
      </div>
      {items.length === 0 ? <div style={{ padding: 16, color: "#cbd5e1", fontSize: 12.5, textAlign: "center" }}>내역이 없습니다</div>
        : items.map(it => {
          const tg = KIND_TAG[it.kind] || { lbl: it.kind, bg: "#f1f5f9", c: "#475569", sign: "" };
          return (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", borderBottom: "1px solid #f8fafc", background: it.status !== "approved" ? "#fffbeb" : "transparent" }}>
            <span style={{ fontSize: 11.5, color: "#94a3b8", width: 62, flexShrink: 0 }}>{it.item_date || "-"}</span>
            <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: tg.bg, color: tg.c, flexShrink: 0 }}>{tg.lbl}</span>
            <span style={{ flex: 1, fontSize: 13, minWidth: 0 }}>{it.label}{it.note && <span style={{ color: "#94a3b8", fontSize: 11 }}> · {it.note}</span>}{it.status !== "approved" && <span style={{ color: "#b45309", fontSize: 11, fontWeight: 700 }}> · 승인대기</span>}</span>
            <b style={{ fontSize: 13, flexShrink: 0, color: tg.c }}>{tg.sign}{peso(Number(it.amount))}</b>
            {it.status !== "approved" && <button onClick={() => onApprove(it.id)} style={{ border: "none", background: "#16a34a", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>승인</button>}
            <button onClick={() => onDel(it.id)} style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 15, flexShrink: 0 }}>×</button>
          </div>);
        })}
    </div>
  );
}

function PresetManager({ presets, onClose, reload }: { presets: Preset[]; onClose: () => void; reload: () => void }) {
  const [all, setAll] = useState<Preset[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [nSection, setNSection] = useState<Section>("class");
  const [nKind, setNKind] = useState<Kind>("charge");
  const [nLabel, setNLabel] = useState("");
  const [nAmount, setNAmount] = useState("");
  const [nDates, setNDates] = useState(false);
  const loadAll = useCallback(async () => {
    const { data } = await supabase.from("settlement_presets").select("*").order("section").order("sort");
    setAll((data || []) as Preset[]);
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);
  function resetForm() { setEditId(null); setNLabel(""); setNAmount(""); setNDates(false); setNSection("class"); setNKind("charge"); }
  function startEdit(p: Preset) { setEditId(p.id); setNSection(p.section as Section); setNKind(p.kind as Kind); setNLabel(p.label); setNAmount(p.default_amount ? String(p.default_amount) : ""); setNDates(!!p.needs_dates); }
  async function save() {
    if (!nLabel.trim()) { toastErr("항목명을 입력하세요"); return; }
    const payload = { section: nSection, kind: nKind, label: nLabel.trim(), default_amount: nAmount ? Number(nAmount) : null, needs_dates: nDates };
    if (editId) {
      const { error } = await supabase.from("settlement_presets").update(payload).eq("id", editId);
      if (error) { toastErr("수정 실패: " + error.message); return; }
      toastOk("수정됐어요");
    } else {
      const { error } = await supabase.from("settlement_presets").insert({ ...payload, sort: (all.length + 1) * 10, active: true });
      if (error) { toastErr("추가 실패: " + error.message); return; }
      toastOk("추가됐어요");
    }
    resetForm(); loadAll(); reload();
  }
  async function del(id: string) {
    if (!confirm("이 자주 쓰는 항목을 삭제할까요?")) return;
    await supabase.from("settlement_presets").delete().eq("id", id);
    if (editId === id) resetForm();
    loadAll(); reload();
  }
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", fontFamily: "'Noto Sans KR',sans-serif" }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>⚙️ 자주 쓰는 항목 관리</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>여기 등록한 항목이 각 예약의 "+ 항목" 모달에 칩으로 나타납니다.</div>
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 16, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <select value={nSection} onChange={e => { const s = e.target.value as Section; setNSection(s); setNKind(s === "deposit" ? "deduct" : "charge"); }} style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, fontFamily: "inherit" }}>
              <option value="class">수업·교재비</option>
              <option value="deposit">보증금 정산</option>
            </select>
            {nSection === "deposit" && (
              <select value={nKind} onChange={e => setNKind(e.target.value as Kind)} style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, fontFamily: "inherit" }}>
                <option value="deposit">보증금 +</option>
                <option value="deduct">차감 −</option>
                <option value="refund">환불 +</option>
              </select>
            )}
          </div>
          <input value={nLabel} onChange={e => setNLabel(e.target.value)} placeholder="항목명 (예: 전기세 / 튜터비 / 교재비)" style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={nAmount} onChange={e => setNAmount(e.target.value)} type="number" placeholder="기본 금액 ₱ (선택)" style={{ flex: 1, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, fontFamily: "inherit" }} />
            <label style={{ fontSize: 12.5, color: "#475569", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><input type="checkbox" checked={nDates} onChange={e => setNDates(e.target.checked)} /> 날짜 표기 권장</label>
            {editId && <button onClick={resetForm} style={{ border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", borderRadius: 7, padding: "9px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>취소</button>}
            <button onClick={save} style={{ border: "none", background: editId ? "#16a34a" : "#2563eb", color: "#fff", borderRadius: 7, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{editId ? "수정 저장" : "추가"}</button>
          </div>
        </div>
        {(["deposit", "class"] as Section[]).map(sec => (
          <div key={sec} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: sec === "deposit" ? "#047857" : "#1d4ed8", marginBottom: 6 }}>{sec === "deposit" ? "🏠 보증금 정산" : "💰 수업·교재비"}</div>
            {all.filter(p => p.section === sec).map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #f1f5f9", background: editId === p.id ? "#eff6ff" : "transparent" }}>
                <span style={{ fontSize: 13, flex: 1 }}>{p.label}{p.default_amount ? <span style={{ color: "#94a3b8" }}> · {peso(Number(p.default_amount))}</span> : ""}{p.needs_dates && <span style={{ color: "#d97706", fontSize: 11 }}> · 날짜</span>}{p.kind === "deduct" && <span style={{ color: "#dc2626", fontSize: 11 }}> · 차감</span>}{p.kind === "refund" && <span style={{ color: "#166534", fontSize: 11 }}> · 환불</span>}</span>
                <button onClick={() => startEdit(p)} style={{ border: "none", background: "none", color: "#2563eb", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>수정</button>
                <button onClick={() => del(p.id)} style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 15 }}>×</button>
              </div>
            ))}
            {all.filter(p => p.section === sec).length === 0 && <div style={{ fontSize: 12, color: "#cbd5e1", padding: "4px 0" }}>없음</div>}
          </div>
        ))}
        <button onClick={onClose} style={{ width: "100%", padding: "10px 0", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13, marginTop: 6 }}>닫기</button>
      </div>
    </div>
  );
}
