import { useState } from 'react'
import { fmtDM } from '../../lib/dates'
import type { EventItem, Objective } from '../../lib/types'

type Rows = {
  rows: EventItem[]
  add: (r: Record<string, unknown>) => Promise<EventItem | null>
  del: (id: string) => Promise<void>
}
const KIND = { lich_hen: 'Lịch hẹn', deadline: 'Deadline', su_kien: 'Sự kiện', loi_hua: 'Lời hứa' } as const

/** Sự kiện & mốc quan trọng (C7): nhập ở kỳ dài, tự hiện xuống Tuần và Ngày. */
export function Events({ periodId, start, end, ev, objs }: { periodId: string; start: string; end: string; ev: Rows; objs: Objective[] }) {
  const [f, setF] = useState({ date: start, time: '', title: '', people: '', kind: 'su_kien' as EventItem['kind'], obj: '' })
  return (
    <div className="events">
      {ev.rows.length === 0 && <p className="note">Chưa có sự kiện. Ghi lịch hẹn lớn, deadline, hội nghị để không quên.</p>}
      {ev.rows.map((e) => (
        <div key={e.id} className={'event ' + e.kind}>
          <b>{fmtDM(e.date)}</b>
          {e.time && <span className="tm">{e.time.slice(0, 5)}</span>}
          <span className="kind">{KIND[e.kind]}</span>
          <span className="et">{e.title}</span>
          {e.people && <span className="who">với {e.people}</span>}
          <button className="x" aria-label="Xoá sự kiện" onClick={() => ev.del(e.id)}>
            ×
          </button>
        </div>
      ))}
      <div className="addrow">
        <input type="date" value={f.date} min={start} max={end} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="Ngày" />
        <input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} aria-label="Giờ (tuỳ chọn)" />
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as EventItem['kind'] })} aria-label="Loại">
          {Object.entries(KIND).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Tên sự kiện" aria-label="Tên sự kiện" />
        <input className="short" value={f.people} onChange={(e) => setF({ ...f, people: e.target.value })} placeholder="Với ai" aria-label="Với ai" />
        <select value={f.obj} onChange={(e) => setF({ ...f, obj: e.target.value })} aria-label="Gắn O">
          <option value="">— gắn O —</option>
          {objs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title || o.area}
            </option>
          ))}
        </select>
        <button
          className="btn"
          disabled={!f.title.trim() || !f.date}
          onClick={async () => {
            await ev.add({ period_id: periodId, date: f.date, time: f.time || null, title: f.title.trim(), people: f.people.trim(), kind: f.kind, objective_id: f.obj || null })
            setF({ ...f, title: '', people: '', time: '' })
          }}
        >
          Thêm
        </button>
      </div>
    </div>
  )
}
