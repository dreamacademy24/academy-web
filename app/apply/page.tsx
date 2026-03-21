import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "드림아카데미 신청서",
  description: "드림아카데미 신청서 — 서비스 선택",
};

export default function ApplyPage() {
  return (
    <>
      <style>{`
        :root {
          --bg: #fbfaf7;
          --card: #ffffff;
          --text: #1f1f1f;
          --muted: #8f8f8f;
          --shadow: 0 18px 40px rgba(17, 24, 39, 0.08);
          --stroke: rgba(17, 24, 39, 0.06);
          --focus: rgba(59, 130, 246, 0.35);
        }
        .apply-wrap { min-height: 100vh; display: grid; place-items: center; padding: 40px 18px 24px; background: radial-gradient(1200px 700px at 50% 10%, #ffffff 0%, var(--bg) 55%, #f8f6f1 100%); color: var(--text); }
        .apply-screen { width: min(860px, 100%); display: grid; gap: 26px; justify-items: center; }
        .apply-title { text-align: center; margin-top: 6px; }
        .apply-title h1 { margin: 0; font-size: clamp(28px, 4vw, 44px); letter-spacing: -0.02em; font-weight: 800; }
        .apply-title p { margin: 12px 0 0; color: var(--muted); font-size: clamp(14px, 2vw, 16px); letter-spacing: -0.01em; }
        .apply-cards { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; margin-top: 6px; }
        .apply-card {
          position: relative; display: grid; justify-items: center; align-content: center;
          gap: 10px; padding: 36px 22px 30px; background: var(--card); border-radius: 22px;
          box-shadow: var(--shadow); border: 1px solid var(--stroke); text-decoration: none;
          color: inherit; transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
          min-height: 210px;
        }
        .apply-card::after {
          content: ""; position: absolute; inset: 0; border-radius: 22px;
          background: radial-gradient(500px 260px at 50% 0%, rgba(0,0,0,0.03), transparent 55%);
          opacity: 0; transition: opacity 160ms ease; pointer-events: none;
        }
        .apply-card:hover { transform: translateY(-2px); box-shadow: 0 22px 50px rgba(17,24,39,0.11); border-color: rgba(17,24,39,0.1); }
        .apply-card:hover::after { opacity: 1; }
        .apply-card:active { transform: translateY(0px); }
        .apply-card:focus-visible { outline: none; box-shadow: 0 22px 50px rgba(17,24,39,0.11), 0 0 0 4px var(--focus); }
        .apply-icon { width: 74px; height: 74px; display: grid; place-items: center; }
        .apply-card h2 { margin: 2px 0 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
        .apply-card p { margin: 0; text-align: center; color: var(--muted); line-height: 1.45; letter-spacing: -0.01em; font-size: 14px; }
        .apply-skip {
          margin-top: 8px; text-decoration: none; color: #b7b7b7; font-weight: 600;
          letter-spacing: -0.01em; padding: 10px 14px; border-radius: 999px;
          transition: color 120ms ease, background 120ms ease; display: inline-block;
        }
        .apply-skip:hover { color: #8d8d8d; background: rgba(17,24,39,0.04); }
        .apply-skip:focus-visible { outline: none; box-shadow: 0 0 0 4px var(--focus); }
        @media (max-width: 900px) {
          .apply-cards { grid-template-columns: 1fr !important; max-width: 420px; margin-inline: auto; }
          .apply-card { min-height: 190px; }
        }
      `}</style>

      <main className="apply-wrap">
        <section className="apply-screen" aria-label="드림아카데미 신청서 메인">
          <header className="apply-title">
            <h1>드림아카데미 패키지 서비스 신청</h1>
            <p>원하시는 서비스를 선택해 주세요.</p>
          </header>

          <div className="apply-cards" role="list" style={{gridTemplateColumns:"repeat(3,minmax(0,1fr))"}}>
            <Link className="apply-card" href="/apply/package" role="listitem" aria-label="패키지 신청으로 이동">
              <div className="apply-icon" aria-hidden="true">
                <svg width="74" height="74" viewBox="0 0 74 74" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="12" y="20" width="50" height="34" rx="8" fill="#DBEAFE"/>
                  <rect x="18" y="26" width="38" height="6" rx="3" fill="#93C5FD"/>
                  <rect x="18" y="36" width="24" height="4" rx="2" fill="#BFDBFE"/>
                  <rect x="18" y="44" width="30" height="4" rx="2" fill="#BFDBFE"/>
                  <circle cx="52" cy="42" r="8" fill="#1A6FC4"/>
                  <path d="M49 42h6M52 39v6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h2>패키지 신청</h2>
              <p>올인원 패키지 상담 신청</p>
            </Link>

            <Link className="apply-card" href="/shuttle" role="listitem" aria-label="투어셔틀신청으로 이동">
              <div className="apply-icon" aria-hidden="true">
                <svg width="74" height="74" viewBox="0 0 74 74" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="14" y="18" width="46" height="30" rx="10" fill="#FFD64D" />
                  <rect x="18" y="22" width="16" height="10" rx="3" fill="#FFF2C2" />
                  <rect x="36" y="22" width="8" height="10" rx="3" fill="#FFF2C2" />
                  <rect x="46" y="22" width="10" height="10" rx="3" fill="#FFF2C2" />
                  <rect x="14" y="34" width="46" height="4" rx="2" fill="#F2B400" opacity="0.9" />
                  <rect x="22" y="18" width="6" height="4" rx="2" fill="#F2B400" opacity="0.9" />
                  <rect x="30" y="18" width="6" height="4" rx="2" fill="#F2B400" opacity="0.9" />
                  <circle cx="26" cy="50" r="6.5" fill="#2D2D2D" />
                  <circle cx="26" cy="50" r="3.2" fill="#8B8B8B" />
                  <circle cx="50" cy="50" r="6.5" fill="#2D2D2D" />
                  <circle cx="50" cy="50" r="3.2" fill="#8B8B8B" />
                  <path d="M16 30c0-4.418 3.582-8 8-8h20" stroke="#F2B400" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
                  <circle cx="18.5" cy="38.5" r="2" fill="#FF7A00" />
                </svg>
              </div>
              <h2>투어셔틀신청</h2>
              <p>안전하고 편안한 이동 서비스</p>
            </Link>

            <Link className="apply-card" href="/after-school-fieldtrip" role="listitem" aria-label="애프터 스쿨 & 필드트립으로 이동">
              <div className="apply-icon" aria-hidden="true">
                <svg width="74" height="74" viewBox="0 0 74 74" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="37" cy="37" r="30" fill="#EAF7EC" />
                  <path d="M18 52c5-9 12-14 19-14s14 5 19 14" stroke="#2E7D32" strokeWidth="3.2" strokeLinecap="round" />
                  <path d="M25 45c2.8-4.8 6.7-7.4 12-7.4S46.2 40.2 49 45" stroke="#43A047" strokeWidth="3.2" strokeLinecap="round" opacity="0.9" />
                  <circle cx="29" cy="31" r="5.3" fill="#FFCC80" />
                  <circle cx="44.5" cy="30" r="4.8" fill="#FFB74D" />
                  <path d="M26 26c2.2-2.7 5.3-4.2 8.6-4.2 3.8 0 7.2 2 9.2 5" stroke="#66BB6A" strokeWidth="3.2" strokeLinecap="round" />
                  <path d="M52 46V33" stroke="#7B5B3A" strokeWidth="4.2" strokeLinecap="round" />
                  <path d="M52 21c5 3.2 7.5 7.1 7.5 11.7 0 5.7-3.9 10.6-10.9 13.7" stroke="#2E7D32" strokeWidth="4.2" strokeLinecap="round" />
                  <path d="M52 21c-4.7 3.3-7 7.2-7 11.7 0 5.6 3.7 10.6 10.6 13.8" stroke="#43A047" strokeWidth="4.2" strokeLinecap="round" opacity="0.9" />
                </svg>
              </div>
              <h2>애프터 스쿨 &amp; 필드트립</h2>
              <p>다양한 체험과 즐거운 야외 활동</p>
            </Link>
          </div>

          <Link className="apply-skip" href="/" aria-label="건너뛰기">건너뛰기</Link>
        </section>
      </main>
    </>
  );
}
