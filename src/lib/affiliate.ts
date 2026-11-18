/* Mô hình thu nhập Affiliate Global: Vật lý + Tools AI + SaaS, phân bổ theo tháng.
   Logic thuần, không gọi DB. Nguồn số mặc định: 2 trang wiki "Mô hình thu nhập Affiliate Global
   (Vật lý / SaaS) - từ mục tiêu 16.000 USD/tháng ra việc mỗi ngày" (09/11/2026).
   Mô hình v2 (docs/plan-aff-model-v2.md, 18/11/2026): 3 mô hình riêng, phí + thuế trên tiền nạp Ads, chi phí cố định, quỹ cầu nối + dự phòng,
   SaaS/Tools AI ghi lợi nhuận theo dòng tiền, tiền test = maxtest của Research. Mô hình cũ (v1) đã bỏ hẳn (migration 014). */
import { addDays, addMonths } from './dates'

export interface PhysCoeffs {
  test_cost: number // $ tiền test 1 dự án
  tests_per_win: number // số test để ra 1 thắng
  win_profit: number // $ lợi nhuận ròng / thắng / tháng (sau tiền ads)
  win_life: number // số tháng thắng sống
  roas: number // ROAS thực nhận khi scale (thực nhận ÷ chi phí ads)
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
  lag_months: number // dùng thử + chờ payout: thắng tìm tháng m, tiền hoa hồng đầu tiên về tháng m + lag
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
  /* Migration 013 (v2). Tuỳ chọn: thiếu thì dùng V2_DEFAULT. */
  tools?: Partial<SaasCoeffs> // hệ số Tools AI
  goal_levels?: number[] // O năm 2027: [tối thiểu, mục tiêu, vươn tới] ($/tháng); mức tối thiểu = year_goal dùng tính kế hoạch
  fee_pct?: number
  tax_pct?: number
  tax_base?: 'profit' | 'received' // không dùng nữa: thuế tính trên chi phí nạp + phí (Luca chốt 18/11)
  fixed_cost_month?: number
  bridge_pct?: number
  reserve_pct?: number
  kickoff_tests_month?: number
  gate1_profit?: number
  gate2_profit?: number
  saas_unlock_gate?: number
  approval_warn_pct?: number
}
/** Bản chụp lúc chốt tháng. v1 = chỉ {phys, saas}; v2 có model_version = 2 và các tham số bên dưới. */
export interface CoeffSnap {
  phys: PhysCoeffs
  saas: SaasCoeffs
  tools?: SaasCoeffs
  model_version?: number
  fee_pct?: number
  tax_pct?: number
  tax_base?: 'profit' | 'received' // không dùng nữa: thuế tính trên chi phí nạp + phí (Luca chốt 18/11)
  fixed_cost_month?: number
  bridge_pct?: number
  reserve_pct?: number
  max_test_usd?: number | null
  usd_vnd?: number | null
  roa?: [number, number, number] | null
  winner_orders?: number | null
  click_rules?: unknown[]
}
export interface AffMonth {
  id: string
  month: string // YYYY-MM-01
  share_phys: number // 0–100
  budget_test: number
  season: number
  profit_target: number
  coeffs: CoeffSnap | null
  locked_at: string | null
  note: string
  share_tools?: number // % Tools AI; SaaS = 100 − Vật lý − Tools AI
  extra_capital?: number // vốn ngoài của tháng
  actuals?: Record<string, unknown> | null // bản chụp số thực tế khi chốt
}
/** Ngưỡng đang có hiệu lực (đọc từ Research/Ads-Hub) + ghi đè cho kịch bản. Chỉ áp cho tháng CHƯA chốt. */
export interface Live {
  max_test_usd?: number | null // maxtest Research → tiền test 1 dự án của cả 3 mô hình
  tests_per_win?: number // kịch bản 100 / 200 / 300 test/thắng
}

