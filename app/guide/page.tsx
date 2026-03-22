"use client";
import { useState, useEffect } from "react";

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";

export default function GuidePage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adminAuthed");
      if (saved === "true") setAuthed(true);
    }
  }, []);

  function checkPw() {
    if (pw === ADMIN_PW) { if (typeof window !== "undefined") localStorage.setItem("adminAuthed", "true"); setAuthed(true); }
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
.bk-link{display:inline-block;margin-top:20px;font-size:13px;color:#6b7c93;text-decoration:none;}.bk-link:hover{color:#1a6fc4;}
    `}</style>
    <div className="pw-w"><div className="pw-c">
      <h1>직원 가이드</h1>
      <p>관리자 비밀번호를 입력하세요.</p>
      <input className="pw-i" type="password" placeholder="비밀번호" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === "Enter") checkPw(); }} />
      <button className="pw-b" onClick={checkPw}>로그인</button>
      <a href="/admin" className="bk-link">← 관리자 홈</a>
    </div></div>
  </>);

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.gw{max-width:800px;margin:0 auto;padding:32px 24px 60px;}
.gh{margin-bottom:32px;}.gh h1{font-size:26px;font-weight:800;margin-bottom:8px;}.gh p{font-size:14px;color:#6b7c93;}
.gh-nav{margin-bottom:24px;}.gh-nav a{color:#6b7c93;font-size:13px;font-weight:600;text-decoration:none;}.gh-nav a:hover{color:#1a6fc4;}
.sec{background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:20px;}
.sec h2{font-size:18px;font-weight:800;margin-bottom:16px;display:flex;align-items:center;gap:8px;}
.sec h3{font-size:15px;font-weight:700;margin:16px 0 8px;color:#1a6fc4;}
.sec p,.sec li{font-size:14px;line-height:1.8;color:#4a5568;}
.sec ul{padding-left:20px;margin-bottom:12px;}
.sec code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:13px;color:#1a6fc4;font-family:monospace;}
.flow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0;font-size:13px;font-weight:600;}
.flow-step{background:#1a6fc4;color:#fff;padding:6px 14px;border-radius:8px;}
.flow-arrow{color:#94a3b8;font-size:16px;}
.tip{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e;margin-top:12px;}
    `}</style>

    <div className="gw">
      <div className="gh-nav"><a href="/admin">← 관리자 홈</a></div>
      <div className="gh">
        <h1>직원 가이드</h1>
        <p>드림아카데미 관리 시스템 사용 가이드</p>
      </div>

      <div className="sec">
        <h2>1. 전체 업무 흐름</h2>
        <div className="flow">
          <span className="flow-step">고객 예약 접수</span>
          <span className="flow-arrow">→</span>
          <span className="flow-step">담당자 지정</span>
          <span className="flow-arrow">→</span>
          <span className="flow-step">인보이스 작성</span>
          <span className="flow-arrow">→</span>
          <span className="flow-step">영수증 발행</span>
          <span className="flow-arrow">→</span>
          <span className="flow-step">구글 시트 기록</span>
        </div>
      </div>

      <div className="sec">
        <h2>2. 주요 페이지</h2>
        <h3>/booking - 고객 예약 접수</h3>
        <ul>
          <li>고객이 직접 작성하는 예약 접수 폼</li>
          <li>접수 완료 시 Supabase DB에 자동 저장</li>
          <li>상태: <code>접수</code>로 시작</li>
        </ul>

        <h3>/admin - 관리자 로그인</h3>
        <ul>
          <li>비밀번호 입력 후 관리자 허브 진입</li>
          <li><strong>예약 관리</strong>: 부킹/인보이스/영수증 탭</li>
          <li><strong>사이트 관리</strong>: 공지사항/셔틀/필드트립/회원</li>
        </ul>

        <h3>/admin/bookings - 예약 관리</h3>
        <ul>
          <li><strong>부킹 리스트 탭</strong>: 전체 예약 목록, 상태 필터, 담당자 지정</li>
          <li><strong>인보이스 탭</strong>: 인보이스 발행된 건 조회</li>
          <li><strong>영수증 탭</strong>: 영수증 발행된 건 조회</li>
          <li>각 행 클릭 시 인보이스 페이지로 이동</li>
          <li>액션 버튼: [인보이스] [영수증] 바로가기</li>
        </ul>

        <h3>/invoice - 인보이스 작성</h3>
        <ul>
          <li>숙소 선택 → 시즌 요금 자동 계산</li>
          <li>예약자/학생 정보 입력 후 미리보기</li>
          <li>저장 → Supabase DB 업데이트 (상태: <code>인보이스발행</code>)</li>
          <li>PDF 저장/인쇄, 영수증 발행 가능</li>
        </ul>

        <h3>/receipt - 영수증 발행</h3>
        <ul>
          <li>인보이스에서 "영수증 발행" 클릭 시 자동 이동</li>
          <li>DB 상태 자동 변경: <code>영수증발행</code></li>
          <li><strong>구글 시트 기록</strong> 버튼으로 통합 시트에 데이터 전송</li>
          <li>이미지 저장, PDF 저장/인쇄 가능</li>
        </ul>
      </div>

      <div className="sec">
        <h2>3. 담당자 지정</h2>
        <p>예약 관리 부킹 리스트에서 각 예약의 담당자를 선택할 수 있습니다.</p>
        <ul>
          <li><strong>May</strong> / <strong>Jamin</strong> / <strong>Yuna</strong> / <strong>Jena</strong></li>
          <li>드롭다운에서 선택하면 즉시 DB에 저장됩니다</li>
          <li>담당자 미지정 시 회색, 지정 시 파란색으로 표시</li>
        </ul>
      </div>

      <div className="sec">
        <h2>4. 구글 시트 연동</h2>
        <p>영수증 페이지에서 <strong>"구글 시트 기록"</strong> 버튼을 클릭하면 통합 시트에 데이터가 기록됩니다.</p>
        <ul>
          <li>학생 수만큼 행이 추가됩니다</li>
          <li>예약번호, 담당자, 예약자 정보, 학생 정보, 금액 등 32개 컬럼</li>
          <li>한 번 기록하면 버튼이 비활성화됩니다 (중복 방지)</li>
        </ul>
        <div className="tip">
          주의: 구글 시트 기록은 영수증 페이지에서만 가능합니다. 인보이스 단계에서는 기록되지 않습니다.
        </div>
      </div>

      <div className="sec">
        <h2>5. 상태 흐름</h2>
        <ul>
          <li><code>접수</code> → 고객이 예약 접수 폼 제출</li>
          <li><code>인보이스발행</code> → 인보이스 저장 시 자동 변경</li>
          <li><code>영수증발행</code> → 영수증 페이지 진입 시 자동 변경</li>
          <li><code>완료</code> → 수동 변경 (추후 기능)</li>
        </ul>
      </div>
    </div>
  </>);
}
