"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";
import ResortInvoiceDoc, { type ResortInvDocRow } from "../resort-invoice/ResortInvoiceDoc";

type Resort = "all" | "jaypark" | "cubenine";
const RESORT_LABEL: Record<string, string> = { jaypark: "제이파크", cubenine: "큐브나인" };

interface InvRow extends ResortInvDocRow {
  id: string; memo: string | null;
  status: string; paid_date: string | null; paid_memo: string | null;
  receipt_url: string | null;
}

function fmtMoney(n: number, cur: string) {
  return (cur === "PHP" ? "₱" : "₩") + Number(n || 0).toLocaleString();
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ResortPaymentsPage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    setAuthed(true);
  }, []);

  const [rows, setRows] = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resort, setResort] = useState<Resort>("all");
  const [status, setStatus] = useState<"all" | "unpaid" | "paid">("all");
  const [month, setMonth] = useState(""); // YYYY-MM, ""=전체
  const [viewInv, setViewInv] = useState<InvRow | null>(null);
  const [savingImg, setSavingImg] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("resort_invoices").select("*").order("period_start", { ascending: false });
    setRows((data || []) as InvRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  const filtered = useMemo(() => rows.filter(r => {
    if (resort !== "all" && r.resort !== resort) return false;
    if (status !== "all" && r.status !== status) return false;
    if (month && !(r.period_start || "").startsWith(month)) return false;
    return true;
  }), [rows, resort, status, month]);

  const sums = useMemo(() => {
    const acc: Record<string, { unpaid: number; paid: number }> = {};
    filtered.forEach(r => {
      const k = r.currency || "PHP";
      if (!acc[k]) acc[k] = { unpaid: 0, paid: 0 };
      acc[k][r.status === "paid" ? "paid" : "unpaid"] += Number(r.amount) || 0;
    });
    return acc;
  }, [filtered]);

  async function markPaid(r: InvRow) {
    const memo = prompt(`"${r.guest_name}" ${fmtMoney(r.amount, r.currency)} 결제완료 처리합니다.\n메모 (선택):`, r.paid_memo || "");
    if (memo === null) return;
    const { error } = await supabase.from("resort_invoices")
      .update({ status: "paid", paid_date: today(), paid_memo: memo.trim() || null, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) { alert("저장 실패: " + error.message); return; }
    load();
  }
  async function markUnpaid(r: InvRow) {
    if (!confirm("미결제 상태로 되돌릴까요?")) return;
    const { error } = await supabase.from("resort_invoices")
      .update({ status: "unpaid", paid_date: null, updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) { alert("저장 실패: " + error.message); return; }
    load();
  }

  // 리조트가 준 최종 컨펌넘버 입력 → 인보이스에 Confirmation No 표시 (status도 confirmed로)
  async function setConfirmNo(r: InvRow) {
    const v = prompt("리조트 컨펌넘버를 입력하세요:", r.confirm_no || "");
    if (v === null) return;
    const confirm_no = v.trim() || null;
    const { error } = await supabase.from("resort_invoices")
      .update({ confirm_no, res_status: confirm_no ? "confirmed" : "tentatively", updated_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) { alert("저장 실패: " + error.message); return; }
    if (viewInv?.id === r.id) setViewInv({ ...viewInv, confirm_no, res_status: confirm_no ? "confirmed" : "tentatively" });
    load();
  }

  async function saveImage() {
    if (!viewInv) return;
    setSavingImg(true);
    try {
      const el = document.getElementById("pay-inv-doc");
      if (!el) return;
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `invoice_${viewInv.invoice_no}${viewInv.confirm_no ? "_" + viewInv.confirm_no : ""}.png`;
      a.click();
    } finally { setSavingImg(false); }
  }

  // 결제 영수증 사진 업로드 → Supabase Storage(staff-files) → receipt_url 저장
  async function uploadReceipt(r: InvRow, file: File) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `resort-receipts/${r.invoice_no}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("staff-files").upload(path, file, { upsert: true });
    if (upErr) { alert("업로드 실패: " + upErr.message); return; }
    const { data: pub } = supabase.storage.from("staff-files").getPublicUrl(path);
    const url = pub?.publicUrl || "";
    const { error } = await supabase.from("resort_invoices").update({ receipt_url: url, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { alert("저장 실패: " + error.message); return; }
    load();
  }

  if (!authed) return null;

  const months = Array.from(new Set(rows.map(r => (r.period_start || "").slice(0, 7)).filter(Boolean))).sort().reverse();

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.rw{max-width:1200px;margin:0 auto;padding:24px 18px 60px}
.rh h1{font-size:20px;font-weight:800;margin-bottom:14px}
.fbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.chip{padding:7px 14px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;color:#475569}
.chip.ac{background:#1a6fc4;border-color:#1a6fc4;color:#fff}
.fsl{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;background:#fff}
.sumbar{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.sumcard{background:#fff;border-radius:10px;padding:12px 18px;box-shadow:0 1px 6px rgba(0,0,0,0.05);font-size:13px}
.sumcard b{display:block;font-size:16px;margin-top:2px}
.card{background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,0.05)}
.tbl{width:100%;border-collapse:collapse;font-size:12.5px}
.tbl th{background:#f8fafc;text-align:left;padding:9px 10px;font-size:11.5px;color:#475569;border-bottom:1px solid #e5e7eb}
.tbl td{padding:9px 10px;border-bottom:1px solid #f3f4f6}
.badge{display:inline-block;padding:2px 9px;border-radius:6px;font-size:11px;font-weight:800}
.abtn{padding:5px 12px;border:1px solid #e2e8f0;background:#fff;border-radius:7px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit}
.empty{text-align:center;padding:40px;color:#9ca3af;font-size:13px}
.inv-ov{position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto}
.inv-box{background:#f8fafc;border-radius:12px;padding:14px;max-width:900px;width:100%}
@media print{
  body{background:#fff!important}
  .no-print,.rw{display:none!important}
  .inv-ov{position:static!important;background:#fff!important;padding:0!important;overflow:visible!important}
  .inv-box{box-shadow:none!important;padding:0!important;max-width:none!important;border-radius:0!important}
}
    `}</style>
    <div className="rw">
      <div className="rh"><h1>💳 리조트 결제내역</h1></div>

      <div className="fbar">
        {(["all", "jaypark", "cubenine"] as Resort[]).map(r => (
          <button key={r} className={`chip${resort === r ? " ac" : ""}`} onClick={() => setResort(r)}>{r === "all" ? "전체" : RESORT_LABEL[r]}</button>
        ))}
        <span style={{ width: 10 }} />
        {(["all", "unpaid", "paid"] as const).map(s => (
          <button key={s} className={`chip${status === s ? " ac" : ""}`} onClick={() => setStatus(s)}>{s === "all" ? "전체 상태" : s === "unpaid" ? "미결제" : "결제완료"}</button>
        ))}
        <select className="fsl" value={month} onChange={e => setMonth(e.target.value)}>
          <option value="">전체 월</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#6b7280", fontWeight: 700 }}>{filtered.length}건</span>
      </div>

      <div className="sumbar">
        {Object.entries(sums).map(([cur, v]) => (
          <div key={cur} className="sumcard">
            <span style={{ color: "#92400e", fontWeight: 700 }}>미결제</span><b>{fmtMoney(v.unpaid, cur)}</b>
          </div>
        ))}
        {Object.entries(sums).map(([cur, v]) => (
          <div key={cur + "p"} className="sumcard">
            <span style={{ color: "#166534", fontWeight: 700 }}>결제완료</span><b>{fmtMoney(v.paid, cur)}</b>
          </div>
        ))}
      </div>

      <div className="card">
        {loading ? <div className="empty">불러오는 중...</div> : filtered.length === 0 ? <div className="empty">내역이 없습니다. 인보이스 생성 페이지에서 먼저 인보이스를 만들어주세요.</div> : (
          <table className="tbl"><thead><tr>
            <th>번호 (클릭=인보이스)</th><th>리조트</th><th>손님</th><th>기간</th><th>금액</th><th>컨펌넘버</th><th>상태</th><th>결제일</th><th>영수증</th><th>메모</th><th style={{ width: 110 }}></th>
          </tr></thead><tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button onClick={() => setViewInv(r)} style={{ background: "none", border: "none", padding: 0, fontWeight: 700, color: "#1a6fc4", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, textDecoration: "underline" }}>{r.invoice_no}</button>
                </td>
                <td>{RESORT_LABEL[r.resort] || r.resort}</td>
                <td style={{ fontWeight: 700 }}>{r.guest_name}</td>
                <td style={{ whiteSpace: "nowrap" }}>{r.period_start} ~ {r.period_end} ({r.nights}박)</td>
                <td style={{ fontWeight: 800 }}>{fmtMoney(r.amount, r.currency)}</td>
                <td onClick={() => setConfirmNo(r)} style={{ cursor: "pointer", whiteSpace: "nowrap" }} title="클릭해서 입력/수정">
                  {r.confirm_no
                    ? <span style={{ fontWeight: 800, color: "#b45309", background: "#fffbeb", padding: "2px 8px", borderRadius: 6 }}>{r.confirm_no}</span>
                    : <span style={{ color: "#94a3b8", fontSize: 11.5, textDecoration: "underline" }}>+ 입력</span>}
                </td>
                <td>{r.status === "paid"
                  ? <span className="badge" style={{ background: "#dcfce7", color: "#166534" }}>결제완료</span>
                  : <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>미결제</span>}</td>
                <td>{r.paid_date || "-"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {r.receipt_url && <a href={r.receipt_url} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "#16a34a", marginRight: 6 }}>📷 보기</a>}
                  <label style={{ fontSize: 11, color: "#64748b", textDecoration: "underline", cursor: "pointer" }}>
                    {r.receipt_url ? "재업로드" : "+ 업로드"}
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadReceipt(r, f); e.target.value = ""; }} />
                  </label>
                </td>
                <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.paid_memo || r.memo || ""}>{r.paid_memo || r.memo || ""}</td>
                <td style={{ textAlign: "right" }}>
                  {r.status === "paid"
                    ? <button className="abtn" onClick={() => markUnpaid(r)}>되돌리기</button>
                    : <button className="abtn" style={{ background: "#16a34a", borderColor: "#16a34a", color: "#fff" }} onClick={() => markPaid(r)}>✓ 결제완료</button>}
                </td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>
    </div>
    {viewInv && (
      <div className="inv-ov" onClick={() => setViewInv(null)}>
        <div className="inv-box" onClick={e => e.stopPropagation()}>
          <div className="no-print" style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <button className="chip" onClick={() => setConfirmNo(viewInv)}>{viewInv.confirm_no ? `컨펌넘버: ${viewInv.confirm_no} (수정)` : "🔖 컨펌넘버 입력"}</button>
            <button className="chip" disabled={savingImg} onClick={saveImage}>{savingImg ? "저장 중..." : "📷 이미지 저장"}</button>
            <button className="chip" onClick={() => window.print()}>🖨️ 인쇄</button>
            <button className="chip" onClick={() => setViewInv(null)}>닫기</button>
          </div>
          <ResortInvoiceDoc inv={viewInv} domId="pay-inv-doc" />
        </div>
      </div>
    )}
  </>);
}
