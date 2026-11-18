import { describe, expect, it } from 'vitest'
import type { AffConfig, AffMonth } from './affiliate'
import { affTickChanges, dayShare, gateFromData, kpiTargets, metricSeries, metricSum, monthActuals, monthsIn, type AffData } from './affLink'
import type { AffProject } from './affProjects'

const cfg: AffConfig = {
  user_id: 'u', year_goal: 16000, goal_month: '2027-12-01', base_budget: 200, reinvest_pct: 50, test_cap_mult: 2, edit_days: 3,
  cap_tests_week: 15, working_days_week: 7, reg_per_test: 2, research_per_test: 5, win_min_orders: 3, phys: {}, saas: {},
}
const row = (month: string, p: Partial<AffMonth> = {}): AffMonth => ({ id: month, month, share_phys: 100, budget_test: 200, season: 1, profit_target: 0, coeffs: null, locked_at: null, note: '', ...p })
const P = (id: string, p: Partial<AffProject>): AffProject => ({ id, name: id, link: '', model: 'phys', network: '', niche: '', geo: '', stage: 'dat_loc', dates: {}, op_status: null, ext_reason: '', stop_reason: '', note: '', created_at: '', ...p })

describe('chuỗi số liệu', () => {
  const d: AffData = {
    projects: [P('a', { dates: { dat_loc: '2026-11-02', dang_ky: '2026-11-03', test: '2026-11-05' } }), P('b', { model: 'saas', dates: { dang_ky: '2026-11-04' } })],
    tallies: [{ id: 't', date: '2026-11-02', kind: 'search', model: 'phys', count: 12 }, { id: 'u', date: '2026-11-03', kind: 'search', model: 'saas', count: 5 }],
    entries: [{ id: 'e', project_id: 'a', date: '2026-11-06', cost: 12, revenue: 30, received: 20, orders: 1, refs: 0, customers: 0, note: '' }],
  }
  it('search từ bộ đếm, bước từ ngày vào giai đoạn, lợi nhuận = thực nhận − chi phí', () => {
    expect(metricSum('search', d, '2026-11-01', '2026-11-30')).toBe(17)
    expect(metricSum('search', d, '2026-11-01', '2026-11-30', 'phys')).toBe(12)
    expect(metricSum('dang_ky', d, '2026-11-01', '2026-11-30')).toBe(2)
    expect(metricSum('test', d, '2026-11-05', '2026-11-05')).toBe(1)
    expect(metricSum('profit', d, '2026-11-01', '2026-11-30')).toBe(8)
    expect(metricSeries('chon', d)).toEqual([{ date: '2026-11-02', value: 1 }])
  })
})

describe('chỉ tiêu theo cấp (số nguyên)', () => {
  const rows = [row('2026-11-01'), row('2026-12-01')]
  it('chia tuần cho ngày: đủ tổng', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => dayShare(4, 7, i))).toEqual([1, 1, 1, 1, 0, 0, 0])
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => dayShare(20, 7, i)).reduce((a, b) => a + b)).toBe(20)
    expect(dayShare(10, 5, 5)).toBe(0)
  })
  it('tháng: $200 → 17 test, 84 search, 34 đăng ký; không đặt thắng khi < 1', () => {
    const t = kpiTargets('month', '2026-11-01', '2026-11-30', rows, cfg, '2026-11-10')
    expect(t).toEqual({ search: 84, dang_ky: 34, test: 17, win: null, profit: null })
  })
  it('tuần và ngày', () => {
    expect(kpiTargets('week', '2026-11-09', '2026-11-15', rows, cfg, '2026-11-10')).toMatchObject({ search: 20, dang_ky: 8, test: 4 })
    expect(kpiTargets('day', '2026-11-09', '2026-11-09', rows, cfg, '2026-11-10')).toMatchObject({ search: 3, dang_ky: 2, test: 1 })
    expect(kpiTargets('day', '2026-11-15', '2026-11-15', rows, cfg, '2026-11-10')).toMatchObject({ search: 2, dang_ky: 1, test: 0 })
  })
  it('kỳ khởi động: cộng các tháng trong kỳ', () => {
    expect(monthsIn('2026-11-01', '2026-12-31')).toEqual(['2026-11-01', '2026-12-01'])
    expect(kpiTargets('kickoff', '2026-11-01', '2026-12-31', rows, cfg, '2026-11-10').test).toBe(34)
  })
})

describe('tự tick KA', () => {
  it('đạt thì tick, tụt thì chỉ bỏ tick KA do app tick', () => {
    const kas = [
      { id: 'a', done: false, auto_ticked: false, aff_metric: 'search' as const, aff_target: 3 },
      { id: 'b', done: true, auto_ticked: true, aff_metric: 'test' as const, aff_target: 1 },
      { id: 'c', done: true, auto_ticked: false, aff_metric: 'test' as const, aff_target: 1 },
      { id: 'd', done: false, auto_ticked: false },
    ]
    expect(affTickChanges(kas, (m) => (m === 'search' ? 3 : 0))).toEqual([
      { id: 'a', done: true, auto_ticked: true },
      { id: 'b', done: false, auto_ticked: false },
    ])
  })
})

