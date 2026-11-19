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
  /* trường lọc (GĐ6, chẩn đoán ROI); tuỳ chọn */
  fixed_commission?: number | null
  commission_pct?: number | null
  pricing?: number | null
  commission_type?: string | null
  top_countries?: string[] | null
  cookie_days?: number | null
}
export type RegStatus = 'Chưa đăng ký' | 'Pending approval' | 'Active' | 'Rejected'
export interface WsReg {
  id: number
  project_id: number
  ref_key: string | null
  reg_status: RegStatus | string
  test_status: string
  test_result?: string | null
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

/* =====================================================================================================
   Sổ dự án GĐ3: mỗi đăng ký Research đã lên camp = 1 dòng, số liệu từ Ads-Hub (ghép theo ref_key).
   ===================================================================================================== */
const addDaysIso = (d: string, n: number) => {
  const x = new Date(d + 'T00:00:00Z')
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}
const daysBetweenIso = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400e3)

export interface LedgerRow {
  reg_id: number
  project_id: number
  name: string
  model: Model3 | null
  type_code: string | null
  trial_days: number | null
  ref_key: string | null
  reg_status: string
  test_status: string
  test_result: string | null
  first_test: string | null // ngày lên camp test đầu tiên (Research)
  camps: string[]
  source: 'ads-hub' | 'research' // số lấy từ Ads-Hub (ghép được camp) hay từ lần test ở Research
  cost: number
  clicks: number
  last_click: string | null // ngày gần nhất có click
  orders: Record<OrderStatus, number>
  comm: Record<OrderStatus, number>
  order_days: string[] // các ngày có đơn (không tính đơn bị huỷ), tăng dần
}
/** Dựng Sổ dự án từ Research (đăng ký đã lên camp, hoặc có chi phí ở Ads-Hub) + Ads-Hub. */
export function buildLedger(ws: WsData, ah: AhData | null): LedgerRow[] {
  const pById = new Map(ws.projects.map((p) => [p.id, p]))
  const first = firstTestDay(ws.runs)
  const runsBy = new Map<number, WsRun[]>()
  for (const r of ws.runs) runsBy.set(r.registration_id, [...(runsBy.get(r.registration_id) ?? []), r])
  const campsByRef = new Map<string, string[]>()
  for (const c of ah?.camps ?? []) if (c.ref_key) campsByRef.set(c.ref_key, [...(campsByRef.get(c.ref_key) ?? []), c.camp])
  const out: LedgerRow[] = []
  const seenRef = new Set<string>()
  for (const r of ws.regs) {
    const camps = r.ref_key && !seenRef.has(r.ref_key) ? (campsByRef.get(r.ref_key) ?? []) : []
    if (r.ref_key) seenRef.add(r.ref_key)
    if (!first.get(r.id) && !camps.length) continue
    const p = pById.get(r.project_id)
    const row: LedgerRow = {
      reg_id: r.id,
      project_id: r.project_id,
      name: p?.name ?? `Dự án #${r.project_id}`,
      model: modelOfType(p?.type_code),
      type_code: p?.type_code ?? null,
      trial_days: p?.trial_days ?? null,
      ref_key: r.ref_key,
      reg_status: String(r.reg_status),
      test_status: r.test_status,
      test_result: r.test_result ?? null,
      first_test: first.get(r.id) ?? null,
      camps,
      source: camps.length ? 'ads-hub' : 'research',
      cost: 0,
      clicks: 0,
      last_click: null,
      orders: { pending: 0, approved: 0, paid: 0, denied: 0 },
      comm: { pending: 0, approved: 0, paid: 0, denied: 0 },
      order_days: [],
    }
    if (camps.length && ah) {
      const set = new Set(camps)
      const days = new Set<string>()
      for (const s of ah.spend) {
        if (!set.has(s.camp)) continue
        row.cost += Number(s.cost ?? 0)
        row.clicks += Number(s.clicks)
        if (Number(s.clicks) > 0 && (!row.last_click || s.d > row.last_click)) row.last_click = s.d
      }
      for (const o of ah.orders) {
        if (!o.camp || !set.has(o.camp)) continue
        row.orders[o.status] += Number(o.n)
        row.comm[o.status] += Number(o.comm)
        if (o.status !== 'denied' && Number(o.n) > 0) days.add(o.d)
      }
      row.order_days = [...days].sort()
    } else {
      for (const x of runsBy.get(r.id) ?? []) {
        row.cost += Number(x.cost_usd ?? 0)
        row.clicks += Number(x.clicks ?? 0)
      }
    }
    row.cost = Math.round(row.cost * 100) / 100
    out.push(row)
  }
  return out
}
export const liveOrders = (r: Pick<LedgerRow, 'orders'>) => r.orders.pending + r.orders.approved + r.orders.paid
export const receivedComm = (r: Pick<LedgerRow, 'comm'>) => r.comm.approved + r.comm.paid

