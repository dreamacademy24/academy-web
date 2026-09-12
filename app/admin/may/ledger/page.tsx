"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

type Cur = "PHP" | "KRW";
type Book = "회사" | "집";
type MoriKind = "accrue" | "settle" | null;
interface Row {
  id: string; entry_date: string; book: Book; type: "income" | "expense";
  division: string; detail: string; memo: string; amount: number; currency: Cur; source?: string;
}
const CO_EXP = ["모리", "드림하우스", "재료비", "인건비", "비품", "기타"];
const CO_INC = ["수강료", "숙박", "기타"];
const HOME_DIV = ["주거", "생활", "건강", "교통", "기타"];
// [division, 표시라벨, 발생주의(식대만 비용)]
const CO_ACCT: [string, string, boolean][] = [
  ["모리", "모리 식대", true], ["드림하우스", "드림하우스", false], ["재료비", "재료비", false],
  ["인건비", "인건비", false], ["비품", "비품", false], ["기타", "기타", false],
];
const PASS_KEY = "mayLedgerPass";

const moriKindOf = (r: Row): MoriKind => {
  if (r.division !== "모리") return null;
  if (r.source === "mori_accrue" || r.source === "auto_meal" || /^mori_lunch/.test(r.id)) return "accrue";
  return "settle";
};

