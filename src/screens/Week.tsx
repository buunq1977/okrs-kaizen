import { useCallback, useEffect, useState } from 'react'
import { Kaizen, OkrSummary } from '../components/day/Kaizen'
import { KrBlocks, ObjectiveBlock } from '../components/day/Okr'
import { Analyze, CarryOver, Observe, RootCauses } from '../components/day/Observe'
import { FocusBand, PctPill, Step, UpperBand, type Upper } from '../components/ui'
import { Verify } from '../components/week/Verify'
import { WeekGrid } from '../components/week/WeekGrid'
import { useApp, useMainObjective, usePeriod, useRows } from '../lib/ctx'
import { errMsg, findPeriods, listBy, listIn, objectivesOf, seriesBetween, update } from '../lib/db'
import { addDays, DOW, fmtDM, fmtMonth, isoDow, mondayOf, monthOfWeek, today, weeksOfMonth } from '../lib/dates'
import {
  autoTickIds, carryCandidates, colorOf, dayScore, effectiveLock, execPercent, focusLevel, keywordStats, krPercent, lockCheck, oActualPercent, weekDefaultTab,
} from '../lib/okr'
import { mergeSchedule, type Entry } from '../lib/schedule'
import type { KA, KaizenData, KR, NextAction, Objective, Observation, Period, ScheduleItem, Validation } from '../lib/types'
import { PeriodNav } from './PeriodNav'

const AREA_LABEL = { cv_tc: 'O Công việc/Tài chính', mqh: 'O Mối quan hệ', ttt: 'O Thân–Tâm–Trí' } as const

interface DayInfo {
  date: string
  period?: Period
  o?: Objective
  exec: number | null
  actual: number | null
  score: number | null
  kaizen?: KaizenData
}