/* ---------- Cờ dừng theo click (luật Research) ---------- */
export type StopLevel = 'none' | 'consider' | 'stop' | 'trial' | 'has_orders'
export interface StopCheck {
  level: StopLevel
  cpc_usd: number | null
  cpc_vnd: number | null
  cps: number | null // click cho 1 sale theo bậc CPC (bảng Loại dự án & Click/Sale của Research)
  max_clicks: number | null // maxtest ÷ CPC
  cap: number // trần tiền test = maxtest × (trần mở rộng nếu có lý do)
  trial_left: number | null // SaaS/Tools AI: còn bao nhiêu ngày chờ dùng thử
  by_money: boolean // chưa có click → chỉ xét theo tiền
}
/** Luật dừng giống Research: click/sale theo bậc CPC, không vượt maxtest ÷ CPC.
 *  0 đơn mà đủ click/sale → "cân nhắc dừng"; tiêu chạm trần (maxtest, ×2 khi có lý do mở rộng) → "nên dừng".
 *  SaaS / Tools AI: còn trong cửa sổ dùng thử (tính từ ngày có click gần nhất, mặc định 14 ngày) thì "chờ dùng thử", không báo dừng. */
export function stopCheck(
  r: Pick<LedgerRow, 'cost' | 'clicks' | 'type_code' | 'model' | 'trial_days' | 'last_click' | 'orders'>,
  th: Pick<SharedThresholds, 'usd_vnd' | 'max_test_usd' | 'click_rules'>,
  capMult: number,
  extended: boolean,
  today: string,
  fallbackTestCost = 10,
): StopCheck {
  const maxTest = th.max_test_usd ?? fallbackTestCost
  const cap = maxTest * (extended ? capMult : 1)
  const cpcUsd = r.clicks > 0 && r.cost > 0 ? r.cost / r.clicks : null
  const cpcVnd = cpcUsd !== null && th.usd_vnd ? cpcUsd * th.usd_vnd : null
  const rule = th.click_rules.find((t) => t.code === r.type_code)
  const cps = rule && cpcVnd !== null ? (cpcVnd < rule.tier_low_vnd ? rule.clicks_low : cpcVnd <= rule.tier_high_vnd ? rule.clicks_mid : rule.clicks_high) : null
  const maxClicks = cpcUsd ? Math.round(maxTest / cpcUsd) : null
  const base = { cpc_usd: cpcUsd, cpc_vnd: cpcVnd, cps, max_clicks: maxClicks, cap, trial_left: null, by_money: cpcUsd === null }
  if (liveOrders(r) > 0) return { ...base, level: 'has_orders' }
  const level: StopLevel = r.cost >= cap - 1e-9 ? 'stop' : cps !== null && r.clicks >= cps ? 'consider' : 'none'
  if (level !== 'none' && (r.model === 'saas' || r.model === 'tools_ai') && r.last_click) {
    const left = (r.trial_days && r.trial_days > 0 ? r.trial_days : 14) - daysBetweenIso(r.last_click, today)
    if (left > 0) return { ...base, level: 'trial', trial_left: left }
  }
  return { ...base, level }
}

