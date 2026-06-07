// 디자인 토큰 (TS) — globals.css :root 와 동일한 값.
// 인라인 style={{}} 을 쓰는 페이지에서 import 해 색을 통일할 때 사용.
// 예) import { UI } from "@/lib/uiTokens";  style={{ color: UI.brand }}
export const UI = {
  brand: "#1a6fc4",
  brandDark: "#0d3d7a",
  brandSoft: "#eff6ff",
  ok: "#16a34a",
  okDark: "#15803d",
  okSoft: "#dcfce7",
  warn: "#d97706",
  warnSoft: "#fffbeb",
  trip: "#c2410c",
  tripSoft: "#fff7ed",
  danger: "#dc2626",
  dangerSoft: "#fef2f2",
  text: "#1a1a2e",
  muted: "#6b7c93",
  faint: "#94a3b8",
  border: "#e2e8f0",
  bg: "#f1f5f9",
  card: "#ffffff",
  radius: 12,
  radiusSm: 8,
  shadow: "0 2px 12px rgba(0,0,0,0.05)",
  shadowLg: "0 8px 28px rgba(0,0,0,0.1)",
} as const;
