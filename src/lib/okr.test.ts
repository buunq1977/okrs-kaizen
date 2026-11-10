import { describe, expect, it } from 'vitest'
import {
  colorOf, krPercent, execPercent, oActualPercent, dayScore, gapSuggest, remindTime, defaultTab, scheduleLoad,
  focusAutoChecks, carryCandidates, lockCheck, looksLikeAction, autoTickIds, focusLevel, weekDefaultTab, bucketOf,
  highlight, keywordStats, effectiveLock, redStreak, timeSlots, kaizenStarted, average, kaizenConfirm, kaizenReady,
} from './okr'

const S = {
  red_below: 50, pass_pct: 80, weights_enabled: false,
  day_min_kr: 3, day_max_kr: 4, auto_lock: true, lock_time: '22:00', okr_lock_time: '08:00', red_lock: true, red_streak: 2, rest_weekdays: [7],
  remind_lead_min: 90, default_tab: 'auto' as const,
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
  it('ví dụ §18: KR 100 / 70 / 50 → % thực thi O 73%', () => {
    const kr1 = krPercent({ pct_override: null }, [ka(true), ka(true), ka(true)], false)
    const kr2 = krPercent({ pct_override: 70 }, [ka(true), ka(true), ka(true), ka(false)], false)
    const kr3 = krPercent({ pct_override: null }, [ka(true), ka(true), ka(false), ka(false)], false)
    expect(execPercent([kr1, kr2, kr3].map((pct) => ({ pct })), false)).toBe(73)
  })
  it('không có KR → null', () => expect(execPercent([], false)).toBeNull())
  it('average rỗng = null', () => expect(average([], false)).toBeNull())
})

describe('% O thực tế (C3)', () => {
  const o = (o_target: number | null, o_actual: number | null, o_result: 'dat' | 'mot_phan' | 'chua' | null = null) => ({ o_target, o_actual, o_result })
  it('có đích số → thực tế / đích', () => expect(oActualPercent(o(20, 6))).toBe(30))
  it('vượt đích chặn 100', () => expect(oActualPercent(o(20, 25))).toBe(100))
  it('không có số → 3 mức', () => {
    expect(oActualPercent(o(null, null, 'dat'))).toBe(100)
    expect(oActualPercent(o(null, null, 'mot_phan'))).toBe(50)
    expect(oActualPercent(o(null, null, null))).toBeNull()
  })
  it('màu/chuỗi đỏ dùng O thực tế nếu có', () => {
    expect(dayScore(100, 30)).toBe(30)
    expect(dayScore(73, null)).toBe(73)
  })
  it('KR 100% mà O 30% → gợi ý KR chọn chưa trúng O', () => {
    expect(gapSuggest(100, 30, 30)).toBe(true)
    expect(gapSuggest(73, 60, 30)).toBe(false)
    expect(gapSuggest(73, null, 30)).toBe(false)
  })
})

