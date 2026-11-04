import { describe, expect, it } from 'vitest'
import {
  actualAt, changeRule, evenPlan, funnelPace, inWindow, lagTriggered, longLockCheck, multiplier, numericPercent, plannedAt,
  krStat, quarterEnd, quarterMilestones, quarterOf, quarterStart, quarterTriggered, reviewMissed, reviewWindow, statusColor, statusPct, weekEndsOfMonth,
} from './numeric'

const S = { status_red: 70, status_green: 90, lower_per_kr_quarter: 1, stop_per_quarter: 1, max_open_kr: 7, kr_min_cvtc: 3, kr_min_other: 1, kr_max_other: 2 }

describe('quý', () => {
  it('quý của ngày', () => {
    expect([quarterOf('2026-01-01'), quarterOf('2026-11-04'), quarterOf('2026-06-30')]).toEqual([1, 4, 2])
    expect(quarterStart('2026-11-04')).toBe('2026-10-01')
    expect(quarterEnd('2026-11-04')).toBe('2026-12-31')
  })
})

describe('KR số (§10.2, ví dụ §18.3)', () => {
  const plan = [
    { date: '2026-12-07', planned: 2 },
    { date: '2026-12-14', planned: 5 },
    { date: '2026-12-21', planned: 8 },
    { date: '2026-12-31', planned: 10 },
  ]
  it('% KR = (thực tế − bắt đầu)/(đích − bắt đầu)', () => {
    expect(numericPercent(0, 10, 4)).toBe(40)
    expect(numericPercent(100, 50, 75)).toBe(50) // KR giảm (VD giảm chi phí)
    expect(numericPercent(0, 10, 15)).toBe(100)
    expect(numericPercent(5, 5, 5)).toBeNull()
  })
  it('thực tế cộng dồn đến ngày', () => {
    const e = [{ date: '2026-12-03', value: 1 }, { date: '2026-12-10', value: 3 }]
    expect(actualAt(0, e, '2026-12-07')).toBe(1)
    expect(actualAt(0, e)).toBe(4)
  })
  it('kế hoạch cộng dồn nội suy tuyến tính, mốc T1=2 T2=5 T3=8 T4=10', () => {
    expect(plannedAt(plan, '2026-11-30', '2026-12-07')).toBe(2)
    expect(plannedAt(plan, '2026-11-30', '2026-12-14')).toBe(5)
    expect(plannedAt(plan, '2026-11-30', '2026-12-10')).toBeCloseTo(3.29, 1)
    expect(plannedAt(plan, '2026-11-30', '2027-01-05')).toBe(10)
    expect(plannedAt(plan, '2026-11-30', '2026-11-30')).toBe(0)
  })
  it('tình trạng và màu (đỏ <70, vàng 70–89, xanh ≥90)', () => {
    expect(statusPct(4, 5)).toBe(80)
    expect(statusPct(1, 0)).toBeNull()
    expect([statusColor(69, S), statusColor(80, S), statusColor(90, S), statusColor(null, S)]).toEqual(['red', 'yellow', 'green', 'none'])
  })
  it('kế hoạch chia đều + 4 mốc quý', () => {
    expect(evenPlan(['a', 'b', 'c', 'd'], 10).map((x) => x.planned)).toEqual([2.5, 5, 7.5, 10])
    expect(quarterMilestones(0, 200000).map((x) => x.value)).toEqual([50000, 100000, 150000, 200000])
  })
  it('mốc cuối tuần của tháng 11/2026', () => {
    expect(weekEndsOfMonth('2026-11-01')).toEqual(['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29', '2026-11-30'])
  })
})

