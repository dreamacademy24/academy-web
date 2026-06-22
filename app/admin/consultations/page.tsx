"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Slot {
  id: string; slot_date: string; slot_time: string; duration_min: number;
  status: "available" | "booked";
  booked_name: string | null; booked_student: string | null; booked_at: string | null;
}
interface Invite { id: string; booking_id: string; notified: boolean }
interface Consultation {
  id: string; title: string; description: string | null;
  target_type: "all" | "selected"; status: "draft" | "published" | "closed";
  created_at: string; consultation_slots: Slot[]; consultation_invites: Invite[];
}
interface Booking {
  id: string; booker_name: string; reservation_no: string;
  checkin_date: string; checkout_date?: string; house_no?: string;
  accom_room?: string; students?: any;
}

const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];
function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()} (${DAY_KR[dt.getDay()]})`;
}
function stuNames(b: Booking): string {
  const raw = b.students;
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") { try { const p = JSON.parse(raw); if (Array.isArray(p)) arr = p; } catch {} }
  return arr.map((s: any) => s?.name_kr || s?.korName || s?.name || "").filter(Boolean).join(", ");
}
function today10() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminConsultationsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [list, setList] = useState<Consultation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [sel, setSel] = useState<Consultation | null>(null);
  const [mode, setMode] = useState<"view" | "create">("view");
  // create form
  const [fDesc, setFDesc] = useState("");
  const [fTarget, setFTarget] = useState<"all" | "selected">("all");
  const [fSlots, setFSlots] = useState<{ date: string; time: string }[]>([]);
  const [fInvites, setFInvites] = useState<string[]>([]);
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("14:00");
  // invite search & filter
  const [invSearch, setInvSearch] = useState("");
  const [invFilter, setInvFilter] = useState<"staying" | "upcoming" | "all">("staying");
  // add slot to detail
  const [addDate, setAddDate] = useState("");
  const [addTime, setAddTime] = useState("14:00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    setReady(true);
  }, [router]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/consultations");
    const j = await res.json();
    if (j.consultations) setList(j.consultations);
  }, []);

  const loadBookings = useCallback(async () => {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, booker_name, reservation_no, checkin_date, checkout_date, house_no, accom_room, students")
      .not("status", "eq", "cancelled")
      .order("checkin_date", { ascending: false });
    if (error) console.error("loadBookings error:", error.message);
    if (data) {
      const t = today10();
      const rank = (b: Booking) => {
        const ci = b.checkin_date || "", co = b.checkout_date || "";
        if (ci && ci <= t && (!co || co >= t)) return 0;
        if (ci && ci > t) return 1;
        return 2;
      };
      const sorted = (data as Booking[]).sort((a, b) => {
        const ra = rank(a), rb = rank(b);
        if (ra !== rb) return ra - rb;
        return (b.checkin_date || "").localeCompare(a.checkin_date || "");
      });
      setBookings(sorted);
    }
  }, []);

  useEffect(() => { if (ready) { load(); loadBookings(); } }, [ready, load, loadBookings]);

  const isStaying = (b: Booking) => { const t = today10(); return !!(b.checkin_date && b.checkin_date <= t && (!b.checkout_date || b.checkout_date >= t)); };
  const isUpcoming = (b: Booking) => { const t = today10(); return !!(b.checkin_date && b.checkin_date > t); };
  const stayingCount = useMemo(() => bookings.filter(isStaying).length, [bookings]);

  const filteredBookings = useMemo(() => {
    const q = invSearch.trim().toLowerCase();
    let base = bookings;
    if (q) base = base.filter(b => `${b.booker_name || ""} ${b.reservation_no || ""} ${b.house_no || b.accom_room || ""} ${stuNames(b)}`.toLowerCase().includes(q));
    else if (invFilter === "staying") base = base.filter(isStaying);
    else if (invFilter === "upcoming") base = base.filter(isUpcoming);
    return base;
  }, [bookings, invSearch, invFilter]);

  // 시간 옵션 (9:00 ~ 18:00, 20분 간격)
  const timeOptions: string[] = [];
  for (let h = 9; h <= 18; h++) {
    for (const m of [0, 20, 40]) {
      if (h === 18 && m > 0) break;
      timeOptions.push(`${h}:${String(m).padStart(2, "0")}`);
    }
  }

  function addSlot() {
    if (!slotDate) return alert("날짜를 선택해주세요");
    const dup = fSlots.some((s) => s.date === slotDate && s.time === slotTime);
    if (dup) return alert("이미 추가된 슬롯입니다");
    setFSlots([...fSlots, { date: slotDate, time: slotTime }].sort((a, b) =>
      `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
    ));
  }
  function removeSlot(i: number) { setFSlots(fSlots.filter((_, idx) => idx !== i)); }
  function toggleInvite(bid: string) {
    setFInvites((prev) => prev.includes(bid) ? prev.filter((x) => x !== bid) : [...prev, bid]);
  }

  function autoTitle() {
    if (fSlots.length === 0) return "학습 상담";
    const first = fSlots[0].date;
    const dt = new Date(first + "T00:00:00");
    return `${dt.getMonth() + 1}월 학습 상담`;
  }

  async function createConsultation(publish: boolean) {
    if (!fDesc.trim()) return alert("안내 내용을 입력해주세요");
    if (fSlots.length === 0) return alert("시간 슬롯을 1개 이상 추가해주세요");
    if (fTarget === "selected" && fInvites.length === 0) return alert("대상 엄마를 1명 이상 선택해주세요");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: autoTitle(), description: fDesc || null, target_type: fTarget,
          slots: fSlots, invite_booking_ids: fTarget === "selected" ? fInvites : [],
          status: publish ? "published" : "draft",
        }),
      });
      const j = await res.json();
      if (!res.ok) return alert(j.error || "생성 실패");
      alert(publish ? "✅ 배포되었습니다" : "✅ 임시저장되었습니다");
      resetForm(); load(); setMode("view");
    } finally { setSaving(false); }
  }
  function resetForm() { setFDesc(""); setFTarget("all"); setFSlots([]); setFInvites([]); setInvSearch(""); }

  function startCreate() { resetForm(); setMode("create"); setSel(null); }
  function backToList() { setMode("view"); }

  async function publishConsultation(c: Consultation) {
    if (!confirm("배포하시겠습니까? 엄마들이 볼 수 있게 됩니다.")) return;
    const res = await fetch("/api/admin/consultations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, status: "published" }) });
    if (res.ok) { alert("✅ 배포 완료"); load(); if (sel?.id === c.id) refreshDetail(c.id); }
  }
  async function closeConsultation(c: Consultation) {
    if (!confirm("마감하시겠습니까?")) return;
    const res = await fetch("/api/admin/consultations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, status: "closed" }) });
    if (res.ok) { alert("✅ 마감 완료"); load(); if (sel?.id === c.id) refreshDetail(c.id); }
  }
  async function deleteConsultation(c: Consultation) {
    if (!confirm(`"${c.title}" 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/admin/consultations?id=${c.id}`, { method: "DELETE" });
    if (res.ok) { alert("삭제 완료"); if (sel?.id === c.id) setSel(null); load(); }
  }
  async function addSlotToDetail() {
    if (!sel || !addDate) return;
    const res = await fetch("/api/admin/consultations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sel.id, add_slots: [{ date: addDate, time: addTime }] }) });
    if (res.ok) { setAddDate(""); load(); refreshDetail(sel.id); }
  }
  async function removeDetailSlot(slotId: string) {
    if (!sel || !confirm("이 슬롯을 삭제합니까?")) return;
    const res = await fetch("/api/admin/consultations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: sel.id, remove_slot_ids: [slotId] }) });
    if (res.ok) { load(); refreshDetail(sel.id); }
  }
  async function refreshDetail(id: string) {
    const res = await fetch("/api/admin/consultations");
    const j = await res.json();
    const found = j.consultations?.find((c: Consultation) => c.id === id);
    if (found) setSel(found);
  }

  if (!ready) return null;

  const SB: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: "#f1f5f9", color: "#64748b", label: "임시저장" },
    published: { bg: "#dcfce7", color: "#16a34a", label: "배포 중" },
    closed: { bg: "#fee2e2", color: "#dc2626", label: "마감" },
  };

  /* ── 좌측: 상담 목록 카드 ── */
  const LeftConsultationList = () => (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 14, flex: 1 }}>📋 상담 목록</span>
        <button onClick={startCreate} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #1a6fc4", background: "#eff6ff", color: "#1a6fc4", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ 새 상담</button>
      </div>
      <div style={{ maxHeight: 560, overflowY: "auto" }}>
        {list.length === 0 && <div style={{ padding: 24, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>등록된 상담이 없습니다</div>}
        {list.map(c => {
          const total = c.consultation_slots?.length || 0;
          const booked = c.consultation_slots?.filter(s => s.status === "booked").length || 0;
          const sb = SB[c.status] || SB.draft;
          const active = sel?.id === c.id;
          return (
            <div key={c.id} onClick={() => { setSel(c); setMode("view"); }}
              style={{ padding: "12px 14px", cursor: "pointer", borderBottom: "1px solid #f8fafc", background: active ? "#eff6ff" : "#fff", transition: "background 120ms" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={c.description || c.title}>{c.description || c.title}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 8, background: sb.bg, color: sb.color, flexShrink: 0 }}>{sb.label}</span>
              </div>
              <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#64748b", alignItems: "center" }}>
                <span>슬롯 {total}</span>
                <span style={{ color: "#16a34a", fontWeight: 700 }}>예약 {booked}</span>
                {c.target_type === "selected" && <span style={{ color: "#b45309", fontWeight: 600 }}>특정</span>}
                <span style={{ marginLeft: "auto", color: "#cbd5e1", fontSize: 10 }}>{new Date(c.created_at).toLocaleDateString("ko-KR")}</span>
              </div>
              {total > 0 && <div style={{ height: 4, borderRadius: 2, background: "#e2e8f0", marginTop: 6, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#1a6fc4,#38bdf8)", width: `${(booked / total) * 100}%`, transition: "width 300ms" }} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── 좌측: 대상 선택 (생성 모드에서 "특정 대상" 선택 시) ── */
  const LeftBookingSelect = () => (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>👩 대상 선택</div>
        <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
          {([["staying", `🟢 투숙중${stayingCount ? ` ${stayingCount}` : ""}`], ["upcoming", "📅 예정"], ["all", "전체"]] as [typeof invFilter, string][]).map(([k, lbl]) => (
            <button key={k} onClick={() => { setInvFilter(k); setInvSearch(""); }}
              style={{ flex: 1, fontSize: 11, fontWeight: 700, padding: "6px 0", borderRadius: 7, border: `1px solid ${invFilter === k ? "#1a6fc4" : "#e2e8f0"}`, background: invFilter === k ? "#eff6ff" : "#fff", color: invFilter === k ? "#1a6fc4" : "#64748b", cursor: "pointer", fontFamily: "inherit" }}>{lbl}</button>
          ))}
        </div>
        <input value={invSearch} onChange={e => setInvSearch(e.target.value)}
          placeholder="검색 (이름·방번호)"
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12, fontFamily: "inherit", outline: "none" }} />
        <div style={{ fontSize: 11, color: "#1a6fc4", fontWeight: 700, marginTop: 6 }}>
          ✅ {fInvites.length}명 선택됨 {fInvites.length > 0 && <span onClick={() => setFInvites([])} style={{ color: "#dc2626", cursor: "pointer", marginLeft: 6 }}>해제</span>}
        </div>
      </div>
      <div style={{ maxHeight: 440, overflowY: "auto" }}>
        {filteredBookings.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>표시할 예약 없음</div>}
        {filteredBookings.map(b => {
          const checked = fInvites.includes(b.id);
          const staying = isStaying(b);
          const room = b.house_no || b.accom_room || "";
          const stu = stuNames(b);
          return (
            <div key={b.id} onClick={() => toggleInvite(b.id)}
              style={{ padding: "9px 13px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, background: checked ? "#eff6ff" : "transparent" }}>
              <input type="checkbox" checked={checked} readOnly style={{ width: 15, height: 15, accentColor: "#1a6fc4", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{b.booker_name}</span>
                  {staying && <span style={{ fontSize: 9, fontWeight: 700, background: "#dcfce7", color: "#16a34a", padding: "1px 5px", borderRadius: 6 }}>투숙중</span>}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>
                  {room && <span>{room} · </span>}{b.checkin_date}
                </div>
                {stu && <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>👶 {stu}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── 우측: 상세 뷰 ── */
  const RightDetail = () => {
    if (!sel) return (
      <div style={{ background: "#fff", border: "2px dashed #e2e8f0", borderRadius: 12, padding: 60, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
        ← 왼쪽에서 상담을 선택하세요
      </div>
    );

    const slots = [...(sel.consultation_slots || [])].sort((a, b) =>
      `${a.slot_date} ${a.slot_time}`.localeCompare(`${b.slot_date} ${b.slot_time}`)
    );
    const total = slots.length;
    const booked = slots.filter(s => s.status === "booked").length;
    const sb = SB[sel.status] || SB.draft;
    const bookedSlots = slots.filter(s => s.status === "booked");
    const availSlots = slots.filter(s => s.status === "available");
    // 날짜별 그룹
    const byDate: Record<string, Slot[]> = {};
    for (const s of slots) { if (!byDate[s.slot_date]) byDate[s.slot_date] = []; byDate[s.slot_date].push(s); }

    return (<>
      {/* 헤더 + 통계 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: sb.bg, color: sb.color }}>{sb.label}</span>
        {sel.target_type === "selected" && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: "#fef3c7", color: "#b45309" }}>특정 대상</span>}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>{new Date(sel.created_at).toLocaleDateString("ko-KR")}</span>
      </div>
      {sel.description && <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e", whiteSpace: "pre-wrap", marginBottom: 14, lineHeight: 1.7 }}>{sel.description}</p>}

      {/* 통계 카드 3개 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ padding: "10px 18px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", flex: 1 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>전체 슬롯</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e" }}>{total}</div>
        </div>
        <div style={{ padding: "10px 18px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0", flex: 1 }}>
          <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>예약 완료</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>{booked}</div>
        </div>
        <div style={{ padding: "10px 18px", background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe", flex: 1 }}>
          <div style={{ fontSize: 11, color: "#1a6fc4", fontWeight: 700 }}>잔여</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6fc4" }}>{total - booked}</div>
        </div>
      </div>
      {total > 0 && <div style={{ height: 8, borderRadius: 4, background: "#e2e8f0", overflow: "hidden", marginBottom: 14 }}><div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#1a6fc4,#38bdf8)", width: `${(booked / total) * 100}%`, transition: "width 300ms" }} /></div>}

      {/* 액션 버튼 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {sel.status === "draft" && <button style={{ padding: "7px 14px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "#16a34a", color: "#fff" }} onClick={() => publishConsultation(sel)}>📢 배포하기</button>}
        {sel.status === "published" && <button style={{ padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "#fff", color: "#64748b" }} onClick={() => closeConsultation(sel)}>마감</button>}
        <button style={{ padding: "5px 10px", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "#fee2e2", color: "#dc2626", marginLeft: "auto" }} onClick={() => deleteConsultation(sel)}>삭제</button>
      </div>

      {/* ✅ 예약 결과 — 가장 눈에 잘 띄는 위치 */}
      {booked > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 10, color: "#16a34a" }}>✅ 예약 결과 ({booked}건)</h3>
          {bookedSlots.map((s, i) => (
            <div key={s.id} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 12, marginBottom: 6, background: "#f8fafc" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff", background: "#16a34a", flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{s.booked_name || "?"}</div>
                {s.booked_student && <div style={{ fontSize: 12, color: "#64748b" }}>👶 {s.booked_student}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1a6fc4" }}>{fmtDate(s.slot_date)}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{s.slot_time}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 미예약 경고 */}
      {availSlots.length > 0 && booked > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#b45309" }}>⚠️ {availSlots.length}개 슬롯이 아직 비어있습니다</div>
          <div style={{ fontSize: 11, color: "#92400e", marginTop: 3 }}>{availSlots.map(s => `${fmtDate(s.slot_date)} ${s.slot_time}`).join(" · ")}</div>
        </div>
      )}

      {/* ⏰ 전체 슬롯 현황 */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>⏰ 시간 슬롯 현황</h3>
        {Object.entries(byDate).map(([date, dateSlots]) => (
          <div key={date} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1a6fc4", marginBottom: 5 }}>📅 {fmtDate(date)}</div>
            {dateSlots.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", padding: "7px 10px", borderRadius: 8, marginBottom: 3,
                background: s.status === "booked" ? "#f0fdf4" : "#f8fafc", border: `1px solid ${s.status === "booked" ? "#bbf7d0" : "#e2e8f0"}` }}>
                <span style={{ fontWeight: 700, fontSize: 13, width: 50 }}>{s.slot_time}</span>
                {s.status === "booked" ? (<>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 6, background: "#dcfce7", color: "#16a34a", marginRight: 6 }}>예약됨</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{s.booked_name}{s.booked_student ? ` (${s.booked_student})` : ""}</span>
                </>) : (<>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 6, background: "#f1f5f9", color: "#94a3b8" }}>대기</span>
                  <span style={{ marginLeft: "auto" }}>
                    {sel.status !== "closed" && <button onClick={() => removeDetailSlot(s.id)} style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>×</button>}
                  </span>
                </>)}
              </div>
            ))}
          </div>
        ))}
        {/* 슬롯 추가 */}
        {sel.status !== "closed" && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, paddingTop: 8, borderTop: "1px solid #f1f5f9", flexWrap: "wrap", alignItems: "center" }}>
            <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} style={{ flex: 1, padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontFamily: "inherit", outline: "none", minWidth: 120 }} />
            <select value={addTime} onChange={e => setAddTime(e.target.value)} style={{ width: 80, padding: "7px 8px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, fontFamily: "inherit", outline: "none" }}>
              {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={addSlotToDetail} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #1a6fc4", background: "#eff6ff", color: "#1a6fc4", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ 추가</button>
          </div>
        )}
      </div>

      {/* 초대 대상 */}
      {sel.target_type === "selected" && sel.consultation_invites?.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>👩 초대 대상 ({sel.consultation_invites.length}명)</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {sel.consultation_invites.map(inv => {
              const bk = bookings.find(b => b.id === inv.booking_id);
              const hasBooked = bookedSlots.some(s => s.booked_name === bk?.booker_name);
              return (
                <span key={inv.id} style={{ padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                  background: hasBooked ? "#dcfce7" : "#fee2e2", color: hasBooked ? "#16a34a" : "#dc2626",
                  border: `1px solid ${hasBooked ? "#bbf7d0" : "#fecaca"}` }}>
                  {hasBooked ? "✅ " : "⏳ "}{bk?.booker_name || inv.booking_id.slice(0, 8)}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </>);
  };

  /* ── 우측: 생성 폼 ── */
  const RightCreateForm = () => (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button onClick={backToList} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← 목록</button>
        <h2 style={{ fontSize: 18, fontWeight: 800, flex: 1 }}>새 상담 만들기</h2>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "18px 20px", marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>안내 내용 *</label>
        <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="엄마들에게 보여질 안내 내용을 입력하세요"
          style={{ width: "100%", padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: 100, marginBottom: 14 }} />

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>대상</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setFTarget("all")} style={{ padding: "7px 16px", borderRadius: 8, border: `1.5px solid ${fTarget === "all" ? "#1a6fc4" : "#e2e8f0"}`, background: fTarget === "all" ? "#eff6ff" : "#fff", color: fTarget === "all" ? "#1a6fc4" : "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>전체</button>
          <button onClick={() => setFTarget("selected")} style={{ padding: "7px 16px", borderRadius: 8, border: `1.5px solid ${fTarget === "selected" ? "#1a6fc4" : "#e2e8f0"}`, background: fTarget === "selected" ? "#eff6ff" : "#fff", color: fTarget === "selected" ? "#1a6fc4" : "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>특정 대상 선택 ←</button>
        </div>
        {fTarget === "selected" && <p style={{ fontSize: 11, color: "#1a6fc4", marginTop: 6 }}>👈 왼쪽 패널에서 대상 엄마를 선택하세요</p>}
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "18px 20px", marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>시간 슬롯 추가</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)} style={{ flex: 1, padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", minWidth: 120 }} />
          <select value={slotTime} onChange={e => setSlotTime(e.target.value)} style={{ width: 85, padding: "8px 8px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
            {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={addSlot} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#1a6fc4", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ 추가</button>
        </div>
        {fSlots.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
            {fSlots.map((s, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "#e0f2fe", color: "#0369a1" }}>
                {fmtDate(s.date)} {s.time}
                <span onClick={() => removeSlot(i)} style={{ cursor: "pointer", marginLeft: 3, color: "#94a3b8", fontWeight: 700 }}>×</span>
              </span>
            ))}
          </div>
        )}
        {fSlots.length === 0 && <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>날짜와 시간을 선택하고 [+ 추가]를 눌러주세요</p>}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={() => createConsultation(false)} disabled={saving} style={{ padding: "8px 16px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: "#fff", color: "#64748b" }}>임시저장</button>
        <button onClick={() => createConsultation(true)} disabled={saving} style={{ padding: "8px 16px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "#16a34a", color: "#fff" }}>{saving ? "처리 중..." : "📢 바로 배포"}</button>
      </div>
    </>
  );

  /* ── 렌더 ── */
  return (<>
    <style>{`*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}`}</style>
    <div style={{ maxWidth: 1020, margin: "0 auto", padding: "24px 20px" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => router.push("/admin/hub")} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>← 관리자 홈</button>
        <h1 style={{ fontSize: 22, fontWeight: 800, flex: 1 }}>🗓 상담 예약 관리</h1>
      </div>
      <p style={{ fontSize: 13, color: "#6b7c93", marginBottom: 18 }}>상담 일정을 만들고 배포하면, 엄마들이 포털에서 원하는 시간에 예약할 수 있습니다. 예약 결과는 상담을 클릭해서 확인하세요.</p>

      {/* 좌우 분할 */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
        {/* ── 좌측 패널 ── */}
        {mode === "create" && fTarget === "selected"
          ? <LeftBookingSelect />
          : <LeftConsultationList />
        }

        {/* ── 우측 패널 ── */}
        <div>
          {mode === "create"
            ? <RightCreateForm />
            : <RightDetail />
          }
        </div>
      </div>
    </div>
  </>);
}
