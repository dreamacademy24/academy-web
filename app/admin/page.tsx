"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";

const STAFF = [
  { id: 'jenna', name: 'Jenna', role: '부원장', color: '#6366f1', pw: 'jenna1234' },
  { id: 'jamie', name: 'Jamie', role: '직원', color: '#0ea5e9', pw: 'jamie1234' },
  { id: 'yuna',  name: 'Yuna',  role: '직원', color: '#ec4899', pw: 'yuna1234' },
  { id: 'hanny', name: 'Hanny', role: '직원', color: '#f59e0b', pw: 'hanny1234' },
  { id: 'sage',  name: 'Sage',  role: '직원', color: '#10b981', pw: 'sage1234' },
  { id: 'eric',  name: 'Eric',  role: '직원', color: '#f97316', pw: 'eric1234' },
  { id: 'ceo',   name: 'CEO',   role: '대표', color: '#1e3a5f', pw: 'ceo1234' },
];

export default function AdminHubPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adminAuthed");
      if (saved === "true") setAuthed(true);
    }
  }, []);

  function checkPw() {
    if (pw === ADMIN_PW || pw === "jiajiu") { if (typeof window !== "undefined") localStorage.setItem("adminAuthed", "true"); setAuthed(true); }
    else alert("비밀번호가 올바르지 않습니다.");
  }

  function logout() { if (typeof window !== "undefined") localStorage.removeItem("adminAuthed"); setAuthed(false); }

  if (!authed) return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;}
.pw-w{display:flex;align-items:center;justify-content:center;height:100vh;}
.pw-c{background:#fff;padding:48px 40px;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.1);text-align:center;max-width:400px;width:100%;}
.pw-c h1{font-size:24px;font-weight:800;margin-bottom:8px;}
.pw-c p{font-size:14px;color:#6b7c93;margin-bottom:28px;}
.pw-wrap{position:relative;width:100%;margin-bottom:16px;}
.pw-i{width:100%;padding:12px 16px;padding-right:44px;border:1px solid #e2e8f0;border-radius:8px;font-size:15px;outline:none;font-family:'Noto Sans KR',sans-serif;}.pw-i:focus{border-color:#1a6fc4;}
.pw-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:18px;color:#94a3b8;padding:4px;}.pw-eye:hover{color:#1a6fc4;}
.pw-b{width:100%;padding:13px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.pw-b:hover{background:#0d3d7a;}
.bk-link{display:inline-block;margin-top:20px;font-size:13px;color:#6b7c93;text-decoration:none;}.bk-link:hover{color:#1a6fc4;}
    `}</style>
    <div className="pw-w"><div className="pw-c">
      <h1>Admin</h1>
      <p>관리자 비밀번호를 입력하세요.</p>
      <div className="pw-wrap">
        <input className="pw-i" type={showPw ? "text" : "password"} placeholder="비밀번호" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === "Enter") checkPw(); }} />
        <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)}>{showPw ? "🙈" : "👁"}</button>
      </div>
      <button className="pw-b" onClick={checkPw}>로그인</button>
      <a href="/" className="bk-link">← 홈으로 돌아가기</a>
    </div></div>
  </>);

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.hub-w{max-width:600px;margin:0 auto;padding:60px 24px;}
.hub-h{text-align:center;margin-bottom:44px;}
.hub-h h1{font-size:28px;font-weight:800;margin-bottom:8px;}
.hub-h p{font-size:14px;color:#6b7c93;}
.hub-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:36px;}
.hub-card{border-radius:16px;padding:40px 24px;text-align:center;cursor:pointer;border:2px solid transparent;transition:all 180ms;}
.hub-card:hover{transform:translateY(-3px);}
.hub-card .ic{font-size:44px;margin-bottom:14px;}
.hub-card h2{font-size:18px;font-weight:800;margin-bottom:8px;}
.hub-card p{font-size:13px;line-height:1.6;opacity:0.85;}
.card-blue{background:#1a6fc4;color:#fff;box-shadow:0 6px 24px rgba(26,111,196,0.25);}.card-blue:hover{box-shadow:0 10px 36px rgba(26,111,196,0.35);}
.card-gray{background:#fff;color:#1a1a2e;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;}.card-gray:hover{border-color:#1a6fc4;box-shadow:0 8px 30px rgba(26,111,196,0.12);}
.hub-footer{display:flex;justify-content:center;gap:16px;flex-wrap:wrap;}
.hub-link{color:#6b7c93;font-size:13px;font-weight:600;text-decoration:none;padding:8px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;}.hub-link:hover{color:#1a6fc4;border-color:#1a6fc4;}
.logout{background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;margin-top:24px;display:block;text-align:center;width:100%;font-family:'Noto Sans KR',sans-serif;}.logout:hover{color:#dc2626;}
.staff-section{margin-bottom:36px;}
.staff-section h3{font-size:16px;font-weight:700;margin-bottom:14px;text-align:center;color:#475569;}
.staff-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
.staff-btn{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 8px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;transition:all 150ms;text-decoration:none;color:#1a1a2e;}
.staff-btn:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,0.1);border-color:#1a6fc4;}
.staff-av{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;}
.staff-name{font-size:12px;font-weight:700;}
.staff-role{font-size:10px;color:#94a3b8;}
@media(max-width:500px){.hub-grid{grid-template-columns:1fr;}.hub-w{padding:40px 16px;}.staff-grid{grid-template-columns:repeat(3,1fr);}}
    `}</style>
    <div className="hub-w">
      <div className="hub-h">
        <h1>드림아카데미 관리자</h1>
        <p>관리 메뉴를 선택하세요</p>
      </div>
      <div className="hub-grid">
        <div className="hub-card card-blue" onClick={() => router.push("/admin/bookings")}>
          <div className="ic">📋</div>
          <h2>예약 관리</h2>
          <p>부킹 접수 · 인보이스 · 영수증</p>
        </div>
        <div className="hub-card card-gray" onClick={() => router.push("/admin/site")}>
          <div className="ic">⚙️</div>
          <h2>사이트 관리</h2>
          <p>공지사항 · 셔틀 · 필드트립 · 회원</p>
        </div>
        <div className="hub-card card-gray" onClick={() => router.push("/staff")}>
          <div className="ic">👥</div>
          <h2>직원업무</h2>
          <p>직원 업무 관리</p>
        </div>
      </div>
      <div className="staff-section">
        <h3>👤 직원 바로가기</h3>
        <div className="staff-grid">
          {STAFF.map(s => (
            <a key={s.id} className="staff-btn" href={`/staff?user=${s.id}&token=${s.pw}`}>
              <div className="staff-av" style={{ background: s.color }}>{s.name[0]}</div>
              <div className="staff-name">{s.name}</div>
              <div className="staff-role">{s.role}</div>
            </a>
          ))}
        </div>
      </div>
      <div className="hub-footer">
        <a className="hub-link" href="/guide">직원 가이드</a>
        <a className="hub-link" href="/">홈으로</a>
      </div>
      <button className="logout" onClick={logout}>로그아웃</button>
    </div>
  </>);
}
