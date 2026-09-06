"use client";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    // Intersection Observer for fade animations
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((el) => {
        if (el.isIntersecting) el.target.classList.add('vis');
      }),
      { threshold: 0.07 }
    );
    document.querySelectorAll('.fade').forEach((el) => obs.observe(el));

    // Tab switching
    const tabs = document.querySelectorAll('.curr-tab');
    tabs.forEach((tab) => {
      const tabId = tab.getAttribute('data-tab');
      if (tabId) {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.curr-tab').forEach((t) => t.classList.remove('active'));
          document.querySelectorAll('.curr-panel').forEach((p) => p.classList.remove('active'));
          tab.classList.add('active');
          const panel = document.getElementById('tab-' + tabId);
          if (panel) panel.classList.add('active');
        });
      }
    });

    // FAQ accordion
    document.querySelectorAll('.faq-q').forEach((btn) => {
      btn.addEventListener('click', () => {
        const a = btn.nextElementSibling;
        const arrow = btn.querySelector('.faq-arrow');
        if (a && arrow) {
          const isOpen = a.classList.contains('open');
          document.querySelectorAll('.faq-a').forEach(el => el.classList.remove('open'));
          document.querySelectorAll('.faq-arrow').forEach(el => el.classList.remove('open'));
          if (!isOpen) { a.classList.add('open'); arrow.classList.add('open'); }
        }
      });
    });

    return () => {
      obs.disconnect();
    };

  }, []);

  return (
    <>
      <style>{`
    :root {
      --blue: #1a6fc4;
      --blue-dark: #0d3d7a;
      --blue-light: #eaf3fb;
      --yellow: #f5a623;
      --sky: #29a9e0;
      --white: #ffffff;
      --off: #f8fafc;
      --text: #1a1a2e;
      --muted: #6b7c93;
      --light-muted: #94a3b8;
      --stroke: #e2e8f0;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
      --shadow: 0 8px 40px rgba(0,0,0,0.09);
      --shadow-lg: 0 20px 60px rgba(26,111,196,0.13);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { font-family: 'Noto Sans KR', sans-serif; color: var(--text); background: var(--white); overflow-x: hidden; line-height: 1.7; }
    a { text-decoration: none; color: inherit; }

    /* ── NAV: 흰 배경, benuity 스타일 ── */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 300;
      height: 66px; display: flex; align-items: center;
      padding: 0 40px;
      background: rgba(255,255,255,0.97);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--stroke);
      box-shadow: var(--shadow-sm);
      gap: 0;
    }
    .logo { flex-shrink: 0; margin-right: 32px; display: flex; align-items: center; }
    .logo img { height: 40px; width: auto; display: block; }
    /* 가운데 메뉴 */
    .nav-center { display: flex; align-items: center; flex: 1; }
    .nav-center > a { color: #374151; font-family: 'Noto Sans KR', sans-serif; font-size: 14px; font-weight: 500; padding: 0 14px; height: 66px; display: flex; align-items: center; transition: color 160ms; white-space: nowrap; }
    .nav-center > a:hover { color: var(--blue); }
    .nav-dd { position: relative; }
    .nav-dd > a { color: #374151; font-family: 'Noto Sans KR', sans-serif; font-size: 14px; font-weight: 500; padding: 0 14px; height: 66px; display: flex; align-items: center; gap: 4px; transition: color 160ms; cursor: pointer; white-space: nowrap; }
    .nav-dd > a:hover { color: var(--blue); }
    .nav-dd-arrow { font-size: 10px; transition: transform 200ms; }
    .nav-dd:hover .nav-dd-arrow { transform: rotate(180deg); }
    .nav-dd-menu {
      position: absolute; top: 66px; left: 0;
      background: var(--white); min-width: 160px;
      border: 1px solid var(--stroke); border-top: 2px solid var(--blue);
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
      opacity: 0; pointer-events: none; transform: translateY(-6px);
      transition: all 180ms;
    }
    .nav-dd:hover .nav-dd-menu { opacity: 1; pointer-events: all; transform: translateY(0); }
    .nav-dd-menu a { display: block; padding: 11px 18px; font-size: 13.5px; color: #374151; border-bottom: 1px solid var(--stroke); transition: background 140ms, color 140ms; white-space: nowrap; }
    .nav-dd-menu a:last-child { border-bottom: none; }
    .nav-dd-menu a:hover { background: var(--blue-light); color: var(--blue); }
    /* 오른쪽 CTA */
    .nav-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .nav-cta { background: var(--blue); color: var(--white); font-size: 13.5px; font-weight: 600; padding: 9px 20px; border-radius: 4px; transition: background 160ms; white-space: nowrap; }
    .nav-cta:hover { background: var(--blue-dark); color: var(--white); }
    .nav-center a.nav-pay { color: var(--blue); font-weight: 700; }
    .nav-center a.nav-pay::before { content: "💳 "; }
    .hamburger { display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 4px; }
    .hamburger span { width: 22px; height: 2px; background: var(--text); display: block; border-radius: 2px; }
    .mob-nav { display: none; position: fixed; top: 66px; left: 0; right: 0; background: var(--white); z-index: 299; padding: 16px 24px 24px; flex-direction: column; border-top: 1px solid var(--stroke); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
    .mob-nav.open { display: flex; }
    .mob-nav a { padding: 12px 0; color: #374151; font-size: 14px; border-bottom: 1px solid var(--stroke); }
    .mob-nav a:last-child { color: var(--blue); font-weight: 600; border: none; margin-top: 8px; }

    /* ── HERO: 밝고 깔끔한 흰색 배경 ── */
    .hero {
      min-height: 100vh; padding-top: 66px;
      background: linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(238,245,252,0.94) 100%);
      display: flex; align-items: center; position: relative; overflow: hidden;
    }
    .hero-photo {
      position: absolute; inset: 0; z-index: 0;
      background: url("/images/academymain.jpg") center/cover no-repeat;
      opacity: 0.08;
    }
    .hero-circle1 { position: absolute; top: -120px; right: -120px; width: 560px; height: 560px; border-radius: 50%; background: radial-gradient(circle, rgba(26,111,196,0.07) 0%, transparent 65%); pointer-events: none; }
    .hero-circle2 { position: absolute; bottom: -80px; left: -80px; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(41,169,224,0.06) 0%, transparent 65%); pointer-events: none; }
    .hero-inner { max-width: 1200px; margin: 0 auto; padding: 80px 60px 100px; width: 100%; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 64px; align-items: center; position: relative; z-index: 2; }
    .hero-tag { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: var(--blue); margin-bottom: 18px; display: flex; align-items: center; gap: 10px; }
    .hero-tag::before { content: ''; width: 28px; height: 2px; background: var(--blue); border-radius: 2px; }
    .hero-h1 { font-size: clamp(36px, 4vw, 56px); font-weight: 800; color: var(--text); line-height: 1.18; margin-bottom: 12px; letter-spacing: -0.025em; word-break: keep-all; }
    .hero-h1 .blue { color: var(--blue); }
    .hero-slogan { font-family: 'Montserrat', sans-serif; font-size: 13px; color: var(--light-muted); margin-bottom: 14px; font-style: italic; letter-spacing: 0.04em; }
    .hero-sub { font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 10px; }
    .hero-desc { font-size: 15px; color: var(--muted); line-height: 1.9; margin-bottom: 36px; word-break: keep-all; }
    .hero-btns { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn-blue { display: inline-flex; align-items: center; gap: 7px; background: var(--blue); color: var(--white); font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 14px 28px; border-radius: 4px; transition: background 160ms, transform 140ms, box-shadow 160ms; box-shadow: 0 4px 18px rgba(26,111,196,0.3); }
    .btn-blue:hover { background: var(--blue-dark); transform: translateY(-1px); box-shadow: 0 8px 28px rgba(26,111,196,0.35); }
    .btn-outline { display: inline-flex; align-items: center; gap: 7px; border: 1.5px solid var(--stroke); color: var(--muted); font-family: 'Montserrat', sans-serif; font-size: 12px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; padding: 14px 28px; border-radius: 4px; transition: border-color 160ms, color 160ms; }
    .btn-outline:hover { border-color: var(--blue); color: var(--blue); }
    .hero-right { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .hcard { background: var(--white); border: 1px solid var(--stroke); padding: 22px 18px; border-radius: 12px; box-shadow: var(--shadow); transition: transform 200ms, box-shadow 200ms; }
    .hcard:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
    .hcard-icon { font-size: 28px; margin-bottom: 10px; }
    .hcard-t { font-size: 13.5px; font-weight: 700; color: var(--text); margin-bottom: 5px; }
    .hcard-d { font-size: 13px; color: var(--muted); line-height: 1.6; word-break: keep-all; }
    .hero-scroll { position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%); color: var(--text); font-family: 'Montserrat', sans-serif; font-size: 9px; letter-spacing: 0.25em; text-transform: uppercase; display: flex; flex-direction: column; align-items: center; gap: 5px; animation: sb 2.2s infinite; text-shadow: 0 1px 4px rgba(255,255,255,0.8); opacity: 0.5; }
    .hero-scroll::after { content: '↓'; font-size: 12px; }
    @keyframes sb { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(7px)} }

    /* ── SECTIONS ── */
    .sec { padding: 88px 60px; max-width: 1200px; margin: 0 auto; }
    .sec-bg { background: var(--off); }
    .sec-bg-i { max-width: 1200px; margin: 0 auto; padding: 88px 60px; }
    .sec-dark { background: var(--blue-dark); }
    .sec-dark-i { max-width: 1200px; margin: 0 auto; padding: 88px 60px; }
    .stag { font-family: 'Montserrat', sans-serif; font-size: 10.5px; font-weight: 600; letter-spacing: 0.28em; text-transform: uppercase; color: var(--blue); margin-bottom: 11px; display: flex; align-items: center; gap: 9px; }
    .stag::before { content: ''; width: 22px; height: 2px; background: var(--blue); border-radius: 2px; }
    .stag.lt { color: rgba(255,255,255,0.7); } .stag.lt::before { background: rgba(255,255,255,0.4); }
    .sh { font-size: clamp(26px,3vw,40px); font-weight: 800; line-height: 1.22; letter-spacing: -0.022em; margin-bottom: 12px; word-break: keep-all; }
    .sh .bl { color: var(--blue); } .sh .yl { color: var(--yellow); } .sh.wh { color: var(--white); }
    .sp { font-size: 14.5px; color: var(--muted); line-height: 1.9; max-width: 540px; word-break: keep-all; }
    .sp.wh { color: rgba(255,255,255,0.6); }
    .divb { width: 44px; height: 3px; background: var(--blue); margin: 14px 0 24px; border-radius: 2px; }
    .divy { width: 44px; height: 3px; background: var(--yellow); margin: 14px 0 24px; border-radius: 2px; }

    /* ABOUT */
    .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; }
    .about-features { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-top: 32px; }
    .af { padding: 18px; border: 1px solid var(--stroke); border-radius: 10px; transition: box-shadow 200ms; border-left: 4px solid var(--blue); }
    .af:hover { box-shadow: var(--shadow); }
    .af.af-green { border-left-color: #2da84e; }
    .af.af-yellow { border-left-color: #f5a623; }
    .af.af-red { border-left-color: #e53e3e; }
    .af-icon { font-size: 22px; margin-bottom: 8px; }
    .af-t { font-size: 13.5px; font-weight: 700; margin-bottom: 5px; color: var(--text); }
    .af-d { font-size: 13px; color: var(--muted); line-height: 1.75; word-break: keep-all; }
    .about-visual { background: linear-gradient(135deg, var(--blue-dark) 0%, var(--blue) 100%); border-radius: 16px; aspect-ratio: 4/5; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; position: relative; overflow: hidden; }
    .about-visual::before { content: ''; position: absolute; top: -60px; right: -60px; width: 300px; height: 300px; border-radius: 50%; background: rgba(255,255,255,0.05); }
    .about-visual-big { font-size: 72px; opacity: 0.2; }
    .about-visual-label { font-family: 'Montserrat', sans-serif; font-size: 10px; letter-spacing: 0.22em; color: rgba(255,255,255,0.22); text-transform: uppercase; }
    .about-quote { background: var(--blue-light); border-left: 4px solid var(--blue); padding: 16px 20px; margin-top: 28px; font-size: 13.5px; color: var(--blue-dark); font-weight: 600; line-height: 1.65; border-radius: 0 8px 8px 0; word-break: keep-all; }

    /* CURRICULUM */
    .curr-tabs { display: flex; gap: 0; margin-bottom: 32px; border-bottom: 2px solid var(--stroke); }
    .curr-tab { padding: 12px 26px; font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color 160ms, border-color 160ms; letter-spacing: -0.01em; }
    .curr-tab.active { color: var(--blue); border-bottom-color: var(--blue); }
    .curr-panel { display: none; }
    .curr-panel.active { display: block; }
    .curr-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 18px; }
    .ccard { background: var(--white); border: 1px solid var(--stroke); border-radius: 12px; padding: 28px 24px; position: relative; overflow: hidden; transition: box-shadow 200ms, transform 200ms; }
    .ccard:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
    .ccard::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; border-radius: 12px 12px 0 0; }
    .ccard.c1::before { background: var(--sky); }
    .ccard.c2::before { background: #2da84e; }
    .ccard.c3::before { background: var(--yellow); }
    .ccard-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 20px; margin-bottom: 14px; font-family: 'Montserrat', sans-serif; letter-spacing: 0.08em; }
    .ccard.c1 .ccard-badge { background: #e0f4ff; color: #0a7bb8; }
    .ccard.c2 .ccard-badge { background: #e0f5e9; color: #1a7a38; }
    .ccard.c3 .ccard-badge { background: #fff6e0; color: #b37400; }
    .ccard-t { font-size: 18px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.01em; }
    .ccard-ko { font-size: 12.5px; color: var(--muted); margin-bottom: 14px; }
    .ccard-desc { font-size: 13px; color: var(--muted); line-height: 1.8; word-break: keep-all; }
    .ccard-feats { margin-top: 16px; display: flex; flex-direction: column; gap: 6px; }
    .ccard-feat { font-size: 12px; color: var(--muted); display: flex; align-items: flex-start; gap: 7px; }
    .ccard-feat::before { content: '✓'; color: var(--blue); font-weight: 700; flex-shrink: 0; }
    .curr-note { margin-top: 20px; padding: 16px 20px; background: var(--blue-light); border-left: 3px solid var(--blue); border-radius: 0 8px 8px 0; font-size: 13.5px; color: var(--blue-dark); line-height: 1.7; }

    /* PACKAGE */
    .pkg-wrap { display: grid; grid-template-columns: 1fr 1.3fr; gap: 60px; align-items: start; }
    .pkg-list { display: flex; flex-direction: column; gap: 12px; margin-top: 28px; }
    .pkg-item { display: flex; align-items: flex-start; gap: 14px; padding: 16px 18px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; transition: background 160ms; }
    .pkg-item:hover { background: rgba(255,255,255,0.06); }
    .pkg-item-icon { font-size: 22px; flex-shrink: 0; }
    .pkg-item-t { font-size: 13.5px; font-weight: 700; color: var(--white); margin-bottom: 3px; }
    .pkg-item-d { font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.6; word-break: keep-all; }
    .pkg-right { display: flex; flex-direction: column; gap: 14px; }
    .pkgc { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 20px; display: flex; align-items: flex-start; gap: 16px; transition: background 160ms; }
    .pkgc:hover { background: rgba(255,255,255,0.1); }
    .pkgc-num { font-family: 'Montserrat', sans-serif; font-size: 24px; font-weight: 800; color: rgba(255,255,255,0.1); width: 36px; flex-shrink: 0; line-height: 1; }
    .pkgc-t { font-size: 13.5px; font-weight: 700; color: var(--white); margin-bottom: 4px; }
    .pkgc-d { font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.65; word-break: keep-all; }
    .pkg-highlight { background: rgba(245,166,35,0.12); border: 1.5px solid rgba(245,166,35,0.3); border-radius: 10px; padding: 22px; margin-top: 4px; }
    .pkg-hl-t { font-size: 15px; font-weight: 800; color: #ffd97a; margin-bottom: 8px; }
    .pkg-hl-d { font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.85; word-break: keep-all; }
    .shuttle-days { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 18px; }
    .sday { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 10px 14px; text-align: center; min-width: 78px; }
    .sday-l { font-size: 9px; font-family: 'Montserrat', sans-serif; letter-spacing: 0.12em; color: rgba(255,255,255,0.35); text-transform: uppercase; margin-bottom: 4px; }
    .sday-n { font-size: 12px; font-weight: 700; color: var(--white); }
    .sday.wk .sday-n { color: #ffd97a; }

    /* ACCOMMODATION */
    .accom-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 22px; margin-top: 44px; }
    .accard { border: 1px solid var(--stroke); border-radius: 14px; overflow: hidden; background: var(--white); transition: box-shadow 220ms, transform 220ms; }
    .accard:hover { box-shadow: var(--shadow-lg); transform: translateY(-3px); }
    .accard-img { height: 196px; background: linear-gradient(135deg, var(--blue-dark), var(--blue)); display: flex; align-items: center; justify-content: center; font-size: 54px; color: rgba(255,255,255,0.1); position: relative; }
    .accard-badge { position: absolute; top: 12px; left: 12px; background: var(--yellow); color: #1a1a2e; font-family: 'Montserrat', sans-serif; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; padding: 4px 9px; border-radius: 4px; text-transform: uppercase; }
    .accard-body { padding: 22px 20px 20px; }
    .accard-name { font-size: 20px; font-weight: 800; margin-bottom: 4px; letter-spacing: -0.01em; }
    .accard-sub { font-size: 12px; color: var(--muted); margin-bottom: 12px; }
    .accard-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .accard-tag { font-size: 11px; padding: 3px 9px; border-radius: 20px; border: 1px solid rgba(26,111,196,0.2); color: var(--blue); background: var(--blue-light); }
    .accard-feats { display: flex; flex-direction: column; gap: 5px; }
    .accard-feat { font-size: 13px; color: var(--muted); display: flex; align-items: flex-start; gap: 6px; }
    .accard-feat::before { content: '·'; color: var(--blue); font-weight: 700; flex-shrink: 0; }

    /* GALLERY */
    .gallery-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; grid-template-rows: 220px 220px; gap: 4px; margin-top: 40px; border-radius: 14px; overflow: hidden; }
    .gitem { background: linear-gradient(135deg, var(--blue-dark), var(--blue)); display: flex; align-items: center; justify-content: center; font-size: 40px; color: rgba(255,255,255,0.08); cursor: pointer; position: relative; transition: filter 200ms; }
    .gitem:first-child { grid-row: span 2; font-size: 60px; }
    .gitem:hover { filter: brightness(1.15); }
    .gitem-lbl { position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 14px; background: linear-gradient(to top, rgba(13,45,80,0.8), transparent); color: rgba(255,255,255,0.8); font-size: 10.5px; font-family: 'Montserrat', sans-serif; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0; transition: opacity 220ms; }
    .gitem:hover .gitem-lbl { opacity: 1; }

    /* REVIEWS */
    .review-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 18px; margin-top: 44px; }
    .rcard { background: var(--white); padding: 28px; border-radius: 14px; border: 1px solid var(--stroke); border-top: 3px solid var(--blue); box-shadow: var(--shadow); }
    .rq { font-size: 36px; color: var(--blue); line-height: 0.5; margin-bottom: 16px; display: block; font-family: 'Montserrat', sans-serif; opacity: 0.25; }
    .rstars { color: #f5a623; font-size: 14px; letter-spacing: 2px; margin-bottom: 12px; }
    .rtext { font-size: 13.5px; color: #444; line-height: 1.95; margin-bottom: 20px; word-break: keep-all; }
    .rauthor { display: flex; align-items: center; gap: 10px; }
    .rav { width: 36px; height: 36px; border-radius: 50%; background: var(--blue-light); display: flex; align-items: center; justify-content: center; font-size: 15px; }
    .rname { font-size: 13px; font-weight: 700; }
    .rinfo { font-size: 11.5px; color: var(--muted); margin-top: 1px; }

    /* FOOTER */
    footer { background: var(--blue-dark); padding: 54px 60px 30px; border-top: 1px solid rgba(255,255,255,0.07); }
    .footer-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 48px; margin-bottom: 34px; }
    .flogo { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; color: var(--white); margin-bottom: 12px; display: block; }
    .flogo .D { color: #5dc8f0; } .flogo .A { color: var(--yellow); }
    .fdesc { font-size: 12.5px; color: rgba(255,255,255,0.35); line-height: 1.9; word-break: keep-all; }
    .ftitle { font-family: 'Montserrat', sans-serif; font-size: 9.5px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 14px; }
    .flinks { display: flex; flex-direction: column; gap: 8px; }
    .flinks a { font-size: 13px; color: rgba(255,255,255,0.45); transition: color 150ms; }
    .flinks a:hover { color: rgba(255,255,255,0.85); }
    .fbottom { max-width: 1200px; margin: 0 auto; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; font-size: 11.5px; color: rgba(255,255,255,0.22); font-family: 'Montserrat', sans-serif; }

    /* FADE */
    .fade { opacity: 0; transform: translateY(22px); transition: opacity 650ms ease, transform 650ms ease; }
    .fade.vis { opacity: 1; transform: translateY(0); }
    .fade.d1 { transition-delay: 80ms; } .fade.d2 { transition-delay: 160ms; } .fade.d3 { transition-delay: 240ms; }

    /* TRUST */
    .trust-sec { background: linear-gradient(135deg, #0d3d7a, #1a6fc4, #1e88e5); padding: 48px 60px; position: relative; overflow: hidden; }
    .trust-sec::before { content: ''; position: absolute; inset: 0; background: url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='20' r='1' fill='rgba(255,255,255,0.06)'/%3E%3C/svg%3E"); pointer-events: none; }
    .trust-inner { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(4,1fr); gap: 24px; }
    .trust-card { text-align: center; }
    .trust-num { font-family: 'Montserrat', sans-serif; font-size: 36px; font-weight: 900; color: var(--white); }
    .trust-label { font-size: 13px; color: rgba(255,255,255,0.75); margin-top: 4px; }

    /* ACCARD BUTTON */
    .accard-btn { display: block; text-align: center; padding: 10px 20px; margin: 16px 20px 20px; border: 2px solid var(--blue); color: var(--blue); font-size: 13px; font-weight: 600; border-radius: 8px; transition: background 160ms, color 160ms; background: transparent; }
    .accard-btn:hover { background: var(--blue); color: var(--white); }

    /* FAQ */
    .faq-list { max-width: 800px; margin: 32px auto 0; }
    .faq-item { border-bottom: 1px solid var(--stroke); }
    .faq-q { display: flex; justify-content: space-between; align-items: center; padding: 18px 0; cursor: pointer; font-size: 15px; font-weight: 700; color: var(--text); background: none; border: none; width: 100%; text-align: left; font-family: 'Noto Sans KR', sans-serif; }
    .faq-q:hover { color: var(--blue); }
    .faq-arrow { font-size: 12px; color: var(--blue); transition: transform 300ms; flex-shrink: 0; }
    .faq-arrow.open { transform: rotate(180deg); }
    .faq-a { max-height: 0; overflow: hidden; transition: max-height 400ms ease; }
    .faq-a.open { max-height: 300px; }
    .faq-a-inner { padding: 0 0 18px; font-size: 14px; color: var(--muted); line-height: 1.8; word-break: keep-all; }

    /* SNS */
    .fsns { display: flex; gap: 14px; margin-top: 14px; }
    .fsns a { width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 14px; transition: background 160ms; }
    .fsns a:hover { background: rgba(255,255,255,0.2); }

    /* MOBILE FIXED CTA */
    .mob-cta { display: none; }

    /* RESPONSIVE */
    @media(max-width:1024px){
      nav { padding: 0 24px; height: 56px; } .nav-center { display: none; } .nav-right { display: none; } .hamburger { display: flex; }
      .logo img { height: 32px; }
      .mob-nav { top: 56px; }
      .hero-inner { grid-template-columns: 1fr; gap: 24px; padding: 60px 24px 80px; }
      .hero-right { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .hcard { padding: 14px 12px; } .hcard-icon { font-size: 22px; margin-bottom: 6px; } .hcard-t { font-size: 12px; } .hcard-d { display: none; }
      .hero { padding-top: 56px; }
      .sec { padding: 48px 24px; }
      .sec-bg-i, .sec-dark-i { padding: 48px 24px; }
      .sh { font-size: clamp(22px,3vw,40px); }
      .sp { max-width: 100%; }
      .about-grid { grid-template-columns: 1fr; } .about-visual { display: none; }
      .curr-tabs { overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; }
      .curr-grid, .accom-grid, .review-grid { grid-template-columns: 1fr; }
      .pkg-wrap { grid-template-columns: 1fr; }
      .gallery-grid { grid-template-columns: 1fr 1fr; }
      .gitem:first-child { grid-row: span 1; }
      .sday { flex: 1 1 80px; }
      .trust-inner { grid-template-columns: repeat(2,1fr); gap: 16px; }
      .trust-sec { padding: 36px 24px; }
      .footer-grid { grid-template-columns: 1fr 1fr; gap: 28px; }
      .fbottom { flex-direction: column; gap: 6px; }
    }
    @media(max-width:768px){
      .sp { max-width: 100%; }
      .mob-cta { display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 400; height: 54px; background: var(--blue); align-items: center; justify-content: center; gap: 8px; color: var(--white); font-size: 15px; font-weight: 700; box-shadow: 0 -2px 12px rgba(0,0,0,0.15); }
      body { padding-bottom: 54px; }
    }
    @media(max-width:480px){
      .hero-h1 { letter-spacing: -0.015em; }
      .hero-btns { flex-direction: column; }
      .gallery-grid { grid-template-columns: 1fr; }
      .gitem { height: 160px; }
      .footer-grid { grid-template-columns: 1fr; gap: 24px; }
    }
  `}</style>
      {/* NAV */}
<SiteNav />

{/* HERO: 밝은 흰색 배경 */}
<section className="hero">
  <div className="hero-photo" role="img" aria-label="드림아카데미 캠퍼스"></div>
  <div className="hero-circle1"></div>
  <div className="hero-circle2"></div>
  <div className="hero-inner">
    <div>
      <div className="hero-tag">Philippines · Cebu · Dream Academy</div>
      <h1 className="hero-h1">영어가 일상이 되는<br/><span className="blue">특별한 경험</span></h1>
      <p className="hero-slogan">Where English Becomes Everyday</p>
      <p className="hero-sub">"여권만 챙기세요. 나머지 우리가 다 준비했어요."</p>
      <p className="hero-desc">숙소부터 수업, 식사, 액티비티까지 모든 것을 책임지는 프리미엄 올인원 영어캠프</p>
      <div className="hero-btns">
        <a href="http://pf.kakao.com/_Yuhxhn/chat" className="btn-blue" target="_blank" rel="noopener noreferrer">프로그램 신청 →</a>
        <a href="/estimate" className="btn-outline">💰 견적 내보기</a>
        <a href="#about" className="btn-outline">자세히 알아보기</a>
      </div>
    </div>
    <div className="hero-right">
      <div className="hcard"><div className="hcard-icon">📚</div><div className="hcard-t">주니어 커리큘럼</div><div className="hcard-d">1-on-1 · S-on-S · Funtivity</div></div>
      <div className="hcard"><div className="hcard-icon">🌱</div><div className="hcard-t">킨더 커리큘럼</div><div className="hcard-d">1-on-1 · Group · Theme project</div></div>
      <div className="hcard"><div className="hcard-icon">🏡</div><div className="hcard-t">프라이빗 숙소</div><div className="hcard-d">드림하우스 · J-Park · CubeNine</div></div>
      <div className="hcard"><div className="hcard-icon">🍱</div><div className="hcard-t">올인원 케어</div><div className="hcard-d">식사 · 셔틀 · 헬퍼 · 액티비티</div></div>
    </div>
  </div>
  <div className="hero-scroll">Scroll</div>
</section>

{/* TRUST */}
<div className="trust-sec">
  <div className="trust-inner">
    <div className="trust-card"><div className="trust-num">500+</div><div className="trust-label">수강생</div></div>
    <div className="trust-card"><div className="trust-num">90%</div><div className="trust-label">교사 자격증 보유</div></div>
    <div className="trust-card"><div className="trust-num">10년</div><div className="trust-label">운영 경력</div></div>
    <div className="trust-card"><div className="trust-num">98%</div><div className="trust-label">만족도</div></div>
  </div>
</div>

{/* ABOUT */}
<section id="about">
  <div className="sec fade">
    <div className="about-grid">
      <div>
        <div className="stag">About Dream Academy</div>
        <h2 className="sh">전문성과 체계적인 운영이<br/>만들어낸 <span className="bl">최적의 교육 환경</span></h2>
        <div className="divb"></div>
        <p className="sp">드림아카데미는 UCLA 출신 원장이 직접 설계한 커리큘럼으로 운영됩니다.<br/>90% 이상 자격증을 보유한 현지 교사진이 함께하는 필리핀 세부의 프리미엄 영어 교육 프로그램입니다.</p>
        <div className="about-features">
          <div className="af"><div className="af-icon">🤝</div><div className="af-t">세심한 케어</div><div className="af-d">상주 한국인 3명 이상<br/>학습 리포트 · 수업사진 공유</div></div>
          <div className="af af-green"><div className="af-icon">⭐</div><div className="af-t">검증된 교육진</div><div className="af-d">90% 이상 자격증 보유<br/>정기적인 교사 트레이닝</div></div>
          <div className="af af-yellow"><div className="af-icon">💡</div><div className="af-t">전문 커리큘럼</div><div className="af-d">UCLA 출신 원장 직접 설계<br/>자체 제작 교재로 수업 진행</div></div>
          <div className="af af-red"><div className="af-icon">⚙️</div><div className="af-t">체계적인 시스템</div><div className="af-d">담임 선생님 배정<br/>담당 매니저 빠른 피드백</div></div>
        </div>
        <div className="about-quote">"아이 한 명, 한 명의 가능성을 소중히 키우는 공간,<br/>드림아카데미에서 믿을 수 있는 배움을 시작하세요."</div>
      </div>
      <div className="about-features" style={{gridColumn:"1/-1"}}>
        <div className="af" style={{textAlign:"center",padding:"24px"}}><div style={{fontFamily:"Montserrat",fontSize:"32px",fontWeight:900,color:"var(--blue)"}}>500+</div><div className="af-t" style={{marginTop:"4px"}}>수강생</div></div>
        <div className="af" style={{textAlign:"center",padding:"24px"}}><div style={{fontFamily:"Montserrat",fontSize:"32px",fontWeight:900,color:"var(--blue)"}}>90%</div><div className="af-t" style={{marginTop:"4px"}}>교사 자격증 보유</div></div>
        <div className="af" style={{textAlign:"center",padding:"24px"}}><div style={{fontFamily:"Montserrat",fontSize:"32px",fontWeight:900,color:"var(--blue)"}}>10년</div><div className="af-t" style={{marginTop:"4px"}}>운영 경력</div></div>
        <div className="af" style={{textAlign:"center",padding:"24px"}}><div style={{fontFamily:"Montserrat",fontSize:"32px",fontWeight:900,color:"var(--blue)"}}>98%</div><div className="af-t" style={{marginTop:"4px"}}>만족도</div></div>
      </div>
    </div>
  </div>
</section>

{/* CURRICULUM */}
<div className="sec-bg">
  <div className="sec-bg-i">
    <div className="fade">
      <div className="stag">Curriculum</div>
      <h2 className="sh">아이의 성장을 위한<br/><span className="bl">체계적인 커리큘럼</span></h2>
      <div className="divb"></div>
    </div>
    <div className="curr-tabs fade">
      <div className="curr-tab active" data-tab="junior">🎒 Junior Line · 주니어 (초1~중2)</div>
      <div className="curr-tab" data-tab="kinder">🌱 Kinder Line · 킨더 (만3세~취학전)</div>
    </div>
    <div id="tab-junior" className="curr-panel active">
      <div className="curr-grid fade">
        <div className="ccard c1">
          <div className="ccard-badge">1-on-1</div>
          <div className="ccard-t">ONE ON ONE</div>
          <div className="ccard-ko">개인 맞춤 1:1 수업</div>
          <div className="ccard-desc">학생 개개인의 레벨을 고려한 맞춤형 수업. 말하기, 듣기, 읽기, 쓰기, 어휘 등 영어 전 영역을 균형 있게 향상시킵니다.</div>
          <div className="ccard-feats">
            <div className="ccard-feat">Speaking / Listening / Reading / Writing / Voca</div>
            <div className="ccard-feat">약점 보완 + 강점 강화 맞춤 구성</div>
            <div className="ccard-feat">자체 제작 교재 · 훈련된 교사진</div>
          </div>
        </div>
        <div className="ccard c2">
          <div className="ccard-badge">S-on-S</div>
          <div className="ccard-t">STUDY ON SUBJECT</div>
          <div className="ccard-ko">최대 1:6 소그룹 참여형 수업</div>
          <div className="ccard-desc">레벨별 소그룹으로 진행되는 주제 중심 영어 수업. 영어로 생각하고 표현하며 소통하는 능동적 수업을 진행합니다.</div>
          <div className="ccard-feats">
            <div className="ccard-feat">BTS · Solomon · Trump · Dream 4가지 Subject</div>
            <div className="ccard-feat">뉴스 앵커, 토론, 선거 캠페인, 매거진 프로젝트</div>
            <div className="ccard-feat">하루 4타임, 다양한 주제로 흥미롭게 구성</div>
          </div>
        </div>
        <div className="ccard c3">
          <div className="ccard-badge">F-class</div>
          <div className="ccard-t">FUNTIVITY</div>
          <div className="ccard-ko">즐겁게 배우는 창의 영어</div>
          <div className="ccard-desc">매일 마지막 그룹 수업으로 롤플레잉, 아웃도어 액티비티, 노래부르기, 대본 수업 등 다양한 활동 중심의 수업입니다.</div>
          <div className="ccard-feats">
            <div className="ccard-feat">Vocab + Lyrics / Script + Play</div>
            <div className="ccard-feat">Outdoor activity / Physical Class</div>
            <div className="ccard-feat">Talent Show / Graduation Party</div>
          </div>
        </div>
      </div>
      <div className="curr-note fade">📅 <strong>주니어 타임테이블 (9:00~16:00)</strong> — 1-on-1 수업 4회 & S-on-S 수업 4회 · 점심 & 간식 포함</div>
    </div>
    <div id="tab-kinder" className="curr-panel">
      <div className="curr-grid fade">
        <div className="ccard c1">
          <div className="ccard-badge">1-on-1</div>
          <div className="ccard-t">ONE ON ONE CLASS</div>
          <div className="ccard-ko">눈높이 맞춤형 1:1 교육</div>
          <div className="ccard-desc">Social English와 Topic English를 병행하며 아이 개개인의 레벨과 흥미에 맞춘 맞춤형 수업이 진행됩니다.</div>
          <div className="ccard-feats">
            <div className="ccard-feat">Social English · Phonics · Math · Science</div>
            <div className="ccard-feat">Reading / Writing · Theme project</div>
            <div className="ccard-feat">파닉스부터 읽기·쓰기·수학까지</div>
          </div>
        </div>
        <div className="ccard c2">
          <div className="ccard-badge">Group</div>
          <div className="ccard-t">GROUP CLASS</div>
          <div className="ccard-ko">함께 배우고 성장하는 수업</div>
          <div className="ccard-desc">아트, 쿠킹, 신체 활동 등 흥미로운 Special Activity와 음악, 연기 등 다양한 테마 수업을 통해 즐겁게 배웁니다.</div>
          <div className="ccard-feats">
            <div className="ccard-feat">Music/Movement · Physical Education</div>
            <div className="ccard-feat">Special Activity · Interactive Learning</div>
            <div className="ccard-feat">Story Reading · Gross Motor</div>
          </div>
        </div>
        <div className="ccard c3">
          <div className="ccard-badge">Theme</div>
          <div className="ccard-t">ONE THEME A WEEK</div>
          <div className="ccard-ko">하루 한 가지 테마 통합 프로그램</div>
          <div className="ccard-desc">매주 한 테마를 중심으로 음악·미술·과학·체육을 연계하는 통합형 교육 프로그램입니다.</div>
          <div className="ccard-feats">
            <div className="ccard-feat">Cooking · Art · P.E. · Science 통합</div>
            <div className="ccard-feat">Sea · Money · Jungle · Job 등 다양한 테마</div>
            <div className="ccard-feat">종일반(9:00~16:00)</div>
          </div>
        </div>
      </div>
      <div className="curr-note fade">📅 <strong>킨더 타임테이블</strong> — 종일반 9:00~16:00 · 대상: 만 3세 ~ 취학 전 (7세 예비초1도 선택 가능)</div>
    </div>
  </div>
</div>

{/* PACKAGE */}
<div className="sec-dark">
  <div className="sec-dark-i">
    <div className="pkg-wrap">
      <div className="fade">
        <div className="stag lt">All-in-One Package</div>
        <h2 className="sh wh">올인원 패키지<br/><span className="yl">포함 사항</span></h2>
        <div className="divy"></div>
        <p className="sp wh">수업부터 식사, 숙소, 셔틀까지 패키지 하나로 모두 해결됩니다.</p>
        <div className="pkg-list">
          <div className="pkg-item"><div className="pkg-item-icon">🏠</div><div><div className="pkg-item-t">프라이빗 숙소</div><div className="pkg-item-d">드림하우스 독채 / 제이파크 5성급 / 큐브나인 리조트</div></div></div>
          <div className="pkg-item"><div className="pkg-item-icon">🍱</div><div><div className="pkg-item-t">평일 3식 프리미엄 도시락</div><div className="pkg-item-d">한국인 조리사님 · 아침 7:50 / 점심 11:50 / 저녁 17:40</div></div></div>
          <div className="pkg-item"><div className="pkg-item-icon">📚</div><div><div className="pkg-item-t">드림아카데미 정규 수업</div><div className="pkg-item-d">주니어 / 킨더 커리큘럼 · 애프터스쿨 & 주말 현장학습</div></div></div>
          <div className="pkg-item"><div className="pkg-item-icon">🚌</div><div><div className="pkg-item-t">무료 투어 셔틀</div><div className="pkg-item-d">H마트 · SM씨사이드 · 쉬라인 · 파롤라 · 사파리 · 안조월드</div></div></div>
          <div className="pkg-item"><div className="pkg-item-icon">✈️</div><div><div className="pkg-item-t">공항 픽드랍 & 무료 유심</div><div className="pkg-item-d">현지 직원 공항 픽업 · 별도 등록 없이 바로 사용 가능</div></div></div>
          <div className="pkg-item"><div className="pkg-item-icon">🧹</div><div><div className="pkg-item-t">주 6일 헬퍼 서비스 (드림하우스)</div><div className="pkg-item-d">청소 · 빨래 · 장보기 · 식사준비 (월~토, 08:00~17:00)</div></div></div>
          <div className="pkg-item"><div className="pkg-item-icon">💻</div><div><div className="pkg-item-t">화상영어</div><div className="pkg-item-d">연수 전·후 등록기간 만큼의 무료 화상영어</div></div></div>
        </div>
      </div>
      <div className="fade d1">
        <div className="pkg-right">
          <div className="pkgc"><div className="pkgc-num">01</div><div><div className="pkgc-t">드림컴퍼니 연계 할인</div><div className="pkgc-d">Play Dream · 88식당 · 모리식당 · 세부닭 10%<br/>골드문 스파 50% · 오션마사지 20%</div></div></div>
          <div className="pkgc"><div className="pkgc-num">02</div><div><div className="pkgc-t">큐브나인 연계 할인</div><div className="pkgc-d">마사지&스파 20% · 더 나인 레스토랑 10%<br/>알리망오 크랩 10% 할인</div></div></div>
          <div className="pkgc"><div className="pkgc-num">03</div><div><div className="pkgc-t">드림카 (렌트카) 이용</div><div className="pkgc-d">기본 2시간 1,000페소 · 추가 350페소/시간<br/>패키지 고객 전용 렌트카 서비스</div></div></div>
          <div className="pkgc"><div className="pkgc-num">04</div><div><div className="pkgc-t">드림하우스 관리 센터</div><div className="pkgc-d">1,000권 이상 도서 · 물놀이 용품 · 킥보드 대여<br/>병생수 무제한 · 커피머신 완비</div></div></div>
          <div className="pkg-highlight">
            <div className="pkg-hl-t">💬 100만원 이상의 가치</div>
            <div className="pkg-hl-d">수천 페소가 드는 투어 비용, 예약하고 기다리는 귀찮음까지 모두 해결! 추가 비용 청구가 아닌 <strong style={{color: '#ffd97a'}}>서비스</strong>입니다. 이제 이동까지 '휴식의 일부'로 느껴보세요.</div>
          </div>
        </div>
        {/* Shuttle */}
        <div style={{marginTop: '28px'}}>
          <p style={{fontFamily: '"Montserrat", sans-serif', fontSize: '10px', fontWeight: '600', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: '10px'}}>TOUR SHUTTLE SAMPLE SCHEDULE</p>
          <div className="shuttle-days">
            <div className="sday"><div className="sday-l">Mon</div><div className="sday-n">H Mart</div></div>
            <div className="sday"><div className="sday-l">Tue</div><div className="sday-n">SM Seaside</div></div>
            <div className="sday"><div className="sday-l">Wed</div><div className="sday-n">Shrine</div></div>
            <div className="sday"><div className="sday-l">Thu</div><div className="sday-n">Parola</div></div>
            <div className="sday"><div className="sday-l">Fri</div><div className="sday-n">Lantaw</div></div>
            <div className="sday wk"><div className="sday-l">Sat</div><div className="sday-n">Safari</div></div>
            <div className="sday wk"><div className="sday-l">Sun</div><div className="sday-n">Anjo World</div></div>
          </div>
          <a href="/shuttle" className="btn-blue" style={{marginTop: '18px', display: 'inline-flex', fontSize: '11px'}}>셔틀 신청하기 →</a>
        </div>
      </div>
    </div>
  </div>
</div>

{/* ACCOMMODATION */}
<div className="sec-bg">
  <div className="sec-bg-i">
    <div className="fade">
      <div className="stag">Accommodation</div>
      <h2 className="sh">편안한 숙소에서<br/><span className="bl">여유로운 일상</span>을</h2>
      <div className="divb"></div>
      <p className="sp">세 가지 프리미엄 숙소 옵션 중 가족 구성과 취향에 맞는 최적의 공간을 선택하세요.</p>
    </div>
    <div className="accom-grid fade">
      <div className="accard">
        <div className="accard-img" style={{background: "url(/images/dreamhouse.jpg) center/cover no-repeat"}}><div className="accard-badge">독채</div></div>
        <div className="accard-body">
          <div className="accard-name">Dream House</div>
          <div className="accard-sub">드림하우스 · 베이스워터 빌리지 · 프라이빗 독채</div>
          <div className="accard-tags"><span className="accard-tag">3룸 독채</span><span className="accard-tag">최대 6인</span><span className="accard-tag">헬퍼포함</span><span className="accard-tag">수영장</span></div>
          <div className="accard-feats">
            <div className="accard-feat">복층 구조 / 방 3개 / 화장실 2개 / 뒷뜰</div>
            <div className="accard-feat">주 6일 헬퍼(아떼) 서비스 포함</div>
            <div className="accard-feat">한국산 가전·정수기·방충망 완비</div>
            <div className="accard-feat">그랜드몰·상스몰 5분 / 공항 20분</div>
          </div>
          <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer" className="accard-btn">상담 문의</a>
        </div>
      </div>
      <div className="accard">
        <div className="accard-img" style={{background: "url(/images/jpark.png) center/cover no-repeat"}}></div>
        <div className="accard-body">
          <div className="accard-name">J-Park Island</div>
          <div className="accard-sub">제이파크 · 5성급 리조트 호텔 · WITH 드림아카데미</div>
          <div className="accard-tags"><span className="accard-tag">5성급</span><span className="accard-tag">워터파크</span><span className="accard-tag">한국인 매니저</span></div>
          <div className="accard-feats">
            <div className="accard-feat">조식 50% · 식당 30% · 런더리 30% 할인</div>
            <div className="accard-feat">5곳의 수영장 / 2개의 비치 / 워터파크</div>
            <div className="accard-feat">디럭스룸 / 프리미어룸 / 막탄스윗</div>
          </div>
          <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer" className="accard-btn">상담 문의</a>
        </div>
      </div>
      <div className="accard">
        <div className="accard-img" style={{background: "url(/images/cube9.png) center/cover no-repeat"}}></div>
        <div className="accard-body">
          <div className="accard-name">Cube Nine</div>
          <div className="accard-sub">큐브나인 · 바다를 품은 프라이빗 리조트 & SPA</div>
          <div className="accard-tags"><span className="accard-tag">오션뷰</span><span className="accard-tag">스파</span><span className="accard-tag">바다액티비티</span></div>
          <div className="accard-feats">
            <div className="accard-feat">디럭스 오션룸 / 풀 억세스룸</div>
            <div className="accard-feat">바다 액티비티 무료 (카약/패들)</div>
            <div className="accard-feat">마사지&스파 20% · 레스토랑 10% 할인</div>
          </div>
          <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer" className="accard-btn">상담 문의</a>
        </div>
      </div>
    </div>
  </div>
</div>

{/* GALLERY */}
<div className="sec fade">
  <div className="stag">Gallery</div>
  <h2 className="sh">드림아카데미의<br/><span className="bl">특별한 순간들</span></h2>
  <div className="gallery-grid">
    <div className="gitem" style={{overflow: 'hidden', background: 'none'}}>
      <img src="/images/gallery/academy-interior.jpg" loading="lazy" alt="드림아카데미 내부" style={{width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 300ms'}} onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.transform="scale(1.04)"; }} onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.transform="scale(1)"; }} />
      <div className="gitem-lbl">드림아카데미 내부</div>
    </div>
    <div className="gitem" style={{overflow: 'hidden', background: 'none'}}>
      <img src="/images/gallery/library.jpg" loading="lazy" alt="도서관" style={{width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 300ms'}} onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.transform="scale(1.04)"; }} onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.transform="scale(1)"; }} />
      <div className="gitem-lbl">도서관 · Library</div>
    </div>
    <div className="gitem" style={{overflow: 'hidden', background: 'none'}}>
      <img src="/images/gallery/consultation.jpg" loading="lazy" alt="컨설테이션 공간" style={{width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 300ms'}} onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.transform="scale(1.04)"; }} onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.transform="scale(1)"; }} />
      <div className="gitem-lbl">컨설테이션 공간</div>
    </div>
    <div className="gitem" style={{overflow: 'hidden', background: 'none'}}>
      <img src="/images/gallery/sos-class.jpg" loading="lazy" alt="S-on-S 수업실" style={{width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 300ms'}} onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.transform="scale(1.04)"; }} onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.transform="scale(1)"; }} />
      <div className="gitem-lbl">S-on-S 수업실</div>
    </div>
    <div className="gitem" style={{overflow: 'hidden', background: 'none'}}>
      <img src="/images/gallery/one-on-one.jpg" loading="lazy" alt="1:1 수업실" style={{width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 300ms'}} onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.transform="scale(1.04)"; }} onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.transform="scale(1)"; }} />
      <div className="gitem-lbl">1:1 수업실</div>
    </div>
  </div>
</div>

{/* REVIEWS */}
<div className="sec-bg">
  <div className="sec-bg-i">
    <div className="fade">
      <div className="stag">Community · 학부모 후기</div>
      <h2 className="sh">학부모님들의<br/><span className="bl">생생한 이야기</span></h2>
      <div className="divb"></div>
    </div>
    <div className="review-grid fade">
      <div className="rcard"><span className="rq">"</span><div className="rstars">★★★★★</div><p className="rtext">아이가 처음엔 영어를 한마디도 못 했는데, 한 달 만에 선생님과 자연스럽게 대화를 나누는 걸 보고 깜짝 놀랐어요. 드림아카데미 덕분에 아이의 자신감이 정말 많이 올랐습니다.</p><div className="rauthor"><div className="rav">👩</div><div><div className="rname">김○○ 어머님</div><div className="rinfo">7세 · 드림하우스</div></div></div></div>
      <div className="rcard"><span className="rq">"</span><div className="rstars">★★★★★</div><p className="rtext">셔틀 서비스가 정말 편리해서 이동 걱정 없이 편하게 지낼 수 있었어요. 현장학습 프로그램도 너무 알차고, 아이가 매일 즐겁게 참여했습니다. 내년에 또 오고 싶어요!</p><div className="rauthor"><div className="rav">👩</div><div><div className="rname">이○○ 어머님</div><div className="rinfo">9세 · 제이파크</div></div></div></div>
      <div className="rcard"><span className="rq">"</span><div className="rstars">★★★★★</div><p className="rtext">필리핀에서의 한 달이 아이 인생에 큰 전환점이 됐어요. 영어뿐만 아니라 다양한 문화 체험을 통해 아이의 세계관이 넓어진 것을 느낄 수 있었습니다. 여권만 챙겨가면 된다는 말이 딱 맞아요!</p><div className="rauthor"><div className="rav">👨</div><div><div className="rname">박○○ 아버님</div><div className="rinfo">11세 · 큐브나인</div></div></div></div>
    </div>
  </div>
</div>

{/* ESTIMATE CTA */}
<div style={{background:"linear-gradient(135deg, #0d3d7a 0%, #1a6fc4 100%)",padding:"64px 0"}}>
  <div style={{maxWidth:720,margin:"0 auto",padding:"0 24px",textAlign:"center"}}>
    <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.6)",letterSpacing:"0.06em",marginBottom:8}}>예상 비용이 궁금하신가요?</div>
    <h2 style={{fontSize:"clamp(24px,3.5vw,36px)",fontWeight:800,color:"#fff",marginBottom:16,lineHeight:1.3}}>지금 바로 견적을 확인해보세요</h2>
    <p style={{fontSize:15,color:"rgba(255,255,255,0.8)",lineHeight:1.8,marginBottom:32,wordBreak:"keep-all"}}>숙소와 인원을 선택하면 예상 금액을 바로 알 수 있어요.<br/>실제 할인가는 상담을 통해 더 저렴하게 안내드립니다 😊</p>
    <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
      <a href="/estimate" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"14px 32px",background:"#fff",color:"#1a6fc4",fontSize:15,fontWeight:700,borderRadius:10,fontFamily:"'Noto Sans KR',sans-serif",transition:"transform 140ms,box-shadow 160ms",boxShadow:"0 4px 16px rgba(0,0,0,0.15)"}}>💰 견적 내보기</a>
      <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"14px 32px",background:"#FEE500",color:"#3C1E1E",fontSize:15,fontWeight:700,borderRadius:10,fontFamily:"'Noto Sans KR',sans-serif",transition:"transform 140ms,box-shadow 160ms",boxShadow:"0 4px 16px rgba(254,229,0,0.35)"}}>💬 카카오톡 상담</a>
    </div>
  </div>
</div>

{/* FAQ */}
<div className="sec-bg">
  <div className="sec-bg-i">
    <div className="fade" style={{textAlign:"center"}}>
      <div className="stag" style={{justifyContent:"center"}}>FAQ</div>
      <h2 className="sh" style={{textAlign:"center"}}>자주 묻는 <span className="bl">질문</span></h2>
      <div className="divb" style={{margin:"14px auto 24px"}}></div>
    </div>
    <div className="faq-list fade" id="faqList">
      <div className="faq-item"><button className="faq-q" data-faq="0">몇 세부터 참가 가능한가요? <span className="faq-arrow">▼</span></button><div className="faq-a"><div className="faq-a-inner">킨더 라인은 만 3세부터, 주니어 라인은 초등학교 1학년부터 중학교 2학년까지 참가 가능합니다. 만 7세 예비 초1은 킨더/주니어 중 선택 가능합니다.</div></div></div>
      <div className="faq-item"><button className="faq-q" data-faq="1">비용은 얼마인가요? <span className="faq-arrow">▼</span></button><div className="faq-a"><div className="faq-a-inner">숙소 종류, 기간, 인원에 따라 다릅니다. 드림하우스 기준 2주 약 400만원대부터 시작하며, 카카오톡으로 문의하시면 맞춤 견적을 안내해드립니다.</div></div></div>
      <div className="faq-item"><button className="faq-q" data-faq="2">영어를 못해도 괜찮나요? <span className="faq-arrow">▼</span></button><div className="faq-a"><div className="faq-a-inner">네, 전혀 문제없습니다! 레벨 테스트를 통해 아이의 수준에 맞는 반에 배정되며, 1:1 수업 위주로 진행되어 영어를 처음 접하는 아이도 빠르게 적응합니다.</div></div></div>
      <div className="faq-item"><button className="faq-q" data-faq="3">부모님도 함께 참가할 수 있나요? <span className="faq-arrow">▼</span></button><div className="faq-a"><div className="faq-a-inner">네, 보호자가 함께 체류하시며 아이의 등하교를 관리합니다. 숙소에서 편안하게 지내시면서 아이 수업 중 자유롭게 시간을 보내실 수 있습니다.</div></div></div>
      <div className="faq-item"><button className="faq-q" data-faq="4">숙소는 어떻게 구성되나요? <span className="faq-arrow">▼</span></button><div className="faq-a"><div className="faq-a-inner">드림하우스(독채), 제이파크(5성급 리조트), 큐브나인(오션뷰 리조트) 중 선택 가능합니다. 모든 숙소에 한국산 가전, 정수기 등이 구비되어 있습니다.</div></div></div>
      <div className="faq-item"><button className="faq-q" data-faq="5">식사는 어떻게 되나요? <span className="faq-arrow">▼</span></button><div className="faq-a"><div className="faq-a-inner">평일 3식 프리미엄 도시락이 숙소로 배달됩니다. 아침 7:50, 점심 11:50, 저녁 17:40에 한국인 조리사님이 준비한 식사가 제공됩니다.</div></div></div>
    </div>
  </div>
</div>

{/* MOBILE FIXED CTA */}
<a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer" className="mob-cta">💬 카카오톡 상담하기</a>

{/* FOOTER */}
<SiteFooter />
    </>
  );
}
