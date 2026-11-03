/**
 * Logic thuần của OKR + Kaizen (SPEC §3, §4, §8, §15, §17 D2).
 * Không gọi database, không phụ thuộc React: mọi hàm ở đây có test trong okr.test.ts.
 */
import { addDays, isoDow } from './dates'
import type { Settings, Smart } from './types'

/* ---------- Màu % (§8) ---------- */
export type Color = 'red' | 'yellow' | 'green' | 'none'
type Thresholds = Pick<Settings, 'red_below' | 'pass_pct'>

export function colorOf(pct: number | null | undefined, t: Thresholds): Color {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return 'none'
  return pct < t.red_below ? 'red' : pct < t.pass_pct ? 'yellow' : 'green'
}

/* ---------- Trung bình, có trọng số tuỳ chọn ---------- */
export interface Weighted {
  value: number
  weight?: number | null
}
export function average(items: Weighted[], useWeights: boolean): number | null {
  if (!items.length) return null
  if (useWeights && items.some((i) => i.weight !== null && i.weight !== undefined)) {
    let w = 0
    let s = 0
    for (const i of items) {
      const k = i.weight ?? 1
      w += k
      s += i.value * k
    }
    return w ? s / w : null
  }
  return items.reduce((a, i) => a + i.value, 0) / items.length
}
const clamp = (n: number) => Math.max(0, Math.min(100, n))
const round = (n: number | null) => (n === null ? null : Math.round(n))

/* ---------- % KR = KA đã tick / tổng KA; chỉnh tay (có lý do) thì lấy số chỉnh (§15.4) ---------- */
export function krPercent(kr: { pct_override: number | null }, kas: { done: boolean; weight?: number | null }[], useWeights: boolean): number {
  if (kr.pct_override !== null && kr.pct_override !== undefined) return clamp(kr.pct_override)
  return average(kas.map((k) => ({ value: k.done ? 100 : 0, weight: k.weight })), useWeights) ?? 0
}

/* ---------- % O = trung bình các KR (ngày) / các O cấp dưới (tuần, tháng, năm) ---------- */
export interface Pct {
  /** Số chính, theo cài đặt "chỉ tính phần liên quan" */
  main: number | null
  /** Chỉ phần liên quan O */
  target: number | null
  /** Tất cả */
  total: number | null
}
export function rollup(children: { pct: number; linked: boolean; weight?: number | null }[], s: Pick<Settings, 'only_linked_pct' | 'weights_enabled'>): Pct {
  const total = average(children.map((c) => ({ value: c.pct, weight: c.weight })), s.weights_enabled)
  const target = average(children.filter((c) => c.linked).map((c) => ({ value: c.pct, weight: c.weight })), s.weights_enabled)
  return { main: round(s.only_linked_pct ? target : total), target: round(target), total: round(total) }
}

/* ---------- Quy tắc mức liên quan (§3) ---------- */
export const requiredLinked = (slots: number, pct: number) => Math.ceil((slots * pct) / 100 - 1e-9)

export interface LinkCheck {
  linked: number
  required: number
  ok: boolean
  message: string
}
export function dayLinkCheck(krs: { linked: boolean }[], s: Pick<Settings, 'day_min_linked_kr'>): LinkCheck {
  const linked = krs.filter((k) => k.linked).length
  const required = s.day_min_linked_kr
  if (linked < required) return { linked, required, ok: false, message: `Cần ít nhất ${required} KR liên quan trực tiếp tiêu điểm (đang có ${linked}).` }
  if (linked === 1 && krs.length > 1) return { linked, required, ok: true, message: 'Chỉ 1 KR liên quan tiêu điểm. Nên có từ 2 KR trở lên.' }
  return { linked, required, ok: true, message: '' }
}
/** Tuần: 7 ngày. Tháng: số tuần của tháng. Năm: 12 tháng. */
export function parentLinkCheck(linked: number, slots: number, label: string, s: Pick<Settings, 'link_pct'>): LinkCheck {
  const required = requiredLinked(slots, s.link_pct)
  const ok = linked >= required
  return { linked, required, ok, message: ok ? '' : `Mới ${linked}/${slots} ${label} liên quan, cần tối thiểu ${required} (${s.link_pct}%).` }
}

