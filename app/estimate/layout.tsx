import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "견적 내보기 | 드림아카데미",
  description: "숙소·기간·인원을 고르면 세부 드림아카데미 영어캠프 예상 비용을 바로 확인할 수 있어요.",
  alternates: { canonical: "https://www.dreamacademyph.com/estimate" },
  openGraph: { title: "견적 내보기 | 드림아카데미", description: "숙소·기간·인원을 고르면 세부 드림아카데미 영어캠프 예상 비용을 바로 확인할 수 있어요.", url: "https://www.dreamacademyph.com/estimate" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
