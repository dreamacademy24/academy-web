"use client";
import { useEffect, useState } from "react";

const notices = [
  {
    id: 1,
    category: "important",
    title: "2026년 여름방학 시즌 패키지 조기 마감 안내",
    date: "2026.03.18",
    content:
      "안녕하세요, 드림아카데미입니다.\n\n2026년 여름방학 시즌(7월~8월) 올인원 패키지가 높은 관심 속에 조기 마감될 예정입니다.\n\n■ 마감 예정 숙소\n- 드림하우스: 7월 잔여 1자리\n- 제이파크: 7~8월 전 기간 마감 임박\n- 큐브나인: 8월 잔여 2자리\n\n■ 예약 방법\n카카오톡 채널을 통해 문의해 주시면 빠르게 안내 도와드리겠습니다.\n\n감사합니다.",
  },
  {
    id: 2,
    category: "important",
    title: "드림아카데미 정규수업 시간표 변경 안내",
    date: "2026.03.10",
    content:
      "안녕하세요, 드림아카데미입니다.\n\n2026년 4월 1일부터 정규수업 시간표가 아래와 같이 변경됩니다.\n\n■ 변경 전\n- 오전 수업: 09:00 ~ 12:00\n- 오후 수업: 13:00 ~ 16:00\n\n■ 변경 후\n- 오전 수업: 08:30 ~ 11:30\n- 오후 수업: 13:00 ~ 16:00\n\n■ 적용일: 2026년 4월 1일 (화)\n\n오전 등원 시간이 30분 앞당겨지오니 참고 부탁드립니다.\n셔틀 운행 시간도 함께 변경됩니다.\n\n감사합니다.",
  },
  {
    id: 3,
    category: "general",
    title: "플레이드림 신규 프로그램 오픈 안내",
    date: "2026.03.05",
    content:
      "안녕하세요, 드림아카데미입니다.\n\n플레이드림에 새로운 프로그램이 추가되었습니다!\n\n■ 신규 프로그램\n1. ART & CRAFT 심화반 - 주 3회, 1:1 맞춤 수업\n2. CODING LINE - 스크래치 기반 코딩 영어 수업\n\n■ 운영 시작일: 2026년 3월 17일 (월)\n■ 대상: 초등 1~6학년\n■ 비용: 별도 문의\n\n자세한 내용은 카카오톡으로 문의해 주세요.\n\n감사합니다.",
  },
  {
    id: 4,
    category: "general",
    title: "제이파크 리조트 수영장 정기 점검 안내",
    date: "2026.02.25",
    content:
      "안녕하세요, 드림아카데미입니다.\n\n제이파크 리조트 측에서 수영장 정기 점검이 진행될 예정입니다.\n\n■ 점검 일정: 2026년 3월 3일 (월) ~ 3월 5일 (수)\n■ 점검 대상: Wave Pool, Amazon River\n■ 이용 가능: Island Pool, Beach Pool 등 나머지 수영장은 정상 운영\n\n점검 기간 동안 일부 수영장 이용이 제한되오니 양해 부탁드립니다.\n\n감사합니다.",
  },
  {
    id: 5,
    category: "general",
    title: "2026년 세부 공휴일 휴원 안내",
    date: "2026.02.15",
    content:
      "안녕하세요, 드림아카데미입니다.\n\n2026년 필리핀 공휴일에 따른 드림아카데미 휴원 일정을 안내드립니다.\n\n■ 휴원일\n- 4월 2일 (목) ~ 4월 5일 (일): 성주간 (Holy Week)\n- 5월 1일 (금): 노동절\n- 6월 12일 (금): 독립기념일\n\n■ 참고사항\n- 휴원일에는 셔틀, 도시락 서비스가 운영되지 않습니다.\n- 숙소(드림하우스 헬퍼 서비스)도 휴무입니다.\n\n감사합니다.",
  },
];

