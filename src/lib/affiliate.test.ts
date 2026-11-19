import { describe, expect, it } from 'vitest'
import {
  ceilCount, dayLabel, winsLabel,
  analyze, configEditable, defaultProfit, defaultShare, monthEditable, monthsOfLevel, needsAutoLock, nextBudget, planRows, simulate, targetsFor,
  adCharges, anyLocked, deseason, gateOf, rebalanceShares, GOAL_LEVEL_NAMES, goalLevelReached, kickoffBudget, profitAfterFees, sampleNeeds, suggestDouble, realRoas, rowEditable, seasonWarn, selfFundProfit, snapshotV2,
  type AffConfig, type AffMonth,
} from './affiliate'

const cfg: AffConfig = {
  user_id: 'u', year_goal: 16000, goal_month: '2027-12-01', base_budget: 200, reinvest_pct: 50, test_cap_mult: 2, edit_days: 3,
  cap_tests_week: 15, working_days_week: 7, reg_per_test: 2, research_per_test: 5, win_min_orders: 3, phys: {}, saas: {},
}
/** Không phí, không thuế, không quỹ: để kiểm phần lõi Vật lý bằng số tròn. */
const cfg0: AffConfig = { ...cfg, fee_pct: 0, tax_pct: 0, fixed_cost_month: 0, bridge_pct: 0, reserve_pct: 0 }
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
  it('kế hoạch mới (GĐ4): 100% Vật lý, Tools AI 0, lợi nhuận mục tiêu 0 (theo cổng), ngân sách = mức tối thiểu', () => {
    const rs = planRows(cfg, '2026-11-10')
    expect(rs.length).toBe(14)
    expect(rs[0]).toMatchObject({ month: '2026-11-01', share_phys: 100, share_tools: 0, budget_test: 200, profit_target: 0 })
    expect(rs[13]).toMatchObject({ month: '2027-12-01', share_phys: 100, share_tools: 0, profit_target: 0 })
  })
})

describe('cổng bằng chứng (GĐ4)', () => {
  const m = (month: string, received: number, cost: number) => ({ month, received, cost })
  const c = { ...cfg, fee_pct: 0, tax_pct: 0 }
  it('không có dự án đủ điều kiện scale → Cổng 0, ngân sách scale khoá, SaaS khoá', () => {
    const g = gateOf(0, [m('2026-10-01', 24, 312)], c)
    expect(g.gate).toBe(0)
    expect(g.scaleOpen).toBe(false)
    expect(g.saasOpen).toBe(false)
    expect(g.next!.missing).toContain('chưa có dự án')
  })
  it('có 1 dự án đủ điều kiện scale → Cổng 1, mở ngân sách scale, còn thiếu tới $1.000', () => {
    const g = gateOf(1, [m('2026-12-01', 900, 500)], c)
    expect(g.gate).toBe(1)
    expect(g.scaleOpen).toBe(true)
    expect(g.saasOpen).toBe(false)
    expect(g.next!.missing).toBe('còn thiếu $600')
  })
  it('1 tháng lợi nhuận sau phí ≥ $1.000 → Cổng 2, mở SaaS + Tools AI (đạt 1 tháng là đủ)', () => {
    const g = gateOf(0, [m('2027-02-01', 2500, 1400), m('2027-03-01', 300, 600)], c)
    expect(g.gate).toBe(2)
    expect(g.best).toEqual({ month: '2027-02-01', net: 1100 })
    expect(g.saasOpen).toBe(true)
  })
  it('phí + thuế làm tụt cổng: thực nhận 2.500, ads 1.400 → sau phí 5%, thuế 8% chỉ còn $912', () => {
    const g = gateOf(1, [m('2027-02-01', 2500, 1400)], cfg)
    expect(g.best!.net).toBeCloseTo(2500 - 1400 * 1.134)
    expect(g.gate).toBe(1)
  })
  it('≥ $2.000 → Cổng 3', () => {
    expect(gateOf(1, [m('2027-06-01', 5000, 2500)], c).gate).toBe(3)
    expect(gateOf(1, [m('2027-06-01', 5000, 2500)], c).next).toBeNull()
  })
})

