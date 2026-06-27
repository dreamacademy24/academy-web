"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed, getAdminInfo, clearAdminAuth } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export default function AdminHubPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [staffId, setStaffId] = useState("");
  const [tutorAlerts, setTutorAlerts] = useState(0);
  const [roomAlerts, setRoomAlerts] = useState(0);

  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    const info = getAdminInfo();
    if (info) { setName(info.name); setRole(info.role); setStaffId(info.staffId); }
    setReady(true);
  }, [router]);

  // 튜터 처리 필요 건(신규/변경/취소요청) → 빨간 느낌표
  useEffect(() => {
    (async () => {
      try {
        const { count } = await supabase.from("tutor_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "reviewing", "cancel_requested"]);
        let cancelN = 0;
        try {
          const r = await fetch("/api/admin/tutor/cancel-requests?status=pending");
          if (r.ok) { const d = await r.json(); cancelN = Array.isArray(d) ? d.length : 0; }
        } catch {}
        setTutorAlerts((count || 0) + cancelN);
      } catch {}
    })();
  }, []);

  // 드림하우스 룸 미배정(오버부킹 위험) 건수 → 예약 관리 카드 ❗
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("bookings").select("accom_type,house_no,accom_room,status,checkout_date");
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const n = (data || []).filter((b: any) => (b.accom_type || "").includes("드림하우스") && !String(b.house_no || b.accom_room || "").trim() && !(b.status || "").includes("취소") && (!b.checkout_date || String(b.checkout_date).slice(0, 10) >= today)).length;
        setRoomAlerts(n);
      } catch {}
    })();
  }, []);

  function logout() { clearAdminAuth(); router.push("/login"); }

  if (!ready) return null;

  const staffHref = staffId ? `/staff?user=${staffId.replace(/^admin-/, '')}` : '/staff';

  // 카테고리 그룹 (카드 속성은 변경 없이 순서/그룹핑만)
  const groups = [
    {
      title: "드림아카데미",
      cards: [
        { icon: "📅", title: "오늘 한눈에",     desc: "오늘 체크인·픽드랍·셔틀·필드트립",   href: "/admin/today",           primary: true },
        { icon: "📋", title: "예약 관리",       desc: "부킹 접수 · 인보이스 · 영수증",     href: "/admin/bookings",        primary: true },
        { icon: "🗂️", title: "과거 예약",       desc: "졸업·체크아웃 완료 (지난 예약 모음)",  href: "/admin/bookings?tab=confirmed&period=past" },
        { icon: "🎒", title: "애프터스쿨/필드트립 관리", desc: "신청목록 및 일정 배포 (아카데미 담당)",  href: "/admin/afterschool-fieldtrip" },
        { icon: "🎓", title: "튜터 수업 관리",   desc: "신청 수신함 · 주간 스케줄 · 수강생",      href: "/admin/tutor-class" },
        { icon: "🧾", title: "정산 관리",        desc: "보증금·튜터비·차감·납부 기록 및 승인",   href: "/admin/settlement" },
        { icon: "💻", title: "화상영어",         desc: "출석관리 · 수업일정 · 가용현황",      href: "/admin/online-class" },
        { icon: "📋", title: "SSP 관리",        desc: "신청현황 · 발급추적",                href: "/admin/ssp" },
        { icon: "📢", title: "공지 배포",       desc: "손님 공지 작성 · 전체/특정 발송",       href: "/admin/notices" },
        { icon: "🗓", title: "상담 예약",       desc: "학습 상담 일정 생성 · 배포 · 현황",      href: "/admin/consultations" },
        { icon: "🗄", title: "지난 내역 보관함", desc: "지난 신청 조회 · 오래된 내역 일괄 삭제",  href: "/admin/archive" },
      ],
    },
    {
      title: "드림하우스",
      cards: [
        { icon: "🏠", title: "드림하우스",       desc: "룸 예약현황 · 충돌감지",             href: "/dreamhouse-rooms" },
        { icon: "🍽", title: "식단 관련 업무",    desc: "식단 배포(엄마용) · 식당 인폼(직원 체크리스트·라벨)",  href: "/admin/meal-plan" },
        { icon: "🏠", title: "하우스 보고",      desc: "호실 점검 · 조치 현황",              href: "/admin/house-reports" },
        { icon: "🚌", title: "투어셔틀 관리",     desc: "셔틀 신청 및 일정 배포 (드림하우스 담당)",  href: "/admin/tour-shuttle" },
        { icon: "🚐", title: "셔틀·기사 관리",   desc: "셔틀 · 기사 · 스케줄 통합",           href: "/admin/shuttle-management", coming: true },
        { icon: "📝", title: "체크인 디테일",    desc: "자동생성 · PDF 출력",               href: "/admin/checkin-details" },
        { icon: "💰", title: "시재 관리",        desc: "보증금 · 지출 · 영수증 기록",        href: "/admin/cash-ledger" },
      ],
    },
    {
      title: "직원업무",
      cards: [
        { icon: "👥", title: "직원업무",         desc: "팀 업무 · 일정 · 프로젝트",          href: staffHref },
        { icon: "📖", title: "직원가이드",       desc: "드림아카데미·드림하우스 업무 매뉴얼",     href: "/staff-guide.html" },
        { icon: "🛒", title: "민에듀 공구",      desc: "신청 접수 · 상담 진행 · 완료",         href: "/admin/minedu" },
        { icon: "📂", title: "자료모음",          desc: "필드트립·애프터스쿨·OT 안내문 편집 및 출력",  href: "/admin/resources" },
        { icon: "⚙️", title: "사이트 관리",     desc: "공지사항 · 필드트립 · 회원",         href: "/admin/site" },
        { icon: "📧", title: "이메일",          desc: "admin@dreamacademyph.com 웹메일",  href: "https://privateemail.com/appsuite/", external: true },
      ],
    },
    {
      title: "현지직원",
      cards: [
        { icon: "🚐", title: "Shuttle Schedule", desc: "Pick up · Drop off · Daily",            href: "/ashuttle" },
        { icon: "🌐", title: "Local Staff Hub",  desc: "현지직원 · 튜터 전용 페이지",            href: "/admineng/hub" },
      ],
    },
  ];

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.hub-w{max-width:820px;margin:0 auto;padding:28px 20px;}
.hub-h{text-align:center;margin-bottom:20px;}
.hub-h h1{font-size:22px;font-weight:800;margin-bottom:4px;}
.hub-h p{font-size:13px;color:#6b7c93;}
.hub-sec{text-align:left;font-size:14px;font-weight:600;color:#64748b;margin-top:24px;margin-bottom:10px;}
.hub-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;}
.hub-card{border-radius:12px;padding:14px 16px;cursor:pointer;border:2px solid transparent;transition:all 180ms;display:flex;align-items:center;gap:12px;}
.hub-card:hover{transform:translateY(-2px);}
.hub-card .ic{font-size:26px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;flex-shrink:0;background:rgba(255,255,255,0.15);}
.hub-card .tx{flex:1;min-width:0;}
.hub-card h2{font-size:14px;font-weight:800;margin-bottom:2px;line-height:1.2;}
.hub-card p{font-size:11px;line-height:1.4;opacity:0.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.card-blue{background:#1a6fc4;color:#fff;box-shadow:0 4px 16px rgba(26,111,196,0.22);}
.card-blue:hover{box-shadow:0 8px 28px rgba(26,111,196,0.3);}
.card-gray{background:#fff;color:#1a1a2e;box-shadow:0 2px 12px rgba(0,0,0,0.05);border:1px solid #e2e8f0;}
.card-gray:hover{border-color:#1a6fc4;box-shadow:0 4px 20px rgba(26,111,196,0.1);}
.card-gray .ic{background:#f1f5f9;}
.hub-footer{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;}
.hub-link{color:#6b7c93;font-size:12px;font-weight:600;text-decoration:none;padding:7px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;}.hub-link:hover{color:#1a6fc4;border-color:#1a6fc4;}
.logout{background:none;border:none;color:#94a3b8;font-size:11px;cursor:pointer;margin-top:20px;display:block;text-align:center;width:100%;font-family:'Noto Sans KR',sans-serif;}.logout:hover{color:#dc2626;}
@media(max-width:500px){.hub-grid{grid-template-columns:1fr;}.hub-w{padding:20px 14px;}}
    `}</style>
    <div className="hub-w">
      <div className="hub-h">
        <h1>관리자 홈</h1>
        <p>안녕하세요, {name}님{role === 'admin' ? ' (관리자)' : ' (스태프)'}</p>
      </div>
      {groups.map((g, gi) => (
        <div key={gi}>
          <div className="hub-sec">{g.title}</div>
          <div className="hub-grid">
            {g.cards.map((c, i) => (
              <div key={i} className={`hub-card ${(c as any).primary ? "card-blue" : "card-gray"}`} style={(c as any).coming ? { opacity: 0.55, position: "relative" } : { position: "relative" }} onClick={() => { if ((c as any).coming) { alert("준비 중입니다 😊"); return; } if ((c as any).external) { window.open(c.href, '_blank'); } else if (c.href.endsWith('.html')) { window.location.href = c.href; } else { router.push(c.href); } }}>
                {(c as any).coming && <span style={{ position: "absolute", top: 8, right: 10, fontSize: 10, fontWeight: 700, color: "#fff", background: "#94a3b8", padding: "2px 8px", borderRadius: 6 }}>준비 중</span>}
                {c.href === "/admin/tutor-class" && tutorAlerts > 0 && <span title="처리 필요(신규/변경/취소요청)" style={{ position: "absolute", top: 8, right: 10, minWidth: 20, height: 20, padding: "0 6px", fontSize: 11, fontWeight: 800, color: "#fff", background: "#dc2626", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(220,38,38,0.4)" }}>❗{tutorAlerts}</span>}
                {c.href === "/admin/bookings" && roomAlerts > 0 && <span title="드림하우스 룸 미배정 — 오버부킹 주의" style={{ position: "absolute", top: 8, right: 10, minWidth: 20, height: 20, padding: "0 6px", fontSize: 11, fontWeight: 800, color: "#fff", background: "#dc2626", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(220,38,38,0.4)" }}>❗{roomAlerts}</span>}
                <div className="ic">{c.icon}</div>
                <div className="tx">
                  <h2>{c.title}</h2>
                  <p title={c.desc}>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="hub-footer">
        <a className="hub-link" href="/guide">직원 가이드</a>
        <a className="hub-link" href="/">홈으로</a>
      </div>
      <button className="logout" onClick={logout}>로그아웃</button>
    </div>
  </>);
}
