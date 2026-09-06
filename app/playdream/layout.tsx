import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "플레이드림 (PlayDream) | 드림아카데미",
  description: "드림아카데미 연계 키즈 프로그램 PlayDream 안내.",
  alternates: { canonical: "https://www.dreamacademyph.com/playdream" },
  openGraph: { title: "플레이드림 (PlayDream) | 드림아카데미", description: "드림아카데미 연계 키즈 프로그램 PlayDream 안내.", url: "https://www.dreamacademyph.com/playdream" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
