"use client";
/**
 * PG 카드심사용 공개 상품 안내 페이지 (/products)
 * - 가격은 하드코딩하지 않고 public/price.xlsx 를 런타임에 SheetJS로 fetch·파싱해 재사용
 *   (견적계산기와 동일한 키 구조: 드림하우스 = 기간-보호자-아이 / 제이파크·큐브나인 = 룸타입-기간-보호자-아이)
 * - 포함/불포함: lib/packageInfo.ts 재사용 / 이용약관·환불정책: lib/refundPolicy.ts 재사용
 * - 결제 버튼 없음 (실제 결제는 손님 포털 인보이스에서만 진행)
 */
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import * as PortOne from "@portone/browser-sdk/v2";
import {
  INCLUSIONS_DH,
  INCLUSIONS_JP,
  INCLUSIONS_C9,
  COMMON_EXCLUSIONS,
  type PkgItem,
} from "@/lib/packageInfo";
import { REFUND_POLICIES, COMMON_NOTICE_TEXT } from "@/lib/refundPolicy";

type P3 = [number, number, number]; // [정가, 비수기, 성수기]

interface ParsedAccom {
  prices: Record<string, P3>; // DH: `${w}-${p}-${k}` / JP·C9: `${room}-${w}-${p}-${k}`
  weeks: number[];
  parents: number[];
  kids: number[];
  roomTypes: string[]; // DH 는 []
}

interface PriceBook {
  dreamhouse: ParsedAccom;
  jpark: ParsedAccom;
  cubenine: ParsedAccom;
}

function won(n: number) {
  return "₩" + n.toLocaleString("ko-KR");
}

// 정렬된 distinct 숫자 배열
function uniqSortedNum(arr: number[]): number[] {
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}

/* ── price.xlsx 파싱 (견적계산기 키 구조 그대로) ── */
function parseWorkbook(wb: XLSX.WorkBook): PriceBook {
  const names = wb.SheetNames;
  const dhName = names.find((n) => n.includes("하우스")) || names[0];
  const jpName = names.find((n) => n.includes("제이")) || names[1];
  const c9Name = names.find((n) => n.includes("큐브")) || names[2];

  // 드림하우스: [기간, 보호자, 아이, 총인원, 정가, 비수기, 성수기]
  function parseDH(sheetName: string): ParsedAccom {
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheetName], {
      header: 1,
      blankrows: false,
    });
    const prices: Record<string, P3> = {};
    const weeks: number[] = [], parents: number[] = [], kids: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const w = Number(r[0]), p = Number(r[1]), k = Number(r[2]);
      const list = Number(r[4]), off = Number(r[5]), peak = Number(r[6]);
      if (!w || !p || !k || !list) continue;
      prices[`${w}-${p}-${k}`] = [list, off, peak];
      weeks.push(w); parents.push(p); kids.push(k);
    }
    return { prices, weeks: uniqSortedNum(weeks), parents: uniqSortedNum(parents), kids: uniqSortedNum(kids), roomTypes: [] };
  }

  // 제이파크·큐브나인: [룸타입, 기간, 보호자, 아이, 총인원, 정가, 비수기, 성수기]
  function parseRoomed(sheetName: string): ParsedAccom {
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[sheetName], {
      header: 1,
      blankrows: false,
    });
    const prices: Record<string, P3> = {};
    const weeks: number[] = [], parents: number[] = [], kids: number[] = [];
    const roomTypes: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const room = String(r[0] ?? "").trim();
      const w = Number(r[1]), p = Number(r[2]), k = Number(r[3]);
      const list = Number(r[5]), off = Number(r[6]), peak = Number(r[7]);
      if (!room || !w || !p || !k || !list) continue;
      prices[`${room}-${w}-${p}-${k}`] = [list, off, peak];
      weeks.push(w); parents.push(p); kids.push(k);
      if (!roomTypes.includes(room)) roomTypes.push(room);
    }
    return { prices, weeks: uniqSortedNum(weeks), parents: uniqSortedNum(parents), kids: uniqSortedNum(kids), roomTypes };
  }

  return { dreamhouse: parseDH(dhName), jpark: parseRoomed(jpName), cubenine: parseRoomed(c9Name) };
}