export type Src = 'nguồn' | 'nguồn (mức sàn)' | 'tính' | 'giả định' | 'của anh' | 'Research'
export const PHYS_DEFAULT: PhysCoeffs = { test_cost: 12, tests_per_win: 100, win_profit: 2000, win_life: 3, roas: 1.5, payout_days: 30 }
export const SAAS_DEFAULT: SaasCoeffs = { test_cost: 40, tests_per_win: 100, commission_month: 15, customer_life: 6, cac: 40, cust_per_win: 35, win_life: 12, lag_months: 3, payout_days: 45 }
/** Tools AI: chưa có số riêng, mặc định bằng SaaS (giả định). */
export const TOOLS_DEFAULT: SaasCoeffs = { ...SAAS_DEFAULT }
export const V2_DEFAULT = {
  goal_levels: [16000, 50000, 120000],
  fee_pct: 5,
  tax_pct: 8,
  fixed_cost_month: 0,
  bridge_pct: 15,
  reserve_pct: 10,
  kickoff_tests_month: 60,
  gate1_profit: 1000,
  gate2_profit: 2000,
  saas_unlock_gate: 2,
  approval_warn_pct: 70,
}
/** Tên 3 mức O năm (Luca chốt 19/11/2026: cùng năm 2027). Mức tối thiểu là cam kết, dùng để tính kế hoạch. */
export const GOAL_LEVEL_NAMES = ['Tối thiểu', 'Mục tiêu', 'Vươn tới'] as const
/** Mức cao nhất mà lợi nhuận dự kiến đạt được: -1 = chưa đạt tối thiểu, 0 = tối thiểu, 1 = mục tiêu, 2 = vươn tới. */
export function goalLevelReached(net: number | null, levels: number[]): number {
  if (net === null) return -1
  let r = -1
  levels.forEach((x, i) => {
    if (net >= x) r = i
  })
  return r
}
/** Tham số v2 của cấu hình (thiếu thì lấy mặc định). */
export const v2Of = (c: Partial<AffConfig>) => ({
  goal_levels: Array.isArray(c.goal_levels) && c.goal_levels.length ? c.goal_levels.map(Number) : V2_DEFAULT.goal_levels,
  fee_pct: num(c.fee_pct, V2_DEFAULT.fee_pct),
  tax_pct: num(c.tax_pct, V2_DEFAULT.tax_pct),
  fixed_cost_month: num(c.fixed_cost_month, V2_DEFAULT.fixed_cost_month),
  bridge_pct: num(c.bridge_pct, V2_DEFAULT.bridge_pct),
  reserve_pct: num(c.reserve_pct, V2_DEFAULT.reserve_pct),
  kickoff_tests_month: num(c.kickoff_tests_month, V2_DEFAULT.kickoff_tests_month),
  gate1_profit: num(c.gate1_profit, V2_DEFAULT.gate1_profit),
  gate2_profit: num(c.gate2_profit, V2_DEFAULT.gate2_profit),
  saas_unlock_gate: num(c.saas_unlock_gate, V2_DEFAULT.saas_unlock_gate),
  approval_warn_pct: num(c.approval_warn_pct, V2_DEFAULT.approval_warn_pct),
})
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d)

type Field<K> = { k: K; label: string; unit: string; src: Src; note: string; derived?: boolean }
export const PHYS_FIELDS: Field<keyof PhysCoeffs>[] = [
  { k: 'test_cost', label: 'Tiền test 1 dự án', unit: '$', src: 'Research', note: '= maxtest ở Research → Cài đặt tính toán. Khi đủ ≥ 5 test sẽ dùng số đo', derived: true },
  { k: 'tests_per_win', label: 'Số test ra 1 thắng', unit: 'test', src: 'nguồn (mức sàn)', note: 'Nguồn: ">100" là mức sàn, có case 800 test/tháng ra 1 thắng. App chạy thêm kịch bản 200 và 300' },
  { k: 'win_profit', label: 'Lợi nhuận 1 thắng / tháng', unit: '$', src: 'giả định', note: 'Nguồn không có; wiki xét $1.000–4.000' },
  { k: 'win_life', label: 'Thắng sống', unit: 'tháng', src: 'giả định', note: 'Theo vòng đời mùa vụ vật lý' },
  { k: 'roas', label: 'ROAS thực nhận khi scale', unit: '×', src: 'nguồn', note: 'Thực nhận ÷ chi phí ads (không phải doanh số màn hình). Ngưỡng cho phép scale 1,5' },
  { k: 'payout_days', label: 'Tiền về sau', unit: 'ngày', src: 'nguồn', note: 'Vật lý dưới 30 ngày' },
]
export const SAAS_FIELDS: Field<keyof SaasCoeffs>[] = [
  { k: 'test_cost', label: 'Tiền test 1 dự án', unit: '$', src: 'Research', note: '= maxtest ở Research → Cài đặt tính toán', derived: true },
  { k: 'tests_per_win', label: 'Số test ra 1 thắng', unit: 'test', src: 'nguồn (mức sàn)', note: 'Nguồn: ">100" là mức sàn' },
  { k: 'commission_month', label: 'Hoa hồng / khách / tháng', unit: '$', src: 'giả định', note: 'Gói $50 × 30% (ví dụ của nguồn)' },
  { k: 'customer_life', label: 'Khách còn trả', unit: 'tháng', src: 'giả định', note: 'Nguồn không có tỷ lệ khách rời' },
  { k: 'cac', label: 'Chi phí 1 khách trả tiền (CAC)', unit: '$', src: 'giả định', note: 'CPC $0,40 ÷ CVR 1%' },
  { k: 'cust_per_win', label: 'Khách mới / thắng / tháng', unit: 'khách', src: 'giả định', note: 'Wiki: 35–40' },
  { k: 'win_life', label: 'Thắng sống', unit: 'tháng', src: 'giả định', note: 'Ví dụ nguồn: trả hoa hồng 12 tháng' },
  { k: 'lag_months', label: 'Độ trễ ra tiền', unit: 'tháng', src: 'tính', note: 'Dùng thử 7–30 ngày + payout 35–60 ngày ≈ 1 quý' },
  { k: 'payout_days', label: 'Tiền về sau', unit: 'ngày', src: 'nguồn', note: 'Số 35–45, có thể tới 60' },
]
export const TOOLS_FIELDS: Field<keyof SaasCoeffs>[] = SAAS_FIELDS.map((f) =>
  f.src === 'Research' || f.src === 'nguồn (mức sàn)' ? f : { ...f, src: 'giả định', note: 'Chưa có số Tools AI riêng: tạm bằng SaaS. ' + f.note },
)

