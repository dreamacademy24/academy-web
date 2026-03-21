"use client";
import { useEffect, useState } from "react";

export default function KinderPage() {
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
          --kinder:#FFD64D; --kinder-dark:#E5A800; --kinder-light:#FFF8E1;
          --mint:#2DD4A8; --mint-dark:#0D9B76; --mint-light:#E6FFF7;
          --sky:#29a9e0; --yellow:#f5a623; --blue:#1a6fc4; --blue-dark:#0d3d7a; --blue-light:#eaf3fb;
          --white:#fff; --off:#FFFDF5; --text:#1a1a2e; --muted:#6b7c93;
          --stroke:#e2e8f0; --shadow:0 8px 40px rgba(0,0,0,0.09);
          --shadow-lg:0 20px 60px rgba(245,166,35,0.13);
        }

        /* NAV */
        nav{position:fixed;top:0;left:0;right:0;z-index:300;height:66px;display:flex;align-items:center;padding:0 40px;background:rgba(255,255,255,0.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--stroke);box-shadow:0 1px 3px rgba(0,0,0,0.08);gap:0;}
        .logo{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:800;color:var(--text);flex-shrink:0;margin-right:32px;}
        .logo .D{color:var(--sky);} .logo .A{color:var(--yellow);}
        .nav-center{display:flex;align-items:center;flex:1;}
        .nav-center>a,.nav-dd>a{color:#374151;font-size:14px;font-weight:500;padding:0 14px;height:66px;display:flex;align-items:center;gap:4px;transition:color 160ms;white-space:nowrap;}
        .nav-center>a:hover,.nav-dd>a:hover{color:var(--kinder-dark);}
        .nav-active{color:var(--kinder-dark)!important;font-weight:700!important;}
        .nav-dd{position:relative;}
        .nav-dd-arrow{font-size:10px;transition:transform 200ms;}
        .nav-dd:hover .nav-dd-arrow{transform:rotate(180deg);}
        .nav-dd-menu{position:absolute;top:66px;left:0;background:var(--white);min-width:165px;border:1px solid var(--stroke);border-top:2px solid var(--kinder);box-shadow:0 8px 24px rgba(0,0,0,0.1);opacity:0;pointer-events:none;transform:translateY(-6px);transition:all 180ms;}
        .nav-dd:hover .nav-dd-menu{opacity:1;pointer-events:all;transform:translateY(0);}
        .nav-dd-menu a{display:block;padding:11px 18px;font-size:13.5px;color:#374151;border-bottom:1px solid var(--stroke);transition:background 140ms,color 140ms;}
        .nav-dd-menu a:last-child{border-bottom:none;}
        .nav-dd-menu a:hover{background:var(--kinder-light);color:var(--kinder-dark);}
        .nav-right{display:flex;align-items:center;flex-shrink:0;}
        .nav-cta{background:var(--kinder);color:var(--text);font-size:13.5px;font-weight:700;padding:9px 20px;border-radius:4px;transition:background 160ms;}
        .nav-cta:hover{background:var(--kinder-dark);color:var(--white);}
        .hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;}
        .hamburger span{width:22px;height:2px;background:var(--text);display:block;}
        .mob-nav{display:none;position:fixed;top:66px;left:0;right:0;background:var(--white);z-index:299;padding:16px 24px 24px;flex-direction:column;border-top:1px solid var(--stroke);box-shadow:0 8px 24px rgba(0,0,0,0.1);}
        .mob-nav.open{display:flex;}
        .mob-nav a{padding:12px 0;color:#374151;font-size:14px;border-bottom:1px solid var(--stroke);}

        /* PAGE HERO */
        .page-hero{
          padding:110px 60px 64px;
          background:linear-gradient(135deg,var(--kinder-light) 0%,#FFF3CD 40%,#FFFDF5 100%);
          border-bottom:1px solid var(--stroke);
        }
        .page-hero-inner{max-width:1200px;margin:0 auto;}
        .breadcrumb{font-size:13px;color:var(--muted);margin-bottom:16px;display:flex;align-items:center;gap:6px;}
        .breadcrumb a{color:var(--kinder-dark);}
        .page-tag{font-family:'Montserrat',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:0.25em;text-transform:uppercase;color:var(--kinder-dark);margin-bottom:12px;display:flex;align-items:center;gap:9px;}
        .page-tag::before{content:'';width:22px;height:2px;background:var(--kinder);border-radius:2px;}
        .page-hero h1{font-size:clamp(32px,4vw,52px);font-weight:800;line-height:1.18;letter-spacing:-0.025em;margin-bottom:12px;word-break:keep-all;}
        .page-hero h1 .hl{color:var(--kinder-dark);}
        .page-hero p{font-size:15px;color:var(--muted);line-height:1.85;max-width:580px;word-break:keep-all;margin-bottom:20px;}
        .hero-badges{display:flex;gap:10px;flex-wrap:wrap;}
        .hbadge{display:inline-flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--stroke);padding:7px 14px;border-radius:20px;font-size:12.5px;font-weight:600;color:var(--text);box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .hbadge.yellow{background:var(--kinder-light);border-color:rgba(245,166,35,0.3);color:var(--kinder-dark);}

        /* SECTIONS */
        .sec{padding:80px 60px;max-width:1200px;margin:0 auto;}
        .sec-bg{background:var(--off);}
        .sec-bg-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .stag{font-family:'Montserrat',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:var(--kinder-dark);margin-bottom:10px;display:flex;align-items:center;gap:9px;}
        .stag::before{content:'';width:20px;height:2px;background:var(--kinder);border-radius:2px;}
        .sh{font-size:clamp(24px,3vw,38px);font-weight:800;line-height:1.22;letter-spacing:-0.022em;margin-bottom:12px;word-break:keep-all;}
        .sh .hl{color:var(--kinder-dark);}
        .sh .mt{color:var(--mint);}
        .sp{font-size:14px;color:var(--muted);line-height:1.9;max-width:560px;word-break:keep-all;}
        .divider{width:40px;height:3px;background:var(--kinder);margin:12px 0 22px;border-radius:2px;}

        /* ABOUT CARDS */
        .about-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:24px;}
        .about-card{background:var(--white);border:1px solid var(--stroke);border-radius:16px;padding:28px 24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);transition:transform 200ms,box-shadow 200ms;}
        .about-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .about-num{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;color:var(--kinder-dark);margin-bottom:10px;}
        .about-icon{font-size:32px;margin-bottom:12px;}
        .about-title{font-size:17px;font-weight:800;margin-bottom:8px;letter-spacing:-0.01em;}
        .about-desc{font-size:13px;color:var(--muted);line-height:1.78;word-break:keep-all;}

        /* TIMETABLE */
        .tt-wrap{display:grid;grid-template-columns:1fr 1.8fr;gap:56px;align-items:start;}
        .tt-table{width:100%;border-collapse:collapse;margin-top:4px;}
        .tt-table tr{border-bottom:1px solid var(--stroke);}
        .tt-table td{padding:12px 14px;font-size:13.5px;vertical-align:middle;}
        .tt-time{color:var(--muted);font-family:'Montserrat',sans-serif;font-size:12.5px;white-space:nowrap;width:120px;}
        .tt-badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;font-family:'Montserrat',sans-serif;letter-spacing:0.05em;}
        .tt-group{background:#FFF3CD;color:#92400e;}
        .tt-1on1{background:var(--mint-light);color:var(--mint-dark);}
        .tt-break{background:#f3f4f6;color:#6b7280;}
        .tt-min{color:var(--muted);font-size:12px;font-family:'Montserrat',sans-serif;text-align:right;}
        .tt-note{font-size:12.5px;color:var(--muted);padding:14px 16px;background:var(--kinder-light);border-left:3px solid var(--kinder);border-radius:0 6px 6px 0;margin-top:16px;line-height:1.7;}

        /* CLASS CARDS */
        .class-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:24px;}
        .class-card{background:var(--white);border:1px solid var(--stroke);border-radius:14px;overflow:hidden;transition:transform 200ms,box-shadow 200ms;}
        .class-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .class-card-top{padding:20px 20px 16px;}
        .class-card-top.group-bg{background:linear-gradient(135deg,#FFF8E1,#FFF3CD);}
        .class-card-top.one-bg{background:linear-gradient(135deg,var(--mint-light),#C5F7E8);}
        .class-card-icon{font-size:28px;margin-bottom:8px;}
        .class-card-title{font-size:15px;font-weight:800;margin-bottom:2px;}
        .class-card-body{padding:16px 20px 20px;}
        .class-card-desc{font-size:13px;color:var(--muted);line-height:1.7;word-break:keep-all;}

        /* PROGRAM SECTION */
        .program-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px;margin-top:24px;}
        .program-card{background:var(--white);border:1px solid var(--stroke);border-radius:16px;padding:28px 24px;transition:transform 200ms,box-shadow 200ms;}
        .program-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .program-card-icon{font-size:36px;margin-bottom:12px;}
        .program-card-title{font-size:16px;font-weight:800;margin-bottom:10px;color:var(--text);}
        .program-tags{display:flex;flex-wrap:wrap;gap:6px;}
        .program-tag{font-size:11.5px;padding:4px 10px;border-radius:20px;font-weight:500;}
        .program-tag.yellow{background:var(--kinder-light);color:#92400e;border:1px solid rgba(245,166,35,0.2);}
        .program-tag.mint{background:var(--mint-light);color:var(--mint-dark);border:1px solid rgba(45,212,168,0.2);}

        /* CTA */
        .cta-wrap{background:linear-gradient(135deg,#E5A800,var(--kinder));border-radius:16px;padding:48px;text-align:center;}
        .cta-wrap h3{font-size:28px;font-weight:800;color:var(--white);margin-bottom:10px;word-break:keep-all;}
        .cta-wrap p{font-size:14.5px;color:rgba(255,255,255,0.75);margin-bottom:28px;word-break:keep-all;}
        .cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
        .btn-white{background:var(--white);color:#92400e;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:transform 150ms,box-shadow 150ms;box-shadow:0 4px 16px rgba(0,0,0,0.15);}
        .btn-white:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,0.2);}
        .btn-outline-w{border:1.5px solid rgba(255,255,255,0.45);color:rgba(255,255,255,0.9);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:border-color 160ms,color 160ms;}
        .btn-outline-w:hover{border-color:var(--white);color:var(--white);}

        /* FOOTER */
        footer{background:#4A3500;padding:40px 60px 24px;border-top:1px solid rgba(255,255,255,0.07);}
        .footer-inner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px;}
        .flogo{font-family:'Montserrat',sans-serif;font-size:18px;font-weight:800;color:var(--white);}
        .flogo .D{color:#5dc8f0;} .flogo .A{color:var(--yellow);}
        .flinks{display:flex;gap:20px;flex-wrap:wrap;}
        .flinks a{font-size:13px;color:rgba(255,255,255,0.45);transition:color 150ms;}
        .flinks a:hover{color:rgba(255,255,255,0.85);}
        .fcopy{font-size:11.5px;color:rgba(255,255,255,0.2);font-family:'Montserrat',sans-serif;margin-top:16px;max-width:1200px;margin-left:auto;margin-right:auto;}

        /* TAB SWITCH */
        .tab-switch{background:var(--white);border-bottom:1px solid var(--stroke);padding:0 60px;}
        .tab-switch-inner{max-width:1200px;margin:0 auto;display:flex;gap:0;}
        .tab-switch-inner a{padding:16px 24px;font-size:14px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px;font-family:'Montserrat',sans-serif;letter-spacing:0.03em;transition:color 160ms;}
        .tab-switch-inner a.active{font-weight:700;color:var(--kinder-dark);border-bottom-color:var(--kinder);}

        /* FADE */
        .fade{opacity:0;transform:translateY(20px);transition:opacity 600ms ease,transform 600ms ease;}
        .fade.vis{opacity:1;transform:translateY(0);}

        @media(max-width:1024px){
          nav{padding:0 24px;} .nav-center{display:none;} .nav-right{display:none;} .hamburger{display:flex;}
          .page-hero{padding:90px 24px 48px;}
          .sec{padding:56px 24px;} .sec-bg-i{padding:56px 24px;}
          .tt-wrap{grid-template-columns:1fr;}
          .about-grid{grid-template-columns:1fr;}
          .class-grid{grid-template-columns:1fr;}
          .program-grid{grid-template-columns:1fr;}
          .footer-inner{flex-direction:column;align-items:flex-start;}
          .tab-switch{padding:0 24px;}
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
              <a href="/junior">주니어 커리큘럼</a>
              <a href="/kinder" style={{ color: "var(--kinder-dark)", fontWeight: 600 }}>
                ▶ 킨더 커리큘럼
              </a>
            </div>
          </div>
          <a href="/package">올인원패키지</a>
          <div className="nav-dd">
            <a href="#">
              숙소 <span className="nav-dd-arrow">▾</span>
            </a>
            <div className="nav-dd-menu">
              <a href="/accommodation/dreamhouse">드림하우스 (독채)</a>
              <a href="/accommodation/jpark">제이파크</a>
              <a href="/accommodation/cubenine">큐브나인</a>
            </div>
          </div>
          <a href="/playdream">플레이드림</a>
          <a href="/apply">패키지서비스신청</a>
          <a href="/notice">공지사항</a>
          <a href="/community">커뮤니티</a>
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
        <a href="/junior">주니어 커리큘럼</a>
        <a href="/kinder" style={{ color: "var(--kinder-dark)", fontWeight: 700 }}>
          ▶ 킨더 커리큘럼
        </a>
        <a href="/package">올인원패키지</a>
        <a href="/accommodation/dreamhouse">드림하우스 (독채)</a>
        <a href="/accommodation/jpark">제이파크</a>
        <a href="/accommodation/cubenine">큐브나인</a>
        <a href="/playdream">플레이드림</a>
          <a href="/apply">패키지서비스신청</a>
        <a href="/notice">공지사항</a>
        <a href="/community">커뮤니티</a>
        <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기 →</a>
      </div>

      {/* PAGE HERO */}
      <div className="page-hero">
        <div className="page-hero-inner">
          <div className="breadcrumb fade"><a href="/">홈</a> › 커리큘럼 › 킨더</div>
          <div className="page-tag">Kinder Curriculum · 킨더 커리큘럼</div>
          <h1 className="fade">유아를 위한<br/><span className="hl">즐거운 영어 첫걸음</span></h1>
          <p className="fade">놀이와 교육이 결합된 최적의 프로그램으로,<br/>아이들이 자연스럽게 영어와 친해지는 드림아카데미 킨더 라인.</p>
          <div className="hero-badges fade">
            <div className="hbadge">🌱 5세 ~ 7세</div>
            <div className="hbadge">⏰ 9:00 ~ 16:00</div>
            <div className="hbadge yellow">1-on-1 · Group · Activity</div>
            <div className="hbadge">월~금 수업</div>
          </div>
        </div>
      </div>

      {/* 커리큘럼 전환 탭 */}
      <div className="tab-switch">
        <div className="tab-switch-inner">
          <a href="/junior">🎒 Junior Line</a>
          <a href="/kinder" className="active">🌱 Kinder Line</a>
        </div>
      </div>

      {/* SECTION 1: About Kinder Line */}
      <div className="sec fade">
        <div className="stag">About</div>
        <h2 className="sh">Dream Academy <span className="hl">Kinder Line</span></h2>
        <div className="divider"></div>
        <p className="sp" style={{ marginBottom: "32px" }}>
          즐겁게 영어를 접할 수 있는 많은 프로그램들과 탄탄한 커리큘럼의 아카데미식 교육이 결합된 최적의 프로그램
        </p>
        <div className="about-grid">
          <div className="about-card">
            <div className="about-num">01</div>
            <div className="about-icon">📖</div>
            <div className="about-title">체계적인 1-on-1 수업</div>
            <p className="about-desc">
              Social English와 Topic English를 병행하는 체계적인 학습 플랜. 파닉스부터 읽기·쓰기, 수학, 테마 활동들을 통해 자신감을 키울 수 있도록 구성됩니다.
            </p>
          </div>
          <div className="about-card">
            <div className="about-num">02</div>
            <div className="about-icon">👫</div>
            <div className="about-title">함께 배우고 성장하는 Group Class</div>
            <p className="about-desc">
              아트, 쿠킹, 신체 활동 등 다양한 Special Activity와 뮤직, 액트 등의 테마수업이 실내외에서 진행됩니다.
            </p>
          </div>
          <div className="about-card">
            <div className="about-num">03</div>
            <div className="about-icon">🎯</div>
            <div className="about-title">One Theme a Week</div>
            <p className="about-desc">
              매주 한 테마를 중심으로 영어, 과학, 미술, 신체 활동이 하나의 주제로 연결되는 통합형 교육 프로그램입니다.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 2: Time Table */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Time Table</div>
          <h2 className="sh">킨더 <span className="hl">수업 시간표</span></h2>
          <div className="divider"></div>
          <div className="tt-wrap">
            <div>
              <p className="sp" style={{ marginBottom: "20px" }}>
                매일 <strong>9:00 ~ 16:00</strong> 수업이 진행됩니다.<br/>
                1-on-1 수업과 Group 수업이 균형 있게 구성됩니다.
              </p>
              <div className="tt-note">
                ✅ <strong>킨더라인 하루 구성</strong><br/>
                9:00~16:00 일정 · Group &amp; 1-on-1 교차 편성<br/>
                점심 및 간식 포함 · 샘플 시간표 기준
              </div>
            </div>
            <table className="tt-table">
              <tbody>
                <tr><td className="tt-time">9:00 ~ 9:40</td><td><span className="tt-badge tt-group">Group</span></td><td className="tt-min">40 min</td></tr>
                <tr><td className="tt-time">9:45 ~ 10:25</td><td><span className="tt-badge tt-1on1">1-on-1</span></td><td className="tt-min">40 min</td></tr>
                <tr><td className="tt-time">10:30 ~ 11:15</td><td><span className="tt-badge tt-group">Group</span></td><td className="tt-min">45 min</td></tr>
                <tr><td className="tt-time">11:20 ~ 12:00</td><td><span className="tt-badge tt-1on1">1-on-1</span></td><td className="tt-min">40 min</td></tr>
                <tr><td className="tt-time">11:55 ~ 12:50</td><td><span className="tt-badge tt-break">Lunch 🍱</span></td><td className="tt-min">55 min</td></tr>
                <tr><td className="tt-time">12:50 ~ 1:30</td><td><span className="tt-badge tt-group">Group</span></td><td className="tt-min">40 min</td></tr>
                <tr><td className="tt-time">1:35 ~ 2:20</td><td><span className="tt-badge tt-1on1">1-on-1</span></td><td className="tt-min">50 min</td></tr>
                <tr><td className="tt-time">2:20 ~ 2:40</td><td><span className="tt-badge tt-break">Snack 🍪</span></td><td className="tt-min">15 min</td></tr>
                <tr><td className="tt-time">2:40 ~ 3:10</td><td><span className="tt-badge tt-group">Group</span></td><td className="tt-min">40 min</td></tr>
                <tr><td className="tt-time">3:15 ~ 4:00</td><td><span className="tt-badge tt-1on1">1-on-1</span></td><td className="tt-min">45 min</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 3: Group Class */}
      <div className="sec fade">
        <div className="stag">Group Class</div>
        <h2 className="sh">함께 즐기며 <span className="mt">배우는 수업</span></h2>
        <div className="divider"></div>
        <div className="class-grid">
          <div className="class-card">
            <div className="class-card-top group-bg">
              <div className="class-card-icon">🎵</div>
              <div className="class-card-title">Music / Movement</div>
            </div>
            <div className="class-card-body">
              <p className="class-card-desc">Music and movement with lyrics, dance and act-play</p>
            </div>
          </div>
          <div className="class-card">
            <div className="class-card-top group-bg">
              <div className="class-card-icon">⚽</div>
              <div className="class-card-title">Physical Education</div>
            </div>
            <div className="class-card-body">
              <p className="class-card-desc">Outdoor activities</p>
            </div>
          </div>
          <div className="class-card">
            <div className="class-card-top group-bg">
              <div className="class-card-icon">🎨</div>
              <div className="class-card-title">Special Activity</div>
            </div>
            <div className="class-card-body">
              <p className="class-card-desc">Science, art, cooking and so on</p>
            </div>
          </div>
          <div className="class-card">
            <div className="class-card-top group-bg">
              <div className="class-card-icon">🎭</div>
              <div className="class-card-title">Interactive Learning</div>
            </div>
            <div className="class-card-body">
              <p className="class-card-desc">Role play, show and tell, market day</p>
            </div>
          </div>
          <div className="class-card">
            <div className="class-card-top group-bg">
              <div className="class-card-icon">📚</div>
              <div className="class-card-title">Story Reading</div>
            </div>
            <div className="class-card-body">
              <p className="class-card-desc">Diverse English reading</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: 1-ON-1 Class */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">1-on-1 Class</div>
          <h2 className="sh">개인 맞춤 <span className="hl">1:1 수업</span></h2>
          <div className="divider"></div>
          <div className="class-grid">
            <div className="class-card">
              <div className="class-card-top one-bg">
                <div className="class-card-icon">💬</div>
                <div className="class-card-title">Social English</div>
              </div>
              <div className="class-card-body">
                <p className="class-card-desc">Basic social English with topic English</p>
              </div>
            </div>
            <div className="class-card">
              <div className="class-card-top one-bg">
                <div className="class-card-icon">🔤</div>
                <div className="class-card-title">Phonics</div>
              </div>
              <div className="class-card-body">
                <p className="class-card-desc">From basic phonics to diphthongs consonant blends</p>
              </div>
            </div>
            <div className="class-card">
              <div className="class-card-top one-bg">
                <div className="class-card-icon">🔢</div>
                <div className="class-card-title">Math</div>
              </div>
              <div className="class-card-body">
                <p className="class-card-desc">From basic counting to arithmetic operations</p>
              </div>
            </div>
            <div className="class-card">
              <div className="class-card-top one-bg">
                <div className="class-card-icon">✏️</div>
                <div className="class-card-title">Reading / Writing</div>
              </div>
              <div className="class-card-body">
                <p className="class-card-desc">Learn to read and write through story-based lessons</p>
              </div>
            </div>
            <div className="class-card">
              <div className="class-card-top one-bg">
                <div className="class-card-icon">🌍</div>
                <div className="class-card-title">Theme Project</div>
              </div>
              <div className="class-card-body">
                <p className="class-card-desc">Knowledge-based lessons organized by themes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 5: Kinder Program */}
      <div className="sec fade">
        <div className="stag">Kinder Program</div>
        <h2 className="sh">킨더 <span className="mt">특별 프로그램</span></h2>
        <div className="divider"></div>
        <div className="program-grid">
          <div className="program-card">
            <div className="program-card-icon">👨‍🍳</div>
            <div className="program-card-title">Cooking</div>
            <div className="program-tags">
              <span className="program-tag yellow">Fruit Skewers</span>
              <span className="program-tag yellow">Popcorn</span>
              <span className="program-tag yellow">Sandwich</span>
              <span className="program-tag yellow">Chocolate Fondue</span>
              <span className="program-tag yellow">Fruit Punch</span>
            </div>
          </div>
          <div className="program-card">
            <div className="program-card-icon">🎨</div>
            <div className="program-card-title">Art</div>
            <div className="program-tags">
              <span className="program-tag mint">T-shirts</span>
              <span className="program-tag mint">Ukelele</span>
              <span className="program-tag mint">Dreamcatcher</span>
              <span className="program-tag mint">Bracelets</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="cta-wrap">
            <h3>드림아카데미와 함께<br/>영어가 놀이가 되는 경험을 시작하세요</h3>
            <p>킨더 커리큘럼 신청 및 문의는 아래 버튼을 통해 진행해 주세요.</p>
            <div className="cta-btns">
              <a href="/apply" className="btn-white">프로그램 신청하기 →</a>
              <a href="/junior" className="btn-outline-w">주니어 커리큘럼 보기</a>
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
        <div style={{textAlign:"right",maxWidth:1200,margin:"8px auto 0"}}><a href="/admin" style={{fontSize:"20px",color:"#fff",fontWeight:900,textDecoration:"none"}}>관리자</a></div>
      </footer>
    </>
  );
}
