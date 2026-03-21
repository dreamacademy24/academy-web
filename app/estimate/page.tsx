"use client";
import { useState } from "react";

// ── 드림하우스 가격 (기간, 보호자, 아이, 가격) ──
const DH: Record<string, number> = {
  "2-1-2":4970000,"2-2-2":5550000,"2-3-2":6140000,
  "3-1-2":7190000,"3-2-2":8010000,"3-3-2":8840000,
  "4-1-2":8950000,"4-2-2":10010000,"4-3-2":11080000,
  "5-1-2":11150000,"5-2-2":12460000,"5-3-2":13770000,
  "6-1-2":13360000,"6-2-2":14910000,"6-3-2":16460000,
  "7-1-2":15570000,"7-2-2":17360000,"7-3-2":19150000,
  "8-1-2":17800000,"8-2-2":19830000,"8-3-2":21860000,
  "9-1-2":20010000,"9-2-2":22280000,"9-3-2":24550000,
  "10-1-2":22220000,"10-2-2":24740000,"10-3-2":27250000,
  "11-1-2":24440000,"11-2-2":27190000,"11-3-2":29940000,
  "12-1-2":26650000,"12-2-2":29640000,"12-3-2":32640000,
};

// ── 제이파크 가격 (룸타입-기간-보호자-아이) ──
const JP: Record<string, number> = {
  "디럭스-2-1-1":5560000,"디럭스-2-1-2":7040000,"디럭스-2-2-1":6140000,"디럭스-2-1-3":8530000,"디럭스-2-2-2":7630000,
  "프리미어-2-1-1":5700000,"프리미어-2-1-2":7180000,"프리미어-2-2-1":6280000,"프리미어-2-1-3":8670000,"프리미어-2-2-2":7770000,
  "막탄스윗-2-1-1":6260000,"막탄스윗-2-1-2":7740000,"막탄스윗-2-2-1":6840000,"막탄스윗-2-1-3":9230000,"막탄스윗-2-2-2":8330000,
  "디럭스-3-1-1":8180000,"디럭스-3-1-2":10300000,"디럭스-3-2-1":9010000,"디럭스-3-1-3":12410000,"디럭스-3-2-2":11120000,
  "프리미어-3-1-1":8390000,"프리미어-3-1-2":10510000,"프리미어-3-2-1":9220000,"프리미어-3-1-3":12620000,"프리미어-3-2-2":11330000,
  "막탄스윗-3-1-1":9230000,"막탄스윗-3-1-2":11350000,"막탄스윗-3-2-1":10060000,"막탄스윗-3-1-3":13460000,"막탄스윗-3-2-2":12170000,
  "디럭스-4-1-1":10720000,"디럭스-4-1-2":13370000,"디럭스-4-2-1":11780000,"디럭스-4-1-3":16030000,"디럭스-4-2-2":14440000,
  "프리미어-4-1-1":11000000,"프리미어-4-1-2":13650000,"프리미어-4-2-1":12060000,"프리미어-4-1-3":16310000,"프리미어-4-2-2":14720000,
  "막탄스윗-4-1-1":12120000,"막탄스윗-4-1-2":14770000,"막탄스윗-4-2-1":13180000,"막탄스윗-4-1-3":17430000,"막탄스윗-4-2-2":15840000,
  "디럭스-5-1-1":13370000,"디럭스-5-1-2":16680000,"디럭스-5-2-1":14670000,"디럭스-5-1-3":20000000,
};

