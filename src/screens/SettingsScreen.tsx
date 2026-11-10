import { useState, type ReactNode } from 'react'
import AffSettings from '../components/aff/AffSettings'
import { Sec } from '../components/ui'
import { useApp } from '../lib/ctx'
import { errMsg, exportAll, saveSettings } from '../lib/db'
import { addDays, DOW_LONG, today } from '../lib/dates'
import { remindTime } from '../lib/okr'
import { supabase } from '../lib/supabase'
import type { Settings } from '../lib/types'

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** File lịch nhắc hằng ngày (§9, §17 D4). Giờ "trôi" theo múi giờ của máy. */
function reminderIcs(time: string) {
  const d = addDays(today(), 0).replace(/-/g, '')
  const t = time.slice(0, 5).replace(':', '') + '00'
  const app = window.location.origin + import.meta.env.BASE_URL
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OKRs Kaizen//VI', 'BEGIN:VEVENT',
    `UID:okrs-kaizen-daily-${d}@okrs-kaizen`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${d}T${t}`, 'DURATION:PT30M', 'RRULE:FREQ=DAILY',
    'SUMMARY:Kaizen hôm nay + OKR ngày mai (20–30 phút)', `DESCRIPTION:Mở app: ${app}`, `URL:${app}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Đến giờ Kaizen + lập OKR ngày mai', 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

function Row({ label, children, unit }: { label: string; children: ReactNode; unit?: string }) {
  return (
    <label className="fld inline">
      <span>{label}</span>
      {children}
      {unit && <span className="unit">{unit}</span>}
    </label>
  )
}

export default function SettingsScreen() {
  const { settings, setSettings, toast } = useApp()
  const [s, setS] = useState<Settings>(settings)
  const [pw, setPw] = useState('')
  const dirty = JSON.stringify(s) !== JSON.stringify(settings)
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v })

  async function save() {
    if (s.red_below >= s.pass_pct) return toast('Ngưỡng đỏ phải nhỏ hơn ngưỡng đạt.')
    if (s.day_max_kr < s.day_min_kr) return toast('Số KR tối đa phải ≥ số KR tối thiểu.')
    if (s.status_red >= s.status_green) return toast('Ngưỡng đỏ tình trạng phải nhỏ hơn ngưỡng xanh.')
    try {
      const u = await saveSettings(s)
      setSettings(u)
      setS(u)
      toast('Đã lưu cài đặt')
    } catch (e) {
      toast(errMsg(e))
    }
  }
  const num = (k: keyof Settings, min: number, max: number) => (
    <input type="number" min={min} max={max} value={s[k] as number} onChange={(e) => set(k, Number(e.target.value) as never)} />
  )
  const time = (k: 'lock_time' | 'day_start' | 'day_end') => <input type="time" value={s[k].slice(0, 5)} onChange={(e) => set(k, e.target.value)} />
  const flag = (k: keyof Settings, label: string) => (
    <label className="li">
      <input type="checkbox" checked={s[k] as boolean} onChange={() => set(k, !s[k] as never)} />
      {label}
    </label>
  )

  return (
    <div className="stack narrow">
      <div className="savebar">
        <button className="btn primary" disabled={!dirty} onClick={save}>
          Lưu cài đặt
        </button>
        {dirty && <span className="flag">Có thay đổi chưa lưu</span>}
      </div>

      <Sec title="Màu % hoàn thành Ngày/Tuần" hint="SPEC §10.3">
        <Row label="Đỏ khi dưới" unit="%">{num('red_below', 0, 99)}</Row>
        <Row label="Đạt (xanh) từ" unit="%">{num('pass_pct', 1, 100)}</Row>
        <Row label="Gợi ý 'KR chọn chưa trúng O' khi % thực thi và O thực tế lệch từ" unit="điểm">{num('gap_suggest_pts', 5, 100)}</Row>
        {flag('weights_enabled', 'Dùng trọng số cho KR/KA')}
      </Sec>

      <Sec title="Tháng · Quý · Năm" hint="SPEC §10.3, §11, §15">
        <Row label="Tình trạng đỏ khi dưới" unit="%">{num('status_red', 0, 99)}</Row>
        <Row label="Tình trạng xanh từ" unit="%">{num('status_green', 1, 200)}</Row>
        <Row label="KR tối thiểu O Công việc/Tài chính" unit="KR">{num('kr_min_cvtc', 1, 6)}</Row>
        <Row label="KR O Mối quan hệ, O Thân–Tâm–Trí: tối thiểu" unit="KR">{num('kr_min_other', 0, 4)}</Row>
        <Row label="… tối đa" unit="KR">{num('kr_max_other', 1, 6)}</Row>
        <Row label="Trần số KR đang mở mỗi kỳ" unit="KR">{num('max_open_kr', 3, 15)}</Row>
        <Row label="Luật kích hoạt: trễ hơn" unit="%">{num('trigger_lag_pct', 5, 60)}</Row>
        <Row label="… trong số tuần liên tiếp" unit="tuần">{num('trigger_weeks', 1, 4)}</Row>
        <Row label="KR quý trễ hơn thì mở chẩn đoán" unit="%">{num('trigger_quarter_pct', 5, 60)}</Row>
        <Row label="Hạ mục tiêu tối đa" unit="lần / KR / quý">{num('lower_per_kr_quarter', 0, 5)}</Row>
        <Row label="Dừng KR tối đa" unit="lần / quý">{num('stop_per_quarter', 0, 5)}</Row>
        <Row label="Thời gian chờ đề xuất điều chỉnh" unit="giờ">{num('change_cooldown_h', 0, 168)}</Row>
        {flag('ka_autotick', 'KA tuần tự tick khi O ngày phục vụ nó đạt ngưỡng đạt')}
      </Sec>

      <AffSettings />

      <Sec title="Trang Ngày">
        <Row label="Số KR tối thiểu" unit="KR">{num('day_min_kr', 1, 6)}</Row>
        <Row label="Số KR tối đa" unit="KR">{num('day_max_kr', 1, 8)}</Row>
        <Row label="Hành động Kaizen khuyến nghị tối đa" unit="/ngày">{num('max_daily_actions', 1, 10)}</Row>
        <Row label="Khung giờ bắt đầu">{time('day_start')}</Row>
        <Row label="Khung giờ kết thúc">{time('day_end')}</Row>
        <Row label="Mỗi dòng lịch">
          <select value={s.slot_minutes} onChange={(e) => set('slot_minutes', Number(e.target.value))}>
            <option value={30}>30 phút</option>
            <option value={60}>60 phút</option>
          </select>
        </Row>
      </Sec>

      <Sec title="Kỷ luật" hint="§17 D2">
        {flag('auto_lock', 'Tự khoá kế hoạch ngày D vào giờ chốt của ngày D-1')}
        <Row label="Giờ chốt">{time('lock_time')}</Row>
        {flag('red_lock', 'Đỏ nhiều ngày liền mà chưa viết Bài học thì khoá thêm KR/KA mới')}
        <Row label="Số ngày đỏ liền" unit="ngày">{num('red_streak', 1, 7)}</Row>
        <div className="fld-l">Ngày nghỉ (không tính chuỗi đỏ)</div>
        <div className="days">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <label key={d} className="li">
              <input
                type="checkbox"
                checked={s.rest_weekdays.includes(d)}
                onChange={() => set('rest_weekdays', s.rest_weekdays.includes(d) ? s.rest_weekdays.filter((x) => x !== d) : [...s.rest_weekdays, d].sort())}
              />
              {DOW_LONG[d]}
            </label>
          ))}
        </div>
      </Sec>

      <Sec title="Nhắc giờ" hint="C20: nhắc trước giờ chốt 60–90 phút">
        <Row label="Nhắc trước giờ chốt">
          <select value={s.remind_lead_min} onChange={(e) => set('remind_lead_min', Number(e.target.value))}>
            {[60, 75, 90].map((m) => (
              <option key={m} value={m}>
                {m} phút
              </option>
            ))}
          </select>
        </Row>
        <p className="note">
          Giờ chốt {s.lock_time.slice(0, 5)} → nhắc lúc <b>{remindTime(s.lock_time, s.remind_lead_min)}</b>. Sau giờ nhắc, trang Hôm nay mở sẵn tab Kaizen.
        </p>
        <Row label="Tab mở sẵn">
          <select value={s.default_tab} onChange={(e) => set('default_tab', e.target.value as Settings['default_tab'])}>
            <option value="auto">Tự theo giờ nhắc</option>
            <option value="okr">Luôn mở OKR</option>
            <option value="kaizen">Luôn mở Kaizen</option>
          </select>
        </Row>
        <button className="btn" onClick={() => download('okrs-kaizen-nhac-hang-ngay.ics', reminderIcs(remindTime(s.lock_time, s.remind_lead_min)), 'text/calendar')}>
          Tải file nhắc vào lịch (.ics)
        </button>
        <p className="note">Lưu cài đặt trước rồi tải file. Mở file trên điện thoại hoặc máy tính, chọn thêm vào Lịch.</p>
      </Sec>

      <Sec title="Năm">
        <Row label="Chia năm theo">
          <select value={s.year_mode} onChange={(e) => set('year_mode', e.target.value as 'month' | 'quarter')}>
            <option value="month">12 tháng</option>
            <option value="quarter">4 quý</option>
          </select>
        </Row>
        <p className="note">Dùng khi làm trang Năm (giai đoạn sau).</p>
      </Sec>

      <Sec title="Sao lưu" hint="Supabase gói Free không tự sao lưu">
        <button
          className="btn"
          onClick={async () => {
            try {
              download(`okrs-kaizen-${today()}.json`, JSON.stringify(await exportAll(), null, 2), 'application/json')
            } catch (e) {
              toast(errMsg(e))
            }
          }}
        >
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
