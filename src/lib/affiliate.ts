/* Mô hình thu nhập Affiliate Global: Vật lý + SaaS chạy song song, phân bổ theo tháng.
   Logic thuần, không gọi DB. Nguồn số mặc định: 2 trang wiki "Mô hình thu nhập Affiliate Global
   (Vật lý / SaaS) - từ mục tiêu 16.000 USD/tháng ra việc mỗi ngày" (09/11/2026). */
import { addDays, addMonths } from './dates'

export interface PhysCoeffs {
  test_cost: number // $ tiền test 1 dự án
  tests_per_win: number // số test để ra 1 thắng
  win_profit: number // $ lợi nhuận ròng / thắng / tháng
  win_life: number // số tháng thắng sống
  roas: number // ROAS khi scale
  payout_days: number
}
export interface SaasCoeffs {
  test_cost: number
  tests_per_win: number
  commission_month: number // $ hoa hồng / khách / tháng
  customer_life: number // số tháng khách còn trả
  cac: number // $ chi phí có 1 khách trả tiền
  cust_per_win: number // khách trả tiền mới / thắng / tháng
  win_life: number
  lag_months: number // dùng thử + chờ payout: thắng tìm tháng m, ra tiền từ tháng m + lag
  payout_days: number
}
export interface AffConfig {
  user_id: string
  year_goal: number
  goal_month: string
  base_budget: number
  reinvest_pct: number
  test_cap_mult: number
  edit_days: number
  cap_tests_week: number
  working_days_week: number
  reg_per_test: number
  research_per_test: number
  win_min_orders: number
  phys: Partial<PhysCoeffs>
  saas: Partial<SaasCoeffs>
}
export interface AffMonth {
  id: string
  month: string // YYYY-MM-01
  share_phys: number // 0–100
  budget_test: number
  season: number
  profit_target: number
  coeffs: { phys: PhysCoeffs; saas: SaasCoeffs } | null
  locked_at: string | null
  note: string
}

export type Src = 'nguồn' | 'tính' | 'giả định' | 'của anh'
export const PHYS_DEFAULT: PhysCoeffs = { test_cost: 12, tests_per_win: 100, win_profit: 2000, win_life: 3, roas: 1.5, payout_days: 30 }
export const SAAS_DEFAULT: SaasCoeffs = { test_cost: 40, tests_per_win: 100, commission_month: 15, customer_life: 6, cac: 40, cust_per_win: 35, win_life: 12, lag_months: 3, payout_days: 45 }

export const PHYS_FIELDS: { k: keyof PhysCoeffs; label: string; unit: string; src: Src; note: string }[] = [
  { k: 'test_cost', label: 'Tiền test 1 dự án', unit: '$', src: 'tính', note: '30 click × CPC ~10.000đ; dải $6–30. Số T10 của anh ~$10,8' },
  { k: 'tests_per_win', label: 'Số test ra 1 thắng', unit: 'test', src: 'nguồn', note: 'Thận trọng ">100"; phễu minh hoạ 10' },
  { k: 'win_profit', label: 'Lợi nhuận 1 thắng / tháng', unit: '$', src: 'giả định', note: 'Nguồn không có; wiki xét $1.000–4.000' },
  { k: 'win_life', label: 'Thắng sống', unit: 'tháng', src: 'giả định', note: 'Theo vòng đời mùa vụ vật lý' },
  { k: 'roas', label: 'ROAS khi scale', unit: '×', src: 'nguồn', note: 'Ngưỡng cho phép scale 1,5; giảm 10–20% khi scale' },
  { k: 'payout_days', label: 'Tiền về sau', unit: 'ngày', src: 'nguồn', note: 'Vật lý dưới 30 ngày' },
]
export const SAAS_FIELDS: { k: keyof SaasCoeffs; label: string; unit: string; src: Src; note: string }[] = [
  { k: 'test_cost', label: 'Tiền test 1 dự án', unit: '$', src: 'tính', note: '125 click × CPC 8.000đ; dải $18–90' },
  { k: 'tests_per_win', label: 'Số test ra 1 thắng', unit: 'test', src: 'nguồn', note: 'Thận trọng ">100"' },
  { k: 'commission_month', label: 'Hoa hồng / khách / tháng', unit: '$', src: 'giả định', note: 'Gói $50 × 30% (ví dụ của nguồn)' },
  { k: 'customer_life', label: 'Khách còn trả', unit: 'tháng', src: 'giả định', note: 'Nguồn không có tỷ lệ khách rời' },
  { k: 'cac', label: 'Chi phí 1 khách trả tiền (CAC)', unit: '$', src: 'giả định', note: 'CPC $0,40 ÷ CVR 1%' },
  { k: 'cust_per_win', label: 'Khách mới / thắng / tháng', unit: 'khách', src: 'giả định', note: 'Wiki: 35–40' },
  { k: 'win_life', label: 'Thắng sống', unit: 'tháng', src: 'giả định', note: 'Ví dụ nguồn: trả hoa hồng 12 tháng' },
  { k: 'lag_months', label: 'Độ trễ ra tiền', unit: 'tháng', src: 'tính', note: 'Dùng thử 7–30 ngày + payout 35–60 ngày ≈ 1 quý' },
  { k: 'payout_days', label: 'Tiền về sau', unit: 'ngày', src: 'nguồn', note: 'Số 35–45, có thể tới 60' },
]

