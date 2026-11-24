// Thông báo đẩy nhắc giờ (SPEC §13 v0.2, migration 016). Worker Cloudflare "okrs-push" gửi theo lịch mỗi 5 phút;
// app chỉ đăng ký "địa chỉ nhận" của trình duyệt vào bảng push_subs (RLS: mỗi người chỉ thấy máy của mình).
import { supabase } from './supabase'

/** Khoá công khai VAPID của Worker okrs-push (công khai, không phải bí mật). */
export const VAPID_PUBLIC = 'BKyQbGBc_rwgpCDhT4wONWLnlcr5QI3UQkMOVfsQhJkN4aFYihHA7BQpUrhxSPey-KZx0ssnopjDdyFUhSB72Hs'

export type PushPrefs = { kaizen: boolean; kaizen_final: boolean; okr: boolean; week: boolean; month: boolean }
export const PUSH_KINDS: { key: keyof PushPrefs; label: string }[] = [
  { key: 'kaizen', label: '🌙 Chốt Kaizen hôm nay (giờ nhắc)' },
  { key: 'kaizen_final', label: '⏰ Sắp hết giờ chốt Kaizen' },
  { key: 'okr', label: '☀️ Chốt OKR hôm nay (sáng)' },
  { key: 'week', label: '📅 Rà tuần (Chủ nhật)' },
  { key: 'month', label: '🗓️ Rà tháng / quý (ngày cuối tháng)' },
]
export const DEFAULT_PREFS: PushPrefs = { kaizen: true, kaizen_final: true, okr: true, week: true, month: true }

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const fromB64u = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  if (!reg) throw new Error('Chưa có service worker — mở app từ bản đã cài (hoặc tải lại trang) rồi thử lại.')
  return navigator.serviceWorker.ready
}

/** Trạng thái máy này: null = chưa bật; có → prefs đã lưu. */
export async function pushStatus(): Promise<{ on: boolean; prefs: PushPrefs }> {
  if (!pushSupported() || !supabase) return { on: false, prefs: DEFAULT_PREFS }
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (!sub) return { on: false, prefs: DEFAULT_PREFS }
  const { data } = await supabase.from('push_subs').select('prefs').eq('endpoint', sub.endpoint).maybeSingle()
  return data ? { on: true, prefs: { ...DEFAULT_PREFS, ...(data.prefs as Partial<PushPrefs>) } } : { on: false, prefs: DEFAULT_PREFS }
}

export async function enablePush(prefs: PushPrefs = DEFAULT_PREFS): Promise<void> {
  if (!supabase) throw new Error('App chưa có địa chỉ Supabase.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Bạn chưa cho phép thông báo.')
  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(VAPID_PUBLIC) })
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase.from('push_subs').upsert(
    { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth_key: j.keys.auth, ua: navigator.userAgent.slice(0, 200), prefs, welcomed: false },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(/push_subs/.test(error.message) ? 'Supabase chưa chạy 016_push_reminders.sql' : error.message)
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (!sub) return
  if (supabase) await supabase.from('push_subs').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe().catch(() => {})
}

export async function savePushPrefs(prefs: PushPrefs): Promise<void> {
  if (!supabase) return
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (!sub) return
  const { error } = await supabase.from('push_subs').update({ prefs }).eq('endpoint', sub.endpoint)
  if (error) throw new Error(error.message)
}