const CSS = `
#mayledger{--gr:#eef1f4;--su:#fff;--su2:#f4f7f9;--ink:#1b2831;--mu:#5d6e79;--fa:#8b98a1;--ln:#e3e9ee;--lns:#cfd8de;--ac:#0c6e5c;--acs:#e0f0eb;--pos:#157a4a;--neg:#b23c28;--ws:#fbeee6;--wa:#a9631a;--sh:0 1px 2px rgba(20,30,36,.06),0 4px 16px rgba(20,30,36,.04);
  font-family:"IBM Plex Sans KR","Apple SD Gothic Neo",system-ui,sans-serif;color:var(--ink);background:var(--gr);min-height:100vh;padding-bottom:60px}
@media (prefers-color-scheme:dark){#mayledger:not([data-ml="light"]){--gr:#0c1216;--su:#141d23;--su2:#1a242b;--ink:#e6edf1;--mu:#9aa8b1;--fa:#6c7a83;--ln:#25313a;--lns:#33424c;--ac:#2fb39a;--acs:#123029;--pos:#40b378;--neg:#e07056;--ws:#2a2013;--wa:#d69445;--sh:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.25)}}
#mayledger[data-ml="dark"]{--gr:#0c1216;--su:#141d23;--su2:#1a242b;--ink:#e6edf1;--mu:#9aa8b1;--fa:#6c7a83;--ln:#25313a;--lns:#33424c;--ac:#2fb39a;--acs:#123029;--pos:#40b378;--neg:#e07056;--ws:#2a2013;--wa:#d69445;--sh:0 1px 2px rgba(0,0,0,.3),0 6px 20px rgba(0,0,0,.25)}
#mayledger *{box-sizing:border-box}
#mayledger .num{font-family:"IBM Plex Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums}
#mayledger .neg{color:var(--neg)} #mayledger .pos{color:var(--pos)}
#mayledger .wrap{max-width:1060px;margin:0 auto;padding:20px 22px}
#mayledger .hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px}
#mayledger h1.t{font-size:19px;font-weight:700;margin:0;letter-spacing:-.01em}
#mayledger .sub{font-size:12px;color:var(--mu);margin-top:3px}
#mayledger .ctrl{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#mayledger select,#mayledger input{font-family:inherit}
#mayledger .fld{padding:8px 10px;font-size:13px;border:1px solid var(--lns);border-radius:9px;background:var(--su);color:var(--ink)}
#mayledger .iconbtn{width:34px;height:34px;border:1px solid var(--ln);background:var(--su);border-radius:9px;cursor:pointer;color:var(--mu)}
#mayledger .wsseg{display:inline-flex;background:var(--su);border:1px solid var(--lns);border-radius:11px;overflow:hidden}
#mayledger .wsseg button{border:none;background:transparent;color:var(--mu);padding:9px 16px;font-size:13.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px}
#mayledger .wsseg button .dot{width:9px;height:9px;border-radius:3px;background:var(--fa)}
#mayledger .wsseg button.on{background:var(--ac);color:#fff}
#mayledger .wsseg button.on .dot{background:#fff}
#mayledger .tabs{display:flex;gap:4px;border-bottom:1px solid var(--ln);margin-bottom:22px}
#mayledger .tabs button{border:none;background:transparent;color:var(--mu);padding:11px 15px;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2.5px solid transparent;margin-bottom:-1px}
#mayledger .tabs button.on{color:var(--ac);border-bottom-color:var(--ac)}
#mayledger .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-bottom:24px}
#mayledger .kpis.k3{grid-template-columns:repeat(3,1fr)}
@media(max-width:720px){#mayledger .kpis,#mayledger .kpis.k3{grid-template-columns:repeat(2,1fr)}}
#mayledger .kpi{background:var(--su);border:1px solid var(--ln);border-radius:13px;padding:15px 16px;box-shadow:var(--sh)}
#mayledger .kpi .k{font-size:11.5px;color:var(--mu);font-weight:600;display:flex;align-items:center;gap:6px}
#mayledger .kpi .v{font-size:23px;font-weight:600;margin-top:8px;letter-spacing:-.02em}
#mayledger .kpi .d{font-size:11.5px;color:var(--fa);margin-top:5px}
#mayledger .kpi.hero{border-color:color-mix(in srgb,var(--ac) 40%,var(--ln))}
#mayledger .kpi.hero .bar{height:3px;border-radius:2px;background:var(--ac);width:34px;margin-bottom:10px}
#mayledger .card{background:var(--su);border:1px solid var(--ln);border-radius:14px;box-shadow:var(--sh);overflow:hidden;margin-bottom:20px}
#mayledger .card>.hd{padding:15px 20px;border-bottom:1px solid var(--ln);display:flex;align-items:baseline;justify-content:space-between;gap:10px}
#mayledger .card>.hd .ct{font-size:14px;font-weight:700} #mayledger .card>.hd .cm{font-size:11.5px;color:var(--fa)}
#mayledger table.stmt{width:100%;border-collapse:collapse}
#mayledger .stmt td{padding:10px 20px}
#mayledger .stmt tr+tr td{border-top:1px solid var(--ln)}
#mayledger .stmt .amt{text-align:right;white-space:nowrap}
#mayledger .stmt .grp td{background:var(--su2);font-weight:700;font-size:11.5px;letter-spacing:.05em;color:var(--mu);padding-top:9px;padding-bottom:9px}
#mayledger .stmt .sub td{padding-left:36px;color:var(--mu)}
#mayledger .stmt .sub .amt{color:var(--ink);font-weight:500}
#mayledger .stmt .note{font-size:11px;color:var(--fa);margin-left:7px;font-weight:400;letter-spacing:0}
#mayledger .stmt .total td{font-weight:700;border-top:1.5px solid var(--lns)}
#mayledger .stmt .result td{font-weight:700;font-size:15px;background:var(--su2);border-top:2.5px double var(--lns)}
#mayledger tr.drill{cursor:pointer} #mayledger tr.drill:hover td{background:var(--acs)}
#mayledger tr.drill .lbl::after{content:" ⤢";font-size:10px;color:var(--fa)}
#mayledger .chip{display:inline-block;font-size:10.5px;padding:1px 7px;border-radius:20px;font-weight:600}
#mayledger .chip.ap{background:var(--ws);color:var(--wa)}
#mayledger .two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:720px){#mayledger .two{grid-template-columns:1fr}}
#mayledger .mrow{display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--ln);font-size:13.5px}
#mayledger .mrow:last-child{border-bottom:none} #mayledger .mrow .l{color:var(--mu)}
#mayledger .bal{background:var(--su2);border-radius:11px;padding:14px 16px;margin-top:6px}
#mayledger .bal .bl{font-size:12px;color:var(--mu)} #mayledger .bal .bv{font-size:22px;font-weight:600;margin-top:4px}
#mayledger table.mtbl{width:100%;border-collapse:collapse;font-size:13.5px}
#mayledger .mtbl th,#mayledger .mtbl td{padding:11px 14px;text-align:right}
#mayledger .mtbl th:first-child,#mayledger .mtbl td:first-child{text-align:left}
#mayledger .mtbl thead th{font-size:11px;color:var(--fa);font-weight:700;border-bottom:1px solid var(--ln);background:var(--su2)}
#mayledger .mtbl tbody td{border-bottom:1px solid var(--ln)}
#mayledger .mtbl tr.r td{font-weight:700;background:var(--su2)}
#mayledger table.txn{width:100%;border-collapse:collapse}
#mayledger .txn thead th{font-size:11px;color:var(--fa);font-weight:700;text-align:left;padding:10px 14px;border-bottom:1px solid var(--ln);background:var(--su2)}
#mayledger .txn thead th.r{text-align:right}
#mayledger .txn td{padding:9px 14px;border-bottom:1px solid var(--ln);font-size:13px}
#mayledger .txn td.r{text-align:right;white-space:nowrap}
#mayledger .tag{font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;white-space:nowrap}
#mayledger .tag.inc{background:var(--acs);color:var(--pos)} #mayledger .tag.exp{background:var(--ws);color:var(--neg)}
#mayledger .tag.acc{background:#e7eef6;color:#3a6ea5} #mayledger .tag.set{background:var(--su2);color:var(--mu);border:1px solid var(--ln)}
#mayledger[data-ml="dark"] .tag.acc{background:#1a2a3b;color:#7fb0e0}
#mayledger .filters{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px}
#mayledger .filters button{border:1px solid var(--ln);background:var(--su);color:var(--mu);border-radius:20px;padding:6px 12px;font-size:12.5px;font-weight:600;cursor:pointer}
#mayledger .filters button.on{background:var(--ac);border-color:var(--ac);color:#fff}
#mayledger .selmini{border:1px solid var(--lns);border-radius:7px;padding:3px 6px;font-size:12px;font-weight:600;color:var(--ac);background:var(--acs);cursor:pointer}
#mayledger .form{background:var(--su);border:1px solid var(--ln);border-radius:13px;padding:14px;margin-bottom:18px;display:grid;gap:9px;grid-template-columns:118px 96px 100px 108px 1fr 1fr 130px auto;align-items:end}
@media(max-width:900px){#mayledger .form{grid-template-columns:1fr 1fr}}
#mayledger .form label{display:flex;flex-direction:column;gap:4px}
#mayledger .form label span{font-size:10.5px;color:var(--fa);font-weight:600}
#mayledger .form .fld{width:100%}
#mayledger .seg2{display:inline-flex;border:1px solid var(--lns);border-radius:9px;overflow:hidden}
#mayledger .seg2 button{border:none;padding:8px 9px;cursor:pointer;font-weight:600;font-size:12.5px;background:var(--su);color:var(--mu);flex:1}
#mayledger .seg2 button.on.exp{background:var(--ws);color:var(--neg)} #mayledger .seg2 button.on.inc{background:var(--acs);color:var(--pos)}
#mayledger .seg2 button.on.a{background:#e7eef6;color:#3a6ea5} #mayledger .seg2 button.on.s{background:var(--su2);color:var(--ink)}
#mayledger .addbtn{background:var(--ac);color:#fff;border:none;border-radius:9px;padding:9px 16px;font-weight:700;cursor:pointer}
#mayledger .back{background:var(--su);border:1px solid var(--ln);border-radius:9px;padding:7px 13px;font-size:12.5px;font-weight:600;color:var(--mu);cursor:pointer;margin-bottom:14px}
#mayledger .hint{font-size:11.5px;color:var(--fa);margin:6px 2px 0;line-height:1.7}
#mayledger .xbtn{background:none;border:none;color:var(--fa);cursor:pointer;font-size:14px}
#mayledger .gate{min-height:70vh;display:flex;align-items:center;justify-content:center}
#mayledger .gatebox{background:var(--su);border:1px solid var(--ln);border-radius:14px;padding:26px;width:330px;box-shadow:var(--sh)}
`;