export const physOf = (c: Partial<PhysCoeffs> | null | undefined): PhysCoeffs => ({ ...PHYS_DEFAULT, ...clean(c) })
export const saasOf = (c: Partial<SaasCoeffs> | null | undefined): SaasCoeffs => ({ ...SAAS_DEFAULT, ...clean(c) })
export const toolsOf = (c: Partial<SaasCoeffs> | null | undefined): SaasCoeffs => ({ ...TOOLS_DEFAULT, ...clean(c) })
function clean<T extends object>(c: T | null | undefined): Partial<T> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(c ?? {})) if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v
  return out as Partial<T>
}
const withTest = <T extends { test_cost: number }>(c: T, maxTest: number | null | undefined): T => (maxTest && maxTest > 0 ? { ...c, test_cost: maxTest } : c)
const withTpw = <T extends { tests_per_win: number }>(c: T, tpw: number | undefined): T => (tpw && tpw > 0 ? { ...c, tests_per_win: tpw } : c)

/** Hệ số dùng cho một tháng: bản chụp lúc chốt; chưa chốt thì mặc định hiện tại, tiền test = maxtest Research (nếu đọc được). */
export function coeffsOf(m: Pick<AffMonth, 'coeffs'>, cfg: Pick<AffConfig, 'phys' | 'saas' | 'tools'>, live: Live = {}) {
  if (m.coeffs) return { phys: physOf(m.coeffs.phys), saas: saasOf(m.coeffs.saas), tools: toolsOf(m.coeffs.tools ?? cfg.tools) }
  return {
    phys: withTpw(withTest(physOf(cfg.phys), live.max_test_usd), live.tests_per_win),
    saas: withTpw(withTest(saasOf(cfg.saas), live.max_test_usd), live.tests_per_win),
    tools: withTpw(withTest(toolsOf(cfg.tools), live.max_test_usd), live.tests_per_win),
  }
}
/** Tham số tính của một tháng: hệ số + phí/thuế/quỹ (bản chụp nếu đã chốt, thiếu trường thì lấy mặc định). */
export function monthModel(m: Pick<AffMonth, 'coeffs'>, cfg: AffConfig, live: Live = {}) {
  const c = coeffsOf(m, cfg, live)
  const src = m.coeffs ? { ...v2Of(cfg), ...stripUndef(m.coeffs) } : v2Of(cfg)
  return {
    ...c,
    fee_pct: num(src.fee_pct, V2_DEFAULT.fee_pct),
    tax_pct: num(src.tax_pct, V2_DEFAULT.tax_pct),
    fixed_cost_month: num(src.fixed_cost_month, 0),
    bridge_pct: num(src.bridge_pct, V2_DEFAULT.bridge_pct),
    reserve_pct: num(src.reserve_pct, V2_DEFAULT.reserve_pct),
  }
}
const stripUndef = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)) as Partial<T>

