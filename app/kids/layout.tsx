import type { Metadata, Viewport } from "next";
import "./kids.css";

export const metadata: Metadata = {
  title: "드림 키즈 · 영어 모험",
  description: "세부 드림아카데미 아이들을 위한 게이미피케이션 영어 학습 앱 (프로토타입)",
  manifest: "/manifest-kids.webmanifest",
  appleWebApp: { capable: true, title: "드림 키즈", statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, themeColor: "#F7F4EA" };

export default function KidsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
