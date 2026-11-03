import { useState } from 'react'
import type { ObsCategory, Observation } from '../../lib/types'
import { Txt } from '../ui'

export type ObsRows = {
  rows: Observation[]
  add: (r: Record<string, unknown>) => Promise<Observation | null>
  patch: (id: string, p: Partial<Observation>) => Promise<void>
  del: (id: string) => Promise<void>
}

const CATS: { id: ObsCategory; label: string; hint: string }[] = [
  { id: 'work_finance', label: 'Công việc / Tài chính', hint: 'Vấn đề, tồn đọng, cơ hội trong công việc, thu nhập' },
  { id: 'relationship', label: 'Mối quan hệ', hint: 'Khách hàng, đối tác, đồng đội, mentor, gia đình' },
  { id: 'body_mind_wisdom', label: 'Thân – Tâm – Trí', hint: 'Sức khoẻ, cảm xúc, học tập' },
]

/** Bước 2 · 1b. Quan sát: 3 mảng, mỗi ý bắt buộc trả lời "Nếu không làm thì sao?". */
export function Observe({ periodId, obs, editable }: { periodId: string; obs: ObsRows; editable: boolean }) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  return (
    <div className="grid3">
      {CATS.map((c) => {
        const items = obs.rows.filter((o) => o.category === c.id)
        return (
          <div key={c.id} className="obs-col">
            <div className="col-h" title={c.hint}>
              {c.label}
            </div>
            {items.map((o) => (
              <div key={o.id} className={'obs ' + (o.is_selected ? 'hl' : '')}>
                <div className="li">
                  <Txt value={o.content} onSave={(v) => obs.patch(o.id, { content: v })} disabled={!editable} placeholder="Vấn đề, nỗi đau, tồn đọng, cơ hội" />
                  {editable && (
                    <button className="x" aria-label="Xoá" onClick={() => obs.del(o.id)}>
                      ×
                    </button>
                  )}
                </div>
                <Txt
                  className={o.consequence.trim() ? '' : 'need'}
                  value={o.consequence}
                  onSave={(v) => obs.patch(o.id, { consequence: v })}
                  disabled={!editable}
                  placeholder="Nếu không làm thì sao? (bắt buộc)"
                />
                {!o.consequence.trim() && <span className="flag">Chưa ghi hệ quả: chưa lọc được việc này có đáng làm không.</span>}
              </div>
            ))}
            {editable && (
              <div className="addrow">
                <input
                  value={draft[c.id] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value })}
                  onKeyDown={async (e) => {
                    if (e.key !== 'Enter' || !(draft[c.id] ?? '').trim()) return
                    await obs.add({ period_id: periodId, category: c.id, content: draft[c.id].trim(), sort: items.length })
                    setDraft({ ...draft, [c.id]: '' })
                  }}
                  placeholder={c.hint}
                  aria-label={`Thêm quan sát ${c.label}`}
                />
                <button
                  className="btn"
                  disabled={!(draft[c.id] ?? '').trim()}
                  onClick={async () => {
                    await obs.add({ period_id: periodId, category: c.id, content: draft[c.id].trim(), sort: items.length })
                    setDraft({ ...draft, [c.id]: '' })
                  }}
                >
                  Thêm
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Bước 3 · 2. Phân tích: tô đậm việc đủ nhân duyên giải quyết ngay trong kỳ. */
export function Analyze({ obs, editable }: { obs: ObsRows; editable: boolean }) {
  const items = obs.rows.filter((o) => o.content.trim())
  return (
    <div className="list">
      {items.map((o) => (
        <label key={o.id} className={'li pick ' + (o.is_selected ? 'hl' : '')}>
          <input type="checkbox" checked={o.is_selected} disabled={!editable} onChange={() => obs.patch(o.id, { is_selected: !o.is_selected })} />
          <span>
            {o.content}
            {o.consequence && <small> · nếu không làm: {o.consequence}</small>}
          </span>
        </label>
      ))}
    </div>
  )
}

/** Bước 4 · 3. Nguyên nhân lỗi: Tham – Sân – Si cho từng việc đã tô đậm. */
export function RootCauses({ obs, editable }: { obs: ObsRows; editable: boolean }) {
  const sel = obs.rows.filter((o) => o.is_selected)
  return (
    <div className="causes">
      <p className="note">Dừng hỏi "vì sao" khi tới nguyên nhân mình có thể thay đổi bằng 1 hành động cụ thể.</p>
      {sel.map((o) => (
        <div key={o.id} className="cause">
          <div className="cause-h">{o.content}</div>
          <div className="grid3">
            <label className="fld">
              <span>Tham</span>
              <Txt value={o.tham} onSave={(v) => obs.patch(o.id, { tham: v })} disabled={!editable} placeholder="Mong cầu, ôm đồm…" />
            </label>
            <label className="fld">
              <span>Sân</span>
              <Txt value={o.san} onSave={(v) => obs.patch(o.id, { san: v })} disabled={!editable} placeholder="Bực bội, đổ lỗi, chống đối…" />
            </label>
            <label className="fld">
              <span>Si</span>
              <Txt value={o.si} onSave={(v) => obs.patch(o.id, { si: v })} disabled={!editable} placeholder="Chưa biết cách, chưa thấy rõ…" />
            </label>
          </div>
          <Txt value={o.cause_note} onSave={(v) => obs.patch(o.id, { cause_note: v })} disabled={!editable} placeholder="Ghi chú thêm (tuỳ chọn)" />
          <label className="li check-q">
            <input type="checkbox" checked={o.resolve_check} disabled={!editable} onChange={() => obs.patch(o.id, { resolve_check: !o.resolve_check })} />
            Nếu giải quyết nguyên nhân này, vấn đề có hết không? <b>Có</b>
          </label>
        </div>
      ))}
    </div>
  )
}
