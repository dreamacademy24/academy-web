import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "올인원 패키지 예약 접수 | 드림아카데미",
  description: "세부 드림아카데미 올인원 영어캠프 예약 신청 폼.",
  alternates: { canonical: "https://www.dreamacademyph.com/booking" },
  openGraph: { title: "올인원 패키지 예약 접수 | 드림아카데미", description: "세부 드림아카데미 올인원 영어캠프 예약 신청 폼.", url: "https://www.dreamacademyph.com/booking" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
