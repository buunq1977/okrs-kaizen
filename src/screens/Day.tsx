import { useEffect, useState } from 'react'
import { Kaizen, OkrSummary } from '../components/day/Kaizen'
import { KrBlocks, ObjectiveBlock } from '../components/day/Okr'
import { Analyze, CarryOver, Observe, RootCauses } from '../components/day/Observe'
import { Schedule } from '../components/day/Schedule'
import { FocusBand, Step, UpperBand, type Upper } from '../components/ui'
import { useApp, useMainObjective, usePeriod, useRows } from '../lib/ctx'
import { errMsg, findPeriods, listBy, listIn, objectivesOf, seriesActiveOn, update } from '../lib/db'
import { addDays, fmtDM, mondayOf, monthStart, today } from '../lib/dates'
import {
  carryCandidates, dayScore, defaultTab, effectiveLock, execPercent, hasLessons, kaizenStarted, krPercent, lockCheck,
  oActualPercent, redStreak, remindTime, scheduleLoad, type DayRecord,
} from '../lib/okr'
import { mergeSchedule } from '../lib/schedule'
import type { KA, KR, NextAction, Observation, ScheduleItem, ScheduleSeries } from '../lib/types'
import { PeriodNav } from './PeriodNav'

const AREA_LABEL = { cv_tc: 'O Công việc/Tài chính', mqh: 'O Mối quan hệ', ttt: 'O Thân–Tâm–Trí' } as const