describe('GĐ5: KR tự đếm từ Research + Ads-Hub', () => {
  const base: AffData = {
    projects: [P('a', { dates: { test: '2026-11-05' } })],
    tallies: [],
    entries: [{ id: 'e', project_id: 'a', date: '2026-11-06', cost: 100, revenue: 200, received: 150, orders: 2, refs: 0, customers: 0, note: '' }],
  }
  it('lợi nhuận đã nhận trừ tiền nạp Ads gồm phí 5% + thuế 8% (×1,134)', () => {
    expect(metricSum('profit', { ...base, costMult: 1.134 }, '2026-11-01', '2026-11-30')).toBeCloseTo(150 - 113.4)
    expect(metricSum('profit', base, '2026-11-01', '2026-11-30')).toBe(50) // chưa có hệ số: như cũ
  })
  it('KR "Dự án đủ điều kiện scale" đếm theo cờ hiện tại', () => {
    const d: AffData = { ...base, source: 'research', today: '2026-11-19', flags: { stop: 1, consider: 0, trial: 0, candidate: 2, ready: 1 } }
    expect(metricSum('scale_ready', d, '2026-11-01', '2026-11-30')).toBe(1)
    expect(metricSum('scale_ready', base, '2026-11-01', '2026-11-30')).toBe(0)
  })
  it('Cổng 0: chỉ tiêu theo nhịp 60 test/tháng, chưa đặt lợi nhuận và thắng', () => {
    const rows = [row('2026-12-01'), row('2027-01-01'), row('2027-02-01')]
    const m = kpiTargets('month', '2026-12-01', '2026-12-31', rows, cfg, '2026-12-01', {}, 60)
    expect(m).toEqual({ search: 300, dang_ky: 120, test: 60, win: null, profit: null })
    const q = kpiTargets('quarter', '2026-12-01', '2027-02-28', rows, cfg, '2026-12-01', {}, 60)
    expect(q.test).toBe(180)
    const w = kpiTargets('week', '2026-12-07', '2026-12-13', rows, cfg, '2026-12-07', {}, 60)
    expect(w.test).toBe(14) // 60 × 12 ÷ 52 = 13,8 → 14
    const days = Array.from({ length: 7 }, (_, i) => kpiTargets('day', `2026-12-${String(7 + i).padStart(2, '0')}`, `2026-12-${String(7 + i).padStart(2, '0')}`, rows, cfg, '2026-12-07', {}, 60).test)
    expect(days.reduce((a, b) => a + b, 0)).toBe(14) // chia đủ tổng tuần
  })
  it('chưa có số Research (gate null) → chỉ tiêu theo mô hình như cũ', () => {
    const rows = [row('2026-12-01')]
    expect(gateFromData(null, cfg)).toBeNull()
    expect(gateFromData({ ...base, source: 'manual' }, cfg)).toBeNull()
    expect(kpiTargets('month', '2026-12-01', '2026-12-31', rows, cfg, '2026-12-01').test).toBe(17) // $200 ÷ $12
  })
  it('có số Research → cổng tính từ cờ + tiền theo tháng', () => {
    const d: AffData = { ...base, source: 'research', today: '2026-11-19', flags: { stop: 0, consider: 0, trial: 0, candidate: 0, ready: 0 }, money: [] }
    expect(gateFromData(d, cfg)!.gate).toBe(0)
    expect(gateFromData({ ...d, flags: { ...d.flags!, ready: 1 } }, cfg)!.gate).toBe(1)
  })
})

describe('bản chụp số thực tế khi chốt sổ tháng', () => {
  it('đếm đủ các chỉ số của tháng + tiền Ads-Hub + cờ', () => {
    const d: AffData = {
      projects: [P('a', { dates: { dat_loc: '2026-11-02', dang_ky: '2026-11-03', duoc_duyet: '2026-11-04', test: '2026-11-05' } }), P('b', { dates: { test: '2026-12-01' } })],
      tallies: [{ id: 't', date: '2026-11-02', kind: 'search', model: 'phys', count: 12 }],
      entries: [{ id: 'e', project_id: 'a', date: '2026-11-06', cost: 100, revenue: 200, received: 150, orders: 2, refs: 0, customers: 0, note: '' }],
      source: 'research',
      costMult: 1.134,
      money: [{ month: '2026-11-01', cost: 100, received: 150 }],
      flags: { stop: 1, consider: 0, trial: 0, candidate: 0, ready: 0 },
    }
    const a = monthActuals(d, '2026-11-01', '2026-11-30', '2026-12-02T01:00:00Z')
    expect(a.counts).toEqual({ search: 12, chon: 1, dang_ky: 1, duyet: 1, test: 1, win: 0, profit: 36.6 })
    expect(a.money).toEqual({ cost: 100, received: 150 })
    expect(a.source).toBe('research')
    expect(a.flags!.stop).toBe(1)
  })
})
