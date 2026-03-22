import type { Metadata } from "next";
import "./globals.css";
import SWRegister from "./sw-register";

export const metadata: Metadata = {
  title: "드림아카데미 | 필리핀 세부 프리미엄 영어캠프",
  description: "필리핀 세부 프리미엄 영어캠프 드림아카데미 | UCLA 출신 원장·올인원 케어·주니어·킨더 커리큘럼 | 여권만 챙기세요!",
  openGraph: {
    title: "드림아카데미 | 필리핀 세부 프리미엄 영어캠프",
    description: "필리핀 세부 프리미엄 영어캠프 드림아카데미 | UCLA 출신 원장·올인원 케어·주니어·킨더 커리큘럼 | 여권만 챙기세요!",
    images: ["/images/academymain.jpg"],
  },
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
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
      <body><SWRegister />{children}</body>
    </html>
  );
}