export const physOf = (c: Partial<PhysCoeffs> | null | undefined): PhysCoeffs => ({ ...PHYS_DEFAULT, ...clean(c) })
export const saasOf = (c: Partial<SaasCoeffs> | null | undefined): SaasCoeffs => ({ ...SAAS_DEFAULT, ...clean(c) })
function clean<T extends object>(c: T | null | undefined): Partial<T> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(c ?? {})) if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v
  return out as Partial<T>
}
/** Hệ số dùng cho một tháng: bản chụp lúc chốt, chưa chốt thì lấy mặc định hiện tại. */
export const coeffsOf = (m: Pick<AffMonth, 'coeffs'>, cfg: Pick<AffConfig, 'phys' | 'saas'>) => ({
  phys: physOf(m.coeffs?.phys ?? cfg.phys),
  saas: saasOf(m.coeffs?.saas ?? cfg.saas),
})

/* ---------- Tháng ---------- */
export const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)))
export const monthOf = (d: string) => d.slice(0, 8) + '01'
export const quarterNo = (m: string) => Math.floor((Number(m.slice(5, 7)) - 1) / 3) + 1

/* ---------- Quy tắc sửa (chỉ đầu kỳ) ---------- */
/** Trong N ngày đầu tháng của `today`. */
export const inEditDays = (today: string, editDays: number) => Number(today.slice(8, 10)) <= editDays
/** Tháng sửa được: tháng tương lai, hoặc đang trong N ngày đầu của chính tháng đó, hoặc chưa từng chốt tháng nào (lần đầu). */
export function monthEditable(month: string, today: string, editDays: number, anyLocked: boolean): boolean {
  if (!anyLocked) return true
  const cur = monthOf(today)
  if (month > cur) return true
  return month === cur && inEditDays(today, editDays)
}
/** Cài đặt mô hình (mục tiêu năm, hệ số mặc định) chỉ sửa ở đầu tháng, trừ lần đầu. */
export const configEditable = (today: string, editDays: number, anyLocked: boolean) => !anyLocked || inEditDays(today, editDays)
/** Tháng đã qua cửa sổ sửa mà chưa chốt (khi đã từng chốt) → tự chốt bằng hệ số hiện tại. */
export const needsAutoLock = (m: AffMonth, today: string, editDays: number, anyLocked: boolean) =>
  anyLocked && !m.locked_at && m.month <= monthOf(today) && !monthEditable(m.month, today, editDays, true)

