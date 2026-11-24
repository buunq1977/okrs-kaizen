// Service worker — cho phép cài app (PWA). Luôn lấy bản MỚI từ mạng trước; mất mạng mới dùng bản đã lưu.
// Chỉ file của chính app (cùng nguồn). Không đụng tới Supabase.
const CACHE = 'okrs-kaizen-v2';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./']).catch(() => {}))); });
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== self.location.origin || !u.pathname.startsWith('/okrs-kaizen/')) return;
  e.respondWith(fetch(r).then((res) => {
    if (res.ok && res.type === 'basic') { const c = res.clone(); caches.open(CACHE).then((x) => x.put(r, c)); }
    return res;
  }).catch(async () => (await caches.match(r)) || (r.mode === 'navigate' ? caches.match('./', { ignoreSearch: true }) : Response.error())));
});

// ---------------- Thông báo đẩy nhắc giờ (Worker okrs-push gửi — migration 016)
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = { title: 'OKRs Kaizen', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'OKRs Kaizen', { body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png',
    tag: d.tag || 'okrs', renotify: true, data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.location.origin).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) if (c.url.includes('/okrs-kaizen/')) { await c.focus(); if ('navigate' in c) c.navigate(url).catch(() => {}); return; }
    await self.clients.openWindow(url);
  })());
});
