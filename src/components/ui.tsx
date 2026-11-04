import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../lib/ctx'
import { colorOf, type Color } from '../lib/okr'
import { fmtNum } from '../lib/pace'
import type { Smart } from '../lib/types'

/** Ô nhập tự lưu khi rời ô. Không bị ghi đè bởi dữ liệu tải lại khi đang gõ. */
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
    title: placeholder,
    'aria-label': label ?? placeholder,
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

/** Hàng ô tick tiêu chí (SMART, KR→O, Kỳ tới). */
export function Criteria({ keys, value, onChange, disabled }: { keys: [string, string][]; value: Smart; onChange: (v: Smart) => void; disabled?: boolean }) {
  return (
    <div className="smart" role="group" aria-label="Tiêu chí kiểm tra">
      {keys.map(([k, l]) => (
        <button key={k} type="button" className="chip" title={l} aria-pressed={!!value?.[k]} disabled={disabled} onClick={() => onChange({ ...value, [k]: !value?.[k] })}>
          {k.length === 1 ? `${k} · ${l}` : l}
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

/** Bước trong wizard: khoá khi bước trước chưa đủ nội dung tối thiểu. */
export function Step(props: { n: string; title: string; hint?: string; open: boolean; done: boolean; lockedMsg?: string; children: ReactNode; right?: ReactNode }) {
  const { n, title, hint, open, done, lockedMsg, children, right } = props
  return (
    <section className={'step ' + (open ? '' : 'locked ') + (done ? 'done' : '')}>
      <h3>
        <span className="n">{done ? '✓' : n}</span>
        <span className="st">{title}</span>
        {right}
      </h3>
      {hint && <p className="hint">{hint}</p>}
      {open ? <div className="step-b">{children}</div> : <p className="step-lock">{lockedMsg}</p>}
    </section>
  )
}

const COLOR_LABEL: Record<Color, string> = { red: 'Chưa đạt', yellow: 'Gần đạt', green: 'Đạt', none: 'Chưa có số' }
export function PctPill({ pct, big }: { pct: number | null; big?: boolean }) {
  const { settings } = useApp()
  const c = colorOf(pct, settings)
  return (
    <span className={'pill ' + c + (big ? ' big' : '')} title={COLOR_LABEL[c]}>
      {pct === null ? '–' : `${Math.round(pct)}%`}
    </span>
  )
}

/** Dải TIÊU ĐIỂM + HOÀN THÀNH + % (§14). Màu theo O thực tế nếu đã đo, chưa thì theo % thực thi. */
export function FocusBand({ title, exec, actual, label = 'Tiêu điểm' }: { title: string; exec: number | null; actual: number | null; label?: string }) {
  const { settings } = useApp()
  const main = actual ?? exec
  return (
    <div className={'band ' + colorOf(main, settings)}>
      <div className="band-t">
        <small>{label}</small>
        <b>{title.trim() || 'Chưa đặt tiêu điểm'}</b>
      </div>
      <div className="band-p">
        <small>Hoàn thành</small>
        <b>{main === null ? '–' : main + '%'}</b>
        <span>
          thực thi {exec ?? '–'}% · O thực tế {actual === null ? 'chưa đo' : actual + '%'}
        </span>
      </div>
    </div>
  )
}

/** Dải cấp trên (C10): % O tuần, 3 O tháng, O năm. */
export interface Upper {
  label: string
  title: string
  pct: number | null
  note?: string
  go?: () => void
}
export function UpperBand({ items }: { items: Upper[] }) {
  const { settings } = useApp()
  return (
    <div className="upper">
      {items.map((u, i) => (
        <button key={i} type="button" className={'up ' + colorOf(u.pct, settings)} onClick={u.go} disabled={!u.go}>
          <small>{u.label}</small>
          <span className="up-t">{u.title || <em>Chưa lập</em>}</span>
          <b>{u.pct === null ? '–' : u.pct + '%'}</b>
          {u.note && <span className="up-n">{u.note}</span>}
        </button>
      ))}
    </div>
  )
}

/** Thanh tiến độ mục tiêu ưu tiên: phần tô = thực tế/đích; vạch = mức cần đạt đến hết hôm qua. */
export function PaceBar({ actual, target, frac, unit, label }: { actual: number; target: number; frac: number; unit: string; label?: ReactNode }) {
  const { settings } = useApp()
  const need = target * frac
  const ratio = need > 0 ? (actual / need) * 100 : null
  const c = colorOf(ratio, settings)
  const pct = target ? Math.max(0, Math.min(100, (actual / target) * 100)) : 0
  return (
    <div className={'pace ' + c}>
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
      <small>{ratio === null ? 'Chưa tới mốc đo' : `Đạt ${Math.round(ratio)}% mức cần có đến hết hôm qua (${fmtNum(Math.round(need * 10) / 10)} ${unit})`}</small>
    </div>
  )
}
