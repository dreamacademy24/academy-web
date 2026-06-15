"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 식단 발행은 모리식단(/admin/meal-plan)의 탭으로 통합됨 → 리디렉트
export default function MealMenuRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/meal-plan"); }, [router]);
  return null;
}
