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

/* ---------- % thực thi O = trung bình % các KR (Ngày/Tuần, §10.1) ---------- */
export function execPercent(children: { pct: number; weight?: number | null }[], useWeights: boolean): number | null {
  return round(average(children.map((c) => ({ value: c.pct, weight: c.weight })), useWeights))
}

/* ---------- % O thực tế (C3, §6 bước 1) ---------- */
const RESULT_PCT = { dat: 100, mot_phan: 50, chua: 0 } as const
export function oActualPercent(o: { o_target: number | null; o_actual: number | null; o_result: 'dat' | 'mot_phan' | 'chua' | null }): number | null {
  if (o.o_target !== null && o.o_target > 0 && o.o_actual !== null) return Math.round(clamp((o.o_actual / o.o_target) * 100))
  if (o.o_result) return RESULT_PCT[o.o_result]
  return null
}
/** Số dùng cho màu và chuỗi đỏ: O thực tế nếu đã nhập, chưa thì % thực thi. */
export const dayScore = (exec: number | null, actual: number | null) => (actual ?? exec)
/** Lệch lớn giữa % thực thi và % O thực tế → gợi ý "KR chọn chưa trúng O". */
export function gapSuggest(exec: number | null, actual: number | null, pts: number): boolean {
  return exec !== null && actual !== null && Math.abs(exec - actual) >= pts
}
export const GAP_KEYWORD = 'KR chọn chưa trúng O'

