"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";

type Tab = "info" | "pickup" | "students" | "invoice" | "tutor" | "shuttle" | "comments";
interface Comment { id: string; booking_id: string; author: string; content: string; created_at: string }

const REQ_ST: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기중", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정",   bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
};

const PAY_ST: Record<string, { label: string; bg: string; color: string }> = {
  unpaid:  { label: "미납", bg: "#fef2f2", color: "#dc2626" },
  partial: { label: "부분납", bg: "#fef3c7", color: "#92400e" },
  paid:    { label: "완료", bg: "#dcfce7", color: "#166534" },
};

const BT_LABEL: Record<string, string> = {
  dreamhouse: "드림하우스 단독",
  dreamhouse_jaypark: "드하 + 제이파크",
  dreamhouse_cubenine: "드하 + 큐브나인",
  room_only: "숙소만 (Room Only)",
};

function fDate(d: string | null) { return d || "-"; }
function fAmt(n: number | null) { return n ? n.toLocaleString() + "원" : "-"; }

export default function BookingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("info");
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentAuthor, setCurrentAuthor] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (isAdminAuthed()) {
      setAuthed(true);
      const info = getAdminInfo();
      if (info?.name) setCurrentAuthor(info.name);
    } else if (typeof window !== "undefined") window.location.href = "/admin";
  }, []);

  const loadComments = useCallback(async () => {
    const res = await fetch(`/api/bookings/${id}/comments`);
    if (res.ok) { const d = await res.json(); setComments(d.comments || []); }
  }, [id]);

  useEffect(() => { if (authed && tab === "comments") loadComments(); }, [authed, tab, loadComments]);

  async function postComment() {
    if (!newComment.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/bookings/${id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: currentAuthor || "관리자", content: newComment }),
    });
    setPosting(false);
    if (!res.ok) { alert("작성 실패"); return; }
    setNewComment("");
    loadComments();
  }

  async function deleteComment(commentId: string) {
    if (!confirm("이 코멘트를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/bookings/${id}/comments?comment_id=${commentId}&author=${encodeURIComponent(currentAuthor)}`, { method: "DELETE" });
    if (!res.ok) { const r = await res.json(); alert(r.error || "삭제 실패"); return; }
    loadComments();
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/bookings/${id}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  if (!authed || loading) return null;
  if (!data || !data.booking) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "'Noto Sans KR',sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>예약을 찾을 수 없습니다</div>
        <button onClick={() => router.push("/admin/bookings")} style={{ marginTop: 16, padding: "10px 24px", background: "#1a6fc4", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← 예약 목록</button>
      </div>
    </div>
  );

  const b = data.booking;
  const students = data.students || [];
  const pickups = data.pickups || [];
  const checkin = data.checkin;
  const invoices = data.invoices || [];
  const accoms = data.accommodations || [];
  const tutorReqs = data.tutor_requests || [];
  const shuttleReqs = data.shuttle_requests || [];

  const payStatus = PAY_ST[b.payment_status] || PAY_ST.unpaid;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.mv-w{max-width:900px;margin:0 auto;padding:32px 24px}
.mv-back{background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:16px;display:inline-flex;align-items:center;gap:4px}.mv-back:hover{color:#1a6fc4}
.mv-head{background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.05);margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.mv-head h1{font-size:20px;font-weight:800;flex:1;min-width:200px}
.mv-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:#6b7c93}
.badge{display:inline-block;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700}
.tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:12px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
.tab{flex:1;padding:12px;font-size:14px;font-weight:700;text-align:center;border:none;border-radius:10px;cursor:pointer;font-family:inherit;background:transparent;color:#6b7c93;transition:all 150ms}
.tab:hover{color:#1a1a2e}.tab.ac{background:#1a6fc4;color:#fff}
.sec{background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.05);margin-bottom:16px}
.sec h2{font-size:15px;font-weight:800;color:#1a6fc4;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.item{padding:12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0}
.item .lbl{font-size:11px;font-weight:700;color:#6b7c93;margin-bottom:3px}
.item .val{font-size:14px;font-weight:600;color:#1a1a2e}
.stu-card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;gap:12px;align-items:center}
.stu-av{width:40px;height:40px;border-radius:10px;background:#e0e7ff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#3730a3;flex-shrink:0}
.stu-info{flex:1}.stu-info .nm{font-size:15px;font-weight:700}.stu-info .sub{font-size:12px;color:#6b7c93;margin-top:2px}
.pk-card{border-left:4px solid #1a6fc4;background:#f8fafc;border-radius:0 10px 10px 0;padding:14px;margin-bottom:8px}
.pk-card.drop{border-left-color:#16a34a}
.pk-row{display:flex;gap:8px;font-size:13px;margin-bottom:3px}.pk-row .lbl{font-weight:700;color:#6b7c93;min-width:50px}
.inv-card{border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center}
.inv-info{font-size:13px}.inv-info .tp{font-weight:700;margin-bottom:2px}
.btn{padding:10px 20px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#0d3d7a}
.btn-sm{padding:6px 14px;font-size:12px}
.btn-gray{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}.btn-gray:hover{background:#e2e8f0}
.empty{text-align:center;padding:32px;color:#94a3b8;font-size:13px}
@media(max-width:600px){.mv-w{padding:20px 12px}.grid{grid-template-columns:1fr}.mv-head{flex-direction:column;align-items:stretch}}
    `}</style>
    <div className="mv-w">
      <button className="mv-back" onClick={() => router.push("/admin/bookings")}>← 예약 목록으로</button>

      <div className="mv-head">
        <h1>{b.booker_name || b.reservation_no || "예약 상세"}</h1>
        <div className="mv-meta">
          {b.reservation_no && <span style={{ fontWeight: 700, color: "#1a6fc4" }}>{b.reservation_no}</span>}
          <span>{fDate(b.check_in || b.checkin_date)} ~ {fDate(b.check_out || b.checkout_date)}</span>
          <span className="badge" style={{ background: payStatus.bg, color: payStatus.color }}>{payStatus.label}</span>
          {b.booking_type && <span className="badge" style={{ background: "#e0e7ff", color: "#3730a3" }}>{BT_LABEL[b.booking_type] || b.booking_type}</span>}
          <span className="badge" style={{ background: b.confirmed ? "#dcfce7" : "#fef3c7", color: b.confirmed ? "#166534" : "#92400e" }}>{b.confirmed ? "확정" : "미확정"}</span>
        </div>
      </div>

      <div className="tabs">
        {([["info","기본정보"],["pickup","픽업/체크인"],["students","학생"],["invoice","인보이스"],["tutor","튜터"],["shuttle","셔틀"],["comments","코멘트"]] as const).map(([k,v]) => (
          <button key={k} className={`tab${tab===k?" ac":""}`} onClick={() => setTab(k as Tab)}>{v}</button>
        ))}
      </div>

      {/* 탭1: 기본정보 */}
      {tab === "info" && (<>
        <div className="sec">
          <h2>예약 정보</h2>
          <div className="grid">
            <div className="item"><div className="lbl">예약자</div><div className="val">{b.booker_name || "-"}</div></div>
            <div className="item"><div className="lbl">연락처</div><div className="val">{b.booker_phone || "-"}</div></div>
            <div className="item"><div className="lbl">체크인</div><div className="val">{fDate(b.check_in || b.checkin_date)}</div></div>
            <div className="item"><div className="lbl">체크아웃</div><div className="val">{fDate(b.check_out || b.checkout_date)}</div></div>
            <div className="item"><div className="lbl">아카데미 시작</div><div className="val">{fDate(b.academy_start)}</div></div>
            <div className="item"><div className="lbl">아카데미 종료</div><div className="val">{fDate(b.academy_end)}</div></div>
            <div className="item"><div className="lbl">예약유형</div><div className="val">{BT_LABEL[b.booking_type] || b.accom_type || "-"}</div></div>
            <div className="item"><div className="lbl">유학원</div><div className="val">{b.agency || "-"}</div></div>
          </div>
        </div>
        <div className="sec">
          <h2>항공편</h2>
          <div className="grid">
            <div className="item"><div className="lbl">입국 항공편</div><div className="val">{b.flight_in_airline || b.flight_in || "-"}</div></div>
            <div className="item"><div className="lbl">입국 날짜/시간</div><div className="val">{fDate(b.flight_in_date)} {b.flight_in_time || ""}</div></div>
            <div className="item"><div className="lbl">출국 항공편</div><div className="val">{b.flight_out_airline || b.flight_out || "-"}</div></div>
            <div className="item"><div className="lbl">출국 날짜/시간</div><div className="val">{fDate(b.flight_out_date)} {b.flight_out_time || ""}</div></div>
            <div className="item"><div className="lbl">픽업장소</div><div className="val">{b.pickup_place || "-"}</div></div>
            <div className="item"><div className="lbl">드랍장소</div><div className="val">{b.drop_place || b.drop_off || "-"}</div></div>
          </div>
        </div>
        <div className="sec">
          <h2>결제</h2>
          <div className="grid">
            <div className="item"><div className="lbl">결제상태</div><div className="val"><span className="badge" style={{ background: payStatus.bg, color: payStatus.color }}>{payStatus.label}</span></div></div>
            <div className="item"><div className="lbl">총 금액</div><div className="val">{fAmt(b.total_amount || b.final_price || b.base_price)}</div></div>
            <div className="item"><div className="lbl">납부 금액</div><div className="val">{fAmt(b.paid_amount)}</div></div>
            <div className="item"><div className="lbl">잔금 납부일</div><div className="val">{fDate(b.balance_due || b.balance_date)}</div></div>
          </div>
        </div>
        {b.special_request && <div className="sec"><h2>특이사항</h2><div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{b.special_request}</div></div>}
        {accoms.length > 0 && <div className="sec"><h2>숙소 상세</h2><div className="grid">
          {accoms.map((a: any) => (
            <div key={a.id} className="item">
              <div className="lbl">{a.accommodation_type}</div>
              <div className="val">{a.nights || 0}박 {a.package_type ? `(${a.package_type})` : ""}</div>
            </div>
          ))}
        </div></div>}
      </>)}

      {/* 탭3: 학생 */}
      {tab === "students" && (
        <div className="sec">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid #e2e8f0" }}>
            <h2 style={{ flex: 1, fontSize: 15, fontWeight: 800, color: "#1a6fc4" }}>학생 목록 ({students.length}명)</h2>
            <button className="btn btn-sm btn-blue" onClick={() => router.push(`/admin/bookings?tab=list`)}>+ 학생 추가</button>
          </div>
          {students.length === 0 ? <div className="empty">등록된 학생이 없습니다<br/>손님이 /booking 폼에서 등록하거나 어드민이 직접 추가할 수 있습니다</div> :
            students.map((s: any, i: number) => (
              <div key={s.id} className="stu-card" style={{ flexWrap: "wrap" }}>
                <div className="stu-av">{i + 1}</div>
                <div className="stu-info" style={{ width: "100%" }}>
                  <div className="nm">{s.name_kr || "-"} {s.name_en ? `(${s.name_en})` : ""}</div>
                  <div className="sub">
                    {s.age || "-"} · {s.level === "kinder" ? "킨더" : s.level === "junior" ? "주니어" : "-"} · {s.class_type === "morning" ? "오전반" : s.class_type === "fullday" ? "종일반" : "-"}
                    {s.academy_start && ` · ${s.academy_start} ~ ${s.academy_end || ""}`}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8, fontSize: 12 }}>
                    <div><span style={{ color: "#6b7c93", fontWeight: 700 }}>SSP:</span> {s.ssp ? "있음" : "없음"}</div>
                    <div><span style={{ color: "#6b7c93", fontWeight: 700 }}>사진허용:</span> {s.photo_allowed ? "O" : "X"}</div>
                    <div><span style={{ color: "#6b7c93", fontWeight: 700 }}>픽드롭:</span> {s.pickup_location || "-"}</div>
                    <div><span style={{ color: "#6b7c93", fontWeight: 700 }}>주소:</span> {s.address_detail || "-"}</div>
                  </div>
                  {s.special_request && <div style={{ marginTop: 8, padding: 8, background: "#fef3c7", borderRadius: 6, fontSize: 12, color: "#92400e" }}>📝 {s.special_request}</div>}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* 탭3: 픽업/체크인 */}
      {tab === "pickup" && (<>
        <div className="sec">
          <h2>픽업/드랍 ({pickups.length}건)</h2>
          {pickups.length === 0 ? <div className="empty">픽업 일정이 없습니다</div> :
            pickups.map((p: any) => (
              <div key={p.id} className={`pk-card${p.request_type === "dropoff" ? " drop" : ""}`}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="badge" style={{ background: p.request_type === "pickup" ? "#dbeafe" : "#dcfce7", color: p.request_type === "pickup" ? "#1e40af" : "#166534" }}>
                    {p.request_type === "pickup" ? "픽업" : "드랍"}
                  </span>
                  <span className="badge" style={{ background: p.status === "confirmed" ? "#dcfce7" : "#fef3c7", color: p.status === "confirmed" ? "#166534" : "#92400e" }}>{p.status}</span>
                </div>
                <div className="pk-row"><span className="lbl">날짜</span>{fDate(p.request_date)}</div>
                <div className="pk-row"><span className="lbl">시간</span>{p.request_time || "-"}</div>
                <div className="pk-row"><span className="lbl">출발</span>{p.location || "-"}</div>
                <div className="pk-row"><span className="lbl">도착</span>{p.destination || "-"}</div>
                <div className="pk-row"><span className="lbl">인원</span>{p.num_people || 0}명</div>
              </div>
            ))
          }
        </div>
        <div className="sec">
          <h2>체크인 디테일</h2>
          {!checkin ? (
            <div className="empty">체크인 디테일이 아직 생성되지 않았습니다<br/><button className="btn btn-sm btn-blue" style={{ marginTop: 12 }} onClick={() => router.push("/admin/checkin-details")}>체크인 디테일 페이지로 이동</button></div>
          ) : (<div className="grid">
            <div className="item"><div className="lbl">침대세팅</div><div className="val">Master {checkin.bed_setting?.master_2f || 0} / Small {checkin.bed_setting?.small_2f || 0} / 1F {checkin.bed_setting?.floor_1f || 0}</div></div>
            <div className="item"><div className="lbl">USIM</div><div className="val">SIM {checkin.usim?.sim || 0} / LOAD {checkin.usim?.load || 0}</div></div>
            <div className="item"><div className="lbl">전체 투숙객</div><div className="val">{checkin.all_guests || "-"}</div></div>
            {checkin.etc_notes && <div className="item"><div className="lbl">메모</div><div className="val">{checkin.etc_notes}</div></div>}
          </div>)}
        </div>
      </>)}

      {/* 탭4: 인보이스 */}
      {tab === "invoice" && (
        <div className="sec">
          <h2>인보이스 ({invoices.length}건)</h2>
          {invoices.length === 0 ? (
            <div className="empty">
              발행된 인보이스가 없습니다
              <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
                <button className="btn btn-sm btn-blue" onClick={() => router.push(`/invoice?id=${id}&type=guest`)}>손님용 생성</button>
                <button className="btn btn-sm btn-gray" onClick={() => router.push(`/invoice?id=${id}&type=resort`)}>리조트용 생성</button>
              </div>
            </div>
          ) : (<>
            {invoices.map((inv: any) => {
              const typeLabel: Record<string, string> = { guest_kr: "손님용 (한국어)", resort_en_jaypark: "리조트용 (제이파크)", resort_en_cubenine: "리조트용 (큐브나인)" };
              return (
                <div key={inv.id} className="inv-card">
                  <div className="inv-info">
                    <div className="tp">{typeLabel[inv.invoice_type] || inv.invoice_type}</div>
                    <div style={{ color: "#6b7c93", fontSize: 12 }}>발행: {inv.issued_at?.slice(0, 10) || "-"} {inv.sent_at ? `· 발송: ${inv.sent_at.slice(0, 10)}` : ""}</div>
                  </div>
                  <button className="btn btn-sm btn-gray" onClick={() => window.print()}>PDF</button>
                </div>
              );
            })}
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button className="btn btn-sm btn-blue" onClick={() => router.push(`/invoice?id=${id}&type=guest`)}>손님용 생성</button>
              <button className="btn btn-sm btn-gray" onClick={() => router.push(`/invoice?id=${id}&type=resort`)}>리조트용 생성</button>
            </div>
          </>)}
        </div>
      )}

      {/* 탭5: 튜터 */}
      {tab === "tutor" && (
        <div className="sec">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid #e2e8f0" }}>
            <h2 style={{ flex: 1, fontSize: 15, fontWeight: 800, color: "#1a6fc4" }}>튜터 신청 ({tutorReqs.length}건)</h2>
            <button className="btn btn-sm btn-blue" onClick={() => alert("튜터 신청 추가 기능은 /admin/tutors에서 사용하세요.")}>+ 튜터 신청 추가</button>
          </div>
          {tutorReqs.length === 0 ? <div className="empty">튜터 신청 내역이 없습니다<br/>손님이 /portal/tutor에서 신청하면 여기에 표시됩니다</div> :
            tutorReqs.map((t: any) => {
              const st = REQ_ST[t.status] || REQ_ST.pending;
              return (
                <div key={t.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 8, background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{t.student_name_kr || "-"} {t.student_name_en ? `(${t.student_name_en})` : ""}</div>
                    <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12, color: "#475569" }}>
                    <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>유형:</span> {t.class_type || "-"}</div>
                    <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>나이:</span> {t.student_age || "-"}</div>
                    <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>기간:</span> {t.start_date || "-"} ~ {t.end_date || "-"}</div>
                    <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>요일:</span> {(t.preferred_days_arr || []).join(",") || "-"}</div>
                    <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>시간:</span> {t.preferred_time || "-"}</div>
                    <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>영어:</span> {t.level_english || "-"}</div>
                    {t.class_style && <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>방향:</span> {t.class_style}</div>}
                    {t.textbook && <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>교재:</span> {t.textbook}</div>}
                  </div>
                  {t.child_personality && <div style={{ marginTop: 8, padding: 8, background: "#fff", borderRadius: 6, fontSize: 12 }}>👦 {t.child_personality}</div>}
                </div>
              );
            })
          }
        </div>
      )}

      {/* 탭7: 코멘트 */}
      {tab === "comments" && (
        <div className="sec">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid #e2e8f0" }}>
            <h2 style={{ flex: 1, fontSize: 15, fontWeight: 800, color: "#1a6fc4" }}>💬 직원 코멘트 ({comments.length})</h2>
          </div>

          {/* 작성 폼 */}
          <div style={{ marginBottom: 16, padding: 14, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 12, color: "#6b7c93", marginBottom: 6 }}>작성자: <b style={{ color: "#1a6fc4" }}>{currentAuthor || "관리자"}</b></div>
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="이 손님에 대한 메모를 작성하세요..."
              style={{ width: "100%", padding: 10, border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical", minHeight: 70, marginBottom: 8 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-sm btn-blue"
                onClick={postComment}
                disabled={posting || !newComment.trim()}
                style={{ opacity: posting || !newComment.trim() ? 0.5 : 1 }}>
                {posting ? "작성 중..." : "작성"}
              </button>
            </div>
          </div>

          {/* 코멘트 목록 */}
          {comments.length === 0 ? (
            <div className="empty">작성된 코멘트가 없습니다</div>
          ) : (
            comments.map(c => (
              <div key={c.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 8, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a6fc4" }}>✍️ {c.author}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {new Date(c.created_at).toLocaleString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {c.author === currentAuthor && (
                      <button onClick={() => deleteComment(c.id)} style={{ marginLeft: 8, padding: "2px 8px", fontSize: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", borderRadius: 4, cursor: "pointer", fontFamily: "inherit" }}>삭제</button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#1a1a2e" }}>{c.content}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 탭6: 셔틀 */}
      {tab === "shuttle" && (
        <div className="sec">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid #e2e8f0" }}>
            <h2 style={{ flex: 1, fontSize: 15, fontWeight: 800, color: "#1a6fc4" }}>셔틀 신청 ({shuttleReqs.length}건)</h2>
            <button className="btn btn-sm btn-blue" onClick={() => router.push("/admin/shuttle")}>+ 셔틀 관리로</button>
          </div>
          {shuttleReqs.length === 0 ? <div className="empty">셔틀 신청 내역이 없습니다<br/>손님이 /portal/shuttle에서 신청하면 여기에 표시됩니다</div> :
            shuttleReqs.map((s: any) => {
              const st = REQ_ST[s.status] || REQ_ST.pending;
              return (
                <div key={s.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 8, background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{s.request_date || "-"} {s.request_time || ""}</div>
                    <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12, color: "#475569" }}>
                    <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>장소:</span> {s.destination || "-"}</div>
                    <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>인원:</span> {s.num_people || 0}명</div>
                    <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>왕복:</span> {s.round_trip ? "왕복" : "편도"}</div>
                    {s.notes && <div style={{ gridColumn: "1/3" }}><span style={{ fontWeight: 700, color: "#6b7c93" }}>메모:</span> {s.notes.replace(/portal_booking_id:[a-f0-9-]+/gi, "").trim() || "-"}</div>}
                  </div>
                </div>
              );
            })
          }
        </div>
      )}
    </div>
  </>);
}