/* ---------- % duyệt hoa hồng đo được (B8) ---------- */
export interface ApprovalStat {
  pct: number | null // đã duyệt ÷ (đã duyệt + bị huỷ), chỉ đơn đã quá hạn payout; null = chưa đủ dữ liệu
  resolved: number // số đơn đã quá hạn payout và có kết quả (duyệt/trả/huỷ)
  pending_n: number // đơn đang chờ duyệt (mọi thời điểm)
  pending_comm: number
}
export const MIN_RESOLVED = 5
/** Chỉ tính đơn đã quá hạn payout (Vật lý 30 ngày, SaaS / Tools AI 45 ngày), bỏ phần chờ duyệt. */
export function approvalStat(ah: AhData, ws: Pick<WsData, 'projects' | 'regs'> | null, today: string, payoutDays: number, model?: Model3): ApprovalStat {
  const cm = campModels(ah, ws)
  const cutoff = addDaysIso(today, -payoutDays)
  let ok = 0
  let bad = 0
  let nOk = 0
  let nBad = 0
  let pn = 0
  let pc = 0
  for (const o of ah.orders) {
    if (model && (!o.camp || cm.get(o.camp) !== model)) continue
    if (o.status === 'pending') {
      pn += Number(o.n)
      pc += Number(o.comm)
      continue
    }
    if (o.d > cutoff) continue
    if (o.status === 'denied') {
      bad += Number(o.comm)
      nBad += Number(o.n)
    } else {
      ok += Number(o.comm)
      nOk += Number(o.n)
    }
  }
  const resolved = nOk + nBad
  return { pct: resolved >= MIN_RESOLVED && ok + bad > 0 ? (ok / (ok + bad)) * 100 : null, resolved, pending_n: pn, pending_comm: Math.round(pc * 100) / 100 }
}

/* ---------- Hai cờ thắng + checklist đủ điều kiện scale (B4) ---------- */
export interface ScaleManual {
  qs7?: boolean // Quality Score ≥ 7
  is40?: boolean // Impression Share ≤ 40%
  lostis30?: boolean // Lost IS do ngân sách ≥ 30%
  cap3?: boolean // cap offer ≥ 3 lần mức scale
}
export const SCALE_MANUAL: { k: keyof ScaleManual; label: string }[] = [
  { k: 'qs7', label: 'Quality Score ≥ 7' },
  { k: 'is40', label: 'Impression Share ≤ 40% (còn chỗ để tăng)' },
  { k: 'lostis30', label: 'Lost IS do ngân sách ≥ 30%' },
  { k: 'cap3', label: 'Cap của offer ≥ 3 lần mức muốn scale' },
]
export interface WinCheck {
  candidate: boolean // ứng viên thắng: ≥ N đơn và ROAS thực nhận dự kiến ≥ ngưỡng
  orders: number // đơn không bị huỷ
  roas_expected: number | null // (đã duyệt + chờ × % duyệt) ÷ chi phí
  roas_real: number | null // đã duyệt ÷ chi phí
  conv30: number // đơn (không huỷ) trong 30 ngày gần nhất
  steady_days: number // số ngày có đơn trong 14 ngày gần nhất
  auto: { conv30: boolean; roas: boolean; steady: boolean }
  manual_ok: boolean
  ready: boolean // đủ điều kiện scale
  low_volume: boolean // < 20 chuyển đổi / 30 ngày: đừng scale dù đang lãi
}
export function winCheck(
  r: Pick<LedgerRow, 'cost' | 'orders' | 'comm' | 'order_days' | 'camps'>,
  ah: AhData | null,
  approvalPct: number | null,
  th: Pick<SharedThresholds, 'roa' | 'winner_orders'>,
  manual: ScaleManual,
  today: string,
  fallback = { roa: 1.5, winner: 3 },
): WinCheck {
  const roaMin = th.roa?.[0] ?? fallback.roa
  const winN = th.winner_orders ?? fallback.winner
  const orders = liveOrders(r)
  const got = receivedComm(r)
  const expected = got + r.comm.pending * ((approvalPct ?? 100) / 100)
  const roasExp = r.cost > 0 ? expected / r.cost : null
  const roasReal = r.cost > 0 ? got / r.cost : null
  const from30 = addDaysIso(today, -29)
  const from14 = addDaysIso(today, -13)
  const set = new Set(r.camps)
  let conv30 = 0
  for (const o of ah?.orders ?? []) if (o.camp && set.has(o.camp) && o.status !== 'denied' && o.d >= from30 && o.d <= today) conv30 += Number(o.n)
  const steady = r.order_days.filter((d) => d >= from14 && d <= today).length
  const auto = { conv30: conv30 >= 30, roas: roasReal !== null && roasReal >= roaMin, steady: steady >= 7 }
  const manualOk = SCALE_MANUAL.every((m) => !!manual[m.k])
  return {
    candidate: orders >= winN && roasExp !== null && roasExp >= roaMin,
    orders,
    roas_expected: roasExp,
    roas_real: roasReal,
    conv30,
    steady_days: steady,
    auto,
    manual_ok: manualOk,
    ready: auto.conv30 && auto.roas && auto.steady && manualOk,
    low_volume: conv30 < 20,
  }
}

