import { describe, expect, it } from 'vitest'
import {
  analyze, configEditable, defaultProfit, defaultShare, monthEditable, monthsOfLevel, needsAutoLock, nextBudget, planRows, simulate, targetsFor,
  type AffConfig, type AffMonth,
} from './affiliate'

const cfg: AffConfig = {
  user_id: 'u', year_goal: 16000, goal_month: '2027-12-01', base_budget: 200, reinvest_pct: 50, test_cap_mult: 2, edit_days: 3,
  cap_tests_week: 15, working_days_week: 7, reg_per_test: 2, research_per_test: 5, win_min_orders: 3, phys: {}, saas: {},
}
const row = (month: string, p: Partial<AffMonth> = {}): AffMonth => ({
  id: month, month, share_phys: 100, budget_test: 0, season: 1, profit_target: 0, coeffs: null, locked_at: null, note: '', ...p,
})

describe('kế hoạch mặc định', () => {
  it('thang lợi nhuận theo mốc quý của wiki, tỷ lệ theo mục tiêu năm', () => {
    expect(defaultProfit('2026-11-01', 16000, '2027-12-01')).toBe(0)
    expect(defaultProfit('2026-12-01', 16000, '2027-12-01')).toBe(0)
    expect(defaultProfit('2027-01-01', 16000, '2027-12-01')).toBe(667)
    expect(defaultProfit('2027-03-01', 16000, '2027-12-01')).toBe(2000)
    expect(defaultProfit('2027-06-01', 16000, '2027-12-01')).toBe(5000)
    expect(defaultProfit('2027-09-01', 16000, '2027-12-01')).toBe(10000)
    expect(defaultProfit('2027-10-01', 16000, '2027-12-01')).toBe(12000)
    expect(defaultProfit('2027-12-01', 16000, '2027-12-01')).toBe(16000)
    expect(defaultProfit('2027-06-01', 8000, '2027-12-01')).toBe(2500)
  })
  it('tỷ trọng Vật lý đã duyệt', () => {
    expect(defaultShare('2026-11-01')).toBe(100)
    expect(defaultShare('2027-02-01')).toBe(60)
    expect(defaultShare('2027-05-01')).toBe(30)
    expect(defaultShare('2027-08-01')).toBe(50)
    expect(defaultShare('2027-11-01')).toBe(80)
  })
  it('tạo dòng từ tháng hiện tại đến tháng mục tiêu, ngân sách = mức tối thiểu', () => {
    const rs = planRows(cfg, '2026-11-10')
    expect(rs.length).toBe(14)
    expect(rs[0]).toMatchObject({ month: '2026-11-01', share_phys: 100, budget_test: 200, profit_target: 0 })
    expect(rs[13]).toMatchObject({ month: '2027-12-01', share_phys: 80, profit_target: 16000 })
  })
})

describe('chỉ sửa ở đầu kỳ', () => {
  it('lần đầu (chưa chốt tháng nào) sửa được mọi lúc', () => {
    expect(monthEditable('2026-11-01', '2026-11-20', 3, false)).toBe(true)
    expect(configEditable('2026-11-20', 3, false)).toBe(true)
  })
  it('đã chốt: tháng hiện tại chỉ sửa trong N ngày đầu; tháng tới luôn sửa được; tháng đã qua thì không', () => {
    expect(monthEditable('2026-12-01', '2026-12-03', 3, true)).toBe(true)
    expect(monthEditable('2026-12-01', '2026-12-04', 3, true)).toBe(false)
    expect(monthEditable('2027-01-01', '2026-12-20', 3, true)).toBe(true)
    expect(monthEditable('2026-11-01', '2026-12-02', 3, true)).toBe(false)
    expect(configEditable('2026-12-04', 3, true)).toBe(false)
  })
  it('qua cửa sổ mà chưa chốt thì tự chốt', () => {
    expect(needsAutoLock(row('2026-12-01'), '2026-12-05', 3, true)).toBe(true)
    expect(needsAutoLock(row('2026-12-01'), '2026-12-02', 3, true)).toBe(false)
    expect(needsAutoLock(row('2026-12-01'), '2026-12-05', 3, false)).toBe(false)
  })
})

describe('mô phỏng', () => {
  it('Vật lý: $1.200 → 100 test → 1 thắng, ra tiền 3 tháng kế tiếp', () => {
    const sim = simulate([row('2027-01-01', { budget_test: 1200 }), row('2027-05-01')], cfg, '2027-01-01')
    expect(sim.length).toBe(5)
    expect(sim[0].testsP).toBeCloseTo(100)
    expect(sim[0].winsP).toBeCloseTo(1)
    expect(sim[0].net).toBeCloseTo(-1200)
    expect(sim[1].profitP).toBeCloseTo(2000)
    expect(sim[3].profitP).toBeCloseTo(2000)
    expect(sim[4].profitP).toBeCloseTo(0)
    expect(sim[1].adsP).toBeCloseTo(4000) // 2000 / (1,5 − 1)
  })
  it('mùa vụ nhân lợi nhuận Vật lý', () => {
    const sim = simulate([row('2027-01-01', { budget_test: 1200 }), row('2027-02-01', { season: 1.5 })], cfg, '2027-01-01')
    expect(sim[1].profitP).toBeCloseTo(3000)
  })
  it('SaaS: ra tiền sau độ trễ 3 tháng, mỗi thắng 35 × (15×6 − 40) = $1.750/tháng', () => {
    const rows = [row('2027-01-01', { budget_test: 4000, share_phys: 0 }), row('2027-06-01', { share_phys: 0 })]
    const sim = simulate(rows, cfg, '2027-01-01')
    expect(sim[0].testsS).toBeCloseTo(100)
    expect(sim[2].profitS).toBe(0)
    expect(sim[3].profitS).toBeCloseTo(1750)
    expect(sim[5].activeS).toBeCloseTo(1)
  })
})

