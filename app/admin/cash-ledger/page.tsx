"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

interface Closing { close_date: string; ledger_balance: number; actual_amount: number | null; diff: number | null; memo: string | null; closed_by: string | null; closed_at: string; }

interface Entry {
  id: string; entry_date: string; type: "in" | "out";
  category: string; description: string | null; amount: number;
  guest_name: string | null; booking_id: string | null;
  receipt_files: { name: string; url: string }[];
  recorded_by: string | null; created_at: string;
  ref_id?: string | null; house_no?: string | null;
}

const CATEGORIES_IN = ["보증금", "현금수입", "기타입금"];
const CATEGORIES_OUT = ["교통비", "소모품", "유지보수", "인건비", "보증금반환", "기타지출"];
const ALL_CATEGORIES = [...CATEGORIES_IN, ...CATEGORIES_OUT];

const peso = (n: number) => "₱" + (n || 0).toLocaleString("en-US");
const won = (n: number) => "₩" + (n || 0).toLocaleString("en-US");
const fmtD = (d: string) => { const dt = new Date(d + "T00:00:00"); return `${dt.getMonth() + 1}/${dt.getDate()}`; };
const today10 = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// 시재관리 접근 허용 계정
const CASH_ALLOWED = ["admin-vivace", "admin-ceo"];

