import { describe, expect, it } from 'vitest'
import type { AffConfig, AffMonth } from './affiliate'
import { affTickChanges, dayShare, kpiTargets, metricSeries, metricSum, monthsIn, type AffData } from './affLink'
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
