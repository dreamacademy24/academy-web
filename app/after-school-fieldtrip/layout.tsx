import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "애프터스쿨 · 필드트립 | 드림아카데미",
  description: "세부 드림아카데미 방과후 수업과 주말 현장학습 안내 및 신청.",
  alternates: { canonical: "https://www.dreamacademyph.com/after-school-fieldtrip" },
  openGraph: { title: "애프터스쿨 · 필드트립 | 드림아카데미", description: "세부 드림아카데미 방과후 수업과 주말 현장학습 안내 및 신청.", url: "https://www.dreamacademyph.com/after-school-fieldtrip" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
