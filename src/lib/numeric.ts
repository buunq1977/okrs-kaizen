/**
 * Logic thuần cho Tháng/Quý/Năm (SPEC v3 §8–§11): KR số, kế hoạch cộng dồn, tình trạng, phễu thu nhập,
 * luật kích hoạt, luật điều chỉnh, cửa sổ rà. Có test trong numeric.test.ts.
 */
import { addDays, addMonths, daysBetween, isoDow, monthEnd, monthStart, parse, iso } from './dates'
import type { Settings } from './types'

const clamp = (n: number, a = 0, b = 100) => Math.max(a, Math.min(b, n))

/* ---------- Quý ---------- */
export const quarterOf = (d: string) => Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1
export const quarterStart = (d: string) => `${d.slice(0, 4)}-${String((quarterOf(d) - 1) * 3 + 1).padStart(2, '0')}-01`
export const quarterEnd = (d: string) => addDays(addMonths(quarterStart(d), 3), -1)
export const yearStart = (d: string) => d.slice(0, 4) + '-01-01'
export const yearEnd = (d: string) => d.slice(0, 4) + '-12-31'

/* ---------- KR số (§10.2) ---------- */
/** Thực tế tuyệt đối đến ngày `upTo` (bao gồm) = điểm bắt đầu + tổng phần tăng. */
export function actualAt(baseline: number, entries: { date: string; value: number }[], upTo?: string): number {
  return baseline + entries.filter((e) => !upTo || e.date <= upTo).reduce((a, e) => a + e.value, 0)
}
/** % KR số = (thực tế − bắt đầu) / (đích − bắt đầu), chặn 0–100. Đích = bắt đầu → null. */
export function numericPercent(baseline: number | null, target: number | null, actual: number | null): number | null {
  if (baseline === null || target === null || actual === null || target === baseline) return null
  return Math.round(clamp(((actual - baseline) / (target - baseline)) * 100))
}
/**
 * Kế hoạch cộng dồn (phần tăng so với điểm bắt đầu) tại ngày `date`:
 * nội suy tuyến tính giữa các mốc, bắt đầu từ 0 tại `start`; sau mốc cuối giữ nguyên.
 */
export function plannedAt(plan: { date: string; planned: number }[], start: string, date: string): number {
  const pts = [{ date: start, planned: 0 }, ...[...plan].sort((a, b) => a.date.localeCompare(b.date))]
  if (date <= start) return 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    if (date <= b.date) {
      const span = daysBetween(a.date, b.date)
      return span <= 0 ? b.planned : a.planned + ((b.planned - a.planned) * daysBetween(a.date, date)) / span
    }
  }
  return pts[pts.length - 1].planned
}
/** Tình trạng = thực tế cộng dồn / kế hoạch cộng dồn đến hôm nay (đều tính phần tăng). */
export function statusPct(actualGain: number, plannedGain: number): number | null {
  if (plannedGain <= 0) return null
  return Math.round((actualGain / plannedGain) * 100)
}
export type SColor = 'red' | 'yellow' | 'green' | 'none'
export function statusColor(pct: number | null, s: Pick<Settings, 'status_red' | 'status_green'>): SColor {
  if (pct === null) return 'none'
  return pct < s.status_red ? 'red' : pct < s.status_green ? 'yellow' : 'green'
}
/** Kế hoạch cộng dồn mặc định: chia đều phần tăng theo các mốc (VD cuối mỗi tuần), mốc cuối = đủ. */
export function evenPlan(dates: string[], totalGain: number): { date: string; planned: number }[] {
  return dates.map((date, i) => ({ date, planned: Math.round(((totalGain * (i + 1)) / dates.length) * 100) / 100 }))
}
/** 4 mốc quý chia đều từ bắt đầu tới đích (giá trị tuyệt đối). */
export function quarterMilestones(baseline: number, target: number): { q: number; value: number }[] {
  return [1, 2, 3, 4].map((q) => ({ q, value: Math.round((baseline + ((target - baseline) * q) / 4) * 100) / 100 }))
}
/** Mốc cuối tuần (Chủ nhật) của các tuần thuộc tháng, ngày cuối không vượt quá cuối tháng. */
export function weekEndsOfMonth(ms: string): string[] {
  const out: string[] = []
  const end = monthEnd(ms)
  let d = ms
  while (d <= end) {
    const sun = addDays(d, 7 - isoDow(d))
    out.push(sun > end ? end : sun)
    d = addDays(sun, 1)
  }
  return out
}

