// okrs-push — Worker Cloudflare gửi thông báo đẩy nhắc giờ cho OKRs Kaizen (SPEC §13, migration 016).
// Mỗi 5 phút: gọi push_due(PUSH_KEY) trên Supabase → danh sách nhắc đến giờ → mã hoá (RFC 8291, aes128gcm)
// + ký VAPID (RFC 8292) bằng WebCrypto có sẵn → gửi tới máy đã bật. Không dùng service_role.
// Secret (wrangler secret put): SUPABASE_URL, SUPABASE_ANON_KEY, PUSH_KEY, VAPID_JWK. Biến thường: VAPID_PUBLIC, VAPID_SUB.

const enc = new TextEncoder()
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0))
const concat = (...arrs) => { const out = new Uint8Array(arrs.reduce((a, x) => a + x.length, 0)); let o = 0; for (const x of arrs) { out.set(x, o); o += x.length } return out }

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8))
}

// Mã hoá nội dung theo RFC 8291 (Content-Encoding: aes128gcm)
async function encrypt(payload, p256dh, auth) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth)
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256))
  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))))
  const rs = new Uint8Array([0, 0, 16, 0])                         // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ct)
}

// Ký VAPID (JWT ES256)
async function vapidHeader(endpoint, env, signKey) {
  const aud = new URL(endpoint).origin
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUB })))
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signKey, enc.encode(`${head}.${body}`))
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`
}

async function rpc(env, fn, args) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!r.ok) throw new Error(`${fn} HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return r.status === 204 ? null : r.json()
}

async function run(env) {
  const due = await rpc(env, 'push_due', { p_key: env.PUSH_KEY })
  const items = (due && due.items) || []
  if (!items.length) return { sent: 0 }
  const jwk = JSON.parse(env.VAPID_JWK)
  const signKey = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const ok = [], dead = []
  for (const it of items) {
    try {
      const body = await encrypt(JSON.stringify({ title: it.title, body: it.body, url: it.url, tag: it.tag }), it.p256dh, it.auth)
      const r = await fetch(it.endpoint, {
        method: 'POST',
        headers: { authorization: await vapidHeader(it.endpoint, env, signKey), 'content-encoding': 'aes128gcm',
          'content-type': 'application/octet-stream', ttl: '3600', urgency: 'high' },
        body,
      })
      if (r.status === 404 || r.status === 410) dead.push(it.endpoint)
      else if (r.ok) ok.push(it.endpoint)
      else console.log('push lỗi', r.status, (await r.text()).slice(0, 200))
    } catch (e) { console.log('push lỗi', e.message) }
  }
  if (ok.length || dead.length) await rpc(env, 'push_report', { p_key: env.PUSH_KEY, p: { ok: [...new Set(ok)], dead: [...new Set(dead)] } })
  return { sent: ok.length, dead: dead.length, items: items.length }
}

export default {
  async scheduled(_ev, env, ctx) { ctx.waitUntil(run(env).then((r) => console.log('okrs-push', JSON.stringify(r)), (e) => console.log('okrs-push lỗi', e.message))) },
  async fetch() { return new Response('okrs-push: Worker gửi nhắc giờ OKRs Kaizen (chạy theo lịch mỗi 5 phút).', { headers: { 'content-type': 'text/plain; charset=utf-8' } }) },
}
