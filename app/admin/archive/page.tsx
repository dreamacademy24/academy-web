"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";
import { toastOk, toastErr } from "@/lib/toast";

/* 지난 내역 보관함 — 날짜가 지난 신청을 모아 보고, 오래된 것은 기간 선택 후 일괄 삭제
   데이터는 옮기지 않고 그대로 둔 채 "지난 것"만 여기서 조회 (참석 아이 내역 보존용) */

type TabKey = "booking" | "cancelled" | "shuttle" | "fieldtrip" | "tutor" | "pickup" | "ocreq" | "consent";
type Row = Record<string, any>;

const pad2 = (n: number) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const monthsAgo = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() - m); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const fD = (s: string | null | undefined) => (s || "").slice(0, 10);

const TABS: { key: TabKey; label: string; dateLabel: string }[] = [
  { key: "booking", label: "📋 예약", dateLabel: "체크아웃" },
  { key: "cancelled", label: "🚫 취소예약", dateLabel: "체크인 예정일" },
  { key: "shuttle", label: "🚌 투어셔틀", dateLabel: "투어일" },
  { key: "fieldtrip", label: "🎒 애프터스쿨/필드트립", dateLabel: "신청일" },
  { key: "tutor", label: "👩‍🏫 튜터 수업", dateLabel: "종료일" },
  { key: "pickup", label: "🛬 픽드랍", dateLabel: "이동일" },
  { key: "ocreq", label: "💻 화상영어 변경", dateLabel: "신청일" },
  { key: "consent", label: "📝 동의 내역", dateLabel: "동의일" },
];

