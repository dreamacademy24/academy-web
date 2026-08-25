"use client";
import { useState, useEffect, useCallback } from "react";
import { toastErr, toastOk } from "@/lib/toast";
import { useRouter, useParams } from "next/navigation";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";
import { generatePortalId, generateTempPassword } from "@/lib/portalUtils";
import { isCommuteBooking, getBookingCategory } from "@/lib/bookingTypes";
import { fmtRoom } from "@/lib/format";
import { supabase } from "@/lib/supabase";

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

const ACC_KR_D: Record<string, string> = { jaypark: "제이파크", dreamhouse: "드림하우스", cubenine: "큐브나인" };
function fDate(d: string | null) { return d || "-"; }
function fAmt(n: number | null) { return n ? n.toLocaleString() + "원" : "-"; }

function addDaysISO(dateStr: string, n: number): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function deriveAcademyStart(checkin: string): string {
  if (!checkin) return "";
  const d = new Date(checkin);
  const day = d.getDay();
  return addDaysISO(checkin, (8 - day) % 7);
}
function deriveAcademyEnd(checkin: string, weeks: number | string | null | undefined): string {
  const start = deriveAcademyStart(checkin);
  const w = Number(weeks);
  if (!start || !w || w < 1) return "";
  return addDaysISO(start, (w - 1) * 7 + 4);
}

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

  // 기본정보 편집 모드
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [agencyModal, setAgencyModal] = useState(false);
  const [agencyList, setAgencyList] = useState<string[]>([]);
  async function openAgencyModal(){
    try{ const {data}=await supabase.from("agencies").select("name").order("name"); setAgencyList((data||[]).map((r:any)=>r.name).filter(Boolean)); }catch{}
    setAgencyModal(true);
  }

  // 학생/픽업/셔틀 row 편집 (단일 row만 동시 편집 가능)
  // students는 booking_json 학생(DB row 없음)도 idx로 식별 가능하게
  const [rowEditing, setRowEditing] = useState<{table:string; id:string|null; idx:number|null} | null>(null);
  const [rowForm, setRowForm] = useState<Record<string, any>>({});
  const [rowSaving, setRowSaving] = useState(false);

  // 보호자 체류 기간 (식단 인원 연동)
  const [gsEditing, setGsEditing] = useState(false);
  const [gsRows, setGsRows] = useState<Array<{ name: string; from: string; to: string }>>([]);
  const [gsSaving, setGsSaving] = useState(false);
  // 보호자 추가요금 → 인보이스 추가 항목 등록
  const [gsInvOn, setGsInvOn] = useState(false);
  const [gsInvName, setGsInvName] = useState("보호자 추가 체류");
  const [gsInvAmt, setGsInvAmt] = useState<string>("");

  // 올인원 패키지 / 포털 계정
  const [isAllInOne, setIsAllInOne] = useState<boolean>(false);
  const [portalUsername, setPortalUsername] = useState('');
  const [portalTempPw, setPortalTempPw] = useState('');
  const [portalUserId, setPortalUserId] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalMsg, setPortalMsg] = useState('');

  useEffect(() => {
    if (isAdminAuthed()) {
      setAuthed(true);
      const info = getAdminInfo();
      if (info?.name) setCurrentAuthor(info.name);
    } else if (typeof window !== "undefined") window.location.href = "/login";
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
    if (!res.ok) { toastErr("작성 실패"); return; }
    setNewComment("");
    loadComments();
  }

  async function deleteComment(commentId: string) {
    if (!confirm("이 코멘트를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/bookings/${id}/comments?comment_id=${commentId}&author=${encodeURIComponent(currentAuthor)}`, { method: "DELETE" });
    if (!res.ok) { const r = await res.json(); toastErr(r.error || "삭제 실패"); return; }
    loadComments();
  }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/bookings/${id}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [id]);

  // booking 로드 시 올인원/포털 state 세팅
  useEffect(() => {
    const bk = data?.booking;
    if (!bk) return;
    setIsAllInOne(bk.is_all_in_one || false);
    setPortalUsername(bk.portal_username || '');
    setPortalTempPw(bk.portal_temp_pw || '');
    setPortalUserId(bk.portal_user_id || '');
  }, [data]);

  async function toggleAllInOne(val: boolean) {
    setIsAllInOne(val);
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_all_in_one: val })
    });
    if (val && !portalUsername && data?.booking) {
      setPortalUsername(generatePortalId(data.booking.booker_name || '', data.booking.reservation_no || ''));
      setPortalTempPw(generateTempPassword());
    }
  }

  async function handleIssueAccount() {
    if (portalUsername.length < 5 || portalUsername.length > 8) {
      setPortalMsg('아이디는 5~8자여야 합니다'); return;
    }
    setPortalLoading(true); setPortalMsg('');
    const res = await fetch('/api/admin/create-portal-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: id, username: portalUsername, password: portalTempPw })
    });
    const r = await res.json();
    if (!res.ok) { setPortalMsg(r.error || '오류 발생'); }
    else { setPortalMsg('✅ 계정 발급 완료!'); setPortalUserId(r.userId); }
    setPortalLoading(false);
  }

  async function handleResetPassword() {
    const newPw = generateTempPassword();
    setPortalLoading(true); setPortalMsg('');
    const res = await fetch('/api/admin/create-portal-user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: id, newPassword: newPw })
    });
    if (res.ok) { setPortalTempPw(newPw); setPortalMsg(`✅ 새 비번: ${newPw}`); }
    else { setPortalMsg('비번 재설정 실패'); }
    setPortalLoading(false);
  }

  function startEdit(b: Record<string, any>) {
    const studentsArr = Array.isArray(data?.students) ? data!.students : [];
    setEditForm({
      booker_name: b.booker_name || "",
      booker_phone: b.booker_phone || "",
      checkin_date: b.check_in || b.checkin_date || "",
      checkout_date: b.check_out || b.checkout_date || "",
      accom_weeks: String(b.accom_weeks || ""),
      accom_type: b.accom_type || "",
      agency: b.agency || "",
      flight_in: b.flight_in || "",
      flight_out: b.flight_out || "",
      flight_in_airline: b.flight_in_airline || "",
      flight_in_no: b.flight_in_no || "",
      flight_in_date: (b.flight_in_date || "").split("T")[0] || "",
      flight_in_time: b.flight_in_time || "",
      flight_in_origin: b.flight_in_origin || "",
      flight_in_undecided: b.flight_in_undecided ? "1" : "",
      flight_out_airline: b.flight_out_airline || "",
      flight_out_no: b.flight_out_no || "",
      flight_out_date: (b.flight_out_date || "").split("T")[0] || "",
      flight_out_time: b.flight_out_time || "",
      flight_out_destination: b.flight_out_destination || "",
      flight_out_undecided: b.flight_out_undecided ? "1" : "",
      pickup_place: b.pickup_place || "",
      drop_off: b.drop_place || b.drop_off || "",
      adults: String(b.adults ?? b.num_adults ?? ""),
      children: String(b.children ?? b.num_children ?? (studentsArr.length || "")),
      house_no: b.house_no || b.accom_room || b.room_no || b.room_number || "",
      academy_start: b.academy_start || deriveAcademyStart(b.check_in || b.checkin_date) || "",
      late_checkout: b.late_checkout ? "1" : "",
      seg1_type: b.seg1_type || "",
      seg1_checkin: (b.seg1_checkin || "").split("T")[0] || "",
      seg1_checkout: (b.seg1_checkout || "").split("T")[0] || "",
      seg2_type: b.seg2_type || "",
      seg2_checkin: (b.seg2_checkin || "").split("T")[0] || "",
      seg2_checkout: (b.seg2_checkout || "").split("T")[0] || "",
      extra_stay_checkin: b.extra_stay_checkin || "",
      extra_stay_checkout: b.extra_stay_checkout || "",
    });
    setEditing(true);
  }
  function startRowEdit(table: string, row: any, idx?: number) {
    const rowId = row.id && /^[0-9a-f-]{36}$/i.test(row.id) ? row.id : null;
    setRowEditing({ table, id: rowId, idx: idx ?? null });
    if (table === "students") {
      // 학생 편집 시 academy_start/end 자동 기본값 (booking 정보 기반)
      const bk = data?.booking || {};
      const isCommute = isCommuteBooking(bk);
      const rawCheckin = (bk.check_in || bk.checkin_date || "").split("T")[0];
      const rawCheckout = (bk.check_out || bk.checkout_date || "").split("T")[0];
      const bStart = (bk.academy_start || "").split("T")[0]
        || (isCommute ? rawCheckin : deriveAcademyStart(rawCheckin));
      const bWeeks = Number(bk.accom_weeks) || 0;
      const derivedEnd = isCommute
        ? (rawCheckout || (bStart && bWeeks > 0 ? deriveAcademyEnd(rawCheckin, bWeeks) : ""))
        : (bStart && bWeeks > 0 ? deriveAcademyEnd(rawCheckin, bWeeks) : (rawCheckout || ""));
      setRowForm({
        ...row,
        academy_start: row.academy_start || row.academyStart || bStart || "",
        academy_end:   row.academy_end   || row.academyEnd   || derivedEnd || "",
      });
    } else {
      setRowForm({ ...row });
    }
  }
  // 직원 직접 픽드랍 등록 (손님이 채팅으로 신청한 건 — 예: 아빠 추가 입국 공항 픽업)
  const [pkAdding, setPkAdding] = useState(false);
  const [pkSaving, setPkSaving] = useState(false);
  const [pkForm, setPkForm] = useState({ request_type: "extra_pickup", request_date: "", request_time: "", location: "공항", destination: "", num_people: 1, notes: "" });
  const [pkTicket, setPkTicket] = useState<File | null>(null);
  // 항공권 업로드 (사진/PDF) → staff-files/flight/{bookingId}/ → public URL
  async function uploadTicketFile(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("image", file);
    fd.append("bookingId", String(id));
    fd.append("target", "pickup");
    const r = await fetch("/api/upload-flight-image", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.publicUrl) { toastErr("항공권 업로드 실패: " + (j.error || r.status)); return null; }
    return j.publicUrl as string;
  }
  async function savePkAdd() {
    if (!pkForm.request_date) { toastErr("날짜를 입력해주세요."); return; }
    // 유형 자동 감지: 도착=공항인데 픽업 / 출발=공항인데 드랍이면 확인 후 자동 교정 (기본값 실수 방지)
    const _dst = (pkForm.destination || "") + "", _src = (pkForm.location || "") + "";
    const airport = (v: string) => /공항|airport|막탄|mcia/i.test(v);
    let fixedType = pkForm.request_type;
    if (airport(_dst) && !airport(_src) && pkForm.request_type.includes("pickup")) {
      if (window.confirm("도착지가 공항이에요 — '추가 드랍'이 맞는 것 같아요.\n추가 드랍으로 바꿔서 등록할까요?")) fixedType = "extra_drop";
    } else if (airport(_src) && !airport(_dst) && pkForm.request_type.includes("drop")) {
      if (window.confirm("출발지가 공항이에요 — '추가 픽업'이 맞는 것 같아요.\n추가 픽업으로 바꿔서 등록할까요?")) fixedType = "extra_pickup";
    }
    if (fixedType !== pkForm.request_type) setPkForm(p => ({ ...p, request_type: fixedType }));
    const _typeToSave = fixedType;
    setPkSaving(true);
    try {
      let ticket_url = "";
      if (pkTicket) {
        const u = await uploadTicketFile(pkTicket);
        if (!u) return;
        ticket_url = u;
      }
      const fields: Record<string, unknown> = { ...pkForm, request_type: _typeToSave };
      if (ticket_url) fields.ticket_url = ticket_url;
      const r = await fetch(`/api/bookings/${id}/update-row`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "pickup_requests", fields }) });
      const d = await r.json();
      if (!r.ok) { toastErr("등록 실패: " + (d.error || r.status)); return; }
      setPkAdding(false);
      setPkForm({ request_type: "extra_pickup", request_date: "", request_time: "", location: "공항", destination: "", num_people: 1, notes: "" });
      setPkTicket(null);
      toastOk("픽드랍이 등록됐어요." + (ticket_url ? " (항공권 첨부됨)" : ""));
      load();
    } finally { setPkSaving(false); }
  }

  async function saveRowEdit() {
    if (!rowEditing) return;
    setRowSaving(true);
    const fieldsByTable: Record<string, string[]> = {
      students: ["name_kr","name_en","age","level","class_type","academy_start","academy_end","ssp","photo_allowed","pickup_location","address_detail","special_request"],
      pickup_requests: ["request_type","request_date","request_time","location","destination","num_people","notes","status","ticket_url"],
      shuttle_requests: ["request_date","request_time","destination","num_people","round_trip","notes","status"],
    };
    const allowed = fieldsByTable[rowEditing.table] || [];
    const fields: Record<string, any> = {};
    for (const k of allowed) if (k in rowForm) fields[k] = rowForm[k];

    // 학생: DB row(UUID) 있으면 PATCH + JSONB 동기화. 없으면(booking_json) JSONB만 업데이트
    if (rowEditing.table === "students") {
      // 1) DB row 있을 때만 PATCH
      if (rowEditing.id) {
        const res = await fetch(`/api/bookings/${id}/update-row`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: "students", rowId: rowEditing.id, fields }),
        });
        if (!res.ok && res.status !== 404) {
          const j = await res.json().catch(()=>({}));
          toastErr("저장 실패: " + (j.error || "알 수 없는 오류"));
          setRowSaving(false);
          return;
        }
      }
      // 2) JSONB 동기화 (모든 학생 케이스 — DB row가 있어도 다른 페이지 호환 위해, 없어도 유일한 저장처)
      const arr = (data?.students || []).map((s: any, i: number) => {
        const matchesById = rowEditing.id && s.id === rowEditing.id;
        const matchesByIdx = rowEditing.idx !== null && rowEditing.idx === i;
        if (!matchesById && !matchesByIdx) return s;
        return {
          ...s,
          ...fields,
          // legacy field 동기화
          korName: fields.name_kr || s.korName || "",
          engName: fields.name_en || s.engName || "",
          grade: fields.level === "kinder" ? "킨더" : fields.level === "junior" ? "주니어" : (s.grade || ""),
          academyStart: fields.academy_start || s.academyStart || "",
          academyEnd: fields.academy_end || s.academyEnd || "",
          photo: fields.photo_allowed === false ? "X" : "O",
        };
      });
      const putRes = await fetch(`/api/bookings/${id}/update-row`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentsJsonb: arr }),
      });
      if (!putRes.ok) {
        const j = await putRes.json().catch(()=>({}));
        toastErr("JSONB 저장 실패: " + (j.error || "알 수 없는 오류"));
        setRowSaving(false);
        return;
      }
    } else {
      // pickup_requests / shuttle_requests: 일반 PATCH
      if (!rowEditing.id) { setRowSaving(false); toastErr("row id 없음"); return; }
      const res = await fetch(`/api/bookings/${id}/update-row`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: rowEditing.table, rowId: rowEditing.id, fields }),
      });
      if (!res.ok) {
        const j = await res.json().catch(()=>({}));
        toastErr("저장 실패: " + (j.error || "알 수 없는 오류"));
        setRowSaving(false);
        return;
      }
    }
    setRowSaving(false);
    setRowEditing(null);
    load();
  }

  async function saveEdit() {
    setSaving(true);
    const payload: Record<string, any> = {
      booker_name: (editForm.booker_name || "").trim() || null,
      booker_phone: (editForm.booker_phone || "").trim() || null,
      checkin_date: editForm.checkin_date || null,
      checkout_date: editForm.checkout_date || null,
      late_checkout: !!editForm.late_checkout,
      accom_weeks: Number(editForm.accom_weeks) || null,
      accom_type: editForm.accom_type || null,
      seg1_type: editForm.seg1_type || null,
      seg1_checkin: editForm.seg1_checkin || null,
      seg1_checkout: editForm.seg1_checkout || null,
      seg2_type: editForm.seg2_type || null,
      seg2_checkin: editForm.seg2_checkin || null,
      seg2_checkout: editForm.seg2_checkout || null,
      extra_stay_checkin: editForm.extra_stay_checkin || null,
      extra_stay_checkout: editForm.extra_stay_checkout || null,
      agency: (editForm.agency || "").trim() || null,
      flight_in: (editForm.flight_in || "").trim() || null,
      flight_out: (editForm.flight_out || "").trim() || null,
      flight_in_airline: (editForm.flight_in_airline || "").trim() || null,
      flight_in_no: (editForm.flight_in_no || "").trim() || null,
      flight_in_date: editForm.flight_in_date || null,
      flight_in_time: editForm.flight_in_time || null,
      flight_in_origin: (editForm.flight_in_origin || "").trim() || null,
      flight_in_undecided: !!editForm.flight_in_undecided,
      flight_out_airline: (editForm.flight_out_airline || "").trim() || null,
      flight_out_no: (editForm.flight_out_no || "").trim() || null,
      flight_out_date: editForm.flight_out_date || null,
      flight_out_time: editForm.flight_out_time || null,
      flight_out_destination: (editForm.flight_out_destination || "").trim() || null,
      flight_out_undecided: !!editForm.flight_out_undecided,
      pickup_place: (editForm.pickup_place || "").trim() || null,
      drop_off: (editForm.drop_off || "").trim() || null,
      adults: editForm.adults !== undefined && editForm.adults !== "" ? Number(editForm.adults) : null,
      children: editForm.children !== undefined && editForm.children !== "" ? Number(editForm.children) : null,
      house_no: fmtRoom(editForm.house_no) || null,
      academy_start: editForm.academy_start || null,
      academy_end: (() => {
        const isCommute = isCommuteBooking(editForm);
        if (isCommute) {
          // 통학형: checkout_date를 academy_end로 사용 (source of truth)
          return editForm.checkout_date || (editForm.academy_start ? deriveAcademyEnd(editForm.academy_start, editForm.accom_weeks) || null : null);
        }
        return editForm.academy_start
          ? deriveAcademyEnd(editForm.academy_start, editForm.accom_weeks) || null
          : null;
      })(),
      updated_at: new Date().toISOString(),
    };
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toastErr("저장 실패: " + (j.error || "알 수 없는 오류"));
      return;
    }
    // 학생 academy 날짜 동기화: 예약의 academy_start/academy_end(기간) 변경 시 연결 학생도 함께 갱신.
    // 학생관리 리스트/달력은 bookings.students JSONB의 academyEnd를 읽으므로, 이 동기화가 없으면
    // 예약 상세 값과 학생 값이 어긋나 "날짜 불일치" 경고가 발생함.
    const syncStart = (payload.academy_start as string) || "";
    const syncEnd = (payload.academy_end as string) || "";
    if (syncStart || syncEnd) {
      const studs = ((data as any)?.students || []) as any[];
      if (studs.length > 0) {
        // 1) JSONB 동기화 (연결된 모든 학생) — 학생관리가 읽는 유일/주 소스
        const arr = studs.map((s) => ({
          ...s,
          academy_start: syncStart || s.academy_start || s.academyStart || "",
          academy_end:   syncEnd   || s.academy_end   || s.academyEnd   || "",
          academyStart:  syncStart || s.academyStart || s.academy_start || "",
          academyEnd:    syncEnd   || s.academyEnd   || s.academy_end   || "",
        }));
        const sres = await fetch(`/api/bookings/${id}/update-row`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentsJsonb: arr }),
        });
        if (!sres.ok) {
          const j = await sres.json().catch(() => ({}));
          toastErr("학생 날짜 동기화 실패: " + (j.error || "알 수 없는 오류"));
        }
        // 2) students 테이블 DB row 동기화 (UUID 있는 학생만, booking_id는 API에서 검증)
        for (const s of studs) {
          const rid = s.id && /^[0-9a-f-]{36}$/i.test(String(s.id)) ? s.id : null;
          if (!rid) continue;
          await fetch(`/api/bookings/${id}/update-row`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "students", rowId: rid, fields: { academy_start: syncStart || null, academy_end: syncEnd || null } }),
          }).catch(() => {});
        }
      }
    }
    setEditing(false);
    load();
  }

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
.ed-inp{width:100%;padding:7px 10px;border:1px solid #cbd5e1;border-radius:7px;font-size:13px;font-family:inherit;outline:none;background:#fff;color:#1a1a2e;font-weight:600}.ed-inp:focus{border-color:#1a6fc4;box-shadow:0 0 0 2px rgba(26,111,196,0.1)}
.ed-bar{display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px}
.ed-note{font-size:11px;color:#94a3b8;margin-top:4px}
@media(max-width:600px){.mv-w{padding:20px 12px}.grid{grid-template-columns:1fr}.mv-head{flex-direction:column;align-items:stretch}}
    `}</style>
    <div className="mv-w">
      <button className="mv-back" onClick={() => router.push("/admin/bookings?tab=confirmed")}>← 예약 목록으로</button>

      <div style={{ fontSize: 22, color: "#1a6fc4", fontWeight: 700, marginBottom: 8 }}>📋 예약 상세</div>

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
        {([["info","기본정보"],["pickup","픽업/체크인"],["students","학생"],["tutor","튜터"],["shuttle","셔틀"],["comments","코멘트"]] as const).map(([k,v]) => (
          <button key={k} className={`tab${tab===k?" ac":""}`} onClick={() => setTab(k as Tab)}>{v}</button>
        ))}
      </div>

      {/* 탭1: 기본정보 */}
      {tab === "info" && (<>
        <div className="ed-bar">
          {!editing ? (
            <button className="btn btn-sm btn-blue" onClick={()=>startEdit(b)}>✏️ 수정</button>
          ) : (<>
            <button className="btn btn-sm btn-gray" onClick={()=>setEditing(false)} disabled={saving}>취소</button>
            <button className="btn btn-sm btn-blue" onClick={saveEdit} disabled={saving}>{saving?"저장 중...":"💾 저장"}</button>
          </>)}
        </div>
        {/* 올인원 패키지 섹션 */}
        <div style={{margin:'6px 0 18px', padding:16, background:'#fefce8', borderRadius:10, border:'1px solid #fde68a'}}>
          <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:12}}>
            <span style={{fontWeight:700, fontSize:15}}>🌟 올인원패키지</span>
            <label style={{display:'flex', alignItems:'center', gap:6, cursor:'pointer'}}>
              <input
                type="checkbox"
                checked={isAllInOne}
                onChange={e => toggleAllInOne(e.target.checked)}
                style={{width:18, height:18, cursor:'pointer'}}
              />
              <span style={{fontSize:13, color:'#92400e'}}>{isAllInOne ? '해당' : '미해당'}</span>
            </label>
          </div>

          {isAllInOne && (
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {portalUserId ? (
                <div style={{display:'flex', flexDirection:'column', gap:6}}>
                  <div style={{fontSize:13}}>
                    <b>포털 아이디:</b> <code style={{background:'#f1f5f9', padding:'2px 8px', borderRadius:4}}>{portalUsername}</code>
                  </div>
                  <div style={{fontSize:13}}>
                    <b>현재 임시 비번:</b> <code style={{background:'#f1f5f9', padding:'2px 8px', borderRadius:4}}>{portalTempPw}</code>
                  </div>
                  <button
                    onClick={handleResetPassword}
                    disabled={portalLoading}
                    style={{alignSelf:'flex-start', padding:'6px 14px', background:'#f59e0b', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontSize:13}}
                  >
                    🔄 비번 재설정
                  </button>
                </div>
              ) : (
                <div style={{display:'flex', flexDirection:'column', gap:8}}>
                  <div style={{display:'flex', gap:8, alignItems:'center'}}>
                    <div style={{flex:1}}>
                      <label style={{fontSize:12, color:'#6b7280', display:'block', marginBottom:2}}>아이디 (5~8자)</label>
                      <input
                        value={portalUsername}
                        onChange={e => setPortalUsername(e.target.value.replace(/[^a-zA-Z0-9]/g,'').slice(0,8))}
                        maxLength={8}
                        placeholder="자동생성됨"
                        style={{width:'100%', padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13}}
                      />
                    </div>
                    <div style={{flex:1}}>
                      <label style={{fontSize:12, color:'#6b7280', display:'block', marginBottom:2}}>임시 비밀번호</label>
                      <input
                        value={portalTempPw}
                        onChange={e => setPortalTempPw(e.target.value)}
                        style={{width:'100%', padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13}}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleIssueAccount}
                    disabled={portalLoading || !portalUsername}
                    style={{alignSelf:'flex-start', padding:'8px 16px', background:'#7c3aed', color:'white', border:'none', borderRadius:6, cursor:'pointer', fontWeight:600, fontSize:13}}
                  >
                    {portalLoading ? '처리 중...' : '🔑 포털 계정 발급'}
                  </button>
                </div>
              )}
              {portalMsg && <p style={{fontSize:13, color: portalMsg.includes('✅') ? '#16a34a' : '#dc2626', margin:0}}>{portalMsg}</p>}
            </div>
          )}
        </div>
        <div className="sec">
          <h2>예약 정보</h2>
          <div className="grid">
            <div className="item"><div className="lbl">예약자</div>
              {editing
                ? <input className="ed-inp" value={editForm.booker_name||""} onChange={e=>setEditForm({...editForm,booker_name:e.target.value})}/>
                : <div className="val">{b.booker_name || "-"}</div>}
            </div>
            {b.booker_english && (
              <div className="item"><div className="lbl">영문명</div>
                <div className="val">{b.booker_english}</div>
              </div>
            )}
            <div className="item"><div className="lbl">연락처</div>
              {editing
                ? <input className="ed-inp" value={editForm.booker_phone||""} onChange={e=>setEditForm({...editForm,booker_phone:e.target.value})} placeholder="010-0000-0000"/>
                : <div className="val">{b.booker_phone || "-"}</div>}
            </div>
            {isCommuteBooking(b) ? (<>
              <div className="item"><div className="lbl">수업시작</div>
                {editing
                  ? <input className="ed-inp" type="date" value={editForm.checkin_date||""} onChange={e=>setEditForm({...editForm,checkin_date:e.target.value})}/>
                  : <div className="val">{fDate(b.academy_start || deriveAcademyStart(b.check_in || b.checkin_date))}</div>}
              </div>
              <div className="item"><div className="lbl">수업종료</div>
                {editing
                  ? <input className="ed-inp" type="date" value={editForm.checkout_date||""} onChange={e=>setEditForm({...editForm,checkout_date:e.target.value})}/>
                  : <div className="val">{fDate(b.checkout_date || deriveAcademyEnd(b.check_in || b.checkin_date, b.accom_weeks))}</div>}
              </div>
            </>) : (<>
              <div className="item"><div className="lbl">체크인</div>
                {editing
                  ? <input className="ed-inp" type="date" value={editForm.checkin_date||""} onChange={e=>setEditForm({...editForm,checkin_date:e.target.value})}/>
                  : <div className="val">{(b.check_in||b.checkin_date)?<>{fDate(b.check_in||b.checkin_date)} <span style={{color:"#64748b",fontSize:12}}>15:00PM</span></>:"-"}</div>}
              </div>
              <div className="item"><div className="lbl">체크아웃</div>
                {editing
                  ? <input className="ed-inp" type="date" value={editForm.checkout_date||""} onChange={e=>setEditForm({...editForm,checkout_date:e.target.value})}/>
                  : <div className="val">{(b.check_out||b.checkout_date)?<>{fDate(b.check_out||b.checkout_date)} <span style={{color:"#64748b",fontSize:12}}>{b.late_checkout?"22:30pm":"12noon"}</span></>:"-"}</div>}
              </div>
              <div className="item"><div className="lbl">Late Check-out</div>
                {editing
                  ? <label style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:13,cursor:"pointer"}}><input type="checkbox" checked={!!editForm.late_checkout} onChange={e=>setEditForm({...editForm,late_checkout:e.target.checked?"1":""})}/>레이트 체크아웃 (10:30PM)</label>
                  : <div className="val">{b.late_checkout ? "예 (10:30PM)" : "아니오"}</div>}
              </div>
              <div className="item"><div className="lbl">기간(주)</div>
                {editing
                  ? <><input className="ed-inp" type="number" min="1" max="12" value={editForm.accom_weeks||""} onChange={e=>setEditForm({...editForm,accom_weeks:e.target.value})}/><div className="ed-note">아카데미 시작/종료는 체크인 + 기간으로 자동 계산</div></>
                  : <div className="val">{b.accom_weeks ? b.accom_weeks+"주" : "-"}</div>}
              </div>
              <div className="item"><div className="lbl">아카데미 시작</div>
                {editing
                  ? <input className="ed-inp" type="date" value={editForm.academy_start||""} onChange={e=>setEditForm({...editForm,academy_start:e.target.value})}/>
                  : <div className="val">{fDate(b.academy_start || deriveAcademyStart(b.check_in || b.checkin_date))}</div>}
              </div>
              <div className="item"><div className="lbl">아카데미 종료</div>
                {editing
                  ? <div className="val">{fDate(deriveAcademyEnd(editForm.academy_start || editForm.checkin_date || b.check_in || b.checkin_date, editForm.accom_weeks || b.accom_weeks))}</div>
                  : <div className="val">{fDate(b.academy_end || deriveAcademyEnd(b.check_in || b.checkin_date, b.accom_weeks))}</div>}
              </div>
            </>)}
            {/* 추가 투숙 */}
            <div className="item"><div className="lbl">추가 투숙</div>
              {editing ? (
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input className="ed-inp" type="date" value={editForm.extra_stay_checkin||""} onChange={e=>setEditForm(p=>({...p,extra_stay_checkin:e.target.value}))} style={{maxWidth:150}}/>
                  <span style={{color:"#94a3b8"}}>~</span>
                  <input className="ed-inp" type="date" value={editForm.extra_stay_checkout||""} onChange={e=>setEditForm(p=>({...p,extra_stay_checkout:e.target.value}))} style={{maxWidth:150}}/>
                </div>
              ) : (
                <div className="val">
                  {b.extra_stay_checkin && b.extra_stay_checkout
                    ? `${b.extra_stay_checkin} ~ ${b.extra_stay_checkout}`
                    : b.extra_stay_checkin || b.extra_stay_checkout || "-"}
                </div>
              )}
            </div>
            {!editing && b.extra_stay_checkin && b.extra_stay_checkout && (
              <div style={{gridColumn:"1 / -1",padding:"8px 12px",background:"#fef3c7",border:"1px solid #fde68a",borderRadius:8,fontSize:12,color:"#92400e",marginTop:6}}>
                ⚠️ 추가 투숙 기간에는 셔틀·애프터스쿨·헬퍼 서비스가 포함되지 않습니다
              </div>
            )}
            <div className="item"><div className="lbl">예약유형</div>
              {editing
                ? <select className="ed-inp" value={editForm.accom_type||""} onChange={e=>setEditForm({...editForm,accom_type:e.target.value})}>
                    <option value="">선택</option>
                    <option value="드림하우스">드림하우스 단독</option>
                    <option value="드림하우스+제이파크">드하 + 제이파크</option>
                    <option value="드림하우스+큐브나인">드하 + 큐브나인</option>
                    <option value="제이파크 단독">제이파크 단독</option>
                    <option value="큐브나인 단독">큐브나인 단독</option>
                    <option value="통학형">통학형</option>
                  </select>
                : <div className="val">{(()=>{const cat=getBookingCategory(b as never);return(<><span style={{fontSize:11,fontWeight:800,background:cat.pkg==="올인원"?"#fef3c7":"#f1f5f9",color:cat.pkg==="올인원"?"#92400e":"#64748b",borderRadius:6,padding:"2px 8px",marginRight:6}}>{cat.pkg}</span><b style={{color:"#4338ca"}}>{cat.comp}</b><span style={{marginLeft:6,color:"#94a3b8",fontSize:12}}>({BT_LABEL[b.booking_type] || b.accom_type || "-"})</span></>);})()}{(b as any).academy_option && <span title="숙소 단독 + 아카데미 별도 등록 손님" style={{marginLeft:6,fontSize:11,fontWeight:800,background:"#eef2ff",color:"#4338ca",borderRadius:6,padding:"2px 8px"}}>🏫 아카데미 별도 등록</span>}</div>}
            </div>
            {((editing && ((editForm.accom_type || "").includes("+") || (editForm as any).seg1_type)) || b.seg1_type) && (
              <div className="item" style={{ gridColumn: "1 / -1" }}>
                <div className="lbl">숙소 구간 (순서대로)</div>
                {editing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[1, 2].map(n => (
                      <div key={n} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: "#64748b", width: 14 }}>{n}</span>
                        <select className="ed-inp" style={{ maxWidth: 130 }} value={(editForm as any)[`seg${n}_type`] || ""} onChange={e => setEditForm({ ...editForm, [`seg${n}_type`]: e.target.value } as any)}>
                          <option value="">숙소</option>
                          <option value="jaypark">제이파크</option>
                          <option value="dreamhouse">드림하우스</option>
                          <option value="cubenine">큐브나인</option>
                        </select>
                        <input className="ed-inp" type="date" style={{ maxWidth: 150 }} value={(editForm as any)[`seg${n}_checkin`] || ""} onChange={e => setEditForm({ ...editForm, [`seg${n}_checkin`]: e.target.value } as any)} />
                        <span style={{ color: "#94a3b8" }}>~</span>
                        <input className="ed-inp" type="date" style={{ maxWidth: 150 }} value={(editForm as any)[`seg${n}_checkout`] || ""} onChange={e => setEditForm({ ...editForm, [`seg${n}_checkout`]: e.target.value } as any)} />
                      </div>
                    ))}
                    <div className="ed-note">픽드랍·셔틀이 이 구간에 맞춰 연결됩니다.</div>
                  </div>
                ) : (
                  <div className="val" style={{ lineHeight: 1.8 }}>
                    {b.seg1_type && <div>① {ACC_KR_D[b.seg1_type] || b.seg1_type} : {fDate((b.seg1_checkin || "").split("T")[0])} ~ {fDate((b.seg1_checkout || "").split("T")[0])}</div>}
                    {b.seg2_type && <div>② {ACC_KR_D[b.seg2_type] || b.seg2_type} : {fDate((b.seg2_checkin || "").split("T")[0])} ~ {fDate((b.seg2_checkout || "").split("T")[0])}</div>}
                  </div>
                )}
              </div>
            )}
            <div className="item"><div className="lbl">유학원</div>
              {editing
                ? <button type="button" onClick={openAgencyModal} className="ed-inp" style={{textAlign:"left",cursor:"pointer",background:"#fff"}}>{editForm.agency||"개인 (선택하려면 클릭)"} ▾</button>
                : <div className="val">{b.agency || "-"}</div>}
            </div>
            <div className="item"><div className="lbl">전체 인원</div>
              {editing
                ? <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span style={{fontSize:12,color:"#6b7c93"}}>보호자</span>
                    <input className="ed-inp" type="number" min={0} value={editForm.adults||""} onChange={e=>setEditForm({...editForm,adults:e.target.value})} style={{width:60}}/>
                    <span style={{fontSize:12,color:"#6b7c93"}}>아이</span>
                    <input className="ed-inp" type="number" min={0} value={editForm.children||""} onChange={e=>setEditForm({...editForm,children:e.target.value})} style={{width:60}}/>
                  </div>
                : (() => {
                    const adults = b.adults ?? b.num_adults ?? null;
                    const stuLen = Array.isArray(data?.students) ? data!.students.length : 0;
                    const children = stuLen > 0 ? stuLen : (b.children ?? b.num_children ?? null);
                    return (adults === null && children === null)
                      ? <div className="val">-</div>
                      : <div className="val">보호자 {adults ?? "-"}명 + 아이 {children ?? "-"}명</div>;
                  })()}
            </div>
            {Array.isArray(b.extra_guardians) && b.extra_guardians.length > 0 && (
              <div className="item"><div className="lbl">추가 보호자</div>
                <div className="val">{b.extra_guardians.map((g:any)=>(typeof g==="string"?g:(g?.name||g?.kr||g?.name_kr||g?.english||""))).filter(Boolean).join(", ") || `${b.extra_guardians.length}명`}</div>
              </div>
            )}
            {/* 보호자 체류 기간 — 식단 모리인폼 주차별 성인 수 연동 */}
            <div className="item"><div className="lbl">보호자 체류 (식단)</div>
              {!gsEditing ? (
                <div className="val" style={{lineHeight:1.7}}>
                  {(() => {
                    const stays = (() => { try { const a = typeof b.guardian_stays === "string" ? JSON.parse(b.guardian_stays) : b.guardian_stays; return Array.isArray(a) ? a : []; } catch { return []; } })();
                    return stays.length === 0
                      ? <span style={{color:"#94a3b8"}}>미입력 (예약 보호자 수 {b.adults ?? 1}명 기준)</span>
                      : stays.map((g:any,i:number)=><div key={i}>{g.name || `보호자${i+1}`} : {g.from} ~ {g.to}</div>);
                  })()}
                  <button onClick={() => {
                    const stays = (() => { try { const a = typeof b.guardian_stays === "string" ? JSON.parse(b.guardian_stays) : b.guardian_stays; return Array.isArray(a) ? a : []; } catch { return []; } })();
                    const from = (b.checkin_date||"").slice(0,10), to = (b.checkout_date||"").slice(0,10);
                    setGsRows(stays.length > 0 ? stays : Array.from({length: Math.max(1, Number(b.adults)||1)}, (_,i)=>({name: i===0?"보호자1 (상주)":`보호자${i+1}`, from, to})));
                    setGsEditing(true);
                  }} style={{marginTop:4,padding:"4px 12px",fontSize:12,border:"1px solid #d6dee8",borderRadius:7,background:"#fff",cursor:"pointer",fontFamily:"inherit"}}>✏️ 기간 입력</button>
                </div>
              ) : (
                <div className="val">
                  <div style={{fontSize:11.5,color:"#6b7c93",marginBottom:6}}>기간이 겹치는 보호자 수만큼 해당 주차 식단 인원에 반영됩니다.</div>
                  {gsRows.map((g,i)=>(
                    <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                      <input className="ed-inp" style={{maxWidth:120}} value={g.name} placeholder={`보호자${i+1}`} onChange={e=>setGsRows(gsRows.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/>
                      <input className="ed-inp" type="date" style={{maxWidth:145}} value={g.from} onChange={e=>setGsRows(gsRows.map((x,j)=>j===i?{...x,from:e.target.value}:x))}/>
                      <span style={{color:"#94a3b8"}}>~</span>
                      <input className="ed-inp" type="date" style={{maxWidth:145}} value={g.to} onChange={e=>setGsRows(gsRows.map((x,j)=>j===i?{...x,to:e.target.value}:x))}/>
                      <button onClick={()=>setGsRows(gsRows.filter((_,j)=>j!==i))} style={{background:"#fee2e2",color:"#b91c1c",border:"none",borderRadius:7,padding:"5px 9px",cursor:"pointer",fontWeight:700}}>✕</button>
                    </div>
                  ))}
                  {/* 보호자 추가요금 → 인보이스 추가 항목 */}
                  <div style={{marginTop:10,padding:"8px 10px",background:"#f0fdfa",border:"1px solid #99f6e4",borderRadius:8}}>
                    <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>
                      <input type="checkbox" checked={gsInvOn} onChange={e=>setGsInvOn(e.target.checked)}/>
                      💰 인보이스 추가 항목으로 요금 등록
                    </label>
                    {gsInvOn && (
                      <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
                        <input className="ed-inp" style={{maxWidth:200}} value={gsInvName} onChange={e=>setGsInvName(e.target.value)} placeholder="항목명 (예: 보호자 추가 6/22~6/28)"/>
                        <input className="ed-inp" type="number" style={{maxWidth:120}} value={gsInvAmt} onChange={e=>setGsInvAmt(e.target.value)} placeholder="금액(원)"/>
                        <span style={{fontSize:11,color:"#0f766e"}}>주당: 드하 34만 · 제이파크 34만 · 큐브나인 25만</span>
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:6,marginTop:8}}>
                    <button onClick={()=>setGsRows([...gsRows,{name:`보호자${gsRows.length+1}`,from:(b.checkin_date||"").slice(0,10),to:(b.checkout_date||"").slice(0,10)}])} style={{padding:"5px 12px",fontSize:12,border:"1px solid #d6dee8",borderRadius:7,background:"#fff",cursor:"pointer",fontFamily:"inherit"}}>＋ 보호자 추가</button>
                    <button disabled={gsSaving} onClick={async()=>{
                      const valid = gsRows.filter(g=>g.from&&g.to&&g.from<=g.to);
                      if(valid.length===0){ alert("보호자 1명 이상, 기간을 올바르게 입력해주세요"); return; }
                      const body: Record<string, unknown> = { guardian_stays: valid };
                      if(gsInvOn){
                        const amt = Number(gsInvAmt)||0;
                        if(!gsInvName.trim()||amt<=0){ alert("인보이스 항목명과 금액을 입력해주세요"); return; }
                        const cur = (()=>{ try { const a = typeof b.additions==="string"?JSON.parse(b.additions):b.additions; return Array.isArray(a)?a:[]; } catch { return []; } })();
                        body.additions = [...cur.filter((a:any)=>a&&a.name), {id:Date.now(), name:gsInvName.trim(), amount:amt}];
                      }
                      setGsSaving(true);
                      const res = await fetch(`/api/bookings/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
                      setGsSaving(false);
                      if(!res.ok){ alert("저장 실패 — scripts/setup-meal-plan.sql 실행 여부를 확인해주세요"); return; }
                      setGsEditing(false); setGsInvOn(false); setGsInvAmt(""); load();
                    }} style={{padding:"5px 14px",fontSize:12,border:"none",borderRadius:7,background:"#0d9488",color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{gsSaving?"저장 중...":"💾 저장"}</button>
                    <button onClick={()=>setGsEditing(false)} style={{padding:"5px 12px",fontSize:12,border:"1px solid #d6dee8",borderRadius:7,background:"#fff",cursor:"pointer",fontFamily:"inherit"}}>취소</button>
                  </div>
                </div>
              )}
            </div>
            <div className="item"><div className="lbl">룸 번호</div>
              {editing
                ? <input className="ed-inp" value={editForm.house_no||""} onChange={e=>setEditForm({...editForm,house_no:e.target.value})} placeholder="예: B17L14"/>
                : <div className="val">{fmtRoom(b.house_no || b.accom_room || b.room_no || b.room_number) || "-"}</div>}
            </div>
          </div>
        </div>
        <div className="sec">
          <h2>항공편</h2>
          {editing ? (
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"#1a6fc4",marginBottom:6}}>🛬 입국편</div>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,marginBottom:8}}>
                  <input type="checkbox" checked={!!editForm.flight_in_undecided} onChange={e=>setEditForm({...editForm,flight_in_undecided:e.target.checked?"1":""})}/>
                  미정(추후 입력)
                </label>
                <fieldset disabled={!!editForm.flight_in_undecided} style={{border:"none",padding:0,margin:0,opacity:editForm.flight_in_undecided?0.4:1}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>항공사</div><input className="ed-inp" value={editForm.flight_in_airline||""} onChange={e=>setEditForm({...editForm,flight_in_airline:e.target.value})} placeholder="예: 대한항공"/></div>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>편명</div><input className="ed-inp" value={editForm.flight_in_no||""} onChange={e=>setEditForm({...editForm,flight_in_no:e.target.value})} placeholder="예: KE601"/></div>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>날짜</div><input className="ed-inp" type="date" value={editForm.flight_in_date||""} onChange={e=>setEditForm({...editForm,flight_in_date:e.target.value})}/></div>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>시간</div><input className="ed-inp" type="time" value={editForm.flight_in_time||""} onChange={e=>setEditForm({...editForm,flight_in_time:e.target.value})}/></div>
                    <div style={{gridColumn:"1/3"}}><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>출발지</div><input className="ed-inp" value={editForm.flight_in_origin||""} onChange={e=>setEditForm({...editForm,flight_in_origin:e.target.value})} placeholder="인천"/></div>
                  </div>
                </fieldset>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"#1a6fc4",marginBottom:6}}>🛫 출국편</div>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,marginBottom:8}}>
                  <input type="checkbox" checked={!!editForm.flight_out_undecided} onChange={e=>setEditForm({...editForm,flight_out_undecided:e.target.checked?"1":""})}/>
                  미정(추후 입력)
                </label>
                <fieldset disabled={!!editForm.flight_out_undecided} style={{border:"none",padding:0,margin:0,opacity:editForm.flight_out_undecided?0.4:1}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>항공사</div><input className="ed-inp" value={editForm.flight_out_airline||""} onChange={e=>setEditForm({...editForm,flight_out_airline:e.target.value})} placeholder="예: 대한항공"/></div>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>편명</div><input className="ed-inp" value={editForm.flight_out_no||""} onChange={e=>setEditForm({...editForm,flight_out_no:e.target.value})} placeholder="예: KE602"/></div>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>날짜</div><input className="ed-inp" type="date" value={editForm.flight_out_date||""} onChange={e=>setEditForm({...editForm,flight_out_date:e.target.value})}/></div>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>시간</div><input className="ed-inp" type="time" value={editForm.flight_out_time||""} onChange={e=>setEditForm({...editForm,flight_out_time:e.target.value})}/></div>
                    <div style={{gridColumn:"1/3"}}><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>도착지</div><input className="ed-inp" value={editForm.flight_out_destination||""} onChange={e=>setEditForm({...editForm,flight_out_destination:e.target.value})} placeholder="인천"/></div>
                  </div>
                </fieldset>
              </div>
            </div>
          ) : (<div className="grid">
            <div className="item"><div className="lbl">입국편</div>
              {b.flight_in_undecided
                ? <div className="val" style={{color:"#94a3b8"}}>미정 (추후 입력)</div>
                : <div className="val">{[b.flight_in_airline, b.flight_in_no].filter(Boolean).join(" ") || b.flight_in || "-"}{b.flight_in_date ? ` / ${fDate(b.flight_in_date)} ${b.flight_in_time||""}` : ""}{b.flight_in_origin ? ` · ${b.flight_in_origin}` : ""}</div>}
            </div>
            <div className="item"><div className="lbl">출국편</div>
              {b.flight_out_undecided
                ? <div className="val" style={{color:"#94a3b8"}}>미정 (추후 입력)</div>
                : <div className="val">{[b.flight_out_airline, b.flight_out_no].filter(Boolean).join(" ") || b.flight_out || "-"}{b.flight_out_date ? ` / ${fDate(b.flight_out_date)} ${b.flight_out_time||""}` : ""}{b.flight_out_destination ? ` · ${b.flight_out_destination}` : ""}</div>}
            </div>
          </div>)}
          {/* 항공권 이미지 */}
          <div style={{marginTop:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"#6b7c93",marginBottom:8}}>📸 항공권 이미지</div>
            {(b.flight_images && Array.isArray(b.flight_images) && b.flight_images.length > 0) && (
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                {b.flight_images.map((img: string, i: number) => (
                  <div key={i} style={{position:"relative",borderRadius:8,overflow:"hidden",border:"1px solid #e2e8f0"}}>
                    <img src={img} alt={`항공권 ${i+1}`} style={{width:160,height:120,objectFit:"cover",cursor:"pointer"}} onClick={()=>window.open(img,"_blank")}/>
                    <button onClick={async ()=>{
                      if(!confirm("이 이미지를 삭제하시겠습니까?")) return;
                      const updated = b.flight_images.filter((_:string,j:number)=>j!==i);
                      const res = await fetch(`/api/bookings/${b.id}`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({flight_images:updated})});
                      if(res.ok) load();
                    }} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",color:"#fff",border:"none",borderRadius:"50%",width:22,height:22,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",background:"#f0f9ff",border:"1px dashed #93c5fd",borderRadius:8,color:"#1a6fc4",fontSize:13,fontWeight:700,cursor:"pointer"}}>
              📎 이미지 업로드
              <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={async (e)=>{
                const files = e.target.files;
                if(!files || files.length === 0) return;
                const uploaded: string[] = [];
                for(const file of Array.from(files)) {
                  const ext = file.name.split(".").pop() || "jpg";
                  const path = `flight/${b.id}/${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`;
                  const { error } = await supabase.storage.from("staff-files").upload(path, file, { contentType: file.type });
                  if(!error) {
                    const { data: urlData } = supabase.storage.from("staff-files").getPublicUrl(path);
                    if(urlData?.publicUrl) uploaded.push(urlData.publicUrl);
                  }
                }
                if(uploaded.length > 0) {
                  const existing = Array.isArray(b.flight_images) ? b.flight_images : [];
                  const res = await fetch(`/api/bookings/${b.id}`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({flight_images:[...existing,...uploaded]})});
                  if(res.ok) { load(); alert(`${uploaded.length}장 업로드 완료`); }
                  else alert("업로드 실패");
                }
                e.target.value = "";
              }}/>
            </label>
            <span style={{fontSize:11,color:"#94a3b8",marginLeft:8}}>클릭하면 원본 크기로 볼 수 있습니다</span>
          </div>
          <div className="grid" style={{marginTop:14}}>
            <div className="item"><div className="lbl">픽업장소</div>
              {editing
                ? <input className="ed-inp" value={editForm.pickup_place||""} onChange={e=>setEditForm({...editForm,pickup_place:e.target.value})} placeholder="예: 막탄공항"/>
                : <div className="val">{b.pickup_place || "-"}</div>}
            </div>
            <div className="item"><div className="lbl">드랍장소</div>
              {editing
                ? <input className="ed-inp" value={editForm.drop_off||""} onChange={e=>setEditForm({...editForm,drop_off:e.target.value})} placeholder="예: 막탄공항"/>
                : <div className="val">{b.drop_place || b.drop_off || "-"}</div>}
            </div>
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
            students.map((s: any, i: number) => {
              // idx 기반 매칭 (booking_json 학생은 s.id 없음 → idx로 식별)
              const isEditing = rowEditing?.table === "students" && rowEditing.idx === i;
              return (
              <div key={s.id || `idx-${i}`} className="stu-card" style={{ flexWrap: "wrap" }}>
                <div className="stu-av">{i + 1}</div>
                <div className="stu-info" style={{ width: "100%" }}>
                  {!isEditing ? (<>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div className="nm" style={{flex:1}}>{s.name_kr || "-"} {s.name_en ? `(${s.name_en})` : ""}</div>
                      <button className="btn btn-sm btn-gray" onClick={()=>startRowEdit("students", s, i)}>✏️ 수정</button>
                    </div>
                    {(()=>{
                      const isCommute = isCommuteBooking(b);
                      const bCheckin = b?.check_in || b?.checkin_date || "";
                      const bStart = (b?.academy_start || "").split("T")[0];
                      const cardStart = s.academyStart || s.academy_start
                        || bStart
                        || (bCheckin ? (isCommute ? bCheckin : deriveAcademyStart(bCheckin)) : "")
                        || "-";
                      const cardEnd = s.academyEnd || s.academy_end
                        || (isCommute
                            ? (b?.check_out || b?.checkout_date || "")
                            : ((b?.academy_end || "").split("T")[0]
                                || deriveAcademyEnd(bStart || (bCheckin ? deriveAcademyStart(bCheckin) : ""), b?.accom_weeks || 0)))
                        || "-";
                      return (
                        <div style={{
                          display:"inline-flex", alignItems:"center", gap:6,
                          background:"#e8f4fd", borderRadius:8, padding:"5px 12px",
                          marginTop:6, marginBottom:8
                        }}>
                          <span style={{fontSize:12, color:"#1a6fc4", fontWeight:700}}>📅 수업기간</span>
                          <span style={{fontSize:13, fontWeight:800, color:"#1a1a2e"}}>
                            {cardStart} ~ {cardEnd}
                          </span>
                        </div>
                      );
                    })()}
                    <div className="sub">
                      {[
                        s.age || null,
                        s.level === "kinder" ? "킨더" : s.level === "junior" ? "주니어" : null,
                        s.class_type === "morning" ? "오전반" : s.class_type === "fullday" ? "종일반" : null,
                      ].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8, fontSize: 12 }}>
                      <div><span style={{ color: "#6b7c93", fontWeight: 700 }}>SSP:</span> {s.ssp ? "있음" : "없음"}</div>
                      <div><span style={{ color: "#6b7c93", fontWeight: 700 }}>사진허용:</span> {s.photo_allowed ? "O" : "X"}</div>
                      <div><span style={{ color: "#6b7c93", fontWeight: 700 }}>픽드롭:</span> {s.pickup_location || "-"}</div>
                      <div><span style={{ color: "#6b7c93", fontWeight: 700 }}>주소:</span> {s.address_detail || "-"}</div>
                    </div>
                    {s.special_request && <div style={{ marginTop: 8, padding: 8, background: "#fef3c7", borderRadius: 6, fontSize: 12, color: "#92400e" }}>📝 {s.special_request}</div>}
                  </>) : (<>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <div style={{flex:1,fontWeight:700,color:"#1a6fc4"}}>학생 {i+1} 편집 중</div>
                      <button className="btn btn-sm btn-gray" onClick={()=>setRowEditing(null)} disabled={rowSaving}>취소</button>
                      <button className="btn btn-sm btn-blue" onClick={()=>saveRowEdit()} disabled={rowSaving}>{rowSaving?"저장 중...":"💾 저장"}</button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12}}>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>한글이름</div><input className="ed-inp" value={rowForm.name_kr||""} onChange={e=>setRowForm({...rowForm,name_kr:e.target.value})}/></div>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>영문이름</div><input className="ed-inp" value={rowForm.name_en||""} onChange={e=>setRowForm({...rowForm,name_en:e.target.value})}/></div>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>생년도/나이</div><input className="ed-inp" value={rowForm.age||""} onChange={e=>setRowForm({...rowForm,age:e.target.value})} placeholder="예: 2016 또는 7살"/></div>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>킨더/주니어</div>
                        <select className="ed-inp" value={rowForm.level||""} onChange={e=>setRowForm({...rowForm,level:e.target.value})}>
                          <option value="">없음</option>
                          <option value="kinder">킨더</option>
                          <option value="junior">주니어</option>
                        </select>
                      </div>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>아카데미 시작</div><input className="ed-inp" type="date" value={rowForm.academy_start||""} onChange={e=>setRowForm({...rowForm,academy_start:e.target.value})}/></div>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>아카데미 종료</div><input className="ed-inp" type="date" value={rowForm.academy_end||""} onChange={e=>setRowForm({...rowForm,academy_end:e.target.value})}/></div>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>SSP</div>
                        <select className="ed-inp" value={rowForm.ssp?"true":"false"} onChange={e=>setRowForm({...rowForm,ssp:e.target.value==="true"})}>
                          <option value="false">없음</option>
                          <option value="true">있음</option>
                        </select>
                      </div>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>사진허용</div>
                        <select className="ed-inp" value={rowForm.photo_allowed?"true":"false"} onChange={e=>setRowForm({...rowForm,photo_allowed:e.target.value==="true"})}>
                          <option value="true">O (허용)</option>
                          <option value="false">X (미허용)</option>
                        </select>
                      </div>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>픽드롭</div><input className="ed-inp" value={rowForm.pickup_location||""} onChange={e=>setRowForm({...rowForm,pickup_location:e.target.value})}/></div>
                      <div><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>주소</div><input className="ed-inp" value={rowForm.address_detail||""} onChange={e=>setRowForm({...rowForm,address_detail:e.target.value})}/></div>
                      <div style={{gridColumn:"1/3"}}><div style={{fontSize:11,fontWeight:700,color:"#6b7c93",marginBottom:3}}>특이사항</div><textarea className="ed-inp" style={{minHeight:50,resize:"vertical"}} value={rowForm.special_request||""} onChange={e=>setRowForm({...rowForm,special_request:e.target.value})}/></div>
                    </div>
                  </>)}
                </div>
              </div>
              );
            })
          }
        </div>
      )}

      {/* 탭3: 픽업/체크인 */}
      {tab === "pickup" && (<>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
          <button className="btn btn-sm btn-blue" onClick={()=>window.open(`/admin/checkin-card?bookingId=${b.id}`,"_blank")}>🪧 체크인 카드</button>
        </div>
        <div className="sec">
          <h2>기본 픽업/드랍 정보 <span style={{fontSize:11,fontWeight:500,color:"#94a3b8"}}>(예약 등록 시 입력)</span></h2>
          <div className="grid">
            <div className="item"><div className="lbl">픽업장소</div><div className="val">{b.pickup_place || "-"}</div></div>
            <div className="item"><div className="lbl">드랍장소</div><div className="val">{b.drop_place || b.drop_off || "-"}</div></div>
          </div>
        </div>
        <div className="sec">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ flex: 1 }}>픽업/드랍 신청 ({pickups.length}건) <span style={{fontSize:11,fontWeight:500,color:"#94a3b8"}}>(포털 신청 + 직원 등록)</span></h2>
            <button className="btn btn-sm btn-blue" onClick={() => setPkAdding(v => !v)}>{pkAdding ? "닫기" : "+ 직접 등록"}</button>
          </div>
          {pkAdding && (
            <div style={{ background: "#f8fafc", border: "1.5px dashed #93c5fd", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>손님이 채팅으로 신청한 픽드랍을 대신 등록합니다 (예: 아빠 추가 입국 공항 픽업)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>유형</div>
                  <select className="ed-inp" value={pkForm.request_type} onChange={e=>setPkForm({...pkForm,request_type:e.target.value})}>
                    <option value="extra_pickup">➕ 추가 픽업</option>
                    <option value="extra_drop">➕ 추가 드랍</option>
                    <option value="pickup">픽업</option>
                    <option value="dropoff">드랍</option>
                  </select></div>
                <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>날짜 *</div><input className="ed-inp" type="date" value={pkForm.request_date} onChange={e=>setPkForm({...pkForm,request_date:e.target.value})}/></div>
                <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>시간</div><input className="ed-inp" type="time" value={pkForm.request_time} onChange={e=>setPkForm({...pkForm,request_time:e.target.value})}/></div>
                <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>출발</div><input className="ed-inp" value={pkForm.location} onChange={e=>setPkForm({...pkForm,location:e.target.value})} placeholder="공항"/></div>
                <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>도착</div><input className="ed-inp" value={pkForm.destination} onChange={e=>setPkForm({...pkForm,destination:e.target.value})} placeholder="드림하우스 / 제이파크"/></div>
                <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>인원</div><input className="ed-inp" type="number" min={1} value={pkForm.num_people} onChange={e=>setPkForm({...pkForm,num_people:Number(e.target.value)||1})}/></div>
              </div>
              <div style={{ marginBottom: 10 }}><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>메모</div><input className="ed-inp" style={{width:"100%"}} value={pkForm.notes} onChange={e=>setPkForm({...pkForm,notes:e.target.value})} placeholder="예: 아버님 1명 추가 입국 (KE631 14:30 도착)"/></div>
              <div style={{ marginBottom: 10 }}>
                <div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>🎫 항공권 첨부 (사진/PDF · 선택)</div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <label style={{display:"inline-flex",alignItems:"center",gap:6,background:"#fff",border:"1px solid #cbd5e1",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,color:"#475569",cursor:"pointer"}}>
                    📎 파일 선택
                    <input type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={e=>setPkTicket(e.target.files?.[0]||null)} />
                  </label>
                  {pkTicket && <span style={{fontSize:12,color:"#1e40af",fontWeight:700}}>{pkTicket.name} <button onClick={()=>setPkTicket(null)} style={{border:"none",background:"none",color:"#94a3b8",cursor:"pointer",fontSize:13}}>✕</button></span>}
                </div>
              </div>
              <button className="btn btn-sm btn-blue" onClick={savePkAdd} disabled={pkSaving}>{pkSaving ? "등록 중..." : "💾 등록"}</button>
            </div>
          )}
          {pickups.length === 0 ? <div className="empty">픽업 일정이 없습니다</div> :
            pickups.map((p: any) => {
              const isEditing = rowEditing?.table === "pickup_requests" && rowEditing.id === p.id;
              return (
              <div key={p.id} className={`pk-card${p.request_type === "dropoff" ? " drop" : ""}`}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems:"center", gap:8 }}>
                  {(() => {
                    const PK_TYPES: Record<string, { label: string; bg: string; color: string }> = {
                      pickup: { label: "픽업", bg: "#dbeafe", color: "#1e40af" },
                      dropoff: { label: "드랍", bg: "#dcfce7", color: "#166534" },
                      extra_pickup: { label: "➕ 추가 픽업", bg: "#ede9fe", color: "#6d28d9" },
                      extra_drop: { label: "➕ 추가 드랍", bg: "#ede9fe", color: "#6d28d9" },
                      transfer: { label: "🔄 환승", bg: "#fef3c7", color: "#92400e" },
                    };
                    const tp = PK_TYPES[p.request_type] || { label: p.request_type || "픽드랍", bg: "#f1f5f9", color: "#475569" };
                    return <span className="badge" style={{ background: tp.bg, color: tp.color }}>{tp.label}</span>;
                  })()}
                  <div style={{display:"flex",gap:6,alignItems:"center"}}>
                    <span className="badge" style={{ background: p.status === "confirmed" ? "#dcfce7" : "#fef3c7", color: p.status === "confirmed" ? "#166534" : "#92400e" }}>{p.status}</span>
                    {!isEditing
                      ? <button className="btn btn-sm btn-gray" onClick={()=>startRowEdit("pickup_requests", p)}>✏️ 수정</button>
                      : (<>
                          <button className="btn btn-sm btn-gray" onClick={()=>setRowEditing(null)} disabled={rowSaving}>취소</button>
                          <button className="btn btn-sm btn-blue" onClick={()=>saveRowEdit()} disabled={rowSaving}>{rowSaving?"저장중":"💾 저장"}</button>
                        </>)}
                  </div>
                </div>
                {!isEditing ? (<>
                  <div className="pk-row"><span className="lbl">날짜</span>{fDate(p.request_date)}</div>
                  <div className="pk-row"><span className="lbl">시간</span>{p.request_time || "-"}</div>
                  <div className="pk-row"><span className="lbl">출발</span>{p.location || "-"}</div>
                  <div className="pk-row"><span className="lbl">도착</span>{p.destination || "-"}</div>
                  <div className="pk-row"><span className="lbl">인원</span>{p.num_people || 0}명</div>
                  {p.ticket_url && <div className="pk-row"><span className="lbl">항공권</span><a href={p.ticket_url} target="_blank" rel="noreferrer" style={{color:"#4f46e5",fontWeight:700,textDecoration:"none"}}>🎫 항공권 보기</a></div>}
                  {p.notes && <div className="pk-row"><span className="lbl">메모</span>{String(p.notes).replace(/portal_booking_id:[a-f0-9-]+/gi,"").trim() || "-"}</div>}
                </>) : (
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}}>
                    <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>유형</div>
                      <select className="ed-inp" value={rowForm.request_type||"extra_pickup"} onChange={e=>setRowForm({...rowForm,request_type:e.target.value})}>
                        <option value="pickup">픽업</option>
                        <option value="dropoff">드랍</option>
                        <option value="extra_pickup">➕ 추가 픽업</option>
                        <option value="extra_drop">➕ 추가 드랍</option>
                        <option value="transfer">🔄 환승</option>
                      </select>
                    </div>
                    <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>날짜</div><input className="ed-inp" type="date" value={rowForm.request_date||""} onChange={e=>setRowForm({...rowForm,request_date:e.target.value})}/></div>
                    <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>시간</div><input className="ed-inp" type="time" value={rowForm.request_time||""} onChange={e=>setRowForm({...rowForm,request_time:e.target.value})}/></div>
                    <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>출발(픽업장소)</div><input className="ed-inp" value={rowForm.location||""} onChange={e=>setRowForm({...rowForm,location:e.target.value})}/></div>
                    <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>도착(드랍장소)</div><input className="ed-inp" value={rowForm.destination||""} onChange={e=>setRowForm({...rowForm,destination:e.target.value})}/></div>
                    <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>인원</div><input className="ed-inp" type="number" value={rowForm.num_people||0} onChange={e=>setRowForm({...rowForm,num_people:Number(e.target.value)})}/></div>
                    <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>상태</div>
                      <select className="ed-inp" value={rowForm.status||"pending"} onChange={e=>setRowForm({...rowForm,status:e.target.value})}>
                        <option value="pending">대기중</option>
                        <option value="confirmed">확정</option>
                        <option value="cancelled">취소</option>
                      </select>
                    </div>
                    <div style={{gridColumn:"1/3"}}><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>메모</div><textarea className="ed-inp" style={{minHeight:50,resize:"vertical"}} value={rowForm.notes||""} onChange={e=>setRowForm({...rowForm,notes:e.target.value})}/></div>
                    <div style={{gridColumn:"1/3"}}><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>🎫 항공권</div>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        {rowForm.ticket_url ? <a href={rowForm.ticket_url} target="_blank" rel="noreferrer" style={{fontSize:12,color:"#4f46e5",fontWeight:700}}>🎫 현재 항공권 보기</a> : <span style={{fontSize:12,color:"#94a3b8"}}>첨부 없음</span>}
                        <label style={{display:"inline-flex",alignItems:"center",gap:4,background:"#fff",border:"1px solid #cbd5e1",borderRadius:8,padding:"4px 10px",fontSize:11.5,fontWeight:700,color:"#475569",cursor:"pointer"}}>
                          📎 {rowForm.ticket_url ? "교체" : "첨부"}
                          <input type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={async e=>{
                            const f=e.target.files?.[0]; if(!f) return;
                            const u=await uploadTicketFile(f);
                            if(u) setRowForm((prev:Record<string,unknown>)=>({...prev,ticket_url:u}));
                          }} />
                        </label>
                        {rowForm.ticket_url && <button onClick={()=>setRowForm((prev:Record<string,unknown>)=>({...prev,ticket_url:""}))} style={{border:"none",background:"none",color:"#ef4444",cursor:"pointer",fontSize:11.5,fontWeight:700}}>제거</button>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              );
            })
          }
        </div>
        {(() => {
          const eps: { type?:string;date?:string;airline?:string;flight?:string;time?:string }[] = (() => {
            try { const arr = JSON.parse(checkin?.extra_pickups || "[]"); return Array.isArray(arr) ? arr : []; } catch { return []; }
          })();
          if (eps.length === 0) return null;
          return (
            <div className="sec">
              <h2>🚗 추가 픽드랍 <span style={{fontSize:11,fontWeight:500,color:"#94a3b8"}}>(체크인 디테일 입력)</span>
                <span style={{marginLeft:8,background:"#e8eaff",color:"#5b6cf8",borderRadius:12,padding:"2px 8px",fontSize:12}}>{eps.length}건</span>
              </h2>
              {eps.map((ep, i) => (
                <div key={i} style={{borderLeft:`3px solid ${ep.type==="픽업"?"#5b6cf8":"#2ea"}`,paddingLeft:12,marginBottom:12}}>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                    <span style={{background:ep.type==="픽업"?"#5b6cf8":"#2ea",color:"#fff",borderRadius:12,padding:"2px 10px",fontSize:12,fontWeight:700}}>{ep.type||"-"}</span>
                  </div>
                  <div style={{fontSize:13,display:"grid",gridTemplateColumns:"60px 1fr",gap:"4px 0",color:"#445"}}>
                    <span style={{color:"#889"}}>날짜</span><span>{ep.date||"-"}</span>
                    <span style={{color:"#889"}}>시간</span><span>{ep.time||"-"}</span>
                    <span style={{color:"#889"}}>항공사</span><span>{ep.airline||"-"}</span>
                    <span style={{color:"#889"}}>편명</span><span>{ep.flight||"-"}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
        <div className="sec">
          <h2>체크인 디테일</h2>
          {!checkin ? (
            <div className="empty">체크인 디테일이 아직 생성되지 않았습니다</div>
          ) : (<div className="grid">
            <div className="item"><div className="lbl">침대세팅</div><div className="val">Master {checkin.bed_setting?.master_2f || 0} / Small {checkin.bed_setting?.small_2f || 0} / 1F {checkin.bed_setting?.floor_1f || 0}</div></div>
            <div className="item"><div className="lbl">USIM</div><div className="val">SIM {checkin.usim?.sim || 0} / LOAD {checkin.usim?.load || 0}</div></div>
            <div className="item"><div className="lbl">전체 투숙객</div><div className="val">{checkin.all_guests || "-"}</div></div>
            {checkin.etc_notes && <div className="item"><div className="lbl">메모</div><div className="val">{checkin.etc_notes}</div></div>}
          </div>)}
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:14}}>
            <button className="btn btn-sm btn-blue" onClick={() => router.push(`/admin/checkin-details?bookingId=${b.id}`)}>체크인 디테일 페이지로 이동</button>
          </div>
        </div>
      </>)}


      {/* 탭5: 튜터 */}
      {tab === "tutor" && (
        <div className="sec">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid #e2e8f0" }}>
            <h2 style={{ flex: 1, fontSize: 15, fontWeight: 800, color: "#1a6fc4" }}>튜터 신청 ({tutorReqs.length}건)</h2>
            <button className="btn btn-sm btn-blue" onClick={() => toastErr("튜터 신청 추가 기능은 /admin/tutors에서 사용하세요.")}>+ 튜터 신청 추가</button>
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
            <button className="btn btn-sm btn-blue" onClick={() => router.push("/admin/shuttle-management")}>+ 셔틀 관리로</button>
          </div>
          {shuttleReqs.length === 0 ? <div className="empty">셔틀 신청 내역이 없습니다<br/>손님이 /portal/shuttle에서 신청하면 여기에 표시됩니다</div> :
            shuttleReqs.map((s: any) => {
              const st = REQ_ST[s.status] || REQ_ST.pending;
              const isEditing = rowEditing?.table === "shuttle_requests" && rowEditing.id === s.id;
              return (
                <div key={s.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, marginBottom: 8, background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap:8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{s.request_date || "-"} {s.request_time || ""}</div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      {!isEditing
                        ? <button className="btn btn-sm btn-gray" onClick={()=>startRowEdit("shuttle_requests", s)}>✏️ 수정</button>
                        : (<>
                            <button className="btn btn-sm btn-gray" onClick={()=>setRowEditing(null)} disabled={rowSaving}>취소</button>
                            <button className="btn btn-sm btn-blue" onClick={()=>saveRowEdit()} disabled={rowSaving}>{rowSaving?"저장중":"💾 저장"}</button>
                          </>)}
                    </div>
                  </div>
                  {!isEditing ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12, color: "#475569" }}>
                      <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>장소:</span> {s.destination || "-"}</div>
                      <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>인원:</span> {s.num_people || 0}명</div>
                      <div><span style={{ fontWeight: 700, color: "#6b7c93" }}>왕복:</span> {s.round_trip ? "왕복" : "편도"}</div>
                      {s.notes && <div style={{ gridColumn: "1/3" }}><span style={{ fontWeight: 700, color: "#6b7c93" }}>메모:</span> {s.notes.replace(/portal_booking_id:[a-f0-9-]+/gi, "").trim() || "-"}</div>}
                    </div>
                  ) : (
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}}>
                      <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>날짜</div><input className="ed-inp" type="date" value={rowForm.request_date||""} onChange={e=>setRowForm({...rowForm,request_date:e.target.value})}/></div>
                      <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>시간</div><input className="ed-inp" type="time" value={rowForm.request_time||""} onChange={e=>setRowForm({...rowForm,request_time:e.target.value})}/></div>
                      <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>장소</div><input className="ed-inp" value={rowForm.destination||""} onChange={e=>setRowForm({...rowForm,destination:e.target.value})}/></div>
                      <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>인원</div><input className="ed-inp" type="number" value={rowForm.num_people||0} onChange={e=>setRowForm({...rowForm,num_people:Number(e.target.value)})}/></div>
                      <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>왕복</div>
                        <select className="ed-inp" value={rowForm.round_trip?"true":"false"} onChange={e=>setRowForm({...rowForm,round_trip:e.target.value==="true"})}>
                          <option value="false">편도</option>
                          <option value="true">왕복</option>
                        </select>
                      </div>
                      <div><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>상태</div>
                        <select className="ed-inp" value={rowForm.status||"pending"} onChange={e=>setRowForm({...rowForm,status:e.target.value})}>
                          <option value="pending">대기중</option>
                          <option value="confirmed">확정</option>
                          <option value="cancelled">취소</option>
                        </select>
                      </div>
                      <div style={{gridColumn:"1/3"}}><div style={{fontSize:11,color:"#6b7c93",fontWeight:700,marginBottom:3}}>메모</div><textarea className="ed-inp" style={{minHeight:50,resize:"vertical"}} value={rowForm.notes||""} onChange={e=>setRowForm({...rowForm,notes:e.target.value})}/></div>
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>
      )}
      {agencyModal&&(
        <div onClick={()=>setAgencyModal(false)} style={{position:"fixed",inset:0,background:"rgba(15,23,42,.45)",zIndex:9990,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,padding:20,width:340,maxWidth:"92vw",maxHeight:"80vh",overflowY:"auto"}}>
            <h3 style={{margin:"0 0 12px",fontSize:16,fontWeight:800}}>유학원 선택</h3>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <button onClick={()=>{setEditForm(f=>({...f,agency:"개인"}));setAgencyModal(false);}} style={{padding:"10px 12px",border:"1.5px solid #94a3b8",borderRadius:9,background:(editForm.agency||"")==="개인"?"#eef2ff":"#fff",cursor:"pointer",textAlign:"left",fontWeight:700,fontFamily:"inherit"}}>👤 개인 (유학원 없음)</button>
              {agencyList.map(n=>(
                <button key={n} onClick={()=>{setEditForm(f=>({...f,agency:n}));setAgencyModal(false);}} style={{padding:"10px 12px",border:"1px solid #cbd5e1",borderRadius:9,background:(editForm.agency||"")===n?"#eef2ff":"#fff",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>🏢 {n}</button>
              ))}
              <div style={{display:"flex",gap:6,marginTop:4}}>
                <input placeholder="직접 입력" id="agencyCustomInp" style={{flex:1,padding:"9px 10px",border:"1px solid #cbd5e1",borderRadius:9,fontFamily:"inherit"}} onKeyDown={e=>{if(e.key==="Enter"){const v=(e.target as HTMLInputElement).value.trim();if(v){setEditForm(f=>({...f,agency:v}));setAgencyModal(false);}}}}/>
                <button onClick={()=>{const el=document.getElementById("agencyCustomInp") as HTMLInputElement;const v=(el&&el.value||"").trim();if(v){setEditForm(f=>({...f,agency:v}));setAgencyModal(false);}}} style={{padding:"9px 14px",border:"none",background:"#1a6fc4",color:"#fff",borderRadius:9,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>입력</button>
              </div>
              <button onClick={()=>{setEditForm(f=>({...f,agency:""}));setAgencyModal(false);}} style={{padding:"8px 12px",border:"1px solid #fecaca",borderRadius:9,background:"#fff5f5",color:"#b91c1c",cursor:"pointer",fontFamily:"inherit",fontSize:13}}>지우기 (미지정)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  </>);
}
