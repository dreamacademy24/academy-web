"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

/* 제이파크 계약서 — 장기(Long Stay) / 단기(Corporate) · 한글/English 열람 */

const peso = (n: number) => "PHP " + n.toLocaleString("en-US");

const LONG_RATES = [
  ["Deluxe", "Main Building", 22000, 6400, 5600],
  ["Deluxe Ocean View", "Main Building", 25000, 7600, 6650],
  ["Premier", "Jpark Tower", 23000, 6800, 5950],
  ["Premier Ocean View", "Jpark Tower", 26000, 8000, 7000],
  ["Mactan Suite", "Main Building", 28000, 8800, 7700],
  ["Mactan Suite Ocean View", "Main Building", 31000, 10000, 8750],
  ["Mountain Suite", "Jpark Tower", 29000, 9200, 8050],
  ["Ocean Suite", "Jpark Tower", 32000, 10400, 9100],
] as const;

const SHORT_RATES = [
  ["Deluxe", "MAIN", 16000, 8000],
  ["Premier", "TOWER", 17000, 8700],
  ["Deluxe Ocean View", "MAIN", 19000, 9000],
  ["Premier Ocean View", "TOWER", 20000, 9700],
  ["Mactan Suite", "MAIN", 22000, 11700],
  ["Mountain Suite", "TOWER", 23000, 12500],
  ["Mactan Suite Ocean View", "MAIN", 25000, 12700],
  ["Ocean Suite", "TOWER", 26000, 13500],
  ["Paw Suite", "MAIN", 22000, 14300],
  ["Cebu Suite", "MAIN", 28000, 17000],
  ["Cebu Suite Ocean View", "MAIN", 31000, 18800],
  ["Patio Villa / Jacuzzi Villa", "", 25000, 15200],
  ["Pool Villa", "", 28000, 17000],
  ["Pororo Suite", "MAIN", 30000, 18200],
  ["Pororo Suite Ocean View", "MAIN", 33000, 20000],
  ["Family Jacuzzi Villa", "", 32000, 32000],
  ["Family Pool Villa", "", 35000, 35000],
] as const;

