"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Session { booking_id: string; booking_number: string; guest_name: string; check_in_date: string; expires: number }

export default function PortalDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("portal_session");
      if (!raw) { router.replace("/portal"); return; }
      const s: Session = JSON.parse(raw);
      if (s.expires < Date.now()) { localStorage.removeItem("portal_session"); router.replace("/portal"); return; }
      setSession(s);
    } catch { router.replace("/portal"); }
  }, [router]);

  function logout() {
    if (typeof window !== "undefined") localStorage.removeItem("portal_session");
    router.replace("/portal");
  }

  if (!session) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.db-w{max-width:640px;margin:0 auto;padding:40px 24px}
.db-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
.db-logo{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:900;color:#1a6fc4}
.db-logout{padding:8px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:#6b7c93}.db-logout:hover{background:#fef2f2;color:#dc2626;border-color:#fecaca}
.db-welcome{background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.06);margin-bottom:20px}
.db-welcome h1{font-size:22px;font-weight:800;margin-bottom:16px}
.db-info{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.db-item{padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0}
.db-item .lbl{font-size:11px;font-weight:700;color:#6b7c93;margin-bottom:4px}
.db-item .val{font-size:16px;font-weight:700;color:#1a1a2e}
.db-coming{background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,0.06);text-align:center}
.db-coming h2{font-size:16px;font-weight:700;color:#475569;margin-bottom:12px}
.db-coming p{font-size:13px;color:#94a3b8;line-height:1.8}
.db-coming .icons{font-size:28px;margin-bottom:12px;letter-spacing:8px}
@media(max-width:500px){.db-w{padding:24px 16px}.db-info{grid-template-columns:1fr}}
    `}</style>
    <div className="db-w">
      <div className="db-head">
        <div className="db-logo">DREAM ACADEMY</div>
        <button className="db-logout" onClick={logout}>로그아웃</button>
      </div>

      <div className="db-welcome">
        <h1>{session.guest_name}님, 환영합니다!</h1>
        <div className="db-info">
          <div className="db-item">
            <div className="lbl">예약번호</div>
            <div className="val">{session.booking_number}</div>
          </div>
          <div className="db-item">
            <div className="lbl">체크인</div>
            <div className="val">{session.check_in_date || "미정"}</div>
          </div>
        </div>
      </div>

      <div className="db-coming">
        <div className="icons">📋 🚐 👩‍🏫 📄</div>
        <h2>더 많은 기능이 준비 중입니다</h2>
        <p>
          예약 상세 조회<br/>
          셔틀 / 픽드랍 신청<br/>
          튜터 수업 신청<br/>
          서류 업로드 (여권 등)<br/>
          인보이스 / 영수증 확인
        </p>
      </div>
    </div>
  </>);
}
