"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { label: string; href: string; ext?: boolean };
const NAV: { title: string; items: Item[] }[] = [
  { title: "직원업무", items: [
    { label: "직원업무 홈", href: "/staff", ext: true },
    { label: "직원 가이드", href: "/staff-guide.html", ext: true },
    { label: "자료모음", href: "/admin/resources" },
    { label: "사이트 관리", href: "/admin/site" },
    { label: "민에듀 공구", href: "/admin/minedu" },
  ]},
  { title: "예약 · 아카데미", items: [
    { label: "오늘 한눈에", href: "/admin/today" },
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
  { title: "현지직원", items: [
    { label: "Local Staff Hub", href: "/admineng/hub", ext: true },
    { label: "Shuttle Schedule", href: "/ashuttle", ext: true },
  ]},
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isHub = pathname === "/admin/hub";
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const init: Record<string, boolean> = {};
    NAV.forEach(g => { init[g.title] = g.items.some(it => pathname === it.href || pathname.startsWith(it.href + "/")); });
    setOpen(init);
    if (typeof window !== "undefined" && window.innerWidth < 900) setHidden(true);
  }, [pathname]);

  // 허브(카드 홈)는 사이드바 없이 기존 그대로
  if (isHub) return <>{children}</>;

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Apple SD Gothic Neo','Noto Sans KR',sans-serif" }}>
      {!hidden && (
        <aside style={{ width: 210, flexShrink: 0, background: "#33373F", color: "#D7DAE0", height: "100vh", position: "sticky", top: 0, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 14px", borderBottom: "1px solid #43474F" }}>
            <Link href="/admin/hub" style={{ fontSize: 13, fontWeight: 700, color: "#fff", textDecoration: "none" }}>DREAM <span style={{ color: "#FFCB36" }}>WORKSPACE</span></Link>
            <button onClick={() => setHidden(true)} title="사이드바 숨기기" style={{ background: "none", border: "none", color: "#8b909a", cursor: "pointer", fontSize: 16 }}>‹</button>
          </div>
          <Link href="/admin/hub" style={{ display: "block", padding: "10px 16px", fontSize: 12.5, color: "#c4c8d0", textDecoration: "none", borderBottom: "1px solid #3c4048" }}>← 관리자 홈(카드)</Link>
          {NAV.map(g => (
            <div key={g.title}>
              <div onClick={() => setOpen(o => ({ ...o, [g.title]: !o[g.title] }))}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", borderBottom: "1px solid #3c4048", background: open[g.title] ? "#2b2e35" : "transparent" }}>
                {g.title} <span style={{ color: open[g.title] ? "#FFCB36" : "#8b909a", fontSize: 11 }}>{open[g.title] ? "▲" : "▼"}</span>
              </div>
              {open[g.title] && g.items.map(it => {
                const on = active(it.href);
                const style: React.CSSProperties = { display: "block", padding: "9px 16px 9px 28px", fontSize: 12.5, textDecoration: "none", color: on ? "#fff" : "#c4c8d0", background: on ? "#1f6fc4" : "#2b2e35" };
                return it.ext
                  ? <a key={it.href} href={it.href} style={style}>{it.label}</a>
                  : <Link key={it.href} href={it.href} style={style}>{it.label}</Link>;
              })}
            </div>
          ))}
          <div style={{ height: 20 }} />
        </aside>
      )}
      <main style={{ flex: 1, minWidth: 0, overflow: "auto", height: "100vh", position: "relative" }}>
        {hidden && (
          <button onClick={() => setHidden(false)} title="메뉴 열기" style={{ position: "sticky", top: 8, left: 8, zIndex: 50, background: "#33373F", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 14, margin: 8 }}>☰ 메뉴</button>
        )}
        {children}
      </main>
    </div>
  );
}
