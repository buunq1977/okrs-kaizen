import { supabase } from './supabase'
import type { Goal, Metric, Objective, Period, PeriodKind, ScheduleSeries, Settings, Vision } from './types'

export type Table =
  | 'visions' | 'goals' | 'metrics'
  | 'periods' | 'objectives' | 'schedule_series' | 'key_results' | 'key_actions' | 'schedule_items' | 'observations' | 'next_actions' | 'validations'
  | 'settings'

function sb() {
  if (!supabase) throw new Error('Chưa cấu hình Supabase')
  return supabase
}
function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(viDbError(r.error.message))
  return r.data as T
}
export function viDbError(msg: string) {
  if (/goals_target_differs/.test(msg)) return 'Mục tiêu phải khác điểm xuất phát.'
  if (/goals_drop_needs_reason/.test(msg)) return 'Bỏ mục tiêu phải ghi lý do.'
  if (/link_reason/.test(msg)) return 'Đánh dấu "liên quan" phải ghi lý do.'
  if (/override_reason/.test(msg)) return 'Chỉnh % tay phải ghi lý do.'
  if (/settings_thresholds/.test(msg)) return 'Ngưỡng đỏ phải nhỏ hơn ngưỡng đạt.'
  if (/settings_kr_range/.test(msg)) return 'Số KR tối đa phải ≥ số KR tối thiểu.'
  if (/Đã đủ 5 mục tiêu/.test(msg)) return msg
  if (/null value in column/.test(msg)) return 'Còn thiếu ô bắt buộc.'
  if (/permission denied/.test(msg)) return msg + ' (chạy lại các file SQL trong supabase/migrations)'
  if (/relation .* does not exist|schema cache/.test(msg)) return msg + ' (chưa chạy file SQL mới nhất trong supabase/migrations)'
  return msg
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function insert<T>(table: Table, row: Record<string, unknown>): Promise<T> {
  return must(await sb().from(table).insert(row).select().single())
}
export async function update(table: Table, id: string, patch: Record<string, unknown>) {
  must(await sb().from(table).update(patch).eq('id', id))
}
export async function remove(table: Table, id: string) {
  must(await sb().from(table).delete().eq('id', id))
}
export async function listBy<T>(table: Table, col: string, val: string, order = 'sort'): Promise<T[]> {
  return must(await sb().from(table).select('*').eq(col, val).order(order).order('created_at'))
}
export async function listIn<T>(table: Table, col: string, vals: string[], order = 'sort'): Promise<T[]> {
  if (!vals.length) return []
  return must(await sb().from(table).select('*').in(col, vals).order(order).order('created_at'))
}

/* ---------- periods ---------- */
export async function getPeriod(uid: string, kind: PeriodKind, start: string): Promise<Period> {
  const found = must(await sb().from('periods').select('*').eq('kind', kind).eq('start_date', start).maybeSingle())
  if (found) return found as Period
  return must(
    await sb().from('periods').upsert({ user_id: uid, kind, start_date: start }, { onConflict: 'user_id,kind,start_date' }).select().single(),
  )
}
/** Chỉ đọc, không tạo kỳ mới. */
export async function findPeriods(kind: PeriodKind, from: string, to: string): Promise<Period[]> {
  return must(await sb().from('periods').select('*').eq('kind', kind).gte('start_date', from).lte('start_date', to).order('start_date'))
}

/* ---------- tiêu điểm O ---------- */
/** O duy nhất của kỳ Ngày/Tuần: lấy hoặc tạo. */
export async function getMainObjective(uid: string, periodId: string): Promise<Objective> {
  const found = must(await sb().from('objectives').select('*').eq('period_id', periodId).is('area', null).maybeSingle())
  if (found) return found as Objective
  return must(await sb().from('objectives').insert({ user_id: uid, period_id: periodId }).select().single())
}
/** O của các kỳ (chỉ đọc). */
export async function objectivesOf(periodIds: string[]): Promise<Objective[]> {
  if (!periodIds.length) return []
  return must(await sb().from('objectives').select('*').in('period_id', periodIds).order('sort'))
}

/* ---------- lịch lặp lại ---------- */
export async function seriesActiveOn(date: string): Promise<ScheduleSeries[]> {
  return must(await sb().from('schedule_series').select('*').lte('start_date', date).or(`end_date.is.null,end_date.gte.${date}`).order('time_from'))
}

/* ---------- tầng mục tiêu ưu tiên (bỏ ở giai đoạn Tầm nhìn, C12) ---------- */
export async function listVisions(): Promise<Vision[]> {
  return must(await sb().from('visions').select('*').order('target_year'))
}
export async function listGoals(): Promise<Goal[]> {
  return must(await sb().from('goals').select('*').order('created_at'))
}
export async function listMetrics(): Promise<Metric[]> {
  return must(await sb().from('metrics').select('*').order('created_at'))
}

/* ---------- settings ---------- */
export async function getSettings(uid: string): Promise<Settings> {
  const found = must(await sb().from('settings').select('*').maybeSingle())
  if (found) return found as Settings
  return must(await sb().from('settings').upsert({ user_id: uid }, { onConflict: 'user_id' }).select().single())
}
export async function saveSettings(s: Settings): Promise<Settings> {
  const { user_id, ...rest } = s
  return must(await sb().from('settings').update({ ...rest, updated_at: new Date().toISOString() }).eq('user_id', user_id).select().single())
}

/* ---------- xuất toàn bộ ---------- */
export async function exportAll() {
  const tables: Table[] = ['visions', 'goals', 'metrics', 'periods', 'objectives', 'schedule_series', 'key_results', 'key_actions', 'schedule_items', 'observations', 'next_actions', 'validations', 'settings']
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), version: 3 }
  for (const t of tables) out[t] = must(await sb().from(t).select('*'))
  return out
}