/* ---------- Tiêu chí kiểm tra & chặn "Chốt kế hoạch" (§4) ---------- */
export const SMART5: [string, string][] = [
  ['S', 'Tất cả đều hiểu'],
  ['M', 'Đo lường được'],
  ['A', 'Khả thi'],
  ['R', 'Quan trọng nhất'],
  ['T', 'Thời gian rõ ràng'],
]
export const O_CRITERIA: [string, string][] = [...SMART5, ['KRO', 'Các KR đạt thì O đạt?']]
export const ACTION_CRITERIA: [string, string][] = [...SMART5, ['NEXT', 'Đưa được vào OKR kỳ tới']]

export const missingKeys = (smart: Smart | undefined, keys: [string, string][]) => keys.filter(([k]) => !smart?.[k]).map(([k]) => k)
const keyName = (k: string) => (k === 'KRO' ? 'KR→O' : k === 'NEXT' ? 'Kỳ tới' : k)

const ACTION_VERBS = [
  'gọi', 'đăng ký', 'đọc', 'viết', 'làm', 'gửi', 'xem', 'thực hiện', 'học', 'chạy', 'tham gia', 'họp', 'liên hệ', 'nhắn',
  'soạn', 'tạo', 'kiểm tra', 'nghiên cứu', 'đi', 'mua', 'sửa', 'cài', 'lên', 'setup', 'research', 'check', 'call',
]
/** §4.4, §15.2: KR bắt đầu bằng động từ hành động → gợi ý viết lại thành kết quả đo được (không chặn). */
export function looksLikeAction(title: string) {
  const t = title.trim().toLowerCase()
  return ACTION_VERBS.some((v) => t === v || t.startsWith(v + ' '))
}

export interface LockCheck {
  blockers: string[]
  warnings: string[]
}
export function lockCheck(
  kind: 'day' | 'week' | 'month' | 'year',
  o: { o_title: string; o_smart: Smart; o_metric: string },
  krs: { title: string; smart: Smart; metric: string; kas: number }[],
  s: Pick<Settings, 'day_min_kr' | 'day_max_kr'>,
): LockCheck {
  const blockers: string[] = []
  const warnings: string[] = []
  if (!o.o_title.trim()) blockers.push('Chưa viết tiêu điểm (O).')
  const om = missingKeys(o.o_smart, O_CRITERIA)
  if (om.length) blockers.push(`Tiêu điểm còn thiếu tiêu chí: ${om.map(keyName).join(', ')}.`)
  if (o.o_smart?.M && !o.o_metric.trim()) warnings.push('Tiêu điểm tick M nhưng chưa có số đo.')
  if (kind === 'day' && krs.length < s.day_min_kr) blockers.push(`Cần ít nhất ${s.day_min_kr} KR (đang có ${krs.length}).`)
  if (kind === 'day' && krs.length > s.day_max_kr) warnings.push(`Nhiều hơn ${s.day_max_kr} KR, dễ dàn trải.`)
  krs.forEach((k, i) => {
    const n = `KR${i + 1}`
    if (!k.title.trim()) blockers.push(`${n} chưa có nội dung.`)
    const km = missingKeys(k.smart, SMART5)
    if (km.length) blockers.push(`${n} còn thiếu: ${km.join(', ')}.`)
    if (k.smart?.M && !k.metric.trim()) warnings.push(`${n}: tick M nhưng chưa có số đo.`)
    if (looksLikeAction(k.title)) warnings.push(`${n} viết như hành động. KR nên là kết quả đo được, hành động để ở KA.`)
    if (!k.kas) warnings.push(`${n} chưa có KA.`)
  })
  return { blockers, warnings }
}

/* ---------- Kaizen ---------- */
export function kaizenStarted(k: { journal?: { s?: string; c?: string; t?: string }; causes?: string; lessons?: { text: string }[]; assessment?: string } | undefined) {
  if (!k) return false
  return Boolean(k.journal?.s?.trim() || k.journal?.c?.trim() || k.journal?.t?.trim() || k.causes?.trim() || k.assessment?.trim() || k.lessons?.some((l) => l.text.trim()))
}
export const hasLessons = (k: { lessons?: { text: string }[] } | undefined) => Boolean(k?.lessons?.some((l) => l.text.trim()))

