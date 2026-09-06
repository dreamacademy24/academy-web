import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "킨더 커리큘럼 (만 3세~취학 전) | 드림아카데미",
  description: "파닉스·Social English 1:1 수업과 아트·쿠킹·음악 테마 그룹 수업으로 영어가 자연스러워지는 세부 드림아카데미 킨더 종일반(9:00~16:00).",
  alternates: { canonical: "https://www.dreamacademyph.com/kinder" },
  openGraph: { title: "킨더 커리큘럼 (만 3세~취학 전) | 드림아카데미", description: "파닉스·Social English 1:1 수업과 아트·쿠킹·음악 테마 그룹 수업으로 영어가 자연스러워지는 세부 드림아카데미 킨더 종일반(9:00~16:00).", url: "https://www.dreamacademyph.com/kinder" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
