"use client";
import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let refreshing = false;
    let hadController = !!navigator.serviceWorker.controller;

    // 새 서비스워커가 제어권을 잡으면 = 업데이트됨 → 한 번 자동 새로고침 (최초 설치는 제외)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      if (!hadController) { hadController = true; return; }
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.update().catch(() => {});
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            try { nw.postMessage({ type: "SKIP_WAITING" }); } catch { /* noop */ }
          }
        });
      });
    }).catch(() => {});

    // 앱을 다시 열 때마다 최신 버전 확인
    const onVis = () => {
      if (document.visibilityState === "visible") {
        navigator.serviceWorker.getRegistration().then((r) => { if (r) r.update().catch(() => {}); }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return null;
}