// ── 큐브나인 가격 (룸타입-기간-보호자-아이) ──
const C9: Record<string, number> = {
  "디럭스-2-1-1":4630000,"디럭스-2-1-2":5730000,"디럭스-2-2-1":4830000,"디럭스-2-1-3":6830000,"디럭스-2-2-2":5930000,
  "풀억세스룸-2-1-1":5020000,"풀억세스룸-2-1-2":6120000,"풀억세스룸-2-2-1":5220000,"풀억세스룸-2-1-3":7220000,"풀억세스룸-2-2-2":6320000,
  "디럭스-3-1-1":6790000,"디럭스-3-1-2":8330000,"디럭스-3-2-1":7040000,"디럭스-3-1-3":9870000,"디럭스-3-2-2":8580000,
  "풀억세스룸-3-1-1":7380000,"풀억세스룸-3-1-2":8920000,"풀억세스룸-3-2-1":7630000,"풀억세스룸-3-1-3":10460000,"풀억세스룸-3-2-2":9170000,
  "디럭스-4-1-1":8860000,"디럭스-4-1-2":10750000,"디럭스-4-2-1":9160000,"디럭스-4-1-3":12640000,"디럭스-4-2-2":11050000,
  "풀억세스룸-4-1-1":9640000,"풀억세스룸-4-1-2":11530000,"풀억세스룸-4-2-1":9940000,"풀억세스룸-4-1-3":13420000,"풀억세스룸-4-2-2":11830000,
  "디럭스-5-1-1":11050000,"디럭스-5-1-2":13410000,"디럭스-5-2-1":11400000,"디럭스-5-1-3":15770000,"디럭스-5-2-2":13760000,
  "풀억세스룸-5-1-1":12030000,"풀억세스룸-5-1-2":14390000,"풀억세스룸-5-2-1":12380000,"풀억세스룸-5-1-3":16750000,"풀억세스룸-5-2-2":14740000,
  "디럭스-6-1-1":13230000,"디럭스-6-1-2":16060000,"디럭스-6-2-1":13630000,"디럭스-6-1-3":18890000,"디럭스-6-2-2":16460000,
  "풀억세스룸-6-1-1":14410000,"풀억세스룸-6-1-2":17240000,"풀억세스룸-6-2-1":14810000,"풀억세스룸-6-1-3":20070000,
};

