import type { MetadataRoute } from "next";
import { BASE_URL } from "@/lib/publicPages";

// 검색엔진 크롤링 규칙 — 어드민/포털/직원/API/토큰 페이지는 색인 제외
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin", "/admineng", "/api/", "/portal", "/staff", "/tutor/",
          "/checkin/", "/consent/", "/driver/", "/invoice", "/receipt", "/payment",
          "/login", "/signup", "/install", "/qr", "/daonmam-", "/ashuttle",
          "/team_manager", "/staff-guide", "/system-map.html",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
