"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

interface Session { booking_id: string; booking_number: string; guest_name: string; expires: number }
interface PayData {
  booking_id: string; booker_name: string; reservation_no: string;
  total_amount: number; paid_amount: number; balance: number; payment_status: string;
}

const PAY_ST: Record<string, { label: string; bg: string; color: string }> = {
  unpaid:  { label: "미납", bg: "#fef2f2", color: "#dc2626" },
  partial: { label: "부분납", bg: "#fef3c7", color: "#92400e" },
  paid:    { label: "완료", bg: "#dcfce7", color: "#166534" },
};

const USD_RATE = 1300; // KRW per USD (견적용)

function fmt(n: number) { return n.toLocaleString() + "원"; }

export default function PortalPaymentPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<PayData | null>(null);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("portalSession");
      if (!raw) { router.replace("/portal"); return; }
      const s: Session = JSON.parse(raw);
      if (s.expires < Date.now()) { localStorage.removeItem("portalSession"); router.replace("/portal"); return; }
      setSession(s);
    } catch { router.replace("/portal"); }
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const res = await fetch(`/api/portal/payment?booking_id=${session.booking_id}`);
        if (res.ok) {
          const d = await res.json();
          setData(d);
        } else {
          const errData = await res.json().catch(() => ({}));
          setError(errData.error || `조회 실패 (${res.status})`);
        }
      } catch (e) {
        setError("네트워크 오류: " + (e instanceof Error ? e.message : "unknown"));
      }
    })();
  }, [session]);

  async function reload() {
    if (!session) return;
    const res = await fetch(`/api/portal/payment?booking_id=${session.booking_id}`);
    if (res.ok) setData(await res.json());
  }

  if (!session) return null;

  const usdAmount = data ? (Math.max(1, Math.round(data.balance / USD_RATE))).toString() : "1";
  const isFullyPaid = data?.payment_status === "paid" || paid;
  const st = data ? (PAY_ST[data.payment_status] || PAY_ST.unpaid) : PAY_ST.unpaid;

  return (<>
    <style>{`
.py-w{max-width:640px;margin:0 auto;padding:24px 24px 40px}
.py-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:12px}.py-back:hover{color:#1a6fc4}
.py-head{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:16px;padding:20px;color:#fff;margin-bottom:12px}
.py-head h1{font-size:18px;font-weight:800;margin-bottom:2px}
.py-head p{font-size:12px;opacity:0.8}
.sec{background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 8px rgba(0,0,0,0.04);margin-bottom:10px}
.sec h2{font-size:14px;font-weight:800;color:#1a6fc4;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.row:last-child{border-bottom:none}
.row .lbl{color:#6b7c93;font-weight:600}
.row .val{font-weight:700}
.row.total{padding-top:12px;border-top:2px solid #1a6fc4;margin-top:4px;font-size:16px}
.row.total .val{color:#1a6fc4;font-size:18px}
.row.balance .val{color:#dc2626}
.badge{display:inline-block;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700}
.done-box{background:#dcfce7;border-radius:12px;padding:28px;text-align:center;border:1px solid #bbf7d0}
.done-box .icon{font-size:42px;margin-bottom:10px}
.done-box .ttl{font-size:17px;font-weight:800;color:#166534;margin-bottom:6px}
.done-box .sub{font-size:13px;color:#166534;opacity:0.85}
.err{margin-top:10px;padding:10px 14px;background:#fef2f2;color:#dc2626;border-radius:10px;font-size:13px;font-weight:600;border:1px solid #fecaca}
.paypal-wrap{padding-top:4px}
.hint{margin-top:12px;padding:10px 14px;background:#f0f7ff;color:#1e40af;border-radius:10px;font-size:12px;border:1px solid #bfdbfe;line-height:1.6}
@media(max-width:500px){.py-w{padding:20px 16px}}
    `}</style>
    <div className="py-w">
      <button className="py-back" onClick={() => router.push("/portal/dashboard")}>← 대시보드로</button>

      <div className="py-head">
        <h1>💳 결제 안내</h1>
        <p>{session.guest_name}님 · {data?.reservation_no || session.booking_number}</p>
      </div>

      <div className="sec">
        <h2>결제 정보</h2>
        {error && !data ? <div className="err">{error}</div> : !data ? <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>로딩 중...</div> : (<>
          <div className="row">
            <span className="lbl">결제 상태</span>
            <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <div className="row total">
            <span className="lbl">총 금액</span>
            <span className="val">{fmt(data.total_amount)}</span>
          </div>
          <div className="row">
            <span className="lbl">납입 금액</span>
            <span className="val">{fmt(data.paid_amount)}</span>
          </div>
          <div className="row balance">
            <span className="lbl">잔금</span>
            <span className="val">{fmt(data.balance)}</span>
          </div>
        </>)}
      </div>

      {isFullyPaid ? (
        <div className="done-box">
          <div className="icon">✅</div>
          <div className="ttl">결제가 완료되었습니다</div>
          <div className="sub">감사합니다. 드림아카데미에서 곧 연락드리겠습니다.</div>
        </div>
      ) : data && data.balance > 0 && clientId ? (
        <div className="sec">
          <h2>PayPal 결제</h2>
          <div className="paypal-wrap">
            <PayPalScriptProvider options={{ clientId, currency: "USD" }}>
              <PayPalButtons
                style={{ layout: "vertical", shape: "rect", label: "pay" }}
                createOrder={(_d, actions) => actions.order.create({
                  intent: "CAPTURE",
                  purchase_units: [{
                    description: `Dream Academy - ${data.reservation_no}`,
                    amount: { currency_code: "USD", value: usdAmount },
                  }],
                })}
                onApprove={async (_d, actions) => {
                  const details = await actions.order!.capture();
                  const captured = details.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
                  if (!captured || captured.currency_code !== "USD") {
                    setError("결제 정보가 일치하지 않습니다. 관리자에게 문의하세요.");
                    return;
                  }
                  const res = await fetch("/api/portal/payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      booking_id: data.booking_id,
                      paypal_order_id: details.id,
                      captured_amount_usd: captured.value,
                      amount_krw: Math.round(parseFloat(captured.value) * USD_RATE),
                    }),
                  });
                  if (!res.ok) { const r = await res.json(); setError(r.error || "결제 처리 실패"); return; }
                  setPaid(true);
                  reload();
                }}
                onError={(err) => { console.error(err); setError("결제 중 오류가 발생했습니다. 다시 시도해주세요."); }}
              />
            </PayPalScriptProvider>
          </div>
          <div className="hint">
            💡 PayPal 계정 또는 신용카드로 결제할 수 있습니다.<br/>
            환율 약 1 USD = ₩{USD_RATE.toLocaleString()} 기준, 결제 예상 금액: <b>${usdAmount}</b>
          </div>
          {error && <div className="err">{error}</div>}
        </div>
      ) : data && !clientId ? (
        <div className="err">PayPal 설정이 준비되지 않았습니다. 관리자에게 문의하세요.</div>
      ) : null}
    </div>
  </>);
}
