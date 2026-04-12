"use client";
import { useState, useEffect } from "react";
import Script from "next/script";
import { supabase } from "@/lib/supabase";

interface Child { name: string; birth_year: string }

declare global {
  interface Window {
    daum?: { Postcode: new (options: { oncomplete: (data: { roadAddress: string; jibunAddress: string; zonecode: string }) => void }) => { open: () => void } };
  }
}

export default function SignupPage() {
  const [form, setForm] = useState({ email: "", password: "", passwordConfirm: "", name: "", phone: "" });
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

  function addChild() { if (children.length < 5) setChildren([...children, { name: "", birth_year: "" }]); }
  function removeChild(i: number) { setChildren(children.filter((_, idx) => idx !== i)); }
  function updateChild(i: number, key: "name" | "birth_year", val: string) {
    const arr = [...children]; arr[i] = { ...arr[i], [key]: val }; setChildren(arr);
  }

  function openAddressSearch() {
    if (typeof window === "undefined" || !window.daum?.Postcode) {
      alert("주소 검색 서비스 로딩 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        setZipcode(data.zonecode);
        setAddress(data.roadAddress || data.jibunAddress);
        setTimeout(() => document.getElementById("address-detail")?.focus(), 100);
      },
    }).open();
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "이름을 입력해주세요.";
    else if (form.name.trim().length < 2) e.name = "이름은 2자 이상이어야 합니다.";
    if (!form.phone.trim()) e.phone = "전화번호를 입력해주세요.";
    if (!form.email.trim()) e.email = "이메일을 입력해주세요.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "올바른 이메일 형식이 아닙니다.";
    if (!form.password) e.password = "비밀번호를 입력해주세요.";
    else if (form.password.length < 8) e.password = "비밀번호는 8자 이상이어야 합니다.";
    if (!form.passwordConfirm) e.passwordConfirm = "비밀번호 확인을 입력해주세요.";
    else if (form.password !== form.passwordConfirm) e.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (!agreed) e.agreed = "개인정보 수집·이용에 동의해주세요.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
    });

    if (error) {
      setLoading(false);
      if (error.message.includes("already registered") || error.message.includes("User already")) {
        setErrors({ email: "이미 가입된 이메일입니다. 로그인해주세요." });
      } else {
        setErrors({ submit: "회원가입 실패: " + error.message });
      }
      return;
    }

    if (data.user) {
      const validChildren = children.filter(c => c.name.trim());
      const fullAddress = [zipcode ? `(${zipcode})` : "", address, addressDetail].filter(Boolean).join(" ").trim();
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        children: validChildren,
        address: fullAddress || null,
      });
      if (profileError) {
        setLoading(false);
        setErrors({ submit: "프로필 저장 실패: " + profileError.message });
        return;
      }
    }

    setLoading(false);
    setDone(true);
  }

  // 실시간 비밀번호 확인 체크
  useEffect(() => {
    if (form.passwordConfirm && form.password !== form.passwordConfirm) {
      setErrors(e => ({ ...e, passwordConfirm: "비밀번호가 일치하지 않습니다." }));
    } else if (form.passwordConfirm && form.password === form.passwordConfirm) {
      setErrors(e => { const { passwordConfirm, ...rest } = e; return rest; });
    }
  }, [form.password, form.passwordConfirm]);

  function onPhoneChange(val: string) {
    // 숫자와 하이픈만 허용
    const cleaned = val.replace(/[^0-9-]/g, "");
    setForm({ ...form, phone: cleaned });
    if (errors.phone) setErrors({ ...errors, phone: "" });
  }

  if (done) {
    return (<>
      <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f9fafb;color:#111827}
.wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.box{background:#fff;border-radius:12px;padding:48px 40px;box-shadow:0 8px 40px rgba(0,0,0,0.08);max-width:440px;width:100%;text-align:center}
.box h1{font-size:24px;font-weight:800;margin-bottom:12px;color:#2563eb}
.box p{font-size:14px;color:#6b7280;line-height:1.7;margin-bottom:24px}
.link{display:inline-block;padding:12px 28px;background:#2563eb;color:#fff;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none}.link:hover{background:#1d4ed8}
      `}</style>
      <div className="wrap">
        <div className="box">
          <h1>회원가입 완료!</h1>
          <p>이메일 인증 후 로그인할 수 있습니다.<br/>메일함을 확인해주세요.</p>
          <a href="/login" className="link">로그인 하러 가기</a>
        </div>
      </div>
    </>);
  }

  return (<>
    <Script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="afterInteractive" />
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f9fafb;color:#111827}
a{text-decoration:none;color:inherit}
.wrap{display:flex;align-items:flex-start;justify-content:center;min-height:100vh;padding:40px 24px}
.box{background:#fff;border-radius:12px;padding:40px;box-shadow:0 8px 40px rgba(0,0,0,0.06);max-width:480px;width:100%;border:1px solid #e5e7eb}
.box h1{font-size:24px;font-weight:800;margin-bottom:6px;text-align:center;color:#111827}
.box .sub{font-size:13px;color:#6b7280;text-align:center;margin-bottom:32px}
.sec{margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb}
.sec:first-of-type{margin-top:0;padding-top:0;border-top:none}
.sec-header{font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:14px}
.fg{margin-bottom:18px}
.fg .fl{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px}
.fg .fl .req{color:#ef4444;margin-left:2px}
.fg .hint{font-size:11px;color:#9ca3af;margin-top:5px}
.fi{width:100%;padding:12px 16px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;font-family:inherit;outline:none;transition:all 160ms;background:#fff;color:#111827}
.fi:focus{border-color:#2563eb;outline:2px solid #3b82f6;outline-offset:-1px}
.fi:disabled,.fi[readonly]{background:#f3f4f6;color:#6b7280;cursor:default}
.err-msg{color:#ef4444;font-size:12px;margin-top:5px;font-weight:500}
.pw-wrap{position:relative}
.pw-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:18px;padding:4px;color:#9ca3af}.pw-eye:hover{color:#2563eb}
.addr-row{display:flex;gap:8px}
.addr-row .fi{flex:1}
.addr-btn{padding:12px 18px;background:#2563eb;color:#fff;font-size:13px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:inherit;white-space:nowrap}.addr-btn:hover{background:#1d4ed8}
.child-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px}
.child-row{display:flex;gap:8px;align-items:center}
.child-row .fi{padding:10px 12px;font-size:13px}
.del-btn{padding:10px 12px;font-size:12px;background:#fef2f2;color:#ef4444;border:1px solid #fecaca;border-radius:6px;cursor:pointer;font-family:inherit;font-weight:600}.del-btn:hover{background:#fee2e2}
.child-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px;font-weight:700;color:#6b7280}
.add-btn{width:100%;padding:10px;font-size:13px;font-weight:700;border:1px dashed #d1d5db;background:#fff;border-radius:8px;cursor:pointer;font-family:inherit;color:#6b7280}.add-btn:hover{background:#f9fafb;color:#2563eb;border-color:#2563eb}
.child-empty{text-align:center;padding:16px;font-size:12px;color:#9ca3af}
.agree-box{padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px}
.agree-text{font-size:12px;color:#6b7280;line-height:1.7;margin-bottom:12px;word-break:keep-all}
.agree-check{display:flex;align-items:center;gap:10px;cursor:pointer}
.agree-check input{width:18px;height:18px;accent-color:#2563eb;cursor:pointer}
.agree-check span{font-size:13px;font-weight:600;color:#111827}
.btn{width:100%;padding:14px;background:#2563eb;color:#fff;font-size:15px;font-weight:800;border:none;border-radius:8px;cursor:pointer;font-family:inherit;transition:background 160ms;margin-top:28px;min-height:52px}
.btn:hover{background:#1d4ed8}.btn:disabled{background:#9ca3af;cursor:not-allowed}
.submit-err{margin-top:12px;padding:12px 14px;background:#fef2f2;color:#ef4444;border-radius:8px;font-size:13px;font-weight:600;border:1px solid #fecaca}
.bottom{text-align:center;margin-top:24px;font-size:13px;color:#6b7280}
.bottom a{color:#2563eb;font-weight:700}
.back{display:block;text-align:center;margin-top:14px;font-size:13px;color:#9ca3af}.back:hover{color:#2563eb}
@media(max-width:500px){.box{padding:28px 20px}.fi{min-height:48px;font-size:16px}.btn{min-height:56px}}
    `}</style>
    <div className="wrap">
      <div className="box">
        <h1>회원가입</h1>
        <p className="sub">드림아카데미 커뮤니티에 가입하세요.</p>

        {/* 기본 정보 */}
        <div className="sec">
          <div className="sec-header">기본 정보</div>

          <div className="fg">
            <label className="fl">이름<span className="req">*</span></label>
            <input className="fi" placeholder="홍길동" value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: "" }); }} />
            {errors.name && <div className="err-msg">{errors.name}</div>}
          </div>

          <div className="fg">
            <label className="fl">전화번호<span className="req">*</span></label>
            <input className="fi" placeholder="010-1234-5678" value={form.phone} onChange={e => onPhoneChange(e.target.value)} />
            {errors.phone && <div className="err-msg">{errors.phone}</div>}
          </div>

          <div className="fg">
            <label className="fl">이메일<span className="req">*</span></label>
            <input className="fi" type="email" placeholder="example@email.com" value={form.email} onChange={e => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: "" }); }} />
            {errors.email && <div className="err-msg">{errors.email}</div>}
          </div>

          <div className="fg">
            <label className="fl">비밀번호<span className="req">*</span></label>
            <div className="pw-wrap">
              <input className="fi" style={{ paddingRight: 44 }} type={showPw ? "text" : "password"} placeholder="8자 이상" value={form.password} onChange={e => { setForm({ ...form, password: e.target.value }); if (errors.password && e.target.value.length >= 8) setErrors({ ...errors, password: "" }); }} />
              <button type="button" className="pw-eye" onClick={() => setShowPw(!showPw)} aria-label={showPw ? "숨기기" : "보기"}>{showPw ? "🙈" : "👁"}</button>
            </div>
            <div className="hint">8자 이상 입력해주세요</div>
            {errors.password && <div className="err-msg">{errors.password}</div>}
          </div>

          <div className="fg">
            <label className="fl">비밀번호 확인<span className="req">*</span></label>
            <div className="pw-wrap">
              <input className="fi" style={{ paddingRight: 44 }} type={showPw2 ? "text" : "password"} placeholder="비밀번호 재입력" value={form.passwordConfirm} onChange={e => setForm({ ...form, passwordConfirm: e.target.value })} />
              <button type="button" className="pw-eye" onClick={() => setShowPw2(!showPw2)} aria-label={showPw2 ? "숨기기" : "보기"}>{showPw2 ? "🙈" : "👁"}</button>
            </div>
            {errors.passwordConfirm && <div className="err-msg">{errors.passwordConfirm}</div>}
          </div>
        </div>

        {/* 자녀 정보 */}
        <div className="sec">
          <div className="sec-header">자녀 정보 (선택)</div>

          {children.length === 0 ? (
            <div className="child-empty">등록된 자녀가 없습니다</div>
          ) : children.map((c, i) => (
            <div key={i} className="child-box">
              <div className="child-head"><span>자녀 {i + 1}</span></div>
              <div className="child-row">
                <input className="fi" style={{ flex: 2 }} placeholder="이름" value={c.name} onChange={e => updateChild(i, "name", e.target.value)} />
                <input className="fi" style={{ flex: 1 }} type="number" min="2000" max="2026" placeholder="2018" value={c.birth_year} onChange={e => updateChild(i, "birth_year", e.target.value)} />
                <button type="button" className="del-btn" onClick={() => removeChild(i)}>삭제</button>
              </div>
            </div>
          ))}

          {children.length < 5 && <button type="button" className="add-btn" onClick={addChild}>+ 자녀 추가 ({children.length}/5)</button>}
        </div>

        {/* 주소 */}
        <div className="sec">
          <div className="sec-header">주소 정보 (선택)</div>

          <div className="fg">
            <label className="fl">우편번호</label>
            <div className="addr-row">
              <input className="fi" placeholder="우편번호" value={zipcode} readOnly style={{ maxWidth: 140 }} />
              <button type="button" className="addr-btn" onClick={openAddressSearch}>🔍 주소 검색</button>
            </div>
          </div>

          <div className="fg">
            <label className="fl">도로명 주소</label>
            <input className="fi" placeholder="주소 검색 버튼을 눌러주세요" value={address} readOnly />
          </div>

          <div className="fg">
            <label className="fl">상세 주소</label>
            <input id="address-detail" className="fi" placeholder="동/호수 등" value={addressDetail} onChange={e => setAddressDetail(e.target.value)} />
            <div className="hint">이벤트 당첨 시 선물 발송에 사용됩니다</div>
          </div>
        </div>

        {/* 약관 동의 */}
        <div className="sec">
          <div className="sec-header">약관 동의<span style={{ color: "#ef4444", marginLeft: 4 }}>*</span></div>

          <div className="agree-box">
            <div className="agree-text">수집된 개인정보(이름, 전화번호, 자녀정보(이름, 출생연도), 주소)는 서비스 이용 및 이벤트 선물 발송 목적으로만 사용되며 제3자에게 절대 제공되지 않습니다.</div>
            <label className="agree-check">
              <input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setErrors({ ...errors, agreed: "" }); }} />
              <span>개인정보 수집·이용에 동의합니다 (필수)</span>
            </label>
            {errors.agreed && <div className="err-msg" style={{ marginTop: 8 }}>{errors.agreed}</div>}
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
  </>);
}
