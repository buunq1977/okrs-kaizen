/* Sổ dự án Affiliate: giai đoạn phễu, chỉ số theo bảng của Luca, cờ win/dừng, đếm, đo hệ số. Logic thuần. */
import type { PhysCoeffs, SaasCoeffs } from './affiliate'

export type Model = 'phys' | 'saas'
export type Stage = 'research' | 'dat_loc' | 'dang_ky' | 'duoc_duyet' | 'test' | 'win' | 'dung'
export type OpStatus = 'scale' | 'duy_tri' | 'theo_doi' | 'dung'
export interface AffProject {
  id: string
  name: string
  link: string
  model: Model
  network: string
  niche: string
  geo: string
  stage: Stage
  dates: Partial<Record<Stage, string>>
  op_status: OpStatus | null
  ext_reason: string
  stop_reason: string
  note: string
  created_at: string
}
export interface AffEntry {
  id: string
  project_id: string
  date: string
  cost: number
  revenue: number
  received: number
  orders: number
  refs: number
  customers: number
  note: string
}

export const STAGES: Stage[] = ['research', 'dat_loc', 'dang_ky', 'duoc_duyet', 'test', 'win']
export const STAGE_NAME: Record<Stage, string> = {
  research: 'Research',
  dat_loc: 'Đạt lọc',
  dang_ky: 'Đăng ký',
  duoc_duyet: 'Được duyệt',
  test: 'Đang test',
  win: 'Thắng',
  dung: 'Dừng',
}
export const MODEL_NAME: Record<Model, string> = { phys: 'Vật lý', saas: 'SaaS' }
export const OP_NAME: Record<OpStatus, string> = { scale: 'Scale', duy_tri: 'Duy trì', theo_doi: 'Theo dõi', dung: 'Dừng' }
/** Màu theo bảng giải nghĩa của Luca: Scale xanh lá, Duy trì xanh dương, Theo dõi vàng, Dừng đỏ. */
export const OP_COLOR: Record<OpStatus, string> = { scale: 'green', duy_tri: 'blue', theo_doi: 'yellow', dung: 'red' }

/** Giai đoạn kế tiếp; ghi ngày vào giai đoạn mới (giữ ngày cũ nếu đã có). */
export function advance(p: Pick<AffProject, 'stage' | 'dates'>, to: Stage, date: string): Pick<AffProject, 'stage' | 'dates'> {
  return { stage: to, dates: { ...p.dates, [to]: p.dates[to] ?? date } }
}
export const nextStage = (s: Stage): Stage | null => {
  const i = STAGES.indexOf(s)
  return i >= 0 && i < STAGES.length - 1 ? STAGES[i + 1] : null
}
/** Đã từng tới giai đoạn `s` (theo ngày đã ghi). */
export const reached = (p: Pick<AffProject, 'dates'>, s: Stage) => !!p.dates[s]

/* ---------- Tổng + chỉ số ---------- */
export interface Totals {
  cost: number
  revenue: number
  received: number
  orders: number
  refs: number
  customers: number
}
export const ZERO: Totals = { cost: 0, revenue: 0, received: 0, orders: 0, refs: 0, customers: 0 }
export function totals(entries: Pick<AffEntry, keyof Totals | 'date'>[], from?: string, to?: string): Totals {
  const t = { ...ZERO }
  for (const e of entries) {
    if ((from && e.date < from) || (to && e.date > to)) continue
    t.cost += Number(e.cost)
    t.revenue += Number(e.revenue)
    t.received += Number(e.received)
    t.orders += Number(e.orders)
    t.refs += Number(e.refs)
    t.customers += Number(e.customers)
  }
  return t
}
const div = (a: number, b: number) => (b > 0 ? a / b : null)
/** Chỉ số theo bảng giải nghĩa: CPA, Payout, ROAS, ROI % (trên Thực nhận), % Duyệt, Lợi nhuận. */
export function metrics(t: Totals) {
  return {
    profit: t.received - t.cost,
    cpa: div(t.cost, t.orders),
    payout: div(t.received, t.orders),
    roas: div(t.revenue, t.cost),
    roi: t.cost > 0 ? ((t.received - t.cost) / t.cost) * 100 : null,
    approval: t.revenue > 0 ? (t.received / t.revenue) * 100 : null,
  }
}
/** Loại theo bảng: Winner (thắng) · Ra đơn (đã test, có đơn) · Test (đã test, chưa có đơn). */
export function kindOf(p: Pick<AffProject, 'stage' | 'dates'>, t: Totals): 'Winner' | 'Ra đơn' | 'Test' | null {
  if (p.stage === 'win') return 'Winner'
  if (p.stage === 'test' || p.dates.test) return t.orders > 0 ? 'Ra đơn' : 'Test'
  return null
}

