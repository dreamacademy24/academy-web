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
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [detail, setDetail] = useState<Consultation | null>(null);
  // create form
  const [fTitle, setFTitle] = useState("");
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

  async function createConsultation(publish: boolean) {
    if (!fTitle.trim()) return alert("제목을 입력해주세요");
    if (fSlots.length === 0) return alert("시간 슬롯을 1개 이상 추가해주세요");
    if (fTarget === "selected" && fInvites.length === 0) return alert("대상 엄마를 1명 이상 선택해주세요");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fTitle, description: fDesc || null, target_type: fTarget,
          slots: fSlots, invite_booking_ids: fTarget === "selected" ? fInvites : [],
          status: publish ? "published" : "draft",
        }),
      });
      const j = await res.json();
      if (!res.ok) return alert(j.error || "생성 실패");
      alert(publish ? "✅ 배포되었습니다" : "✅ 임시저장되었습니다");
      resetForm(); load(); setView("list");
    } finally { setSaving(false); }
  }
  function resetForm() { setFTitle(""); setFDesc(""); setFTarget("all"); setFSlots([]); setFInvites([]); }

  async function publishConsultation(c: Consultation) {
    if (!confirm("배포하시겠습니까? 엄마들이 볼 수 있게 됩니다.")) return;
    const res = await fetch("/api/admin/consultations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, status: "published" }) });
    if (res.ok) { alert("✅ 배포 완료"); load(); if (detail?.id === c.id) refreshDetail(c.id); }
  }
  async function closeConsultation(c: Consultation) {
    if (!confirm("마감하시겠습니까?")) return;
    const res = await fetch("/api/admin/consultations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, status: "closed" }) });
    if (res.ok) { alert("✅ 마감 완료"); load(); if (detail?.id === c.id) refreshDetail(c.id); }
  }
  async function deleteConsultation(c: Consultation) {
    if (!confirm(`"${c.title}" 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/admin/consultations?id=${c.id}`, { method: "DELETE" });
    if (res.ok) { alert("삭제 완료"); if (detail?.id === c.id) { setDetail(null); setView("list"); } load(); }
  }
  async function addSlotToDetail() {
    if (!detail || !addDate) return;
    const res = await fetch("/api/admin/consultations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: detail.id, add_slots: [{ date: addDate, time: addTime }] }) });
    if (res.ok) { setAddDate(""); load(); refreshDetail(detail.id); }
  }
  async function removeDetailSlot(slotId: string) {
    if (!detail || !confirm("이 슬롯을 삭제합니까?")) return;
    const res = await fetch("/api/admin/consultations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: detail.id, remove_slot_ids: [slotId] }) });
    if (res.ok) { load(); refreshDetail(detail.id); }
  }
  async function refreshDetail(id: string) {
    const res = await fetch("/api/admin/consultations");
    const j = await res.json();
    const found = j.consultations?.find((c: Consultation) => c.id === id);
    if (found) setDetail(found);
  }
  function openDetail(c: Consultation) { setDetail(c); setView("detail"); }

  if (!ready) return null;

  const SB: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: "#f1f5f9", color: "#64748b", label: "임시저장" },
    published: { bg: "#dcfce7", color: "#16a34a", label: "배포 중" },
    closed: { bg: "#fee2e2", color: "#dc2626", label: "마감" },
  };

  /* ── 대상 선택 UI (정산 관리 스타일 카드 리스트) ── */
  const InviteList = () => (
    <div style={{ marginTop: 8 }}>
      {/* 필터 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
        {([
          { k: "staying" as const, icon: "🟢", label: `투숙중 ${stayingCount}` },
          { k: "upcoming" as const, icon: "🏨", label: "예정" },
          { k: "all" as const, icon: "", label: "전체" },
        ]).map(f => (
          <button key={f.k} onClick={() => { setInvFilter(f.k); setInvSearch(""); }}
            style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              border: invFilter === f.k ? "1.5px solid #1a6fc4" : "1px solid #e2e8f0",
              background: invFilter === f.k ? "#eff6ff" : "#fff", color: invFilter === f.k ? "#1a6fc4" : "#64748b" }}>
            {f.icon ? `${f.icon} ` : ""}{f.label}
          </button>
        ))}
      </div>
      {/* 검색 */}
      <input value={invSearch} onChange={e => setInvSearch(e.target.value)}
        placeholder="검색 (이름·예약번호·방번호) — 검색 시 전체 0"
        style={{ width: "100%", padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", marginBottom: 8, outline: "none" }} />
      {/* 선택된 수 */}
      <div style={{ fontSize: 12, color: "#1a6fc4", fontWeight: 700, marginBottom: 6 }}>
        ✅ {fInvites.length}명 선택됨 {fInvites.length > 0 && <span onClick={() => setFInvites([])} style={{ color: "#dc2626", cursor: "pointer", marginLeft: 8, fontWeight: 400 }}>전체 해제</span>}
      </div>
      {/* 카드 리스트 */}
      <div style={{ maxHeight: 400, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff" }}>
        {filteredBookings.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>표시할 예약이 없습니다</div>}
        {filteredBookings.map(b => {
          const sel = fInvites.includes(b.id);
          const room = b.house_no || b.accom_room || "";
          const stu = stuNames(b);
          const staying = isStaying(b);
          return (
            <div key={b.id} onClick={() => toggleInvite(b.id)}
              style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                background: sel ? "#eff6ff" : "transparent", transition: "background 150ms" }}>
              <input type="checkbox" checked={sel} readOnly style={{ width: 16, height: 16, accentColor: "#1a6fc4", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{b.booker_name}</span>
                  {staying && <span style={{ fontSize: 10, fontWeight: 700, background: "#dcfce7", color: "#16a34a", padding: "1px 6px", borderRadius: 8 }}>투숙중</span>}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                  {room && <span style={{ marginRight: 6 }}>{room}</span>}
                  · {b.checkin_date}
                </div>
                {stu && <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>👶 {stu}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.cw{max-width:960px;margin:0 auto;padding:24px 20px}
.hdr{display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap}
.hdr h1{font-size:22px;font-weight:800;flex:1}
.btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 150ms}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#1558a0}
.btn-green{background:#16a34a;color:#fff}.btn-green:hover{background:#15803d}
.btn-gray{background:#fff;color:#64748b;border:1px solid #e2e8f0}.btn-gray:hover{background:#f8fafc}
.btn-red{background:#fee2e2;color:#dc2626}.btn-red:hover{background:#fecaca}
.btn-sm{padding:5px 10px;font-size:11px;border-radius:6px}
.box{background:#fff;border-radius:12px;padding:20px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
.box label{display:block;font-size:12px;font-weight:600;color:#64748b;margin-bottom:4px;margin-top:14px}
.box label:first-child{margin-top:0}
.box input,.box textarea,.box select{width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none}
.box textarea{min-height:80px;resize:vertical}
.badge{display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700}
.bar{height:8px;border-radius:4px;background:#e2e8f0;overflow:hidden;margin-top:8px}
.bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#1a6fc4,#38bdf8);transition:width 300ms}
.slot-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.slot-chip{display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;background:#e0f2fe;color:#0369a1}
.slot-chip .x{cursor:pointer;margin-left:4px;color:#94a3b8;font-weight:700}.slot-chip .x:hover{color:#dc2626}
/* 목록 카드 */
.c-card{background:#fff;border-radius:12px;padding:16px 20px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06);cursor:pointer;border:2px solid transparent;transition:all 150ms}
.c-card:hover{border-color:#1a6fc4;box-shadow:0 4px 16px rgba(26,111,196,0.1)}
/* 결과 카드 */
.res-card{padding:12px 16px;border-radius:10px;border:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;margin-bottom:8px;background:#fff}
.res-card .num{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;flex-shrink:0}
@media(max-width:600px){.cw{padding:16px 12px}.slot-row{flex-direction:column;align-items:stretch}}
    `}</style>

    <div className="cw">
      <div className="hdr">
        <button className="btn btn-gray" onClick={() => router.push("/admin/hub")}>← 관리자 홈</button>
        <h1>📋 상담 예약 관리</h1>
        {view !== "list" && <button className="btn btn-gray" onClick={() => { setView("list"); setDetail(null); }}>← 목록</button>}
        {view === "list" && <button className="btn btn-blue" onClick={() => { resetForm(); setView("create"); }}>+ 새 상담 만들기</button>}
      </div>

      {/* ═══ 목록 ═══ */}
      {view === "list" && (<>
        {list.length === 0 && <div className="box" style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>등록된 상담이 없습니다</div>}
        {list.map(c => {
          const total = c.consultation_slots?.length || 0;
          const booked = c.consultation_slots?.filter(s => s.status === "booked").length || 0;
          const sb = SB[c.status] || SB.draft;
          return (
            <div key={c.id} className="c-card" onClick={() => openDetail(c)}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>{c.title}</span>
                <span className="badge" style={{ background: sb.bg, color: sb.color }}>{sb.label}</span>
                {c.target_type === "selected" && <span className="badge" style={{ background: "#fef3c7", color: "#b45309" }}>특정 대상</span>}
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#64748b" }}>
                <span>슬롯 {total}개</span>
                <span style={{ color: "#16a34a", fontWeight: 700 }}>예약 {booked}건</span>
                <span>잔여 {total - booked}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>{new Date(c.created_at).toLocaleDateString("ko-KR")}</span>
              </div>
              {total > 0 && <div className="bar"><div className="bar-fill" style={{ width: `${(booked / total) * 100}%` }} /></div>}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {c.status === "draft" && <button className="btn btn-green btn-sm" onClick={e => { e.stopPropagation(); publishConsultation(c); }}>📢 배포</button>}
                {c.status === "published" && <button className="btn btn-gray btn-sm" onClick={e => { e.stopPropagation(); closeConsultation(c); }}>마감</button>}
                <button className="btn btn-red btn-sm" onClick={e => { e.stopPropagation(); deleteConsultation(c); }}>삭제</button>
              </div>
            </div>
          );
        })}
      </>)}

      {/* ═══ 생성 ═══ */}
      {view === "create" && (<>
        <div className="box">
          <label>상담 제목 *</label>
          <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="예: 6월 학습 상담" />
          <label>안내 문구</label>
          <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="엄마들에게 보여질 안내 메시지를 입력하세요" />
          <label>대상</label>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className={`btn ${fTarget === "all" ? "btn-blue" : "btn-gray"}`} onClick={() => setFTarget("all")}>전체</button>
            <button className={`btn ${fTarget === "selected" ? "btn-blue" : "btn-gray"}`} onClick={() => setFTarget("selected")}>특정 대상 선택</button>
          </div>
          {fTarget === "selected" && <InviteList />}
        </div>

        <div className="box">
          <label>시간 슬롯 추가</label>
          <div className="slot-row" style={{ marginTop: 4 }}>
            <input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)} style={{ flex: 1 }} />
            <select value={slotTime} onChange={e => setSlotTime(e.target.value)} style={{ width: 100 }}>
              {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button className="btn btn-blue btn-sm" onClick={addSlot}>+ 추가</button>
          </div>
          {fSlots.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {fSlots.map((s, i) => (
                <span key={i} className="slot-chip">{fmtDate(s.date)} {s.time}<span className="x" onClick={() => removeSlot(i)}>×</span></span>
              ))}
            </div>
          )}
          {fSlots.length === 0 && <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>날짜와 시간을 선택하고 [+ 추가]를 눌러주세요</p>}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-gray" onClick={() => createConsultation(false)} disabled={saving}>임시저장</button>
          <button className="btn btn-green" onClick={() => createConsultation(true)} disabled={saving}>{saving ? "처리 중..." : "📢 바로 배포"}</button>
        </div>
      </>)}

      {/* ═══ 상세 (현황판 + 결과) ═══ */}
      {view === "detail" && detail && (() => {
        const slots = [...(detail.consultation_slots || [])].sort((a, b) =>
          `${a.slot_date} ${a.slot_time}`.localeCompare(`${b.slot_date} ${b.slot_time}`)
        );
        const total = slots.length;
        const booked = slots.filter(s => s.status === "booked").length;
        const sb = SB[detail.status] || SB.draft;
        const bookedSlots = slots.filter(s => s.status === "booked");
        const availSlots = slots.filter(s => s.status === "available");
        // 날짜별 그룹
        const byDate: Record<string, Slot[]> = {};
        for (const s of slots) { if (!byDate[s.slot_date]) byDate[s.slot_date] = []; byDate[s.slot_date].push(s); }

        return (<>
          {/* 헤더 정보 */}
          <div className="box">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>{detail.title}</h2>
              <span className="badge" style={{ background: sb.bg, color: sb.color, fontSize: 13, padding: "4px 12px" }}>{sb.label}</span>
            </div>
            {detail.description && <p style={{ fontSize: 13, color: "#64748b", whiteSpace: "pre-wrap", marginBottom: 10, lineHeight: 1.6 }}>{detail.description}</p>}
            {/* 통계 카드 */}
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <div style={{ padding: "10px 18px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>전체 슬롯</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a2e" }}>{total}</div>
              </div>
              <div style={{ padding: "10px 18px", background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0" }}>
                <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>예약 완료</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>{booked}</div>
              </div>
              <div style={{ padding: "10px 18px", background: "#eff6ff", borderRadius: 10, border: "1px solid #bfdbfe" }}>
                <div style={{ fontSize: 11, color: "#1a6fc4", fontWeight: 700 }}>잔여</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6fc4" }}>{total - booked}</div>
              </div>
            </div>
            {total > 0 && <div className="bar" style={{ marginTop: 12 }}><div className="bar-fill" style={{ width: `${(booked / total) * 100}%` }} /></div>}
            <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
              {detail.status === "draft" && <button className="btn btn-green" onClick={() => publishConsultation(detail)}>📢 배포하기</button>}
              {detail.status === "published" && <button className="btn btn-gray" onClick={() => closeConsultation(detail)}>마감</button>}
              <button className="btn btn-red btn-sm" style={{ marginLeft: "auto" }} onClick={() => deleteConsultation(detail)}>삭제</button>
            </div>
          </div>

          {/* ✅ 예약 결과 (예약된 슬롯이 있을 때) */}
          {booked > 0 && (
            <div className="box">
              <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>✅ 예약 결과 ({booked}건)</h3>
              {bookedSlots.map((s, i) => (
                <div key={s.id} className="res-card">
                  <div className="num" style={{ background: "#16a34a" }}>{i + 1}</div>
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

          {/* ⏰ 전체 슬롯 현황 */}
          <div className="box">
            <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>⏰ 시간 슬롯 현황</h3>
            {Object.entries(byDate).map(([date, dateSlots]) => (
              <div key={date} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1a6fc4", marginBottom: 6, paddingLeft: 2 }}>📅 {fmtDate(date)}</div>
                {dateSlots.map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: 8, marginBottom: 4,
                    background: s.status === "booked" ? "#f0fdf4" : "#f8fafc", border: `1px solid ${s.status === "booked" ? "#bbf7d0" : "#e2e8f0"}` }}>
                    <span style={{ fontWeight: 700, fontSize: 14, width: 60 }}>{s.slot_time}</span>
                    {s.status === "booked" ? (<>
                      <span className="badge" style={{ background: "#dcfce7", color: "#16a34a", marginRight: 8 }}>예약됨</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{s.booked_name}{s.booked_student ? ` (${s.booked_student})` : ""}</span>
                    </>) : (<>
                      <span className="badge" style={{ background: "#f1f5f9", color: "#94a3b8" }}>대기</span>
                      <span style={{ marginLeft: "auto" }}>
                        {detail.status !== "closed" && <button className="btn btn-red btn-sm" onClick={() => removeDetailSlot(s.id)}>×</button>}
                      </span>
                    </>)}
                  </div>
                ))}
              </div>
            ))}
            {/* 슬롯 추가 */}
            {detail.status !== "closed" && (
              <div className="slot-row" style={{ marginTop: 8, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} style={{ flex: 1, padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
                <select value={addTime} onChange={e => setAddTime(e.target.value)} style={{ width: 100, padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}>
                  {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="btn btn-blue btn-sm" onClick={addSlotToDetail}>+ 슬롯 추가</button>
              </div>
            )}
          </div>

          {/* 미예약 슬롯 안내 */}
          {availSlots.length > 0 && booked > 0 && (
            <div className="box" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#b45309" }}>
                ⚠️ 아직 {availSlots.length}개 슬롯이 비어있습니다
              </div>
              <div style={{ fontSize: 12, color: "#92400e", marginTop: 4 }}>
                {availSlots.map(s => `${fmtDate(s.slot_date)} ${s.slot_time}`).join(" · ")}
              </div>
            </div>
          )}

          {/* 초대 대상 */}
          {detail.target_type === "selected" && detail.consultation_invites?.length > 0 && (
            <div className="box">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>👩 초대 대상 ({detail.consultation_invites.length}명)</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {detail.consultation_invites.map(inv => {
                  const bk = bookings.find(b => b.id === inv.booking_id);
                  const hasBooked = bookedSlots.some(s => s.booked_name === bk?.booker_name);
                  return (
                    <span key={inv.id} style={{ padding: "4px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
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
      })()}
    </div>
  </>);
}
