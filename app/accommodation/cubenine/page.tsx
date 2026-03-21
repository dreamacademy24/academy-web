"use client";
import { useEffect, useState } from "react";

export default function CubeNinePage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

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
          --cream:#f5f0e8; --cream-dark:#e8dfd2; --cream-light:#faf8f4;
          --navy:#1a3a6b; --navy-dark:#0f2548; --navy-light:#e8edf5;
          --gold:#b8943e; --gold-light:#f9f3e3;
          --sky:#29a9e0; --yellow:#f5a623;
          --white:#fff; --off:#faf8f4; --text:#1a1a2e; --muted:#6b7c93;
          --stroke:#e2ddd4; --shadow:0 8px 40px rgba(0,0,0,0.09);
          --shadow-lg:0 20px 60px rgba(26,58,107,0.13);
          --green:#2da84e; --orange:#FF6B35;
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
        .nav-center>a:hover,.nav-dd>a:hover{color:var(--navy);}
        .nav-active{color:var(--navy)!important;font-weight:700!important;}
        .nav-dd{position:relative;}
        .nav-dd-arrow{font-size:10px;transition:transform 200ms;}
        .nav-dd:hover .nav-dd-arrow{transform:rotate(180deg);}
        .nav-dd-menu{position:absolute;top:66px;left:0;background:var(--white);min-width:165px;border:1px solid var(--stroke);border-top:2px solid var(--navy);box-shadow:0 8px 24px rgba(0,0,0,0.1);opacity:0;pointer-events:none;transform:translateY(-6px);transition:all 180ms;}
        .nav-dd:hover .nav-dd-menu{opacity:1;pointer-events:all;transform:translateY(0);}
        .nav-dd-menu a{display:block;padding:11px 18px;font-size:13.5px;color:#374151;border-bottom:1px solid var(--stroke);transition:background 140ms,color 140ms;}
        .nav-dd-menu a:last-child{border-bottom:none;}
        .nav-dd-menu a:hover{background:var(--cream-light);color:var(--navy);}
        .nav-right{display:flex;align-items:center;flex-shrink:0;}
        .nav-cta{background:var(--navy);color:var(--white);font-size:13.5px;font-weight:600;padding:9px 20px;border-radius:4px;transition:background 160ms;}
        .nav-cta:hover{background:var(--navy-dark);}
        .hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;}
        .hamburger span{width:22px;height:2px;background:var(--text);display:block;}
        .mob-nav{display:none;position:fixed;top:66px;left:0;right:0;background:var(--white);z-index:299;padding:16px 24px 24px;flex-direction:column;border-top:1px solid var(--stroke);box-shadow:0 8px 24px rgba(0,0,0,0.1);}
        .mob-nav.open{display:flex;}
        .mob-nav a{padding:12px 0;color:#374151;font-size:14px;border-bottom:1px solid var(--stroke);}

        /* HERO */
        .page-hero{
          padding:120px 60px 72px;
          background:linear-gradient(135deg,var(--cream) 0%,var(--cream-dark) 40%,var(--cream-light) 100%);
          border-bottom:1px solid var(--stroke);
          text-align:center;
        }
        .page-hero-inner{max-width:900px;margin:0 auto;}
        .page-tag{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:var(--gold);margin-bottom:14px;}
        .page-hero h1{font-size:clamp(32px,5vw,52px);font-weight:800;line-height:1.15;letter-spacing:-0.03em;margin-bottom:16px;}
        .page-hero h1 .hl{color:var(--navy);}
        .page-hero .sub{font-size:18px;font-weight:600;color:var(--navy);margin-bottom:10px;line-height:1.6;}
        .page-hero p{font-size:16px;color:var(--muted);line-height:1.7;margin:0 auto;max-width:700px;}
        .hero-badges{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:24px;}
        .hbadge{display:inline-flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--stroke);padding:8px 16px;border-radius:24px;font-size:13px;font-weight:600;color:var(--text);box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .hbadge.navy{background:var(--navy-light);border-color:rgba(26,58,107,0.2);color:var(--navy);}
        .hero-img{width:100%;max-width:800px;margin:32px auto 0;border-radius:16px;box-shadow:var(--shadow);display:block;}

        /* SECTIONS */
        .sec{padding:80px 60px;max-width:1200px;margin:0 auto;}
        .sec-bg{background:var(--off);}
        .sec-bg-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .sec-white{background:var(--white);}
        .sec-white-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .stag{font-family:'Montserrat',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;display:flex;align-items:center;gap:9px;}
        .stag::before{content:'';width:20px;height:2px;background:var(--gold);border-radius:2px;}
        .sh{font-size:clamp(24px,3vw,38px);font-weight:800;line-height:1.22;letter-spacing:-0.022em;margin-bottom:12px;word-break:keep-all;}
        .sh .hl{color:var(--navy);}
        .sp{font-size:14px;color:var(--muted);line-height:1.9;max-width:660px;word-break:keep-all;}
        .divider{width:40px;height:3px;background:var(--gold);margin:12px 0 22px;border-radius:2px;}

        /* LOCATION INFO */
        .loc-wrap{margin-top:24px;padding:24px;background:var(--cream-light);border:1px solid var(--stroke);border-radius:14px;}
        .loc-addr{font-size:14px;color:var(--muted);line-height:1.8;margin-bottom:16px;word-break:keep-all;}
        .loc-addr strong{color:var(--text);}
        .loc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
        .loc-card{background:var(--white);border:1px solid var(--stroke);border-radius:10px;padding:16px;text-align:center;}
        .loc-card-icon{font-size:24px;margin-bottom:6px;}
        .loc-card-title{font-size:13px;font-weight:700;margin-bottom:2px;}
        .loc-card-desc{font-size:12px;color:var(--muted);}
        .loc-extra{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;}
        .loc-tag{background:var(--white);border:1px solid var(--stroke);padding:8px 14px;border-radius:20px;font-size:12.5px;color:var(--muted);display:inline-flex;align-items:center;gap:6px;}
        .loc-tag strong{color:var(--text);}

        /* FACILITY GRID */
        .fac-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-top:24px;}
        .fac-card{background:var(--white);border:1px solid var(--stroke);border-radius:16px;padding:28px;display:flex;align-items:flex-start;gap:16px;transition:transform 200ms,box-shadow 200ms;}
        .fac-card:hover{transform:translateY(-2px);box-shadow:var(--shadow);}
        .fac-icon{font-size:32px;flex-shrink:0;margin-top:2px;}
        .fac-title{font-size:15px;font-weight:700;margin-bottom:4px;}
        .fac-desc{font-size:13px;color:var(--muted);line-height:1.7;word-break:keep-all;}

        /* ROOM CARDS */
        .room-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-top:28px;}
        .room-card{background:var(--white);border:1px solid var(--stroke);border-radius:18px;overflow:hidden;transition:transform 200ms,box-shadow 200ms;}
        .room-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .room-card-top{padding:24px 24px 18px;}
        .room-card-top.ocean{background:linear-gradient(135deg,var(--cream),var(--cream-dark));}
        .room-card-top.pool{background:linear-gradient(135deg,var(--navy-light),#d4dff0);}
        .room-card-icon{font-size:36px;margin-bottom:10px;}
        .room-card-title{font-size:18px;font-weight:800;margin-bottom:4px;}
        .room-card-sub{font-size:12.5px;color:var(--muted);}
        .room-card-body{padding:18px 24px 24px;}
        .room-meta{display:flex;flex-direction:column;gap:6px;padding:14px 16px;background:#f8f7f4;border-radius:10px;margin-bottom:14px;}
        .room-meta-row{font-size:12.5px;color:var(--muted);display:flex;align-items:center;gap:8px;}
        .room-meta-row strong{color:var(--text);}
        .amenity-title{font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px;letter-spacing:0.05em;text-transform:uppercase;}
        .amenity-tags{display:flex;flex-wrap:wrap;gap:6px;}
        .amenity-tag{background:var(--cream-light);border:1px solid var(--stroke);padding:4px 10px;border-radius:16px;font-size:11px;color:var(--muted);}

        /* PACKAGE LIST */
        .pkg-list{display:flex;flex-direction:column;gap:12px;margin-top:24px;}
        .pkg-item{display:flex;align-items:flex-start;gap:14px;background:var(--white);border:1px solid var(--stroke);border-radius:14px;padding:20px;transition:transform 200ms;}
        .pkg-item:hover{transform:translateY(-2px);box-shadow:var(--shadow);}
        .pkg-item-icon{font-size:28px;flex-shrink:0;margin-top:2px;}
        .pkg-item-title{font-size:14px;font-weight:700;margin-bottom:4px;}
        .pkg-item-desc{font-size:13px;color:var(--muted);line-height:1.7;word-break:keep-all;}

        /* TABLE */
        .price-table{width:100%;border-collapse:collapse;margin-top:24px;border:1px solid var(--stroke);border-radius:12px;overflow:hidden;}
        .price-table th{background:var(--navy);color:var(--white);font-size:13px;font-weight:700;padding:14px 18px;text-align:left;}
        .price-table td{font-size:13px;padding:12px 18px;border-bottom:1px solid var(--stroke);color:var(--muted);line-height:1.6;}
        .price-table tr:last-child td{border-bottom:none;}
        .price-table td strong{color:var(--text);}
        .price-table .cat{background:var(--cream-light);color:var(--navy);font-weight:700;font-size:12.5px;letter-spacing:0.05em;}

        /* DISCOUNT GRID */
        .disc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:24px;}
        .disc-card{background:var(--white);border:1px solid var(--stroke);border-radius:14px;padding:20px;text-align:center;transition:transform 200ms;}
        .disc-card:hover{transform:translateY(-2px);box-shadow:var(--shadow);}
        .disc-icon{font-size:28px;margin-bottom:8px;}
        .disc-name{font-size:14px;font-weight:700;margin-bottom:4px;}
        .disc-rate{font-size:20px;font-weight:800;color:var(--navy);}

        /* ACCORDION */
        .acc-wrap{margin-top:24px;border:1px solid var(--stroke);border-radius:14px;overflow:hidden;}
        .acc-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;background:var(--cream-light);cursor:pointer;border:none;width:100%;font-family:'Noto Sans KR',sans-serif;font-size:15px;font-weight:700;color:var(--text);transition:background 160ms;}
        .acc-header:hover{background:var(--cream);}
        .acc-arrow{font-size:14px;transition:transform 300ms;color:var(--muted);}
        .acc-arrow.open{transform:rotate(180deg);}
        .acc-body{max-height:0;overflow:hidden;transition:max-height 400ms ease;}
        .acc-body.open{max-height:600px;}
        .acc-inner{padding:20px 24px;background:var(--white);border-top:1px solid var(--stroke);}
        .policy-item{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--muted);line-height:1.8;margin-bottom:8px;word-break:keep-all;}
        .policy-item::before{content:'·';color:var(--navy);font-weight:700;flex-shrink:0;}
        .policy-item strong{color:var(--text);}
        .policy-warn{margin-top:14px;padding:14px 18px;background:#fef8f0;border:1px solid #f0dfc0;border-radius:10px;font-size:12.5px;color:#92400e;line-height:1.7;font-weight:600;}

        /* CTA */
        .cta-wrap{background:linear-gradient(135deg,var(--navy-dark),var(--navy));border-radius:16px;padding:48px;text-align:center;}
        .cta-wrap h3{font-size:28px;font-weight:800;color:var(--white);margin-bottom:10px;word-break:keep-all;}
        .cta-wrap p{font-size:14.5px;color:rgba(255,255,255,0.7);margin-bottom:28px;word-break:keep-all;}
        .cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
        .btn-white{background:var(--white);color:var(--navy-dark);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:transform 150ms,box-shadow 150ms;box-shadow:0 4px 16px rgba(0,0,0,0.15);}
        .btn-white:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,0.2);}
        .btn-outline-w{border:1.5px solid rgba(255,255,255,0.35);color:rgba(255,255,255,0.85);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:border-color 160ms,color 160ms;}
        .btn-outline-w:hover{border-color:var(--white);color:var(--white);}

        /* FOOTER */
        footer{background:#1a2030;padding:40px 60px 24px;border-top:1px solid rgba(255,255,255,0.07);}
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

        @media(max-width:1024px){
          nav{padding:0 24px;} .nav-center{display:none;} .nav-right{display:none;} .hamburger{display:flex;}
          .page-hero{padding:90px 24px 48px;}
          .sec{padding:56px 24px;} .sec-bg-i,.sec-white-i{padding:56px 24px;}
          .fac-grid{grid-template-columns:1fr;}
          .room-grid{grid-template-columns:1fr;}
          .loc-grid{grid-template-columns:1fr;}
          .disc-grid{grid-template-columns:1fr;}
          .footer-inner{flex-direction:column;align-items:flex-start;}
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
          <a href="/package">올인원패키지</a>
          <div className="nav-dd">
            <a href="#" className="nav-active">숙소 <span className="nav-dd-arrow">▾</span></a>
            <div className="nav-dd-menu">
              <a href="/accommodation/dreamhouse">드림하우스 (독채)</a>
              <a href="/accommodation/jpark">제이파크</a>
              <a href="/accommodation/cubenine" className="nav-active">큐브나인</a>
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
        <button className="hamburger" onClick={() => setMobileNavOpen((v) => !v)}>
          <span></span><span></span><span></span>
        </button>
      </nav>

      {/* MOBILE NAV */}
      <div className={`mob-nav${mobileNavOpen ? " open" : ""}`}>
        <a href="/junior">주니어 커리큘럼</a>
        <a href="/kinder">킨더 커리큘럼</a>
        <a href="/package">올인원패키지</a>
        <a href="/accommodation/dreamhouse">드림하우스 (독채)</a>
        <a href="/accommodation/jpark">제이파크</a>
        <a href="/accommodation/cubenine" style={{ color: "var(--navy)", fontWeight: 700 }}>▶ 큐브나인</a>
        <a href="/playdream">플레이드림</a>
        <a href="/apply">패키지서비스신청</a>
        <a href="/notice">공지사항</a>
        <a href="/community">커뮤니티</a>
        <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기 →</a>
      </div>

      {/* HERO */}
      <div className="page-hero">
        <div className="page-hero-inner">
          <div className="page-tag fade">Premium Resort Package</div>
          <h1 className="fade">Dream × <span className="hl">Cube9</span> All-in-One Week</h1>
          <div className="sub fade">숙소부터 수업, 식사, 활동까지 모든 것을 한 번에,<br/>가족 맞춤형 올인원 케어</div>
          <p className="fade">세부 막탄 마리곤돈의 조용하고 여유로운 프리미엄 리조트</p>
          <div className="hero-badges fade">
            <div className="hbadge">🏖️ 오션뷰 리조트</div>
            <div className="hbadge">🏊 인피니티 풀</div>
            <div className="hbadge">📚 정규수업</div>
            <div className="hbadge navy">⭐ 올인원</div>
          </div>
          <img src="/images/cube9.png" alt="Cube9 Resort" className="hero-img fade" />
        </div>
      </div>

      {/* Welcome to Cube9 */}
      <div className="sec fade">
        <div className="stag">Welcome</div>
        <h2 className="sh">Welcome to <span className="hl">Cube9 Resort</span></h2>
        <div className="divider"></div>
        <p className="sp">세부 막탄 마리곤돈에 위치한 큐브나인 리조트는 조용하고 여유로운 환경 속에서 프리미엄 리조트 생활을 즐길 수 있습니다. 유명한 다이빙 스팟과 해양 액티비티 센터들과 인접해 있습니다.</p>

        <div className="loc-wrap">
          <div className="loc-addr">📍 <strong>세부 막탄 마리곤돈</strong></div>
          <div className="loc-grid">
            <div className="loc-card">
              <div className="loc-card-icon">✈️</div>
              <div className="loc-card-title">막탄 공항</div>
              <div className="loc-card-desc">차량 20~30분</div>
            </div>
            <div className="loc-card">
              <div className="loc-card-icon">🏫</div>
              <div className="loc-card-title">드림아카데미</div>
              <div className="loc-card-desc">차량 10분</div>
            </div>
            <div className="loc-card">
              <div className="loc-card-icon">🏘️</div>
              <div className="loc-card-title">베이스워터</div>
              <div className="loc-card-desc">차량 5분</div>
            </div>
          </div>
          <div className="loc-extra">
            <span className="loc-tag">🏙️ <strong>뉴타운</strong> 차량 15~20분</span>
            <span className="loc-tag">🛒 <strong>상스몰</strong> 차량 3분 / 도보 10분</span>
            <span className="loc-tag">🤿 <strong>다이빙 스팟</strong> 인접</span>
          </div>
        </div>
      </div>

      {/* 시설 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Facilities</div>
          <h2 className="sh">Cube9 <span className="hl">Resort 시설</span></h2>
          <div className="divider"></div>

          <div className="fac-grid">
            <div className="fac-card">
              <div className="fac-icon">🏊</div>
              <div>
                <div className="fac-title">오션뷰 야외 인피니티 수영장</div>
                <div className="fac-desc">탁 트인 바다를 바라보며 즐기는 프리미엄 인피니티 풀</div>
              </div>
            </div>
            <div className="fac-card">
              <div className="fac-icon">🚣</div>
              <div>
                <div className="fac-title">바다 액티비티</div>
                <div className="fac-desc">카약, 패들보드 등 다양한 해양 액티비티를 즐길 수 있습니다</div>
              </div>
            </div>
            <div className="fac-card">
              <div className="fac-icon">🍽️</div>
              <div>
                <div className="fac-title">오션뷰 더 나인 레스토랑</div>
                <div className="fac-desc">바다가 보이는 레스토랑에서 다양한 요리를 즐겨보세요</div>
              </div>
            </div>
            <div className="fac-card">
              <div className="fac-icon">💆</div>
              <div>
                <div className="fac-title">Massage & Spa</div>
                <div className="fac-desc">리조트 내 전문 스파에서 힐링 마사지를 받아보세요</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 객실 타입 */}
      <div className="sec fade">
        <div className="stag">Room Types</div>
        <h2 className="sh">객실 <span className="hl">타입</span></h2>
        <div className="divider"></div>

        <div className="room-grid">
          <div className="room-card">
            <div className="room-card-top ocean">
              <div className="room-card-icon">🌊</div>
              <div className="room-card-title">Deluxe Ocean</div>
              <div className="room-card-sub">King / Twin</div>
            </div>
            <div className="room-card-body">
              <div className="room-meta">
                <div className="room-meta-row">📐 <strong>면적:</strong> 46.08㎡</div>
                <div className="room-meta-row">🏠 <strong>구성:</strong> 오션뷰, 테라스, 선셋베드</div>
                <div className="room-meta-row">👥 <strong>수용:</strong> 최대 4인 (성인 최대 2인)</div>
              </div>
              <div className="amenity-title">Amenities</div>
              <div className="amenity-tags">
                <span className="amenity-tag">무료 WIFI</span>
                <span className="amenity-tag">개인금고</span>
                <span className="amenity-tag">스마트TV</span>
                <span className="amenity-tag">옷걸이</span>
                <span className="amenity-tag">슬리퍼</span>
                <span className="amenity-tag">커피포트</span>
                <span className="amenity-tag">생수</span>
                <span className="amenity-tag">커피/녹차</span>
                <span className="amenity-tag">헤어드라이어</span>
                <span className="amenity-tag">배쓰어메니티</span>
                <span className="amenity-tag">배쓰타올</span>
                <span className="amenity-tag">목욕가운</span>
                <span className="amenity-tag">샤워캡</span>
                <span className="amenity-tag">칫솔세트</span>
                <span className="amenity-tag">머리빗</span>
                <span className="amenity-tag">면봉</span>
              </div>
            </div>
          </div>

          <div className="room-card">
            <div className="room-card-top pool">
              <div className="room-card-icon">🏊</div>
              <div className="room-card-title">Deluxe Pool Access</div>
              <div className="room-card-sub">트윈퀸베드</div>
            </div>
            <div className="room-card-body">
              <div className="room-meta">
                <div className="room-meta-row">📐 <strong>면적:</strong> 43.68㎡</div>
                <div className="room-meta-row">🛏️ <strong>베드:</strong> 트윈퀸베드</div>
                <div className="room-meta-row">🏊 <strong>특징:</strong> 메인 풀장과 직접 연결 / 오션프론트룸</div>
                <div className="room-meta-row">👥 <strong>수용:</strong> 최대 4인 (성인 최대 2인)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 패키지 포함사항 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Package Included</div>
          <h2 className="sh">패키지 <span className="hl">포함사항</span></h2>
          <div className="divider"></div>

          <div className="pkg-list">
            <div className="pkg-item">
              <div className="pkg-item-icon">🏨</div>
              <div>
                <div className="pkg-item-title">큐브나인 객실 이용 / 조식 포함</div>
                <div className="pkg-item-desc">인피니티 풀 및 리조트 시설 자유 이용</div>
              </div>
            </div>
            <div className="pkg-item">
              <div className="pkg-item-icon">🍽️</div>
              <div>
                <div className="pkg-item-title">식사 바우처 제공</div>
                <div className="pkg-item-desc">1주 기준 10만원 / 더 나인 레스토랑 이용</div>
              </div>
            </div>
            <div className="pkg-item">
              <div className="pkg-item-icon">🍱</div>
              <div>
                <div className="pkg-item-title">평일 3식 프리미엄 도시락</div>
                <div className="pkg-item-desc">아침 7:50 / 점심 11:50 / 저녁 17:40 배달</div>
              </div>
            </div>
            <div className="pkg-item">
              <div className="pkg-item-icon">📚</div>
              <div>
                <div className="pkg-item-title">드림아카데미 정규수업 + 에프터스쿨 + 주말체험학습</div>
                <div className="pkg-item-desc">체계적인 영어 교육 프로그램과 다양한 체험 활동 포함</div>
              </div>
            </div>
            <div className="pkg-item">
              <div className="pkg-item-icon">🚗</div>
              <div>
                <div className="pkg-item-title">공항 픽업 & 드랍 서비스</div>
                <div className="pkg-item-desc">주말 투어 셔틀 운영</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 불포함 사항 */}
      <div className="sec fade">
        <div className="stag">Not Included</div>
        <h2 className="sh">불포함 <span className="hl">사항</span></h2>
        <div className="divider"></div>

        <table className="price-table">
          <thead>
            <tr>
              <th>항목</th>
              <th>금액</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><strong>SSP</strong></td><td>1인당 7,000 pesos</td><td>학생만 해당</td></tr>
            <tr><td><strong>SSP-i card</strong></td><td>1인당 4,000 pesos</td><td>학생만 해당</td></tr>
            <tr><td><strong>교재비 (주니어)</strong></td><td>₱350 / 권</td><td>주니어 라인</td></tr>
            <tr><td><strong>교재비 (킨더)</strong></td><td>₱2,500 / 월</td><td>킨더 라인</td></tr>
          </tbody>
        </table>
      </div>

      {/* 유료 서비스 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Paid Services</div>
          <h2 className="sh">유료 <span className="hl">서비스</span></h2>
          <div className="divider"></div>

          <table className="price-table">
            <thead>
              <tr>
                <th>항목</th>
                <th>금액</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="cat" colSpan={3}>추가 숙박 (최대 3박)</td></tr>
              <tr><td><strong>디럭스</strong></td><td>₩180,000 / 박</td><td>Deluxe Ocean</td></tr>
              <tr><td><strong>풀억세스</strong></td><td>₩230,000 / 박</td><td>Deluxe Pool Access</td></tr>
              <tr><td className="cat" colSpan={3}>기타</td></tr>
              <tr><td><strong>가족 추가 투숙</strong></td><td>1인 1박 $10 (조식금액)</td><td>최대 3박 / 식사·셔틀 불가</td></tr>
              <tr><td><strong>비자연장비</strong></td><td>4,060 pesos</td><td>+ 대행수수료 500 pesos</td></tr>
              <tr><td><strong>추가 공항 픽업</strong></td><td>₱1,000</td><td>편도</td></tr>
              <tr><td><strong>추가 공항 드랍</strong></td><td>₱800</td><td>편도</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 제휴 할인 */}
      <div className="sec fade">
        <div className="stag">Partnership</div>
        <h2 className="sh">제휴 <span className="hl">할인 혜택</span></h2>
        <div className="divider"></div>

        <div className="disc-grid">
          <div className="disc-card">
            <div className="disc-icon">🎨</div>
            <div className="disc-name">플레이드림</div>
            <div className="disc-rate">10% 할인</div>
          </div>
          <div className="disc-card">
            <div className="disc-icon">💆</div>
            <div className="disc-name">골드문스파</div>
            <div className="disc-rate">50% 할인</div>
          </div>
          <div className="disc-card">
            <div className="disc-icon">💆‍♂️</div>
            <div className="disc-name">오션마사지</div>
            <div className="disc-rate">20% 할인</div>
          </div>
          <div className="disc-card">
            <div className="disc-icon">🍽️</div>
            <div className="disc-name">88식당</div>
            <div className="disc-rate">10% 할인</div>
          </div>
          <div className="disc-card">
            <div className="disc-icon">🍣</div>
            <div className="disc-name">모리</div>
            <div className="disc-rate">10% 할인</div>
          </div>
          <div className="disc-card">
            <div className="disc-icon">🍗</div>
            <div className="disc-name">세부닭</div>
            <div className="disc-rate">10% 할인</div>
          </div>
          <div className="disc-card">
            <div className="disc-icon">🧖</div>
            <div className="disc-name">큐브나인 마사지&스파</div>
            <div className="disc-rate">20% 할인</div>
          </div>
          <div className="disc-card">
            <div className="disc-icon">🍷</div>
            <div className="disc-name">더나인레스토랑</div>
            <div className="disc-rate">10% 할인</div>
          </div>
          <div className="disc-card">
            <div className="disc-icon">🦀</div>
            <div className="disc-name">크랩앤BBQ</div>
            <div className="disc-rate">10% 할인</div>
          </div>
        </div>
      </div>

      {/* 등록 및 환불 규정 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Policy</div>
          <h2 className="sh">등록 및 <span className="hl">환불 규정</span></h2>
          <div className="divider"></div>

          <div className="acc-wrap">
            <button className="acc-header" onClick={() => setPolicyOpen((v) => !v)}>
              <span>📋 등록 및 환불 규정 상세 보기</span>
              <span className={`acc-arrow${policyOpen ? " open" : ""}`}>▼</span>
            </button>
            <div className={`acc-body${policyOpen ? " open" : ""}`}>
              <div className="acc-inner">
                <div className="policy-item"><strong>예약금:</strong> 총 금액의 50% 선입금</div>
                <div className="policy-item"><strong>잔금:</strong> 입실일 기준 2개월 전까지 전액 입금</div>
                <div className="policy-item"><strong>등록 완료 후</strong> 환불 및 변경 불가</div>
                <div className="policy-item"><strong>출국 6주 전 취소:</strong> 예약금 제외 잔금 50% 환불</div>
                <div className="policy-item"><strong>출국 6주 이내 취소:</strong> 환불 불가</div>
                <div className="policy-item"><strong>체크인:</strong> 오후 3시 / <strong>체크아웃:</strong> 정오 12시</div>
                <div className="policy-item"><strong>패키지 정원:</strong> 최대 4인 (성인 최대 2인)</div>
                <div className="policy-warn">⚠️ 등록 완료 후에는 환불 및 변경이 불가하오니, 신중하게 결정해 주시기 바랍니다.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="sec-white">
        <div className="sec-white-i fade">
          <div className="cta-wrap">
            <h3>큐브나인 리조트에서<br/>여유로운 세부 생활을 시작하세요</h3>
            <p>숙소 문의 및 예약은 카카오톡으로 편하게 연락주세요.</p>
            <div className="cta-btns">
              <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer" className="btn-white">상담하기 →</a>
              <a href="/package" className="btn-outline-w">올인원 패키지 보기</a>
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
            <a href="/accommodation/dreamhouse">드림하우스</a>
            <a href="/accommodation/jpark">제이파크</a>
            <a href="/accommodation/cubenine">큐브나인</a>
            <a href="/playdream">플레이드림</a>
            <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기</a>
          </div>
        </div>
        <div className="fcopy">© 2026 Dream Academy by Dream Company. All rights reserved. · Cebu, Philippines</div>
        <div style={{textAlign:"right",maxWidth:1200,margin:"8px auto 0"}}><a href="/admin" style={{fontSize:"9px",color:"rgba(255,255,255,0.08)",textDecoration:"none"}}>관리자</a></div>
      </footer>
    </>
  );
}
