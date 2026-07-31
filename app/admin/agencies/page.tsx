"use client";
/* 유학원 관리 — 목록 / 판매 내역 / 지급 내역 (2026-07-20) */
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";
import { matchAgency } from "@/lib/agencies";

interface Agency { id: string; name: string; short_label: string | null; contact: string | null; commission_rate: number | null; memo: string | null; }
interface Payout { id: string; agency_id: string; payout_date: string | null; amount: number | null; memo: string | null; booking_ids: string[] | null; }
interface Bk { id: string; booker_name: string; checkin_date: string | null; checkout_date: string | null; accom_type: string | null; agency: string | null; final_price: number | null; base_price: number | null; agency_commission_rate: number | null; status: string | null; }

const fmtWon = (n: number) => n >= 10000 ? `${Math.round(n / 10000).toLocaleString()}만` : n.toLocaleString();

export default function AgenciesPage() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"list" | "sales" | "payouts">("list");
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [bookings, setBookings] = useState<Bk[]>([]);
  const [selId, setSelId] = useState<string>("");
  const [editAg, setEditAg] = useState<Partial<Agency> | null>(null);
  const [payForm, setPayForm] = useState<{ date: string; amount: string; memo: string; picks: Set<string> } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!isAdminAuthed()) { window.location.href = "/login"; return; } setReady(true); }, []);

  const load = useCallback(async () => {
    const [a, p, b] = await Promise.all([
      supabase.from("agencies").select("*").order("name"),
      supabase.from("agency_payouts").select("*").order("payout_date", { ascending: false }),
      supabase.from("bookings").select("id,booker_name,checkin_date,checkout_date,accom_type,agency,final_price,base_price,agency_commission_rate,status").not("agency", "is", null).neq("agency", "").order("checkin_date", { ascending: false }),
    ]);
    setAgencies((a.data || []) as Agency[]);
    setPayouts((p.data || []) as Payout[]);
    // 정산 대상 = 영수증 발행(예약 확정) + 금액(final_price) 기록된 예약만 (2026-07-31 메이 지시)
    setBookings(((b.data || []) as Bk[]).filter(x => !String(x.status || "").includes("취소") && String(x.agency || "").trim() !== "개인" && /영수증발행|결제완료|완료/.test(String(x.status || "")) && Number((x as unknown as Record<string, unknown>).final_price) > 0));
  }, []);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const sel = useMemo(() => agencies.find(a => a.id === selId) || agencies[0] || null, [agencies, selId]);
  const agBookings = useCallback((ag: Agency) => bookings.filter(b => matchAgency(b.agency, ag.name)), [bookings]);
  const paidSet = useMemo(() => {
    const s = new Set<string>();
    payouts.forEach(p => (p.booking_ids || []).forEach(id => s.add(id)));
    return s;
  }, [payouts]);
  const price = (b: Bk) => Number(b.final_price || b.base_price || 0);
  const rateOf = (b: Bk, ag: Agency) => b.agency_commission_rate ?? ag.commission_rate ?? 0;
  const commOf = (b: Bk, ag: Agency) => Math.round(price(b) * Number(rateOf(b, ag)) / 100);

  async function saveAgency() {
    if (!editAg || !editAg.name?.trim()) { alert("유학원명을 입력하세요"); return; }
    setSaving(true);
    const row = { name: editAg.name.trim(), short_label: editAg.short_label || null, contact: editAg.contact || null, commission_rate: editAg.commission_rate === undefined || editAg.commission_rate === null || String(editAg.commission_rate) === "" ? null : Number(editAg.commission_rate), memo: editAg.memo || null };
    const q = editAg.id ? supabase.from("agencies").update(row).eq("id", editAg.id) : supabase.from("agencies").insert(row);
    const { error } = await q;
    setSaving(false);
    if (error) { alert("저장 실패: " + error.message); return; }
    setEditAg(null); load();
  }
  async function saveRate(b: Bk, v: string) {
    const rate = v === "" ? null : Number(v);
    const { error } = await supabase.from("bookings").update({ agency_commission_rate: rate }).eq("id", b.id);
    if (error) { alert("저장 실패: " + error.message); return; }
    setBookings(prev => prev.map(x => x.id === b.id ? { ...x, agency_commission_rate: rate } : x));
  }
  async function savePayout() {
    if (!sel || !payForm) return;
    if (!payForm.amount || Number(payForm.amount) <= 0) { alert("지급 금액을 입력하세요"); return; }
    setSaving(true);
    const { error } = await supabase.from("agency_payouts").insert({
      agency_id: sel.id, payout_date: payForm.date || null, amount: Number(payForm.amount),
      memo: payForm.memo || null, booking_ids: [...payForm.picks],
    });
    setSaving(false);
    if (error) { alert("저장 실패: " + error.message); return; }
    setPayForm(null); load();
  }
  async function delPayout(p: Payout) {
    if (!confirm("이 지급 기록을 삭제할까요? 연결된 예약들은 미지급으로 돌아갑니다.")) return;
    const { error } = await supabase.from("agency_payouts").delete().eq("id", p.id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    load();
  }

  if (!ready) return null;
  const T = { border: "1px solid #e2e8f0", pad: "9px 12px" };
  return (<div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 80px", fontFamily: "'Noto Sans KR',sans-serif", color: "#1a1a2e" }}>
    <style>{`
      .ag-tab{padding:9px 18px;border-radius:10px;border:1.5px solid #d8dee9;background:#fff;font-size:13.5px;font-weight:800;color:#475569;cursor:pointer;font-family:inherit}
      .ag-tab.on{background:#1a6fc4;border-color:#1a6fc4;color:#fff}
      .ag-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px 18px}
      .ag-btn{padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
      .ag-inp{padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none}
      table.ag-t{width:100%;border-collapse:collapse;font-size:12.5px}
      .ag-t th{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:8px 10px;font-size:11.5px;color:#64748b;text-align:left}
      .ag-t td{border-bottom:1px solid #f1f5f9;padding:8px 10px}
    `}</style>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <button onClick={() => history.back()} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer" }}>←</button>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>🏢 유학원 관리</h1>
    </div>

    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
      <button className={`ag-tab${tab === "list" ? " on" : ""}`} onClick={() => setTab("list")}>🏢 유학원 목록</button>
      <button className={`ag-tab${tab === "sales" ? " on" : ""}`} onClick={() => setTab("sales")}>📋 판매 내역</button>
      <button className={`ag-tab${tab === "payouts" ? " on" : ""}`} onClick={() => setTab("payouts")}>💸 지급 내역</button>
      {tab !== "list" && agencies.length > 0 && (
        <select className="ag-inp" value={sel?.id || ""} onChange={e => setSelId(e.target.value)} style={{ marginLeft: "auto", minWidth: 160 }}>
          {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
    </div>

    {tab === "list" && (<>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 12, marginBottom: 14 }}>
        {agencies.map(a => {
          const bs = agBookings(a);
          const rev = bs.reduce((s, b) => s + price(b), 0);
          const unpaid = bs.filter(b => !paidSet.has(b.id)).reduce((s, b) => s + commOf(b, a), 0);
          return (
            <div key={a.id} className="ag-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ fontSize: 15 }}>{a.name} {a.short_label && <span style={{ fontSize: 11, background: "#eef2ff", color: "#4338ca", borderRadius: 6, padding: "1px 7px", fontWeight: 800, marginLeft: 4 }}>{a.short_label}</span>}</b>
                <span style={{ fontSize: 12, color: "#1a6fc4", fontWeight: 800 }}>{a.commission_rate != null ? `기본 수수료 ${a.commission_rate}%` : "수수료율 미설정"}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>{a.contact || "연락처 미입력"}{a.memo ? ` · ${a.memo}` : ""}</div>
              <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12.5 }}>
                <span>판매 <b>{bs.length}건</b></span>
                <span>매출 <b>{fmtWon(rev)}</b></span>
                <span style={{ color: unpaid > 0 ? "#dc2626" : "#166534", fontWeight: 700 }}>{unpaid > 0 ? `미지급 ${fmtWon(unpaid)}` : "완납 ✓"}</span>
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                <button className="ag-btn" style={{ background: "#eff6ff", color: "#1a6fc4" }} onClick={() => setEditAg(a)}>✏️ 수정</button>
                <button className="ag-btn" style={{ background: "#f8fafc", color: "#475569" }} onClick={() => { setSelId(a.id); setTab("sales"); }}>판매 내역 →</button>
              </div>
            </div>
          );
        })}
      </div>
      <button className="ag-btn" style={{ background: "#1a6fc4", color: "#fff" }} onClick={() => setEditAg({})}>+ 유학원 추가</button>

      {editAg && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setEditAg(null)}>
          <div className="ag-card" style={{ maxWidth: 420, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>{editAg.id ? "유학원 수정" : "유학원 추가"}</div>
            {[["name", "유학원명 *", "이젠유학"], ["short_label", "짧은 표기(뱃지)", "이젠"], ["contact", "연락처/담당", "김OO 010-0000-0000"], ["commission_rate", "기본 수수료율 (%)", "10"], ["memo", "메모", ""]].map(([k, label, ph]) => (
              <div key={k} style={{ marginBottom: 9 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 3 }}>{label}</label>
                <input className="ag-inp" style={{ width: "100%" }} placeholder={ph}
                  value={(editAg as any)[k] ?? ""} onChange={e => setEditAg({ ...editAg, [k]: e.target.value })} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button className="ag-btn" style={{ background: "#f1f5f9", color: "#475569" }} onClick={() => setEditAg(null)}>취소</button>
              <button className="ag-btn" style={{ background: "#1a6fc4", color: "#fff" }} onClick={saveAgency} disabled={saving}>{saving ? "저장 중..." : "저장"}</button>
            </div>
          </div>
        </div>
      )}
    </>)}

    {tab === "sales" && sel && (() => {
      const bs = agBookings(sel);
      const totalComm = bs.reduce((s, b) => s + commOf(b, sel), 0);
      const unpaidComm = bs.filter(b => !paidSet.has(b.id)).reduce((s, b) => s + commOf(b, sel), 0);
      return (
        <div className="ag-card">
          <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 13, flexWrap: "wrap" }}>
            <span>판매 <b>{bs.length}건</b></span>
            <span>매출 합계 <b>{fmtWon(bs.reduce((s, b) => s + price(b), 0))}원</b></span>
            <span>수수료 합계 <b>{fmtWon(totalComm)}원</b></span>
            <span style={{ color: unpaidComm > 0 ? "#dc2626" : "#166534", fontWeight: 700 }}>미지급 {fmtWon(unpaidComm)}원</span>
          </div>
          <table className="ag-t">
            <thead><tr><th>체크인</th><th>예약자</th><th>숙소</th><th style={{ textAlign: "right" }}>판매가</th><th style={{ textAlign: "center" }}>수수료율%</th><th style={{ textAlign: "right" }}>수수료</th><th style={{ textAlign: "center" }}>지급</th></tr></thead>
            <tbody>
              {bs.map(b => (
                <tr key={b.id}>
                  <td>{(b.checkin_date || "").slice(2, 10)}</td>
                  <td style={{ fontWeight: 700 }}>{b.booker_name}</td>
                  <td style={{ color: "#94a3b8", fontSize: 11.5 }}>{b.accom_type || "-"}</td>
                  <td style={{ textAlign: "right" }}>{price(b) ? fmtWon(price(b)) : "-"}</td>
                  <td style={{ textAlign: "center" }}>
                    <input className="ag-inp" style={{ width: 54, padding: "4px 6px", textAlign: "right", fontSize: 12 }}
                      defaultValue={b.agency_commission_rate ?? ""} placeholder={String(sel.commission_rate ?? "")}
                      onBlur={e => { if (e.target.value !== String(b.agency_commission_rate ?? "")) saveRate(b, e.target.value); }} />
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{commOf(b, sel) ? fmtWon(commOf(b, sel)) : "-"}</td>
                  <td style={{ textAlign: "center" }}>
                    {paidSet.has(b.id)
                      ? <span style={{ background: "#dcfce7", color: "#166534", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8 }}>지급완료</span>
                      : <span style={{ background: "#fef2f2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8 }}>미지급</span>}
                  </td>
                </tr>
              ))}
              {bs.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>이 유학원으로 등록된 예약이 없습니다 (예약의 유학원 칸 기준)</td></tr>}
            </tbody>
          </table>
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 8 }}>수수료율 빈칸 = 유학원 기본값({sel.commission_rate ?? 0}%) 적용 · 칸에 입력하면 그 예약만 다른 요율로 계산</div>
        </div>
      );
    })()}

    {tab === "payouts" && sel && (() => {
      const bs = agBookings(sel);
      const unpaidBs = bs.filter(b => !paidSet.has(b.id));
      const myPayouts = payouts.filter(p => p.agency_id === sel.id);
      return (
        <div className="ag-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <b style={{ fontSize: 14 }}>{sel.name} 지급 내역</b>
            <button className="ag-btn" style={{ background: "#1a6fc4", color: "#fff" }}
              onClick={() => setPayForm({ date: new Date().toISOString().slice(0, 10), amount: "", memo: "", picks: new Set() })}>+ 지급 기록</button>
          </div>
          {myPayouts.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 13, padding: "16px 0" }}>지급 기록이 없습니다</div> : (
            <table className="ag-t">
              <thead><tr><th>지급일</th><th style={{ textAlign: "right" }}>금액</th><th>메모</th><th style={{ textAlign: "center" }}>해당 예약</th><th></th></tr></thead>
              <tbody>{myPayouts.map(p => (
                <tr key={p.id}>
                  <td>{p.payout_date || "-"}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtWon(Number(p.amount || 0))}원</td>
                  <td style={{ color: "#64748b" }}>{p.memo || "-"}</td>
                  <td style={{ textAlign: "center" }}>{(p.booking_ids || []).length}건</td>
                  <td style={{ textAlign: "right" }}><button className="ag-btn" style={{ background: "#fef2f2", color: "#dc2626", padding: "4px 10px", fontSize: 11.5 }} onClick={() => delPayout(p)}>삭제</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}

          {payForm && (
            <div style={{ border: "1.5px solid #bfdbfe", background: "#f8fbff", borderRadius: 10, padding: 14, marginTop: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 10 }}>💸 지급 기록 추가</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <input className="ag-inp" type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} />
                <input className="ag-inp" type="number" placeholder="금액 (원)" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} style={{ width: 140 }} />
                <input className="ag-inp" placeholder="메모 (예: 5~6월분)" value={payForm.memo} onChange={e => setPayForm({ ...payForm, memo: e.target.value })} style={{ flex: 1, minWidth: 140 }} />
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", marginBottom: 6 }}>이번 지급에 포함되는 예약 선택 (미지급 {unpaidBs.length}건)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
                {unpaidBs.map(b => (
                  <label key={b.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
                    <input type="checkbox" checked={payForm.picks.has(b.id)}
                      onChange={e => { const s = new Set(payForm.picks); if (e.target.checked) s.add(b.id); else s.delete(b.id); setPayForm({ ...payForm, picks: s }); }} />
                    <span>{(b.checkin_date || "").slice(2, 10)} · <b>{b.booker_name}</b> · 수수료 {fmtWon(commOf(b, sel))}원</span>
                  </label>
                ))}
                {unpaidBs.length === 0 && <span style={{ color: "#94a3b8", fontSize: 12 }}>미지급 예약이 없습니다</span>}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <button className="ag-btn" style={{ background: "#eef2ff", color: "#4338ca", fontSize: 12 }}
                  onClick={() => setPayForm({ ...payForm, picks: new Set(unpaidBs.map(b => b.id)), amount: String(unpaidBs.reduce((s, b) => s + commOf(b, sel), 0)) })}>전체 선택 + 금액 자동</button>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button className="ag-btn" style={{ background: "#f1f5f9", color: "#475569" }} onClick={() => setPayForm(null)}>취소</button>
                  <button className="ag-btn" style={{ background: "#1a6fc4", color: "#fff" }} onClick={savePayout} disabled={saving}>{saving ? "저장 중..." : "저장"}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    })()}
  </div>);
}
