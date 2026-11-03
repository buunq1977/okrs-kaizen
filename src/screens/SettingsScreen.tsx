import { useState } from 'react'
import { Sec } from '../components/ui'
import { useApp } from '../lib/ctx'
import { errMsg, exportAll, saveSettings } from '../lib/db'
import { DOW_LONG, today } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { Settings } from '../lib/types'

export default function SettingsScreen() {
  const { settings, setSettings, toast } = useApp()
  const [s, setS] = useState<Settings>(settings)
  const [pw, setPw] = useState('')
  const dirty = JSON.stringify(s) !== JSON.stringify(settings)

  async function save() {
    if (s.yellow_pct > s.green_pct) return toast('Ngưỡng vàng phải nhỏ hơn hoặc bằng ngưỡng xanh.')
    try {
      const u = await saveSettings(s)
      setSettings(u)
      setS(u)
      toast('Đã lưu cài đặt')
    } catch (e) {
      toast(errMsg(e))
    }
  }

  async function download() {
    try {
      const data = await exportAll()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `okrs-kaizen-${today()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast(errMsg(e))
    }
  }

  return (
    <div className="stack narrow">
      <Sec title="Kỷ luật" hint="Các ngưỡng này quyết định khi nào app báo đỏ và khoá">
        <label className="fld inline">
          <span>Giờ chốt kế hoạch ngày mai</span>
          <input type="time" value={s.lock_time.slice(0, 5)} onChange={(e) => setS({ ...s, lock_time: e.target.value })} />
        </label>
        <label className="fld inline">
          <span>Xanh khi đạt ≥</span>
          <input type="number" min={1} max={200} value={s.green_pct} onChange={(e) => setS({ ...s, green_pct: Number(e.target.value) })} />
          <span className="unit">% mức cần đạt</span>
        </label>
        <label className="fld inline">
          <span>Vàng khi đạt ≥</span>
          <input type="number" min={0} max={200} value={s.yellow_pct} onChange={(e) => setS({ ...s, yellow_pct: Number(e.target.value) })} />
          <span className="unit">% (thấp hơn là đỏ)</span>
        </label>
        <label className="fld inline">
          <span>Khoá thêm việc sau</span>
          <input type="number" min={1} max={7} value={s.red_streak} onChange={(e) => setS({ ...s, red_streak: Number(e.target.value) })} />
          <span className="unit">ngày đỏ liền</span>
        </label>
        <div className="fld-l">Ngày nghỉ trong tuần (không tính tiến độ)</div>
        <div className="days">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <label key={d} className="li">
              <input
                type="checkbox"
                checked={s.rest_weekdays.includes(d)}
                onChange={() => setS({ ...s, rest_weekdays: s.rest_weekdays.includes(d) ? s.rest_weekdays.filter((x) => x !== d) : [...s.rest_weekdays, d].sort() })}
              />
              {DOW_LONG[d]}
            </label>
          ))}
        </div>
        <button className="btn primary" disabled={!dirty} onClick={save}>
          Lưu cài đặt
        </button>
      </Sec>

      <Sec title="Sao lưu" hint="Supabase gói Free không tự sao lưu. Tải file này định kỳ.">
        <button className="btn" onClick={download}>
          Tải toàn bộ dữ liệu (JSON)
        </button>
      </Sec>

      <Sec title="Tài khoản">
        <label className="fld inline">
          <span>Mật khẩu mới</span>
          <input type="password" minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button
            className="btn"
            disabled={pw.length < 8}
            onClick={async () => {
              const { error } = (await supabase?.auth.updateUser({ password: pw })) ?? {}
              if (error) toast(error.message)
              else {
                setPw('')
                toast('Đã đổi mật khẩu')
              }
            }}
          >
            Đổi mật khẩu
          </button>
        </label>
      </Sec>
    </div>
  )
}
