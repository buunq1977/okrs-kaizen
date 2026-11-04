import { describe, expect, it } from 'vitest'
import { inSlot, mergeSchedule, occursOn, repeatLabel } from './schedule'
import type { ScheduleItem, ScheduleSeries } from './types'

const series = (p: Partial<ScheduleSeries>): ScheduleSeries => ({
  id: 's1', rule: 'daily', weekdays: [], month_day: null, start_date: '2026-11-01', end_date: null,
  time_from: '16:30:00', time_to: '17:00:00', title: 'Chạy bộ 5km', people: '', kind: 'viec', fixed: false, kr_id: null, increment: 1, ...p,
})
const item = (p: Partial<ScheduleItem>): ScheduleItem => ({
  id: 'i1', period_id: 'p', date: '2026-11-04', time_from: null, time_to: null, title: '', people: '', kind: 'viec',
  fixed: false, done: false, untimed: false, series_id: null, skipped: false, kr_id: null, ...p,
})

describe('lặp lại (C8)', () => {
  it('hằng ngày trong khoảng ngày', () => {
    expect(occursOn(series({}), '2026-11-04')).toBe(true)
    expect(occursOn(series({}), '2026-10-31')).toBe(false)
    expect(occursOn(series({ end_date: '2026-11-03' }), '2026-11-04')).toBe(false)
  })
  it('T2–T6', () => {
    const s = series({ rule: 'weekly', weekdays: [1, 2, 3, 4, 5] })
    expect(occursOn(s, '2026-11-06')).toBe(true) // T6
    expect(occursOn(s, '2026-11-08')).toBe(false) // CN
  })
  it('ngày 31 hằng tháng → tháng 30 ngày rơi vào ngày 30', () => {
    const s = series({ rule: 'monthly', month_day: 31 })
    expect(occursOn(s, '2026-11-30')).toBe(true)
    expect(occursOn(s, '2026-11-29')).toBe(false)
    expect(occursOn(s, '2026-12-31')).toBe(true)
  })
  it('nhãn lặp', () => {
    expect(repeatLabel({ rule: 'weekly', weekdays: [5, 1, 2, 3, 4], month_day: null })).toBe('T2–T6')
    expect(repeatLabel({ rule: 'weekly', weekdays: [7, 6], month_day: null })).toBe('T7, CN')
  })
})

describe('gộp lịch ngày', () => {
  it('chuỗi + mục riêng + lời hứa chưa có giờ, sắp theo giờ', () => {
    const e = mergeSchedule(
      [series({}), series({ id: 's2', title: 'Gọi Phonetem', time_from: '09:30:00', time_to: '10:00:00', fixed: true })],
      [item({ id: 'i1', time_from: '04:30:00', time_to: '06:15:00', title: 'Trại mentor', fixed: true }), item({ id: 'i2', untimed: true, title: 'Gọi lại anh A', kind: 'loi_hua' })],
      '2026-11-04',
    )
    expect(e.map((x) => x.title)).toEqual(['Trại mentor', 'Gọi Phonetem', 'Chạy bộ 5km', 'Gọi lại anh A'])
    expect(e[1].fixed).toBe(true)
  })
  it('sửa riêng 1 lần: giữ chuỗi, dùng giá trị sửa; bỏ 1 lần thì ẩn', () => {
    const ov = item({ id: 'o', series_id: 's1', title: 'Chạy bộ 3km', done: true, time_from: '16:30:00', time_to: '17:00:00' })
    const e = mergeSchedule([series({})], [ov], '2026-11-04')
    expect([e[0].title, e[0].done, e[0].series?.id]).toEqual(['Chạy bộ 3km', true, 's1'])
    expect(mergeSchedule([series({})], [{ ...ov, skipped: true }], '2026-11-04')).toEqual([])
  })
  it('xếp vào ô 30 phút theo giờ bắt đầu', () => {
    const [e] = mergeSchedule([series({})], [], '2026-11-04')
    expect(inSlot(e, '16:30', '17:00')).toBe(true)
    expect(inSlot(e, '16:00', '16:30')).toBe(false)
  })
})