/* ---------- Giờ nhắc & tab mở sẵn (C19, C20) ---------- */
const toMin = (t: string) => {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
const fmtHM = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
export function remindTime(lockTime: string, leadMin: number) {
  return fmtHM((((toMin(lockTime) - leadMin) % 1440) + 1440) % 1440)
}
export function defaultTab(date: string, todayIso: string, now: Date, s: Pick<Settings, 'lock_time' | 'remind_lead_min' | 'default_tab'>): 'okr' | 'kaizen' {
  if (s.default_tab !== 'auto') return s.default_tab
  if (date > todayIso) return 'okr'
  if (date < todayIso) return 'kaizen'
  return now.getHours() * 60 + now.getMinutes() >= toMin(remindTime(s.lock_time, s.remind_lead_min)) ? 'kaizen' : 'okr'
}

/* ---------- Tải lịch cố định trong ngày (gợi ý cho chữ A) ---------- */
export function scheduleLoad(entries: { time_from: string | null; time_to: string | null; fixed: boolean }[], dayStart: string, dayEnd: string): number {
  const total = toMin(dayEnd) - toMin(dayStart)
  if (total <= 0) return 0
  const used = entries.filter((e) => e.fixed && e.time_from && e.time_to).reduce((a, e) => a + Math.max(0, toMin(e.time_to!) - toMin(e.time_from!)), 0)
  return Math.round((used / total) * 100)
}

/* ---------- Nút "Kiểm tra tiêu điểm" (C14, §4.1) ---------- */
export interface CheckItem {
  key: string
  ok: boolean | null // null = người dùng tự xác nhận
  note: string
}
export function focusAutoChecks(o: { title: string; o_metric: string; o_target: number | null }, krCount: number, minKr: number, loadPct: number): Record<string, CheckItem> {
  return {
    S: { key: 'S', ok: o.title.trim().length >= 8 ? null : false, note: o.title.trim().length >= 8 ? '' : 'Tiêu điểm quá ngắn để người khác hiểu.' },
    M: { key: 'M', ok: o.o_metric.trim() || o.o_target !== null ? true : false, note: o.o_metric.trim() || o.o_target !== null ? '' : 'Chưa có số đo O. Ghi con số hoặc dấu hiệu đo được.' },
    A: { key: 'A', ok: loadPct > 80 ? false : null, note: loadPct > 80 ? `Lịch cố định đã chiếm ${loadPct}% ngày. Kiểm tra lại quỹ thời gian.` : '' },
    R: { key: 'R', ok: null, note: '' },
    T: { key: 'T', ok: null, note: '' },
    KRO: { key: 'KRO', ok: krCount >= minKr ? null : false, note: krCount >= minKr ? '' : `Cần ít nhất ${minKr} KR mới đánh giá được.` },
  }
}

/* ---------- Tuần (§3.1, §7) ---------- */
/** KA tuần cần tự tick: có O ngày phục vụ đạt ngưỡng đạt; bỏ qua KA đã tick hoặc đã từng tự tick (người dùng bỏ tick tay thì tôn trọng). */
export function autoTickIds(
  kas: { id: string; done: boolean; auto_ticked: boolean }[],
  days: { serves_ka_id: string | null; score: number | null }[],
  pass: number,
  enabled: boolean,
): string[] {
  if (!enabled) return []
  const hit = new Set(days.filter((d) => d.serves_ka_id && d.score !== null && d.score >= pass).map((d) => d.serves_ka_id!))
  return kas.filter((k) => !k.done && !k.auto_ticked && hit.has(k.id)).map((k) => k.id)
}
/** Mức tập trung: số ngày có O phục vụ một KR/KA của tuần (chỉ là thông tin, C2). */
export function focusLevel(days: { serves_kr_id: string | null; serves_ka_id: string | null }[], krIds: string[], kaIds: string[]): number {
  const kr = new Set(krIds)
  const ka = new Set(kaIds)
  return days.filter((d) => (d.serves_kr_id && kr.has(d.serves_kr_id)) || (d.serves_ka_id && ka.has(d.serves_ka_id))).length
}
/** Tab mở sẵn trang Tuần: tuần đã qua hoặc Chủ nhật của tuần hiện tại → Kaizen. */
export function weekDefaultTab(weekStart: string, todayIso: string, mode: 'auto' | 'okr' | 'kaizen'): 'okr' | 'kaizen' {
  if (mode !== 'auto') return mode
  const end = addDays(weekStart, 6)
  if (end < todayIso) return 'kaizen'
  if (weekStart <= todayIso && todayIso <= end && isoDow(todayIso) === 7) return 'kaizen'
  return 'okr'
}
/** Buổi trong ngày cho lưới tuần: Sáng < 12:00 ≤ Chiều < 18:00 ≤ Tối. */
export const bucketOf = (time: string | null): 's' | 'c' | 't' | 'u' => (!time ? 'u' : time < '12:00' ? 's' : time < '18:00' ? 'c' : 't')

/* ---------- Mang sang quan sát chưa xử lý (C13) ---------- */
export function carryCandidates<T extends { id: string; closed: boolean; content: string }>(prev: T[], today: { carried_from: string | null }[]): T[] {
  const taken = new Set(today.map((x) => x.carried_from).filter(Boolean))
  return prev.filter((o) => !o.closed && o.content.trim() && !taken.has(o.id))
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
  kind: 'day' | 'week',
  o: { title: string; smart: Smart; o_metric: string; o_target: number | null },
  krs: { title: string; smart: Smart; metric: string; kas: number }[],
  s: Pick<Settings, 'day_min_kr' | 'day_max_kr'>,
): LockCheck {
  const blockers: string[] = []
  const warnings: string[] = []
  if (!o.title.trim()) blockers.push('Chưa viết tiêu điểm (O).')
  const om = missingKeys(o.smart, O_CRITERIA)
  if (om.length) blockers.push(`Tiêu điểm còn thiếu tiêu chí: ${om.map(keyName).join(', ')}.`)
  if (o.smart?.M && !o.o_metric.trim() && o.o_target === null) warnings.push('Tiêu điểm tick M nhưng chưa có số đo.')
  if (krs.length < s.day_min_kr) blockers.push(`Cần ít nhất ${s.day_min_kr} KR ${kind === "day" ? "ngày" : "tuần"} (đang có ${krs.length}).`)
  if (krs.length > s.day_max_kr) warnings.push(`Nhiều hơn ${s.day_max_kr} KR, dễ dàn trải.`)
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
export function kaizenStarted(k: { journal?: { did: string; result: string }[] | unknown; causes?: string; lessons?: { text: string }[]; assessment?: string } | undefined) {
  if (!k) return false
  const rows = Array.isArray(k.journal) ? (k.journal as { did: string; result: string }[]) : []
  return Boolean(rows.some((r) => r.result?.trim() || r.did?.trim()) || k.causes?.trim() || k.assessment?.trim() || k.lessons?.some((l) => l.text.trim()))
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
