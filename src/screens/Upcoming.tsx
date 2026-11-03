import { useEffect, useState } from 'react'
import { PctPill } from '../components/ui'
import { useApp } from '../lib/ctx'
import { errMsg, findPeriods, listIn } from '../lib/db'
import { addDays, DOW, fmtDM, isoDow, mondayOf } from '../lib/dates'
import { krPercent, parentLinkCheck, rollup } from '../lib/okr'
import type { KA, KR, Period } from '../lib/types'
import { PeriodNav } from './PeriodNav'

/** Tuần: bản xem nhanh 7 O ngày + quy tắc 60% trong lúc chờ giai đoạn 3–4 (SPEC §13). */
export function WeekPreview({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const ws = mondayOf(date)
  const { settings: s, toast, go } = useApp()
  const [days, setDays] = useState<{ d: string; p?: Period; pct: number | null }[]>([])

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const ps = await findPeriods('day', ws, addDays(ws, 6))
        const krs = await listIn<KR>('key_results', 'period_id', ps.map((x) => x.id))
        const kas = await listIn<KA>('key_actions', 'kr_id', krs.map((x) => x.id))
        const rows = [0, 1, 2, 3, 4, 5, 6].map((i) => {
          const d = addDays(ws, i)
          const p = ps.find((x) => x.start_date === d)
          const ks = krs.filter((k) => k.period_id === p?.id)
          const r = rollup(ks.map((k) => ({ pct: krPercent(k, kas.filter((a) => a.kr_id === k.id), s.weights_enabled), linked: k.linked, weight: k.weight })), s)
          return { d, p, pct: p?.o_title.trim() ? r.main : null }
        })
        if (live) setDays(rows)
      } catch (e) {
        toast(errMsg(e))
      }
    })()
    return () => {
      live = false
    }
  }, [ws, s, toast])

  const withO = days.filter((x) => x.p?.o_title.trim())
  const week = rollup(withO.map((x) => ({ pct: x.pct ?? 0, linked: !!x.p?.linked })), s)
  const rule = parentLinkCheck(withO.filter((x) => x.p?.linked).length, 7, 'ngày', s)

  return (
    <>
      <PeriodNav kind="week" start={ws} onShift={(n) => setDate(addDays(ws, 7 * n))} />
      <div className="alert blue">Trang Tuần đầy đủ (O tuần, Kaizen tuần, Kiểm chứng 3 chiều) làm ở giai đoạn tiếp theo. Dưới đây là 7 O ngày, tức các KR của tuần.</div>
      {!rule.ok && <div className="alert red">{rule.message}</div>}
      <section className="sec">
        <h3>
          KR tuần = các O ngày <span className="hint">% tuần (phần liên quan): {week.main ?? '–'}% · tổng {week.total ?? '–'}%</span>
        </h3>
        <div className="list">
          {days.map(({ d, p, pct }) => (
            <div key={d} className="wkday">
              <button className="linkbtn" onClick={() => go('day', d)}>
                {DOW[isoDow(d)]} {fmtDM(d)}
              </button>
              <span className="wkday-o">{p?.o_title.trim() || <em>Chưa lập O</em>}</span>
              {p?.linked ? <span className="tag active">Liên quan</span> : <span className="tag">Không liên quan</span>}
              <PctPill pct={pct} />
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

export function Upcoming({ title, what }: { title: string; what: string }) {
  return (
    <div className="stack narrow">
      <h1>{title}</h1>
      <p className="empty">{what}</p>
    </div>
  )
}
