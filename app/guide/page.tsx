"use client";
import { useState, useEffect } from "react";

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";

export default function GuidePage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [tab, setTab] = useState(0);
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

  const TABS = ["전체 업무 흐름", "이메일 설정", "직원관리 페이지"];

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.gw{max-width:860px;margin:0 auto;padding:32px 24px 60px;}
.g-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px;}
.g-top h1{font-size:24px;font-weight:800;line-height:1.4;}
.g-top p{font-size:13px;color:#6b7c93;margin-top:4px;}
.g-back{padding:8px 16px;background:#fff;color:#6b7c93;font-size:13px;font-weight:600;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;white-space:nowrap;}.g-back:hover{color:#1a6fc4;border-color:#1a6fc4;}

.tab-row{display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap;}
.tab-b{padding:10px 20px;border-radius:10px;font-size:14px;font-weight:700;border:1px solid #e2e8f0;background:#fff;color:#6b7c93;cursor:pointer;transition:all 150ms;font-family:'Noto Sans KR',sans-serif;}
.tab-b:hover{border-color:#1a6fc4;color:#1a6fc4;}
.tab-b.active{background:#1a6fc4;color:#fff;border-color:#1a6fc4;}

.sec{background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:20px;}
.sec h2{font-size:17px;font-weight:800;margin-bottom:20px;display:flex;align-items:center;gap:8px;}
.sec h3{font-size:15px;font-weight:700;margin:20px 0 12px;color:#1a1a2e;}

.steps{display:flex;flex-direction:column;gap:0;}
.step{display:flex;gap:16px;position:relative;}
.step-line{width:3px;background:#e2e8f0;position:absolute;left:19px;top:42px;bottom:-2px;}
.step:last-child .step-line{display:none;}
.step-dot{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0;z-index:1;}
.step-body{flex:1;padding-bottom:24px;}
.step-body h3{font-size:15px;font-weight:700;margin-bottom:6px;margin-top:0;display:flex;align-items:center;gap:6px;}
.step-body .tag{font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px;color:#fff;}
.step-body ul{padding-left:18px;margin:0;}.step-body li{font-size:13px;line-height:1.9;color:#4a5568;}
.step-body li code{background:#f1f5f9;padding:1px 6px;border-radius:4px;font-size:12px;color:#1a6fc4;font-family:monospace;}

.status-flow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
.status-item{padding:8px 16px;border-radius:10px;font-size:13px;font-weight:700;text-align:center;}
.status-arrow{color:#94a3b8;font-size:18px;font-weight:700;}

.url-tbl{width:100%;border-collapse:collapse;}
.url-tbl th{font-size:11px;font-weight:700;color:#6b7c93;padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;text-transform:uppercase;}
.url-tbl td{font-size:13px;padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#4a5568;}
.url-tbl td:first-child{font-weight:600;color:#1a1a2e;}
.url-tbl td:nth-child(2){font-family:monospace;color:#1a6fc4;}
.url-tbl tr:hover td{background:#f8fafc;}

.info-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;font-size:13px;color:#1e40af;line-height:1.8;margin:12px 0;}
.warn-box{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;font-size:13px;color:#dc2626;line-height:1.8;margin:12px 0;}

.feat-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:14px;}
.feat-card h4{font-size:14px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px;}
.feat-card ul{padding-left:18px;margin:0;}.feat-card li{font-size:13px;line-height:1.9;color:#4a5568;}

.g-footer{text-align:center;margin-top:32px;}
.g-footer a{display:inline-flex;align-items:center;gap:6px;padding:12px 24px;background:#fee500;color:#3c1e1e;font-size:14px;font-weight:700;border-radius:10px;text-decoration:none;}.g-footer a:hover{background:#fdd835;}

@media(max-width:600px){.gw{padding:20px 16px 40px;}.tab-row{gap:6px;}.tab-b{padding:8px 14px;font-size:13px;}.sec{padding:20px;}}
    `}</style>

    <div className="gw">
      <div className="g-top">
        <div>
          <h1>드림아카데미 직원 업무 가이드</h1>
          <p>예약 시스템 사용 매뉴얼 · 현재 시스템 기준</p>
        </div>
        <a href="/admin" className="g-back">← 관리자 홈</a>
      </div>

      {/* 탭 버튼 */}
      <div className="tab-row">
        {TABS.map((t, i) => (
          <button key={i} className={`tab-b${tab === i ? ' active' : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* ════════════ 탭 1: 전체 업무 흐름 ════════════ */}
      {tab === 0 && (<>
        {/* 로그인 */}
        <div className="sec">
          <h2>🔐 로그인</h2>
          <ul style={{paddingLeft:18}}>
            <li style={{fontSize:13,lineHeight:'1.9',color:'#4a5568'}}><code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>dreamacademyph.com/admin</code> 접속</li>
            <li style={{fontSize:13,lineHeight:'1.9',color:'#4a5568'}}>개인 아이디/비번으로 로그인 (admin-may, admin-jenna 등)</li>
            <li style={{fontSize:13,lineHeight:'1.9',color:'#4a5568'}}>로그인 후 자동으로 관리자 허브(<code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>/admin/hub</code>)로 이동</li>
            <li style={{fontSize:13,lineHeight:'1.9',color:'#4a5568'}}>24시간 자동 로그인 유지</li>
          </ul>
        </div>

        {/* 관리자 허브 메뉴 */}
        <div className="sec">
          <h2>🏠 관리자 허브 메뉴</h2>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:12,background:'#f0f7ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'14px 18px'}}>
              <span style={{fontSize:24}}>📋</span>
              <div><strong style={{fontSize:14}}>예약관리</strong><p style={{fontSize:12,color:'#6b7c93',margin:0}}>부킹 / 인보이스 / 영수증 / 견적계산기</p></div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12,background:'#f0f7ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'14px 18px'}}>
              <span style={{fontSize:24}}>⚙️</span>
              <div><strong style={{fontSize:14}}>사이트관리</strong><p style={{fontSize:12,color:'#6b7c93',margin:0}}>공지 / 셔틀 / 필드트립 / 회원</p></div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12,background:'#f0f7ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'14px 18px'}}>
              <span style={{fontSize:24}}>👥</span>
              <div><strong style={{fontSize:14}}>직원업무</strong><p style={{fontSize:12,color:'#6b7c93',margin:0}}>팀 업무 관리 페이지</p></div>
            </div>
          </div>
        </div>

        {/* 손님 견적 흐름 */}
        <div className="sec">
          <h2>🧮 손님 자체 견적 흐름</h2>
          <div className="steps">
            <div className="step">
              <div className="step-dot" style={{background:"#8b5cf6"}}>1</div>
              <div className="step-line"/>
              <div className="step-body">
                <h3>견적 페이지 접속</h3>
                <ul>
                  <li>손님이 홈페이지 메인에서 <strong>[견적 내보기]</strong> 버튼 클릭</li>
                  <li><code>/estimate</code> 페이지에서 숙소/기간/인원 선택 → 정가 기준 견적 자동 계산</li>
                </ul>
              </div>
            </div>
            <div className="step">
              <div className="step-dot" style={{background:"#8b5cf6"}}>2</div>
              <div className="step-line"/>
              <div className="step-body">
                <h3>할인가 안내 유도</h3>
                <ul>
                  <li>하단 &quot;💡 실제 할인가는 정가보다 훨씬 저렴합니다!&quot; 문구 확인</li>
                  <li><strong>[할인가 확인하러 가기]</strong> 버튼 → 카카오톡 채널로 연결</li>
                </ul>
              </div>
            </div>
            <div className="step">
              <div className="step-dot" style={{background:"#8b5cf6"}}>3</div>
              <div className="step-body">
                <h3>상담 및 예약 연결</h3>
                <ul>
                  <li>담당자가 카카오톡으로 실제 할인가 안내 및 상담 진행</li>
                  <li>상담 후 예약 접수로 연결</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="warn-box">
            ⚠️ <code style={{background:"#fee2e2",padding:"1px 5px",borderRadius:3}}>/estimate</code> 견적은 <strong>정가 기준</strong>입니다. 실제 할인가는 어드민 견적계산기(<code style={{background:"#fee2e2",padding:"1px 5px",borderRadius:3}}>/admin/bookings</code> 견적탭)에서 계산하여 손님께 안내해주세요.
          </div>
        </div>

        {/* 예약 처리 전체 흐름 */}
        <div className="sec">
          <h2>📌 예약 처리 전체 흐름</h2>
          <div className="steps">
            <div className="step">
              <div className="step-dot" style={{background:"#1a6fc4"}}>1</div>
              <div className="step-line"/>
              <div className="step-body">
                <h3><span className="tag" style={{background:"#1a6fc4"}}>접수</span> 손님 예약 접수</h3>
                <ul>
                  <li><code>/booking</code> 페이지에서 손님이 직접 접수</li>
                  <li>또는 어드민에서 <strong>[+ 새 예약 접수]</strong> 버튼으로 직접 입력</li>
                  <li>상태: <strong>&quot;접수&quot;</strong>로 자동 설정</li>
                </ul>
              </div>
            </div>

            <div className="step">
              <div className="step-dot" style={{background:"#16a34a"}}>2</div>
              <div className="step-line"/>
              <div className="step-body">
                <h3><span className="tag" style={{background:"#16a34a"}}>지정</span> 담당자 지정</h3>
                <ul>
                  <li>어드민 부킹 리스트에서 담당자 드롭다운으로 지정</li>
                  <li>May / Jamin / Yuna / Jena 중 선택</li>
                </ul>
              </div>
            </div>

            <div className="step">
              <div className="step-dot" style={{background:"#8b5cf6"}}>3</div>
              <div className="step-line"/>
              <div className="step-body">
                <h3><span className="tag" style={{background:"#8b5cf6"}}>견적</span> 견적 계산 (필요시)</h3>
                <ul>
                  <li>견적계산기 탭에서 1안/2안 계산</li>
                  <li>정가 및 할인가 산출</li>
                  <li>이미지 저장 후 손님에게 전달</li>
                </ul>
              </div>
            </div>

            <div className="step">
              <div className="step-dot" style={{background:"#d97706"}}>4</div>
              <div className="step-line"/>
              <div className="step-body">
                <h3><span className="tag" style={{background:"#d97706"}}>발행</span> 인보이스 발행</h3>
                <ul>
                  <li><strong>[인보이스]</strong> 버튼 클릭</li>
                  <li>금액, 체크인, 숙소 정보 입력</li>
                  <li>상태: <strong>&quot;인보이스발행&quot;</strong>으로 자동 변경</li>
                </ul>
              </div>
            </div>

            <div className="step">
              <div className="step-dot" style={{background:"#0891b2"}}>5</div>
              <div className="step-line"/>
              <div className="step-body">
                <h3><span className="tag" style={{background:"#0891b2"}}>결제</span> 결제 링크 발송</h3>
                <ul>
                  <li>인보이스 페이지에서 <strong>[💳 결제링크]</strong> 버튼</li>
                  <li>링크 복사 후 손님에게 전달</li>
                  <li>손님이 PayPal로 결제</li>
                </ul>
              </div>
            </div>

            <div className="step">
              <div className="step-dot" style={{background:"#7c3aed"}}>6</div>
              <div className="step-line"/>
              <div className="step-body">
                <h3><span className="tag" style={{background:"#7c3aed"}}>영수증</span> 영수증 발행</h3>
                <ul>
                  <li><strong>[영수증]</strong> 버튼 클릭</li>
                  <li>Google Sheets 자동 기록</li>
                  <li>상태: <strong>&quot;영수증발행&quot;</strong>으로 자동 변경</li>
                </ul>
              </div>
            </div>

            <div className="step">
              <div className="step-dot" style={{background:"#64748b"}}>7</div>
              <div className="step-body">
                <h3><span className="tag" style={{background:"#64748b"}}>완료</span> 완료 처리</h3>
                <ul>
                  <li>모든 절차 완료 후 상태 <strong>&quot;완료&quot;</strong>로 변경</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 예약 상태 흐름 */}
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
        </div>

        {/* 주요 URL */}
        <div className="sec">
          <h2>🔗 주요 URL</h2>
          <div style={{overflowX:'auto'}}>
            <table className="url-tbl">
              <thead><tr><th>페이지</th><th>URL</th><th>설명</th></tr></thead>
              <tbody>
                <tr><td>메인</td><td>/</td><td>홈페이지</td></tr>
                <tr><td>예약접수</td><td>/booking</td><td>손님 예약폼</td></tr>
                <tr><td>어드민 로그인</td><td>/admin</td><td>직원 로그인</td></tr>
                <tr><td>관리자 허브</td><td>/admin/hub</td><td>메인 메뉴</td></tr>
                <tr><td>예약관리</td><td>/admin/bookings</td><td>부킹/인보이스/영수증</td></tr>
                <tr><td>견적계산기</td><td>/admin/bookings</td><td>견적탭에서 계산</td></tr>
                <tr><td>인보이스</td><td>/invoice</td><td>인보이스 작성</td></tr>
                <tr><td>영수증</td><td>/receipt</td><td>영수증 발행</td></tr>
                <tr><td>직원업무</td><td>/staff</td><td>팀 업무 관리</td></tr>
                <tr><td>직원가이드</td><td>/guide</td><td>이 페이지</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {/* ════════════ 탭 2: 이메일 설정 ════════════ */}
      {tab === 1 && (<>
        <div className="sec">
          <h2>📧 회사 이메일 Gmail 연동 방법</h2>
          <p style={{fontSize:14,color:"#4a5568",lineHeight:1.8,marginBottom:20}}>
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
                  <div className="warn-box">
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
                  <div className="warn-box">
                    ⚠️ <strong>주의:</strong> 사용자 이름은 <code style={{background:"#fee2e2",padding:"1px 5px",borderRadius:3}}>info</code> 가 아닌 <code style={{background:"#fee2e2",padding:"1px 5px",borderRadius:3}}>info@dreamacademyph.com</code> 처럼 <strong>전체 이메일 주소</strong>를 입력하세요.
                  </div>
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-dot" style={{background:"#16a34a"}}>✓</div>
              <div className="step-body">
                <h3>완료!</h3>
                <p style={{fontSize:14,color:"#4a5568",lineHeight:1.8}}>설정 완료 후 Gmail에서 회사 이메일이 자동으로 수신됩니다</p>
              </div>
            </div>
          </div>
        </div>
      </>)}

      {/* ════════════ 탭 3: 직원관리 페이지 사용법 ════════════ */}
      {tab === 2 && (<>
        {/* 초기 계정 정보 */}
        <div className="sec">
          <h2>🔑 초기 계정 정보</h2>
          <div style={{overflowX:'auto'}}>
            <table className="url-tbl">
              <thead><tr><th>아이디</th><th>초기 비밀번호</th><th>이동 페이지</th></tr></thead>
              <tbody>
                <tr><td>admin-may</td><td style={{fontFamily:'monospace',color:'#1a6fc4'}}>may1234</td><td>/admin/hub (전체)</td></tr>
                <tr><td>admin-ceo</td><td style={{fontFamily:'monospace',color:'#1a6fc4'}}>ceo1234</td><td>/admin/hub (전체)</td></tr>
                <tr><td>admin-jenna</td><td style={{fontFamily:'monospace',color:'#1a6fc4'}}>jenna1234</td><td>/staff (jenna)</td></tr>
                <tr><td>admin-jamie</td><td style={{fontFamily:'monospace',color:'#1a6fc4'}}>jamie1234</td><td>/staff (jamie)</td></tr>
                <tr><td>admin-yuna</td><td style={{fontFamily:'monospace',color:'#1a6fc4'}}>yuna1234</td><td>/staff (yuna)</td></tr>
                <tr><td>admin-hanny</td><td style={{fontFamily:'monospace',color:'#1a6fc4'}}>hanny1234</td><td>/staff (hanny)</td></tr>
                <tr><td>admin-sage</td><td style={{fontFamily:'monospace',color:'#1a6fc4'}}>sage1234</td><td>/staff (sage)</td></tr>
                <tr><td>admin-eric</td><td style={{fontFamily:'monospace',color:'#1a6fc4'}}>eric1234</td><td>/staff (eric)</td></tr>
              </tbody>
            </table>
          </div>
          <div className="info-box">
            🔒 초기 비밀번호는 반드시 변경해주세요. <strong>설정(⚙️) → 비밀번호 변경 탭</strong>에서 변경 가능합니다.
          </div>
        </div>

        {/* 접속 방법 */}
        <div className="sec">
          <h2>🚀 접속 방법</h2>
          <ul style={{paddingLeft:18}}>
            <li style={{fontSize:13,lineHeight:'1.9',color:'#4a5568'}}><code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>dreamacademyph.com/admin</code> 에서 개인 아이디로 로그인</li>
            <li style={{fontSize:13,lineHeight:'1.9',color:'#4a5568'}}>관리자 허브에서 <strong>[👥 직원업무]</strong> 클릭</li>
            <li style={{fontSize:13,lineHeight:'1.9',color:'#4a5568'}}>또는 직접 접속: <code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>dreamacademyph.com/staff</code></li>
          </ul>
        </div>

        {/* 화면 구성 */}
        <div className="sec">
          <h2>🖥 화면 구성</h2>
          <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
            <div style={{flex:'1 1 200px',background:'#f0f7ff',border:'1px solid #bfdbfe',borderRadius:10,padding:16}}>
              <strong style={{fontSize:13,color:'#1e40af'}}>왼쪽 사이드바</strong>
              <ul style={{paddingLeft:18,marginTop:8}}>
                {['홈','전체업무','달력','프로젝트','직원공간','설정'].map(m => (
                  <li key={m} style={{fontSize:13,lineHeight:'1.9',color:'#4a5568'}}>{m}</li>
                ))}
              </ul>
            </div>
            <div style={{flex:'2 1 300px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:16}}>
              <strong style={{fontSize:13,color:'#64748b'}}>오른쪽 메인</strong>
              <p style={{fontSize:13,color:'#4a5568',marginTop:8}}>선택한 페이지의 내용이 표시됩니다</p>
            </div>
          </div>
        </div>

        {/* 주요 기능 설명 */}
        <div className="sec">
          <h2>⭐ 주요 기능</h2>

          <div className="feat-card">
            <h4>☀️ 데일리 체크 (매일 할 일)</h4>
            <ul>
              <li>직원 개인 페이지 → <strong>데일리 탭</strong> (기본 선택)</li>
              <li>오늘 할 일 입력 후 Enter</li>
              <li>완료시 체크박스 클릭</li>
              <li>매일 고정 항목: <strong>설정(⚙️) → 고정 항목 탭</strong>에서 관리</li>
            </ul>
          </div>

          <div className="feat-card">
            <h4>📋 업무 추가/관리</h4>
            <ul>
              <li><strong>[+ 업무 추가]</strong> 버튼 클릭</li>
              <li>제목, 마감일, 담당자, 메모 입력</li>
              <li>진행률 슬라이더로 진행 상태 업데이트</li>
              <li>체크리스트로 세부 항목 관리</li>
            </ul>
          </div>

          <div className="feat-card">
            <h4>📁 프로젝트</h4>
            <ul>
              <li>여러 업무를 하나의 프로젝트로 묶어 관리</li>
              <li>팀 채팅으로 프로젝트별 소통</li>
              <li>진행률 자동 계산</li>
            </ul>
          </div>

          <div className="feat-card">
            <h4>📅 달력</h4>
            <ul>
              <li>월간/주간 뷰로 마감일 확인</li>
              <li>공유된 업무만 달력에 표시</li>
            </ul>
          </div>
        </div>

        {/* 설정 모달 */}
        <div className="sec">
          <h2>⚙️ 설정 모달</h2>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[
              {tab:'탭1: 고정 항목 관리',desc:'매일 반복할 항목 설정'},
              {tab:'탭2: 업무 템플릿',desc:'자주 쓰는 업무 템플릿 저장'},
              {tab:'탭3: 월간 목표',desc:'이번 달 목표 설정 및 진행률'},
              {tab:'탭4: 알림 설정',desc:'마감일 브라우저 알림 on/off'},
              {tab:'탭5: 비밀번호 변경',desc:'개인 로그인 비번 변경'},
            ].map((s,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:12,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 18px'}}>
                <span style={{background:'#1a6fc4',color:'#fff',fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:6,whiteSpace:'nowrap'}}>{s.tab}</span>
                <span style={{fontSize:13,color:'#4a5568'}}>{s.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 기타 기능 */}
        <div className="sec">
          <h2>🔧 기타 기능</h2>

          <div className="feat-card">
            <h4>⏱ 포모도로 타이머</h4>
            <ul>
              <li>업무 카드의 ⏱ 버튼 클릭</li>
              <li>25분 집중 타이머 시작</li>
              <li>완료시 알림</li>
            </ul>
          </div>

          <div className="feat-card">
            <h4>🗑 완료 업무 정리</h4>
            <ul>
              <li>직원 개인 페이지 → <strong>완료 탭</strong></li>
              <li>체크박스로 선택 후 <strong>[선택 삭제]</strong></li>
              <li>또는 <strong>[전체 삭제]</strong>로 한번에 정리</li>
            </ul>
          </div>
        </div>
      </>)}

      {/* 하단 */}
      <div className="g-footer">
        <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">
          💬 카카오톡 문의하기
        </a>
      </div>
    </div>
  </>);
}
