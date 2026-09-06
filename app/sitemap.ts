import type { MetadataRoute } from "next";
import { BASE_URL } from "@/lib/publicPages";

// 검색엔진용 사이트맵 — 손님 공개 페이지만 (어드민/포털/API 제외)
const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/junior", priority: 0.9, changeFrequency: "monthly" },
  { path: "/kinder", priority: 0.9, changeFrequency: "monthly" },
  { path: "/package", priority: 0.9, changeFrequency: "monthly" },
  { path: "/accommodation/dreamhouse", priority: 0.8, changeFrequency: "monthly" },
  { path: "/accommodation/jpark", priority: 0.8, changeFrequency: "monthly" },
  { path: "/accommodation/cubenine", priority: 0.8, changeFrequency: "monthly" },
  { path: "/estimate", priority: 0.8, changeFrequency: "monthly" },
  { path: "/booking", priority: 0.7, changeFrequency: "monthly" },
  { path: "/booking2", priority: 0.5, changeFrequency: "monthly" },
  { path: "/playdream", priority: 0.6, changeFrequency: "monthly" },
  { path: "/after-school-fieldtrip", priority: 0.6, changeFrequency: "monthly" },
  { path: "/shuttle", priority: 0.5, changeFrequency: "monthly" },
  { path: "/notice", priority: 0.6, changeFrequency: "weekly" },
  { path: "/community", priority: 0.5, changeFrequency: "weekly" },
  { path: "/products", priority: 0.5, changeFrequency: "monthly" },
  { path: "/tutor-apply", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
