"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Tab = "shuttle" | "fieldtrip" | "tutor" | "pickup";
type AnyRow = Record<string, unknown>;

interface Buckets {
  shuttle: AnyRow[];
  fieldtrip: AnyRow[];
  tutor: AnyRow[];
  pickup: AnyRow[];
}

interface CancelModalState {
  open: boolean;
  table: "shuttle_applications" | "fieldtrip_applications" | "tutor_requests" | "";
  id: string;
  title: string;
}

function statusMeta(s: string) {
  const v = String(s || "").toLowerCase();
  if (v === "pending" || v === "대기중") return { label: "대기중", bg: "#dbeafe", color: "#1e40af" };
  if (v === "confirmed" || v === "확정") return { label: "확정", bg: "#dcfce7", color: "#15803d" };
  if (v === "cancel_requested") return { label: "취소요청중", bg: "#fed7aa", color: "#9a3412" };
  if (v === "cancelled" || v === "cancel") return { label: "취소완료", bg: "#fee2e2", color: "#b91c1c" };
  if (v === "assigned" || v === "reviewing") return { label: v === "assigned" ? "배정됨" : "검토중", bg: "#e5e7eb", color: "#4b5563" };
  return { label: s || "-", bg: "#f1f5f9", color: "#475569" };
}

function canCancel(s: string) {
  const v = String(s || "").toLowerCase();
  return v === "pending" || v === "confirmed" || v === "대기중" || v === "확정";
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "-";
  return String(s).slice(0, 10);
}

// 일요일 제외 — 튜터 수업 불가
const EDIT_DAYS = ["월","화","수","목","금","토"];

