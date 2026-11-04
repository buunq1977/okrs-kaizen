import { useState } from 'react'
import { useApp } from '../../lib/ctx'
import { addDays, DOW } from '../../lib/dates'
import { errMsg, insert, remove, update } from '../../lib/db'
import { timeSlots } from '../../lib/okr'
import { inSlot, KIND_LABEL, repeatLabel, type Entry } from '../../lib/schedule'
import type { EntryKind, ScheduleItem } from '../../lib/types'

export type ItemRows = {
  rows: ScheduleItem[]
  add: (r: Record<string, unknown>) => Promise<ScheduleItem | null>
  patch: (id: string, p: Partial<ScheduleItem>) => Promise<void>
  del: (id: string) => Promise<void>
  reload: () => Promise<void>
}

const COMPACT_KEY = 'okrk-schedule-compact'
const readCompact = () => {
  try {
    return localStorage.getItem(COMPACT_KEY) === '1'
  } catch {
    return false
  }
}
type Repeat = 'none' | 'daily' | 'weekly' | 'monthly'
interface Draft {
  title: string
  kind: EntryKind
  people: string
  fixed: boolean
  repeat: Repeat
  weekdays: number[]
  end: string
  to: string
}

/** 1a. Lịch cố định & cam kết (§5, §5.1). */
export function Schedule(props: { date: string; periodId: string; entries: Entry[]; items: ItemRows; reloadSeries: () => Promise<void>; editable: boolean }) {
  const { date, periodId, entries, items, reloadSeries, editable } = props
  const { settings: s, toast } = useApp()
  const [compact, setCompact] = useState(readCompact)
  const [adding, setAdding] = useState<string | null>(null) // giờ bắt đầu ô đang thêm, 'untimed' cho lời hứa chưa có giờ
  const [scope, setScope] = useState<{ e: Entry; patch: Partial<ScheduleItem> | 'delete' } | null>(null)
  const slots = timeSlots(s.day_start.slice(0, 5), s.day_end.slice(0, 5), s.slot_minutes)
  const untimed = entries.filter((e) => e.untimed)

  /** Sửa 1 mục: mục riêng sửa thẳng; mục của chuỗi thì hỏi "chỉ hôm nay" hay "cả chuỗi". */
  async function change(e: Entry, patch: Partial<ScheduleItem> | 'delete', where?: 'once' | 'series') {
    try {
      if (!e.series) {
        if (patch === 'delete') await items.del(e.item!.id)
        else await items.patch(e.item!.id, patch)
        return
      }
      if (!where) return setScope({ e, patch })
      if (where === 'series') {
        if (patch !== 'delete') await update('schedule_series', e.series.id, patch as Record<string, unknown>)
        else if (date <= e.series.start_date) await remove('schedule_series', e.series.id)
        else await update('schedule_series', e.series.id, { end_date: addDays(date, -1) })
        await reloadSeries()
        await items.reload()
      } else await upsertOverride(e, patch === 'delete' ? { skipped: true } : patch)
    } catch (err) {
      toast(errMsg(err))
    }
    setScope(null)
  }
  /** Ghi 1 lần riêng của chuỗi (đã làm, sửa riêng, bỏ hôm nay). */
  async function upsertOverride(e: Entry, patch: Partial<ScheduleItem>) {
    if (e.item) return items.patch(e.item.id, patch)
    await items.add({ period_id: periodId, date, series_id: e.series!.id, time_from: e.time_from, time_to: e.time_to, title: '', fixed: e.fixed, kind: e.kind, ...patch })
  }
  const toggleDone = (e: Entry) => (e.series ? upsertOverride(e, { done: !e.done }) : items.patch(e.item!.id, { done: !e.done }))

  async function create(from: string | null, d: Draft) {
    const title = d.title.trim()
    if (!title) return
    try {
      if (d.repeat === 'none' || !from) {
        await items.add({ period_id: periodId, date, time_from: from, time_to: from ? d.to : null, untimed: !from, title, kind: d.kind, people: d.people, fixed: d.fixed })
      } else {
        await insert('schedule_series', {
          rule: d.repeat,
          weekdays: d.repeat === 'weekly' ? d.weekdays : [],
          month_day: d.repeat === 'monthly' ? Number(date.slice(8, 10)) : null,
          start_date: date,
          end_date: d.end || null,
          time_from: from,
          time_to: d.to,
          title,
          kind: d.kind,
          people: d.people,
          fixed: d.fixed,
        })
        await reloadSeries()
      }
      setAdding(null)
    } catch (err) {
      toast(errMsg(err))
    }
  }

  const row = (e: Entry) => (
    <div key={e.key} className={'entry ' + (e.fixed ? 'fixed ' : '') + (e.done ? 'done ' : '') + e.kind}>
      <input type="checkbox" aria-label="Đã làm" checked={e.done} onChange={() => toggleDone(e)} />
      <span className="kind">{KIND_LABEL[e.kind]}</span>
      <input
        type="text"
        className="et"
        defaultValue={e.title}
        disabled={!editable}
        aria-label="Nội dung"
        onBlur={(ev) => ev.target.value.trim() !== e.title && ev.target.value.trim() && change(e, { title: ev.target.value.trim() })}
      />
      {e.people && <span className="who">với {e.people}</span>}
      {e.series && <span className="rep" title="Lặp lại">↻ {repeatLabel(e.series)}</span>}
      <button className="fix" aria-pressed={e.fixed} disabled={!editable} title="Cố định: không dời được (tô vàng)" onClick={() => change(e, { fixed: !e.fixed })}>
        ★
      </button>
      {editable && (
        <button className="x" aria-label="Xoá" onClick={() => change(e, 'delete')}>
          ×
        </button>
      )}
    </div>
  )

  const slotRow = (sl: { from: string; to: string }) => {
    const list = entries.filter((e) => inSlot(e, sl.from, sl.to))
    if (compact && !list.length && adding !== sl.from) return null
    return (
      <div key={sl.from} className={'slot2 ' + (list.some((e) => e.fixed) ? 'has-fixed' : '')}>
        <div className="slot-h">
          <span className="tm">{sl.from}</span>
          {editable && adding !== sl.from && (
            <button className="slot-add" aria-label={`Thêm vào ${sl.from}`} onClick={() => setAdding(sl.from)}>
              +
            </button>
          )}
        </div>
        <div className="slot-b">
          {list.map(row)}
          {adding === sl.from && <AddForm from={sl.from} defTo={sl.to} date={date} onCancel={() => setAdding(null)} onSave={(d) => create(sl.from, d)} />}
        </div>
      </div>
    )
  }
  const am = slots.filter((x) => x.from < '12:00')
  const pm = slots.filter((x) => x.from >= '12:00')

  return (
    <div className="sched">
      <div className="sched-bar">
        <span className="note">Bấm + ở ô giờ để thêm việc, lời hứa, lịch hẹn. ★ = cố định (không dời). ↻ = lặp lại.</span>
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
      {scope && (
        <div className="alert blue">
          “{scope.e.title}” lặp lại {repeatLabel(scope.e.series!)}. {scope.patch === 'delete' ? 'Xoá' : 'Sửa'}:
          <button className="btn" onClick={() => change(scope.e, scope.patch, 'once')}>
            Chỉ hôm nay
          </button>
          <button className="btn" onClick={() => change(scope.e, scope.patch, 'series')}>
            {scope.patch === 'delete' ? 'Cả chuỗi từ hôm nay' : 'Cả chuỗi'}
          </button>
          <button className="btn ghost" onClick={() => setScope(null)}>
            Huỷ
          </button>
        </div>
      )}
      <div className="sched-cols">
        <div className="sched-col">
          <div className="col-h">Sáng</div>
          {am.map(slotRow)}
        </div>
        <div className="sched-col">
          <div className="col-h">Chiều – Tối</div>
          {pm.map(slotRow)}
        </div>
      </div>
      <div className="untimed">
        <div className="col-h">Lời hứa, việc chưa có giờ</div>
        {untimed.map(row)}
        {editable &&
          (adding === 'untimed' ? (
            <AddForm from={null} defTo="" date={date} onCancel={() => setAdding(null)} onSave={(d) => create(null, d)} />
          ) : (
            <button className="add" onClick={() => setAdding('untimed')}>
              + Thêm lời hứa / việc chưa có giờ
            </button>
          ))}
      </div>
    </div>
  )
}

