"use client";
import { useState, useEffect } from "react";

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";

export default function GuidePage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem("adminAuthed") === "true") setAuthed(true);
    }
  }, []);

  function checkPw() {
    if (pw === ADMIN_PW) {
      if (typeof window !== "undefined") localStorage.setItem("adminAuthed", "true");
      setAuthed(true);
    } else alert("비밀번호가 올바르지 않습니다.");
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

  const faqs = [
    { q: "항공편 정보를 아직 모를 때?", a: "빈칸으로 저장하면 \"미정\"으로 표시됩니다. 나중에 인보이스에서 수정 후 다시 저장하면 됩니다." },
    { q: "방 번호는 언제 입력하나요?", a: "배정 후 인보이스에서 수정합니다. 미입력 시 \"미정\"으로 표시됩니다." },
    { q: "구글 시트에 안 기록됐어요!", a: "영수증 페이지에서 [📊 구글 시트 기록] 버튼을 반드시 직접 클릭해야 합니다! 자동 기록이 아닙니다." },
    { q: "유학원 정보 입력 위치는?", a: "인보이스 하단 🔒 관리자 전용 섹션에서 입력합니다. 고객 출력물에는 표시되지 않습니다." },
    { q: "예약 삭제는 어떻게?", a: "/admin/bookings → 부킹 리스트 또는 인보이스 탭에서 [삭제] 버튼을 클릭합니다." },
    { q: "로그인 유지가 안 돼요!", a: "브라우저 캐시/쿠키를 삭제하면 재로그인이 필요합니다." },
  ];

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.gw{max-width:860px;margin:0 auto;padding:32px 24px 60px;}
.g-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;flex-wrap:wrap;gap:12px;}
.g-top h1{font-size:24px;font-weight:800;line-height:1.4;}
.g-top p{font-size:13px;color:#6b7c93;margin-top:4px;}
.g-back{padding:8px 16px;background:#fff;color:#6b7c93;font-size:13px;font-weight:600;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;white-space:nowrap;}.g-back:hover{color:#1a6fc4;border-color:#1a6fc4;}

.sec{background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:20px;}
.sec h2{font-size:17px;font-weight:800;margin-bottom:20px;display:flex;align-items:center;gap:8px;}

/* Steps */
.steps{display:flex;flex-direction:column;gap:0;}
.step{display:flex;gap:16px;position:relative;}
.step-line{width:3px;background:#e2e8f0;position:absolute;left:19px;top:42px;bottom:-2px;}
.step:last-child .step-line{display:none;}
.step-dot{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0;z-index:1;}
.step-body{flex:1;padding-bottom:24px;}
.step-body h3{font-size:15px;font-weight:700;margin-bottom:6px;display:flex;align-items:center;gap:6px;}
.step-body .tag{font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;color:#fff;}
.step-body ul{padding-left:18px;margin:0;}.step-body li{font-size:13px;line-height:1.9;color:#4a5568;}
.step-body li code{background:#f1f5f9;padding:1px 6px;border-radius:4px;font-size:12px;color:#1a6fc4;font-family:monospace;}

/* Status */
.status-flow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
.status-item{padding:8px 16px;border-radius:10px;font-size:13px;font-weight:700;text-align:center;}
.status-arrow{color:#94a3b8;font-size:18px;font-weight:700;}
.status-desc{font-size:13px;color:#4a5568;line-height:1.8;}

/* URL Table */
.url-tbl{width:100%;border-collapse:collapse;}
.url-tbl th{font-size:11px;font-weight:700;color:#6b7c93;padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;text-transform:uppercase;}
.url-tbl td{font-size:13px;padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#4a5568;}
.url-tbl td:first-child{font-family:monospace;font-weight:600;color:#1a6fc4;}
.url-tbl tr:hover td{background:#f8fafc;}

/* Assignee */
.asg-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;}
.asg-card{background:#f0f7ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;text-align:center;font-size:16px;font-weight:800;color:#1a6fc4;}

/* FAQ */
.faq-item{border:1px solid #e2e8f0;border-radius:10px;margin-bottom:8px;overflow:hidden;}
.faq-q{padding:14px 18px;font-size:14px;font-weight:700;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:#fff;}.faq-q:hover{background:#f8fafc;}
.faq-a{padding:0 18px 16px;font-size:13px;line-height:1.8;color:#4a5568;border-top:1px solid #e2e8f0;padding-top:14px;}
.faq-arrow{font-size:12px;color:#94a3b8;transition:transform 200ms;}.faq-arrow.open{transform:rotate(180deg);}

.g-footer{text-align:center;margin-top:32px;}
.g-footer a{display:inline-flex;align-items:center;gap:6px;padding:12px 24px;background:#fee500;color:#3c1e1e;font-size:14px;font-weight:700;border-radius:10px;text-decoration:none;}.g-footer a:hover{background:#fdd835;}

@media(max-width:600px){.gw{padding:20px 16px 40px;}.asg-cards{grid-template-columns:1fr 1fr;}.steps{gap:0;}.step{gap:12px;}}
    `}</style>

    <div className="gw">
      <div className="g-top">
        <div>
          <h1>드림아카데미 직원 업무 가이드</h1>
          <p>예약 시스템 사용 매뉴얼 · 현재 시스템 기준</p>
        </div>
        <a href="/admin" className="g-back">← 관리자 홈</a>
      </div>

      {/* ── 섹션1: 전체 업무 흐름 ── */}
      <div className="sec">
        <h2>📌 전체 업무 흐름</h2>
        <div className="steps">
          <div className="step">
            <div className="step-dot" style={{background:"#1a6fc4"}}>1</div>
            <div className="step-line"/>
            <div className="step-body">
              <h3><span className="tag" style={{background:"#1a6fc4"}}>고객</span> 예약 접수</h3>
              <ul>
                <li><code>/booking</code> 에서 고객이 직접 작성</li>
                <li>예약자명, 학생정보(이름/나이/킨더·주니어), 희망날짜/숙소, 픽업여부, 특이사항</li>
                <li>제출 시 예약번호 자동생성 <code>DA-날짜-번호</code></li>
              </ul>
            </div>
          </div>

          <div className="step">
            <div className="step-dot" style={{background:"#16a34a"}}>2</div>
            <div className="step-line"/>
            <div className="step-body">
              <h3><span className="tag" style={{background:"#16a34a"}}>직원</span> 어드민 확인</h3>
              <ul>
                <li><code>/admin</code> → 예약관리 → 부킹 리스트 탭</li>
                <li>접수된 예약 목록 확인</li>
                <li>담당자 드롭다운으로 바로 지정 (May / Jamin / Yuna / Jena)</li>
              </ul>
            </div>
          </div>

          <div className="step">
            <div className="step-dot" style={{background:"#d97706"}}>3</div>
            <div className="step-line"/>
            <div className="step-body">
              <h3><span className="tag" style={{background:"#d97706"}}>직원</span> 인보이스 작성</h3>
              <ul>
                <li>부킹 리스트에서 행 클릭 → <code>/invoice?id=xxx</code> 자동 이동</li>
                <li>고객 정보 자동 불러오기</li>
                <li>패키지 견적 계산 후 <strong>"인보이스에 적용"</strong> 클릭</li>
                <li>잔금일 자동계산 (체크인 +2달)</li>
                <li>드림하우스 보증금 자동 (주수 × 2,000페소)</li>
                <li>🔒 관리자전용: 유학원, SSP 입력 (출력물 미표시)</li>
                <li><strong>[저장하기]</strong> → DB 저장, 상태 → 인보이스발행</li>
                <li><strong>[인보이스 미리보기]</strong> → PDF 출력 가능</li>
              </ul>
            </div>
          </div>

          <div className="step">
            <div className="step-dot" style={{background:"#7c3aed"}}>4</div>
            <div className="step-line"/>
            <div className="step-body">
              <h3><span className="tag" style={{background:"#7c3aed"}}>직원</span> 영수증 발행</h3>
              <ul>
                <li>인보이스 미리보기에서 <strong>[영수증 발행]</strong> 클릭</li>
                <li><code>/receipt?id=xxx</code> 새 탭으로 열림</li>
                <li><strong>[📊 구글 시트 기록]</strong> 버튼 클릭 → 통합 시트에 저장 (자동 아님!)</li>
                <li><strong>[📷 이미지 저장]</strong> PNG 다운로드</li>
                <li><strong>[🖨 PDF 저장/인쇄]</strong> 출력</li>
              </ul>
            </div>
          </div>

          <div className="step">
            <div className="step-dot" style={{background:"#64748b"}}>5</div>
            <div className="step-body">
              <h3><span className="tag" style={{background:"#64748b"}}>확인</span> 구글 시트 확인</h3>
              <ul>
                <li>시트명: <strong>드림아카데미 예약현황 (웹)</strong></li>
                <li>기존 시트(드하 최종 예약현황 등)와 완전히 별개</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── 섹션2: 예약 상태 흐름 ── */}
      <div className="sec">
        <h2>🔄 예약 상태 흐름</h2>
        <div className="status-flow">
          <span className="status-item" style={{background:"#fef3c7",color:"#92400e"}}>접수</span>
          <span className="status-arrow">→</span>
          <span className="status-item" style={{background:"#dbeafe",color:"#1e40af"}}>인보이스발행</span>
          <span className="status-arrow">→</span>
          <span className="status-item" style={{background:"#dcfce7",color:"#166534"}}>영수증발행</span>
          <span className="status-arrow">→</span>
          <span className="status-item" style={{background:"#f1f5f9",color:"#64748b"}}>완료</span>
        </div>
        <div className="status-desc">
          <strong>접수</strong>: 고객이 예약 폼 제출 시 자동 생성<br/>
          <strong>인보이스발행</strong>: 인보이스 [저장하기] 클릭 시 자동 변경<br/>
          <strong>영수증발행</strong>: 영수증 페이지 진입 시 자동 변경<br/>
          <strong>완료</strong>: 수동 변경 (추후 기능 예정)
        </div>
      </div>

      {/* ── 섹션3: 주요 URL ── */}
      <div className="sec">
        <h2>🔗 주요 URL</h2>
        <table className="url-tbl">
          <thead><tr><th>URL</th><th>용도</th><th>접근 대상</th></tr></thead>
          <tbody>
            <tr><td>/booking</td><td>고객 예약 접수</td><td>고객 공개</td></tr>
            <tr><td>/admin</td><td>관리자 대시보드</td><td>직원 (비밀번호)</td></tr>
            <tr><td>/admin/bookings</td><td>예약관리 (부킹/인보이스/영수증 탭)</td><td>직원</td></tr>
            <tr><td>/admin/site</td><td>사이트관리 (공지/셔틀/필드트립/회원)</td><td>직원</td></tr>
            <tr><td>/invoice</td><td>인보이스 작성</td><td>직원</td></tr>
            <tr><td>/receipt</td><td>영수증 발행</td><td>직원</td></tr>
          </tbody>
        </table>
      </div>

      {/* ── 섹션4: 담당자 지정 ── */}
      <div className="sec">
        <h2>👤 담당자 지정</h2>
        <div className="asg-cards">
          <div className="asg-card">May</div>
          <div className="asg-card">Jamin</div>
          <div className="asg-card">Yuna</div>
          <div className="asg-card">Jena</div>
        </div>
        <ul style={{paddingLeft:"18px"}}>
          <li style={{fontSize:"13px",lineHeight:"1.9",color:"#4a5568"}}>부킹 리스트에서 담당자 드롭다운으로 바로 선택</li>
          <li style={{fontSize:"13px",lineHeight:"1.9",color:"#4a5568"}}>선택 즉시 DB에 저장됩니다</li>
          <li style={{fontSize:"13px",lineHeight:"1.9",color:"#4a5568"}}>구글 시트 기록 시 담당자 컬럼에 자동 입력</li>
        </ul>
      </div>

      {/* ── 섹션5: 회사 이메일 Gmail 연동 ── */}
      <div className="sec">
        <h2>📧 회사 이메일 Gmail 연동 방법</h2>
        <p style={{fontSize:"14px",color:"#4a5568",lineHeight:1.8,marginBottom:20}}>
          회사 이메일(@dreamacademyph.com)을 Gmail에서 바로 받아볼 수 있어요.<br/>
          아래 순서대로 설정하면 됩니다.
        </p>
        <div className="steps">
          <div className="step">
            <div className="step-dot" style={{background:"#1a6fc4"}}>1</div>
            <div className="step-line"/>
            <div className="step-body">
              <h3>Gmail 설정 열기</h3>
              <ul>
                <li>Gmail 접속 (<code>mail.google.com</code>)</li>
                <li>우측 상단 톱니바퀴 ⚙️ 클릭</li>
                <li><strong>&quot;모든 설정 보기&quot;</strong> 클릭</li>
                <li><strong>&quot;계정 및 가져오기&quot;</strong> 탭 클릭</li>
              </ul>
            </div>
          </div>

          <div className="step">
            <div className="step-dot" style={{background:"#16a34a"}}>2</div>
            <div className="step-line"/>
            <div className="step-body">
              <h3>메일 계정 추가</h3>
              <ul>
                <li><strong>&quot;다른 계정의 메일 확인&quot;</strong> 항목 찾기</li>
                <li><strong>&quot;메일 계정 추가&quot;</strong> 클릭</li>
                <li>본인 회사 이메일 입력:</li>
              </ul>
              <div style={{display:"flex",flexDirection:"column",gap:4,margin:"8px 0 8px 18px"}}>
                <code style={{display:"inline-block",background:"#f1f5f9",padding:"4px 10px",borderRadius:4,fontSize:13,color:"#1a6fc4"}}>info@dreamacademyph.com</code>
                <code style={{display:"inline-block",background:"#f1f5f9",padding:"4px 10px",borderRadius:4,fontSize:13,color:"#1a6fc4"}}>admin@dreamacademyph.com</code>
                <code style={{display:"inline-block",background:"#f1f5f9",padding:"4px 10px",borderRadius:4,fontSize:13,color:"#1a6fc4"}}>may@dreamacademyph.com</code>
              </div>
              <ul>
                <li><strong>&quot;POP3로 다른 계정의 이메일 가져오기&quot;</strong> 선택 후 다음</li>
              </ul>
            </div>
          </div>

          <div className="step">
            <div className="step-dot" style={{background:"#d97706"}}>3</div>
            <div className="step-line"/>
            <div className="step-body">
              <h3>POP3 서버 설정</h3>
              <div style={{background:"#f8fafc",borderRadius:10,padding:16,margin:"8px 0",display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
                  <span style={{color:"#6b7c93",fontWeight:600}}>사용자 이름</span>
                  <code style={{background:"#e0e7ff",padding:"3px 10px",borderRadius:4,color:"#1a6fc4",fontWeight:700}}>본인 회사 이메일 전체</code>
                </div>
                <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#dc2626",lineHeight:1.7}}>
                  ⚠️ <strong>주의:</strong> <code style={{background:"#fee2e2",padding:"1px 5px",borderRadius:3}}>info</code> 처럼 앞부분만 입력하면 오류납니다.<br/>
                  반드시 <code style={{background:"#fee2e2",padding:"1px 5px",borderRadius:3}}>info@dreamacademyph.com</code> 처럼 <strong>전체 이메일 주소</strong>를 입력하세요.
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
                  <span style={{color:"#6b7c93",fontWeight:600}}>비밀번호</span>
                  <code style={{background:"#e0e7ff",padding:"3px 10px",borderRadius:4,color:"#1a6fc4",fontWeight:700}}>메일박스 생성시 설정한 비번</code>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
                  <span style={{color:"#6b7c93",fontWeight:600}}>POP 서버</span>
                  <code style={{background:"#e0e7ff",padding:"3px 10px",borderRadius:4,color:"#1a6fc4",fontWeight:700}}>mail.privateemail.com</code>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
                  <span style={{color:"#6b7c93",fontWeight:600}}>포트</span>
                  <code style={{background:"#e0e7ff",padding:"3px 10px",borderRadius:4,color:"#1a6fc4",fontWeight:700}}>995</code>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
                  <span style={{color:"#6b7c93",fontWeight:600}}>SSL 사용</span>
                  <span style={{fontWeight:700,color:"#16a34a"}}>✅ 체크</span>
                </div>
              </div>
            </div>
          </div>

          <div className="step">
            <div className="step-dot" style={{background:"#7c3aed"}}>4</div>
            <div className="step-line"/>
            <div className="step-body">
              <h3>보내기 설정 <span style={{fontSize:11,color:"#94a3b8",fontWeight:400}}>(선택)</span></h3>
              <p style={{fontSize:13,color:"#4a5568",marginBottom:8}}>Gmail에서 회사 이메일로 직접 보내고 싶을 때:</p>
              <ul>
                <li><strong>&quot;이름으로 메일 보내기&quot;</strong> → <strong>&quot;다른 이메일 주소 추가&quot;</strong></li>
              </ul>
              <div style={{background:"#f8fafc",borderRadius:10,padding:16,margin:"8px 0",display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
                  <span style={{color:"#6b7c93",fontWeight:600}}>SMTP 서버</span>
                  <code style={{background:"#e0e7ff",padding:"3px 10px",borderRadius:4,color:"#1a6fc4",fontWeight:700}}>mail.privateemail.com</code>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
                  <span style={{color:"#6b7c93",fontWeight:600}}>포트</span>
                  <code style={{background:"#e0e7ff",padding:"3px 10px",borderRadius:4,color:"#1a6fc4",fontWeight:700}}>465</code>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
                  <span style={{color:"#6b7c93",fontWeight:600}}>SSL 사용</span>
                  <span style={{fontWeight:700,color:"#16a34a"}}>✅ 체크</span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}>
                  <span style={{color:"#6b7c93",fontWeight:600}}>사용자 이름 + 비밀번호</span>
                  <code style={{background:"#e0e7ff",padding:"3px 10px",borderRadius:4,color:"#1a6fc4",fontWeight:700}}>회사 이메일 계정 정보</code>
                </div>
                <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#dc2626",lineHeight:1.7}}>
                  ⚠️ <strong>주의:</strong> 사용자 이름은 <code style={{background:"#fee2e2",padding:"1px 5px",borderRadius:3}}>info</code> 가 아닌 <code style={{background:"#fee2e2",padding:"1px 5px",borderRadius:3}}>info@dreamacademyph.com</code> 처럼 <strong>전체 이메일 주소</strong>를 입력하세요.
                </div>
              </div>
            </div>
          </div>

          <div className="step">
            <div className="step-dot" style={{background:"#16a34a"}}>✓</div>
            <div className="step-body">
              <h3>완료!</h3>
              <p style={{fontSize:14,color:"#4a5568",lineHeight:1.8}}>설정 완료 후 Gmail에서 회사 이메일이 자동으로 수신됩니다 😊</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 섹션6: FAQ ── */}
      <div className="sec">
        <h2>❓ 자주 묻는 것들</h2>
        {faqs.map((f, i) => (
          <div className="faq-item" key={i}>
            <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <span>Q. {f.q}</span>
              <span className={`faq-arrow${openFaq === i ? " open" : ""}`}>▼</span>
            </div>
            {openFaq === i && <div className="faq-a">A. {f.a}</div>}
          </div>
        ))}
      </div>

      {/* ── 하단 ── */}
      <div className="g-footer">
        <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">
          💬 카카오톡 문의하기
        </a>
      </div>
    </div>
  </>);
}
