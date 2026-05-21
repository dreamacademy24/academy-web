"use client";
import { useRouter } from "next/navigation";

// fieldtrip_staff_guide.html 을 Next.js 페이지로 변환.
// 원본 CSS는 ::before 의사요소 / @media print 를 쓰므로 인라인 style 만으로는
// 표현 불가 → 원본 CSS를 <style> 블록으로 그대로 유지하고 className 으로 매핑.
export default function FieldtripStaffGuidePage() {
  const router = useRouter();
  return (
    <>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=DM+Sans:wght@400;500;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4; margin: 0; }
body { font-family: 'Noto Sans KR', sans-serif; background: #eceae6; display: flex; justify-content: center; padding: 2rem; min-height: 100vh; }
.page { width: 210mm; background: #fff; display: flex; flex-direction: column; }
.header { background: #0a2540; padding: 22px 32px 20px; display: flex; justify-content: space-between; align-items: flex-end; }
.header-left .eyebrow { font-family: 'DM Sans', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.15em; color: #5ba3d9; text-transform: uppercase; margin-bottom: 5px; }
.header-left .title { font-size: 20px; font-weight: 700; color: #fff; line-height: 1.2; }
.header-right { text-align: right; }
.header-right .label { font-family: 'DM Sans', sans-serif; font-size: 9px; letter-spacing: 0.1em; color: #5ba3d9; margin-bottom: 2px; }
.header-right .date { font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; color: #fff; }
.header-right .day { font-size: 10px; color: #8bb8d8; margin-top: 2px; }
.body { padding: 22px 32px; display: flex; flex-direction: column; gap: 18px; }
.hc-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
.hc { border-radius: 8px; padding: 10px 12px; text-align: center; }
.hc.dark { background: #0a2540; }
.hc.light { background: #f1f5f9; }
.hc-num { font-family: 'DM Sans', sans-serif; font-size: 24px; font-weight: 700; line-height: 1; }
.hc.dark .hc-num { color: #fff; }
.hc.green .hc-num { color: #166534; }
.hc.blue .hc-num { color: #185FA5; }
.hc.teal .hc-num { color: #0F6E56; }
.hc-label { font-size: 10px; color: #64748b; margin-top: 4px; }
.hc.dark .hc-label { color: #8bb8d8; }
.banner { background: #E6F1FB; border: 1px solid #B5D4F4; border-radius: 8px; padding: 10px 14px; font-size: 11px; color: #0C447C; line-height: 1.75; }
.banner b { color: #0a2540; }
.sec-label { font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
.sec-label span { display: inline-block; font-size: 9px; font-weight: 600; padding: 2px 7px; border-radius: 8px; }
.sl-navy { color: #0a2540; }
.sl-blue { color: #185FA5; }
.sl-green { color: #166534; }
.sl-amber { color: #854F0B; }
.sl-red { color: #A32D2D; }
.badge-red { background: #FCEBEB; color: #A32D2D; }
.badge-amber { background: #FAEEDA; color: #854F0B; }
.badge-green { background: #EAF3DE; color: #27500A; }
.card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 7px; break-inside: avoid; page-break-inside: avoid; }
.sec { margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid; }
.mission-wrap { break-inside: avoid; page-break-inside: avoid; }
.safety-card { break-inside: avoid; page-break-inside: avoid; }
.role-card { break-inside: avoid; page-break-inside: avoid; }
.two-col { break-inside: avoid; page-break-inside: avoid; }
.card:last-child { margin-bottom: 0; }
.card-head { padding: 7px 14px; font-size: 10px; font-weight: 500; color: #64748b; background: #f8fafc; border-bottom: 1px solid #e2e8f0; letter-spacing: 0.03em; }
.checklist { padding: 2px 0; }
.ci { display: flex; align-items: flex-start; gap: 10px; padding: 7px 14px; border-bottom: 1px solid #f1f5f9; }
.ci:last-child { border-bottom: none; }
.cb { width: 13px; height: 13px; border-radius: 3px; border: 1.5px solid #cbd5e1; flex-shrink: 0; margin-top: 2px; }
.cm { font-size: 11.5px; color: #1e293b; line-height: 1.4; }
.cs { font-size: 10px; color: #64748b; line-height: 1.6; margin-top: 2px; }
.tag { display: inline-block; font-size: 9px; font-weight: 600; padding: 1px 5px; border-radius: 4px; margin-left: 4px; vertical-align: middle; }
.t-must { background: #FCEBEB; color: #A32D2D; }
.t-check { background: #FAEEDA; color: #854F0B; }
.alt-box { background: #E1F5EE; border: 1px solid #9FE1CB; border-radius: 6px; padding: 7px 10px; margin-top: 5px; font-size: 10px; color: #085041; line-height: 1.75; }
.alt-box b { color: #0F6E56; }
.mission-wrap { background: #EAF3DE; border: 1px solid #C0DD97; border-radius: 8px; padding: 11px 13px; margin-bottom: 7px; }
.mission-title { font-size: 10px; font-weight: 500; color: #27500A; margin-bottom: 7px; }
.mission-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
.mi { background: #fff; border-radius: 5px; padding: 6px 8px; border: 1px solid #C0DD97; break-inside: avoid; }
.mi-name { font-size: 11px; font-weight: 500; color: #166534; }
.mi-sub { font-size: 9.5px; color: #374151; margin-top: 1px; }
.safety-card { background: #FCEBEB; border: 1px solid #F7C1C1; border-radius: 8px; padding: 11px 13px; margin-bottom: 7px; }
.safety-title { font-size: 11px; font-weight: 700; color: #A32D2D; margin-bottom: 7px; }
.si { font-size: 10.5px; color: #7f1d1d; line-height: 1.85; padding-left: 12px; position: relative; }
.si::before { content: '→'; position: absolute; left: 0; color: #dc2626; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.role-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 11px 13px; }
.role-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px; padding-bottom: 7px; border-bottom: 1px solid #f1f5f9; }
.role-name { font-size: 12px; font-weight: 700; color: #0a2540; }
.role-badge { font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 6px; }
.rb-kr { background: #EAF3DE; color: #166534; }
.rb-lo { background: #E1F5EE; color: #085041; }
.ri { font-size: 10.5px; color: #475569; line-height: 1.9; padding-left: 10px; position: relative; }
.ri::before { content: '·'; position: absolute; left: 0; }
.footer { border-top: 1px solid #e2e8f0; padding: 12px 32px; display: flex; justify-content: space-between; align-items: center; }
.footer-msg { font-size: 10px; color: #94a3b8; }
.footer-brand { font-family: 'DM Sans', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: #0a2540; opacity: 0.4; text-align: right; text-transform: uppercase; }
.no-print { position: fixed; top: 16px; right: 16px; display: flex; gap: 8px; z-index: 1000; }
.no-print button { padding: 8px 16px; font-size: 13px; font-weight: 600; border-radius: 8px; border: none; cursor: pointer; font-family: 'Noto Sans KR', sans-serif; }
.np-print { background: #0a2540; color: #fff; }
.np-back { background: #fff; color: #0a2540; border: 1px solid #cbd5e1; }
@media print {
  .no-print { display: none !important; }
  .card, .mission-wrap, .safety-card, .role-card, .banner, .hc-row, .two-col { page-break-inside: avoid; break-inside: avoid; }
  .sec { page-break-inside: avoid; break-inside: avoid; }
  *, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { background: none; padding: 0; }
  .page { width: 210mm; box-shadow: none; }
  .header { background: #0a2540 !important; }
  .hc.dark { background: #0a2540 !important; }
  .banner { background: #E6F1FB !important; }
  .alt-box { background: #E1F5EE !important; }
  .mission-wrap { background: #EAF3DE !important; }
  .safety-card { background: #FCEBEB !important; }
}
      `}</style>

      <div className="no-print">
        <button className="np-back" onClick={() => router.back()}>← 뒤로</button>
        <button className="np-print" onClick={() => window.print()}>🖨️ 인쇄</button>
      </div>

      <div className="page">
        {/* HEADER */}
        <div className="header">
          <div className="header-left">
            <div className="eyebrow">Dream Academy Cebu &nbsp;·&nbsp; Staff Prep Guide</div>
            <div className="title">필드트립 직원 준비 가이드</div>
          </div>
          <div className="header-right">
            <div className="label">DATE</div>
            <div className="date">2026. 05. 23</div>
            <div className="day">토요일 · Saturday</div>
          </div>
        </div>

        {/* BODY */}
        <div className="body">

          {/* 인원 */}
          <div>
            <div className="hc-row">
              <div className="hc dark light"><div className="hc-num" style={{ color: "#fff", fontSize: 22 }}>18</div><div className="hc-label" style={{ color: "#8bb8d8" }}>총 인원</div></div>
              <div className="hc light green"><div className="hc-num">8</div><div className="hc-label">학생</div></div>
              <div className="hc light blue"><div className="hc-num">4</div><div className="hc-label">한국인 스탭</div></div>
              <div className="hc light teal"><div className="hc-num">6</div><div className="hc-label">현지 선생님</div></div>
            </div>
          </div>

          <div className="banner">
            🛼 <b>링크 탑승:</b> 학생 8명 + 현지 선생님 6명 = 최소 14명 &nbsp;|&nbsp; 한국인 스탭 4명 탑승 선택 가능<br/>
            🎟️ <b>단체 할인:</b> 13명 이상 기준 적용 — 탑승 인원 따라 금액 달라짐, 두 경우 모두 계산해올 것 &nbsp;|&nbsp; ⚠️ <b>강사 예약 시 탑승 인원 14명 기준으로 안내</b>
          </div>

          {/* 사전 답사 */}
          <div>
            <div className="sec-label sl-navy">
              사전 답사 체크리스트 &nbsp;·&nbsp; Pre-Visit
              <span className="badge-red">내일 방문</span>
            </div>

            <div className="card">
              <div className="card-head">🛼 아이스링크 — 입장 & 대여</div>
              <div className="checklist">
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">입장료 확인 <span className="tag t-must">필수</span></div>
                  <div className="cs">성인/아동 구분 요금 / 13명 이상 단체 할인 금액 확인 / 한국 스탭 탑승 여부 두 경우 모두 계산</div>
                </div></div>
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">스케이트화 대여 확인 <span className="tag t-must">필수</span></div>
                  <div className="cs">입장료 포함 여부 / 아동 최소 사이즈 보유 여부 / 14~18명 동시 대여 가능 여부</div>
                </div></div>
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">곰돌이 보조 기구(Bear Skate Aid) 수량 및 요금 <span className="tag t-must">필수</span></div>
                  <div className="cs">보유 수량 / 대여 추가 요금 여부 / 초보 학생 수 감안해 충분한지 확인</div>
                </div></div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">👨‍🏫 스케이팅 강사 — 세부 확인사항</div>
              <div className="checklist">
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">강사 인원 및 배정 방식 확인 <span className="tag t-must">필수</span></div>
                  <div className="cs">초보 어린이 위주 2~3명 예상 / 강사 1명이 몇 명까지 동시에 가르칠 수 있는지 (1:1 전용인지, 1:2·1:3 가능한지)</div>
                </div></div>
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">수업 시간 및 요금 체계 확인</div>
                  <div className="cs">몇 시간 단위로 운영하는지 (30분? 1시간?) / 시간당 요금 vs 패키지 / 2시간 연속 가능 여부</div>
                </div></div>
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">예약 방법 확인 — 당일 현장 요청 가능인지 / 사전 예약 필수인지</div>
                  <div className="cs">예약 시 필요한 정보 (인원수, 나이대, 시간) / 취소·변경 정책 확인</div>
                </div></div>
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">안전 교육 포함 여부 확인 <span className="tag t-must">필수</span></div>
                  <div className="cs">강사가 입장 전 안전 교육을 직접 해주는지 / 안 해줄 경우 우리 쪽 선생님이 직접 진행 (아래 안전 교육 섹션 참고)</div>
                </div></div>
              </div>
            </div>

            <div className="card">
              <div className="card-head">🎯 미션 카드 부착 — 현장 허가 확인</div>
              <div className="checklist">
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">링크 벽면 부착 허용 여부 확인 <span className="tag t-check">불허 가능성 높음</span></div>
                  <div className="cs">관리자에게 직접 허가 여부 / 사용 가능 테이프 종류 문의</div>
                  <div className="alt-box">
                    <b>🔄 대안 (벽 부착 불가 시)</b><br/>
                    ① <b>선생님 몸에 부착</b> — 현지 선생님 조끼·등에 미션 카드 부착, 학생이 해당 선생님 찾아 미션 수행<br/>
                    ② <b>곰돌이 보조 기구에 부착</b> — 기구 앞면에 미션 카드 부착, 곰돌이 잡으러 오는 학생이 확인<br/>
                    ③ <b>선생님이 카드 들고 이동</b> — 링크 돌며 학생이 선생님 만나면 미션 공개
                  </div>
                </div></div>
              </div>
            </div>

            <div className="two-col">
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-head">🍔 졸리비 / 🛒 마트 — 동선</div>
                <div className="checklist">
                  <div className="ci"><div className="cb"></div><div>
                    <div className="cm">스케이트장 → 졸리비 빠른 동선 확인 <span className="tag t-must">필수</span></div>
                    <div className="cs">엘리베이터·에스컬레이터 위치 / 18명 이동 시 소요 시간 실측<br/>13:00 종료 → 13:20 식사까지 20분 — 가능한지 확인</div>
                  </div></div>
                  <div className="ci"><div className="cb"></div><div>
                    <div className="cm">졸리비 좌석 수 / 마트 위치 확인</div>
                    <div className="cs">18명 착석 가능 여부 / 14:40 출발 맞게 마트 체류 시간 계산</div>
                  </div></div>
                </div>
              </div>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-head">🚗 개별 하원 — 쇼핑몰 출입구</div>
                <div className="checklist">
                  <div className="ci"><div className="cb"></div><div>
                    <div className="cm">차량 픽업 가능한 SM 씨사이드 출입구 위치 확인</div>
                    <div className="cs">차량 잠깐 정차 가능 게이트 번호·명칭 메모<br/>학부모에게 안내할 정확한 위치 파악</div>
                  </div></div>
                  <div className="ci"><div className="cb"></div><div>
                    <div className="cm">스케이트장 → 해당 출입구 이동 동선 파악</div>
                  </div></div>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 7 }}>
              <div className="card-head">💰 예산 계산 (답사 후 확정)</div>
              <div className="checklist">
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">전체 비용 산출 <span className="tag t-must">필수</span></div>
                  <div className="cs">입장료(14명 or 18명) + 스케이트 대여 + 강사비(2~3명) + 보조 기구 대여 + 교통비</div>
                </div></div>
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">머니 미션 보상 금액 책정 — 미션 난이도별 금액 / 학생 1인당 최대 획득 금액 설정</div>
                </div></div>
              </div>
            </div>
          </div>

          {/* 미션 카드 */}
          <div>
            <div className="sec-label sl-green">
              머니 미션 카드 제작 &nbsp;·&nbsp; Mission Cards
              <span className="badge-amber">당일 전 준비</span>
            </div>
            <div className="mission-wrap">
              <div className="mission-title">미션 아이디어 — 답사 후 장소 확인하여 최종 확정</div>
              <div className="mission-grid">
                <div className="mi"><div className="mi-name">박수 5번 치기</div><div className="mi-sub">★ 쉬움 · 초보 추천</div></div>
                <div className="mi"><div className="mi-name">한 발로 3초 서기</div><div className="mi-sub">벽 잡고 OK</div></div>
                <div className="mi"><div className="mi-name">선생님과 하이파이브</div><div className="mi-sub">선생님 찾아가야 함</div></div>
                <div className="mi"><div className="mi-name">영어로 인사하기</div><div className="mi-sub">"How are you?" 등</div></div>
                <div className="mi"><div className="mi-name">친구 손 잡고 한 바퀴</div><div className="mi-sub">협동 미션</div></div>
                <div className="mi"><div className="mi-name">반대편 벽 터치</div><div className="mi-sub">혼자 이동</div></div>
              </div>
            </div>
            <div className="card">
              <div className="checklist">
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">미션 카드 출력 — 미션 내용 + 보상 금액 크게 인쇄</div>
                  <div className="cs">코팅 필수 — 링크 내부 습기로 종이 젖을 수 있음 / 여유분 2~3장씩 추가 출력</div>
                </div></div>
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">카드별 금액 차등 설정 — 예: 쉬운 미션 20페소 / 보통 30페소 / 어려운 미션 50페소</div>
                </div></div>
                <div className="ci"><div className="cb"></div><div>
                  <div className="cm">보상용 소액 현금 준비 + 벽 부착용 테이프 / 마스킹테이프 또는 블루택</div>
                </div></div>
              </div>
            </div>
          </div>

          {/* 안전 교육 */}
          <div>
            <div className="sec-label sl-red">
              안전 교육 준비 &nbsp;·&nbsp; Safety
              <span className="badge-amber">답사 후 확정</span>
            </div>
            <div className="safety-card">
              <div className="safety-title">⚠️ 강사가 안전 교육을 안 해주는 경우 — 우리가 직접 진행</div>
              <div className="si">담당 한국인 선생님 1명 사전 지정 → 스케이팅 안전 교육 내용 미리 공부해올 것</div>
              <div className="si">답사 시 현장 강사·직원에게 "어린이 안전 교육 내용" 직접 물어보고 메모</div>
              <div className="si">현지 강사가 설명해줄 경우 — 한국인 선생님이 옆에서 함께 듣고 학생들에게 한국어로 동시 통역</div>
              <div className="si">현지 강사가 안 해줄 경우 — 한국인 선생님이 입장 전 5~10분 직접 안전 교육 진행</div>
            </div>
            <div className="card">
              <div className="card-head">📖 안전 교육 포함 내용 (사전 숙지)</div>
              <div className="checklist">
                <div className="ci"><div className="cb"></div><div className="cm">넘어질 때 자세 — 앞으로 넘어질 때 무릎 먼저, 손 짚지 않기</div></div>
                <div className="ci"><div className="cb"></div><div className="cm">출발·정지 방법 — 발 V자 정지법 기초</div></div>
                <div className="ci"><div className="cb"></div><div className="cm">링크 안 규칙 — 역방향 이동 금지, 뛰지 않기, 다른 사람 밀지 않기</div></div>
                <div className="ci"><div className="cb"></div><div className="cm">보조 기구 사용법 — 곰돌이 기구 잡는 방법, 기대지 않고 균형 잡기</div></div>
              </div>
            </div>
          </div>

          {/* 당일 준비물 + 역할 */}
          <div>
            <div className="sec-label sl-amber">
              당일 준비물 &amp; 역할 분담 &nbsp;·&nbsp; Day-of
              <span className="badge-green">당일</span>
            </div>
            <div className="two-col" style={{ marginBottom: 8 }}>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-head">📋 서류·현금</div>
                <div className="checklist">
                  <div className="ci"><div className="cb"></div><div className="cm">학생 명단(8명) + 비상연락처</div></div>
                  <div className="ci"><div className="cb"></div><div className="cm">개별 하원 신청 학생 명단</div></div>
                  <div className="ci"><div className="cb"></div><div className="cm">당일 전체 예산 현금 (소액권 포함)</div></div>
                  <div className="ci"><div className="cb"></div><div className="cm">학부모 공유용 출입구 안내 문자 준비</div></div>
                </div>
              </div>
              <div className="card" style={{ marginBottom: 0 }}>
                <div className="card-head">🎒 물품</div>
                <div className="checklist">
                  <div className="ci"><div className="cb"></div><div className="cm">미션 카드 + 여분 + 테이프</div></div>
                  <div className="ci"><div className="cb"></div><div className="cm">보상 현금 소액권</div></div>
                  <div className="ci"><div className="cb"></div><div className="cm">구급약 (밴드, 소독약)</div></div>
                  <div className="ci"><div className="cb"></div><div className="cm">카메라 / 폰 충전 완료</div></div>
                </div>
              </div>
            </div>
            <div className="two-col">
              <div className="role-card">
                <div className="role-head">
                  <span className="role-name">한국인 스탭</span>
                  <span className="role-badge rb-kr">4명</span>
                </div>
                <div className="ri">전체 일정 진행 총괄</div>
                <div className="ri">안전 교육 담당자 1명 사전 지정</div>
                <div className="ri">미션 운영 및 보상 금액 지급</div>
                <div className="ri">활동 사진·영상 촬영</div>
                <div className="ri">개별 하원 학부모 인계 대응</div>
                <div className="ri">졸리비 영어 주문 지도 / 마트 계산 도움</div>
              </div>
              <div className="role-card">
                <div className="role-head">
                  <span className="role-name">현지 선생님</span>
                  <span className="role-badge rb-lo">6명 · 링크 탑승</span>
                </div>
                <div className="ri">학생 1~2명씩 케어</div>
                <div className="ri">초보 학생 손 잡고 이동 보조</div>
                <div className="ri">스케이팅 강사와 협력</div>
                <div className="ri">넘어진 학생 즉시 대응</div>
                <div className="ri">미션 수행 확인 및 심판 역할</div>
                <div className="ri">현지어 소통 지원</div>
              </div>
            </div>
          </div>

        </div>

        <div className="footer">
          <div className="footer-msg">내일 답사 후 최종 확정 — 미팅 전 체크리스트 작성 완료</div>
          <div className="footer-brand">Dream Academy<br/>Cebu</div>
        </div>
      </div>
    </>
  );
}
