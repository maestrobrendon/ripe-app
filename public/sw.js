/*
 * Basket's service worker. It does two things: shows app notifications
 * (Web Push, sent by src/lib/web-push.ts) and opens the right page when one
 * is tapped. It caches nothing, so every page is always fresh.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Basket", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Basket";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/app-icon/192",
      badge: "/app-icon/192",
      tag: data.tag || undefined,
      data: { url: data.url || "/basket" },
    }),
  );
});

// Tapping a notification focuses Basket if it's open, on the right page; otherwise opens it there.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/basket", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          w.navigate(target);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
