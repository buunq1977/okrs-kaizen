/** Lịch cố định & lặp lại (SPEC v3 §5, §5.1). Thuần, có test trong schedule.test.ts. */
import { isoDow, monthEnd } from './dates'
import type { EntryKind, ScheduleItem, ScheduleSeries } from './types'

/** Chuỗi lặp có diễn ra vào ngày `date` không. Ngày X hằng tháng mà tháng thiếu ngày → rơi vào ngày cuối tháng. */
export function occursOn(s: Pick<ScheduleSeries, 'rule' | 'weekdays' | 'month_day' | 'start_date' | 'end_date'>, date: string): boolean {
  if (date < s.start_date) return false
  if (s.end_date && date > s.end_date) return false
  if (s.rule === 'daily') return true
  if (s.rule === 'weekly') return s.weekdays.includes(isoDow(date))
  const day = Number(date.slice(8, 10))
  const last = Number(monthEnd(date).slice(8, 10))
  const md = s.month_day ?? 0
  return day === md || (md > last && day === last)
}

/** Một dòng hiển thị trong bảng giờ: mục riêng của ngày, hoặc 1 lần của chuỗi lặp (có thể đã bị sửa riêng). */
export interface Entry {
  key: string
  item: ScheduleItem | null
  series: ScheduleSeries | null
  time_from: string | null
  time_to: string | null
  title: string
  people: string
  kind: EntryKind
  fixed: boolean
  done: boolean
  untimed: boolean
  /** Sự kiện & mốc từ Tháng/Quý/Năm: chỉ đọc ở Ngày/Tuần (C7). */
  readonly?: boolean
}

/** Đổi sự kiện kỳ dài thành dòng lịch chỉ đọc. */
export function eventEntries(events: { id: string; date: string; time: string | null; title: string; people: string; kind: string }[], date: string): Entry[] {
  return events
    .filter((e) => e.date === date)
    .map((e) => ({
      key: 'e' + e.id,
      item: null,
      series: null,
      time_from: e.time ? e.time.slice(0, 5) : null,
      time_to: null,
      title: '◆ ' + e.title,
      people: e.people,
      kind: (e.kind === 'lich_hen' || e.kind === 'loi_hua' ? e.kind : 'viec') as EntryKind,
      fixed: true,
      done: false,
      untimed: !e.time,
      readonly: true,
    }))
}

export function mergeSchedule(series: ScheduleSeries[], items: ScheduleItem[], date: string): Entry[] {
  const out: Entry[] = []
  const overrides = new Map(items.filter((i) => i.series_id).map((i) => [i.series_id!, i]))
  for (const s of series) {
    if (!occursOn(s, date)) continue
    const o = overrides.get(s.id)
    if (o?.skipped) continue
    out.push({
      key: 's' + s.id,
      item: o ?? null,
      series: s,
      time_from: (o?.time_from ?? s.time_from).slice(0, 5),
      time_to: (o?.time_to ?? s.time_to).slice(0, 5),
      title: o?.title.trim() ? o.title : s.title,
      people: o?.people.trim() ? o.people : s.people,
      kind: o?.kind ?? s.kind,
      fixed: o ? o.fixed : s.fixed,
      done: o?.done ?? false,
      untimed: false,
    })
  }
  for (const i of items) {
    if (i.series_id) continue
    out.push({
      key: 'i' + i.id,
      item: i,
      series: null,
      time_from: i.time_from?.slice(0, 5) ?? null,
      time_to: i.time_to?.slice(0, 5) ?? null,
      title: i.title,
      people: i.people,
      kind: i.kind,
      fixed: i.fixed,
      done: i.done,
      untimed: i.untimed,
    })
  }
  return out.sort((a, b) => (a.time_from ?? '99').localeCompare(b.time_from ?? '99') || a.title.localeCompare(b.title))
}

/** Mục thuộc ô giờ [from, to): bắt đầu trong ô. */
export const inSlot = (e: Entry, from: string, to: string) => !e.untimed && !!e.time_from && e.time_from >= from && e.time_from < to

export const KIND_LABEL: Record<EntryKind, string> = { viec: 'Việc', loi_hua: 'Lời hứa', lich_hen: 'Lịch hẹn' }

export function repeatLabel(s: Pick<ScheduleSeries, 'rule' | 'weekdays' | 'month_day'>): string {
  if (s.rule === 'daily') return 'Hằng ngày'
  if (s.rule === 'monthly') return `Ngày ${s.month_day} hằng tháng`
  const names = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
  const w = [...s.weekdays].sort()
  if (w.join() === '1,2,3,4,5') return 'T2–T6'
  return w.map((d) => names[d]).join(', ')
}
