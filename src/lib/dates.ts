import type { PeriodKind } from './types'

const p2 = (n: number) => String(n).padStart(2, '0')
export const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const today = () => iso(new Date())
export const addDays = (s: string, n: number) => {
  const d = parse(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}
/** 1 = thứ Hai … 7 = Chủ nhật */
export const isoDow = (s: string) => {
  const g = parse(s).getDay()
  return g === 0 ? 7 : g
}
export const mondayOf = (s: string) => addDays(s, 1 - isoDow(s))
export const monthStart = (s: string) => s.slice(0, 8) + '01'
export const addMonths = (s: string, n: number) => {
  const d = parse(monthStart(s))
  d.setMonth(d.getMonth() + n)
  return iso(d)
}
export const monthEnd = (s: string) => addDays(addMonths(s, 1), -1)
/** Tuần thuộc tháng chứa ngày thứ Năm của tuần (giống chuẩn ISO). */
export const monthOfWeek = (monday: string) => monthStart(addDays(monday, 3))

export function startOf(kind: PeriodKind, date: string) {
  return kind === 'day' ? date : kind === 'week' ? mondayOf(date) : monthStart(date)
}
export function endOf(kind: PeriodKind, start: string) {
  return kind === 'day' ? start : kind === 'week' ? addDays(start, 6) : monthEnd(start)
}
export function shift(kind: PeriodKind, start: string, n: number) {
  return kind === 'day' ? addDays(start, n) : kind === 'week' ? addDays(start, 7 * n) : addMonths(start, n)
}

export function workdays(from: string, to: string, rest: number[]) {
  let n = 0
  for (let d = from; d <= to; d = addDays(d, 1)) if (!rest.includes(isoDow(d))) n++
  return n
}
export function daysBetween(from: string, to: string) {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86400000)
}
/** Các thứ Hai của những tuần thuộc tháng (theo quy tắc thứ Năm). */
export function weeksOfMonth(ms: string) {
  const out: string[] = []
  for (let w = mondayOf(ms); w <= monthEnd(ms); w = addDays(w, 7)) if (monthOfWeek(w) === ms) out.push(w)
  return out
}
/** Số tháng còn lại tính cả tháng hiện tại, đến tháng của hạn chót. */
export function monthsLeft(ms: string, deadline: string) {
  const a = parse(ms), b = parse(deadline)
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1)
}

export const DOW = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
export const DOW_LONG = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
export const fmtDM = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
export const fmtDMY = (s: string) => `${fmtDM(s)}/${s.slice(0, 4)}`
export const fmtMonth = (s: string) => `Tháng ${s.slice(5, 7)}/${s.slice(0, 4)}`
