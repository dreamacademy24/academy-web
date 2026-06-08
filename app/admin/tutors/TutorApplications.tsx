"use client";
import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from "react";
import { toastErr } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { blocksToTimeOverrides, toFocusArr, toDateArr } from "@/lib/scheduleBlocks";
import { isLessonDateAllowed, tutorDailyRate, tutorBaseRate, countLessonDays } from "@/lib/lessonDates";
import * as XLSX from "xlsx";

interface Tutor { id: string; name: string; phone: string; specialty: string; is_active: boolean; hourly_rate: number }
interface TutorApp {
  id: string; created_at: string; updated_at?: string | null;
  reserver_type: string | null;
  house_or_reserver: string; house_number: string; children_names: string; children_ages: string;
  class_type: string; sessions_per_day: number | null; hourly_rate: number;
  start_date: string; end_date: string;
  class_days: string[] | null; excluded_dates: string | null; class_time: string;
  overall_level: string; speaking_level: string; reading_level: string; writing_level: string;
  textbook: string | null; class_style: string; class_focus: string[] | null; child_notes: string | null;
  agreed_privacy: boolean; agreed_tutor_rules?: boolean; agreed_tutor_rules_bool?: boolean;
  status: string; assigned_tutor_id: string | null;
  booking_id: string | null;
  total_sessions: number | null; total_amount: number | null; admin_memo: string | null;
  schedule_blocks?: Array<{ days: string[]; time: string; sessions_per_day: number }> | null;
}

const DAY_KR: Record<string, string> = { mon: "월", tue: "화", wed: "수", thu: "목", fri: "금", sat: "토" };
const LEVEL_OVERALL: Record<string, string> = { zero: "제로 베이스", beginner: "비기너", intermediate: "미디엄", advanced: "어드밴스" };
const LEVEL_7: Record<string, string> = {
  zero: "제로 베이스",
  beginner1: "비기너1", beginner2: "비기너2",
  intermediate1: "미디엄1", intermediate2: "미디엄2",
  advanced1: "어드밴스1", advanced2: "어드밴스2",
};
const LEVEL_7_FULL: Record<string, string> = {
  zero: "제로 베이스",
  beginner1: "비기너1 (초급1)", beginner2: "비기너2 (초급2)",
  intermediate1: "미디엄1 (중급1)", intermediate2: "미디엄2 (중급2)",
  advanced1: "어드밴스1 (고급)", advanced2: "어드밴스2 (심화)",
};
const CLASS_STYLE_KR: Record<string, string> = { play: "놀이식", study: "학습식", combined: "놀이+학습" };
const CLASS_FOCUS_KR: Record<string, string> = {
  speaking: "스피킹", reading: "리딩", vocabulary: "보카",
  writing: "롸이팅", phonics: "파닉스", activity: "액티비티",
};
const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기중",  bg: "#f1f5f9", color: "#475569" },
  reviewing: { label: "검토중",  bg: "#fef3c7", color: "#92400e" },
  assigned:  { label: "배정됨",  bg: "#dbeafe", color: "#1e40af" },
  confirmed: { label: "확정",    bg: "#dcfce7", color: "#166534" },
  completed: { label: "완료",    bg: "#d1fae5", color: "#065f46" },
  cancelled: { label: "취소",    bg: "#fef2f2", color: "#dc2626" },
};
const STATUS_ORDER = ["pending", "reviewing", "assigned", "confirmed", "completed", "cancelled"];

const LEVEL_RANK: Record<string, number> = {
  zero: 0,
  beginner: 1, beginner1: 1, beginner2: 2,
  intermediate: 3, intermediate1: 3, intermediate2: 4,
  advanced: 5, advanced1: 5, advanced2: 6,
};
function levelRank(v: string): number { return LEVEL_RANK[v] ?? -1; }
function isAsymmetric(a: TutorApp): boolean {
  const ranks = [a.overall_level, a.speaking_level, a.reading_level, a.writing_level].map(levelRank).filter(r => r >= 0);
  if (ranks.length < 2) return false;
  return Math.max(...ranks) - Math.min(...ranks) >= 3;
}

const ADMIN_FORM_INIT = { status: "pending", assigned_tutor_id: "", total_sessions: "", total_amount: "", admin_memo: "" };

