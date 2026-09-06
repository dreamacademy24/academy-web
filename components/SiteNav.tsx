"use client";
// 공개 페이지 공통 상단 네비게이션 (단일 소스)
// - 메뉴 항목은 NAV_ITEMS 한 곳만 수정하면 홈·주니어·킨더·패키지·숙소·플레이드림·공지·커뮤니티 전부 반영
// - 클래스는 sn- 접두사라 각 페이지 인라인 CSS와 충돌 없음. 높이 66px(모바일 56px) 고정 — 기존 페이지의 padding-top 기준과 동일
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getAdminInfo, clearAdminAuth } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export const KAKAO_CHAT_URL = "http://pf.kakao.com/_Yuhxhn/chat";

type NavItem = { label: string; href?: string; children?: { label: string; href: string }[]; pay?: boolean };

const NAV_ITEMS: NavItem[] = [
  { label: "커리큘럼", children: [
    { label: "주니어 커리큘럼", href: "/junior" },
    { label: "킨더 커리큘럼", href: "/kinder" },
  ]},
  { label: "올인원패키지", href: "/package" },
  { label: "숙소", children: [
    { label: "드림하우스 (독채)", href: "/accommodation/dreamhouse" },
    { label: "제이파크", href: "/accommodation/jpark" },
    { label: "큐브나인", href: "/accommodation/cubenine" },
  ]},
  { label: "플레이드림", href: "/playdream" },
  { label: "공지사항", href: "/notice" },
  { label: "커뮤니티", href: "/community" },
  { label: "결제", href: "/products", pay: true },
];

const CSS = `
.sn-nav{position:fixed;top:0;left:0;right:0;z-index:300;height:66px;display:flex;align-items:center;padding:0 40px;background:rgba(255,255,255,0.97);backdrop-filter:blur(12px);border-bottom:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.08);font-family:'Noto Sans KR',sans-serif;transition:box-shadow 200ms}
.sn-nav.sn-scrolled{box-shadow:0 2px 20px rgba(0,0,0,0.1)}
.sn-logo{flex-shrink:0;margin-right:32px;display:flex;align-items:center}
.sn-logo img{height:40px;width:auto;display:block}
.sn-center{display:flex;align-items:center;flex:1}
.sn-center>a,.sn-dd>a{color:#374151;font-size:14px;font-weight:500;padding:0 14px;height:66px;display:flex;align-items:center;gap:4px;transition:color 160ms;white-space:nowrap;cursor:pointer}
.sn-center>a:hover,.sn-dd>a:hover,.sn-center>a.sn-active,.sn-dd>a.sn-active{color:#1a6fc4}
.sn-center>a.sn-active{font-weight:700}
.sn-dd{position:relative}
.sn-dd-arrow{font-size:10px;transition:transform 200ms}
.sn-dd:hover .sn-dd-arrow{transform:rotate(180deg)}
.sn-dd-menu{position:absolute;top:66px;left:0;background:#fff;min-width:160px;border:1px solid #e2e8f0;border-top:2px solid #1a6fc4;box-shadow:0 8px 24px rgba(0,0,0,0.1);opacity:0;pointer-events:none;transform:translateY(-6px);transition:all 180ms}
.sn-dd:hover .sn-dd-menu{opacity:1;pointer-events:all;transform:translateY(0)}
.sn-dd-menu a{display:block;padding:11px 18px;font-size:13.5px;color:#374151;border-bottom:1px solid #e2e8f0;transition:background 140ms,color 140ms;white-space:nowrap}
.sn-dd-menu a:last-child{border-bottom:none}
.sn-dd-menu a:hover,.sn-dd-menu a.sn-active{background:#eaf3fb;color:#1a6fc4;font-weight:600}
.sn-center a.sn-pay{color:#1a6fc4;font-weight:700}
.sn-center a.sn-pay::before{content:"💳 "}
.sn-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
.sn-hello{font-size:13px;color:#374151;font-weight:600}
.sn-btn{background:none;border:1px solid #e2e8f0;border-radius:6px;padding:7px 14px;font-size:13px;color:#374151;font-weight:600;cursor:pointer;font-family:inherit}
.sn-btn.sn-muted{padding:6px 12px;font-size:12px;color:#94a3b8}
.sn-cta{background:#1a6fc4;color:#fff;font-size:13.5px;font-weight:600;padding:9px 20px;border-radius:4px;transition:background 160ms;white-space:nowrap}
.sn-cta:hover{background:#0d3d7a;color:#fff}
.sn-burger{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:4px;background:none;border:none}
.sn-burger span{width:22px;height:2px;background:#1a1a2e;display:block;border-radius:2px}
.sn-mob{display:none;position:fixed;top:66px;left:0;right:0;background:#fff;z-index:299;padding:16px 24px 24px;flex-direction:column;border-top:1px solid #e2e8f0;box-shadow:0 8px 24px rgba(0,0,0,0.1);font-family:'Noto Sans KR',sans-serif;max-height:calc(100vh - 66px);overflow-y:auto}
.sn-mob.sn-open{display:flex}
.sn-mob a{padding:12px 0;color:#374151;font-size:14px;border-bottom:1px solid #e2e8f0}
.sn-mob a.sn-active{color:#1a6fc4;font-weight:700}
.sn-mob a.sn-pay{color:#1a6fc4;font-weight:700}
.sn-mob a.sn-pay::before{content:"💳 "}
.sn-mob-acct{border-top:1px solid #e2e8f0;margin-top:8px;padding-top:8px}
.sn-mob-acct span,.sn-mob-acct a{display:block;padding:11px 0;font-size:13px;border:none}
@media(max-width:1024px){.sn-nav{padding:0 24px;height:56px}.sn-center,.sn-right{display:none}.sn-burger{display:flex}.sn-logo img{height:32px}.sn-mob{top:56px;max-height:calc(100vh - 56px)}}
`;

