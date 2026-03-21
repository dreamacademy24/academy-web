"use client";
import { useEffect, useState } from "react";

export default function JparkPage() {
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
          --resort:#1a6fa8; --resort-dark:#0d4f7a; --resort-light:#e8f4fd;
          --resort-mid:#2a8fd4; --resort-pale:#f0f8ff;
          --sky:#29a9e0; --yellow:#f5a623; --gold:#d4a017;
          --white:#fff; --off:#f6fafd; --text:#1a1a2e; --muted:#6b7c93;
          --stroke:#d4e5f0; --shadow:0 8px 40px rgba(0,0,0,0.09);
          --shadow-lg:0 20px 60px rgba(26,111,168,0.13);
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
        .nav-center>a:hover,.nav-dd>a:hover{color:var(--resort);}
        .nav-active{color:var(--resort)!important;font-weight:700!important;}
        .nav-dd{position:relative;}
        .nav-dd-arrow{font-size:10px;transition:transform 200ms;}
        .nav-dd:hover .nav-dd-arrow{transform:rotate(180deg);}
        .nav-dd-menu{position:absolute;top:66px;left:0;background:var(--white);min-width:165px;border:1px solid var(--stroke);border-top:2px solid var(--resort);box-shadow:0 8px 24px rgba(0,0,0,0.1);opacity:0;pointer-events:none;transform:translateY(-6px);transition:all 180ms;}
        .nav-dd:hover .nav-dd-menu{opacity:1;pointer-events:all;transform:translateY(0);}
        .nav-dd-menu a{display:block;padding:11px 18px;font-size:13.5px;color:#374151;border-bottom:1px solid var(--stroke);transition:background 140ms,color 140ms;}
        .nav-dd-menu a:last-child{border-bottom:none;}
        .nav-dd-menu a:hover{background:var(--resort-light);color:var(--resort);}
        .nav-right{display:flex;align-items:center;flex-shrink:0;}
        .nav-cta{background:var(--resort);color:var(--white);font-size:13.5px;font-weight:600;padding:9px 20px;border-radius:4px;transition:background 160ms;}
        .nav-cta:hover{background:var(--resort-dark);}
        .hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;}
        .hamburger span{width:22px;height:2px;background:var(--text);display:block;}
        .mob-nav{display:none;position:fixed;top:66px;left:0;right:0;background:var(--white);z-index:299;padding:16px 24px 24px;flex-direction:column;border-top:1px solid var(--stroke);box-shadow:0 8px 24px rgba(0,0,0,0.1);}
        .mob-nav.open{display:flex;}
        .mob-nav a{padding:12px 0;color:#374151;font-size:14px;border-bottom:1px solid var(--stroke);}

        /* HERO */
        .page-hero{
          padding:120px 60px 72px;
          background:linear-gradient(135deg,var(--resort-light) 0%,#cce7f8 40%,#e8f4fd 100%);
          border-bottom:1px solid var(--stroke);
          text-align:center;
        }
        .page-hero-inner{max-width:900px;margin:0 auto;}
        .page-tag{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:var(--resort);margin-bottom:14px;}
        .page-hero h1{font-size:clamp(34px,5vw,56px);font-weight:800;line-height:1.15;letter-spacing:-0.03em;margin-bottom:16px;}
        .page-hero h1 .hl{color:var(--resort);}
        .page-hero .sub{font-size:22px;font-weight:700;color:var(--resort-dark);margin-bottom:12px;}
        .page-hero p{font-size:16px;color:var(--muted);line-height:1.7;margin:0 auto;max-width:700px;}
        .hero-badges{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:24px;}
        .hbadge{display:inline-flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--stroke);padding:8px 16px;border-radius:24px;font-size:13px;font-weight:600;color:var(--text);box-shadow:0 2px 8px rgba(0,0,0,0.06);}
        .hbadge.blue{background:var(--resort-light);border-color:rgba(26,111,168,0.2);color:var(--resort);}
        .hero-img{width:100%;max-width:800px;margin:32px auto 0;border-radius:16px;box-shadow:var(--shadow);display:block;}

        /* SECTIONS */
        .sec{padding:80px 60px;max-width:1200px;margin:0 auto;}
        .sec-bg{background:var(--off);}
        .sec-bg-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .sec-white{background:var(--white);}
        .sec-white-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .stag{font-family:'Montserrat',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:var(--resort);margin-bottom:10px;display:flex;align-items:center;gap:9px;}
        .stag::before{content:'';width:20px;height:2px;background:var(--resort);border-radius:2px;}
        .sh{font-size:clamp(24px,3vw,38px);font-weight:800;line-height:1.22;letter-spacing:-0.022em;margin-bottom:12px;word-break:keep-all;}
        .sh .hl{color:var(--resort);}
        .sp{font-size:14px;color:var(--muted);line-height:1.9;max-width:660px;word-break:keep-all;}
        .divider{width:40px;height:3px;background:var(--resort);margin:12px 0 22px;border-radius:2px;}

        /* FEATURE GRID */
        .feat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:24px;}
        .feat-card{background:var(--white);border:1px solid var(--stroke);border-radius:14px;padding:22px;display:flex;align-items:flex-start;gap:14px;transition:transform 200ms,box-shadow 200ms;}
        .feat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow);}
        .feat-icon{font-size:28px;flex-shrink:0;margin-top:2px;}
        .feat-title{font-size:14px;font-weight:700;margin-bottom:4px;}
        .feat-desc{font-size:13px;color:var(--muted);line-height:1.7;word-break:keep-all;}

        /* LOCATION */
        .loc-info{margin-top:24px;padding:24px;background:var(--resort-light);border:1px solid rgba(26,111,168,0.15);border-radius:14px;}
        .loc-addr{font-size:13.5px;color:var(--muted);line-height:1.8;margin-bottom:16px;}
        .loc-addr strong{color:var(--text);}
        .loc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
        .loc-card{background:var(--white);border:1px solid var(--stroke);border-radius:10px;padding:16px;text-align:center;}
        .loc-card-icon{font-size:24px;margin-bottom:6px;}
        .loc-card-title{font-size:13px;font-weight:700;margin-bottom:2px;}
        .loc-card-desc{font-size:12px;color:var(--muted);}

        /* POOL TAGS */
        .pool-tags{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px;}
        .pool-tag{background:var(--resort-light);border:1px solid rgba(26,111,168,0.15);padding:10px 18px;border-radius:24px;font-size:13px;font-weight:600;color:var(--resort);display:inline-flex;align-items:center;gap:6px;}

        /* ACTIVITY GRID */
        .act-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:24px;}
        .act-card{background:var(--white);border:1px solid var(--stroke);border-radius:14px;padding:20px;text-align:center;transition:transform 200ms,box-shadow 200ms;}
        .act-card:hover{transform:translateY(-2px);box-shadow:var(--shadow);}
        .act-icon{font-size:32px;margin-bottom:8px;}
        .act-name{font-size:13px;font-weight:700;}
        .act-sub{font-size:11.5px;color:var(--muted);margin-top:2px;}

        /* ROOM CARDS */
        .room-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:28px;}
        .room-card{background:var(--white);border:1px solid var(--stroke);border-radius:18px;overflow:hidden;transition:transform 200ms,box-shadow 200ms;}
        .room-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .room-card-top{padding:24px 24px 18px;}
        .room-card-top.deluxe{background:linear-gradient(135deg,#e8f4fd,#cce7f8);}
        .room-card-top.premier{background:linear-gradient(135deg,#f0fdf4,#dcfce7);}
        .room-card-top.suite{background:linear-gradient(135deg,#FFF8E1,#FFF3CD);}
        .room-card-icon{font-size:36px;margin-bottom:10px;}
        .room-card-title{font-size:17px;font-weight:800;margin-bottom:4px;}
        .room-card-sub{font-size:12.5px;color:var(--muted);}
        .room-card-body{padding:18px 24px 24px;}
        .room-meta{display:flex;flex-direction:column;gap:6px;padding:14px 16px;background:#f8fafc;border-radius:10px;}
        .room-meta-row{font-size:12.5px;color:var(--muted);display:flex;align-items:center;gap:8px;}
        .room-meta-row strong{color:var(--text);}

        /* PACKAGE LIST */
        .pkg-list{display:flex;flex-direction:column;gap:12px;margin-top:24px;}
        .pkg-item{display:flex;align-items:flex-start;gap:14px;background:var(--white);border:1px solid var(--stroke);border-radius:14px;padding:20px;transition:transform 200ms;}
        .pkg-item:hover{transform:translateY(-2px);box-shadow:var(--shadow);}
        .pkg-item-icon{font-size:28px;flex-shrink:0;margin-top:2px;}
        .pkg-item-title{font-size:14px;font-weight:700;margin-bottom:4px;}
        .pkg-item-desc{font-size:13px;color:var(--muted);line-height:1.7;word-break:keep-all;}

        /* TABLE */
        .price-table{width:100%;border-collapse:collapse;margin-top:24px;border:1px solid var(--stroke);border-radius:12px;overflow:hidden;}
        .price-table th{background:var(--resort);color:var(--white);font-size:13px;font-weight:700;padding:14px 18px;text-align:left;}
        .price-table td{font-size:13px;padding:12px 18px;border-bottom:1px solid var(--stroke);color:var(--muted);line-height:1.6;}
        .price-table tr:last-child td{border-bottom:none;}
        .price-table td strong{color:var(--text);}
        .price-table .cat{background:var(--resort-light);color:var(--resort);font-weight:700;font-size:12.5px;letter-spacing:0.05em;}

        /* DISCOUNT GRID */
        .disc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:24px;}
        .disc-card{background:var(--white);border:1px solid var(--stroke);border-radius:14px;padding:20px;text-align:center;transition:transform 200ms;}
        .disc-card:hover{transform:translateY(-2px);box-shadow:var(--shadow);}
        .disc-icon{font-size:28px;margin-bottom:8px;}
        .disc-name{font-size:14px;font-weight:700;margin-bottom:4px;}
        .disc-rate{font-size:20px;font-weight:800;color:var(--resort);}

        /* CTA */
        .cta-wrap{background:linear-gradient(135deg,var(--resort-dark),var(--resort));border-radius:16px;padding:48px;text-align:center;}
        .cta-wrap h3{font-size:28px;font-weight:800;color:var(--white);margin-bottom:10px;word-break:keep-all;}
        .cta-wrap p{font-size:14.5px;color:rgba(255,255,255,0.7);margin-bottom:28px;word-break:keep-all;}
        .cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
        .btn-white{background:var(--white);color:var(--resort-dark);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:transform 150ms,box-shadow 150ms;box-shadow:0 4px 16px rgba(0,0,0,0.15);}
        .btn-white:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,0.2);}
        .btn-outline-w{border:1.5px solid rgba(255,255,255,0.35);color:rgba(255,255,255,0.85);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:border-color 160ms,color 160ms;}
        .btn-outline-w:hover{border-color:var(--white);color:var(--white);}

        /* FOOTER */
        footer{background:#0d2a3d;padding:40px 60px 24px;border-top:1px solid rgba(255,255,255,0.07);}
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
          .feat-grid{grid-template-columns:1fr;}
          .room-grid{grid-template-columns:1fr;}
          .act-grid{grid-template-columns:repeat(2,1fr);}
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
              <a href="/accommodation/jpark" className="nav-active">제이파크</a>
              <a href="/accommodation/cubenine">큐브나인</a>
            </div>
          </div>
          <a href="/playdream">플레이드림</a>
          <a href="/apply">패키지서비스신청</a>
          <a href="/notice">공지사항</a>
          <a href="/community">커뮤니티</a>
        </div>
        <div className="nav-right">
          <a href="/login" style={{color:"#374151",fontSize:"13.5px",fontWeight:600,marginRight:"10px"}}>로그인</a><a href="http://pf.kakao.com/_Yuhxhn/chat" className="nav-cta" target="_blank" rel="noopener noreferrer">상담하기</a>
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
        <a href="/accommodation/jpark" style={{ color: "var(--resort)", fontWeight: 700 }}>▶ 제이파크</a>
        <a href="/accommodation/cubenine">큐브나인</a>
        <a href="/playdream">플레이드림</a>
        <a href="/apply">패키지서비스신청</a>
        <a href="/notice">공지사항</a>
        <a href="/community">커뮤니티</a>
        <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기 →</a>
      </div>

      {/* HERO */}
      <div className="page-hero">
        <div className="page-hero-inner">
          <div className="page-tag fade">Premium Resort Stay</div>
          <h1 className="fade">Jpark Island <span className="hl">× Dream Academy</span></h1>
          <div className="sub fade">남다른 한 달 살기</div>
          <p className="fade">5성급 리조트의 품격은 기본, 전문 교육과 케어까지 모두 담은<br/>세부 유일의 프리미엄 올인클루시브 어학연수 패키지</p>
          <div className="hero-badges fade">
            <div className="hbadge">🏨 5성급 리조트</div>
            <div className="hbadge">🏊 워터파크</div>
            <div className="hbadge">📚 정규수업</div>
            <div className="hbadge blue">⭐ 올인클루시브</div>
          </div>
          <img src="/images/jpark.png" alt="J-Park Island Resort" className="hero-img fade" />
        </div>
      </div>

      {/* About J-Park */}
      <div className="sec fade">
        <div className="stag">About</div>
        <h2 className="sh">About <span className="hl">J-Park</span></h2>
        <div className="divider"></div>

        <div className="feat-grid">
          <div className="feat-card">
            <div className="feat-icon">🏨</div>
            <div>
              <div className="feat-title">5성급 호텔 & 다양한 룸타입</div>
              <div className="feat-desc">820개 객실을 보유한 세부 최대 규모의 5성급 리조트로, Deluxe · Premier · Mactan Suite 등 다양한 룸타입을 제공합니다.</div>
            </div>
          </div>
          <div className="feat-card">
            <div className="feat-icon">🏊</div>
            <div>
              <div className="feat-title">7개 이상 테마 수영장 & 워터슬라이드</div>
              <div className="feat-desc">다양한 테마의 수영장과 워터슬라이드, 전용 비치까지 리조트 내에서 물놀이를 마음껏 즐길 수 있습니다.</div>
            </div>
          </div>
          <div className="feat-card">
            <div className="feat-icon">🎢</div>
            <div>
              <div className="feat-title">액티비티 존 & 키즈 프렌들리</div>
              <div className="feat-desc">뿌로로파크, 고카트 등 다양한 액티비티 존이 있으며, 아이와 함께하는 가족에게 최적화된 키즈 프렌들리 호텔입니다.</div>
            </div>
          </div>
          <div className="feat-card">
            <div className="feat-icon">📍</div>
            <div>
              <div className="feat-title">편리한 위치</div>
              <div className="feat-desc">상스몰 도보 1분, 드림아카데미 차량 10~13분, 공항 20분 거리에 위치하여 생활과 학습 모두 편리합니다.</div>
            </div>
          </div>
        </div>

        <div className="loc-info">
          <div className="loc-addr">📍 <strong>M.L. Quezon Highway, Barangay Maribago, Lapu Lapu City, Cebu</strong></div>
          <div className="loc-grid">
            <div className="loc-card">
              <div className="loc-card-icon">🛒</div>
              <div className="loc-card-title">상스몰</div>
              <div className="loc-card-desc">도보 1분</div>
            </div>
            <div className="loc-card">
              <div className="loc-card-icon">🏫</div>
              <div className="loc-card-title">드림아카데미</div>
              <div className="loc-card-desc">차량 10~13분</div>
            </div>
            <div className="loc-card">
              <div className="loc-card-icon">✈️</div>
              <div className="loc-card-title">막탄 공항</div>
              <div className="loc-card-desc">차량 약 20분</div>
            </div>
          </div>
        </div>
      </div>

      {/* Water Park */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Water Park</div>
          <h2 className="sh">테마 <span className="hl">워터파크</span></h2>
          <div className="divider"></div>
          <p className="sp">7개 이상의 테마 수영장과 워터슬라이드로 매일 새로운 물놀이를 경험할 수 있습니다.</p>

          <div className="pool-tags">
            <span className="pool-tag">🏝️ Island Pool</span>
            <span className="pool-tag">🌊 Wave Pool</span>
            <span className="pool-tag">🏖️ Beach Pool</span>
            <span className="pool-tag">🏴‍☠️ Captain Hook&apos;s Pool</span>
            <span className="pool-tag">👶 Toddler&apos;s Pool</span>
            <span className="pool-tag">🎢 Tube Slide</span>
            <span className="pool-tag">🌅 Sunset Pool</span>
            <span className="pool-tag">🌿 Amazon River</span>
          </div>
        </div>
      </div>

      {/* Outside Activities & Other Facilities */}
      <div className="sec fade">
        <div className="stag">Activities & Facilities</div>
        <h2 className="sh">액티비티 & <span className="hl">부대시설</span></h2>
        <div className="divider"></div>

        <div className="act-grid">
          <div className="act-card">
            <div className="act-icon">⚽</div>
            <div className="act-name">Soccer Billiard</div>
            <div className="act-sub">풋볼 당구</div>
          </div>
          <div className="act-card">
            <div className="act-icon">🏎️</div>
            <div className="act-name">Go Kart Bikes</div>
            <div className="act-sub">고카트</div>
          </div>
          <div className="act-card">
            <div className="act-icon">🎯</div>
            <div className="act-name">J Activity Zone</div>
            <div className="act-sub">액티비티 존</div>
          </div>
          <div className="act-card">
            <div className="act-icon">⛳</div>
            <div className="act-name">Mini-Golf</div>
            <div className="act-sub">미니 골프</div>
          </div>
          <div className="act-card">
            <div className="act-icon">💪</div>
            <div className="act-name">Gym</div>
            <div className="act-sub">피트니스 센터</div>
          </div>
          <div className="act-card">
            <div className="act-icon">💆</div>
            <div className="act-name">Cara Spa</div>
            <div className="act-sub">스파 & 마사지</div>
          </div>
          <div className="act-card">
            <div className="act-icon">🍨</div>
            <div className="act-name">The Snow Dessert Cafe</div>
            <div className="act-sub">디저트 카페</div>
          </div>
          <div className="act-card">
            <div className="act-icon">🏥</div>
            <div className="act-name">Medical Center</div>
            <div className="act-sub">의료 센터</div>
          </div>
        </div>
      </div>

      {/* 객실 타입 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Room Types</div>
          <h2 className="sh">객실 <span className="hl">타입</span></h2>
          <div className="divider"></div>

          <div className="room-grid">
            <div className="room-card">
              <div className="room-card-top deluxe">
                <div className="room-card-icon">🛏️</div>
                <div className="room-card-title">Deluxe</div>
                <div className="room-card-sub">Tower B</div>
              </div>
              <div className="room-card-body">
                <div className="room-meta">
                  <div className="room-meta-row">📐 <strong>면적:</strong> 38㎡</div>
                  <div className="room-meta-row">🏠 <strong>구성:</strong> 침실 + 욕실</div>
                  <div className="room-meta-row">👥 <strong>수용:</strong> 최대 4인</div>
                  <div className="room-meta-row">🏢 <strong>위치:</strong> Tower B</div>
                </div>
              </div>
            </div>

            <div className="room-card">
              <div className="room-card-top premier">
                <div className="room-card-icon">✨</div>
                <div className="room-card-title">Premier</div>
                <div className="room-card-sub">Tower G (신축)</div>
              </div>
              <div className="room-card-body">
                <div className="room-meta">
                  <div className="room-meta-row">📐 <strong>면적:</strong> 32㎡</div>
                  <div className="room-meta-row">🏠 <strong>구성:</strong> 침실 + 욕실 (신축)</div>
                  <div className="room-meta-row">👥 <strong>수용:</strong> 최대 4인</div>
                  <div className="room-meta-row">🏢 <strong>위치:</strong> Tower G</div>
                </div>
              </div>
            </div>

            <div className="room-card">
              <div className="room-card-top suite">
                <div className="room-card-icon">👑</div>
                <div className="room-card-title">Mactan Suite</div>
                <div className="room-card-sub">Tower A, C</div>
              </div>
              <div className="room-card-body">
                <div className="room-meta">
                  <div className="room-meta-row">📐 <strong>면적:</strong> 76㎡</div>
                  <div className="room-meta-row">🏠 <strong>구성:</strong> 침실1 + 거실1 + 욕실1 + 화장실2</div>
                  <div className="room-meta-row">👥 <strong>수용:</strong> 최대 4인</div>
                  <div className="room-meta-row">🏢 <strong>위치:</strong> Tower A, C</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 패키지 포함사항 */}
      <div className="sec fade">
        <div className="stag">Package Included</div>
        <h2 className="sh">패키지 <span className="hl">포함사항</span></h2>
        <div className="divider"></div>

        <div className="pkg-list">
          <div className="pkg-item">
            <div className="pkg-item-icon">🏨</div>
            <div>
              <div className="pkg-item-title">제이파크 리조트 객실 이용</div>
              <div className="pkg-item-desc">워터파크 & 비치 모든 시설 자유이용 (뿌로로파크 제외)</div>
            </div>
          </div>
          <div className="pkg-item">
            <div className="pkg-item-icon">🍽️</div>
            <div>
              <div className="pkg-item-title">리조트 내 레스토랑 30% 할인</div>
              <div className="pkg-item-desc">리조트 내 모든 레스토랑 30% 할인 적용 (논끼 제외)</div>
            </div>
          </div>
          <div className="pkg-item">
            <div className="pkg-item-icon">🥐</div>
            <div>
              <div className="pkg-item-title">아발론 조식 50% 할인</div>
              <div className="pkg-item-desc">보호자 1인 결제 시 6세 미만 아동 무료</div>
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
              <div className="pkg-item-title">공항 픽업 & 드랍 서비스 / 주말 투어 셔틀</div>
              <div className="pkg-item-desc">공항 이동 및 주말 투어 셔틀 서비스 제공</div>
            </div>
          </div>
        </div>
      </div>

      {/* 불포함 사항 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
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
      </div>

      {/* 유료 서비스 */}
      <div className="sec fade">
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
            <tr><td><strong>디럭스</strong></td><td>₩260,000 / 박</td><td>Tower B</td></tr>
            <tr><td><strong>프리미어</strong></td><td>₩300,000 / 박</td><td>Tower G</td></tr>
            <tr><td><strong>막탄스위트</strong></td><td>₩370,000 / 박</td><td>Tower A, C</td></tr>
            <tr><td className="cat" colSpan={3}>기타</td></tr>
            <tr><td><strong>가족 추가 투숙</strong></td><td>1인 1박 무료</td><td>최대 3박 / 식사·셔틀 불가</td></tr>
            <tr><td><strong>비자연장비</strong></td><td>4,060 pesos</td><td>+ 대행수수료 500 pesos</td></tr>
            <tr><td><strong>추가 공항 픽업</strong></td><td>₱1,000</td><td>편도</td></tr>
            <tr><td><strong>추가 공항 드랍</strong></td><td>₱800</td><td>편도</td></tr>
          </tbody>
        </table>
      </div>

      {/* 제휴 할인 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
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
      </div>

      {/* CTA */}
      <div className="sec-white">
        <div className="sec-white-i fade">
          <div className="cta-wrap">
            <h3>제이파크 리조트에서<br/>프리미엄 어학연수를 시작하세요</h3>
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
            <a href="/playdream">플레이드림</a>
            <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기</a>
          </div>
        </div>
        <div className="fcopy">© 2026 Dream Academy by Dream Company. All rights reserved. · Cebu, Philippines</div>
        <div style={{textAlign:"right",maxWidth:1200,margin:"8px auto 0"}}><a href="/admin" style={{fontSize:"20px",color:"#fff",fontWeight:900,textDecoration:"none"}}>관리자</a></div>
      </footer>
    </>
  );
}
