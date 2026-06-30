"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAdminInfo } from "@/lib/adminAuth";

function Frame() {
  const sp = useSearchParams();
  const src = sp.get("src") || "/staff";
  const [real, setReal] = useState("");

  useEffect(() => {
    if (src === "/staff") {
      // /staff 는 세션 만료 시 /admin 으로 리다이렉트되어 사이드바가 또 뜸.
      // 원본 team_manager3.html 을