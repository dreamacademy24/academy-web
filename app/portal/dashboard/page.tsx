"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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
  const [authUser, setAuthUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function init() {
      if (typeof window === "undefined") return;
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

  async function logout() {
    if (typeof window !== "undefined") localStorage.removeItem("portalSession");
    await supabase.auth.signOut();
    router.replace("/portal");
  }

  if (!session && !authUser) return null;

  const cards = [
    { icon: "📋", title: "내 예약 정보", desc: "숙소, 기간, 인원 확인", ready: true, href: "/portal/my-booking" },
    { icon: "✈️", title: "항공편 등록", desc: "입출국 항공편 정보 입력", ready: true, href: "/portal/flight" },
    { icon: "💳", title: "결제 안내", desc: "결제 상태, 잔금 확인", ready: true, href: "/portal/payment" },
    { icon: "🚐", title: "셔틀 신청", desc: "SM/Ayala/IT Park 셔틀", ready: true, href: "/portal/shuttle" },
    { icon: "🛬", title: "추가 픽드랍", desc: "공항/외부 픽업 신청", ready: true, href: "/portal/pickup" },
    { icon: "👩‍🏫", title: "튜터 수업", desc: "원어민 1:1 수업 신청", ready: true, href: "/portal/tutor" },
  ];

  const memberCards = authUser ? [
    { icon: "📋", title: "내 예약 현황", desc: "예약 상태 및 상세 확인", ready: true, href: "/portal/my-booking" },
    { icon: "📝", title: "내 신청 내역", desc: "셔틀/픽업/튜터 신청 확인", ready: true, href: "/portal/my-requests" },
    { icon: "✈️", title: "항공편 등록", desc: "입출국 항공편 정보 입력", ready: true, href: "/portal/flight" },
    { icon: "🚐", title: "투어 셔틀 신청", desc: "드림하우스/제이파크/큐브나인", ready: true, href: "/shuttle" },
    { icon: "🎓", title: "애프터스쿨/필드트립", desc: "방과후 활동 및 현장학습", ready: true, href: "/after-school-fieldtrip" },
    { icon: "🛬", title: "추가 픽드랍", desc: "공항/외부 픽업 신청", ready: true, href: "/portal/pickup" },
    { icon: "👩‍🏫", title: "튜터 수업", desc: "화상영어 스케줄 & 남은 회차", ready: true, href: "/portal/online-class" },
    { icon: "💳", title: "결제 안내", desc: "결제 상태, 잔금 확인", ready: true, href: "/portal/payment" },
  ] : cards;

  const displayName = session ? session.guest_name : (profile?.name || profile?.full_name || authUser?.email?.split('@')[0]);

  return (<>
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
        {session ? (
          <div className="db-info">
            <div className="db-item"><div className="lbl">예약번호</div><div className="val">{session.booking_number}</div></div>
            <div className="db-item"><div className="lbl">체크인</div><div className="val">{session.check_in_date || "미정"}</div></div>
          </div>
        ) : (
          <div className="db-info">
            <div className="db-item"><div className="lbl">이메일</div><div className="val" style={{fontSize:13}}>{authUser?.email}</div></div>
            <div className="db-item"><div className="lbl">회원 포털</div><div className="val">내 신청 관리</div></div>
          </div>
        )}
      </div>

      <div className="db-grid">
        {(authUser ? memberCards : cards).map((c, i) => (
          <div key={i} className="db-card" style={c.ready ? { cursor: "pointer" } : {}}
            onClick={() => { if (c.ready && c.href) router.push(c.href); }}>
            {!c.ready && <span className="coming">준비 중</span>}
            <div className="icon">{c.icon}</div>
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="db-footer">
        <p>문의사항이 있으시면 카카오톡 또는 이메일로 연락주세요.</p>
        <p style={{ marginTop: 4 }}><a href="/">드림아카데미 홈</a></p>
      </div>
    </div>
  </>);
}