/** Bản chụp v2 khi chốt tháng: hệ số hiện tại (tiền test = maxtest), phí/thuế/quỹ và ngưỡng dùng chung lúc chốt. */
export function snapshotV2(
  cfg: AffConfig,
  th: { max_test_usd?: number | null; usd_vnd?: number | null; roa?: [number, number, number] | null; winner_orders?: number | null; click_rules?: unknown[] } = {},
): CoeffSnap {
  const c = coeffsOf({ coeffs: null }, cfg, { max_test_usd: th.max_test_usd })
  const v = v2Of(cfg)
  return {
    ...c,
    model_version: 2,
    fee_pct: v.fee_pct,
    tax_pct: v.tax_pct,
    fixed_cost_month: v.fixed_cost_month,
    bridge_pct: v.bridge_pct,
    reserve_pct: v.reserve_pct,
    max_test_usd: th.max_test_usd ?? null,
    usd_vnd: th.usd_vnd ?? null,
    roa: th.roa ?? null,
    winner_orders: th.winner_orders ?? null,
    click_rules: th.click_rules ?? [],
  }
}

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
/** Đã chốt ít nhất một tháng → bật luật khoá đầu kỳ. (Mở khoá một lần 18/11/2026: migration 014 mở lại tháng chốt theo mô hình cũ.) */
export const anyLocked = (ms: Pick<AffMonth, 'locked_at'>[]) => ms.some((m) => !!m.locked_at)
/** Một dòng của bảng phân bổ có sửa được không. Tháng đã chốt: chỉ trong N ngày đầu của chính tháng đó. */
export function rowEditable(m: Pick<AffMonth, 'month' | 'locked_at'>, today: string, editDays: number, locked: boolean): boolean {
  if (m.locked_at) return monthEditable(m.month, today, editDays, true)
  return monthEditable(m.month, today, editDays, locked)
}

/* ---------- Kế hoạch mặc định ---------- */
/** (Tuỳ chọn) Tỷ trọng Vật lý theo bảng cũ duyệt 10/11/2026; từ GĐ4 kế hoạch mới mặc định 100% Vật lý. */
/** Tỷ trọng Vật lý mặc định cũ (anh đã duyệt 10/11/2026): T11–12/2026 100%, Q1 60%, Q2 30%, Q3 50%, Q4 80%. */
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
    // GĐ4 (D3, D4): mặc định 100% Vật lý (SaaS, Tools AI mở theo cổng), lợi nhuận mục tiêu 0 = theo cổng bằng chứng
    out.push({ month: m, share_phys: 100, share_tools: 0, budget_test: cfg.base_budget, season: 1, profit_target: 0 })
  }
  return out
}

/* ---------- Mô phỏng ---------- */
export interface SimMonth {
  month: string
  budget: number
  testsP: number
  testsT: number // Tools AI
  testsS: number
  winsP: number
  winsT: number
  winsS: number
  activeP: number
  activeT: number
  activeS: number
  profitP: number
  profitT: number
  profitS: number
  gross: number // lợi nhuận trước phí/thuế nạp tiền = LN các mô hình − tiền test
  fee: number // phí tài khoản Invoice (% chi phí nạp)
  fixed: number // chi phí cố định
  tax: number // thuế (% chi phí nạp + phí)
  net: number // lợi nhuận ròng sau tiền test, ads, phí, chi phí cố định, thuế
  received: number // thực nhận dự kiến
  adsP: number // tiền ads scale Vật lý
  adsT: number // tiền ads mua khách Tools AI
  adsS: number // tiền ads mua khách SaaS
  capitalOps: number // vốn vận hành: test + ads chờ hoa hồng về
  bridge: number // quỹ cầu nối chờ payout
  reserve: number // quỹ dự phòng
  capital: number // vốn cần = vận hành + cầu nối + dự phòng
}
/** Dòng tiền SaaS/Tools AI của tháng i: thắng tìm tháng j mua khách từ tháng j+1 trong `win_life` tháng (trả CAC ngay);
 *  mỗi khách trả hoa hồng `customer_life` tháng, tiền đầu tiên về sau (lag − 1) tháng kể từ tháng mua khách
 *  → thắng tìm tháng m có tiền hoa hồng đầu tiên ở tháng m + lag. */
