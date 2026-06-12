import { redirect } from "next/navigation";

// 페이지 관리 → 자료모음 '🔗 운영 정보' 탭으로 통합 (2026-06-12)
export default function PagesRedirect() {
  redirect("/admin/resources?tab=ops");
}
