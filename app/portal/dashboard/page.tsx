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
  const [bookingInfo, setBookingInfo] = useState<any>(null);

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

  // portalSession.booking_id로 예약/학생 정보 fetch
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("portalSession");
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      if (s.booking_id) {
        fetch(`/api/bookings/${s.booking_id}`)
          .then(r => r.json())
          .then(d => setBookingInfo(d?.booking || d))
          .catch(() => {});
      }
    } catch {}
  }, []);

  async function logout() {
    if (typeof window !== "undefined") localStorage.removeItem("portalSession");
    await supabase.auth.signOut();
    router.replace("/portal");
  }

  if (!session && !authUser) return null;

  const cards = [
    { icon: "📋", title: "내 예약현황", desc: "예약·학생·결제 정보 확인", ready: true, href: "/portal/my-booking" },
    { icon: "🏨", title: "체크인 정보입력", desc: "입실 전 필요한 정보 사전 등록", ready: true, href: "/portal/checkin-detail" },
    { icon: "✈️", title: "항공편 · 픽드랍", desc: "항공편 등록 및 공항 픽드랍 신청", ready: true, href: "/portal/flight" },
    { icon: "🚌", title: "투어 셔틀 신청", desc: "드림하우스/제이파크/큐브나인", ready: true, href: "/portal/shuttle" },
    { icon: "🎓", title: "애프터스쿨/필드트립", desc: "방과후 활동 및 현장학습", ready: true, href: "/after-school-fieldtrip" },
    { icon: "👩‍🏫", title: "튜터 수업", desc: "방문 튜터 수업 신청", ready: true, href: "/portal/tutor" },
    { icon: "💻", title: "화상영어", desc: "온라인 영어 수업", ready: false, href: "/portal/online-class" },
    { icon: "📑", title: "내 신청 내역", desc: "셔틀/튜터/픽드랍 등 전체 신청 확인", ready: true, href: "/portal/my-requests" },
  ];

  const memberCards = authUser ? cards : cards;

  const displayName = bookingInfo?.booker_name || (session ? session.guest_name : (profile?.name || profile?.full_name || authUser?.email?.split('@')[0]));

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
        {bookingInfo ? (
          <>
            <div style={{display:'flex', gap:8, marginBottom:8}}>
              <div style={{flex:1, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'10px 14px'}}>
                <div style={{fontSize:11, opacity:0.8, marginBottom:2}}>체크인</div>
                <div style={{fontWeight:700, fontSize:14}}>
                  {bookingInfo.check_in || bookingInfo.checkin_date || bookingInfo.academy_start || '-'}
                </div>
              </div>
              <div style={{flex:1, background:'rgba(255,255,255,0.15)', borderRadius:10, padding:'10px 14px'}}>
                <div style={{fontSize:11, opacity:0.8, marginBottom:2}}>체크아웃</div>
                <div style={{fontWeight:700, fontSize:14}}>
                  {bookingInfo.check_out || bookingInfo.checkout_date || bookingInfo.academy_end || '-'}
                </div>
              </div>
            </div>
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

      <div className="db-grid">
        {(authUser ? memberCards : cards).map((c, i) => (
          <div key={i} className="db-card" style={{ cursor: "pointer" }}
            onClick={() => {
              if (c.ready === false) { alert('곧 오픈 예정입니다 😊'); return; }
              if (c.href) router.push(c.href);
            }}>
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