export default function SiteNav() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [adminInfo, setAdminInfo] = useState<{ name: string; role: string; staffId: string } | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);

  useEffect(() => {
    const info = getAdminInfo();
    if (info) { setAdminInfo(info); return; }
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      const fallback = data.user.email?.split("@")[0] || "회원";
      supabase.from("profiles").select("name").eq("id", data.user.id).single()
        .then(({ data: prof }) => setGuestName(prof?.name || fallback));
    });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href?: string) => !!href && (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const cls = (href?: string, extra?: string) => [extra, isActive(href) ? "sn-active" : ""].filter(Boolean).join(" ") || undefined;

  const logoutAdmin = () => { clearAdminAuth(); window.location.href = "/"; };
  const logoutGuest = async () => { await supabase.auth.signOut(); window.location.href = "/"; };

  return (
    <>
      <style>{CSS}</style>
      <nav className={`sn-nav${scrolled ? " sn-scrolled" : ""}`} id="mainNav">
        <a href="/" className="sn-logo"><img src="/logo.png" alt="드림아카데미" /></a>
        <div className="sn-center">
          {NAV_ITEMS.map((it) => it.children ? (
            <div className="sn-dd" key={it.label}>
              <a href="#" onClick={(e) => e.preventDefault()} className={it.children.some(c => isActive(c.href)) ? "sn-active" : undefined}>
                {it.label} <span className="sn-dd-arrow">▾</span>
              </a>
              <div className="sn-dd-menu">
                {it.children.map((c) => <a key={c.href} href={c.href} className={cls(c.href)}>{c.label}</a>)}
              </div>
            </div>
          ) : (
            <a key={it.href} href={it.href} className={cls(it.href, it.pay ? "sn-pay" : undefined)}>{it.label}</a>
          ))}
        </div>
        <div className="sn-right">
          {adminInfo ? (<>
            <span className="sn-hello">안녕하세요! {adminInfo.name}님</span>
            <button className="sn-btn sn-muted" onClick={logoutAdmin}>로그아웃</button>
            <a href="/admin/hub" className="sn-cta">관리페이지</a>
          </>) : guestName ? (<>
            <span className="sn-hello">안녕하세요! {guestName}님</span>
            <button className="sn-btn sn-muted" onClick={logoutGuest}>로그아웃</button>
            <a href="/portal/dashboard" className="sn-cta">마이페이지</a>
          </>) : (<>
            <a href="/login" className="sn-btn">로그인</a>
            <a href={KAKAO_CHAT_URL} className="sn-cta" target="_blank" rel="noopener noreferrer">상담하기</a>
          </>)}
        </div>
        <button className="sn-burger" aria-label="메뉴" aria-expanded={open} onClick={() => setOpen(v => !v)}>
          <span></span><span></span><span></span>
        </button>
      </nav>

      <div className={`sn-mob${open ? " sn-open" : ""}`} id="mobnav">
        {NAV_ITEMS.flatMap((it) => it.children
          ? it.children.map((c) => <a key={c.href} href={c.href} className={cls(c.href)}>{c.label}</a>)
          : [<a key={it.href} href={it.href} className={cls(it.href, it.pay ? "sn-pay" : undefined)}>{it.label}</a>]
        )}
        {adminInfo ? (
          <a href="/admin/hub" style={{ fontWeight: 700, color: "#1a6fc4" }}>관리페이지 →</a>
        ) : guestName ? (
          <a href="/portal/dashboard" style={{ fontWeight: 700, color: "#1a6fc4" }}>마이페이지 →</a>
        ) : (<>
          <a href="/login" style={{ fontWeight: 700, color: "#1a6fc4" }}>🔑 로그인 (마이페이지) →</a>
          <a href={KAKAO_CHAT_URL} target="_blank" rel="noopener noreferrer">상담하기 →</a>
        </>)}
        <div className="sn-mob-acct">
          {adminInfo ? (<>
            <span style={{ color: "#374151", fontWeight: 600 }}>안녕하세요! {adminInfo.name}님</span>
            <a href="#" onClick={(e) => { e.preventDefault(); logoutAdmin(); }} style={{ color: "#dc2626" }}>로그아웃</a>
          </>) : guestName ? (<>
            <span style={{ color: "#374151", fontWeight: 600 }}>안녕하세요! {guestName}님</span>
            <a href="#" onClick={(e) => { e.preventDefault(); logoutGuest(); }} style={{ color: "#dc2626" }}>로그아웃</a>
          </>) : (
            <a href="/admin" style={{ color: "#94a3b8", fontSize: 12 }}>직원 로그인</a>
          )}
        </div>
      </div>
    </>
  );
}
