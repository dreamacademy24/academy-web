"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed, setAdminAuthed } from "@/lib/adminAuth";

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return "h_" + Math.abs(hash).toString(36);
}

const ADMIN_ACCOUNTS = [
  { id: "admin-may",   pw: "h_dyghlz", role: "admin", name: "May",   staffId: "may" },
  { id: "admin-ceo",   pw: "h_azeaz3", role: "admin", name: "CEO",   staffId: "ceo" },
  { id: "admin-jenna", pw: "h_9x7hvc", role: "staff", name: "Jenna", staffId: "jenna" },
  { id: "admin-jamie", pw: "h_4whzg",  role: "staff", name: "Jamie", staffId: "jamie" },
  { id: "admin-yuna",  pw: "h_25tbwx", role: "staff", name: "Yuna",  staffId: "yuna"  },
  { id: "admin-hanny", pw: "h_5ytroi", role: "staff", name: "Hanny", staffId: "hanny" },
  { id: "admin-sage",  pw: "h_tmt0j2", role: "staff", name: "Sage",  staffId: "sage"  },
  { id: "admin-eric",  pw: "h_im0z0p", role: "staff", name: "Eric",  staffId: "eric"  },
  { id: "admin-jun",   pw: "h_krvnp7", role: "staff", name: "Jun",   staffId: "jun"   },
];

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ id: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && isAdminAuthed()) {
      router.replace("/admin/hub");
    }
  }, [router]);

  async function handleLogin() {
    const idTrim = form.id.trim();
    if (!idTrim || !form.password) { setErr("아이디와 비밀번호를 입력해주세요."); return; }
    setErr(""); setLoading(true);

    // 관리자 계정 (admin-xxx)
    if (idTrim.startsWith("admin-")) {
      const account = ADMIN_ACCOUNTS.find(a => a.id === idTrim && a.pw === simpleHash(form.password));
      if (!account) {
        setErr("관리자 아이디 또는 비밀번호가 올바르지 않습니다.");
        setLoading(false); return;
      }
      setAdminAuthed(account.id, { role: account.role, name: account.name, staffId: account.staffId });
      window.location.href = "/admin/hub";
      return;
    }

    // 일반 회원 (아이디 → 가상 이메일 변환)
    const internalEmail = `${idTrim}@dreamacademyph.com`;
    const { error } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password: form.password,
    });
    setLoading(false);
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        setErr("아이디 또는 비밀번호가 올바르지 않습니다.");
      } else {
        setErr("로그인 실패: " + error.message);
      }
      return;
    }
    window.location.href = "/portal/dashboard";
  }

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;}
a{text-decoration:none;color:inherit;}
.wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
.box{background:#fff;border-radius:16px;padding:48px 40px;box-shadow:0 8px 40px rgba(0,0,0,0.1);max-width:420px;width:100%;text-align:center;}
.box h1{font-size:24px;font-weight:800;margin-bottom:8px;}
.box .sub{font-size:13px;color:#6b7c93;margin-bottom:28px;}
.form-group{margin-bottom:14px;text-align:left;}
.form-label{display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:5px;}
.form-input{width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'Noto Sans KR',sans-serif;outline:none;transition:border-color 160ms;}
.form-input:focus{border-color:#1a6fc4;}
.pw-wrap{position:relative;}
.pw-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:18px;color:#94a3b8;padding:4px;}.pw-eye:hover{color:#1a6fc4;}
.btn{width:100%;padding:13px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:background 160ms;margin-top:8px;}
.btn:hover{background:#0d3d7a;}.btn:disabled{background:#94a3b8;cursor:not-allowed;}
.err{color:#dc2626;font-size:13px;margin-top:12px;padding:10px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;}
.hint{font-size:11px;color:#94a3b8;margin-top:10px;line-height:1.5;}
.bottom{text-align:center;margin-top:20px;font-size:13px;color:#6b7c93;}
.bottom a{color:#1a6fc4;font-weight:600;}
.back{display:block;text-align:center;margin-top:12px;font-size:13px;color:#6b7c93;}.back:hover{color:#1a6fc4;}
@media(max-width:500px){.box{padding:36px 24px;}.form-input,.btn{min-height:48px;font-size:16px;}}
    `}</style>
    <div className="wrap">
      <div className="box">
        <h1>로그인</h1>
        <p className="sub">드림아카데미 계정으로 로그인하세요.</p>

        <div className="form-group">
          <label className="form-label">아이디</label>
          <input
            className="form-input"
            type="text"
            placeholder="아이디 입력"
            value={form.id}
            onChange={e => { setForm({ ...form, id: e.target.value }); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label className="form-label">비밀번호</label>
          <div className="pw-wrap">
            <input
              className="form-input"
              style={{ paddingRight: 44 }}
              type={showPw ? "text" : "password"}
              placeholder="비밀번호"
              value={form.password}
              onChange={e => { setForm({ ...form, password: e.target.value }); setErr(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              autoComplete="current-password"
            />
            <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)} aria-label={showPw ? "숨기기" : "보기"}>{showPw ? "🙈" : "👁"}</button>
          </div>
        </div>

        <button className="btn" disabled={loading} onClick={handleLogin}>
          {loading ? "로그인 중..." : "로그인"}
        </button>

        {err && <div className="err">{err}</div>}

        <div className="bottom">아직 계정이 없으신가요? <a href="/signup">회원가입</a></div>
        <a href="/" className="back">← 홈으로 돌아가기</a>
      </div>
    </div>
  </>);
}