/* ---------- Cờ: nên dừng / đạt tiêu chí thắng ---------- */
export interface Flags {
  cap: number // trần tiền test của dự án
  kill: boolean // đã tiêu ≥ trần mà chưa có đơn
  overCap: boolean // tiêu vượt trần (kể cả khi có đơn) mà chưa thắng
  winReady: boolean // đạt tiêu chí thắng: ≥ N đơn và ROAS theo thực nhận dự kiến ≥ ngưỡng
}
/** approvalPct = % duyệt lịch sử của mô hình (null = chưa có, coi như 100%). Thực nhận dự kiến = max(đã nhận, doanh số × % duyệt). */
export function flags(p: Pick<AffProject, 'stage' | 'model' | 'ext_reason'>, t: Totals, c: { phys: PhysCoeffs; saas: SaasCoeffs }, capMult: number, winMinOrders: number, approvalPct: number | null = null): Flags {
  const testCost = p.model === 'phys' ? c.phys.test_cost : c.saas.test_cost
  const cap = testCost * (p.ext_reason.trim() ? capMult : 1)
  const testing = p.stage === 'test'
  const expected = Math.max(t.received, t.revenue * ((approvalPct ?? 100) / 100))
  return {
    cap,
    kill: testing && t.orders === 0 && t.cost >= cap,
    overCap: testing && t.cost > cap,
    winReady: testing && t.orders >= winMinOrders && t.cost > 0 && expected / t.cost >= c.phys.roas,
  }
}

/* ---------- Đếm theo kỳ (dùng cho KR tự đếm) ---------- */
export interface Counts {
  research: number
  dang_ky: number
  test: number
  win: number
}
export function countBetween(ps: Pick<AffProject, 'dates' | 'model'>[], from: string, to: string, model?: Model): Counts {
  const inR = (d?: string) => !!d && d >= from && d <= to
  const xs = model ? ps.filter((p) => p.model === model) : ps
  return {
    research: xs.filter((p) => inR(p.dates.research)).length,
    dang_ky: xs.filter((p) => inR(p.dates.dang_ky)).length,
    test: xs.filter((p) => inR(p.dates.test)).length,
    win: xs.filter((p) => inR(p.dates.win)).length,
  }
}

/* ---------- Đo hệ số thật ---------- */
export interface Measured {
  n_tests: number
  n_wins: number
  test_cost: number | null // chi phí TB mỗi dự án đã test (trước khi thắng)
  tests_per_win: number | null
  order_rate: number | null // % dự án test có đơn
  approval: number | null // % duyệt = thực nhận / doanh số
  win_profit: number | null // lợi nhuận TB / thắng / tháng (từ ngày thắng)
  reg_per_test: number | null
  research_per_test: number | null
}
/** Đo trên các dự án của 1 mô hình có ngày vào giai đoạn trong [from, to]. */
export function measure(ps: AffProject[], es: AffEntry[], model: Model, from: string, to: string): Measured {
  const byP = new Map<string, AffEntry[]>()
  for (const e of es) byP.set(e.project_id, [...(byP.get(e.project_id) ?? []), e])
  const inR = (d?: string) => !!d && d >= from && d <= to
  const xs = ps.filter((p) => p.model === model)
  const tested = xs.filter((p) => inR(p.dates.test))
  const wins = xs.filter((p) => inR(p.dates.win))
  const costs = tested.map((p) => totals(byP.get(p.id) ?? [], undefined, p.dates.win ? prevDay(p.dates.win) : undefined).cost)
  const withOrders = tested.filter((p) => totals(byP.get(p.id) ?? []).orders > 0).length
  const all = totals(xs.flatMap((p) => byP.get(p.id) ?? []), from, to)
  const winMonthly = wins
    .map((p) => {
      const t = totals(byP.get(p.id) ?? [], p.dates.win, to)
      const months = Math.max(1, monthsSpan(p.dates.win!, to))
      return (t.received - t.cost) / months
    })
  const regs = xs.filter((p) => inR(p.dates.dang_ky)).length
  const research = xs.filter((p) => inR(p.dates.research)).length
  return {
    n_tests: tested.length,
    n_wins: wins.length,
    test_cost: tested.length ? costs.reduce((a, b) => a + b, 0) / tested.length : null,
    tests_per_win: wins.length ? tested.length / wins.length : null,
    order_rate: tested.length ? (withOrders / tested.length) * 100 : null,
    approval: all.revenue > 0 ? (all.received / all.revenue) * 100 : null,
    win_profit: winMonthly.length ? winMonthly.reduce((a, b) => a + b, 0) / winMonthly.length : null,
    reg_per_test: tested.length ? regs / tested.length : null,
    research_per_test: tested.length ? research / tested.length : null,
  }
}
const prevDay = (d: string) => {
  const x = new Date(d + 'T00:00:00')
  x.setDate(x.getDate() - 1)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const monthsSpan = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7))) + (b.slice(8) >= a.slice(8) ? 1 : 0)