export default function MyApplicationsPage() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("shuttle");
  const [data, setData] = useState<Buckets>({ shuttle: [], fieldtrip: [], tutor: [], pickup: [] });
  const [cancelModal, setCancelModal] = useState<CancelModalState>({ open: false, table: "", id: "", title: "" });
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [editId, setEditId] = useState<string>("");
  const [editForm, setEditForm] = useState({ class_type: "", preferred_days: [] as string[], preferred_time: "", start_date: "", end_date: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [lessonsByApp, setLessonsByApp] = useState<Record<string, AnyRow[]>>({});
  const [detail, setDetail] = useState<{ student: string; lessons: AnyRow[] } | null>(null);

  const load = useCallback(async (bid: string) => {
    if (!bid) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/my-applications?booking_id=${encodeURIComponent(bid)}`);
      if (res.ok) {
        const j = await res.json();
        setData({
          shuttle: j.shuttle || [],
          fieldtrip: j.fieldtrip || [],
          tutor: j.tutor || [],
          pickup: j.pickup || [],
        });
      }
      // 확정 튜터 수업(인보이스+일정) — 신청별로 묶기
      const inv = await fetch(`/api/portal/tutor-invoice?booking_id=${encodeURIComponent(bid)}`);
      if (inv.ok) {
        const ij = await inv.json();
        const map: Record<string, AnyRow[]> = {};
        (ij.lessons || []).forEach((l: AnyRow) => {
          const k = String(l.application_id || "");
          if (!map[k]) map[k] = [];
          map[k].push(l);
        });
        setLessonsByApp(map);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    async function init() {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem("portalSession");
        if (raw) {
          const session = JSON.parse(raw);
          if (session.booking_id && Date.now() < session.expires) {
            setBookingId(session.booking_id);
            load(session.booking_id);
            return;
          }
          localStorage.removeItem("portalSession");
        }
      } catch {}
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const bid = data.session.user.user_metadata?.booking_id || data.session.user.id;
        setBookingId(bid);
        load(bid);
        return;
      }
      router.replace("/portal");
    }
    init();
  }, [router, load]);

  function openCancel(table: CancelModalState["table"], id: string, title: string) {
    setCancelModal({ open: true, table, id, title });
    setCancelReason("");
  }
  function closeCancel() {
    setCancelModal({ open: false, table: "", id: "", title: "" });
    setCancelReason("");
  }
  async function submitCancel() {
    if (!cancelModal.table || !cancelModal.id) return;
    setCancelSaving(true);
    const res = await fetch("/api/portal/cancel-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: cancelModal.table, id: cancelModal.id, reason: cancelReason }),
    });
    setCancelSaving(false);
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      alert("취소 요청 실패: " + (r.error || ""));
      return;
    }
    closeCancel();
    if (bookingId) load(bookingId);
    setToast("취소 요청이 접수되었습니다.");
    setTimeout(() => setToast(""), 2500);
  }

  function openEdit(r: AnyRow) {
    const rawDays = r.preferred_days_arr ?? r.preferred_days;
    const daysArr = Array.isArray(rawDays)
      ? rawDays.map(String)
      : (typeof rawDays === "string" ? rawDays.split(",").map(s => s.trim()).filter(Boolean) : []);
    setEditForm({
      class_type: String(r.class_type || ""),
      preferred_days: daysArr,
      preferred_time: String(r.preferred_time || ""),
      start_date: String(r.start_date || "").slice(0, 10),
      end_date: String(r.end_date || "").slice(0, 10),
      notes: String(r.notes || ""),
    });
    setEditId(String(r.id || ""));
  }
  function toggleEditDay(d: string) {
    setEditForm(f => ({ ...f, preferred_days: f.preferred_days.includes(d) ? f.preferred_days.filter(x => x !== d) : [...f.preferred_days, d] }));
  }
  async function submitEdit() {
    if (!editId) return;
    setEditSaving(true);
    const res = await fetch("/api/portal/tutor-edit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editId,
        class_type: editForm.class_type,
        preferred_days: editForm.preferred_days.join(","),
        preferred_time: editForm.preferred_time,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        notes: editForm.notes,
      }),
    });
    setEditSaving(false);
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      alert("수정 실패: " + (r.error || ""));
      return;
    }
    setEditId("");
    if (bookingId) load(bookingId);
    setToast("수정이 완료되었습니다.");
    setTimeout(() => setToast(""), 2500);
  }

  const shuttleCancelled = data.shuttle.filter((r: AnyRow) => {
    const v = String(r.status || "").toLowerCase();
    return v === "cancelled" || v === "cancel";
  }).length;

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 14, fontFamily: "'Noto Sans KR',sans-serif" }}>불러오는 중...</div>;
  }

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f9fafb;color:#1a1a2e}
.ma-w{max-width:880px;margin:0 auto;padding:24px 18px 60px}
.ma-back{padding:8px 12px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-weight:600;color:#475569;cursor:pointer;font-family:inherit;margin-bottom:14px}
.ma-back:hover{background:#f1f5f9;color:#1a6fc4;border-color:#cbd5e1}
.ma-title{font-size:22px;font-weight:800;margin-bottom:18px}
.ma-tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:12px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.06);overflow-x:auto}
.ma-tab{flex:1;min-width:90px;padding:10px 6px;font-size:12.5px;font-weight:700;text-align:center;border:none;border-radius:9px;cursor:pointer;font-family:inherit;background:transparent;color:#6b7c93;transition:all 120ms;white-space:nowrap}
.ma-tab:hover:not(.ac){background:#f1f5f9}
.ma-tab.ac{background:#1a6fc4;color:#fff}
.ma-card{background:#fff;border:1px solid #f3f4f6;border-radius:12px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.04)}
.ma-row1{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
.ma-date{font-size:12px;color:#6b7280;font-weight:600}
.ma-title-line{font-size:14px;font-weight:700;color:#1a1a2e;margin-bottom:4px;line-height:1.4;word-break:keep-all}
.ma-meta{font-size:12.5px;color:#475569;line-height:1.7}
.ma-meta b{color:#1a1a2e;font-weight:700}
.ma-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.ma-actions{display:flex;justify-content:flex-end;margin-top:8px}
.ma-cancel-btn{padding:6px 12px;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}
.ma-cancel-btn:hover{background:#fecaca}
.ma-empty{text-align:center;padding:40px 16px;color:#9ca3af;font-size:13.5px;background:#fff;border:1px dashed #e5e7eb;border-radius:12px}
.ma-warn{padding:12px 14px;background:#fef3c7;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:10px;color:#92400e;font-size:12.5px;line-height:1.6;margin-bottom:12px;font-weight:600}
.ma-info{padding:10px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;color:#1e40af;font-size:12px;line-height:1.6;margin-top:8px;font-weight:600}

.ma-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px}
.ma-modal{background:#fff;border-radius:14px;width:100%;max-width:420px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,0.18)}
.ma-modal h3{font-size:15px;font-weight:800;margin-bottom:6px}
.ma-modal .desc{font-size:12.5px;color:#6b7280;margin-bottom:12px;line-height:1.6}
.ma-modal textarea{width:100%;min-height:80px;padding:9px 11px;border:1px solid #e5e7eb;border-radius:7px;font-size:13px;font-family:inherit;outline:none;resize:vertical}
.ma-modal .btns{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
.ma-modal .btn-cl{padding:9px 14px;background:#fff;color:#475569;border:1px solid #cbd5e1;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.ma-modal .btn-ok{padding:9px 18px;background:#dc2626;color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.ma-modal .btn-ok:disabled{opacity:0.6;cursor:not-allowed}

.ma-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 22px;border-radius:10px;font-size:13.5px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,0.2);z-index:200}
    `}</style>
    <div className="ma-w">
      <button className="ma-back" onClick={() => router.push("/portal/dashboard")}>← 마이페이지로</button>
      <h1 className="ma-title">📑 내 신청 내역</h1>

      <div className="ma-tabs" role="tablist">
        <button className={`ma-tab${tab === "shuttle" ? " ac" : ""}`} onClick={() => setTab("shuttle")}>🚌 투어셔틀</button>
        <button className={`ma-tab${tab === "fieldtrip" ? " ac" : ""}`} onClick={() => setTab("fieldtrip")}>🎒 애프터스쿨/필드트립</button>
        <button className={`ma-tab${tab === "tutor" ? " ac" : ""}`} onClick={() => setTab("tutor")}>👩‍🏫 튜터</button>
        <button className={`ma-tab${tab === "pickup" ? " ac" : ""}`} onClick={() => setTab("pickup")}>🚐 픽드랍</button>
      </div>

      {/* 투어셔틀 */}
      {tab === "shuttle" && (
        <div>
          {data.shuttle.length > 0 && (
            <div className="ma-warn">⚠️ 인보이스가 발행되고 수정·변경하시는 경우에는 반영이 불가할 수 있습니다.</div>
          )}
          {shuttleCancelled >= 2 && (
            <div className="ma-warn">⚠️ 투어셔틀 취소가 2회 이상 발생했습니다. 신규 예약이 제한될 수 있습니다.</div>
          )}
          {data.shuttle.length === 0 ? (
            <div className="ma-empty">신청 내역이 없습니다.</div>
          ) : [...data.shuttle].sort((a: AnyRow, b: AnyRow) => String(a.tour_date || a.date || "").localeCompare(String(b.tour_date || b.date || ""))).map((r: AnyRow) => {
            const meta = statusMeta(String(r.status || ""));
            const id = String(r.id || "");
            const tourName = String(r.tour_name || r.request || "투어 셔틀");
            const tDate = String(r.tour_date || r.date || "");
            const dt = new Date(tDate + "T00:00:00");
            const md = (!tDate || isNaN(dt.getTime())) ? (tDate || "-") : `${dt.getMonth()+1}/${dt.getDate()} (${["일","월","화","수","목","금","토"][dt.getDay()]})`;
            const depart = String(r.depart_time || "");
            const ppl = r.people_count ?? r.num_people ?? "-";
            const room = String(r.room_number || "-");
            return (
              <div key={id} className="ma-card">
                <div className="ma-row1">
                  <span className="ma-title-line" style={{margin:0, flex:1}}>{md} · {tourName}</span>
                  <span className="ma-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                </div>
                <div className="ma-meta">
                  {depart && <><b>🕐 출발:</b> {depart}{" "}</>}
                  <b style={{ marginLeft: depart ? 8 : 0 }}>👥 인원:</b> {String(ppl)}명{" "}
                  <b style={{ marginLeft: 8 }}>📍 픽업:</b> {room}
                </div>
                {canCancel(String(r.status || "")) && (
                  <div className="ma-actions">
                    <button className="ma-cancel-btn" onClick={() => openCancel("shuttle_applications", id, `${md} · ${tourName}`)}>취소요청</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 애프터스쿨/필드트립 */}
      {tab === "fieldtrip" && (
        <div>
          {data.fieldtrip.length === 0 ? (
            <div className="ma-empty">신청 내역이 없습니다.</div>
          ) : data.fieldtrip.map((r: AnyRow) => {
            const meta = statusMeta(String(r.status || ""));
            const id = String(r.id || "");
            const title = String(r.request || r.title || "애프터스쿨/필드트립");
            return (
              <div key={id} className="ma-card">
                <div className="ma-row1">
                  <span className="ma-date">신청일 {fmtDate(String(r.created_at || ""))}</span>
                  <span className="ma-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                </div>
                <div className="ma-title-line">{title}</div>
                <div className="ma-meta">
                  <b>📅 날짜:</b> {fmtDate(String(r.date || ""))}{" "}
                  <b style={{ marginLeft: 8 }}>👥 인원:</b> {String(r.people_count ?? r.num_people ?? "-")}명
                </div>
                {canCancel(String(r.status || "")) && (
                  <div className="ma-actions">
                    <button className="ma-cancel-btn" onClick={() => openCancel("fieldtrip_applications", id, title)}>취소요청</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 튜터 */}
      {tab === "tutor" && (
        <div>
          {data.tutor.length === 0 ? (
            <div className="ma-empty">신청 내역이 없습니다.</div>
          ) : data.tutor.map((r: AnyRow) => {
            const meta = statusMeta(String(r.status || ""));
            const id = String(r.id || "");
            const studentName = String(r.student_name_kr || r.student_name_en || "학생");
            const classType = String(r.class_type || "");
            return (
              <div key={id} className="ma-card">
                <div className="ma-row1">
                  <span className="ma-date">신청일 {fmtDate(String(r.created_at || ""))}</span>
                  <span className="ma-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                </div>
                <div className="ma-title-line">{studentName} {classType && <span style={{ fontSize: 12, color: "#1a6fc4", marginLeft: 6 }}>· {classType}</span>}</div>
                <div className="ma-meta">
                  <b>📅 기간:</b> {fmtDate(String(r.start_date || ""))} ~ {fmtDate(String(r.end_date || ""))}
                </div>
                {(lessonsByApp[id]?.length ?? 0) > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => setDetail({ student: studentName, lessons: lessonsByApp[id] })}
                      style={{ padding: "8px 14px", background: "#1a6fc4", color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      📄 수업 일정 · 인보이스 보기
                    </button>
                  </div>
                )}
                {canCancel(String(r.status || "")) && (
                  <div className="ma-actions" style={{ gap: 6 }}>
                    {String(r.status || "") === "pending" && (
                      <button
                        onClick={() => openEdit(r)}
                        style={{ padding:"6px 12px", background:"#eff6ff", color:"#1d4ed8", border:"1px solid #bfdbfe", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                      >✏️ 수정</button>
                    )}
                    <button className="ma-cancel-btn" onClick={() => openCancel("tutor_requests", id, `${studentName} 튜터 수업`)}>취소요청</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 픽드랍 */}
      {tab === "pickup" && (
        <div>
          {data.pickup.length === 0 ? (
            <div className="ma-empty">신청 내역이 없습니다.</div>
          ) : data.pickup.map((r: AnyRow) => {
            const meta = statusMeta(String(r.status || ""));
            const id = String(r.id || "");
            const reqType = String(r.request_type || "");
            const isPickup = reqType === "pickup" || reqType === "extra_pickup";
            const isDrop = reqType === "dropoff" || reqType === "extra_drop";
            const typeLabel = reqType === "extra_pickup" ? "추가픽업"
              : reqType === "extra_drop" ? "추가드랍"
              : reqType === "pickup" ? "픽업"
              : reqType === "dropoff" ? "드랍"
              : reqType;
            const typeBg = isPickup ? "#dbeafe" : isDrop ? "#fef3c7" : "#f1f5f9";
            const typeFg = isPickup ? "#1d4ed8" : isDrop ? "#92400e" : "#475569";
            return (
              <div key={id} className="ma-card">
                <div className="ma-row1">
                  <span className="ma-date">신청일 {fmtDate(String(r.created_at || ""))}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="ma-badge" style={{ background: typeBg, color: typeFg }}>{typeLabel}</span>
                    <span className="ma-badge" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                  </div>
                </div>
                <div className="ma-title-line">
                  {String(r.location || "-")} → {String(r.destination || "-")}
                </div>
                <div className="ma-meta">
                  <b>📅 날짜:</b> {fmtDate(String(r.request_date || ""))} {String(r.request_time || "")}
                  {r.num_people != null && (<><b style={{ marginLeft: 8 }}>👥 인원:</b> {String(r.num_people)}명</>)}
                </div>
              </div>
            );
          })}
          <div className="ma-info">ℹ️ 픽드랍 신청 취소는 스탭에게 문의해주세요.</div>
        </div>
      )}
    </div>

    {editId && (
      <div className="ma-modal-bg" onClick={() => !editSaving && setEditId("")}>
        <div className="ma-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
          <h3>✏️ 신청 수정</h3>
          <div className="desc">대기중 상태에서만 수정 가능합니다.</div>
          <div className="ma-warn">⚠️ 인보이스가 발행되고 수정하시는 경우에는 반영이 불가할 수 있습니다.</div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display:"block", fontSize:12.5, fontWeight:700, color:"#374151", marginBottom:6 }}>수업 유형</label>
            <div style={{ display:"flex", gap:6 }}>
              {["1:1","1:2"].map(v => (
                <button key={v} type="button" onClick={() => setEditForm(f => ({ ...f, class_type: v }))}
                  style={{ flex:1, padding:"10px", border:"1.5px solid "+(editForm.class_type===v?"#1a6fc4":"#e2e8f0"), borderRadius:8, background:editForm.class_type===v?"#eff6ff":"#fff", color:editForm.class_type===v?"#1a6fc4":"#475569", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                >{v}</button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display:"block", fontSize:12.5, fontWeight:700, color:"#374151", marginBottom:6 }}>희망 요일</label>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {EDIT_DAYS.map(d => (
                <button key={d} type="button" onClick={() => toggleEditDay(d)}
                  style={{ flex:"1 1 auto", minWidth:42, padding:"8px 6px", border:"1.5px solid "+(editForm.preferred_days.includes(d)?"#1a6fc4":"#e2e8f0"), borderRadius:8, background:editForm.preferred_days.includes(d)?"#eff6ff":"#fff", color:editForm.preferred_days.includes(d)?"#1a6fc4":"#475569", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                >{d}</button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display:"block", fontSize:12.5, fontWeight:700, color:"#374151", marginBottom:6 }}>희망 시간</label>
            <input type="text" value={editForm.preferred_time}
              onChange={e => setEditForm(f => ({ ...f, preferred_time: e.target.value }))}
              placeholder="예: 14:00 ~ 14:50"
              style={{ width:"100%", padding:"10px 12px", border:"1px solid #e2e8f0", borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none" }}
            />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop: 14 }}>
            <div>
              <label style={{ display:"block", fontSize:12.5, fontWeight:700, color:"#374151", marginBottom:6 }}>시작일</label>
              <input type="date" value={editForm.start_date}
                onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))}
                style={{ width:"100%", padding:"9px 11px", border:"1px solid #e2e8f0", borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none" }}
              />
            </div>
            <div>
              <label style={{ display:"block", fontSize:12.5, fontWeight:700, color:"#374151", marginBottom:6 }}>종료일</label>
              <input type="date" value={editForm.end_date}
                onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))}
                style={{ width:"100%", padding:"9px 11px", border:"1px solid #e2e8f0", borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none" }}
              />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ display:"block", fontSize:12.5, fontWeight:700, color:"#374151", marginBottom:6 }}>요청사항</label>
            <textarea value={editForm.notes}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="요청사항을 입력해주세요"
              style={{ width:"100%", minHeight:70, padding:"9px 11px", border:"1px solid #e2e8f0", borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical" }}
            />
          </div>

          <div className="btns">
            <button className="btn-cl" onClick={() => setEditId("")} disabled={editSaving}>닫기</button>
            <button onClick={submitEdit} disabled={editSaving}
              style={{ padding:"9px 18px", background:"#1a6fc4", color:"#fff", border:"none", borderRadius:7, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:editSaving?0.6:1 }}
            >{editSaving ? "저장 중..." : "수정 저장"}</button>
          </div>
        </div>
      </div>
    )}

    {cancelModal.open && (
      <div className="ma-modal-bg" onClick={closeCancel}>
        <div className="ma-modal" onClick={e => e.stopPropagation()}>
          <h3>취소 요청</h3>
          <div className="desc"><b style={{ color: "#1a1a2e" }}>{cancelModal.title}</b><br />취소 요청 후에는 스탭이 확인 후 처리합니다.</div>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, display: "block" }}>사유 (선택)</label>
          <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="취소 사유를 입력해주세요" />
          <div className="btns">
            <button className="btn-cl" onClick={closeCancel} disabled={cancelSaving}>닫기</button>
            <button className="btn-ok" onClick={submitCancel} disabled={cancelSaving}>
              {cancelSaving ? "처리 중..." : "취소요청 확인"}
            </button>
          </div>
        </div>
      </div>
    )}

    {detail && (
      <div className="ma-modal-bg" onClick={() => setDetail(null)}>
        <div className="ma-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
          <h3>📄 {detail.student} 튜터 수업</h3>
          {detail.lessons.map((l: AnyRow, li: number) => {
            const sessions: AnyRow[] = Array.isArray(l.sessions) ? (l.sessions as AnyRow[]) : [];
            const rate = Number(l.hourly_rate) || 0;
            const cnt = Number(l.total_sessions) || sessions.length || 0;
            const total = Number(l.total_amount) || rate * cnt;
            return (
              <div key={li} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>
                  {l.tutor_name ? `${String(l.tutor_name)} 선생님` : "튜터 배정 예정"}
                  {l.class_type ? <span style={{ fontSize: 12, color: "#1a6fc4", fontWeight: 700, marginLeft: 6 }}>· {String(l.class_type)}</span> : null}
                </div>
                <div style={{ fontSize: 12.5, color: "#6b7c93", marginBottom: 10 }}>
                  📅 {fmtDate(String(l.start_date || ""))} ~ {fmtDate(String(l.end_date || ""))}{l.class_time ? ` · ${String(l.class_time)}` : ""}
                </div>
                <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#6b7c93" }}>회차</span><span style={{ fontWeight: 700 }}>{cnt}회</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}><span style={{ color: "#6b7c93" }}>1회 단가</span><span style={{ fontWeight: 700 }}>₱{rate.toLocaleString()}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 0", borderTop: "1px solid #e2e8f0", marginTop: 4 }}><span style={{ fontWeight: 800 }}>총 금액</span><span style={{ fontWeight: 800, color: "#1a6fc4" }}>₱{total.toLocaleString()}</span></div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 6 }}>🗓️ 수업 일정 ({sessions.length}일)</div>
                  {sessions.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{String(l.class_days || "")} {String(l.class_time || "")}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {sessions.map((s: AnyRow, si: number) => (
                        <div key={si} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                          <span>{fmtDate(String(s.session_date || ""))}</span>
                          <span style={{ color: "#6b7c93" }}>{String(s.session_time || l.class_time || "")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 12 }}>* 금액·일정은 확정 기준입니다. 변경은 스탭에게 문의해주세요.</div>
          <div className="btns" style={{ marginTop: 14 }}>
            <button className="btn-cl" onClick={() => setDetail(null)}>닫기</button>
          </div>
        </div>
      </div>
    )}

    {toast && <div className="ma-toast" role="status" aria-live="polite">{toast}</div>}
  </>);
}