/* ---------- Kế hoạch mặc định ---------- */
/** Tỷ trọng Vật lý mặc định (anh đã duyệt 10/11/2026): T11–12/2026 100%, Q1 60%, Q2 30%, Q3 50%, Q4 80%. */
export function defaultShare(month: string): number {
  if (month < '2027-01-01') return 100
  return [60, 30, 50, 80][quarterNo(month) - 1]
}
/** Thang lợi nhuận/tháng (đề xuất wiki, tỷ lệ theo mục tiêu năm): cuối Q1 12,5%, Q2 31,25%, Q3 62,5%, tháng mục tiêu 100%.
 *  Trước năm mục tiêu = 0 (giai đoạn đo). Giữa các mốc nội suy tuyến tính. */
export function defaultProfit(month: string, goal: number, goalMonth: string): number {
  const gy = goalMonth.slice(0, 4)
  const start = `${Number(gy) - 1}-12-01`
  if (month <= start || month > goalMonth) return month > goalMonth ? goal : 0
  const anchors: [string, number][] = [
    [start, 0],
    [`${gy}-03-01`, 0.125],
    [`${gy}-06-01`, 0.3125],
    [`${gy}-09-01`, 0.625],
    [goalMonth, 1],
  ].filter(([m]) => (m as string) <= goalMonth) as [string, number][]
  for (let i = 1; i < anchors.length; i++) {
    const [a, fa] = anchors[i - 1]
    const [b, fb] = anchors[i]
    if (month <= b) {
      const t = monthsBetween(a, month) / Math.max(1, monthsBetween(a, b))
      return Math.round((fa + (fb - fa) * t) * goal)
    }
  }
  return goal
}
export function planRows(cfg: Pick<AffConfig, 'year_goal' | 'goal_month' | 'base_budget'>, from: string) {
  const out: Omit<AffMonth, 'id' | 'coeffs' | 'locked_at' | 'note'>[] = []
  for (let m = monthOf(from); m <= cfg.goal_month; m = addMonths(m, 1)) {
    out.push({ month: m, share_phys: defaultShare(m), budget_test: cfg.base_budget, season: 1, profit_target: defaultProfit(m, cfg.year_goal, cfg.goal_month) })
  }
  return out
}

/* ---------- Mô phỏng ---------- */
export interface SimMonth {
  month: string
  budget: number
  testsP: number
  testsS: number
  winsP: number
  winsS: number
  activeP: number
  activeS: number
  profitP: number
  profitS: number
  net: number // lợi nhuận ròng sau tiền test và ads
  adsP: number // tiền ads scale Vật lý
  adsS: number // tiền ads mua khách SaaS
  capital: number // vốn cần trong tháng: test + vốn quay vòng
}
/** x nhân ngân sách test của các tháng từ `fromMonth` trở đi (dùng để tìm ngân sách tối thiểu). */
export function simulate(rows: AffMonth[], cfg: Pick<AffConfig, 'phys' | 'saas'>, fromMonth: string, x = 1): SimMonth[] {
  const rs = [...rows].sort((a, b) => a.month.localeCompare(b.month))
  if (!rs.length) return []
  const first = rs[0].month
  const byIdx = new Map(rs.map((r) => [monthsBetween(first, r.month), r]))
  const n = monthsBetween(first, rs[rs.length - 1].month) + 1
  const winsP: number[] = new Array(n).fill(0)
  const winsS: number[] = new Array(n).fill(0)
  const out: SimMonth[] = []
  for (let i = 0; i < n; i++) {
    const r = byIdx.get(i)
    const month = addMonths(first, i)
    const { phys, saas } = r ? coeffsOf(r, cfg) : coeffsOf({ coeffs: null }, cfg)
    const budget = r ? r.budget_test * (month >= fromMonth ? x : 1) : 0
    const share = r ? r.share_phys / 100 : 0
    const testsP = (budget * share) / phys.test_cost
    const testsS = (budget * (1 - share)) / saas.test_cost
    winsP[i] = testsP / phys.tests_per_win
    winsS[i] = testsS / saas.tests_per_win
    const lp = Math.max(1, Math.round(phys.win_life))
    const ls = Math.max(1, Math.round(saas.win_life))
    const lag = Math.max(0, Math.round(saas.lag_months))
    let activeP = 0
    for (let j = i - lp; j <= i - 1; j++) if (j >= 0) activeP += winsP[j]
    let activeS = 0
    for (let j = i - lag - ls + 1; j <= i - lag; j++) if (j >= 0 && j < i + 1) activeS += winsS[j]
    const season = r?.season ?? 1
    const profitP = activeP * phys.win_profit * season
    const perSaasWin = saas.cust_per_win * (saas.commission_month * saas.customer_life - saas.cac)
    const profitS = activeS * perSaasWin
    const adsP = phys.roas > 1 ? profitP / (phys.roas - 1) : 0
    const adsS = activeS * saas.cust_per_win * saas.cac
    const capital = budget + adsP * (phys.payout_days / 30) + adsS * (saas.cac / saas.commission_month + saas.payout_days / 30)
    out.push({ month, budget, testsP, testsS, winsP: winsP[i], winsS: winsS[i], activeP, activeS, profitP, profitS, net: profitP + profitS - budget, adsP, adsS, capital })
  }
  return out
}