/* ---------- Phễu thu nhập (§9) ---------- */
export interface Funnel {
  target_income_month: number | null
  value_per_unit: number | null
  retention: number | null
  stages: { id: string; name: string; conversion: number | null }[]
  working_days_week: number
  capacity_per_day: number | null
  unknown: Record<string, boolean>
}
export interface Pace {
  ok: boolean
  missing: string[]
  estimated: boolean
  unitsNeeded: number
  unitsToAcquire: number
  stages: { name: string; perMonth: number; perWeek: number; perDay: number }[]
  topPerDay: number
  overCapacity: boolean
}
export function funnelPace(m: Funnel): Pace {
  const missing: string[] = []
  if (!m.target_income_month) missing.push('Thu nhập mục tiêu/tháng')
  if (!m.value_per_unit) missing.push('Thu nhập mỗi đơn vị')
  if (!m.stages.length) missing.push('Các bước phễu')
  m.stages.slice(0, -1).forEach((s, i) => {
    if (!s.conversion) missing.push(`Tỷ lệ bước ${i + 1} → ${i + 2}`)
  })
  const empty: Pace = { ok: false, missing, estimated: false, unitsNeeded: 0, unitsToAcquire: 0, stages: [], topPerDay: 0, overCapacity: false }
  if (missing.length) return empty
  const unitsNeeded = m.target_income_month! / m.value_per_unit!
  const unitsToAcquire = unitsNeeded / (m.retention && m.retention > 0 ? m.retention : 1)
  // Bước cuối = số đơn vị cần có; đi ngược lên bước đầu
  const per = new Array(m.stages.length).fill(0)
  per[m.stages.length - 1] = unitsToAcquire
  for (let i = m.stages.length - 2; i >= 0; i--) per[i] = per[i + 1] / (m.stages[i].conversion as number)
  const wd = m.working_days_week > 0 ? m.working_days_week : 5
  const stages = m.stages.map((s, i) => ({ name: s.name, perMonth: per[i], perWeek: (per[i] * 12) / 52, perDay: (per[i] * 12) / 52 / wd }))
  const topPerDay = stages[0].perDay
  return {
    ok: true,
    missing,
    estimated: Object.values(m.unknown ?? {}).some(Boolean),
    unitsNeeded,
    unitsToAcquire,
    stages,
    topPerDay,
    overCapacity: m.capacity_per_day !== null && m.capacity_per_day > 0 && topPerDay > m.capacity_per_day,
  }
}
/** Hệ số nhân bản cần có so với năm trước (§9.3). */
export const multiplier = (targetYear: number | null, prevYear: number | null) => (targetYear && prevYear && prevYear > 0 ? Math.round((targetYear / prevYear) * 10) / 10 : null)

/* ---------- Luật kích hoạt (§11.3) ---------- */
/** KR tháng trễ > lag% ở N tuần đã kết thúc gần nhất liên tiếp. */
export function lagTriggered(weekStatuses: (number | null)[], lagPct: number, weeks: number): boolean {
  const last = weekStatuses.filter((x): x is number => x !== null).slice(-weeks)
  return last.length >= weeks && last.every((x) => x < 100 - lagPct)
}
/** KR quý trễ > x% → mở chẩn đoán đầy đủ. */
export const quarterTriggered = (status: number | null, pct: number) => status !== null && status < 100 - pct

