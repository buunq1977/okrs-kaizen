import { useState } from 'react'
import { useApp } from '../lib/ctx'
import { errMsg, insert, remove, update } from '../lib/db'
import { fmtNum } from '../lib/pace'
import type { KR, Metric } from '../lib/types'
import { PaceBar, SmartChips, Txt, toNum } from './ui'

/** Danh sách KR của một mục tiêu trong một kỳ (tháng hoặc tuần), kèm form thêm. */
export function KrEditor(props: {
  periodId: string
  goalId: string
  parent?: KR
  krs: KR[]
  metrics: Metric[]
  actuals: Map<string, number>
  frac: number
  hint?: string
  onChange: () => void
}) {
  const { periodId, goalId, parent, krs, metrics, actuals, frac, hint, onChange } = props
  const { toast } = useApp()
  const leading = metrics.filter((m) => m.kind === 'leading')
  const defMetric = parent?.metric_id ?? leading[0]?.id ?? ''
  const unitOf = (mid: string) => metrics.find((m) => m.id === mid)?.unit ?? parent?.unit ?? ''
  const [f, setF] = useState({ title: '', target: '', metric: defMetric, unit: unitOf(defMetric) })

  const save = async (k: KR, part: Partial<KR>) => {
    try {
      await update('krs', k.id, part)
      onChange()
    } catch (e) {
      toast(errMsg(e))
    }
  }
  const ok = f.title.trim() && (toNum(f.target) ?? 0) > 0 && f.unit.trim()

  return (
    <div className="kr-ed">
      {krs.map((k) => (
        <div key={k.id} className="kr">
          <div className="kr-h">
            <Txt className="strong" value={k.title} onSave={(x) => x.trim() && save(k, { title: x.trim() })} label="Tên KR" />
            <Txt className="num" type="number" value={String(k.target)} onSave={(x) => (toNum(x) ?? 0) > 0 && save(k, { target: toNum(x)! })} label="Con số KR" />
            <span className="unit">{k.unit}</span>
            <button
              className="x"
              aria-label="Xoá KR"
              onClick={async () => {
                try {
                  await remove('krs', k.id)
                  onChange()
                } catch (e) {
                  toast(errMsg(e))
                }
              }}
            >
              ×
            </button>
          </div>
          <PaceBar actual={actuals.get(k.id) ?? 0} target={k.target} frac={frac} unit={k.unit} />
          <SmartChips value={k.smart ?? {}} onChange={(s) => save(k, { smart: s })} />
        </div>
      ))}
      <div className="addrow kr-add">
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={parent ? `KR tuần cho “${parent.title}”` : 'KR tháng, VD: Launch 8 campaign mới'} aria-label="KR mới" />
        <input className="num" inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="Số" aria-label="Con số KR" />
        {!parent && metrics.length > 0 ? (
          <select value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value, unit: unitOf(e.target.value) })} aria-label="Chỉ số">
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.unit})
              </option>
            ))}
          </select>
        ) : (
          <input className="short" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="Đơn vị" aria-label="Đơn vị" />
        )}
        <button
          className="btn"
          disabled={!ok}
          onClick={async () => {
            try {
              await insert('krs', {
                period_id: periodId,
                goal_id: goalId,
                parent_kr_id: parent?.id ?? null,
                metric_id: f.metric || null,
                title: f.title.trim(),
                target: toNum(f.target),
                unit: f.unit.trim(),
                sort: krs.length,
              })
              setF({ ...f, title: '', target: '' })
              onChange()
            } catch (e) {
              toast(errMsg(e))
            }
          }}
        >
          Thêm KR
        </button>
      </div>
      {hint && <p className="note">{hint}</p>}
    </div>
  )
}

export const krPct = (krs: KR[], actuals: Map<string, number>) =>
  krs.length ? Math.round((krs.reduce((a, k) => a + Math.min((actuals.get(k.id) ?? 0) / k.target, 1), 0) / krs.length) * 100) : null

export const suggest = (n: number, unit: string) => `Gợi ý ≈ ${fmtNum(Math.ceil(n * 10) / 10)} ${unit}`
