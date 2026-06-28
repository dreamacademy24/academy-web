"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function Frame() {
  const sp = useSearchParams();
  const src = sp.get("src") || "/staff";
  return <iframe src={src} style={{ width: "100%", height: "100vh", border: "none", display: "block" }} title="content" />;
}
export default function AdminViewPage() {
  return <Suspense fallback={<div style={{ padding: 24, color: "#94a3b8" }}>불러오는 중…</div>}><Frame /></Suspense>;
}