export default function TutorApplications() {
  const router = useRouter();
  const [apps, setApps] = useState<TutorApp[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tutorFilter, setTutorFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // detail modal — 원본 row 객체를 저장하지 않고 id만 보관.
  // 렌더 시점에 apps.find(a => a.id === detailId)로 조회하여
  // 클릭 후 리스트가 재렌더/리페치되더라도 detail 필드와 id가 어긋나지 않도록 보장.
  // apps에서 사라진 경우(삭제 등) 폴백으로 클릭 당시 스냅샷 사용.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailSnap, setDetailSnap] = useState<TutorApp | null>(null);
  const [adminForm, setAdminForm] = useState(ADMIN_FORM_INIT);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [modalError, setModalError] = useState("");
  const tutorSelectRef = useRef<HTMLSelectElement>(null);

  // toast
  const [toast, setToast] = useState("");

  // excel download
  const [downloading, setDownloading] = useState(false);

  const loadApps = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tutor_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { console.error("tutor_requests 로드 실패:", error); return; }

    // booking_id 기준 bookings 일괄 조회 (FK 의존 없이 in() 으로)
    const bookingIds = Array.from(new Set((data || []).map((r: any) => r.booking_id).filter(Boolean)));
    const bookingMap: Record<string, { house_no?: string; accom_room?: string }> = {};
    if (bookingIds.length > 0) {
      const { data: bs } = await supabase.from("bookings").select("id, house_no, accom_room").in("id", bookingIds);
      (bs || []).forEach((b: any) => { bookingMap[b.id] = { house_no: b.house_no, accom_room: b.accom_room }; });
    }

    const mapped: TutorApp[] = (data || []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      updated_at: r.updated_at || null,
      booking_id: r.booking_id || null,
      reserver_type: 'portal',
      house_or_reserver: r.guest_name || r.house_number || '',
      house_number: (() => {
        const b = bookingMap[r.booking_id] || {};
        const combined = [b.house_no, b.accom_room].filter(Boolean).join('');
        return combined || r.house_number || '';
      })(),
      children_names: [r.student_name_kr, r.student_name_en].filter(Boolean).join(' / '),
      children_ages: r.student_age || '',
      class_type: r.class_type || '',
      sessions_per_day: r.sessions_per_day || 1,
      hourly_rate: r.class_type === '1:2' ? 350 : 300,
      start_date: r.start_date || '',
      end_date: r.end_date || '',
      class_days: r.preferred_days
        ? String(r.preferred_days).split(',').map((s: string) => s.trim()).filter(Boolean)
        : (Array.isArray(r.preferred_days_arr) ? r.preferred_days_arr : null),
      excluded_dates: r.skip_dates || null,
      class_time: r.preferred_time || '',
      overall_level: r.level_english || '',
      speaking_level: r.level_speaking || '',
      reading_level: r.level_reading || '',
      writing_level: r.level_writing || '',
      textbook: r.textbook || null,
      class_style: r.class_style || '',
      class_focus: Array.isArray(r.class_focus_arr) ? r.class_focus_arr : null,
      child_notes: r.child_personality || null,
      agreed_privacy: r.privacy_agreed ?? true,
      agreed_tutor_rules: r.rules_agreed ?? true,
      status: r.status || 'pending',
      assigned_tutor_id: r.assigned_tutor_id || r.tutor_id || null,
      total_sessions: r.total_sessions ?? null,
      total_amount: r.total_amount ?? null,
      admin_memo: r.admin_memo ?? null,
    }));
    setApps(mapped);
  }, []);
  const loadTutors = useCallback(async () => {
    const { data, error } = await supabase.from("tutors").select("*").eq("is_active", true).order("name");
    if (error) { console.error("튜터 로드 실패:", error); return; }
    if (data) setTutors(data as Tutor[]);
  }, []);
  useEffect(() => { loadApps(); loadTutors(); }, [loadApps, loadTutors]);

  // 파생 detail — 항상 apps의 현재 상태 기준으로 조회. id와 필드 일관성 보장.
  const detail = useMemo<TutorApp | null>(() => {
    if (!detailId) return null;
    const fromList = apps.find(a => a.id === detailId);
    return fromList || detailSnap;
  }, [detailId, apps, detailSnap]);

  // 모달 오픈·detail 갱신 진단 로그 — id와 표시 필드의 일관성 추적용
  useEffect(() => {
    if (detailId) {
      console.log("[modal state]", { detailId, resolved: detail ? { id: detail.id, names: detail.children_names, house: detail.house_or_reserver } : null });
    }
  }, [detailId, detail]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function openDetail(a: TutorApp, focusAssign = false) {
    console.log("[openDetail]", { id: a.id, names: a.children_names, house: a.house_or_reserver });
    setDetailId(a.id);
    setDetailSnap(a);
    setAdminForm({
      status: a.status || "pending",
      assigned_tutor_id: a.assigned_tutor_id || "",
      total_sessions: a.total_sessions != null ? String(a.total_sessions) : "",
      total_amount: a.total_amount != null ? String(a.total_amount) : "",
      admin_memo: a.admin_memo || "",
    });
    setModalError("");
    if (focusAssign) setTimeout(() => tutorSelectRef.current?.focus(), 100);
  }
  function closeDetail() { setDetailId(null); setDetailSnap(null); setModalError(""); setShowDeleteConfirm(false); }

  // 확정 처리 공통 함수 — tutor_lessons + tutor_lesson_sessions 생성.
  // 단가=하루치(기본×타임), 회차=실제 수업 일수, 총액=단가×일수 로 저장.
  // 모달 저장(saveAdmin)·목록 "확정" 버튼이 동일하게 호출. 실패 시 throw.
  async function createLessonForApp(
    app: TutorApp,
    opts?: { assignedTutorId?: string | null; totalSessions?: number | null; totalAmount?: number | null; adminMemo?: string }
  ): Promise<string> {
    const assignedTutorId = opts && "assignedTutorId" in opts ? (opts.assignedTutorId ?? null) : (app.assigned_tutor_id || null);
    const adminMemoText = (opts?.adminMemo ?? app.admin_memo ?? "").trim();

    const { data: existing, error: exErr } = await supabase
      .from("tutor_lessons").select("id").eq("application_id", app.id).maybeSingle();
    if (exErr) console.error("기존 수업 조회 실패:", exErr);
    if (existing) return "확정 저장 (수업은 이미 생성됨)";

    const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const targetDays = (app.class_days || []).map(d => dayMap[d]).filter(n => n !== undefined);
    const localStr = (d: Date) => {
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    };
    const _skipSet = new Set(toDateArr((app as any).skip_dates ?? app.excluded_dates));
    // 요일 → 시간 매핑 (요청의 schedule_blocks 기반) → 세션마다 시간 저장해 --:-- 방지
    const _krDow: Record<string, number> = { "일":0,"월":1,"화":2,"수":3,"목":4,"금":5,"토":6, sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6 };
    const _blockTime: Record<number, string> = {};
    if (Array.isArray((app as any).schedule_blocks)) {
      for (const b of (app as any).schedule_blocks as { days?: string[]; time?: string }[]) {
        if (!b || !b.time || !Array.isArray(b.days)) continue;
        for (const d of b.days) { const n = _krDow[String(d).trim()]; if (n !== undefined) _blockTime[n] = b.time as string; }
      }
    }
    const sessions: { session_date: string; session_idx: number; status: string; session_time: string | null }[] = [];
    if (app.start_date && app.end_date && targetDays.length > 0) {
      const cur = new Date(app.start_date + "T00:00:00");
      const end = new Date(app.end_date + "T00:00:00");
      let idx = 1;
      while (cur <= end) {
        if (targetDays.includes(cur.getDay())) {
          const ds = localStr(cur);
          // 휴일(6/12)·1·3·5번째 토요일·skip 제외 → 세션 미생성 (회차·금액 자동 일치)
          if (!_skipSet.has(ds) && isLessonDateAllowed(cur, ds)) sessions.push({ session_date: ds, session_idx: idx++, status: "scheduled", session_time: _blockTime[cur.getDay()] || app.class_time || null });
        }
        cur.setDate(cur.getDate() + 1);
      }
    }

    // 회차 = 실제 수업 일수(= sessions.length). 단가 = 하루치. 총액 = 단가 × 일수.
    const computedTotalSessions = (opts?.totalSessions ?? null) ?? sessions.length;
    const sessionsPerDay = app.sessions_per_day || 1;
    const dailyRate = tutorDailyRate(app.class_type, sessionsPerDay);
    const computedTotalAmount = (opts?.totalAmount ?? null) ?? (dailyRate * computedTotalSessions);

    const _to = blocksToTimeOverrides(app.schedule_blocks);
    const _skipArr = toDateArr((app as any).skip_dates ?? app.excluded_dates);
    const lessonInsertPayload: Record<string, unknown> = {
      application_id: app.id,
      house_or_reserver: app.house_or_reserver,
      student_names: app.children_names,
      student_ages: app.children_ages,
      tutor_id: assignedTutorId,
      class_type: app.class_type,
      sessions_per_day: sessionsPerDay,
      hourly_rate: dailyRate,
      start_date: app.start_date,
      end_date: app.end_date,
      class_days: app.class_days,
      class_time: app.class_time,
      confirmed_time: null,
      overall_level: app.overall_level,
      speaking_level: app.speaking_level,
      reading_level: app.reading_level,
      writing_level: app.writing_level,
      textbook: app.textbook,
      class_style: app.class_style,
      class_focus: toFocusArr(app.class_focus),
      total_sessions: computedTotalSessions,
      total_amount: computedTotalAmount,
      status: "active",
      admin_memo: `request_id: ${app.id}${adminMemoText ? '\n' + adminMemoText : ''}`,
    };
    if (Object.keys(_to).length > 0) lessonInsertPayload.time_overrides = _to;
    if (_skipArr.length > 0) lessonInsertPayload.skip_dates = _skipArr;

    const { data: lesson, error: e2 } = await supabase
      .from("tutor_lessons").insert(lessonInsertPayload).select().single();
    if (e2 || !lesson) throw new Error(`수업 생성 실패: ${e2?.message || "unknown"}`);

    if (sessions.length > 0) {
      const sessionsWithLessonId = sessions.map(s => ({ ...s, lesson_id: (lesson as { id: string }).id }));
      const { error: e3 } = await supabase.from("tutor_lesson_sessions").insert(sessionsWithLessonId);
      if (e3) throw new Error(`수업 생성됐지만 회차 생성 실패: ${e3.message}`);
    }

    // 정산 자동 청구: 튜터비를 settlement_items에 charge로 등록 (예약 연결 시).
    // createLessonForApp은 최초 1회만 도달(기존 수업 있으면 위에서 early-return)하므로 중복 없음.
    if (app.booking_id && computedTotalAmount > 0) {
      const mdShort = (d: string) => (d ? d.slice(5).replace("-", "/") : "");
      const label = `튜터비 · ${app.children_names || ""}${app.start_date ? ` (${mdShort(app.start_date)}~${mdShort(app.end_date)})` : ""}`;
      const { error: eChg } = await supabase.from("settlement_items").insert({
        booking_id: app.booking_id, kind: "charge", label,
        amount: computedTotalAmount, item_date: app.start_date || localStr(new Date()),
        status: "approved", recorded_by: "시스템(튜터확정)",
      });
      if (eChg) console.error("정산 자동청구 실패(수업은 정상):", eChg);
    }
    return `✅ 확정 완료: ${sessions.length}회차 자동 생성`;
  }

  // 목록 "확정" 버튼 — 상세 모달의 확정 처리와 동일 로직(createLessonForApp) 호출.
  async function confirmFromList(a: TutorApp) {
    if (a.status === "confirmed") return;
    if (!confirm("확정하시겠습니까?")) return;
    const { error } = await supabase.from("tutor_requests").update({ status: "confirmed" }).eq("id", a.id);
    if (error) { showToast("확정 실패: " + error.message); return; }
    try {
      const msg = await createLessonForApp(a);
      showToast(msg);
    } catch (e) {
      showToast(`확정됐지만 ${e instanceof Error ? e.message : "수업 생성 실패"}`);
    }
    await loadApps();
  }

  async function saveAdmin() {
    if (!detail) return;
    console.log("[save start]", { id: detail.id, names: detail.children_names, house: detail.house_or_reserver });
    setSaving(true);
    setModalError("");
    const oldStatus = detail.status;
    const newStatus = adminForm.status;
    const parsedSessions = adminForm.total_sessions ? parseInt(adminForm.total_sessions) : null;
    const parsedAmount = adminForm.total_amount ? parseFloat(adminForm.total_amount) : null;
    const payload = {
      status: newStatus,
      assigned_tutor_id: adminForm.assigned_tutor_id || null,
      total_sessions: parsedSessions,
      total_amount: parsedAmount,
      admin_memo: adminForm.admin_memo.trim() || null,
    };
    const { error } = await supabase.from("tutor_requests").update(payload).eq("id", detail.id).select();
    if (error) {
      setSaving(false);
      console.error("신청 저장 실패:", error, "payload:", payload);
      setModalError(error.message + (error.details ? " — " + error.details : "") + (error.hint ? " (" + error.hint + ")" : ""));
      return;
    }

    // 기존 tutor_lessons에 튜터 변경 동기화 — 이미 확정돼 lesson이 생성된 신청건에 대해
    // application 측 assigned_tutor_id 변경이 lesson.tutor_id에 반영되도록.
    // lesson이 아직 없으면 매칭 0건 = no-op (아래 최초 confirmed 분기가 INSERT 시 tutor_id 직접 세팅).
    const oldTutorId = detail.assigned_tutor_id || null;
    const newTutorId = adminForm.assigned_tutor_id || null;
    let syncWarning = "";
    console.log("[lesson sync] appId:", detail.id, "oldTutorId:", oldTutorId, "newTutorId:", newTutorId);
    if (oldTutorId !== newTutorId) {
      // application_id 또는 memo의 request_id 로 연결 수업 조회 (두 생성 경로 모두 커버 — 옛 수업은 application_id가 null일 수 있음)
      const { data: byApp } = await supabase.from("tutor_lessons").select("id").eq("application_id", detail.id);
      const { data: byMemo } = await supabase.from("tutor_lessons").select("id").ilike("admin_memo", `%request_id: ${detail.id}%`);
      const linkedIds = Array.from(new Set([...(byApp || []), ...(byMemo || [])].map((x: { id: string }) => x.id)));
      console.log("[lesson sync] appId:", detail.id, "linked:", linkedIds);
      if (linkedIds.length > 0) {
        const { error: syncErr } = await supabase
          .from("tutor_lessons")
          .update({ tutor_id: newTutorId, application_id: detail.id }) // tutor_id 동기화 + application_id 백필
          .in("id", linkedIds);
        if (syncErr) {
          console.warn("lesson 튜터 동기화 실패:", syncErr);
          syncWarning = " (수업 튜터 동기화 실패: " + syncErr.message + ")";
        } else {
          console.log("[lesson sync] ✓", linkedIds.length, "개 lesson 동기화 완료");
        }
      } else if (!(newStatus === "confirmed" && oldStatus !== "confirmed")) {
        // 매칭 0건 & 최초 확정 전환도 아님 → 연결 수업이 없음(곧 INSERT되는 케이스는 아래 confirmed 분기에서 처리)
        console.warn("[lesson sync] 0 rows matched. appId:", detail.id);
        syncWarning = " (연결된 수업을 찾지 못함 — 콘솔 확인)";
      }
    } else {
      console.log("[lesson sync] 변경 없음, 스킵");
    }

    // 최초 confirmed 전환 시 → 공통 함수로 tutor_lessons + tutor_lesson_sessions 생성
    let postMsg = "저장되었습니다" + syncWarning;
    if (newStatus === "confirmed" && oldStatus !== "confirmed") {
      try {
        postMsg = await createLessonForApp(detail, {
          assignedTutorId: adminForm.assigned_tutor_id || null,
          totalSessions: parsedSessions,
          totalAmount: parsedAmount,
          adminMemo: adminForm.admin_memo,
        });
      } catch (e) {
        setSaving(false);
        console.error("수업 생성 실패:", e);
        closeDetail();
        showToast(`확정 저장됐지만 ${e instanceof Error ? e.message : "수업 생성 실패"}`);
        await loadApps();
        return;
      }
    }

    setSaving(false);
    closeDetail();
    showToast(postMsg);
    await loadApps();
  }

  async function deleteApp() {
    if (!detail) return;
    setDeleting(true);
    setModalError("");
    // 연결된 tutor_lessons 정리
    await supabase.from("tutor_lessons")
      .delete()
      .ilike("admin_memo", `%request_id: ${detail.id}%`);
    const { error } = await supabase.from("tutor_requests").delete().eq("id", detail.id);
    setDeleting(false);
    if (error) {
      console.error("신청 삭제 실패:", error);
      setModalError("삭제 실패: " + error.message);
      setShowDeleteConfirm(false);
      return;
    }
    const deletedId = detail.id;
    setApps(prev => prev.filter(x => x.id !== deletedId));
    closeDetail();
    showToast("삭제되었습니다");
  }

  // Estimate helpers (for placeholders/hints only — not saved)
  // 회차 = 실제 수업 "일수"(lib/lessonDates), 단가 = 하루치(기본×타임), 총액 = 단가 × 일수.
  function estimateSessions(a: TutorApp): string {
    const days = countLessonDays(a.start_date, a.end_date, a.class_days, toDateArr(a.excluded_dates));
    if (!days) return "";
    return `자동: 실제 수업일 ${days}일`;
  }
  function estimateAmount(a: TutorApp, sessions: number | string): string {
    const typed = typeof sessions === "number" ? sessions : parseInt(sessions);
    const days = typed || countLessonDays(a.start_date, a.end_date, a.class_days, toDateArr(a.excluded_dates));
    if (!days) return "";
    const spd = a.sessions_per_day || 1;
    const daily = tutorDailyRate(a.class_type, spd);
    return `단가 ₱${daily.toLocaleString()} (₱${tutorBaseRate(a.class_type)}×${spd}타임) × ${days}일 = ₱${(daily * days).toLocaleString()}`;
  }

  // Filtered list
  const filteredApps = apps.filter(a => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (tutorFilter !== "all") {
      if (tutorFilter === "__unassigned__") { if (a.assigned_tutor_id) return false; }
      else if (a.assigned_tutor_id !== tutorFilter) return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${a.house_or_reserver} ${a.children_names}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const statusCounts = apps.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1; return acc;
  }, {});

  function fmtMD(iso: string): string {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  const tutorNameById = (id: string | null | undefined): string => id ? (tutors.find(t => t.id === id)?.name || "-") : "-";

  async function downloadExcel() {
    if (apps.length === 0 || downloading) return;
    setDownloading(true);
    try {
      // 필터 무시, 전체 재조회
      // tutor_requests 사용 — 이미 로드된 apps state 활용 (중복 fetch 방지)
      const rows = apps;

      const pad = (n: number) => String(n).padStart(2, "0");
      const fmtDT = (iso: string) => {
        if (!iso) return "";
        const d = new Date(iso);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      const fmtD = (iso: string) => {
        if (!iso) return "";
        const d = new Date(iso);
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      };
      const joinDays = (arr: string[] | null) =>
        (arr || []).map(d => DAY_KR[d] || d).join("/");
      const joinFocus = (arr: string[] | null) =>
        (arr || []).map(f => CLASS_FOCUS_KR[f] || f).join(", ");
      const weeksBetween = (s: string, e: string): string => {
        if (!s || !e) return "";
        const ms = new Date(s + "T00:00:00").getTime();
        const me = new Date(e + "T00:00:00").getTime();
        if (isNaN(ms) || isNaN(me)) return "";
        const days = Math.max(0, (me - ms) / 86400000);
        return (days / 7).toFixed(1);
      };
      const classTypeBase = (ct: string): string => {
        if (!ct) return "";
        const m = ct.match(/1\s*[:：]\s*[12]/);
        return m ? m[0].replace(/\s+/g, "") : ct;
      };
      const classTypePriced = (a: TutorApp): string => {
        const base = classTypeBase(a.class_type);
        const rate = a.hourly_rate ? `₱${a.hourly_rate}` : "";
        return rate ? `${base} (${rate})` : base;
      };

      // 시트 1: 손님명단
      const sheet1Rows = rows.map(a => ({
        "접수일": fmtDT(a.created_at),
        "예약자/하우스": a.house_or_reserver || "",
        "수강자 이름": a.children_names || "",
        "수강자 나이": a.children_ages || "",
        "수업유형": classTypePriced(a),
        "타임": a.sessions_per_day === 2 ? "2타임 (100분)" : "1타임 (50분)",
        "시작일": a.start_date || "",
        "종료일": a.end_date || "",
        "요일": joinDays(a.class_days),
        "빠지는 날": a.excluded_dates || "",
        "희망 시간대": a.class_time || "",
        "전체 레벨": LEVEL_OVERALL[a.overall_level] || a.overall_level || "",
        "스피킹": LEVEL_7_FULL[a.speaking_level] || a.speaking_level || "",
        "리딩": LEVEL_7_FULL[a.reading_level] || a.reading_level || "",
        "롸이팅": LEVEL_7_FULL[a.writing_level] || a.writing_level || "",
        "교재": a.textbook || "",
        "수업 방향": CLASS_STYLE_KR[a.class_style] || a.class_style || "",
        "수업 포커스": joinFocus(a.class_focus),
        "성향/흥미": a.child_notes || "",
        "개인정보 동의": a.agreed_privacy ? "✓" : "",
        "튜터 규정 동의": (a.agreed_tutor_rules_bool ?? a.agreed_tutor_rules) ? "✓" : "",
      }));

      // 시트 2: 정산용
      type Sheet2Row = {
        "접수일": string | number; "예약자": string; "수강자": string; "수업유형": string; "타임": string;
        "시급": number | string; "시작일": string; "종료일": string; "기간(주)": number | string;
        "요일": string; "담당 튜터": string; "상태": string;
        "확정 회차": number | string; "확정 금액": number | string;
        "어드민 메모": string; "업데이트일": string;
      };
      const sheet2Rows: Sheet2Row[] = rows.map(a => ({
        "접수일": fmtD(a.created_at),
        "예약자": a.house_or_reserver || "",
        "수강자": a.children_names || "",
        "수업유형": classTypeBase(a.class_type),
        "타임": a.sessions_per_day === 2 ? "2타임" : "1타임",
        "시급": a.hourly_rate || 0,
        "시작일": a.start_date || "",
        "종료일": a.end_date || "",
        "기간(주)": weeksBetween(a.start_date, a.end_date),
        "요일": joinDays(a.class_days),
        "담당 튜터": a.assigned_tutor_id ? (tutorNameById(a.assigned_tutor_id) || "(미배정)") : "(미배정)",
        "상태": STATUS_META[a.status]?.label || a.status || "",
        "확정 회차": a.total_sessions ?? "",
        "확정 금액": a.total_amount ?? "",
        "어드민 메모": a.admin_memo || "",
        "업데이트일": a.updated_at ? fmtDT(a.updated_at) : "",
      }));
      const sumSessions = rows.reduce((s, a) => s + (a.total_sessions || 0), 0);
      const sumAmount = rows.reduce((s, a) => s + (a.total_amount || 0), 0);
      sheet2Rows.push({
        "접수일": `합계 (총 ${rows.length}건)`,
        "예약자": "", "수강자": "", "수업유형": "", "타임": "", "시급": "",
        "시작일": "", "종료일": "", "기간(주)": "", "요일": "",
        "담당 튜터": "", "상태": "",
        "확정 회차": sumSessions,
        "확정 금액": sumAmount,
        "어드민 메모": "", "업데이트일": "",
      });

      // 워크북 생성
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(sheet1Rows);
      const ws2 = XLSX.utils.json_to_sheet(sheet2Rows);

      // 컬럼 폭
      ws1["!cols"] = [
        { wch: 16 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 22 },
        { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 25 },
        { wch: 14 }, { wch: 22 }, { wch: 50 }, { wch: 14 }, { wch: 14 },
      ];
      ws2["!cols"] = [
        { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 16 },
        { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 40 }, { wch: 16 },
      ];

      // 자동 필터
      const ws1Cols = sheet1Rows.length > 0 ? Object.keys(sheet1Rows[0]).length : 0;
      const ws2Cols = sheet2Rows.length > 0 ? Object.keys(sheet2Rows[0]).length : 0;
      const colLetter = (i: number) => {
        let s = "";
        let n = i;
        while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
        return s;
      };
      if (ws1Cols > 0 && sheet1Rows.length > 0) {
        ws1["!autofilter"] = { ref: `A1:${colLetter(ws1Cols - 1)}${sheet1Rows.length + 1}` };
      }
      if (ws2Cols > 0 && rows.length > 0) {
        // 합계행 제외한 데이터 범위에만 필터
        ws2["!autofilter"] = { ref: `A1:${colLetter(ws2Cols - 1)}${rows.length + 1}` };
      }

      // 셀 스타일 (xlsx 커뮤니티 에디션은 대부분 무시하지만 호환 버전에서는 적용됨)
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1A6FC4" } },
        alignment: { vertical: "center", horizontal: "center" },
      };
      const totalStyle = {
        font: { bold: true },
        fill: { fgColor: { rgb: "F1F5F9" } },
      };
      const styleHeaderRow = (ws: XLSX.WorkSheet, colCount: number) => {
        for (let c = 0; c < colCount; c++) {
          const addr = `${colLetter(c)}1`;
          const cell = ws[addr];
          if (cell) (cell as XLSX.CellObject & { s?: unknown }).s = headerStyle;
        }
      };
      styleHeaderRow(ws1, ws1Cols);
      styleHeaderRow(ws2, ws2Cols);
      const totalRowNum = rows.length + 2;
      for (let c = 0; c < ws2Cols; c++) {
        const addr = `${colLetter(c)}${totalRowNum}`;
        const cell = ws2[addr];
        if (cell) (cell as XLSX.CellObject & { s?: unknown }).s = totalStyle;
      }

      XLSX.utils.book_append_sheet(wb, ws1, "손님명단");
      XLSX.utils.book_append_sheet(wb, ws2, "정산용");

      // 파일명: 튜터신청_전체_YYYYMMDD_HHmm.xlsx
      const now = new Date();
      const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      XLSX.writeFile(wb, `튜터신청_전체_${stamp}.xlsx`);
      showToast(`엑셀 다운로드 완료 (${rows.length}건)`);
    } catch (e) {
      console.error("엑셀 다운로드 실패:", e);
      toastErr("다운로드 실패: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <style>{`
.tbl-w{width:100%;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);border:1px solid #f3f4f6;}
.tbl-scroll{width:100%;overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;table-layout:fixed;}
.tbl th{font-size:13px;font-weight:500;color:#6b7280;padding:12px 16px;text-align:left;background:#f9fafb;border-bottom:1px solid #e5e7eb;white-space:nowrap;}
.tbl td{font-size:13px;padding:14px 16px;border-bottom:1px solid #f3f4f6;color:#1a1a2e;}
.tbl tbody tr:last-child td{border-bottom:none}
.tbl tbody tr:hover td{background:#eff6ff;}
.ta-act-btn{display:inline-flex;align-items:center;justify-content:center;height:28px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 120ms;line-height:1;white-space:nowrap;padding:0 8px}
.ta-act-btn.view{background:#fff;color:#475569;border:1px solid #cbd5e1}.ta-act-btn.view:hover{background:#f8fafc;border-color:#94a3b8;color:#1a1a2e}
.ta-act-btn.review{background:#f59e0b;color:#fff;border:none}.ta-act-btn.review:hover{background:#d97706}
.ta-act-btn.assign{background:#16a34a;color:#fff;border:none}.ta-act-btn.assign:hover{background:#15803d}
.ta-act-btn.confirm{background:#1a6fc4;color:#fff;border:none}.ta-act-btn.confirm:hover{background:#155aa0}
.ta-act-btn:disabled{opacity:0.4;cursor:not-allowed}
.ta-toolbar{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}
.ta-filter-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.ta-chip{padding:7px 13px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 120ms}
.ta-chip:hover{background:#e2e8f0}
.ta-chip.ac{background:#1a6fc4;color:#fff}
.ta-chip .cnt{display:inline-block;margin-left:5px;padding:1px 7px;background:rgba(0,0,0,0.08);border-radius:10px;font-size:11px;font-weight:700}
.ta-chip.ac .cnt{background:rgba(255,255,255,0.22)}
.ta-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%}
.ta-controls select,.ta-controls input{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff}
.ta-controls select{min-width:160px}
.ta-controls input{flex:1;min-width:180px}
.ta-count{margin-left:auto;font-size:12.5px;color:#475569;font-weight:700;padding:6px 10px;background:#eff6ff;border-radius:8px}
.ta-xlsx{padding:8px 14px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;transition:all 120ms;display:inline-flex;align-items:center;gap:6px}
.ta-xlsx:hover:not(:disabled){background:#15803d}
.ta-xlsx:disabled{background:#cbd5e1;color:#94a3b8;cursor:not-allowed}
.ta-spin{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:taSpin 650ms linear infinite}
@keyframes taSpin{to{transform:rotate(360deg)}}
.ta-badge-type{display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;background:#eff6ff;color:#1a6fc4}
.ta-badge-time{display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:800}
.ta-time-1{background:#f1f5f9;color:#475569}
.ta-time-2{background:#dbeafe;color:#1e40af}
.ta-empty{text-align:center;padding:40px 20px;color:#94a3b8;font-size:13px}
.ta-loading{text-align:center;padding:40px;color:#94a3b8;font-size:13px}
.ta-row-acts{display:flex;gap:3px;justify-content:flex-start;align-items:center;flex-wrap:nowrap}
.ta-warn-chip{display:inline-block;margin-left:4px;padding:1px 6px;background:#fef3c7;color:#92400e;border-radius:4px;font-size:10px;font-weight:700}

.ta-modal{background:#fff;border-radius:16px;width:100%;max-width:960px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15)}
.ta-modal-head{position:sticky;top:0;z-index:2;background:#fff;padding:18px 22px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:12px}
.ta-modal-head h3{font-size:17px;font-weight:800;margin:0}
.ta-close{background:none;border:none;font-size:22px;cursor:pointer;color:#6b7c93;line-height:1;padding:4px 8px;border-radius:6px}.ta-close:hover{background:#f1f5f9;color:#1a1a2e}
.ta-modal-err{margin:0 22px 12px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:8px;font-size:12.5px;line-height:1.5;font-weight:600}
.ta-modal-body{display:grid;grid-template-columns:1fr 1fr;gap:18px;padding:18px 22px}
.ta-modal-foot{position:sticky;bottom:0;background:#fff;border-top:1px solid #e2e8f0;padding:14px 22px;display:flex;justify-content:space-between;gap:10px;align-items:center}

.ta-s{margin-bottom:14px}
.ta-s h4{font-size:12px;font-weight:800;color:#1a6fc4;margin:0 0 6px;padding-bottom:4px;border-bottom:1.5px solid #e2e8f0;letter-spacing:0.02em}
.ta-kv{display:grid;grid-template-columns:92px 1fr;gap:4px 10px;font-size:12.5px}
.ta-kv .k{color:#6b7c93;font-weight:600}
.ta-kv .v{color:#1a1a2e;word-break:break-word;white-space:pre-wrap;line-height:1.5}

.ta-lvl-row{display:flex;align-items:center;gap:6px}
.ta-lvl-r0{color:#94a3b8}
.ta-lvl-r1,.ta-lvl-r2{color:#ea580c}
.ta-lvl-r3,.ta-lvl-r4{color:#1a6fc4}
.ta-lvl-r5,.ta-lvl-r6{color:#166534}
.ta-asym{background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;margin-left:6px}

.ta-admin label{display:block;font-size:12px;font-weight:700;color:#475569;margin:0 0 4px}
.ta-admin .hint{font-size:11px;color:#94a3b8;margin:-2px 0 4px;line-height:1.4}
.ta-admin input,.ta-admin select,.ta-admin textarea{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff;margin-bottom:12px;box-sizing:border-box}
.ta-admin input:focus,.ta-admin select:focus,.ta-admin textarea:focus{border-color:#1a6fc4}
.ta-admin textarea{resize:vertical;min-height:80px;line-height:1.5}

.ta-confirm{background:#fff;border-radius:14px;padding:24px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2)}
.ta-confirm h4{font-size:15px;font-weight:800;margin:0 0 8px}
.ta-confirm p{font-size:13px;color:#475569;line-height:1.6;margin:0 0 20px}
.ta-confirm-foot{display:flex;justify-content:flex-end;gap:8px}

.ta-btn-danger{padding:10px 18px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}.ta-btn-danger:hover{background:#b91c1c}.ta-btn-danger:disabled{opacity:0.5;cursor:not-allowed}

.ta-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 22px;border-radius:10px;font-size:13.5px;font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,0.18);z-index:300;animation:taToastIn 250ms ease-out}
@keyframes taToastIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}

@media(max-width:768px){
  .ta-modal{max-height:100vh;border-radius:0}
  .ta-modal-body{grid-template-columns:1fr;padding:16px}
  .ta-kv{grid-template-columns:86px 1fr}
  .ta-count{margin-left:0;width:100%;text-align:center}
}
      `}</style>

      <div className="sec">
        <div className="sec-head">
          <h2>📬 튜터 신청 접수</h2>
        </div>

        <div className="ta-toolbar">
          <div className="ta-filter-row">
            <button className={`ta-chip${statusFilter === "all" ? " ac" : ""}`} onClick={() => setStatusFilter("all")}>
              전체<span className="cnt">{apps.length}</span>
            </button>
            {STATUS_ORDER.map(s => (
              <button key={s} className={`ta-chip${statusFilter === s ? " ac" : ""}`} onClick={() => setStatusFilter(s)}>
                {STATUS_META[s].label}<span className="cnt">{statusCounts[s] || 0}</span>
              </button>
            ))}
          </div>
          <div className="ta-controls">
            <select value={tutorFilter} onChange={e => setTutorFilter(e.target.value)} aria-label="튜터 필터">
              <option value="all">모든 튜터</option>
              <option value="__unassigned__">미배정만</option>
              {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="예약자명 또는 수강자 이름 검색"
              aria-label="검색"
            />
            <div className="ta-count">{filteredApps.length}건</div>
            <button
              className="ta-xlsx"
              onClick={downloadExcel}
              disabled={apps.length === 0 || downloading}
              title={apps.length === 0 ? "다운로드할 신청이 없습니다" : "tutor_applications 전체 데이터 다운로드 (필터 무시)"}
              aria-label="엑셀 다운로드"
            >
              {downloading ? (<><span className="ta-spin" aria-hidden="true" />생성중...</>) : (<>📥 엑셀 다운로드</>)}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="ta-loading">로딩 중...</div>
        ) : filteredApps.length === 0 ? (
          <div className="ta-empty">{apps.length === 0 ? "신청된 내역이 없습니다" : "필터 조건에 맞는 신청이 없습니다"}</div>
        ) : (
          <div className="tbl-w">
            <div className="tbl-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: '6%' }}>접수</th>
                  <th style={{ width: '9%' }}>하우스</th>
                  <th style={{ width: '10%' }}>예약자</th>
                  <th style={{ width: '18%' }}>수강자</th>
                  <th style={{ width: '6%' }}>나이</th>
                  <th style={{ width: '5%' }}>유형</th>
                  <th style={{ width: '5%' }}>타임</th>
                  <th style={{ width: '12%' }}>기간</th>
                  <th style={{ width: '9%' }}>요일</th>
                  <th style={{ width: '9%' }}>담당 튜터</th>
                  <th style={{ width: '7%' }}>상태</th>
                  <th style={{ width: '14%', minWidth: 200 }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map(a => {
                  const st = STATUS_META[a.status] || STATUS_META.pending;
                  const days = (a.class_days || []).map(d => DAY_KR[d] || d).join("/");
                  return (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "#6b7c93" }}>{fmtMD(a.created_at)}</td>
                      <td style={{ fontSize: 12, fontWeight: 700, color: "#1a6fc4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.house_number || "-"}</td>
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={a.house_or_reserver}>{a.house_or_reserver}</td>
                      <td style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.children_names}>
                        {a.children_names}
                        {(a as any).slot_label && (
                          <span style={{
                            display:"inline-block",padding:"2px 8px",
                            background:"#ede9fe",color:"#7c3aed",
                            borderRadius:6,fontSize:11,fontWeight:800,marginLeft:6
                          }}>{(a as any).slot_label}</span>
                        )}
                        {isAsymmetric(a) && <span className="ta-warn-chip" title="레벨 편차 큼">⚠</span>}
                      </td>
                      <td style={{ fontSize: 12, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={a.children_ages}>{a.children_ages?.replace(/\d{4}\.\d{2}\.\d{2}\s*/g, '')}</td>
                      <td><span className="ta-badge-type">{a.class_type}</span></td>
                      <td>
                        <span className={`ta-badge-time ${a.sessions_per_day === 2 ? "ta-time-2" : "ta-time-1"}`}>
                          {a.sessions_per_day === 2 ? "2T" : "1T"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={`${a.start_date} ~ ${a.end_date}`}>{a.start_date?.slice(5).replace('-','/')}~{a.end_date?.slice(5).replace('-','/')}</td>
                      <td style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={days || "-"}>{days || "-"}</td>
                      <td style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={tutorNameById(a.assigned_tutor_id) || ""}>{tutorNameById(a.assigned_tutor_id)}</td>
                      <td><span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                      <td>
                        <div className="ta-row-acts">
                          {/* 상세 — 항상 */}
                          <button
                            className="ta-act-btn view"
                            onClick={() => router.push('/admin/tutor-class/' + a.id)}
                            title="상세 보기"
                          >상세</button>
                          {/* 검토중 — pending에서만 */}
                          {a.status === 'pending' && (
                            <button
                              className="ta-act-btn review"
                              onClick={async () => {
                                const res = await fetch(`/api/admin/tutor-applications/${a.id}/status`, {
                                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'reviewing' }),
                                });
                                if (!res.ok) { const r = await res.json().catch(() => ({})); toastErr(r.error || '상태 변경 실패'); return; }
                                await loadApps();
                              }}
                              title="검토중으로 변경"
                            >검토중</button>
                          )}
                          {/* 배정 — 확정/완료/취소가 아닐 때 */}
                          {!['confirmed','completed','cancelled'].includes(a.status) && (
                            <button
                              className="ta-act-btn assign"
                              onClick={() => openDetail(a, true)}
                              title={a.assigned_tutor_id ? "튜터 재배정" : "튜터 배정"}
                            >배정</button>
                          )}
                          {/* 확정 — 배정됨 상태에서만 (상세 확정 처리와 동일 로직) */}
                          {a.status === 'assigned' && (
                            <button
                              className="ta-act-btn confirm"
                              onClick={() => confirmFromList(a)}
                              title="확정 처리 (수업·회차 생성)"
                            >확정</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {detail && (
        <div className="overlay" onClick={closeDetail}>
          <div className="ta-modal" onClick={e => e.stopPropagation()}>
            <div className="ta-modal-head">
              <h3>
                📬 {detail.house_or_reserver} · {detail.children_names}
                <span className="badge" style={{ background: STATUS_META[detail.status]?.bg, color: STATUS_META[detail.status]?.color, marginLeft: 10, fontSize: 11 }}>
                  {STATUS_META[detail.status]?.label || detail.status}
                </span>
              </h3>
              <button className="ta-close" onClick={closeDetail} aria-label="닫기">✕</button>
            </div>

            {modalError && <div className="ta-modal-err">⚠️ {modalError}</div>}

            <div className="ta-modal-body">
              {/* 좌측: 손님 입력 내용 */}
              <div>
                <div className="ta-s">
                  <h4>1. 기본 정보</h4>
                  <div className="ta-kv">
                    <span className="k">예약자/하우스</span><span className="v">{detail.house_or_reserver}</span>
                    <span className="k">수강자 이름</span><span className="v">{detail.children_names}</span>
                    <span className="k">수강자 나이</span><span className="v">{detail.children_ages}</span>
                    <span className="k">접수</span><span className="v">{new Date(detail.created_at).toLocaleString("ko-KR")}</span>
                  </div>
                </div>

                <div className="ta-s">
                  <h4>2. 수업 유형</h4>
                  <div className="ta-kv">
                    <span className="k">유형</span><span className="v">{detail.class_type}</span>
                    <span className="k">타임 수</span><span className="v">{detail.sessions_per_day || 1}타임 ({(detail.sessions_per_day || 1) * 50}분)</span>
                    <span className="k">요금</span>
                    <span className="v">
                      {detail.class_type} (₱{detail.hourly_rate?.toLocaleString()}/타임 × {detail.sessions_per_day || 1}타임
                      {" = ₱"}{((detail.hourly_rate || 0) * (detail.sessions_per_day || 1)).toLocaleString()}/회)
                    </span>
                  </div>
                </div>

                <div className="ta-s">
                  <h4>3. 일정</h4>
                  <div className="ta-kv">
                    <span className="k">시작일</span><span className="v">{detail.start_date}</span>
                    <span className="k">종료일</span><span className="v">{detail.end_date}</span>
                    <span className="k">요일</span><span className="v">{(detail.class_days || []).map(d => DAY_KR[d] || d).join(", ") || "-"}</span>
                    <span className="k">시간 희망</span><span className="v">{detail.class_time}</span>
                    {Array.isArray(detail.schedule_blocks) && detail.schedule_blocks.length > 0 && detail.schedule_blocks.map((b, i) => (
                      <Fragment key={`sb${i}`}>
                        <span className="k">일정 {i+1}</span>
                        <span className="v">{(Array.isArray(b.days) ? b.days.map(d => DAY_KR[d] || d) : []).join('·') || '-'} — {b.time || '-'} ({Number(b.sessions_per_day) === 2 ? '2타임' : '1타임'})</span>
                      </Fragment>
                    ))}
                    <span className="k">빠지는 날</span><span className="v">{detail.excluded_dates || "-"}</span>
                  </div>
                </div>

                <div className="ta-s">
                  <h4>
                    4. 영어 레벨
                    {isAsymmetric(detail) && <span className="ta-asym">⚠ 편차 큼</span>}
                  </h4>
                  <div className="ta-kv">
                    <span className="k">전체</span>
                    <span className={`v ta-lvl-r${levelRank(detail.overall_level)}`}>
                      {LEVEL_OVERALL[detail.overall_level] || detail.overall_level}
                    </span>
                    <span className="k">스피킹</span>
                    <span className={`v ta-lvl-r${levelRank(detail.speaking_level)}`}>
                      {LEVEL_7[detail.speaking_level] || detail.speaking_level}
                    </span>
                    <span className="k">리딩</span>
                    <span className={`v ta-lvl-r${levelRank(detail.reading_level)}`}>
                      {LEVEL_7[detail.reading_level] || detail.reading_level}
                    </span>
                    <span className="k">롸이팅</span>
                    <span className={`v ta-lvl-r${levelRank(detail.writing_level)}`}>
                      {LEVEL_7[detail.writing_level] || detail.writing_level}
                    </span>
                  </div>
                </div>

                <div className="ta-s">
                  <h4>5. 수업 방향</h4>
                  <div className="ta-kv">
                    <span className="k">교재</span><span className="v">{detail.textbook || "-"}</span>
                    <span className="k">방향</span><span className="v">{CLASS_STYLE_KR[detail.class_style] || detail.class_style}</span>
                    <span className="k">포커스</span><span className="v">{(detail.class_focus || []).map(f => CLASS_FOCUS_KR[f] || f).join(", ") || "-"}</span>
                    <span className="k">성향/흥미</span><span className="v">{detail.child_notes || "-"}</span>
                  </div>
                </div>

                <div className="ta-s">
                  <h4>6. 동의</h4>
                  <div className="ta-kv">
                    <span className="k">개인정보</span><span className="v">{detail.agreed_privacy ? "✓" : "미동의"}</span>
                    <span className="k">튜터 규정</span><span className="v">{detail.agreed_tutor_rules ? "✓" : "미동의"}</span>
                  </div>
                </div>
              </div>

              {/* 우측: 어드민 폼 */}
              <div className="ta-admin">
                <div className="ta-s">
                  <h4>🛠 어드민 처리</h4>

                  <label htmlFor="ta-status">상태</label>
                  <select id="ta-status" value={adminForm.status} onChange={e => setAdminForm({ ...adminForm, status: e.target.value })}>
                    {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>

                  <label htmlFor="ta-tutor">담당 튜터</label>
                  <select
                    id="ta-tutor"
                    ref={tutorSelectRef}
                    value={adminForm.assigned_tutor_id}
                    onChange={e => setAdminForm({ ...adminForm, assigned_tutor_id: e.target.value })}
                  >
                    <option value="">-- 미배정 --</option>
                    {tutors.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}{t.specialty ? ` (${t.specialty})` : ""}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="ta-sessions">확정 회차 (total_sessions)</label>
                  <div className="hint">{estimateSessions(detail)}</div>
                  <input
                    id="ta-sessions"
                    type="number"
                    value={adminForm.total_sessions}
                    onChange={e => setAdminForm({ ...adminForm, total_sessions: e.target.value })}
                    placeholder="예: 12"
                    min={0}
                  />

                  <label htmlFor="ta-amount">확정 금액 (total_amount, ₱)</label>
                  <div className="hint">{estimateAmount(detail, adminForm.total_sessions)}</div>
                  <input
                    id="ta-amount"
                    type="number"
                    value={adminForm.total_amount}
                    onChange={e => setAdminForm({ ...adminForm, total_amount: e.target.value })}
                    placeholder="예: 3600"
                    min={0}
                    step={0.01}
                  />

                  <label htmlFor="ta-memo">어드민 메모 (admin_memo)</label>
                  <textarea
                    id="ta-memo"
                    value={adminForm.admin_memo}
                    onChange={e => setAdminForm({ ...adminForm, admin_memo: e.target.value })}
                    placeholder="확정 시간, 변경 사항, 특이사항 기록"
                  />
                </div>
              </div>
            </div>

            <div className="ta-modal-foot">
              <button className="ta-btn-danger" onClick={() => setShowDeleteConfirm(true)} disabled={saving || deleting}>
                🗑 삭제
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-gray" onClick={closeDetail} disabled={saving || deleting}>취소</button>
                <button className="btn btn-blue" onClick={saveAdmin} disabled={saving || deleting}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && detail && (
        <div className="overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="ta-confirm" onClick={e => e.stopPropagation()}>
            <h4>⚠️ 신청을 삭제하시겠습니까?</h4>
            <p>
              <b>{detail.house_or_reserver}</b> — <b>{detail.children_names}</b> 님의 신청이 영구 삭제됩니다. 되돌릴 수 없습니다.
            </p>
            <div className="ta-confirm-foot">
              <button className="btn btn-gray" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>취소</button>
              <button className="ta-btn-danger" onClick={deleteApp} disabled={deleting}>
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="ta-toast" role="status" aria-live="polite">{toast}</div>}
    </>
  );
}
