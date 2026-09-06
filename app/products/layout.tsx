import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "상품 안내 · 결제 | 드림아카데미",
  description: "세부 드림아카데미 프로그램 상품 안내와 온라인 결제.",
  alternates: { canonical: "https://www.dreamacademyph.com/products" },
  openGraph: { title: "상품 안내 · 결제 | 드림아카데미", description: "세부 드림아카데미 프로그램 상품 안내와 온라인 결제.", url: "https://www.dreamacademyph.com/products" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
