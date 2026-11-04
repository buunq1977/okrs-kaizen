import { useEffect, useState } from 'react'
import { StatusPill } from '../components/long/NumericKr'
import { PctPill } from '../components/ui'
import { useApp } from '../lib/ctx'
import { errMsg, findPeriods, listAll, listIn, objectivesOf } from '../lib/db'
import { addDays, DOW, fmtDM, fmtMonth, isoDow, mondayOf, monthEnd, monthStart, today, weeksOfMonth } from '../lib/dates'
import { AREA_NAME, loadLongSummary, type LongSum } from '../lib/long'
import { dayScore, execPercent, krPercent, oActualPercent } from '../lib/okr'
import { quarterOf, statusColor } from '../lib/numeric'
import type { KA, KR, Objective, VisionItem } from '../lib/types'

interface Node {
  date: string
  o?: Objective
  krs: { kr: KR; pct: number; kas: KA[] }[]
  score: number | null
}

/** Cây liên kết (§14.8): Tầm nhìn → Năm → Quý → Tháng → Tuần → Ngày → KR → KA, màu theo tình trạng. */
export default function Tree() {
  const { settings: s, toast, go } = useApp()
  const t0 = today()
  const [vision, setVision] = useState<VisionItem[]>([])
  const [longs, setLongs] = useState<LongSum[]>([])
  const [weeks, setWeeks] = useState<Node[]>([])
  const [days, setDays] = useState<Node[]>([])

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const v = await listAll<VisionItem>('vision_items', 'year_no')
        const ls = await Promise.all([loadLongSummary('year', t0, t0, s), loadLongSummary('quarter', t0, t0, s), loadLongSummary('month', t0, t0, s)])
        const load = async (kind: 'week' | 'day', dates: string[]): Promise<Node[]> => {
          const ps = await findPeriods(kind, dates[0], dates[dates.length - 1])
          const [os, ks] = await Promise.all([objectivesOf(ps.map((x) => x.id)), listIn<KR>('key_results', 'period_id', ps.map((x) => x.id))])
          const as = await listIn<KA>('key_actions', 'kr_id', ks.map((x) => x.id))
          return dates.map((d) => {
            const p = ps.find((x) => x.start_date === d)
            const o = os.find((x) => x.period_id === p?.id && !x.area)
            const krs = ks.filter((k) => k.period_id === p?.id).map((kr) => ({ kr, pct: krPercent(kr, as.filter((a) => a.kr_id === kr.id), s.weights_enabled), kas: as.filter((a) => a.kr_id === kr.id) }))
            return { date: d, o, krs, score: o?.title.trim() ? dayScore(execPercent(krs.map((x) => ({ pct: x.pct, weight: x.kr.weight })), s.weights_enabled), oActualPercent(o)) : null }
          })
        }
        const ms = monthStart(t0)
        const ws = weeksOfMonth(ms)
        const wn = ws.length ? await load('week', ws) : []
        const ds = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(t0), i))
        const dn = await load('day', ds)
        if (!live) return
        setVision(v)
        setLongs(ls)
        setWeeks(wn)
        setDays(dn)
      } catch (e) {
        toast(errMsg(e))
      }
    })()
    return () => {
      live = false
    }
  }, [t0, s, toast])

  const lsTitle = (l: LongSum) => (l.kind === 'year' ? `Năm ${l.start.slice(0, 4)}` : l.kind === 'quarter' ? `Quý ${quarterOf(l.start)}` : fmtMonth(l.start))
  const tickNode = (n: Node, label: string, kind: 'week' | 'day') => (
    <details key={n.date} open={kind === 'day' ? n.date === t0 : n.date === mondayOf(t0)}>
      <summary>
        <span className="tn-k">{label}</span> {n.o?.title || <em>Chưa lập O</em>} <PctPill pct={n.score} />
        <button className="linkbtn" onClick={() => go(kind === 'day' ? 'day' : 'week', n.date)}>
          mở
        </button>
      </summary>
      <ul>
        {n.krs.map(({ kr, pct, kas }) => (
          <li key={kr.id}>
            <details>
              <summary>
                KR {kr.title} <PctPill pct={pct} />
              </summary>
              <ul>
                {kas.map((a) => (
                  <li key={a.id} className={a.done ? 'done' : ''}>
                    {a.done ? '✓' : '○'} KA {a.title}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </details>
  )

  return (
    <div className="stack tree">
      <h1>Cây liên kết</h1>
      <p className="note">Từ Tầm nhìn xuống KA của tuần này. Màu theo tình trạng (kỳ dài) hoặc % hoàn thành (tuần, ngày). Bấm để mở rộng.</p>
      <details open>
        <summary>
          <span className="tn-k">Tầm nhìn</span> {vision.length ? `${vision.length} năm` : <em>chưa lập</em>}
        </summary>
        <ul>
          {vision.map((v) => (
            <li key={v.id}>
              Năm {v.year_no}: {v.goal} {v.verification.trim() ? <span className="pill green">hợp lệ</span> : <span className="pill red">chưa hợp lệ</span>}
            </li>
          ))}
        </ul>
      </details>
      {longs.map((l) => (
        <details key={l.kind} open>
          <summary>
            <span className="tn-k">{lsTitle(l)}</span> {l.period ? '' : <em>chưa lập</em>}
            <button className="linkbtn" onClick={() => go(l.kind, l.start)}>
              mở
            </button>
          </summary>
          <ul>
            {l.objs.map((o) => (
              <li key={o.o.id}>
                <details>
                  <summary>
                    O {AREA_NAME[o.o.area!]}: {o.o.title || <em>chưa viết</em>} <StatusPill v={o.status} color={statusColor(o.status, s)} />
                  </summary>
                  <ul>
                    {o.krs.map(({ kr, st }) => (
                      <li key={kr.id}>
                        KR {kr.title}: {st.actual ?? '–'}/{kr.target ?? '–'} {kr.unit} <StatusPill v={st.status} color={st.color} />
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <details open>
        <summary>
          <span className="tn-k">Các tuần {fmtMonth(monthStart(t0)).toLowerCase()}</span> {fmtDM(monthStart(t0))} – {fmtDM(monthEnd(t0))}
        </summary>
        <div className="tree-in">{weeks.map((w) => tickNode(w, `Tuần ${fmtDM(w.date)}`, 'week'))}</div>
      </details>
      <details open>
        <summary>
          <span className="tn-k">Các ngày tuần này</span>
        </summary>
        <div className="tree-in">{days.map((d) => tickNode(d, `${DOW[isoDow(d.date)]} ${fmtDM(d.date)}`, 'day'))}</div>
      </details>
    </div>
  )
}
