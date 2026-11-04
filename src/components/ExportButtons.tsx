import { useState } from 'react'
import { useApp } from '../lib/ctx'
import { errMsg } from '../lib/db'
import { exportPeriodXlsx } from '../lib/export'
import type { Period } from '../lib/types'

/** Xuất Excel và in / lưu PDF cho kỳ đang xem. */
export function ExportButtons({ p, title }: { p: Period | null; title: string }) {
  const { toast } = useApp()
  const [busy, setBusy] = useState(false)
  if (!p) return null
  return (
    <span className="export no-print">
      <button
        className="btn ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await exportPeriodXlsx(p, title)
          } catch (e) {
            toast(errMsg(e))
          }
          setBusy(false)
        }}
      >
        ⤓ Excel
      </button>
      <button className="btn ghost" onClick={() => window.print()} title="Chọn 'Lưu dưới dạng PDF' trong hộp thoại in">
        ⎙ PDF
      </button>
    </span>
  )
}
