import { supabase } from './supabase'
import type { Action, Goal, KR, Metric, Period, PeriodKind, Settings, Task, Vision } from './types'

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
  if (/periods_max_3_active/.test(msg)) return 'Mỗi tháng chỉ kích hoạt tối đa 3 mục tiêu.'
  if (/violates check constraint .*target/.test(msg)) return 'Con số mục tiêu phải lớn hơn 0.'
  if (/null value in column/.test(msg)) return 'Còn thiếu ô bắt buộc.'
  return msg
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

type Table = 'visions' | 'goals' | 'metrics' | 'periods' | 'krs' | 'tasks' | 'actions' | 'settings'

export async function insert<T>(table: Table, row: Record<string, unknown>): Promise<T> {
  return must(await sb().from(table).insert(row).select().single())
}
export async function update<T>(table: Table, id: string, patch: Record<string, unknown>): Promise<T> {
  return must(await sb().from(table).update(patch).eq('id', id).select().single())
}
export async function remove(table: Table, id: string) {
  must(await sb().from(table).delete().eq('id', id))
}

/* ---------- periods ---------- */
export async function getPeriod(uid: string, kind: PeriodKind, start: string): Promise<Period> {
  const found = must(await sb().from('periods').select('*').eq('kind', kind).eq('start_date', start).maybeSingle())
  if (found) return found as Period
  return must(
    await sb()
      .from('periods')
      .upsert({ user_id: uid, kind, start_date: start }, { onConflict: 'user_id,kind,start_date' })
      .select()
      .single(),
  )
}
export async function listPeriods(kind: PeriodKind, from: string, to: string): Promise<Period[]> {
  return must(await sb().from('periods').select('*').eq('kind', kind).gte('start_date', from).lte('start_date', to))
}

/* ---------- goals ---------- */
export async function listVisions(): Promise<Vision[]> {
  return must(await sb().from('visions').select('*').order('target_year'))
}
export async function listGoals(): Promise<Goal[]> {
  return must(await sb().from('goals').select('*').order('created_at'))
}
export async function listMetrics(): Promise<Metric[]> {
  return must(await sb().from('metrics').select('*').order('created_at'))
}

/* ---------- krs / tasks / actions ---------- */
export async function listKrs(periodIds: string[]): Promise<KR[]> {
  if (!periodIds.length) return []
  return must(await sb().from('krs').select('*').in('period_id', periodIds).order('sort').order('created_at'))
}
export async function listChildKrs(parentIds: string[]): Promise<KR[]> {
  if (!parentIds.length) return []
  return must(await sb().from('krs').select('*').in('parent_kr_id', parentIds))
}
export async function listTasks(periodIds: string[]): Promise<Task[]> {
  if (!periodIds.length) return []
  return must(await sb().from('tasks').select('*').in('period_id', periodIds).order('sort').order('created_at'))
}
export async function listTasksByKr(krIds: string[]): Promise<Task[]> {
  if (!krIds.length) return []
  return must(await sb().from('tasks').select('*').in('kr_id', krIds))
}
export async function listActions(periodId: string): Promise<Action[]> {
  return must(await sb().from('actions').select('*').eq('period_id', periodId).order('created_at'))
}
export async function listCarried(periodId: string): Promise<Action[]> {
  return must(await sb().from('actions').select('*').eq('push_to_period_id', periodId).order('created_at'))
}

/** Tổng số thực tế của từng KR tuần (từ việc trong ngày) và từng KR tháng (từ KR tuần con). */
export async function krActuals(krs: KR[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!krs.length) return out
  const children = await listChildKrs(krs.map((k) => k.id))
  const leafIds = [...krs.map((k) => k.id), ...children.map((c) => c.id)]
  const tasks = await listTasksByKr(leafIds)
  const sumBy = new Map<string, number>()
  for (const t of tasks) if (t.kr_id) sumBy.set(t.kr_id, (sumBy.get(t.kr_id) ?? 0) + (t.actual ?? 0))
  for (const k of krs) {
    const own = sumBy.get(k.id) ?? 0
    const fromChildren = children.filter((c) => c.parent_kr_id === k.id).reduce((a, c) => a + (sumBy.get(c.id) ?? 0), 0)
    out.set(k.id, own + fromChildren)
  }
  return out
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

/* ---------- export ---------- */
export async function exportAll() {
  const tables: Table[] = ['visions', 'goals', 'metrics', 'periods', 'krs', 'tasks', 'actions', 'settings']
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), version: 1 }
  for (const t of tables) out[t] = must(await sb().from(t).select('*'))
  return out
}
