import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "투어 셔틀 신청 | 드림아카데미",
  description: "드림아카데미 패키지 고객 무료 투어 셔틀 — H마트·SM씨사이드·쉬라인·파롤라·사파리·안조월드.",
  alternates: { canonical: "https://www.dreamacademyph.com/shuttle" },
  openGraph: { title: "투어 셔틀 신청 | 드림아카데미", description: "드림아카데미 패키지 고객 무료 투어 셔틀 — H마트·SM씨사이드·쉬라인·파롤라·사파리·안조월드.", url: "https://www.dreamacademyph.com/shuttle" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
