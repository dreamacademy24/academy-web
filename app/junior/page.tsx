"use client";
import { useEffect, useState } from "react";

export default function JuniorPage() {
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
          --sky:#29a9e0; --green:#2da84e; --yellow:#f5a623;
          --white:#fff; --off:#f8fafc; --text:#1a1a2e; --muted:#6b7c93;
          --stroke:#e2e8f0; --shadow:0 8px 40px rgba(0,0,0,0.09);
          --shadow-lg:0 20px 60px rgba(26,111,196,0.13);
        }

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
          padding:110px 60px 64px;
          background:linear-gradient(135deg,var(--blue-light) 0%,#dbeafe 40%,#f0f9ff 100%);
          border-bottom:1px solid var(--stroke);
        }
        .page-hero-inner{max-width:1200px;margin:0 auto;}
        .breadcrumb{font-size:13px;color:var(--muted);margin-bottom:16px;display:flex;align-items:center;gap:6px;}
        .breadcrumb a{color:var(--blue);}
        .page-tag{font-family:'Montserrat',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:0.25em;text-transform:uppercase;color:var(--blue);margin-bottom:12px;display:flex;align-items:center;gap:9px;}
        .page-tag::before{content:'';width:22px;height:2px;background:var(--blue);border-radius:2px;}
        .page-hero h1{font-size:clamp(32px,4vw,52px);font-weight:800;line-height:1.18;letter-spacing:-0.025em;margin-bottom:12px;word-break:keep-all;}
        .page-hero h1 .bl{color:var(--blue);}
        .page-hero p{font-size:15px;color:var(--muted);line-height:1.85;max-width:580px;word-break:keep-all;margin-bottom:20px;}
        .hero-badges{display:flex;gap:10px;flex-wrap:wrap;}
        .hbadge{display:inline-flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--stroke);padding:7px 14px;border-radius:20px;font-size:12.5px;font-weight:600;color:var(--text);box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .hbadge.blue{background:var(--blue-light);border-color:rgba(26,111,196,0.2);color:var(--blue);}

        /* SECTIONS */
        .sec{padding:80px 60px;max-width:1200px;margin:0 auto;}
        .sec-bg{background:var(--off);}
        .sec-bg-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .sec-dark{background:var(--blue-dark);}
        .sec-dark-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .stag{font-family:'Montserrat',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:var(--blue);margin-bottom:10px;display:flex;align-items:center;gap:9px;}
        .stag::before{content:'';width:20px;height:2px;background:var(--blue);border-radius:2px;}
        .stag.lt{color:rgba(255,255,255,0.5);} .stag.lt::before{background:rgba(255,255,255,0.4);}
        .sh{font-size:clamp(24px,3vw,38px);font-weight:800;line-height:1.22;letter-spacing:-0.022em;margin-bottom:12px;word-break:keep-all;}
        .sh .bl{color:var(--blue);} .sh .yl{color:var(--yellow);} .sh .gr{color:var(--green);}
        .sh.wh{color:var(--white);}
        .sp{font-size:14px;color:var(--muted);line-height:1.9;max-width:560px;word-break:keep-all;}
        .sp.wh{color:rgba(255,255,255,0.6);}
        .divb{width:40px;height:3px;background:var(--blue);margin:12px 0 22px;border-radius:2px;}
        .divy{width:40px;height:3px;background:var(--yellow);margin:12px 0 22px;border-radius:2px;}
        .divg{width:40px;height:3px;background:var(--green);margin:12px 0 22px;border-radius:2px;}

        /* TIMETABLE */
        .tt-wrap{display:grid;grid-template-columns:1fr 1.8fr;gap:56px;align-items:start;}
        .tt-table{width:100%;border-collapse:collapse;margin-top:4px;}
        .tt-table tr{border-bottom:1px solid var(--stroke);}
        .tt-table td{padding:12px 14px;font-size:13.5px;vertical-align:middle;}
        .tt-time{color:var(--muted);font-family:'Montserrat',sans-serif;font-size:12.5px;white-space:nowrap;width:120px;}
        .tt-badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;font-family:'Montserrat',sans-serif;letter-spacing:0.05em;}
        .tt-1on1{background:#dbeafe;color:#1e40af;}
        .tt-sons{background:#dcfce7;color:#166534;}
        .tt-fclass{background:#fef9c3;color:#854d0e;}
        .tt-break{background:#f3f4f6;color:#6b7280;}
        .tt-min{color:var(--muted);font-size:12px;font-family:'Montserrat',sans-serif;text-align:right;}
        .tt-note{font-size:12.5px;color:var(--muted);padding:14px 16px;background:var(--blue-light);border-left:3px solid var(--blue);border-radius:0 6px 6px 0;margin-top:16px;line-height:1.7;}

        /* CLASS CARDS */
        .class-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:8px;}
        .ccard{border-radius:14px;overflow:hidden;border:1px solid var(--stroke);background:var(--white);box-shadow:0 2px 12px rgba(0,0,0,0.06);transition:transform 200ms,box-shadow 200ms;}
        .ccard:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .ccard-top{padding:28px 24px 22px;position:relative;}
        .ccard.c1 .ccard-top{background:linear-gradient(135deg,#eff8ff,#dbeafe);}
        .ccard.c2 .ccard-top{background:linear-gradient(135deg,#f0fdf4,#dcfce7);}
        .ccard.c3 .ccard-top{background:linear-gradient(135deg,#fffbeb,#fef9c3);}
        .ccard-badge{display:inline-block;font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;margin-bottom:14px;font-family:'Montserrat',sans-serif;letter-spacing:0.08em;}
        .ccard.c1 .ccard-badge{background:#bfdbfe;color:#1d4ed8;}
        .ccard.c2 .ccard-badge{background:#bbf7d0;color:#15803d;}
        .ccard.c3 .ccard-badge{background:#fde68a;color:#92400e;}
        .ccard-t{font-size:20px;font-weight:800;margin-bottom:4px;letter-spacing:-0.01em;}
        .ccard-ko{font-size:12.5px;color:var(--muted);margin-bottom:0;}
        .ccard-body{padding:20px 24px 24px;}
        .ccard-desc{font-size:13.5px;color:var(--muted);line-height:1.8;margin-bottom:18px;word-break:keep-all;}
        .ccard-feats{display:flex;flex-direction:column;gap:7px;}
        .ccard-feat{font-size:13px;color:var(--text);display:flex;align-items:flex-start;gap:8px;}
        .ccard-feat .ck{flex-shrink:0;margin-top:1px;font-size:12px;}
        .ccard.c1 .ck{color:#2563eb;}
        .ccard.c2 .ck{color:var(--green);}
        .ccard.c3 .ck{color:var(--yellow);}

        /* SUBJECT CARDS (S-on-S) */
        .subj-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:8px;}
        .subj-card{border:1px solid var(--stroke);border-radius:12px;padding:24px;background:var(--white);transition:box-shadow 200ms,transform 200ms;}
        .subj-card:hover{box-shadow:var(--shadow);transform:translateY(-2px);}
        .subj-num{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;color:var(--blue);margin-bottom:8px;}
        .subj-title{font-size:18px;font-weight:800;margin-bottom:4px;}
        .subj-en{font-size:12px;color:var(--muted);margin-bottom:14px;font-family:'Montserrat',sans-serif;}
        .subj-desc{font-size:13px;color:var(--muted);line-height:1.78;word-break:keep-all;margin-bottom:14px;}
        .subj-tags{display:flex;flex-wrap:wrap;gap:6px;}
        .subj-tag{font-size:11.5px;padding:3px 10px;border-radius:20px;background:var(--blue-light);color:var(--blue);border:1px solid rgba(26,111,196,0.15);}
        .subj-highlight{background:linear-gradient(135deg,var(--blue-light),#dbeafe);border:1px solid rgba(26,111,196,0.2);border-radius:10px;padding:16px 18px;margin-top:12px;font-size:13px;color:var(--blue-dark);font-weight:600;line-height:1.6;word-break:keep-all;}

        /* PHOTO SECTION */
        .photo-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:8px;}
        .photo-item{border-radius:10px;overflow:hidden;aspect-ratio:4/3;}
        .photo-item img{width:100%;height:100%;object-fit:cover;transition:transform 300ms;}
        .photo-item:hover img{transform:scale(1.04);}

        /* INFO BOX */
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:8px;}
        .ibox{background:var(--white);border:1px solid var(--stroke);border-radius:12px;padding:24px;}
        .ibox-t{font-size:15px;font-weight:800;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
        .ibox-list{display:flex;flex-direction:column;gap:8px;}
        .ibox-row{font-size:13.5px;color:var(--muted);display:flex;align-items:flex-start;gap:8px;line-height:1.6;word-break:keep-all;}
        .ibox-row::before{content:'·';color:var(--blue);font-weight:700;flex-shrink:0;}
        .ibox-row strong{color:var(--text);}
        .warn-box{background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:18px 20px;font-size:13px;color:#92400e;line-height:1.75;word-break:keep-all;}
        .warn-box strong{color:#c2410c;}

        /* CTA */
        .cta-wrap{background:linear-gradient(135deg,var(--blue-dark),var(--blue));border-radius:16px;padding:48px;text-align:center;}
        .cta-wrap h3{font-size:28px;font-weight:800;color:var(--white);margin-bottom:10px;word-break:keep-all;}
        .cta-wrap p{font-size:14.5px;color:rgba(255,255,255,0.65);margin-bottom:28px;word-break:keep-all;}
        .cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
        .btn-white{background:var(--white);color:var(--blue-dark);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:transform 150ms,box-shadow 150ms;box-shadow:0 4px 16px rgba(0,0,0,0.15);}
        .btn-white:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,0.2);}
        .btn-outline-w{border:1.5px solid rgba(255,255,255,0.35);color:rgba(255,255,255,0.85);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:border-color 160ms,color 160ms;}
        .btn-outline-w:hover{border-color:var(--white);color:var(--white);}

        /* SWITCH */
        .curr-switch{display:flex;gap:12px;margin-bottom:36px;}
        .sw-btn{padding:10px 24px;border-radius:24px;font-size:14px;font-weight:600;cursor:pointer;border:1.5px solid var(--stroke);color:var(--muted);background:var(--white);transition:all 160ms;}
        .sw-btn.active{background:var(--blue);color:var(--white);border-color:var(--blue);}
        .sw-btn:hover:not(.active){border-color:var(--blue);color:var(--blue);}

        /* FOOTER */
        footer{background:var(--blue-dark);padding:40px 60px 24px;border-top:1px solid rgba(255,255,255,0.07);}
        .footer-inner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px;}
        .flogo{font-family:'Montserrat',sans-serif;font-size:18px;font-weight:800;color:var(--white);}
        .flogo .D{color:#5dc8f0;} .flogo .A{color:var(--yellow);}
        .flinks{display:flex;gap:20px;flex-wrap:wrap;}
        .flinks a{font-size:13px;color:rgba(255,255,255,0.45);transition:color 150ms;}
        .flinks a:hover{color:rgba(255,255,255,0.85);}
        .fcopy{font-size:11.5px;color:rgba(255,255,255,0.2);font-family:'Montserrat',sans-serif;margin-top:16px;max-width:1200px;margin-left:auto;margin-right:auto;}

        /* FADE */
        .fade{opacity:0;transform:translateY(20px);transition:opacity 600ms ease,transform 600ms ease;}
        .fade.vis{opacity:1;transform:translateY(0);}
        .fade.d1{transition-delay:80ms;} .fade.d2{transition-delay:160ms;} .fade.d3{transition-delay:240ms;}

        @media(max-width:1024px){
          nav{padding:0 24px;} .nav-center{display:none;} .nav-right{display:none;} .hamburger{display:flex;}
          .page-hero{padding:90px 24px 48px;}
          .sec{padding:56px 24px;} .sec-bg-i,.sec-dark-i{padding:56px 24px;}
          .tt-wrap{grid-template-columns:1fr;}
          .class-grid{grid-template-columns:1fr;}
          .subj-grid{grid-template-columns:1fr;}
          .photo-grid{grid-template-columns:1fr 1fr;}
          .info-grid{grid-template-columns:1fr;}
          .footer-inner{flex-direction:column;align-items:flex-start;}
        }
      `}</style>

      {/* NAV */}
      <nav id="mainNav">
        <a href="/" className="logo">
          <span className="D">D</span>ream<span className="A">A</span>cademy
        </a>
        <div className="nav-center">
          <div className="nav-dd">
            <a href="#" className="nav-active">
              커리큘럼 <span className="nav-dd-arrow">▾</span>
            </a>
            <div className="nav-dd-menu">
              <a href="/junior" style={{ color: "var(--blue)", fontWeight: 600 }}>
                ▶ 주니어 커리큘럼
              </a>
              <a href="/kinder">킨더 커리큘럼</a>
            </div>
          </div>
          <a href="/package">올인원패키지</a>
          <div className="nav-dd">
            <a href="#">
              숙소 <span className="nav-dd-arrow">▾</span>
            </a>
            <div className="nav-dd-menu">
              <a href="/accommodation/dreamhouse">드림하우스 (독채)</a>
              <a href="#">제이파크</a>
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
        <button
          className="hamburger"
          onClick={() => setMobileNavOpen((v) => !v)}
        >
          <span></span><span></span><span></span>
        </button>
      </nav>

      {/* MOBILE NAV */}
      <div className={`mob-nav${mobileNavOpen ? " open" : ""}`} id="mobnav">
        <a href="/junior" style={{ color: "var(--blue)", fontWeight: 700 }}>
          ▶ 주니어 커리큘럼
        </a>
        <a href="/kinder">킨더 커리큘럼</a>
        <a href="/package">올인원패키지</a>
        <a href="/accommodation/dreamhouse">드림하우스 (독채)</a>
        <a href="#">제이파크</a>
        <a href="#">큐브나인</a>
        <a href="/playdream">플레이드림</a>
          <a href="/apply">패키지서비스신청</a>
        <a href="#">커뮤니티</a>
        <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기 →</a>
      </div>

      {/* PAGE HERO */}
      <div className="page-hero">
        <div className="page-hero-inner">
          <div className="breadcrumb fade">
            <a href="/">홈</a> › 커리큘럼 › 주니어
          </div>
          <div className="page-tag">Junior Curriculum · 주니어 커리큘럼</div>
          <h1 className="fade">
            초등학생을 위한<br/>
            <span className="bl">체계적인 영어 수업</span>
          </h1>
          <p className="fade">
            학생 개개인의 레벨에 맞춘 1:1 수업부터 소그룹 참여형 수업, 즐거운 액티비티 수업까지.
            <br/>
            드림아카데미 주니어 라인에서 영어가 일상이 됩니다.
          </p>
          <div className="hero-badges fade">
            <div className="hbadge">🎒 초1 ~ 중2</div>
            <div className="hbadge">⏰ 9:00 ~ 16:00</div>
            <div className="hbadge blue">1-on-1 · S-on-S · Funtivity</div>
            <div className="hbadge">월~금 수업</div>
          </div>
        </div>
      </div>

      {/* 커리큘럼 전환 버튼 */}
      <div style={{ background: "var(--white)", borderBottom: "1px solid var(--stroke)", padding: "0 60px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 0 }}>
          <a href="/junior" style={{ padding: "16px 24px", fontSize: 14, fontWeight: 700, color: "var(--blue)", borderBottom: "2px solid var(--blue)", marginBottom: -1, fontFamily: "'Montserrat',sans-serif", letterSpacing: "0.03em" }}>
            🎒 Junior Line
          </a>
          <a href="/kinder" style={{ padding: "16px 24px", fontSize: 14, fontWeight: 500, color: "var(--muted)", borderBottom: "2px solid transparent", marginBottom: -1, fontFamily: "'Montserrat',sans-serif", letterSpacing: "0.03em" }}>
            🌱 Kinder Line
          </a>
        </div>
      </div>

      {/* TIMETABLE */}
      <div className="sec fade">
        <div className="stag">Time Table</div>
        <h2 className="sh">
          주니어 <span className="bl">수업 시간표</span>
        </h2>
        <div className="divb"></div>
        <div className="tt-wrap">
          <div>
            <p className="sp" style={{ marginBottom: 20 }}>
              매일 <strong>9:00 ~ 16:00</strong> 수업이 진행됩니다.<br/>
              1-on-1 수업 4회 &amp; S-on-S 수업 4회로 구성된 하루 일정입니다.
            </p>
            <div className="tt-note">
              ✅ <strong>주니어라인 하루 구성</strong><br/>
              9:00~16:00 일정 · 1 on 1 class 4회 &amp; S-on-S class 4회<br/>
              점심 및 간식 포함 · 샘플 시간표 기준
            </div>
          </div>
          <table className="tt-table">
            <tbody>
              <tr>
                <td className="tt-time">9:00 ~ 9:40</td>
                <td><span className="tt-badge tt-1on1">1-on-1</span></td>
                <td className="tt-min">40 min</td>
              </tr>
              <tr>
                <td className="tt-time">9:45 ~ 10:25</td>
                <td><span className="tt-badge tt-sons">S-on-S</span></td>
                <td className="tt-min">40 min</td>
              </tr>
              <tr>
                <td className="tt-time">10:35 ~ 11:15</td>
                <td><span className="tt-badge tt-sons">S-on-S</span></td>
                <td className="tt-min">40 min</td>
              </tr>
              <tr>
                <td className="tt-time">11:20 ~ 12:00</td>
                <td><span className="tt-badge tt-1on1">1-on-1</span></td>
                <td className="tt-min">40 min</td>
              </tr>
              <tr>
                <td className="tt-time">12:00 ~ 12:50</td>
                <td><span className="tt-badge tt-break">Lunch 🍱</span></td>
                <td className="tt-min">&ndash;</td>
              </tr>
              <tr>
                <td className="tt-time">12:50 ~ 13:30</td>
                <td><span className="tt-badge tt-1on1">1-on-1</span></td>
                <td className="tt-min">40 min</td>
              </tr>
              <tr>
                <td className="tt-time">13:35 ~ 14:15</td>
                <td><span className="tt-badge tt-sons">S-on-S</span></td>
                <td className="tt-min">40 min</td>
              </tr>
              <tr>
                <td className="tt-time">14:15 ~ 14:30</td>
                <td><span className="tt-badge tt-break">Snack 🍪</span></td>
                <td className="tt-min">&ndash;</td>
              </tr>
              <tr>
                <td className="tt-time">14:30 ~ 15:10</td>
                <td><span className="tt-badge tt-1on1">1-on-1</span></td>
                <td className="tt-min">40 min</td>
              </tr>
              <tr>
                <td className="tt-time">15:15 ~ 16:00</td>
                <td><span className="tt-badge tt-fclass">F-class ⭐</span></td>
                <td className="tt-min">45 min</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3대 수업 */}
      <div className="sec-bg">
        <div className="sec-bg-i">
          <div className="fade">
            <div className="stag">Curriculum</div>
            <h2 className="sh">
              3가지 수업으로<br/>
              <span className="bl">완성되는 영어</span>
            </h2>
            <div className="divb"></div>
          </div>
          <div className="class-grid fade">
            {/* Card 1: 1-on-1 */}
            <div className="ccard c1">
              <div className="ccard-top">
                <div className="ccard-badge">1-on-1</div>
                <div className="ccard-t">ONE ON ONE</div>
                <div className="ccard-ko">개인 맞춤 1:1 수업</div>
              </div>
              <div className="ccard-body">
                <p className="ccard-desc">
                  학생 개개인의 레벨을 고려한 맞춤형 수업. 말하기, 듣기, 읽기, 쓰기, 어휘 등 영어 전 영역을 균형 있게 향상시킵니다.
                </p>
                <div className="ccard-feats">
                  <div className="ccard-feat"><span className="ck">✓</span>Speaking / Listening drill</div>
                  <div className="ccard-feat"><span className="ck">✓</span>Reading / Writing drill</div>
                  <div className="ccard-feat"><span className="ck">✓</span>Vocabulary drill</div>
                  <div className="ccard-feat"><span className="ck">✓</span>약점 보완 + 강점 강화 맞춤 구성</div>
                  <div className="ccard-feat"><span className="ck">✓</span>자체 제작 교재 · 훈련된 교사진</div>
                </div>
              </div>
            </div>

            {/* Card 2: S-on-S */}
            <div className="ccard c2">
              <div className="ccard-top">
                <div className="ccard-badge">S-on-S</div>
                <div className="ccard-t">STUDY ON SUBJECT</div>
                <div className="ccard-ko">최대 1:6 소그룹 참여형 수업</div>
              </div>
              <div className="ccard-body">
                <p className="ccard-desc">
                  레벨별 소그룹으로 진행되는 주제 중심 영어 수업. 영어로 생각하고 표현하며 소통하는 능동적 수업입니다.
                </p>
                <div className="ccard-feats">
                  <div className="ccard-feat"><span className="ck">✓</span>BTS · Solomon · Trump · Dream</div>
                  <div className="ccard-feat"><span className="ck">✓</span>레벨에 맞는 역할 배정 맞춤형 활동</div>
                  <div className="ccard-feat"><span className="ck">✓</span>하루 4타임, 다양한 주제</div>
                  <div className="ccard-feat"><span className="ck">✓</span>답만 쓰는 수동적 수업 NO</div>
                </div>
              </div>
            </div>

            {/* Card 3: F-class */}
            <div className="ccard c3">
              <div className="ccard-top">
                <div className="ccard-badge">F-class</div>
                <div className="ccard-t">FUNTIVITY</div>
                <div className="ccard-ko">즐겁게 배우는 창의 영어</div>
              </div>
              <div className="ccard-body">
                <p className="ccard-desc">
                  매일 마지막 그룹 수업. 롤플레잉, 야외 활동, 노래, 요리 등 다양한 활동 중심의 수업으로 영어를 즐겁게 익힙니다.
                </p>
                <div className="ccard-feats">
                  <div className="ccard-feat"><span className="ck">✓</span>Fun 1: Vocab + Lyrics (노래)</div>
                  <div className="ccard-feat"><span className="ck">✓</span>Fun 2: Script + Play (연극)</div>
                  <div className="ccard-feat"><span className="ck">✓</span>Fun 3: Recipe + Chef (요리)</div>
                  <div className="ccard-feat"><span className="ck">✓</span>Fun 4: Talent Show / Party</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* S-on-S SUBJECTS */}
      <div className="sec fade">
        <div className="stag">S-on-S Subjects</div>
        <h2 className="sh">
          S-on-S <span className="bl">4가지 수업 주제</span>
        </h2>
        <div className="divb"></div>
        <p className="sp" style={{ marginBottom: 32 }}>
          매주 월~금, BTS 소나스 수업이 진행됩니다. 월~목요일에는 특정 직업과 관련된 역할, 기능, 준비사항을 단계별로 학습하고, 금요일에는 최종 발표를 진행합니다.
        </p>
        <div className="subj-grid">
          {/* Subject 01 */}
          <div className="subj-card">
            <div className="subj-num">SUBJECT 01</div>
            <div className="subj-title">BTS — Individual Skill</div>
            <div className="subj-en">Plan Your Speech · Become a Special Character</div>
            <p className="subj-desc">
              스피킹 스킬과 영어적 사고력 개발에 집중. 다양한 직업 역할을 수행하며 실생활 영어를 연습합니다.
            </p>
            <div className="subj-tags">
              <span className="subj-tag">Weather Caster</span>
              <span className="subj-tag">Newscaster</span>
              <span className="subj-tag">Developer</span>
              <span className="subj-tag">Idol</span>
              <span className="subj-tag">Teacher</span>
            </div>
            <div className="subj-highlight">
              🎤 This approach makes Learning both enjoyable and effective!
            </div>
          </div>

          {/* Subject 02 */}
          <div className="subj-card">
            <div className="subj-num">SUBJECT 02</div>
            <div className="subj-title">Solomon — Group Skill</div>
            <div className="subj-en">Supporters vs. Opponents · Teamwork Presentation</div>
            <p className="subj-desc">
              찬반 토론과 팀 프레젠테이션을 통해 듣기, 정리, 쓰기, 발표 능력을 종합적으로 개발합니다.
            </p>
            <div className="subj-tags">
              <span className="subj-tag">토론</span>
              <span className="subj-tag">팀워크</span>
              <span className="subj-tag">리서치</span>
              <span className="subj-tag">발표</span>
            </div>
            <div className="subj-highlight">
              🏛️ This method promotes collaboration and effectively enhances communication skills!
            </div>
          </div>

          {/* Subject 03 */}
          <div className="subj-card">
            <div className="subj-num">SUBJECT 03</div>
            <div className="subj-title">Trump — Individual &amp; Group</div>
            <div className="subj-en">Election Campaign · Learn About Great Figures</div>
            <p className="subj-desc">
              선거 캠페인 진행 및 위인 탐구를 통해 개인 역량과 그룹 협업을 동시에 강화합니다.
            </p>
            <div className="subj-tags">
              <span className="subj-tag">후보</span>
              <span className="subj-tag">대변인</span>
              <span className="subj-tag">선거운동원</span>
              <span className="subj-tag">위인탐구</span>
            </div>
            <div className="subj-highlight">
              🗳️ Emphasizes both individual skill development and group collaboration!
            </div>
          </div>

          {/* Subject 04 */}
          <div className="subj-card">
            <div className="subj-num">SUBJECT 04</div>
            <div className="subj-title">Dream — Group Skill</div>
            <div className="subj-en">Magazine · Newspaper · Encyclopedia · Poems</div>
            <p className="subj-desc">
              창의성, 협업, 영어 언어와 문화에 대한 깊은 이해를 동시에 키우는 프로젝트형 수업입니다.
            </p>
            <div className="subj-tags">
              <span className="subj-tag">Dream Magazine</span>
              <span className="subj-tag">Dream Newspaper</span>
              <span className="subj-tag">Encyclopedia</span>
              <span className="subj-tag">Poems</span>
            </div>
            <div className="subj-highlight">
              📰 Encourages creativity, collaboration, and deeper understanding!
            </div>
          </div>
        </div>
      </div>

      {/* 수업 사진 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Class Photos</div>
          <h2 className="sh">
            수업 현장 <span className="bl">생생한 모습</span>
          </h2>
          <div className="divb"></div>
          <div className="photo-grid">
            {/* PHOTO_PLACEHOLDER: base64-encoded images from original HTML */}
          </div>
        </div>
      </div>

      {/* 수업 안내 */}
      <div className="sec fade">
        <div className="stag">Information</div>
        <h2 className="sh">
          수업 <span className="bl">안내사항</span>
        </h2>
        <div className="divb"></div>
        <div className="info-grid">
          <div className="ibox">
            <div className="ibox-t">📋 수업 대상 &amp; 기본 안내</div>
            <div className="ibox-list">
              <div className="ibox-row"><strong>대상:</strong> 주니어 라인 — 초1 ~ 중2</div>
              <div className="ibox-row"><strong>수업 요일:</strong> 월 ~ 금</div>
              <div className="ibox-row"><strong>시작일:</strong> 매주 월요일만 가능</div>
              <div className="ibox-row"><strong>결석:</strong> 결석 시 보강 수업 없음</div>
              <div className="ibox-row"><strong>공휴일:</strong> 포함 시 일할 계산 환불</div>
              <div className="ibox-row"><strong>교재비:</strong> 1권당 ₱350 (학생만 해당)</div>
            </div>
          </div>
          <div className="ibox">
            <div className="ibox-t">🔥 성수기 기간 안내</div>
            <div className="ibox-list">
              <div className="ibox-row"><strong>여름:</strong> 7/15 ~ 8/30</div>
              <div className="ibox-row"><strong>겨울:</strong> 12/15 ~ 2/29</div>
              <div className="ibox-row"><strong>성수기 등록:</strong> 3주 이상 필수</div>
              <div className="ibox-row"><strong>종료 시점:</strong> 2주 가능 (상담 필수)</div>
              <div className="ibox-row"><strong>7세 예비초1:</strong> 킨더 / 주니어 선택 가능</div>
            </div>
          </div>
        </div>
        <div className="warn-box" style={{ marginTop: 18 }}>
          ⚠️ <strong>유의사항:</strong> 분리 가능한 아이만 수업 참여 가능합니다. 분리 불가능으로 인한 환불은 불가합니다. 학원 내 부모님 대기 및 수업 참관은 허용되지 않습니다. 수업 규정 및 환불 규정은 반드시 확인해 주세요.
        </div>
      </div>

      {/* CTA */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="cta-wrap">
            <h3>
              드림아카데미와 함께<br/>
              영어가 일상이 되는 경험을 시작하세요
            </h3>
            <p>주니어 커리큘럼 신청 및 문의는 아래 버튼을 통해 진행해 주세요.</p>
            <div className="cta-btns">
              <a href="/apply" className="btn-white">프로그램 신청하기 →</a>
              <a href="/kinder" className="btn-outline-w">킨더 커리큘럼 보기</a>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <span className="flogo">
            <span className="D">D</span>ream<span className="A">A</span>cademy
          </span>
          <div className="flinks">
            <a href="/">홈</a>
            <a href="/junior">주니어 커리큘럼</a>
            <a href="/kinder">킨더 커리큘럼</a>
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
