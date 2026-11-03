import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../lib/ctx'
import { fmtNum, status, STATUS_LABEL, type DayStatus } from '../lib/pace'
import type { Smart, SmartKey } from '../lib/types'

/** Ô nhập tự lưu khi rời ô (blur). Giữ chữ đang gõ, không bị ghi đè bởi dữ liệu tải lại. */
export function Txt(props: {
  value: string | null | undefined
  onSave: (v: string) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
  disabled?: boolean
  type?: string
  className?: string
  label?: string
  id?: string
}) {
  const { value, onSave, multiline, rows, placeholder, disabled, type = 'text', className, label, id } = props
  const [v, setV] = useState(value ?? '')
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setV(value ?? '')
  }, [value])
  const common = {
    id,
    value: v,
    placeholder,
    disabled,
    className,
    'aria-label': label,
    onFocus: () => {
      focused.current = true
    },
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
    onBlur: () => {
      focused.current = false
      if (v !== (value ?? '')) onSave(v)
    },
  }
  return multiline ? <textarea rows={rows ?? 2} {...common} /> : <input type={type} {...common} />
}

export const toNum = (s: string): number | null => {
  const t = s.replace(/\s/g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const SMART: [SmartKey, string][] = [
  ['S', 'Ai cũng hiểu'],
  ['M', 'Đo lường được'],
  ['A', 'Khả thi'],
  ['R', 'Quan trọng nhất'],
  ['T', 'Thời gian rõ ràng'],
]
export function SmartChips({ value, onChange, withO, disabled }: { value: Smart; onChange: (v: Smart) => void; withO?: boolean; disabled?: boolean }) {
  const keys: [SmartKey, string][] = withO ? [...SMART, ['O', '3 KR đạt thì O đạt?']] : SMART
  return (
    <div className="smart" role="group" aria-label="Kiểm tra SMART">
      {keys.map(([k, l]) => (
        <button key={k} type="button" className="chip" title={l} aria-pressed={!!value[k]} disabled={disabled} onClick={() => onChange({ ...value, [k]: !value[k] })}>
          {k === 'O' ? l : `${k} · ${l}`}
        </button>
      ))}
    </div>
  )
}

export function Sec({ title, hint, n, children, className }: { title: ReactNode; hint?: string; n?: string; children: ReactNode; className?: string }) {
  return (
    <section className={'sec ' + (className ?? '')}>
      <h3>
        {n && <span className="n">{n}</span>}
        {title}
        {hint && <span className="hint">{hint}</span>}
      </h3>
      {children}
    </section>
  )
}

export function Badge({ st }: { st: DayStatus }) {
  return <span className={'badge ' + st}>{STATUS_LABEL[st]}</span>
}

/** Thanh tiến độ: phần tô = thực tế/mục tiêu; vạch đứng = mức cần đạt đến hôm qua. */
export function PaceBar({ actual, target, frac, unit, label }: { actual: number; target: number; frac: number; unit: string; label?: ReactNode }) {
  const { settings } = useApp()
  const st = status(actual, target, frac, settings)
  const pct = target ? Math.max(0, Math.min(100, (actual / target) * 100)) : 0
  const need = target * frac
  return (
    <div className={'pace ' + st}>
      <div className="pace-h">
        {label && <span className="pace-l">{label}</span>}
        <b>
          {fmtNum(actual)} / {fmtNum(target)} {unit}
        </b>
      </div>
      <div className="pbar">
        <i style={{ width: pct + '%' }} />
        <em style={{ left: Math.min(100, frac * 100) + '%' }} />
      </div>
      <small>
        <Badge st={st} />
        {st !== 'none' && ` Cần ${fmtNum(Math.round(need * 10) / 10)} ${unit} đến hết hôm qua`}
      </small>
    </div>
  )
}

export function Ring({ pct }: { pct: number | null }) {
  const p = pct ?? 0
  return (
    <div className="ring" style={{ ['--p' as string]: p }}>
      <span>{pct === null ? '–' : p + '%'}</span>
    </div>
  )
}

export function Bars({ items }: { items: { label: string; pct: number | null; st: DayStatus }[] }) {
  return (
    <div className="bars">
      {items.map((it, i) => (
        <div key={i} className={'b ' + it.st} title={STATUS_LABEL[it.st]}>
          <b>{it.pct === null ? '–' : it.pct + '%'}</b>
          <i style={{ height: (it.pct ?? 0) * 0.7 + '%' }} />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  )
}
