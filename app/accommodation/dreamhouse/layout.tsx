import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "드림하우스 (프라이빗 독채) | 드림아카데미",
  description: "베이스워터 빌리지 3룸 독채, 주 6일 헬퍼 서비스, 수영장·관리센터. 세부 드림아카데미 가족 영어캠프 숙소 드림하우스 안내.",
  alternates: { canonical: "https://www.dreamacademyph.com/accommodation/dreamhouse" },
  openGraph: { title: "드림하우스 (프라이빗 독채) | 드림아카데미", description: "베이스워터 빌리지 3룸 독채, 주 6일 헬퍼 서비스, 수영장·관리센터. 세부 드림아카데미 가족 영어캠프 숙소 드림하우스 안내.", url: "https://www.dreamacademyph.com/accommodation/dreamhouse" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
