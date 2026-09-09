"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

type Cur = "PHP" | "KRW";
type Book = "회사" | "집";
interface Row {
  id: string; entry_date: string; book: Book; type: "income" | "expense";
  division: string; detail: string; memo: string; amount: number; currency: Cur;
}
const CO_EXP = ["모리", "드림하우스", "재료비", "인건비", "기타"];
const CO_INC = ["수강료", "숙박", "기타"];
const HOME_DIV = ["주거", "생활", "건강", "교통", "기타"];
const PASS_KEY = "mayLedgerPass";

const C = {
  ground: "#f2f4f2", surface: "#fff", surface2: "#f7f9f7", ink: "#182220", muted: "#5c6b64", faint: "#8a968f",
  line: "#e1e7e2", lineS: "#cbd5ce", accent: "#0e6e5b", accentSoft: "#e3f1ec",
  income: "#1c7a45", incomeSoft: "#e6f3ea", expense: "#b23a28", expenseSoft: "#fbeae5", home: "#8a5a1c",
};
const fld: React.CSSProperties = { padding: "8px 11px", fontSize: 14, border: `1px solid ${C.lineS}`, borderRadius: 9, background: C.surface, color: C.ink, boxSizing: "border-box" };
const won = (n: number) => "₱" + Math.round(n).toLocaleString("en-US");

