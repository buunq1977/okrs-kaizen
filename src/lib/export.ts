/** Xuất Excel từng kỳ (§13). Thư viện tải khi bấm nút để không làm nặng trang. */
import { listIn, objectivesOf } from './db'
import { krEntries } from './long'
import type { KA, KR, NextAction, Observation, Period } from './types'

const AREA = { cv_tc: 'Công việc/Tài chính', mqh: 'Mối quan hệ', ttt: 'Thân–Tâm–Trí' } as Record<string, string>
const CAT = { work_finance: 'Công việc/Tài chính', relationship: 'Mối quan hệ', body_mind_wisdom: 'Thân–Tâm–Trí' } as Record<string, string>

export async function exportPeriodXlsx(p: Period, title: string) {
  const XLSX = await import('xlsx')
  const [objs, krs, obs, acts] = await Promise.all([
    objectivesOf([p.id]),
    listIn<KR>('key_results', 'period_id', [p.id]),
    listIn<Observation>('observations', 'period_id', [p.id]),
    listIn<NextAction>('next_actions', 'period_id', [p.id]),
  ])
  const kas = await listIn<KA>('key_actions', 'kr_id', krs.map((k) => k.id))
  const ent = await krEntries(krs)

  const okr: (string | number | null)[][] = [[title], [], ['Mảng', 'Tiêu điểm O', 'KR', 'Từ', 'Đến', 'Đơn vị', 'Hạn', 'Nguồn', 'Thực tế', 'KA', 'Xong']]
  for (const o of objs) {
    const ks = krs.filter((k) => k.objective_id === o.id)
    if (!ks.length) okr.push([AREA[o.area ?? ''] ?? '', o.title])
    for (const k of ks) {
      const actual = k.baseline != null ? k.baseline + (ent.get(k.id) ?? []).reduce((a, e) => a + e.value, 0) : null
      const ka = kas.filter((a) => a.kr_id === k.id)
      const base = [AREA[o.area ?? ''] ?? '', o.title, k.title, k.baseline ?? null, k.target ?? null, k.unit ?? '', k.deadline ?? '', k.source ?? '', actual]
      if (!ka.length) okr.push(base)
      ka.forEach((a, i) => okr.push([...(i === 0 ? base : ['', '', '', null, null, '', '', '', null]), a.title, a.done ? '✓' : '']))
    }
  }
  const ob: (string | number)[][] = [['Mảng', 'Quan sát', 'Nếu không làm thì sao?', 'Tô đậm', 'Tham', 'Sân', 'Si']]
  for (const x of obs) ob.push([CAT[x.category], x.content, x.consequence, x.is_selected ? '✓' : '', x.tham, x.san, x.si])

  const k = p.kaizen ?? {}
  const kz: (string | number)[][] = [['Kaizen', title], [], ['Đánh giá', k.assessment ?? '']]
  if (k.journal?.length) {
    kz.push([], ['Nhật ký', 'Giờ/Ngày', 'Đã làm gì', 'Kết quả'])
    for (const r of k.journal) kz.push(['', r.time, r.did, r.result])
  }
  if (k.causes) kz.push([], ['Nguyên nhân', k.causes])
  if (k.keywords?.length) kz.push(['Từ khoá đỏ', k.keywords.join(', ')])
  for (const l of k.lessons ?? []) kz.push(['Bài học', l.text, l.keyword, l.signal])
  for (const l of k.num_lessons ?? []) kz.push(['Bài học (số)', l.text, l.number])
  for (const a of acts) kz.push(['Hành động', a.text, a.converted_period_id ? 'đã chuyển kỳ tới' : ''])
  for (const [id, d] of Object.entries(k.diagnoses ?? {})) kz.push(['Chẩn đoán', krs.find((x) => x.id === id)?.title ?? '', `nhóm (${d.group})`, d.evidence])
  for (const [id, d] of Object.entries(k.decisions ?? {})) kz.push(['Quyết định', krs.find((x) => x.id === id)?.title ?? '', d.decision, d.reason])

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(okr), 'OKR')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ob), 'Quan sát')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kz), 'Kaizen')
  XLSX.writeFile(wb, `okrs-kaizen-${p.kind}-${p.start_date}.xlsx`)
}
