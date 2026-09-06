import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "커뮤니티 | 드림아카데미",
  description: "세부 드림아카데미 학부모 커뮤니티 — 후기와 정보를 나누는 공간.",
  alternates: { canonical: "https://www.dreamacademyph.com/community" },
  openGraph: { title: "커뮤니티 | 드림아카데미", description: "세부 드림아카데미 학부모 커뮤니티 — 후기와 정보를 나누는 공간.", url: "https://www.dreamacademyph.com/community" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
