// ============================================================
// Service Worker - แม่ยม พาเลส
// ทำหน้าที่: 1) PWA offline cache  2) รับ Push Notification
// ============================================================

const CACHE_NAME = 'maeyom-v1';
const ESSENTIAL = [
  '/',
  '/index.html',
  '/menu.html',
  '/status.html',
  '/admin.html',
  '/tables.html',
  '/menu-manage.html',
  '/print.html',
  '/css/styles.css',
  '/js/config.js',
  '/js/notifications.js',
  '/js/customer.js',
  '/js/admin.js',
  '/js/tables.js',
  '/js/menu-manage.js',
  '/manifest.json'
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // ใช้ addAll แต่ไม่ fail ถ้าไฟล์บางตัวยังไม่มี
      return Promise.allSettled(ESSENTIAL.map(url => cache.add(url).catch(() => null)));
    })
  );
  self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — Network first, fallback cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ข้าม API calls (Supabase, Apps Script ฯลฯ) — ให้ผ่านโดยตรง
  if (url.origin !== self.location.origin) return;

  // ข้าม method ที่ไม่ใช่ GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});

// ============================================================
// Push Notification
// ============================================================
self.addEventListener('push', (event) => {
  let payload = {
    title: 'แม่ยม พาเลส',
    body: 'มีการแจ้งเตือนใหม่',
    icon: '/images/icon-192.png',
    badge: '/images/badge.png',
    data: { url: '/' }
  };

  if (event.data) {
    try { payload = Object.assign(payload, event.data.json()); }
    catch { payload.body = event.data.text(); }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      vibrate: [200, 100, 200, 100, 200],
      tag: payload.tag || 'maeyom-notify',
      renotify: true,
      requireInteraction: payload.requireInteraction || false,
      data: payload.data || {},
      actions: payload.actions || []
    })
  );
});

// คลิกการแจ้งเตือน → เปิดหน้าที่กำหนด
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && 'focus' in w) return w.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