/* ---------- Phân tích + cảnh báo ---------- */
export interface Analysis {
  sim: SimMonth[] // theo kế hoạch hiện tại
  xNeed: number | null // hệ số nhân ngân sách test tối thiểu để đạt mọi mục tiêu tháng còn kịp; null = không cần mục tiêu
  scaleFrom: string // tháng đầu được nhân ngân sách: không sớm hơn tháng hiện tại và tháng đầu có LN mục tiêu (giai đoạn đo giữ nguyên)
  late: string[] // tháng có mục tiêu nhưng không kịp vì độ trễ (tăng ngân sách bây giờ cũng không đủ)
  short: string[] // tháng dự kiến thấp hơn mục tiêu với ngân sách hiện tại
  goalNet: number | null // lợi nhuận dự kiến ở tháng mục tiêu
  suggestBudget: number | null // ngân sách test tối thiểu đề xuất cho tháng `scaleFrom`
  physLoss: boolean
  saasLoss: boolean
  overCapacity: { month: string; perWeek: number }[]
  maxCapital: { month: string; capital: number } | null
}
export function analyze(rows: AffMonth[], cfg: AffConfig, today: string): Analysis {
  const cur = monthOf(today)
  const firstTarget = [...rows].sort((a, b) => a.month.localeCompare(b.month)).find((r) => r.profit_target > 0)?.month
  const scaleFrom = firstTarget && firstTarget > cur ? firstTarget : cur
  const sim = simulate(rows, cfg, scaleFrom, 1)
  const s0 = simulate(rows, cfg, scaleFrom, 0)
  const byMonth = new Map(rows.map((r) => [r.month, r]))
  const late: string[] = []
  const short: string[] = []
  let xNeed: number | null = null
  sim.forEach((m, i) => {
    const r = byMonth.get(m.month)
    if (!r || r.profit_target <= 0 || m.month < cur) return
    if (m.net < r.profit_target - 0.5) short.push(m.month)
    const fixed = s0[i].net
    const v = m.net - fixed
    if (fixed >= r.profit_target) return void (xNeed = Math.max(xNeed ?? 0, 0))
    if (v <= 1e-9) return void late.push(m.month)
    xNeed = Math.max(xNeed ?? 0, (r.profit_target - fixed) / v)
  })
  const goal = sim.find((m) => m.month === cfg.goal_month)
  const curRow = byMonth.get(cur)
  const c = coeffsOf(curRow ?? { coeffs: null }, cfg)
  const physLoss = c.phys.test_cost * c.phys.tests_per_win >= c.phys.win_profit * c.phys.win_life
  const perSaasWin = c.saas.cust_per_win * (c.saas.commission_month * c.saas.customer_life - c.saas.cac)
  const saasLoss = perSaasWin <= 0 || c.saas.test_cost * c.saas.tests_per_win >= perSaasWin * c.saas.win_life
  const mult = Math.max(1, xNeed ?? 1)
  const overCapacity = sim
    .filter((m) => m.month >= cur)
    .map((m) => ({ month: m.month, perWeek: ((m.testsP + m.testsS) * (m.month >= scaleFrom ? mult : 1) * 12) / 52 }))
    .filter((m) => m.perWeek > cfg.cap_tests_week)
  const future = sim.filter((m) => m.month >= cur)
  const maxCapital = future.length ? future.reduce((a, b) => (b.capital > a.capital ? b : a)) : null
  return {
    sim,
    xNeed,
    scaleFrom,
    late,
    short,
    goalNet: goal ? goal.net : null,
    suggestBudget: byMonth.get(scaleFrom) ? byMonth.get(scaleFrom)!.budget_test * mult : null,
    physLoss,
    saasLoss,
    overCapacity,
    maxCapital: maxCapital ? { month: maxCapital.month, capital: maxCapital.capital } : null,
  }
}

