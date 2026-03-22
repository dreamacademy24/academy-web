"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";

export default function AdminHubPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");

  function checkPw() {
    if (pw === ADMIN_PW) setAuthed(true);
    else alert("비밀번호가 올바르지 않습니다.");
  }

  if (!authed) return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;}
.pw-w{display:flex;align-items:center;justify-content:center;height:100vh;}
.pw-c{background:#fff;padding:48px 40px;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.1);text-align:center;max-width:400px;width:100%;}
.pw-c h1{font-size:24px;font-weight:800;margin-bottom:8px;}
.pw-c p{font-size:14px;color:#6b7c93;margin-bottom:28px;}
.pw-i{width:100%;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;font-size:15px;outline:none;font-family:'Noto Sans KR',sans-serif;margin-bottom:16px;}.pw-i:focus{border-color:#1a6fc4;}
.pw-b{width:100%;padding:13px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.pw-b:hover{background:#0d3d7a;}
.back-link{display:inline-block;margin-top:20px;font-size:13px;color:#6b7c93;text-decoration:none;}.back-link:hover{color:#1a6fc4;}
    `}</style>
    <div className="pw-w"><div className="pw-c">
      <h1>Admin</h1>
      <p>관리자 비밀번호를 입력하세요.</p>
      <input className="pw-i" type="password" placeholder="비밀번호" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === "Enter") checkPw(); }} />
      <button className="pw-b" onClick={checkPw}>로그인</button>
      <a href="/" className="back-link">← 홈으로 돌아가기</a>
    </div></div>
  </>);

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.hub-w{max-width:700px;margin:0 auto;padding:60px 24px;}
.hub-h{text-align:center;margin-bottom:40px;}
.hub-h h1{font-size:28px;font-weight:800;margin-bottom:8px;}
.hub-h p{font-size:14px;color:#6b7c93;}
.hub-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:36px;}
.hub-card{background:#fff;border-radius:16px;padding:36px 24px;box-shadow:0 4px 20px rgba(0,0,0,0.06);text-align:center;cursor:pointer;border:2px solid transparent;transition:all 180ms;}
.hub-card:hover{border-color:#1a6fc4;box-shadow:0 8px 30px rgba(26,111,196,0.15);transform:translateY(-2px);}
.hub-icon{font-size:40px;margin-bottom:16px;}
.hub-card h2{font-size:18px;font-weight:800;margin-bottom:8px;}
.hub-card p{font-size:13px;color:#6b7c93;line-height:1.6;}
.hub-links{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
.hub-link{padding:10px 20px;background:#fff;color:#1a6fc4;font-size:13px;font-weight:600;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;transition:all 150ms;}.hub-link:hover{background:#f0f7ff;border-color:#1a6fc4;}
@media(max-width:500px){.hub-grid{grid-template-columns:1fr;}.hub-w{padding:40px 16px;}}
    `}</style>
    <div className="hub-w">
      <div className="hub-h">
        <h1>관리자 대시보드</h1>
        <p>Dream Academy 관리 메뉴를 선택하세요</p>
      </div>
      <div className="hub-grid">
        <div className="hub-card" onClick={() => router.push("/admin/dashboard")}>
          <div className="hub-icon">⚙️</div>
          <h2>사이트 관리</h2>
          <p>공지사항, 커뮤니티, 회원 관리</p>
        </div>
        <div className="hub-card" onClick={() => router.push("/admin/bookings")}>
          <div className="hub-icon">📋</div>
          <h2>예약 관리</h2>
          <p>부킹 접수 확인, 인보이스 발행, 영수증 발행</p>
        </div>
      </div>
      <div className="hub-links">
        <a className="hub-link" href="/booking">새 예약 접수</a>
        <a className="hub-link" href="/guide">직원 가이드</a>
        <a className="hub-link" href="/">홈으로</a>
      </div>
    </div>
  </>);
}