/* ---------- Luật điều chỉnh (§11.5) ---------- */
export type ChangeType = 'add' | 'raise' | 'method' | 'lower' | 'cut' | 'stop' | 'pause'
export type CauseGroup = 'a' | 'b' | 'c' | 'd'
export interface ChangeCtx {
  type: ChangeType
  inReview: boolean // đang trong cửa sổ rà
  cause?: CauseGroup | null
  evidence?: string
  lowersThisQuarter: number // số lần hạ của KR này trong quý
  stopsThisQuarter: number // số lần dừng trong quý
  openKrs: number // số KR đang mở của cấp
  mentor?: string
}
export interface ChangeVerdict {
  allowed: boolean
  pending: boolean // áp dụng sau thời gian chờ
  needMentor: boolean
  reason: string
}
export function changeRule(c: ChangeCtx, s: Pick<Settings, 'lower_per_kr_quarter' | 'stop_per_quarter' | 'max_open_kr'>): ChangeVerdict {
  const v = (allowed: boolean, reason: string, pending = false, needMentor = false): ChangeVerdict => ({ allowed, reason, pending, needMentor })
  if (c.type === 'add') return c.openKrs >= s.max_open_kr ? v(false, `Đã đủ ${s.max_open_kr} KR đang mở. Tạm dừng hoặc dừng 1 KR khác trước.`) : v(true, '')
  if (c.type === 'raise' || c.type === 'method' || c.type === 'pause') return v(true, '')
  if (c.type === 'lower' || c.type === 'cut') {
    if (!c.cause) return v(false, 'Chọn nhóm nguyên nhân và ghi số liệu.')
    if (c.cause === 'a') return v(false, 'Nhóm (a) "làm chưa đủ" không được hạ mục tiêu. Chỉ được chọn "Tăng nỗ lực".')
    if (!c.evidence?.trim()) return v(false, 'Ghi số liệu chứng minh.')
    const over = c.lowersThisQuarter >= s.lower_per_kr_quarter
    if (over && !c.mentor?.trim()) return v(false, `KR này đã hạ ${c.lowersThisQuarter} lần trong quý (giới hạn ${s.lower_per_kr_quarter}). Cần ghi tên mentor đã duyệt.`, false, true)
    return v(true, '', !c.inReview && c.cause !== 'd', over)
  }
  // stop
  const over = c.stopsThisQuarter >= s.stop_per_quarter
  if (over && !c.mentor?.trim()) return v(false, `Đã dừng ${c.stopsThisQuarter} lần trong quý (giới hạn ${s.stop_per_quarter}). Cần ghi tên mentor đã duyệt.`, false, true)
  return v(true, '', !c.inReview && c.cause !== 'd', over)
}

/* ---------- Cửa sổ rà (§13) ---------- */
export type LongKind = 'month' | 'quarter' | 'year' | 'kickoff'
/** Buổi rà của kỳ bắt đầu `start`: ngày cuối kỳ hoặc ngày đầu kỳ sau (năm: 1–5/1 năm sau). */
export function reviewWindow(kind: LongKind | 'week', start: string, end?: string): { from: string; to: string } {
  if (kind === 'week') return { from: addDays(start, 6), to: addDays(start, 7) }
  if (kind === 'month') return { from: monthEnd(start), to: addMonths(start, 1) }
  if (kind === 'quarter') return { from: quarterEnd(start), to: addMonths(start, 3) }
  if (kind === 'kickoff') {
    const e = end ?? yearEnd(start)
    return { from: e, to: addDays(e, 5) }
  }
  const ny = String(Number(start.slice(0, 4)) + 1)
  return { from: `${ny}-01-01`, to: `${ny}-01-05` }
}
export const inWindow = (w: { from: string; to: string }, d: string) => d >= w.from && d <= w.to
/** Buổi rà đã qua mà chưa làm Kaizen. */
export const reviewMissed = (w: { to: string }, todayIso: string, done: boolean) => !done && todayIso > w.to

