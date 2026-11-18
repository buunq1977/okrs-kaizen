/* Nối OKR với Sổ dự án Affiliate: chỉ tiêu theo cấp, chuỗi số liệu theo ngày cho KR/KA tự đếm. Logic thuần. */
import { analyze, ceilCount, gateOf, monthOf, targetsFor, type AffConfig, type AffMonth, type GateInfo, type Live } from './affiliate'
import type { AffEntry, AffProject, Model, Stage, Tally } from './affProjects'
import type { AhData, ApprovalStat, FlagSum, Model3, WsData } from './affSource'
import { addMonths, isoDow } from './dates'
import type { AffMetric } from './types'

export const METRIC_NAME: Record<AffMetric, string> = {
  search: 'Search dự án',
  chon: 'Chọn dự án',
  dang_ky: 'Đăng ký',
  duyet: 'Duyệt link',
  test: 'Lên camp test',
  win: 'Camp thắng',
  profit: 'Lợi nhuận đã nhận (sau phí, thuế)',
  scale_ready: 'Dự án đủ điều kiện scale',
}
export const METRIC_UNIT: Record<AffMetric, string> = { search: 'dự án', chon: 'dự án', dang_ky: 'dự án', duyet: 'dự án', test: 'camp', win: 'camp', profit: '$', scale_ready: 'dự án' }
const STAGE_OF: Partial<Record<AffMetric, Stage>> = { chon: 'dat_loc', dang_ky: 'dang_ky', duyet: 'duoc_duyet', test: 'test', win: 'win' }

export interface AffData {
  projects: AffProject[]
  tallies: Tally[]
  entries: AffEntry[]
  /* GĐ5: nguồn số. 'research' = dựng từ Research + Ads-Hub; 'manual' = Sổ nhập tay cũ (chưa kết nối). */
  source?: 'manual' | 'research'
  costMult?: number // tiền phải nạp ÷ chi tiêu ads (phí Invoice + thuế), để lợi nhuận đã nhận là sau phí, thuế
  flags?: FlagSum // cờ của Sổ dự án (Research + Ads-Hub)
  money?: { month: string; cost: number; received: number }[] // tiền theo tháng từ Ads-Hub (cho cổng)
  appr?: Record<Model3, ApprovalStat> | null
  ws?: WsData | null
  ah?: AhData | null
  today?: string
}
/** Cổng bằng chứng từ dữ liệu đã tải; null khi chưa có số Research + Ads-Hub (dùng chỉ tiêu theo mô hình như cũ). */
export function gateFromData(d: AffData | null, cfg: AffConfig): GateInfo | null {
  if (!d || d.source !== 'research' || !d.flags) return null
  return gateOf(d.flags.ready, d.money ?? [], cfg)
}
/** Chuỗi (ngày, giá trị) của 1 chỉ số: search từ bộ đếm, các bước từ ngày vào giai đoạn, lợi nhuận = Thực nhận − Chi phí. */
export function metricSeries(metric: AffMetric, d: AffData, model?: Model | null): { date: string; value: number }[] {
  const ok = (m: Model) => !model || m === model
  if (metric === 'search') return d.tallies.filter((t) => ok(t.model)).map((t) => ({ date: t.date, value: Number(t.count) }))
  if (metric === 'profit') {
    // lợi nhuận đã nhận = hoa hồng đã duyệt / đã trả − tiền nạp Ads (chi tiêu × phí, thuế)
    const pm = new Map(d.projects.map((p) => [p.id, p.model]))
    const k = d.costMult ?? 1
    return d.entries.filter((e) => ok(pm.get(e.project_id) ?? 'phys')).map((e) => ({ date: e.date, value: Number(e.received) - Number(e.cost) * k }))
  }
  if (metric === 'scale_ready') return d.flags && d.today ? [{ date: d.today, value: d.flags.ready }] : []
  const st = STAGE_OF[metric]!
  return d.projects.filter((p) => ok(p.model) && p.dates[st]).map((p) => ({ date: p.dates[st]!, value: 1 }))
}
export const metricSum = (metric: AffMetric, d: AffData, from: string, to: string, model?: Model | null) =>
  metricSeries(metric, d, model)
    .filter((x) => x.date >= from && x.date <= to)
    .reduce((s, x) => s + x.value, 0)

/** Số thực tế của 1 tháng để lưu bản chụp khi chốt sổ (Kaizen tháng đã chốt đọc bản chụp, không đổi theo dữ liệu về sau). */
export interface MonthActuals {
  source: 'manual' | 'research'
  at: string
  counts: Record<'search' | 'chon' | 'dang_ky' | 'duyet' | 'test' | 'win' | 'profit', number>
  money: { cost: number; received: number } | null
  flags: FlagSum | null
}
export function monthActuals(d: AffData, month: string, monthEndIso: string, at: string): MonthActuals {
  const ks = ['search', 'chon', 'dang_ky', 'duyet', 'test', 'win', 'profit'] as const
  const mm = d.money?.find((x) => x.month === month)
  return {
    source: d.source ?? 'manual',
    at,
    counts: Object.fromEntries(ks.map((k) => [k, Math.round(metricSum(k, d, month, monthEndIso) * 100) / 100])) as MonthActuals['counts'],
    money: mm ? { cost: mm.cost, received: mm.received } : null,
    flags: d.flags ?? null,
  }
}

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
/** Chỉ tiêu tối thiểu (theo ngân sách) của 1 kỳ, số nguyên. `start`: ngày đầu kỳ (Ngày: chính ngày đó; Tuần: thứ Hai).
 *  paceMonth (GĐ4–5): đang ở Cổng 0 thì chỉ tiêu test lấy theo nhịp khối lượng (N test/tháng), search / đăng ký theo phễu; chưa đặt lợi nhuận. */
export function kpiTargets(level: Level, start: string, end: string, rows: AffMonth[], cfg: AffConfig, today: string, live: Live = {}, paceMonth: number | null = null): KpiTargets {
  if (paceMonth && paceMonth > 0) {
    const months = level === 'day' || level === 'week' ? 1 : monthsIn(start, end).length
    const perMonth = paceMonth
    if (level === 'week' || level === 'day') {
      const w = (perMonth * 12) / 52
      if (level === 'week') return { search: ceilCount(w * cfg.research_per_test), dang_ky: ceilCount(w * cfg.reg_per_test), test: ceilCount(w), win: null, profit: null }
      const i = isoDow(start) - 1
      const wd = cfg.working_days_week
      return { search: dayShare(w * cfg.research_per_test, wd, i), dang_ky: dayShare(w * cfg.reg_per_test, wd, i), test: dayShare(w, wd, i), win: null, profit: null }
    }
    const tests = perMonth * months
    return { search: ceilCount(tests * cfg.research_per_test), dang_ky: ceilCount(tests * cfg.reg_per_test), test: ceilCount(tests), win: null, profit: null }
  }
  const a = analyze(rows, cfg, today, live)
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