/* ── 숙소 섹션 ── */
interface SectionConfig {
  id: "dreamhouse" | "jpark" | "cubenine";
  title: string;
  shortLabel: string;
  tagline: string;
  inclusions: PkgItem[];
}

function lookupPrice(data: ParsedAccom, room: string, w: number, p: number, k: number): P3 | null {
  const key = data.roomTypes.length ? `${room}-${w}-${p}-${k}` : `${w}-${p}-${k}`;
  return data.prices[key] ?? null;
}

function AccomSection({ cfg, data }: { cfg: SectionConfig; data: ParsedAccom }) {
  const hasRoom = data.roomTypes.length > 0;
  const [room, setRoom] = useState<string>(hasRoom ? data.roomTypes[0] : "");
  const [weeks, setWeeks] = useState<number>(data.weeks.includes(2) ? 2 : data.weeks[0]);
  const [parents, setParents] = useState<number>(data.parents.includes(1) ? 1 : data.parents[0]);
  const [kids, setKids] = useState<number>(data.kids.includes(2) ? 2 : data.kids[0]);

  // "부터" 가격: 기본값 2주 / 보호자1 + 아이2 정가 (없으면 해당 숙소 최저 정가)
  const fromPrice = useMemo(() => {
    const def = lookupPrice(data, hasRoom ? data.roomTypes[0] : "", 2, 1, 2);
    if (def) return def[0];
    const all = Object.values(data.prices).map((v) => v[0]).filter(Boolean);
    return all.length ? Math.min(...all) : 0;
  }, [data, hasRoom]);

  const selected = lookupPrice(data, room, weeks, parents, kids);
  const listPrice = selected ? selected[0] : null; // 정가 기준

  // 결제 (PG 카드심사용)
  const [showForm, setShowForm] = useState(false);
  const [buyer, setBuyer] = useState({ fullName: "", phoneNumber: "", email: "" });
  const [paying, setPaying] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const orderName = `${cfg.shortLabel}${hasRoom ? ` ${room}` : ""} ${weeks}주 보호자${parents}+아이${kids}`;

  async function pay() {
    if (!listPrice) return;
    if (!buyer.fullName.trim() || !buyer.phoneNumber.trim() || !buyer.email.trim()) {
      setFeedback({ type: "err", msg: "이름·연락처·이메일을 모두 입력해주세요." });
      return;
    }
    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
    const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
    if (!storeId || !channelKey) {
      setFeedback({ type: "err", msg: "결제 설정이 준비되지 않았습니다. 관리자에게 문의하세요." });
      return;
    }
    setPaying(true);
    setFeedback(null);
    try {
      const paymentId = `product-${Date.now()}`;
      const res = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId,
        orderName,
        totalAmount: listPrice,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        customer: { fullName: buyer.fullName, phoneNumber: buyer.phoneNumber, email: buyer.email },
      });
      if (!res || res.code !== undefined) {
        setFeedback({ type: "err", msg: res?.message || "결제가 취소되었습니다." });
        return;
      }
      // 서버 검증 (포트원 단건조회 + 정가 재계산)
      const verify = await fetch("/api/products/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: paymentId, accom: cfg.id, roomType: room, weeks, parents, kids, buyer }),
      });
      if (!verify.ok) {
        const r = await verify.json().catch(() => ({}));
        setFeedback({ type: "err", msg: r.error || "결제 검증에 실패했습니다. 관리자에게 문의하세요." });
        return;
      }
      setFeedback({ type: "ok", msg: "결제가 완료되었습니다. 감사합니다." });
      setShowForm(false);
    } catch {
      setFeedback({ type: "err", msg: "결제 중 오류가 발생했습니다. 다시 시도해주세요." });
    } finally {
      setPaying(false);
    }
  }

  return (
    <section className="accom">
      <div className="accom-head">
        <h2>{cfg.title}</h2>
        <p className="tagline">{cfg.tagline}</p>
        <div className="from">
          {fromPrice ? (<><span className="from-num">{won(fromPrice)}</span><span className="from-unit">부터</span></>) : "가격 문의"}
          <span className="from-note">2주 · 보호자 1 + 아이 2 · 정가 기준</span>
        </div>
      </div>

      <div className="accom-body">
        {/* 가격 계산 */}
        <div className="picker">
          <div className="picker-title">구성 선택</div>
          <div className="picker-grid">
            {hasRoom && (
              <label>
                <span>룸타입</span>
                <select value={room} onChange={(e) => setRoom(e.target.value)}>
                  {data.roomTypes.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
                </select>
              </label>
            )}
            <label>
              <span>기간</span>
              <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                {data.weeks.map((w) => <option key={w} value={w}>{w}주</option>)}
              </select>
            </label>
            <label>
              <span>보호자</span>
              <select value={parents} onChange={(e) => setParents(Number(e.target.value))}>
                {data.parents.map((p) => <option key={p} value={p}>{p}명</option>)}
              </select>
            </label>
            <label>
              <span>아이</span>
              <select value={kids} onChange={(e) => setKids(Number(e.target.value))}>
                {data.kids.map((k) => <option key={k} value={k}>{k}명</option>)}
              </select>
            </label>
          </div>
          <div className="picker-result">
            {listPrice ? (
              <>
                <span className="pr-label">선택 구성 정가</span>
                <span className="pr-num">{won(listPrice)}</span>
              </>
            ) : (
              <span className="pr-none">해당 구성은 별도 문의 바랍니다.</span>
            )}
          </div>
          <p className="picker-foot">※ 표시 가격은 정가(원화) 기준이며, 체크인 시즌(비수기/성수기)에 따라 달라질 수 있습니다. 최종 금액은 상담·견적 후 확정됩니다.</p>
        </div>

        {/* 결제 (PG 카드심사용) */}
        {listPrice && (
          <div className="paybox">
            {!showForm ? (
              <button className="pay-open" onClick={() => { setShowForm(true); setFeedback(null); }}>
                이 구성으로 결제하기 ({won(listPrice)})
              </button>
            ) : (
              <div className="payform">
                <div className="pf-title">결제자 정보 입력</div>
                <div className="pf-sum">{orderName} · <b>{won(listPrice)}</b></div>
                <input placeholder="이름" value={buyer.fullName} onChange={(e) => setBuyer({ ...buyer, fullName: e.target.value })} />
                <input placeholder="연락처 (예: 01012345678)" value={buyer.phoneNumber} onChange={(e) => setBuyer({ ...buyer, phoneNumber: e.target.value })} />
                <input placeholder="이메일" type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} />
                <div className="pf-btns">
                  <button className="pf-cancel" onClick={() => setShowForm(false)} disabled={paying}>취소</button>
                  <button className="pf-pay" onClick={pay} disabled={paying}>{paying ? "결제 진행 중..." : "결제 진행"}</button>
                </div>
              </div>
            )}
            {feedback && <div className={`pf-fb ${feedback.type}`}>{feedback.type === "ok" ? "✅ " : "⚠️ "}{feedback.msg}</div>}
          </div>
        )}

        {/* 포함 / 불포함 */}
        <div className="incl">
          <div className="incl-col">
            <div className="incl-h ok">포함 사항</div>
            <ul>
              {cfg.inclusions.map((it, i) => (
                <li key={i}><span className="ic">{it.icon}</span><div><b>{it.title}</b>{it.desc && <em>{it.desc}</em>}</div></li>
              ))}
            </ul>
          </div>
          <div className="incl-col">
            <div className="incl-h no">불포함 / 현지 별도</div>
            <ul>
              {COMMON_EXCLUSIONS.map((it, i) => (
                <li key={i}><span className="ic">{it.icon}</span><div><b>{it.title}</b><em>{it.desc}</em></div></li>
              ))}
            </ul>
          </div>
        </div>

        <a href="/booking" className="apply-btn">예약 신청하기 →</a>
      </div>

      <style jsx>{`
        .accom { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-bottom: 28px; box-shadow: 0 2px 16px rgba(0,0,0,0.04); }
        .accom-head { background: linear-gradient(135deg, #1a6fc4, #2563eb); color: #fff; padding: 28px 28px 24px; }
        .accom-head h2 { font-size: 22px; font-weight: 800; margin: 0 0 6px; }
        .tagline { font-size: 14px; opacity: 0.9; margin: 0 0 16px; }
        .from { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .from-num { font-size: 30px; font-weight: 800; }
        .from-unit { font-size: 15px; opacity: 0.9; }
        .from-note { font-size: 12px; opacity: 0.8; margin-left: 4px; }
        .accom-body { padding: 24px 28px 28px; }
        .picker { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 22px; }
        .picker-title { font-size: 13px; font-weight: 700; color: #1a6fc4; margin-bottom: 12px; }
        .picker-grid { display: flex; gap: 10px; flex-wrap: wrap; }
        .picker-grid label { flex: 1; min-width: 110px; display: flex; flex-direction: column; gap: 4px; }
        .picker-grid label span { font-size: 12px; font-weight: 600; color: #6b7c93; }
        .picker-grid select { padding: 9px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-family: inherit; background: #fff; color: #1a1a2e; }
        .picker-result { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 14px; border-top: 1px dashed #cbd5e1; }
        .pr-label { font-size: 14px; font-weight: 600; color: #475569; }
        .pr-num { font-size: 24px; font-weight: 800; color: #1a6fc4; }
        .pr-none { font-size: 14px; color: #94a3b8; font-weight: 600; }
        .picker-foot { font-size: 11.5px; color: #94a3b8; margin: 10px 0 0; line-height: 1.5; }
        .incl { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 22px; }
        .incl-col { flex: 1; min-width: 260px; }
        .incl-h { font-size: 14px; font-weight: 800; padding-bottom: 8px; margin-bottom: 10px; border-bottom: 2px solid; }
        .incl-h.ok { color: #166534; border-color: #bbf7d0; }
        .incl-h.no { color: #b45309; border-color: #fde68a; }
        .incl ul { list-style: none; margin: 0; padding: 0; }
        .incl li { display: flex; gap: 10px; padding: 7px 0; align-items: flex-start; }
        .incl li .ic { font-size: 16px; line-height: 1.4; flex-shrink: 0; }
        .incl li b { display: block; font-size: 13.5px; color: #1a1a2e; font-weight: 700; }
        .incl li em { display: block; font-size: 12px; color: #6b7c93; font-style: normal; margin-top: 1px; }
        .paybox { margin-bottom: 22px; }
        .pay-open { width: 100%; padding: 13px; border: none; border-radius: 10px; background: #0ea5e9; color: #fff; font-size: 14.5px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background 160ms; }
        .pay-open:hover { background: #0284c7; }
        .payform { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 16px; }
        .pf-title { font-size: 13px; font-weight: 700; color: #0369a1; margin-bottom: 4px; }
        .pf-sum { font-size: 13px; color: #475569; margin-bottom: 12px; }
        .pf-sum b { color: #1a6fc4; }
        .payform input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-family: inherit; margin-bottom: 8px; box-sizing: border-box; }
        .pf-btns { display: flex; gap: 8px; margin-top: 4px; }
        .pf-cancel { flex: 0 0 auto; padding: 11px 18px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #64748b; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .pf-pay { flex: 1; padding: 11px; border: none; border-radius: 8px; background: #1a6fc4; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
        .pf-pay:disabled, .pf-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
        .pf-fb { margin-top: 10px; padding: 10px 12px; border-radius: 8px; font-size: 13px; font-weight: 600; }
        .pf-fb.ok { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .pf-fb.err { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .apply-btn { display: block; text-align: center; background: #1a6fc4; color: #fff; font-size: 15px; font-weight: 700; padding: 14px; border-radius: 10px; transition: background 160ms; }
        .apply-btn:hover { background: #155a9e; color: #fff; }
      `}</style>
    </section>
  );
}