describe('nhịp khối lượng giai đoạn tìm winner', () => {
  it('60 test × maxtest $10 = $600 chi tiêu, phải nạp $680,4 (×1,134)', () => {
    const k = kickoffBudget(60, 10, cfg)
    expect(k.spend).toBe(600)
    expect(k.topup).toBeCloseTo(680.4)
  })
  it('tháng trước đạt ≥ 60 test thì gợi ý gấp đôi', () => {
    expect(suggestDouble(60, 60)).toBe(true)
    expect(suggestDouble(59, 60)).toBe(false)
  })
  it('cỡ mẫu: 3 thắng ≈ 300 test ≈ $3.000 với maxtest $10', () => {
    const s = sampleNeeds(100, 10)
    expect(s.find((x) => x.key === 'wins')!.note).toContain('300 test')
    expect(s.find((x) => x.key === 'wins')!.note).toContain('$3.000')
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

describe('mô phỏng Vật lý (không phí, không thuế)', () => {
  it('Vật lý: $1.200 → 100 test → 1 thắng, ra tiền 3 tháng kế tiếp', () => {
    const sim = simulate([row('2027-01-01', { budget_test: 1200 }), row('2027-05-01')], cfg0, '2027-01-01')
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
})

describe('phân tích', () => {
  it('tìm hệ số nhân ngân sách tối thiểu', () => {
    const rows = [row('2027-01-01', { budget_test: 1200, profit_target: 100 }), row('2027-02-01', { budget_test: 1200, profit_target: 4000 })]
    const a = analyze(rows, cfg0, '2027-01-02')
    // x = 4000 / (2000 − 1200) = 5; tháng 1 có mục tiêu nhưng không kịp (thắng chưa ra tiền)
    expect(a.xNeed).toBeCloseTo(5)
    expect(a.scaleFrom).toBe('2027-01-01')
    expect(a.suggestBudget).toBeCloseTo(6000)
    expect(a.late).toEqual(['2027-01-01'])
    expect(a.short).toEqual(['2027-01-01', '2027-02-01'])
    const s5 = simulate(rows.map((r) => ({ ...r, budget_test: r.budget_test * 5 })), cfg0, '2027-01-01')
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

describe('số dự án là số nguyên', () => {
  it('làm tròn lên, thắng hiện < 1, ngày chia từ tuần', () => {
    expect(ceilCount(3.8)).toBe(4)
    expect(ceilCount(17)).toBe(17)
    expect(ceilCount(16.0000000001)).toBe(16)
    expect(winsLabel(0)).toBe('0')
    expect(winsLabel(0.2)).toBe('< 1')
    expect(winsLabel(1.4)).toBe('1')
    expect(dayLabel(19.2, 7)).toBe('3')
    expect(dayLabel(3.8, 7)).toBe('1 · 4 ngày/tuần')
    expect(dayLabel(0, 7)).toBe('0')
    expect(dayLabel(14, 7)).toBe('2')
  })
})

describe('mô hình v2 (tháng chưa chốt)', () => {
  const live = { max_test_usd: 10 }
  it('tiền test = maxtest Research: $200 ÷ $10 = 20 test, kỳ vọng 0,2 thắng với 100 test/thắng', () => {
    const s = simulate([row('2026-12-01', { budget_test: 200 })], cfg, '2026-12-01', 1, live)
    expect(s[0].testsP).toBeCloseTo(20)
    expect(s[0].winsP).toBeCloseTo(0.2)
    expect(ceilCount(s[0].testsP)).toBe(20)
  })
  it('chưa đọc được Research thì dùng tiền test đang lưu ($12 → ≈ 17 test)', () => {
    const s = simulate([row('2026-12-01', { budget_test: 200 })], cfg, '2026-12-01')
    expect(ceilCount(s[0].testsP)).toBe(17)
    expect(s[0].winsP).toBeCloseTo(0.17, 2)
  })
  it('ROAS thực nhận: 15% duyệt × ROAS màn hình 1,5 = 0,225', () => {
    expect(realRoas(1.5, 15)).toBeCloseTo(0.225)
  })
  it('ví dụ của Luca: chi tiêu 500.000đ → phí 25.000đ, thuế 42.000đ, phải nạp 567.000đ', () => {
    const c = adCharges(500000, 5, 8)
    expect(c.fee).toBe(25000)
    expect(c.tax).toBe(42000)
    expect(c.total).toBe(567000)
    expect(c.mult).toBeCloseTo(1.134)
  })
  it('lợi nhuận sau phí + thuế tính trên tiền nạp Ads (cả tiền test lẫn ads scale)', () => {
    const s = simulate([row('2027-01-01', { budget_test: 1200 }), row('2027-02-01')], cfg, '2027-01-01', 1, { max_test_usd: 12 })
    expect(s[0].fee).toBeCloseTo(60) // 5% × $1.200 tiền test
    expect(s[0].tax).toBeCloseTo(100.8) // 8% × (1.200 + 60): lỗ vẫn chịu thuế vì tính trên tiền nạp
    expect(s[0].net).toBeCloseTo(-1360.8)
    expect(s[1].profitP).toBeCloseTo(2000)
    expect(s[1].adsP).toBeCloseTo(4000)
    expect(s[1].fee).toBeCloseTo(200) // 5% × $4.000 ads
    expect(s[1].tax).toBeCloseTo(336) // 8% × 4.200
    expect(s[1].net).toBeCloseTo(1464)
  })
  it('phí: ads $32.000 × 5% = $1.600; thuế 8% × 33.600 = $2.688; số T10 của anh', () => {
    const r = profitAfterFees({ received: 48000, cost: 32000 }, { fee_pct: 5, tax_pct: 0 })
    expect(r.fee).toBe(1600)
    expect(r.net).toBe(14400)
    expect(profitAfterFees({ received: 48000, cost: 32000 }, { fee_pct: 5, tax_pct: 8 }).tax).toBeCloseTo(2688)
    const t10 = profitAfterFees({ received: 24, cost: 312 }, { fee_pct: 5, tax_pct: 8 })
    expect(t10.net).toBeCloseTo(24 - 312 * 1.134) // −$329,8
  })
  it('ngân sách tháng sau + vốn ngoài + tự nuôi được tới đâu', () => {
    expect(nextBudget(200, 50, -288)).toBe(200)
    expect(nextBudget(200, 50, 9600)).toBe(5000)
    expect(nextBudget(200, 50, 0, 500)).toBe(700)
    expect(selfFundProfit(5000, 200, 50)).toBe(9600)
  })
  it('SaaS ghi lợi nhuận theo dòng tiền: trả CAC khi có khách, hoa hồng về sau', () => {
    const rows = [row('2027-01-01', { budget_test: 4000, share_phys: 0 }), row('2027-12-01', { share_phys: 0 })]
    const s = simulate(rows, { ...cfg, tax_pct: 0, fee_pct: 0 }, '2027-01-01')
    expect(s[0].testsS).toBeCloseTo(100)
    expect(s[1].adsS).toBeCloseTo(1400) // 35 khách × $40
    expect(s[1].profitS).toBeCloseTo(-1400) // chưa có hoa hồng
    expect(s[3].profitS).toBeCloseTo(525 - 1400) // khách tháng 2 trả tháng đầu: 35 × $15
    expect(s[7].profitS).toBeCloseTo(5 * 35 * 15 - 1400)
  })
  it('3 mô hình: Vật lý 50% · Tools AI 30% · SaaS 20%', () => {
    const s = simulate([row('2027-01-01', { budget_test: 1000, share_phys: 50, share_tools: 30 })], cfg, '2027-01-01', 1, live)
    expect(s[0].testsP).toBeCloseTo(50)
    expect(s[0].testsT).toBeCloseTo(30)
    expect(s[0].testsS).toBeCloseTo(20)
  })
  it('vốn cần = vận hành (gồm phí + thuế nạp) + quỹ cầu nối 15% + dự phòng 10%; cảnh báo khi thiếu', () => {
    const rows = [row('2027-01-01', { budget_test: 1200 }), row('2027-02-01')]
    const s = simulate(rows, cfg, '2027-01-01', 1, { max_test_usd: 12 })
    expect(s[1].capitalOps).toBeCloseTo(4000 * 1.134) // ads $4.000 × 30/30, nạp kèm phí + thuế
    expect(s[1].capital).toBeCloseTo(4000 * 1.134 * 1.25)
    const a = analyze(rows, cfg, '2027-01-02', { max_test_usd: 12 })
    expect(a.capitalShort.map((x) => x.month)).toEqual(['2027-01-01', '2027-02-01'])
    const b = analyze([row('2027-01-01', { budget_test: 100, extra_capital: 200 })], cfg, '2027-01-02', live)
    expect(b.capitalShort).toEqual([])
  })
  it('dải kịch bản 100 / 200 / 300 test/thắng', () => {
    const rows = [row('2027-10-01', { budget_test: 3000 }), row('2027-12-01', { budget_test: 3000 })]
    const a = analyze(rows, cfg, '2027-10-02', live)
    expect(a.scenarios.map((x) => x.tpw)).toEqual([100, 200, 300])
    const [s100, s200, s300] = a.scenarios.map((x) => x.goalNet!)
    expect(s100).toBeGreaterThan(s200)
    expect(s200).toBeGreaterThan(s300)
  })
  it('mùa vụ: cảnh báo khi T11–T1 phía trước còn = 1; quy số đo về mùa thường', () => {
    expect(seasonWarn([row('2026-12-01')], '2026-11-18')).toBe(true)
    expect(seasonWarn([row('2026-12-01', { season: 1.4 })], '2026-11-18')).toBe(false)
    expect(seasonWarn([row('2027-03-01')], '2026-11-18')).toBe(false)
    expect(deseason(2800, [1.4, 1.4])).toBeCloseTo(2000)
    expect(deseason(2000, [])).toBe(2000)
  })
})

describe('khoá đầu kỳ sau khi mở lại (migration 014)', () => {
  it('chưa chốt tháng nào → cài đặt và mọi tháng sửa tự do', () => {
    const ms = [row('2026-11-01'), row('2026-12-01')]
    expect(anyLocked(ms)).toBe(false)
    expect(configEditable('2026-11-18', 3, anyLocked(ms))).toBe(true)
    expect(rowEditable(ms[0], '2026-11-18', 3, anyLocked(ms))).toBe(true)
  })
  it('chốt tháng 12 → luật đầu kỳ chạy lại; tháng 11 chưa chốt sẽ tự chốt', () => {
    const dec = row('2026-12-01', { locked_at: 'x', coeffs: snapshotV2(cfg) })
    const ms = [row('2026-11-01'), dec]
    expect(anyLocked(ms)).toBe(true)
    expect(configEditable('2026-12-10', 3, true)).toBe(false)
    expect(rowEditable(dec, '2026-12-02', 3, true)).toBe(true) // 3 ngày đầu của chính tháng đó
    expect(rowEditable(dec, '2026-12-10', 3, true)).toBe(false)
    expect(rowEditable(row('2027-01-01'), '2026-12-10', 3, true)).toBe(true)
    expect(needsAutoLock(ms[0], '2026-12-10', 3, true)).toBe(true)
  })
  it('tháng chốt có bản chụp thiếu trường (cũ) vẫn tính được, thiếu thì dùng mặc định', () => {
    const old = row('2026-11-01', { budget_test: 200, locked_at: 'x', coeffs: { phys: { ...snapshotV2(cfg).phys, test_cost: 12 }, saas: snapshotV2(cfg).saas } })
    const s = simulate([old], cfg, '2026-11-01', 1, { max_test_usd: 10 })
    expect(s[0].testsP).toBeCloseTo(200 / 12) // giữ tiền test của bản chụp
    expect(s[0].fee).toBeCloseTo(10) // phí mặc định 5%
  })
  it('bản chụp v2: model_version 2, tiền test = maxtest, phí/thuế/quỹ, ngưỡng dùng chung', () => {
    const s = snapshotV2(cfg, { max_test_usd: 10, usd_vnd: 25726, roa: [1.5, 3, 4.5], winner_orders: 3 })
    expect(s.model_version).toBe(2)
    expect(s.phys.test_cost).toBe(10)
    expect(s.saas.test_cost).toBe(10)
    expect(s.tools!.test_cost).toBe(10)
    expect(s).toMatchObject({ fee_pct: 5, tax_pct: 8, bridge_pct: 15, reserve_pct: 10, usd_vnd: 25726, winner_orders: 3 })
    // tháng chốt v2 dùng bản chụp, không đổi khi maxtest đổi
    const m = row('2026-12-01', { budget_test: 200, coeffs: s, locked_at: 'x' })
    expect(simulate([m], cfg, '2026-12-01', 1, { max_test_usd: 20 })[0].testsP).toBeCloseTo(20)
  })
})

describe('3 mức O năm 2027: tối thiểu / mục tiêu / vươn tới', () => {
  const L = [16000, 50000, 120000]
  it('mức cao nhất đạt được', () => {
    expect(GOAL_LEVEL_NAMES).toEqual(['Tối thiểu', 'Mục tiêu', 'Vươn tới'])
    expect(goalLevelReached(920, L)).toBe(-1)
    expect(goalLevelReached(16000, L)).toBe(0)
    expect(goalLevelReached(60000, L)).toBe(1)
    expect(goalLevelReached(130000, L)).toBe(2)
    expect(goalLevelReached(null, L)).toBe(-1)
  })
})

describe('tỷ trọng 3 mô hình luôn = 100%', () => {
  const total = (r: { share_phys: number; share_tools: number }) => r.share_phys + r.share_tools + (100 - r.share_phys - r.share_tools)
  it('tăng Tools AI: cột cao nhất còn lại (Vật lý) giảm', () => {
    expect(rebalanceShares({ phys: 60, tools: 0 }, 'tools', 30)).toEqual({ share_phys: 30, share_tools: 30 }) // SaaS giữ 40
  })
  it('giảm Vật lý: cột cao nhất còn lại (SaaS) nhận phần thiếu', () => {
    expect(rebalanceShares({ phys: 60, tools: 10 }, 'phys', 50)).toEqual({ share_phys: 50, share_tools: 10 }) // SaaS 30 → 40
  })
  it('sửa SaaS: cột cao nhất (Vật lý) điều chỉnh', () => {
    expect(rebalanceShares({ phys: 100, tools: 0 }, 'saas', 20)).toEqual({ share_phys: 80, share_tools: 0 })
    expect(rebalanceShares({ phys: 30, tools: 30 }, 'saas', 0)).toEqual({ share_phys: 70, share_tools: 30 }) // hoà: lấy cột đứng trước
  })
  it('cột cao nhất về 0 mà vẫn thiếu → cột còn lại nhận tiếp', () => {
    expect(rebalanceShares({ phys: 50, tools: 40 }, 'saas', 100)).toEqual({ share_phys: 0, share_tools: 0 })
    expect(rebalanceShares({ phys: 30, tools: 25 }, 'phys', 90)).toEqual({ share_phys: 90, share_tools: 10 }) // SaaS 45 → 0, Tools 25 → 10
  })
  it('chặn ngoài 0–100 và tổng luôn 100', () => {
    const r = rebalanceShares({ phys: 60, tools: 0 }, 'phys', 140)
    expect(r).toEqual({ share_phys: 100, share_tools: 0 })
    expect(total(rebalanceShares({ phys: 33.3, tools: 33.3 }, 'tools', 50))).toBe(100)
  })
})
