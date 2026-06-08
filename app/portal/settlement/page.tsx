"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Item { id: string; kind: string; label: string; amount: number; item_date: string | null; status: string; }

type Kind = "deposit" | "charge" | "deduct" | "payment";
const KIND_META: Record<Kind, { label: string; bg: string; c: string }> = {
  deposit: { label: "보증금", bg: "#ecfdf5", c: "#047857" },
  charge: { label: "청구", bg: "#eff6ff", c: "#1d4ed8" },
  deduct: { label: "차감", bg: "#fef2f2", c: "#dc2626" },
  payment: { label: "납부", bg: "#f5f3ff", c: "#6d28d9" },
};
const won = (n: number) => "₱" + (n || 0).toLocaleString("en-US");

export default function PortalSettlementPage() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (bid: string) => {
    setLoading(true);
    const { data } = await supabase.from("settlement_items").select("id, kind, label, amount, item_date, status")
      .eq("booking_id", bid).eq("status", "approved").order("item_date", { ascending: true });
    setItems((data || []) as Item[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem("portalSession");
        if (raw) {
          const session = JSON.parse(raw);
          if (session.booking_id && Date.now() < session.expires) {
            setBookingId(session.booking_id); load(session.booking_id); return;
          }
          localStorage.removeItem("portalSession");
        }
      } catch {}
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const bid = data.session.user.user_metadata?.booking_id || data.session.user.id;
        setBookingId(bid); load(bid); return;
      }
      router.replace("/portal");
    }
    init();
  }, [router, load]);

  const sum = useMemo(() => {
    const s = { deposit: 0, charge: 0, deduct: 0, payment: 0 };
    for (const it of items) s[it.kind as Kind] = (s[it.kind as Kind] || 0) + Number(it.amount || 0);
    return s;
  }, [items]);
  const dueBalance = sum.charge - sum.payment;
  const depositBalance = sum.deposit - sum.deduct;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 18px 60px", fontFamily: "'Noto Sans KR',sans-serif", color: "#1a1a2e" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <button onClick={() => router.push("/portal/dashboard")} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontWeight: 600 }}>← 마이페이지</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>🧾 정산내역</h1>
      </div>
      <p style={{ fontSize: 13, color: "#6b7c93", marginBottom: 18 }}>보증금·튜터비·추가비용·납부 내역을 확인하실 수 있습니다.</p>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12, padding: 44, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>아직 등록된 정산내역이 없습니다.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 12, color: "#6b7c93", marginBottom: 8, fontWeight: 700 }}>💰 수업·추가비용</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span>청구</span><b>{won(sum.charge)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#6d28d9" }}><span>납부</span><b>− {won(sum.payment)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, borderTop: "1px solid #f1f5f9", paddingTop: 7, color: dueBalance > 0 ? "#dc2626" : "#16a34a" }}><span>{dueBalance > 0 ? "미납 잔액" : "완납"}</span><span>{won(Math.max(0, dueBalance))}</span></div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontSize: 12, color: "#6b7c93", marginBottom: 8, fontWeight: 700 }}>🏠 보증금</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span>받은 보증금</span><b>{won(sum.deposit)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, color: "#dc2626" }}><span>차감</span><b>− {won(sum.deduct)}</b></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 800, borderTop: "1px solid #f1f5f9", paddingTop: 7, color: "#047857" }}><span>잔여 보증금</span><span>{won(depositBalance)}</span></div>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", fontWeight: 800, fontSize: 14 }}>📋 상세 내역</div>
            {items.map(it => {
              const km = KIND_META[it.kind as Kind] || { label: it.kind, bg: "#f1f5f9", c: "#475569" };
              return (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: "1px solid #f8fafc" }}>
                  <span style={{ fontSize: 11.5, color: "#94a3b8", width: 66, flexShrink: 0 }}>{it.item_date || "-"}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: km.bg, color: km.c, flexShrink: 0 }}>{km.label}</span>
                  <span style={{ flex: 1, fontSize: 13, minWidth: 0 }}>{it.label}</span>
                  <b style={{ fontSize: 13, flexShrink: 0, color: (it.kind === "deduct" || it.kind === "payment") ? "#6d28d9" : "#1a1a2e" }}>{(it.kind === "deduct" || it.kind === "payment") ? "− " : ""}{won(Number(it.amount))}</b>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 12, lineHeight: 1.6 }}>※ 보증금은 체크아웃 시 차감 항목을 제외하고 환급됩니다. 문의사항은 담당 매니저에게 연락 주세요.</p>
        </>
      )}
    </div>
  );
}
