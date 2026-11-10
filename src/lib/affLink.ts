/* Nối OKR với Sổ dự án Affiliate: chỉ tiêu theo cấp, chuỗi số liệu theo ngày cho KR/KA tự đếm. Logic thuần. */
import { analyze, ceilCount, monthOf, targetsFor, type AffConfig, type AffMonth } from './affiliate'
import type { AffEntry, AffProject, Model, Stage, Tally } from './affProjects'
import { addMonths, isoDow } from './dates'
import type { AffMetric } from './types'

export const METRIC_NAME: Record<AffMetric, string> = {
  search: 'Search dự án',
  chon: 'Chọn dự án',
  dang_ky: 'Đăng ký',
  duyet: 'Duyệt link',
  test: 'Lên camp test',
  win: 'Camp thắng',
  profit: 'Lợi nhuận đã nhận',
}
export const METRIC_UNIT: Record<AffMetric, string> = { search: 'dự án', chon: 'dự án', dang_ky: 'dự án', duyet: 'dự án', test: 'camp', win: 'camp', profit: '$' }
const STAGE_OF: Partial<Record<AffMetric, Stage>> = { chon: 'dat_loc', dang_ky: 'dang_ky', duyet: 'duoc_duyet', test: 'test', win: 'win' }

export interface AffData {
  projects: AffProject[]
  tallies: Tally[]
  entries: AffEntry[]
}
/** Chuỗi (ngày, giá trị) của 1 chỉ số: search từ bộ đếm, các bước từ ngày vào giai đoạn, lợi nhuận = Thực nhận − Chi phí. */
export function metricSeries(metric: AffMetric, d: AffData, model?: Model | null): { date: string; value: number }[] {
  const ok = (m: Model) => !model || m === model
  if (metric === 'search') return d.tallies.filter((t) => ok(t.model)).map((t) => ({ date: t.date, value: Number(t.count) }))
  if (metric === 'profit') {
    const pm = new Map(d.projects.map((p) => [p.id, p.model]))
    return d.entries.filter((e) => ok(pm.get(e.project_id) ?? 'phys')).map((e) => ({ date: e.date, value: Number(e.received) - Number(e.cost) }))
  }
  const st = STAGE_OF[metric]!
  return d.projects.filter((p) => ok(p.model) && p.dates[st]).map((p) => ({ date: p.dates[st]!, value: 1 }))
}
export const metricSum = (metric: AffMetric, d: AffData, from: string, to: string, model?: Model | null) =>
  metricSeries(metric, d, model)
    .filter((x) => x.date >= from && x.date <= to)
    .reduce((s, x) => s + x.value, 0)

/** Chia chỉ tiêu tuần (số nguyên) cho từng ngày làm: đủ tổng, không có số lẻ. dayIndex: 0 = Thứ Hai. */
export function dayShare(weekTotal: number, workDays: number, dayIndex: number): number {
  const w = ceilCount(weekTotal)
  if (dayIndex >= workDays) return 0
  const base = Math.floor(w / workDays)
  return base + (dayIndex < w % workDays ? 1 : 0)
}

export type Level = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'kickoff'
export interface KpiTargets {
  search: number
  dang_ky: number
  test: number
  win: number | null // chỉ từ cấp Tháng; null khi < 1
  profit: number | null // LN mục tiêu tháng cuối kỳ (> 0)
}
/** Các tháng (YYYY-MM-01) nằm trong [start, end]. */
export function monthsIn(start: string, end: string): string[] {
  const out: string[] = []
  for (let m = monthOf(start); m <= end; m = addMonths(m, 1)) out.push(m)
  return out
}
/** Chỉ tiêu tối thiểu (theo ngân sách) của 1 kỳ, số nguyên. `start`: ngày đầu kỳ (Ngày: chính ngày đó; Tuần: thứ Hai). */
export function kpiTargets(level: Level, start: string, end: string, rows: AffMonth[], cfg: AffConfig, today: string): KpiTargets {
  const a = analyze(rows, cfg, today)
  if (level === 'day' || level === 'week') {
    const monday = level === 'week' ? start : start // tuần lấy theo tháng chứa ngày đầu
    const w = targetsFor([monthOf(monday)], a, rows, cfg, 'week')
    if (level === 'week') return { search: ceilCount(w.research[0]), dang_ky: ceilCount(w.reg[0]), test: ceilCount(w.tests[0]), win: null, profit: null }
    const i = isoDow(start) - 1
    const wd = cfg.working_days_week
    return { search: dayShare(w.research[0], wd, i), dang_ky: dayShare(w.reg[0], wd, i), test: dayShare(w.tests[0], wd, i), win: null, profit: null }
  }
  const t = targetsFor(monthsIn(start, end), a, rows, cfg, 'year')
  const win = t.wins ? Math.round(t.wins[0]) : 0
  return {
    search: ceilCount(t.research[0]),
    dang_ky: ceilCount(t.reg[0]),
    test: ceilCount(t.tests[0]),
    win: win >= 1 ? win : null,
    profit: t.profit && t.profit > 0 ? t.profit : null,
  }
}
/** Tự tick KA: đạt khi số đếm ≥ chỉ tiêu; chỉ bỏ tick những KA do app tự tick. */
export function affTickChanges(kas: { id: string; done: boolean; auto_ticked: boolean; aff_metric?: AffMetric | null; aff_target?: number | null }[], count: (m: AffMetric) => number) {
  const out: { id: string; done: boolean; auto_ticked: boolean }[] = []
  for (const k of kas) {
    if (!k.aff_metric || k.aff_target === null || k.aff_target === undefined) continue
    const reach = count(k.aff_metric) >= k.aff_target
    if (reach && !k.done) out.push({ id: k.id, done: true, auto_ticked: true })
    else if (!reach && k.done && k.auto_ticked) out.push({ id: k.id, done: false, auto_ticked: false })
  }
  return out
}
