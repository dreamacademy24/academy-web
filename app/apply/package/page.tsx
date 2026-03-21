"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function PackageApplyPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", package_type: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.package_type) {
      alert("필수 항목을 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("applications").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      package_type: form.package_type,
      message: form.message.trim(),
    });
    if (error) {
      alert("신청 실패: " + error.message);
    } else {
      setDone(true);
    }
    setSubmitting(false);
  }

  if (done) {
    return (
      <>
        <style>{`
          *{box-sizing:border-box;margin:0;padding:0;}
          body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
          .wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
          .box{background:#fff;border-radius:16px;padding:48px 40px;box-shadow:0 8px 40px rgba(0,0,0,0.1);max-width:480px;width:100%;text-align:center;}
          .box h1{font-size:24px;font-weight:800;margin-bottom:12px;color:#1a6fc4;}
          .box p{font-size:14px;color:#6b7c93;line-height:1.7;margin-bottom:24px;}
          .link{display:inline-block;padding:12px 28px;background:#1a6fc4;color:#fff;font-size:14px;font-weight:700;border-radius:8px;text-decoration:none;transition:background 160ms;}
          .link:hover{background:#0d3d7a;}
        `}</style>
        <div className="wrap">
          <div className="box">
            <h1>신청이 완료되었습니다!</h1>
            <p>담당자가 확인 후 연락드리겠습니다.<br/>감사합니다.</p>
            <a href="/" className="link">홈으로 돌아가기</a>
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
        .box{background:#fff;border-radius:16px;padding:40px;box-shadow:0 8px 40px rgba(0,0,0,0.1);max-width:520px;width:100%;}
        .box h1{font-size:24px;font-weight:800;margin-bottom:6px;text-align:center;}
        .box .sub{font-size:13px;color:#6b7c93;text-align:center;margin-bottom:28px;}
        .form-group{margin-bottom:16px;}
        .form-label{display:block;font-size:12px;font-weight:600;color:#6b7c93;margin-bottom:5px;}
        .form-label .req{color:#dc2626;margin-left:2px;}
        .form-input{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'Noto Sans KR',sans-serif;outline:none;transition:border-color 160ms;}
        .form-input:focus{border-color:#1a6fc4;}
        .form-select{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'Noto Sans KR',sans-serif;outline:none;background:#fff;transition:border-color 160ms;}
        .form-select:focus{border-color:#1a6fc4;}
        .form-textarea{width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'Noto Sans KR',sans-serif;outline:none;resize:vertical;min-height:100px;transition:border-color 160ms;}
        .form-textarea:focus{border-color:#1a6fc4;}
        .row{display:flex;gap:12px;}
        .row .form-group{flex:1;}
        .btn{width:100%;padding:13px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:background 160ms;margin-top:8px;}
        .btn:hover{background:#0d3d7a;}
        .btn:disabled{background:#94a3b8;cursor:not-allowed;}
        .back{display:block;text-align:center;margin-top:16px;font-size:13px;color:#6b7c93;}
        .back:hover{color:#1a6fc4;}
        @media(max-width:600px){.row{flex-direction:column;gap:16px;}}
      `}</style>
      <div className="wrap">
        <div className="box">
          <h1>패키지 신청</h1>
          <p className="sub">원하시는 패키지를 선택하고 정보를 입력해주세요.</p>

          <div className="row">
            <div className="form-group">
              <label className="form-label">이름 <span className="req">*</span></label>
              <input className="form-input" placeholder="홍길동" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">전화번호 <span className="req">*</span></label>
              <input className="form-input" placeholder="010-1234-5678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">이메일 <span className="req">*</span></label>
            <input className="form-input" type="email" placeholder="example@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label">패키지 종류 <span className="req">*</span></label>
            <select className="form-select" value={form.package_type} onChange={(e) => setForm({ ...form, package_type: e.target.value })}>
              <option value="">선택해주세요</option>
              <option value="드림하우스">드림하우스 (독채)</option>
              <option value="제이파크 디럭스">제이파크 - Deluxe</option>
              <option value="제이파크 프리미어">제이파크 - Premier</option>
              <option value="제이파크 막탄스위트">제이파크 - Mactan Suite</option>
              <option value="큐브나인 디럭스오션">큐브나인 - Deluxe Ocean</option>
              <option value="큐브나인 풀억세스">큐브나인 - Deluxe Pool Access</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">문의 내용</label>
            <textarea className="form-textarea" placeholder="희망 일정, 인원, 궁금한 점 등을 자유롭게 작성해주세요." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>

          <button className="btn" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "신청 중..." : "패키지 신청하기"}
          </button>

          <a href="/apply" className="back">← 서비스 선택으로 돌아가기</a>
        </div>
      </div>
    </>
  );
}
