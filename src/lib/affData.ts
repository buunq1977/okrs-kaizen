import type { SupabaseClient } from '@supabase/supabase-js'
import { adCharges, coeffsOf, v2Of, type AffConfig } from './affiliate'
import type { AffData } from './affLink'
import type { AffEntry, AffProject, Tally } from './affProjects'
import { approvalByModel, buildLedger, flagSum, ledgerItems, monthlyMoney, researchProjects, sharedThresholds, type AhData, type SharedThresholds, type WsData, type WsProject, type WsReg, type WsRun, type WsSettings, type WsType } from './affSource'
import { listAll } from './db'
import { addDays, today as todayIso } from './dates'
import { ahClient, supabase, wsClient } from './supabase'

/** Tải dữ liệu cho OKR / Kaizen (KR tự đếm, nhịp, đo lường, chẩn đoán).
 *  Đã kết nối Research → dựng từ Research + Ads-Hub (GĐ5); chưa kết nối → Sổ nhập tay cũ. Bộ nhớ đệm 60 giây để nhiều khối trên một trang không tải lặp. */
let cache: { at: number; p: Promise<AffData> } | null = null
export function loadAffData(force = false): Promise<AffData> {
  if (!force && cache && Date.now() - cache.at < 60e3) return cache.p
  const p = loadAffDataNow()
  cache = { at: Date.now(), p }
  p.catch(() => (cache = null))
  return p
}
async function readCfg(): Promise<AffConfig[]> {
  if (!supabase) return []
  const { data } = await supabase.from('aff_config').select('*').maybeSingle()
  return data ? [data as AffConfig] : []
}
async function loadAffDataNow(): Promise<AffData> {
  const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[])
  const [projects, tallies, entries, cfgs] = await Promise.all([
    safe(listAll<AffProject>('aff_projects')),
    safe(listAll<Tally>('aff_tallies', 'date')),
    safe(listAll<AffEntry>('aff_entries', 'date')),
    readCfg().catch(() => [] as AffConfig[]),
  ])
  const cfg = cfgs[0]
  const v = v2Of(cfg ?? {})
  const costMult = adCharges(1, v.fee_pct, v.tax_pct).mult
  // dòng nối Research (ws_reg_id) chỉ giữ checklist / lý do, không phải dự án nhập tay → không đếm
  const manual: AffData = { projects: projects.filter((p) => !p.ws_reg_id), tallies, entries, source: 'manual', costMult }
  const ws = await loadWs().catch(() => null)
  if (!ws?.data) return manual
  const t0 = todayIso()
  const ah = await loadAh(addDays(t0, -399), t0).catch(() => null)
  const ahD = ah?.data ?? null
  const th = sharedThresholds(ws.data, ahD)
  const ledger = buildLedger(ws.data, ahD)
  const base: AffConfig = cfg ?? ({ phys: {}, saas: {}, test_cap_mult: 2, win_min_orders: 3 } as unknown as AffConfig)
  const co = coeffsOf({ coeffs: null }, base, { max_test_usd: th.max_test_usd })
  const appr = ahD ? approvalByModel(ahD, ws.data, t0, { phys: co.phys.payout_days, tools_ai: co.tools.payout_days, saas: co.saas.payout_days }) : null
  const links = projects.filter((p) => p.ws_reg_id)
  const items = ledgerItems(ledger, links, th, { capMult: base.test_cap_mult ?? 2, testCost: co.phys.test_cost, roa: co.phys.roas, winner: base.win_min_orders ?? 3 }, ahD, appr, t0)
  const r = researchProjects(ws.data, ahD, ledger, (id) => links.find((l) => l.ws_reg_id === id)?.ext_reason ?? '')
  return {
    projects: r.projects as unknown as AffProject[],
    entries: r.entries as unknown as AffEntry[],
    tallies,
    source: 'research',
    costMult,
    flags: flagSum(items),
    money: ahD ? monthlyMoney(ahD) : [],
    appr,
    ws: ws.data,
    ah: ahD,
    today: t0,
  }
}

/* ---------- Nguồn số ngoài: Research + Ads-Hub (chỉ đọc) ---------- */
export type SrcKey = 'ws' | 'ah'
export const SRC: Record<SrcKey, { name: string; client: SupabaseClient | null; sql: string; member: string }> = {
  ws: { name: 'Research', client: wsClient, sql: 'workspace/supabase/09_reg_dates.sql', member: 'ws_users' },
  ah: { name: 'Ads-Hub', client: ahClient, sql: 'ads-hub/supabase/12_okr_read.sql', member: 'dash_users' },
}
export interface SrcResult<T> {
  data: T | null
  error: string | null // lỗi chặn (chưa đăng nhập, không có quyền…)
  needSql: boolean // app nguồn chưa chạy file SQL cho OKR
}

export async function srcEmail(k: SrcKey): Promise<string | null> {
  const c = SRC[k].client
  if (!c) return null
  const s = (await c.auth.getSession()).data.session
  return s?.user.email ?? null
}
export async function srcSignIn(k: SrcKey, email: string, password: string) {
  const c = SRC[k].client
  if (!c) throw new Error(`Chưa cấu hình kết nối ${SRC[k].name}.`)
  const { error } = await c.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(/invalid/i.test(error.message) ? `Sai email hoặc mật khẩu ${SRC[k].name}.` : error.message)
}
export async function srcSignOut(k: SrcKey) {
  await SRC[k].client?.auth.signOut()
}