/** Lợi nhuận đã nhận của mọi dự án trong khoảng ngày (Thực nhận − Chi phí). */
export const receivedProfit = (es: AffEntry[], from: string, to: string) => {
  const t = totals(es, from, to)
  return t.received - t.cost
}

/* ---------- Nhập từ Excel/CSV ---------- */
export interface ImportRow {
  name: string
  link: string
  model: Model
  network: string
  stage: Stage
  op_status: OpStatus | null
  date: string
  totals: Totals
}
const norm = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()
const HEAD: [keyof ImportRow | keyof Totals | 'kind' | 'status', RegExp][] = [
  ['name', /^(ten|du an|ten du an|project|store|offer|ten store)\b/],
  ['link', /^(link|url|website)/],
  ['model', /^(mo hinh|loai hinh|model)/],
  ['network', /^(network|mang|nen tang)/],
  ['kind', /^loai\b/],
  ['status', /^(trang thai|status)/],
  ['date', /^(ngay|date|thang)/],
  ['cost', /^chi phi/],
  ['revenue', /^doanh so/],
  ['received', /^thuc nhan/],
  ['orders', /^(so don|don\b|orders?)/],
]
const num = (v: unknown) => {
  if (typeof v === 'number') return v
  const s = String(v ?? '').replace(/[$\s]/g, '')
  if (!s) return 0
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-')
  const n = Number(s.replace(/[()-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))
  return Number.isFinite(n) ? (neg ? -n : n) : 0
}
const isoDate = (v: unknown, fallback: string) => {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000)
    return d.toISOString().slice(0, 10)
  }
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return fallback
}
/** Đọc bảng (mảng các dòng). Dòng tiêu đề = dòng đầu có cột "Chi phí". Bỏ dòng không có tên. */
export function parseImport(table: unknown[][], today: string): { rows: ImportRow[]; missing: string[] } {
  const hi = table.findIndex((r) => r.some((c) => /^chi phi/.test(norm(c))))
  if (hi < 0) return { rows: [], missing: ['Không thấy dòng tiêu đề có cột "Chi phí"'] }
  const cols: Partial<Record<string, number>> = {}
  table[hi].forEach((c, i) => {
    const h = norm(c)
    for (const [k, re] of HEAD) if (cols[k] === undefined && re.test(h)) cols[k] = i
  })
  const missing = cols.name === undefined ? ['Cột tên dự án (Tên / Dự án / Store)'] : []
  if (missing.length) return { rows: [], missing }
  const get = (r: unknown[], k: string) => (cols[k] === undefined ? '' : r[cols[k]!])
  const rows: ImportRow[] = []
  for (const r of table.slice(hi + 1)) {
    const name = String(get(r, 'name') ?? '').trim()
    if (!name || /^(tong|total)/.test(norm(name))) continue
    const kind = norm(get(r, 'kind'))
    const st = norm(get(r, 'status'))
    const op: OpStatus | null = /scale/.test(st) ? 'scale' : /duy tri/.test(st) ? 'duy_tri' : /theo doi/.test(st) ? 'theo_doi' : /dung|tat/.test(st) ? 'dung' : null
    const stage: Stage = op === 'dung' ? 'dung' : /winner|thang/.test(kind) ? 'win' : 'test'
    rows.push({
      name,
      link: String(get(r, 'link') ?? '').trim(),
      model: /saas|so\b|phan mem/.test(norm(get(r, 'model'))) ? 'saas' : 'phys',
      network: String(get(r, 'network') ?? '').trim(),
      stage,
      op_status: op,
      date: isoDate(get(r, 'date'), today),
      totals: {
        cost: Math.max(0, num(get(r, 'cost'))),
        revenue: Math.max(0, num(get(r, 'revenue'))),
        received: Math.max(0, num(get(r, 'received'))),
        orders: Math.max(0, num(get(r, 'orders'))),
        refs: 0,
        customers: 0,
      },
    })
  }
  return { rows, missing }
}
