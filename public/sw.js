// Service worker — cho phép cài app (PWA). Luôn lấy bản MỚI từ mạng trước; mất mạng mới dùng bản đã lưu.
// Chỉ file của chính app (cùng nguồn). Không đụng tới Supabase.
const CACHE = 'okrs-kaizen-v1';
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
