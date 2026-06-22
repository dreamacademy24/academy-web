"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Slot {
  id: string;
  slot_date: string;
  slot_time: string;
  duration_min: number;
  status: "available" | "booked";
  booked_name: string | null;
  booked_student: string | null;
  booked_at: string | null;
}

interface Invite { id: string; booking_id: string; notified: boolean }

interface Consultation {
  id: string;
  title: string;
  description: string | null;
  target_type: "all" | "selected";
  status: "draft" | "published" | "closed";
  created_at: string;
  consultation_slots: Slot[];
  consultation_invites: Invite[];
}

interface Booking { id: string; booker_name: string; reservation_no: string; checkin_date: string; checkout_date?: string; students?: any }

const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];

function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()} (${DAY_KR[dt.getDay()]})`;
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
    // 활성 예약 목록 (대상 선택용)
    const { data, error } = await supabase
      .from("bookings")
      .select("id, booker_name, reservation_no, checkin_date, checkout_date, students")
      .not("status", "eq", "cancelled")
      .order("checkin_date", { ascending: true });
    if (error) console.error("loadBookings error:", error.message);
    if (data) setBookings(data as Booking[]);
  }, []);

  useEffect(() => { if (ready) { load(); loadBookings(); } }, [ready, load, loadBookings]);

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
          title: fTitle,
          description: fDesc || null,
          target_type: fTarget,
          slots: fSlots,
          invite_booking_ids: fTarget === "selected" ? fInvites : [],
          status: publish ? "published" : "draft",
        }),
      });
      const j = await res.json();
      if (!res.ok) return alert(j.error || "생성 실패");
      alert(publish ? "✅ 배포되었습니다" : "✅ 임시저장되었습니다");
      resetForm();
      load();
      setView("list");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setFTitle(""); setFDesc(""); setFTarget("all"); setFSlots([]); setFInvites([]);
  }

  async function publishConsultation(c: Consultation) {
    if (!confirm("배포하시겠습니까? 엄마들이 볼 수 있게 됩니다.")) return;
    const res = await fetch("/api/admin/consultations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, status: "published" }),
    });
    if (res.ok) { alert("✅ 배포 완료"); load(); }
  }

  async function closeConsultation(c: Consultation) {
    if (!confirm("마감하시겠습니까?")) return;
    const res = await fetch("/api/admin/consultations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, status: "closed" }),
    });
    if (res.ok) { alert("✅ 마감 완료"); load(); }
  }

  async function deleteConsultation(c: Consultation) {
    if (!confirm(`"${c.title}" 상담을 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/admin/consultations?id=${c.id}`, { method: "DELETE" });
    if (res.ok) {
      alert("삭제 완료");
      if (detail?.id === c.id) { setDetail(null); setView("list"); }
      load();
    }
  }

  async function addSlotToDetail() {
    if (!detail || !addDate) return;
    const res = await fetch("/api/admin/consultations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: detail.id, add_slots: [{ date: addDate, time: addTime }] }),
    });
    if (res.ok) { setAddDate(""); load(); refreshDetail(detail.id); }
  }

  async function removeDetailSlot(slotId: string) {
    if (!detail || !confirm("이 슬롯을 삭제합니까?")) return;
    const res = await fetch("/api/admin/consultations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: detail.id, remove_slot_ids: [slotId] }),
    });
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

  const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: "#f1f5f9", text: "#64748b", label: "임시저장" },
    published: { bg: "#dcfce7", text: "#16a34a", label: "배포 중" },
    closed: { bg: "#fee2e2", text: "#dc2626", label: "마감" },
  };

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.cw{max-width:900px;margin:0 auto;padding:24px 20px}
.cw h1{font-size:20px;font-weight:800;margin-bottom:4px}
.ch{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:8px}
.btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 150ms}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#1558a0}
.btn-green{background:#16a34a;color:#fff}.btn-green:hover{background:#15803d}
.btn-gray{background:#fff;color:#64748b;border:1px solid #e2e8f0}.btn-gray:hover{background:#f8fafc}
.btn-red{background:#fee2e2;color:#dc2626}.btn-red:hover{background:#fecaca}
.btn-sm{padding:5px 10px;font-size:11px;border-radius:6px}
.card{background:#fff;border-radius:12px;padding:16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.06);cursor:pointer;transition:all 150ms;border:2px solid transparent}
.card:hover{border-color:#1a6fc4;box-shadow:0 4px 16px rgba(26,111,196,0.1)}
.card-h{display:flex;align-items:center;justify-content:space-between;gap:8px}
.badge{display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700}
.meta{font-size:12px;color:#94a3b8;margin-top:4px}
.slots-summary{font-size:12px;color:#64748b;margin-top:4px}
.form-box{background:#fff;border-radius:12px;padding:20px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
.form-box label{display:block;font-size:12px;font-weight:600;color:#64748b;margin-bottom:4px;margin-top:12px}
.form-box label:first-child{margin-top:0}
.form-box input,.form-box textarea,.form-box select{width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit}
.form-box textarea{min-height:80px;resize:vertical}
.slot-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.slot-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;background:#e0f2fe;color:#0369a1}
.slot-chip.booked{background:#dcfce7;color:#16a34a}
.slot-chip .x{cursor:pointer;margin-left:4px;color:#94a3b8;font-weight:700}
.slot-chip .x:hover{color:#dc2626}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:11px;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0}
.tbl td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.tbl tr:hover td{background:#f8fafc}
.invite-grid{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.invite-chip{padding:4px 10px;border-radius:6px;font-size:12px;cursor:pointer;border:1px solid #e2e8f0;background:#fff;transition:all 150ms}
.invite-chip.sel{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.bar{height:6px;border-radius:3px;background:#e2e8f0;overflow:hidden;margin-top:8px}
.bar-fill{height:100%;border-radius:3px;background:#1a6fc4;transition:width 300ms}
@media(max-width:600px){.cw{padding:16px 12px}.slot-row{flex-direction:column;align-items:stretch}}
    `}</style>

    <div className="cw">
      <div className="ch">
        <div>
          <h1>📋 상담 예약 관리</h1>
          <p style={{ fontSize: 12, color: "#94a3b8" }}>상담 일정 생성 · 배포 · 현황 확인</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {view !== "list" && <button className="btn btn-gray" onClick={() => { setView("list"); setDetail(null); }}>← 목록</button>}
          {view === "list" && <button className="btn btn-blue" onClick={() => { resetForm(); setView("create"); }}>+ 새 상담 만들기</button>}
          <button className="btn btn-gray" onClick={() => router.push("/admin/hub")}>← 관리자 홈</button>
        </div>
      </div>

      {/* === 목록 === */}
      {view === "list" && (<>
        {list.length === 0 && <div className="form-box" style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>등록된 상담이 없습니다</div>}
        {list.map((c) => {
          const totalSlots = c.consultation_slots?.length || 0;
          const bookedSlots = c.consultation_slots?.filter((s) => s.status === "booked").length || 0;
          const sb = STATUS_BADGE[c.status] || STATUS_BADGE.draft;
          return (
            <div key={c.id} className="card" onClick={() => openDetail(c)}>
              <div className="card-h">
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>{c.title}</span>
                    <span className="badge" style={{ background: sb.bg, color: sb.text }}>{sb.label}</span>
                    {c.target_type === "selected" && <span className="badge" style={{ background: "#fef3c7", color: "#b45309" }}>특정 대상</span>}
                  </div>
                  <div className="slots-summary">
                    슬롯 {totalSlots}개 · 예약 {bookedSlots}건 · 잔여 {totalSlots - bookedSlots}건
                  </div>
                  <div className="meta">{new Date(c.created_at).toLocaleDateString("ko-KR")}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {c.status === "draft" && <button className="btn btn-green btn-sm" onClick={(e) => { e.stopPropagation(); publishConsultation(c); }}>배포</button>}
                  {c.status === "published" && <button className="btn btn-gray btn-sm" onClick={(e) => { e.stopPropagation(); closeConsultation(c); }}>마감</button>}
                  <button className="btn btn-red btn-sm" onClick={(e) => { e.stopPropagation(); deleteConsultation(c); }}>삭제</button>
                </div>
              </div>
              {totalSlots > 0 && (
                <div className="bar"><div className="bar-fill" style={{ width: `${(bookedSlots / totalSlots) * 100}%` }} /></div>
              )}
            </div>
          );
        })}
      </>)}

      {/* === 생성 === */}
      {view === "create" && (<>
        <div className="form-box">
          <label>상담 제목 *</label>
          <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="예: 5월 학습 상담" />

          <label>안내 문구</label>
          <textarea value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder="엄마들에게 보여질 안내 메시지를 입력하세요" />

          <label>대상</label>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className={`btn ${fTarget === "all" ? "btn-blue" : "btn-gray"}`} onClick={() => setFTarget("all")}>전체</button>
            <button className={`btn ${fTarget === "selected" ? "btn-blue" : "btn-gray"}`} onClick={() => setFTarget("selected")}>특정 대상 선택</button>
          </div>

          {fTarget === "selected" && (<>
            <label>대상 엄마 선택 ({fInvites.length}명) {bookings.length === 0 && <span style={{ color: "#dc2626" }}>— 예약 데이터 없음</span>}</label>
            {bookings.length > 0 ? (
              <div className="invite-grid">
                {bookings.map((b) => {
                  const stuArr = Array.isArray(b.students) ? b.students : [];
                  const stuName = stuArr.map((s: any) => s.korName || s.name_kr).filter(Boolean).join(", ");
                  return (
                    <span
                      key={b.id}
                      className={`invite-chip ${fInvites.includes(b.id) ? "sel" : ""}`}
                      onClick={() => toggleInvite(b.id)}
                    >
                      {b.booker_name}{stuName ? ` · ${stuName}` : ""} <span style={{ opacity: 0.5, fontSize: 11 }}>({b.checkin_date?.slice(5) || "?"})</span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>활성 예약이 없습니다. 예약을 먼저 등록해주세요.</p>
            )}
          </>)}
        </div>

        <div className="form-box">
          <label>시간 슬롯 추가</label>
          <div className="slot-row" style={{ marginTop: 4 }}>
            <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} style={{ flex: 1 }} />
            <select value={slotTime} onChange={(e) => setSlotTime(e.target.value)} style={{ width: 100 }}>
              {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button className="btn btn-blue btn-sm" onClick={addSlot}>+ 추가</button>
          </div>

          {fSlots.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {fSlots.map((s, i) => (
                <span key={i} className="slot-chip">
                  {fmtDate(s.date)} {s.time}
                  <span className="x" onClick={() => removeSlot(i)}>×</span>
                </span>
              ))}
            </div>
          )}
          {fSlots.length === 0 && <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>날짜와 시간을 선택하고 [+ 추가]를 눌러주세요</p>}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-gray" onClick={() => createConsultation(false)} disabled={saving}>임시저장</button>
          <button className="btn btn-green" onClick={() => createConsultation(true)} disabled={saving}>
            {saving ? "처리 중..." : "📢 바로 배포"}
          </button>
        </div>
      </>)}

      {/* === 상세 (현황판) === */}
      {view === "detail" && detail && (() => {
        const slots = [...(detail.consultation_slots || [])].sort((a, b) =>
          `${a.slot_date} ${a.slot_time}`.localeCompare(`${b.slot_date} ${b.slot_time}`)
        );
        const totalSlots = slots.length;
        const bookedSlots = slots.filter((s) => s.status === "booked").length;
        const sb2 = STATUS_BADGE[detail.status] || STATUS_BADGE.draft;

        // 날짜별 그룹
        const byDate: Record<string, Slot[]> = {};
        for (const s of slots) {
          if (!byDate[s.slot_date]) byDate[s.slot_date] = [];
          byDate[s.slot_date].push(s);
        }

        return (<>
          <div className="form-box">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, flex: 1 }}>{detail.title}</h2>
              <span className="badge" style={{ background: sb2.bg, color: sb2.text }}>{sb2.label}</span>
            </div>
            {detail.description && <p style={{ fontSize: 13, color: "#64748b", whiteSpace: "pre-wrap", marginBottom: 10 }}>{detail.description}</p>}
            <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#64748b" }}>
              <span>총 {totalSlots}슬롯</span>
              <span style={{ color: "#16a34a", fontWeight: 700 }}>예약 {bookedSlots}</span>
              <span>잔여 {totalSlots - bookedSlots}</span>
            </div>
            {totalSlots > 0 && <div className="bar"><div className="bar-fill" style={{ width: `${(bookedSlots / totalSlots) * 100}%` }} /></div>}

            <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
              {detail.status === "draft" && <button className="btn btn-green btn-sm" onClick={() => publishConsultation(detail)}>📢 배포</button>}
              {detail.status === "published" && <button className="btn btn-gray btn-sm" onClick={() => closeConsultation(detail)}>마감</button>}
            </div>
          </div>

          {/* 슬롯 테이블 (날짜별 그룹) */}
          <div className="form-box">
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>⏰ 시간 슬롯 현황</h3>
            <table className="tbl">
              <thead><tr><th>날짜</th><th>시간</th><th>상태</th><th>예약자</th><th></th></tr></thead>
              <tbody>
                {Object.entries(byDate).map(([date, dateSlots]) =>
                  dateSlots.map((s, i) => (
                    <tr key={s.id}>
                      {i === 0 && <td rowSpan={dateSlots.length} style={{ fontWeight: 700 }}>{fmtDate(date)}</td>}
                      <td>{s.slot_time}</td>
                      <td>
                        {s.status === "booked"
                          ? <span className="badge" style={{ background: "#dcfce7", color: "#16a34a" }}>예약됨</span>
                          : <span className="badge" style={{ background: "#f1f5f9", color: "#64748b" }}>대기</span>
                        }
                      </td>
                      <td>{s.booked_name ? `${s.booked_name}${s.booked_student ? ` (${s.booked_student})` : ""}` : "-"}</td>
                      <td>
                        {s.status === "available" && (
                          <button className="btn btn-red btn-sm" onClick={() => removeDetailSlot(s.id)}>×</button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* 슬롯 추가 */}
            {detail.status !== "closed" && (
              <div className="slot-row" style={{ marginTop: 12 }}>
                <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} style={{ flex: 1 }} />
                <select value={addTime} onChange={(e) => setAddTime(e.target.value)} style={{ width: 100 }}>
                  {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="btn btn-blue btn-sm" onClick={addSlotToDetail}>+ 슬롯 추가</button>
              </div>
            )}
          </div>

          {/* 📊 예약 현황 요약 */}
          {bookedSlots > 0 && (
            <div className="form-box">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>📊 예약 현황 ({bookedSlots}건)</h3>
              <table className="tbl">
                <thead><tr><th>날짜</th><th>시간</th><th>예약자</th><th>학생</th></tr></thead>
                <tbody>
                  {slots.filter(s => s.status === "booked").map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 700 }}>{fmtDate(s.slot_date)}</td>
                      <td>{s.slot_time}</td>
                      <td>{s.booked_name || "-"}</td>
                      <td style={{ color: "#64748b" }}>{s.booked_student || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 초대 대상 */}
          {detail.target_type === "selected" && (
            <div className="form-box">
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>👩 대상 엄마 ({detail.consultation_invites?.length || 0}명)</h3>
              <div className="invite-grid">
                {(detail.consultation_invites || []).map((inv) => {
                  const bk = bookings.find((b) => b.id === inv.booking_id);
                  return <span key={inv.id} className="invite-chip sel">{bk?.booker_name || inv.booking_id.slice(0, 8)}</span>;
                })}
              </div>
            </div>
          )}
        </>);
      })()}
    </div>
  </>);
}
