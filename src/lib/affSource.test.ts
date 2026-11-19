import { describe, expect, it } from 'vitest'
import { ahTotals, approvalStat, buildLedger, commissionPerOrder, flagSum, researchProjects, roiByField, campModels, firstTestDay, modelOfType, monthlyMoney, sharedThresholds, stopCheck, vnDate, winCheck, wsCounts, type AhData, type WsData } from './affSource'

const ws: WsData = {
  settings: {
    max_test_usd: 10,
    usd_vnd: 25726,
    roa_hoa: 1.5,
    roa_lai: 3,
    roa_lai_tot: 4.5,
  },
  types: [
    {
      code: 'vat_ly',
      name: 'Vật lý',
      tier_low_vnd: 5000,
      tier_high_vnd: 15000,
      clicks_low: 50,
      clicks_mid: 30,
      clicks_high: 15,
      active: true,
    },
    {
      code: 'cu',
      name: 'Cũ',
      tier_low_vnd: 1,
      tier_high_vnd: 2,
      clicks_low: 1,
      clicks_mid: 1,
      clicks_high: 1,
      active: false,
    },
  ],
  projects: [
    {
      id: 1,
      name: 'Đèn',
      type_code: 'vat_ly',
      trial_days: null,
      created_at: '2026-11-09T18:30:00+00:00',
    }, // 10/11 giờ VN
    {
      id: 2,
      name: 'Writely',
      type_code: 'tools_ai',
      trial_days: 7,
      created_at: '2026-11-10T03:00:00+00:00',
    },
    {
      id: 3,
      name: 'CRM',
      type_code: 'saas',
      trial_days: 14,
      created_at: '2026-10-28T03:00:00+00:00',
    },
  ],
  regs: [
    {
      id: 11,
      project_id: 1,
      ref_key: 'sca|111',
      reg_status: 'Active',
      test_status: 'Đang Testing',
      created_at: '2026-11-10T03:00:00Z',
      registered_on: '2026-11-10',
      approved_on: '2026-11-11',
      rejected_on: null,
    },
    {
      id: 12,
      project_id: 2,
      ref_key: 'writely.com|abc',
      reg_status: 'Rejected',
      test_status: 'Chưa đủ ĐK',
      created_at: '2026-11-10T03:00:00Z',
      registered_on: '2026-11-10',
      approved_on: null,
      rejected_on: '2026-11-12',
    },
    {
      id: 13,
      project_id: 3,
      ref_key: 'crm.io|x',
      reg_status: 'Active',
      test_status: 'Đang Testing',
      created_at: '2026-10-28T03:00:00Z',
      registered_on: '2026-10-28',
      approved_on: '2026-10-30',
      rejected_on: null,
    },
  ],
  runs: [
    {
      id: 1,
      registration_id: 11,
      started_on: '2026-11-13',
      cost_usd: 5,
      clicks: 30,
    },
    {
      id: 2,
      registration_id: 11,
      started_on: '2026-11-12',
      cost_usd: 2,
      clicks: 10,
    }, // lần test thứ 2 sớm hơn → ngày test = 12/11
    {
      id: 3,
      registration_id: 13,
      started_on: '2026-10-31',
      cost_usd: 20,
      clicks: 80,
    },
  ],
  hasDates: true,
}
const ah: AhData = {
  spend: [
    { d: '2026-11-12', camp: 'c1', cust: '1', cost: 3.5, clicks: 20 },
    { d: '2026-11-13', camp: 'c1', cust: '1', cost: 2.25, clicks: 12 },
    { d: '2026-11-13', camp: 'c3', cust: '1', cost: 9, clicks: 40 },
    { d: '2026-11-13', camp: 'cx', cust: '2', cost: 1, clicks: 3 }, // camp chưa ghép dự án
    { d: '2026-11-14', camp: 'c1', cust: '1', cost: null, clicks: 4 }, // chưa có tỷ giá
    { d: '2026-12-01', camp: 'c1', cust: '1', cost: 100, clicks: 100 }, // ngoài kỳ
  ],
  orders: [
    { d: '2026-11-13', camp: 'c1', status: 'pending', n: 2, comm: 8 },
    { d: '2026-11-13', camp: 'c1', status: 'denied', n: 1, comm: 4 },
    { d: '2026-11-14', camp: 'c3', status: 'approved', n: 1, comm: 15 },
    { d: '2026-11-14', camp: null, status: 'paid', n: 1, comm: 6 },
  ],
  camps: [
    {
      camp: 'c1',
      cust: '1',
      ref_key: 'sca|111',
      name: 'GA-VL-11-001 | Đèn',
      first_seen: null,
    },
    {
      camp: 'c3',
      cust: '1',
      ref_key: 'crm.io|x',
      name: 'CRM',
      first_seen: null,
    },
    { camp: 'cx', cust: '2', ref_key: null, name: 'Lạ', first_seen: null },
  ],
  settings: { winner_orders: 3, max_test_usd: 10 },
}