function subModel(i: number, c: SaasCoeffs, wins: number[], acq: number[]) {
  const life = Math.max(1, Math.round(c.win_life))
  let active = 0
  for (let j = i - life; j <= i - 1; j++) if (j >= 0) active += wins[j]
  acq[i] = active * c.cust_per_win
  const lp = Math.max(0, Math.round(c.lag_months) - 1)
  const cl = Math.max(1, Math.round(c.customer_life))
  let inflow = 0
  for (let a = i - lp - cl + 1; a <= i - lp; a++) if (a >= 0) inflow += (acq[a] ?? 0) * c.commission_month
  const ads = acq[i] * c.cac
  return { active, profit: inflow - ads, ads, inflow }
}
/** x nhân ngân sách test của các tháng từ `fromMonth` trở đi (dùng để tìm ngân sách tối thiểu). */
export function simulate(rows: AffMonth[], cfg: AffConfig, fromMonth: string, x = 1, live: Live = {}): SimMonth[] {
  const rs = [...rows].sort((a, b) => a.month.localeCompare(b.month))
  if (!rs.length) return []
  const first = rs[0].month
  const byIdx = new Map(rs.map((r) => [monthsBetween(first, r.month), r]))
  const n = monthsBetween(first, rs[rs.length - 1].month) + 1
  const winsP: number[] = new Array(n).fill(0)
  const winsT: number[] = new Array(n).fill(0)
  const winsS: number[] = new Array(n).fill(0)
  const acqT: number[] = new Array(n).fill(0)
  const acqS: number[] = new Array(n).fill(0)
  const out: SimMonth[] = []
  let prev: AffMonth | undefined
  for (let i = 0; i < n; i++) {
    const r = byIdx.get(i)
    if (r) prev = r
    const month = addMonths(first, i)
    // tháng không có dòng trong bảng: dùng mô hình (hệ số, phiên bản) của dòng gần nhất phía trước, ngân sách 0
    const mm = monthModel(r ?? prev ?? { coeffs: null }, cfg, live)
    const { phys, saas, tools } = mm
    const budget = r ? r.budget_test * (month >= fromMonth ? x : 1) : 0
    const sp = r ? r.share_phys / 100 : 0
    const st = r ? Math.min(1 - sp, (r.share_tools ?? 0) / 100) : 0
    const ss = r ? Math.max(0, 1 - sp - st) : 0
    const testsP = (budget * sp) / phys.test_cost
    const testsT = (budget * st) / tools.test_cost
    const testsS = (budget * ss) / saas.test_cost
    winsP[i] = testsP / phys.tests_per_win
    winsT[i] = testsT / tools.tests_per_win
    winsS[i] = testsS / saas.tests_per_win
    const lp = Math.max(1, Math.round(phys.win_life))
    let activeP = 0
    for (let j = i - lp; j <= i - 1; j++) if (j >= 0) activeP += winsP[j]
    const season = r?.season ?? 1
    const profitP = activeP * phys.win_profit * season
    const adsP = phys.roas > 1 ? profitP / (phys.roas - 1) : 0
    const T = subModel(i, tools, winsT, acqT)
    const S = subModel(i, saas, winsS, acqS)
    const gross = profitP + T.profit + S.profit - budget
    // Phí + thuế tính trên chi phí nạp tài khoản Ads (tiền test + ads scale + ads mua khách SaaS/Tools AI)
    const { fee, tax, mult } = adCharges(budget + adsP + T.ads + S.ads, mm.fee_pct, mm.tax_pct)
    const fixed = mm.fixed_cost_month
    const received = profitP + adsP + T.inflow + S.inflow
    const sub = (c: SaasCoeffs, ads: number) => ads * (c.payout_days / 30)
    // vốn vận hành = tiền phải nạp (đã gồm phí + thuế) cho test + ads chờ hoa hồng về
    const capitalOps = (budget + adsP * (phys.payout_days / 30) + sub(tools, T.ads) + sub(saas, S.ads)) * mult
    const bridge = (capitalOps * mm.bridge_pct) / 100
    const reserve = (capitalOps * mm.reserve_pct) / 100
    out.push({
      month,
      budget,
      testsP,
      testsT,
      testsS,
      winsP: winsP[i],
      winsT: winsT[i],
      winsS: winsS[i],
      activeP,
      activeT: T.active,
      activeS: S.active,
      profitP,
      profitT: T.profit,
      profitS: S.profit,
      gross,
      fee,
      fixed,
      tax,
      net: gross - fee - tax - fixed,
      received,
      adsP,
      adsT: T.ads,
      adsS: S.ads,
      capitalOps,
      bridge,
      reserve,
      capital: capitalOps + bridge + reserve,
    })
  }
  return out
}

