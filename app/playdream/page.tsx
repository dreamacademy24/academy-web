"use client";
import { useEffect, useState } from "react";

export default function PlayDreamPage() {
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

        /* PROGRAM CARDS */
        .prog-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-top:28px;}
        .prog-card{background:var(--white);border:1px solid var(--stroke);border-radius:18px;overflow:hidden;transition:transform 200ms,box-shadow 200ms;}
        .prog-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .prog-card-top{padding:24px 24px 18px;position:relative;}
        .prog-card-top.making{background:linear-gradient(135deg,#FFF4ED,#FFE0CC);}
        .prog-card-top.subject{background:linear-gradient(135deg,#eaf3fb,#dbeafe);}
        .prog-card-top.science{background:linear-gradient(135deg,#f0fdf4,#dcfce7);}
        .prog-card-top.allday{background:linear-gradient(135deg,#FFF8E1,#FFF3CD);}
        .prog-card-icon{font-size:36px;margin-bottom:10px;}
        .prog-card-title{font-family:'Montserrat',sans-serif;font-size:16px;font-weight:800;letter-spacing:0.02em;margin-bottom:4px;}
        .prog-card-sub{font-size:12.5px;color:var(--muted);}
        .prog-card-body{padding:18px 24px 24px;}
        .prog-card-desc{font-size:13px;color:var(--muted);line-height:1.75;margin-bottom:14px;word-break:keep-all;}
        .prog-meta{display:flex;flex-direction:column;gap:6px;padding:14px 16px;background:#f8fafc;border-radius:10px;}
        .prog-meta-row{font-size:12.5px;color:var(--muted);display:flex;align-items:center;gap:8px;}
        .prog-meta-row strong{color:var(--text);}
        .prog-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-bottom:10px;}
        .prog-badge.hot{background:#fef2f2;color:#dc2626;}
        .prog-badge.new{background:#dbeafe;color:#1d4ed8;}

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
        .tutor-item::before{content:'·';color:var(--orange);font-weight:700;flex-shrink:0;}
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
          .prog-grid{grid-template-columns:1fr;}
          .tutor-grid{grid-template-columns:1fr;}
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
            <a href="#">숙소 <span className="nav-dd-arrow">▾</span></a>
            <div className="nav-dd-menu">
              <a href="/accommodation/dreamhouse">드림하우스 (독채)</a>
              <a href="/accommodation/jpark">제이파크</a>
              <a href="#">큐브나인</a>
            </div>
          </div>
          <a href="/playdream" className="nav-active">플레이드림</a>
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
        <a href="/accommodation/dreamhouse">드림하우스 (독채)</a>
        <a href="/accommodation/jpark">제이파크</a>
        <a href="#">큐브나인</a>
        <a href="/playdream" style={{ color: "var(--orange)", fontWeight: 700 }}>▶ 플레이드림</a>
        <a href="/apply">패키지서비스신청</a>
        <a href="#">커뮤니티</a>
        <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기 →</a>
      </div>

      {/* HERO */}
      <div className="page-hero">
        <div className="page-hero-inner">
          <div className="page-tag fade">Play Dream</div>
          <h1 className="fade">PLAY DREAM <span className="hl">DAILY CLASS</span></h1>
          <p className="fade">세부 현지에서 즐기는 특별한 하루!<br/>아이들의 흥미와 발달에 맞춘 다양한 프로그램</p>
          <div className="hero-badges fade">
            <div className="hbadge">🎨 Making</div>
            <div className="hbadge">📚 Subject</div>
            <div className="hbadge">🔬 Science</div>
            <div className="hbadge orange">⭐ All Day</div>
          </div>
        </div>
      </div>

      {/* 프로그램 카드 */}
      <div className="sec fade">
        <div className="stag">Daily Class</div>
        <h2 className="sh">플레이드림 <span className="hl">프로그램</span></h2>
        <div className="divider"></div>

        <div className="prog-grid">
          {/* MAKING LINE */}
          <div className="prog-card">
            <div className="prog-card-top making">
              <div className="prog-card-icon">🎨</div>
              <div className="prog-card-title">MAKING LINE</div>
              <div className="prog-card-sub">요리 / 만들기 / 공예</div>
            </div>
            <div className="prog-card-body">
              <p className="prog-card-desc">요리, 만들기, 공예 등 핸즈온 활동을 통해 창의력과 영어를 동시에 키웁니다.</p>
              <div className="prog-meta">
                <div className="prog-meta-row">💰 <strong>비용:</strong> 1:1 ₱200 / 1:2 ₱160</div>
                <div className="prog-meta-row">🕐 <strong>운영:</strong> 월~토 / 50분</div>
              </div>
            </div>
          </div>

          {/* SUBJECT LINE */}
          <div className="prog-card">
            <div className="prog-card-top subject">
              <div className="prog-card-icon">📚</div>
              <div className="prog-card-title">SUBJECT LINE</div>
              <div className="prog-card-sub">영어 / 수학 등 교과 학습</div>
            </div>
            <div className="prog-card-body">
              <p className="prog-card-desc">영어, 수학 등 교과 중심 학습으로 기초 실력을 탄탄하게 다집니다.</p>
              <div className="prog-meta">
                <div className="prog-meta-row">📅 <strong>운영:</strong> 주 1회 1타임</div>
                <div className="prog-meta-row">🕐 <strong>시간:</strong> 월~토 / 50분</div>
              </div>
            </div>
          </div>

          {/* SCIENCE LINE */}
          <div className="prog-card">
            <div className="prog-card-top science">
              <div className="prog-card-icon">🔬</div>
              <div className="prog-card-title">SCIENCE LINE</div>
              <div className="prog-card-sub">과학 실험 탐구</div>
            </div>
            <div className="prog-card-body">
              <p className="prog-card-desc">직접 실험하고 탐구하며 과학적 사고력과 영어 표현력을 함께 키웁니다.</p>
              <div className="prog-meta">
                <div className="prog-meta-row">💰 <strong>비용:</strong> 1:1 ₱200</div>
                <div className="prog-meta-row">🕐 <strong>운영:</strong> 월~토 / 50분</div>
              </div>
            </div>
          </div>

          {/* ALL DAY PROGRAM */}
          <div className="prog-card">
            <div className="prog-card-top allday">
              <div className="prog-badge hot">🔥 BEST</div>
              <div className="prog-card-icon">⭐</div>
              <div className="prog-card-title">ALL DAY PROGRAM</div>
              <div className="prog-card-sub">풀패키지 식사 포함</div>
            </div>
            <div className="prog-card-body">
              <p className="prog-card-desc">오전부터 오후까지 하루 종일! 수업, 활동, 식사가 모두 포함된 올데이 프로그램입니다.</p>
              <div className="prog-meta">
                <div className="prog-meta-row">💰 <strong>비용:</strong> ₱2,830</div>
                <div className="prog-meta-row">🕐 <strong>운영:</strong> 월~토 / 오전 9시 ~ 오후 6시</div>
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
                <div className="tutor-item">정규 수업 복습 및 미완료 내용 이어서 진행 <strong>(별도 교재 수업 불가)</strong></div>
                <div className="tutor-item">킨더라인은 색종이, 보드게임 등 <strong>놀이식 수업 가능</strong></div>
                <div className="tutor-item">개별 피드백 미제공</div>
                <div className="tutor-meta">
                  <div className="tutor-meta-row">🕐 <strong>운영:</strong> 월~금 / 50분 / 마지막 수업 17:50 / 최대 2타임</div>
                  <div className="tutor-meta-row">💰 <strong>비용:</strong> 1:1 ₱300 / 1:2 ₱350</div>
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
                <div className="tutor-item">외출 불가 / 기본 자료 티처 준비 / 별도 교재 <strong>개별 지참</strong> / 개별 피드백 미제공</div>
                <div className="tutor-item">어린 아이는 색종이, 보드게임, 플래시카드 추천</div>
                <div className="tutor-meta">
                  <div className="tutor-meta-row">🕐 <strong>운영:</strong> 월~토 / 50분 / 오전 10시~오후 8시 / 최대 2타임</div>
                  <div className="tutor-meta-row">💰 <strong>비용:</strong> 1:1 ₱300 / 1:2 ₱350</div>
                  <div className="tutor-meta-row">💳 <strong>결제:</strong> 수업 확정 후 전액 선결제 필수</div>
                </div>
              </div>
            </div>
          </div>

          <div className="tutor-warn">
            <div className="tutor-warn-title">⚠️ 튜터 변경 및 환불규정</div>
            <div className="tutor-warn-list">
              <div className="tutor-warn-item"><strong>최소 2주 전</strong> 예약 필수 / 성수기 3주 전</div>
              <div className="tutor-warn-item">변경은 <strong>수업일 4일 전까지</strong> / 장소 변경 불가</div>
            </div>
            <div style={{ marginTop: "12px", fontWeight: 700 }}>아래 경우 변경 및 환불 불가:</div>
            <div className="tutor-warn-list">
              <div className="tutor-warn-item">당일 취소 및 일정 변경</div>
              <div className="tutor-warn-item">수업 시작 후 학생 거부로 인한 취소</div>
              <div className="tutor-warn-item">수업 3일 전 이내 취소</div>
              <div className="tutor-warn-item">당일 2회 이상 변경</div>
            </div>
            <div className="tutor-warn-danger">⚠️ 당일 노쇼(무단 결석) 시 모든 수업 자동 취소, 환불 불가, 이후 수업 재신청도 불가</div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="sec-white">
        <div className="sec-white-i fade">
          <div className="cta-wrap">
            <h3>플레이드림과 함께<br/>세부에서 특별한 하루를 시작하세요</h3>
            <p>프로그램 문의 및 예약은 카카오톡으로 편하게 연락주세요.</p>
            <div className="cta-btns">
              <a href="http://pf.kakao.com/_PFMJb/chat" target="_blank" rel="noopener noreferrer" className="btn-white">카카오톡 문의하기 →</a>
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
            <a href="/playdream">플레이드림</a>
            <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기</a>
          </div>
        </div>
        <div className="fcopy">© 2026 Dream Academy by Dream Company. All rights reserved. · Cebu, Philippines</div>
      </footer>
    </>
  );
}
