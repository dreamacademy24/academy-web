"use client";
import { useEffect, useState } from "react";

type Env = "kakao-android" | "kakao-ios" | "android" | "ios" | "other";

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [env, setEnv] = useState<Env>("other");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if ((navigator as any).standalone) return;

    const ua = navigator.userAgent;
    const isKakao = /KAKAOTALK/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/i.test(ua);

    if (isKakao && isIOS) setEnv("kakao-ios");
    else if (isKakao && isAndroid) setEnv("kakao-android");
    else if (isKakao) setEnv("kakao-android");
    else if (isIOS) setEnv("ios");
    else if (isAndroid) setEnv("android");
    else setEnv("android");

    setShow(true);

    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShow(false);
  }

  if (!show) return null;

  const isKakao = env === "kakao-android" || env === "kakao-ios";
  const showInstallBtn = env === "android" && deferredPrompt && !isKakao;

  return (
    <>
      <style>{`
.ip-bar{position:fixed;top:66px;left:0;right:0;z-index:298;background:#1a6fc4;color:#fff;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;font-family:'Noto Sans KR',sans-serif;}
.ip-text{display:flex;align-items:center;gap:6px;font-weight:500;}
.ip-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.ip-btn{padding:6px 16px;background:#fff;color:#1a6fc4;font-size:12px;font-weight:700;border:none;border-radius:6px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;white-space:nowrap;}
.ip-btn:hover{background:#e8f4fd;}
.ip-x{background:none;border:none;color:rgba(255,255,255,0.7);font-size:18px;cursor:pointer;padding:0 4px;line-height:1;}
.ip-x:hover{color:#fff;}
.ip-overlay{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;}
.ip-modal{background:#fff;border-radius:16px 16px 0 0;padding:28px 24px 32px;width:100%;max-width:420px;color:#1a1a2e;font-family:'Noto Sans KR',sans-serif;animation:ip-up 300ms ease;}
@keyframes ip-up{from{transform:translateY(100%)}to{transform:translateY(0)}}
.ip-modal h3{font-size:18px;font-weight:800;margin-bottom:20px;text-align:center;}
.ip-step{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px;font-size:14px;line-height:1.7;}
.ip-num{width:28px;height:28px;border-radius:50%;background:#1a6fc4;color:#fff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ip-close{width:100%;padding:12px;background:#f1f5f9;color:#1a1a2e;font-size:14px;font-weight:600;border:none;border-radius:8px;cursor:pointer;margin-top:8px;font-family:'Noto Sans KR',sans-serif;}
.ip-close:hover{background:#e2e8f0;}
@media(max-width:1024px){.ip-bar{top:56px;}}
      `}</style>

      <div className="ip-bar">
        <span className="ip-text">📲 홈화면에 추가하고 앱처럼 사용하세요!</span>
        <div className="ip-right">
          {showInstallBtn ? (
            <button className="ip-btn" onClick={handleInstall}>설치하기</button>
          ) : (
            <button className="ip-btn" onClick={() => setShowModal(true)}>설치방법 보기</button>
          )}
          <button className="ip-x" onClick={() => setShow(false)}>✕</button>
        </div>
      </div>

      {showModal && (
        <div className="ip-overlay" onClick={() => setShowModal(false)}>
          <div className="ip-modal" onClick={(e) => e.stopPropagation()}>

            {env === "kakao-android" && (<>
              <h3>카카오톡에서 홈화면 추가</h3>
              <div className="ip-step"><span className="ip-num">1</span><span>우측 하단 <strong>⋮ 버튼</strong>을 클릭하세요.</span></div>
              <div className="ip-step"><span className="ip-num">2</span><span><strong>다른 브라우저로 열기</strong> 또는 <strong>크롬으로 열기</strong>를 선택하세요.</span></div>
              <div className="ip-step"><span className="ip-num">3</span><span>크롬에서 우측 상단 <strong>⋮ 메뉴</strong> → <strong>홈 화면에 추가</strong>를 클릭하세요.</span></div>
            </>)}

            {env === "kakao-ios" && (<>
              <h3>카카오톡에서 홈화면 추가</h3>
              <div className="ip-step"><span className="ip-num">1</span><span>우측 하단 <strong>⋮ 버튼</strong>을 클릭하세요.</span></div>
              <div className="ip-step"><span className="ip-num">2</span><span><strong>Safari로 열기</strong>를 선택하세요.</span></div>
              <div className="ip-step"><span className="ip-num">3</span><span>하단 <strong>공유(📤) 버튼</strong> → <strong>홈 화면에 추가</strong>를 클릭하세요.</span></div>
            </>)}

            {env === "ios" && (<>
              <h3>홈 화면에 추가하기</h3>
              <div className="ip-step"><span className="ip-num">1</span><span>하단 <strong>공유 버튼(📤)</strong>을 클릭하세요.</span></div>
              <div className="ip-step"><span className="ip-num">2</span><span><strong>홈 화면에 추가</strong>를 선택하세요.</span></div>
              <div className="ip-step"><span className="ip-num">3</span><span>오른쪽 상단 <strong>추가</strong> 버튼을 클릭하세요.</span></div>
            </>)}

            {(env === "android" || env === "other") && (<>
              <h3>홈 화면에 추가하기</h3>
              <div className="ip-step"><span className="ip-num">1</span><span>브라우저 우측 상단 <strong>⋮ 메뉴</strong>를 클릭하세요.</span></div>
              <div className="ip-step"><span className="ip-num">2</span><span><strong>홈 화면에 추가</strong> 또는 <strong>앱 설치</strong>를 선택하세요.</span></div>
              <div className="ip-step"><span className="ip-num">3</span><span><strong>설치</strong> 또는 <strong>추가</strong> 버튼을 클릭하세요.</span></div>
            </>)}

            <button className="ip-close" onClick={() => setShowModal(false)}>닫기</button>
          </div>
        </div>
      )}
    </>
  );
}
