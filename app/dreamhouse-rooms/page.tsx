"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const ROOMS = [
  "b16L19", "b17L12", "b17L11", "b17L10", "b17L9",
  "b17L8", "b17L7", "b17L13", "b17L18", "빅하우스",
  "b21L1", "b13L10", "b15L5", "b15L6", "b15L7",
];

interface Booking {
  id: string;
  reservation_no: string;
  booker_name: string;
  accom_room: string;
  checkin_date: string;
  checkout_date: string;
  status: string;
}

export default function DreamhouseRoomsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adminAuthed");
      if (saved === "true") setAuthed(true);
      else router.push("/admin");
    }
  }, [router]);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, reservation_no, booker_name, accom_room, checkin_date, checkout_date, status")
        .eq("accom_type", "드림하우스")
        .order("checkin_date", { ascending: true });
      if (!error && data) setBookings(data);
      setLoading(false);
    })();
  }, [authed]);

  if (!authed) return null;

  function getBookingsForRoom(room: string) {
    return bookings.filter((b) => b.accom_room === room);
  }

  return (
    <>
      <style>{`
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.dr-w{max-width:1100px;margin:0 auto;padding:40px 24px;}
.dr-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:12px;}
.dr-header h1{font-size:24px;font-weight:800;}
.dr-back{font-size:13px;color:#6b7c93;text-decoration:none;padding:8px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;}.dr-back:hover{color:#1a6fc4;border-color:#1a6fc4;}
.dr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;}
.dr-card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #e2e8f0;}
.dr-card h2{font-size:16px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px;}
.dr-dot{width:10px;height:10px;border-radius:50%;display:inline-block;}
.dr-dot.occupied{background:#ef4444;}
.dr-dot.empty{background:#22c55e;}
.dr-booking{font-size:13px;color:#475569;padding:8px 10px;background:#f8fafc;border-radius:6px;margin-bottom:6px;line-height:1.6;}
.dr-booking strong{color:#1a1a2e;}
.dr-empty{font-size:13px;color:#94a3b8;padding:8px 0;}
.dr-loading{text-align:center;padding:80px 0;color:#94a3b8;font-size:15px;}
@media(max-width:500px){.dr-w{padding:24px 16px;}.dr-grid{grid-template-columns:1fr;}}
      `}</style>
      <div className="dr-w">
        <div className="dr-header">
          <h1>드림하우스 룸 관리</h1>
          <a className="dr-back" href="/admin">← 관리자 허브</a>
        </div>
        {loading ? (
          <div className="dr-loading">불러오는 중...</div>
        ) : (
          <div className="dr-grid">
            {ROOMS.map((room) => {
              const rb = getBookingsForRoom(room);
              const occupied = rb.length > 0;
              return (
                <div className="dr-card" key={room}>
                  <h2>
                    <span className={`dr-dot ${occupied ? "occupied" : "empty"}`} />
                    {room}
                  </h2>
                  {rb.length === 0 ? (
                    <div className="dr-empty">현재 예약 없음</div>
                  ) : (
                    rb.map((b) => (
                      <div className="dr-booking" key={b.id}>
                        <strong>{b.booker_name}</strong> ({b.reservation_no})<br />
                        {b.checkin_date} ~ {b.checkout_date}<br />
                        상태: {b.status}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
