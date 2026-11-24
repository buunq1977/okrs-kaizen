import { useEffect, useState } from 'react'
import { useApp } from '../lib/ctx'
import { disablePush, enablePush, PUSH_KINDS, pushStatus, pushSupported, savePushPrefs, DEFAULT_PREFS, type PushPrefs } from '../lib/push'

/** Cài đặt → Nhắc giờ: bật / tắt thông báo đẩy trên máy đang dùng + chọn loại nhắc. */
export default function PushBox() {
  const { toast } = useApp()
  const [st, setSt] = useState<{ on: boolean; prefs: PushPrefs } | null>(null)
  const [busy, setBusy] = useState(false)
  const ok = pushSupported()
  const denied = ok && Notification.permission === 'denied'

  useEffect(() => {
    if (ok) pushStatus().then(setSt).catch(() => setSt({ on: false, prefs: DEFAULT_PREFS }))
  }, [ok])

  if (!ok) return <p className="note">Trình duyệt này không hỗ trợ thông báo đẩy. Trên điện thoại: cài app bằng Chrome (📲 Cài app) rồi bật ở đây.</p>

  const act = async (f: () => Promise<void>, done: string) => {
    setBusy(true)
    try {
      await f()
      setSt(await pushStatus())
      toast(done)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  const toggle = (k: keyof PushPrefs) => {
    if (!st) return
    const prefs = { ...st.prefs, [k]: !st.prefs[k] }
    setSt({ ...st, prefs })
    savePushPrefs(prefs).catch((e) => toast(e instanceof Error ? e.message : String(e)))
  }

  return (
    <div className="push-box">
      <div className="fld-l">Thông báo đẩy trên máy này</div>
      {denied ? (
        <p className="note">Trình duyệt đang chặn thông báo của app. Vào cài đặt trang (⋮ → Cài đặt trang web → Thông báo) để cho phép, rồi tải lại.</p>
      ) : st?.on ? (
        <>
          {PUSH_KINDS.map((x) => (
            <label key={x.key} className="li">
              <input type="checkbox" checked={st.prefs[x.key]} onChange={() => toggle(x.key)} />
              {x.label}
            </label>
          ))}
          <button className="btn" disabled={busy} onClick={() => act(disablePush, 'Đã tắt thông báo trên máy này')}>
            🔕 Tắt trên máy này
          </button>
        </>
      ) : (
        <button className="btn primary" disabled={busy || !st} onClick={() => act(() => enablePush(), 'Đã bật. Thông báo thử sẽ tới trong ~5 phút.')}>
          🔔 Bật thông báo nhắc giờ
        </button>
      )}
      <p className="note">
        Gửi kể cả khi đã đóng app (máy chủ Cloudflare kiểm tra mỗi 5 phút, có thể trễ tối đa ~5 phút). Đã xác nhận Kaizen / đã chốt OKR / đã rà thì không nhắc. Mỗi nhắc 1 lần / ngày.
      </p>
    </div>
  )
}
