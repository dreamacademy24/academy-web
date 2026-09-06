import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "공지사항 | 드림아카데미",
  description: "세부 드림아카데미 공지사항 — 휴무 일정, 프로그램 안내, 운영 소식.",
  alternates: { canonical: "https://www.dreamacademyph.com/notice" },
  openGraph: { title: "공지사항 | 드림아카데미", description: "세부 드림아카데미 공지사항 — 휴무 일정, 프로그램 안내, 운영 소식.", url: "https://www.dreamacademyph.com/notice" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