/* ---------- Phân tích + cảnh báo ---------- */
export const SCENARIO_TPW = [100, 200, 300]
export interface Analysis {
  sim: SimMonth[] // theo kế hoạch hiện tại
  xNeed: number | null // hệ số nhân ngân sách test tối thiểu để đạt mọi mục tiêu tháng còn kịp; null = không cần mục tiêu
  scaleFrom: string // tháng đầu được nhân ngân sách: không sớm hơn tháng hiện tại và tháng đầu có LN mục tiêu (giai đoạn đo giữ nguyên)
  late: string[] // tháng có mục tiêu nhưng không kịp vì độ trễ (tăng ngân sách bây giờ cũng không đủ)
  short: string[] // tháng dự kiến thấp hơn mục tiêu với ngân sách hiện tại
  goalNet: number | null // lợi nhuận ròng (sau phí, thuế) dự kiến ở tháng mục tiêu
  goal: SimMonth | null // chi tiết tháng mục tiêu
  suggestBudget: number | null // ngân sách test tối thiểu đề xuất cho tháng `scaleFrom`
  physLoss: boolean
  toolsLoss: boolean
  saasLoss: boolean
  overCapacity: { month: string; perWeek: number }[]
  maxCapital: SimMonth | null // tháng cần vốn cao nhất (có chi tiết quỹ)
  capitalShort: { month: string; need: number; avail: number }[] // vốn khả dụng (ngân sách tối thiểu + vốn ngoài) < vốn cần
  scenarios: { tpw: number; goalNet: number | null }[] // dải 100 / 200 / 300 test/thắng
  seasonWarn: boolean // tháng T11–T1 chưa chốt mà hệ số mùa vụ vẫn = 1
}
export function analyze(rows: AffMonth[], cfg: AffConfig, today: string, live: Live = {}): Analysis {
  const cur = monthOf(today)
  const firstTarget = [...rows].sort((a, b) => a.month.localeCompare(b.month)).find((r) => r.profit_target > 0)?.month
  const scaleFrom = firstTarget && firstTarget > cur ? firstTarget : cur
  const sim = simulate(rows, cfg, scaleFrom, 1, live)
  const s0 = simulate(rows, cfg, scaleFrom, 0, live)
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
  const goal = sim.find((m) => m.month === cfg.goal_month) ?? null
  const curRow = byMonth.get(cur)
  const c = coeffsOf(curRow ?? { coeffs: null }, cfg, live)
  const physLoss = c.phys.test_cost * c.phys.tests_per_win >= c.phys.win_profit * c.phys.win_life
  const subLoss = (s: SaasCoeffs) => {
    const perWin = s.cust_per_win * (s.commission_month * s.customer_life - s.cac)
    return perWin <= 0 || s.test_cost * s.tests_per_win >= perWin * s.win_life
  }
  const mult = Math.max(1, xNeed ?? 1)
  const overCapacity = sim
    .filter((m) => m.month >= cur)
    .map((m) => ({ month: m.month, perWeek: ((m.testsP + m.testsT + m.testsS) * (m.month >= scaleFrom ? mult : 1) * 12) / 52 }))
    .filter((m) => m.perWeek > cfg.cap_tests_week)
  const future = sim.filter((m) => m.month >= cur)
  const maxCapital = future.length ? future.reduce((a, b) => (b.capital > a.capital ? b : a)) : null
  const capitalShort = future
    .map((m) => ({ month: m.month, need: m.capital, avail: cfg.base_budget + (byMonth.get(m.month)?.extra_capital ?? 0) }))
    .filter((x) => x.need > x.avail + 0.5)
  const scenarios = SCENARIO_TPW.map((tpw) => ({ tpw, goalNet: simulate(rows, cfg, scaleFrom, 1, { ...live, tests_per_win: tpw }).find((m) => m.month === cfg.goal_month)?.net ?? null }))
  return {
    sim,
    xNeed,
    scaleFrom,
    late,
    short,
    goalNet: goal ? goal.net : null,
    goal,
    suggestBudget: byMonth.get(scaleFrom) ? byMonth.get(scaleFrom)!.budget_test * mult : null,
    physLoss,
    toolsLoss: subLoss(c.tools),
    saasLoss: subLoss(c.saas),
    overCapacity,
    maxCapital,
    capitalShort,
    scenarios,
    seasonWarn: seasonWarn(rows, today),
  }
}

/* ---------- ROAS ---------- */
/** ROAS thực nhận = ROAS hoa hồng (màn hình) × % duyệt. Mọi quyết định scale dùng số này, không dùng ROAS màn hình. */
export const realRoas = (roasScreen: number, approvalPct: number) => roasScreen * (approvalPct / 100)

/* ---------- Phí + thuế khi nạp tiền tài khoản Ads ---------- */
/** Luca chốt 18/11/2026: phí Invoice tính trên chi phí nạp; thuế tính trên (chi phí nạp + phí).
 *  VD chi tiêu 500.000đ: phí 5% = 25.000đ, thuế 8% × 525.000 = 42.000đ, tổng phải nạp 567.000đ (×1,134). */
