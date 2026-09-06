// 공개 페이지 공통 푸터 (단일 소스). 클래스 sf- 접두사 — 페이지 인라인 CSS와 충돌 없음
import { KAKAO_CHAT_URL } from "./SiteNav";

const CSS = `
.sf{background:#0d3d7a;padding:54px 60px 30px;border-top:1px solid rgba(255,255,255,0.07);font-family:'Noto Sans KR',sans-serif;color:#fff}
.sf-grid{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:34px}
.sf-logo{font-family:'Montserrat',sans-serif;font-size:18px;font-weight:800;color:#fff;margin-bottom:12px;display:block}
.sf-logo .D{color:#5dc8f0}.sf-logo .A{color:#f5a623}
.sf-desc{font-size:12.5px;color:rgba(255,255,255,0.35);line-height:1.9;word-break:keep-all;margin:0}
.sf-sns{display:flex;gap:14px;margin-top:14px}
.sf-sns a{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:14px;transition:background 160ms}
.sf-sns a:hover{background:rgba(255,255,255,0.2)}
.sf-title{font-family:'Montserrat',sans-serif;font-size:9.5px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.45);margin-bottom:14px}
.sf-links{display:flex;flex-direction:column;gap:8px}
.sf-links a{font-size:13px;color:rgba(255,255,255,0.45);transition:color 150ms}
.sf-links a:hover{color:rgba(255,255,255,0.85)}
.sf-bottom{max-width:1200px;margin:0 auto;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;font-size:11.5px;color:rgba(255,255,255,0.22);font-family:'Montserrat',sans-serif}
.sf-admin{text-align:right;max-width:1200px;margin:8px auto 0}
.sf-admin a{font-size:12px;color:rgba(255,255,255,0.35);font-weight:600}
@media(max-width:1024px){.sf-grid{grid-template-columns:1fr 1fr;gap:28px}.sf-bottom{flex-direction:column;gap:6px}}
@media(max-width:768px){.sf{padding:40px 24px 80px}}
@media(max-width:480px){.sf-grid{grid-template-columns:1fr;gap:24px}}
`;

const COLS: { title: string; links: { label: string; href: string; ext?: boolean }[] }[] = [
  { title: "커리큘럼", links: [
    { label: "주니어 커리큘럼", href: "/junior" },
    { label: "킨더 커리큘럼", href: "/kinder" },
    { label: "플레이드림", href: "/playdream" },
    { label: "애프터스쿨 · 필드트립", href: "/after-school-fieldtrip" },
  ]},
  { title: "숙소 · 패키지", links: [
    { label: "드림하우스 (독채)", href: "/accommodation/dreamhouse" },
    { label: "제이파크", href: "/accommodation/jpark" },
    { label: "큐브나인", href: "/accommodation/cubenine" },
    { label: "올인원 패키지 안내", href: "/package" },
    { label: "견적 내보기", href: "/estimate" },
  ]},
  { title: "서비스", links: [
    { label: "투어 셔틀 신청", href: "/shuttle" },
    { label: "마이페이지", href: "/portal/dashboard" },
    { label: "결제", href: "/products" },
    { label: "공지사항", href: "/notice" },
    { label: "커뮤니티", href: "/community" },
    { label: "카카오톡 상담", href: KAKAO_CHAT_URL, ext: true },
  ]},
];

export default function SiteFooter() {
  return (
    <>
      <style>{CSS}</style>
      <footer className="sf">
        <div className="sf-grid">
          <div>
            <span className="sf-logo"><span className="D">D</span>ream<span className="A">A</span>cademy</span>
            <p className="sf-desc">필리핀 세부의 프리미엄 영어 교육 프로그램.<br />숙소, 수업, 식사, 활동까지 올인원 케어.</p>
            <div className="sf-sns">
              <a href={KAKAO_CHAT_URL} target="_blank" rel="noopener noreferrer" aria-label="KakaoTalk" title="카카오톡 상담">💬</a>
            </div>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <div className="sf-title">{c.title}</div>
              <div className="sf-links">
                {c.links.map((l) => l.ext
                  ? <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
                  : <a key={l.href} href={l.href}>{l.label}</a>)}
              </div>
            </div>
          ))}
        </div>
        <div className="sf-bottom">
          <span>© {new Date().getFullYear()} Dream Academy by Dream Company. All rights reserved.</span>
          <span>Bayswater, Mactan · Cebu, Philippines</span>
        </div>
        <div className="sf-admin"><a href="/admin">관리자</a></div>
      </footer>
    </>
  );
}