describe('phễu thu nhập (§9, ví dụ §18.2)', () => {
  const m = {
    target_income_month: 16700,
    value_per_unit: 500,
    retention: 0.6,
    stages: [
      { id: '1', name: 'Cuộc gọi', conversion: 0.2 },
      { id: '2', name: 'Hẹn', conversion: 0.25 },
      { id: '3', name: 'Vào hệ thống', conversion: null },
    ],
    working_days_week: 5,
    capacity_per_day: 60,
    unknown: {},
  }
  it('chia ngược ra cuộc gọi/ngày', () => {
    const p = funnelPace(m)
    expect(p.ok).toBe(true)
    expect(p.unitsNeeded).toBeCloseTo(33.4, 1)
    expect(p.unitsToAcquire).toBeCloseTo(55.67, 1)
    expect(p.stages[0].perMonth).toBeCloseTo(1113.3, 0)
    expect(p.topPerDay).toBeCloseTo(51.4, 0)
    expect(p.overCapacity).toBe(false)
  })
  it('vượt công suất → cảnh báo', () => expect(funnelPace({ ...m, capacity_per_day: 30 }).overCapacity).toBe(true))
  it('thiếu hệ số → báo thiếu; hệ số chưa đo → ước lượng', () => {
    expect(funnelPace({ ...m, value_per_unit: null }).missing).toContain('Thu nhập mỗi đơn vị')
    expect(funnelPace({ ...m, unknown: { retention: true } }).estimated).toBe(true)
  })
  it('hệ số nhân bản', () => expect(multiplier(500000, 200000)).toBe(2.5))
})

describe('luật kích hoạt (§11.3)', () => {
  it('trễ >20% hai tuần liên tiếp', () => {
    expect(lagTriggered([95, 75, 70], 20, 2)).toBe(true)
    expect(lagTriggered([75, 85, 70], 20, 2)).toBe(false)
    expect(lagTriggered([70], 20, 2)).toBe(false)
    expect(lagTriggered([70, null, 60], 20, 2)).toBe(true)
  })
  it('KR quý trễ >30%', () => {
    expect(quarterTriggered(65, 30)).toBe(true)
    expect(quarterTriggered(75, 30)).toBe(false)
  })
})

describe('luật điều chỉnh (§11.4, §11.5)', () => {
  const base = { inReview: true, lowersThisQuarter: 0, stopsThisQuarter: 0, openKrs: 5 }
  it('thêm KR trong trần; đủ trần thì chặn', () => {
    expect(changeRule({ ...base, type: 'add' }, S).allowed).toBe(true)
    expect(changeRule({ ...base, type: 'add', openKrs: 7 }, S).allowed).toBe(false)
  })
  it('nhóm (a) không được hạ', () => {
    const v = changeRule({ ...base, type: 'lower', cause: 'a', evidence: 'gọi 20/40' }, S)
    expect(v.allowed).toBe(false)
    expect(v.reason).toContain('Tăng nỗ lực')
  })
  it('hạ nhóm (b) có số liệu: được; ngoài buổi rà thì chờ', () => {
    expect(changeRule({ ...base, type: 'lower', cause: 'b', evidence: 'hẹn/gọi 8% < 20%' }, S)).toEqual({ allowed: true, pending: false, needMentor: false, reason: '' })
    expect(changeRule({ ...base, inReview: false, type: 'lower', cause: 'b', evidence: 'x' }, S).pending).toBe(true)
    expect(changeRule({ ...base, inReview: false, type: 'lower', cause: 'd', evidence: 'x' }, S).pending).toBe(false)
  })
  it('vượt giới hạn hạ → cần mentor', () => {
    expect(changeRule({ ...base, lowersThisQuarter: 1, type: 'lower', cause: 'c', evidence: 'x' }, S).allowed).toBe(false)
    expect(changeRule({ ...base, lowersThisQuarter: 1, type: 'lower', cause: 'c', evidence: 'x', mentor: 'Mentor X3' }, S)).toMatchObject({ allowed: true, needMentor: true })
  })
  it('dừng: tối đa 1 lần/quý', () => {
    expect(changeRule({ ...base, type: 'stop' }, S).allowed).toBe(true)
    expect(changeRule({ ...base, type: 'stop', stopsThisQuarter: 1 }, S).allowed).toBe(false)
  })
})

