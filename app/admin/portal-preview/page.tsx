"use client";
// 👀 엄마 화면 미리보기 — 예약(엄마) 선택 → 우측에 그 엄마의 포털 화면을 그대로 표시
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";

interface B { id: string; booker_name: string | null; reservation_no: string | null; checkin_date: string | null; checkout_date: string | null; house_no: string | null; accom_room: string | null; accom_type: string | null; students: unknown; status: string | null; }

function stuNames(students: unknown) { try { const s = typeof students === "string" ? JSON.parse(students) : students; if (Array.isArray(s)) return s.map((x: { korName?: string; name_kr?: string }) => x.korName || x.name_kr || "").filter(Boolean).join(", "); } catch { } return ""; }
const today10 = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function PortalPreviewPage() {
  const router = useRouter();
  const [rows, setRows] = useState<B[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"now" | "future" | "all">("now");
  const [sel, setSel] = useState<B | null>(null);
  const [mobile, setMobile] = useState(true);
  const [frameKey, setFrameKey] = useState(0);
  const cleanupRef = useRef(() => { try { localStorage.removeItem("portalSession"); } catch { } });

  useEffect(() => { if (typeof window !== "undefined" && !isAdminAuthed()) router.replace("/login"); }, [router]);

  const load = useCallback(async () => {
    const { data } = await supabase.from("bookings")
      .select("id,booker_name,reservation_no,checkin_date,checkout_date,house_no,accom_room,accom_type,students,status")
      .not("status", "ilike", "%취소%").order("checkin_date");
    setRows((data || []) as B[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  // 페이지 이탈 시 미리보기 세션 정리 (어드민 브라우저에 엄마 세션 안 남게)
  useEffect(() => {
    const fn = cleanupRef.current;
    window.addEventListener("beforeunload", fn);
    return () => { window.removeEventListener("beforeunload", fn); fn(); };
  }, []);

  const t = today10();
  const staying = (b: B) => (b.checkin_date || "") <= t && (b.checkout_date || "9999") >= t;
  const future = (b: B) => (b.checkin_date || "") > t;
  const base = rows.filter(b => tab === "now" ? staying(b) : tab === "future" ? future(b) : true); // 전체 = 과거(귀국 후 화상영어 등) 포함
  const shown = base.filter(b => { if (!q) return true; const s = q.toLowerCase(); return [b.booker_name, stuNames(b.students), b.reservation_no, b.house_no, b.accom_room].some(v => v && String(v).toLowerCase().includes(s)); });

  const pick = (b: B) => { try { localStorage.removeItem("portalSession"); } catch { } setSel(b); setFrameKey(k => k + 1); };
  const room = (b: B) => (b.house_no || b.accom_room || "").toString().toUpperCase();

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif", background: "#f1f5f9" }}>
      {/* 좌측: 엄마 목록 */}
      <div style={{ width: 320, flexShrink: 0, background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 16px 10px" }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>👀 엄마 화면 미리보기</div>
          <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
            {([["now", "투숙중"], ["future", "예정"], ["all", "전체"]] as const).map(([k, v]) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "6px 0", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", border: tab === k ? "none" : "1px solid #e2e8f0", background: tab === k ? "#7c3aed" : "#fff", color: tab === k ? "#fff" : "#64748b" }}>{v} ({rows.filter(b => k === "now" ? staying(b) : k === "future" ? future(b) : true).length})</button>
            ))}
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 이름·학생·룸번호" style={{ width: "100%", boxSizing: "border-box", padding: "8px 11px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 12.5, outline: "none" }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 16px" }}>
          {shown.map(b => (
            <div key={b.id} onClick={() => pick(b)} style={{ padding: "10px 12px", borderRadius: 10, marginBottom: 6, cursor: "pointer", border: sel?.id === b.id ? "2px solid #7c3aed" : "1px solid #eef0f5", background: sel?.id === b.id ? "#f5f3ff" : "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800 }}>{b.booker_name || "-"}</span>
                {room(b) && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#4338ca", background: "#eef2ff", borderRadius: 6, padding: "1px 6px" }}>{room(b)}</span>}
                {staying(b) && <span style={{ fontSize: 10, fontWeight: 800, color: "#166534", background: "#f0fdf4", borderRadius: 6, padding: "1px 6px" }}>투숙중</span>}
              </div>
              <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 3 }}>{b.checkin_date?.slice(5)}~{b.checkout_date?.slice(5)} · {stuNames(b.students) || b.accom_type || ""}</div>
            </div>
          ))}
          {shown.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 12.5, padding: 30 }}>표시할 예약이 없습니다</div>}
        </div>
      </div>

      {/* 우측: 미리보기 */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
          {sel ? (<>
            <span style={{ fontSize: 13.5, fontWeight: 800 }}>👩 {sel.booker_name}님 화면</span>
            <span style={{ fontSize: 11.5, color: "#94a3b8" }}>엄마가 로그인해서 보는 것과 동일 · 엄마에게는 표시되지 않음</span>
            <button onClick={() => setFrameKey(k => k + 1)} style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>🔄 새로고침</button>
            <button onClick={() => setMobile(m => !m)} style={{ border: "1px solid #e2e8f0", background: mobile ? "#eef2ff" : "#f8fafc", color: mobile ? "#4338ca" : "#475569", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{mobile ? "📱 모바일" : "🖥 PC"}</button>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#dc2626", fontWeight: 700 }}>⚠ 이 화면에서 신청·수정하면 실제 반영됩니다 — 보기 전용으로만!</span>
          </>) : <span style={{ fontSize: 13, color: "#64748b" }}>왼쪽에서 엄마를 선택하면 그 엄마의 포털 화면이 여기 나타나요</span>}
        </div>
        <div style={{ flex: 1, overflow: "hidden", display: "flex", justifyContent: "center", background: mobile ? "#e2e8f0" : "#fff", padding: mobile && sel ? "14px 0" : 0 }}>
          {sel && (
            <iframe key={frameKey} src={`/portal/dashboard?admin_view=${sel.id}&t=${frameKey}`}
              style={{ border: mobile ? "1px solid #cbd5e1" : "none", borderRadius: mobile ? 18 : 0, width: mobile ? 420 : "100%", height: "100%", background: "#fff", boxShadow: mobile ? "0 8px 30px rgba(0,0,0,0.15)" : "none" }} />
          )}
        </div>
      </div>
    </div>
  );
}
