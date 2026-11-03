import { describe, expect, it } from 'vitest'
import {
  colorOf, krPercent, rollup, requiredLinked, dayLinkCheck, parentLinkCheck, lockCheck, looksLikeAction,
  highlight, keywordStats, effectiveLock, redStreak, timeSlots, kaizenStarted, average,
} from './okr'

const S = {
  red_below: 50, pass_pct: 80, only_linked_pct: true, weights_enabled: false, link_pct: 60, day_min_linked_kr: 1,
  day_min_kr: 3, day_max_kr: 4, auto_lock: true, lock_time: '22:00', red_lock: true, red_streak: 2, rest_weekdays: [7],
}
const ka = (done: boolean, weight: number | null = null) => ({ done, weight })

describe('màu % (§8)', () => {
  it('<50 đỏ, 50–79 vàng, ≥80 xanh', () => {
    expect(colorOf(49, S)).toBe('red')
    expect(colorOf(50, S)).toBe('yellow')
    expect(colorOf(79, S)).toBe('yellow')
    expect(colorOf(80, S)).toBe('green')
    expect(colorOf(null, S)).toBe('none')
  })
})

describe('% KR và % O', () => {
  it('KR = KA tick / tổng KA', () => {
    expect(krPercent({ pct_override: null }, [ka(true), ka(true), ka(false), ka(false)], false)).toBe(50)
    expect(krPercent({ pct_override: null }, [], false)).toBe(0)
  })
  it('chỉnh tay thì lấy số chỉnh (§15.4)', () => {
    expect(krPercent({ pct_override: 70 }, [ka(true), ka(true), ka(true), ka(false)], false)).toBe(70)
  })
  it('trọng số chỉ dùng khi bật', () => {
    const kas = [ka(true, 3), ka(false, 1)]
    expect(krPercent({ pct_override: null }, kas, false)).toBe(50)
    expect(krPercent({ pct_override: null }, kas, true)).toBe(75)
  })
  it('ví dụ §14: KR 100 / 70 / 50 → O 73%', () => {
    const kr1 = krPercent({ pct_override: null }, [ka(true), ka(true), ka(true)], false)
    const kr2 = krPercent({ pct_override: 70 }, [ka(true), ka(true), ka(true), ka(false)], false)
    const kr3 = krPercent({ pct_override: null }, [ka(true), ka(true), ka(false), ka(false)], false)
    const o = rollup([kr1, kr2, kr3].map((pct) => ({ pct, linked: true })), S)
    expect(o.main).toBe(73)
  })
  it('chỉ tính phần liên quan, vẫn trả cả % tổng', () => {
    const r = rollup([{ pct: 100, linked: true }, { pct: 0, linked: false }], S)
    expect(r).toEqual({ main: 100, target: 100, total: 50 })
    expect(rollup([{ pct: 100, linked: true }, { pct: 0, linked: false }], { ...S, only_linked_pct: false }).main).toBe(50)
  })
  it('không có KR liên quan → % mục tiêu trống', () => {
    expect(rollup([{ pct: 100, linked: false }], S).main).toBeNull()
  })
  it('average rỗng = null', () => expect(average([], false)).toBeNull())
})

describe('quy tắc liên quan (§3)', () => {
  it('60%: tuần 7→5, tháng 4→3, 5→3, năm 12→8', () => {
    expect(requiredLinked(7, 60)).toBe(5)
    expect(requiredLinked(4, 60)).toBe(3)
    expect(requiredLinked(5, 60)).toBe(3)
    expect(requiredLinked(12, 60)).toBe(8)
  })
  it('tuần chỉ 4/7 ngày liên quan → cảnh báo', () => {
    expect(parentLinkCheck(4, 7, 'ngày', S).ok).toBe(false)
    expect(parentLinkCheck(5, 7, 'ngày', S).ok).toBe(true)
  })
  it('ngày: ≥1 KR liên quan, cảnh báo khi chỉ có 1', () => {
    expect(dayLinkCheck([{ linked: false }, { linked: false }], S).ok).toBe(false)
    const one = dayLinkCheck([{ linked: true }, { linked: false }, { linked: false }], S)
    expect(one.ok).toBe(true)
    expect(one.message).not.toBe('')
    expect(dayLinkCheck([{ linked: true }, { linked: true }, { linked: false }], S).message).toBe('')
  })
})

describe('chặn Chốt kế hoạch (§4.4)', () => {
  const full = { S: true, M: true, A: true, R: true, T: true }
  const O = { o_title: 'Hoàn thiện kỹ năng tuyển dụng', o_smart: { ...full, KRO: true }, o_metric: '73%' }
  const kr = (title: string, smart = full, kas = 2) => ({ title, smart, metric: 'x', kas })
  it('đủ 6 tiêu chí O, 3 KR đủ SMART → cho chốt', () => {
    expect(lockCheck('day', O, [kr('A đạt 100%'), kr('B 70%'), kr('C 50%')], S).blockers).toEqual([])
  })
  it('thiếu KR→O, thiếu KR, KR thiếu T → chặn', () => {
    const r = lockCheck('day', { ...O, o_smart: full }, [kr('A', { ...full, T: false })], S)
    expect(r.blockers.join(' ')).toContain('KR→O')
    expect(r.blockers.join(' ')).toContain('Cần ít nhất 3 KR')
    expect(r.blockers.join(' ')).toContain('KR1 còn thiếu: T')
  })
  it('tick M không có số đo → cảnh báo, không chặn', () => {
    const r = lockCheck('day', { ...O, o_metric: '' }, [kr('A'), kr('B'), kr('C')], S)
    expect(r.blockers).toEqual([])
    expect(r.warnings.join(' ')).toContain('chưa có số đo')
  })
  it('KR viết như hành động → gợi ý', () => {
    expect(looksLikeAction('Gọi 20 data')).toBe(true)
    expect(looksLikeAction('Đăng ký 5 data')).toBe(true)
    expect(looksLikeAction('100% kịch bản được chuẩn bị')).toBe(false)
    expect(lockCheck('day', O, [kr('Gọi 20 data'), kr('B'), kr('C')], S).warnings.join(' ')).toContain('viết như hành động')
  })
})