export function adCharges(spend: number, feePct: number, taxPct: number) {
  const fee = (spend * feePct) / 100
  const tax = ((spend + fee) * taxPct) / 100
  return { fee, tax, total: spend + fee + tax, mult: (1 + feePct / 100) * (1 + taxPct / 100) }
}

/* ---------- Ngân sách + lợi nhuận đã nhận ---------- */
/** Ngân sách test tối thiểu tháng sau: nền + x% lợi nhuận đã nhận (sau phí) tháng này + vốn ngoài. Lợi nhuận âm tính là 0. */
export const nextBudget = (base: number, reinvestPct: number, receivedProfit: number, extra = 0) => base + Math.max(0, receivedProfit) * (reinvestPct / 100) + Math.max(0, extra)
/** "Tự nuôi được tới đâu": lợi nhuận đã nhận (sau phí) cần có để ngân sách test tự đạt mức X mà không cần vốn ngoài. */
export const selfFundProfit = (target: number, base: number, reinvestPct: number) => (reinvestPct > 0 ? Math.max(0, target - base) / (reinvestPct / 100) : Infinity)
/** Lợi nhuận đã nhận sau phí, chi phí cố định và thuế (từ số thực tế: thực nhận + chi phí ads). */
export function profitAfterFees(t: { received: number; cost: number }, cfg: Partial<AffConfig>) {
  const v = v2Of(cfg)
  const { fee, tax } = adCharges(t.cost, v.fee_pct, v.tax_pct)
  return { fee, fixed: v.fixed_cost_month, tax, net: t.received - t.cost - fee - tax - v.fixed_cost_month }
}

/* ---------- Cổng bằng chứng (GĐ4, A5) ---------- */
/** Cổng tính từ dữ liệu thật, không lưu tay:
 *  0 = chưa có dự án đủ điều kiện scale (mục tiêu = khối lượng test)
 *  1 = có ≥ 1 dự án đủ điều kiện scale (mục tiêu: lợi nhuận đã nhận sau phí chạm gate1_profit/tháng; mở ngân sách scale)
 *  2 = đã có 1 tháng lợi nhuận đã nhận sau phí ≥ gate1_profit (mở SaaS + Tools AI nếu saas_unlock_gate = 2; mục tiêu gate2_profit)
 *  3 = đã có 1 tháng ≥ gate2_profit (mở gợi ý team / AI) */
export type Gate = 0 | 1 | 2 | 3
export interface GateInfo {
  gate: Gate
  best: { month: string; net: number } | null // tháng lợi nhuận đã nhận sau phí cao nhất
  next: { label: string; need: string; missing: string } | null
  saasOpen: boolean // SaaS + Tools AI đã mở theo cổng
  scaleOpen: boolean // ngân sách scale đã mở
}
export function gateOf(readyCount: number, months: { month: string; received: number; cost: number }[], cfg: Partial<AffConfig>): GateInfo {
  const v = v2Of(cfg)
  const nets = months.map((m) => ({ month: m.month, net: profitAfterFees(m, cfg).net }))
  const best = nets.length ? nets.reduce((a, b) => (b.net > a.net ? b : a)) : null
  const bestNet = best?.net ?? -Infinity
  const gate: Gate = bestNet >= v.gate2_profit ? 3 : bestNet >= v.gate1_profit ? 2 : readyCount > 0 ? 1 : 0
  const usd = (n: number) => '$' + Math.round(n).toLocaleString('vi-VN')
  const next =
    gate === 0
      ? { label: 'Cổng 1: có dự án đủ điều kiện scale', need: '1 dự án qua đủ checklist scale', missing: 'chưa có dự án nào đủ điều kiện scale' }
      : gate === 1
        ? { label: `Cổng 2: lợi nhuận đã nhận sau phí ≥ ${usd(v.gate1_profit)} trong 1 tháng`, need: usd(v.gate1_profit), missing: `còn thiếu ${usd(v.gate1_profit - Math.max(0, bestNet))}` }
        : gate === 2
          ? { label: `Cổng 3: lợi nhuận đã nhận sau phí ≥ ${usd(v.gate2_profit)} trong 1 tháng`, need: usd(v.gate2_profit), missing: `còn thiếu ${usd(v.gate2_profit - Math.max(0, bestNet))}` }
          : null
  return { gate, best, next, saasOpen: gate >= v.saas_unlock_gate, scaleOpen: gate >= 1 }
}

