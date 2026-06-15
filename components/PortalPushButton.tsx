"use client";
import { useEffect, useState } from "react";
import { resolvePortalSession } from "@/lib/portalSession";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type Status = "unsupported" | "ios-install" | "denied" | "granted" | "default" | "loading";

export default function PortalPushButton() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1) 지원 체크
      const supported =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supported) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      // 2) iOS 분기
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;
      if (isIOS && !isStandalone) {
        if (!cancelled) setStatus("ios-install");
        return;
      }

      // booking_id 획득
      try {
        const sess = await resolvePortalSession();
        if (!cancelled && sess?.booking_id) setBookingId(sess.booking_id);
      } catch {}

      // 3) 권한/구독 상태
      const perm = Notification.permission;
      if (perm === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      if (perm === "granted") {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          const sub = reg ? await reg.pushManager.getSubscription() : null;
          if (!cancelled) setStatus(sub ? "granted" : "default");
        } catch {
          if (!cancelled) setStatus("default");
        }
        return;
      }
      if (!cancelled) setStatus("default");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enablePush() {
    if (busy) return;
    setBusy(true);
    try {
      // a. 권한 요청 (사용자 제스처)
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "default");
        return;
      }

      // b. 서비스워커 등록 (기존 등록 재사용됨)
      const reg = await navigator.serviceWorker.register("/sw.js");

      // c. 구독
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) {
        alert("푸시 설정이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.");
        setStatus("default");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });

      // d. 서버에 구독 저장
      const res = await fetch("/api/portal/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: sub,
          booking_id: bookingId,
          user_agent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        alert("알림 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");
        setStatus("default");
        return;
      }

      // e. 성공
      setStatus("granted");
    } catch (e) {
      alert("알림을 켜는 중 문제가 발생했습니다.");
      setStatus("default");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || status === "unsupported") return null;

  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    padding: "18px 20px",
    marginBottom: 16,
    boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
    display: "flex",
    alignItems: "center",
    gap: 14,
  };

  if (status === "ios-install") {
    return (
      <div style={{ ...card, background: "#eff6ff", border: "1.5px solid #bfdbfe", boxShadow: "none" }}>
        <div style={{ fontSize: 30 }}>🔔</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1d4ed8", marginBottom: 3 }}>
            알림 받으려면 홈 화면에 추가하세요
          </div>
          <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
            사파리 하단 <b>공유 <span style={{ fontSize: 13 }}>⬆️</span> → "홈 화면에 추가"</b> 후, 홈 화면 아이콘으로 열면 식단·셔틀·튜터 알림을 받을 수 있어요.
          </div>
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div style={card}>
        <div style={{ fontSize: 30 }}>🔕</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1a2e", marginBottom: 3 }}>
            알림 차단됨
          </div>
          <div style={{ fontSize: 12, color: "#6b7c93", lineHeight: 1.5 }}>
            브라우저 설정에서 알림을 허용해주세요.
          </div>
        </div>
      </div>
    );
  }

  if (status === "granted") {
    return (
      <div style={card}>
        <div style={{ fontSize: 30 }}>🔔</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#15803d", marginBottom: 3 }}>
            알림 켜짐
          </div>
          <div style={{ fontSize: 12, color: "#6b7c93", lineHeight: 1.5 }}>
            예약 관련 소식을 알림으로 받아보실 수 있어요.
          </div>
        </div>
      </div>
    );
  }

  // default — 미구독: 눈에 띄게 강조 (구독 유도)
  return (
    <div style={{ ...card, background: "#fffbeb", border: "1.5px solid #fcd34d", boxShadow: "none", flexWrap: "wrap" }}>
      <div style={{ fontSize: 30 }}>🔔</div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: "#92400e", marginBottom: 3 }}>
          알림을 켜주세요!
        </div>
        <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.5 }}>
          이번주 식단 · 셔틀 · 튜터 · 정산 등 중요한 소식을 폰 알림으로 바로 받아보세요.
        </div>
      </div>
      <button
        onClick={enablePush}
        disabled={busy}
        style={{
          padding: "11px 20px",
          borderRadius: 10,
          border: "none",
          background: busy ? "#94a3b8" : "#d97706",
          color: "#fff",
          fontSize: 13.5,
          fontWeight: 800,
          cursor: busy ? "default" : "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        {busy ? "설정 중…" : "🔔 알림 켜기"}
      </button>
    </div>
  );
}
