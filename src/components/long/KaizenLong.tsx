import { fmtDM } from '../../lib/dates'
import { AREA_NAME, type LongSum } from '../../lib/long'
import { fmtNum } from '../../lib/pace'
import type { Decision, KaizenData, KR, PlanChange } from '../../lib/types'
import { Step, Txt } from '../ui'
import { CAUSES } from './ChangeDialog'
import { StatusPill } from './NumericKr'

const DECISIONS: [Decision['decision'], string][] = [
  ['keep', 'Giữ'],
  ['increase', 'Tăng nỗ lực'],
  ['cut', 'Cắt phạm vi'],
  ['change', 'Đổi cách làm'],
  ['stop', 'Dừng'],
]
const TYPE_VI: Record<PlanChange['type'], string> = { add: 'Thêm', raise: 'Nâng', method: 'Đổi cách làm', lower: 'Hạ', cut: 'Cắt', stop: 'Dừng', pause: 'Tạm dừng' }
const uid = () => Math.random().toString(36).slice(2, 10)

/** Kaizen số liệu 5 bước cho Tháng/Quý/Năm (§11). */
export function KaizenLong(props: {
  sum: LongSum
  k: KaizenData
  save: (k: Partial<KaizenData>) => void
  changes: PlanChange[]
  onAdjust: (kr: KR) => void
  onCancelChange: (c: PlanChange) => void
  adjustNote: string
}) {
  const { sum, k, save, changes, onAdjust, onCancelChange, adjustNote } = props
  const rows = sum.objs.flatMap((o) => o.krs.map((x) => ({ ...x, area: o.o.area! })))
  const bad = rows.filter((r) => r.st.color === 'red' || r.st.color === 'yellow')
  const diag = k.diagnoses ?? {}
  const dec = k.decisions ?? {}
  const lessons = k.num_lessons ?? []

  return (
    <div className="kaizen">
      <Step n="1" title="Số liệu" hint="Lấy tự động: kế hoạch cộng dồn, thực tế, chênh lệch, tình trạng của từng KR." open done={rows.length > 0}>
        <div className="tbl">
          <table className="ktable">
            <thead>
              <tr>
                <th>Mảng</th>
                <th>KR</th>
                <th>Kế hoạch đến nay</th>
                <th>Thực tế</th>
                <th>Chênh lệch</th>
                <th>Đích</th>
                <th>Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ kr, st, area }) => {
                const planned = kr.baseline != null ? kr.baseline + st.plannedGain : null
                const gap = planned !== null && st.actual !== null ? st.actual - planned : null
                return (
                  <tr key={kr.id}>
                    <td>{AREA_NAME[area as keyof typeof AREA_NAME]}</td>
                    <td>{kr.title}</td>
                    <td className="n">{planned === null ? '–' : fmtNum(Math.round(planned * 10) / 10)}</td>
                    <td className="n">{st.actual === null ? '–' : fmtNum(st.actual)}</td>
                    <td className={'n ' + (gap !== null && gap < 0 ? 'neg' : '')}>{gap === null ? '–' : (gap > 0 ? '+' : '') + fmtNum(Math.round(gap * 10) / 10)}</td>
                    <td className="n">
                      {kr.target ?? '–'} {kr.unit}
                    </td>
                    <td>
                      <StatusPill v={st.status} color={st.color} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Step>

      <Step n="2" title="Chẩn đoán" hint="Mỗi KR vàng/đỏ: chọn 1 trong 4 nhóm nguyên nhân và dùng số liệu chứng minh." open done={bad.every((r) => diag[r.kr.id]?.evidence?.trim())}>
        {!bad.length && <p className="note">Không có KR vàng/đỏ.</p>}
        {bad.map(({ kr, st }) => {
          const d = diag[kr.id]
          const lead = (kr.leading_ind ?? []).map((l) => {
            const vals = Object.values(l.actuals ?? {})
            const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
            return `${l.name}: TB ${avg === null ? '–' : fmtNum(Math.round(avg))}/tuần so với ${l.per_week ?? '–'}`
          })
          return (
            <div key={kr.id} className="diag">
              <div className="diag-h">
                {kr.title} <StatusPill v={st.status} color={st.color} />
              </div>
              {lead.length > 0 && <p className="note">Dẫn trước: {lead.join(' · ')}</p>}
              <div className="seg3">
                {CAUSES.map((c) => (
                  <button key={c.id} className="chip" aria-pressed={d?.group === c.id} title={c.sign} onClick={() => save({ diagnoses: { ...diag, [kr.id]: { group: c.id, evidence: d?.evidence ?? '' } } })}>
                    {c.label}
                  </button>
                ))}
              </div>
              <Txt
                value={d?.evidence}
                onSave={(v) => save({ diagnoses: { ...diag, [kr.id]: { group: d?.group ?? 'a', evidence: v } } })}
                placeholder={d ? CAUSES.find((c) => c.id === d.group)?.sign : 'Số liệu chứng minh'}
                label="Số liệu chứng minh"
              />
            </div>
          )
        })}
      </Step>

      <Step n="3" title="Quyết định" hint="Mỗi KR chọn đúng 1: Giữ · Tăng nỗ lực · Cắt phạm vi · Đổi cách làm · Dừng." open done={rows.every((r) => dec[r.kr.id])}>
        {rows.map(({ kr }) => {
          const d = dec[kr.id]
          const group = diag[kr.id]?.group
          return (
            <div key={kr.id} className="decide">
              <div className="diag-h">{kr.title}</div>
              <div className="seg3">
                {DECISIONS.map(([v, l]) => (
                  <button
                    key={v}
                    className="chip"
                    aria-pressed={d?.decision === v}
                    disabled={group === 'a' && (v === 'cut' || v === 'stop')}
                    title={group === 'a' && (v === 'cut' || v === 'stop') ? 'Nhóm (a) làm chưa đủ: không được hạ mục tiêu' : ''}
                    onClick={() => save({ decisions: { ...dec, [kr.id]: { decision: v, reason: d?.reason ?? '', at: new Date().toISOString() } } })}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {d && <Txt value={d.reason} onSave={(v) => save({ decisions: { ...dec, [kr.id]: { ...d, reason: v } } })} placeholder="Vì sao quyết định vậy?" label="Lý do quyết định" />}
              {d && (d.decision === 'cut' || d.decision === 'stop' || d.decision === 'change') && (
                <button className="btn" onClick={() => onAdjust(kr)}>
                  Tạo điều chỉnh cho KR này
                </button>
              )}
            </div>
          )
        })}
      </Step>

      <Step n="4" title="Bài học" hint="Tối đa 3 câu, mỗi câu kèm 1 con số chứng minh." open done={lessons.some((l) => l.text.trim() && l.number.trim())}>
        {lessons.map((l) => (
          <div key={l.id} className="lead-r">
            <Txt className="strong" value={l.text} onSave={(v) => save({ num_lessons: lessons.map((x) => (x.id === l.id ? { ...x, text: v } : x)) })} placeholder="Bài học" label="Bài học" />
            <Txt className={l.number.trim() ? '' : 'need'} value={l.number} onSave={(v) => save({ num_lessons: lessons.map((x) => (x.id === l.id ? { ...x, number: v } : x)) })} placeholder="Con số chứng minh" label="Con số" />
            <button className="x" aria-label="Xoá bài học" onClick={() => save({ num_lessons: lessons.filter((x) => x.id !== l.id) })}>
              ×
            </button>
          </div>
        ))}
        {lessons.length < 3 && (
          <button className="add" onClick={() => save({ num_lessons: [...lessons, { id: uid(), text: '', number: '' }] })}>
            + Bài học ({lessons.length}/3)
          </button>
        )}
      </Step>

      <Step n="5" title="Điều chỉnh" hint={adjustNote} open done={changes.length > 0}>
        {rows.length > 0 && (
          <div className="seg3">
            {rows.map(({ kr }) => (
              <button key={kr.id} className="btn" onClick={() => onAdjust(kr)}>
                Điều chỉnh: {kr.title || 'KR'}
              </button>
            ))}
          </div>
        )}
        <div className="fld-l">Lịch sử phiên bản</div>
        {!changes.length && <p className="note">Chưa có điều chỉnh. Đang dùng bản gốc.</p>}
        <ul className="log">
          {changes.map((c) => {
            const kr = rows.find((r) => r.kr.id === c.kr_id)?.kr
            return (
              <li key={c.id} className={c.status}>
                <b>{TYPE_VI[c.type]}</b> {kr?.title ?? ''} · {fmtDM(c.created_at.slice(0, 10))} · {c.reason}
                {c.cause_group && ` · nhóm (${c.cause_group})`}
                {c.evidence && ` · ${c.evidence}`}
                {c.mentor && ` · mentor ${c.mentor}`}
                {c.status === 'pending' && (
                  <>
                    {' '}
                    · <em>chờ áp dụng {c.apply_at ? new Date(c.apply_at).toLocaleString('vi-VN') : ''}</em>{' '}
                    <button className="linkbtn" onClick={() => onCancelChange(c)}>
                      Huỷ đề xuất
                    </button>
                  </>
                )}
                {c.status === 'cancelled' && ' · đã huỷ'}
              </li>
            )
          })}
        </ul>
      </Step>
    </div>
  )
}
