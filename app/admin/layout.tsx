"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Item = { label: string; href: string; ext?: boolean; badge?: number };
const NAV: { title: string; items: Item[] }[] = [
  { title: "직원업무", items: [
    { label: "직원업무 홈", href: "/staff?page=home", ext: true },
    { label: "공지사항", href: "/staff?page=announcements", ext: true },
    { label: "내 업무", href: "/staff?page=mywork", ext: true },
    { label: "전체 업무", href: "/staff?page=board", ext: true },
    { label: "달력", href: "/staff?page=calendar", ext: true },
    { label: "업무자료", href: "/staff?page=manual", ext: true },
    { label: "안내문구", href: "/staff?page=guide", ext: true },
  ]},
  { title: "예약 · 아카데미", items: [
    { label: "예약 관리", href: "/admin/bookings" },
    { label: "정산 관리", href: "/admin/settlement" },
    { label: "튜터 수업", href: "/admin/tutor-class" },
    { label: "화상영어", href: "/admin/online-class" },
    { label: "SSP 관리", href: "/admin/ssp" },
    { label: "상담 예약", href: "/admin/consultations" },
    { label: "애프터스쿨/필드트립", href: "/admin/afterschool-fieldtrip" },
    { label: "동의서함", href: "/admin/consents" },
    { label: "공지 배포", href: "/admin/notices" },
    { label: "지난 내역 보관함", href: "/admin/archive" },
  ]},
  { title: "드림하우스", items: [
    { label: "드림하우스 룸", href: "/dreamhouse-rooms", ext: true },
    { label: "식단 관련 업무", href: "/admin/meal-plan" },
    { label: "하우스 보고", href: "/admin/house-reports" },
    { label: "투어셔틀 관리", href: "/admin/tour-shuttle" },
    { label: "셔틀·기사 관리", href: "/admin/shuttle-management" },
    { label: "체크인 디테일", href: "/admin/checkin-details" },
    { label: "시재 관리", href: "/admin/cash-ledger" },
  ]},
  { title: "리조트", items: [
    { label: "인보이스 생성", href: "/admin/resort-invoice" },
    { label: "결제내역", href: "/admin/resort-payments" },
  ]},
  { title: "현지직원", items: [
    { label: "Local Staff Hub", href: "/admineng/hub", ext: true },
    { label: "Shuttle Schedule", href: "/ashuttle", ext: true },
  ]},
  { title: "기타 업무", items: [
    { label: "직원 가이드", href: "/staff-guide.html", ext: true },
    { label: "자료모음", href: "/admin/resources" },
    { label: "사이트 관리", href: "/admin/site" },
    { label: "민에듀 공구", href: "/admin/minedu" },
  ]},
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState(false);
  const [viewSrc, setViewSrc] = useState("");
  const [framed, setFramed] = useState(false);
  const [tutorAlerts, setTutorAlerts] = useState(0);
  const [roomAlerts, setRoomAlerts] = useState(0);

  useEffect(() => {
    try { setFramed(window.self !== window.top); } catch { setFramed(true); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { count } = await supabase.from("tutor_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "reviewing", "cancel_requested"]);
        let cancelN = 0;
        try {
          const r = await fetch("/api/admin/tutor/cancel-requests?status=pending");
          if (r.ok) { const d = await r.json(); cancelN = Array.isArray(d) ? d.length : 0; }
        } catch {}
        setTutorAlerts((count || 0) + cancelN);
      } catch {}
      try {
        const { data } = await supabase.from("bookings").select("accom_type,house_no,accom_room,status,checkout_date");
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const n = (data || []).filter((b: { accom_type?: string; house_no?: string; accom_room?: string; status?: string; checkout_date?: string }) => (b.accom_type || "").includes("드림하우스") && !String(b.house_no || b.accom_room || "").trim() && !(b.status || "").includes("취소") && (!b.checkout_date || String(b.checkout_date).slice(0, 10) >= today)).length;
        setRoomAlerts(n);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const init: Record<string, boolean> = {};
    const sp = typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("src") || "") : "";
    NAV.forEach(g => { init[g.title] = g.items.some(it => it.ext ? (pathname === "/admin/view" && sp === it.href) : (pathname === it.href || pathname.startsWith(it.href + "/"))); });
    setOpen(init);
    if (typeof window !== "undefined") setViewSrc(new URLSearchParams(window.location.search).get("src") || "");
    if (typeof window !== "undefined" && window.innerWidth < 900) setHidden(true);
  }, [pathname]);

  if (framed) return <>{children}</>;

  const isView = pathname === "/admin/view";
  const badgeFor = (it: Item) => it.href === "/admin/bookings" ? roomAlerts : it.href === "/admin/tutor-class" ? tutorAlerts : 0;
  const active = (it: Item) => it.ext
    ? (isView && viewSrc === it.href)
    : (!isView && (pathname === it.href || pathname.startsWith(it.href + "/")));
  const todayOn = !isView && pathname === "/admin/today";

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif" }}>
      <style>{`@media print{.admin-noprint{display:none!important}.admin-main{height:auto!important;overflow:visible!important}}`}</style>
      {!hidden && (
        <aside className="admin-noprint" style={{ width: 224, flexShrink: 0, background: "#3a47a8", color: "#eef0fc", height: "100vh", position: "sticky", top: 0, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.16)" }}>
            <Link href="/admin/today" style={{ fontSize: 15, fontWeight: 800, color: "#fff", textDecoration: "none" }}>DREAM <span style={{ color: "#FFD54A" }}>WORKSPACE</span></Link>
            <button onClick={() => setHidden(true)} title="사이드바 숨기기" style={{ background: "none", border: "none", color: "#c5cbf2", cursor: "pointer", fontSize: 18 }}>‹</button>
          </div>
          <Link href="/admin/today" style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 18px", fontSize: 15, fontWeight: 700, color: todayOn ? "#fff" : "#eef0fc", textDecoration: "none", background: todayOn ? "rgba(255,255,255,0.20)" : "transparent", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>📅 오늘 한눈에</Link>
          {NAV.map(g => (
            <div key={g.title}>
              <div onClick={() => setOpen(o => ({ ...o, [g.title]: !o[g.title] }))}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", fontSize: 15, fontWeight: 800, color: "#fff", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.12)", background: open[g.title] ? "rgba(0,0,0,0.14)" : "transparent" }}>
                {g.title} <span style={{ color: open[g.title] ? "#FFD54A" : "#c5cbf2", fontSize: 12 }}>{open[g.title] ? "▲" : "▼"}</span>
              </div>
              {open[g.title] && g.items.map(it => {
                const on = active(it);
                const bdg = badgeFor(it);
                const style: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px 11px 30px", fontSize: 14.5, fontWeight: on ? 700 : 500, textDecoration: "none", color: on ? "#fff" : "#dfe2fa", background: on ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.07)", borderBottom: "1px solid rgba(255,255,255,0.06)" };
                const to = it.ext ? `/admin/view?src=${encodeURIComponent(it.href)}` : it.href;
                return (
                  <Link key={it.href} href={to} onClick={() => it.ext && setViewSrc(it.href)} style={style}>
                    <span>{it.label}</span>
                    {bdg > 0 && <span style={{ minWidth: 19, height: 19, padding: "0 5px", fontSize: 11, fontWeight: 800, color: "#fff", background: "#e23b3b", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }}>❗{bdg}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
          <div style={{ height: 24 }} />
        </aside>
      )}
      <main className="admin-main" style={{ flex: 1, minWidth: 0, overflow: "auto", height: "100vh", position: "relative" }}>
        {hidden && (
          <button className="admin-noprint" onClick={() => setHidden(false)} title="메뉴 열기" style={{ position: "sticky", top: 8, left: 8, zIndex: 50, background: "#3a47a8", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 14, margin: 8 }}>☰ 메뉴</button>
        )}
        {children}
      </main>
    </div>
  );
}
