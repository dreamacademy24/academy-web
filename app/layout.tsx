import type { Metadata, Viewport } from "next";
import "./globals.css";
import SWRegister from "./sw-register";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata: Metadata = {
  title: "드림아카데미 | 필리핀 세부 프리미엄 영어캠프",
  description: "필리핀 세부 프리미엄 영어캠프 드림아카데미 | UCLA 출신 원장·올인원 케어·주니어·킨더 커리큘럼 | 여권만 챙기세요!",
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "드림아카데미 | 필리핀 세부 프리미엄 영어캠프",
    description: "필리핀 세부 프리미엄 영어캠프 드림아카데미 | UCLA 출신 원장·올인원 케어·주니어·킨더 커리큘럼 | 여권만 챙기세요!",
    images: ["/images/academymain.jpg"],
  },
};

// 모바일 반응형 — 폰에서 화면 실제 너비에 맞춰 렌더 (없으면 데스크탑 980px로 축소돼 보임)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1a6fc4" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body><SWRegister /><InstallPrompt />{children}</body>
    </html>
  );
}
