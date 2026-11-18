import { describe, expect, it } from 'vitest'
import { ahTotals, campModels, firstTestDay, modelOfType, sharedThresholds, vnDate, wsCounts, type AhData, type WsData } from './affSource'

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
