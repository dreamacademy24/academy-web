import type { Metadata, Viewport } from "next";
import "./globals.css";
import SWRegister from "./sw-register";
import InstallPrompt from "@/components/InstallPrompt";

const SITE = "https://www.dreamacademyph.com";
const TITLE = "드림아카데미 | 필리핀 세부 프리미엄 영어캠프";
const DESC = "필리핀 세부 프리미엄 영어캠프 드림아카데미 | UCLA 출신 원장·올인원 케어·주니어·킨더 커리큘럼 | 여권만 챙기세요!";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s" },
  description: DESC,
  alternates: { canonical: SITE },
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "드림아카데미",
    locale: "ko_KR",
    url: SITE,
    title: TITLE,
    description: DESC,
    images: [{ url: "/images/academymain.jpg", width: 1200, height: 900, alt: "드림아카데미 캠퍼스" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/images/academymain.jpg"] },
  robots: { index: true, follow: true },
};

// 검색엔진 구조화 데이터 (JSON-LD)
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "드림아카데미 (Dream Academy)",
  alternateName: "Cebu Dream Academy",
  url: SITE,
  logo: `${SITE}/logo.png`,
  image: `${SITE}/images/academymain.jpg`,
  description: DESC,
  address: { "@type": "PostalAddress", addressLocality: "Lapu-Lapu City, Mactan", addressRegion: "Cebu", addressCountry: "PH", streetAddress: "Bayswater" },
  areaServed: ["KR", "PH"],
  sameAs: ["http://pf.kakao.com/_Yuhxhn"],
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
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        <SWRegister /><InstallPrompt />{children}
      </body>
    </html>
  );
}
