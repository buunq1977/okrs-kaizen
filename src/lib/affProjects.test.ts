import { describe, expect, it } from 'vitest'
import { PHYS_DEFAULT, SAAS_DEFAULT } from './affiliate'
import { advance, countBetween, flags, kindOf, measure, metrics, nextStage, parseImport, receivedProfit, totals, type AffEntry, type AffProject } from './affProjects'

const C = { phys: PHYS_DEFAULT, saas: SAAS_DEFAULT }
const P = (id: string, p: Partial<AffProject> = {}): AffProject => ({
  id, name: id, link: '', model: 'phys', network: '', niche: '', geo: '', stage: 'research', dates: {}, op_status: null, ext_reason: '', stop_reason: '', note: '', created_at: '', ...p,
})
const E = (project_id: string, date: string, x: Partial<AffEntry>): AffEntry => ({ id: project_id + date, project_id, date, cost: 0, revenue: 0, received: 0, orders: 0, refs: 0, customers: 0, note: '', ...x })

describe('giai đoạn', () => {
  it('chuyển giai đoạn ghi ngày, giữ ngày cũ', () => {
    const p = advance({ stage: 'research', dates: { research: '2026-11-01' } }, 'dang_ky', '2026-11-05')
    expect(p).toEqual({ stage: 'dang_ky', dates: { research: '2026-11-01', dang_ky: '2026-11-05' } })
    expect(advance(p, 'dang_ky', '2026-11-09').dates.dang_ky).toBe('2026-11-05')
    expect(nextStage('duoc_duyet')).toBe('test')
    expect(nextStage('win')).toBeNull()
  })
})

describe('chỉ số theo bảng giải nghĩa', () => {
  it('số tháng 10 của anh: chi phí 312, doanh số 158, thực nhận 24', () => {
    const m = metrics({ cost: 312, revenue: 158, received: 24, orders: 4, refs: 0, customers: 0 })
    expect(m.profit).toBe(-288)
    expect(Math.round(m.roi!)).toBe(-92)
    expect(Math.round(m.approval!)).toBe(15)
    expect(m.cpa).toBe(78)
    expect(m.payout).toBe(6)
    expect(m.roas).toBeCloseTo(158 / 312)
  })
  it('loại: Winner / Ra đơn / Test', () => {
    const z = totals([])
    expect(kindOf({ stage: 'win', dates: {} }, z)).toBe('Winner')
    expect(kindOf({ stage: 'test', dates: {} }, { ...z, orders: 2 })).toBe('Ra đơn')
    expect(kindOf({ stage: 'dung', dates: { test: '2026-11-01' } }, z)).toBe('Test')
    expect(kindOf({ stage: 'dang_ky', dates: {} }, z)).toBeNull()
  })
  it('tổng theo khoảng ngày', () => {
    const es = [E('a', '2026-10-30', { cost: 5 }), E('a', '2026-11-03', { cost: 7, received: 20 })]
    expect(totals(es).cost).toBe(12)
    expect(totals(es, '2026-11-01', '2026-11-30').cost).toBe(7)
    expect(receivedProfit(es, '2026-11-01', '2026-11-30')).toBe(13)
  })
})

describe('cờ nên dừng / đạt tiêu chí thắng', () => {
  const z = totals([])
  it('tiêu ≥ tiền test mặc định mà 0 đơn → nên dừng', () => {
    expect(flags({ stage: 'test', model: 'phys', ext_reason: '' }, { ...z, cost: 12 }, C, 2, 3).kill).toBe(true)
    expect(flags({ stage: 'test', model: 'phys', ext_reason: '' }, { ...z, cost: 11 }, C, 2, 3).kill).toBe(false)
  })
  it('có lý do mở rộng → trần × 2', () => {
    const f = flags({ stage: 'test', model: 'phys', ext_reason: 'Có đơn trong ngưỡng click' }, { ...z, cost: 20 }, C, 2, 3)
    expect(f.cap).toBe(24)
    expect(f.kill).toBe(false)
  })
  it('SaaS dùng tiền test SaaS', () => {
    expect(flags({ stage: 'test', model: 'saas', ext_reason: '' }, { ...z, cost: 30 }, C, 2, 3).kill).toBe(false)
  })
  it('ROAS ≥ 1,5 và ≥ 3 đơn → đạt tiêu chí thắng', () => {
    expect(flags({ stage: 'test', model: 'phys', ext_reason: '' }, { ...z, cost: 100, revenue: 150, orders: 3 }, C, 2, 3).winReady).toBe(true)
    expect(flags({ stage: 'test', model: 'phys', ext_reason: '' }, { ...z, cost: 100, revenue: 149, orders: 3 }, C, 2, 3).winReady).toBe(false)
    expect(flags({ stage: 'test', model: 'phys', ext_reason: '' }, { ...z, cost: 100, revenue: 300, orders: 2 }, C, 2, 3).winReady).toBe(false)
  })
  it('% duyệt thấp: doanh số đẹp nhưng thực nhận dự kiến không đủ → chưa thắng', () => {
    const t = { ...z, cost: 22, revenue: 48, received: 18, orders: 4 }
    expect(flags({ stage: 'test', model: 'phys', ext_reason: '' }, t, C, 2, 3, 38).winReady).toBe(false)
    expect(flags({ stage: 'test', model: 'phys', ext_reason: '' }, t, C, 2, 3, 80).winReady).toBe(true)
  })
})

