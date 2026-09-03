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

// 숙소별 최저 정가 (카드 "최저 ₩…부터")
function minListPrice(d?: ParsedAccom): number {
  if (!d) return 0;
  const vals = Object.values(d.prices).map((p) => p[0]).filter((n) => n > 0);
  return vals.length ? Math.min(...vals) : 0;
}

/* ── 숙소 상세 (공식 안내서·브로셔 기반) ── */
interface RoomType { name: string; size?: string; beds?: string; cap?: string; note?: string; }
interface Highlight { icon: string; title: string; desc: string; }
interface ProductDetail {
  hero: string; gallery: string[]; intro: string; badges: string[];
  roomTypes: RoomType[]; highlights: Highlight[]; location: string[];
}
const PRODUCT_DETAIL: Record<string, ProductDetail> = {
  dreamhouse: {
    hero: "/images/dreamhouse.jpg",
    gallery: ["/images/dh-exterior.jpg", "/images/dh-living1.jpg", "/images/dreamhouse_Room-1.jpg", "/images/dreamhouseroom-10.jpg", "/images/bayswater002.jpg"],
    intro: "현지 생활을 그대로 담은 단독 2층 독채 숙소입니다. 베이스워터 빌리지 안에 위치해 한국인이 편안하게 생활할 수 있는 프라이빗 공간으로, 한국 정수기·디지털 도어락·한국산 가전이 구비되어 있습니다.",
    badges: ["독채 빌리지", "방 3 · 욕실 2", "수영장 자유이용", "주 6일 헬퍼 포함"],
    roomTypes: [
      { name: "드림하우스 (독채 전체)", beds: "방 3개 · 욕실 2개 · 거실 · 뒷마당", cap: "한 가족 단독 사용", note: "한국 정수기 · 디지털 도어락 · 방충망 · 한국산 가전" },
    ],
    highlights: [
      { icon: "🏊", title: "수영장 · 테니스 · 농구장", desc: "베이스워터 빌리지 부대시설 자유 이용" },
      { icon: "🛒", title: "미니마트 · 카페 · 스낵바", desc: "단지 내 도보 이용, 카드결제 가능" },
      { icon: "🧹", title: "주 6일 헬퍼 서비스", desc: "청소·정리 등 생활 지원 (드림하우스 전용)" },
    ],
    location: ["드림아카데미 차량 5분", "그랜드몰(플레이드림) 차량 5분", "제이파크 리조트 차량 10분", "공항 차량 약 20분"],
  },
  jpark: {
    hero: "/images/jpark.png",
    gallery: ["/images/jpark-g1.jpg", "/images/jpark-g2.jpg", "/images/jpark-g3.jpg", "/images/jpark-g4.jpg", "/images/jpark-g5.jpg"],
    intro: "막탄 최대 번화가에 위치한 5성급 아일랜드 리조트입니다. 7개 이상의 테마 수영장과 워터슬라이드, 다양한 액티비티를 갖춘 가족 맞춤형 올인클루시브 리조트로, 도보권에 식당·마트·마사지 등 편의시설이 풍부합니다.",
    badges: ["5성급", "820 객실", "테마 수영장 7+", "리조트 식당 30% 할인"],
    roomTypes: [
      { name: "Deluxe (Tower B)", size: "38㎡", beds: "침실 + 욕실", cap: "최대 4인" },
      { name: "Premier (Tower G · 신축)", size: "32㎡", beds: "침실 + 욕실 (신축동)", cap: "최대 4인" },
      { name: "Mactan Suite (Tower A/C)", size: "76㎡", beds: "침실1 + 거실1 + 욕실1 + 화장실2", cap: "최대 4인" },
    ],
    highlights: [
      { icon: "🍽️", title: "레스토랑 30% 할인", desc: "리조트 내 레스토랑·바 30% 할인 (일부 제외) · 조식 50% 할인" },
      { icon: "🏝️", title: "전용 해변 · 워터파크", desc: "테마 수영장 7개+, 워터슬라이드, 프라이빗 비치" },
      { icon: "👶", title: "키즈 프렌들리", desc: "성인 결제 시 6세 미만 아동 최대 2명 조식 무료" },
    ],
    location: ["샹스몰 도보 2분", "한인마트 도보 3분", "공항 차량 20분", "드림아카데미 차량 10~13분"],
  },
  cubenine: {
    hero: "/images/cube9.png",
    gallery: ["/images/cube9-g1.jpg", "/images/cube9-g2.jpg", "/images/cube9-g3.jpg", "/images/cube9-g4.jpg", "/images/cube9-g5.jpg"],
    intro: "오션뷰 인피니티 풀과 조용한 여유를 갖춘 막탄 프리미엄 리조트입니다. 바다를 바라보는 야외 수영장과 해양 액티비티, 오션뷰 레스토랑 조식이 포함되어 자연과 함께하는 힐링 어학연수 환경을 제공합니다.",
    badges: ["오션뷰", "인피니티 풀", "조식 포함", "해양 액티비티"],
    roomTypes: [
      { name: "Deluxe Ocean (King / Twin)", size: "46.08㎡", beds: "오션뷰 + 테라스 + 선셋베드", cap: "최대 4인" },
      { name: "Deluxe Pool Access (트윈 퀸)", size: "43.68㎡", beds: "메인풀 직접 연결", cap: "최대 4인" },
    ],
    highlights: [
      { icon: "🌅", title: "오션뷰 인피니티 풀", desc: "바다를 바라보는 야외 수영장" },
      { icon: "🍳", title: "조식 포함 (월~일)", desc: "오션뷰 더나인 레스토랑 조식 · 평일 석식 도시락 제공" },
      { icon: "🛶", title: "해양 액티비티", desc: "카약·패들 이용, 다이빙 스팟 인접" },
    ],
    location: ["샹스몰 차량 3분 / 도보 10분", "공항 차량 20~30분", "베이스워터 차량 5분", "드림아카데미 차량 10~13분"],
  },
};

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
        <span className="store-badge">🏝️ 드림아카데미 공식 스토어</span>
        <h1>필리핀 세부 영어캠프 패키지</h1>
        <p>숙소 · 정규수업 · 평일 3식 · 주말 셔틀 · 애프터스쿨까지 올인원. 원하시는 패키지를 선택하세요.</p>
        <div className="trust-row">
          <span>🔒 안전결제 (PG)</span>
          <span>💬 고객센터 010-2639-2826</span>
          <span>↩️ 환불정책 명시</span>
        </div>
      </div>

      <main className="pmain">
        {error && <div className="perr">⚠️ {error}</div>}
        {!book && !error && <div className="ploading">가격 정보를 불러오는 중...</div>}

        {book && (
          <div className="pgrid">
            {sections.map((cfg) => {
              const mp = minListPrice(book[cfg.id]);
              const sel = activeTab === cfg.id;
              const icon = cfg.id === "dreamhouse" ? "🏡" : cfg.id === "jpark" ? "🌊" : "🏊";
              return (
                <button
                  key={cfg.id}
                  type="button"
                  className={`pcard ${sel ? "sel" : ""}`}
                  onClick={() => { setActiveTab(cfg.id); if (typeof document !== "undefined") document.getElementById("pdetail")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                >
                  <div className={`pcard-img img-${cfg.id}`}><span>{icon}</span></div>
                  <div className="pcard-body">
                    <div className="pcard-name">{cfg.title}</div>
                    <div className="pcard-tag">{cfg.tagline}</div>
                    <div className="pcard-foot">
                      <div className="pcard-price">{mp > 0 ? (<><span>최저</span> <b>{won(mp)}</b> 부터</>) : "가격 문의"}</div>
                      <span className="pcard-cta">{sel ? "✓ 선택됨" : "상세 보기 →"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {book && (
          <div id="pdetail">
            {(() => {
              const det = PRODUCT_DETAIL[activeTab];
              if (!det) return null;
              return (
                <div className="pd-rich">
                  <div className="pd-hero" style={{ backgroundImage: `url(${det.hero})` }} />
                  <div className="pd-thumbs">
                    {det.gallery.map((g) => <div key={g} className="pd-thumb" style={{ backgroundImage: `url(${g})` }} />)}
                  </div>
                  <div className="pd-badges">{det.badges.map((b) => <span key={b}>{b}</span>)}</div>
                  <p className="pd-intro">{det.intro}</p>
                  <h3 className="pd-h">🛏️ 룸 타입</h3>
                  <div className="pd-rooms">
                    {det.roomTypes.map((r) => (
                      <div className="pd-room" key={r.name}>
                        <div className="pd-room-name">{r.name}{r.size && <span className="pd-room-size">{r.size}</span>}</div>
                        <div className="pd-room-info">{[r.beds, r.cap, r.note].filter(Boolean).join(" · ")}</div>
                      </div>
                    ))}
                  </div>
                  <h3 className="pd-h">✨ 주요 특징</h3>
                  <div className="pd-highlights">
                    {det.highlights.map((h) => (
                      <div className="pd-hl" key={h.title}>
                        <span className="pd-hl-ic">{h.icon}</span>
                        <div className="pd-hl-tx"><b>{h.title}</b><span>{h.desc}</span></div>
                      </div>
                    ))}
                  </div>
                  <h3 className="pd-h">📍 위치</h3>
                  <div className="pd-loc">{det.location.map((l) => <span key={l}>{l}</span>)}</div>
                </div>
              );
            })()}
            <div className="pdetail-head">💰 {sections.find((s) => s.id === activeTab)?.title} · 상세 가격</div>
            {sections.map((cfg) => (
              <div key={cfg.id} style={{ display: activeTab === cfg.id ? "block" : "none" }}>
                <AccomSection cfg={cfg} data={book[cfg.id]} />
              </div>
            ))}
          </div>
        )}

        {/* 이용약관 / 환불정책 */}
        <section className="terms">
          <h2>이용약관 · 환불정책</h2>
          <p className="terms-notice">{COMMON_NOTICE_TEXT}</p>
          {(() => {
            const policy = REFUND_POLICIES[activeTab];
            if (!policy) return null;
            return (
              <div className="policy">
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
          })()}
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
        .store-badge { display: inline-block; background: #eef2ff; color: #4338ca; font-size: 12.5px; font-weight: 800; padding: 5px 14px; border-radius: 999px; margin-bottom: 12px; }
        .trust-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 18px; margin-top: 16px; }
        .trust-row span { font-size: 12.5px; color: #475569; font-weight: 600; }
        .pgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
        .pcard { display: flex; flex-direction: column; text-align: left; padding: 0; border: 1.5px solid #e2e8f0; border-radius: 16px; background: #fff; cursor: pointer; overflow: hidden; font-family: inherit; transition: transform 160ms, box-shadow 160ms, border-color 160ms; }
        .pcard:hover { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(20,30,60,0.10); }
        .pcard.sel { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }
        .pcard-img { height: 130px; display: flex; align-items: center; justify-content: center; font-size: 46px; }
        .pcard-img.img-dreamhouse { background: linear-gradient(135deg, #34d399, #0ea5a4); }
        .pcard-img.img-jpark { background: linear-gradient(135deg, #38bdf8, #2563eb); }
        .pcard-img.img-cubenine { background: linear-gradient(135deg, #a78bfa, #7c3aed); }
        .pcard-body { padding: 16px 16px 18px; display: flex; flex-direction: column; flex: 1; }
        .pcard-name { font-size: 16px; font-weight: 800; margin-bottom: 5px; }
        .pcard-tag { font-size: 12.5px; color: #6b7c93; line-height: 1.5; flex: 1; margin-bottom: 14px; }
        .pcard-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; }
        .pcard-price { font-size: 12px; color: #94a3b8; }
        .pcard-price span { font-size: 11px; }
        .pcard-price b { font-size: 18px; color: #1a1a2e; font-weight: 800; }
        .pcard-cta { flex-shrink: 0; font-size: 12.5px; font-weight: 800; color: #2563eb; background: #eff6ff; padding: 7px 12px; border-radius: 8px; }
        .pcard.sel .pcard-cta { background: #2563eb; color: #fff; }
        .pdetail-head { font-size: 16px; font-weight: 800; color: #1a1a2e; margin: 24px 0 14px; padding-left: 4px; }
        .pd-rich { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; margin-bottom: 8px; }
        .pd-hero { width: 100%; height: 230px; border-radius: 12px; background-size: cover; background-position: center; }
        .pd-thumbs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 8px; }
        .pd-thumb { height: 64px; border-radius: 8px; background-size: cover; background-position: center; }
        .pd-badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 16px 0 12px; }
        .pd-badges span { font-size: 12px; font-weight: 700; color: #1d4ed8; background: #eff6ff; border: 1px solid #bfdbfe; padding: 4px 11px; border-radius: 999px; }
        .pd-intro { font-size: 13.5px; color: #475569; line-height: 1.75; margin: 0 0 6px; }
        .pd-h { font-size: 15px; font-weight: 800; color: #1a1a2e; margin: 20px 0 10px; }
        .pd-rooms { display: flex; flex-direction: column; gap: 9px; }
        .pd-room { border: 1px solid #e2e8f0; border-radius: 11px; padding: 12px 14px; background: #f8fafc; }
        .pd-room-name { font-size: 14px; font-weight: 800; color: #1a1a2e; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .pd-room-size { font-size: 11.5px; font-weight: 700; color: #0369a1; background: #e0f2fe; padding: 2px 8px; border-radius: 6px; }
        .pd-room-info { font-size: 12.5px; color: #64748b; margin-top: 4px; line-height: 1.5; }
        .pd-highlights { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .pd-hl { display: flex; gap: 10px; align-items: flex-start; border: 1px solid #eef2f7; border-radius: 11px; padding: 12px; background: #fff; }
        .pd-hl-ic { font-size: 22px; flex-shrink: 0; }
        .pd-hl-tx { display: flex; flex-direction: column; min-width: 0; }
        .pd-hl-tx b { font-size: 13px; font-weight: 800; margin-bottom: 2px; }
        .pd-hl-tx span { font-size: 11.5px; color: #6b7c93; line-height: 1.5; }
        .pd-loc { display: flex; flex-wrap: wrap; gap: 7px; }
        .pd-loc span { font-size: 12.5px; color: #475569; background: #f1f5f9; border-radius: 8px; padding: 6px 11px; font-weight: 600; }
        .pd-loc span::before { content: "📍 "; }
        @media (max-width: 600px) {
          .biz dl { grid-template-columns: 1fr; }
          .phero h1 { font-size: 23px; }
          .pgrid { grid-template-columns: 1fr; }
          .pd-highlights { grid-template-columns: 1fr; }
          .pd-hero { height: 180px; }
          .pd-thumb { height: 48px; }
        }
      `}</style>
    </div>
  );
}