export default function Week({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const ws = mondayOf(date)
  const we = addDays(ws, 6)
  const { settings: s, toast, go } = useApp()
  const { p, patch, patchKaizen } = usePeriod('week', ws)
  const pid = p?.id ?? ''
  const { o, patch: patchO } = useMainObjective(pid)
  const none = <T,>() => Promise.resolve([] as T[])
  const obs = useRows<Observation>('observations', pid, () => (pid ? listBy('observations', 'period_id', pid) : none()))
  const krs = useRows<KR>('key_results', pid, () => (pid ? listBy('key_results', 'period_id', pid) : none()))
  const krIds = krs.rows.map((k) => k.id).join(',')
  const kas = useRows<KA>('key_actions', krIds, () => (krIds ? listIn('key_actions', 'kr_id', krIds.split(',')) : none()))
  const acts = useRows<NextAction>('next_actions', pid, () => (pid ? listBy('next_actions', 'period_id', pid) : none()))
  const vals = useRows<Validation>('validations', pid, () => (pid ? listBy('validations', 'period_id', pid) : none()))

  const [tab, setTab] = useState<'okr' | 'kaizen'>(() => weekDefaultTab(ws, today(), s.default_tab))
  const [days, setDays] = useState<DayInfo[]>([])
  const [byDay, setByDay] = useState<Record<string, Entry[]>>({})
  const [upper, setUpper] = useState<Upper[]>([])
  const [chart, setChart] = useState<{ label: string; pct: number | null; current: boolean }[]>([])
  const [prevObs, setPrevObs] = useState<Observation[]>([])
  const [monthKrs, setMonthKrs] = useState<KR[]>([])
  const [tick, setTick] = useState(0)
  const [lockReason, setLockReason] = useState('')
  const [unlockReason, setUnlockReason] = useState('')
  const [showUnlock, setShowUnlock] = useState(false)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  // Các ngày trong tuần, lịch, cấp trên, chart tháng, quan sát tuần trước
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const exec = (ks: KR[], as: KA[]) => execPercent(ks.map((k) => ({ pct: krPercent(k, as.filter((a) => a.kr_id === k.id), s.weights_enabled), weight: k.weight })), s.weights_enabled)
        const dps = await findPeriods('day', ws, we)
        const [dos, dks, items, series] = await Promise.all([
          objectivesOf(dps.map((x) => x.id)),
          listIn<KR>('key_results', 'period_id', dps.map((x) => x.id)),
          listIn<ScheduleItem>('schedule_items', 'period_id', dps.map((x) => x.id), 'created_at'),
          seriesBetween(ws, we),
        ])
        const das = await listIn<KA>('key_actions', 'kr_id', dks.map((x) => x.id))
        const info: DayInfo[] = [0, 1, 2, 3, 4, 5, 6].map((i) => {
          const d = addDays(ws, i)
          const period = dps.find((x) => x.start_date === d)
          const od = dos.find((x) => x.period_id === period?.id && !x.area)
          const ex = period ? exec(dks.filter((k) => k.period_id === period.id), das) : null
          const ac = od ? oActualPercent(od) : null
          return { date: d, period, o: od, exec: ex, actual: ac, score: od?.title.trim() ? dayScore(ex, ac) : null, kaizen: period?.kaizen }
        })
        const grid: Record<string, Entry[]> = {}
        for (const d of info) grid[d.date] = mergeSchedule(series, items.filter((x) => x.date === d.date), d.date)

        const ms = monthOfWeek(ws)
        const [mp] = await findPeriods('month', ms, ms)
        const [yp] = await findPeriods('year', ms.slice(0, 4) + '-01-01', ms.slice(0, 4) + '-01-01')
        const uos = await objectivesOf([mp?.id, yp?.id].filter(Boolean) as string[])
        const mk = mp ? await listBy<KR>('key_results', 'period_id', mp.id) : []
        const up: Upper[] = (['cv_tc', 'mqh', 'ttt'] as const).map((a) => {
          const mo = uos.find((x) => x.period_id === mp?.id && x.area === a)
          return { label: AREA_LABEL[a] + ' · ' + fmtMonth(ms).toLowerCase(), title: mo?.title ?? '', pct: null, note: mo ? 'Tình trạng: khi có trang Tháng' : undefined, go: () => go('month', ws) }
        })
        const yo = uos.filter((x) => x.period_id === yp?.id)
        up.push({ label: 'O năm', title: yo.map((x) => x.title).filter(Boolean).join(' · '), pct: null, go: () => go('year', ws) })

        const weeks = weeksOfMonth(ms)
        const wps = await findPeriods('week', weeks[0], weeks[weeks.length - 1])
        const [wos, wks] = await Promise.all([objectivesOf(wps.map((x) => x.id)), listIn<KR>('key_results', 'period_id', wps.map((x) => x.id))])
        const was = await listIn<KA>('key_actions', 'kr_id', wks.map((x) => x.id))
        const bars = weeks.map((w, i) => {
          const wp = wps.find((x) => x.start_date === w)
          const wo = wos.find((x) => x.period_id === wp?.id && !x.area)
          const ex = wp ? exec(wks.filter((k) => k.period_id === wp.id), was) : null
          return { label: `T${i + 1} · ${fmtDM(w)}`, pct: wo?.title.trim() ? dayScore(ex, wo ? oActualPercent(wo) : null) : null, current: w === ws }
        })

        const [pw] = await findPeriods('week', addDays(ws, -7), addDays(ws, -7))
        const po = pw ? await listBy<Observation>('observations', 'period_id', pw.id) : []
        if (!live) return
        setDays(info)
        setByDay(grid)
        setUpper(up)
        setMonthKrs(mk)
        setChart(bars)
        setPrevObs(po)
      } catch (e) {
        toast(errMsg(e))
      }
    })()
    return () => {
      live = false
    }
  }, [ws, we, s, toast, go, tick])

  // KA tuần tự tick khi O ngày phục vụ đạt ngưỡng (§3.1)
  const kasReload = kas.reload
  useEffect(() => {
    const ids = autoTickIds(kas.rows, days.map((d) => ({ serves_ka_id: d.o?.serves_ka_id ?? null, score: d.score })), s.pass_pct, s.ka_autotick)
    if (!ids.length) return
    Promise.all(ids.map((id) => update('key_actions', id, { done: true, auto_ticked: true })))
      .then(() => kasReload())
      .catch((e) => toast(errMsg(e)))
  }, [kas.rows, days, s.pass_pct, s.ka_autotick, kasReload, toast])

  if (!p || !o) return <p className="note">Đang mở tuần…</p>

  const lock = effectiveLock(p, s, new Date())
  const editable = !lock.locked
  const krPcts = krs.rows.map((k) => krPercent(k, kas.rows.filter((a) => a.kr_id === k.id), s.weights_enabled))
  const exec = execPercent(krs.rows.map((k, i) => ({ pct: krPcts[i], weight: k.weight })), s.weights_enabled)
  const actual = oActualPercent(o)
  const check = lockCheck('week', o, krs.rows.map((k) => ({ ...k, kas: kas.rows.filter((a) => a.kr_id === k.id).length })), s)
  const carry = carryCandidates(prevObs, obs.rows)
  const focus = focusLevel(days.map((d) => ({ serves_kr_id: d.o?.serves_kr_id ?? null, serves_ka_id: d.o?.serves_ka_id ?? null })), krs.rows.map((k) => k.id), kas.rows.map((a) => a.id))
  const sel = obs.rows.filter((x) => x.is_selected)
  const done = [
    days.some((d) => (byDay[d.date] ?? []).length > 0),
    obs.rows.some((x) => x.content.trim()),
    sel.length > 0,
    sel.some((x) => x.tham.trim() || x.san.trim() || x.si.trim()),
    !!o.title.trim(),
    krs.rows.length > 0,
    kas.rows.length > 0,
  ]
  const open = (i: number) => i <= 1 || done.slice(1, i).every(Boolean) || done[i] || (i >= 4 && (!!o.title.trim() || krs.rows.length > 0))
  const causes = sel.flatMap((x) => [x.tham, x.san, x.si].map((y) => y.trim()).filter(Boolean))
  const servesLabel = (od?: Objective) => {
    if (!od) return ''
    const ki = krs.rows.findIndex((k) => k.id === od.serves_kr_id)
    if (ki >= 0) return `KR${ki + 1}`
    const ka = kas.rows.find((a) => a.id === od.serves_ka_id)
    if (ka) return `KA: ${ka.title}`
    return ''
  }

  const daysTable = (
    <section className="sec">
      <h3>
        Ngày trong tuần
        <span className="hint">
          Mức tập trung: <b>{focus}/7</b> ngày có O phục vụ KR/KA tuần (thông tin, không bắt buộc)
        </span>
      </h3>
      <div className="list">
        {days.map((d) => (
          <div key={d.date} className="wkday">
            <button className="linkbtn" onClick={() => go('day', d.date)}>
              {DOW[isoDow(d.date)]} {fmtDM(d.date)}
            </button>
            <span className="wkday-o">
              {d.o?.title.trim() || <em>Chưa lập O</em>}
              {servesLabel(d.o) && <small> → {servesLabel(d.o)}</small>}
            </span>
            <PctPill pct={d.score} />
          </div>
        ))}
      </div>
    </section>
  )

  return (
    <>
      <PeriodNav kind="week" start={ws} onShift={(n) => setDate(addDays(ws, 7 * n))} extra={<span className="period-tag">{ws <= today() && today() <= we ? 'Tuần này' : ''}</span>} />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'okr'} onClick={() => setTab('okr')}>
          OKR tuần
        </button>
        <button role="tab" aria-selected={tab === 'kaizen'} onClick={() => setTab('kaizen')}>
          Kaizen tuần
        </button>
      </div>

      {tab === 'okr' ? (
        <div className="stack">
          <UpperBand items={upper} />
          {chart.length > 0 && (
            <section className="sec">
              <h3>
                % các tuần trong {fmtMonth(monthOfWeek(ws)).toLowerCase()}
                <span className="hint">Đường cộng dồn KR Công việc/Tài chính hiện khi có trang Tháng</span>
              </h3>
              <div className="bars">
                {chart.map((c) => (
                  <div key={c.label} className={'b ' + colorOf(c.pct, s) + (c.current ? ' cur' : '')}>
                    <b>{c.pct === null ? '–' : c.pct + '%'}</b>
                    <i style={{ height: (c.pct ?? 0) * 0.7 + '%' }} />
                    <span>{c.label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <FocusBand title={o.title} exec={exec} actual={actual} label="Tiêu điểm tuần" />
          <div className="lockbar">
            {editable ? (
              <span>Kế hoạch tuần đang mở. Chốt sau khi viết O, KR và kiểm chứng.</span>
            ) : (
              <>
                <span>🔒 Kế hoạch tuần đã chốt. Vẫn tick KA và viết Kaizen được.</span>
                {!showUnlock ? (
                  <button className="btn ghost" onClick={() => setShowUnlock(true)}>
                    Mở khoá để sửa
                  </button>
                ) : (
                  <span className="addrow">
                    <input autoFocus value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} placeholder="Vì sao phải sửa kế hoạch đã chốt?" aria-label="Lý do mở khoá" />
                    <button
                      className="btn"
                      disabled={!unlockReason.trim()}
                      onClick={async () => {
                        await patch({ unlocks: [...p.unlocks, { at: new Date().toISOString(), reason: unlockReason.trim() }] })
                        setUnlockReason('')
                        setShowUnlock(false)
                      }}
                    >
                      Mở khoá
                    </button>
                  </span>
                )}
              </>
            )}
          </div>

          <Step n="1" title="1a. Quan sát · Lịch tuần" hint="Lịch cố định và cam kết của 7 ngày. Biết quỹ thời gian trước khi chọn việc." open done={done[0]}>
            <WeekGrid weekStart={ws} byDay={byDay} onChange={refresh} editable={editable} />
          </Step>
          <Step n="2" title="1b. Quan sát · Vấn đề, nỗi đau, tồn đọng, cơ hội" hint="Mỗi ý trả lời: Nếu không làm thì sao?" open={open(1)} done={done[1]}>
            {editable && <CarryOver prev={carry} onKeep={(x) => obs.add({ period_id: pid, category: x.category, content: x.content, consequence: x.consequence, tham: x.tham, san: x.san, si: x.si, cause_note: x.cause_note, carried_from: x.id, sort: obs.rows.length })} onClose={async (x) => {
              try {
                await update('observations', x.id, { closed: true })
                setPrevObs((xs) => xs.map((y) => (y.id === x.id ? { ...y, closed: true } : y)))
              } catch (e) {
                toast(errMsg(e))
              }
            }} label="tuần trước" />}
            <Observe periodId={pid} obs={obs} editable={editable} />
          </Step>
          <Step n="3" title="2. Phân tích" hint="Tô đậm việc đủ điều kiện giải quyết trong tuần." open={open(2)} done={done[2]} lockedMsg="Ghi ít nhất 1 quan sát trước.">
            <Analyze obs={obs} editable={editable} />
          </Step>
          <Step n="4" title="3. Nguyên nhân lõi" hint="Với từng việc tô đậm: Tham, Sân hay Si?" open={open(3)} done={done[3]} lockedMsg="Tô đậm ít nhất 1 việc trước.">
            <RootCauses obs={obs} editable={editable} />
          </Step>
          <Step n="5" title="Tiêu điểm tuần (O)" hint="1 câu, có số đo, kiểm đủ 6 tiêu chí, ghi đóng góp vào KR tháng." open={open(4)} done={done[4]} lockedMsg="Tìm nguyên nhân ở bước 4 trước.">
            <ObjectiveBlock level="week" o={o} patch={patchO} editable={editable} causes={causes} krCount={krs.rows.length} load={0} monthKrs={monthKrs} />
          </Step>
          <Step n="6–7" title="KR và KA tuần" hint="KR/KA tuần là thứ O các ngày chọn để phục vụ." open={open(5)} done={done[5] && done[6]} lockedMsg="Viết tiêu điểm tuần trước.">
            <KrBlocks periodId={pid} objectiveId={o.id} krs={krs} kas={kas} pcts={krPcts} editable={editable} canAdd={editable} addBlockedMsg="" />
            {kas.rows.some((a) => a.auto_ticked && a.done) && <p className="note">KA có dấu ✓ tự động: được tick vì O ngày phục vụ nó đạt từ {s.pass_pct}%. Bỏ tick tay được.</p>}
          </Step>
          <Step n="8" title="Kiểm chứng 3 chiều" hint="Làm sau khi viết O và KR, trước khi bắt tay làm." open={!!o.title.trim()} done={vals.rows.some((r) => r.asked)} lockedMsg="Viết tiêu điểm tuần trước.">
            <Verify periodId={pid} v={vals} editable={editable} />
          </Step>
          {daysTable}

          <section className="lockpanel">
            {check.blockers.length > 0 && (
              <ul className="blockers">
                {check.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {check.warnings.length > 0 && (
              <ul className="warnings">
                {check.warnings.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {editable && (
              <div className="lock-a">
                {check.blockers.length === 0 ? (
                  <button className="btn primary" onClick={() => patch({ status: 'locked', locked_at: new Date().toISOString(), lock_reason: null })}>
                    Chốt kế hoạch tuần
                  </button>
                ) : (
                  <span className="addrow">
                    <input value={lockReason} onChange={(e) => setLockReason(e.target.value)} placeholder="Chốt dù chưa đủ tiêu chí? Ghi lý do" aria-label="Lý do chốt" />
                    <button className="btn" disabled={!lockReason.trim()} onClick={() => patch({ status: 'locked', locked_at: new Date().toISOString(), lock_reason: lockReason.trim() })}>
                      Chốt bỏ qua
                    </button>
                  </span>
                )}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="stack">
          <OkrSummary o={o} krs={krs.rows} kas={kas.rows} pcts={krPcts} />
          {daysTable}
          <Kaizen
            level="week"
            p={p}
            save={patchKaizen}
            o={o}
            patchO={patchO}
            exec={exec}
            actual={actual}
            acts={acts}
            prefill={() =>
              days
                .filter((d) => d.o?.title.trim())
                .map((d) => ({
                  time: `${DOW[isoDow(d.date)]} ${fmtDM(d.date)}`,
                  did: d.o!.title,
                  result: `${d.score ?? 0}%${d.o!.o_target !== null && d.o!.o_actual !== null ? ` (${d.o!.o_actual}/${d.o!.o_target} ${d.o!.o_metric})` : ''}`,
                }))
            }
            suggest={keywordStats(days.map((d) => d.kaizen ?? {})).filter((x) => x.count >= 1)}
            suggestLessons={[...new Set(days.flatMap((d) => (d.kaizen?.lessons ?? []).map((l) => l.text.trim())).filter(Boolean))]}
            extraMeasure={
              <label className="fld inline">
                <span>Thực tế đóng góp KR tháng</span>
                <input
                  type="number"
                  defaultValue={o.weekly_actual ?? ''}
                  onBlur={(e) => patchO({ weekly_actual: e.target.value === '' ? null : Number(e.target.value) })}
                  aria-label="Thực tế đóng góp KR tháng"
                />
                <span className="unit">{o.weekly_target !== null ? `/ chỉ tiêu ${o.weekly_target}` : 'chưa đặt chỉ tiêu tuần'}</span>
              </label>
            }
          />
        </div>
      )}
    </>
  )
}
