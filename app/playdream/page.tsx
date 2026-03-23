"use client";
import { useEffect, useState } from "react";
export default function PlayDreamPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => {
    const handleScroll = () => { const nav = document.getElementById("mainNav"); if (nav) { nav.style.boxShadow = window.scrollY > 20 ? "0 2px 20px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.08)"; } }; window.addEventListener("scroll", handleScroll); const obs = new IntersectionObserver((entries) => entries.forEach((el) => { if (el.isIntersecting) el.target.classList.add("vis"); }), { threshold: 0.07 }); document.querySelectorAll(".fade").forEach((el) => obs.observe(el)); return () => { window.removeEventListener("scroll", handleScroll); obs.disconnect(); };
  }, []);
  return (
    <>
      <style>{`
        :root { --blue:#1a6fc4; --blue-dark:#0d3d7a; --blue-light:#eaf3fb; --sky:#29a9e0; --yellow:#f5a623; --orange:#FF6B35; --orange-dark:#D4520A; --orange-light:#FFF4ED; --white:#fff; --off:#FFF9F5; --text:#1a1a2e; --muted:#6b7c93; --stroke:#e2e8f0; --shadow:0 8px 40px rgba(0,0,0,0.09); --shadow-lg:0 20px 60px rgba(255,107,53,0.13); --green:#2da84e; }
        *{box-sizing:border-box;margin:0;padding:0;} html{scroll-behavior:smooth;} body{font-family:'Noto Sans KR',sans-serif;color:var(--text);background:var(--white);overflow-x:hidden;} a{text-decoration:none;color:inherit;}
        nav{position:fixed;top:0;left:0;right:0;z-index:300;height:66px;display:flex;align-items:center;padding:0 40px;background:rgba(255,255,255,0.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--stroke);box-shadow:0 1px 3px rgba(0,0,0,0.08);gap:0;}
        .logo{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:800;color:var(--text);flex-shrink:0;margin-right:32px;} .logo .D{color:var(--sky);} .logo .A{color:var(--yellow);}
        .nav-center{display:flex;align-items:center;flex:1;} .nav-center>a,.nav-dd>a{color:#374151;font-size:14px;font-weight:500;padding:0 14px;height:66px;display:flex;align-items:center;gap:4px;transition:color 160ms;white-space:nowrap;} .nav-center>a:hover,.nav-dd>a:hover{color:var(--orange);} .nav-active{color:var(--orange)!important;font-weight:700!important;}
        .nav-dd{position:relative;} .nav-dd-arrow{font-size:10px;transition:transform 200ms;} .nav-dd:hover .nav-dd-arrow{transform:rotate(180deg);} .nav-dd-menu{position:absolute;top:66px;left:0;background:var(--white);min-width:165px;border:1px solid var(--stroke);border-top:2px solid var(--orange);box-shadow:0 8px 24px rgba(0,0,0,0.1);opacity:0;pointer-events:none;transform:translateY(-6px);transition:all 180ms;} .nav-dd:hover .nav-dd-menu{opacity:1;pointer-events:all;transform:translateY(0);} .nav-dd-menu a{display:block;padding:11px 18px;font-size:13.5px;color:#374151;border-bottom:1px solid var(--stroke);transition:background 140ms,color 140ms;} .nav-dd-menu a:last-child{border-bottom:none;} .nav-dd-menu a:hover{background:var(--orange-light);color:var(--orange);}
        .nav-right{display:flex;align-items:center;flex-shrink:0;} .nav-cta{background:var(--orange);color:var(--white);font-size:13.5px;font-weight:600;padding:9px 20px;border-radius:4px;transition:background 160ms;} .nav-cta:hover{background:var(--orange-dark);}
        .hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;} .hamburger span{width:22px;height:2px;background:var(--text);display:block;}
        .mob-nav{display:none;position:fixed;top:66px;left:0;right:0;background:var(--white);z-index:299;padding:16px 24px 24px;flex-direction:column;border-top:1px solid var(--stroke);box-shadow:0 8px 24px rgba(0,0,0,0.1);} .mob-nav.open{display:flex;} .mob-nav a{padding:12px 0;color:#374151;font-size:14px;border-bottom:1px solid var(--stroke);}
        .page-hero{padding:120px 60px 72px;background:linear-gradient(135deg,var(--orange-light) 0%,#FFE0CC 40%,#FFF4ED 100%);border-bottom:1px solid var(--stroke);text-align:center;}
        .page-hero-inner{max-width:900px;margin:0 auto;}
        .page-tag{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:var(--orange);margin-bottom:14px;}
        .page-hero h1{font-size:clamp(34px,5vw,56px);font-weight:800;line-height:1.15;letter-spacing:-0.03em;margin-bottom:16px;} .page-hero h1 .hl{color:var(--orange);}
        .page-hero p{font-size:17px;color:var(--muted);line-height:1.7;margin:0 auto;}
        .hero-badges{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:24px;}
        .hbadge{display:inline-flex;align-items:center;gap:6px;background:var(--white);border:1px solid var(--stroke);padding:8px 16px;border-radius:24px;font-size:13px;font-weight:600;color:var(--text);box-shadow:0 2px 8px rgba(0,0,0,0.06);} .hbadge.orange{background:var(--orange-light);border-color:rgba(255,107,53,0.2);color:var(--orange);}
        .sec{padding:80px 60px;max-width:1200px;margin:0 auto;}
        .sec-bg{background:var(--off);} .sec-bg-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .sec-white{background:var(--white);} .sec-white-i{max-width:1200px;margin:0 auto;padding:80px 60px;}
        .stag{font-family:'Montserrat',sans-serif;font-size:10.5px;font-weight:600;letter-spacing:0.28em;text-transform:uppercase;color:var(--orange);margin-bottom:10px;display:flex;align-items:center;gap:9px;} .stag::before{content:'';width:20px;height:2px;background:var(--orange);border-radius:2px;}
        .sh{font-size:clamp(24px,3vw,38px);font-weight:800;line-height:1.22;letter-spacing:-0.022em;margin-bottom:12px;word-break:keep-all;} .sh .hl{color:var(--orange);}
        .divider{width:40px;height:3px;background:var(--orange);margin:12px 0 22px;border-radius:2px;}
        .prog-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-top:28px;}
        .prog-card{background:var(--white);border:1px solid var(--stroke);border-radius:18px;overflow:hidden;transition:transform 200ms,box-shadow 200ms;} .prog-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-lg);}
        .prog-card-img{width:100%;height:200px;object-fit:cover;display:block;}
        .prog-card-top{padding:20px 24px 14px;position:relative;}
        .prog-card-top.making{background:linear-gradient(135deg,#FFF4ED,#FFE0CC);}
        .prog-card-top.subject{background:linear-gradient(135deg,#eaf3fb,#dbeafe);}
        .prog-card-top.science{background:linear-gradient(135deg,#f0fdf4,#dcfce7);}
        .prog-card-top.allday{background:linear-gradient(135deg,#FFF8E1,#FFF3CD);}
        .prog-card-icon{font-size:32px;margin-bottom:8px;}
        .prog-card-title{font-family:'Montserrat',sans-serif;font-size:16px;font-weight:800;letter-spacing:0.02em;margin-bottom:3px;}
        .prog-card-sub{font-size:12.5px;color:var(--muted);}
        .prog-card-body{padding:16px 24px 22px;}
        .prog-meta{display:flex;flex-direction:column;gap:5px;padding:12px 14px;background:#f8fafc;border-radius:10px;}
        .prog-meta-row{font-size:12.5px;color:var(--muted);display:flex;align-items:flex-start;gap:8px;line-height:1.6;} .prog-meta-row strong{color:var(--text);flex-shrink:0;}
        .prog-badge{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-bottom:8px;} .prog-badge.hot{background:#fef2f2;color:#dc2626;}
        .cta-wrap{background:linear-gradient(135deg,var(--orange-dark),var(--orange));border-radius:16px;padding:48px;text-align:center;}
        .cta-wrap h3{font-size:28px;font-weight:800;color:var(--white);margin-bottom:10px;word-break:keep-all;}
        .cta-wrap p{font-size:14.5px;color:rgba(255,255,255,0.7);margin-bottom:28px;word-break:keep-all;}
        .cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}
        .btn-white{background:var(--white);color:var(--orange-dark);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:transform 150ms,box-shadow 150ms;box-shadow:0 4px 16px rgba(0,0,0,0.15);} .btn-white:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,0,0,0.2);}
        .btn-outline-w{border:1.5px solid rgba(255,255,255,0.35);color:rgba(255,255,255,0.85);font-family:'Montserrat',sans-serif;font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:14px 28px;border-radius:4px;transition:border-color 160ms,color 160ms;} .btn-outline-w:hover{border-color:var(--white);color:var(--white);}
        footer{background:#3D1F00;padding:40px 60px 24px;border-top:1px solid rgba(255,255,255,0.07);}
        .footer-inner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px;}
        .flogo{font-family:'Montserrat',sans-serif;font-size:18px;font-weight:800;color:var(--white);} .flogo .D{color:#5dc8f0;} .flogo .A{color:var(--yellow);}
        .flinks{display:flex;gap:20px;flex-wrap:wrap;} .flinks a{font-size:13px;color:rgba(255,255,255,0.45);transition:color 150ms;} .flinks a:hover{color:rgba(255,255,255,0.85);}
        .fcopy{font-size:11.5px;color:rgba(255,255,255,0.2);font-family:'Montserrat',sans-serif;margin-top:16px;max-width:1200px;margin-left:auto;margin-right:auto;}
        .fade{opacity:0;transform:translateY(20px);transition:opacity 600ms ease,transform 600ms ease;} .fade.vis{opacity:1;transform:translateY(0);}
        @media(max-width:1024px){
          nav{padding:0 24px;} .nav-center,.nav-right{display:none;} .hamburger{display:flex;}
          .page-hero{padding:90px 24px 48px;} .sec{padding:56px 24px;} .sec-bg-i,.sec-white-i{padding:56px 24px;}
          .prog-grid{grid-template-columns:1fr;} .facility-resp{grid-template-columns:1fr!important;}
          .footer-inner{flex-direction:column;align-items:flex-start;}
        }
      `}</style>

      <nav id="mainNav">
        <a href="/" className="logo"><span className="D">D</span>ream<span className="A">A</span>cademy</a>
        <div className="nav-center">
          <div className="nav-dd"><a href="#">커리큘럼 <span className="nav-dd-arrow">▾</span></a><div className="nav-dd-menu"><a href="/junior">주니어 커리큘럼</a><a href="/kinder">킨더 커리큘럼</a></div></div>
          <a href="/package">올인원패키지</a>
          <div className="nav-dd"><a href="#">숙소 <span className="nav-dd-arrow">▾</span></a><div className="nav-dd-menu"><a href="/accommodation/dreamhouse">드림하우스 (독채)</a><a href="/accommodation/jpark">제이파크</a><a href="/accommodation/cubenine">큐브나인</a></div></div>
          <a href="/playdream" className="nav-active">플레이드림</a>
          <a href="/apply">패키지서비스신청</a>
          <a href="/notice">공지사항</a>
          <a href="/community">커뮤니티</a>
        </div>
        <div className="nav-right">
          <a href="/login" style={{color:"#374151",fontSize:"13.5px",fontWeight:600,marginRight:"10px"}}>로그인</a>
          <a href="http://pf.kakao.com/_Yuhxhn/chat" className="nav-cta" target="_blank" rel="noopener noreferrer">상담하기</a>
        </div>
        <button className="hamburger" onClick={() => setMobileNavOpen((v) => !v)}><span></span><span></span><span></span></button>
      </nav>

      <div className={`mob-nav${mobileNavOpen ? " open" : ""}`}>
        <a href="/junior">주니어 커리큘럼</a><a href="/kinder">킨더 커리큘럼</a><a href="/package">올인원패키지</a>
        <a href="/accommodation/dreamhouse">드림하우스 (독채)</a><a href="/accommodation/jpark">제이파크</a><a href="/accommodation/cubenine">큐브나인</a>
        <a href="/playdream" style={{color:"var(--orange)",fontWeight:700}}>▶ 플레이드림</a>
        <a href="/apply">패키지서비스신청</a><a href="/notice">공지사항</a><a href="/community">커뮤니티</a>
        <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기 →</a>
      </div>

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

      <div className="sec fade">
        <div className="stag">Daily Class</div>
        <h2 className="sh">플레이드림 <span className="hl">프로그램</span></h2>
        <div className="divider"></div>
        <div className="prog-grid">

          <div className="prog-card">
            <img src="/images/playdream_1.jpg" alt="Making Line" className="prog-card-img"/>
            <div className="prog-card-top making">
              <div className="prog-card-icon">🎨</div>
              <div className="prog-card-title">MAKING LINE (110분)</div>
              <div className="prog-card-sub">쿠킹 또는 아트 중 선택 · 만들기 중심 체험 수업</div>
            </div>
            <div className="prog-card-body">
              <div className="prog-meta">
                <div className="prog-meta-row">📋 <strong>수업방식:</strong> <span>1:1 / 1:2 / 1:3 / 2:5 선택 가능<br/>4세 미만 → 1:1만 가능<br/>일행이 없는 경우 1:1 수업으로 신청</span></div>
                <div className="prog-meta-row" style={{marginTop:6}}>💰 <strong>수업금액:</strong> <span>1:1 → 1,200페소<br/>1:2 → 950페소<br/>1:3 → 800페소<br/>2:5 → 860페소</span></div>
              </div>
            </div>
          </div>

          <div className="prog-card">
            <img src="/images/playdream_2.jpg" alt="Subject Line" className="prog-card-img"/>
            <div className="prog-card-top subject">
              <div className="prog-card-icon">📚</div>
              <div className="prog-card-title">SUBJECT LINE (110분)</div>
              <div className="prog-card-sub">영어 통합 테마 수업 · 영어 + 사고력 + 표현력 중심</div>
            </div>
            <div className="prog-card-body">
              <div className="prog-meta">
                <div className="prog-meta-row">📋 <strong>수업방식:</strong> <span>1:1 only / 레벨별 수업 진행</span></div>
                <div className="prog-meta-row" style={{marginTop:6}}>💰 <strong>수업금액:</strong> <span>950페소</span></div>
              </div>
            </div>
          </div>

          <div className="prog-card">
            <img src="/images/playdream_3.jpg" alt="Science Line" className="prog-card-img"/>
            <div className="prog-card-top science">
              <div className="prog-card-icon">🔬</div>
              <div className="prog-card-title">SCIENCE LINE (110분)</div>
              <div className="prog-card-sub">영어 + 과학 + 만들기 · 과학 원리 + 실험 + 제작 활동</div>
            </div>
            <div className="prog-card-body">
              <div className="prog-meta">
                <div className="prog-meta-row">📋 <strong>수업방식:</strong> <span>1:1 only / 만들기 종류별 추가비용 있음</span></div>
                <div className="prog-meta-row" style={{marginTop:6}}>💰 <strong>수업금액:</strong> <span>1,200페소</span></div>
              </div>
            </div>
          </div>

          <div className="prog-card">
            <img src="/images/playdream_4.jpg" alt="All Day Program" className="prog-card-img"/>
            <div className="prog-card-top allday">
              <div className="prog-badge hot">🔥 BEST</div>
              <div className="prog-card-icon">⭐</div>
              <div className="prog-card-title">ALL DAY PROGRAM</div>
              <div className="prog-card-sub">9:30am – 3:00pm · 수업 + 만들기 + 활동 + 놀이</div>
            </div>
            <div className="prog-card-body">
              <div className="prog-meta">
                <div className="prog-meta-row">📋 <strong>수업방식:</strong> <span>1:1 + 그룹 혼합 / 테마별 프로그램 진행</span></div>
                <div className="prog-meta-row" style={{marginTop:6}}>💰 <strong>수업금액:</strong> <span>2,800페소</span></div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="sec-bg">
        <div className="sec-bg-i fade">
          <div className="stag">Play Dream</div>
          <h2 className="sh">세부 최초 <span className="hl">영어놀이센터</span></h2>
          <div className="divider"></div>
          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:18,padding:"32px 36px"}}>
            <div style={{display:"inline-block",background:"#FFF4ED",color:"#FF6B35",fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:20,border:"1px solid rgba(255,107,53,0.2)",marginBottom:16}}>수업 전 과정 영어 진행</div>
            <div style={{fontSize:22,fontWeight:800,marginBottom:12}}>PlayDream의 수업은 전 과정 영어로 진행됩니다.</div>
            <p style={{fontSize:14,color:"#6b7c93",lineHeight:1.9}}>단순한 영어 노출이 아닌, 아이들의 이해도와 참여도를 고려해 활동 중심으로 구성되어 있습니다.<br/>쿠킹·아트·과학·스토리 활동을 통해 아이들이 자연스럽게 영어를 듣고 말하는 환경을 만듭니다.</p>
          </div>
        </div>
      </div>

      <div className="sec-white">
        <div className="sec-white-i fade">
          <div className="stag">Facilities</div>
          <h2 className="sh">수업 및 <span className="hl">시설안내</span></h2>
          <div className="divider"></div>
          <div className="facility-resp" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:24,marginTop:28}}>
            <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:18,overflow:"hidden"}}>
              <div style={{display:"flex",gap:2}}>
                <img src="/images/playdream_5.png" alt="" style={{width:"33.33%",aspectRatio:"1",objectFit:"cover"}}/>
                <img src="/images/playdream_6.png" alt="" style={{width:"33.33%",aspectRatio:"1",objectFit:"cover"}}/>
                <img src="/images/playdream_7.png" alt="" style={{width:"33.33%",aspectRatio:"1",objectFit:"cover"}}/>
              </div>
              <div style={{padding:"20px 22px 24px"}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:800,marginBottom:10}}>Cooking / <span style={{color:"#FF6B35"}}>Activity Zone</span></div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",gap:7}}><span style={{color:"#FF6B35",fontWeight:700,flexShrink:0}}>·</span>실제 베이킹 도구로 반죽부터 완성까지, 아이들이 직접 참여하는 수업입니다.</div>
                  <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",gap:7}}><span style={{color:"#FF6B35",fontWeight:700,flexShrink:0}}>·</span>재료부터 과정까지 영어로 표현하며, 자연스럽게 영어 표현력을 배웁니다.</div>
                  <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",gap:7}}><span style={{color:"#FF6B35",fontWeight:700,flexShrink:0}}>·</span>메인 수업 후 연결된 활동(메모리게임, 페이퍼아트, 보드게임 등)으로 배운 내용을 놀이처럼 확장합니다.</div>
                </div>
              </div>
            </div>
            <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:18,overflow:"hidden"}}>
              <div style={{display:"flex",gap:2}}>
                <img src="/images/playdream_8.png" alt="" style={{width:"33.33%",aspectRatio:"1",objectFit:"cover"}}/>
                <img src="/images/playdream_9.png" alt="" style={{width:"33.33%",aspectRatio:"1",objectFit:"cover"}}/>
                <img src="/images/playdream_10.png" alt="" style={{width:"33.33%",aspectRatio:"1",objectFit:"cover"}}/>
              </div>
              <div style={{padding:"20px 22px 24px"}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:800,marginBottom:10}}>Making / <span style={{color:"#FF6B35"}}>Activity Zone</span></div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",gap:7}}><span style={{color:"#FF6B35",fontWeight:700,flexShrink:0}}>·</span>다양한 재료로 표현하고 만드는 아트 활동을 통해 창의력과 표현력을 키워줍니다.</div>
                  <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",gap:7}}><span style={{color:"#FF6B35",fontWeight:700,flexShrink:0}}>·</span>메인 수업 후 연결된 활동(메모리게임, 페이퍼아트, 보드게임 등)으로 배운 내용을 놀이처럼 확장합니다.</div>
                </div>
              </div>
            </div>
            <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:18,overflow:"hidden"}}>
              <div style={{display:"flex",gap:2}}>
                <img src="/images/playdream_11.png" alt="" style={{width:"33.33%",aspectRatio:"1",objectFit:"cover"}}/>
                <img src="/images/playdream_12.png" alt="" style={{width:"33.33%",aspectRatio:"1",objectFit:"cover"}}/>
                <img src="/images/playdream_13.png" alt="" style={{width:"33.33%",aspectRatio:"1",objectFit:"cover"}}/>
              </div>
              <div style={{padding:"20px 22px 24px"}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:15,fontWeight:800,marginBottom:10}}>Science / <span style={{color:"#FF6B35"}}>Study Zone</span></div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",gap:7}}><span style={{color:"#FF6B35",fontWeight:700,flexShrink:0}}>·</span>아이의 관심과 수준에 맞춘 수업으로 몰입도 높은 영어 학습</div>
                  <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",gap:7}}><span style={{color:"#FF6B35",fontWeight:700,flexShrink:0}}>·</span>만들기 활동과 함께, 과학 원리를 영어로 배워보는 수업</div>
                  <div style={{fontSize:13,color:"#6b7c93",lineHeight:1.7,display:"flex",gap:7}}><span style={{color:"#FF6B35",fontWeight:700,flexShrink:0}}>·</span>연결된 활동으로 배운 내용을 페이퍼 아트, 컬러링, 3D 만들기 등으로 놀이처럼 확장하는 미니 프로젝트 수업</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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

      <footer>
        <div className="footer-inner">
          <span className="flogo"><span className="D">D</span>ream<span className="A">A</span>cademy</span>
          <div className="flinks">
            <a href="/">홈</a><a href="/junior">주니어 커리큘럼</a><a href="/kinder">킨더 커리큘럼</a>
            <a href="/package">올인원패키지</a><a href="/playdream">플레이드림</a>
            <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기</a>
          </div>
        </div>
        <div className="fcopy">© 2026 Dream Academy by Dream Company. All rights reserved. · Cebu, Philippines</div>
        <div style={{textAlign:"right",maxWidth:1200,margin:"8px auto 0"}}><a href="/admin" style={{fontSize:"20px",color:"#fff",fontWeight:900,textDecoration:"none"}}>관리자</a></div>
      </footer>
    </>
  );
}
