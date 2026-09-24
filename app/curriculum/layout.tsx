import type { Metadata } from "next";

const TITLE = "커리큘럼 안내 (주니어·킨더) | 드림아카데미";
const DESC = "하루 8교시, 1:1 4회와 소그룹 4회. 15단계 자체 교재와 워드북, 학습 리포트까지. 세부 드림아카데미 주니어·킨더 커리큘럼 한눈에 보기.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://www.dreamacademyph.com/curriculum" },
  openGraph: { title: TITLE, description: DESC, url: "https://www.dreamacademyph.com/curriculum" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
