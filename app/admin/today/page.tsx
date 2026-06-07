"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";

// 로컬(KST/PHT) 기준 오늘 YYYY-MM-DD — toISOString 사용 금지(타임존 밀림 방지)
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateOnly(v?: string | null): string {
  return String(v || "").slice(0, 10);
}
function prettyKey(key: string): string {
  return key.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Booking { id: string; booker_name: string | null; checkin_date: string | null; checkout_date: string | null; booking_type: string | null; accom_type: string | null; reservation_no: string | null; }
interface Pickup { id: string; booking_id: string | null; request_type: string | null; request_date: string | null; pickup_place?: string | null; drop_place?: string | null; }
interface Shuttle { id: number; booking_id: string | null; portal_name: string | null; tour_name: string | null; tour_date: string | null; depart_time: string | null; people_count: number | null; room_number: string | null; status: string | null; }
interface Fieldtrip { id: number; name: string | null; portal_name: string | null; date: string | null; booking_id: string | null; status: string | null; }

interface FtRow { id: number; child: string; reserver: string; program: string; isFieldtrip: boolean; }

const PICKUP_LABEL: Record<string, string> = { pickup: "픽업", dropoff: "드랍", extra_pickup: "추가 픽업", extra_drop: "추가 드랍" };

export default function AdminTodayPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [today] = useState(localToday());

  const [checkins, setCheckins] = useState<Booking[]>([]);
  const [checkouts, setCheckouts] = useState<Booking[]>([]);
  const [pickups, setPickups] = useState<{ row: Pickup; name: string }[]>([]);
  const [shuttles, setShuttles] = useState<Shuttle[]>([]);
  const [ftRows, setFtRows] = useState<FtRow[]>([]);

  useEffect(() => {
    if (!isAdminAuthed()) { router.replace("/login"); return; }
    setAuthed(true);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const tdy = localToday();
    const [bk, pk, sh, ft] = await Promise.all([
      supabase.from("bookings").select("id, booker_name, checkin_date, checkout_date, booking_type, accom_type, reservation_no"),
      supabase.from("pickup_requests").select("*").eq("request_date", tdy),
      supabase.from("shuttle_applications").select("*").eq("tour_date", tdy),
      supabase.from("fieldtrip_applications").select("id, name, portal_name, date, booking_id, status"),
    ]);

    const bookings = (bk.data || []) as Booking[];
    const bMap = new Map(bookings.map((b) => [b.id, b]));

    setCheckins(bookings.filter((b) => dateOnly(b.checkin_date) === tdy));
    setCheckouts(bookings.filter((b) => dateOnly(b.checkout_date) === tdy));

    setPickups(((pk.data || []) as Pickup[]).map((p) => ({ row: p, name: (p.booking_id && bMap.get(p.booking_id)?.booker_name) || "—" })));
    setShuttles(((sh.data || []) as Shuttle[]).filter((s) => (s.status || "") !== "cancelled"));

    // 필드트립: date 토큰("M-D-key" 콤마결합) 중 오늘 날짜 토큰만 추출
    const [, mStr, dStr] = tdy.split("-");
    const todM = parseInt(mStr, 10), todD = parseInt(dStr, 10);
    const rows: FtRow[] = [];
    ((ft.data || []) as Fieldtrip[]).forEach((a) => {
      if ((a.status || "") === "cancelled") return;
      const reserver = (a.booking_id && bMap.get(a.booking_id)?.booker_name) || (a.portal_name || "").trim() || "—";
      (a.date || "").split(",").map((t) => t.trim()).filter(Boolean).forEach((tok) => {
        const m = tok.match(/^(\d{1,2})-(\d{1,2})-(.+)$/);
        if (!m) return;
        if (parseInt(m[1], 10) === todM && parseInt(m[2], 10) === todD) {
          rows.push({ id: a.id, child: (a.name || "").trim() || "—", reserver, program: prettyKey(m[3]), isFieldtrip: true });
        }
      });
    });
    setFtRows(rows);
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  if (!authed) return null;

  const chips = [
    { label: "체크인", n: checkins.length, c: "#1a6fc4" },
    { label: "체크아웃", n: checkouts.length, c: "#0891b2" },
    { label: "픽드랍", n: pickups.length, c: "#7c3aed" },
    { label: "셔틀", n: shuttles.length, c: "#16a34a" },
    { label: "필드트립", n: ftRows.length, c: "#c2410c" },
  ];

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.tw{max-width:980px;margin:0 auto;padding:28px 20px 60px}
.top{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.back:hover{background:#e2e8f0}
.top h1{font-size:21px;font-weight:800;flex:1}
.sub{font-size:13px;color:#6b7c93;margin-bottom:18px;padding-left:46px}
.chips{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px}
.chip{flex:1;min-width:120px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;box-shadow:0 2px 10px rgba(0,0,0,0.04)}
.chip .n{font-size:26px;font-weight:800;line-height:1}
.chip .l{font-size:12px;color:#6b7c93;margin-top:6px;font-weight:600}
.sec{background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);margin-bottom:16px}
.sec h2{font-size:15px;font-weight:800;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.sec h2 .cnt{font-size:12px;font-weight:700;color:#94a3b8}
.row{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
.row:last-child{border-bottom:none}
.row .nm{font-weight:700;min-width:90px}
.row .meta{color:#6b7c93;flex:1}
.tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;white-space:nowrap}
.empty{color:#cbd5e1;font-size:13px;padding:8px 0}
@media(max-width:640px){.sub{padding-left:0}.chip{min-width:calc(50% - 5px)}}
    `}</style>
    <div className="tw">
      <div className="top">
        <button className="back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>📅 오늘 한눈에</h1>
        <button className="back" title="새로고침" onClick={load}>🔄</button>
      </div>
      <div className="sub">{today} · 오늘 처리할 체크인/아웃 · 픽드랍 · 셔틀 · 필드트립을 모았습니다.</div>

      <div className="chips">
        {chips.map((c) => (
          <div key={c.label} className="chip">
            <div className="n" style={{ color: c.c }}>{c.n}</div>
            <div className="l">{c.label}</div>
          </div>
        ))}
      </div>

      {loading ? <div className="sec"><div className="empty">불러오는 중...</div></div> : (<>
        <div className="sec">
          <h2>🛬 오늘 체크인 <span className="cnt">{checkins.length}건</span></h2>
          {checkins.length === 0 ? <div className="empty">오늘 체크인 예약이 없습니다.</div> : checkins.map((b) => (
            <div className="row" key={b.id}>
              <span className="nm">{b.booker_name || "—"}</span>
              <span className="meta">{b.accom_type || b.booking_type || ""}{b.reservation_no ? ` · ${b.reservation_no}` : ""}</span>
            </div>
          ))}
        </div>

        <div className="sec">
          <h2>🧳 오늘 체크아웃 <span className="cnt">{checkouts.length}건</span></h2>
          {checkouts.length === 0 ? <div className="empty">오늘 체크아웃 예약이 없습니다.</div> : checkouts.map((b) => (
            <div className="row" key={b.id}>
              <span className="nm">{b.booker_name || "—"}</span>
              <span className="meta">{b.accom_type || b.booking_type || ""}{b.reservation_no ? ` · ${b.reservation_no}` : ""}</span>
            </div>
          ))}
        </div>

        <div className="sec">
          <h2>🚐 오늘 픽드랍 <span className="cnt">{pickups.length}건</span></h2>
          {pickups.length === 0 ? <div className="empty">오늘 픽드랍이 없습니다.</div> : pickups.map(({ row, name }) => (
            <div className="row" key={row.id}>
              <span className="nm">{name}</span>
              <span className="tag" style={{ background: "#f3e8ff", color: "#7c3aed" }}>{PICKUP_LABEL[row.request_type || ""] || row.request_type || "픽드랍"}</span>
              <span className="meta">{row.pickup_place || row.drop_place || ""}</span>
            </div>
          ))}
        </div>

        <div className="sec">
          <h2>🚌 오늘 투어 셔틀 <span className="cnt">{shuttles.length}건</span></h2>
          {shuttles.length === 0 ? <div className="empty">오늘 셔틀이 없습니다.</div> : shuttles.map((s) => (
            <div className="row" key={s.id}>
              <span className="nm">{s.portal_name || "—"}</span>
              <span className="meta">{[s.tour_name, s.depart_time, s.room_number].filter(Boolean).join(" · ")}</span>
              <span className="tag" style={{ background: "#dcfce7", color: "#16a34a" }}>{s.people_count || 0}명</span>
            </div>
          ))}
        </div>

        <div className="sec">
          <h2>🌿 오늘 필드트립/애프터스쿨 <span className="cnt">{ftRows.length}건</span></h2>
          {ftRows.length === 0 ? <div className="empty">오늘 필드트립/애프터스쿨이 없습니다.</div> : ftRows.map((r, i) => (
            <div className="row" key={r.id + "-" + i}>
              <span className="nm">{r.child}</span>
              <span className="meta">{r.program}{r.reserver !== "—" ? ` · ${r.reserver}` : ""}</span>
              <span className="tag" style={{ background: "#fff7ed", color: "#c2410c" }}>🟠 오늘</span>
            </div>
          ))}
        </div>
      </>)}
    </div>
  </>);
}
