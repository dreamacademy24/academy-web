"use client";
// 옛 셔틀 관리 페이지 — /admin/shuttle-management(셔틀·기사·스케줄 통합)로 통합됨.
// 기존 링크/북마크 호환을 위해 리다이렉트만 수행.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyShuttleRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/shuttle-management"); }, [router]);
  return null;
}