describe('nguồn Research + Ads-Hub', () => {
  it('loại dự án → 3 mô hình riêng', () => {
    expect(modelOfType('vat_ly')).toBe('phys')
    expect(modelOfType('tools_ai')).toBe('tools_ai')
    expect(modelOfType('saas')).toBe('saas')
    expect(modelOfType('khac')).toBeNull()
    expect(modelOfType(null)).toBeNull()
  })
  it('ngày theo giờ VN', () => {
    expect(vnDate('2026-11-09T18:30:00+00:00')).toBe('2026-11-10')
    expect(vnDate('2026-11-10T03:00:00Z')).toBe('2026-11-10')
    expect(vnDate('2026-11-10')).toBe('2026-11-10')
  })
  it('ngày test = lần test sớm nhất của đăng ký', () => {
    expect(firstTestDay(ws.runs).get(11)).toBe('2026-11-12')
  })
  it('đếm đầu vào tháng 11 từ Research', () => {
    expect(wsCounts(ws, '2026-11-01', '2026-11-30')).toEqual({
      chon: 2,
      dang_ky: 2,
      duyet: 1,
      tu_choi: 1,
      test: 1,
    })
    expect(wsCounts(ws, '2026-11-01', '2026-11-30', 'phys')).toEqual({
      chon: 1,
      dang_ky: 1,
      duyet: 1,
      tu_choi: 0,
      test: 1,
    })
    expect(wsCounts(ws, '2026-11-01', '2026-11-30', 'tools_ai')).toEqual({
      chon: 1,
      dang_ky: 1,
      duyet: 0,
      tu_choi: 1,
      test: 0,
    })
    expect(wsCounts(ws, '2026-10-01', '2026-10-31', 'saas')).toEqual({
      chon: 1,
      dang_ky: 1,
      duyet: 1,
      tu_choi: 0,
      test: 1,
    })
  })
  it('Research chưa có ngày đăng ký (chưa chạy 09) → đăng ký/duyệt/từ chối = null, không đoán', () => {
    const c = wsCounts({ ...ws, hasDates: false }, '2026-11-01', '2026-11-30')
    expect(c.dang_ky).toBeNull()
    expect(c.duyet).toBeNull()
    expect(c.test).toBe(1)
  })
  it('camp → mô hình qua ref_key', () => {
    const m = campModels(ah, ws)
    expect(m.get('c1')).toBe('phys')
    expect(m.get('c3')).toBe('saas')
    expect(m.get('cx')).toBeNull()
    expect(campModels(ah, null).get('c1')).toBeNull()
  })
  it('tổng tháng 11 từ Ads-Hub: chi phí, click, hoa hồng tách trạng thái', () => {
    const t = ahTotals(ah, ws, '2026-11-01', '2026-11-30')
    expect(t.cost).toBe(15.75)
    expect(t.clicks).toBe(79)
    expect(t.noRateCost).toBe(1)
    expect(t.comm).toEqual({ pending: 8, approved: 15, paid: 0, denied: 4 })
    expect(t.orders).toEqual({ pending: 2, approved: 1, paid: 0, denied: 1 })
    expect(t.unmatchedOrders).toBe(1)
    expect(t.unmatchedComm).toBe(6)
    expect(t.unknownCampCost).toBe(1)
  })
  it('lọc theo mô hình', () => {
    const p = ahTotals(ah, ws, '2026-11-01', '2026-11-30', 'phys')
    expect(p.cost).toBe(5.75)
    expect(p.clicks).toBe(36)
    expect(p.comm.pending).toBe(8)
    expect(p.comm.approved).toBe(0)
    expect(p.unmatchedOrders).toBe(0)
    const s = ahTotals(ah, ws, '2026-11-01', '2026-11-30', 'saas')
    expect(s.cost).toBe(9)
    expect(s.comm.approved).toBe(15)
  })
  it('ngưỡng dùng chung: tỷ giá, maxtest, ROA từ Research; winner từ Ads-Hub; bỏ loại đã tắt', () => {
    const t = sharedThresholds(ws, ah)
    expect(t.usd_vnd).toBe(25726)
    expect(t.max_test_usd).toBe(10)
    expect(t.roa).toEqual([1.5, 3, 4.5])
    expect(t.winner_orders).toBe(3)
    expect(t.click_rules.map((r) => r.code)).toEqual(['vat_ly'])
    expect(sharedThresholds(null, null).usd_vnd).toBeNull()
  })
})

