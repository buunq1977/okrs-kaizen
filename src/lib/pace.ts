import { addDays, daysBetween, isoDow, workdays } from './dates'
import type { Goal, Period, Settings, Task } from './types'

export type Status = 'green' | 'yellow' | 'red' | 'none'
export type DayStatus = Status | 'gray'

export const STATUS_LABEL: Record<DayStatus, string> = {
  green: 'Đúng tiến độ',
  yellow: 'Hơi chậm',
  red: 'Chậm',
  none: 'Chưa tới mốc đo',
  gray: 'Chưa check-in',
}

type Thresholds = Pick<Settings, 'green_pct' | 'yellow_pct'>

/** Tỉ lệ thời gian đã qua của kỳ, tính đến hết HÔM QUA, theo ngày làm việc. */
export function expectedFraction(start: string, end: string, todayIso: string, rest: number[]) {
  const total = workdays(start, end, rest)
  if (!total) return 1
  const upto = addDays(todayIso, -1)
  if (upto < start) return 0
  return workdays(start, upto < end ? upto : end, rest) / total
}

/** So thực tế với mức cần đạt (target × tỉ lệ thời gian). */
export function status(actual: number, target: number, frac: number, s: Thresholds): Status {
  const expected = target * frac
  if (!expected) return 'none'
  const r = (actual / expected) * 100
  return r >= s.green_pct ? 'green' : r >= s.yellow_pct ? 'yellow' : 'red'
}

/** Mục tiêu năm: tiến độ theo lịch từ ngày tạo đến hạn chót. */
export function goalStatus(g: Goal, todayIso: string, s: Thresholds) {
  const start = g.created_at.slice(0, 10)
  const total = daysBetween(start, g.deadline)
  const passed = Math.min(Math.max(daysBetween(start, addDays(todayIso, -1)), 0), total)
  const frac = total > 0 ? passed / total : 1
  return { frac, st: status(g.current - g.baseline, g.target - g.baseline, frac, s) }
}

/** % hoàn thành ngày = trung bình các việc gắn mục tiêu, mỗi việc tối đa 100%. */
export function dayPct(tasks: Task[]): number | null {
  const linked = tasks.filter((t) => t.kr_id)
  if (!linked.length) return null
  return Math.round((linked.reduce((a, t) => a + Math.min((t.actual ?? 0) / t.target, 1), 0) / linked.length) * 100)
}

export function dayStatus(p: Period | undefined, tasks: Task[], s: Thresholds): DayStatus {
  if (!p?.checked_in_at) return 'gray'
  const pct = dayPct(tasks)
  if (pct === null) return 'none'
  return pct >= s.green_pct ? 'green' : pct >= s.yellow_pct ? 'yellow' : 'red'
}

/**
 * R8: N ngày làm việc gần nhất trước hôm nay đều đỏ (hoặc không check-in)
 * và ngày gần nhất trong chuỗi chưa viết Bài học → khoá thêm việc mới.
 * Chỉ xét từ ngày đầu tiên bắt đầu dùng app.
 */
export function redStreakLock(
  todayIso: string,
  days: { date: string; period?: Period; tasks: Task[] }[],
  s: Settings,
): { locked: boolean; day?: string } {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const first = days.filter((d) => d.period).map((d) => d.date).sort()[0]
  if (!first || s.red_streak < 1) return { locked: false }
  const streak: string[] = []
  for (let d = addDays(todayIso, -1); d >= first && streak.length < s.red_streak; d = addDays(d, -1)) {
    if (s.rest_weekdays.includes(isoDow(d))) continue
    const row = byDate.get(d)
    const st = dayStatus(row?.period, row?.tasks ?? [], s)
    if (st === 'red' || st === 'gray') streak.push(d)
    else return { locked: false }
  }
  if (streak.length < s.red_streak) return { locked: false }
  const latest = streak[0]
  const lessons = byDate.get(latest)?.period?.kaizen?.lessons?.trim()
  return lessons ? { locked: false } : { locked: true, day: latest }
}

/** R6: kế hoạch của một ngày khoá từ giờ chốt của ngày hôm trước. */
export function planLocked(p: Period, lockTime: string, now: Date) {
  const [h, m] = lockTime.split(':').map(Number)
  const [y, mo, d] = addDays(p.start_date, -1).split('-').map(Number)
  const deadline = new Date(y, mo - 1, d, h, m)
  const lockedAt = p.locked_at ? new Date(p.locked_at) : now >= deadline ? deadline : null
  if (!lockedAt) return { locked: false, deadline }
  const unlocked = (p.observe.unlocks ?? []).some((u) => new Date(u.at) > lockedAt)
  return { locked: !unlocked, deadline }
}

export const fmtNum = (n: number) => (Number.isInteger(n) ? n.toLocaleString('vi-VN') : n.toLocaleString('vi-VN', { maximumFractionDigits: 1 }))