const won = (n: number) => { const r = Math.round(n); return (r < 0 ? "(₱" : "₱") + Math.abs(r).toLocaleString("en-US") + (r < 0 ? ")" : ""); };
const wonP = (n: number) => "₱" + Math.round(n).toLocaleString("en-US");

export default function MayLedgerPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pass, setPass] = useState("");
  const [passInput, setPassInput] = useState("");
  const [gate, setGate] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  const [items, setItems] = useState<Row[]>([]);
  const [krwPerPhp, setKrw] = useState(23);
  const [theme, setTheme] = useState<"" | "light" | "dark">("");

  const [ws, setWs] = useState<Book>("회사");
  const [view, setView] = useState<"pl" | "fs" | "tx" | "apLedger" | "acct">("pl");
  const [period, setPeriod] = useState("all");
  const [txnFilter, setTxnFilter] = useState("all");
  const [backTo, setBackTo] = useState<"fs" | "pl">("fs");
  const [acct, setAcct] = useState<{ book: Book; div: string; type: "income" | "expense" }>({ book: "회사", div: "재료비", type: "expense" });

  const today = new Date().toISOString().slice(0, 10);
  const [fDate, setFDate] = useState(today);
  const [fType, setFType] = useState<"income" | "expense">("expense");
  const [fDiv, setFDiv] = useState("모리");
  const [fMori, setFMori] = useState<"accrue" | "settle">("settle");
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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (authed && pass) load(pass); }, [authed, pass, load]);

  async function submitPass(e: React.FormEvent) {
    e.preventDefault();
    const ok = await load(passInput);
    if (ok) { setPass(passInput); try { sessionStorage.setItem(PASS_KEY, passInput); } catch {} }
  }

  const phpOf = useCallback((r: Row) => r.currency === "KRW" ? r.amount / (krwPerPhp || 1) : r.amount, [krwPerPhp]);
  const mkey = (d: string) => (d || "").slice(0, 7);
  const inP = useCallback((r: Row) => period === "all" || mkey(r.entry_date) === period, [period]);
  const months = useMemo(() => { const s = new Set<string>(); items.forEach(r => r.entry_date && s.add(mkey(r.entry_date))); return Array.from(s).sort().reverse(); }, [items]);
  const sum = useCallback((pred: (r: Row) => boolean) => items.filter(pred).reduce((s, r) => s + phpOf(r), 0), [items, phpOf]);

  async function addEntry() {
    const amt = parseFloat(fAmount); if (!isFinite(amt) || amt <= 0) return;
    const isMori = ws === "회사" && fDiv === "모리" && fType === "expense";
    const source = isMori ? (fMori === "accrue" ? "mori_accrue" : "mori_settle") : "manual";
    const res = await api("POST", { body: { entry_date: fDate, book: ws, type: fType, division: fDiv, detail: fDetail.trim(), memo: fMemo.trim(), amount: amt, currency: fCur, source } });
    if (res.ok) { setFAmount(""); setFMemo(""); setFDetail(""); load(); }
  }
  async function changeDiv(id: string, division: string) {
    setItems(p => p.map(r => r.id === id ? { ...r, division } : r));
    await api("PATCH", { body: { id, patch: { division } } });
  }
  async function changeMori(id: string, kind: "accrue" | "settle") {
    const source = kind === "accrue" ? "mori_accrue" : "mori_settle";
    setItems(p => p.map(r => r.id === id ? { ...r, source } : r));
    await api("PATCH", { body: { id, patch: { source } } });
  }
  async function del(id: string) {
    if (!confirm("이 항목을 삭제할까요?")) return;
    setItems(p => p.filter(r => r.id !== id));
    await api("DELETE", { qs: "?id=" + encodeURIComponent(id) });
  }
  async function saveRate(v: number) { if (!isFinite(v) || v <= 0) return; setKrw(v); await api("POST", { body: { kind: "config", krwPerPhp: v } }); }

  const divOptions = ws === "집" ? HOME_DIV : (fType === "income" ? CO_INC : CO_EXP);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!divOptions.includes(fDiv)) setFDiv(divOptions[0]);
  }, [ws, fType]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!authed) return null;
  const setThemeAttr = theme;

  if (!unlocked) {
    return (
      <div id="mayledger" data-ml={setThemeAttr || undefined}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="gate">
          <form onSubmit={submitPass} className="gatebox">
            <div style={{ fontSize: 19, fontWeight: 800 }}>🔒 드림 재무</div>
            <div style={{ fontSize: 13, color: "var(--mu)", margin: "6px 0 16px" }}>나만 보는 장부입니다. 암호를 입력하세요.</div>
            <input type="password" value={passInput} onChange={e => setPassInput(e.target.value)} autoFocus placeholder="암호"
              style={{ width: "100%", padding: "11px 13px", fontSize: 15, border: "1px solid var(--lns)", borderRadius: 9 }} />
            {gate && <div style={{ color: "var(--neg)", fontSize: 12.5, marginTop: 8 }}>{gate}</div>}
            <button type="submit" style={{ width: "100%", marginTop: 14, padding: 11, background: "var(--ac)", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>열기</button>
          </form>
        </div>
      </div>
    );
  }

  // ---- computations ----
  const coRev = sum(r => r.book === "회사" && r.type === "income" && inP(r));
  const coAcct = CO_ACCT.map(([dv, label, ac]) => ({
    dv, label, ac,
    v: sum(r => r.book === "회사" && r.type === "expense" && r.division === dv && inP(r) && (dv !== "모리" || moriKindOf(r) === "accrue")),
  }));
  const coExp = coAcct.reduce((s, a) => s + a.v, 0);
  const hoInc = sum(r => r.book === "집" && r.type === "income" && inP(r));
  const hoExp = sum(r => r.book === "집" && r.type === "expense" && inP(r));
  const accAll = sum(r => r.division === "모리" && moriKindOf(r) === "accrue");
  const setAll = sum(r => r.division === "모리" && moriKindOf(r) === "settle");
  const apBal = accAll - setAll;

  const openApLedger = (from: "fs" | "pl") => { setBackTo(from); setView("apLedger"); };
  const openAcct = (book: Book, div: string, type: "income" | "expense") => { if (book === "회사" && div === "모리") { openApLedger("pl"); return; } setAcct({ book, div, type }); setView("acct"); };

  const title = view === "pl" ? "손익계산서" : view === "fs" ? "재무제표" : view === "tx" ? "거래내역" : view === "apLedger" ? "모리 미지급금 원장" : "계정 상세";
  const periodLbl = period === "all" ? "전체 기간" : period.replace("-", ". ");

  // ---- KPI ----
  const kpis = view === "apLedger" || view === "acct" ? null : ws === "회사" ? (
    <div className="kpis">
      <div className="kpi hero"><div className="bar" /><div className="k">영업이익</div><div className={"v " + (coRev - coExp < 0 ? "neg" : "")}>{won(coRev - coExp)}</div><div className="d">매출 {wonP(coRev)} − 비용 {wonP(coExp)}</div></div>
      <div className="kpi"><div className="k">매출액</div><div className="v">{wonP(coRev)}</div><div className="d">{periodLbl}</div></div>
      <div className="kpi"><div className="k">영업비용</div><div className="v">{wonP(coExp)}</div><div className="d">모리는 식대(발생)만</div></div>
      <div className="kpi"><div className="k">모리 미지급금 <span className="chip ap">부채</span></div><div className={"v " + (apBal < 0 ? "neg" : "")}>{won(apBal)}</div><div className="d">{apBal < 0 ? "선지급 상태" : "미지급 잔액"}</div></div>
    </div>
  ) : (
    <div className="kpis">
      <div className="kpi hero"><div className="bar" style={{ background: "#c98a2a" }} /><div className="k">순손익</div><div className={"v " + (hoInc - hoExp < 0 ? "neg" : "")}>{won(hoInc - hoExp)}</div><div className="d">수입 {wonP(hoInc)} − 지출 {wonP(hoExp)}</div></div>
      <div className="kpi"><div className="k">수입</div><div className="v pos">{wonP(hoInc)}</div><div className="d">{periodLbl}</div></div>
      <div className="kpi"><div className="k">지출</div><div className="v">{wonP(hoExp)}</div><div className="d">개인 지출</div></div>
      <div className="kpi"><div className="k">거래 건수</div><div className="v">{items.filter(r => r.book === "집" && inP(r)).length}건</div><div className="d">이번 기간</div></div>
    </div>
  );

  // ---- P&L (company) ----
  const plCo = (
    <>
      <div className="card">
        <div className="hd"><div className="ct">손익계산서 · 드림아카데미</div><div className="cm">{periodLbl} · 단위 ₱</div></div>
        <table className="stmt"><tbody>
          <tr className="grp"><td>Ⅰ. 매출액</td><td className="amt">{wonP(coRev)}</td></tr>
          <tr className="sub drill" onDoubleClick={() => openAcct("회사", "*", "income")}><td><span className="lbl">차량렌트 · 기타수입</span></td><td className="amt num">{wonP(coRev)}</td></tr>
          <tr className="grp"><td>Ⅱ. 영업비용</td><td className="amt">{wonP(coExp)}</td></tr>
          {coAcct.map(a => (
            <tr key={a.dv} className="sub drill" onDoubleClick={() => openAcct("회사", a.dv, "expense")}>
              <td><span className="lbl">{a.label}</span>{a.ac && <span className="note">발생분(미지급금 계상)</span>}</td>
              <td className="amt num">{wonP(a.v)}</td>
            </tr>
          ))}
          <tr className="total"><td>영업비용 계</td><td className="amt num">{wonP(coExp)}</td></tr>
          <tr className="result"><td>영업이익 (Ⅰ − Ⅱ)</td><td className={"amt num " + (coRev - coExp < 0 ? "neg" : "")}>{won(coRev - coExp)}</td></tr>
        </tbody></table>
      </div>
      <div className="hint">※ 모리에게 준 고깃값·야채·도시락통·현금 등은 <b>비용이 아니라 미지급금 지급</b>입니다. 비용엔 <b>계산된 식대(발생분)</b>만 반영돼요. 계정을 <b>더블클릭</b>하면 상세원장이 열립니다.</div>
    </>
  );

  // ---- P&L (home) ----
  const homeAcct = HOME_DIV.map(dv => ({ dv, v: sum(r => r.book === "집" && r.type === "expense" && r.division === dv && inP(r)) })).filter(a => a.v > 0);
  const plHome = (
    <>
      <div className="card">
        <div className="hd"><div className="ct">손익계산서 · 메이집</div><div className="cm">{periodLbl} · 단위 ₱</div></div>
        <table className="stmt"><tbody>
          <tr className="grp"><td>Ⅰ. 수입</td><td className="amt">{wonP(hoInc)}</td></tr>
          <tr className="sub drill" onDoubleClick={() => openAcct("집", "*", "income")}><td><span className="lbl">용돈 · 렌트 · 기타수익</span></td><td className="amt num">{wonP(hoInc)}</td></tr>
          <tr className="grp"><td>Ⅱ. 지출</td><td className="amt">{wonP(hoExp)}</td></tr>
          {homeAcct.map(a => (
            <tr key={a.dv} className="sub drill" onDoubleClick={() => openAcct("집", a.dv, "expense")}><td><span className="lbl">{a.dv}</span></td><td className="amt num">{wonP(a.v)}</td></tr>
          ))}
          <tr className="total"><td>지출 계</td><td className="amt num">{wonP(hoExp)}</td></tr>
          <tr className="result"><td>순손익 (Ⅰ − Ⅱ)</td><td className={"amt num " + (hoInc - hoExp < 0 ? "neg" : "")}>{won(hoInc - hoExp)}</td></tr>
        </tbody></table>
      </div>
      <div className="hint">※ 메이집은 드림아카데미와 완전히 분리된 개인 장부입니다. 계정을 <b>더블클릭</b>하면 상세원장이 열립니다.</div>
    </>
  );

  // ---- 재무제표 (company) ----
  const mrows = months.slice().reverse().map(m => {
    const rev = sum(r => r.book === "회사" && r.type === "income" && mkey(r.entry_date) === m);
    const exp = CO_ACCT.reduce((s, [dv]) => s + sum(r => r.book === "회사" && r.type === "expense" && r.division === dv && mkey(r.entry_date) === m && (dv !== "모리" || moriKindOf(r) === "accrue")), 0);
    return { m, rev, exp, op: rev - exp };
  });
  const tRev = mrows.reduce((s, x) => s + x.rev, 0), tExp = mrows.reduce((s, x) => s + x.exp, 0);
  const dhTotal = sum(r => r.division === "드림하우스");
  const fs = (
    <>
      <div className="card">
        <div className="hd"><div className="ct">월별 손익 요약</div><div className="cm">단위 ₱</div></div>
        <div style={{ overflowX: "auto" }}><table className="mtbl">
          <thead><tr><th>계정</th>{mrows.map(x => <th key={x.m}>{x.m.replace("-", ". ")}</th>)}<th>누계</th></tr></thead>
          <tbody>
            <tr><td>매출액</td>{mrows.map(x => <td key={x.m} className="num">{wonP(x.rev)}</td>)}<td className="num">{wonP(tRev)}</td></tr>
            <tr><td>영업비용</td>{mrows.map(x => <td key={x.m} className="num">{wonP(x.exp)}</td>)}<td className="num">{wonP(tExp)}</td></tr>
            <tr className="r"><td>영업이익</td>{mrows.map(x => <td key={x.m} className={"num " + (x.op < 0 ? "neg" : "")}>{won(x.op)}</td>)}<td className={"num " + (tRev - tExp < 0 ? "neg" : "")}>{won(tRev - tExp)}</td></tr>
          </tbody>
        </table></div>
      </div>
      <div className="two">
        <div className="card" style={{ cursor: "pointer" }} onClick={() => openApLedger("fs")}>
          <div className="hd"><div className="ct">모리 미지급금 <span className="chip ap">부채</span></div><div className="cm" style={{ color: "var(--ac)", fontWeight: 600 }}>상세원장 ›</div></div>
          <div style={{ padding: "8px 20px 16px" }}>
            <div className="mrow"><span className="l">식대 발생 누계 <span className="note">(비용)</span></span><span className="num">{wonP(accAll)}</span></div>
            <div className="mrow"><span className="l">지급 누계 <span className="note">(현금·대납)</span></span><span className="num">{wonP(setAll)}</span></div>
            <div className="bal"><div className="bl">{apBal < 0 ? "선지급 잔액 (모리에게 더 지급)" : "미지급 잔액 (모리에게 줄 돈)"}</div><div className={"bv " + (apBal < 0 ? "neg" : "")}>{won(apBal)}</div></div>
          </div>
        </div>
        <div className="card">
          <div className="hd"><div className="ct">드림하우스 <span className="chip ap" style={{ background: "var(--acs)", color: "var(--ac)" }}>아카데미 합산</span></div></div>
          <div style={{ padding: "8px 20px 16px" }}>
            <div className="mrow"><span className="l">급여</span><span className="num">{wonP(sum(r => r.division === "드림하우스" && /급여/.test(r.detail)))}</span></div>
            <div className="mrow"><span className="l">수리비</span><span className="num">{wonP(sum(r => r.division === "드림하우스" && /수리/.test(r.detail)))}</span></div>
            <div className="mrow"><span className="l">기타(렌트·비품·물류)</span><span className="num">{wonP(sum(r => r.division === "드림하우스" && !/급여|수리/.test(r.detail)))}</span></div>
            <div className="bal"><div className="bl">드림하우스 소계 → 아카데미 영업비용</div><div className="bv">{wonP(dhTotal)}</div></div>
          </div>
        </div>
      </div>
    </>
  );

  // ---- 모리 미지급금 원장 ----
  const moriRows = items.filter(r => r.division === "모리" && moriKindOf(r) != null).slice()
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || ((moriKindOf(a) === "accrue" ? 0 : 1) - (moriKindOf(b) === "accrue" ? 0 : 1)));
  let run = 0;
  const apLedgerView = (
    <>
      <button className="back" onClick={() => setView(backTo)}>‹ {backTo === "fs" ? "재무제표" : "손익계산서"}로</button>
      <div className="kpis k3">
        <div className="kpi"><div className="k">발생 누계 <span className="note">식대</span></div><div className="v pos">{wonP(accAll)}</div><div className="d">모리에게 지는 빚</div></div>
        <div className="kpi"><div className="k">지급 누계 <span className="note">현금·대납</span></div><div className="v">{wonP(setAll)}</div><div className="d">갚은 금액</div></div>
        <div className="kpi hero"><div className="bar" style={{ background: "var(--wa)" }} /><div className="k">현재 잔액</div><div className={"v " + (apBal < 0 ? "neg" : "")}>{won(apBal)}</div><div className="d">{apBal < 0 ? "선지급" : "미지급"}</div></div>
      </div>
      <div className="card">
        <div className="hd"><div className="ct">모리 미지급금 상세원장</div><div className="cm">발생(+) · 지급(−) · 잔액 · 단위 ₱</div></div>
        <div style={{ overflowX: "auto" }}><table className="txn">
          <thead><tr><th>날짜</th><th>구분</th><th>적요</th><th className="r">발생(+)</th><th className="r">지급(−)</th><th className="r">잔액</th></tr></thead>
          <tbody>
            {moriRows.map(r => { const acc = moriKindOf(r) === "accrue"; run += acc ? phpOf(r) : -phpOf(r); return (
              <tr key={r.id}>
                <td className="num" style={{ color: "var(--fa)", whiteSpace: "nowrap" }}>{r.entry_date}</td>
                <td>{acc ? <span className="tag acc">발생</span> : <span className="tag set">지급</span>}</td>
                <td>{r.detail}<div style={{ color: "var(--fa)", fontSize: 11.5 }}>{r.memo}</div></td>
                <td className="r num pos">{acc ? wonP(phpOf(r)) : "·"}</td>
                <td className="r num neg">{acc ? "·" : wonP(phpOf(r))}</td>
                <td className={"r num " + (run < 0 ? "neg" : "")} style={{ fontWeight: 600 }}>{won(run)}</td>
              </tr>
            ); })}
          </tbody>
          <tfoot><tr style={{ background: "var(--su2)" }}>
            <td colSpan={3} style={{ padding: "12px 14px", fontWeight: 700, borderTop: "1.5px solid var(--lns)" }}>합계</td>
            <td className="r num pos" style={{ padding: "12px 14px", fontWeight: 700, borderTop: "1.5px solid var(--lns)" }}>{wonP(accAll)}</td>
            <td className="r num neg" style={{ padding: "12px 14px", fontWeight: 700, borderTop: "1.5px solid var(--lns)" }}>{wonP(setAll)}</td>
            <td className={"r num " + (apBal < 0 ? "neg" : "")} style={{ padding: "12px 14px", fontWeight: 700, borderTop: "1.5px solid var(--lns)" }}>{won(apBal)}</td>
          </tr></tfoot>
        </table></div>
      </div>
      <div className="hint">발생 = 계산된 식대(비용 계상). 지급 = 고깃값·야채·도시락통·현금 등 대신 지불. 잔액 = 발생누계 − 지급누계.</div>
    </>
  );

  // ---- 계정 상세 ----
  const aList = items.filter(r => r.book === acct.book && r.type === acct.type && (acct.div === "*" || r.division === acct.div) && inP(r) && !(acct.book === "회사" && acct.div === "모리" && moriKindOf(r) === "settle")).slice()
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const aTot = aList.reduce((s, r) => s + phpOf(r), 0);
  let arun = 0;
  const aLabel = acct.div === "*" ? (acct.type === "income" ? "수입" : "지출") : acct.div;
  const acctView = (
    <>
      <button className="back" onClick={() => setView("pl")}>‹ 손익계산서로</button>
      <div className="kpis k3">
        <div className="kpi hero"><div className="bar" /><div className="k">{aLabel} 합계</div><div className={"v " + (acct.type === "income" ? "pos" : "")}>{wonP(aTot)}</div><div className="d">{periodLbl}</div></div>
        <div className="kpi"><div className="k">건수</div><div className="v">{aList.length}건</div><div className="d">{acct.book === "회사" ? "드림아카데미" : "메이집"}</div></div>
        <div className="kpi"><div className="k">건당 평균</div><div className="v">{aList.length ? wonP(aTot / aList.length) : "₱0"}</div><div className="d">평균 단가</div></div>
      </div>
      <div className="card">
        <div className="hd"><div className="ct">계정별 원장 · {aLabel}</div><div className="cm">발생 순 · 단위 ₱</div></div>
        <div style={{ overflowX: "auto" }}><table className="txn">
          <thead><tr><th>날짜</th><th>세부</th><th>메모</th><th className="r">금액</th><th className="r">누계</th></tr></thead>
          <tbody>
            {aList.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--mu)" }}>내역이 없어요.</td></tr>}
            {aList.map(r => { arun += phpOf(r); return (
              <tr key={r.id}>
                <td className="num" style={{ color: "var(--fa)", whiteSpace: "nowrap" }}>{r.entry_date}</td>
                <td>{r.detail}</td><td style={{ color: "var(--fa)", fontSize: 12 }}>{r.memo}</td>
                <td className="r num">{wonP(phpOf(r))}</td><td className="r num" style={{ fontWeight: 600 }}>{wonP(arun)}</td>
              </tr>
            ); })}
          </tbody>
        </table></div>
      </div>
    </>
  );

  // ---- 거래내역 ----
  const isCo = ws === "회사";
  const txList = items.filter(r => r.book === ws && inP(r)).filter(r => {
    if (txnFilter === "all") return true;
    if (txnFilter === "income") return r.type === "income";
    if (txnFilter === "accrue") return moriKindOf(r) === "accrue";
    if (txnFilter === "settle") return moriKindOf(r) === "settle";
    return r.division === txnFilter;
  }).slice().sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  const txFilters: [string, string][] = isCo
    ? [["all", "전체"], ["income", "수입"], ["accrue", "모리식대(발생)"], ["settle", "미지급금지급"], ["재료비", "재료비"], ["비품", "비품"], ["드림하우스", "드림하우스"], ["기타", "기타"]]
    : [["all", "전체"], ["income", "수입"], ["주거", "주거"], ["생활", "생활"], ["건강", "건강"], ["교통", "교통"], ["기타", "기타"]];
  const txOpts = isCo ? CO_EXP : HOME_DIV;
  const txView = (
    <>
      <div className="form">
        <label><span>날짜</span><input type="date" className="fld" value={fDate} onChange={e => setFDate(e.target.value)} /></label>
        <label><span>유형</span><div className="seg2"><button className={fType === "expense" ? "on exp" : ""} onClick={() => setFType("expense")}>지출</button><button className={fType === "income" ? "on inc" : ""} onClick={() => setFType("income")}>수입</button></div></label>
        <label><span>부문</span><select className="fld" value={fDiv} onChange={e => setFDiv(e.target.value)}>{divOptions.map(o => <option key={o}>{o}</option>)}</select></label>
        {isCo && fDiv === "모리" && fType === "expense"
          ? <label><span>모리 구분</span><div className="seg2"><button className={fMori === "accrue" ? "on a" : ""} onClick={() => setFMori("accrue")}>발생(식대)</button><button className={fMori === "settle" ? "on s" : ""} onClick={() => setFMori("settle")}>지급</button></div></label>
          : <label><span>세부</span><input className="fld" value={fDetail} onChange={e => setFDetail(e.target.value)} placeholder="예: 식대, 렌트" /></label>}
        {isCo && fDiv === "모리" && fType === "expense"
          ? <label><span>세부</span><input className="fld" value={fDetail} onChange={e => setFDetail(e.target.value)} placeholder="예: 고깃값" /></label>
          : <label><span>메모</span><input className="fld" value={fMemo} onChange={e => setFMemo(e.target.value)} placeholder="사유/방식" /></label>}
        {isCo && fDiv === "모리" && fType === "expense"
          ? <label><span>메모</span><input className="fld" value={fMemo} onChange={e => setFMemo(e.target.value)} placeholder="사유/상대" /></label>
          : <label style={{ visibility: "hidden" }}><span>.</span><input className="fld" /></label>}
        <label><span>금액</span><div style={{ display: "flex", gap: 5 }}><input type="number" className="fld" style={{ width: 80 }} value={fAmount} onChange={e => setFAmount(e.target.value)} placeholder="0" /><select className="fld" style={{ width: 52 }} value={fCur} onChange={e => setFCur(e.target.value as Cur)}><option value="PHP">₱</option><option value="KRW">₩</option></select></div></label>
        <label><span>&nbsp;</span><button className="addbtn" onClick={addEntry}>추가</button></label>
      </div>
      <div className="filters">{txFilters.map(([k, l]) => <button key={k} className={txnFilter === k ? "on" : ""} onClick={() => setTxnFilter(k)}>{l}</button>)}</div>
      <div className="card"><div style={{ overflowX: "auto" }}><table className="txn">
        <thead><tr><th>날짜</th><th>구분</th><th>부문</th><th>세부</th><th>메모</th><th className="r">금액</th><th></th></tr></thead>
        <tbody>
          {txList.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--mu)" }}>내역이 없어요.</td></tr>}
          {txList.map(r => {
            const mk = moriKindOf(r);
            const tag = r.type === "income" ? <span className="tag inc">수입</span> : mk === "accrue" ? <span className="tag acc">식대 발생</span> : mk === "settle" ? <span className="tag set">미지급 지급</span> : <span className="tag exp">지출</span>;
            const signed = r.type === "income" ? "+" + wonP(phpOf(r)) : mk === "settle" ? wonP(phpOf(r)) : "−" + wonP(phpOf(r));
            return (
              <tr key={r.id}>
                <td className="num" style={{ color: "var(--fa)", whiteSpace: "nowrap" }}>{r.entry_date}</td>
                <td>{tag}</td>
                <td><select className="selmini" value={txOpts.includes(r.division) ? r.division : "기타"} onChange={e => changeDiv(r.id, e.target.value)}>{txOpts.map(o => <option key={o}>{o}</option>)}</select>
                  {isCo && r.division === "모리" && r.type === "expense" && <select className="selmini" style={{ marginLeft: 5 }} value={mk || "settle"} onChange={e => changeMori(r.id, e.target.value as "accrue" | "settle")}><option value="accrue">발생</option><option value="settle">지급</option></select>}
                </td>
                <td>{r.detail}</td>
                <td style={{ color: "var(--fa)", fontSize: 12 }}>{r.memo}</td>
                <td className={"r num " + (r.type === "income" ? "pos" : mk === "settle" ? "" : "neg")} style={{ fontWeight: 600 }}>{signed}</td>
                <td><button className="xbtn" onClick={() => del(r.id)}>✕</button></td>
              </tr>
            );
          })}
        </tbody>
      </table></div></div>
      <div className="hint">기준통화 <b>페소(₱)</b>. 원(₩)은 환율로 환산 — 1 페소 = <input type="number" step="0.1" defaultValue={krwPerPhp} onBlur={e => saveRate(parseFloat(e.target.value))} style={{ width: 62, textAlign: "right", padding: "3px 6px", border: "1px solid var(--lns)", borderRadius: 7 }} /> 원.</div>
    </>
  );

  const tabs: [string, string][] = ws === "회사" ? [["pl", "손익계산서"], ["fs", "재무제표"], ["tx", "거래내역"]] : [["pl", "손익계산서"], ["tx", "거래내역"]];

  return (
    <div id="mayledger" data-ml={setThemeAttr || undefined}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="wrap">
        <div className="hdr">
          <div><h1 className="t">{title}</h1><div className="sub">{ws === "회사" ? "드림아카데미" : "메이집"} · 페소(₱) 기준 · 원화 자동환산 · 나만 보는 비공개</div></div>
          <div className="ctrl">
            <div className="wsseg">
              <button className={ws === "회사" ? "on" : ""} onClick={() => { setWs("회사"); setView("pl"); setTxnFilter("all"); }}><span className="dot" />드림아카데미</button>
              <button className={ws === "집" ? "on" : ""} onClick={() => { setWs("집"); setView("pl"); setTxnFilter("all"); }}><span className="dot" style={{ background: "#c98a2a" }} />메이집</button>
            </div>
            <select className="fld" value={period} onChange={e => setPeriod(e.target.value)}><option value="all">전체 기간</option>{months.map(m => <option key={m} value={m}>{m.replace("-", ". ")}</option>)}</select>
            <button className="iconbtn" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="테마">◐</button>
          </div>
        </div>
        <div className="tabs">{tabs.map(([v, l]) => <button key={v} className={(view === v || (view === "apLedger" && v === "fs") || (view === "acct" && v === "pl")) ? "on" : ""} onClick={() => setView(v as typeof view)}>{l}</button>)}</div>
        {kpis}
        {view === "pl" && (ws === "회사" ? plCo : plHome)}
        {view === "fs" && ws === "회사" && fs}
        {view === "apLedger" && apLedgerView}
        {view === "acct" && acctView}
        {view === "tx" && txView}
      </div>
    </div>
  );
}
