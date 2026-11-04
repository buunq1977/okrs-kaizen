import { useState } from 'react'
import { SMART5 } from '../../lib/okr'
import type { Validation } from '../../lib/types'
import { Criteria, Txt } from '../ui'

type Rows = {
  rows: Validation[]
  add: (r: Record<string, unknown>) => Promise<Validation | null>
  patch: (id: string, p: Partial<Validation>) => Promise<void>
  del: (id: string) => Promise<void>
}

const GROUPS: { id: Validation['direction']; title: string; hint: string; ph: string }[] = [
  { id: 'top_down', title: 'Kiểm chứng trên xuống', hint: 'Người chịu ảnh hưởng bởi mục tiêu của bạn', ph: 'VD: đồng đội trong nhóm gọi' },
  { id: 'cross', title: 'Kiểm chứng chéo', hint: 'Phòng ban / người khác bị ảnh hưởng', ph: 'VD: bộ phận chăm sóc khách hàng' },
  { id: 'bottom_up', title: 'Kiểm chứng dưới lên', hint: 'Sếp, Thầy, Mentor: xin duyệt hướng đi', ph: 'VD: Mentor X3' },
]

/** Kiểm chứng 3 chiều (§12): làm sau khi viết O và KR, trước khi bắt tay làm. */
export function Verify({ periodId, v, editable }: { periodId: string; v: Rows; editable: boolean }) {
  const [draft, setDraft] = useState<Record<string, string>>({})
  const asked = v.rows.filter((r) => r.asked).length
  return (
    <div className="verify">
      <p className="note">
        Đã hỏi ý kiến {asked}/{v.rows.length} người. Kiểm chứng giúp O đạt được khi việc liên quan tới người khác.
      </p>
      {GROUPS.map((g) => {
        const list = v.rows.filter((r) => r.direction === g.id)
        const add = async () => {
          const t = (draft[g.id] ?? '').trim()
          if (!t) return
          await v.add({ period_id: periodId, direction: g.id, person: t, sort: list.length })
          setDraft({ ...draft, [g.id]: '' })
        }
        return (
          <div key={g.id} className="vgroup">
            <div className="vtitle">
              {g.title} <span>· {g.hint}</span>
            </div>
            {list.map((r) => (
              <div key={r.id} className="vrow2">
                <label className="li">
                  <input type="checkbox" checked={r.asked} onChange={() => v.patch(r.id, { asked: !r.asked })} aria-label="Đã hỏi ý kiến" />
                  <Txt className="strong" value={r.person} onSave={(x) => x.trim() && v.patch(r.id, { person: x.trim() })} disabled={!editable} label="Người kiểm chứng" />
                </label>
                <Txt value={r.note} onSave={(x) => v.patch(r.id, { note: x })} placeholder="Họ nhận xét gì? Đồng ý, góp ý, điều kiện" label="Ghi chú" />
                <Criteria keys={SMART5} value={r.smart} onChange={(x) => v.patch(r.id, { smart: x })} />
                {editable && (
                  <button className="x" aria-label="Xoá" onClick={() => v.del(r.id)}>
                    ×
                  </button>
                )}
              </div>
            ))}
            {editable && (
              <div className="addrow">
                <input value={draft[g.id] ?? ''} onChange={(e) => setDraft({ ...draft, [g.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder={g.ph} aria-label={`Thêm người: ${g.title}`} />
                <button className="btn" disabled={!(draft[g.id] ?? '').trim()} onClick={add}>
                  Thêm người
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
