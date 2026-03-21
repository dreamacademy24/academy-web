"use client";
import { useEffect, useState } from "react";

export default function DreamHousePage() {
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
          --sky:#29a9e0; --yellow:#f5a623; --orange:#FF6B35; --orange-dark:#D4520A; --orange-light:#FFF4ED;
          --white:#fff; --off:#FFF9F5; --text:#1a1a2e; --muted:#6b7c93;
          --stroke:#e2e8f0; --shadow:0 8px 40px rgba(0,0,0,0.09);
          --shadow-lg:0 20px 60px rgba(255,107,53,0.13);
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
        .nav-center>a:hover,.nav-dd>a:hover{color:var(--orange);}
        .nav-active{color:var(--orange)!important;font-weight:700!important;}
        .nav-dd{position:relative;}
        .nav-dd-arrow{font-size:10px;transition:transform 200ms;}
        .nav-dd:hover .nav-dd-arrow{transform:rotate(180deg);}
        .nav-dd-menu{position:absolute;top:66px;left:0;background:var(--white);min-width:165px;border:1px solid var(--stroke);border-top:2px solid var(--orange);box-shadow:0 8px 24px rgba(0,0,0,0.1);opacity:0;pointer-events:none;transform:translateY(-6px);transition:all 180ms;}
        .nav-dd:hover .nav-dd-menu{opacity:1;pointer-events:all;transform:translateY(0);}
        .nav-dd-menu a{display:block;padding:11px 18px;font-size:13.5px;color:#374151;border-bottom:1px solid var(--stroke);transition:background 140ms,color 140ms;}
        .nav-dd-menu a:last-child{border-bottom:none;}
        .nav-dd-menu a:hover{background:var(--orange-light);color:var(--orange);}
        .nav-right{display:flex;align-items:center;flex-shrink:0;}
        .nav-cta{background:var(--orange);color:var(--white);font-size:13.5px;font-weight:600;padding:9px 20px;border-radius:4px;transition:background 160ms;}
        .nav-cta:hover{background:var(--orange-dark);}
        .hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;}
        .hamburger span{width:22px;height:2px;background:var(--text);display:block;}
        .mob-nav{display:none;position:fixed;top:66px;left:0;right:0;background:var(--white);z-index:299;padding:16px 24px 24px;flex-direction:column;border-top:1px solid var(--stroke);box-shadow:0 8px 24px rgba(0,0,0,0.1);}
        .mob-nav.open{display:flex;}
        .mob-nav a{padding:12px 0;color:#374151;font-size:14px;border-bottom:1px solid var(--stroke);}

        /* HERO */
        .page-hero{
          padding:120px 60px 72px;
          background:linear-gradient(135deg,var(--orange-light) 0%,#FFE0CC 40%,#FFF4ED 100%);
          border-bottom:1px solid var(--stroke);
          text-align:center;
        }
        .page-hero-inner{max-width:900px;margin:0 auto;}
        .page-tag{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:var(--orange);margin-bottom:14px;}
        .page-hero h1{font-size:clamp(34px,5vw,56px);font-weight:800;line-height:1.15;letter-spacing:-0.03em;margin-bottom:16px;}
        .page-hero h1 .hl{color:var(--orange);}
        .page-hero p{font-size:17px;color:var(--muted);line-height:1.7;margin:0 auto;}
        .hero-badges{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:24px;}
        .hbadge{display:inline-flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--stroke);padding:8px 16px;border-radius:24px;font-size:13px;font-weight:600;color:var(--text);box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .hbadge.orange{background:var(--orange-light);border-color:rgba(255,107,53,0.2);color:var(--orange);}

        /* HERO IMAGE */
        .hero-img{width:100%;max-width:800px;margin:32px auto 0;border-radius:16px;box-shadow:var(--shadow);display:block;}

        /* SECTIONS */
        .sec{padding:80px 60px;max-width:1200px;margin:0 auto;}
        .sec-bg{background:var(--off);}
        .sec-bg-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .sec-white{background:var(--white);}
        .sec-white-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .stag{font-family:'Montserrat',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:var(--orange);margin-bottom:10px;display:flex;align-items:center;gap:9px;}
        .stag::before{content:'';width:20px;height:2px;background:var(--orange);border-radius:2px;}
        .sh{font-size:clamp(24px,3vw,38px);font-weight:800;line-height:1.22;letter-spacing:-0.022em;margin-bottom:12px;word-break:keep-all;}
        .sh .hl{color:var(--orange);}
        .sp{font-size:14px;color:var(--muted);line-height:1.9;max-width:660px;word-break:keep-all;}
        .divider{width:40px;height:3px;background:var(--orange);margin:12px 0 22px;border-radius:2px;}

        /* FEATURE LIST */
        .feat-list{display:flex;flex-direction:column;gap:10px;margin-top:20px;}
        .feat-item{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:var(--muted);line-height:1.8;word-break:keep-all;}
        .feat-item strong{color:var(--text);}

        /* ROOM CARD */
        .room-card{background:var(--white);border:1px solid var(--stroke);border-radius:18px;padding:28px 28px 24px;margin-top:24px;}
        .room-title{font-size:18px;font-weight:800;margin-bottom:16px;display:flex;align-items:center;gap:8px;}
        .room-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
        .room-item{display:flex;align-items:flex-start;gap:8px;font-size:13.5px;color:var(--muted);line-height:1.7;}
        .room-item strong{color:var(--text);}

        /* PACKAGE CARDS */
        .pkg-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-top:28px;}
        .pkg-card{background:var(--white);border:1px solid var(--stroke);border-radius:18px;overflow:hidden;transition:transform 200ms,box-shadow 200ms;}
        .pkg-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .pkg-card-top{padding:24px 24px 18px;}
        .pkg-card-top.helper{background:linear-gradient(135deg,#FFF4ED,#FFE0CC);}
        .pkg-card-top.center{background:linear-gradient(135deg,#eaf3fb,#dbeafe);}
        .pkg-card-top.tutor{background:linear-gradient(135deg,#f0fdf4,#dcfce7);}
        .pkg-card-top.airport{background:linear-gradient(135deg,#FFF8E1,#FFF3CD);}
        .pkg-card-top.sim{background:linear-gradient(135deg,#f5f3ff,#ede9fe);}
        .pkg-card-top.meal{background:linear-gradient(135deg,#fef2f2,#fecaca30);}
        .pkg-card-icon{font-size:36px;margin-bottom:10px;}
        .pkg-card-title{font-size:16px;font-weight:800;margin-bottom:4px;}
        .pkg-card-sub{font-size:12.5px;color:var(--muted);}
        .pkg-card-body{padding:18px 24px 24px;}
        .pkg-card-desc{font-size:13px;color:var(--muted);line-height:1.75;margin-bottom:14px;word-break:keep-all;}
        .pkg-meta{display:flex;flex-direction:column;gap:6px;padding:14px 16px;background:#f8fafc;border-radius:10px;}
        .pkg-meta-row{font-size:12.5px;color:var(--muted);display:flex;align-items:center;gap:8px;}
        .pkg-meta-row strong{color:var(--text);}

        /* LOCATION */
        .loc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:24px;}
        .loc-card{background:var(--white);border:1px solid var(--stroke);border-radius:14px;padding:24px;text-align:center;transition:transform 200ms,box-shadow 200ms;}
        .loc-card:hover{transform:translateY(-2px);box-shadow:var(--shadow);}
        .loc-icon{font-size:32px;margin-bottom:10px;}
        .loc-title{font-size:14px;font-weight:700;margin-bottom:4px;}
        .loc-desc{font-size:13px;color:var(--muted);}

        /* TABLE */
        .price-table{width:100%;border-collapse:collapse;margin-top:24px;border:1px solid var(--stroke);border-radius:12px;overflow:hidden;}
        .price-table th{background:var(--orange);color:var(--white);font-size:13px;font-weight:700;padding:14px 18px;text-align:left;}
        .price-table td{font-size:13px;padding:12px 18px;border-bottom:1px solid var(--stroke);color:var(--muted);line-height:1.6;}
        .price-table tr:last-child td{border-bottom:none;}
        .price-table td strong{color:var(--text);}
        .price-table .cat{background:#FFF4ED;color:var(--orange);font-weight:700;font-size:12.5px;letter-spacing:0.05em;}

        /* DISCOUNT */
        .disc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:24px;}
        .disc-card{background:var(--white);border:1px solid var(--stroke);border-radius:14px;padding:20px;text-align:center;transition:transform 200ms;}
        .disc-card:hover{transform:translateY(-2px);box-shadow:var(--shadow);}
        .disc-icon{font-size:28px;margin-bottom:8px;}
        .disc-name{font-size:14px;font-weight:700;margin-bottom:4px;}
        .disc-rate{font-size:20px;font-weight:800;color:var(--orange);}
        .disc-desc{font-size:12px;color:var(--muted);margin-top:4px;}

        /* CTA */
        .cta-wrap{background:linear-gradient(135deg,var(--orange-dark),var(--orange));border-radius:16px;padding:48px;text-align:center;}
        .cta-wrap h3{font-size:28px;font-weight:800;color:var(--white);margin-bottom:10px;word-break:keep-all;}
        .cta-wrap p{font-size:14.5px;color:rgba(255,255,255,0.7);margin-bottom:28px;word-break:keep-all;}
        .cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
        .btn-white{background:var(--white);color:var(--orange-dark);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:transform 150ms,box-shadow 150ms;box-shadow:0 4px 16px rgba(0,0,0,0.15);}
        .btn-white:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,0.2);}
        .btn-outline-w{border:1.5px solid rgba(255,255,255,0.35);color:rgba(255,255,255,0.85);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:border-color 160ms,color 160ms;}
        .btn-outline-w:hover{border-color:var(--white);color:var(--white);}

        /* FOOTER */
        footer{background:#3D1F00;padding:40px 60px 24px;border-top:1px solid rgba(255,255,255,0.07);}
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
          .pkg-grid{grid-template-columns:1fr;}
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
              <a href="/accommodation/dreamhouse" className="nav-active">드림하우스 (독채)</a>
              <a href="/accommodation/jpark">제이파크</a>
              <a href="/accommodation/cubenine">큐브나인</a>
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
        <a href="/package">올인원패키지</a>
        <a href="/accommodation/dreamhouse" style={{ color: "var(--orange)", fontWeight: 700 }}>▶ 드림하우스 (독채)</a>
        <a href="/accommodation/jpark">제이파크</a>
        <a href="/accommodation/cubenine">큐브나인</a>
        <a href="/playdream">플레이드림</a>
        <a href="/apply">패키지서비스신청</a>
        <a href="#">커뮤니티</a>
        <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기 →</a>
      </div>

      {/* HERO */}
      <div className="page-hero">
        <div className="page-hero-inner">
          <div className="page-tag fade">Dream House</div>
          <h1 className="fade">PRIVATE <span className="hl">DREAM HOUSE</span></h1>
          <p className="fade">숙소, 영어 수업, 식사, 생활 케어까지<br/>모든 것이 이루어지는 프라이빗 올인원 시스템!</p>
          <div className="hero-badges fade">
            <div className="hbadge">🏡 독채 주택</div>
            <div className="hbadge">🍳 식사 제공</div>
            <div className="hbadge">📚 튜터 서비스</div>
            <div className="hbadge orange">⭐ 올인원</div>
          </div>
          <img src="/images/dreamhouse.jpg" alt="Dream House" className="hero-img fade" />
        </div>
      </div>

      {/* 숙소 소개 */}
      <div className="sec fade">
        <div className="stag">About</div>
        <h2 className="sh">드림하우스 <span className="hl">소개</span></h2>
        <div className="divider"></div>
        <p className="sp">기숙사형이 아닌, 베이스워터 빌리지 내 단독 2층 주택입니다. 한국 정수기, 방충망, 도어락, 한국산 가전까지 구비되어 한국에서의 생활 그대로 편안하게 지낼 수 있습니다.</p>
        <div className="feat-list" style={{ marginTop: "24px" }}>
          <div className="feat-item">🏠 기숙사형이 아닌 <strong>빌리지 내 단독 2층 주택</strong></div>
          <div className="feat-item">📍 <strong>베이스워터 빌리지</strong> 위치</div>
          <div className="feat-item">💧 한국 <strong>정수기</strong> 설치</div>
          <div className="feat-item">🪟 <strong>방충망</strong> 전 객실 완비</div>
          <div className="feat-item">🔒 <strong>디지털 도어락</strong> 설치</div>
          <div className="feat-item">🇰🇷 <strong>한국산 가전제품</strong> 구비</div>
        </div>
      </div>

      {/* Room Details */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Room Details</div>
          <h2 className="sh">객실 <span className="hl">상세</span></h2>
          <div className="divider"></div>

          <div className="room-card">
            <div className="room-title">🏡 2층 독채 주택</div>
            <div className="room-grid">
              <div className="room-item">🛏️ <strong>구성:</strong> 방 3개 / 화장실 2개</div>
              <div className="room-item">👥 <strong>수용:</strong> 최대 6인</div>
              <div className="room-item">🍳 <strong>주방:</strong> 냉장고, 밥솥, 전자렌지 등 완비</div>
              <div className="room-item">🇰🇷 <strong>가전:</strong> 한국 제품으로 구성</div>
              <div className="room-item">💧 <strong>정수기:</strong> 한국산 정수기 설치</div>
              <div className="room-item">🔒 <strong>보안:</strong> 디지털 도어락</div>
            </div>
          </div>
        </div>
      </div>

      {/* 패키지 포함사항 */}
      <div className="sec fade">
        <div className="stag">Package</div>
        <h2 className="sh">패키지 <span className="hl">포함사항</span></h2>
        <div className="divider"></div>

        <div className="pkg-grid">
          {/* 헬퍼(아떼) 서비스 */}
          <div className="pkg-card">
            <div className="pkg-card-top helper">
              <div className="pkg-card-icon">🧹</div>
              <div className="pkg-card-title">주 6일 헬퍼(아떼) 서비스</div>
              <div className="pkg-card-sub">청소 / 빨래 / 식사 준비</div>
            </div>
            <div className="pkg-card-body">
              <p className="pkg-card-desc">전담 헬퍼가 매일 방문하여 청소, 빨래, 식사 준비까지 생활 전반을 케어합니다.</p>
              <div className="pkg-meta">
                <div className="pkg-meta-row">📅 <strong>운영:</strong> 월~토 (주 6일)</div>
                <div className="pkg-meta-row">🕐 <strong>시간:</strong> 오전 8시 ~ 오후 5시</div>
              </div>
            </div>
          </div>

          {/* 드림센터 */}
          <div className="pkg-card">
            <div className="pkg-card-top center">
              <div className="pkg-card-icon">📚</div>
              <div className="pkg-card-title">드림센터 운영</div>
              <div className="pkg-card-sub">도서관 / 물놀이 / 편의시설</div>
            </div>
            <div className="pkg-card-body">
              <p className="pkg-card-desc">빌리지 내 드림센터에서 도서관, 물놀이 용품, 커피머신, 킥보드 대여 등 다양한 시설을 이용할 수 있습니다.</p>
              <div className="pkg-meta">
                <div className="pkg-meta-row">📖 <strong>도서관</strong> 이용 가능</div>
                <div className="pkg-meta-row">🏊 <strong>물놀이 용품</strong> 대여</div>
                <div className="pkg-meta-row">☕ <strong>커피머신</strong> 비치</div>
                <div className="pkg-meta-row">🛴 <strong>킥보드</strong> 대여</div>
              </div>
            </div>
          </div>

          {/* 튜터 서비스 */}
          <div className="pkg-card">
            <div className="pkg-card-top tutor">
              <div className="pkg-card-icon">👩‍🏫</div>
              <div className="pkg-card-title">튜터 서비스</div>
              <div className="pkg-card-sub">1:1 및 1:2 영어 수업</div>
            </div>
            <div className="pkg-card-body">
              <p className="pkg-card-desc">드림하우스로 방문하는 전문 튜터와 함께 1:1 또는 1:2 맞춤 영어 수업을 진행합니다.</p>
              <div className="pkg-meta">
                <div className="pkg-meta-row">📅 <strong>운영:</strong> 월~토</div>
                <div className="pkg-meta-row">🕐 <strong>시간:</strong> 50분 수업</div>
                <div className="pkg-meta-row">💰 <strong>1:1</strong> ₱300 / 타임</div>
                <div className="pkg-meta-row">💰 <strong>1:2</strong> ₱350 / 타임</div>
              </div>
            </div>
          </div>

          {/* 공항 픽드랍 */}
          <div className="pkg-card">
            <div className="pkg-card-top airport">
              <div className="pkg-card-icon">✈️</div>
              <div className="pkg-card-title">무료 공항 픽드랍</div>
              <div className="pkg-card-sub">기사 + 현지 직원 동행</div>
            </div>
            <div className="pkg-card-body">
              <p className="pkg-card-desc">공항 도착부터 숙소까지 전담 기사와 현지 직원이 함께 동행하여 안전하게 이동합니다.</p>
              <div className="pkg-meta">
                <div className="pkg-meta-row">🚗 <strong>전담 기사</strong> 배정</div>
                <div className="pkg-meta-row">👤 <strong>현지 직원</strong> 동행</div>
                <div className="pkg-meta-row">💰 <strong>비용:</strong> 무료</div>
              </div>
            </div>
          </div>

          {/* 유심 대여 */}
          <div className="pkg-card">
            <div className="pkg-card-top sim">
              <div className="pkg-card-icon">📱</div>
              <div className="pkg-card-title">유심 대여 서비스</div>
              <div className="pkg-card-sub">Smart 5G 요금제</div>
            </div>
            <div className="pkg-card-body">
              <p className="pkg-card-desc">Smart 5G 유심을 기간별 요금제로 편리하게 대여하여 사용할 수 있습니다.</p>
              <div className="pkg-meta">
                <div className="pkg-meta-row">📶 <strong>통신사:</strong> Smart 5G</div>
                <div className="pkg-meta-row">📅 <strong>요금제:</strong> 3일 / 7일 / 30일</div>
              </div>
            </div>
          </div>

          {/* 프리미엄 도시락 */}
          <div className="pkg-card">
            <div className="pkg-card-top meal">
              <div className="pkg-card-icon">🍱</div>
              <div className="pkg-card-title">평일 3식 프리미엄 도시락</div>
              <div className="pkg-card-sub">아침 / 점심 / 저녁 배달</div>
            </div>
            <div className="pkg-card-body">
              <p className="pkg-card-desc">매일 정해진 시간에 프리미엄 도시락이 드림하우스로 배달됩니다.</p>
              <div className="pkg-meta">
                <div className="pkg-meta-row">🌅 <strong>아침:</strong> 7:50</div>
                <div className="pkg-meta-row">☀️ <strong>점심:</strong> 11:50</div>
                <div className="pkg-meta-row">🌇 <strong>저녁:</strong> 17:40</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 위치 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Location</div>
          <h2 className="sh">위치 <span className="hl">안내</span></h2>
          <div className="divider"></div>
          <p className="sp">베이스워터 빌리지에 위치한 드림하우스는 주요 시설과 가까워 편리한 생활이 가능합니다.</p>

          <div className="loc-grid">
            <div className="loc-card">
              <div className="loc-icon">🏫</div>
              <div className="loc-title">드림아카데미</div>
              <div className="loc-desc">차량 약 5분</div>
            </div>
            <div className="loc-card">
              <div className="loc-icon">✈️</div>
              <div className="loc-title">막탄 공항</div>
              <div className="loc-desc">차량 약 20분</div>
            </div>
            <div className="loc-card">
              <div className="loc-icon">🛒</div>
              <div className="loc-title">가이사노몰</div>
              <div className="loc-desc">차량 약 5분</div>
            </div>
          </div>
        </div>
      </div>

      {/* 금액 안내 */}
      <div className="sec fade">
        <div className="stag">Pricing</div>
        <h2 className="sh">금액 <span className="hl">안내</span></h2>
        <div className="divider"></div>

        <table className="price-table">
          <thead>
            <tr>
              <th>구분</th>
              <th>항목</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="cat" colSpan={3}>포함 사항</td></tr>
            <tr><td><strong>숙소</strong></td><td>드림하우스 독채 (2층)</td><td>방3 / 화장실2</td></tr>
            <tr><td><strong>헬퍼</strong></td><td>주 6일 아떼 서비스</td><td>월~토 8시~17시</td></tr>
            <tr><td><strong>식사</strong></td><td>평일 3식 프리미엄 도시락</td><td>아침/점심/저녁</td></tr>
            <tr><td><strong>픽드랍</strong></td><td>무료 공항 픽업 & 드랍</td><td>기사+직원 동행</td></tr>
            <tr><td><strong>유심</strong></td><td>Smart 5G 유심 대여</td><td>3일/7일/30일</td></tr>
            <tr><td><strong>드림센터</strong></td><td>도서관, 물놀이, 커피머신 등</td><td>자유 이용</td></tr>
            <tr><td className="cat" colSpan={3}>별도 결제</td></tr>
            <tr><td><strong>튜터</strong></td><td>1:1 ₱300 / 1:2 ₱350</td><td>50분 / 타임당</td></tr>
          </tbody>
        </table>
      </div>

      {/* 제휴 할인 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Partnership</div>
          <h2 className="sh">제휴 <span className="hl">할인</span></h2>
          <div className="divider"></div>
          <p className="sp">드림하우스 입주 고객님께 제공되는 특별 제휴 할인 혜택입니다.</p>

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
              <div className="disc-icon">🍽️</div>
              <div className="disc-name">88식당</div>
              <div className="disc-rate">10% 할인</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="sec-white">
        <div className="sec-white-i fade">
          <div className="cta-wrap">
            <h3>드림하우스에서<br/>편안한 세부 생활을 시작하세요</h3>
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
            <a href="/playdream">플레이드림</a>
            <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기</a>
          </div>
        </div>
        <div className="fcopy">© 2026 Dream Academy by Dream Company. All rights reserved. · Cebu, Philippines</div>
      </footer>
    </>
  );
}
