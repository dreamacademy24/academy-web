const CACHE_NAME = "dreamacademy-v5";
const PRECACHE_URLS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 페이지(HTML 네비게이션) + API + 동적 데이터는 항상 네트워크에서 최신으로 (캐시로 옛 화면 안 보이게)
  if (req.mode === "navigate" || req.destination === "document" || url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  // 정적 자산(_next/static, 아이콘 등)만 캐시 (network-first)
  event.respondWith(
    fetch(req)
      .then((response) => { const clone = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)); return response; })
      .catch(() => caches.match(req))
  );
});

self.addEventListener('push', function (event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || '드림아카데미';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-192x192.png',
    data: { url: data.url || '/portal' },
    tag: data.tag,
    renotify: !!data.tag,
  };
  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    // 앱 아이콘 배지 = 안 읽은(트레이에 남은) 알림 개수 — 앱이 꺼져 있어도 반영
    try {
      if (self.navigator && self.navigator.setAppBadge) {
        const notifs = await self.registration.getNotifications();
        const n = (typeof data.badgeCount === "number" && data.badgeCount > 0) ? data.badgeCount : (notifs.length || 1);
        await self.navigator.setAppBadge(n);
      }
    } catch (e) {}
  })());
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/portal';
  event.waitUntil((async () => {
    // 배지 갱신: 트레이에 남은 알림 수 기준 (없으면 제거)
    try {
      if (self.navigator) {
        const notifs = await self.registration.getNotifications();
        if (notifs.length > 0 && self.navigator.setAppBadge) await self.navigator.setAppBadge(notifs.length);
        else if (self.navigator.clearAppBadge) await self.navigator.clearAppBadge();
      }
    } catch (e) {}
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) { if (c.url.includes(targetUrl) && 'focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow(targetUrl);
  })());
});