function fmt(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

type AccomType = "dreamhouse" | "jpark" | "cubenine";

interface AccomConfig {
  type: AccomType;
  weeks: number;
  roomType: string;
  parents: number;
  kids: number;
}

const defaultAccom = (type: AccomType): AccomConfig => ({
  type,
  weeks: 2,
  roomType: type === "jpark" ? "디럭스" : type === "cubenine" ? "디럭스" : "",
  parents: 1,
  kids: 2,
});

function getPrice(cfg: AccomConfig, totalWeeks?: number): number | null {
  const w = totalWeeks ?? cfg.weeks;
  if (cfg.type === "dreamhouse") {
    return DH[`${w}-${cfg.parents}-${cfg.kids}`] ?? null;
  }
  if (cfg.type === "jpark") {
    return JP[`${cfg.roomType}-${w}-${cfg.parents}-${cfg.kids}`] ?? null;
  }
  return C9[`${cfg.roomType}-${w}-${cfg.parents}-${cfg.kids}`] ?? null;
}

const accomLabel: Record<AccomType, string> = { dreamhouse: "드림하우스", jpark: "제이파크", cubenine: "큐브나인" };

export default function EstimatePage() {
  const [mode, setMode] = useState<"single" | "combo">("single");
  const [a1, setA1] = useState<AccomConfig>(defaultAccom("dreamhouse"));
  const [a2, setA2] = useState<AccomConfig>(defaultAccom("jpark"));

  function updateA1(patch: Partial<AccomConfig>) {
    const next = { ...a1, ...patch };
    if (patch.type) {
      next.roomType = patch.type === "jpark" ? "디럭스" : patch.type === "cubenine" ? "디럭스" : "";
      next.parents = 1; next.kids = 2; next.weeks = 2;
    }
    setA1(next);
  }
  function updateA2(patch: Partial<AccomConfig>) {
    const next = { ...a2, ...patch };
    if (patch.type) {
      next.roomType = patch.type === "jpark" ? "디럭스" : patch.type === "cubenine" ? "디럭스" : "";
      next.parents = 1; next.kids = 2; next.weeks = 2;
    }
    setA2(next);
  }

  // 계산
  let result: { total: number; items: { label: string; price: number; note: string }[] } | null = null;

  if (mode === "single") {
    const p = getPrice(a1);
    if (p !== null) {
      result = { total: p, items: [{ label: `${accomLabel[a1.type]}${a1.roomType ? ` ${a1.roomType}` : ""} ${a1.weeks}주`, price: p, note: `보호자 ${a1.parents}명 + 아이 ${a1.kids}명` }] };
    }
  } else {
    const totalWeeks = a1.weeks + a2.weeks;
    const p1 = getPrice(a1, totalWeeks);
    const p2 = getPrice(a2, totalWeeks);
    if (p1 !== null && p2 !== null) {
      const half1 = Math.round(p1 * 0.5);
      const half2 = Math.round(p2 * 0.5);
      result = {
        total: half1 + half2,
        items: [
          { label: `${accomLabel[a1.type]}${a1.roomType ? ` ${a1.roomType}` : ""} ${a1.weeks}주`, price: half1, note: `${totalWeeks}주 가격의 50% (보호자 ${a1.parents} + 아이 ${a1.kids})` },
          { label: `${accomLabel[a2.type]}${a2.roomType ? ` ${a2.roomType}` : ""} ${a2.weeks}주`, price: half2, note: `${totalWeeks}주 가격의 50% (보호자 ${a2.parents} + 아이 ${a2.kids})` },
        ],
      };
    }
  }

  function maxWeeks(type: AccomType) { return type === "dreamhouse" ? 12 : type === "jpark" ? 5 : 6; }
  function maxPeople(type: AccomType) { return type === "dreamhouse" ? 6 : 4; }

  function renderAccomForm(cfg: AccomConfig, update: (p: Partial<AccomConfig>) => void, idx: number) {
    const mw = maxWeeks(cfg.type);
    const mp = maxPeople(cfg.type);
    return (
      <div className="accom-card" key={idx}>
        <div className="accom-num">{mode === "combo" ? `숙소 ${idx}` : "숙소 선택"}</div>
        <div className="f-row">
          <div className="f-group">
            <label className="f-label">숙소</label>
            <select className="f-select" value={cfg.type} onChange={(e) => update({ type: e.target.value as AccomType })}>
              <option value="dreamhouse">드림하우스</option>
              <option value="jpark">제이파크</option>
              <option value="cubenine">큐브나인</option>
            </select>
          </div>
          {(cfg.type === "jpark" || cfg.type === "cubenine") && (
            <div className="f-group">
              <label className="f-label">룸타입</label>
              <select className="f-select" value={cfg.roomType} onChange={(e) => update({ roomType: e.target.value })}>
                {cfg.type === "jpark" ? (
                  <><option value="디럭스">디럭스</option><option value="프리미어">프리미어</option><option value="막탄스윗">막탄스윗</option></>
                ) : (
                  <><option value="디럭스">디럭스</option><option value="풀억세스룸">풀억세스룸</option></>
                )}
              </select>
            </div>
          )}
        </div>
        <div className="f-row">
          <div className="f-group">
            <label className="f-label">기간</label>
            <select className="f-select" value={cfg.weeks} onChange={(e) => update({ weeks: Number(e.target.value) })}>
              {Array.from({ length: mw - 1 }, (_, i) => i + 2).map((w) => (
                <option key={w} value={w}>{w}주</option>
              ))}
            </select>
          </div>
          <div className="f-group">
            <label className="f-label">보호자</label>
            <select className="f-select" value={cfg.parents} onChange={(e) => {
              const p = Number(e.target.value);
              const maxK = mp - p;
              update({ parents: p, kids: Math.min(cfg.kids, maxK) });
            }}>
              {[1, 2, 3].filter((p) => p < mp).map((p) => (
                <option key={p} value={p}>{p}명</option>
              ))}
            </select>
          </div>
          <div className="f-group">
            <label className="f-label">아이</label>
            <select className="f-select" value={cfg.kids} onChange={(e) => update({ kids: Number(e.target.value) })}>
              {Array.from({ length: mp - cfg.parents }, (_, i) => i + 1).map((k) => (
                <option key={k} value={k}>{k}명</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
        a{text-decoration:none;color:inherit;}

        .est-header{background:linear-gradient(135deg,#1a6fc4,#0d3d7a);padding:80px 40px 48px;text-align:center;}
        .est-header h1{color:#fff;font-size:clamp(28px,4vw,42px);font-weight:800;margin-bottom:8px;}
        .est-header p{color:rgba(255,255,255,0.7);font-size:15px;}

        .est-body{max-width:720px;margin:-32px auto 0;padding:0 20px 60px;position:relative;z-index:1;}

        /* MODE TOGGLE */
        .mode-toggle{display:flex;gap:4px;background:#fff;border-radius:10px;padding:4px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:24px;}
        .mode-btn{flex:1;padding:12px;font-size:14px;font-weight:700;text-align:center;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;background:transparent;color:#6b7c93;transition:all 160ms;}
        .mode-btn:hover{color:#1a1a2e;}
        .mode-btn.active{background:#1a6fc4;color:#fff;box-shadow:0 2px 8px rgba(26,111,196,0.3);}

        /* ACCOM CARD */
        .accom-card{background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:16px;}
        .accom-num{font-size:13px;font-weight:700;color:#1a6fc4;margin-bottom:16px;letter-spacing:0.03em;}
        .f-row{display:flex;gap:12px;margin-bottom:12px;}
        .f-row:last-child{margin-bottom:0;}
        .f-group{flex:1;}
        .f-label{display:block;font-size:11px;font-weight:600;color:#6b7c93;margin-bottom:4px;letter-spacing:0.03em;}
        .f-select{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:'Noto Sans KR',sans-serif;outline:none;background:#fff;transition:border-color 160ms;}
        .f-select:focus{border-color:#1a6fc4;}

        .combo-plus{text-align:center;padding:8px 0;font-size:24px;font-weight:800;color:#1a6fc4;}

        /* RESULT */
        .result-card{background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-top:24px;}
        .result-title{font-size:16px;font-weight:800;margin-bottom:16px;display:flex;align-items:center;gap:8px;}
        .result-item{display:flex;justify-content:space-between;align-items:flex-start;padding:14px 0;border-bottom:1px solid #e2e8f0;}
        .result-item:last-of-type{border-bottom:none;}
        .ri-label{font-size:14px;font-weight:600;color:#1a1a2e;}
        .ri-note{font-size:11px;color:#94a3b8;margin-top:2px;}
        .ri-price{font-size:15px;font-weight:700;color:#1a1a2e;text-align:right;white-space:nowrap;}
        .result-total{display:flex;justify-content:space-between;align-items:center;padding:18px 0 0;border-top:2px solid #1a1a2e;margin-top:8px;}
        .rt-label{font-size:16px;font-weight:800;}
        .rt-price{font-size:22px;font-weight:800;color:#1a6fc4;}

        .result-notice{margin-top:20px;padding:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:13px;color:#92400e;line-height:1.7;text-align:center;word-break:keep-all;}
        .result-notice strong{color:#d97706;}

        .no-result{text-align:center;padding:40px 20px;color:#94a3b8;font-size:14px;background:#fff;border-radius:14px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-top:24px;}

        .cta-btn{display:block;width:100%;padding:16px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:10px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;text-align:center;margin-top:16px;transition:background 160ms;}
        .cta-btn:hover{background:#0d3d7a;}

        .back-link{display:block;text-align:center;margin-top:16px;font-size:13px;color:#6b7c93;}
        .back-link:hover{color:#1a6fc4;}

        @media(max-width:600px){
          .est-header{padding:70px 20px 40px;}
          .f-row{flex-direction:column;gap:12px;}
        }
      `}</style>

      <div className="est-header">
        <h1>견적 계산기</h1>
        <p>숙소와 인원을 선택하면 예상 금액을 바로 확인할 수 있습니다.</p>
      </div>

      <div className="est-body">
        <div className="mode-toggle">
          <button className={`mode-btn${mode === "single" ? " active" : ""}`} onClick={() => setMode("single")}>숙소 1개</button>
          <button className={`mode-btn${mode === "combo" ? " active" : ""}`} onClick={() => setMode("combo")}>숙소 2개 조합</button>
        </div>

        {renderAccomForm(a1, updateA1, 1)}

        {mode === "combo" && (
          <>
            <div className="combo-plus">+</div>
            {renderAccomForm(a2, updateA2, 2)}
          </>
        )}

        {result ? (
          <div className="result-card">
            <div className="result-title">견적 결과</div>
            {result.items.map((item, i) => (
              <div className="result-item" key={i}>
                <div>
                  <div className="ri-label">{item.label}</div>
                  <div className="ri-note">{item.note}</div>
                </div>
                <div className="ri-price">{fmt(item.price)}</div>
              </div>
            ))}
            <div className="result-total">
              <span className="rt-label">총 예상 금액</span>
              <span className="rt-price">{fmt(result.total)}</span>
            </div>

            <div className="result-notice">
              <strong>정가 기준 견적입니다.</strong><br/>
              실제 할인가는 상담을 통해 안내드립니다.
            </div>

            <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer" className="cta-btn">
              카카오톡 상담하기
            </a>
          </div>
        ) : (
          <div className="no-result">선택하신 조건의 가격 정보가 없습니다.<br/>조건을 변경해주세요.</div>
        )}

        <a href="/" className="back-link">← 홈으로 돌아가기</a>
      </div>
    </>
  );
}