/* ---------- Chốt kế hoạch kỳ dài (§4.5) ---------- */
export function longLockCheck(
  objs: { area: string | null; title: string; smart: Record<string, boolean | undefined> }[],
  krs: { objective_id: string | null; title: string; baseline: number | null; target: number | null; deadline: string | null; source: string; is_team: boolean; status: string }[],
  objIds: Record<string, string>,
  s: Pick<Settings, 'kr_min_cvtc' | 'kr_min_other' | 'kr_max_other' | 'max_open_kr'>,
  opts: { overCapacity: boolean; passive: boolean },
): { blockers: string[]; warnings: string[] } {
  const blockers: string[] = []
  const warnings: string[] = []
  const name = { cv_tc: 'O Công việc/Tài chính', mqh: 'O Mối quan hệ', ttt: 'O Thân–Tâm–Trí' } as Record<string, string>
  const active = krs.filter((k) => k.status !== 'stopped')
  for (const a of ['cv_tc', 'mqh', 'ttt']) {
    const o = objs.find((x) => x.area === a)
    if (!o?.title.trim()) {
      blockers.push(`Chưa viết ${name[a]}.`)
      continue
    }
    const miss = ['S', 'M', 'A', 'R', 'T', 'KRO'].filter((k) => !o.smart?.[k])
    if (miss.length) blockers.push(`${name[a]} còn thiếu tiêu chí: ${miss.map((k) => (k === 'KRO' ? 'KR→O' : k)).join(', ')}.`)
    const ks = active.filter((k) => k.objective_id === objIds[a])
    const min = a === 'cv_tc' ? s.kr_min_cvtc : s.kr_min_other
    if (ks.length < min) blockers.push(`${name[a]} cần ít nhất ${min} KR (đang có ${ks.length}).`)
    if (a !== 'cv_tc' && ks.length > s.kr_max_other) warnings.push(`${name[a]} có ${ks.length} KR, khuyến nghị tối đa ${s.kr_max_other}.`)
  }
  active.forEach((k) => {
    const miss = [k.baseline === null && 'Từ', k.target === null && 'Đến', !k.deadline && 'Hạn', !k.source.trim() && 'Nguồn'].filter(Boolean)
    if (miss.length) blockers.push(`KR "${k.title || 'chưa đặt tên'}" thiếu: ${miss.join(', ')}.`)
  })
  if (active.length > s.max_open_kr) warnings.push(`Đang mở ${active.length} KR, vượt trần ${s.max_open_kr}.`)
  if (opts.overCapacity && !active.some((k) => k.is_team)) blockers.push('Nhịp độ vượt công suất cá nhân: cần ít nhất 1 KR đội ngũ tự vận hành / đòn bẩy.')
  if (opts.passive && !active.some((k) => k.is_team)) blockers.push('O thụ động cần ít nhất 1 KR về đội ngũ tự vận hành.')
  return { blockers, warnings }
}

/* ---------- Trạng thái 1 KR số ---------- */
export interface KrStat {
  actual: number | null
  pct: number | null
  plannedGain: number
  status: number | null
  color: SColor
  weekStatuses: (number | null)[]
  triggered: boolean
}
export function krStat(
  kr: { baseline?: number | null; target?: number | null; deadline?: string | null; cumulative_plan?: { date: string; planned: number }[] },
  entries: { date: string; value: number }[],
  start: string,
  end: string,
  todayIso: string,
  s: Pick<Settings, 'status_red' | 'status_green' | 'trigger_lag_pct' | 'trigger_weeks'>,
  checkpoints: string[] = [],
): KrStat {
  const b = kr.baseline ?? null
  const t = kr.target ?? null
  if (b === null || t === null) return { actual: null, pct: null, plannedGain: 0, status: null, color: 'none', weekStatuses: [], triggered: false }
  const plan = kr.cumulative_plan?.length ? kr.cumulative_plan : [{ date: kr.deadline || end, planned: t - b }]
  const sign = Math.sign(t - b) || 1
  const upTo = todayIso < end ? todayIso : end
  const actual = actualAt(b, entries, upTo)
  const plannedGain = plannedAt(plan, start, upTo)
  const status = statusPct((actual - b) * sign, plannedGain * sign)
  const weekStatuses = checkpoints.filter((d) => d < todayIso).map((d) => statusPct((actualAt(b, entries, d) - b) * sign, plannedAt(plan, start, d) * sign))
  return {
    actual,
    pct: numericPercent(b, t, actual),
    plannedGain,
    status,
    color: statusColor(status, s),
    weekStatuses,
    triggered: lagTriggered(weekStatuses, s.trigger_lag_pct, s.trigger_weeks),
  }
}

export const today0 = () => iso(new Date())
export { parse, monthStart }