/* ---------- Tiền theo tháng (cho cổng bằng chứng) ---------- */
/** Chi phí ads và hoa hồng đã nhận (đã duyệt + đã trả) theo tháng, từ Ads-Hub. Hoa hồng tính vào tháng của đơn. */
export function monthlyMoney(ah: AhData, ws: Pick<WsData, 'projects' | 'regs'> | null = null, model?: Model3): { month: string; cost: number; received: number }[] {
  const cm = model ? campModels(ah, ws) : null
  const ok = (camp: string | null) => !model || (!!camp && cm!.get(camp) === model)
  const by = new Map<string, { cost: number; received: number }>()
  const get = (d: string) => {
    const k = d.slice(0, 8) + '01'
    if (!by.has(k)) by.set(k, { cost: 0, received: 0 })
    return by.get(k)!
  }
  for (const s of ah.spend) if (ok(s.camp)) get(s.d).cost += Number(s.cost ?? 0)
  for (const o of ah.orders) if ((o.status === 'approved' || o.status === 'paid') && ok(o.camp)) get(o.d).received += Number(o.comm)
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, cost: Math.round(v.cost * 100) / 100, received: Math.round(v.received * 100) / 100 }))
}

/* ---------- GĐ5: dữ liệu cho OKR / Kaizen dựng từ Research + Ads-Hub ---------- */
/** Một "dự án" theo khuôn Sổ dự án cũ, dựng từ 1 đăng ký Research (để KR tự đếm, Kaizen, chẩn đoán dùng chung một logic). */
export interface VProject {
  id: string
  name: string
  link: string
  model: Model3
  network: string
  niche: string
  geo: string
  stage: 'research' | 'dat_loc' | 'dang_ky' | 'duoc_duyet' | 'test' | 'win' | 'dung'
  dates: Partial<Record<'dat_loc' | 'dang_ky' | 'duoc_duyet' | 'test' | 'win' | 'dung', string>>
  op_status: null
  ext_reason: string
  stop_reason: string
  note: string
  created_at: string
}
export interface VEntry {
  id: string
  project_id: string
  date: string
  cost: number
  revenue: number // hoa hồng chưa huỷ (chờ + duyệt + trả)
  received: number // hoa hồng đã duyệt + đã trả
  orders: number
  refs: number
  customers: number
  note: string
}
export interface FlagSum {
  stop: number
  consider: number
  trial: number
  candidate: number // ứng viên thắng chưa đủ điều kiện scale
  ready: number // đủ điều kiện scale
}
/** Giai đoạn theo trạng thái Research: Rejected / đã test xong → Dừng; Lãi → Thắng; đang test → test… */
function stageOf(r: Pick<WsReg, 'reg_status' | 'test_status' | 'test_result'>, tested: boolean): VProject['stage'] {
  if (r.test_result === 'Lãi') return 'win'
  if (r.reg_status === 'Rejected') return 'dung'
  if (r.test_status === 'Đang Testing') return 'test'
  if (['Đã Test', 'Dừng chờ Paid', 'Closed Program'].includes(r.test_status)) return 'dung'
  if (tested) return 'test'
  if (r.reg_status === 'Active') return 'duoc_duyet'
  if (r.reg_status === 'Pending approval') return 'dang_ky'
  return 'dat_loc'
}
/** Dựng projects + entries theo khuôn cũ:
 *  - mỗi đăng ký = 1 dự án; ngày "chọn" = ngày tạo dự án ở Research (chỉ gán cho đăng ký đầu tiên của dự án, tránh đếm trùng);
 *    dự án Research chưa có đăng ký vẫn tính 1 lần "chọn"
 *  - đăng ký / duyệt link / dừng = ngày ghi ở Research (09_reg_dates); test = ngày test đầu tiên; thắng (kết quả "Lãi") = ngày có đơn gần nhất
 *  - entries theo ngày từ Ads-Hub: chi phí, hoa hồng chưa huỷ, hoa hồng đã nhận, số đơn */