export default function NoticePage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

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
          --white:#fff; --off:#f8fafc; --text:#1a1a2e; --muted:#6b7c93;
          --stroke:#e2e8f0; --shadow:0 8px 40px rgba(0,0,0,0.09);
          --shadow-lg:0 20px 60px rgba(26,111,196,0.13);
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

        /* HERO */
        .page-hero{
          padding:120px 60px 56px;
          background:linear-gradient(135deg,var(--blue-light) 0%,#dbeafe 40%,#eaf3fb 100%);
          border-bottom:1px solid var(--stroke);
          text-align:center;
        }
        .page-hero-inner{max-width:900px;margin:0 auto;}
        .page-tag{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:var(--blue);margin-bottom:14px;}
        .page-hero h1{font-size:clamp(30px,4vw,46px);font-weight:800;line-height:1.15;letter-spacing:-0.03em;margin-bottom:12px;}
        .page-hero h1 .hl{color:var(--blue);}
        .page-hero p{font-size:16px;color:var(--muted);line-height:1.7;}

        /* NOTICE LIST */
        .notice-sec{padding:60px 60px 80px;max-width:900px;margin:0 auto;}
        .notice-count{font-size:13px;color:var(--muted);margin-bottom:20px;}
        .notice-count strong{color:var(--text);}
        .notice-list{display:flex;flex-direction:column;gap:0;border-top:2px solid var(--text);}
        .notice-item{border-bottom:1px solid var(--stroke);}
        .notice-header{display:flex;align-items:center;gap:14px;padding:18px 20px;cursor:pointer;background:none;border:none;width:100%;font-family:'Noto Sans KR',sans-serif;text-align:left;transition:background 140ms;}
        .notice-header:hover{background:#f8fafc;}
        .notice-header.open{background:#f0f7ff;}
        .notice-badge{flex-shrink:0;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:0.03em;}
        .notice-badge.important{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}
        .notice-badge.general{background:var(--blue-light);color:var(--blue);border:1px solid #bfdbfe;}
        .notice-title{flex:1;font-size:14.5px;font-weight:600;color:var(--text);line-height:1.4;}
        .notice-date{flex-shrink:0;font-size:12.5px;color:var(--muted);font-family:'Montserrat',sans-serif;}
        .notice-arrow{flex-shrink:0;font-size:12px;color:var(--muted);transition:transform 300ms;}
        .notice-arrow.open{transform:rotate(180deg);}
        .notice-body{max-height:0;overflow:hidden;transition:max-height 400ms ease;}
        .notice-body.open{max-height:800px;}
        .notice-content{padding:20px 24px 28px;margin:0 20px 20px;background:#f8fafc;border-radius:12px;font-size:13.5px;color:var(--muted);line-height:2;white-space:pre-wrap;word-break:keep-all;}

        /* FOOTER */
        footer{background:#1e293b;padding:40px 60px 24px;border-top:1px solid rgba(255,255,255,0.07);}
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
          .page-hero{padding:90px 24px 40px;}
          .notice-sec{padding:40px 24px 60px;}
          .notice-header{padding:16px 12px;gap:10px;flex-wrap:wrap;}
          .notice-date{width:100%;order:3;padding-left:0;margin-top:2px;}
          .notice-content{margin:0 8px 16px;padding:16px 18px;}
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
              <a href="/accommodation/cubenine">큐브나인</a>
            </div>
          </div>
          <a href="/playdream">플레이드림</a>
          <a href="/apply">패키지서비스신청</a>
          <a href="/notice" className="nav-active">공지사항</a>
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
        <a href="/accommodation/cubenine">큐브나인</a>
        <a href="/playdream">플레이드림</a>
        <a href="/apply">패키지서비스신청</a>
        <a href="/notice" style={{ color: "var(--blue)", fontWeight: 700 }}>▶ 공지사항</a>
        <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기 →</a>
      </div>

      {/* HERO */}
      <div className="page-hero">
        <div className="page-hero-inner">
          <div className="page-tag fade">Notice</div>
          <h1 className="fade"><span className="hl">공지사항</span></h1>
          <p className="fade">드림아카데미의 소식과 안내사항을 확인하세요.</p>
        </div>
      </div>

      {/* NOTICE LIST */}
      <div className="notice-sec fade">
        <div className="notice-count">전체 <strong>{notices.length}건</strong></div>
        <div className="notice-list">
          {notices.map((n) => (
            <div className="notice-item" key={n.id}>
              <button
                className={`notice-header${openId === n.id ? " open" : ""}`}
                onClick={() => setOpenId(openId === n.id ? null : n.id)}
              >
                <span className={`notice-badge ${n.category}`}>
                  {n.category === "important" ? "중요" : "일반"}
                </span>
                <span className="notice-title">{n.title}</span>
                <span className="notice-date">{n.date}</span>
                <span className={`notice-arrow${openId === n.id ? " open" : ""}`}>▼</span>
              </button>
              <div className={`notice-body${openId === n.id ? " open" : ""}`}>
                <div className="notice-content">{n.content}</div>
              </div>
            </div>
          ))}
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
            <a href="/notice">공지사항</a>
            <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기</a>
          </div>
        </div>
        <div className="fcopy">© 2026 Dream Academy by Dream Company. All rights reserved. · Cebu, Philippines</div>
      </footer>
    </>
  );
}