describe('nhắc & tab (C19, C20)', () => {
  it('chốt 22:00, nhắc trước 90 phút = 20:30; 60 phút = 21:00', () => {
    expect(remindTime('22:00', 90)).toBe('20:30')
    expect(remindTime('22:00:00', 60)).toBe('21:00')
    expect(remindTime('00:30', 60)).toBe('23:30')
  })
  it('tab mở sẵn theo giờ nhắc', () => {
    expect(defaultTab('2026-11-04', '2026-11-04', new Date(2026, 10, 4, 20, 29), S)).toBe('okr')
    expect(defaultTab('2026-11-04', '2026-11-04', new Date(2026, 10, 4, 20, 30), S)).toBe('kaizen')
    expect(defaultTab('2026-11-05', '2026-11-04', new Date(2026, 10, 4, 21), S)).toBe('okr')
    expect(defaultTab('2026-11-03', '2026-11-04', new Date(2026, 10, 4, 9), S)).toBe('kaizen')
    expect(defaultTab('2026-11-04', '2026-11-04', new Date(2026, 10, 4, 21), { ...S, default_tab: 'okr' })).toBe('okr')
  })
  it('Kaizen hôm trước chưa xác nhận: mở tab đó trước 08:00 và khi lập ngày mai', () => {
    expect(defaultTab('2026-11-04', '2026-11-04', new Date(2026, 10, 4, 7, 30), S, false)).toBe('prev')
    expect(defaultTab('2026-11-04', '2026-11-04', new Date(2026, 10, 4, 8, 0), S, false)).toBe('okr')
    expect(defaultTab('2026-11-04', '2026-11-04', new Date(2026, 10, 4, 7, 30), S, true)).toBe('okr')
    expect(defaultTab('2026-11-05', '2026-11-04', new Date(2026, 10, 4, 21), S, false)).toBe('prev')
  })
  it('xác nhận Kaizen: cần nhật ký + bài học; đúng hạn trước 22:00', () => {
    expect(kaizenReady({ journal: [{ did: 'x', result: 'y' }] })).toBe(false)
    expect(kaizenReady({ journal: [{ did: 'x', result: 'y' }], lessons: [{ text: 'Bài học' }] })).toBe(true)
    expect(kaizenConfirm('2026-11-04', {}, S)).toBe('none')
    expect(kaizenConfirm('2026-11-04', { confirmed_at: new Date(2026, 10, 4, 21, 59).toISOString() }, S)).toBe('ontime')
    expect(kaizenConfirm('2026-11-04', { confirmed_at: new Date(2026, 10, 4, 22, 1).toISOString() }, S)).toBe('late')
  })
})

describe('Kiểm tra tiêu điểm & tải lịch', () => {
  it('lịch cố định 04:30–22:30: 9 giờ cố định = 50%', () => {
    expect(scheduleLoad([{ time_from: '04:30', time_to: '13:30', fixed: true }, { time_from: '14:00', time_to: '18:00', fixed: false }], '04:30', '22:30')).toBe(50)
  })
  it('M thiếu số đo, KR chưa đủ, lịch quá kín → báo', () => {
    const c = focusAutoChecks({ title: 'Hoàn thiện kỹ năng tuyển dụng', o_metric: '', o_target: null }, 2, 3, 85)
    expect(c.M.ok).toBe(false)
    expect(c.KRO.ok).toBe(false)
    expect(c.A.ok).toBe(false)
    expect(c.R.ok).toBeNull()
  })
  it('đủ điều kiện → để người dùng tự xác nhận', () => {
    const c = focusAutoChecks({ title: 'Hoàn thiện kỹ năng tuyển dụng', o_metric: '20 data', o_target: 20 }, 3, 3, 40)
    expect([c.S.ok, c.M.ok, c.A.ok, c.KRO.ok]).toEqual([null, true, null, null])
  })
})

describe('mang sang quan sát (C13)', () => {
  it('chỉ lấy ý chưa đóng, chưa mang sang', () => {
    const prev = [
      { id: 'a', closed: false, content: 'Tuyển dụng chưa có kênh' },
      { id: 'b', closed: true, content: 'Đã xong' },
      { id: 'c', closed: false, content: 'Đã mang' },
      { id: 'd', closed: false, content: '  ' },
    ]
    expect(carryCandidates(prev, [{ carried_from: 'c' }, { carried_from: null }]).map((x) => x.id)).toEqual(['a'])
  })
})

describe('chặn Chốt kế hoạch (§4.4)', () => {
  const full = { S: true, M: true, A: true, R: true, T: true }
  const O = { title: 'Hoàn thiện kỹ năng tuyển dụng', smart: { ...full, KRO: true }, o_metric: '73%', o_target: null }
  const kr = (title: string, smart = full, kas = 2) => ({ title, smart, metric: 'x', kas })
  it('đủ 6 tiêu chí O, 3 KR đủ SMART → cho chốt', () => {
    expect(lockCheck('day', O, [kr('A đạt 100%'), kr('B 70%'), kr('C 50%')], S).blockers).toEqual([])
  })
  it('thiếu KR→O, thiếu KR, KR thiếu T → chặn', () => {
    const r = lockCheck('day', { ...O, smart: full }, [kr('A', { ...full, T: false })], S)
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
    expect(kaizenStarted({ journal: [{ did: '4h30 trại mentor', result: '' }] })).toBe(true)
    expect(kaizenStarted({ journal: [{ did: '', result: '' }] })).toBe(false)
  })
})

