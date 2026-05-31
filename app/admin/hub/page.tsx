"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed, getAdminInfo, clearAdminAuth } from "@/lib/adminAuth";

export default function AdminHubPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [staffId, setStaffId] = useState("");

  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    const info = getAdminInfo();
    if (info) { setName(info.name); setRole(info.role); setStaffId(info.staffId); }
    setReady(true);
  }, [router]);

  function logout() { clearAdminAuth(); router.push("/login"); }

  if (!ready) return null;

  const staffHref = staffId ? `/staff?user=${staffId.replace(/^admin-/, '')}` : '/staff';

  // 우선순위 순 카드 배열
  const cards = [
    { icon: "📋", title: "예약 관리",       desc: "부킹 접수 · 인보이스 · 영수증",     href: "/admin/bookings",        primary: true },
    { icon: "⚙️", title: "사이트 관리",     desc: "공지사항 · 필드트립 · 회원",         href: "/admin/site" },
    { icon: "👥", title: "직원업무",         desc: "팀 업무 · 일정 · 프로젝트",          href: staffHref },
    { icon: "🏠", title: "드림하우스",       desc: "룸 예약현황 · 충돌감지",             href: "/dreamhouse-rooms" },
    { icon: "📝", title: "체크인 디테일",    desc: "자동생성 · PDF 출력",               href: "/admin/checkin-details" },
    { icon: "🏠", title: "하우스 보고",      desc: "호실 점검 · 조치 현황",              href: "/admin/house-reports" },
    { icon: "🚐", title: "셔틀·기사 관리",   desc: "셔틀 · 기사 · 스케줄 통합",           href: "/admin/shuttle-management" },
    { icon: "🚌", title: "투어셔틀 관리",     desc: "셔틀 신청 목록 및 상태 관리",           href: "/admin/tour-shuttle" },
    { icon: "🛬", title: "픽드랍 관리",     desc: "픽업 · 드랍 일정 · 기사 배정",       href: "/admin/pickups" },
    { icon: "🎓", title: "튜터 수업 관리",   desc: "신청 수신함 · 주간 스케줄 · 수강생",      href: "/admin/tutor-class" },
    { icon: "📋", title: "SSP 관리",        desc: "신청현황 · 발급추적",                href: "/admin/ssp" },
    { icon: "🛒", title: "민에듀 공구",      desc: "신청 접수 · 상담 진행 · 완료",         href: "/admin/minedu" },
    { icon: "🔗", title: "페이지 관리",       desc: "공개 URL 목록 · 링크 모음",            href: "/admin/pages" },
    { icon: "📂", title: "자료모음",          desc: "필드트립·애프터스쿨·OT 안내문 편집 및 출력",  href: "/admin/resources" },
    { icon: "💻", title: "화상영어",         desc: "출석관리 · 수업일정 · 가용현황",      href: "/admin/online-class" },
    { icon: "🌐", title: "Local Staff Hub",  desc: "현지직원 · 튜터 전용 페이지",            href: "/admineng/hub" },
  ];

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.hub-w{max-width:820px;margin:0 auto;padding:28px 20px;}
.hub-h{text-align:center;margin-bottom:20px;}
.hub-h h1{font-size:22px;font-weight:800;margin-bottom:4px;}
.hub-h p{font-size:13px;color:#6b7c93;}
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
      <div className="hub-grid">
        {cards.map((c, i) => (
          <div key={i} className={`hub-card ${c.primary ? "card-blue" : "card-gray"}`} onClick={() => (c as any).external ? window.open(c.href, '_blank') : router.push(c.href)}>
            <div className="ic">{c.icon}</div>
            <div className="tx">
              <h2>{c.title}</h2>
              <p>{c.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="hub-footer">
        <a className="hub-link" href="/guide">직원 가이드</a>
        <a className="hub-link" href="/">홈으로</a>
        <a href="/ashuttle" style={{display:"inline-block",padding:"10px 16px",background:"#2563eb",color:"#fff",borderRadius:8,textDecoration:"none",fontWeight:600}}>🚐 Shuttle Schedule</a>
      </div>
      <button className="logout" onClick={logout}>로그아웃</button>
    </div>
  </>);
}
