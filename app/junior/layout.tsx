import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "주니어 커리큘럼 (초1~중2) | 드림아카데미",
  description: "1:1 수업 4회 + 소그룹 S-on-S 4회 + Funtivity. UCLA 출신 원장이 설계한 자체 교재로 말하기·듣기·읽기·쓰기를 균형 있게 키우는 세부 드림아카데미 주니어 프로그램.",
  alternates: { canonical: "https://www.dreamacademyph.com/junior" },
  openGraph: { title: "주니어 커리큘럼 (초1~중2) | 드림아카데미", description: "1:1 수업 4회 + 소그룹 S-on-S 4회 + Funtivity. UCLA 출신 원장이 설계한 자체 교재로 말하기·듣기·읽기·쓰기를 균형 있게 키우는 세부 드림아카데미 주니어 프로그램.", url: "https://www.dreamacademyph.com/junior" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