describe('kỷ luật (§17 D2)', () => {
  const p = (status: 'draft' | 'locked', locked_at: string | null = null, unlocks: { at: string }[] = []) => ({ kind: 'day', start_date: '2026-11-05', status, locked_at, unlocks })
  it('OKR ngày tự khoá 08:00 chính ngày đó', () => {
    expect(effectiveLock(p('draft'), S, new Date(2026, 10, 4, 22, 30)).locked).toBe(false)
    expect(effectiveLock(p('draft'), S, new Date(2026, 10, 5, 7, 59)).locked).toBe(false)
    expect(effectiveLock(p('draft'), S, new Date(2026, 10, 5, 8, 0)).locked).toBe(true)
  })
  it('tắt tự khoá thì chỉ khoá khi bấm Chốt', () => {
    expect(effectiveLock(p('draft'), { ...S, auto_lock: false }, new Date(2026, 10, 5, 9)).locked).toBe(false)
    expect(effectiveLock(p('locked', new Date(2026, 10, 4, 20).toISOString()), { ...S, auto_lock: false }, new Date(2026, 10, 4, 21)).locked).toBe(true)
  })
  it('mở khoá có lý do sau giờ khoá', () => {
    const u = [{ at: new Date(2026, 10, 5, 8, 30).toISOString() }]
    expect(effectiveLock(p('draft', null, u), S, new Date(2026, 10, 5, 9)).locked).toBe(false)
  })
  it('chốt lại sau khi đã mở khoá → khoá', () => {
    const u = [{ at: new Date(2026, 10, 5, 8, 30).toISOString() }]
    expect(effectiveLock(p('locked', new Date(2026, 10, 5, 8, 45).toISOString(), u), S, new Date(2026, 10, 5, 9)).locked).toBe(true)
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

describe('tuần (§3.1, §7)', () => {
  const kas = [
    { id: 'a', done: false, auto_ticked: false },
    { id: 'b', done: false, auto_ticked: true },
    { id: 'c', done: true, auto_ticked: false },
    { id: 'd', done: false, auto_ticked: false },
  ]
  it('tự tick KA khi O ngày phục vụ đạt ≥ 80%', () => {
    const days = [{ serves_ka_id: 'a', score: 85 }, { serves_ka_id: 'b', score: 100 }, { serves_ka_id: 'd', score: 60 }, { serves_ka_id: null, score: 100 }]
    expect(autoTickIds(kas, days, 80, true)).toEqual(['a'])
    expect(autoTickIds(kas, days, 80, false)).toEqual([])
  })
  it('mức tập trung đếm ngày phục vụ KR hoặc KA tuần', () => {
    const days = [{ serves_kr_id: 'k1', serves_ka_id: null }, { serves_kr_id: null, serves_ka_id: 'a' }, { serves_kr_id: 'kX', serves_ka_id: null }, { serves_kr_id: null, serves_ka_id: null }]
    expect(focusLevel(days, ['k1'], ['a'])).toBe(2)
  })
  it('tab tuần: tuần đã qua / Chủ nhật → Kaizen, còn lại OKR', () => {
    expect(weekDefaultTab('2026-10-26', '2026-11-04', 'auto')).toBe('kaizen')
    expect(weekDefaultTab('2026-11-02', '2026-11-04', 'auto')).toBe('okr')
    expect(weekDefaultTab('2026-11-02', '2026-11-08', 'auto')).toBe('kaizen')
    expect(weekDefaultTab('2026-11-09', '2026-11-08', 'auto')).toBe('okr')
    expect(weekDefaultTab('2026-10-26', '2026-11-04', 'okr')).toBe('okr')
  })
  it('buổi trong ngày', () => {
    expect([bucketOf('04:30'), bucketOf('12:00'), bucketOf('17:59'), bucketOf('18:00'), bucketOf(null)]).toEqual(['s', 'c', 'c', 't', 'u'])
  })
})