/** Chia chuỗi thành đoạn thường/đoạn trùng từ khoá đỏ (không phân biệt hoa thường). */
export function highlight(text: string, keywords: string[]): { text: string; hit: boolean }[] {
  const ks = keywords.map((k) => k.trim()).filter(Boolean).sort((a, b) => b.length - a.length)
  if (!ks.length || !text) return text ? [{ text, hit: false }] : []
  const esc = ks.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${esc.join('|')})`, 'giu')
  return text
    .split(re)
    .filter((x) => x !== '')
    .map((x) => ({ text: x, hit: ks.some((k) => k.toLowerCase() === x.toLowerCase()) }))
}

/** Từ khoá lặp lại nhiều nhất qua nhiều bản Kaizen (§6, §10.7). */
export function keywordStats(list: { keywords?: string[] }[]): { keyword: string; count: number }[] {
  const m = new Map<string, { keyword: string; count: number }>()
  for (const k of list)
    for (const w of new Set((k.keywords ?? []).map((x) => x.trim()).filter(Boolean))) {
      const key = w.toLowerCase()
      const cur = m.get(key)
      if (cur) cur.count++
      else m.set(key, { keyword: w, count: 1 })
    }
  return [...m.values()].sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
}

/* ---------- Kỷ luật (§17 D2) ---------- */

/** Kế hoạch ngày D khoá khi bấm Chốt, hoặc tự khoá lúc lock_time ngày D-1 (nếu bật). Mở khoá có lý do sau thời điểm khoá thì mở. */
export function effectiveLock(
  p: { kind: string; start_date: string; status: 'draft' | 'locked'; locked_at: string | null; unlocks: { at: string }[] },
  s: Pick<Settings, 'auto_lock' | 'lock_time'>,
  now: Date,
): { locked: boolean; deadline: Date | null; auto: boolean } {
  let deadline: Date | null = null
  if (p.kind === 'day') {
    const [h, m] = s.lock_time.split(':').map(Number)
    const [y, mo, d] = addDays(p.start_date, -1).split('-').map(Number)
    deadline = new Date(y, mo - 1, d, h, m)
  }
  const manual = p.status === 'locked' && p.locked_at ? new Date(p.locked_at) : null
  const auto = s.auto_lock && deadline && now >= deadline ? deadline : null
  const lockedAt = manual && auto ? (manual > auto ? manual : auto) : (manual ?? auto)
  if (!lockedAt) return { locked: false, deadline, auto: false }
  const reopened = p.unlocks.some((u) => new Date(u.at) > lockedAt)
  return { locked: !reopened, deadline, auto: !manual || lockedAt === auto }
}

export interface DayRecord {
  date: string
  hasO: boolean
  pct: number | null
  lessons: boolean
}
/**
 * Đỏ N ngày làm việc liền trước hôm nay (không có O hoặc % < ngưỡng đỏ) và ngày gần nhất chưa có Bài học
 * → khoá thêm KR/KA mới. Chỉ xét từ ngày đầu tiên có lập O.
 */
export function redStreak(todayIso: string, days: DayRecord[], s: Pick<Settings, 'red_lock' | 'red_streak' | 'red_below' | 'rest_weekdays'>): { locked: boolean; day?: string } {
  if (!s.red_lock || s.red_streak < 1) return { locked: false }
  const by = new Map(days.map((d) => [d.date, d]))
  const first = days.filter((d) => d.hasO).map((d) => d.date).sort()[0]
  if (!first) return { locked: false }
  const streak: string[] = []
  for (let d = addDays(todayIso, -1); d >= first && streak.length < s.red_streak; d = addDays(d, -1)) {
    if (s.rest_weekdays.includes(isoDow(d))) continue
    const r = by.get(d)
    const red = !r || !r.hasO || r.pct === null || r.pct < s.red_below
    if (!red) return { locked: false }
    streak.push(d)
  }
  if (streak.length < s.red_streak) return { locked: false }
  return by.get(streak[0])?.lessons ? { locked: false } : { locked: true, day: streak[0] }
}

/* ---------- Lịch giờ ---------- */
export function timeSlots(start: string, end: string, minutes: number): { from: string; to: string }[] {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const fmt = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
  const out: { from: string; to: string }[] = []
  for (let t = toMin(start); t + minutes <= toMin(end); t += minutes) out.push({ from: fmt(t), to: fmt(t + minutes) })
  return out
}
