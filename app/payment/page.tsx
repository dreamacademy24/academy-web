"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as PortOne from "@portone/browser-sdk/v2";

interface BookingInfo {
  id: string;
  reservation_no: string;
  booker_name: string;
  accom_type: string;
  checkin_date: string;
  checkout_date: string;
  final_price: number;
  status: string;
  students: any;
}

function fmt(n?: number) { return n ? n.toLocaleString("ko-KR") + "원" : "-"; }
function stuNames(s: any): string {
  try { const a = typeof s === "string" ? JSON.parse(s) : s; if (!Array.isArray(a)) return ""; return a.map((x: any) => x.korName).filter(Boolean).join(", "); } catch { return ""; }
}

function PaymentContent() {
  const sp = useSearchParams();
  const bookingId = sp.get("id");
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bookingId) { setLoading(false); setError("잘못된 결제 링크입니다."); return; }
    supabase.from("bookings").select("id, reservation_no, booker_name, accom_type, checkin_date, checkout_date, final_price, status, students")
      .eq("id", bookingId).single()
      .then(({ data, error: err }) => {
        if (err || !data) { setError("예약 정보를 찾을 수 없습니다."); }
        else { setBooking(data as BookingInfo); if (data.status === "결제완료") setPaid(true); }
        setLoading(false);
      });
    // 서버에서 권위 있는 잔액 조회 (결제 금액 = 이 값으로 고정)
    fetch(`/api/portal/payment?booking_id=${bookingId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.balance === "number") setBalance(d.balance); })
      .catch(() => {});
  }, [bookingId]);

  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;
  const portoneReady = !!(storeId && channelKey);

  async function handlePay(b: BookingInfo, amount: number) {
    if (!storeId || !channelKey) return;
    setError("");
    setPaying(true);
    try {
      const paymentId = `payment-${b.id}-${Date.now()}`;
      const res = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId,
        orderName: `Dream Academy - ${b.reservation_no}`,
        totalAmount: amount,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
      });
      if (!res || res.code !== undefined) {
        setError(res?.message || "결제가 취소되었습니다.");
        return;
      }
      const verify = await fetch("/api/portal/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: b.id, payment_id: paymentId }),
      });
      if (!verify.ok) {
        const r = await verify.json().catch(() => ({}));
        setError(r.error || "결제 검증에 실패했습니다. 관리자에게 문의하세요.");
        return;
      }
      setPaid(true);
    } catch {
      setError("결제 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setPaying(false);
    }
  }

  if (loading) return (<div style={wrap}><div style={card}><p style={{ textAlign: "center", color: "#6b7c93" }}>로딩 중...</p></div></div>);
  if (error && !booking) return (<div style={wrap}><div style={card}><p style={{ textAlign: "center", color: "#dc2626" }}>{error}</p></div></div>);
  if (!booking) return null;

  const payAmount = balance ?? booking.final_price;

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1a6fc4", marginBottom: 4 }}>Dream Academy Philippines</div>
          <div style={{ fontSize: 14, color: "#6b7c93" }}>결제 페이지</div>
        </div>

        <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={row}><span style={label}>예약번호</span><span style={val}>{booking.reservation_no}</span></div>
          <div style={row}><span style={label}>예약자</span><span style={val}>{booking.booker_name}</span></div>
          <div style={row}><span style={label}>학생</span><span style={val}>{stuNames(booking.students)}</span></div>
          <div style={row}><span style={label}>숙소</span><span style={val}>{booking.accom_type || "미정"}</span></div>
          <div style={row}><span style={label}>체크인</span><span style={val}>{booking.checkin_date || "미정"}</span></div>
          <div style={{ ...row, borderBottom: "none" }}><span style={label}>체크아웃</span><span style={val}>{booking.checkout_date || "미정"}</span></div>
        </div>

        <div style={{ background: "#eff6ff", borderRadius: 12, padding: 20, marginBottom: 24, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "#6b7c93", marginBottom: 4 }}>결제 금액</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1a6fc4" }}>{fmt(payAmount)}</div>
        </div>

        {paid ? (
          <div style={{ background: "#dcfce7", borderRadius: 12, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#166534" }}>결제가 완료되었습니다</div>
            <div style={{ fontSize: 13, color: "#4a5568", marginTop: 8 }}>감사합니다. 드림아카데미에서 곧 연락드리겠습니다.</div>
          </div>
        ) : portoneReady ? (
          <>
            <button
              onClick={() => handlePay(booking, payAmount)}
              disabled={paying || payAmount <= 0}
              style={{ width: "100%", padding: 14, border: "none", borderRadius: 10, background: "linear-gradient(135deg,#1a6fc4,#7c3aed)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: paying ? "not-allowed" : "pointer", opacity: paying || payAmount <= 0 ? 0.6 : 1, fontFamily: "inherit" }}
            >
              {paying ? "결제 진행 중..." : `${fmt(payAmount)} 결제하기`}
            </button>
            {error && <p style={{ textAlign: "center", fontSize: 13, color: "#dc2626", marginTop: 12 }}>{error}</p>}
            <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 16 }}>
              신용카드로 원화(KRW) 결제가 진행됩니다.
            </p>
          </>
        ) : (
          <p style={{ textAlign: "center", fontSize: 13, color: "#dc2626" }}>결제 설정이 준비되지 않았습니다. 관리자에게 문의하세요.</p>
        )}
      </div>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <a href="/" style={{ fontSize: 13, color: "#6b7c93", textDecoration: "none" }}>← 드림아카데미 홈</a>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (<Suspense><PaymentContent /></Suspense>);
}

const wrap: React.CSSProperties = { minHeight: "100vh", background: "#f1f5f9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Noto Sans KR', sans-serif" };
const card: React.CSSProperties = { background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 8px 40px rgba(0,0,0,0.1)", maxWidth: 480, width: "100%" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #e2e8f0", fontSize: 14 };
const label: React.CSSProperties = { color: "#6b7c93", fontWeight: 600 };
const val: React.CSSProperties = { color: "#1a1a2e", fontWeight: 700 };