describe('Kaizen', () => {
  it('bôi đỏ từ khoá trong đoạn nguyên nhân', () => {
    expect(highlight('Do chưa tập trung nên mất năng lượng', ['mất năng lượng', 'chưa tập trung'])).toEqual([
      { text: 'Do ', hit: false },
      { text: 'chưa tập trung', hit: true },
      { text: ' nên ', hit: false },
      { text: 'mất năng lượng', hit: true },
    ])
  })
  it('từ khoá lặp lại nhiều nhất', () => {
    const r = keywordStats([{ keywords: ['chưa tập trung', 'mất năng lượng'] }, { keywords: ['Chưa tập trung'] }, {}])
    expect(r[0]).toEqual({ keyword: 'chưa tập trung', count: 2 })
  })
  it('nhận biết Kaizen đã bắt đầu', () => {
    expect(kaizenStarted({})).toBe(false)
    expect(kaizenStarted({ journal: { s: '4h30 trại mentor' } })).toBe(true)
  })
})

describe('kỷ luật (§17 D2)', () => {
  const p = (status: 'draft' | 'locked', locked_at: string | null = null, unlocks: { at: string }[] = []) => ({ kind: 'day', start_date: '2026-11-05', status, locked_at, unlocks })
  it('tự khoá 22:00 hôm trước', () => {
    expect(effectiveLock(p('draft'), S, new Date(2026, 10, 4, 21, 59)).locked).toBe(false)
    expect(effectiveLock(p('draft'), S, new Date(2026, 10, 4, 22, 0)).locked).toBe(true)
  })
  it('tắt tự khoá thì chỉ khoá khi bấm Chốt', () => {
    expect(effectiveLock(p('draft'), { ...S, auto_lock: false }, new Date(2026, 10, 5, 9)).locked).toBe(false)
    expect(effectiveLock(p('locked', new Date(2026, 10, 4, 20).toISOString()), { ...S, auto_lock: false }, new Date(2026, 10, 4, 21)).locked).toBe(true)
  })
  it('mở khoá có lý do sau giờ khoá', () => {
    const u = [{ at: new Date(2026, 10, 4, 22, 30).toISOString() }]
    expect(effectiveLock(p('draft', null, u), S, new Date(2026, 10, 4, 23)).locked).toBe(false)
  })
  it('chốt lại sau khi đã mở khoá → khoá', () => {
    const u = [{ at: new Date(2026, 10, 4, 22, 30).toISOString() }]
    expect(effectiveLock(p('locked', new Date(2026, 10, 4, 22, 45).toISOString(), u), S, new Date(2026, 10, 4, 23)).locked).toBe(true)
  })

  const rec = (date: string, pct: number | null, lessons = false, hasO = true) => ({ date, pct, lessons, hasO })
  it('đỏ 2 ngày liền chưa có bài học → khoá', () => {
    expect(redStreak('2026-11-04', [rec('2026-11-02', 20), rec('2026-11-03', 30)], S)).toEqual({ locked: true, day: '2026-11-03' })
  })
  it('đã viết bài học ngày gần nhất → mở', () => {
    expect(redStreak('2026-11-04', [rec('2026-11-02', 20), rec('2026-11-03', 30, true)], S).locked).toBe(false)
  })
  it('một ngày đạt thì không khoá', () => {
    expect(redStreak('2026-11-04', [rec('2026-11-02', 20), rec('2026-11-03', 85)], S).locked).toBe(false)
  })
  it('bỏ qua ngày nghỉ (CN)', () => {
    expect(redStreak('2026-11-09', [rec('2026-11-06', 10), rec('2026-11-07', 10)], S)).toEqual({ locked: true, day: '2026-11-07' })
  })
  it('người mới dùng từ hôm qua không bị khoá oan', () => {
    expect(redStreak('2026-11-04', [rec('2026-11-03', 10)], S).locked).toBe(false)
  })
  it('ngày bỏ trống không lập O vẫn tính là đỏ', () => {
    expect(redStreak('2026-11-04', [rec('2026-11-02', 10)], S)).toEqual({ locked: true, day: '2026-11-03' })
  })
  it('tắt cài đặt thì không khoá', () => {
    expect(redStreak('2026-11-04', [rec('2026-11-02', 0), rec('2026-11-03', 0)], { ...S, red_lock: false }).locked).toBe(false)
  })
})

describe('lịch giờ', () => {
  it('04:30–22:30, 30 phút = 36 ô', () => {
    const s = timeSlots('04:30', '22:30', 30)
    expect(s.length).toBe(36)
    expect(s[0]).toEqual({ from: '04:30', to: '05:00' })
    expect(s[35]).toEqual({ from: '22:00', to: '22:30' })
  })
})
