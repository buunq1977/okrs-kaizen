import { describe, expect, it } from 'vitest'
import {
  ceilCount, dayLabel, winsLabel,
  analyze, configEditable, defaultProfit, defaultShare, monthEditable, monthsOfLevel, needsAutoLock, nextBudget, planRows, simulate, targetsFor,
  anyLockedV2, deseason, profitAfterFees, realRoas, rowEditable, seasonWarn, selfFundProfit, snapshotV2,
  PHYS_DEFAULT, SAAS_DEFAULT,
  type AffConfig, type AffMonth,
} from './affiliate'

const cfg: AffConfig = {
  user_id: 'u', year_goal: 16000, goal_month: '2027-12-01', base_budget: 200, reinvest_pct: 50, test_cap_mult: 2, edit_days: 3,
  cap_tests_week: 15, working_days_week: 7, reg_per_test: 2, research_per_test: 5, win_min_orders: 3, phys: {}, saas: {},
}
const V1 = { coeffs: { phys: PHYS_DEFAULT, saas: SAAS_DEFAULT } } // bản chụp tháng chốt theo mô hình cũ (không có model_version)
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

describe('mô phỏng tháng chốt theo v1 (giữ đúng kết quả cũ)', () => {
  it('Vật lý: $1.200 → 100 test → 1 thắng, ra tiền 3 tháng kế tiếp', () => {
    const sim = simulate([row('2027-01-01', { budget_test: 1200, ...V1 }), row('2027-05-01', V1)], cfg, '2027-01-01')
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
    const rows = [row('2027-01-01', { budget_test: 4000, share_phys: 0, ...V1 }), row('2027-06-01', { share_phys: 0, ...V1 })]
    const sim = simulate(rows, cfg, '2027-01-01')
    expect(sim[0].testsS).toBeCloseTo(100)
    expect(sim[2].profitS).toBe(0)
    expect(sim[3].profitS).toBeCloseTo(1750)
    expect(sim[5].activeS).toBeCloseTo(1)
  })
})

describe('phân tích', () => {
  it('tìm hệ số nhân ngân sách tối thiểu', () => {
    const rows = [row('2027-01-01', { budget_test: 1200, profit_target: 100, ...V1 }), row('2027-02-01', { budget_test: 1200, profit_target: 4000, ...V1 })]
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
  it('lợi nhuận sau phí 5% ads, thuế 8% trên lợi nhuận', () => {
    const s = simulate([row('2027-01-01', { budget_test: 1200 }), row('2027-02-01')], cfg, '2027-01-01', 1, { max_test_usd: 12 })
    expect(s[0].fee).toBeCloseTo(60) // 5% × $1.200 tiền test
    expect(s[0].tax).toBe(0) // lỗ thì không thuế
    expect(s[0].net).toBeCloseTo(-1260)
    expect(s[1].profitP).toBeCloseTo(2000)
    expect(s[1].adsP).toBeCloseTo(4000)
    expect(s[1].fee).toBeCloseTo(200) // 5% × $4.000 ads
    expect(s[1].tax).toBeCloseTo(144) // 8% × (2.000 − 200)
    expect(s[1].net).toBeCloseTo(1656)
  })
  it('phí: ads $32.000 × 5% = $1.600; thuế trên thực nhận nếu chọn', () => {
    const r = profitAfterFees({ received: 48000, cost: 32000 }, { fee_pct: 5, tax_pct: 0 })
    expect(r.fee).toBe(1600)
    expect(r.net).toBe(14400)
    expect(profitAfterFees({ received: 1000, cost: 400 }, { fee_pct: 0, tax_pct: 8, tax_base: 'received' }).tax).toBeCloseTo(80)
    expect(profitAfterFees({ received: 24, cost: 312 }, { fee_pct: 5, tax_pct: 8 }).tax).toBe(0)
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
    const v1 = simulate([row('2027-01-01', { budget_test: 1000, share_phys: 50, share_tools: 30, ...V1 })], cfg, '2027-01-01')
    expect(v1[0].testsT).toBe(0) // tháng chốt v1 không có Tools AI
  })
  it('vốn cần = vận hành + quỹ cầu nối 15% + dự phòng 10%; cảnh báo khi thiếu', () => {
    const rows = [row('2027-01-01', { budget_test: 1200 }), row('2027-02-01')]
    const s = simulate(rows, cfg, '2027-01-01', 1, { max_test_usd: 12 })
    expect(s[1].capitalOps).toBeCloseTo(4000) // ads $4.000 × 30/30
    expect(s[1].capital).toBeCloseTo(5000)
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

describe('mở khoá một lần cho v2', () => {
  const novV1 = row('2026-11-01', { locked_at: '2026-11-05T00:00:00Z', ...V1 })
  it('tháng chốt theo v1 không tính là "đã chốt" → cài đặt sửa tự do', () => {
    expect(anyLockedV2([novV1])).toBe(false)
    expect(configEditable('2026-11-18', 3, anyLockedV2([novV1]))).toBe(true)
    expect(anyLockedV2([row('2026-12-01', { locked_at: 'x', coeffs: snapshotV2(cfg) })])).toBe(true)
  })
  it('tháng 11 đã chốt (v1) giữ khoá; tháng chưa chốt sửa được', () => {
    expect(rowEditable(novV1, '2026-11-18', 3, false)).toBe(false)
    expect(rowEditable(row('2026-12-01'), '2026-11-18', 3, false)).toBe(true)
    expect(rowEditable(row('2026-11-01'), '2026-11-18', 3, false)).toBe(true)
    expect(rowEditable(row('2026-11-01'), '2026-11-18', 3, true)).toBe(false)
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
