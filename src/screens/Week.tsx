import { useCallback, useEffect, useState } from 'react'
import { CarriedBlock, FocusBlock, KaizenBlock, ObserveBlock, VerifyBlock } from '../components/Blocks'
import { KrEditor, krPct, suggest } from '../components/KrEditor'
import { Bars, Sec, Txt } from '../components/ui'
import { useApp, usePeriod } from '../lib/ctx'
import { errMsg, getPeriod, krActuals, listGoals, listKrs, listMetrics, listPeriods, listTasks } from '../lib/db'
import { addDays, DOW, fmtDM, isoDow, mondayOf, monthOfWeek, today, weeksOfMonth } from '../lib/dates'
import { dayPct, dayStatus, expectedFraction, type DayStatus } from '../lib/pace'
import type { Goal, KR, Metric, Period } from '../lib/types'
import { PeriodNav } from './PeriodNav'

export default function Week({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const ws = mondayOf(date)
  const { uid, settings, toast, go } = useApp()
  const { p, patch, patchObserve, patchKaizen } = usePeriod('week', ws)
  const [month, setMonth] = useState<Period | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [monthKrs, setMonthKrs] = useState<KR[]>([])
  const [weekKrs, setWeekKrs] = useState<KR[]>([])
  const [actuals, setActuals] = useState(new Map<string, number>())
  const [days, setDays] = useState<{ label: string; pct: number | null; st: DayStatus }[]>([])

  const load = useCallback(async () => {
    if (!p) return
    try {
      const mp = await getPeriod(uid, 'month', monthOfWeek(ws))
      const [g, m, mk, wk, dps] = await Promise.all([listGoals(), listMetrics(), listKrs([mp.id]), listKrs([p.id]), listPeriods('day', ws, addDays(ws, 6))])
      setMonth(mp)
      setGoals(g)
      setMetrics(m)
      setMonthKrs(mk)
      setWeekKrs(wk)
      setActuals(await krActuals([...mk, ...wk]))
      const tasks = await listTasks(dps.map((d) => d.id))
      setDays(
        [0, 1, 2, 3, 4, 5, 6].map((i) => {
          const d = addDays(ws, i)
          const dp = dps.find((x) => x.start_date === d)
          const ts = tasks.filter((t) => t.period_id === dp?.id)
          const rest = settings.rest_weekdays.includes(isoDow(d))
          return { label: `${DOW[isoDow(d)]} ${fmtDM(d)}`, pct: dp?.checked_in_at ? dayPct(ts) : null, st: rest && !dp ? 'none' : d >= today() ? 'none' : dayStatus(dp, ts, settings) }
        }),
      )
    } catch (e) {
      toast(errMsg(e))
    }
  }, [p, uid, ws, settings, toast])
  useEffect(() => {
    load()
  }, [load])

  if (!p) return <p className="note">Đang mở tuần…</p>
  const frac = expectedFraction(ws, addDays(ws, 6), today(), settings.rest_weekdays)
  const activated = month?.activated_goal_ids ?? []
  const pct = krPct(weekKrs, actuals)
  const weeksLeft = weeksOfMonth(monthOfWeek(ws)).filter((w) => w >= ws).length || 1
  const grid = p.observe.grid ?? {}
  const setCell = (d: string, c: 's' | 'c' | 't', v: string) => patchObserve({ grid: { ...grid, [d]: { ...grid[d], [c]: v } } })

  return (
    <>
      <PeriodNav kind="week" start={ws} onShift={(n) => setDate(addDays(ws, 7 * n))} />
      <div className="panes">
        <div className="pane">
          <div className="pane-h">OKRs tuần</div>
          <CarriedBlock p={p} />
          <Sec n="1a" title="Lịch cố định & cam kết" hint="Làm gì, với ai, khi nào? Còn lời hứa nào không?">
            <div className="tbl">
              <table className="wk">
                <thead>
                  <tr>
                    <th className="rowh" />
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                      const d = addDays(ws, i)
                      return (
                        <th key={d} className={d === today() ? 'today' : ''}>
                          <button className="linkbtn" onClick={() => go('day', d)}>
                            <b>{DOW[isoDow(d)]}</b> {fmtDM(d)}
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['s', 'Sáng'],
                      ['c', 'Chiều'],
                      ['t', 'Tối'],
                    ] as const
                  ).map(([c, l]) => (
                    <tr key={c}>
                      <th className="rowh">{l}</th>
                      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                        const d = addDays(ws, i)
                        return (
                          <td key={d}>
                            <Txt multiline rows={3} value={grid[d]?.[c]} onSave={(v) => setCell(d, c, v)} label={`${l} ${fmtDM(d)}`} />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Sec>
          <ObserveBlock p={p} save={patchObserve} />
          <FocusBlock p={p} patch={patch} pct={pct}>
            {!activated.length && (
              <p className="empty">
                Tháng này chưa kích hoạt mục tiêu nào.{' '}
                <button className="linkbtn" onClick={() => go('month', ws)}>
                  Mở kế hoạch tháng
                </button>
              </p>
            )}
            {goals
              .filter((g) => activated.includes(g.id))
              .map((g) => {
                const mks = monthKrs.filter((k) => k.goal_id === g.id)
                return (
                  <div key={g.id} className="goal-krs">
                    <div className="goal-krs-h">{g.title}</div>
                    {!mks.length && <p className="flag">Chưa có KR tháng cho mục tiêu này. Đặt KR tháng trước để chia xuống tuần.</p>}
                    {mks.map((mk) => {
                      const remain = mk.target - (actuals.get(mk.id) ?? 0) + weekKrs.filter((w) => w.parent_kr_id === mk.id).reduce((a, w) => a + (actuals.get(w.id) ?? 0), 0)
                      return (
                        <div key={mk.id} className="parent-kr">
                          <div className="parent-h">
                            KR tháng: {mk.title} · <b>{mk.target} {mk.unit}</b>
                          </div>
                          <KrEditor
                            periodId={p.id}
                            goalId={g.id}
                            parent={mk}
                            krs={weekKrs.filter((w) => w.parent_kr_id === mk.id)}
                            metrics={metrics.filter((m) => m.goal_id === g.id)}
                            actuals={actuals}
                            frac={frac}
                            hint={`${suggest(Math.max(remain, 0) / weeksLeft, mk.unit)}/tuần (phần còn lại của KR tháng chia cho ${weeksLeft} tuần còn lại)`}
                            onChange={load}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
          </FocusBlock>
          <VerifyBlock p={p} save={patchObserve} />
        </div>
        <div className="pane">
          <div className="pane-h">Kaizen tuần</div>
          <KaizenBlock
            p={p}
            save={patchKaizen}
            measure={
              <>
                <div className="measure">
                  <div className="t">{p.focus_title || 'Chưa đặt tiêu điểm tuần'}</div>
                  <b className="big">{pct === null ? '–' : pct + '%'}</b>
                </div>
                <Bars items={days} />
                <p className="note">% từng ngày. Cột xám = chưa check-in.</p>
              </>
            }
          />
        </div>
      </div>
    </>
  )
}