export default function ProductsPage() {
  const [book, setBook] = useState<PriceBook | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<SectionConfig["id"]>("dreamhouse");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/price.xlsx");
        if (!res.ok) throw new Error("price.xlsx 로드 실패");
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        setBook(parseWorkbook(wb));
      } catch (e) {
        setError(e instanceof Error ? e.message : "가격 정보를 불러오지 못했습니다.");
      }
    })();
  }, []);

  const sections: SectionConfig[] = [
    { id: "dreamhouse", title: "드림하우스 (독채 빌리지)", shortLabel: "드림하우스", tagline: "단독 하우스 + 수영장 자유 이용 · 드림아카데미 정규 수업 올인원", inclusions: INCLUSIONS_DH },
    { id: "jpark", title: "제이파크 리조트", shortLabel: "제이파크", tagline: "워터파크 & 비치 리조트 + 정규 수업 결합 패키지", inclusions: INCLUSIONS_JP },
    { id: "cubenine", title: "큐브나인 리조트", shortLabel: "큐브나인", tagline: "인피니티 풀 리조트 + 조식 포함 + 정규 수업 결합 패키지", inclusions: INCLUSIONS_C9 },
  ];

  return (
    <div className="pwrap">
      {/* 상단 바 */}
      <header className="ptop">
        <a href="/" className="back">← 드림아카데미 홈</a>
        <a href="/booking" className="cta">예약 신청</a>
      </header>

      <div className="phero">
        <h1>요금 안내 · 패키지 상품</h1>
        <p>드림아카데미 어학연수 패키지 상품의 구성과 가격을 안내합니다. 모든 가격은 원화(₩) 기준입니다.</p>
      </div>

      <main className="pmain">
        {error && <div className="perr">⚠️ {error}</div>}
        {!book && !error && <div className="ploading">가격 정보를 불러오는 중...</div>}

        {book && (
          <div className="ptabs" role="tablist">
            {sections.map((cfg) => (
              <button
                key={cfg.id}
                type="button"
                role="tab"
                aria-selected={activeTab === cfg.id}
                className={`ptab ${activeTab === cfg.id ? "active" : ""}`}
                onClick={() => setActiveTab(cfg.id)}
              >
                {cfg.shortLabel}
              </button>
            ))}
          </div>
        )}

        {book && sections.map((cfg) => (
          <div key={cfg.id} style={{ display: activeTab === cfg.id ? "block" : "none" }}>
            <AccomSection cfg={cfg} data={book[cfg.id]} />
          </div>
        ))}

        {/* 이용약관 / 환불정책 */}
        <section className="terms">
          <h2>이용약관 · 환불정책</h2>
          <p className="terms-notice">{COMMON_NOTICE_TEXT}</p>
          {(["dreamhouse", "jpark", "cubenine"] as const).map((key) => {
            const policy = REFUND_POLICIES[key];
            return (
              <div className="policy" key={key}>
                <h3>{policy.title}</h3>
                {policy.sections.map((sec, i) => (
                  <div className="psec" key={i}>
                    <div className="psec-h"><span>{sec.icon}</span>{sec.title}</div>
                    <ul>
                      {sec.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      </main>

      {/* 사업자정보 (카드심사 필수) */}
      <footer className="pfoot">
        <div className="biz">
          <div className="biz-title">사업자 정보</div>
          <dl>
            <div><dt>상호</dt><dd>세부드림연수</dd></div>
            <div><dt>대표자</dt><dd>오초희</dd></div>
            <div><dt>사업자등록번호</dt><dd>105-36-13435</dd></div>
            <div><dt>통신판매업 신고번호</dt><dd><span className="ph">신고 예정</span></dd></div>
            <div><dt>사업장 소재지</dt><dd>경상남도 김해시 금관대로 1205, 202-S36호(외동)</dd></div>
            <div><dt>고객센터</dt><dd>010-2639-2826</dd></div>
            <div><dt>이메일</dt><dd>admin@dreamacademyph.com</dd></div>
          </dl>
          <p className="biz-note">※ 통신판매업 신고번호는 발급 후 등록 예정입니다.</p>
        </div>
        <p className="copyright">© Dream Academy Philippines. 결제는 예약 확정 후 손님 포털 인보이스에서만 진행됩니다.</p>
      </footer>

      <style jsx>{`
        .pwrap { min-height: 100vh; background: #f1f5f9; font-family: 'Noto Sans KR', sans-serif; color: #1a1a2e; }
        .ptop { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; align-items: center; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 14px 20px; }
        .ptop .back { font-size: 14px; color: #6b7c93; font-weight: 600; }
        .ptop .back:hover { color: #1a6fc4; }
        .ptop .cta { background: #1a6fc4; color: #fff; font-size: 13.5px; font-weight: 700; padding: 8px 18px; border-radius: 6px; }
        .ptop .cta:hover { background: #155a9e; color: #fff; }
        .phero { max-width: 880px; margin: 0 auto; padding: 36px 20px 20px; text-align: center; }
        .phero h1 { font-size: 28px; font-weight: 800; margin: 0 0 10px; }
        .phero p { font-size: 14px; color: #6b7c93; margin: 0; line-height: 1.6; }
        .pmain { max-width: 880px; margin: 0 auto; padding: 12px 20px 40px; }
        .ptabs { display: flex; gap: 8px; margin-bottom: 18px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
        .ptab { flex: 1; padding: 12px 8px; border: none; border-radius: 8px; background: transparent; color: #64748b; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background 160ms, color 160ms; }
        .ptab:hover { color: #1a6fc4; }
        .ptab.active { background: linear-gradient(135deg, #1a6fc4, #2563eb); color: #fff; }
        .perr { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 10px; padding: 16px; font-size: 14px; font-weight: 600; text-align: center; }
        .ploading { text-align: center; color: #94a3b8; padding: 60px 0; font-size: 14px; }
        .terms { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 28px; margin-top: 8px; }
        .terms h2 { font-size: 20px; font-weight: 800; margin: 0 0 8px; }
        .terms-notice { font-size: 13px; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; margin: 0 0 20px; }
        .policy { margin-bottom: 24px; padding-bottom: 4px; }
        .policy h3 { font-size: 16px; font-weight: 800; color: #1a6fc4; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        .psec { margin-bottom: 14px; }
        .psec-h { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; color: #1a1a2e; margin-bottom: 6px; }
        .psec ul { margin: 0; padding-left: 20px; }
        .psec li { font-size: 13px; color: #475569; line-height: 1.7; margin-bottom: 3px; }
        .pfoot { background: #1a1a2e; color: #cbd5e1; padding: 32px 20px; }
        .biz { max-width: 880px; margin: 0 auto; }
        .biz-title { font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 14px; }
        .biz dl { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
        .biz dl > div { display: flex; gap: 10px; font-size: 13px; border-bottom: 1px solid #2d2d44; padding-bottom: 8px; }
        .biz dt { color: #94a3b8; min-width: 110px; flex-shrink: 0; }
        .biz dd { margin: 0; color: #e2e8f0; }
        .biz .ph { color: #f59e0b; }
        .biz-note { font-size: 12px; color: #94a3b8; margin: 16px 0 0; line-height: 1.6; }
        .copyright { max-width: 880px; margin: 20px auto 0; font-size: 12px; color: #64748b; text-align: center; }
        @media (max-width: 600px) {
          .biz dl { grid-template-columns: 1fr; }
          .phero h1 { font-size: 23px; }
        }
      `}</style>
    </div>
  );
}
