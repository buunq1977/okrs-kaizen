/* Nguồn số ngoài OKR (chỉ đọc): Research (app workspace) và Ads-Hub. Logic thuần, không gọi DB.
   - Research: dự án, đăng ký (ngày đăng ký / duyệt link / từ chối), lần test, Cài đặt tính toán (tỷ giá, maxtest, ROA, Click/Sale).
   - Ads-Hub: chi phí + click theo ngày từng camp, hoa hồng theo ngày × trạng thái, camp ↔ link affiliate (ref_key).
   Ghép Research ↔ Ads-Hub bằng ref_key (cùng quy tắc ở cả hai app). Ngày tính theo giờ Việt Nam. */

export type Model3 = 'phys' | 'tools_ai' | 'saas'
export const MODEL3: Model3[] = ['phys', 'tools_ai', 'saas']
export const MODEL3_NAME: Record<Model3, string> = {
  phys: 'Vật lý',
  tools_ai: 'Tools AI',
  saas: 'SaaS',
}
/** Loại dự án của Research → mô hình OKR. Loại khác/trống → null (không xếp vào mô hình nào). */
export const modelOfType = (code?: string | null): Model3 | null => (code === 'vat_ly' ? 'phys' : code === 'tools_ai' || code === 'saas' ? code : null)

/* ---------- Research ---------- */
export interface WsSettings {
  max_test_usd: number
  usd_vnd: number
  roa_hoa: number
  roa_lai: number
  roa_lai_tot: number
  updated_at?: string
}
export interface WsType {
  code: string
  name: string
  tier_low_vnd: number
  tier_high_vnd: number
  clicks_low: number
  clicks_mid: number
  clicks_high: number
  active: boolean
}
export interface WsProject {
  id: number
  name: string
  type_code: string | null
  trial_days: number | null
  created_at: string
}
export type RegStatus = 'Chưa đăng ký' | 'Pending approval' | 'Active' | 'Rejected'
export interface WsReg {
  id: number
  project_id: number
  ref_key: string | null
  reg_status: RegStatus | string
  test_status: string
  created_at: string
  registered_on?: string | null
  approved_on?: string | null
  rejected_on?: string | null
}
export interface WsRun {
  id: number
  registration_id: number
  started_on: string | null
  cost_usd: number | null
  clicks: number | null
}
export interface WsData {
  settings: WsSettings | null
  types: WsType[]
  projects: WsProject[]
  regs: WsReg[]
  runs: WsRun[]
  /** Research đã chạy 09_reg_dates.sql (có ngày đăng ký / duyệt / từ chối). */
  hasDates: boolean
}

/* ---------- Ads-Hub ---------- */
export type OrderStatus = 'pending' | 'approved' | 'paid' | 'denied'
export const ORDER_STATUSES: OrderStatus[] = ['pending', 'approved', 'paid', 'denied']
export interface AhSpend {
  d: string
  camp: string
  cust: string
  cost: number | null // USD; null khi Ads-Hub chưa có tỷ giá cho tài khoản
  clicks: number
}
export interface AhOrder {
  d: string
  camp: string | null // null = đơn chưa ghép được camp
  status: OrderStatus
  n: number
  comm: number
}
export interface AhCamp {
  camp: string
  cust: string
  ref_key: string | null
  name: string | null
  first_seen: string | null
}
export interface AhSettings {
  max_test_usd?: number
  winner_orders?: number
  roa_hoa?: number
  roa_lai?: number
  roa_lai_tot?: number
}
export interface AhData {
  spend: AhSpend[]
  orders: AhOrder[]
  camps: AhCamp[]
  settings: AhSettings | null
}

/** Ngày giờ (ISO, có múi giờ) → ngày theo giờ Việt Nam (UTC+7), dạng YYYY-MM-DD. */
export function vnDate(ts: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(ts)) return ts
  const t = Date.parse(ts)
  if (!Number.isFinite(t)) return ts.slice(0, 10)
  return new Date(t + 7 * 3600e3).toISOString().slice(0, 10)
}
const inRange = (d: string | null | undefined, from: string, to: string) => !!d && d >= from && d <= to

/** Dự án Research → mô hình (qua loại dự án). */
const projectModels = (ws: Pick<WsData, 'projects'>) => new Map(ws.projects.map((p) => [p.id, modelOfType(p.type_code)]))

/** Ngày lên camp test của mỗi đăng ký = ngày bắt đầu sớm nhất trong các lần test. */
export function firstTestDay(runs: Pick<WsRun, 'registration_id' | 'started_on'>[]): Map<number, string> {
  const m = new Map<number, string>()
  for (const r of runs) {
    if (!r.started_on) continue
    const cur = m.get(r.registration_id)
    if (!cur || r.started_on < cur) m.set(r.registration_id, r.started_on)
  }
  return m
}

/* ---------- Đếm đầu vào (KR/KA) từ Research ---------- */
export interface WsCounts {
  chon: number // dự án mới vào Research
  dang_ky: number | null // null = Research chưa có ngày đăng ký (chưa chạy 09)
  duyet: number | null
  tu_choi: number | null
  test: number // đăng ký lên camp test lần đầu
}
export function wsCounts(ws: WsData, from: string, to: string, model?: Model3): WsCounts {
  const pm = projectModels(ws)
  const okP = (pid: number) => !model || pm.get(pid) === model
  const regs = ws.regs.filter((r) => okP(r.project_id))
  const first = firstTestDay(ws.runs)
  const n = (f: (r: WsReg) => string | null | undefined) => (ws.hasDates ? regs.filter((r) => inRange(f(r), from, to)).length : null)
  return {
    chon: ws.projects.filter((p) => (!model || modelOfType(p.type_code) === model) && inRange(vnDate(p.created_at), from, to)).length,
    dang_ky: n((r) => r.registered_on),
    duyet: n((r) => r.approved_on),
    tu_choi: n((r) => r.rejected_on),
    test: regs.filter((r) => inRange(first.get(r.id), from, to)).length,
  }
}

