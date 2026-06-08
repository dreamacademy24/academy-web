"use client";
// 공용 토스트 — provider 없이 어디서든 호출 가능 (alert 대체). SSR 안전.
//   toastOk("저장됐어요")  /  toastErr("저장 실패: ...")  /  toast("...", "info")
type ToastType = "success" | "error" | "info";

function ensureContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  let c = document.getElementById("da-toast-root");
  if (!c) {
    c = document.createElement("div");
    c.id = "da-toast-root";
    c.style.cssText =
      "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99999;" +
      "display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:max-content;max-width:92vw";
    document.body.appendChild(c);
  }
  return c;
}

export function toast(message: unknown, type: ToastType = "success"): void {
  const c = ensureContainer();
  const msg = message == null ? "" : (typeof message === "string" ? message : String((message as { message?: unknown })?.message ?? message));
  if (!c || !msg) return;
  const palette: Record<ToastType, { bg: string; icon: string }> = {
    success: { bg: "#16a34a", icon: "✓ " },
    error: { bg: "#dc2626", icon: "⚠️ " },
    info: { bg: "#1a1a2e", icon: "" },
  };
  const { bg, icon } = palette[type];
  const el = document.createElement("div");
  el.textContent = icon + msg;
  el.style.cssText =
    `pointer-events:auto;background:${bg};color:#fff;font-family:'Noto Sans KR',sans-serif;` +
    "font-size:14px;font-weight:700;padding:12px 18px;border-radius:10px;" +
    "box-shadow:0 8px 24px rgba(0,0,0,0.18);opacity:0;transform:translateY(8px);" +
    "transition:opacity .2s ease,transform .2s ease;max-width:92vw;text-align:center;line-height:1.5;white-space:pre-line";
  c.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
  const ms = type === "error" ? 4200 : 2600;
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 250);
  }, ms);
}

export const toastOk = (m: unknown) => toast(m, "success");
export const toastErr = (m: unknown) => toast(m, "error");
export const toastInfo = (m: unknown) => toast(m, "info");
