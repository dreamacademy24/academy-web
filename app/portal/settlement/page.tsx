"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Item { id: string; section: string; kind: string; label: string; amount: number; item_date: string | null; note: string | null; }
const peso = (n: number) => "₱" + (n || 0).toLocaleString("en-US");

export default function PortalSettlementPage() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [finalClosed, setFinalClosed] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null); // 데모 공개 여부 (null=확인중)
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (bid: string) => {
    setLoading(true);
    const { data: bk } = await supabase.from("bookings").select("settlement_open").eq("id", bid).maybeSingle();
    const isOpen = !!bk?.settlement_open;
    setOpen(isOpen);
    if (!isOpen) { setLoading(false); return; }
    const { data } = await supabase.from("settlement_items").select("id, section, kind, label, amount, item_date, note")
      .eq("booking_id", bid).eq("status", "approved").order("item_date", { ascending: true });
    setItems((data || []) as Item[]);
    const { data: st } = await supabase.from("settlement_status").select("final_closed").eq("booking_id", bid).maybeSingle();
    setFinalClosed(!!st?.final_closed);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem("portalSession");
        if (raw) {
          const session = JSON.parse(raw);
          if (session.booking_id && Date.now() < session.expires) { setBookingId(session.booking_id); load(session.booking_id); return; }
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

  const sectionOf = (i: Item) => i.section || (["deposit", "deduct", "refund"].includes(i.kind) ? "deposit" : "class");
  const depositItems = items.filter(i => sectionOf(i) === "deposit");
  const classItems = items.filter(i => sectionOf(i) === "class");
  const sumOf = (arr: Item[], kind: string) => arr.filter(i => i.kind === kind).reduce((a, i) => a + Number(i.amount || 0), 0);
  const depRecv = sumOf(depositItems, "deposit");
  const depDeduct = sumOf(depositItems, "deduct");
  const depRefund = sumOf(depositItems, "refund");
  const depositRefund = depRecv - depDeduct + depRefund;
  const classCharge = classItems.filter(i => i.kind !== "payment").reduce((a, i) => a + Number(i.amount || 0), 0);
  const classPaid = classItems.filter(i => i.kind === "payment").reduce((a, i) => a + Number(i.amount || 0), 0);
  const classDue = classCharge - classPaid;
  const finalNet = depositRefund - classDue;

  const KIND_TAG: Record<string, { lbl: string; bg: string; c: string; sign: string }> = {
    deposit: { lbl: "보증금", bg: "#dcfce7", c: "#166534", sign: "+" },
    deduct: { lbl: "차감", bg: "#fef2f2", c: "#dc2626", sign: "−" },
    refund: { lbl: "환불", bg: "#dcfce7", c: "#166534", sign: "+" },
    charge: { lbl: "청구", bg: "#eff6ff", c: "#1d4ed8", sign: "+" },
    payment: { lbl: "납부", bg: "#f5f3ff", c: "#6d28d9", sign: "−" },
  };
  const Row = (it: Item) => {
    const tg = KIND_TAG[it.kind] || { lbl: it.kind, bg: "#f1f5f9", c: "#475569", sign: "" };
    return (
      <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 16px", borderBottom: "1px solid #f8fafc" }}>
        <span style={{ fontSize: 11.5, color: "#94a3b8", width: 52, flexShrink: 0 }}>{it.item_date || "-"}</span>
        <span style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: tg.bg, color: tg.c, flexShrink: 0 }}>{tg.lbl}</span>
        <span style={{ flex: 1, fontSize: 13, minWidth: 0 }}>{it.label}{it.note && <span style={{ color: "#94a3b8", fontSize: 11 }}> · {it.note}</span>}</span>
        <b style={{ fontSize: 13, flexShrink: 0, color: tg.c }}>{tg.sign}{peso(Number(it.amount))}</b>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 18px 60px", fontFamily: "'Noto Sans KR',sans-serif", color: "#1a1a2e" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <button onClick={() => router.push("/portal/dashboard")} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontWeight: 600 }}>← 마이페이지</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>🧾 정산내역 {open && <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", padding: "2px 8px", borderRadius: 8, verticalAlign: "middle" }}>베타</span>}</h1>
      </div>
      <p style={{ fontSize: 13, color: "#6b7c93", marginBottom: 16 }}>현지에서 지불하시는 금액(보증금·수업·교재비 등) 내역입니다.</p>

      {open === false ? (
        <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12, padding: 44, textAlign: "center", color: "#94a3b8", fontSize: 14, lineHeight: 1.6 }}>정산내역 기능은 현재 준비 중입니다.<br />오픈되면 안내드리겠습니다 🙏</div>
      ) : (<>

      {finalClosed && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#047857" }}>✅ 정산이 완료되었습니다</div>
          <div style={{ fontSize: 12.5, color: "#15803d", marginTop: 3 }}>아래 최종 금액을 확인해 주세요. 문의사항은 담당 매니저에게 연락 주세요.</div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12, padding: 44, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>아직 등록된 정산내역이 없습니다.</div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
            <div style={{ padding: "11px 16px", borderBottom: "1px solid #f1f5f9", fontWeight: 800, fontSize: 13.5, color: "#047857" }}>🏠 보증금 정산 <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 600 }}>받은 보증금 {peso(depRecv)}</span></div>
            {depositItems.length ? depositItems.map(Row) : <div style={{ padding: 16, color: "#cbd5e1", fontSize: 12.5, textAlign: "center" }}>내역 없음</div>}
          </div>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "11px 16px", borderBottom: "1px solid #f1f5f9", fontWeight: 800, fontSize: 13.5, color: "#1d4ed8" }}>💰 수업 · 교재비 등</div>
            {classItems.length ? classItems.map(Row) : <div style={{ padding: 16, color: "#cbd5e1", fontSize: 12.5, textAlign: "center" }}>내역 없음</div>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "13px 15px" }}>
              <div style={{ fontSize: 12, color: "#047857", fontWeight: 700 }}>① 보증금 환불 예정</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: "#047857", marginTop: 3 }}>{peso(depositRefund)}</div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "13px 15px" }}>
              <div style={{ fontSize: 12, color: "#6b7c93", fontWeight: 700 }}>② 수업·교재비 받을 잔액</div>
              <div style={{ fontSize: 19, fontWeight: 900, marginTop: 3 }}>{peso(classDue)}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>청구 {peso(classCharge)}{classPaid ? ` − 납부 ${peso(classPaid)}` : ""}</div>
            </div>
          </div>
          <div style={{ background: finalNet >= 0 ? "#0f5132" : "#7f1d1d", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, color: "#fff" }}>
            <div>
              <div style={{ fontSize: 12.5, opacity: 0.85, fontWeight: 600 }}>최종 {finalNet >= 0 ? "환불" : "납부"} 금액 <span style={{ opacity: 0.7 }}>(① − ②)</span></div>
              <div style={{ fontSize: 26, fontWeight: 900, marginTop: 2 }}>{peso(Math.abs(finalNet))}</div>
            </div>
            <div style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, background: "rgba(255,255,255,0.18)", padding: "8px 14px", borderRadius: 20 }}>{finalNet >= 0 ? "환불받으실 금액" : "추가 납부 금액"}</div>
          </div>
          <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 12, lineHeight: 1.6 }}>※ 본 내역은 현지 지불 금액 기준입니다. 보증금은 차감 항목을 제외하고 환급됩니다.</p>
        </>
      )}
      </>)}
    </div>
  );
}
