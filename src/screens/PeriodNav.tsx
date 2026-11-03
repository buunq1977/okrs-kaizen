import type { ReactNode } from 'react'
import { addDays, DOW_LONG, fmtDM, fmtDMY, fmtMonth, isoDow } from '../lib/dates'
import type { PeriodKind } from '../lib/types'

export function PeriodNav({ kind, start, onShift, extra }: { kind: PeriodKind; start: string; onShift: (n: number) => void; extra?: ReactNode }) {
  const title =
    kind === 'day' ? `${DOW_LONG[isoDow(start)]}, ${fmtDMY(start)}` : kind === 'week' ? `Tuần ${fmtDM(start)} – ${fmtDMY(addDays(start, 6))}` : fmtMonth(start)
  return (
    <div className="period">
      <button className="btn" onClick={() => onShift(-1)} aria-label="Kỳ trước">
        ‹
      </button>
      <h1>{title}</h1>
      <button className="btn" onClick={() => onShift(1)} aria-label="Kỳ sau">
        ›
      </button>
      {extra}
    </div>
  )
}
