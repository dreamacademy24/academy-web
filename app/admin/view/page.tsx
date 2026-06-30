"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAdminInfo } from "@/lib/adminAuth";

function Frame() {
  const sp = useSearchParams();
  const src = sp.get("src") || "/staff";
  const [real, setReal] = useState("");

  useEffect(() => {
    if (src.startsWith("/staff?") || src === "/staff") {
      // /staff 는 세션 만료 시 /admin 으로 리다이렉트되어 사이드바가 또 뜸.
      // 원본 team_manager3.html 을 직접 임베드 + page 파라미터로 탭 딥링크.
      const qs = src.includes("?") ? src.split("?")[1] : "";
      const page = new URLSearchParams(qs).get("page") || "home";
      const info = getAdminInfo();
      const uid = (info?.staffId || "").replace(/^admin-/, "");
      const params = new URLSearchParams();
      if (uid) params.set("user", uid);
      params.set("page", page);
      setReal("/team_manager3.html?" + params.toString());
    } else {
      setReal(src);
    }
  }, [src]);

  if (!real) return <div style={{ padding: 24, color: "#94a3b8" }}>불러오는 중…</div>;
  return <iframe src={real} style={{ width: "100%", height: "100vh", border: "none", display: "block" }} title="content" />;
}

export default function AdminViewPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "#94a3b8" }}>불러오는 중…</div>}>
      <Frame />
    </Suspense>
  );
}