async function pageAll<T>(c: SupabaseClient, table: string, cols: string, order = 'id'): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await c.from(table).select(cols).order(order).range(from, from + 999)
    if (error) throw error
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}
const msgOf = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e))
const codeOf = (e: unknown) => (e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '')

/** Đọc Research: Cài đặt tính toán, loại dự án, dự án, đăng ký, lần test. Chỉ lấy cột cần (không lấy email, PayPal…). */
export async function loadWs(): Promise<SrcResult<WsData>> {
  const c = wsClient
  if (!c) return { data: null, error: 'Chưa cấu hình kết nối Research (thiếu VITE_WS_URL / VITE_WS_KEY).', needSql: false }
  if (!(await srcEmail('ws'))) return { data: null, error: 'Chưa đăng nhập Research.', needSql: false }
  try {
    const member = await c.rpc('is_ws_user')
    if (member.error) throw member.error
    if (member.data !== true) return { data: null, error: 'Email này chưa có trong danh sách người dùng Research (ws_users).', needSql: false }
    const regBase = 'id, project_id, ref_key, reg_status, test_status, test_result, created_at'
    let hasDates = true
    let regs: WsReg[]
    try {
      regs = await pageAll<WsReg>(c, 'registrations', regBase + ', registered_on, approved_on, rejected_on')
    } catch (e) {
      if (codeOf(e) !== '42703' && !/registered_on/.test(msgOf(e))) throw e
      hasDates = false
      regs = await pageAll<WsReg>(c, 'registrations', regBase)
    }
    const [settings, types, projects, runs] = await Promise.all([
      c.from('settings').select('max_test_usd, usd_vnd, roa_hoa, roa_lai, roa_lai_tot, updated_at').eq('id', 1).maybeSingle(),
      pageAll<WsType>(c, 'project_types', 'code, name, tier_low_vnd, tier_high_vnd, clicks_low, clicks_mid, clicks_high, active', 'sort'),
      pageAll<WsProject>(c, 'projects', 'id, name, type_code, trial_days, created_at'),
      pageAll<WsRun>(c, 'test_runs', 'id, registration_id, started_on, cost_usd, clicks'),
    ])
    if (settings.error) throw settings.error
    return { data: { settings: (settings.data as WsSettings | null) ?? null, types, projects, regs, runs, hasDates }, error: null, needSql: !hasDates }
  } catch (e) {
    return { data: null, error: 'Research: ' + msgOf(e), needSql: false }
  }
}

/** Đọc nhanh ngưỡng dùng chung (tỷ giá, maxtest, ROA, Click/Sale ở Research; Winner ≥ N đơn ở Ads-Hub).
 *  Chưa kết nối hoặc lỗi → trường tương ứng null (mô hình dùng số đang lưu ở OKR). */
export async function loadThresholds(): Promise<SharedThresholds> {
  let ws: Pick<WsData, 'settings' | 'types'> | null = null
  let ah: Pick<AhData, 'settings'> | null = null
  try {
    if (wsClient && (await srcEmail('ws'))) {
      const [s, t] = await Promise.all([
        wsClient.from('settings').select('max_test_usd, usd_vnd, roa_hoa, roa_lai, roa_lai_tot, updated_at').eq('id', 1).maybeSingle(),
        wsClient.from('project_types').select('code, name, tier_low_vnd, tier_high_vnd, clicks_low, clicks_mid, clicks_high, active').order('sort'),
      ])
      if (!s.error && !t.error) ws = { settings: (s.data as WsSettings | null) ?? null, types: (t.data ?? []) as WsType[] }
    }
  } catch {
    ws = null
  }
  try {
    if (ahClient && (await srcEmail('ah'))) {
      const d = new Date().toISOString().slice(0, 10)
      const { data, error } = await ahClient.rpc('okr_daily', { p_from: d, p_to: d })
      if (!error && data) ah = { settings: (data as AhData).settings }
    }
  } catch {
    ah = null
  }
  return sharedThresholds(ws, ah)
}

/** Đọc Ads-Hub qua hàm chỉ đọc okr_daily(từ, đến). */
export async function loadAh(from: string, to: string): Promise<SrcResult<AhData>> {
  const c = ahClient
  if (!c) return { data: null, error: 'Chưa cấu hình kết nối Ads-Hub (thiếu VITE_ADSHUB_URL / VITE_ADSHUB_KEY).', needSql: false }
  if (!(await srcEmail('ah'))) return { data: null, error: 'Chưa đăng nhập Ads-Hub.', needSql: false }
  const { data, error } = await c.rpc('okr_daily', { p_from: from, p_to: to })
  if (error) {
    if (codeOf(error) === 'PGRST202' || /okr_daily/.test(error.message)) return { data: null, error: null, needSql: true }
    if (codeOf(error) === '42501' || /cấp quyền/.test(error.message)) return { data: null, error: 'Email này chưa có trong danh sách người xem Ads-Hub (dash_users).', needSql: false }
    return { data: null, error: 'Ads-Hub: ' + error.message, needSql: false }
  }
  return { data: data as AhData, error: null, needSql: false }
}
