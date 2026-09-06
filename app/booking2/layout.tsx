import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "비패키지 예약 접수 | 드림아카데미",
  description: "세부 드림아카데미 자유 일정(비패키지) 예약 신청 폼.",
  alternates: { canonical: "https://www.dreamacademyph.com/booking2" },
  openGraph: { title: "비패키지 예약 접수 | 드림아카데미", description: "세부 드림아카데미 자유 일정(비패키지) 예약 신청 폼.", url: "https://www.dreamacademyph.com/booking2" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
