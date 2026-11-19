import { describe, expect, it } from 'vitest'
import { PHYS_DEFAULT, SAAS_DEFAULT } from './affiliate'
import { diagnose, suggestCoeffs, extraFindings, type ExtraIn } from './affDiag'
import type { Counts, Measured } from './affProjects'

const C = (p: Partial<Counts>): Counts => ({ search: 0, chon: 0, dang_ky: 0, duyet: 0, test: 0, win: 0, ...p })
const M = (p: Partial<Measured>): Measured => ({ n_tests: 0, n_wins: 0, test_cost: null, tests_per_win: null, order_rate: null, approval: null, win_profit: null, reg_per_test: null, research_per_test: null, reg_approved: null, ...p })
const T = { search: 84, dang_ky: 34, test: 17 }
const set = { phys: PHYS_DEFAULT }
const keys = (f: { key: string }[]) => f.map((x) => x.key)

describe('chẩn đoán khâu nghẽn', () => {
  it('thiếu test do search ít', () => {
    expect(keys(diagnose(C({ search: 40, dang_ky: 30, test: 8 }), T, M({}), set, 0))).toEqual(['vol', 'vol-search', 'win-sample'])
  })
  it('search đủ, đăng ký thiếu', () => {
    expect(keys(diagnose(C({ search: 90, dang_ky: 20, test: 8 }), T, M({}), set, 0))).toContain('vol-reg')
  })
  it('đăng ký đủ, duyệt ít', () => {
    expect(keys(diagnose(C({ search: 90, dang_ky: 34, duyet: 10, test: 8 }), T, M({}), set, 0))).toContain('vol-approve')
  })
  it('đã có link mà chưa lên camp', () => {
    expect(keys(diagnose(C({ search: 90, dang_ky: 34, duyet: 30, test: 8 }), T, M({}), set, 6))).toContain('vol-launch')
  })
  it('đủ khối lượng', () => {
    expect(keys(diagnose(C({ test: 17 }), T, M({}), set, 0))[0]).toBe('vol-ok')
  })
  it('tiền test cao, ít ra đơn, network huỷ nhiều, cần đủ mẫu', () => {
    const f = keys(diagnose(C({ test: 17 }), T, M({ n_tests: 12, test_cost: 18, order_rate: 20, approval: 15 }), set, 0))
    expect(f).toEqual(expect.arrayContaining(['cost-hi', 'orders', 'scrub']))
    expect(keys(diagnose(C({ test: 17 }), T, M({ n_tests: 4, test_cost: 18, order_rate: 0 }), set, 0))).not.toContain('cost-hi')
  })
  it('tỷ lệ thắng so với giả định', () => {
    expect(keys(diagnose(C({}), null, M({ n_tests: 300, n_wins: 1, tests_per_win: 300 }), set, 0))).toContain('win-slow')
    expect(keys(diagnose(C({}), null, M({ n_tests: 40, n_wins: 1, tests_per_win: 40 }), set, 0))).toContain('win-fast')
  })
})

describe('gợi ý hệ số', () => {
  it('chỉ gợi ý khi có mẫu; đánh dấu đủ/chưa đủ', () => {
    const s = suggestCoeffs(M({ n_tests: 6, test_cost: 14.37, reg_per_test: 2.5, research_per_test: 7 }), M({}), { phys: PHYS_DEFAULT, saas: SAAS_DEFAULT, reg_per_test: 2, research_per_test: 5 })
    expect(s.map((x) => [x.key, x.value, x.enough])).toEqual([
      ['phys.test_cost', 14.4, true],
      ['reg_per_test', 2.5, false], // phễu minh hoạ: cần ≥ 30 dự án test mới đủ
      ['research_per_test', 7, false],
    ])
    const s30 = suggestCoeffs(M({ n_tests: 30, reg_per_test: 2.5, research_per_test: 7 }), M({}), { phys: PHYS_DEFAULT, saas: SAAS_DEFAULT, reg_per_test: 2, research_per_test: 5 })
    expect(s30.find((x) => x.key === 'reg_per_test')!.enough).toBe(true)
    expect(s[0].diffPct).toBe(20)
  })
})

describe('cảnh báo thêm GĐ5 (Research + Ads-Hub)', () => {
  const base: ExtraIn = { testCost: null, nTests: 0, maxTest: 10, approval: null, warnPct: 70, pendingComm: 0, deniedComm: 0, seasonWarn: false, capitalShort: null }
  const keys = (x: Partial<ExtraIn>) => extraFindings({ ...base, ...x }).map((f) => f.key)
  it('không có gì bất thường → không cảnh báo', () => {
    expect(keys({})).toEqual([])
  })
  it('tiền test TB vượt maxtest (đủ 5 test)', () => {
    expect(keys({ testCost: 11, nTests: 5 })).toEqual(['cost-max'])
    expect(keys({ testCost: 11, nTests: 4 })).toEqual([])
    expect(keys({ testCost: 10.4, nTests: 9 })).toEqual([])
  })
  it('% duyệt thấp hoặc chưa đủ đơn quá hạn', () => {
    expect(keys({ approval: { pct: 55, resolved: 7 } })).toEqual(['appr-low'])
    expect(keys({ approval: { pct: 80, resolved: 7 } })).toEqual([])
    expect(keys({ approval: { pct: null, resolved: 2 } })).toEqual(['appr-wait'])
  })
  it('hoa hồng chờ / bị huỷ, mùa vụ, vốn', () => {
    expect(keys({ pendingComm: 40, deniedComm: 25, seasonWarn: true, capitalShort: { month: '2027-01-01', need: 900, avail: 200 } })).toEqual(['pending', 'denied', 'season', 'capital'])
  })
})
