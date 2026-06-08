"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resolvePortalSession } from "@/lib/portalSession";

interface Notice { id: string; category: string; title: string; content: string; popup: boolean; audience: string; target_ids: string[]; created_at: string; }

function fmt(d: string) { return (d || "").slice(0, 10).replace(/-/g, "."); }

export default function PortalNoticesPage() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [list, setList] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Notice | null>(null);

  useEffect(() => {
    (async () => {
      const s = await resolvePortalSession();
      if (!s) { router.replace("/portal"); return; }
      setBookingId((s as { booking_id: string }).booking_id);
    })();
  }, [router]);

  const load = useCallback(async (bid: string) => {
    setLoading(true);
    const { data } = await supabase.from("portal_notices").select("*").order("created_at", { ascending: false });
    const all = (data || []) as Notice[];
    const visible = all.filter((n) => n.audience !== "selected" || (Array.isArray(n.target_ids) && n.target_ids.includes(bid)));
    setList(visible);
    setLoading(false);
  }, []);
  useEffect(() => { if (bookingId) load(bookingId); }, [bookingId, load]);

  // 공지 페이지 방문 = 읽음 처리: 안읽음 기준 시각 갱신 + 앱 아이콘 배지 제거
  useEffect(() => {
    try { localStorage.setItem("notices_last_seen", new Date().toISOString()); } catch {}
    try { (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.(); } catch {}
  }, []);

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.pw{max-width:640px;margin:0 auto;padding:22px 16px 60px}
.top{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.back:hover{background:#e2e8f0}
.top h1{font-size:19px;font-weight:800;flex:1}
.item{background:#fff;border-radius:12px;box-shadow:0 1px 6px rgba(0,0,0,0.05);padding:14px 16px;margin-bottom:10px;cursor:pointer;border:1px solid #eef2f7}
.item:hover{border-color:#bfdbfe}
.item .h{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.badge{font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:6px}
.b-imp{background:#fceaeb;color:#a32d2d}.b-gen{background:#eff6ff;color:#1a6fc4}
.item .t{font-size:15px;font-weight:700;color:#1a1a2e}
.item .d{font-size:11px;color:#94a3b8;margin-left:auto}
.item .p{font-size:12.5px;color:#6b7c93;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.empty{color:#cbd5e1;font-size:14px;text-align:center;padding:50px 0}
.ov{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:18px}
.modal{background:#fff;border-radius:14px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;padding:22px}
.modal .t{font-size:18px;font-weight:800;margin:8px 0 4px}
.modal .body{font-size:14px;line-height:1.8;color:#374151;white-space:pre-wrap;margin-top:12px}
.close{margin-top:18px;width:100%;padding:11px;border:none;border-radius:8px;background:#1a6fc4;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}
`}</style>
    <div className="pw">
      <div className="top">
        <button className="back" onClick={() => router.push("/portal/dashboard")}>←</button>
        <h1>📢 공지사항</h1>
      </div>
      {loading ? <div className="empty">불러오는 중...</div>
        : list.length === 0 ? <div className="empty">등록된 공지가 없습니다.</div>
        : list.map((n) => (
          <div className="item" key={n.id} onClick={() => setOpen(n)}>
            <div className="h">
              <span className={`badge ${n.category === "important" ? "b-imp" : "b-gen"}`}>{n.category === "important" ? "중요" : "일반"}</span>
              <span className="t" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
              <span className="d">{fmt(n.created_at)}</span>
            </div>
            <div className="p">{n.content}</div>
          </div>
        ))}
    </div>
    {open && (
      <div className="ov" onClick={() => setOpen(null)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={`badge ${open.category === "important" ? "b-imp" : "b-gen"}`}>{open.category === "important" ? "중요" : "일반"}</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{fmt(open.created_at)}</span>
          </div>
          <div className="t">{open.title}</div>
          <div className="body">{open.content}</div>
          <button className="close" onClick={() => setOpen(null)}>닫기</button>
        </div>
      </div>
    )}
  </>);
}
