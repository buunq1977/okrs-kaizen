import { useCallback, useEffect, useState } from 'react'
import { CarriedBlock, FocusBlock, KaizenBlock, ObserveBlock } from '../components/Blocks'
import { KrEditor, krPct, suggest } from '../components/KrEditor'
import { Bars, Sec } from '../components/ui'
import { useApp, usePeriod } from '../lib/ctx'
import { errMsg, krActuals, listChildKrs, listGoals, listKrs, listMetrics, listPeriods } from '../lib/db'
import { addMonths, fmtDM, monthEnd, monthsLeft, monthStart, today, weeksOfMonth } from '../lib/dates'
import { expectedFraction, type DayStatus } from '../lib/pace'
import type { Goal, KR, Metric } from '../lib/types'
import { PeriodNav } from './PeriodNav'

export default function Month({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const ms = monthStart(date)
  const { settings, toast } = useApp()
  const { p, patch, patchObserve, patchKaizen } = usePeriod('month', ms)
  const [goals, setGoals] = useState<Goal[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [krs, setKrs] = useState<KR[]>([])
  const [actuals, setActuals] = useState(new Map<string, number>())
  const [weekPct, setWeekPct] = useState<{ label: string; pct: number | null; st: DayStatus }[]>([])

  const load = useCallback(async () => {
    if (!p) return
    try {
      const [g, m, k] = await Promise.all([listGoals(), listMetrics(), listKrs([p.id])])
      setGoals(g)
      setMetrics(m)
      setKrs(k)
      setActuals(await krActuals(k))
      // % từng tuần = trung bình KR tuần con của các KR tháng này
      const weeks = weeksOfMonth(ms)
      const wps = await listPeriods('week', weeks[0], weeks[weeks.length - 1])
      const child = await listChildKrs(k.map((x) => x.id))
      const childAct = await krActuals(child)
      setWeekPct(
        weeks.map((w, i) => {
          const wp = wps.find((x) => x.start_date === w)
          const ks = child.filter((c) => c.period_id === wp?.id)
          const pct = krPct(ks, childAct)
          return { label: `T${i + 1} ${fmtDM(w)}`, pct, st: pct === null ? 'none' : pct >= settings.green_pct ? 'green' : pct >= settings.yellow_pct ? 'yellow' : 'red' }
        }),
      )
    } catch (e) {
      toast(errMsg(e))
    }
  }, [p, ms, settings, toast])
  useEffect(() => {
    load()
  }, [load])

  if (!p) return <p className="note">Đang mở tháng…</p>
  const frac = expectedFraction(ms, monthEnd(ms), today(), settings.rest_weekdays)
  const activeGoals = goals.filter((g) => g.status === 'active')
  const hasLeading = (g: Goal) => metrics.some((m) => m.goal_id === g.id && m.kind === 'leading')
  const activated = p.activated_goal_ids
  const toggle = (id: string) => patch({ activated_goal_ids: activated.includes(id) ? activated.filter((x) => x !== id) : [...activated, id] })
  const visibleKrs = krs.filter((k) => activated.includes(k.goal_id))
  const pct = krPct(visibleKrs, actuals)

  return (
    <>
      <PeriodNav kind="month" start={ms} onShift={(n) => setDate(addMonths(ms, n))} />
      <div className="panes">
        <div className="pane">
          <div className="pane-h">OKRs tháng</div>
          <CarriedBlock p={p} />
          <Sec n="1a" title="Kích hoạt mục tiêu tháng này" hint="Tối đa 3. Mục tiêu không kích hoạt sẽ không sinh việc xuống tuần/ngày.">
            {!activeGoals.length && <p className="empty">Chưa có mục tiêu năm. Vào màn Mục tiêu để tạo trước.</p>}
            <div className="list">
              {activeGoals.map((g) => {
                const on = activated.includes(g.id)
                const can = hasLeading(g) && (on || activated.length < 3)
                return (
                  <label key={g.id} className={'li ' + (can ? '' : 'off')}>
                    <input type="checkbox" checked={on} disabled={!can} onChange={() => toggle(g.id)} />
                    <span>
                      {g.title} <small>({g.unit})</small>
                      {!hasLeading(g) && <em className="flag"> · cần chỉ số hành động</em>}
                    </span>
                  </label>
                )
              })}
            </div>
          </Sec>
          <ObserveBlock p={p} save={patchObserve} />
          <FocusBlock p={p} patch={patch} pct={pct}>
            {activeGoals
              .filter((g) => activated.includes(g.id))
              .map((g) => {
                const left = monthsLeft(ms, g.deadline)
                return (
                  <div key={g.id} className="goal-krs">
                    <div className="goal-krs-h">
                      {g.title}
                      <small>
                        {' '}
                        · còn {left} tháng đến hạn · {suggest((g.target - g.current) / left, g.unit)}/tháng cho chỉ số kết quả
                      </small>
                    </div>
                    <KrEditor
                      periodId={p.id}
                      goalId={g.id}
                      krs={krs.filter((k) => k.goal_id === g.id)}
                      metrics={metrics.filter((m) => m.goal_id === g.id)}
                      actuals={actuals}
                      frac={frac}
                      onChange={load}
                    />
                  </div>
                )
              })}
            {!activated.length && <p className="empty">Kích hoạt ít nhất 1 mục tiêu ở trên để đặt KR tháng.</p>}
          </FocusBlock>
        </div>
        <div className="pane">
          <div className="pane-h">Kaizen tháng</div>
          <KaizenBlock
            p={p}
            save={patchKaizen}
            measure={
              <>
                <div className="measure">
                  <div className="t">{p.focus_title || 'Chưa đặt tiêu điểm tháng'}</div>
                  <b className="big">{pct === null ? '–' : pct + '%'}</b>
                </div>
                <Bars items={weekPct} />
                <p className="note">% KR tuần của từng tuần trong tháng</p>
              </>
            }
          />
        </div>
      </div>
    </>
  )
}
