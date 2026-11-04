/** Tải và tính số liệu kỳ dài (Tháng/Quý/Năm/Khởi động) — dùng chung cho trang kỳ dài, Ngày, Tuần, Tổng quan. */
import { errMsg, findPeriods, getPeriod, insert, listIn, objectivesOf } from './db'
import { addDays, addMonths, monthEnd, monthStart } from './dates'
import { krStat, quarterEnd, quarterStart, weekEndsOfMonth, yearEnd, yearStart, type KrStat, type LongKind } from './numeric'
import type { KR, KrActual, Objective, Period, ScheduleItem, ScheduleSeries, Settings } from './types'

export const AREAS = ['cv_tc', 'mqh', 'ttt'] as const
export const AREA_NAME = { cv_tc: 'Công việc / Tài chính', mqh: 'Mối quan hệ', ttt: 'Thân – Tâm – Trí' } as const
export const KIND_NAME = { month: 'Tháng', quarter: 'Quý', year: 'Năm', kickoff: 'Kỳ khởi động' } as const

export function longStart(kind: Exclude<LongKind, 'kickoff'>, date: string) {
  return kind === 'month' ? monthStart(date) : kind === 'quarter' ? quarterStart(date) : yearStart(date)
}
export function longEnd(kind: LongKind, start: string, end?: string | null) {
  return kind === 'month' ? monthEnd(start) : kind === 'quarter' ? quarterEnd(start) : kind === 'year' ? yearEnd(start) : end || yearEnd(start)
}
export function longShift(kind: Exclude<LongKind, 'kickoff'>, start: string, n: number) {
  return addMonths(start, kind === 'month' ? n : kind === 'quarter' ? 3 * n : 12 * n)
}
/** Mốc kiểm tra tình trạng: cuối mỗi tuần (tháng), cuối mỗi tháng (quý, năm, khởi động). */
export function checkpoints(kind: LongKind, start: string, end: string): string[] {
  if (kind === 'month') return weekEndsOfMonth(start)
  const out: string[] = []
  for (let m = start; m <= end; m = addMonths(m, 1)) out.push(monthEnd(m) > end ? end : monthEnd(m))
  return out
}

/** Kỳ khởi động: kỳ có sẵn (nếu có), không thì tạo từ đầu tháng hiện tại đến 31/12. */
export async function getKickoff(uid: string, todayIso: string): Promise<Period> {
  const found = await findPeriods('kickoff', '2000-01-01', '2100-01-01')
  if (found[0]) return found[0]
  return getPeriod(uid, 'kickoff', monthStart(todayIso))
}

/** Bảo đảm kỳ có đủ 3 O theo 3 mảng. */
export async function ensureAreas(uid: string, periodId: string, existing: Objective[]): Promise<Objective[]> {
  const out = [...existing]
  for (const [i, a] of AREAS.entries()) {
    if (!out.some((o) => o.area === a)) out.push(await insert<Objective>('objectives', { user_id: uid, period_id: periodId, area: a, sort: i }))
  }
  return out.filter((o) => o.area).sort((x, y) => x.sort - y.sort)
}

/** Thực tế của từng KR số: nhập tay + thực tế đóng góp tuần + đếm Check của lịch lặp lại (§3.1). */
export async function krEntries(krs: KR[]): Promise<Map<string, { date: string; value: number; source: string }[]>> {
  const out = new Map<string, { date: string; value: number; source: string }[]>()
  const ids = krs.map((k) => k.id)
  if (!ids.length) return out
  const manual = await listIn<KrActual>('kr_actuals', 'kr_id', ids, 'date')
  for (const a of manual) push(out, a.kr_id, { date: a.date, value: Number(a.value), source: a.note || 'nhập tay' })
  const contrib = await listIn<Objective>('objectives', 'contributes_kr_id', ids, 'sort')
  const withActual = contrib.filter((o) => o.weekly_actual !== null)
  if (withActual.length) {
    const wps = await listIn<Period>('periods', 'id', withActual.map((o) => o.period_id), 'start_date')
    for (const o of withActual) {
      const wp = wps.find((p) => p.id === o.period_id)
      if (wp) push(out, o.contributes_kr_id!, { date: addDays(wp.start_date, 6), value: Number(o.weekly_actual), source: 'tuần ' + wp.start_date })
    }
  }
  const seriesIds = krs.map((k) => k.series_id).filter(Boolean) as string[]
  if (seriesIds.length) {
    const [series, items] = await Promise.all([listIn<ScheduleSeries>('schedule_series', 'id', seriesIds, 'created_at'), listIn<ScheduleItem>('schedule_items', 'series_id', seriesIds, 'date')])
    for (const k of krs.filter((x) => x.series_id)) {
      const sr = series.find((x) => x.id === k.series_id)
      for (const it of items.filter((x) => x.series_id === k.series_id && x.done && !x.skipped)) push(out, k.id, { date: it.date, value: Number(sr?.increment ?? 1), source: 'lịch lặp lại' })
    }
  }
  return out
}
function push<T>(m: Map<string, T[]>, k: string, v: T) {
  const a = m.get(k) ?? []
  a.push(v)
  m.set(k, a)
}

export interface ObjSum {
  o: Objective
  krs: { kr: KR; st: KrStat }[]
  pct: number | null
  status: number | null
}
export interface LongSum {
  kind: LongKind
  period: Period | null
  start: string
  end: string
  objs: ObjSum[]
}
const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null)
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
}
export function summarize(kind: LongKind, period: Period | null, start: string, end: string, objs: Objective[], krs: KR[], entries: Map<string, { date: string; value: number }[]>, todayIso: string, s: Settings): LongSum {
  const cps = checkpoints(kind, start, end)
  return {
    kind,
    period,
    start,
    end,
    objs: objs
      .filter((o) => o.area)
      .map((o) => {
        const ks = krs.filter((k) => k.objective_id === o.id && k.status !== 'stopped').map((kr) => ({ kr, st: krStat(kr, entries.get(kr.id) ?? [], start, end, todayIso, s, cps) }))
        return { o, krs: ks, pct: avg(ks.map((x) => x.st.pct)), status: avg(ks.map((x) => x.st.status)) }
      }),
  }
}

/** Chỉ đọc: tóm tắt kỳ dài chứa ngày `date` (không tạo kỳ mới). */
export async function loadLongSummary(kind: Exclude<LongKind, 'kickoff'>, date: string, todayIso: string, s: Settings): Promise<LongSum> {
  const start = longStart(kind, date)
  const end = longEnd(kind, start)
  const [p] = await findPeriods(kind, start, start)
  if (!p) return { kind, period: null, start, end, objs: [] }
  const objs = await objectivesOf([p.id])
  const krs = await listIn<KR>('key_results', 'period_id', [p.id])
  return summarize(kind, p, start, end, objs, krs, await krEntries(krs), todayIso, s)
}
export { errMsg }