export default function MayLedgerPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState("");
  const [passInput, setPassInput] = useState("");
  const [gate, setGate] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const [items, setItems] = useState<Row[]>([]);
  const [krwPerPhp, setKrw] = useState(23);
  const [month, setMonth] = useState("all");
  const [coFilter, setCoFilter] = useState<"all" | string>("all");

  const today = new Date().toISOString().slice(0, 10);
  const [fDate, setFDate] = useState(today);
  const [fBook, setFBook] = useState<Book>("회사");
  const [fType, setFType] = useState<"income" | "expense">("expense");
  const [fDiv, setFDiv] = useState("모리");
  const [fDetail, setFDetail] = useState("");
  const [fMemo, setFMemo] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fCur, setFCur] = useState<Cur>("PHP");

  useEffect(() => {
    if (!isAdminAuthed()) { router.replace("/login"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthed(true);
    const saved = typeof window !== "undefined" ? sessionStorage.getItem(PASS_KEY) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setPass(saved);
  }, [router]);

  const api = useCallback((method: string, opts: { qs?: string; body?: unknown; pass?: string } = {}) => {
    const p = opts.pass ?? pass;
    return fetch("/api/admin/may-ledger" + (opts.qs || ""), {
      method,
      headers: { "x-ledger-pass": p, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  }, [pass]);

  const load = useCallback(async (p?: string) => {
    const res = await api("GET", { pass: p });
    if (res.status === 401) { setUnlocked(false); setGate("암호가 올바르지 않아요."); return false; }
    if (res.status === 503) { const d = await res.json().catch(() => ({})); setUnlocked(false); setGate(d.message || "서버 암호 미설정"); return false; }
    if (!res.ok) { setGate("불러오기 실패"); return false; }
    const d = await res.json();
    setItems((d.items || []).map((r: Row) => ({ ...r, amount: Number(r.amount) })));
    setKrw(d.config?.krwPerPhp || 23);
    setUnlocked(true); setGate("");
    return true;
  }, [api]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (authed && pass) load(pass);
  }, [authed, pass, load]);

  async function submitPass(e: React.FormEvent) {
    e.preventDefault();
    const ok = await load(passInput);
    if (ok) { setPass(passInput); try { sessionStorage.setItem(PASS_KEY, passInput); } catch {} }
  }

  const phpOf = useCallback((r: Row) => r.currency === "KRW" ? r.amount / (krwPerPhp || 1) : r.amount, [krwPerPhp]);
  const mkey = (d: string) => (d || "").slice(0, 7);
  const scope = useMemo(() => items.filter(r => month === "all" || mkey(r.entry_date) === month), [items, month]);
  const sumBy = useCallback((list: Row[], pred: (r: Row) => boolean) => list.filter(pred).reduce((s, r) => s + phpOf(r), 0), [phpOf]);

  const co = scope.filter(r => r.book === "회사");
  const ho = scope.filter(r => r.book === "집");
  const coRev = sumBy(co, r => r.type === "income");
  const coExp = sumBy(co, r => r.type === "expense");
  const hoRev = sumBy(ho, r => r.type === "income");
  const hoExp = sumBy(ho, r => r.type === "expense");
  const divTotals = CO_EXP.map(dv => ({ dv, v: sumBy(co, r => r.type === "expense" && (r.division === dv || (dv === "기타" && !CO_EXP.includes(r.division)))) }));
  const maxDiv = Math.max(1, ...divTotals.map(d => d.v));

  const months = useMemo(() => {
    const s = new Set<string>(); items.forEach(r => r.entry_date && s.add(mkey(r.entry_date)));
    return Array.from(s).sort().reverse();
  }, [items]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(fAmount); if (!isFinite(amt) || amt <= 0) return;
    const res = await api("POST", { body: { entry_date: fDate, book: fBook, type: fType, division: fDiv, detail: fDetail.trim(), memo: fMemo.trim(), amount: amt, currency: fCur } });
    if (res.ok) { setFAmount(""); setFMemo(""); setFDetail(""); load(); }
  }
  async function changeDiv(id: string, division: string) {
    setItems(p => p.map(r => r.id === id ? { ...r, division } : r));
    await api("PATCH", { body: { id, patch: { division } } });
  }
  async function del(id: string) {
    if (!confirm("이 항목을 삭제할까요?")) return;
    setItems(p => p.filter(r => r.id !== id));
    await api("DELETE", { qs: "?id=" + encodeURIComponent(id) });
  }
  async function saveRate(v: number) { if (!isFinite(v) || v <= 0) return; setKrw(v); await api("POST", { body: { kind: "config", krwPerPhp: v } }); }

  const divOptions = fBook === "집" ? HOME_DIV : (fType === "income" ? CO_INC : CO_EXP);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!divOptions.includes(fDiv)) setFDiv(divOptions[0]);
  }, [fBook, fType]); // eslint-disable-line

  if (!authed) return null;

  if (!unlocked) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.ground, fontFamily: "'Noto Sans KR',sans-serif" }}>
        <form onSubmit={submitPass} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 28, width: 340, boxShadow: "0 8px 30px rgba(0,0,0,.08)" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>🔒 드림 손익장부</div>
          <div style={{ fontSize: 13, color: C.muted, margin: "6px 0 18px" }}>나만 보는 장부입니다. 암호를 입력하세요.</div>
          <input type="password" value={passInput} onChange={e => setPassInput(e.target.value)} autoFocus placeholder="암호"
            style={{ width: "100%", padding: "11px 13px", fontSize: 15, border: `1px solid ${C.lineS}`, borderRadius: 9, boxSizing: "border-box" }} />
          {gate && <div style={{ color: C.expense, fontSize: 12.5, marginTop: 8 }}>{gate}</div>}
          <button type="submit" style={{ width: "100%", marginTop: 14, padding: "11px", background: C.accent, color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>열기</button>
        </form>
      </div>
    );
  }

  const tile = (label: string, big: number, a: number, b: number, aLbl: string, bLbl: string, hero?: boolean, accent?: string) => (
    <div style={{ background: C.surface, border: `1px solid ${hero ? (accent || C.accent) : C.line}`, borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 2px rgba(24,34,32,.05)" }}>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: hero ? 30 : 26, fontWeight: 800, margin: "7px 0 0", color: big < 0 ? C.expense : C.ink, fontVariantNumeric: "tabular-nums" }}>{won(big)}</div>
      <div style={{ marginTop: 9, borderTop: `1px dashed ${C.lineS}`, paddingTop: 8, display: "grid", gap: 4, fontSize: 12.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>{aLbl}</span><span style={{ color: C.income, fontVariantNumeric: "tabular-nums" }}>{won(a)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.muted }}>{bLbl}</span><span style={{ color: C.expense, fontVariantNumeric: "tabular-nums" }}>{won(b)}</span></div>
      </div>
    </div>
  );

  const tableFor = (list: Row[], book: Book) => {
    const rows = list.filter(r => book === "집" ? true : (coFilter === "all" || r.division === coFilter || (coFilter === "기타" && !CO_EXP.includes(r.division))))
      .slice().sort((x, y) => (y.entry_date || "").localeCompare(x.entry_date || ""));
    const opts = book === "집" ? HOME_DIV : CO_EXP;
    return (
      <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: 12, background: C.surface }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead><tr style={{ background: C.surface2 }}>
            {["날짜", "유형", "부문", "세부", "메모", "금액", ""].map((h, i) => (
              <th key={i} style={{ textAlign: i === 5 ? "right" : "left", fontSize: 11.5, color: C.faint, fontWeight: 700, padding: "10px 12px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.muted }}>내역이 없어요.</td></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.line}`, fontSize: 12.5, color: C.faint, fontVariantNumeric: "tabular-nums" }}>{r.entry_date}</td>
                <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.line}`, fontSize: 13, color: r.type === "income" ? C.income : C.expense }}>{r.type === "income" ? "수입" : "지출"}</td>
                <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.line}` }}>
                  <select value={opts.includes(r.division) ? r.division : "기타"} onChange={e => changeDiv(r.id, e.target.value)}
                    style={{ border: `1px solid ${C.lineS}`, borderRadius: 7, padding: "3px 6px", fontSize: 12, fontWeight: 700, color: C.accent, background: C.accentSoft, cursor: "pointer" }}>
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </td>
                <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.line}`, fontSize: 13.5 }}>{r.detail}</td>
                <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.line}`, fontSize: 12, color: C.faint }}>{r.memo}</td>
                <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.line}`, textAlign: "right", fontWeight: 700, fontSize: 13.5, color: r.type === "income" ? C.income : C.expense, fontVariantNumeric: "tabular-nums" }}>{r.type === "income" ? "+" : "−"}{won(phpOf(r))}</td>
                <td style={{ padding: "9px 12px", borderBottom: `1px solid ${C.line}` }}><button onClick={() => del(r.id)} style={{ background: "none", border: "none", color: C.faint, cursor: "pointer", fontSize: 15 }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ background: C.ground, minHeight: "100vh", fontFamily: "'Noto Sans KR','Apple SD Gothic Neo',sans-serif", color: C.ink }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "22px 20px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 21, fontWeight: 800 }}>📒 드림 손익장부 <span style={{ fontSize: 12, color: C.faint, fontWeight: 600 }}>· 나만 보는 비공개</span></div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>회사(드림아카데미)와 집(개인) 손익 · 페소 기준</div>
          </div>
          <select value={month} onChange={e => setMonth(e.target.value)} style={fld}>
            <option value="all">전체 기간</option>
            {months.map(m => <option key={m} value={m}>{m.replace("-", ". ")}</option>)}
          </select>
        </div>

        {/* ENTRY FORM */}
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, marginBottom: 24, display: "grid", gap: 9, gridTemplateColumns: "116px 110px 110px 1fr 1fr 1.1fr auto", alignItems: "end" }}>
          <L t="날짜"><input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={fld} /></L>
          <L t="장부"><select value={fBook} onChange={e => setFBook(e.target.value as Book)} style={fld}><option>회사</option><option>집</option></select></L>
          <L t="유형">
            <div style={{ display: "inline-flex", border: `1px solid ${C.lineS}`, borderRadius: 9, overflow: "hidden" }}>
              <button type="button" onClick={() => setFType("expense")} style={{ border: "none", padding: "8px 10px", cursor: "pointer", fontWeight: 600, flex: 1, background: fType === "expense" ? C.expenseSoft : C.surface, color: fType === "expense" ? C.expense : C.muted }}>지출</button>
              <button type="button" onClick={() => setFType("income")} style={{ border: "none", padding: "8px 10px", cursor: "pointer", fontWeight: 600, flex: 1, background: fType === "income" ? C.incomeSoft : C.surface, color: fType === "income" ? C.income : C.muted }}>수입</button>
            </div>
          </L>
          <L t="부문"><select value={fDiv} onChange={e => setFDiv(e.target.value)} style={fld}>{divOptions.map(o => <option key={o}>{o}</option>)}</select></L>
          <L t="세부"><input value={fDetail} onChange={e => setFDetail(e.target.value)} placeholder="예: 식대, 렌트" style={fld} /></L>
          <L t="메모"><input value={fMemo} onChange={e => setFMemo(e.target.value)} placeholder="사유/방식" style={fld} /></L>
          <L t="금액">
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" step="0.01" min="0" value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0" style={{ ...fld, width: 92 }} />
              <select value={fCur} onChange={e => setFCur(e.target.value as Cur)} style={{ ...fld, width: 62 }}><option value="PHP">₱</option><option value="KRW">₩</option></select>
              <button onClick={addEntry} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 9, padding: "9px 14px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>추가</button>
            </div>
          </L>
        </div>

        {/* COMPANY */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 0 12px 2px" }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: C.accent }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>회사 손익계산서</h2><span style={{ fontSize: 12, color: C.faint }}>드림아카데미</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
          {tile("영업이익 (매출 − 지출)", coRev - coExp, coRev, coExp, "매출", "지출", true)}
          {tile("매출", coRev, coRev, 0, "합계", " ", false)}
          {tile("지출", coExp, 0, coExp, " ", "합계", false)}
        </div>
        <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px", marginBottom: 8, boxShadow: "0 1px 2px rgba(24,34,32,.05)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, margin: "0 0 12px" }}>지출 구성</h3>
          <div style={{ display: "grid", gap: 9 }}>
            {divTotals.map(({ dv, v }) => (
              <div key={dv} style={{ display: "grid", gridTemplateColumns: "88px 1fr auto", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{dv}</span>
                <span style={{ background: C.surface2, borderRadius: 6, height: 9, overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: Math.round(v / maxDiv * 100) + "%", background: dv === "드림하우스" ? C.income : C.accent }} /></span>
                <span style={{ fontSize: 13, fontWeight: 700, color: v > 0 ? C.expense : C.faint, fontVariantNumeric: "tabular-nums" }}>{won(v)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "14px 0 10px 2px" }}>
          {["all", ...CO_EXP].map(x => (
            <button key={x} onClick={() => setCoFilter(x)} style={{ border: `1px solid ${coFilter === x ? C.accent : C.lineS}`, background: coFilter === x ? C.accent : C.surface, color: coFilter === x ? "#fff" : C.muted, borderRadius: 20, padding: "5px 12px", fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>{x === "all" ? "전체" : x}</button>
          ))}
        </div>
        {tableFor(co, "회사")}

        {/* HOME */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "28px 0 12px 2px" }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: C.home }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>집 손익계산서</h2><span style={{ fontSize: 12, color: C.faint }}>개인 · 회사와 별개</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
          {tile("순액 (수입 − 지출)", hoRev - hoExp, hoRev, hoExp, "수입", "지출", true, C.home)}
          {tile("수입", hoRev, hoRev, 0, "합계", " ", false)}
          {tile("지출", hoExp, 0, hoExp, " ", "합계", false)}
        </div>
        {tableFor(ho, "집")}

        <div style={{ color: C.faint, fontSize: 12, marginTop: 18, lineHeight: 1.7 }}>
          기준통화 <b>페소(₱)</b>. 원(₩)은 환율로 환산 — 1 페소 = <input type="number" step="0.1" defaultValue={krwPerPhp} onBlur={e => saveRate(parseFloat(e.target.value))} style={{ width: 66, textAlign: "right", padding: "3px 6px", border: `1px solid ${C.lineS}`, borderRadius: 7 }} /> 원.
          &nbsp;드림하우스 지출은 회사 '드림하우스' 항목으로 합산됩니다.
        </div>
      </div>
    </div>
  );
}

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: "#8a968f", fontWeight: 600 }}>{t}</span>
      {children}
    </label>
  );
}
