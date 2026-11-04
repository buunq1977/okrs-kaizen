import { useState } from 'react'
import { useApp } from '../../lib/ctx'
import { errMsg, getPeriod, insert } from '../../lib/db'
import { addDays, DOW, fmtDM, isoDow, today } from '../../lib/dates'
import { bucketOf } from '../../lib/okr'
import { KIND_LABEL, type Entry } from '../../lib/schedule'
import type { EntryKind } from '../../lib/types'

const ROWS = [
  ['s', 'Sáng', '08:00'],
  ['c', 'Chiều', '14:00'],
  ['t', 'Tối', '19:00'],
  ['u', 'Chưa có giờ', ''],
] as const

/** 1a. Lịch tuần: lưới T2 → CN × Sáng/Chiều/Tối, lấy từ lịch của từng ngày (một nguồn sự thật). */
export function WeekGrid({ weekStart, byDay, onChange, editable }: { weekStart: string; byDay: Record<string, Entry[]>; onChange: () => void; editable: boolean }) {
  const { uid, toast, go } = useApp()
  const [adding, setAdding] = useState<{ date: string; b: string } | null>(null)
  const [f, setF] = useState({ title: '', time: '', kind: 'viec' as EntryKind, fixed: false })
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i))
  const t0 = today()

  async function save() {
    if (!adding || !f.title.trim()) return
    try {
      const dp = await getPeriod(uid, 'day', adding.date)
      const timed = adding.b !== 'u' && f.time
      await insert('schedule_items', {
        period_id: dp.id,
        date: adding.date,
        time_from: timed ? f.time : null,
        time_to: timed ? addMinutes(f.time, 30) : null,
        untimed: !timed,
        title: f.title.trim(),
        kind: f.kind,
        fixed: f.fixed,
      })
      setAdding(null)
      onChange()
    } catch (e) {
      toast(errMsg(e))
    }
  }

  return (
    <div className="tbl">
      <p className="note">Lấy từ lịch của từng ngày. ★ cố định tô vàng, ↻ lặp lại. Muốn đặt lịch lặp lại, mở trang Ngày tương ứng.</p>
      <table className="wk">
        <thead>
          <tr>
            <th className="rowh" />
            {days.map((d) => (
              <th key={d} className={d === t0 ? 'today' : ''}>
                <button className="linkbtn" onClick={() => go('day', d)}>
                  <b>{DOW[isoDow(d)]}</b> {fmtDM(d)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([b, label, defTime]) => (
            <tr key={b}>
              <th className="rowh">{label}</th>
              {days.map((d) => {
                const list = (byDay[d] ?? []).filter((e) => (e.untimed ? 'u' : bucketOf(e.time_from)) === b)
                const isAdding = adding?.date === d && adding.b === b
                return (
                  <td key={d} className="wcell">
                    {list.map((e) => (
                      <div key={e.key} className={'wentry ' + (e.fixed ? 'fixed ' : '') + (e.done ? 'done ' : '') + e.kind} title={`${KIND_LABEL[e.kind]}${e.people ? ' · với ' + e.people : ''}`}>
                        {e.time_from && <span className="tm">{e.time_from}</span>} {e.title}
                        {e.series && ' ↻'}
                      </div>
                    ))}
                    {editable &&
                      (isAdding ? (
                        <div className="wadd">
                          <input autoFocus value={f.title} onChange={(ev) => setF({ ...f, title: ev.target.value })} onKeyDown={(ev) => ev.key === 'Enter' && save()} placeholder="Việc / lời hứa / hẹn" aria-label="Nội dung" />
                          {b !== 'u' && <input type="time" value={f.time} onChange={(ev) => setF({ ...f, time: ev.target.value })} aria-label="Giờ" />}
                          <select value={f.kind} onChange={(ev) => setF({ ...f, kind: ev.target.value as EntryKind })} aria-label="Loại">
                            <option value="viec">Việc</option>
                            <option value="loi_hua">Lời hứa</option>
                            <option value="lich_hen">Lịch hẹn</option>
                          </select>
                          <label className="li">
                            <input type="checkbox" checked={f.fixed} onChange={() => setF({ ...f, fixed: !f.fixed })} /> ★
                          </label>
                          <span className="addrow">
                            <button className="btn primary" disabled={!f.title.trim()} onClick={save}>
                              Thêm
                            </button>
                            <button className="btn ghost" onClick={() => setAdding(null)}>
                              Huỷ
                            </button>
                          </span>
                        </div>
                      ) : (
                        <button
                          className="slot-add"
                          aria-label={`Thêm vào ${label} ${fmtDM(d)}`}
                          onClick={() => {
                            setF({ title: '', time: defTime, kind: 'viec', fixed: false })
                            setAdding({ date: d, b })
                          }}
                        >
                          +
                        </button>
                      ))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function addMinutes(t: string, m: number) {
  const [h, mi] = t.split(':').map(Number)
  const n = Math.min(h * 60 + mi + m, 23 * 60 + 59)
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
}