describe('cửa sổ rà (§13)', () => {
  it('tháng: ngày cuối tháng hoặc ngày đầu tháng sau', () => {
    expect(reviewWindow('month', '2026-11-01')).toEqual({ from: '2026-11-30', to: '2026-12-01' })
  })
  it('quý và năm', () => {
    expect(reviewWindow('quarter', '2026-10-01')).toEqual({ from: '2026-12-31', to: '2027-01-01' })
    expect(reviewWindow('year', '2027-01-01')).toEqual({ from: '2028-01-01', to: '2028-01-05' })
    expect(reviewWindow('kickoff', '2026-11-01', '2026-12-31')).toEqual({ from: '2026-12-31', to: '2027-01-05' })
  })
  it('trong cửa sổ / bỏ lỡ', () => {
    const w = reviewWindow('month', '2026-11-01')
    expect(inWindow(w, '2026-11-30')).toBe(true)
    expect(reviewMissed(w, '2026-12-02', false)).toBe(true)
    expect(reviewMissed(w, '2026-12-02', true)).toBe(false)
  })
})

describe('chốt kỳ dài (§4.5)', () => {
  const full = { S: true, M: true, A: true, R: true, T: true, KRO: true }
  const objs = [
    { area: 'cv_tc', title: 'Hệ thống chạy ổn định', smart: full },
    { area: 'mqh', title: 'Kết nối mentor', smart: full },
    { area: 'ttt', title: 'Khoẻ', smart: full },
  ]
  const ids = { cv_tc: 'o1', mqh: 'o2', ttt: 'o3' }
  const kr = (objective_id: string, p: Partial<{ baseline: number | null; is_team: boolean; source: string }> = {}) => ({
    objective_id, title: 'KR', baseline: 0, target: 10, deadline: '2026-12-31', source: 'bảng theo dõi', is_team: false, status: 'active', ...p,
  })
  it('đủ 3 O, CV/TC 3 KR, mỗi O khác 1 KR, đủ Từ–Đến–Hạn–Nguồn → cho chốt', () => {
    const r = longLockCheck(objs, [kr('o1'), kr('o1'), kr('o1'), kr('o2'), kr('o3')], ids, S, { overCapacity: false, passive: false })
    expect(r.blockers).toEqual([])
  })
  it('thiếu KR, thiếu nguồn, vượt công suất không có KR đội ngũ → chặn', () => {
    const r = longLockCheck(objs, [kr('o1', { source: '' }), kr('o2')], ids, S, { overCapacity: true, passive: false })
    const t = r.blockers.join(' ')
    expect(t).toContain('cần ít nhất 3 KR')
    expect(t).toContain('thiếu: Nguồn')
    expect(t).toContain('O Thân–Tâm–Trí cần ít nhất 1 KR')
    expect(t).toContain('đội ngũ')
  })
})

describe('trạng thái KR số', () => {
  const T = { status_red: 70, status_green: 90, trigger_lag_pct: 20, trigger_weeks: 2 }
  const kr = { baseline: 0, target: 10, deadline: '2026-11-30', cumulative_plan: [{ date: '2026-11-08', planned: 2 }, { date: '2026-11-15', planned: 5 }, { date: '2026-11-22', planned: 8 }, { date: '2026-11-30', planned: 10 }] }
  it('giữa tháng: thực tế 3, kế hoạch 5 đến 15/11 → tình trạng 60% đỏ', () => {
    const st = krStat(kr, [{ date: '2026-11-05', value: 1 }, { date: '2026-11-12', value: 2 }], '2026-11-01', '2026-11-30', '2026-11-15', T)
    expect([st.actual, st.pct, st.status, st.color]).toEqual([3, 30, 60, 'red'])
  })
  it('luật kích hoạt theo mốc tuần đã qua', () => {
    const st = krStat(kr, [{ date: '2026-11-05', value: 1 }], '2026-11-01', '2026-11-30', '2026-11-18', T, ['2026-11-08', '2026-11-15'])
    expect(st.weekStatuses).toEqual([50, 20])
    expect(st.triggered).toBe(true)
  })
  it('KR giảm (đích < bắt đầu) vẫn tính đúng chiều', () => {
    const st = krStat({ baseline: 100, target: 60, deadline: '2026-11-30' }, [{ date: '2026-11-10', value: -20 }], '2026-11-01', '2026-11-30', '2026-11-15', T)
    expect(st.pct).toBe(50)
    expect(st.status).toBeGreaterThan(100)
  })
  it('thiếu bắt đầu/đích → chưa có số', () => expect(krStat({ baseline: null, target: 10 }, [], '2026-11-01', '2026-11-30', '2026-11-15', T).color).toBe('none'))
})