/* ---------- Kết quả (Kaizen) từ Ads-Hub ---------- */
export interface Money {
  cost: number
  clicks: number
  orders: Record<OrderStatus, number>
  comm: Record<OrderStatus, number>
}
export const zeroMoney = (): Money => ({
  cost: 0,
  clicks: 0,
  orders: { pending: 0, approved: 0, paid: 0, denied: 0 },
  comm: { pending: 0, approved: 0, paid: 0, denied: 0 },
})
export interface AhTotals extends Money {
  noRateCost: number // số dòng chi phí chưa quy USD (Ads-Hub thiếu tỷ giá)
  unmatchedOrders: number // đơn chưa ghép được camp
  unmatchedComm: number
  unknownCampCost: number // chi phí của camp chưa ghép được dự án Research (không biết mô hình)
}
/** Camp → mô hình, qua ref_key → đăng ký Research → loại dự án. Thiếu Research hoặc không ghép được → null. */
export function campModels(ah: Pick<AhData, 'camps'>, ws: Pick<WsData, 'projects' | 'regs'> | null): Map<string, Model3 | null> {
  const out = new Map<string, Model3 | null>()
  if (!ws) {
    for (const c of ah.camps) out.set(c.camp, null)
    return out
  }
  const pm = projectModels(ws)
  const byRef = new Map<string, Model3 | null>()
  for (const r of ws.regs) if (r.ref_key && !byRef.has(r.ref_key)) byRef.set(r.ref_key, pm.get(r.project_id) ?? null)
  for (const c of ah.camps) out.set(c.camp, c.ref_key ? (byRef.get(c.ref_key) ?? null) : null)
  return out
}
/** Tổng chi phí, click, đơn và hoa hồng theo trạng thái trong [from, to]. model = lọc theo mô hình (cần Research để ghép). */
export function ahTotals(ah: AhData, ws: Pick<WsData, 'projects' | 'regs'> | null, from: string, to: string, model?: Model3): AhTotals {
  const cm = campModels(ah, ws)
  const ok = (camp: string) => !model || cm.get(camp) === model
  const t: AhTotals = {
    ...zeroMoney(),
    noRateCost: 0,
    unmatchedOrders: 0,
    unmatchedComm: 0,
    unknownCampCost: 0,
  }
  for (const s of ah.spend) {
    if (!inRange(s.d, from, to)) continue
    if (!model && (cm.get(s.camp) ?? null) === null) t.unknownCampCost += Number(s.cost ?? 0)
    if (!ok(s.camp)) continue
    if (s.cost === null || s.cost === undefined) t.noRateCost++
    t.cost += Number(s.cost ?? 0)
    t.clicks += Number(s.clicks)
  }
  for (const o of ah.orders) {
    if (!inRange(o.d, from, to)) continue
    if (o.camp === null) {
      if (!model) {
        t.unmatchedOrders += Number(o.n)
        t.unmatchedComm += Number(o.comm)
      }
      continue
    }
    if (!ok(o.camp)) continue
    t.orders[o.status] += Number(o.n)
    t.comm[o.status] += Number(o.comm)
  }
  t.cost = round2(t.cost)
  t.unknownCampCost = round2(t.unknownCampCost)
  t.unmatchedComm = round2(t.unmatchedComm)
  for (const k of ORDER_STATUSES) t.comm[k] = round2(t.comm[k])
  return t
}
const round2 = (x: number) => Math.round(x * 100) / 100

/** Ngưỡng dùng chung đang có hiệu lực (để hiển thị + chụp vào tháng khi chốt). */
export interface SharedThresholds {
  usd_vnd: number | null
  max_test_usd: number | null
  roa: [number, number, number] | null
  winner_orders: number | null
  click_rules: Pick<WsType, 'code' | 'name' | 'tier_low_vnd' | 'tier_high_vnd' | 'clicks_low' | 'clicks_mid' | 'clicks_high'>[]
}
export function sharedThresholds(ws: Pick<WsData, 'settings' | 'types'> | null, ah: Pick<AhData, 'settings'> | null): SharedThresholds {
  const s = ws?.settings ?? null
  return {
    usd_vnd: s ? Number(s.usd_vnd) : null,
    max_test_usd: s ? Number(s.max_test_usd) : ah?.settings?.max_test_usd != null ? Number(ah.settings.max_test_usd) : null,
    roa: s ? [Number(s.roa_hoa), Number(s.roa_lai), Number(s.roa_lai_tot)] : null,
    winner_orders: ah?.settings?.winner_orders != null ? Number(ah.settings.winner_orders) : null,
    click_rules: (ws?.types ?? [])
      .filter((t) => t.active)
      .map(({ code, name, tier_low_vnd, tier_high_vnd, clicks_low, clicks_mid, clicks_high }) => ({
        code,
        name,
        tier_low_vnd: Number(tier_low_vnd),
        tier_high_vnd: Number(tier_high_vnd),
        clicks_low: Number(clicks_low),
        clicks_mid: Number(clicks_mid),
        clicks_high: Number(clicks_high),
      })),
  }
}
