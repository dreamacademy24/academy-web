"use client";
import { useState, useEffect } from "react";
import { resolvePortalFeatures } from "@/lib/portalFeatures";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import PortalPushButton from "@/components/PortalPushButton";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Session {
  booking_id: string; booking_number: string; guest_name: string;
  check_in_date: string; status: string; expires: number;
}

export default function PortalDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ocReady, setOcReady] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [bookingInfo, setBookingInfo] = useState<any>(null);
  const [shuttleApps, setShuttleApps] = useState<any[]>([]);
  const [hasConfirmedTutor, setHasConfirmedTutor] = useState(false);
  const [confirmedTutorIds, setConfirmedTutorIds] = useState<string[]>([]);
  const [stayHolidays, setStayHolidays] = useState<Array<{ date: string; name: string }> | null>(null);
  const [dashStudents, setDashStudents] = useState<any[]>([]);
  const [hasNewNotes, setHasNewNotes] = useState(false);
  const [popupNotice, setPopupNotice] = useState<any>(null);
  const [noticeUnread, setNoticeUnread] = useState(0);
  const [appsChanged, setAppsChanged] = useState(0);
  const [ocChanged, setOcChanged] = useState(0);
  const [mealNew, setMealNew] = useState(0);
  // 배너 dismiss 상태
  const [dismissBalance, setDismissBalance] = useState(false);
  const [dismissEngName, setDismissEngName] = useState(false);
  const [dismissNewNotes, setDismissNewNotes] = useState(false);

  // 배너 dismiss localStorage 로드
  useEffect(() => {
    if (typeof window === "undefined") return;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem("dismiss_balance") === today) setDismissBalance(true);
    if (localStorage.getItem("dismiss_engname") === today) setDismissEngName(true);
    if (localStorage.getItem("dismiss_newnotes") === today) setDismissNewNotes(true);
  }, []);

  useEffect(() => {
    async function init() {
      if (typeof window === "undefined") return;
      // 👀 관리자 미리보기: ?admin_view={bookingId} — 어드민 로그인 상태에서만 해당 예약의 엄마 화면을 그대로 연다
      try {
        const av = new URLSearchParams(window.location.search).get("admin_view");
        if (av) {
          const { isAdminAuthed } = await import("@/lib/adminAuth");
          if (isAdminAuthed()) {
            const j = await fetch("/api/bookings/" + av).then(r => r.json());
            const b = j?.booking;
            if (b && b.id) {
              localStorage.setItem("portalSession", JSON.stringify({ booking_id: b.id, booking_number: b.reservation_no, guest_name: b.booker_name, check_in_date: b.checkin_date, expires: Date.now() + 2 * 3600000, admin_view: true }));
              window.location.replace("/portal/dashboard");
              return;
            }
          }
        }
      } catch {}
      // 1) portalSession 체크
      try {
        const raw = localStorage.getItem("portalSession");
        if (raw) {
          const s = JSON.parse(raw);
          if (s.expires > Date.now()) { setSession(s); return; }
          localStorage.removeItem("portalSession");
        }
      } catch {}
      // 2) Supabase Auth 체크
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setAuthUser(data.session.user);
        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.session.user.id)
          .single();
        setProfile(prof);
        return;
      }
      // 3) 둘 다 없으면 포털로
      router.replace("/portal");
    }
    init();
  }, [router]);

  // booking_id 기반 예약/학생/셔틀/튜터 정보 fetch
  // 우선순위: portalSession.booking_id → supabase.auth.getUser().user_metadata.booking_id
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      let bookingId: string | null = null;
      try {
        const raw = localStorage.getItem("portalSession");
        if (raw) {
          const s = JSON.parse(raw);
          if (s?.booking_id) bookingId = s.booking_id;
        }
      } catch {}
      if (!bookingId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.booking_id) bookingId = user.user_metadata.booking_id;
      }
      if (!bookingId || cancelled) return;
      fetch(`/api/bookings/${bookingId}`)
        .then(r => r.json())
        .then(d => { if (!cancelled) { setBookingInfo(d?.booking || d); setDashStudents(d?.students || []); } })
        .catch(() => {});
      supabase
        .from("shuttle_applications")
        .select("id,tour_name,date,num_people,status,created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .then(({ data }) => { if (!cancelled) setShuttleApps(data || []); });
      fetch(`/api/portal/tutor?booking_id=${bookingId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          // 확인(클릭)한 확정 건은 다시 안 띄움 — 새로 확정된 건만 배너 표시
          const confirmedIds: string[] = (d?.requests || []).filter((r: any) => r.status === 'confirmed').map((r: any) => String(r.id));
          let seen: string[] = [];
          try { seen = JSON.parse(localStorage.getItem('tutor_confirm_seen') || '[]'); } catch {}
          const unseen = confirmedIds.filter(id => !seen.includes(id));
          if (!cancelled && unseen.length > 0) {
            setHasConfirmedTutor(true);
            setConfirmedTutorIds(confirmedIds);
          }
          const anyNotes = d?.notesMap && Object.values(d.notesMap)
            .some((a: any) => Array.isArray(a) && a.length > 0);
          if (!cancelled && anyNotes) setHasNewNotes(true);
        })
        .catch(() => {});
    })();
    return () => { cancelled = true; };
  }, []);

  // 입장 팝업 공지 — popup=true & 이 손님 대상, 하루 1회
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      let bookingId: string | null = null;
      try { const raw = localStorage.getItem("portalSession"); if (raw) { const s = JSON.parse(raw); if (s?.booking_id) bookingId = s.booking_id; } } catch {}
      if (!bookingId) { const { data: { user } } = await supabase.auth.getUser(); if (user?.user_metadata?.booking_id) bookingId = user.user_metadata.booking_id; }
      let allNotices: any[] = [];
      try { const res = await fetch("/api/portal/notices"); if (res.ok) { const d = await res.json(); allNotices = d.notices || []; } } catch {}
      if (cancelled) return;
      const list = allNotices.filter((n: any) => n.popup).filter((n: any) => n.audience !== "selected" || (Array.isArray(n.target_ids) && bookingId && n.target_ids.includes(bookingId)));
      // 영구 dismiss된 공지 제외
      let dismissed: string[] = [];
      try { dismissed = JSON.parse(localStorage.getItem("notice_popup_dismissed") || "[]"); } catch {}
      const visible = list.filter((n: any) => !dismissed.includes(n.id));
      const top = visible[0];
      if (!top) return;
      const seen = localStorage.getItem("notice_popup_seen");
      const todayKey = top.id + "|" + new Date().toISOString().slice(0, 10);
      if (seen === todayKey) return;
      setPopupNotice(top);
    })();
    return () => { cancelled = true; };
  }, []);

  // 안읽은 공지 수 → 공지 카드 빨간 배지
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      let bookingId: string | null = null;
      try { const raw = localStorage.getItem("portalSession"); if (raw) { const s = JSON.parse(raw); if (s?.booking_id) bookingId = s.booking_id; } } catch {}
      if (!bookingId) { const { data: { user } } = await supabase.auth.getUser(); if (user?.user_metadata?.booking_id) bookingId = user.user_metadata.booking_id; }
      let allNotices2: any[] = [];
      try { const res = await fetch("/api/portal/notices"); if (res.ok) { const d = await res.json(); allNotices2 = d.notices || []; } } catch {}
      if (cancelled) return;
      const list = allNotices2.filter((n: any) => n.audience !== "selected" || (Array.isArray(n.target_ids) && bookingId && n.target_ids.includes(bookingId)));
      let lastSeen = ""; try { lastSeen = localStorage.getItem("notices_last_seen") || ""; } catch {}
      const unread = lastSeen ? list.filter((n: any) => String(n.created_at) > lastSeen).length : list.length;
      setNoticeUnread(unread);
    })();
    return () => { cancelled = true; };
  }, []);

  // 신청 상태 변경 (셔틀/필드트립/튜터/픽드랍 + 화상영어 변경요청) → 카드 빨간 배지
  // 방식: 마지막으로 본 상태 스냅샷(localStorage apps_status_seen)과 비교, 달라진 건수만 카운트
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      let bookingId: string | null = null;
      try { const raw = localStorage.getItem("portalSession"); if (raw) { const s = JSON.parse(raw); if (s?.booking_id) bookingId = s.booking_id; } } catch {}
      const { data: { user } } = await supabase.auth.getUser();
      if (!bookingId && user?.user_metadata?.booking_id) bookingId = user.user_metadata.booking_id;

      const items: Array<{ key: string; status: string }> = [];
      if (bookingId) {
        try {
          const res = await fetch(`/api/portal/my-applications?booking_id=${bookingId}`);
          if (res.ok) {
            const d = await res.json();
            (["shuttle", "fieldtrip", "tutor", "pickup"] as const).forEach(k =>
              (d[k] || []).forEach((it: any) => items.push({ key: `${k}:${it.id}`, status: String(it.status ?? "") })));
          }
        } catch {}
      }
      let ocItems: Array<{ key: string; status: string }> = [];
      if (user?.id) {
        try {
          const rEn = await fetch(`/api/portal/online-class/enrollments?customer_user_id=${user.id}`);
          if (rEn.ok) { const de = await rEn.json(); if ((de.enrollments || []).length > 0) setOcReady(true); }
        } catch {}
        try {
          const r2 = await fetch(`/api/portal/online-class/change-request?customer_user_id=${user.id}`);
          if (r2.ok) { const dd = await r2.json(); ocItems = (dd.requests || []).map((it: any) => ({ key: `ocreq:${it.id}`, status: String(it.status ?? "") })); }
        } catch {}
      }
      if (cancelled) return;

      const rawSnap = localStorage.getItem("apps_status_seen");
      if (rawSnap === null) {
        // 첫 방문: 현재 상태를 기준점으로 저장, 뱃지 0
        const init: Record<string, string> = {};
        [...items, ...ocItems].forEach(it => { init[it.key] = it.status; });
        try { localStorage.setItem("apps_status_seen", JSON.stringify(init)); } catch {}
        return;
      }
      let snap: Record<string, string> = {};
      try { snap = JSON.parse(rawSnap || "{}"); } catch {}
      const countChanged = (arr: Array<{ key: string; status: string }>) =>
        arr.filter(it => snap[it.key] !== undefined && snap[it.key] !== it.status).length;
      setAppsChanged(countChanged(items));
      setOcChanged(countChanged(ocItems));
      // 새로 만든 신청(스냅샷에 없음)은 본인이 만든 거라 카운트하지 않되, 스냅샷에는 추가
      const merged = { ...snap };
      [...items, ...ocItems].forEach(it => { if (merged[it.key] === undefined) merged[it.key] = it.status; });
      try { localStorage.setItem("apps_status_seen", JSON.stringify(merged)); } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // 식단 새 발행 인앱 뱃지 (구독 없이도 보임): 발행된 식단이 마지막 확인 이후 갱신됐으면 표시
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("meal_menus").select("updated_at").eq("published", true).order("updated_at", { ascending: false }).limit(30);
      if (cancelled || !data || data.length === 0) return;
      let seen = "";
      try { seen = localStorage.getItem("meal_seen") || ""; } catch {}
      if (!seen) { try { localStorage.setItem("meal_seen", data[0].updated_at); } catch {}; return; } // 첫 방문: 기준점만
      setMealNew(data.filter((m: { updated_at: string }) => m.updated_at > seen).length);
    })();
    return () => { cancelled = true; };
  }, []);

  // 앱 아이콘 배지 = 공지 + 상태변경 + 식단 합산 (지원 기기에서만)
  useEffect(() => {
    try {
      const total = noticeUnread + appsChanged + ocChanged + mealNew;
      const navAny = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
      if (navAny.setAppBadge) { if (total > 0) navAny.setAppBadge(total); else navAny.clearAppBadge?.(); }
    } catch {}
  }, [noticeUnread, appsChanged, ocChanged, mealNew]);

  // 체류 기간에 휴무일이 끼면 미리 안내 팝업 (하루 1회)
  useEffect(() => {
    if (typeof window === "undefined" || !bookingInfo) return;
    const isCombo = bookingInfo.seg1_type && bookingInfo.seg2_type;
    const ci = (isCombo ? bookingInfo.seg1_checkin : (bookingInfo.check_in || bookingInfo.checkin_date || "")).slice(0, 10);
    const co = (isCombo ? bookingInfo.seg2_checkout : (bookingInfo.check_out || bookingInfo.checkout_date || "")).slice(0, 10);
    if (!ci || !co) return;
    let cancelled = false;
    import("@/lib/holidays").then(async m => {
      const list = await m.fetchDeployedHolidays(supabase);
      const hits = m.holidaysInRange(list, ci, co);
      if (cancelled || hits.length === 0) return;
      const key = "stay_holiday_seen";
      const todayKey = hits.map(h => h.date).join("|") + "|" + new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(key) === todayKey) return;
      localStorage.setItem(key, todayKey);
      setStayHolidays(hits);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [bookingInfo]);

  function dismissPopup(mode: "today" | "forever" | "close") {
    if (popupNotice && typeof window !== "undefined") {
      if (mode === "today") {
        localStorage.setItem("notice_popup_seen", popupNotice.id + "|" + new Date().toISOString().slice(0, 10));
      } else if (mode === "forever") {
        try {
          const raw = localStorage.getItem("notice_popup_dismissed") || "[]";
          const arr: string[] = JSON.parse(raw);
          if (!arr.includes(popupNotice.id)) arr.push(popupNotice.id);
          localStorage.setItem("notice_popup_dismissed", JSON.stringify(arr));
        } catch { localStorage.setItem("notice_popup_dismissed", JSON.stringify([popupNotice.id])); }
      }
    }
    setPopupNotice(null);
  }

  async function logout() {
    if (typeof window !== "undefined") localStorage.removeItem("portalSession");
    await supabase.auth.signOut();
    router.replace("/portal");
  }

  if (!session && !authUser) return null;

  // 예약별 앱 메뉴 권한 (카테고리 기본값 + 어드민 오버라이드). 예약 없으면 null
  const feats = bookingInfo ? resolvePortalFeatures(bookingInfo) : null;
  // 화상영어 전용 계정: 예약 연결 없음 + 화상영어 수강권만 있는 손님 → 화상영어·공지만 표시
  const ocOnly = !bookingInfo && !session && ocReady;
  const allCards = [
    { icon: "📋", title: "내 예약현황", desc: "예약·학생·결제 정보 확인", ready: true, href: "/portal/my-booking" },
    { icon: "📢", title: "공지사항", desc: "안내·공지 확인", ready: true, href: "/portal/notices" },
    { icon: "🏨", title: "체크인 정보입력", desc: "입실 전 필요한 정보 사전 등록", subDesc: "항공권 · 체크인 · 픽드랍신청", ready: feats ? feats.checkin : true, href: "/portal/checkin-detail" },
    { icon: "🚌", title: "투어 셔틀 신청", desc: "드림하우스/제이파크/큐브나인", ready: feats ? feats.shuttle : true, href: "/portal/shuttle" },
    { icon: "🎓", title: "애프터스쿨/필드트립", desc: "방과후 활동 및 현장학습", ready: feats ? feats.afterschool : true, href: "/after-school-fieldtrip" },
    { icon: "👩‍🏫", title: "튜터 수업 신청", desc: "방문 튜터 수업 새 신청", ready: feats ? feats.tutor : true, href: "/portal/tutor" },
    { icon: "✏️", title: "튜터 수업 변경요청", desc: "신청한 수업 취소·시간·날짜 변경", ready: feats ? feats.tutor : true, href: "/portal/tutor-change" },
    { icon: "💻", title: "화상영어", desc: ocReady ? "온라인 영어 수업" : "온라인 영어 수업 · 신청하기", ready: true, href: "/portal/online-class" },
    { icon: "🧾", title: "정산내역" + (bookingInfo?.settlement_open ? " (베타)" : ""), desc: "보증금·튜터비·추가비용 정산 내역", ready: !!bookingInfo?.settlement_open, href: "/portal/settlement" },
    { icon: "🍽", title: "식단", desc: "학생 점심(아카데미) · 드림하우스(올인원) 식단표", ready: feats ? feats.meal : true, href: "/portal/meal-menu" },
    { icon: "📑", title: "내 신청 내역", desc: "셔틀/튜터/픽드랍 등 전체 신청 확인", ready: true, href: "/portal/my-applications" },
    { icon: "🗓", title: "상담 예약", desc: "학습 상담 일정 확인 및 예약", ready: feats ? feats.consultation : true, href: "/portal/consultation" },
  ];
  const cards = ocOnly ? allCards.filter(c => c.title === "화상영어" || c.title === "공지사항") : allCards;

  const memberCards = authUser ? cards : cards;

  // 우선순위: portalSession.booker_name/name → session.guest_name → bookingInfo.booker_name/name → profile → email prefix
  const sessAny = session as unknown as Record<string, string | undefined> | null;
  const displayName =
    sessAny?.booker_name ||
    sessAny?.name ||
    session?.guest_name ||
    bookingInfo?.booker_name ||
    bookingInfo?.name ||
    profile?.name ||
    profile?.full_name ||
    authUser?.email?.split('@')[0];

  const adminView = !!(session as unknown as { admin_view?: boolean } | null)?.admin_view;
  return (<>
    {adminView && (
      <div style={{ position: "sticky", top: 0, zIndex: 999, background: "#7c3aed", color: "#fff", padding: "9px 16px", display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, fontFamily: "'Noto Sans KR',sans-serif" }}>
        👀 관리자 미리보기 — {(session as unknown as { guest_name?: string } | null)?.guest_name}님이 보는 화면과 동일합니다 (엄마에게는 아무 표시 안 됨)
        <button onClick={() => { localStorage.removeItem("portalSession"); window.close(); setTimeout(() => { window.location.href = "/admin/bookings"; }, 300); }} style={{ marginLeft: "auto", background: "#fff", color: "#7c3aed", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>미리보기 종료</button>
      </div>
    )}
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.db-w{max-width:640px;margin:0 auto;padding:32px 24px;min-height:100vh}
.db-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px}
.db-logo{font-family:'Montserrat',sans-serif;font-size:18px;font-weight:900;color:#1a6fc4}
.db-logout{padding:8px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:#6b7c93;transition:all 150ms}.db-logout:hover{background:#fef2f2;color:#dc2626;border-color:#fecaca}
.db-welcome{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:20px;padding:28px 24px;color:#fff;margin-bottom:24px}
.db-welcome h1{font-size:22px;font-weight:800;margin-bottom:14px}
.db-info{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.db-item{padding:14px;background:rgba(255,255,255,0.15);border-radius:12px;backdrop-filter:blur(4px)}
.db-item .lbl{font-size:11px;opacity:0.8;margin-bottom:3px}
.db-item .val{font-size:16px;font-weight:700}
.db-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.db-card{background:#fff;border-radius:16px;padding:24px 20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);cursor:default;transition:all 180ms;border:2px solid transparent;position:relative}
.db-card:hover{border-color:#e2e8f0;transform:translateY(-2px)}
.db-card .icon{font-size:32px;margin-bottom:10px}
.db-card h3{font-size:15px;font-weight:700;margin-bottom:4px}
.db-card p{font-size:12px;color:#6b7c93;line-height:1.5}
.db-card .coming{position:absolute;top:10px;right:10px;padding:2px 8px;background:#fef3c7;color:#92400e;border-radius:6px;font-size:10px;font-weight:700}
.db-card .db-badge{position:absolute;top:10px;right:10px;min-width:22px;height:22px;padding:0 6px;background:#ef4444;color:#fff;border-radius:999px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 5px rgba(239,68,68,0.5)}
.db-footer{text-align:center;margin-top:32px;font-size:12px;color:#94a3b8}
.db-footer a{color:#1a6fc4;text-decoration:none;font-weight:600}
@media(max-width:500px){.db-w{padding:24px 16px}.db-info{grid-template-columns:1fr}.db-grid{grid-template-columns:1fr}}
    `}</style>
    <div className="db-w">
      <div className="db-head">
        <div className="db-logo">DREAM ACADEMY</div>
        <button className="db-logout" onClick={logout}>로그아웃</button>
      </div>

      <div className="db-welcome">
        <h1>안녕하세요, {displayName}님!</h1>
        {bookingInfo ? (
          <>
            {(() => {
              const combo = bookingInfo.seg1_type && bookingInfo.seg2_type;
              const ciVal = combo ? (bookingInfo.seg1_checkin || bookingInfo.check_in || bookingInfo.checkin_date || '-') : (bookingInfo.check_in || bookingInfo.checkin_date || bookingInfo.academy_start || '-');
              const coVal = combo ? (bookingInfo.seg2_checkout || bookingInfo.check_out || bookingInfo.checkout_date || '-') : (bookingInfo.check_out || bookingInfo.checkout_date || bookingInfo.academy_end || '-');
              return (
                <div style={{display:'flex', gap:8, marginBottom:8}}>
                  <div style={{flex:1, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'10px 14px'}}>
                    <div style={{fontSize:11, opacity:0.8, marginBottom:2}}>체크인</div>
                    <div style={{fontWeight:700, fontSize:14}}>{ciVal}</div>
                  </div>
                  <div style={{flex:1, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'10px 14px'}}>
                    <div style={{fontSize:11, opacity:0.8, marginBottom:2}}>체크아웃</div>
                    <div style={{fontWeight:700, fontSize:14}}>{coVal}</div>
                  </div>
                </div>
              );
            })()}
            {(() => {
              const students = Array.isArray(bookingInfo.students)
                ? bookingInfo.students
                : (typeof bookingInfo.students === 'string'
                    ? (() => { try { return JSON.parse(bookingInfo.students || '[]'); } catch { return []; } })()
                    : []);
              const names = students.map((s: any) => s.name_kr || s.korName || s.name_en || s.engName || s.name).filter(Boolean);
              return names.length > 0 ? (
                <div style={{background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'10px 14px', marginBottom:8}}>
                  <div style={{fontSize:11, opacity:0.8, marginBottom:2}}>👧 학생</div>
                  <div style={{fontWeight:600, fontSize:13}}>{names.join(' · ')}</div>
                </div>
              ) : null;
            })()}
            {bookingInfo.accom_type && (
              <div style={{background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'10px 14px'}}>
                <div style={{fontSize:11, opacity:0.8, marginBottom:2}}>🏠 숙소</div>
                <div style={{fontWeight:600, fontSize:13}}>{bookingInfo.accom_type}</div>
              </div>
            )}
          </>
        ) : (
          authUser?.email && !authUser.email.includes('@dreamacademyph.com') ? (
            <div style={{background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'10px 14px'}}>
              <div style={{fontSize:11, opacity:0.8, marginBottom:2}}>이메일</div>
              <div style={{fontWeight:600, fontSize:13}}>{authUser.email}</div>
            </div>
          ) : null
        )}
      </div>

      {/* 체류 기간 휴무일 사전 안내 팝업 */}
      {stayHolidays && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setStayHolidays(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 22px", maxWidth: 420, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>📢 주요 안내 — 휴무일</div>
            <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, marginBottom: 8 }}>체류 기간 중 아래 휴무일이 있어요.</div>
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "10px 13px", fontSize: 13.5, fontWeight: 700, color: "#b45309", marginBottom: 10 }}>
              {stayHolidays.map(h => { const d = new Date(h.date + "T00:00:00"); return `${d.getMonth() + 1}/${d.getDate()}(${["일","월","화","수","목","금","토"][d.getDay()]}) ${h.name}`; }).join(", ")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
              {[
                { icon: "✕", text: "수업 · 헬퍼 · 셔틀 · 관리실 운영하지 않아요", bg: "#fef2f2", color: "#b91c1c", ic: "#dc2626" },
                { icon: "✓", text: "식사는 정상 제공됩니다", bg: "#ecfdf5", color: "#065f46", ic: "#059669" },
                { icon: "!", text: "휴무일에 대한 별도 환불 · 보강은 없습니다", bg: "#fffbeb", color: "#92400e", ic: "#b45309" },
              ].map(l => (
                <div key={l.icon} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: l.bg, borderRadius: 8, padding: "9px 11px" }}>
                  <span style={{ fontWeight: 800, color: l.ic }}>{l.icon}</span>
                  <span style={{ fontSize: 13, color: l.color, fontWeight: 600 }}>{l.text}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setStayHolidays(null)}
              style={{ width: "100%", padding: 13, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              확인했어요
            </button>
          </div>
        </div>
      )}

      {/* 잔금 D-7 자동 안내 */}
      {!dismissBalance && (() => {
        const bd = (bookingInfo?.balance_date || "").slice(0, 10);
        const paidStatuses = ["영수증발행", "결제완료", "완료"];
        if (!bd || paidStatuses.includes(bookingInfo?.status || "")) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const t = new Date(bd + "T00:00:00");
        const dday = Math.round((t.getTime() - today.getTime()) / 86400000);
        if (dday < 0 || dday > 7) return null;
        return (
          <div style={{ position: "relative", marginBottom: 16 }}>
            <a href="/portal/payment" style={{ display: "block", textDecoration: "none" }}>
              <div style={{ background: "linear-gradient(135deg,#fef3c7,#fde68a)", border: "2px solid #f59e0b", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                <div style={{ fontSize: 32 }}>💰</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#92400e", marginBottom: 3 }}>잔금 납부일 {dday === 0 ? "오늘" : `D-${dday}`} ({bd})</div>
                  <div style={{ fontSize: 12, color: "#a16207" }}>결제 안내를 확인해주세요 →</div>
                </div>
              </div>
            </a>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); localStorage.setItem("dismiss_balance", new Date().toISOString().slice(0,10)); setDismissBalance(true); }}
              style={{ position: "absolute", top: 6, right: 8, background: "rgba(255,255,255,0.7)", border: "none", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#92400e", cursor: "pointer" }}>
              오늘 그만보기
            </button>
          </div>
        );
      })()}

      {/* 학생 영문이름 미입력 안내 */}
      {!dismissEngName && dashStudents.some((s: any) => !(s.name_en || "").trim()) && (
        <div style={{ position: "relative", marginBottom: 16 }}>
          <a href="/portal/my-booking" style={{ display: "block", textDecoration: "none" }}>
            <div style={{ background: "linear-gradient(135deg,#fee2e2,#fecaca)", border: "2px solid #f87171", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
              <div style={{ fontSize: 32 }}>✏️</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#b91c1c", marginBottom: 3 }}>학생 영문 혹은 사용하는 영어 이름을 기재해주세요!</div>
                <div style={{ fontSize: 12, color: "#dc2626" }}>내 예약현황에서 바로 입력할 수 있어요 →</div>
              </div>
            </div>
          </a>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); localStorage.setItem("dismiss_engname", new Date().toISOString().slice(0,10)); setDismissEngName(true); }}
            style={{ position: "absolute", top: 6, right: 8, background: "rgba(255,255,255,0.7)", border: "none", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#b91c1c", cursor: "pointer" }}>
            오늘 그만보기
          </button>
        </div>
      )}

      {hasConfirmedTutor && (
        <a href="/portal/my-applications" style={{display:"block",textDecoration:"none",marginBottom:16}}
          onClick={() => {
            // 확인했으면 이 확정 건들은 다시 안 띄움
            try {
              const seen: string[] = JSON.parse(localStorage.getItem('tutor_confirm_seen') || '[]');
              localStorage.setItem('tutor_confirm_seen', JSON.stringify(Array.from(new Set([...seen, ...confirmedTutorIds]))));
            } catch {}
          }}>
          <div style={{
            background:"linear-gradient(135deg,#dcfce7,#bbf7d0)",
            border:"2px solid #86efac",
            borderRadius:16,
            padding:"16px 20px",
            display:"flex",
            alignItems:"center",
            gap:14,
            cursor:"pointer",
          }}>
            <div style={{fontSize:32}}>📋</div>
            <div>
              <div style={{fontSize:14,fontWeight:800,color:"#15803d",marginBottom:3}}>
                튜터 수업이 확정되었습니다!
              </div>
              <div style={{fontSize:12,color:"#166534"}}>
                내 신청 내역에서 확정된 수업·인보이스를 확인하세요 →
              </div>
            </div>
          </div>
        </a>
      )}

      {hasNewNotes && !dismissNewNotes && (
        <div style={{ position: "relative", marginBottom: 16 }}>
          <a href="/portal/tutor" style={{display:"block",textDecoration:"none"}}>
            <div style={{
              background:"linear-gradient(135deg,#fee2e2,#fecaca)",
              border:"2px solid #fca5a5",
              borderRadius:16,
              padding:"16px 20px",
              display:"flex",
              alignItems:"center",
              gap:14,
              cursor:"pointer",
            }}>
              <div style={{fontSize:32}}>📝</div>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:"#b91c1c",marginBottom:3}}>
                  새 데일리 노트가 도착했습니다!
                </div>
                <div style={{fontSize:12,color:"#991b1b"}}>
                  튜터 수업 노트를 확인하세요 →
                </div>
              </div>
            </div>
          </a>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); localStorage.setItem("dismiss_newnotes", new Date().toISOString().slice(0,10)); setDismissNewNotes(true); }}
            style={{ position: "absolute", top: 6, right: 8, background: "rgba(255,255,255,0.7)", border: "none", borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "#b91c1c", cursor: "pointer" }}>
            오늘 그만보기
          </button>
        </div>
      )}

      <PortalPushButton />

      <div className="db-grid">
        {(authUser ? memberCards : cards).map((c, i) => (
          <div key={i} className="db-card" style={{ cursor: "pointer" }}
            onClick={() => {
              if (c.ready === false) { alert('곧 오픈 예정입니다 😊'); return; }
              if (c.href) router.push(c.href);
            }}>
            {!c.ready && <span className="coming">준비 중</span>}
            {c.title === "공지사항" && noticeUnread > 0 && (
              <span className="db-badge">{noticeUnread > 99 ? "99+" : noticeUnread}</span>
            )}
            {c.title === "내 신청 내역" && appsChanged > 0 && (
              <span className="db-badge">{appsChanged > 99 ? "99+" : appsChanged}</span>
            )}
            {c.title === "화상영어" && ocChanged > 0 && (
              <span className="db-badge">{ocChanged > 99 ? "99+" : ocChanged}</span>
            )}
            {c.title === "식단" && mealNew > 0 && (
              <span className="db-badge">{mealNew > 99 ? "99+" : mealNew}</span>
            )}
            <div className="icon">{c.icon}</div>
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
            {(c as { subDesc?: string }).subDesc && (
              <p style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 4, fontWeight: 600 }}>{(c as { subDesc: string }).subDesc}</p>
            )}
          </div>
        ))}
      </div>

      {shuttleApps.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, marginTop: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#1a1a2e", marginBottom: 12 }}>🚌 셔틀 신청 내역 ({shuttleApps.length}건)</h3>
          {shuttleApps.map(s => {
            const meta = s.status === "confirmed"
              ? { label: "확정", bg: "#dcfce7", color: "#166534" }
              : s.status === "cancelled"
              ? { label: "취소", bg: "#fef2f2", color: "#dc2626" }
              : { label: "대기중", bg: "#fef3c7", color: "#92400e" };
            return (
              <div key={s.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 8, background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{s.tour_name}</div>
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.color }}>{meta.label}</span>
                </div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                  <span style={{ marginRight: 12 }}>📅 {s.date}</span>
                  <span>👥 {s.num_people}명</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="db-footer">
        <p>문의사항이 있으시면 카카오톡 또는 이메일로 연락주세요.</p>
        <p style={{ marginTop: 4 }}><a href="/">드림아카데미 홈</a></p>
      </div>
    </div>
    {popupNotice && (
      <div onClick={() => dismissPopup("today")} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 18 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, maxWidth: 440, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: popupNotice.category === "important" ? "#fceaeb" : "#eff6ff", color: popupNotice.category === "important" ? "#a32d2d" : "#1a6fc4" }}>{popupNotice.category === "important" ? "중요" : "공지"}</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{(popupNotice.created_at || "").slice(0, 10).replace(/-/g, ".")}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{popupNotice.title}</div>
          <div style={{ fontSize: 14, lineHeight: 1.8, color: "#374151", whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto" }}>{popupNotice.content}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
            <button onClick={() => { dismissPopup("close"); router.push("/portal/notices"); }} style={{ width: "100%", padding: 12, border: "none", borderRadius: 8, background: "#1a6fc4", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>전체 공지 보기</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => dismissPopup("today")} style={{ flex: 1, padding: 10, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#6b7c93", fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>오늘 그만보기</button>
              <button onClick={() => dismissPopup("forever")} style={{ flex: 1, padding: 10, border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", color: "#94a3b8", fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>다시 보지 않기</button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>);
}
