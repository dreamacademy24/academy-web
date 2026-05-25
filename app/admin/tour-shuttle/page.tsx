"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthed } from "@/lib/adminAuth";
import ScheduleDeploy from "./ScheduleDeploy";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ShuttleApp {
  id: string;
  created_at: string;
  booking_id: string | null;
  portal_name: string | null;
  tour_name: string | null;
  date: string | null;
  num_people: number | null;
  notes: string | null;
  status: string;
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기중", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정",   bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
};

function fmtDate(s: string | null) {
  if (!s) return "-";
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export default function TourShuttleAdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [apps, setApps] = useState<ShuttleApp[]>([]);
  const [bookingNumbers, setBookingNumbers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<"list" | "deploy">("list");

  useEffect(() => {
    if (!isAdminAuthed()) { router.replace("/login"); return; }
    setAuthed(true);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shuttle_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setApps(data as ShuttleApp[]);
      const ids = Array.from(new Set(data.map(d => d.booking_id).filter(Boolean) as string[]));
      if (ids.length > 0) {
        const { data: bs } = await supabase.from("bookings").select("id, reservation_no, booker_name").in("id", ids);
        const map: Record<string, string> = {};
        (bs || []).forEach((b: any) => { map[b.id] = b.reservation_no || ""; });
        setBookingNumbers(map);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function changeStatus(id: string, status: string) {
    const prev = apps;
    setApps(apps.map(a => a.id === id ? { ...a, status } : a));
    const { error } = await supabase.from("shuttle_applications").update({ status }).eq("id", id);
    if (error) { alert("상태 변경 실패: " + error.message); setApps(prev); }
  }

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.ts-w{max-width:1400px;margin:0 auto;padding:24px}
.ts-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.ts-back{background:none;border:1px solid #cbd5e1;color:#475569;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit;font-weight:600}.ts-back:hover{background:#fff;color:#1a6fc4}
.ts-title{font-size:20px;font-weight:800;color:#1a1a2e}
.ts-sub{font-size:13px;color:#6b7c93;margin-left:10px}
.ts-card{background:#fff;border-radius:14px;padding:0;box-shadow:0 2px 12px rgba(0,0,0,0.05);overflow:hidden}
.ts-tbl{width:100%;border-collapse:collapse;font-size:13px}
.ts-tbl th{background:#f8fafc;text-align:left;padding:12px 14px;font-weight:700;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;white-space:nowrap}
.ts-tbl td{padding:12px 14px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.ts-tbl tr:hover td{background:#f8fafc}
.ts-sel{padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:inherit;background:#fff;cursor:pointer;font-weight:600}
.ts-empty{padding:60px;text-align:center;color:#94a3b8;font-size:14px}
.ts-loading{padding:40px;text-align:center;color:#3b82f6;font-size:14px}
.ts-notes{max-width:280px;font-size:12px;color:#475569;white-space:pre-wrap}
    `}</style>
    <div className="ts-w">
      <div className="ts-head">
        <button className="ts-back" onClick={() => router.push("/admin/hub")}>← 어드민 홈</button>
        <div>
          <span className="ts-title">🚌 투어셔틀 관리</span>
          <span className="ts-sub">총 {apps.length}건</span>
        </div>
        <div style={{ width: 100 }} />
      </div>

      <div style={{display:"flex",gap:6,background:"#fff",padding:4,borderRadius:12,marginBottom:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
        <button
          onClick={() => setMainTab("list")}
          style={{flex:1,padding:"10px 14px",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:mainTab==="list"?"#1a6fc4":"transparent",color:mainTab==="list"?"#fff":"#6b7c93"}}
        >📋 신청목록</button>
        <button
          onClick={() => setMainTab("deploy")}
          style={{flex:1,padding:"10px 14px",border:"none",borderRadius:9,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",background:mainTab==="deploy"?"#1a6fc4":"transparent",color:mainTab==="deploy"?"#fff":"#6b7c93"}}
        >📅 전체신청배포</button>
      </div>

      {mainTab === "deploy" ? (
        <ScheduleDeploy />
      ) : (
      <div className="ts-card">
        {loading ? (
          <div className="ts-loading">불러오는 중...</div>
        ) : apps.length === 0 ? (
          <div className="ts-empty">신청 내역이 없습니다.</div>
        ) : (
          <table className="ts-tbl">
            <thead>
              <tr>
                <th style={{ width: 110 }}>신청일</th>
                <th style={{ width: 110 }}>신청자</th>
                <th style={{ width: 120 }}>예약번호</th>
                <th style={{ width: 180 }}>투어명</th>
                <th style={{ width: 110 }}>날짜</th>
                <th style={{ width: 60 }}>인원</th>
                <th>요청사항</th>
                <th style={{ width: 130 }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {apps.map(a => {
                const meta = STATUS_META[a.status] || STATUS_META.pending;
                return (
                  <tr key={a.id}>
                    <td style={{ fontSize: 12, color: "#6b7c93", whiteSpace: "nowrap" }}>{fmtDate(a.created_at)}</td>
                    <td style={{ fontWeight: 600 }}>{a.portal_name || "-"}</td>
                    <td style={{ fontSize: 12, fontFamily: "monospace", color: "#475569" }}>
                      {a.booking_id ? (bookingNumbers[a.booking_id] || a.booking_id.slice(0, 8)) : "-"}
                    </td>
                    <td>{a.tour_name || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(a.date)}</td>
                    <td style={{ textAlign: "center" }}>{a.num_people || "-"}</td>
                    <td className="ts-notes" title={a.notes || ""}>{a.notes || "-"}</td>
                    <td>
                      <select
                        className="ts-sel"
                        style={{ background: meta.bg, color: meta.color, borderColor: meta.bg }}
                        value={a.status}
                        onChange={e => changeStatus(a.id, e.target.value)}
                      >
                        <option value="pending">대기중</option>
                        <option value="confirmed">확정</option>
                        <option value="cancelled">취소</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  </>);
}
