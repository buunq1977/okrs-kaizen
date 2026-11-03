import { useState } from 'react'
import { useApp } from '../../lib/ctx'
import { timeSlots } from '../../lib/okr'
import type { ScheduleItem } from '../../lib/types'
import { Txt } from '../ui'

type Rows = {
  rows: ScheduleItem[]
  add: (r: Record<string, unknown>) => Promise<ScheduleItem | null>
  patch: (id: string, p: Partial<ScheduleItem>) => Promise<void>
  del: (id: string) => Promise<void>
}

const COMPACT_KEY = 'okrk-schedule-compact'
const readCompact = () => {
  try {
    return localStorage.getItem(COMPACT_KEY) === '1'
  } catch {
    return false
  }
}

/** 1a. Lịch cố định & cam kết: bảng giờ chia 2 cột Sáng | Chiều – Tối (§10). */
export function Schedule({ date, periodId, sched, editable }: { date: string; periodId: string; sched: Rows; editable: boolean }) {
  const { settings: s } = useApp()
  const [compact, setCompact] = useState(readCompact)
  const slots = timeSlots(s.day_start.slice(0, 5), s.day_end.slice(0, 5), s.slot_minutes)
  const byFrom = new Map(sched.rows.map((r) => [r.time_from.slice(0, 5), r]))
  const outside = sched.rows.filter((r) => !slots.some((x) => x.from === r.time_from.slice(0, 5)))

  async function save(from: string, to: string, title: string) {
    const it = byFrom.get(from)
    if (it) {
      if (!title.trim() && !it.fixed) await sched.del(it.id)
      else await sched.patch(it.id, { title })
    } else if (title.trim()) await sched.add({ period_id: periodId, date, time_from: from, time_to: to, title })
  }

  const row = (sl: { from: string; to: string }) => {
    const it = byFrom.get(sl.from)
    if (compact && !it?.title.trim()) return null
    return (
      <div key={sl.from} className={'slot ' + (it?.fixed ? 'fixed ' : '') + (it?.done ? 'done' : '')}>
        <span className="tm">{sl.from}</span>
        <Txt value={it?.title} onSave={(v) => save(sl.from, sl.to, v)} disabled={!editable} label={`Việc lúc ${sl.from}`} placeholder="" />
        <button
          className="fix"
          aria-pressed={!!it?.fixed}
          disabled={!it || !editable}
          title="Cố định, không dời được (tô vàng)"
          onClick={() => it && sched.patch(it.id, { fixed: !it.fixed })}
        >
          ★
        </button>
        <input type="checkbox" aria-label={`Hoàn thành ${sl.from}`} disabled={!it} checked={!!it?.done} onChange={() => it && sched.patch(it.id, { done: !it.done })} />
      </div>
    )
  }
  const am = slots.filter((x) => x.from < '12:00')
  const pm = slots.filter((x) => x.from >= '12:00')

  return (
    <div className="sched">
      <div className="sched-bar">
        <span className="note">Làm gì, với ai, khi nào? Lời hứa, lịch hẹn nào? ★ = cố định. Ô cuối = Check.</span>
        <label className="li">
          <input
            type="checkbox"
            checked={compact}
            onChange={() => {
              setCompact(!compact)
              try {
                localStorage.setItem(COMPACT_KEY, compact ? '0' : '1')
              } catch {
                /* bỏ qua */
              }
            }}
          />
          Thu gọn ô trống
        </label>
      </div>
      <div className="sched-cols">
        <div className="sched-col">
          <div className="col-h">Sáng</div>
          {am.map(row)}
        </div>
        <div className="sched-col">
          <div className="col-h">Chiều – Tối</div>
          {pm.map(row)}
        </div>
      </div>
      {outside.length > 0 && (
        <div className="list">
          <div className="fld-l">Ngoài khung giờ hiện tại</div>
          {outside.map((it) => (
            <div key={it.id} className={'slot ' + (it.fixed ? 'fixed' : '')}>
              <span className="tm">{it.time_from.slice(0, 5)}</span>
              <span>{it.title}</span>
              <button className="x" aria-label="Xoá" disabled={!editable} onClick={() => sched.del(it.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
