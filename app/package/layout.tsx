import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "올인원 패키지 안내 | 드림아카데미",
  description: "숙소·평일 3식·정규 수업·투어 셔틀·공항 픽드랍·헬퍼 서비스·화상영어까지 하나로. 세부 드림아카데미 올인원 영어캠프 패키지 포함 사항과 숙소별 안내.",
  alternates: { canonical: "https://www.dreamacademyph.com/package" },
  openGraph: { title: "올인원 패키지 안내 | 드림아카데미", description: "숙소·평일 3식·정규 수업·투어 셔틀·공항 픽드랍·헬퍼 서비스·화상영어까지 하나로. 세부 드림아카데미 올인원 영어캠프 패키지 포함 사항과 숙소별 안내.", url: "https://www.dreamacademyph.com/package" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
