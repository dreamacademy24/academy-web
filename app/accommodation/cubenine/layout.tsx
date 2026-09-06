import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "큐브나인 리조트 & 스파 | 드림아카데미",
  description: "오션뷰 프라이빗 리조트 큐브나인에서 머무는 드림아카데미 영어캠프 — 바다 액티비티·스파 할인.",
  alternates: { canonical: "https://www.dreamacademyph.com/accommodation/cubenine" },
  openGraph: { title: "큐브나인 리조트 & 스파 | 드림아카데미", description: "오션뷰 프라이빗 리조트 큐브나인에서 머무는 드림아카데미 영어캠프 — 바다 액티비티·스파 할인.", url: "https://www.dreamacademyph.com/accommodation/cubenine" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
