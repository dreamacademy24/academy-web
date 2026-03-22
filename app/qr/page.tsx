"use client";
import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

const URL = "https://www.dreamacademyph.com";

export default function QRPage() {
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  function handleDownload() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "dreamacademy-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <style>{`
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Noto Sans KR',sans-serif;background:#fff;color:#1a1a2e;}
.qr-wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;text-align:center;}
.qr-logo{height:60px;width:auto;margin-bottom:32px;}
.qr-box{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;box-shadow:0 8px 40px rgba(0,0,0,0.08);display:inline-block;margin-bottom:24px;}
.qr-url{font-family:'Montserrat',sans-serif;font-size:16px;font-weight:700;color:#1a6fc4;margin-bottom:6px;}
.qr-hint{font-size:13px;color:#6b7c93;margin-bottom:24px;}
.qr-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:28px;}
.qr-btn{padding:12px 24px;font-size:14px;font-weight:700;border-radius:8px;border:none;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:all 160ms;}
.qr-btn-primary{background:#1a6fc4;color:#fff;}
.qr-btn-primary:hover{background:#0d3d7a;}
.qr-btn-outline{background:#fff;color:#1a6fc4;border:2px solid #1a6fc4;}
.qr-btn-outline:hover{background:#eaf3fb;}
.qr-btn-done{background:#059669;color:#fff;border:2px solid #059669;}
.qr-footer{font-size:12px;color:#94a3b8;line-height:1.6;max-width:360px;}
      `}</style>

      <div className="qr-wrap">
        <img src="/logo.png" alt="드림아카데미" className="qr-logo" />

        <div className="qr-box" ref={qrRef}>
          <QRCodeCanvas
            value={URL}
            size={256}
            level="H"
            imageSettings={{ src: "/logo.png", height: 50, width: 50, excavate: true }}
          />
        </div>

        <div className="qr-url">www.dreamacademyph.com</div>
        <div className="qr-hint">카메라로 스캔하면 바로 접속됩니다</div>

        <div className="qr-btns">
          <button className="qr-btn qr-btn-primary" onClick={handleDownload}>📥 QR코드 저장하기</button>
          <button className={`qr-btn ${copied ? "qr-btn-done" : "qr-btn-outline"}`} onClick={handleCopy}>
            {copied ? "✅ 복사됐어요!" : "🔗 링크 복사하기"}
          </button>
        </div>

        <p className="qr-footer">이 QR코드를 저장해서 카카오톡, 인스타그램,<br/>안내문에 사용하세요</p>
      </div>
    </>
  );
}