export default function ResortContractPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [doc, setDoc] = useState<"long" | "short">("long");
  const [lang, setLang] = useState<"ko" | "en">("ko");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    setReady(true);
  }, [router]);
  if (!ready) return null;

  const scans = doc === "long"
    ? [1, 2, 3, 4, 5].map(n => `/resort-contracts/jlong-${n}.jpg`)
    : [1, 2, 3].map(n => `/resort-contracts/jshort-${n}.jpg`);

  return (<>
    <style>{`
      .rc-wrap{max-width:980px;margin:0 auto;padding:24px 20px 80px;font-family:'Noto Sans KR',sans-serif;color:#1a1a2e}
      .rc-tabs{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
      .rc-tab{padding:9px 18px;border-radius:10px;border:1.5px solid #d8dee9;background:#fff;font-size:13.5px;font-weight:800;color:#475569;cursor:pointer;font-family:inherit}
      .rc-tab.on{background:#1a6fc4;border-color:#1a6fc4;color:#fff}
      .rc-lang{margin-left:auto;display:flex;gap:4px;background:#eef1f6;border-radius:9px;padding:3px}
      .rc-lbtn{padding:6px 14px;border:none;border-radius:7px;background:transparent;font-size:12.5px;font-weight:800;color:#64748b;cursor:pointer;font-family:inherit}
      .rc-lbtn.on{background:#fff;color:#1a6fc4;box-shadow:0 1px 3px rgba(0,0,0,.1)}
      .rc-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px 22px;margin-bottom:14px}
      .rc-h{font-size:14.5px;font-weight:800;margin-bottom:10px;display:flex;align-items:center;gap:8px}
      .rc-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:14px}
      .rc-sum>div{background:#f8faff;border:1px solid #dbe3f5;border-radius:10px;padding:10px 14px}
      .rc-sum b{display:block;font-size:13.5px;margin-top:2px}
      .rc-sum span{font-size:11px;color:#64748b;font-weight:700}
      table.rc-t{width:100%;border-collapse:collapse;font-size:12.5px}
      .rc-t th{background:#f1f5f9;text-align:left;padding:8px 10px;font-size:11px;color:#475569;border-bottom:2px solid #e2e8f0;white-space:nowrap}
      .rc-t td{padding:7px 10px;border-bottom:1px solid #f1f3f8}
      .rc-t td:nth-child(n+3){text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
      ul.rc-ul{margin:0;padding-left:18px;font-size:13px;line-height:1.9}
      ol.rc-ol{margin:0;padding-left:20px;font-size:13px;line-height:1.9}
      .rc-warn{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;font-size:12.5px;color:#92400e;font-weight:700;margin-bottom:12px}
      .rc-scan{width:100%;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:14px;cursor:zoom-in;display:block}
      .rc-badge{font-size:10.5px;font-weight:800;border-radius:6px;padding:2px 8px;background:#eef2ff;color:#4338ca}
      @media print{.rc-tabs,.no-print{display:none}}
    `}</style>
    <div className="rc-wrap">
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>📑 제이파크 계약서</h1>
      <p style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>Jpark Island Resort &amp; Waterpark — Dream Academy 계약 요금 · 원본 스캔(English)과 한글 번역을 전환해서 보세요</p>

      <div className="rc-tabs">
        <button className={`rc-tab${doc === "long" ? " on" : ""}`} onClick={() => setDoc("long")}>🌙 장기 계약 (Long Stay · 7박↑)</button>
        <button className={`rc-tab${doc === "short" ? " on" : ""}`} onClick={() => setDoc("short")}>☀️ 단기 계약 (Corporate · 2박↑)</button>
        <div className="rc-lang">
          <button className={`rc-lbtn${lang === "ko" ? " on" : ""}`} onClick={() => setLang("ko")}>🇰🇷 한글</button>
          <button className={`rc-lbtn${lang === "en" ? " on" : ""}`} onClick={() => setLang("en")}>🇬🇧 English (원본)</button>
        </div>
      </div>

      {lang === "en" ? (
        <div className="rc-card">
          <div className="rc-h">📄 {doc === "long" ? "장기 계약 원본 (5장)" : "단기 계약 원본 (3장)"} <span className="rc-badge">클릭하면 크게 보기</span></div>
          {scans.map(src => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={src} src={src} alt={src} className="rc-scan" onClick={() => setLightbox(src)} />
          ))}
        </div>
      ) : doc === "long" ? (
        <>
          <div className="rc-sum">
            <div><span>계약 기간</span><b>2026.4.1 ~ 2027.3.31</b></div>
            <div><span>대상</span><b>외국 여권 소지자 (국제 마켓)</b></div>
            <div><span>최소 숙박</span><b>전 객실 7박 이상</b></div>
            <div><span>추가 인원</span><b>1박 PHP 3,000 (조식·엑스트라 베드 포함)</b></div>
          </div>
          <div className="rc-card">
            <div className="rc-h">💰 계약 객실 요금 (1박 · PHP · nett)</div>
            <div style={{ overflowX: "auto" }}>
              <table className="rc-t">
                <thead><tr><th>객실 타입</th><th>위치</th><th>BAR (정상가)</th><th>7박 이상</th><th>14박 이상</th></tr></thead>
                <tbody>
                  {LONG_RATES.map(r => (
                    <tr key={r[0]}><td style={{ fontWeight: 700 }}>{r[0]}</td><td>{r[1] === "Main Building" ? "메인 빌딩" : "제이파크 타워"}</td><td>{peso(r[2])}</td><td style={{ fontWeight: 800, color: "#1a6fc4" }}>{peso(r[3])}</td><td style={{ fontWeight: 800, color: "#16a34a" }}>{peso(r[4])}</td></tr>
                  ))}
                  <tr><td style={{ fontWeight: 700 }}>추가 인원 (Extra person)</td><td>—</td><td>{peso(3000)}</td><td>{peso(3000)}</td><td>{peso(3000)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="rc-warn" style={{ marginTop: 10, marginBottom: 0 }}>⚠️ 전 객실 최소 7박 필수 · 요금은 객실만 포함(Room only) · 조식 불포함</div>
          </div>
          <div className="rc-card">
            <div className="rc-h">✅ 요금 포함사항 (전 객실)</div>
            <ul className="rc-ul">
              <li>객실만 제공 (Room only) · 무료 Wi-Fi</li>
              <li>헬스장 · 워터파크 무료 이용, 액티비티 존 이용 가능 (일부 유료)</li>
              <li>하우스키핑·린넨 교체 주 2회</li>
              <li>세탁 서비스 30% 할인 · 알라카르트 30% 할인 (룸서비스·입점업체 제외) · Abalone 뷔페 50% 할인</li>
              <li>만 6세 이하 어린이 2명까지 무료 투숙</li>
            </ul>
          </div>
          <div className="rc-card">
            <div className="rc-h">📈 성수기 추가요금 (1박당)</div>
            <div style={{ overflowX: "auto" }}>
              <table className="rc-t">
                <thead><tr><th>시즌</th><th>2026 / 2027</th><th>추가요금</th><th>적용 마켓</th></tr></thead>
                <tbody>
                  <tr><td>신정 (New Year)</td><td>1/1 ~ 1/2</td><td>{peso(4500)}</td><td>국내/외국</td></tr>
                  <tr><td>춘절 (Chinese NY)</td><td>2/14 ~ 2/17</td><td>{peso(2250)}</td><td>국내/외국</td></tr>
                  <tr><td>골든위크</td><td>5/3 ~ 5/6</td><td>{peso(2250)}</td><td>일본</td></tr>
                  <tr><td>오봉</td><td>8/13 ~ 8/15</td><td>{peso(2250)}</td><td>일본</td></tr>
                  <tr><td>크리스마스</td><td>12/23 ~ 12/27</td><td>{peso(2250)}</td><td>국내/외국</td></tr>
                  <tr><td>연말 (New Year)</td><td>12/28 ~ 12/31</td><td>{peso(4500)}</td><td>국내/외국</td></tr>
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: "#92400e", marginTop: 8, fontWeight: 700 }}>🎄 12/31을 포함해 숙박하는 예약은 갈라 디너 의무 참석: 성인(13세↑) PHP 5,500 · 어린이(7~12세) PHP 2,750 · 0~6세 무료 (12/31 12~18시 출발 또는 22시 이후 도착 시 면제)</div>
          </div>
          <div className="rc-card">
            <div className="rc-h">📜 주요 약관 (요약 번역)</div>
            <ol className="rc-ol">
              <li>요금 유효기간 2026.4.1~2027.3.31, <b>외국 여권 소지자 전용</b>, 전 객실 최소 7박</li>
              <li><b>선결제 필수</b>(최소 숙박일수만큼) · 결제 후 환불 불가 — 도착 10일 전까지 1회 리부킹 허용 (원 숙박일 기준 3개월 이내, 차액 발생 가능)</li>
              <li>조기 퇴실·숙박 단축 시 페널티: 할인 상실 + 현재 다이내믹 요금으로 재계산</li>
              <li>취소·단축·변경·노쇼는 환불 없음, 부대비용으로 전환 불가</li>
              <li>객실 내 취사 금지 (가전·주방기기 반입 불가) · 외부 음식·음료 반입 금지 · 금연 (지정 흡연구역)</li>
              <li>혜택은 등록 투숙객 전용 (양도 불가) · 타 할인과 중복 불가 · 요금은 PHP net, 커미션 없음</li>
              <li>30객실 이상 단체는 별도 계약 · Corporate 계정 예약은 별도 요금</li>
              <li>체크인 15:00 / 체크아웃 12:00 — 얼리 체크인(10시~15시) 및 레이트 체크아웃(12시~18시) 객실료 50%, 그 외 시간은 1박 요금</li>
              <li>체크인 시 객실당 1박 기준 <b>보증금 PHP 3,000</b></li>
              <li>성인 1명당 12세 이하 어린이 2명까지 무료(기존 침구) · 어린이 엑스트라 베드 PHP 1,000 (조식 불포함)</li>
              <li>비수기: 예약 확정 후 14일 이내 전액 선결제 / 성수기: 확정 후 2일 이내 · 도착 21일 전 축소 변경은 1박 취소료, 20일 이내는 전액 취소료</li>
              <li>노쇼: 예약·보증된 전체 숙박일수 요금 부과</li>
              <li>재계약 조건: 연간 100 룸나이트 보장 시 다음 연도 계약 자격</li>
            </ol>
          </div>
          <div className="rc-card">
            <div className="rc-h">📮 예약 절차 · 컨택</div>
            <ul className="rc-ul">
              <li>모든 예약은 Dream Academy 공식 부킹오더로 직접 접수 — FIT 3일 전 / 단체(GIT) 5일 전까지 호텔 바우처 제출</li>
              <li>예약부: <b>travel@jparkislandresort.com</b></li>
              <li>세일즈: <b>britney.na@jparkislandresort.com</b> · rodan.segovia@jparkislandresort.com · genrov.rabusa@jparkislandresort.com</li>
              <li>미결제 예약은 옵션 날짜 18시까지만 홀드 → 자동 해제</li>
              <li>체크인 시 현장 추가 예약은 계약 요금 미적용 (OTC 요금)</li>
            </ul>
          </div>
          <div className="rc-card">
            <div className="rc-h">🍽 식사 계약 요금 (Abalone 뷔페 · TA 요금 / 1인)</div>
            <div style={{ overflowX: "auto" }}>
              <table className="rc-t">
                <thead><tr><th>구분</th><th></th><th>일반가 성인</th><th>계약가 성인</th><th>계약가 어린이 7~12세</th></tr></thead>
                <tbody>
                  <tr><td>조식 (매일)</td><td></td><td>{peso(1300)}</td><td style={{ fontWeight: 800, color: "#1a6fc4" }}>{peso(1100)}</td><td>{peso(440)}</td></tr>
                  <tr><td>중식 (주말만)</td><td></td><td>{peso(2000)}</td><td style={{ fontWeight: 800, color: "#1a6fc4" }}>{peso(1650)}</td><td>{peso(660)}</td></tr>
                  <tr><td>석식 (매일)</td><td></td><td>{peso(2500)}</td><td style={{ fontWeight: 800, color: "#1a6fc4" }}>{peso(1925)}</td><td>{peso(825)}</td></tr>
                  <tr><td>세트메뉴 (Coral·Maru·Ching Hai)</td><td></td><td>{peso(2000)}</td><td style={{ fontWeight: 800, color: "#1a6fc4" }}>{peso(1375)}</td><td>{peso(660)}</td></tr>
                </tbody>
              </table>
            </div>
            <ul className="rc-ul" style={{ marginTop: 8 }}>
              <li>0~6세 무료 · 블랙아웃: 크리스마스(12/24·25), 연말연시(12/31·1/1)</li>
              <li>TA 계약 식사요금은 여행사(드림)가 예약·결제한 경우만 적용, 성인 15명당 1명 무료(가이드·기사 등)</li>
              <li>Maru 화요일 휴무 · Ching Hai 목요일 휴무 · Abalone/Coral/Galo 매일 운영</li>
            </ul>
          </div>
        </>
      ) : (
        <>
          <div className="rc-sum">
            <div><span>계약 기간</span><b>2026.1.1 ~ 2026.12.31</b></div>
            <div><span>대상</span><b>Dream Academy 직원·관계자 (회사 ID 필요)</b></div>
            <div><span>최소 숙박</span><b>2박 이상</b></div>
            <div><span>추가 인원</span><b>1박 PHP 2,000 (조식·엑스트라 베드 포함)</b></div>
          </div>
          <div className="rc-card">
            <div className="rc-h">💰 기업(Corporate) 요금 (1박 · PHP · 세금 포함 net)</div>
            <div style={{ overflowX: "auto" }}>
              <table className="rc-t">
                <thead><tr><th>객실 타입</th><th>위치</th><th>BAR (정상가)</th><th>기업 요금</th></tr></thead>
                <tbody>
                  {SHORT_RATES.map(r => (
                    <tr key={r[0]}><td style={{ fontWeight: 700 }}>{r[0]}</td><td>{r[1]}</td><td>{peso(r[2])}</td><td style={{ fontWeight: 800, color: "#1a6fc4" }}>{peso(r[3])}</td></tr>
                  ))}
                  <tr><td style={{ fontWeight: 700 }}>추가 인원 (Extra Person)</td><td>—</td><td>{peso(3000)}</td><td style={{ fontWeight: 800 }}>{peso(2000)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="rc-warn" style={{ marginTop: 10, marginBottom: 0 }}>⚠️ 기업 요금은 최소 2박 · 체크인 시 <b>회사 ID 제시 필수</b> (미제시 시 현장 정상요금 적용)</div>
          </div>
          <div className="rc-card">
            <div className="rc-h">✅ 요금 포함사항</div>
            <ul className="rc-ul">
              <li><b>조식 뷔페 포함</b> — 성인 2명 + 6세 이하 어린이 2명 (2베드룸은 성인 4명 + 어린이 2명)</li>
              <li>무료 Wi-Fi · 헬스장 · 워터파크</li>
              <li>Pororo Suite: 12세 이하 어린이 2명 뽀로로파크 종일 이용 + 굿즈 20% 할인</li>
              <li>전 빌라: 웰컴 어메니티 · 미니바 1회 · 인룸 조식 옵션 · 턴다운 서비스 / Paw Suite: 반려동물 어메니티</li>
            </ul>
          </div>
          <div className="rc-card">
            <div className="rc-h">📈 성수기 추가요금 (1박당 · 2026)</div>
            <div style={{ overflowX: "auto" }}>
              <table className="rc-t">
                <thead><tr><th>날짜</th><th>이벤트</th><th>추가요금</th></tr></thead>
                <tbody>
                  <tr><td>1/1 ~ 1/2</td><td>신정</td><td>{peso(4500)}</td></tr>
                  <tr><td>2/14 ~ 2/17</td><td>춘절</td><td>{peso(2250)}</td></tr>
                  <tr><td>4/2 ~ 4/5</td><td>홀리위크 / 부활절</td><td>{peso(2250)}</td></tr>
                  <tr><td>12/23 ~ 12/27</td><td>크리스마스</td><td>{peso(2250)}</td></tr>
                  <tr><td>12/28 ~ 12/31</td><td>연말</td><td>{peso(4500)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="rc-card">
            <div className="rc-h">📜 주요 약관 (요약 번역)</div>
            <ol className="rc-ol">
              <li>기업 요금 유효기간 2026.1.1~12.31 · <b>Dream Academy 직원·관계자 전용, 체크인 시 회사 ID 필수</b></li>
              <li>FIT·소규모 단체 적용 — 30객실 이상 연회 포함 단체는 별도 계약</li>
              <li>요금은 12% VAT + 1.5% 지방세 포함 net, 커미션 불가 · 성수기 추가요금 별도</li>
              <li>체크인 15:00 / 체크아웃 12:00 — 얼리/레이트 50%, 10시 이전·18시 이후는 1박 요금</li>
              <li>체크인 시 객실당 1박 기준 <b>보증금 PHP 3,000</b></li>
              <li>성인 1명당 12세 이하 어린이 2명 무료(기존 침구) · 어린이 엑스트라 베드 PHP 1,000 (조식 불포함) · <b>2명 초과 어린이는 1박 PHP 1,500</b> (베드+조식 포함)</li>
              <li>객실당 성인 1명 이상 필수 — 18세 미만 단독 투숙 불가</li>
              <li>뷔페: 0~6세 무료, 7~12세 50%</li>
              <li>결제 완료 예약은 <b>환불 불가</b> (리조트 운영 중단 시 제외)</li>
              <li><b>비수기</b>: 확정 후 2일 이내 전액 선결제 또는 회사 보증서(LOA) — 취소 불가, 도착 10일 전까지 1회 일정변경 가능(3개월 이내, 차액 발생 가능), 도착 10일 이내 객실 수·박수 축소 불가</li>
              <li><b>성수기</b>: 확정 즉시 전액 선결제 또는 LOA — 취소·변경·수정 모두 불가</li>
              <li>노쇼: 예약·보증된 전체 숙박일수 요금 부과</li>
              <li>반려동물 반입 금지(Paw Suite 제외) · 외부 음식 반입 금지 · 객실 상업 활동 금지</li>
              <li>재계약 조건: 연간 100 룸나이트 보장 시 다음 연도 계약 자격</li>
            </ol>
          </div>
          <div className="rc-card">
            <div className="rc-h">📮 예약 절차 · 컨택</div>
            <ul className="rc-ul">
              <li>모든 예약은 Dream Academy 공식 부킹오더로 접수</li>
              <li>세일즈·마케팅: <b>kimm.bardago@jparkislandresort.com</b></li>
              <li>예약부: <b>rsvn@jparkislandresort.com</b></li>
              <li>미결제 예약은 옵션 날짜 18시까지만 홀드 → 자동 해제</li>
            </ul>
          </div>
        </>
      )}

      <div className="rc-card" style={{ background: "#f8faff" }}>
        <div className="rc-h">🏦 입금 계좌 (두 계약 공통 · Phil. BXT Corp.)</div>
        <ul className="rc-ul">
          <li><b>China Banking Corp.</b> — 1084 0000 5627 (Cebu-Mandaue Branch)</li>
          <li><b>BPI</b> — 2945-0668-84 (Cebu Ayala-FGU Center Branch)</li>
          <li><b>BDO</b> — 6140-379-880 (MEPZ1, Mactan Island)</li>
        </ul>
      </div>
    </div>

    {lightbox && (
      <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 9999, cursor: "zoom-out", overflowY: "auto", padding: "20px 0" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={lightbox} alt="contract" style={{ width: "min(1100px,96vw)", borderRadius: 8 }} />
      </div>
    )}
  </>);
}