describe('Sổ dự án GĐ3: Research + Ads-Hub', () => {
  const th = sharedThresholds(ws, ah)
  const R = 25726
  const at = (vnd: number, clicks: number) => ({ cost: (vnd / R) * clicks, clicks })
  const base = { type_code: 'vat_ly', model: 'phys' as const, trial_days: null, last_click: '2026-11-17', orders: { pending: 0, approved: 0, paid: 0, denied: 0 } }

  it('dựng dòng từ đăng ký đã lên camp, số lấy từ Ads-Hub theo ref_key', () => {
    const rows = buildLedger(ws, ah)
    const den = rows.find((r) => r.reg_id === 11)!
    expect(den.source).toBe('ads-hub')
    expect(den.camps).toEqual(['c1'])
    expect(den.cost).toBe(105.75) // gồm cả chi phí ngày 01/12
    expect(den.orders.pending).toBe(2)
    expect(den.orders.denied).toBe(1)
    expect(den.order_days).toEqual(['2026-11-13'])
    expect(den.last_click).toBe('2026-12-01')
    expect(rows.find((r) => r.reg_id === 12)).toBeUndefined() // bị từ chối, chưa test
  })
  it('chưa ghép được camp → dùng chi phí, click của lần test ở Research', () => {
    const rows = buildLedger(ws, { ...ah, camps: [] })
    const den = rows.find((r) => r.reg_id === 11)!
    expect(den.source).toBe('research')
    expect(den.cost).toBe(7)
    expect(den.clicks).toBe(40)
  })
  it('Vật lý CPC 4.000đ, 0 đơn: 49 click chưa cờ, 50 click cân nhắc dừng, chạm maxtest nên dừng', () => {
    expect(stopCheck({ ...base, ...at(4000, 49) }, th, 2, false, '2026-11-18').level).toBe('none')
    const c = stopCheck({ ...base, ...at(4000, 50) }, th, 2, false, '2026-11-18')
    expect(c.level).toBe('consider')
    expect(c.cps).toBe(50)
    expect(c.max_clicks).toBe(64) // $10 ÷ CPC
    expect(stopCheck({ ...base, ...at(4000, 65) }, th, 2, false, '2026-11-18').level).toBe('stop')
  })
  it('CPC 8.000đ → bậc giữa 30 click; có lý do mở rộng thì trần ×2', () => {
    expect(stopCheck({ ...base, ...at(8000, 30) }, th, 2, false, '2026-11-18').level).toBe('consider')
    const x = stopCheck({ ...base, cost: 12, clicks: 38 }, th, 2, true, '2026-11-18')
    expect(x.cap).toBe(20)
    expect(x.level).toBe('consider')
  })
  it('có đơn thì không báo dừng', () => {
    expect(stopCheck({ ...base, cost: 30, clicks: 200, orders: { pending: 1, approved: 0, paid: 0, denied: 0 } }, th, 2, false, '2026-11-18').level).toBe('has_orders')
  })
  it('SaaS $40, 0 đơn, còn trong cửa sổ dùng thử → chờ dùng thử, không báo dừng', () => {
    const s = stopCheck({ ...base, type_code: 'saas', model: 'saas', trial_days: 14, cost: 40, clicks: 150, last_click: '2026-11-15' }, th, 2, false, '2026-11-18')
    expect(s.level).toBe('trial')
    expect(s.trial_left).toBe(11)
    expect(stopCheck({ ...base, type_code: 'saas', model: 'saas', trial_days: 14, cost: 40, clicks: 150, last_click: '2026-11-01' }, th, 2, false, '2026-11-18').level).toBe('stop')
  })
  it('đợt cũ không có click → xét theo tiền, không lỗi', () => {
    const s = stopCheck({ ...base, cost: 12, clicks: 0, last_click: null }, th, 2, false, '2026-11-18')
    expect(s.by_money).toBe(true)
    expect(s.level).toBe('stop')
  })
  it('% duyệt chỉ tính đơn đã quá hạn payout, bỏ đơn chờ; chưa đủ 5 đơn thì "chưa đủ dữ liệu"', () => {
    const mk = (d: string, status: 'pending' | 'approved' | 'paid' | 'denied', n: number, comm: number) => ({ d, camp: 'c1', status, n, comm })
    const a2: AhData = { ...ah, orders: [mk('2026-09-01', 'approved', 3, 30), mk('2026-09-05', 'denied', 2, 20), mk('2026-11-10', 'denied', 5, 50), mk('2026-11-12', 'pending', 4, 40)] }
    const s = approvalStat(a2, ws, '2026-11-18', 30)
    expect(s.resolved).toBe(5)
    expect(s.pct).toBeCloseTo(60) // 30 ÷ (30 + 20); đơn huỷ 10/11 chưa quá hạn nên chưa tính
    expect(s.pending_n).toBe(4)
    expect(approvalStat(a2, ws, '2026-11-18', 30, 'saas').pct).toBeNull()
    expect(approvalStat({ ...a2, orders: a2.orders.slice(0, 1) }, ws, '2026-11-18', 30).pct).toBeNull()
  })
  it('3 đơn, ROAS thực nhận dự kiến 1,6 → ứng viên thắng nhưng chưa đủ điều kiện scale (thiếu 30 chuyển đổi/30 ngày)', () => {
    const r = { cost: 100, camps: ['c9'], order_days: ['2026-11-10', '2026-11-12'], orders: { pending: 3, approved: 0, paid: 0, denied: 0 }, comm: { pending: 160, approved: 0, paid: 0, denied: 0 } }
    const a2: AhData = { ...ah, orders: [{ d: '2026-11-10', camp: 'c9', status: 'pending', n: 3, comm: 160 }] }
    const w = winCheck(r, a2, null, th, {}, '2026-11-18')
    expect(w.roas_expected).toBeCloseTo(1.6)
    expect(w.candidate).toBe(true)
    expect(w.auto.conv30).toBe(false)
    expect(w.ready).toBe(false)
    expect(w.low_volume).toBe(true)
    expect(winCheck(r, a2, 50, th, {}, '2026-11-18').candidate).toBe(false) // % duyệt 50% → 0,8
  })
  it('đủ điều kiện scale: ≥ 30 đơn/30 ngày, ROAS thực nhận ≥ 1,5, có đơn ≥ 7 ngày trong 14 ngày, đủ 4 mục tick tay', () => {
    const days = Array.from({ length: 10 }, (_, i) => `2026-11-${String(9 + i).padStart(2, '0')}`)
    const a2: AhData = { ...ah, orders: days.map((d) => ({ d, camp: 'c9', status: 'approved' as const, n: 4, comm: 20 })) }
    const r = { cost: 100, camps: ['c9'], order_days: days, orders: { pending: 0, approved: 40, paid: 0, denied: 0 }, comm: { pending: 0, approved: 200, paid: 0, denied: 0 } }
    const all = { qs7: true, is40: true, lostis30: true, cap3: true }
    expect(winCheck(r, a2, null, th, all, '2026-11-18').ready).toBe(true)
    expect(winCheck(r, a2, null, th, { ...all, cap3: false }, '2026-11-18').ready).toBe(false)
  })
})