export default function CashLedgerPage() {
  const router = useRouter();
  const [denied, setDenied] = useState(false);
  const [ready, setReady] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [items, setItems] = useState<Entry[]>([]);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [balance, setBalance] = useState(0);

  // 월 네비
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // 추가 폼
  const [addOpen, setAddOpen] = useState(false);
  const [aType, setAType] = useState<"in" | "out">("in");
  const [aCat, setACat] = useState("보증금");
  const [aDesc, setADesc] = useState("");
  const [aAmount, setAAmount] = useState("");
  const [aDate, setADate] = useState(today10());
  const [aGuest, setAGuest] = useState("");
  const [aFiles, setAFiles] = useState<{ name: string; url: string }[]>([]);
  const [aRefId, setARefId] = useState<string>("");
  const [aHouse, setAHouse] = useState<string>("");
  const DH_HOUSES = ["17/7","17/8","17/9","17/10","17/11","17/12","17/13","17/14","17/15","17/16","17/17","17/18","13/10","16/19"];
  // 반환 처리 모달 (보유 보증금 → 기존 반환 기록 연결 or 새 출금 생성)
  const [retModal, setRetModal] = useState<{ id: string; name: string; date: string; amount: number } | null>(null);
  const [retSel, setRetSel] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 영수증 확대
  const [lightbox, setLightbox] = useState<string | null>(null);

  // 필터
  const [filterCat, setFilterCat] = useState<string>("all");

  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    const info = getAdminInfo();
    if (info) {
      setStaffName(info.name);
      setStaffId(info.staffId || "");
      // 허용된 계정만 접근 가능
      if (!CASH_ALLOWED.includes(info.staffId)) { setDenied(true); setReady(true); return; }
    }
    setReady(true);
  }, [router]);

  const [allItems, setAllItems] = useState<Entry[]>([]);
  const [closings, setClosings] = useState<Closing[]>([]);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [closePanel, setClosePanel] = useState<string | null>(null);
  const [closeActual, setCloseActual] = useState("");
  const [closeMemo, setCloseMemo] = useState("");
  const [closing, setClosing] = useState(false);
  const [staffId, setStaffId] = useState("");
  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/cash-ledger?year=${year}&month=${String(month).padStart(2, "0")}`);
    const j = await res.json();
    if (j.items) setItems(j.items);
    setTotalIn(j.totalIn || 0);
    setTotalOut(j.totalOut || 0);
    setBalance(j.balance || 0);
    // 전체 내역 (이월 잔액·보증금 보유현황) — 클라이언트에서 직접 조회
    try {
      const { data } = await supabase.from("cash_ledger").select("id,entry_date,type,category,description,amount,guest_name,ref_id,house_no").order("entry_date");
      setAllItems((data || []) as Entry[]);
    } catch {}
    try {
      const cr = await fetch("/api/admin/cash-ledger/close").then(r => r.json());
      setClosings((cr.closings || []) as Closing[]);
    } catch {}
  }, [year, month]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const filtered = useMemo(() => {
    if (filterCat === "all") return items;
    return items.filter(i => i.category === filterCat);
  }, [items, filterCat]);


  // 이월 잔액 = 이번 달 이전 모든 내역의 순액
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const carryOver = useMemo(() => allItems.filter(i => (i.entry_date || "") < monthStart)
    .reduce((a2, i) => a2 + (i.type === "in" ? 1 : -1) * Number(i.amount || 0), 0), [allItems, monthStart]);
  const grandTotal = carryOver + balance;

  /* ── 일마감 ── */
  const closingMap = useMemo(() => { const m: Record<string, Closing> = {}; closings.forEach(c => { m[c.close_date] = c; }); return m; }, [closings]);
  const lastClosed = useMemo(() => closings.reduce((mx, c) => (c.close_date > mx ? c.close_date : mx), ""), [closings]);
  // 특정 날짜까지의 장부 잔액 (전체 기준)
  const balAt = useCallback((d: string) => allItems.filter(i => (i.entry_date || "") <= d).reduce((a2, i) => a2 + (i.type === "in" ? 1 : -1) * Number(i.amount || 0), 0), [allItems]);
  // 미마감 (기록 있는 지난 날짜, 마지막 마감 이후 ~ 어제)
  const unclosedDays = useMemo(() => {
    const t = today10();
    const days = [...new Set(allItems.map(i => i.entry_date))].filter(d => d && d < t && (!lastClosed || d > lastClosed));
    return days.sort();
  }, [allItems, lastClosed]);
  const canUnlock = staffId === "admin-ceo";

  async function submitClose(d: string) {
    if (closing) return;
    setClosing(true);
    try {
      const res = await fetch("/api/admin/cash-ledger/close", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ close_date: d, actual_amount: closeActual.trim() === "" ? null : Number(closeActual.replace(/[,\s]/g, "")), memo: closeMemo.trim() || null, closed_by: staffName }),
      });
      const j = await res.json();
      if (!res.ok) { alert(j.error || "마감 실패"); return; }
      setClosePanel(null); setCloseActual(""); setCloseMemo("");
      load();
    } finally { setClosing(false); }
  }
  async function unlockClose(d: string) {
    if (!confirm(d + " 마감을 해제할까요?\n해제하면 그 날짜 기록을 수정할 수 있어요.")) return;
    const res = await fetch("/api/admin/cash-ledger/close?date=" + d, { method: "DELETE" });
    const j = await res.json();
    if (!res.ok) { alert(j.error || "해제 실패"); return; }
    load();
  }
  // 보증금 보유현황: ① ref_id 정확 매칭 → ② 같은 이름 매칭 (반환 완료분 숨김)
  const { heldDeposits, unmatchedReturns } = useMemo(() => {
    const key = (i: Entry) => {
      const nm = String(i.guest_name || i.description || "").trim();
      const h = String(i.house_no || "").replace(/\s+/g, "");
      return h ? h + "|" + nm : nm;
    };
    const deposits = allItems.filter(i => i.category === "보증금" && i.type === "in");
    const returns = allItems.filter(i => i.category === "보증금반환" && i.type === "out");
    const remaining = new Map<string, number>();
    deposits.forEach(d => remaining.set(d.id, Number(d.amount || 0)));
    const usedReturn = new Set<string>();
    // ① ref_id 정확 매칭
    returns.forEach(r => {
      if (r.ref_id && remaining.has(r.ref_id)) {
        remaining.set(r.ref_id, Math.max(0, (remaining.get(r.ref_id) || 0) - Number(r.amount || 0)));
        usedReturn.add(r.id);
      }
    });
    // ② 이름 매칭 풀 (ref 없는 반환)
    const nameReturned = new Map<string, number>();
    returns.forEach(r => {
      if (usedReturn.has(r.id)) return;
      const k = key(r); nameReturned.set(k, (nameReturned.get(k) || 0) + Number(r.amount || 0));
      // 이름-only 폴백 키 (하우스 정보가 한쪽에만 있는 과거 기록 호환)
      const nm = String(r.guest_name || r.description || "").trim();
      if (k !== nm) nameReturned.set(nm, (nameReturned.get(nm) || 0) + Number(r.amount || 0));
    });
    const list: { id: string; name: string; house: string; date: string; amount: number; desc: string }[] = [];
    deposits.forEach(d => {
      let amt = remaining.get(d.id) || 0;
      if (amt <= 0) return;
      const k = key(d);
      const nmOnly = String(d.guest_name || d.description || "").trim();
      let ret = nameReturned.get(k) || 0;
      let useKey = k;
      if (ret <= 0 && k !== nmOnly) { ret = nameReturned.get(nmOnly) || 0; useKey = nmOnly; }
      if (ret > 0) {
        const use = Math.min(ret, amt);
        nameReturned.set(useKey, ret - use);
        amt -= use;
      }
      if (amt <= 0) return;
      list.push({ id: d.id, name: String(d.guest_name || d.description || "").trim() || "(이름 없음)", house: String(d.house_no || "").trim(), date: (d.entry_date || "").slice(5, 10).replace("-", "/"), amount: amt, desc: String(d.description || "") });
    });
    // 어느 보증금과도 매칭 안 된 반환 기록 (이름 불일치 등)
    const um = returns.filter(r => !usedReturn.has(r.id) && (nameReturned.get(key(r)) || 0) > 0);
    return { heldDeposits: list.reverse(), unmatchedReturns: um };
  }, [allItems]);
  const heldTotal = heldDeposits.reduce((a2, d) => a2 + d.amount, 0);

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  // 사진 압축 (폰 카메라 원본이 4.5MB 초과 시 서버가 413으로 거부 → 업로드 전 리사이즈)
  function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve) => {
      if (!file.type.startsWith("image/")) { resolve(file); return; }
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 1800; let w = img.width, h = img.height;
          if (Math.max(w, h) > max) { const k = max / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          const ctx = c.getContext("2d");
          if (!ctx) { resolve(file); return; }
          ctx.drawImage(img, 0, 0, w, h);
          c.toBlob(b => resolve(b || file), "image/jpeg", 0.85);
        };
        img.onerror = () => resolve(file);
        img.src = r.result as string;
      };
      r.onerror = () => resolve(file);
      r.readAsDataURL(file);
    });
  }

  // 파일 업로드
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const orig = files[i];
        const blob = await compressImage(orig);
        const fname = orig.name.replace(/\.[^.]+$/, "") + ".jpg";
        const fd = new FormData();
        fd.append("file", new File([blob], fname, { type: "image/jpeg" }));
        const res = await fetch("/api/admin/cash-ledger/upload", { method: "POST", body: fd });
        const j = await res.json().catch(() => null);
        if (res.ok && j?.url) setAFiles(prev => [...prev, { name: j.name, url: j.url }]);
        else alert(`업로드 실패 (${res.status}): ${j?.error || "사진이 너무 크거나 네트워크 오류예요. 다시 시도해주세요."}`);
      }
    } catch (err) {
      alert("업로드 실패: " + (err instanceof Error ? err.message : "알 수 없는 오류"));
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function saveEntry() {
    if (!aAmount || Number(aAmount) <= 0) return alert("금액을 입력해주세요");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/cash-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_date: aDate, type: aType, category: aCat,
          description: aDesc || null, amount: Number(aAmount),
          guest_name: aGuest || null, receipt_files: aFiles,
          recorded_by: staffName, ref_id: aRefId || null, house_no: aHouse.trim() || null,
        }),
      });
      if (!res.ok) { const j = await res.json(); alert(j.error || "저장 실패"); return; }
      resetForm(); load();
    } finally { setSaving(false); }
  }

  async function deleteEntry(id: string) {
    if (!confirm("이 항목을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/admin/cash-ledger?id=${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  function resetForm() { setAddOpen(false); setAType("in"); setACat("보증금"); setADesc(""); setAAmount(""); setADate(today10()); setAGuest(""); setAFiles([]); setARefId(""); setAHouse(""); }
  // 기존 반환 기록 ↔ 보증금 연결
  async function linkReturn() {
    if (!retModal || !retSel) return;
    const res = await fetch("/api/admin/cash-ledger", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: retSel, ref_id: retModal.id }) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || "연결 실패"); return; }
    setRetModal(null); setRetSel("");
    load();
  }
  // 보유 보증금에서 바로 반환 출금 만들기
  function newReturnFromDeposit(d: { id: string; name: string; amount: number; house?: string }) {
    setRetModal(null); setRetSel("");
    setAType("out"); setACat("보증금반환"); setAGuest(d.name); setAHouse(d.house || ""); setAAmount(String(d.amount)); setADate(today10()); setADesc("보증금 반환 — " + d.name); setAFiles([]); setARefId(d.id);
    setAddOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!ready) return null;

  if (denied) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "'Noto Sans KR', sans-serif", background: "#f1f5f9" }}>
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: "#1a1a2e" }}>접근 권한이 없습니다</h2>
        <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>시재 관리는 허용된 관리자만 사용할 수 있습니다.</p>
        <button onClick={() => router.push("/admin/hub")} style={{ padding: "10px 24px", background: "#1a6fc4", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← 관리자 홈으로</button>
      </div>
    </div>
  );

  return (<>
    <style>{`*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}`}</style>
    <div style={{ maxWidth: 1020, margin: "0 auto", padding: "24px 20px" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>💰 시재 관리</h1>
        {unclosedDays.length > 0 && (
          <span title={"미마감: " + unclosedDays.join(", ")} style={{ fontSize: 11.5, fontWeight: 800, background: "#fee2e2", color: "#b91c1c", borderRadius: 8, padding: "3px 10px" }}>⚠ 미마감 {unclosedDays.length}일</span>
        )}
        {lastClosed && <span style={{ fontSize: 11.5, fontWeight: 700, color: "#166534", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "3px 10px" }}>🔒 {fmtD(lastClosed)}까지 마감됨</span>}
        <span style={{ flex: 1 }} />
      </div>
      <p style={{ fontSize: 13, color: "#6b7c93", marginBottom: 12 }}>하루 기록이 끝나면 금고와 대조하고 일마감하세요 — 마감된 날짜는 잠깁니다.</p>
      {(() => {
        const t = today10();
        const tIn = allItems.filter(i => i.entry_date === t && i.type === "in").reduce((a2, i) => a2 + Number(i.amount || 0), 0);
        const tOut = allItems.filter(i => i.entry_date === t && i.type === "out").reduce((a2, i) => a2 + Number(i.amount || 0), 0);
        const nowBal = balAt(t);
        const startBal = nowBal - (tIn - tOut);
        return (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 14px" }}><div style={{ fontSize: 10.5, color: "#94a3b8" }}>오늘 시작 잔액</div><div style={{ fontSize: 15, fontWeight: 800 }}>{peso(startBal)}</div></div>
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "8px 14px" }}><div style={{ fontSize: 10.5, color: "#94a3b8" }}>오늘 증감</div><div style={{ fontSize: 15, fontWeight: 800, color: tIn - tOut >= 0 ? "#1a6fc4" : "#dc2626" }}>{tIn - tOut >= 0 ? "+" : "-"}{peso(Math.abs(tIn - tOut))}</div></div>
            <div style={{ background: "#eefaf1", border: "1px solid #bfe5c8", borderRadius: 10, padding: "8px 14px" }}><div style={{ fontSize: 10.5, color: "#1d7a35" }}>현재 장부 잔액</div><div style={{ fontSize: 15, fontWeight: 800, color: "#166534" }}>{peso(nowBal)}</div></div>
          </div>
        );
      })()}

      {/* 좌우 분할 */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 18, alignItems: "start" }}>

        {/* ── 좌측: 월 네비 + 요약 ── */}
        <div>
          {/* 월 네비 */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 12 }}>
              <button onClick={prevMonth} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>◀</button>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{year}년 {month}월</span>
              <button onClick={nextMonth} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>▶</button>
            </div>

            {/* 잔액: 이월 → 이번 달 → 총 잔액 */}
            <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "9px 14px", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>이월 잔액 (지난달까지)</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#334155" }}>{peso(carryOver)}</div>
            </div>
            <div style={{ background: "#fff", border: "1px dashed #e2e8f0", borderRadius: 10, padding: "8px 14px", marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>이번 달 증감</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: balance >= 0 ? "#16a34a" : "#dc2626" }}>{balance >= 0 ? "+" : ""}{peso(balance)}</div>
            </div>
            <div style={{ background: grandTotal >= 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: `1.5px solid ${grandTotal >= 0 ? "#86efac" : "#fecaca"}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: grandTotal >= 0 ? "#16a34a" : "#dc2626" }}>현재 총 잔액 (금고 실제)</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: grandTotal >= 0 ? "#16a34a" : "#dc2626" }}>{peso(grandTotal)}</div>
            </div>

            {/* 입금/출금 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: "#eff6ff", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1a6fc4" }}>입금</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1a6fc4" }}>{peso(totalIn)}</div>
              </div>
              <div style={{ background: "#fef2f2", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#dc2626" }}>출금</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#dc2626" }}>{peso(totalOut)}</div>
              </div>
            </div>
          </div>

          {/* 🔒 보증금 보유현황 */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              🔒 보증금 보유현황
              <span style={{ fontSize: 10.5, fontWeight: 800, background: "#eef2ff", color: "#4338ca", borderRadius: 6, padding: "2px 8px" }}>{heldDeposits.length}건 · {peso(heldTotal)}</span>
            </div>
            {heldDeposits.length === 0 ? <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 0" }}>보관 중인 보증금이 없습니다</div> :
              heldDeposits.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 8px", borderRadius: 8, background: "#f8fafc", marginBottom: 4, fontSize: 12 }}>
                  <span style={{ fontWeight: 800, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.desc}>{d.house && <span style={{ background: "#eef2ff", color: "#4338ca", borderRadius: 5, padding: "1px 5px", fontSize: 10.5, marginRight: 4 }}>{d.house}</span>}{d.name}</span>
                  <span style={{ color: "#94a3b8", fontSize: 10.5, whiteSpace: "nowrap" }}>{d.date} 입금</span>
                  <span style={{ fontWeight: 800, color: "#1d4ed8", whiteSpace: "nowrap" }}>{peso(d.amount)}</span>
                  <button onClick={() => { setRetModal(d); setRetSel(""); }} title="반환 처리"
                    style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 7, padding: "3px 8px", fontSize: 10.5, fontWeight: 800, color: "#475569", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>↩ 반환</button>
                </div>
              ))}
            <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 6, lineHeight: 1.6 }}>↩ 반환 버튼으로 정확히 매칭하세요 · 같은 이름의 반환 기록은 자동 매칭 (반환 완료분은 숨김)</div>
          </div>
        </div>

        {/* ── 우측: 거래 내역 ── */}
        <div>
          {/* 추가 버튼 */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button onClick={() => { resetForm(); setAType("in"); setACat("보증금"); setAddOpen(true); }}
              style={{ padding: "8px 16px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "#1a6fc4", color: "#fff" }}>+ 입금 기록</button>
            <button onClick={() => { resetForm(); setAType("out"); setACat("교통비"); setAddOpen(true); }}
              style={{ padding: "8px 16px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: "#dc2626", color: "#fff" }}>+ 출금 기록</button>
          </div>

          {/* 추가 폼 (인라인) */}
          {addOpen && (
            <div style={{ background: "#fff", border: "2px solid #1a6fc4", borderRadius: 12, padding: "18px 20px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{aType === "in" ? "💵 입금 기록" : "💸 출금 기록"}</span>
                <button onClick={resetForm} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8" }}>✕</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>날짜</label>
                  <input type="date" value={aDate} onChange={e => setADate(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>분류</label>
                  <select value={aCat} onChange={e => setACat(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
                    {(aType === "in" ? CATEGORIES_IN : CATEGORIES_OUT).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                {aType === "out" && aCat === "보증금반환" && (
                  <div style={{ gridColumn: "1 / 3" }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>🔒 어느 보증금의 반환인가요? (보유현황에서 선택)</label>
                    <select value={aRefId} onChange={e => {
                      const v = e.target.value; setARefId(v);
                      const d = heldDeposits.find(x => x.id === v);
                      if (d) { setAGuest(d.name); if (!aAmount) setAAmount(String(d.amount)); }
                    }}
                      style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #4338ca", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: "#f5f6ff" }}>
                      <option value="">— 선택 안 함 (이름으로 자동 매칭) —</option>
                      {heldDeposits.map(d => <option key={d.id} value={d.id}>{d.name} · {d.date} 입금 · {peso(d.amount)}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>금액 (PHP) *</label>
                  <input type="number" value={aAmount} onChange={e => setAAmount(e.target.value)} placeholder="0"
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>관련 손님 (선택)</label>
                    <input value={aGuest} onChange={e => setAGuest(e.target.value)} placeholder="손님 이름"
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>하우스</label>
                    <input list="dhHouseList" value={aHouse} onChange={e => setAHouse(e.target.value)} placeholder="17/16"
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                    <datalist id="dhHouseList">{DH_HOUSES.map(h => <option key={h} value={h} />)}</datalist>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>내용/메모</label>
                <input value={aDesc} onChange={e => setADesc(e.target.value)} placeholder="내용을 입력하세요"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              </div>

              {/* 영수증 업로드 */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>🧾 영수증 이미지</label>
                <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileChange}
                  style={{ fontSize: 12 }} />
                {uploading && <span style={{ fontSize: 11, color: "#1a6fc4", marginLeft: 8 }}>업로드 중...</span>}
                {aFiles.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {aFiles.map((f, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        <img src={f.url} alt={f.name} style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer" }} onClick={() => setLightbox(f.url)} />
                        <span onClick={() => setAFiles(prev => prev.filter((_, idx) => idx !== i))}
                          style={{ position: "absolute", top: -4, right: -4, background: "#dc2626", color: "#fff", borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, cursor: "pointer" }}>×</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={resetForm} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>취소</button>
                <button onClick={saveEntry} disabled={saving}
                  style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: aType === "in" ? "#1a6fc4" : "#dc2626", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>{saving ? "저장 중..." : "저장"}</button>
              </div>
            </div>
          )}

          {/* 거래 내역 리스트 */}
          {filtered.length === 0 ? (
            <div style={{ background: "#fff", border: "2px dashed #e2e8f0", borderRadius: 12, padding: 50, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
              {items.length === 0 ? `${year}년 ${month}월 기록이 없습니다` : "해당 분류 기록이 없습니다"}
            </div>
          ) : (
            <div>
              {(() => {
                const dayList = [...new Set(filtered.map(i => i.entry_date))].sort().reverse();
                const t = today10();
                return dayList.map(d => {
                  const dayItems = filtered.filter(i => i.entry_date === d);
                  const dIn = dayItems.filter(i => i.type === "in").reduce((a2, i) => a2 + Number(i.amount || 0), 0);
                  const dOut = dayItems.filter(i => i.type === "out").reduce((a2, i) => a2 + Number(i.amount || 0), 0);
                  // 줄마다 잔액 (통장 스타일): 그날 시작 잔액에서 시간순 누적
                  const dayStart = balAt(d) - (dIn - dOut);
                  const runMap: Record<string, number> = {};
                  { let acc = dayStart; [...dayItems].reverse().forEach(i => { acc += (i.type === "in" ? 1 : -1) * Number(i.amount || 0); runMap[i.id] = acc; }); }
                  const cl = closingMap[d];
                  const isToday = d === t;
                  const collapsed = !!cl && !expandedDays.has(d);
                  const dow = ["일","월","화","수","목","금","토"][new Date(d + "T00:00:00").getDay()];
                  const canClose = !cl && d <= t && (!lastClosed || d > lastClosed);
                  return (
                    <div key={d} style={{ background: "#fff", border: isToday && !cl ? "2px solid #6366f1" : cl ? "1px solid #e2e8f0" : "1px solid #fca5a5", borderRadius: 12, marginBottom: 10, overflow: "hidden" }}>
                      <div onClick={() => { if (cl) setExpandedDays(p => { const n = new Set(p); if (n.has(d)) n.delete(d); else n.add(d); return n; }); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: isToday && !cl ? "#eef2ff" : "#f8fafc", cursor: cl ? "pointer" : "default", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: isToday ? "#3730a3" : "#334155" }}>{fmtD(d)} ({dow}){isToday ? " · 오늘" : ""}</span>
                        <span style={{ fontSize: 11.5, color: "#64748b" }}>{dayItems.length}건 · 입금 {peso(dIn)} · 출금 {peso(dOut)}</span>
                        <span style={{ fontSize: 11.5, color: "#475569", fontWeight: 700 }}>잔액 {peso(cl ? Number(cl.ledger_balance) : balAt(d))}</span>
                        {cl && cl.diff != null && cl.diff !== 0 && <span style={{ fontSize: 11, fontWeight: 800, color: "#b45309" }}>실사 차액 {cl.diff > 0 ? "+" : ""}{peso(Number(cl.diff))}{cl.memo ? ` "${cl.memo}"` : ""}</span>}
                        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                          {cl
                            ? <><span style={{ fontSize: 11, fontWeight: 800, background: "#dcfce7", color: "#166534", borderRadius: 7, padding: "2px 9px" }}>🔒 마감 · {cl.closed_by || ""} {String(cl.closed_at || "").slice(11, 16)}</span>
                                {canUnlock && d === lastClosed && <button onClick={e => { e.stopPropagation(); unlockClose(d); }} title="마감 해제 (관리자)" style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 10, padding: "2px 7px", cursor: "pointer", color: "#94a3b8", fontFamily: "inherit" }}>해제</button>}
                                <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{collapsed ? "▸ 펼치기" : "▾ 접기"}</span></>
                            : isToday
                            ? <span style={{ fontSize: 11, fontWeight: 800, background: "#fef3c7", color: "#92400e", borderRadius: 7, padding: "2px 9px" }}>진행 중</span>
                            : <span style={{ fontSize: 11, fontWeight: 800, background: "#fee2e2", color: "#b91c1c", borderRadius: 7, padding: "2px 9px" }}>⚠ 미마감</span>}
                          {canClose && closePanel !== d && <button onClick={e => { e.stopPropagation(); setClosePanel(d); setCloseActual(String(balAt(d))); setCloseMemo(""); }}
                            style={{ background: isToday ? "#4f46e5" : "#fff", color: isToday ? "#fff" : "#4f46e5", border: isToday ? "none" : "1px solid #c7d2fe", borderRadius: 8, padding: "5px 13px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>🔒 {isToday ? "오늘 마감" : "마감하기"}</button>}
                        </span>
                      </div>
                      {!collapsed && dayItems.map(item => (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "70px 60px 80px 1fr 100px 90px 50px", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", alignItems: "center", fontSize: 13 }}>
                  <span style={{ color: "#64748b", fontSize: 12 }}>{fmtD(item.entry_date)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 6, textAlign: "center",
                    background: item.type === "in" ? "#eff6ff" : "#fef2f2", color: item.type === "in" ? "#1a6fc4" : "#dc2626" }}>
                    {item.type === "in" ? "입금" : "출금"}
                  </span>
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{item.category}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.description || ""}>
                      {item.description || "-"}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
                      {item.guest_name && <span style={{ fontSize: 10, color: "#94a3b8" }}>👤 {item.guest_name}</span>}
                      {item.receipt_files?.length > 0 && (
                        <span style={{ fontSize: 10, color: "#1a6fc4", cursor: "pointer", fontWeight: 600 }} onClick={() => setLightbox(item.receipt_files[0].url)}>
                          🧾 영수증 {item.receipt_files.length}장
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ textAlign: "right", fontWeight: 800, fontSize: 14, color: item.type === "in" ? "#1a6fc4" : "#dc2626" }}>
                    {item.type === "in" ? "+" : "-"}{peso(item.amount)}
                  </span>
                  <span style={{ textAlign: "right", fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }} title="이 기록 직후 잔액">{peso(runMap[item.id] ?? 0)}</span>
                  {closingMap[item.entry_date]
                    ? <span title="마감된 날짜 (잠김)" style={{ fontSize: 12, color: "#cbd5e1", textAlign: "center" }}>🔒</span>
                    : <button onClick={() => deleteEntry(item.id)} title="삭제"
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#cbd5e1", fontFamily: "inherit" }}>🗑</button>}
                </div>
                      ))}
                      {closePanel === d && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "1px dashed #c7d2fe", background: "#fafbff", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: "#475569" }}>마감 잔액 <b style={{ fontSize: 14 }}>{peso(balAt(d))}</b></span>
                          <span style={{ fontSize: 11.5, color: "#94a3b8" }}>금고 실사:</span>
                          <input value={closeActual} onChange={e => setCloseActual(e.target.value)} placeholder="실제 센 금액"
                            style={{ width: 110, padding: "5px 9px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit" }} />
                          {(() => { const a = Number(String(closeActual).replace(/[,\s]/g, "")); const df = closeActual.trim() === "" || isNaN(a) ? null : Math.round((a - balAt(d)) * 100) / 100;
                            return df === null ? null : <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 6, padding: "2px 8px", background: df === 0 ? "#dcfce7" : "#fef3c7", color: df === 0 ? "#166534" : "#92400e" }}>차액 {df > 0 ? "+" : ""}{peso(df)}</span>; })()}
                          <input value={closeMemo} onChange={e => setCloseMemo(e.target.value)} placeholder="메모 (차액 있으면 필수)"
                            style={{ flex: 1, minWidth: 130, padding: "5px 9px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontFamily: "inherit" }} />
                          <button onClick={() => setClosePanel(null)} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 7, padding: "5px 11px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", color: "#64748b" }}>취소</button>
                          <button onClick={() => submitClose(d)} disabled={closing}
                            style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", opacity: closing ? 0.6 : 1 }}>{closing ? "마감 중…" : "마감 확정"}</button>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* 라이트박스 */}
    {lightbox && (
      <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, cursor: "pointer" }}>
        <img src={lightbox} alt="receipt" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }} />
      </div>
    )}

    {/* 반환 처리 모달 */}
    {retModal && (
      <div onClick={() => setRetModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 }}>
        <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: "20px 22px", width: "min(460px, 92vw)", boxShadow: "0 12px 40px rgba(0,0,0,0.25)" }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>↩ 보증금 반환 처리</div>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>
            <b>{retModal.name}</b> · {retModal.date} 입금 · <b style={{ color: "#1d4ed8" }}>{peso(retModal.amount)}</b>
          </div>

          <button onClick={() => newReturnFromDeposit(retModal)}
            style={{ width: "100%", padding: "10px 0", border: "none", borderRadius: 9, background: "#dc2626", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 14 }}>
            💸 새 출금(반환) 기록 만들기 — 이름·금액 자동 입력
          </button>

          {unmatchedReturns.length > 0 && (<>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#92400e", marginBottom: 6 }}>
              이미 출금 기록이 있다면 — 매칭 안 된 반환 기록과 연결 (이름이 달라서 남은 경우)
            </div>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 9, padding: 6, marginBottom: 10 }}>
              {unmatchedReturns.map(r => (
                <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7, background: retSel === r.id ? "#eef2ff" : "transparent", cursor: "pointer", fontSize: 12 }}>
                  <input type="radio" name="retSel" checked={retSel === r.id} onChange={() => setRetSel(r.id)} />
                  <span style={{ flex: 1, fontWeight: 700 }}>{String(r.guest_name || r.description || "(이름 없음)")}</span>
                  <span style={{ color: "#94a3b8", fontSize: 10.5 }}>{(r.entry_date || "").slice(5, 10).replace("-", "/")} 출금</span>
                  <span style={{ fontWeight: 800, color: "#dc2626" }}>{peso(Number(r.amount) || 0)}</span>
                </label>
              ))}
            </div>
            <button onClick={linkReturn} disabled={!retSel}
              style={{ width: "100%", padding: "9px 0", border: "1.5px solid #4338ca", borderRadius: 9, background: retSel ? "#4338ca" : "#fff", color: retSel ? "#fff" : "#94a3b8", fontWeight: 800, fontSize: 13, cursor: retSel ? "pointer" : "default", fontFamily: "inherit", marginBottom: 10 }}>
              🔗 선택한 반환 기록과 연결 (장부에 새 출금 안 생김)
            </button>
          </>)}

          <button onClick={() => setRetModal(null)} style={{ width: "100%", padding: "8px 0", border: "1px solid #e2e8f0", borderRadius: 9, background: "#fff", color: "#64748b", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>닫기</button>
        </div>
      </div>
    )}
  </>);
}
