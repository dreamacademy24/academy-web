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
        <a href="/accommodation/dreamhouse" style={{ color: "var(--orange)", fontWeight: 700 }}>▶ 드림하우스 (독채)</a>
        <a href="/accommodation/jpark">제이파크</a>
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

      {/* 객실 갤러리 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Gallery</div>
          <h2 className="sh">객실 <span className="hl">사진</span></h2>
          <div className="divider"></div>
          <div style={{display:"flex",flexDirection:"column",gap:32}}>

            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#FF6B35",marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span>🏠</span> 외관</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
                <img src="/images/dh-exterior.jpg" alt="외관" style={{width:"100%",aspectRatio:"16/7",objectFit:"cover",objectPosition:"center",borderRadius:14}}/>
              </div>
            </div>

            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#FF6B35",marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span>🛋️</span> 거실</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                <img src="/images/dh-living1.jpg" alt="거실+주방 전체" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>
                <img src="/images/dh-living2.jpg" alt="거실" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>
                <img src="/images/dh-living3.jpg" alt="거실+소파" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>
              </div>
            </div>

            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#FF6B35",marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span>🛏️</span> 방 3개</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                <img src="/images/dh-room1.jpg" alt="침실1" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>
                <img src="/images/dreamhouse_Room-1.jpg" alt="침실2" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>
                <img src="/images/dreamhouseroom-11.jpg" alt="침실3" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>
              </div>
            </div>

            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#FF6B35",marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span>🍳</span> 주방</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                <img src="/images/Dreamhouse_room-12_.png" alt="주방전체" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>
                <img src="/images/dreamhouse_Room-4.jpg" alt="주방싱크" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>
                <img src="/images/dreamhouse_Room-2.jpg" alt="가전" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>
              </div>
            </div>

            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#FF6B35",marginBottom:10,display:"flex",alignItems:"center",gap:6}}><span>🚿</span> 욕실 2개</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                <img src="/images/dreamhouseroom-10.jpg" alt="욕실1" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>
                <img src="/images/dreamhouseroom22.png" alt="샤워기" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>
                <img src="/images/dreamhouse25.png" alt="욕실2" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:12}}/>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 부대시설 */}
      <div className="sec fade">
        <div className="stag">Facilities</div>
        <h2 className="sh">베이스워터 <span className="hl">부대시설</span></h2>
        <div className="divider"></div>
        <p className="sp">드림하우스가 위치한 베이스워터 빌리지에서는 다양한 부대시설을 자유롭게 이용하실 수 있습니다.</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:16,marginBottom:8}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#FFF4ED",border:"1px solid rgba(255,107,53,0.2)",color:"#FF6B35",fontSize:13,fontWeight:600,padding:"6px 14px",borderRadius:20}}>🏡 독채 하우스</span>
          <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#f0f7ff",border:"1px solid #bfdbfe",color:"#1a6fc4",fontSize:13,fontWeight:600,padding:"6px 14px",borderRadius:20}}>🛏️ 방 3개</span>
          <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#f0f7ff",border:"1px solid #bfdbfe",color:"#1a6fc4",fontSize:13,fontWeight:600,padding:"6px 14px",borderRadius:20}}>🚿 욕실 2개</span>
          <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#f0fdf4",border:"1px solid #a7f3d0",color:"#059669",fontSize:13,fontWeight:600,padding:"6px 14px",borderRadius:20}}>🛋️ 거실</span>
          <span style={{display:"inline-flex",alignItems:"center",gap:6,background:"#f0fdf4",border:"1px solid #a7f3d0",color:"#059669",fontSize:13,fontWeight:600,padding:"6px 14px",borderRadius:20}}>🌿 뒷마당</span>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20,marginTop:28}}>

          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,overflow:"hidden"}}>
            <img src="/images/bayswater002.jpg" alt="수영장" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}}/>
            <div style={{padding:"16px 18px 20px"}}>
              <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>🏊 수영장</div>
              <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",flexDirection:"column",gap:4}}>
                <span>· 이용시간 8:00am – 6:00pm</span>
                <span>· 수영복·수영모 착용 필수</span>
                <span>· 입수 전 샤워 필수</span>
                <span>· 어린이는 반드시 보호자 동반</span>
                <span>· 음식물 반입 및 음주 금지</span>
              </div>
            </div>
          </div>

          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,overflow:"hidden"}}>
            <img src="/images/bayswater008.png" alt="농구 코트" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}}/>
            <div style={{padding:"16px 18px 20px"}}>
              <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>🏀 농구 코트</div>
              <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",flexDirection:"column",gap:4}}>
                <span>· 이용시간 8:00am – 10:00pm</span>
                <span>· 예약된 시간대 외 자유롭게 이용</span>
                <span>· 6pm 이후 전기세·단독사용 추가비용 800페소</span>
              </div>
            </div>
          </div>

          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,overflow:"hidden"}}>
            <img src="/images/bayswater007.jpg" alt="테니스장" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}}/>
            <div style={{padding:"16px 18px 20px"}}>
              <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>🎾 테니스장</div>
              <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",flexDirection:"column",gap:4}}>
                <span>· 이용시간 7am – 8pm</span>
                <span>· 베이스워터 오피스에서 직접 신청</span>
                <span>· 한 시간 단위로 예약 가능</span>
                <span>· 우천시 사용 불가</span>
              </div>
            </div>
          </div>

          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,overflow:"hidden"}}>
            <img src="/images/bayswater004.jpg" alt="놀이터" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}}/>
            <div style={{padding:"16px 18px 20px"}}>
              <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>🛝 놀이터</div>
              <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",flexDirection:"column",gap:4}}>
                <span>· 이용시간 8:00am – 6:00pm</span>
                <span>· 수영장 옆 위치</span>
              </div>
            </div>
          </div>

          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,overflow:"hidden"}}>
            <img src="/images/bayswater006.jpg" alt="미니마트" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}}/>
            <div style={{padding:"16px 18px 20px"}}>
              <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>🛒 미니마트</div>
              <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",flexDirection:"column",gap:4}}>
                <span>· 이용시간 6:00am – 10:00pm</span>
                <span>· 카드 결제 가능</span>
                <span>· 쌀·계란·유제품·생필품·육류·생선 등 판매</span>
              </div>
            </div>
          </div>

          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,overflow:"hidden"}}>
            <img src="/images/bayswater003.jpg" alt="카페" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",display:"block"}}/>
            <div style={{padding:"16px 18px 20px"}}>
              <div style={{fontWeight:800,fontSize:15,marginBottom:8}}>☕ 카페 (Lin's Coffee Shop)</div>
              <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",flexDirection:"column",gap:4}}>
                <span>· 수~월 7am–7pm / 화 7am–10am</span>
                <span>· 미니마트 바로 뒷편</span>
                <span>· 크로아상·와플·쿠키·쉐이크</span>
                <span>· 커피·밀크티·아이스크림 등</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 위치 */}
      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Location</div>
          <h2 className="sh">위치 <span className="hl">안내</span> <span style={{fontSize:"0.5em",fontWeight:500,color:"#6b7c93"}}>(베이스워터 빌리지)</span></h2>
          <div className="divider"></div>
          <p className="sp">베이스워터 빌리지에 위치한 드림하우스는 막탄의 중심부에 있어 주요 시설과 가까워 편리한 생활이 가능합니다.</p>

          <div className="loc-grid" style={{marginBottom:24}}>
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
          <div style={{borderRadius:16,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}}>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3925.5!2d123.9768965!3d10.2814273!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a9914ae28abc99%3A0xf2ab256eefb4c6b4!2sBayswater%20Subdivision%20Lapu-Lapu%20City!5e0!3m2!1sko!2sph!4v1"
              width="100%"
              height="400"
              style={{border:0,display:"block"}}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
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
        <div style={{textAlign:"right",maxWidth:1200,margin:"8px auto 0"}}><a href="/admin" style={{fontSize:"20px",color:"#fff",fontWeight:900,textDecoration:"none"}}>관리자</a></div>
      </footer>
    </>
  );
}
