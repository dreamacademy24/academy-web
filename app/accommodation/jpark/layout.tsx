import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "제이파크 아일랜드 리조트 | 드림아카데미",
  description: "5성급 제이파크 리조트에서 머무는 드림아카데미 영어캠프 — 워터파크·5개 수영장·한국인 매니저·조식 할인.",
  alternates: { canonical: "https://www.dreamacademyph.com/accommodation/jpark" },
  openGraph: { title: "제이파크 아일랜드 리조트 | 드림아카데미", description: "5성급 제이파크 리조트에서 머무는 드림아카데미 영어캠프 — 워터파크·5개 수영장·한국인 매니저·조식 할인.", url: "https://www.dreamacademyph.com/accommodation/jpark" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
