"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

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
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
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
  }, [bookingId]);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

  if (loading) return (<div style={wrap}><div style={card}><p style={{ textAlign: "center", color: "#6b7c93" }}>로딩 중...</p></div></div>);
  if (error) return (<div style={wrap}><div style={card}><p style={{ textAlign: "center", color: "#dc2626" }}>{error}</p></div></div>);
  if (!booking) return null;

  const usdAmount = (booking.final_price / 1400).toFixed(2);

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
          <div style={{ fontSize: 28, fontWeight: 800, color: "#1a6fc4" }}>{fmt(booking.final_price)}</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>≈ USD ${usdAmount}</div>
        </div>

        {paid ? (
          <div style={{ background: "#dcfce7", borderRadius: 12, padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#166534" }}>결제가 완료되었습니다</div>
            <div style={{ fontSize: 13, color: "#4a5568", marginTop: 8 }}>감사합니다. 드림아카데미에서 곧 연락드리겠습니다.</div>
          </div>
        ) : (
          <>
            <PayPalScriptProvider options={{ clientId, currency: "USD" }}>
              <PayPalButtons
                style={{ layout: "vertical", shape: "rect", label: "pay" }}
                createOrder={(_data, actions) => {
                  return actions.order.create({
                    intent: "CAPTURE",
                    purchase_units: [{
                      description: `Dream Academy - ${booking.reservation_no}`,
                      amount: { currency_code: "USD", value: usdAmount },
                    }],
                  });
                }}
                onApprove={async (_data, actions) => {
                  await actions.order!.capture();
                  await supabase.from("bookings").update({ status: "결제완료" }).eq("id", booking.id);
                  setPaid(true);
                }}
                onError={(err) => { console.error(err); setError("결제 중 오류가 발생했습니다. 다시 시도해주세요."); }}
              />
            </PayPalScriptProvider>
            <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 16 }}>
              PayPal 계정 또는 신용카드로 결제할 수 있습니다.
            </p>
          </>
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
