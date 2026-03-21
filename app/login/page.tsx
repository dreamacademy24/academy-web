"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!form.email.trim() || !form.password) {
      alert("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    });

    if (error) {
      alert("로그인 실패: " + error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/community";
  }

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
        a{text-decoration:none;color:inherit;}
        .wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
        .box{background:#fff;border-radius:16px;padding:48px 40px;box-shadow:0 8px 40px rgba(0,0,0,0.1);max-width:420px;width:100%;}
        .box h1{font-size:24px;font-weight:800;margin-bottom:6px;text-align:center;}
        .box .sub{font-size:13px;color:#6b7c93;text-align:center;margin-bottom:28px;}
        .form-group{margin-bottom:16px;}
        .form-label{display:block;font-size:12px;font-weight:600;color:#6b7c93;margin-bottom:5px;}
        .form-input{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'Noto Sans KR',sans-serif;outline:none;transition:border-color 160ms;}
        .form-input:focus{border-color:#1a6fc4;}
        .btn{width:100%;padding:13px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:background 160ms;margin-top:8px;}
        .btn:hover{background:#0d3d7a;}
        .btn:disabled{background:#94a3b8;cursor:not-allowed;}
        .bottom{text-align:center;margin-top:20px;font-size:13px;color:#6b7c93;}
        .bottom a{color:#1a6fc4;font-weight:600;}
        .back{display:block;text-align:center;margin-top:12px;font-size:13px;color:#6b7c93;}
        .back:hover{color:#1a6fc4;}
      `}</style>
      <div className="wrap">
        <div className="box">
          <h1>로그인</h1>
          <p className="sub">드림아카데미 커뮤니티에 로그인하세요.</p>

          <div className="form-group">
            <label className="form-label">이메일</label>
            <input
              className="form-input"
              type="email"
              placeholder="example@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <div className="form-group">
            <label className="form-label">비밀번호</label>
            <input
              className="form-input"
              type="password"
              placeholder="비밀번호 입력"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <button className="btn" disabled={loading} onClick={handleLogin}>
            {loading ? "로그인 중..." : "로그인"}
          </button>

          <div className="bottom">아직 계정이 없으신가요? <a href="/signup">회원가입</a></div>
          <a href="/" className="back">← 홈으로 돌아가기</a>
        </div>
      </div>
    </>
  );
}
