"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";

interface Entry {
  id: string; entry_date: string; type: "in" | "out";
  category: string; description: string | null; amount: number;
  guest_name: string | null; booking_id: string | null;
  receipt_files: { name: string; url: string }[];
  recorded_by: string | null; created_at: string;
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
      // 허용된 계정만 접근 가능
      if (!CASH_ALLOWED.includes(info.staffId)) { setDenied(true); setReady(true); return; }
    }
    setReady(true);
  }, [router]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/cash-ledger?year=${year}&month=${String(month).padStart(2, "0")}`);
    const j = await res.json();
    if (j.items) setItems(j.items);
    setTotalIn(j.totalIn || 0);
    setTotalOut(j.totalOut || 0);
    setBalance(j.balance || 0);
  }, [year, month]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const filtered = useMemo(() => {
    if (filterCat === "all") return items;
    return items.filter(i => i.category === filterCat);
  }, [items, filterCat]);

  // 카테고리별 집계
  const catSummary = useMemo(() => {
    const map: Record<string, { in: number; out: number }> = {};
    for (const i of items) {
      if (!map[i.category]) map[i.category] = { in: 0, out: 0 };
      map[i.category][i.type] += Number(i.amount || 0);
    }
    return map;
  }, [items]);

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }

  // 파일 업로드
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append("file", files[i]);
        const res = await fetch("/api/admin/cash-ledger/upload", { method: "POST", body: fd });
        const j = await res.json();
        if (res.ok && j.url) setAFiles(prev => [...prev, { name: j.name, url: j.url }]);
        else alert(`업로드 실패: ${j.error || "unknown"}`);
      }
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
          recorded_by: staffName,
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

  function resetForm() { setAddOpen(false); setAType("in"); setACat("보증금"); setADesc(""); setAAmount(""); setADate(today10()); setAGuest(""); setAFiles([]); }

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
        <button onClick={() => router.push("/admin/hub")} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>← 관리자 홈</button>
        <h1 style={{ fontSize: 22, fontWeight: 800, flex: 1 }}>💰 시재 관리</h1>
      </div>
      <p style={{ fontSize: 13, color: "#6b7c93", marginBottom: 18 }}>보증금 입금, 지출 내역, 영수증을 기록하고 관리합니다.</p>

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

            {/* 잔액 */}
            <div style={{ background: balance >= 0 ? "#f0fdf4" : "#fef2f2", borderRadius: 10, padding: "12px 14px", marginBottom: 10, border: `1px solid ${balance >= 0 ? "#bbf7d0" : "#fecaca"}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: balance >= 0 ? "#16a34a" : "#dc2626" }}>이번 달 잔액</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: balance >= 0 ? "#16a34a" : "#dc2626" }}>{peso(balance)}</div>
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

          {/* 분류별 필터 */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>분류별 보기</div>
            <div onClick={() => setFilterCat("all")} style={{ padding: "7px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 3, fontSize: 13, fontWeight: 700, background: filterCat === "all" ? "#eff6ff" : "transparent", color: filterCat === "all" ? "#1a6fc4" : "#64748b" }}>
              전체 ({items.length}건)
            </div>
            {Object.entries(catSummary).map(([cat, v]) => (
              <div key={cat} onClick={() => setFilterCat(cat)} style={{ padding: "6px 10px", borderRadius: 8, cursor: "pointer", marginBottom: 2, fontSize: 12, display: "flex", alignItems: "center", gap: 6, background: filterCat === cat ? "#eff6ff" : "transparent", color: filterCat === cat ? "#1a6fc4" : "#475569" }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{cat}</span>
                {v.in > 0 && <span style={{ color: "#1a6fc4", fontWeight: 700, fontSize: 11 }}>+{peso(v.in)}</span>}
                {v.out > 0 && <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 11 }}>-{peso(v.out)}</span>}
              </div>
            ))}
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
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>금액 (PHP) *</label>
                  <input type="number" value={aAmount} onChange={e => setAAmount(e.target.value)} placeholder="0"
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>관련 손님 (선택)</label>
                  <input value={aGuest} onChange={e => setAGuest(e.target.value)} placeholder="손님 이름"
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
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
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              {/* 테이블 헤더 */}
              <div style={{ display: "grid", gridTemplateColumns: "70px 60px 80px 1fr 100px 50px", padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                <span>날짜</span><span>유형</span><span>분류</span><span>내용</span><span style={{ textAlign: "right" }}>금액</span><span></span>
              </div>
              {filtered.map(item => (
                <div key={item.id} style={{ display: "grid", gridTemplateColumns: "70px 60px 80px 1fr 100px 50px", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", alignItems: "center", fontSize: 13 }}>
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
                  <button onClick={() => deleteEntry(item.id)} title="삭제"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#cbd5e1", fontFamily: "inherit" }}>🗑</button>
                </div>
              ))}
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
  </>);
}
