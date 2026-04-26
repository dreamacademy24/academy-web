"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { isAdminAuthed, setAdminAuthed } from "@/lib/adminAuth";

const ADMIN_PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";

export default function GuidePage() {
  return (
    <Suspense fallback={null}>
      <GuideInner />
    </Suspense>
  );
}

function GuideInner() {
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [tab, setTab] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (isAdminAuthed()) setAuthed(true);
    }
    if (searchParams.get("tab") === "tutor") setTab(3);
  }, [searchParams]);

  function checkPw() {
    if (pw === ADMIN_PW) {
      setAdminAuthed('admin-guide');
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
      <div style={{ position: "relative" }}>
        <input className="pw-i" style={{ paddingRight: 44 }} type={showPw ? "text" : "password"} placeholder="비밀번호" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === "Enter") checkPw(); }} />
        <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, padding: 4, color: "#94a3b8" }} aria-label={showPw ? "숨기기" : "보기"}>{showPw ? "🙈" : "👁"}</button>
      </div>
      <button className="pw-b" onClick={checkPw}>로그인</button>
      <a href="/admin" className="bk-link">← 관리자 홈</a>
    </div></div>
  </>);

  const TABS = ["전체 업무 흐름", "이메일 설정", "직원관리 페이지", "🌐 Tutor Guide (EN)"];

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
.callout-yellow{background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:14px 18px;font-size:13px;color:#78350f;line-height:1.8;margin:12px 0;}
.callout-blue{background:#dbeafe;border:1px solid #93c5fd;border-radius:10px;padding:14px 18px;font-size:13px;color:#1e3a8a;line-height:1.8;margin:12px 0;}
.callout-green{background:#dcfce7;border:1px solid #86efac;border-radius:10px;padding:14px 18px;font-size:13px;color:#166534;line-height:1.8;margin:12px 0;}
.tutor-clr-tbl{width:100%;border-collapse:collapse;margin:12px 0;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;}
.tutor-clr-tbl th{background:#f8fafc;padding:10px 12px;text-align:left;font-size:12px;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0;}
.tutor-clr-tbl td{padding:10px 12px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;}
.tutor-clr-tbl tr:last-child td{border-bottom:none;}
.tutor-clr-sw{display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:middle;margin-right:8px;}
.qa-item{background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #60a5fa;border-radius:8px;padding:12px 16px;margin-bottom:10px;}
.qa-item .q{font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:6px;}
.qa-item .a{font-size:13px;color:#475569;line-height:1.8;margin:0;}
.num-step{display:flex;gap:10px;align-items:flex-start;margin-bottom:8px;font-size:13px;line-height:1.8;color:#4a5568;}
.num-step .num{display:inline-flex;width:22px;height:22px;border-radius:50%;background:#dbeafe;color:#1e40af;font-size:11px;font-weight:800;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;}
.screenshot-ph{background:#f1f5f9;border:1px dashed #cbd5e1;border-radius:8px;padding:14px;text-align:center;font-size:12px;color:#64748b;margin:12px 0;}

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

        {/* 🎥 화상영어 시스템 */}
        <div className="sec">
          <h2>🎥 화상영어 시스템</h2>

          <div className="callout-yellow">
            ⚠️ <strong>변경 공지:</strong> Team Manager 사이드바에서 화상영어 섹션이 제거되었습니다.
            화상영어 업무는 어드민 허브의 <strong>[화상영어]</strong> 또는 <strong>[Online Class]</strong> 카드를 사용하세요.
          </div>

          <h3>🎨 튜터 색상 약속</h3>
          <p style={{fontSize:13,color:'#4a5568',lineHeight:1.8,marginBottom:8}}>각 튜터는 고유 색상이 있어 스케줄에서 한눈에 구분 가능. 카드 좌측 세로 바가 해당 튜터 색깔로 표시됨.</p>
          <table className="tutor-clr-tbl">
            <thead><tr><th>튜터</th><th>색상</th><th>헥스</th></tr></thead>
            <tbody>
              <tr><td><strong>T.Ann</strong></td><td><span className="tutor-clr-sw" style={{background:'#3b82f6'}}/>🔵 파랑</td><td><code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>#3b82f6</code></td></tr>
              <tr><td><strong>T.Angel</strong></td><td><span className="tutor-clr-sw" style={{background:'#8b5cf6'}}/>🟣 보라</td><td><code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>#8b5cf6</code></td></tr>
              <tr><td><strong>T.Carla</strong></td><td><span className="tutor-clr-sw" style={{background:'#10b981'}}/>🟢 초록</td><td><code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>#10b981</code></td></tr>
              <tr><td><strong>T.Amelyn</strong></td><td><span className="tutor-clr-sw" style={{background:'#ec4899'}}/>🩷 분홍</td><td><code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>#ec4899</code></td></tr>
              <tr><td><strong>T.Cristel</strong></td><td><span className="tutor-clr-sw" style={{background:'#f59e0b'}}/>🟠 주황</td><td><code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>#f59e0b</code></td></tr>
            </tbody>
          </table>

          <h3>📋 자주 하는 작업 — 한국 관리자 기준</h3>

          <h4 style={{fontSize:14,fontWeight:700,color:'#1a6fc4',margin:'16px 0 8px'}}>① 학생의 출결 확인하고 싶을 때</h4>
          <div className="num-step"><span className="num">1</span><span><code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>dreamacademyph.com/admin</code> 로그인</span></div>
          <div className="num-step"><span className="num">2</span><span>어드민 허브에서 <strong>[화상영어]</strong> 카드 클릭</span></div>
          <div className="num-step"><span className="num">3</span><span>수강생 목록에서 학생 찾기 (학생명/영문명 검색 가능)</span></div>
          <div className="num-step"><span className="num">4</span><span>해당 행의 <strong>[출결]</strong> 버튼 클릭 → 세션 그리드가 펼쳐짐</span></div>
          <div className="num-step"><span className="num">5</span><span>
            날짜 셀 확인:
            <ul style={{paddingLeft:18,marginTop:4}}>
              <li><strong>O</strong> = Attended (출석)</li>
              <li><strong>X</strong> = Absent (결석)</li>
              <li><strong>△</strong> = Makeup (보강)</li>
              <li><strong>-</strong> = Scheduled (예정)</li>
              <li>우상단 <strong>💬</strong> = 튜터가 메모 작성함</li>
            </ul>
          </span></div>
          <div className="num-step"><span className="num">6</span><span>그리드 아래 노란 박스에서 튜터 메모 전문 확인</span></div>
          <div className="callout-blue">💡 <strong>읽기 전용:</strong> 메모는 튜터만 수정 가능. 한국 관리자는 확인만.</div>
          <div className="screenshot-ph">📸 스크린샷 추가 예정 — 2-online-class-korean.png / 8-tutor-memo.png</div>

          <h4 style={{fontSize:14,fontWeight:700,color:'#1a6fc4',margin:'20px 0 8px'}}>② 오늘/이번 주 전체 수업 현황 보기</h4>
          <div className="num-step"><span className="num">1</span><span>어드민 허브에서 <strong>[Online Class]</strong> 카드 클릭</span></div>
          <div className="num-step"><span className="num">2</span><span>제목: &quot;Online Class — Attendance Monitor&quot;</span></div>
          <div className="num-step"><span className="num">3</span><span>
            <strong>Today&apos;s Schedule 탭</strong>: 오늘 수업 전체 (2-컬럼 그리드)
            <ul style={{paddingLeft:18,marginTop:4}}>
              <li>날짜 네비게이션: <strong>◀ Previous</strong> / Date / <strong>Next ▶</strong></li>
              <li>중앙 날짜 클릭 → 달력으로 특정일 선택</li>
            </ul>
          </span></div>
          <div className="num-step"><span className="num">4</span><span>
            <strong>This Week 탭</strong>: 7-컬럼 가로형 (Mon~Sun)
            <ul style={{paddingLeft:18,marginTop:4}}>
              <li><strong>◀ Previous Week</strong> / This Week Apr 13 – Apr 19 / <strong>Next Week ▶</strong></li>
              <li>미래/과거 주 무제한 이동 가능</li>
            </ul>
          </span></div>
          <div className="screenshot-ph">📸 스크린샷 추가 예정 — 3-attendance-monitor.png / 7-week-grid.png</div>

          <h4 style={{fontSize:14,fontWeight:700,color:'#1a6fc4',margin:'20px 0 8px'}}>③ CEO가 특정 튜터 시점으로 보기 (CEO 전용)</h4>
          <div className="num-step"><span className="num">1</span><span><strong>[Online Class]</strong> 카드 접속</span></div>
          <div className="num-step"><span className="num">2</span><span>상단 &quot;<strong>👤 View as:</strong>&quot; 드롭다운 → 원하는 튜터 선택</span></div>
          <div className="num-step"><span className="num">3</span><span>&quot;Viewing: T.Angel&quot; 배지 표시, 해당 튜터 수업만 보임</span></div>
          <div className="num-step"><span className="num">4</span><span><strong>Clear filter</strong> 링크로 해제</span></div>
          <div className="callout-blue">💡 <strong>일반 직원은 이 드롭다운이 안 보임</strong> (CEO/관리자만)</div>

          <h3>🔄 데이터 실시간 연동 — 중요</h3>
          <p style={{fontSize:13,color:'#4a5568',lineHeight:1.8,marginBottom:8}}>튜터가 Today 탭에서 출결 찍고 노트 쓰면:</p>
          <ul style={{paddingLeft:18,marginBottom:12}}>
            <li style={{fontSize:13,lineHeight:1.9,color:'#4a5568'}}>1초 이내 DB 저장됨</li>
            <li style={{fontSize:13,lineHeight:1.9,color:'#4a5568'}}>한국 관리자 페이지 새로고침하면 바로 반영</li>
            <li style={{fontSize:13,lineHeight:1.9,color:'#4a5568'}}>사용/잔여 카운트 자동 계산</li>
            <li style={{fontSize:13,lineHeight:1.9,color:'#4a5568'}}>노트 있으면 💬 아이콘 + 노란 박스 자동 표시</li>
          </ul>

          <h3>⚠️ 자주 발생하는 문제 + 해결법</h3>
          <div className="qa-item"><div className="q">Q1. 튜터가 출결 잘못 찍었어요</div><p className="a">→ 튜터가 본인 Today 탭에서 <strong>[↺ Undo]</strong> 클릭하면 Scheduled로 복원됨</p></div>
          <div className="qa-item"><div className="q">Q2. 메모를 관리자가 수정/삭제하고 싶어요</div><p className="a">→ 안 됨. 튜터 페이지에서만 수정 가능 (데이터 무결성 위해)<br/>→ 정 수정이 필요하면 튜터에게 요청해서 본인이 직접 수정</p></div>
          <div className="qa-item"><div className="q">Q3. 다른 날짜의 수업을 보고 싶어요</div><p className="a">→ Today 탭에서 <strong>◀ Previous</strong> / <strong>Next ▶</strong> 버튼 또는 날짜 클릭해서 달력으로 선택</p></div>
          <div className="qa-item"><div className="q">Q4. 다른 주를 미리 보고 싶어요</div><p className="a">→ This Week 탭에서 <strong>Previous Week</strong> / <strong>Next Week</strong> 버튼 (무제한)</p></div>
          <div className="qa-item"><div className="q">Q5. 학생의 세부 출결 기록을 전체 확인하고 싶어요</div><p className="a">→ 한국 관리자: 화상영어 → [출결] 클릭 → 전체 그리드<br/>→ 튜터: My Students → 영문명 클릭 → 월별 캘린더 모달</p></div>
          <div className="qa-item"><div className="q">Q6. 휴강일은 어떻게 처리되나요?</div><p className="a">→ 시스템에 2025-2026 휴강일 등록되어 있어 자동으로 수업일 제외함<br/>→ 아카데미 노란/보라 휴무 + 센터 초록 휴무 모두 포함</p></div>
          <div className="qa-item"><div className="q">Q7. 튜터 계정 비번을 잊어버렸어요</div><p className="a">→ 기본 비번: <code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>&#123;튜터이름&#125;2026!</code> (예: angel2026!)<br/>→ 재설정 필요하면 개발팀에게 요청</p></div>
          <div className="qa-item"><div className="q">Q8. 새 수강생은 어떻게 등록하나요?</div><p className="a">→ 화상영어 → <strong>[+ 수강 등록]</strong> 탭에서 폼 작성<br/>→ 자동으로 휴강일 제외하고 세션 생성됨</p></div>

          <h3>🔗 페이지 이동 맵</h3>
          <ul style={{paddingLeft:18}}>
            <li style={{fontSize:13,lineHeight:1.9,color:'#4a5568'}}>허브 → 화상영어: <code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>/admin/hub</code> → <strong>[화상영어]</strong> 카드</li>
            <li style={{fontSize:13,lineHeight:1.9,color:'#4a5568'}}>허브 → Online Class: <code style={{background:'#f1f5f9',padding:'1px 6px',borderRadius:4,fontSize:12,color:'#1a6fc4',fontFamily:'monospace'}}>/admin/hub</code> → <strong>[Online Class]</strong> 카드</li>
            <li style={{fontSize:13,lineHeight:1.9,color:'#4a5568'}}>Online Class → 튜터 페이지: 상단 <strong>[My Schedule (Tutor View) →]</strong> 버튼</li>
            <li style={{fontSize:13,lineHeight:1.9,color:'#4a5568'}}>튜터 페이지 → Online Class: 상단 <strong>[← Back to Attendance]</strong> 버튼</li>
            <li style={{fontSize:13,lineHeight:1.9,color:'#4a5568'}}>어디서든 가이드: 상단 <strong>[📖 Tutor Guide]</strong> / <strong>[📖 Guide]</strong> 버튼</li>
          </ul>
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
        {/* 변경 공지 */}
        <div className="sec">
          <div className="callout-yellow" style={{margin:0}}>
            ⚠️ <strong>중요:</strong> Team Manager 사이드바에서 화상영어 섹션이 제거되었습니다.
            화상영어 관련 업무는 어드민 허브의 <strong>[화상영어]</strong> 또는 <strong>[Online Class]</strong> 카드를 사용하세요.
            상세는 탭 1 &quot;🎥 화상영어 시스템&quot; 참조.
          </div>
        </div>

        {/* 초기 계정 정보 */}
        <div className="sec">
          <h2>🔑 초기 계정 정보</h2>
          <div style={{overflowX:'auto'}}>
            <table className="url-tbl">
              <thead><tr><th>아이디</th><th>초기 비밀번호</th><th>이동 페이지</th></tr></thead>
              <tbody>
<tr><td>admin-jamie</td><td style={{fontFamily:'monospace',color:'#1a6fc4'}}>jamie1234</td><td>/staff (jamie)</td></tr>
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

      {/* ════════════ 탭 4: Tutor Guide (English) ════════════ */}
      {tab === 3 && (<>
        <style>{`
.tg-tbl-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px;margin:12px 0}
.tg-cred{width:100%;border-collapse:collapse;font-size:13px;min-width:460px}
.tg-cred th{background:#f8fafc;padding:10px 14px;text-align:left;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0;font-size:12px}
.tg-cred td{padding:10px 14px;border-bottom:1px solid #f1f5f9;font-family:'SF Mono',Consolas,monospace;font-size:13px}
.tg-cred tr:last-child td{border-bottom:none}
.tg-status{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:14px 0}
.tg-status-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
.tg-status-card .lbl{font-weight:700;font-size:14px;margin-bottom:4px}
.tg-status-card .dsc{font-size:12px;color:#6b7c93;line-height:1.5}
.tg-status-card.attended{background:#f0fdf4;border-color:#bbf7d0}
.tg-status-card.attended .lbl{color:#166534}
.tg-status-card.absent{background:#fef2f2;border-color:#fecaca}
.tg-status-card.absent .lbl{color:#991b1b}
.tg-status-card.resched{background:#fff7ed;border-color:#fed7aa}
.tg-status-card.resched .lbl{color:#9a3412}
.tg-status-card.makeup{background:#fef3c7;border-color:#fde047}
.tg-status-card.makeup .lbl{color:#92400e}
.tg-callout{border-radius:8px;padding:12px 16px;margin:12px 0;font-size:13px;line-height:1.6}
.tg-callout.info{background:#eff6ff;border-left:4px solid #3b82f6;color:#1e3a8a}
.tg-callout.warn{background:#fef2f2;border-left:4px solid #dc2626;color:#991b1b}
.tg-sec p{font-size:14px;line-height:1.7;color:#475569;margin-bottom:10px}
.tg-sec ul, .tg-sec ol{padding-left:20px;margin:8px 0 12px}
.tg-sec li{font-size:14px;line-height:1.8;color:#475569}
.tg-sec code{background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:13px;color:#1a6fc4;font-family:'SF Mono',Consolas,monospace}
.tg-sec strong{color:#1a1a2e;font-weight:700}
.tg-sec a{color:#1a6fc4;text-decoration:none;font-weight:600}
.tg-sec a:hover{text-decoration:underline}
@media(max-width:600px){.tg-status{grid-template-columns:1fr}}
        `}</style>

        {/* 1. Login */}
        <div className="sec tg-sec">
          <h2>🔐 1. Login</h2>
          <p><strong>URL:</strong> <a href="https://dreamacademyph.com/login">https://dreamacademyph.com/login</a></p>
          <p>Use your assigned credentials below:</p>
          <div className="tg-tbl-wrap">
            <table className="tg-cred">
              <thead>
                <tr><th>Tutor</th><th>Username</th><th>Password</th></tr>
              </thead>
              <tbody>
                <tr><td>T.Ann</td><td>admin-ann</td><td>ann2026!</td></tr>
                <tr><td>T.Angel</td><td>admin-angel</td><td>angel2026!</td></tr>
                <tr><td>T.Carla</td><td>admin-carla</td><td>carla2026!</td></tr>
                <tr><td>T.Amelyn</td><td>admin-amelyn</td><td>amelyn2026!</td></tr>
                <tr><td>T.Cristel</td><td>admin-cristel</td><td>cristel2026!</td></tr>
              </tbody>
            </table>
          </div>
          <p>After login, you will be automatically redirected to your dashboard at <code>/tutor/online-class</code>.</p>
        </div>

        {/* 2. Your Dashboard */}
        <div className="sec tg-sec">
          <h2>📊 2. Your Dashboard</h2>
          <p>Your dashboard at <code>/tutor/online-class</code> has:</p>
          <ul>
            <li><strong>Student List</strong> — all students currently assigned to you, with schedule/time/remaining sessions.</li>
            <li><strong>Class Schedule</strong> — This Week / Next Week / Month view of upcoming sessions.</li>
            <li><strong>Attendance Log</strong> — past sessions with recorded status.</li>
          </ul>
        </div>

        {/* 3. Recording Attendance */}
        <div className="sec tg-sec">
          <h2>✍️ 3. Recording Attendance</h2>
          <p>After each class:</p>
          <ol>
            <li>Find the session in your schedule</li>
            <li>Click the <strong>[Attendance]</strong> button on the session row</li>
            <li>Select the appropriate status (see below)</li>
            <li>Add a short note if needed (optional)</li>
            <li>Save — the record is updated instantly</li>
          </ol>
          <h3>Status Options</h3>
          <div className="tg-status">
            <div className="tg-status-card attended">
              <div className="lbl">✓ Attended</div>
              <div className="dsc">Student joined and completed the class. Counts as one used session.</div>
            </div>
            <div className="tg-status-card absent">
              <div className="lbl">✗ Absent</div>
              <div className="dsc">Student did not join without prior notice. Counts as one used session.</div>
            </div>
            <div className="tg-status-card resched">
              <div className="lbl">⟳ Rescheduled</div>
              <div className="dsc">Class moved to another date. Select the new date when saving.</div>
            </div>
            <div className="tg-status-card makeup">
              <div className="lbl">△ Makeup</div>
              <div className="dsc">Compensation session for a previously missed class. Does not deduct from total.</div>
            </div>
          </div>
          <h3>Adding Notes (Optional)</h3>
          <p>Below the status buttons, you can add a note about the class if needed.</p>
          <p>Examples: student was late, technical issues, special situation.</p>
          <p>Notes are optional — leave blank if there&apos;s nothing special.</p>
          <p>Notes will automatically appear in the Korean admin&apos;s view as well.</p>
        </div>

        {/* 4. Schedule Rules */}
        <div className="sec tg-sec">
          <h2>📅 4. Class Schedule Rules</h2>
          <ul>
            <li>Classes follow each student&apos;s assigned days and Korea time. All times shown on your dashboard are <strong>Korea Standard Time (KST, UTC+9)</strong>.</li>
            <li>Philippine Time (PHT) is <strong>1 hour behind KST</strong> (e.g. KST 19:30 = PHT 18:30).</li>
            <li><strong>Saturday classes</strong> may have a different time than weekday classes — check each session carefully.</li>
            <li>Holiday dates (Korean public holidays, academy-specific closures) are <strong>automatically excluded</strong> from the schedule. No classes are generated on those days.</li>
          </ul>
        </div>

        {/* 5. Cancellation Policy */}
        <div className="sec tg-sec">
          <h2>⚠️ 5. Cancellation Policy</h2>
          <ul>
            <li><strong>4+ days before class:</strong> Free reschedule or cancel — <em>no session deducted</em>.</li>
            <li><strong>Less than 4 days before class:</strong> Session counts as <em>used</em> — no refund or reschedule.</li>
            <li><strong>No show without notice:</strong> Session counts as <em>used</em>.</li>
          </ul>
          <div className="tg-callout info">
            💡 Students manage their own cancellations through the customer portal. You only need to record the final attendance status after the class.
          </div>
        </div>

        {/* 6. Need Help */}
        <div className="sec tg-sec">
          <h2>💬 6. Need Help?</h2>
          <p>Contact <strong>May</strong> for:</p>
          <ul>
            <li>Login issues (forgot password, account locked)</li>
            <li>Student information changes</li>
            <li>Schedule conflicts or missing sessions</li>
            <li>Any technical problems with the system</li>
          </ul>
          <p style={{marginTop:14}}>
            📧 <a href="mailto:may@dreamacademyph.com">may@dreamacademyph.com</a>
          </p>
        </div>

        {/* 7. Common Issues */}
        <div className="sec tg-sec">
          <h2>🛟 7. Common Issues</h2>
          <div className="qa-item"><div className="q">Q1. I marked attendance by mistake.</div><p className="a">Click the <strong>[↺ Undo]</strong> button. Status returns to Scheduled.</p></div>
          <div className="qa-item"><div className="q">Q2. Notes won&apos;t save.</div><p className="a">Notes save automatically when you click outside the text box (blur) or change status. Make sure to wait 1-2 seconds before closing the page.</p></div>
          <div className="qa-item"><div className="q">Q3. Today tab shows wrong date.</div><p className="a">Use <strong>◀ Previous</strong> / <strong>Next ▶</strong> buttons to navigate. Click the date in the middle to open a calendar and pick a specific date. Click <strong>[Today]</strong> button to return to today.</p></div>
          <div className="qa-item"><div className="q">Q4. My students list is empty.</div><p className="a">Your tutor profile may not be linked to your account. Contact May to verify.</p></div>
          <div className="qa-item"><div className="q">Q5. I can&apos;t see other tutors&apos; students.</div><p className="a">That&apos;s by design. Each tutor only sees their own students. If you need to see someone else&apos;s schedule, ask May.</p></div>
          <div className="qa-item"><div className="q">Q6. I opened the wrong student&apos;s calendar.</div><p className="a">Click <strong>[Close]</strong> button or press <strong>ESC</strong> key.</p></div>
        </div>

        {/* 8. Best Practices */}
        <div className="sec tg-sec">
          <h2>⭐ 8. Best Practices</h2>

          <div className="callout-green">
            💚 <strong>Mark attendance right after class ends</strong><br/>
            Don&apos;t wait until end of day. You might forget details.
          </div>

          <div className="callout-green">
            💚 <strong>Keep notes short and factual</strong><br/>
            Good: &quot;Student joined 10 min late, made up for it&quot;<br/>
            Avoid: Long personal opinions or judgments
          </div>

          <div className="callout-green">
            💚 <strong>If unsure about status, leave as Scheduled</strong><br/>
            You can update later. Wrong status confuses admins.
          </div>

          <div className="callout-green">
            💚 <strong>Always verify time zone</strong><br/>
            Dashboard shows Korea Standard Time (KST, UTC+9). Philippine Time (PHT) is 1 hour behind KST.
          </div>

          <div className="callout-green">
            💚 <strong>Check your schedule daily</strong><br/>
            Use My Schedule tab to see your full week. Saturday classes may have different times than weekdays.
          </div>

          <div className="callout-green">
            💚 <strong>Use notes wisely</strong><br/>
            Notes help the Korean admin understand situations. Examples of good notes:
            <ul style={{paddingLeft:18,marginTop:6}}>
              <li>&quot;Internet issue, class cut short at 25 min&quot;</li>
              <li>&quot;Student absent, parent notified in advance&quot;</li>
              <li>&quot;Very engaged today, finished advanced unit&quot;</li>
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