function AddForm({ from, defTo, date, onSave, onCancel }: { from: string | null; defTo: string; date: string; onSave: (d: Draft) => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>({ title: '', kind: 'viec', people: '', fixed: false, repeat: 'none', weekdays: [], end: '', to: defTo })
  const dow = new Date(date + 'T00:00').getDay() || 7
  return (
    <form
      className="addform"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(d)
      }}
    >
      <input autoFocus value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Làm gì, lời hứa gì, hẹn ai?" aria-label="Nội dung" />
      <div className="addform-r">
        <select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as EntryKind })} aria-label="Loại">
          <option value="viec">Việc</option>
          <option value="loi_hua">Lời hứa</option>
          <option value="lich_hen">Lịch hẹn</option>
        </select>
        <input value={d.people} onChange={(e) => setD({ ...d, people: e.target.value })} placeholder="Với ai" aria-label="Với ai" className="short" />
        {from && (
          <label className="li">
            đến <input type="time" value={d.to} onChange={(e) => setD({ ...d, to: e.target.value })} aria-label="Giờ kết thúc" />
          </label>
        )}
        <label className="li">
          <input type="checkbox" checked={d.fixed} onChange={() => setD({ ...d, fixed: !d.fixed })} /> ★ Cố định
        </label>
      </div>
      {from && (
        <div className="addform-r">
          <select value={d.repeat} onChange={(e) => setD({ ...d, repeat: e.target.value as Repeat, weekdays: e.target.value === 'weekly' && !d.weekdays.length ? [dow] : d.weekdays })} aria-label="Lặp lại">
            <option value="none">Không lặp</option>
            <option value="daily">↻ Hằng ngày</option>
            <option value="weekly">↻ Theo thứ trong tuần</option>
            <option value="monthly">↻ Ngày {Number(date.slice(8, 10))} hằng tháng</option>
          </select>
          {d.repeat === 'weekly' && (
            <span className="wd">
              {[1, 2, 3, 4, 5, 6, 7].map((w) => (
                <button key={w} type="button" className="chip" aria-pressed={d.weekdays.includes(w)} onClick={() => setD({ ...d, weekdays: d.weekdays.includes(w) ? d.weekdays.filter((x) => x !== w) : [...d.weekdays, w] })}>
                  {DOW[w]}
                </button>
              ))}
            </span>
          )}
          {d.repeat !== 'none' && (
            <label className="li">
              đến hết <input type="date" value={d.end} min={date} onChange={(e) => setD({ ...d, end: e.target.value })} aria-label="Ngày kết thúc" /> <small>(trống = không hết hạn)</small>
            </label>
          )}
        </div>
      )}
      <div className="addform-r">
        <button className="btn primary" disabled={!d.title.trim() || (d.repeat === 'weekly' && !d.weekdays.length) || (!!from && (!d.to || d.to <= from))}>
          Thêm
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Huỷ
        </button>
      </div>
    </form>
  )
}

