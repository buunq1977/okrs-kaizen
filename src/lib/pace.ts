import { addDays, daysBetween } from './dates'
import type { Goal } from './types'

/** Mục tiêu ưu tiên (§17 D1, D7): tỉ lệ thời gian đã qua từ ngày tạo đến hạn chót, tính đến hết hôm qua. */
export function goalStatus(g: Goal, todayIso: string) {
  const start = g.created_at.slice(0, 10)
  const total = daysBetween(start, g.deadline)
  const passed = Math.min(Math.max(daysBetween(start, addDays(todayIso, -1)), 0), total)
  return { frac: total > 0 ? passed / total : 1 }
}

export const fmtNum = (n: number) =>
  Number.isInteger(n) ? n.toLocaleString('vi-VN') : n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