describe('tiền theo tháng từ Ads-Hub (cho cổng)', () => {
  it('chi phí + hoa hồng đã duyệt / đã trả theo tháng; bỏ đơn chờ và bị huỷ', () => {
    const r = monthlyMoney(ah)
    expect(r.map((x) => x.month)).toEqual(['2026-11-01', '2026-12-01'])
    expect(r[0].cost).toBe(15.75) // 3,5 + 2,25 + 9 + 1 (dòng chưa có tỷ giá tính 0)
    expect(r[0].received).toBe(21) // 15 đã duyệt + 6 đã trả (đơn chưa ghép camp vẫn là tiền thật)
    expect(r[1].cost).toBe(100)
  })
  it('lọc theo mô hình', () => {
    const p = monthlyMoney(ah, ws, 'saas')
    expect(p[0]).toEqual({ month: '2026-11-01', cost: 9, received: 15 })
  })
})

describe('GĐ5: dựng dữ liệu OKR từ Research + Ads-Hub', () => {
  const ledger = buildLedger(ws, ah)
  const { projects, entries } = researchProjects(ws, ah, ledger, (id) => (id === 11 ? 'có đơn chờ' : ''))
  it('mỗi đăng ký = 1 dự án, có ngày từng bước; "chọn" chỉ tính 1 lần cho mỗi dự án Research', () => {
    const a = projects.find((p) => p.id === 'ws-11')!
    expect(a.model).toBe('phys')
    expect(a.stage).toBe('test')
    expect(a.dates).toEqual({ dat_loc: '2026-11-10', dang_ky: '2026-11-10', duoc_duyet: '2026-11-11', test: '2026-11-12' })
    expect(a.ext_reason).toBe('có đơn chờ')
    const b = projects.find((p) => p.id === 'ws-12')!
    expect(b.model).toBe('tools_ai')
    expect(b.stage).toBe('dung') // Rejected
    expect(b.dates.dung).toBe('2026-11-12')
    expect(projects.filter((p) => p.dates.dat_loc).length).toBe(3)
  })
  it('entries theo ngày từ Ads-Hub: chi phí, hoa hồng chưa huỷ, hoa hồng đã nhận, số đơn', () => {
    const e = entries.filter((x) => x.project_id === 'ws-11')
    const d13 = e.find((x) => x.date === '2026-11-13')!
    expect(d13.cost).toBe(2.25)
    expect(d13.revenue).toBe(8) // 2 đơn chờ; đơn bị huỷ không tính
    expect(d13.received).toBe(0)
    expect(d13.orders).toBe(2)
    const s = entries.filter((x) => x.project_id === 'ws-13')
    expect(s.reduce((a, x) => a + x.received, 0)).toBe(15)
  })
  it('kết quả "Lãi" ở Research → Thắng, ngày thắng = ngày có đơn gần nhất', () => {
    const ws2 = { ...ws, regs: ws.regs.map((r) => (r.id === 13 ? { ...r, test_result: 'Lãi' } : r)) }
    const r = researchProjects(ws2, ah, buildLedger(ws2, ah))
    const c = r.projects.find((p) => p.id === 'ws-13')!
    expect(c.stage).toBe('win')
    expect(c.dates.win).toBe('2026-11-14')
  })
  it('đếm cờ: dừng / cân nhắc / chờ dùng thử chỉ xét dự án đang test', () => {
    const it = (ts: string, level: 'stop' | 'consider' | 'trial' | 'none', candidate = false, ready = false) => ({ r: { test_status: ts }, stop: { level }, win: { candidate, ready } })
    expect(flagSum([it('Đang Testing', 'stop'), it('Đã Test', 'stop'), it('Đang Testing', 'trial'), it('Đã Test', 'none', true), it('Đang Testing', 'none', true, true)])).toEqual({ stop: 1, consider: 0, trial: 1, candidate: 1, ready: 1 })
  })
})

