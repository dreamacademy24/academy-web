"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

type Tab = "android" | "ios" | "pc";

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [tab, setTab] = useState<Tab>("android");

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/i.test(ua);
    if (isIOS) setTab("ios");
    else if (isAndroid) setTab("android");
    else setTab("pc");

    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone) {
      setInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const installedHandler = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  }

  return (
    <div className="wrap">
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,sans-serif;}
        .wrap{min-height:100vh;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 16px;font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,sans-serif;color:#1a1a2e;}
        .container{max-width:520px;margin:0 auto;}
        .header{text-align:center;color:#fff;margin-bottom:28px;}
        .logo-wrap{width:96px;height:96px;margin:0 auto 16px;background:#fff;border-radius:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,0.2);overflow:hidden;}
        .logo-wrap img{width:72px;height:72px;object-fit:contain;}
        .title{font-size:26px;font-weight:800;letter-spacing:-0.5px;margin-bottom:6px;}
        .subtitle{font-size:14px;opacity:0.9;font-weight:400;}
        .card{background:#fff;border-radius:18px;padding:24px 20px;margin-bottom:16px;box-shadow:0 8px 24px rgba(0,0,0,0.08);}
        .auto-card{text-align:center;}
        .auto-card h2{font-size:16px;font-weight:700;margin-bottom:8px;color:#1a1a2e;}
        .auto-card p{font-size:13px;color:#64748b;margin-bottom:16px;line-height:1.6;}
        .install-btn{width:100%;padding:16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;transition:transform 0.15s,box-shadow 0.15s;box-shadow:0 4px 12px rgba(102,126,234,0.35);}
        .install-btn:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(102,126,234,0.45);}
        .install-btn:active{transform:translateY(0);}
        .install-btn:disabled{background:#cbd5e1;cursor:not-allowed;box-shadow:none;transform:none;}
        .installed-badge{padding:14px;background:#d1fae5;color:#065f46;border-radius:12px;font-weight:600;font-size:14px;}
        .no-auto{padding:14px;background:#f1f5f9;color:#64748b;border-radius:12px;font-size:13px;line-height:1.6;}
        .section-title{font-size:15px;font-weight:700;margin-bottom:12px;color:#1a1a2e;}
        .tabs{display:flex;gap:6px;margin-bottom:18px;background:#f1f5f9;padding:4px;border-radius:10px;}
        .tab{flex:1;padding:10px 4px;border:none;background:transparent;color:#64748b;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;font-family:inherit;transition:all 0.15s;}
        .tab.active{background:#fff;color:#667eea;box-shadow:0 2px 6px rgba(0,0,0,0.06);}
        .steps{display:flex;flex-direction:column;gap:14px;}
        .step{display:flex;gap:12px;align-items:flex-start;}
        .step-num{flex-shrink:0;width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;}
        .step-text{flex:1;font-size:14px;line-height:1.65;color:#334155;padding-top:4px;}
        .step-text strong{color:#1a1a2e;font-weight:700;}
        .step-icon{display:inline-block;padding:2px 8px;background:#eef2ff;color:#667eea;border-radius:6px;font-weight:700;margin:0 2px;font-size:13px;}
        .footer{text-align:center;margin-top:24px;}
        .footer-link{display:inline-block;padding:12px 24px;background:rgba(255,255,255,0.15);color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:600;border:1px solid rgba(255,255,255,0.3);transition:background 0.15s;}
        .footer-link:hover{background:rgba(255,255,255,0.25);}
        @media(max-width:480px){
          .wrap{padding:24px 12px;}
          .title{font-size:22px;}
          .card{padding:20px 16px;}
        }
      `}</style>

      <div className="container">
        <div className="header">
          <div className="logo-wrap">
            <Image src="/logo.png" alt="드림아카데미" width={72} height={72} priority />
          </div>
          <h1 className="title">앱 설치하기</h1>
          <p className="subtitle">드림아카데미를 홈 화면에 추가하고 앱처럼 사용하세요</p>
        </div>

        <div className="card auto-card">
          <h2>📲 빠른 설치</h2>
          <p>브라우저에서 지원하는 경우 아래 버튼으로 바로 설치할 수 있어요.</p>
          {installed ? (
            <div className="installed-badge">✅ 이미 설치되어 있습니다</div>
          ) : deferredPrompt ? (
            <button className="install-btn" onClick={handleInstall}>
              📲 앱 설치하기
            </button>
          ) : (
            <div className="no-auto">
              자동 설치를 지원하지 않는 브라우저예요.<br />아래 안내를 따라 수동으로 설치해 주세요.
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-title">수동 설치 안내</div>
          <div className="tabs">
            <button className={`tab ${tab === "android" ? "active" : ""}`} onClick={() => setTab("android")}>📱 안드로이드</button>
            <button className={`tab ${tab === "ios" ? "active" : ""}`} onClick={() => setTab("ios")}>🍎 아이폰</button>
            <button className={`tab ${tab === "pc" ? "active" : ""}`} onClick={() => setTab("pc")}>💻 PC</button>
          </div>

          {tab === "android" && (
            <div className="steps">
              <div className="step"><span className="step-num">1</span><span className="step-text"><strong>크롬 브라우저</strong>에서 dreamacademyph.com 접속</span></div>
              <div className="step"><span className="step-num">2</span><span className="step-text">우측 상단 <span className="step-icon">⋮</span> 메뉴 버튼을 누르세요</span></div>
              <div className="step"><span className="step-num">3</span><span className="step-text"><strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong> 선택</span></div>
              <div className="step"><span className="step-num">4</span><span className="step-text"><strong>설치</strong> 버튼을 눌러 완료하세요</span></div>
            </div>
          )}

          {tab === "ios" && (
            <div className="steps">
              <div className="step"><span className="step-num">1</span><span className="step-text"><strong>Safari 브라우저</strong>에서 dreamacademyph.com 접속</span></div>
              <div className="step"><span className="step-num">2</span><span className="step-text">하단 <span className="step-icon">􀈂</span> 공유 버튼을 누르세요</span></div>
              <div className="step"><span className="step-num">3</span><span className="step-text">목록에서 <strong>홈 화면에 추가</strong>를 선택</span></div>
              <div className="step"><span className="step-num">4</span><span className="step-text">우측 상단 <strong>추가</strong> 버튼을 눌러 완료하세요</span></div>
            </div>
          )}

          {tab === "pc" && (
            <div className="steps">
              <div className="step"><span className="step-num">1</span><span className="step-text"><strong>크롬</strong> 또는 <strong>엣지</strong> 브라우저에서 dreamacademyph.com 접속</span></div>
              <div className="step"><span className="step-num">2</span><span className="step-text">주소창 오른쪽 끝의 <span className="step-icon">⊕</span> 설치 아이콘 클릭</span></div>
              <div className="step"><span className="step-num">3</span><span className="step-text">팝업에서 <strong>설치</strong> 버튼 클릭</span></div>
              <div className="step"><span className="step-num">4</span><span className="step-text">바탕화면 또는 시작메뉴에서 실행할 수 있어요</span></div>
            </div>
          )}
        </div>

        <div className="footer">
          <a href="https://dreamacademyph.com" className="footer-link">설치 없이 바로 사용하기 →</a>
        </div>
      </div>
    </div>
  );
}