/* ---------- Nhịp khối lượng giai đoạn tìm winner (A1, A2) ---------- */
/** Ngân sách test (đã gồm phí + thuế nạp) để đủ N test/tháng với tiền test hiện tại. */
export const kickoffBudget = (tests: number, testCost: number, cfg: Partial<AffConfig>) => {
  const v = v2Of(cfg)
  const spend = tests * testCost
  return { spend, topup: adCharges(spend, v.fee_pct, v.tax_pct).total }
}
/** Tháng trước đạt ≥ nhịp thì gợi ý tháng này gấp đôi (nguồn: "tháng trước 60 thì tháng này 120"); anh quyết. */
export const suggestDouble = (lastMonthTests: number, pace: number) => pace > 0 && lastMonthTests >= pace

/** Cỡ mẫu tối thiểu để đo được từng hệ số (giai đoạn tìm winner). */
export function sampleNeeds(testsPerWin: number, testCost: number) {
  return [
    { key: 'test_cost', label: 'Tiền test 1 dự án', need: 5, unit: 'test', note: '≥ 5 dự án đã test' },
    { key: 'approval', label: '% duyệt hoa hồng', need: 5, unit: 'đơn', note: '≥ 5 đơn đã quá hạn payout (đã duyệt hoặc bị huỷ)' },
    { key: 'wins', label: 'Tỷ lệ thắng, lợi nhuận 1 thắng', need: 3, unit: 'thắng', note: `≥ 3 thắng ≈ ${3 * testsPerWin} test ≈ $${Math.round(3 * testsPerWin * testCost).toLocaleString('vi-VN')} tiền test` },
  ]
}

/* ---------- Mùa vụ ---------- */
/** Số đo trong các tháng có hệ số mùa vụ khác 1 → quy về "mùa thường" trước khi dùng thay hệ số (chia cho mùa vụ TB của các tháng đo). */
export function deseason(value: number, seasons: number[]): number {
  const s = seasons.filter((x) => x > 0)
  if (!s.length) return value
  return value / (s.reduce((a, b) => a + b, 0) / s.length)
}
/** Cảnh báo: tháng 11, 12, 1 (mùa cao điểm vật lý) còn ở phía trước mà hệ số mùa vụ vẫn = 1. */
export function seasonWarn(rows: Pick<AffMonth, 'month' | 'season' | 'locked_at'>[], today: string): boolean {
  const cur = monthOf(today)
  return rows.some((r) => r.month >= cur && !r.locked_at && ['11', '12', '01'].includes(r.month.slice(5, 7)) && Number(r.season) === 1)
}

/* ---------- Bảng chỉ tiêu phân tầng ---------- */
export interface Targets {
  research: [number, number] // [tối thiểu (theo ngân sách), mục tiêu (đủ đạt LN)]
  reg: [number, number]
  tests: [number, number]
  testsP: number
  testsT: number
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
  const tests = both((m) => m.testsP + m.testsT + m.testsS)
  const last = ms[ms.length - 1]
  const lastRow = last ? rows.find((r) => r.month === last.month) : undefined
  const times = (p: [number, number], f: number): [number, number] => [p[0] * f, p[1] * f]
  return {
    research: times(tests, cfg.research_per_test),
    reg: times(tests, cfg.reg_per_test),
    tests,
    testsP: sum((m) => m.testsP),
    testsT: sum((m) => m.testsT),
    testsS: sum((m) => m.testsS),
    wins: level === 'week' || level === 'day' ? null : both((m) => m.winsP + m.winsT + m.winsS),
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

/* ---------- Hiển thị số dự án: số nguyên ---------- */
/** Chỉ tiêu số dự án làm tròn lên (đủ chỉ tiêu, không có số lẻ). */
export const ceilCount = (x: number) => Math.max(0, Math.ceil(x - 1e-9))
/** Số thắng: 0, "< 1" hoặc số nguyên gần nhất. */
export const winsLabel = (x: number) => (x <= 1e-9 ? '0' : x < 1 ? '< 1' : String(Math.round(x)))
/** Chỉ tiêu ngày từ chỉ tiêu tuần (số nguyên): ≥ số ngày làm thì chia đều làm tròn lên; ít hơn thì "1 · N ngày/tuần". */
export function dayLabel(weekValue: number, workDays: number): string {
  const w = ceilCount(weekValue)
  if (w === 0) return '0'
  if (w >= workDays) return String(Math.ceil(w / workDays))
  return `1 · ${w} ngày/tuần`
}