/** Ngân sách test tối thiểu tháng sau theo quy tắc: nền + x% lợi nhuận đã nhận tháng này. */
export const nextBudget = (base: number, reinvestPct: number, receivedProfit: number) => base + Math.max(0, receivedProfit) * (reinvestPct / 100)

/* ---------- Bảng chỉ tiêu phân tầng ---------- */
export interface Targets {
  research: [number, number] // [tối thiểu (theo ngân sách), mục tiêu (đủ đạt LN)]
  reg: [number, number]
  tests: [number, number]
  testsP: number
  testsS: number
  wins: [number, number] | null // null ở Tuần/Ngày: không đặt chỉ tiêu thắng
  budget: [number, number]
  profit: number | null // LN mục tiêu tháng cuối kỳ
  net: number | null // LN dự kiến tháng cuối kỳ
}
export function targetsFor(months: string[], a: Analysis, rows: AffMonth[], cfg: AffConfig, level: 'year' | 'quarter' | 'month' | 'week' | 'day'): Targets {
  const set = new Set(months)
  const ms = a.sim.filter((m) => set.has(m.month))
  const mult = Math.max(1, a.xNeed ?? 1)
  let div = 1
  if (level === 'week' || level === 'day') div = 52 / 12
  if (level === 'day') div *= cfg.working_days_week
  const k = (m: SimMonth) => (m.month >= a.scaleFrom ? mult : 1)
  const sum = (f: (m: SimMonth) => number) => ms.reduce((s, m) => s + f(m), 0) / div
  const both = (f: (m: SimMonth) => number): [number, number] => [sum(f), sum((m) => f(m) * k(m))]
  const tests = both((m) => m.testsP + m.testsS)
  const last = ms[ms.length - 1]
  const lastRow = last ? rows.find((r) => r.month === last.month) : undefined
  const times = (p: [number, number], f: number): [number, number] => [p[0] * f, p[1] * f]
  return {
    research: times(tests, cfg.research_per_test),
    reg: times(tests, cfg.reg_per_test),
    tests,
    testsP: sum((m) => m.testsP),
    testsS: sum((m) => m.testsS),
    wins: level === 'week' || level === 'day' ? null : both((m) => m.winsP + m.winsS),
    budget: both((m) => m.budget),
    profit: level === 'week' || level === 'day' ? null : (lastRow?.profit_target ?? null),
    net: level === 'week' || level === 'day' ? null : (last?.net ?? null),
  }
}
/** Các tháng của kỳ chứa `month`. */
export function monthsOfLevel(level: 'year' | 'quarter' | 'month', month: string): string[] {
  if (level === 'month') return [month]
  const y = month.slice(0, 4)
  const startM = level === 'year' ? 1 : (quarterNo(month) - 1) * 3 + 1
  const n = level === 'year' ? 12 : 3
  return Array.from({ length: n }, (_, i) => `${y}-${String(startM + i).padStart(2, '0')}-01`)
}
/** Ngày cuối tháng (hiển thị hạn). */
export const monthLast = (m: string) => addDays(addMonths(m, 1), -1)