describe('đếm và đo', () => {
  const ps = [
    P('a', { stage: 'test', dates: { research: '2026-11-02', dang_ky: '2026-11-03', test: '2026-11-05' } }),
    P('b', { stage: 'win', dates: { research: '2026-11-02', test: '2026-11-04', win: '2026-11-20' } }),
    P('c', { stage: 'dang_ky', model: 'saas', dates: { research: '2026-11-10', dang_ky: '2026-11-11' } }),
    P('d', { stage: 'research', dates: { research: '2026-10-30' } }),
  ]
  const es = [E('a', '2026-11-06', { cost: 12 }), E('b', '2026-11-10', { cost: 30, revenue: 40, received: 10, orders: 2 }), E('b', '2026-11-25', { cost: 50, revenue: 120, received: 90, orders: 5 })]
  it('đếm theo ngày vào giai đoạn', () => {
    expect(countBetween(ps, '2026-11-01', '2026-11-30')).toEqual({ research: 3, dang_ky: 2, test: 2, win: 1 })
    expect(countBetween(ps, '2026-11-01', '2026-11-30', 'saas')).toEqual({ research: 1, dang_ky: 1, test: 0, win: 0 })
  })
  it('đo hệ số Vật lý', () => {
    const m = measure(ps, es, 'phys', '2026-11-01', '2026-11-30')
    expect(m.n_tests).toBe(2)
    expect(m.n_wins).toBe(1)
    expect(m.tests_per_win).toBe(2)
    expect(m.test_cost).toBe((12 + 30) / 2) // chi phí của b chỉ tính trước ngày thắng
    expect(m.order_rate).toBe(50)
    expect(m.approval).toBeCloseTo((100 / 160) * 100)
    expect(m.win_profit).toBe(40) // (90 − 50) trong 1 tháng từ ngày thắng
    expect(m.research_per_test).toBe(1)
  })
})

describe('nhập từ Excel', () => {
  it('nhận tiêu đề theo bảng của anh, số kiểu $(288), bỏ dòng tổng', () => {
    const t = [
      ['BÁO CÁO'],
      ['Dự án', 'Network', 'Loại', 'Trạng thái', 'Chi phí ($)', 'Doanh số ($)', 'Thực nhận ($)', 'Số đơn', 'Ngày'],
      ['Pococo', 'UpPromote', 'Ra đơn', 'Theo dõi', '$312', '$158', '$24', 4, '15/10/2026'],
      ['Yofidra', 'Impact', 'Test', 'Dừng', '$7', '$0', '$0', 0, ''],
      ['Tổng', '', '', '', '$319', '', '', '', ''],
      ['', '', '', '', '', '', '', '', ''],
    ]
    const r = parseImport(t, '2026-11-10')
    expect(r.missing).toEqual([])
    expect(r.rows.length).toBe(2)
    expect(r.rows[0]).toMatchObject({ name: 'Pococo', network: 'UpPromote', stage: 'test', op_status: 'theo_doi', date: '2026-10-15', model: 'phys' })
    expect(r.rows[0].totals).toMatchObject({ cost: 312, revenue: 158, received: 24, orders: 4 })
    expect(r.rows[1]).toMatchObject({ stage: 'dung', op_status: 'dung', date: '2026-11-10' })
  })
  it('thiếu cột tên thì báo', () => {
    expect(parseImport([['Chi phí', 'Doanh số']], '2026-11-10').missing.length).toBe(1)
  })
})
