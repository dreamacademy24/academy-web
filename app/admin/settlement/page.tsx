"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";
import { toastOk, toastErr } from "@/lib/toast";

interface Booking { id: string; booker_name: string | null; reservation_no: string | null; checkin_date: string | null; checkout_date: string | null; house_no: string | null; }
interface Item { id: string; booking_id: string; kind: string; label: string; amount: number; item_date: string | null; status: string; recorded_by: string | null; approved_by: string | null; created_at: string; }

type Kind = "deposit" | "charge" | "deduct" | "payment";
const KIND_META: Record<Kind, { label: string; bg: string; c: string }> = {
  deposit: { label: "보증금", bg: "#ecfdf5", c: "#047857" },
  charge: { label: "청구", bg: "#eff6ff", c: "#1d4ed8" },
  deduct: { label: "차감", bg: "#fef2f2", c: "#dc2626" },
  payment: { label: "납부", bg: "#f5f3ff", c: "#6d28d9" },
};
const won = (n: number) => "₱" + (n || 0).toLocaleString("en-US");

export default function SettlementPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<Booking | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  // 입력 폼
  const [fKind, setFKind] = useState<Kind>("charge");
  const [fLabel, setFLabel] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fDate, setFDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!isAdminAuthed()) { router.replace("/login"); return; } setAuthed(true); }, [router]);

  const loadBookings = useCallback(async () => {
    const { data } = await supabase.from("bookings").select("id, booker_name, reservation_no, checkin_date, checkout_date, house_no").order("checkin_date", { ascending: false });
    const today = new Date().toISOString().slice(0, 10);
    const rank = (b: Booking) => {
      const ci = b.checkin_date || "", co = b.checkout_date || "";
      if (ci && ci <= today && (!co || co >= today)) return 0; // 투숙중
      if (ci && ci > today) return 1;                          // 예정
      return 2;                                                 // 지난
    };
    const sorted = ((data || []) as Booking[]).sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 1) return (a.checkin_date || "").localeCompare(b.checkin_date || ""); // 예정: 가까운 순
      return (b.checkin_date || "").localeCompare(a.checkin_date || "");               // 투숙중/지난: 최근 순
    });
    setBookings(sorted);
  }, []);
  useEffect(() => { if (authed) loadBookings(); }, [authed, loadBookings]);

  // 전체 승인 대기(튜터 납부) — 예약 선택과 무관하게 표시
  const [globalPending, setGlobalPending] = useState<Item[]>([]);
  const loadGlobalPending = useCallback(async () => {
    const { data } = await supabase.from("settlement_items").select("*").eq("status", "pending").order("item_date", { ascending: true });
    setGlobalPending((data || []) as Item[]);
  }, []);
  useEffect(() => { if (authed) loadGlobalPending(); }, [authed, loadGlobalPending]);

  const loadItems = useCallback(async (bid: string) => {
    setLoading(true);
    const { data } = await supabase.from("settlement_items").select("*").eq("booking_id", bid).order("item_date", { ascending: true });
    setItems((data || []) as Item[]);
    setLoading(false);
  }, []);
  useEffect(() => { if (sel?.id) loadItems(sel.id); else setItems([]); }, [sel?.id, loadItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings.slice(0, 40);
    return bookings.filter(b => `${b.booker_name || ""} ${b.reservation_no || ""} ${b.house_no || ""}`.toLowerCase().includes(q)).slice(0, 40);
  }, [bookings, search]);

  const sum = useMemo(() => {
    const s = { deposit: 0, charge: 0, deduct: 0, payment: 0 };
    for (const it of items) if (it.status === "approved") s[it.kind as Kind] = (s[it.kind as Kind] || 0) + Number(it.amount || 0);
    return s;
  }, [items]);
  const dueBalance = sum.charge - sum.payment;       // 받을 잔액
  const depositBalance = sum.deposit - sum.deduct;   // 보증금 잔액

  async function addItem() {
    if (!sel) return;
    const amt = Number(fAmount);
    if (!fLabel.trim()) { toastErr("내용을 입력하세요"); return; }
    if (!amt || amt <= 0) { toastErr("금액을 입력하세요"); return; }
    setSaving(true);
    const { error } = await supabase.from("settlement_items").insert({
      booking_id: sel.id, kind: fKind, label: fLabel.trim(), amount: amt, item_date: fDate,
      status: "approved", recorded_by: "직원",
    });
    setSaving(false);
    if (error) { toastErr("저장 실패: " + error.message); return; }
    setFLabel(""); setFAmount("");
    toastOk("추가됐어요");
    loadItems(sel.id);
  }
  async function approveItem(id: string) {
    const { error } = await supabase.from("settlement_items").update({ status: "approved", approved_by: "직원" }).eq("id", id);
    if (error) { toastErr("승인 실패: " + error.message); return; }
    toastOk("승인(배포)됐어요");
    if (sel) loadItems(sel.id);
    loadGlobalPending();
  }
  async function rejectItem(id: string) {
    if (!confirm("이 납부 기록을 삭제할까요? (튜터가 잘못 기록한 경우)")) return;
    const { error } = await supabase.from("settlement_items").delete().eq("id", id);
    if (error) { toastErr("삭제 실패: " + error.message); return; }
    if (sel) loadItems(sel.id);
    loadGlobalPending();
  }
  async function delItem(id: string) {
    if (!confirm("이 항목을 삭제할까요?")) return;
    const { error } = await supabase.from("settlement_items").delete().eq("id", id);
    if (error) { toastErr("삭제 실패: " + error.message); return; }
    if (sel) loadItems(sel.id);
  }

  if (!authed) return null;
  const pending = items.filter(i => i.status === "pending");

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px 60px", fontFamily: "'Noto Sans KR',sans-serif", color: "#1a1a2e" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <button onClick={() => router.push("/admin/hub")} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontWeight: 600 }}>← 관리자 홈</button>
        <h1 style={{ fontSize: 22, fontWeight: 800, flex: 1 }}>🧾 정산 관리</h1>
      </div>
      <p style={{ fontSize: 13, color: "#6b7c93", marginBottom: 18 }}>예약을 선택해 보증금·튜터비·추가비용·납부를 기록하고, 튜터 납부 기록을 승인(배포)합니다.</p>

      {globalPending.length > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#b45309", marginBottom: 10 }}>⏳ 튜터 납부 승인 대기 — 전체 {globalPending.length}건</div>
          {globalPending.map(it => {
            const bk = bookings.find(b => b.id === it.booking_id);
            return (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #fef3c7" }}>
                <span style={{ fontSize: 12, color: "#94a3b8", width: 70, flexShrink: 0 }}>{it.item_date}</span>
                <button onClick={() => { if (bk) { setSel(bk); window.scrollTo({ top: 0 }); } }} style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8", background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, width: 110, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bk?.booker_name || "(미매칭)"}</button>
                <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label} <span style={{ color: "#94a3b8", fontSize: 11 }}>· {it.recorded_by}</span></span>
                <b style={{ fontSize: 13, flexShrink: 0 }}>{won(Number(it.amount))}</b>
                <button onClick={() => approveItem(it.id)} style={{ border: "none", background: "#16a34a", color: "#fff", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>승인</button>
                <button onClick={() => rejectItem(it.id)} style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 16, flexShrink: 0 }}>×</button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 18, alignItems: "start" }}>
        {/* 예약 선택 */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="예약자·예약번호·방번호 검색" style={{ width: "100%", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            {filtered.map(b => {
              const today = new Date().toISOString().slice(0, 10);
              const staying = !!(b.checkin_date && b.checkin_date <= today && (!b.checkout_date || b.checkout_date >= today));
              return (
              <div key={b.id} onClick={() => setSel(b)} style={{ padding: "10px 13px", cursor: "pointer", borderBottom: "1px solid #f8fafc", background: sel?.id === b.id ? "#eff6ff" : "#fff" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  {b.booker_name || "(이름없음)"}
                  {staying && <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: "#dcfce7", color: "#15803d" }}>투숙중</span>}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{b.house_no || ""} {b.checkin_date ? `· ${b.checkin_date}` : ""}</div>
              </div>
              );
            })}
            {filtered.length === 0 && <div style={{ padding: 16, color: "#cbd5e1", fontSize: 13 }}>예약이 없습니다</div>}
          </div>
        </div>

        {/* 정산 내역 */}
        <div>
          {!sel ? (
            <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12, padding: 50, textAlign: "center", color: "#94a3b8" }}>왼쪽에서 예약을 선택하세요</div>
          ) : (
            <>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>{sel.booker_name} <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{sel.house_no || ""}</span></div>

              {/* 요약 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 }}>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "#6b7c93", marginBottom: 8, fontWeight: 700 }}>💰 수업·추가비용</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span>청구</span><b>{won(sum.charge)}</b></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#6d28d9" }}><span>납부</span><b>− {won(sum.payment)}</b></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, borderTop: "1px solid #f1f5f9", paddingTop: 6, color: dueBalance > 0 ? "#dc2626" : "#16a34a" }}><span>받을 잔액</span><span>{won(dueBalance)}</span></div>
                </div>
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, color: "#6b7c93", marginBottom: 8, fontWeight: 700 }}>🏠 보증금</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span>받은 보증금</span><b>{won(sum.deposit)}</b></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#dc2626" }}><span>차감</span><b>− {won(sum.deduct)}</b></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, borderTop: "1px solid #f1f5f9", paddingTop: 6, color: "#047857" }}><span>보증금 잔액</span><span>{won(depositBalance)}</span></div>
                </div>
              </div>

              {/* 승인 대기 (튜터 기록) */}
              {pending.length > 0 && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#b45309", marginBottom: 8 }}>⏳ 승인 대기 (튜터 기록 {pending.length}건)</div>
                  {pending.map(it => (
                    <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                      <span style={{ fontSize: 12, color: "#94a3b8", width: 64 }}>{it.item_date}</span>
                      <span style={{ flex: 1, fontSize: 13 }}>{it.label}</span>
                      <b style={{ fontSize: 13 }}>{won(Number(it.amount))}</b>
                      <button onClick={() => approveItem(it.id)} style={{ border: "none", background: "#16a34a", color: "#fff", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>승인(배포)</button>
                    </div>
                  ))}
                </div>
              )}

              {/* 항목 추가 */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>➕ 항목 추가</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={fKind} onChange={e => setFKind(e.target.value as Kind)} style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, fontFamily: "inherit" }}>
                    <option value="charge">청구 (튜터비·추가)</option>
                    <option value="deposit">보증금</option>
                    <option value="deduct">차감 (물품·커피·픽드랍)</option>
                    <option value="payment">납부</option>
                  </select>
                  <input value={fLabel} onChange={e => setFLabel(e.target.value)} placeholder="내용 (예: 튜터비 6월 / 물 구매)" style={{ flex: 1, minWidth: 140, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, fontFamily: "inherit" }} />
                  <input value={fAmount} onChange={e => setFAmount(e.target.value)} type="number" placeholder="금액 ₱" style={{ width: 110, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, fontFamily: "inherit" }} />
                  <input value={fDate} onChange={e => setFDate(e.target.value)} type="date" style={{ padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13, fontFamily: "inherit" }} />
                  <button onClick={addItem} disabled={saving} style={{ border: "none", background: "#2563eb", color: "#fff", borderRadius: 7, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>{saving ? "저장 중…" : "추가"}</button>
                </div>
              </div>

              {/* 전체 내역 */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "11px 16px", borderBottom: "1px solid #f1f5f9", fontWeight: 800, fontSize: 14 }}>📋 전체 내역</div>
                {loading ? <div style={{ padding: 20, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>불러오는 중…</div>
                  : items.length === 0 ? <div style={{ padding: 24, color: "#cbd5e1", fontSize: 13, textAlign: "center" }}>내역이 없습니다</div>
                  : items.map(it => {
                    const km = KIND_META[it.kind as Kind] || { label: it.kind, bg: "#f1f5f9", c: "#475569" };
                    return (
                      <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: "1px solid #f8fafc" }}>
                        <span style={{ fontSize: 11.5, color: "#94a3b8", width: 64, flexShrink: 0 }}>{it.item_date || "-"}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: km.bg, color: km.c, flexShrink: 0 }}>{km.label}</span>
                        <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}{it.status === "pending" && <span style={{ marginLeft: 6, fontSize: 11, color: "#b45309" }}>· 승인대기</span>}</span>
                        <b style={{ fontSize: 13, flexShrink: 0 }}>{won(Number(it.amount))}</b>
                        <button onClick={() => delItem(it.id)} style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 15, flexShrink: 0 }}>×</button>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