export function researchProjects(ws: WsData, ah: AhData | null, ledger: LedgerRow[], extReason: (regId: number) => string = () => ''): { projects: VProject[]; entries: VEntry[] } {
  const first = firstTestDay(ws.runs)
  const lr = new Map(ledger.map((r) => [r.reg_id, r]))
  const firstReg = new Map<number, number>()
  for (const r of [...ws.regs].sort((a, b) => a.id - b.id)) if (!firstReg.has(r.project_id)) firstReg.set(r.project_id, r.id)
  const projects: VProject[] = []
  const entries: VEntry[] = []
  const pById = new Map(ws.projects.map((p) => [p.id, p]))
  for (const r of ws.regs) {
    const p = pById.get(r.project_id)
    const model = modelOfType(p?.type_code) ?? 'phys'
    const row = lr.get(r.id)
    const t = first.get(r.id)
    const dates: VProject['dates'] = {}
    if (firstReg.get(r.project_id) === r.id && p) dates.dat_loc = vnDate(p.created_at)
    if (r.registered_on) dates.dang_ky = r.registered_on
    if (r.approved_on) dates.duoc_duyet = r.approved_on
    if (t) dates.test = t
    if (r.rejected_on) dates.dung = r.rejected_on
    if (r.test_result === 'Lãi') dates.win = row?.order_days[row.order_days.length - 1] ?? t ?? r.approved_on ?? vnDate(r.created_at)
    const id = `ws-${r.id}`
    projects.push({
      id,
      name: p?.name ?? `Dự án #${r.project_id}`,
      link: '',
      model,
      network: '',
      niche: '',
      geo: '',
      stage: stageOf(r, !!t),
      dates,
      op_status: null,
      ext_reason: extReason(r.id),
      stop_reason: '',
      note: '',
      created_at: r.created_at,
    })
    if (row && row.source === 'ads-hub' && ah) {
      const set = new Set(row.camps)
      const by = new Map<string, VEntry>()
      const get = (d: string) => {
        if (!by.has(d)) by.set(d, { id: `${id}-${d}`, project_id: id, date: d, cost: 0, revenue: 0, received: 0, orders: 0, refs: 0, customers: 0, note: 'Ads-Hub' })
        return by.get(d)!
      }
      for (const s of ah.spend) if (set.has(s.camp)) get(s.d).cost += Number(s.cost ?? 0)
      for (const o of ah.orders) {
        if (!o.camp || !set.has(o.camp) || o.status === 'denied') continue
        const e = get(o.d)
        e.revenue += Number(o.comm)
        e.orders += Number(o.n)
        if (o.status !== 'pending') e.received += Number(o.comm)
      }
      entries.push(...by.values())
    } else if (row && t && row.cost > 0) {
      entries.push({ id: `${id}-r`, project_id: id, date: t, cost: row.cost, revenue: 0, received: 0, orders: 0, refs: 0, customers: 0, note: 'Research' })
    }
  }
  for (const p of ws.projects)
    if (!firstReg.has(p.id))
      projects.push({ id: `wsp-${p.id}`, name: p.name, link: '', model: modelOfType(p.type_code) ?? 'phys', network: '', niche: '', geo: '', stage: 'dat_loc', dates: { dat_loc: vnDate(p.created_at) }, op_status: null, ext_reason: '', stop_reason: '', note: '', created_at: p.created_at })
  return { projects, entries }
}
/** Đếm cờ của Sổ dự án (đang test: dừng / cân nhắc / chờ dùng thử; mọi dự án: ứng viên / đủ scale). */
export function flagSum(items: { r: Pick<LedgerRow, 'test_status'>; stop: Pick<StopCheck, 'level'>; win: Pick<WinCheck, 'candidate' | 'ready'> }[]): FlagSum {
  const t = items.filter((x) => x.r.test_status === 'Đang Testing')
  return {
    stop: t.filter((x) => x.stop.level === 'stop').length,
    consider: t.filter((x) => x.stop.level === 'consider').length,
    trial: t.filter((x) => x.stop.level === 'trial').length,
    candidate: items.filter((x) => x.win.candidate && !x.win.ready).length,
    ready: items.filter((x) => x.win.ready).length,
  }
}

