"use client";
import { useState, useEffect } from "react";
import Script from "next/script";
import { supabase } from "@/lib/supabase";

interface Child { name: string; birth_year: string }
declare global {
  interface Window {
    daum?: { Postcode: new (o: { oncomplete: (d: { roadAddress: string; jibunAddress: string; zonecode: string }) => void }) => { open: () => void } };
  }
}
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function SignupPage() {
  const [form, setForm] = useState({ username: "", email: "", password: "", passwordConfirm: "", name: "", phone: "" });
  const [zipcode, setZipcode] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");

  function addChild() { if (children.length < 5) setChildren([...children, { name: "", birth_year: "" }]); }
  function removeChild(i: number) { setChildren(children.filter((_, idx) => idx !== i)); }
  function updateChild(i: number, key: "name" | "birth_year", val: string) {
    const arr = [...children]; arr[i] = { ...arr[i], [key]: val }; setChildren(arr);
  }
  function onUsernameChange(val: string) {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9]/g, "");
    setForm(f => ({ ...f, username: cleaned }));
    setUsernameStatus("idle");
  }
  function onPhoneChange(val: string) {
    setForm(f => ({ ...f, phone: val.replace(/[^0-9-]/g, "") }));
  }
  async function checkUsername() {
    setUsernameStatus("checking");
    const u = form.username.trim();
    if (u.length < 4 || u.length > 20 || u.startsWith("admin")) { setUsernameStatus("invalid"); return; }
    try {
      const res = await fetch("/api/check-username", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: u }) });
      const data = await res.json();
      setUsernameStatus(data.available ? "available" : "taken");
    } catch { setUsernameStatus("idle"); }
  }
  function openAddressSearch() {
    if (!window.daum?.Postcode) { alert("주소 검색 로딩 중입니다. 잠시 후 다시 시도해주세요."); return; }
    new window.daum.Postcode({ oncomplete: (d) => { setZipcode(d.zonecode); setAddress(d.roadAddress || d.jibunAddress); setTimeout(() => document.getElementById("addr-detail")?.focus(), 100); } }).open();
  }
  function validate() {
    const e: Record<string, string> = {};
    if (!form.username) e.username = "아이디를 입력해주세요.";
    else if (usernameStatus !== "available") e.username = "아이디 중복확인을 해주세요.";
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "이름을 2자 이상 입력해주세요.";
    if (!form.phone.trim()) e.phone = "전화번호를 입력해주세요.";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "올바른 이메일을 입력해주세요.";
    if (!form.password || form.password.length < 8) e.password = "비밀번호를 8자 이상 입력해주세요.";
    if (form.password !== form.passwordConfirm) e.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (!agreed) e.agreed = "개인정보 수집·이용에 동의해주세요.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }
  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      const internalEmail = `${form.username}@dreamacademyph.com`;
      const { data, error } = await supabase.auth.signUp({ email: internalEmail, password: form.password });
      if (error) {
        setLoading(false);
        if (error.message.includes("already registered") || error.message.includes("User already")) {
          setUsernameStatus("taken");
          setErrors({ submit: "이미 사용 중인 아이디입니다." });
        } else {
          setErrors({ submit: "회원가입 실패: " + error.message });
        }
        return;
      }
      if (!data?.user?.id) { setLoading(false); setErrors({ submit: "회원가입 처리 중 오류가 발생했습니다." }); return; }
      const fullAddress = [zipcode ? `(${zipcode})` : "", address, addressDetail].filter(Boolean).join(" ").trim();
      const { error: pe } = await supabase.from("profiles").insert({
        id: data.user.id, username: form.username, name: form.name.trim(),
        phone: form.phone.trim(), email: form.email.trim(),
        children: children.filter(c => c.name.trim()),
        ...(fullAddress ? { address: fullAddress } : {})
      });
      if (pe) { setLoading(false); setErrors({ submit: "프로필 저장 실패: " + pe.message }); return; }
      setDone(true);
    } catch (err: unknown) {
      setLoading(false);
      setErrors({ submit: "오류: " + (err instanceof Error ? err.message : String(err)) });
    }
  }
  useEffect(() => {
    if (form.passwordConfirm && form.password !== form.passwordConfirm)
      setErrors(e => ({ ...e, passwordConfirm: "비밀번호가 일치하지 않습니다." }));
    else if (form.passwordConfirm)
      setErrors(e => { const c = { ...e }; delete c.passwordConfirm; return c; });
  }, [form.password, form.passwordConfirm]);

  const css = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Noto Sans KR',sans-serif;background:#f3f4f6;color:#111827}
    .wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px}
    .box{background:#fff;border-radius:16px;padding:40px 36px;box-shadow:0 4px 24px rgba(0,0,0,0.08);width:100%;max-width:480px}
    h1{font-size:26px;font-weight:800;text-align:center;margin-bottom:4px}
    .sub{text-align:center;color:#6b7280;font-size:14px;margin-bottom:32px}
    .sec{margin-bottom:24px}
    .sec-title{font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;padding-bottom:8px;border-bottom:1px solid #f3f4f6;margin-bottom:16px}
    .fg{margin-bottom:16px}
    .fl{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px}
    .req{color:#ef4444;margin-left:2px}
    .fi{width:100%;padding:11px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-size:15px;color:#111827;outline:none;transition:border-color 0.15s;background:#fff}
    .fi:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1)}
    .fi:read-only{background:#f9fafb;color:#6b7280}
    .fi.err{border-color:#ef4444}
    .err-msg{font-size:12px;color:#ef4444;margin-top:4px}
    .ok-msg{font-size:12px;color:#16a34a;margin-top:4px}
    .hint{font-size:12px;color:#9ca3af;margin-top:4px}
    .row{display:flex;gap:8px}
    .row .fi{flex:1}
    .check-btn{white-space:nowrap;padding:11px 16px;border-radius:8px;font-size:13px;font-weight:700;border:none;cursor:pointer;background:#6b7280;color:#fff;transition:background 0.15s}
    .check-btn:hover:not(:disabled){background:#4b5563}
    .check-btn.ok{background:#16a34a}.check-btn.ng{background:#dc2626}
    .check-btn:disabled{opacity:0.5;cursor:not-allowed}
    .pw-wrap{position:relative}
    .pw-wrap .fi{padding-right:44px}
    .eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:18px;color:#9ca3af;padding:4px}
    .child-card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:10px}
    .child-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:13px;font-weight:600;color:#374151}
    .del-btn{background:none;border:none;color:#ef4444;cursor:pointer;font-size:20px;line-height:1;padding:0}
    .add-btn{width:100%;padding:10px;border:1.5px dashed #d1d5db;border-radius:8px;background:#f9fafb;color:#6b7280;font-size:13px;cursor:pointer;transition:all 0.15s}
    .add-btn:hover{border-color:#3b82f6;color:#3b82f6}
    .addr-hint{font-size:12px;color:#9ca3af;margin-top:6px}
    .search-btn{white-space:nowrap;padding:11px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
    .search-btn:hover{background:#1d4ed8}
    .agree-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px}
    .agree-text{font-size:13px;color:#6b7280;line-height:1.7;margin-bottom:12px}
    .agree-label{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;cursor:pointer}
    .agree-label input{width:18px;height:18px;cursor:pointer}
    .btn{width:100%;padding:15px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;margin-top:8px;transition:background 0.15s}
    .btn:hover:not(:disabled){background:#1d4ed8}
    .btn:disabled{opacity:0.6;cursor:not-allowed}
    .submit-err{margin-top:12px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#dc2626;font-size:13px;text-align:center}
    .bottom{text-align:center;margin-top:20px;font-size:14px;color:#6b7280}
    .bottom a{color:#2563eb;font-weight:600;text-decoration:none}
    .back{display:block;text-align:center;margin-top:10px;font-size:13px;color:#9ca3af;text-decoration:none}
    .back:hover{color:#6b7280}
  `;

  if (done) return (
    <>
      <style>{css}</style>
      <div className="wrap"><div className="box" style={{textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}}>🎉</div>
        <h1 style={{marginBottom:12}}>가입 완료!</h1>
        <p className="sub" style={{marginBottom:28}}>아이디로 바로 로그인할 수 있습니다.</p>
        <a href="/login" style={{display:"inline-block",padding:"13px 32px",background:"#2563eb",color:"#fff",borderRadius:"8px",fontWeight:700,textDecoration:"none",fontSize:15}}>로그인 하러 가기</a>
      </div></div>
    </>
  );

  return (
    <>
      <Script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="afterInteractive" />
      <style>{css}</style>
      <div className="wrap">
        <div className="box">
          <h1>회원가입</h1>
          <p className="sub">드림아카데미 커뮤니티에 가입하세요.</p>

          {/* 기본 정보 */}
          <div className="sec">
            <div className="sec-title">기본 정보</div>

            <div className="fg">
              <label className="fl">아이디<span className="req">*</span></label>
              <div className="row">
                <input className={`fi${errors.username ? " err" : ""}`} placeholder="영문 소문자, 숫자 조합 4~20자" value={form.username} onChange={e => onUsernameChange(e.target.value)} maxLength={20} />
                <button type="button" className={`check-btn${usernameStatus === "available" ? " ok" : usernameStatus === "taken" || usernameStatus === "invalid" ? " ng" : ""}`} onClick={checkUsername} disabled={form.username.length < 4 || usernameStatus === "checking"}>
                  {usernameStatus === "checking" ? "확인 중..." : "중복확인"}
                </button>
              </div>
              {usernameStatus === "available" && <div className="ok-msg">✓ 사용 가능한 아이디입니다</div>}
              {usernameStatus === "taken" && <div className="err-msg">이미 사용 중인 아이디입니다</div>}
              {usernameStatus === "invalid" && <div className="err-msg">4~20자 영문 소문자/숫자만 가능합니다</div>}
              {usernameStatus === "idle" && errors.username && <div className="err-msg">{errors.username}</div>}
            </div>

            <div className="fg">
              <label className="fl">이름<span className="req">*</span></label>
              <input className={`fi${errors.name ? " err" : ""}`} placeholder="홍길동" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              {errors.name && <div className="err-msg">{errors.name}</div>}
            </div>

            <div className="fg">
              <label className="fl">전화번호<span className="req">*</span></label>
              <input className={`fi${errors.phone ? " err" : ""}`} placeholder="010-1234-5678" value={form.phone} onChange={e => onPhoneChange(e.target.value)} />
              {errors.phone && <div className="err-msg">{errors.phone}</div>}
            </div>

            <div className="fg">
              <label className="fl">이메일<span className="req">*</span> <span style={{fontWeight:400,color:"#9ca3af"}}>(비밀번호 찾기, 보안 알림용)</span></label>
              <input className={`fi${errors.email ? " err" : ""}`} type="email" placeholder="example@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              {errors.email && <div className="err-msg">{errors.email}</div>}
            </div>

            <div className="fg">
              <label className="fl">비밀번호<span className="req">*</span></label>
              <div className="pw-wrap">
                <input className={`fi${errors.password ? " err" : ""}`} type={showPw ? "text" : "password"} placeholder="8자 이상" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                <button type="button" className="eye" onClick={() => setShowPw(!showPw)}>{showPw ? "🙈" : "👁"}</button>
              </div>
              {errors.password ? <div className="err-msg">{errors.password}</div> : <div className="hint">8자 이상 입력해주세요</div>}
            </div>

            <div className="fg">
              <label className="fl">비밀번호 확인<span className="req">*</span></label>
              <div className="pw-wrap">
                <input className={`fi${errors.passwordConfirm ? " err" : ""}`} type={showPw2 ? "text" : "password"} placeholder="비밀번호 재입력" value={form.passwordConfirm} onChange={e => setForm(f => ({ ...f, passwordConfirm: e.target.value }))} />
                <button type="button" className="eye" onClick={() => setShowPw2(!showPw2)}>{showPw2 ? "🙈" : "👁"}</button>
              </div>
              {errors.passwordConfirm && <div className="err-msg">{errors.passwordConfirm}</div>}
            </div>
          </div>

          {/* 자녀 정보 */}
          <div className="sec">
            <div className="sec-title">자녀 정보 <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(선택 · {children.length}/5명)</span></div>
            {children.map((c, i) => (
              <div className="child-card" key={i}>
                <div className="child-header">
                  <span>자녀 {i + 1}</span>
                  <button type="button" className="del-btn" onClick={() => removeChild(i)}>×</button>
                </div>
                <div className="row">
                  <input className="fi" placeholder="이름" value={c.name} onChange={e => updateChild(i, "name", e.target.value)} />
                  <input className="fi" type="number" placeholder="출생연도 (예: 2018)" min={2000} max={2026} value={c.birth_year} onChange={e => updateChild(i, "birth_year", e.target.value)} style={{maxWidth:180}} />
                </div>
              </div>
            ))}
            {children.length < 5 && <button type="button" className="add-btn" onClick={addChild}>+ 자녀 추가</button>}
          </div>

          {/* 주소 정보 */}
          <div className="sec">
            <div className="sec-title">주소 정보 <span style={{fontWeight:400,textTransform:"none",letterSpacing:0}}>(선택)</span></div>
            <div className="fg">
              <label className="fl">우편번호</label>
              <div className="row">
                <input className="fi" placeholder="우편번호" value={zipcode} readOnly />
                <button type="button" className="search-btn" onClick={openAddressSearch}>🔍 주소 검색</button>
              </div>
            </div>
            <div className="fg">
              <label className="fl">도로명 주소</label>
              <input className="fi" placeholder="주소 검색 버튼을 눌러주세요" value={address} readOnly />
            </div>
            <div className="fg">
              <label className="fl">상세 주소</label>
              <input id="addr-detail" className="fi" placeholder="동/호수 등" value={addressDetail} onChange={e => setAddressDetail(e.target.value)} />
              <div className="addr-hint">이벤트 당첨 시 선물 발송에 사용됩니다</div>
            </div>
          </div>

          {/* 약관 동의 */}
          <div className="sec">
            <div className="sec-title">약관 동의<span className="req">*</span></div>
            <div className="agree-box">
              <div className="agree-text">수집된 개인정보(아이디, 이름, 전화번호, 이메일, 자녀정보(이름, 출생연도), 주소)는 서비스 이용 및 이벤트 선물 발송 목적으로만 사용되며 제3자에게 절대 제공되지 않습니다.</div>
              <label className="agree-label">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                개인정보 수집·이용에 동의합니다 (필수)
              </label>
              {errors.agreed && <div className="err-msg" style={{marginTop:8}}>{errors.agreed}</div>}
            </div>
          </div>

          <button className="btn" disabled={loading} onClick={handleSubmit}>
            {loading ? "가입 중..." : "회원가입"}
          </button>
          {errors.submit && <div className="submit-err">{errors.submit}</div>}
          <div className="bottom">이미 계정이 있으신가요? <a href="/login">로그인</a></div>
          <a href="/" className="back">← 홈으로 돌아가기</a>
        </div>
      </div>
    </>
  );
}
