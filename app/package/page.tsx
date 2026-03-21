"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function PackagePage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const nav = document.getElementById("mainNav");
      if (nav) {
        nav.style.boxShadow =
          window.scrollY > 20
            ? "0 2px 20px rgba(0,0,0,0.1)"
            : "0 1px 3px rgba(0,0,0,0.08)";
      }
    };
    window.addEventListener("scroll", handleScroll);

    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((el) => {
          if (el.isIntersecting) el.target.classList.add("vis");
        }),
      { threshold: 0.07 }
    );
    document.querySelectorAll(".fade").forEach((el) => obs.observe(el));

    return () => {
      window.removeEventListener("scroll", handleScroll);
      obs.disconnect();
    };
  }, []);

  return (
    <>
      <style>{`
        :root {
          --blue:#1a6fc4; --blue-dark:#0d3d7a; --blue-light:#eaf3fb;
          --sky:#29a9e0; --yellow:#f5a623; --cream:#FFF9EC;
          --white:#fff; --off:#FFF9EC; --text:#1a1a2e; --muted:#6b7c93;
          --stroke:#e2e8f0; --shadow:0 8px 40px rgba(0,0,0,0.09);
          --shadow-lg:0 20px 60px rgba(26,111,196,0.13);
          --green:#2da84e;
        }
        *{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        body{font-family:'Noto Sans KR',sans-serif;color:var(--text);background:var(--white);overflow-x:hidden;}
        a{text-decoration:none;color:inherit;}

        /* NAV */
        nav{position:fixed;top:0;left:0;right:0;z-index:300;height:66px;display:flex;align-items:center;padding:0 40px;background:rgba(255,255,255,0.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--stroke);box-shadow:0 1px 3px rgba(0,0,0,0.08);gap:0;}
        .logo{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:800;color:var(--text);flex-shrink:0;margin-right:32px;}
        .logo .D{color:var(--sky);} .logo .A{color:var(--yellow);}
        .nav-center{display:flex;align-items:center;flex:1;}
        .nav-center>a,.nav-dd>a{color:#374151;font-size:14px;font-weight:500;padding:0 14px;height:66px;display:flex;align-items:center;gap:4px;transition:color 160ms;white-space:nowrap;}
        .nav-center>a:hover,.nav-dd>a:hover{color:var(--blue);}
        .nav-active{color:var(--blue)!important;font-weight:700!important;}
        .nav-dd{position:relative;}
        .nav-dd-arrow{font-size:10px;transition:transform 200ms;}
        .nav-dd:hover .nav-dd-arrow{transform:rotate(180deg);}
        .nav-dd-menu{position:absolute;top:66px;left:0;background:var(--white);min-width:165px;border:1px solid var(--stroke);border-top:2px solid var(--blue);box-shadow:0 8px 24px rgba(0,0,0,0.1);opacity:0;pointer-events:none;transform:translateY(-6px);transition:all 180ms;}
        .nav-dd:hover .nav-dd-menu{opacity:1;pointer-events:all;transform:translateY(0);}
        .nav-dd-menu a{display:block;padding:11px 18px;font-size:13.5px;color:#374151;border-bottom:1px solid var(--stroke);transition:background 140ms,color 140ms;}
        .nav-dd-menu a:last-child{border-bottom:none;}
        .nav-dd-menu a:hover{background:var(--blue-light);color:var(--blue);}
        .nav-right{display:flex;align-items:center;flex-shrink:0;}
        .nav-cta{background:var(--blue);color:var(--white);font-size:13.5px;font-weight:600;padding:9px 20px;border-radius:4px;transition:background 160ms;}
        .nav-cta:hover{background:var(--blue-dark);}
        .hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;}
        .hamburger span{width:22px;height:2px;background:var(--text);display:block;}
        .mob-nav{display:none;position:fixed;top:66px;left:0;right:0;background:var(--white);z-index:299;padding:16px 24px 24px;flex-direction:column;border-top:1px solid var(--stroke);box-shadow:0 8px 24px rgba(0,0,0,0.1);}
        .mob-nav.open{display:flex;}
        .mob-nav a{padding:12px 0;color:#374151;font-size:14px;border-bottom:1px solid var(--stroke);}

        /* PAGE HERO */
        .page-hero{
          padding:120px 60px 72px;
          background:linear-gradient(135deg,var(--cream) 0%,#FFE8B0 40%,#FFF5DC 100%);
          border-bottom:1px solid var(--stroke);
          text-align:center;
        }
        .page-hero-inner{max-width:900px;margin:0 auto;}
        .page-tag{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:var(--blue);margin-bottom:14px;}
        .page-hero h1{font-size:clamp(34px,5vw,56px);font-weight:800;line-height:1.15;letter-spacing:-0.03em;margin-bottom:16px;}
        .page-hero h1 .hl{color:var(--blue);}
        .page-hero p{font-size:17px;color:var(--muted);line-height:1.7;margin:0 auto;}
        .hero-badges{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:24px;}
        .hbadge{display:inline-flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--stroke);padding:8px 16px;border-radius:24px;font-size:13px;font-weight:600;color:var(--text);box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .hbadge.blue{background:var(--blue-light);border-color:rgba(26,111,196,0.2);color:var(--blue);}

        /* SECTIONS */
        .sec{padding:80px 60px;max-width:1200px;margin:0 auto;}
        .sec-bg{background:var(--off);}
        .sec-bg-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .sec-white{background:var(--white);}
        .sec-white-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .stag{font-family:'Montserrat',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:var(--blue);margin-bottom:10px;display:flex;align-items:center;gap:9px;}
        .stag::before{content:'';width:20px;height:2px;background:var(--blue);border-radius:2px;}
        .sh{font-size:clamp(24px,3vw,38px);font-weight:800;line-height:1.22;letter-spacing:-0.022em;margin-bottom:12px;word-break:keep-all;}
        .sh .hl{color:var(--blue);}
        .sp{font-size:14px;color:var(--muted);line-height:1.9;max-width:660px;word-break:keep-all;}
        .divider{width:40px;height:3px;background:var(--blue);margin:12px 0 22px;border-radius:2px;}

        /* BADGE */
        .inc-badge{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;background:#dbeafe;color:#1d4ed8;margin-bottom:18px;}

        /* FEATURE CARDS */
        .feat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:24px;}
        .feat-card{background:var(--white);border:1px solid var(--stroke);border-radius:16px;padding:28px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);transition:transform 200ms,box-shadow 200ms;}
        .feat-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .feat-icon{font-size:32px;margin-bottom:12px;}
        .feat-title{font-size:16px;font-weight:800;margin-bottom:8px;}
        .feat-desc{font-size:13px;color:var(--muted);line-height:1.78;word-break:keep-all;}
        .feat-note{margin-top:12px;font-size:12px;color:#6b7280;background:#f8fafc;padding:10px 14px;border-radius:8px;line-height:1.6;}

        /* INFO LIST */
        .info-list{display:flex;flex-direction:column;gap:8px;margin-top:16px;}
        .info-item{font-size:13.5px;color:var(--muted);display:flex;align-items:flex-start;gap:8px;line-height:1.6;word-break:keep-all;}
        .info-item::before{content:'·';color:var(--blue);font-weight:700;flex-shrink:0;}
        .info-item strong{color:var(--text);}

        /* TIMELINE */
        .timeline{margin-top:24px;display:flex;flex-direction:column;gap:0;}
        .tl-item{display:grid;grid-template-columns:100px 1fr;gap:16px;padding:16px 0;border-bottom:1px solid var(--stroke);}
        .tl-time{font-family:'Montserrat',sans-serif;font-size:12.5px;font-weight:700;color:var(--blue);padding-top:2px;}
        .tl-desc{font-size:13.5px;color:var(--text);line-height:1.6;}
        .tl-desc small{display:block;color:var(--muted);font-size:12px;margin-top:2px;}
        .tl-note{margin-top:12px;font-size:12px;color:#92400e;background:#fff7ed;border:1px solid #fed7aa;padding:12px 16px;border-radius:8px;line-height:1.6;}

        /* SHUTTLE TABLE */
        .shuttle-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-top:20px;}
        .shuttle-day{background:var(--white);border:1px solid var(--stroke);border-radius:12px;padding:16px 12px;text-align:center;transition:transform 200ms,box-shadow 200ms;}
        .shuttle-day:hover{transform:translateY(-2px);box-shadow:var(--shadow);}
        .shuttle-day-label{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;color:var(--blue);margin-bottom:8px;letter-spacing:0.1em;}
        .shuttle-day-dest{font-size:13px;font-weight:600;color:var(--text);line-height:1.5;}
        .shuttle-day.weekend{background:#fff7ed;border-color:#fed7aa;}
        .shuttle-day.weekend .shuttle-day-label{color:#c2410c;}

        /* DISCOUNT CARDS */
        .disc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:24px;}
        .disc-card{background:var(--white);border:1px solid var(--stroke);border-radius:16px;overflow:hidden;transition:transform 200ms,box-shadow 200ms;}
        .disc-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .disc-card-top{padding:20px 24px 16px;display:flex;align-items:center;justify-content:space-between;}
        .disc-card-top.student{background:linear-gradient(135deg,#eaf3fb,#dbeafe);}
        .disc-card-top.partner{background:linear-gradient(135deg,#f0fdf4,#dcfce7);}
        .disc-card-name{font-size:17px;font-weight:800;}
        .disc-badge{padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;}
        .disc-badge.blue{background:#bfdbfe;color:#1d4ed8;}
        .disc-badge.green{background:#bbf7d0;color:#15803d;}
        .disc-card-body{padding:16px 24px 22px;}
        .disc-card-desc{font-size:13px;color:var(--muted);line-height:1.7;word-break:keep-all;margin-bottom:10px;}
        .disc-card-meta{font-size:12px;color:#6b7280;line-height:1.6;}
        .disc-card-meta span{display:block;}
        .disc-card-warn{font-size:11px;color:#92400e;margin-top:6px;}

        /* RENT TABLE */
        .rent-table{width:100%;border-collapse:collapse;margin-top:20px;background:var(--white);border-radius:12px;overflow:hidden;border:1px solid var(--stroke);}
        .rent-table th{background:var(--blue);color:var(--white);padding:12px 16px;font-size:13px;font-weight:700;text-align:left;font-family:'Montserrat',sans-serif;letter-spacing:0.05em;}
        .rent-table td{padding:12px 16px;font-size:13.5px;border-bottom:1px solid var(--stroke);}
        .rent-table tr:last-child td{border-bottom:none;}
        .rent-table .price{font-family:'Montserrat',sans-serif;font-weight:700;color:var(--blue);}

        /* ACCOMMODATION CARDS */
        .acc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:24px;margin-top:24px;}
        .acc-card{background:var(--white);border:1px solid var(--stroke);border-radius:18px;overflow:hidden;transition:transform 200ms,box-shadow 200ms;}
        .acc-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .acc-card-img{width:100%;height:220px;position:relative;overflow:hidden;}
        .acc-card-img img{object-fit:cover;}
        .acc-card-top{padding:28px 28px 20px;position:relative;}
        .acc-card-top.dream{background:linear-gradient(135deg,#FFF8E1,#FFE8B0);}
        .acc-card-top.jpark{background:linear-gradient(135deg,#eaf3fb,#dbeafe);}
        .acc-card-top.cube{background:linear-gradient(135deg,#f0fdf4,#dcfce7);}
        .acc-card-emoji{font-size:40px;margin-bottom:12px;}
        .acc-card-name{font-size:20px;font-weight:800;margin-bottom:4px;}
        .acc-card-sub{font-size:13px;color:var(--muted);}
        .acc-card-body{padding:20px 28px 28px;}
        .acc-feat{font-size:13px;color:var(--muted);display:flex;align-items:flex-start;gap:8px;line-height:1.7;margin-bottom:6px;word-break:keep-all;}
        .acc-feat::before{content:'✓';color:var(--blue);font-weight:700;flex-shrink:0;}
        .acc-special{margin-top:14px;padding:14px 16px;background:var(--blue-light);border-radius:10px;font-size:12.5px;color:var(--blue-dark);line-height:1.7;word-break:keep-all;}
        .acc-special strong{color:var(--blue);}

        /* CTA */
        .cta-wrap{background:linear-gradient(135deg,var(--blue-dark),var(--blue));border-radius:16px;padding:48px;text-align:center;}
        .cta-wrap h3{font-size:28px;font-weight:800;color:var(--white);margin-bottom:10px;word-break:keep-all;}
        .cta-wrap p{font-size:14.5px;color:rgba(255,255,255,0.65);margin-bottom:28px;word-break:keep-all;}
        .cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
        .btn-white{background:var(--white);color:var(--blue-dark);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:transform 150ms,box-shadow 150ms;box-shadow:0 4px 16px rgba(0,0,0,0.15);}
        .btn-white:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,0.2);}
        .btn-outline-w{border:1.5px solid rgba(255,255,255,0.35);color:rgba(255,255,255,0.85);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:border-color 160ms,color 160ms;}
        .btn-outline-w:hover{border-color:var(--white);color:var(--white);}

        /* FOOTER */
        footer{background:var(--blue-dark);padding:40px 60px 24px;border-top:1px solid rgba(255,255,255,0.07);}
        .footer-inner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px;}
        .flogo{font-family:'Montserrat',sans-serif;font-size:18px;font-weight:800;color:var(--white);}
        .flogo .D{color:#5dc8f0;} .flogo .A{color:var(--yellow);}
        .flinks{display:flex;gap:20px;flex-wrap:wrap;}
        .flinks a{font-size:13px;color:rgba(255,255,255,0.45);transition:color 150ms;}
        .flinks a:hover{color:rgba(255,255,255,0.85);}
        .fcopy{font-size:11.5px;color:rgba(255,255,255,0.2);font-family:'Montserrat',sans-serif;margin-top:16px;max-width:1200px;margin-left:auto;margin-right:auto;}

        /* TUTOR CARDS */
        .tutor-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;}
        .tutor-card{background:var(--white);border:1px solid var(--stroke);border-radius:16px;overflow:hidden;transition:transform 200ms,box-shadow 200ms;}
        .tutor-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .tutor-card-top{padding:24px 24px 18px;}
        .tutor-card-top.academy{background:linear-gradient(135deg,#eaf3fb,#dbeafe);}
        .tutor-card-top.home{background:linear-gradient(135deg,#FFF8E1,#FFF3CD);}
        .tutor-card-icon{font-size:32px;margin-bottom:8px;}
        .tutor-card-title{font-size:17px;font-weight:800;margin-bottom:2px;}
        .tutor-card-sub{font-size:12.5px;color:var(--muted);}
        .tutor-card-body{padding:18px 24px 24px;}
        .tutor-item{font-size:13px;color:var(--muted);display:flex;align-items:flex-start;gap:8px;line-height:1.7;margin-bottom:6px;word-break:keep-all;}
        .tutor-item::before{content:'·';color:var(--blue);font-weight:700;flex-shrink:0;}
        .tutor-item strong{color:var(--text);}
        .tutor-meta{margin-top:14px;padding:14px 16px;background:#f8fafc;border-radius:10px;display:flex;flex-direction:column;gap:6px;}
        .tutor-meta-row{font-size:12.5px;color:var(--muted);display:flex;align-items:center;gap:8px;}
        .tutor-meta-row strong{color:var(--text);}
        .tutor-warn{margin-top:24px;padding:20px 24px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;font-size:13px;color:#92400e;line-height:1.75;word-break:keep-all;}
        .tutor-warn strong{color:#c2410c;}
        .tutor-warn-title{font-size:14px;font-weight:800;color:#c2410c;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
        .tutor-warn-list{display:flex;flex-direction:column;gap:4px;margin-top:8px;}
        .tutor-warn-item{display:flex;align-items:flex-start;gap:8px;}
        .tutor-warn-item::before{content:'·';color:#c2410c;font-weight:700;flex-shrink:0;}
        .tutor-warn-danger{margin-top:12px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:12.5px;color:#991b1b;font-weight:600;line-height:1.6;}

        /* PHOTO GRID */
        .photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:28px;}
        .photo-item{border-radius:14px;overflow:hidden;border:1px solid var(--stroke);box-shadow:0 2px 12px rgba(0,0,0,0.06);}
        .photo-item img{display:block;}
        .photo-caption{padding:12px 16px;font-size:12.5px;font-weight:600;color:var(--muted);background:var(--white);}
        .photo-full{margin-top:28px;border-radius:14px;overflow:hidden;border:1px solid var(--stroke);box-shadow:0 2px 12px rgba(0,0,0,0.06);}
        .photo-full img{display:block;}
        .photo-full .photo-caption{text-align:center;}
        .sec-split{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:start;margin-top:28px;}
        .sec-split-img{border-radius:14px;overflow:hidden;border:1px solid var(--stroke);box-shadow:0 4px 20px rgba(0,0,0,0.08);}
        .sec-split-img img{display:block;}

        /* FADE */
        .fade{opacity:0;transform:translateY(20px);transition:opacity 600ms ease,transform 600ms ease;}
        .fade.vis{opacity:1;transform:translateY(0);}

        @media(max-width:1024px){
          nav{padding:0 24px;} .nav-center{display:none;} .nav-right{display:none;} .hamburger{display:flex;}
          .page-hero{padding:90px 24px 48px;}
          .sec{padding:56px 24px;} .sec-bg-i,.sec-white-i{padding:56px 24px;}
          .feat-grid{grid-template-columns:1fr;}
          .disc-grid{grid-template-columns:1fr;}
          .acc-grid{grid-template-columns:1fr;}
          .shuttle-grid{grid-template-columns:repeat(4,1fr);}
          .tl-item{grid-template-columns:90px 1fr;gap:12px;}
          .footer-inner{flex-direction:column;align-items:flex-start;}
          .tutor-grid{grid-template-columns:1fr;}
          .photo-grid{grid-template-columns:1fr;}
          .sec-split{grid-template-columns:1fr;}
        }
        @media(max-width:600px){
          .shuttle-grid{grid-template-columns:repeat(2,1fr);}
        }
      `}</style>

      {/* NAV */}
      <nav id="mainNav">
        <a href="/" className="logo"><span className="D">D</span>ream<span className="A">A</span>cademy</a>
        <div className="nav-center">
          <div className="nav-dd">
            <a href="#">커리큘럼 <span className="nav-dd-arrow">▾</span></a>
            <div className="nav-dd-menu">
              <a href="/junior">주니어 커리큘럼</a>
              <a href="/kinder">킨더 커리큘럼</a>
            </div>
          </div>
          <a href="/package" className="nav-active">올인원패키지</a>
          <div className="nav-dd">
            <a href="#">숙소 <span className="nav-dd-arrow">▾</span></a>
            <div className="nav-dd-menu">
              <a href="/accommodation/dreamhouse">드림하우스 (독채)</a>
              <a href="/accommodation/jpark">제이파크</a>
              <a href="#">큐브나인</a>
            </div>
          </div>
          <a href="/playdream">플레이드림</a>
          <a href="/apply">패키지서비스신청</a>
          <a href="#">커뮤니티</a>
        </div>
        <div className="nav-right">
          <a href="http://pf.kakao.com/_Yuhxhn/chat" className="nav-cta" target="_blank" rel="noopener noreferrer">상담하기</a>
        </div>
        <button className="hamburger" onClick={() => setMobileNavOpen((v) => !v)}>
          <span></span><span></span><span></span>
        </button>
      </nav>

      {/* MOBILE NAV */}
      <div className={`mob-nav${mobileNavOpen ? " open" : ""}`}>
        <a href="/junior">주니어 커리큘럼</a>
        <a href="/kinder">킨더 커리큘럼</a>
        <a href="/package" style={{ color: "var(--blue)", fontWeight: 700 }}>▶ 올인원패키지</a>
        <a href="/accommodation/dreamhouse">드림하우스 (독채)</a>
        <a href="/accommodation/jpark">제이파크</a>
        <a href="#">큐브나인</a>
        <a href="/playdream">플레이드림</a>
          <a href="/apply">패키지서비스신청</a>
        <a href="#">커뮤니티</a>
        <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기 →</a>
      </div>

      {/* SECTION 1: HERO */}
      <div className="page-hero">
        <div className="page-hero-inner">
          <div className="page-tag fade">All-in-One Package</div>
          <h1 className="fade">드림 아카데미 <span className="hl">올인원패키지</span></h1>
          <p className="fade">수업, 숙소, 식사, 셔틀, 액티비티까지 All-in-One</p>
          <div className="hero-badges fade">
            <div className="hbadge">📚 수업</div>
            <div className="hbadge">🏠 숙소</div>
            <div className="hbadge">🍽️ 식사</div>
            <div className="hbadge">🚐 셔틀</div>
            <div className="hbadge blue">🎯 액티비티</div>
          </div>
        </div>
      </div>

      {/* SECTION 2: 숙소 안내 */}
      <div className="sec-white">
        <div className="sec-white-i fade">
          <div className="stag">Accommodation</div>
          <h2 className="sh">숙소 <span className="hl">안내</span></h2>
          <div className="divider"></div>
          <div className="acc-grid">
            {/* 드림하우스 */}
            <div className="acc-card">
              <div className="acc-card-img">
                <Image src="/images/dreamhouse.jpg" alt="드림하우스 외관" fill style={{ objectFit: "cover" }} />
              </div>
              <div className="acc-card-top dream">
                <div className="acc-card-emoji">🏡</div>
                <div className="acc-card-name">드림하우스</div>
                <div className="acc-card-sub">쓰리룸 독채 하우스</div>
              </div>
              <div className="acc-card-body">
                <div className="acc-feat">복층구조 방 3개 · 화장실 2개</div>
                <div className="acc-feat">24시간 가드 상주</div>
                <div className="acc-feat">그랜드몰, 상스몰과 5분 거리</div>
                <div className="acc-feat">관리센터 운영</div>
                <div className="acc-feat">각 집 담당 헬퍼 (월~토 근무, 청소, 빨래, 식사 준비)</div>
                <div className="acc-feat">빌리지 내 수영장, 테니스장, 농구장, 공원, 마트</div>
              </div>
            </div>

            {/* 제이파크 */}
            <div className="acc-card">
              <div className="acc-card-img">
                <Image src="/images/jpark.png" alt="J-Park Island Resort" fill style={{ objectFit: "cover" }} />
              </div>
              <div className="acc-card-top jpark">
                <div className="acc-card-emoji">🏨</div>
                <div className="acc-card-name">J-Park Island Resort</div>
                <div className="acc-card-sub">5성급 호텔 WITH 드림아카데미</div>
              </div>
              <div className="acc-card-body">
                <div className="acc-feat">수영장 5곳 · 비치 2개</div>
                <div className="acc-feat">뽀로로파크 · 헬스장</div>
                <div className="acc-feat">다양한 액티비티존</div>
                <div className="acc-feat">24시 의료실 · 한국인 매니저</div>
                <div className="acc-special">
                  <strong>드림아카데미 X 제이파크 패키지 특별혜택</strong><br/>
                  · 조식 50% 할인<br/>
                  · 제이파크 내 식당 30% 할인<br/>
                  · 어메니티 및 물·수건 제공<br/>
                  · 런더리 서비스 30% 할인
                </div>
              </div>
            </div>

            {/* 큐브나인 */}
            <div className="acc-card">
              <div className="acc-card-img">
                <Image src="/images/cube9.png" alt="CubeNine Resort & SPA" fill style={{ objectFit: "cover" }} />
              </div>
              <div className="acc-card-top cube">
                <div className="acc-card-emoji">🌊</div>
                <div className="acc-card-name">CubeNine Resort &amp; SPA</div>
                <div className="acc-card-sub">바다를 품은 프라이빗 리조트</div>
              </div>
              <div className="acc-card-body">
                <div className="acc-feat">바다 액티비티 무료 (카약 / 패들)</div>
                <div className="acc-feat">디럭스 오션룸: 오션뷰, 테라스, 선셋 베드</div>
                <div className="acc-feat">풀 억세스룸: 메인 풀장과 직접 연결</div>
                <div className="acc-feat">오션뷰와 함께 즐기는 레스토랑</div>
                <div className="acc-feat">마사지 샵</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 튜터 서비스 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Tutor Service</div>
          <h2 className="sh">튜터 <span className="hl">서비스</span></h2>
          <div className="divider"></div>

          <div className="tutor-grid">
            <div className="tutor-card">
              <div className="tutor-card-top academy">
                <div className="tutor-card-icon">🏫</div>
                <div className="tutor-card-title">아카데미 내 튜터</div>
                <div className="tutor-card-sub">연장 수업</div>
              </div>
              <div className="tutor-card-body">
                <div className="tutor-item">드림아카데미 정규 수업 종료 후 <strong>아카데미 내 진행</strong></div>
                <div className="tutor-item">정규 수업 복습 및 수업 시간 내 미완료 내용 이어서 진행 <strong>(별도 원하는 교재로 수업 진행 불가)</strong></div>
                <div className="tutor-item">킨더라인의 경우 색종이, 보드게임 등 <strong>놀이식 수업 진행 가능</strong></div>
                <div className="tutor-item">수업에 대한 개별적 피드백 미제공</div>
                <div className="tutor-meta">
                  <div className="tutor-meta-row">🕐 <strong>운영:</strong> 월~금 / 한타임당 50분</div>
                  <div className="tutor-meta-row">⏰ <strong>마지막 수업 종료:</strong> 17:50 / 1일 최대 2타임</div>
                  <div className="tutor-meta-row">💰 <strong>비용:</strong> 1:1 수업 ₱300 / 1:2 수업 ₱350</div>
                  <div className="tutor-meta-row">💳 <strong>결제:</strong> 수업 확정 후 전액 선결제 필수</div>
                </div>
              </div>
            </div>

            <div className="tutor-card">
              <div className="tutor-card-top home">
                <div className="tutor-card-icon">🏡</div>
                <div className="tutor-card-title">드림하우스 방문 튜터</div>
                <div className="tutor-card-sub">집으로 찾아가는 수업</div>
              </div>
              <div className="tutor-card-body">
                <div className="tutor-item">플레이드림 / 드림아카데미 티처가 <strong>집으로 방문</strong>하여 수업 진행</div>
                <div className="tutor-item">외부 활동 및 놀이터 등 <strong>외출 불가</strong></div>
                <div className="tutor-item">기본 워크지 등 학습 자료는 튜터가 준비 / 별도 원하는 교재는 <strong>개별 지참 필요</strong> (개별적 피드백 미제공)</div>
                <div className="tutor-item">아이가 어린 경우 색종이, 보드게임, 플래시카드 등 추천</div>
                <div className="tutor-meta">
                  <div className="tutor-meta-row">🕐 <strong>운영:</strong> 월~토 / 한타임당 50분</div>
                  <div className="tutor-meta-row">⏰ <strong>시간:</strong> 오전 10시~오후 8시 / 1일 최대 2타임</div>
                  <div className="tutor-meta-row">💰 <strong>비용:</strong> 1:1 수업 ₱300 / 1:2 수업 ₱350</div>
                  <div className="tutor-meta-row">💳 <strong>결제:</strong> 수업 확정 후 전액 선결제 필수</div>
                </div>
              </div>
            </div>
          </div>

          <div className="tutor-warn">
            <div className="tutor-warn-title">⚠️ 튜터 변경 및 환불규정</div>
            <div className="tutor-warn-list">
              <div className="tutor-warn-item"><strong>최소 2주 전</strong> 사전 예약 필수 / 성수기는 3주 전</div>
              <div className="tutor-warn-item">변경은 <strong>수업일 4일 전까지</strong> 가능 / 장소 변경 불가</div>
            </div>
            <div style={{ marginTop: "12px", fontWeight: 700 }}>아래 경우 변경 및 환불 불가:</div>
            <div className="tutor-warn-list">
              <div className="tutor-warn-item">당일 취소 및 일정 변경</div>
              <div className="tutor-warn-item">수업 시작 후 학생의 거부로 취소 요청</div>
              <div className="tutor-warn-item">수업 3일 전 이내 취소</div>
              <div className="tutor-warn-item">당일 2회 이상 변경</div>
            </div>
            <div className="tutor-warn-danger">⚠️ 당일 노쇼(무단 결석) 시 모든 수업 자동 취소, 환불 불가, 이후 수업 재신청도 불가</div>
          </div>
        </div>
      </div>

      {/* SECTION 3: After-School Activities */}
      <div className="sec fade">
        <div className="inc-badge">📦 패키지 포함</div>
        <div className="stag">After-School Activities</div>
        <h2 className="sh">아카데미 선생님과 함께하는<br/><span className="hl">특별한 액티비티 - 애프터 스쿨</span></h2>
        <div className="divider"></div>
        <p className="sp">체육, 예술, 퍼포먼스, 원서, 아트 등 다양한 방과 후 활동을 드림아카데미 선생님과 함께 경험합니다.</p>
        <div className="info-list">
          <div className="info-item"><strong>활동 장소:</strong> 베이스워터 빌리지 내 (드림하우스)</div>
          <div className="info-item"><strong>패키지 등록 고객 전용</strong></div>
          <div className="info-item"><strong>제이파크 패키지 고객</strong> 차량 지원</div>
          <div className="info-item"><strong>사전 신청 필수</strong></div>
        </div>
        <div className="feat-grid">
          <div className="feat-card">
            <div className="feat-icon">🌿</div>
            <div className="feat-title">Forest Walk</div>
            <p className="feat-desc">선생님과 함께 메모리얼 파크를 걸으며 다양한 식물과 나무를 관찰하고, 어휘력 확장과 묘사 능력 향상을 위한 주도된 영어 대화를 나누며 실생활 속에서 자연스럽게 영어를 활용하는 연습이 가능한 수업입니다.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">📚</div>
            <div className="feat-title">Book &amp; Art</div>
            <p className="feat-desc">각 레벨에 맞춘 수준별 도서 리딩 활동 후, 도서의 주제 및 내용을 기반으로 한 아트 프로젝트를 연계하여 진행합니다.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">⚽</div>
            <div className="feat-title">체육 활동</div>
            <p className="feat-desc">다양한 스포츠와 신체 활동으로 건강한 에너지를 발산합니다.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">🎭</div>
            <div className="feat-title">퍼포먼스</div>
            <p className="feat-desc">영어 연극, 발표 등 표현력을 키우는 퍼포먼스 활동입니다.</p>
          </div>
        </div>

        {/* 2026 After School Program 목록 */}
        <div className="feat-card" style={{ marginTop: "28px" }}>
          <div className="feat-title" style={{ marginBottom: "16px" }}>2026 After School &amp; Field Trip Program</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--blue)", marginBottom: "10px", padding: "6px 14px", background: "var(--blue-light)", borderRadius: "20px", display: "inline-block" }}>After School Program</div>
              <div className="info-list" style={{ marginTop: "10px" }}>
                <div className="info-item">Eco Planting and Herb : 식물 심기</div>
                <div className="info-item">Gross motor : 체육 중심 활동</div>
                <div className="info-item">Mini Olympics : 미니 올림픽</div>
                <div className="info-item">Nature Walk : 자연 관찰 산책 활동</div>
                <div className="info-item">Water Gun Fun : 물총 놀이</div>
                <div className="info-item">Balloon Tennis : 풍선 테니스</div>
                <div className="info-item">Book Hunt &amp; Puzzle : 책 탐색 &amp; 퍼즐 게임</div>
                <div className="info-item">Catching ball : 공 잡기 놀이</div>
                <div className="info-item">Hand base ball : 손 야구 게임</div>
                <div className="info-item">Flower arrangement : 꽃꽂이</div>
                <div className="info-item">Traffic Light Game : 신호등 게임</div>
                <div className="info-item">Snack Grabbing Game : 간식 잡기 게임</div>
                <div className="info-item">Origami activity : 종이 접기 활동</div>
                <div className="info-item">Plant observation : 식물 관찰 활동</div>
                <div className="info-item">Hula hoop and Jump rope : 훌라후프 &amp; 줄넘기</div>
                <div className="info-item">Pinwheel activity : 바람개비 게임</div>
                <div className="info-item">Art activity : 미술 활동</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#15803d", marginBottom: "10px", padding: "6px 14px", background: "#dcfce7", borderRadius: "20px", display: "inline-block" }}>Field Trip Program</div>
              <div className="info-list" style={{ marginTop: "10px" }}>
                <div className="info-item">Shrine Tour : 막탄의 대표 명소 쉬라인 투어</div>
                <div className="info-item">Nimo Brew : 파충류 및 식물 관찰 카페 체험 활동</div>
                <div className="info-item">SM Skating : 아이스스케이트장 방문</div>
                <div className="info-item">{"Magellan's Cross : 마젤란 십자가 방문 (역사 공부)"}</div>
                <div className="info-item">Crocolandia : 악어 및 파충류 관찰 활동</div>
                <div className="info-item">Kids Cafe : 키즈 카페 방문</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Field Trip */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="inc-badge">📦 패키지 포함</div>
          <div className="stag">Weekend Field Trip</div>
          <h2 className="sh">선생님과 함께하는<br/><span className="hl">체험 현장학습</span></h2>
          <div className="divider"></div>
          <p className="sp" style={{ marginBottom: "16px" }}>격주로 운영되는 체험 현장학습. 영어를 실전에서 활용하며 세부의 다양한 명소를 탐방합니다.</p>
          <div className="info-list" style={{ marginBottom: "28px" }}>
            <div className="info-item"><strong>운영:</strong> 격주 · 2주에 한 번씩 진행</div>
            <div className="info-item"><strong>패키지 고객:</strong> 무료 제공</div>
            <div className="info-item"><strong>비패키지 고객:</strong> 정가 1인 ₱3,000</div>
          </div>

          <p className="sp" style={{ marginBottom: "12px" }}>드림아카데미는 살아 있는 체험을 통해 배움의 즐거움을 느끼도록 하기 위해 정기적으로 현장학습 프로그램을 운영하고 있습니다.</p>
          <p className="sp" style={{ marginBottom: "28px" }}>크로코랜디아, SM Seaside, Museum 등 다양한 프로그램들이 준비되어 있습니다.</p>

          <div className="feat-card">
            <div className="feat-icon">🐊</div>
            <div className="feat-title">활동 일정 예시: 크로코랜디아 (Crocodile &amp; Nature Park)</div>
            <div className="timeline">
              <div className="tl-item">
                <div className="tl-time">10:00 AM</div>
                <div className="tl-desc">아카데미 등원 후 오전 스터디<small>악어 및 파충류 관련 주제 학습</small></div>
              </div>
              <div className="tl-item">
                <div className="tl-time">12:00 PM</div>
                <div className="tl-desc">점심 식사</div>
              </div>
              <div className="tl-item">
                <div className="tl-time">12:40 PM</div>
                <div className="tl-desc">크로코랜디아로 이동</div>
              </div>
              <div className="tl-item">
                <div className="tl-time">1:20 ~ 3:00</div>
                <div className="tl-desc">크로코랜디아 견학 및 체험 활동<small>피딩, 파충류 관찰 등 생태학습 및 실전 영어 활용</small></div>
              </div>
              <div className="tl-item">
                <div className="tl-time">3:30 PM</div>
                <div className="tl-desc">아카데미 도착 및 현장 귀가 진행</div>
              </div>
            </div>
            <div className="tl-note">※ 상기 일정 및 장소는 현지 사정에 따라 변경될 수 있습니다</div>
          </div>
        </div>
      </div>

      {/* SECTION 4: Shuttle */}
      <div className="sec-white">
        <div className="sec-white-i fade">
          <div className="inc-badge">📦 패키지 포함</div>
          <div className="stag">Tour Shuttle</div>
          <h2 className="sh">주말엔 드림 셔틀로<br/><span className="hl">편하게 떠나요!</span></h2>
          <div className="divider"></div>
          <p className="sp">패키지 고객만 이용 가능 · 사전 예약 필수</p>
          <div className="shuttle-grid">
            <div className="shuttle-day"><div className="shuttle-day-label">MON</div><div className="shuttle-day-dest">H mart</div></div>
            <div className="shuttle-day"><div className="shuttle-day-label">TUE</div><div className="shuttle-day-dest">SM Seaside</div></div>
            <div className="shuttle-day"><div className="shuttle-day-label">WED</div><div className="shuttle-day-dest">Shrine</div></div>
            <div className="shuttle-day"><div className="shuttle-day-label">THU</div><div className="shuttle-day-dest">Parola Restaurant</div></div>
            <div className="shuttle-day"><div className="shuttle-day-label">FRI</div><div className="shuttle-day-dest">Lantaw</div></div>
            <div className="shuttle-day weekend"><div className="shuttle-day-label">SAT</div><div className="shuttle-day-dest">Safari</div></div>
            <div className="shuttle-day weekend"><div className="shuttle-day-label">SUN</div><div className="shuttle-day-dest">Anjo World</div></div>
          </div>
        </div>
      </div>

      {/* SECTION 5: 드림 컴퍼니 연계할인 (학생증 10%) */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Dream Company</div>
          <h2 className="sh">드림 컴퍼니 <span className="hl">연계 할인</span></h2>
          <div className="divider"></div>
          <p className="sp" style={{ marginBottom: "8px" }}>학생증 지참 시 10% 할인</p>
          <div className="disc-grid">
            <div className="disc-card">
              <div className="disc-card-top student">
                <div className="disc-card-name">Play Dream</div>
                <div className="disc-badge blue">10% 할인</div>
              </div>
              <div className="disc-card-body">
                <p className="disc-card-desc">영어로 놀고, 만들고, 배우는 즐거운 시간! 쿠킹, 아트, 과학, 서브젝트 수업, 올데이까지</p>
                <div className="disc-card-meta">
                  <span>📍 가이사노 그랜드몰 2층</span>
                  <span>💬 카카오톡 채널: 세부 플레이드림</span>
                </div>
              </div>
            </div>
            <div className="disc-card">
              <div className="disc-card-top student">
                <div className="disc-card-name">88식당</div>
                <div className="disc-badge blue">10% 할인</div>
              </div>
              <div className="disc-card-body">
                <p className="disc-card-desc">삼겹살부터 감자탕까지! 뉴타운 근처 유명 한식 맛집</p>
                <div className="disc-card-meta">
                  <span>📍 H마트 옆</span>
                  <span>💬 카카오톡 ID: 88cebu</span>
                </div>
              </div>
            </div>
            <div className="disc-card">
              <div className="disc-card-top student">
                <div className="disc-card-name">모리식당</div>
                <div className="disc-badge blue">10% 할인</div>
              </div>
              <div className="disc-card-body">
                <p className="disc-card-desc">한식, 현지식, 샤브샤브 등 다양한 메뉴 · 베이스워터 도보 5분</p>
                <div className="disc-card-meta">
                  <span>📍 베이스워터 마시와 게이트</span>
                  <span>💬 카카오톡 ID: cebuminam</span>
                </div>
                <p className="disc-card-warn">* 무제한 삼겹살 할인 불가</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: 10~20% 연계할인 */}
      <div className="sec-white">
        <div className="sec-white-i fade">
          <div className="stag">Partner Discount</div>
          <h2 className="sh">10~20% <span className="hl">연계 할인</span></h2>
          <div className="divider"></div>
          <div className="disc-grid">
            <div className="disc-card">
              <div className="disc-card-top partner">
                <div className="disc-card-name">큐브나인 마사지 &amp; 스파</div>
                <div className="disc-badge green">20% 할인</div>
              </div>
              <div className="disc-card-body">
                <p className="disc-card-desc">프라이빗 리조트에서 즐기는 힐링 마사지와 스파</p>
                <div className="disc-card-meta"><span>📍 마리곤돈 큐브나인 리조트</span></div>
              </div>
            </div>
            <div className="disc-card">
              <div className="disc-card-top partner">
                <div className="disc-card-name">더 나인 레스토랑</div>
                <div className="disc-badge green">10% 할인</div>
              </div>
              <div className="disc-card-body">
                <p className="disc-card-desc">큐브나인 리조트 내 레스토랑</p>
                <div className="disc-card-meta"><span>📍 마리곤돈 큐브나인 리조트</span></div>
                <p className="disc-card-warn">* 패키지 식사 바우처 사용 시 할인 제외</p>
              </div>
            </div>
            <div className="disc-card">
              <div className="disc-card-top partner">
                <div className="disc-card-name">Crab Boil &amp; BBQ</div>
                <div className="disc-badge green">할인</div>
              </div>
              <div className="disc-card-body">
                <p className="disc-card-desc">세부 유명 알리망오 크랩 맛집 · MARIBAGO BRANCH</p>
                <div className="disc-card-meta"><span>📍 상스몰 제이파크 맞은편</span></div>
                <p className="disc-card-warn">* 주류, 음료 할인 제외</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 7: 드림카 (렌트카) */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Dream Car</div>
          <h2 className="sh">드림카 <span className="hl">렌트카 서비스</span></h2>
          <div className="divider"></div>
          <p className="sp" style={{ marginBottom: "16px" }}>렌트카 예약이 어려우셨던 분들을 위해, 드림 렌트카 서비스를 제공합니다.</p>
          <div className="info-list" style={{ marginBottom: "24px" }}>
            <div className="info-item"><strong>드림 아카데미 패키지 이용 고객</strong>에 한해 이용 가능</div>
            <div className="info-item">차량 탑승 정원 <strong>최대 10인</strong></div>
            <div className="info-item">왕복 표기가 없는 요금은 모두 <strong>편도 요금</strong></div>
            <div className="info-item"><strong>사전 예약 필수</strong></div>
          </div>
          <table className="rent-table">
            <thead>
              <tr><th>구간</th><th>요금</th></tr>
            </thead>
            <tbody>
              <tr><td>기본 2시간</td><td className="price">₱1,000</td></tr>
              <tr><td>추가 시간당</td><td className="price">₱350</td></tr>
              <tr><td>파크몰 / SM Seaside</td><td className="price">₱700</td></tr>
              <tr><td>드림하우스 → 그랜드몰</td><td className="price">₱100</td></tr>
              <tr><td>드림하우스 → Pier 1 (CCLEX 포함)</td><td className="price">₱700</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="cta-wrap">
            <h3>드림 아카데미 올인원 패키지로<br/>세부 영어 캠프를 시작하세요</h3>
            <p>패키지 상담 및 신청은 아래 버튼을 통해 진행해 주세요.</p>
            <div className="cta-btns">
              <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer" className="btn-white">카카오톡 상담하기 →</a>
              <a href="/apply" className="btn-outline-w">패키지 서비스 신청</a>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <span className="flogo"><span className="D">D</span>ream<span className="A">A</span>cademy</span>
          <div className="flinks">
            <a href="/">홈</a>
            <a href="/junior">주니어 커리큘럼</a>
            <a href="/kinder">킨더 커리큘럼</a>
            <a href="/package">올인원패키지</a>
            <a href="/shuttle">셔틀 신청</a>
            <a href="/after-school-fieldtrip">애프터스쿨</a>
            <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기</a>
          </div>
        </div>
        <div className="fcopy">© 2026 Dream Academy by Dream Company. All rights reserved. · Cebu, Philippines</div>
      </footer>
    </>
  );
}
