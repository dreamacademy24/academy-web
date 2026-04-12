"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface Child { name: string; age: string }

export default function SignupPage() {
  const [form, setForm] = useState({ email: "", password: "", passwordConfirm: "", name: "", phone: "", address: "" });
  const [children, setChildren] = useState<Child[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  function addChild() { if (children.length < 5) setChildren([...children, { name: "", age: "" }]); }
  function removeChild(i: number) { setChildren(children.filter((_, idx) => idx !== i)); }
  function updateChild(i: number, key: "name" | "age", val: string) {
    const arr = [...children]; arr[i] = { ...arr[i], [key]: val }; setChildren(arr);
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim() || !form.password) {
      alert("필수 항목(이름/전화번호/이메일/비밀번호)을 입력해주세요.");
      return;
    }
    if (form.password.length < 6) { alert("비밀번호는 6자 이상이어야 합니다."); return; }
    if (form.password !== form.passwordConfirm) { alert("비밀번호가 일치하지 않습니다."); return; }
    if (!agreed) { alert("개인정보 수집·이용에 동의해주세요."); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
    });

    if (error) {
      setLoading(false);
      if (error.message.includes("already registered") || error.message.includes("User already")) {
        alert("이미 사용 중인 이메일입니다. 로그인해주세요.");
      } else {
        alert("회원가입 실패: " + error.message);
      }
      return;
    }

    if (data.user) {
      const validChildren = children.filter(c => c.name.trim());
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        children: validChildren,
        address: form.address.trim() || null,
      });
      if (profileError) {
        setLoading(false);
        alert("프로필 저장 실패: " + profileError.message);
        return;
      }
    }

    setLoading(false);
    setDone(true);
  }

  if (done) {
    return (
      <>
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0;}
          body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
          .wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
          .box{background:#fff;border-radius:16px;padding:48px 40px;box-shadow:0 8px 40px rgba(0,0,0,0.1);max-width:440px;width:100%;text-align:center;}
          .box h1{font-size:24px;font-weight:800;margin-bottom:12px;color:#1a6fc4;}
          .box p{font-size:14px;color:#6b7c93;line-height:1.7;margin-bottom:24px;}
          .link{display:inline-block;padding:12px 28px;background:#1a6fc4;color:#fff;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none;transition:background 160ms;}
          .link:hover{background:#0d3d7a;}
        `}</style>
        <div className="wrap">
          <div className="box">
            <h1>회원가입 완료!</h1>
            <p>이메일 인증 후 로그인할 수 있습니다.<br/>메일함을 확인해주세요.</p>
            <a href="/login" className="link">로그인 하러 가기</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
        a{text-decoration:none;color:inherit;}
        .wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
        .box{background:#fff;border-radius:16px;padding:40px;box-shadow:0 8px 40px rgba(0,0,0,0.1);max-width:440px;width:100%;}
        .box h1{font-size:24px;font-weight:800;margin-bottom:6px;text-align:center;}
        .box .sub{font-size:13px;color:#6b7c93;text-align:center;margin-bottom:28px;}
        .form-group{margin-bottom:16px;}
        .form-label{display:block;font-size:12px;font-weight:600;color:#6b7c93;margin-bottom:5px;}
        .form-input{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'Noto Sans KR',sans-serif;outline:none;transition:border-color 160ms;}
        .form-input:focus{border-color:#1a6fc4;}
        .row{display:flex;gap:12px;}
        .row .form-group{flex:1;}
        .agree-box{margin:20px 0;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;}
        .agree-text{font-size:12px;color:#6b7c93;line-height:1.7;margin-bottom:10px;word-break:keep-all;}
        .agree-check{display:flex;align-items:center;gap:8px;cursor:pointer;}
        .agree-check input{width:16px;height:16px;accent-color:#1a6fc4;cursor:pointer;}
        .agree-check span{font-size:13px;font-weight:600;color:#1a1a2e;}
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
          <h1>회원가입</h1>
          <p className="sub">드림아카데미 커뮤니티에 가입하세요.</p>

          <div className="row">
            <div className="form-group">
              <label className="form-label">이름</label>
              <input className="form-input" placeholder="홍길동" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">전화번호</label>
              <input className="form-input" placeholder="010-1234-5678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">이메일</label>
            <input className="form-input" type="email" placeholder="example@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label">비밀번호</label>
            <div style={{ position: "relative" }}>
              <input className="form-input" style={{ paddingRight: 44 }} type={showPw ? "text" : "password"} placeholder="6자 이상" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: 4, color: "#94a3b8" }} aria-label={showPw ? "숨기기" : "보기"}>{showPw ? "🙈" : "👁"}</button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">비밀번호 확인</label>
            <div style={{ position: "relative" }}>
              <input className="form-input" style={{ paddingRight: 44 }} type={showPw2 ? "text" : "password"} placeholder="비밀번호 재입력" value={form.passwordConfirm} onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })} />
              <button type="button" onClick={() => setShowPw2(!showPw2)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: 4, color: "#94a3b8" }} aria-label={showPw2 ? "숨기기" : "보기"}>{showPw2 ? "🙈" : "👁"}</button>
            </div>
          </div>

          {/* 자녀 정보 (선택) */}
          <div style={{ marginTop: 8, marginBottom: 12, padding: 14, background: "#fefce8", border: "1px solid #fde68a", borderRadius: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#854d0e" }}>자녀 정보 (선택)</span>
              <span style={{ fontSize: 11, color: "#a16207" }}>{children.length}/5명</span>
              {children.length < 5 && (
                <button type="button" onClick={addChild} style={{ marginLeft: "auto", padding: "5px 12px", fontSize: 11, fontWeight: 700, border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>+ 자녀 추가</button>
              )}
            </div>
            {children.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <input className="form-input" style={{ flex: 2 }} placeholder={`자녀 ${i + 1} 이름`} value={c.name} onChange={e => updateChild(i, "name", e.target.value)} />
                <input className="form-input" style={{ flex: 1 }} placeholder="나이" value={c.age} onChange={e => updateChild(i, "age", e.target.value)} />
                <button type="button" onClick={() => removeChild(i)} style={{ padding: "8px 10px", fontSize: 11, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>삭제</button>
              </div>
            ))}
          </div>

          {/* 주소 (선택) */}
          <div className="form-group">
            <label className="form-label">주소 (선택)</label>
            <input className="form-input" placeholder="이벤트 당첨 시 선물 발송에 사용됩니다" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>

          <div className="agree-box">
            <div className="agree-text">수집된 개인정보(이름, 전화번호, 자녀정보, 주소)는 서비스 이용 및 이벤트 선물 발송 목적으로만 사용되며 제3자에게 절대 제공되지 않습니다.</div>
            <label className="agree-check">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>개인정보 수집·이용에 동의합니다 (필수)</span>
            </label>
          </div>

          <button className="btn" disabled={loading} onClick={handleSubmit}>
            {loading ? "가입 중..." : "회원가입"}
          </button>

          <div className="bottom">이미 계정이 있으신가요? <a href="/login">로그인</a></div>
          <a href="/" className="back">← 홈으로 돌아가기</a>
        </div>
      </div>
    </>
  );
}
