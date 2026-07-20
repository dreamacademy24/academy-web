"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed, setAdminAuthed } from "@/lib/adminAuth";

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

const ADMIN_ACCOUNTS = [
  { id: 'admin-may',   pw: 'h_dyghlz', role: 'admin', name: 'May', staffId: 'may' },
  { id: 'admin-ceo',   pw: 'h_azeaz3', role: 'admin', name: 'CEO', staffId: 'ceo' },
  { id: 'admin-jamie', pw: 'h_4whzg',  role: 'staff', name: 'Jamie', staffId: 'jamie' },
  { id: 'admin-vivace', pw: 'h_5ytroi', role: 'staff', name: 'Vivace', staffId: 'vivace' },
  { id: 'admin-eric',  pw: 'h_im0z0p', role: 'staff', name: 'Eric',  staffId: 'eric'  },
  { id: 'admin-jun',   pw: 'h_krvnp7', role: 'staff', name: 'Jun',   staffId: 'jun'   },
];

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isAdminAuthed()) {
      window.location.href = '/admin/hub';
    } else {
      // 로그인 페이지로 통합 (레거시 /admin 접근 시 /login으로 리다이렉트)
      window.location.href = '/login';
    }
  }, [router]);

  function handleLogin() {
    const account = ADMIN_ACCOUNTS.find(a => a.id === id.trim() && a.pw === simpleHash(pw));
    if (!account) {
      setErr("아이디 또는 비밀번호가 올바르지 않습니다.");
      return;
    }
    setErr("");
    setAdminAuthed(account.id, { role: account.role, name: account.name, staffId: account.staffId });

    window.location.href = "/admin/hub";
  }

  if (!ready) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;}
.pw-w{display:flex;align-items:center;justify-content:center;height:100vh;}
.pw-c{background:#fff;padding:48px 40px;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.1);text-align:center;max-width:400px;width:100%;}
.pw-c h1{font-size:24px;font-weight:800;margin-bottom:8px;}
.pw-c p{font-size:14px;color:#6b7c93;margin-bottom:28px;}
.pw-group{width:100%;margin-bottom:14px;}
.pw-i{width:100%;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;font-size:15px;outline:none;font-family:'Noto Sans KR',sans-serif;}.pw-i:focus{border-color:#1a6fc4;}
.pw-wrap{position:relative;width:100%;}
.pw-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:18px;color:#94a3b8;padding:4px;}.pw-eye:hover{color:#1a6fc4;}
.pw-b{width:100%;padding:13px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-top:4px;}.pw-b:hover{background:#0d3d7a;}
.pw-err{color:#dc2626;font-size:13px;margin-top:12px;}
.bk-link{display:inline-block;margin-top:20px;font-size:13px;color:#6b7c93;text-decoration:none;}.bk-link:hover{color:#1a6fc4;}
@media(max-width:500px){.pw-c{padding:32px 20px;margin:0 16px;max-width:100%;}.pw-i{min-height:44px;font-size:16px;}.pw-b{min-height:48px;font-size:16px;}.pw-c h1{font-size:22px;}}
    `}</style>
    <div className="pw-w"><div className="pw-c">
      <h1>Admin</h1>
      <p>관리자 계정으로 로그인하세요.</p>
      <div className="pw-group">
        <input className="pw-i" type="text" placeholder="아이디" value={id} onChange={e => { setId(e.target.value); setErr(""); }} onKeyDown={e => { if (e.key === "Enter") handleLogin(); }} autoComplete="username" />
      </div>
      <div className="pw-group">
        <div className="pw-wrap">
          <input className="pw-i" style={{ paddingRight: 44 }} type={showPw ? "text" : "password"} placeholder="비밀번호" value={pw} onChange={e => { setPw(e.target.value); setErr(""); }} onKeyDown={e => { if (e.key === "Enter") handleLogin(); }} autoComplete="current-password" />
          <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)}>{showPw ? "🙈" : "👁"}</button>
        </div>
      </div>
      <button className="pw-b" onClick={handleLogin}>로그인</button>
      {err && <div className="pw-err">{err}</div>}
      <a href="/" className="bk-link">← 홈으로 돌아가기</a>
    </div></div>
  </>);
}