export default function ArchivePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<TabKey>("shuttle");
  const [rows, setRows] = useState<Record<TabKey, Row[]>>({ booking: [], cancelled: [], shuttle: [], fieldtrip: [], tutor: [], pickup: [], ocreq: [], consent: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  /* 삭제 도구 */
  const [delMonths, setDelMonths] = useState(6);
  const [delPreview, setDelPreview] = useState<Record<string, number> | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const today = todayStr();
    const [bk, cx, sh, ft, tu, pk, oc, cs] = await Promise.all([
      supabase.from("bookings").select("id, reservation_no, booker_name, checkin_date, checkout_date, accom_type, status, students").lt("checkout_date", today).order("checkout_date", { ascending: false }).limit(1000),
      supabase.from("bookings").select("id, reservation_no, booker_name, booker_phone, checkin_date, checkout_date, accom_type, status, students, updated_at").ilike("status", "%취소%").order("checkin_date", { ascending: false }).limit(1000),
      supabase.from("shuttle_applications").select("*").lt("tour_date", today).order("tour_date", { ascending: false }).limit(1000),
      supabase.from("fieldtrip_applications").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("tutor_requests").select("id, student_name_kr, student_name_en, class_type, start_date, end_date, status, created_at, house_or_reserver").lt("end_date", today).order("end_date", { ascending: false }).limit(1000),
      supabase.from("pickup_requests").select("*").lt("request_date", today).order("request_date", { ascending: false }).limit(1000),
      supabase.from("online_change_requests").select("*").neq("status", "pending").order("created_at", { ascending: false }).limit(500),
      supabase.from("booking_consents").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);
    setRows({
      booking: (bk.data || []).filter((r: Row) => String(r.status || "").indexOf("취소") < 0),
      cancelled: cx.data || [],
      shuttle: sh.data || [],
      fieldtrip: (ft.data || []).filter((r: Row) => fD(r.created_at) < today),
      tutor: tu.data || [],
      pickup: pk.data || [],
      ocreq: oc.data || [],
      consent: cs.data || [],
    });
    setLoading(false);
  }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);

  /* 행 → 표시 텍스트 (탭별) */
  function rowView(t: TabKey, r: Row): { date: string; who: string; detail: string; status: string } {
    if (t === "consent") {
      const hol = Array.isArray(r.holidays_notified) ? r.holidays_notified.map((h: Row) => h.date).join(", ") : "";
      return { date: fD(r.created_at), who: `${r.booker_name || "-"} (${(r.reservation_no || "").slice(-6)})`, detail: `규정 v${r.policy_version || "-"} · ${(r.policy_keys || []).join("+")} · "${(r.agreed_text || "").slice(0, 30)}…"${hol ? ` · 휴일안내: ${hol}` : ""}`, status: "동의" };
    }
    if (t === "cancelled") {
      let stu = "";
      try { const a2 = typeof r.students === "string" ? JSON.parse(r.students) : r.students; if (Array.isArray(a2)) stu = a2.map((s: Row) => s.korName || s.name_kr || "").filter(Boolean).join(", "); } catch {}
      return { date: fD(r.checkin_date), who: `${r.booker_name || "-"} (${(r.reservation_no || "").slice(-6)})`, detail: `${stu ? `👧 ${stu} · ` : ""}${r.accom_type || ""} · ${fD(r.checkin_date)}~${fD(r.checkout_date)}${r.booker_phone ? ` · 📞${r.booker_phone}` : ""}`, status: r.status || "취소" };
    }
    if (t === "booking") {
      let stu = "";
      try { const a = typeof r.students === "string" ? JSON.parse(r.students) : r.students; if (Array.isArray(a)) stu = a.map((s: Row) => s.korName || s.name_kr || "").filter(Boolean).join(", "); } catch {}
      return { date: fD(r.checkout_date), who: `${r.booker_name || "-"} (${(r.reservation_no || "").slice(-6)})`, detail: `${stu ? `👧 ${stu} · ` : ""}${r.accom_type || ""} · ${fD(r.checkin_date)}~${fD(r.checkout_date)}`, status: r.status || "-" };
    }
    if (t === "shuttle") return { date: fD(r.tour_date), who: `${r.portal_name || "-"} 🏠${r.room_number || "-"}`, detail: `${r.tour_name || ""} · ${r.people_count || "-"}명${r.riders ? ` · ${typeof r.riders === "string" ? r.riders : JSON.stringify(r.riders)}` : ""}`, status: r.status || "-" };
    if (t === "fieldtrip") return { date: fD(r.created_at), who: `${r.name || "-"} 🏠${r.room_number || "-"}`, detail: String(r.date || ""), status: r.status || "-" };
    if (t === "tutor") return { date: fD(r.end_date), who: r.student_name_en || r.student_name_kr || "-", detail: `${r.class_type || ""} · ${fD(r.start_date)}~${fD(r.end_date)} · ${r.house_or_reserver || ""}`, status: r.status || "-" };
    if (t === "pickup") return { date: fD(r.request_date), who: r.guest_name || r.booker_name || "-", detail: `${r.request_type || ""} · ${r.location || ""} → ${r.destination || ""}`, status: r.status || "-" };
    return { date: fD(r.created_at), who: r.customer_user_id || "-", detail: `${(r.req_days_of_week || []).join("/")} ${r.req_time_kr || ""} (적용 ${fD(r.effective_from)})`, status: r.status || "-" };
  }

  const filtered = useMemo(() => {
    const list = rows[tab] || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(r => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, tab, search]);

  /* 월별 그룹 (최근 월부터) */
  const monthGroups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of filtered) {
      const d = rowView(tab, r).date || "0000-00";
      const mk = d.slice(0, 7);
      if (!m.has(mk)) m.set(mk, []);
      m.get(mk)!.push(r);
    }
    return Array.from(m.entries());
  }, [filtered, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───── 삭제 도구 ───── */
  async function previewDelete() {
    const cutoff = monthsAgo(delMonths);
    const cnt = async (q: PromiseLike<{ count: number | null }>) => ((await q).count ?? 0);
    const [a, b, c, d, e] = await Promise.all([
      cnt(supabase.from("shuttle_applications").select("id", { count: "exact", head: true }).lt("tour_date", cutoff)),
      cnt(supabase.from("fieldtrip_applications").select("id", { count: "exact", head: true }).lt("created_at", cutoff)),
      cnt(supabase.from("tutor_requests").select("id", { count: "exact", head: true }).lt("end_date", cutoff)),
      cnt(supabase.from("pickup_requests").select("id", { count: "exact", head: true }).lt("request_date", cutoff)),
      cnt(supabase.from("online_change_requests").select("id", { count: "exact", head: true }).lt("created_at", cutoff).neq("status", "pending")),
    ]);
    setDelPreview({ "투어셔틀": a, "애프터스쿨/필드트립": b, "튜터 수업": c, "픽드랍": d, "화상영어 변경": e });
  }

  async function runDelete() {
    if (!delPreview) return;
    const total = Object.values(delPreview).reduce((s, n) => s + n, 0);
    if (total === 0) { toastErr("삭제할 내역이 없습니다"); return; }
    const cutoff = monthsAgo(delMonths);
    const typed = window.prompt(`⚠️ ${cutoff} 이전 내역 총 ${total}건을 영구 삭제합니다.\n되돌릴 수 없습니다. 계속하려면 "삭제"라고 입력하세요.`);
    if (typed !== "삭제") { toastErr("취소되었습니다"); return; }
    setDeleting(true);
    try {
      // 튜터: 연결된 수업/세션 먼저 정리 (고아 데이터 방지)
      const { data: oldReqs } = await supabase.from("tutor_requests").select("id").lt("end_date", cutoff);
      const reqIds = (oldReqs || []).map(r => r.id);
      if (reqIds.length > 0) {
        const { data: lessons } = await supabase.from("tutor_lessons").select("id").in("application_id", reqIds);
        const lessonIds = (lessons || []).map(l => l.id);
        if (lessonIds.length > 0) {
          await supabase.from("tutor_lesson_sessions").delete().in("lesson_id", lessonIds);
          await supabase.from("tutor_lessons").delete().in("id", lessonIds);
        }
        await supabase.from("tutor_requests").delete().in("id", reqIds);
      }
      await supabase.from("shuttle_applications").delete().lt("tour_date", cutoff);
      await supabase.from("fieldtrip_applications").delete().lt("created_at", cutoff);
      await supabase.from("pickup_requests").delete().lt("request_date", cutoff);
      await supabase.from("online_change_requests").delete().lt("created_at", cutoff).neq("status", "pending");
      toastOk(`삭제 완료 — ${total}건 정리됨`);
      setDelPreview(null);
      load();
    } catch (e) {
      toastErr("삭제 중 오류: " + (e instanceof Error ? e.message : "unknown"));
    } finally { setDeleting(false); }
  }

  if (!authed) return null;

  const ST_COLOR: Record<string, { bg: string; c: string }> = {
    confirmed: { bg: "#dcfce7", c: "#166534" }, approved: { bg: "#dcfce7", c: "#166534" }, 확정: { bg: "#dcfce7", c: "#166534" },
    cancelled: { bg: "#fef2f2", c: "#dc2626" }, rejected: { bg: "#fef2f2", c: "#dc2626" }, 취소: { bg: "#fef2f2", c: "#dc2626" },
    pending: { bg: "#fef3c7", c: "#92400e" },
  };

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.aw{max-width:980px;margin:0 auto;padding:24px 16px 60px}
.top{display:flex;align-items:center;gap:10px;margin-bottom:4px}
.back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.back:hover{background:#e2e8f0}
.top h1{font-size:20px;font-weight:800;flex:1}
.sub{font-size:13px;color:#6b7c93;margin:0 0 16px 46px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.tab{padding:9px 14px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;font-size:13px;font-weight:700;color:#64748b;cursor:pointer;font-family:inherit}
.tab.ac{background:#475569;border-color:#475569;color:#fff}
.tab .n{margin-left:5px;font-size:11px;background:#f1f5f9;border-radius:8px;padding:1px 6px;color:#64748b}
.tab.ac .n{background:rgba(255,255,255,0.25);color:#fff}
.toolbar{display:flex;gap:8px;margin-bottom:12px;align-items:center;flex-wrap:wrap}
.toolbar input{padding:9px 12px;border:1px solid #e2e8f0;border-radius:9px;font-size:13px;font-family:inherit;outline:none;min-width:200px;background:#fff}
.mh{background:#475569;color:#fff;border-radius:10px;padding:9px 14px;font-size:13.5px;font-weight:800;margin:14px 0 8px;display:flex;justify-content:space-between}
.row{background:#fff;border:1px solid #eef2f7;border-radius:10px;padding:10px 14px;margin-bottom:5px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px}
.row .dt{font-weight:800;min-width:84px}
.row .who{font-weight:700}
.row .det{color:#6b7c93;font-size:12px;flex:1;min-width:140px}
.badge{font-size:11px;font-weight:700;padding:2px 9px;border-radius:9px}
.empty{color:#cbd5e1;text-align:center;padding:50px 0;font-size:14px}
.del-card{background:#fff;border:1.5px solid #fecaca;border-radius:13px;padding:16px 18px;margin-bottom:18px}
.del-card h2{font-size:14.5px;font-weight:800;color:#dc2626;margin-bottom:8px}
.del-card select{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;background:#fff}
.del-btn{padding:9px 16px;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
@media(max-width:600px){.aw{padding:12px 8px 40px}.row .det{flex-basis:100%}}
    `}</style>
    <div className="aw">
      <div className="top">
        <button className="back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>🗄 지난 내역 보관함</h1>
        <button className="back" title="새로고침" onClick={load}>🔄</button>
      </div>
      <div className="sub">날짜가 지난 신청 내역 — 참석 아이·방 정보가 그대로 보존됩니다. 오래된 내역은 아래에서 일괄 삭제.</div>

      {/* 삭제 도구 */}
      <div className="del-card">
        <h2>🗑 오래된 내역 일괄 삭제</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={delMonths} onChange={e => { setDelMonths(Number(e.target.value)); setDelPreview(null); }}>
            <option value={3}>3개월 지난 내역</option>
            <option value={6}>6개월 지난 내역</option>
            <option value={12}>12개월 지난 내역</option>
          </select>
          <button className="del-btn" style={{ background: "#f1f5f9", color: "#475569" }} onClick={previewDelete}>건수 미리보기</button>
          {delPreview && (
            <button className="del-btn" style={{ background: "#dc2626", color: "#fff" }} disabled={deleting} onClick={runDelete}>
              {deleting ? "삭제 중..." : `영구 삭제 (총 ${Object.values(delPreview).reduce((s, n) => s + n, 0)}건)`}
            </button>
          )}
        </div>
        {delPreview && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#475569", display: "flex", gap: 14, flexWrap: "wrap" }}>
            {Object.entries(delPreview).map(([k, v]) => <span key={k}>{k}: <b style={{ color: v > 0 ? "#dc2626" : "#94a3b8" }}>{v}건</b></span>)}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 8 }}>※ 삭제는 되돌릴 수 없어요. 튜터 내역은 연결된 수업·출결 기록도 함께 정리됩니다. <b>예약(📋)은 학생·정산·인보이스가 연결돼 있어 일괄 삭제에서 제외</b> — 필요 시 예약관리에서 개별 삭제하세요.</div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tab${tab === t.key ? " ac" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}<span className="n">{(rows[t.key] || []).length}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <input placeholder="이름 · 방 번호 · 프로그램 검색" value={search} onChange={e => setSearch(e.target.value)} />
        <span style={{ fontSize: 12.5, color: "#6b7c93" }}>{filtered.length}건 · {TABS.find(t => t.key === tab)?.dateLabel} 기준</span>
      </div>

      {loading ? <div className="empty">불러오는 중…</div> :
        monthGroups.length === 0 ? <div className="empty">지난 내역이 없습니다</div> :
        monthGroups.map(([mk, list]) => (
          <div key={mk}>
            <div className="mh"><span>📅 {mk.replace("-", "년 ")}월</span><span>{list.length}건</span></div>
            {list.map((r, i) => {
              const v = rowView(tab, r);
              const sc = ST_COLOR[v.status] || { bg: "#f1f5f9", c: "#64748b" };
              return (
                <div className="row" key={r.id ?? i}>
                  <span className="dt">{v.date}</span>
                  <span className="who">{v.who}</span>
                  <span className="det">{v.detail}</span>
                  <span className="badge" style={{ background: sc.bg, color: sc.c }}>{v.status}</span>
                </div>
              );
            })}
          </div>
        ))}
    </div>
  </>);
}