describe('phân tích', () => {
  it('tìm hệ số nhân ngân sách tối thiểu', () => {
    const rows = [row('2027-01-01', { budget_test: 1200, profit_target: 100 }), row('2027-02-01', { budget_test: 1200, profit_target: 4000 })]
    const a = analyze(rows, cfg, '2027-01-02')
    // x = 4000 / (2000 − 1200) = 5; tháng 1 có mục tiêu nhưng không kịp (thắng chưa ra tiền)
    expect(a.xNeed).toBeCloseTo(5)
    expect(a.scaleFrom).toBe('2027-01-01')
    expect(a.suggestBudget).toBeCloseTo(6000)
    expect(a.late).toEqual(['2027-01-01'])
    expect(a.short).toEqual(['2027-01-01', '2027-02-01'])
    const s5 = simulate(rows.map((r) => ({ ...r, budget_test: r.budget_test * 5 })), cfg, '2027-01-01')
    expect(s5[1].net).toBeCloseTo(4000)
  })
  it('giai đoạn đo (LN mục tiêu 0) không bị nhân ngân sách', () => {
    const rows = [row('2026-11-01', { budget_test: 200 }), row('2026-12-01', { budget_test: 200 }), row('2027-01-01', { budget_test: 200, profit_target: 0 }), row('2027-02-01', { budget_test: 200, profit_target: 2000 })]
    const a = analyze(rows, cfg, '2026-11-10')
    expect(a.scaleFrom).toBe('2027-02-01')
    const nov = targetsFor(['2026-11-01'], a, rows, cfg, 'month')
    expect(nov.tests[1]).toBeCloseTo(nov.tests[0])
    expect(nov.budget).toEqual([200, 200])
    expect(a.late).toEqual(['2027-02-01'])
  })
  it('mục tiêu ngay tháng này: không kịp vì thắng chưa kịp ra tiền', () => {
    const a = analyze([row('2027-01-01', { budget_test: 200, profit_target: 1000 })], cfg, '2027-01-02')
    expect(a.late).toEqual(['2027-01-01'])
    expect(a.xNeed).toBeNull()
  })
  it('báo lỗ đơn vị khi tiền tìm 1 thắng ≥ lợi nhuận trọn đời của thắng', () => {
    expect(analyze([row('2027-01-01')], cfg, '2027-01-02').physLoss).toBe(false)
    expect(analyze([row('2027-01-01')], { ...cfg, phys: { win_profit: 300 } }, '2027-01-02').physLoss).toBe(true)
    expect(analyze([row('2027-01-01')], { ...cfg, saas: { cac: 100 } }, '2027-01-02').saasLoss).toBe(true)
  })
  it('báo vượt công suất test/tuần', () => {
    const a = analyze([row('2027-01-01', { budget_test: 1200 })], cfg, '2027-01-02')
    expect(a.overCapacity[0].perWeek).toBeCloseTo((100 * 12) / 52)
  })
})

describe('chỉ tiêu phân tầng', () => {
  it('tuần = tháng × 12/52, ngày = tuần ÷ số ngày làm; không đặt chỉ tiêu thắng ở tuần/ngày', () => {
    const rows = [row('2026-11-01', { budget_test: 200 })]
    const a = analyze(rows, cfg, '2026-11-10')
    const m = targetsFor(['2026-11-01'], a, rows, cfg, 'month')
    expect(m.tests[0]).toBeCloseTo(200 / 12)
    expect(m.research[0]).toBeCloseTo((200 / 12) * 5)
    expect(m.reg[0]).toBeCloseTo((200 / 12) * 2)
    expect(m.wins![0]).toBeCloseTo(200 / 12 / 100)
    const w = targetsFor(['2026-11-01'], a, rows, cfg, 'week')
    expect(w.tests[0]).toBeCloseTo(((200 / 12) * 12) / 52)
    expect(w.wins).toBeNull()
    const d = targetsFor(['2026-11-01'], a, rows, cfg, 'day')
    expect(d.tests[0]).toBeCloseTo(((200 / 12) * 12) / 52 / 7)
  })
  it('tháng của quý/năm', () => {
    expect(monthsOfLevel('quarter', '2027-05-01')).toEqual(['2027-04-01', '2027-05-01', '2027-06-01'])
    expect(monthsOfLevel('year', '2027-05-01').length).toBe(12)
  })
  it('quy tắc ngân sách: nền + 50% lợi nhuận đã nhận', () => {
    expect(nextBudget(200, 50, 600)).toBe(500)
    expect(nextBudget(200, 50, -100)).toBe(200)
  })
})
