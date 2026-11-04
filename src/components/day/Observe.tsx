import { useState } from 'react'
import type { ObsCategory, Observation } from '../../lib/types'
import { Txt } from '../ui'

export type ObsRows = {
  rows: Observation[]
  add: (r: Record<string, unknown>) => Promise<Observation | null>
  patch: (id: string, p: Partial<Observation>) => Promise<void>
  del: (id: string) => Promise<void>
}

export const CATS: { id: ObsCategory; label: string; hint: string }[] = [
  { id: 'work_finance', label: 'Công việc / Tài chính', hint: 'Vấn đề, tồn đọng, cơ hội trong công việc, thu nhập' },
  { id: 'relationship', label: 'Mối quan hệ', hint: 'Khách hàng, đối tác, đồng đội, mentor, gia đình' },
  { id: 'body_mind_wisdom', label: 'Thân – Tâm – Trí', hint: 'Sức khoẻ, cảm xúc, học tập' },
]

/** Ý chưa xử lý của kỳ trước (C13): Giữ = mang sang, Đóng = đã xong/bỏ. */
export function CarryOver({ prev, onKeep, onClose, label }: { prev: Observation[]; onKeep: (o: Observation) => void; onClose: (o: Observation) => void; label: string }) {
  if (!prev.length) return null
  return (
    <div className="carry-list">
      <div className="fld-l">Chưa xử lý từ {label}</div>
      {prev.map((o) => (
        <div key={o.id} className="carry-row">
          <span className="cat">{CATS.find((c) => c.id === o.category)?.label}</span>
          <span className="ct">
            {o.content}
            {o.consequence && <small> · nếu không làm: {o.consequence}</small>}
          </span>
          <button className="btn" onClick={() => onKeep(o)}>
            Giữ
          </button>
          <button className="btn ghost" onClick={() => onClose(o)}>
            Đã xong / bỏ
          </button>
        </div>
      ))}
    </div>
  )
}

/** 1b. Quan sát: 3 mảng, mỗi ý bắt buộc trả lời "Nếu không làm thì sao?". */
export function Observe({ periodId, obs, editable }: { periodId: string; obs: ObsRows; editable: boolean }) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const addOne = async (c: ObsCategory, n: number) => {
    const t = (draft[c] ?? '').trim()
    if (!t) return
    await obs.add({ period_id: periodId, category: c, content: t, sort: n })
    setDraft({ ...draft, [c]: '' })
  }
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
                  {o.carried_from && <span className="tag kz">từ kỳ trước</span>}
                  {editable && (
                    <button className="x" aria-label="Xoá" onClick={() => obs.del(o.id)}>
                      ×
                    </button>
                  )}
                </div>
                <Txt className={o.consequence.trim() ? '' : 'need'} value={o.consequence} onSave={(v) => obs.patch(o.id, { consequence: v })} disabled={!editable} placeholder="Nếu không làm thì sao? (bắt buộc)" />
                {!o.consequence.trim() && <span className="flag">Chưa ghi hệ quả: chưa lọc được việc này có đáng làm không.</span>}
              </div>
            ))}
            {editable && (
              <div className="addrow">
                <input
                  value={draft[c.id] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addOne(c.id, items.length)}
                  placeholder={c.hint}
                  aria-label={`Thêm quan sát ${c.label}`}
                />
                <button className="btn" disabled={!(draft[c.id] ?? '').trim()} onClick={() => addOne(c.id, items.length)}>
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

/** 2. Phân tích: tô đậm việc đủ nhân duyên giải quyết trong kỳ, nhóm theo 3 mảng. */
export function Analyze({ obs, editable }: { obs: ObsRows; editable: boolean }) {
  return (
    <div className="grid3">
      {CATS.map((c) => {
        const items = obs.rows.filter((o) => o.category === c.id && o.content.trim())
        return (
          <div key={c.id} className="obs-col">
            <div className="col-h">{c.label}</div>
            {!items.length && <span className="note">Không có ý</span>}
            {items.map((o) => (
              <label key={o.id} className={'li pick ' + (o.is_selected ? 'hl' : '')}>
                <input type="checkbox" checked={o.is_selected} disabled={!editable} onChange={() => obs.patch(o.id, { is_selected: !o.is_selected })} />
                <span>{o.content}</span>
              </label>
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** 3. Nguyên nhân lõi: Tham – Sân – Si cho từng việc tô đậm, nhóm theo 3 mảng. */
export function RootCauses({ obs, editable }: { obs: ObsRows; editable: boolean }) {
  return (
    <div className="causes">
      <p className="note">Dừng hỏi "vì sao" khi tới nguyên nhân mình có thể thay đổi bằng 1 hành động cụ thể.</p>
      {CATS.map((c) => {
        const sel = obs.rows.filter((o) => o.is_selected && o.category === c.id)
        if (!sel.length) return null
        return (
          <div key={c.id} className="cause-group">
            <div className="col-h">{c.label}</div>
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
      })}
    </div>
  )
}