export default function Day({ date, setDate, mode }: { date: string; setDate: (d: string) => void; mode: 'today' | 'plan' }) {
  const { settings: s, toast, go } = useApp()
  const { p, patch, patchKaizen } = usePeriod('day', date)
  const pid = p?.id ?? ''
  const { o, patch: patchO } = useMainObjective(pid)
  const none = <T,>() => Promise.resolve([] as T[])
  const items = useRows<ScheduleItem>('schedule_items', pid, () => (pid ? listBy('schedule_items', 'period_id', pid, 'created_at') : none()))
  const series = useRows<ScheduleSeries>('schedule_series', date, () => seriesActiveOn(date))
  const obs = useRows<Observation>('observations', pid, () => (pid ? listBy('observations', 'period_id', pid) : none()))
  const krs = useRows<KR>('key_results', pid, () => (pid ? listBy('key_results', 'period_id', pid) : none()))
  const krIds = krs.rows.map((k) => k.id).join(',')
  const kas = useRows<KA>('key_actions', krIds, () => (krIds ? listIn('key_actions', 'kr_id', krIds.split(',')) : none()))
  const acts = useRows<NextAction>('next_actions', pid, () => (pid ? listBy('next_actions', 'period_id', pid) : none()))

  const [now, setNow] = useState(() => new Date())
  const [tab, setTab] = useState<'okr' | 'kaizen'>(() => (mode === 'plan' ? 'okr' : defaultTab(date, today(), new Date(), s)))
  const [prevObs, setPrevObs] = useState<Observation[]>([])
  const [upper, setUpper] = useState<Upper[]>([])
  const [weekKrs, setWeekKrs] = useState<KR[]>([])
  const [weekKas, setWeekKas] = useState<KA[]>([])
  const [streak, setStreak] = useState<{ locked: boolean; day?: string }>({ locked: false })
  const [todayKaizenDone, setTodayKaizenDone] = useState(true)
  const [lockReason, setLockReason] = useState('')
  const [unlockReason, setUnlockReason] = useState('')
  const [showUnlock, setShowUnlock] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // Cấp trên (tuần, tháng, năm), quan sát hôm qua, chuỗi đỏ, Kaizen hôm nay
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const ws = mondayOf(date)
        const [wp] = await findPeriods('week', ws, ws)
        const [mp] = await findPeriods('month', monthStart(date), monthStart(date))
        const [yp] = await findPeriods('year', date.slice(0, 4) + '-01-01', date.slice(0, 4) + '-01-01')
        const os = await objectivesOf([wp?.id, mp?.id, yp?.id].filter(Boolean) as string[])
        const wk = wp ? await listBy<KR>('key_results', 'period_id', wp.id) : []
        const wka = await listIn<KA>('key_actions', 'kr_id', wk.map((k) => k.id))
        const wo = os.find((x) => x.period_id === wp?.id && !x.area)
        const wExec = execPercent(wk.map((k) => ({ pct: krPercent(k, wka.filter((a) => a.kr_id === k.id), s.weights_enabled), weight: k.weight })), s.weights_enabled)
        const up: Upper[] = [{ label: 'O tuần', title: wo?.title ?? '', pct: wo ? (oActualPercent(wo) ?? wExec) : null, go: () => go('week', date) }]
        for (const a of ['cv_tc', 'mqh', 'ttt'] as const) {
          const mo = os.find((x) => x.period_id === mp?.id && x.area === a)
          up.push({ label: AREA_LABEL[a] + ' · tháng', title: mo?.title ?? '', pct: null, note: mo ? 'Tình trạng: khi có trang Tháng' : undefined, go: () => go('month', date) })
        }
        const yo = os.filter((x) => x.period_id === yp?.id)
        up.push({ label: 'O năm', title: yo.map((x) => x.title).filter(Boolean).join(' · '), pct: null, go: () => go('year', date) })

        const [pp] = await findPeriods('day', addDays(date, -1), addDays(date, -1))
        const po = pp ? await listBy<Observation>('observations', 'period_id', pp.id) : []

        const t0 = today()
        let st: { locked: boolean; day?: string } = { locked: false }
        let tk = true
        if (date >= t0) {
          const past = await findPeriods('day', addDays(t0, -45), t0)
          const pos = await objectivesOf(past.map((x) => x.id))
          const pk = await listIn<KR>('key_results', 'period_id', past.map((x) => x.id))
          const pa = await listIn<KA>('key_actions', 'kr_id', pk.map((x) => x.id))
          const recs: DayRecord[] = past
            .filter((d) => d.start_date < t0)
            .map((d) => {
              const od = pos.find((x) => x.period_id === d.id && !x.area)
              const ks = pk.filter((k) => k.period_id === d.id)
              const ex = execPercent(ks.map((k) => ({ pct: krPercent(k, pa.filter((a) => a.kr_id === k.id), s.weights_enabled), weight: k.weight })), s.weights_enabled)
              return { date: d.start_date, hasO: !!od?.title.trim(), pct: dayScore(ex, od ? oActualPercent(od) : null), lessons: hasLessons(d.kaizen) }
            })
          st = redStreak(t0, recs, s)
          if (date > t0) tk = kaizenStarted(past.find((x) => x.start_date === t0)?.kaizen)
        }
        if (!live) return
        setUpper(up)
        setWeekKrs(wk)
        setWeekKas(wka)
        setPrevObs(po)
        setStreak(st)
        setTodayKaizenDone(tk)
      } catch (e) {
        toast(errMsg(e))
      }
    })()
    return () => {
      live = false
    }
  }, [date, s, toast, go])

  if (!p || !o) return <p className="note">Đang mở ngày…</p>

  const t0 = today()
  const lock = effectiveLock(p, s, now)
  const editable = !lock.locked
  const canAdd = editable && !streak.locked
  const entries = mergeSchedule(series.rows, items.rows, date)
  const krPcts = krs.rows.map((k) => krPercent(k, kas.rows.filter((a) => a.kr_id === k.id), s.weights_enabled))
  const exec = execPercent(krs.rows.map((k, i) => ({ pct: krPcts[i], weight: k.weight })), s.weights_enabled)
  const actual = oActualPercent(o)
  const check = lockCheck('day', o, krs.rows.map((k) => ({ ...k, kas: kas.rows.filter((a) => a.kr_id === k.id).length })), s)
  const load = scheduleLoad(entries, s.day_start, s.day_end)
  const carry = carryCandidates(prevObs, obs.rows)

  const sel = obs.rows.filter((x) => x.is_selected)
  const done = [
    p.no_fixed_schedule || entries.some((e) => e.title.trim()),
    obs.rows.some((x) => x.content.trim()),
    sel.length > 0,
    sel.some((x) => x.tham.trim() || x.san.trim() || x.si.trim()),
    !!o.title.trim(),
    krs.rows.length > 0,
    kas.rows.length > 0,
  ]
  const open = (i: number) => done.slice(0, i).every(Boolean) || done[i] || (i >= 4 && (!!o.title.trim() || krs.rows.length > 0))
  const causes = sel.flatMap((x) => [x.tham, x.san, x.si].map((y) => y.trim()).filter(Boolean))
  const remind = remindTime(s.lock_time, s.remind_lead_min)
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const keep = async (x: Observation) => {
    await obs.add({ period_id: pid, category: x.category, content: x.content, consequence: x.consequence, tham: x.tham, san: x.san, si: x.si, cause_note: x.cause_note, carried_from: x.id, sort: obs.rows.length })
  }
  const close = async (x: Observation) => {
    try {
      await update('observations', x.id, { closed: true })
      setPrevObs((xs) => xs.map((y) => (y.id === x.id ? { ...y, closed: true } : y)))
    } catch (e) {
      toast(errMsg(e))
    }
  }

  return (
    <>
      <PeriodNav kind="day" start={date} onShift={(n) => setDate(addDays(date, n))} extra={<span className="period-tag">{mode === 'plan' ? 'Lập kế hoạch' : date === t0 ? 'Hôm nay' : ''}</span>} />

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'okr'} onClick={() => setTab('okr')}>
          OKR ngày
        </button>
        <button role="tab" aria-selected={tab === 'kaizen'} onClick={() => setTab('kaizen')}>
          Kaizen ngày
        </button>
      </div>

      {streak.locked && (
        <div className="alert red">
          <b>Đã đỏ {s.red_streak} ngày liền.</b> Không thêm KR/KA mới cho đến khi viết Bài học cho ngày {fmtDM(streak.day!)}.{' '}
          <button className="btn" onClick={() => go('day', streak.day)}>
            Viết Kaizen ngày {fmtDM(streak.day!)}
          </button>
        </div>
      )}
      {date > t0 && !todayKaizenDone && (
        <div className="alert yellow">
          Chưa làm Kaizen hôm nay. Thứ tự đúng: Kaizen ngày {fmtDM(t0)} trước, rồi lập OKR ngày {fmtDM(date)}.{' '}
          <button className="btn" onClick={() => go('day', t0)}>
            Làm Kaizen hôm nay
          </button>
        </div>
      )}
      {mode === 'today' && date === t0 && nowHM >= remind && !kaizenStarted(p.kaizen) && (
        <div className="alert blue">
          Đã {remind}: còn ít hơn {s.remind_lead_min} phút đến giờ chốt kế hoạch ngày mai ({s.lock_time.slice(0, 5)}). Làm Kaizen hôm nay rồi lập OKR ngày mai.{' '}
          {tab === 'okr' && (
            <button className="btn" onClick={() => setTab('kaizen')}>
              Mở Kaizen
            </button>
          )}
          <button className="btn" onClick={() => go('plan', addDays(t0, 1))}>
            Lập OKR ngày mai
          </button>
        </div>
      )}

      {tab === 'okr' ? (
        <div className="stack">
          <UpperBand items={upper} />
          <FocusBand title={o.title} exec={exec} actual={actual} />
          <div className="lockbar">
            {editable ? (
              <span>
                Kế hoạch đang mở
                {s.auto_lock && lock.deadline && (
                  <>
                    , tự khoá lúc <b>{s.lock_time.slice(0, 5)} ngày {fmtDM(addDays(date, -1))}</b>
                  </>
                )}
                .
              </span>
            ) : (
              <>
                <span>🔒 Kế hoạch đã chốt. Vẫn tick KA, Check lịch và viết Kaizen được.</span>
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
                        setNow(new Date())
                      }}
                    >
                      Mở khoá
                    </button>
                  </span>
                )}
              </>
            )}
          </div>

          <Step n="1" title="1a. Quan sát · Lịch cố định & cam kết" hint="Làm trước: biết quỹ thời gian mới chọn được việc khả thi (chữ A)." open done={done[0]}>
            <Schedule date={date} periodId={pid} entries={entries} items={items} reloadSeries={series.reload} editable={editable} />
            <label className="li">
              <input type="checkbox" checked={p.no_fixed_schedule} disabled={!editable} onChange={() => patch({ no_fixed_schedule: !p.no_fixed_schedule })} />
              Ngày này không có lịch cố định
            </label>
          </Step>

          <Step n="2" title="1b. Quan sát · Vấn đề, nỗi đau, tồn đọng, cơ hội" hint="Mỗi ý trả lời: Nếu không làm thì sao?" open={open(1)} done={done[1]} lockedMsg="Ghi lịch cố định (hoặc tick 'không có lịch cố định') trước.">
            {editable && <CarryOver prev={carry} onKeep={keep} onClose={close} label="hôm qua" />}
            <Observe periodId={pid} obs={obs} editable={editable} />
          </Step>

          <Step n="3" title="2. Phân tích" hint="Tô đậm việc đủ điều kiện (nhân duyên) giải quyết ngay trong ngày." open={open(2)} done={done[2]} lockedMsg="Ghi ít nhất 1 quan sát ở bước 2 trước.">
            <Analyze obs={obs} editable={editable} />
          </Step>

          <Step n="4" title="3. Nguyên nhân lõi" hint="Với từng việc tô đậm: gốc rễ ở Tham, Sân hay Si?" open={open(3)} done={done[3]} lockedMsg="Tô đậm ít nhất 1 việc ở bước 3 trước.">
            <RootCauses obs={obs} editable={editable} />
          </Step>

          <Step n="5" title="Tiêu điểm (O)" hint="1 câu, có số đo, kiểm đủ 6 tiêu chí." open={open(4)} done={done[4]} lockedMsg="Tìm nguyên nhân ở bước 4 trước.">
            <ObjectiveBlock level="day" o={o} patch={patchO} editable={editable} causes={causes} krCount={krs.rows.length} load={load} weekKrs={weekKrs} weekKas={weekKas} />
          </Step>

          <Step n="6–7" title="KR và KA" hint="Để O hoàn thành cần những KR nào? Mỗi KR có danh sách KA riêng." open={open(5)} done={done[5] && done[6]} lockedMsg="Viết tiêu điểm O ở bước 5 trước.">
            <KrBlocks
              periodId={pid}
              objectiveId={o.id}
              krs={krs}
              kas={kas}
              pcts={krPcts}
              editable={editable}
              canAdd={canAdd}
              addBlockedMsg={streak.locked ? `Đang khoá thêm việc: viết Bài học cho ngày ${fmtDM(streak.day!)} trước.` : ''}
            />
          </Step>

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
                    Chốt kế hoạch
                  </button>
                ) : (
                  <span className="addrow">
                    <input value={lockReason} onChange={(e) => setLockReason(e.target.value)} placeholder="Chốt dù chưa đủ tiêu chí? Ghi lý do" aria-label="Lý do chốt khi chưa đủ tiêu chí" />
                    <button className="btn" disabled={!lockReason.trim()} onClick={() => patch({ status: 'locked', locked_at: new Date().toISOString(), lock_reason: lockReason.trim() })}>
                      Chốt bỏ qua
                    </button>
                  </span>
                )}
              </div>
            )}
            {!editable && p.lock_reason && <p className="note">Đã chốt khi chưa đủ tiêu chí. Lý do: {p.lock_reason}</p>}
          </section>
        </div>
      ) : date <= t0 ? (
        <div className="stack">
          <OkrSummary o={o} krs={krs.rows} kas={kas.rows} pcts={krPcts} />
          <Kaizen
            level="day"
            p={p}
            save={patchKaizen}
            o={o}
            patchO={patchO}
            exec={exec}
            actual={actual}
            acts={acts}
            prefill={() => [
              ...entries.filter((e) => e.title.trim()).map((e) => ({ time: e.time_from ?? '', did: e.title })),
              ...kas.rows.filter((a) => a.done).map((a) => ({ time: '', did: 'KA: ' + a.title })),
            ]}
          />
        </div>
      ) : (
        <p className="empty">Kaizen ngày {fmtDM(date)} mở vào cuối ngày đó.</p>
      )}
    </>
  )
}