describe('GĐ6: ROI theo trường lọc của Research', () => {
  const row = (id: number, pid: number, cost: number, got: number) =>
    ({ reg_id: id, project_id: pid, cost, comm: { pending: 0, approved: got, paid: 0, denied: 0 } }) as unknown as Parameters<typeof roiByField>[0][number]
  const projects = [
    { id: 1, name: 'A', type_code: 'vat_ly', trial_days: null, created_at: '', fixed_commission: 5, top_countries: ['US'], commission_type: 'One time', cookie_days: 30 },
    { id: 2, name: 'B', type_code: 'vat_ly', trial_days: null, created_at: '', commission_pct: 20, pricing: 200, top_countries: ['UK'], cookie_days: 7 },
    { id: 3, name: 'C', type_code: 'vat_ly', trial_days: null, created_at: '' },
  ]
  it('hoa hồng / đơn: cố định, hoặc % × giá', () => {
    expect(commissionPerOrder(projects[0])).toBe(5)
    expect(commissionPerOrder(projects[1])).toBe(40)
    expect(commissionPerOrder(projects[2])).toBeNull()
  })
  it('nhóm theo trường lọc, ROI = (đã nhận − chi phí) ÷ chi phí; chưa đủ 10 dự án thì chưa kết luận', () => {
    const rows = [row(1, 1, 10, 0), row(2, 1, 10, 5), row(3, 2, 10, 40), row(4, 3, 10, 0), row(5, 3, 0, 0)]
    const r = roiByField(rows, { projects })
    expect(r.total).toBe(4) // dòng chưa có chi phí bỏ qua
    expect(r.enough).toBe(false)
    const hh = r.groups.find((g) => g.field === 'Hoa hồng / đơn')!.buckets
    expect(hh.find((b) => b.bucket === '< $10')).toMatchObject({ n: 2, cost: 20, received: 5, roi: -75, few: true })
    expect(hh.find((b) => b.bucket === '≥ $30')).toMatchObject({ n: 1, roi: 300 })
    expect(r.groups.find((g) => g.field === 'Thị trường chính')!.buckets.map((b) => b.bucket)).toEqual(['US', 'UK', 'không rõ'])
    expect(r.groups.find((g) => g.field === 'Cookie')!.buckets.find((b) => b.bucket === '< 30 ngày')!.n).toBe(1)
  })
  it('đủ ≥ 10 dự án đã test thì bật', () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(i, 1, 10, 12))
    const r = roiByField(rows, { projects })
    expect(r.enough).toBe(true)
    expect(r.groups[0].buckets[0]).toMatchObject({ bucket: '< $10', n: 10, roi: 20, few: false })
  })
})
