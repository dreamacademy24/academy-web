import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "신청 완료 — 드림아카데미 튜터",
};

export default function TutorApplySuccess() {
  return (
    <>
      <style>{`
.ok-w{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#eff6ff,#f5f3ff);padding:24px 16px}
.ok-box{background:#fff;border-radius:20px;padding:36px 28px;max-width:440px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,0.08);text-align:center}
.ok-icon{width:72px;height:72px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:50%;font-size:36px;color:#fff}
.ok-ttl{font-size:22px;font-weight:800;color:#1a1a2e;margin-bottom:10px}
.ok-sub{font-size:14px;color:#475569;line-height:1.7;margin-bottom:24px}
.ok-note{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:#475569;line-height:1.6;text-align:left}
.ok-note b{color:#1a1a2e}
.ok-row{display:flex;gap:8px;flex-direction:column}
.ok-btn{padding:13px 18px;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;border:none;text-decoration:none;display:block;text-align:center}
.ok-btn-primary{background:linear-gradient(135deg,#1a6fc4,#7c3aed);color:#fff}
.ok-btn-kakao{background:#fee500;color:#1a1a1a}
.ok-btn-ghost{background:#fff;color:#475569;border:1px solid #e2e8f0}
.ok-btn:hover{opacity:0.92}
      `}</style>
      <main className="ok-w">
        <div className="ok-box">
          <div className="ok-icon" aria-hidden="true">✓</div>
          <h1 className="ok-ttl">신청이 완료되었습니다</h1>
          <p className="ok-sub">
            담당자가 신청 내용을 확인한 후<br />
            카카오톡 또는 등록하신 연락처로 안내드리겠습니다.
          </p>
          <div className="ok-note">
            <b>안내</b><br />
            · 배정까지 평균 1~2일 소요됩니다 (성수기 3일)<br />
            · 최소 2주 전 신청을 권장드립니다<br />
            · 문의는 아래 카카오톡 채널로 연락 주세요
          </div>
          <div className="ok-row">
            <a
              className="ok-btn ok-btn-kakao"
              href="http://pf.kakao.com/_pxcvxgM"
              target="_blank"
              rel="noopener noreferrer"
            >
              카카오톡 드림아카데미 채널 문의
            </a>
            <Link href="/" className="ok-btn ok-btn-primary">홈으로 돌아가기</Link>
            <Link href="/tutor-apply" className="ok-btn ok-btn-ghost">다른 자녀 추가 신청</Link>
          </div>
        </div>
      </main>
    </>
  );
}
