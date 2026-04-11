"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PortalPage() {
  const router = useRouter();
  const [bookingNo, setBookingNo] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function verify() {
    if (!bookingNo.trim() || !name.trim()) { setError("예약번호와 이름을 모두 입력해주세요."); return; }
    setLoading(true); setError("");
    const res = await fetch("/api/portal/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_number: bookingNo.trim(), guest_name: name.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "예약을 찾을 수 없습니다."); return; }
    if (typeof window !== "undefined") {
      localStorage.setItem("portal_session", JSON.stringify({
        booking_id: data.booking_id,
        booking_number: data.booking_number,
        guest_name: data.guest_name,
        check_in_date: data.check_in_date,
        expires: Date.now() + 24 * 60 * 60 * 1000,
      }));
    }
    router.push("/portal/dashboard");
  }

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a6fc4 100%);min-height:100vh}
.pt-w{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.pt-card{background:#fff;border-radius:20px;padding:48px 36px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center}
.pt-logo{font-family:'Montserrat',sans-serif;font-size:26px;font-weight:900;color:#1a6fc4;margin-bottom:4px;letter-spacing:-0.5px}
.pt-sub{font-size:13px;color:#6b7c93;margin-bottom:32px}
.pt-label{display:block;text-align:left;font-size:12px;font-weight:700;color:#475569;margin-bottom:6px}
.pt-input{width:100%;padding:14px 16px;border:2px solid #e2e8f0;border-radius:12px;font-size:15px;font-family:inherit;outline:none;transition:border-color 200ms;margin-bottom:16px}
.pt-input:focus{border-color:#1a6fc4}
.pt-input::placeholder{color:#cbd5e1}
.pt-btn{width:100%;padding:16px;background:#1a6fc4;color:#fff;font-size:16px;font-weight:700;border:none;border-radius:12px;cursor:pointer;font-family:inherit;transition:background 200ms;margin-top:8px}
.pt-btn:hover{background:#0d3d7a}
.pt-btn:disabled{background:#94a3b8;cursor:not-allowed}
.pt-err{margin-top:12px;padding:10px 14px;background:#fef2f2;color:#dc2626;border-radius:8px;font-size:13px;font-weight:600}
.pt-footer{margin-top:24px;font-size:11px;color:#94a3b8}
.pt-footer a{color:#1a6fc4;text-decoration:none}.pt-footer a:hover{text-decoration:underline}
@media(max-width:500px){.pt-card{padding:36px 24px;border-radius:16px}.pt-input,.pt-btn{min-height:48px}}
    `}</style>
    <div className="pt-w">
      <div className="pt-card">
        <div className="pt-logo">DREAM ACADEMY</div>
        <div className="pt-sub">예약 조회 포털</div>

        <label className="pt-label">예약번호</label>
        <input className="pt-input" placeholder="DA-20260411-123456" value={bookingNo}
          onChange={e => setBookingNo(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") verify(); }} />

        <label className="pt-label">예약자 이름</label>
        <input className="pt-input" placeholder="이름 (한글 또는 영문)" value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") verify(); }} />

        <button className="pt-btn" onClick={verify} disabled={loading}>
          {loading ? "확인 중..." : "예약 확인하기"}
        </button>

        {error && <div className="pt-err">{error}</div>}

        <div className="pt-footer">
          <a href="/">← 드림아카데미 홈으로</a>
        </div>
      </div>
    </div>
  </>);
}