/* ---------- Cờ của Sổ dự án, dùng chung cho màn Sổ dự án và OKR / Kaizen ---------- */
export interface LinkRow {
  id?: string
  ws_reg_id?: number | null
  ext_reason?: string
  scale_check?: Record<string, boolean>
}
export interface LedgerItem<L extends LinkRow = LinkRow> {
  r: LedgerRow
  link: L | undefined
  stop: StopCheck
  win: WinCheck
}
/** % duyệt theo mô hình (đơn đã quá hạn payout của từng mô hình). */
export function approvalByModel(ah: AhData, ws: Pick<WsData, 'projects' | 'regs'>, today: string, payout: Record<Model3, number>): Record<Model3, ApprovalStat> {
  return Object.fromEntries(MODEL3.map((m) => [m, approvalStat(ah, ws, today, payout[m], m)])) as Record<Model3, ApprovalStat>
}
/** Gắn cờ dừng + cờ thắng cho từng dòng Sổ dự án. opts: trần mở rộng, tiền test dự phòng, ngưỡng dự phòng khi chưa đọc được Research / Ads-Hub. */
export function ledgerItems<L extends LinkRow>(
  rows: LedgerRow[],
  links: L[],
  th: Pick<SharedThresholds, 'usd_vnd' | 'max_test_usd' | 'click_rules' | 'roa' | 'winner_orders'>,
  opts: { capMult: number; testCost: number; roa: number; winner: number },
  ah: AhData | null,
  appr: Record<Model3, ApprovalStat> | null,
  today: string,
): LedgerItem<L>[] {
  return rows.map((r) => {
    const link = links.find((p) => p.ws_reg_id === r.reg_id)
    return {
      r,
      link,
      stop: stopCheck(r, th, opts.capMult, !!link?.ext_reason?.trim(), today, opts.testCost),
      win: winCheck(r, ah, r.model && appr ? appr[r.model].pct : null, th, (link?.scale_check ?? {}) as ScaleManual, today, { roa: opts.roa, winner: opts.winner }),
    }
  })
}

/* ---------- GĐ6: ROI theo trường lọc của Research (C2) ---------- */
export interface RoiBucket {
  bucket: string
  n: number // số dự án đã test (có chi phí)
  cost: number
  received: number // hoa hồng đã duyệt + đã trả
  roi: number | null // %
  few: boolean // ít mẫu (< minN)
}
export interface RoiGroup {
  field: string
  buckets: RoiBucket[]
}
export const ROI_MIN_TOTAL = 10
/** Hoa hồng 1 đơn ước tính: hoa hồng cố định, hoặc % × giá. */
export const commissionPerOrder = (p: Pick<WsProject, 'fixed_commission' | 'commission_pct' | 'pricing'>): number | null => {
  if (p.fixed_commission && p.fixed_commission > 0) return Number(p.fixed_commission)
  if (p.commission_pct && p.pricing && p.commission_pct > 0 && p.pricing > 0) return (Number(p.commission_pct) / 100) * Number(p.pricing)
  return null
}
/** So ROI của dự án đã test theo nhóm của từng trường lọc. Chỉ có ý nghĩa khi tổng ≥ ROI_MIN_TOTAL dự án. */
export function roiByField(rows: LedgerRow[], ws: Pick<WsData, 'projects'>, minN = 5): { total: number; enough: boolean; groups: RoiGroup[] } {
  const pById = new Map(ws.projects.map((p) => [p.id, p]))
  const tested = rows.filter((r) => r.cost > 0)
  const keyers: [string, (p: WsProject | undefined) => string][] = [
    [
      'Hoa hồng / đơn',
      (p) => {
        const c = p ? commissionPerOrder(p) : null
        return c === null ? 'không rõ' : c < 10 ? '< $10' : c < 30 ? '$10–30' : '≥ $30'
      },
    ],
    ['Loại hoa hồng', (p) => (p?.commission_type?.trim() ? p.commission_type.trim() : 'không rõ')],
    ['Thị trường chính', (p) => (p?.top_countries?.length ? p.top_countries[0] : 'không rõ')],
    ['Cookie', (p) => (p?.cookie_days == null ? 'không rõ' : p.cookie_days < 30 ? '< 30 ngày' : '≥ 30 ngày')],
  ]
  const groups = keyers.map(([field, key]) => {
    const by = new Map<string, { n: number; cost: number; received: number }>()
    for (const r of tested) {
      const k = key(pById.get(r.project_id))
      const b = by.get(k) ?? { n: 0, cost: 0, received: 0 }
      b.n++
      b.cost += r.cost
      b.received += receivedComm(r)
      by.set(k, b)
    }
    const buckets = [...by.entries()]
      .map(([bucket, b]) => ({ bucket, n: b.n, cost: Math.round(b.cost * 100) / 100, received: Math.round(b.received * 100) / 100, roi: b.cost > 0 ? ((b.received - b.cost) / b.cost) * 100 : null, few: b.n < minN }))
      .sort((a, b) => b.n - a.n)
    return { field, buckets }
  })
  return { total: tested.length, enough: tested.length >= ROI_MIN_TOTAL, groups }
}
