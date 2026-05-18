"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Session { booking_id: string; booking_number: string; guest_name: string; check_in_date: string; expires: number }

const PAY: Record<string, { label: string; bg: string; color: string }> = {
  unpaid:  { label: "미납", bg: "#fef2f2", color: "#dc2626" },
  partial: { label: "부분납", bg: "#fef3c7", color: "#92400e" },
  paid:    { label: "완료", bg: "#dcfce7", color: "#166534" },
};

function fDate(d: string | null) { return d || "-"; }
function fAmt(n: number | null) { return n ? n.toLocaleString() + "원" : "-"; }

export default function MyBookingPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      try {
        const raw = localStorage.getItem("portalSession");
        if (!raw) {
          const { data: { session: authSession } } = await supabase.auth.getSession();
          if (!authSession) { router.replace("/portal"); return; }
          const res = await fetch('/api/portal/find-booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: authSession.user.id })
          });
          const d = res.ok ? await res.json() : null;
          const bk = d?.booking;
          if (bk) {
            setSession({
              booking_id: bk.id,
              booking_number: bk.reservation_no || '',
              guest_name: bk.booker_name || '',
              check_in_date: bk.check_in || '',
              expires: Date.now() + 24 * 60 * 60 * 1000
            });
          } else {
            router.replace("/portal/dashboard");
          }
          return;
        }
        const s: Session = JSON.parse(raw);
        if (s.expires < Date.now()) { localStorage.removeItem("portalSession"); router.replace("/portal"); return; }
        setSession(s);
      } catch { router.replace("/portal"); }
    })();
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch(`/api/portal/booking?booking_id=${session.booking_id}`);
      if (res.ok) setData(await res.json());
      setLoading(false);
    })();
  }, [session]);

  if (!session || loading) return null;

  const b = data?.booking;
  const students = data?.students || [];
  if (!b) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "'Noto Sans KR',sans-serif", background: "#f1f5f9" }}>
      <div style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>예약 정보를 찾을 수 없습니다</div>
        <button onClick={() => router.push("/portal/dashboard")} style={{ padding: "10px 24px", background: "#1a6fc4", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← 대시보드로</button>
      </div>
    </div>
  );

  const pay = PAY[b.payment_status] || PAY.unpaid;
  const totalAmt = b.total_amount || b.final_price || b.base_price || 0;
  const paidAmt = b.paid_amount || 0;
  const balance = totalAmt - paidAmt;

  return (<>
    <style>{`
.mb-w{max-width:640px;margin:0 auto;padding:24px 24px 40px}
.mb-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:12px}.mb-back:hover{color:#1a6fc4}
.mb-head{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:16px;padding:20px;color:#fff;margin-bottom:12px}
.mb-head h1{font-size:18px;font-weight:800;margin-bottom:2px}
.mb-head p{font-size:12px;opacity:0.8}
.sec{background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 8px rgba(0,0,0,0.04);margin-bottom:10px}
.sec h2{font-size:13px;font-weight:800;color:#1a6fc4;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.item{padding:10px;background:#f8fafc;border-radius:8px}
.item .lbl{font-size:10px;font-weight:700;color:#6b7c93;margin-bottom:2px}
.item .val{font-size:13px;font-weight:600}
.badge{display:inline-block;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700}
.stu{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:8px}
.stu .nm{font-size:15px;font-weight:700;margin-bottom:4px}
.stu .sub{font-size:12px;color:#6b7c93}
.empty{text-align:center;padding:20px;color:#94a3b8;font-size:13px}
@media(max-width:500px){.mb-w{padding:24px 16px}.grid{grid-template-columns:1fr}}
    `}</style>
    <div className="mb-w">
      <button className="mb-back" onClick={() => router.push("/portal/dashboard")}>← 대시보드로</button>

      <div className="mb-head">
        <h1>{session.guest_name}님의 예약</h1>
        <p>{session.booking_number}</p>
      </div>

      <div className="sec">
        <h2>예약 정보</h2>
        <div className="grid">
          <div className="item"><div className="lbl">예약번호</div><div className="val">{b.reservation_no || session.booking_number}</div></div>
          <div className="item"><div className="lbl">예약유형</div><div className="val">{b.booking_type || b.accom_type || "-"}</div></div>
          <div className="item"><div className="lbl">체크인</div><div className="val">{fDate(b.check_in || b.checkin_date)}</div></div>
          <div className="item"><div className="lbl">체크아웃</div><div className="val">{fDate(b.check_out || b.checkout_date)}</div></div>
          <div className="item"><div className="lbl">아카데미 시작</div><div className="val">{fDate(b.academy_start)}</div></div>
          <div className="item"><div className="lbl">아카데미 종료</div><div className="val">{fDate(b.academy_end)}</div></div>
          <div className="item"><div className="lbl">픽업장소</div><div className="val">{b.pickup_place || "-"}</div></div>
          <div className="item"><div className="lbl">유학원</div><div className="val">{b.agency || "-"}</div></div>
        </div>
      </div>

      <div className="sec">
        <h2>항공편</h2>
        <div className="grid">
          <div className="item"><div className="lbl">입국 항공편</div><div className="val">{b.flight_in_airline || b.flight_in || "-"}</div></div>
          <div className="item"><div className="lbl">입국 날짜/시간</div><div className="val">{fDate(b.flight_in_date)} {b.flight_in_time || ""}</div></div>
          <div className="item"><div className="lbl">출국 항공편</div><div className="val">{b.flight_out_airline || b.flight_out || "-"}</div></div>
          <div className="item"><div className="lbl">출국 날짜/시간</div><div className="val">{fDate(b.flight_out_date)} {b.flight_out_time || ""}</div></div>
        </div>
      </div>

      <div className="sec">
        <h2>학생 ({students.length}명)</h2>
        {students.length === 0 ? <div className="empty">등록된 학생이 없습니다</div> :
          students.map((s: any) => (
            <div key={s.id} className="stu">
              <div className="nm">{s.name_kr || "-"} {s.name_en ? `(${s.name_en})` : ""}</div>
              <div className="sub">
                {s.age || "-"} · {s.level === "kinder" ? "킨더" : s.level === "junior" ? "주니어" : "-"} · {s.class_type === "morning" ? "오전반" : s.class_type === "fullday" ? "종일반" : "-"}
              </div>
            </div>
          ))
        }
      </div>

      <div className="sec">
        <h2>결제 상태</h2>
        <div className="grid">
          <div className="item"><div className="lbl">결제상태</div><div className="val"><span className="badge" style={{ background: pay.bg, color: pay.color }}>{pay.label}</span></div></div>
          <div className="item"><div className="lbl">총 금액</div><div className="val">{fAmt(totalAmt)}</div></div>
          <div className="item"><div className="lbl">납입 금액</div><div className="val">{fAmt(paidAmt)}</div></div>
          <div className="item"><div className="lbl">잔금</div><div className="val" style={{ color: balance > 0 ? "#dc2626" : "#166534" }}>{fAmt(balance)}</div></div>
        </div>
      </div>

    </div>
  </>);
}
