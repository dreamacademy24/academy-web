"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Slot {
  id: string;
  slot_date: string;
  slot_time: string;
  duration_min: number;
  status: "available" | "booked";
  booked_by: string | null;
  booked_name: string | null;
}

interface Consultation {
  id: string;
  title: string;
  description: string | null;
  status: string;
  consultation_slots: Slot[];
}

const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];
function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${DAY_KR[dt.getDay()]})`;
}

export default function PortalConsultation() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [studentNames, setStudentNames] = useState<string[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);

  // 세션에서 booking_id 추출
  useEffect(() => {
    async function init() {
      let bid: string | null = null;
      let name = "";
      // portalSession
      try {
        const raw = localStorage.getItem("portalSession");
        if (raw) {
          const s = JSON.parse(raw);
          if (s.expires > Date.now()) {
            bid = s.booking_id;
            name = s.guest_name || s.booker_name || s.name || "";
          }
        }
      } catch {}
      // Supabase Auth fallback
      if (!bid) {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          bid = data.user.user_metadata?.booking_id || null;
          const { data: prof } = await supabase.from("profiles").select("name").eq("id", data.user.id).single();
          name = prof?.name || data.user.email?.split("@")[0] || "";
        }
      }
      if (!bid) { router.replace("/portal"); return; }
      setBookingId(bid);
      setGuestName(name);

      // 학생 이름 가져오기
      try {
        const { data: sts } = await supabase.from("students").select("name_kr").eq("booking_id", bid);
        if (sts?.length) setStudentNames(sts.map((s: any) => s.name_kr).filter(Boolean));
      } catch {}
    }
    init();
  }, [router]);

  const loadConsultations = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/consultation?booking_id=${bookingId}`);
      const j = await res.json();
      if (j.consultations) setConsultations(j.consultations);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => { if (bookingId) loadConsultations(); }, [bookingId, loadConsultations]);

  async function bookSlot(slotId: string) {
    if (!bookingId || booking) return;
    const studentStr = studentNames.join(", ");
    const displayName = `${guestName}${studentStr ? ` (${studentStr})` : ""}`;

    if (!confirm(`${displayName}\n이 시간으로 예약하시겠습니까?`)) return;

    setBooking(true);
    setMsg(null);
    try {
      const res = await fetch("/api/portal/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot_id: slotId,
          booking_id: bookingId,
          booked_name: guestName,
          booked_student: studentStr || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg({ text: j.error || "예약 실패", type: "err" });
        return;
      }
      setMsg({ text: "✅ 상담이 예약되었습니다!", type: "ok" });
      loadConsultations();
    } finally {
      setBooking(false);
    }
  }

  async function cancelSlot(slotId: string) {
    if (!bookingId) return;
    if (!confirm("예약을 취소하시겠습니까?")) return;
    const res = await fetch(`/api/portal/consultation?slot_id=${slotId}&booking_id=${bookingId}`, { method: "DELETE" });
    if (res.ok) {
      setMsg({ text: "예약이 취소되었습니다.", type: "ok" });
      loadConsultations();
    }
  }

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.pw{max-width:560px;margin:0 auto;padding:24px 20px;min-height:100vh}
.ph{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.ph h1{font-size:18px;font-weight:800}
.back{padding:6px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:#6b7c93}
.back:hover{background:#f8fafc}
.cbox{background:#fff;border-radius:14px;padding:20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
.cbox h2{font-size:16px;font-weight:800;margin-bottom:4px}
.cbox .desc{font-size:13px;color:#64748b;white-space:pre-wrap;margin-bottom:14px;line-height:1.6}
.date-group{margin-bottom:12px}
.date-label{font-size:13px;font-weight:700;color:#1a6fc4;margin-bottom:6px;padding-left:2px}
.slot-btn{width:100%;padding:12px 16px;border:2px solid #e2e8f0;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-family:inherit;font-size:14px;transition:all 150ms;margin-bottom:6px}
.slot-btn:hover:not(.booked):not(.mine){border-color:#1a6fc4;background:#eff6ff}
.slot-btn.booked{background:#f8fafc;color:#94a3b8;cursor:default;border-color:#f1f5f9}
.slot-btn.mine{background:#dcfce7;border-color:#16a34a;color:#16a34a;cursor:default}
.slot-btn .time{font-weight:800;font-size:15px}
.slot-btn .status{font-size:12px;font-weight:600}
.mine-cancel{font-size:11px;color:#dc2626;cursor:pointer;text-decoration:underline;margin-left:8px}
.msg{padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:12px;text-align:center}
.msg.ok{background:#dcfce7;color:#16a34a}.msg.err{background:#fee2e2;color:#dc2626}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px}
    `}</style>

    <div className="pw">
      <div className="ph">
        <h1>📋 상담 예약</h1>
        <button className="back" onClick={() => router.push("/portal/dashboard")}>← 마이페이지</button>
      </div>

      {msg && <div className={`msg ${msg.type}`} onClick={() => setMsg(null)}>{msg.text}</div>}

      {loading && <div className="empty">불러오는 중...</div>}

      {!loading && consultations.length === 0 && (
        <div className="empty">현재 예약 가능한 상담이 없습니다.</div>
      )}

      {consultations.map((c) => {
        const slots = c.consultation_slots || [];
        const mySlot = slots.find((s) => s.booked_by === bookingId && s.status === "booked");

        // 날짜별 그룹
        const byDate: Record<string, Slot[]> = {};
        for (const s of slots) {
          if (!byDate[s.slot_date]) byDate[s.slot_date] = [];
          byDate[s.slot_date].push(s);
        }

        return (
          <div key={c.id} className="cbox">
            <h2>{c.title}</h2>
            {c.description && <p className="desc">{c.description}</p>}

            {mySlot && (
              <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#16a34a" }}>
                  ✅ 예약 완료: {fmtDate(mySlot.slot_date)} {mySlot.slot_time}
                </div>
                <span className="mine-cancel" onClick={() => cancelSlot(mySlot.id)}>예약 취소</span>
              </div>
            )}

            {Object.entries(byDate).map(([date, dateSlots]) => (
              <div key={date} className="date-group">
                <div className="date-label">✔ {fmtDate(date)}</div>
                {dateSlots.map((s) => {
                  const isMine = s.booked_by === bookingId && s.status === "booked";
                  const isBooked = s.status === "booked" && !isMine;
                  const canBook = s.status === "available" && !mySlot;

                  return (
                    <button
                      key={s.id}
                      className={`slot-btn ${isMine ? "mine" : isBooked ? "booked" : ""}`}
                      onClick={() => canBook ? bookSlot(s.id) : undefined}
                      disabled={booking || isBooked || isMine || !!mySlot}
                    >
                      <span className="time">{s.slot_time}</span>
                      <span className="status">
                        {isMine ? "✅ 내 예약" : isBooked ? "🔒 마감" : mySlot ? "—" : "선택 가능"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  </>);
}
