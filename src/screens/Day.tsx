import { useEffect, useState } from 'react'
import { Kaizen } from '../components/day/Kaizen'
import { KrBlocks, Objective } from '../components/day/Okr'
import { Analyze, Observe, RootCauses } from '../components/day/Observe'
import { Schedule } from '../components/day/Schedule'
import { FocusBand, Step } from '../components/ui'
import { useApp, usePeriod, useRows } from '../lib/ctx'
import { errMsg, findPeriods, listBy, listIn } from '../lib/db'
import { addDays, fmtDM, mondayOf, today } from '../lib/dates'
import { dayLinkCheck, effectiveLock, hasLessons, kaizenStarted, krPercent, lockCheck, redStreak, rollup, type DayRecord } from '../lib/okr'
import type { KA, KR, NextAction, Observation, Period, ScheduleItem } from '../lib/types'
import { PeriodNav } from './PeriodNav'

export default function Day({ date, setDate, mode }: { date: string; setDate: (d: string) => void; mode: 'today' | 'plan' }) {
  const { settings: s, toast, go } = useApp()
  const { p, patch, patchKaizen } = usePeriod('day', date)
  const pid = p?.id ?? ''
  const none = <T,>() => Promise.resolve([] as T[])
  const sched = useRows<ScheduleItem>('schedule_items', pid, () => (pid ? listBy('schedule_items', 'period_id', pid, 'time_from') : none()))
  const obs = useRows<Observation>('observations', pid, () => (pid ? listBy('observations', 'period_id', pid) : none()))
  const krs = useRows<KR>('key_results', pid, () => (pid ? listBy('key_results', 'period_id', pid) : none()))
  const krIds = krs.rows.map((k) => k.id).join(',')
  const kas = useRows<KA>('key_actions', krIds, () => (krIds ? listIn('key_actions', 'kr_id', krIds.split(',')) : none()))
  const acts = useRows<NextAction>('next_actions', pid, () => (pid ? listBy('next_actions', 'period_id', pid) : none()))

  const [now, setNow] = useState(() => new Date())
  const [weekTitle, setWeekTitle] = useState('')
  const [streak, setStreak] = useState<{ locked: boolean; day?: string }>({ locked: false })
  const [todayKaizenDone, setTodayKaizenDone] = useState(true)
  const [lockReason, setLockReason] = useState('')
  const [unlockReason, setUnlockReason] = useState('')
  const [showUnlock, setShowUnlock] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // O tuần (để đánh dấu liên quan), chuỗi ngày đỏ, Kaizen hôm nay (khi lập kế hoạch ngày mai)
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const w = await findPeriods('week', mondayOf(date), mondayOf(date))
        if (live) setWeekTitle(w[0]?.o_title ?? '')
        const t0 = today()
        if (date < t0) return live && setStreak({ locked: false })
        const past = await findPeriods('day', addDays(t0, -45), date === t0 ? addDays(t0, -1) : t0)
        const pk = await listIn<KR>('key_results', 'period_id', past.map((x) => x.id))
        const pa = await listIn<KA>('key_actions', 'kr_id', pk.map((x) => x.id))
        const recs: DayRecord[] = past
          .filter((x) => x.start_date < t0)
          .map((d) => {
            const ks = pk.filter((k) => k.period_id === d.id)
            const r = rollup(ks.map((k) => ({ pct: krPercent(k, pa.filter((a) => a.kr_id === k.id), s.weights_enabled), linked: k.linked, weight: k.weight })), s)
            return { date: d.start_date, hasO: !!d.o_title.trim(), pct: r.main, lessons: hasLessons(d.kaizen) }
          })
        if (!live) return
        setStreak(redStreak(t0, recs, s))
        if (date > t0) setTodayKaizenDone(kaizenStarted(past.find((x: Period) => x.start_date === t0)?.kaizen))
      } catch (e) {
        toast(errMsg(e))
      }
    })()
    return () => {
      live = false
    }
  }, [date, s, toast])

  if (!p) return <p className="note">Đang mở ngày…</p>

  const t0 = today()
  const lock = effectiveLock(p, s, now)
  const editable = !lock.locked
  const canAdd = editable && !streak.locked
  const krPcts = krs.rows.map((k) => krPercent(k, kas.rows.filter((a) => a.kr_id === k.id), s.weights_enabled))
  const pct = rollup(krs.rows.map((k, i) => ({ pct: krPcts[i], linked: k.linked, weight: k.weight })), s)
  const link = dayLinkCheck(krs.rows, s)
  const check = lockCheck('day', p, krs.rows.map((k) => ({ ...k, kas: kas.rows.filter((a) => a.kr_id === k.id).length })), s)

  // Mở bước khi bước trước đủ nội dung tối thiểu, hoặc bước đó đã có nội dung
  const sel = obs.rows.filter((o) => o.is_selected)
  const done = [
    p.no_fixed_schedule || sched.rows.some((x) => x.title.trim()),
    obs.rows.some((o) => o.content.trim()),
    sel.length > 0,
    sel.some((o) => o.tham.trim() || o.san.trim() || o.si.trim()),
    !!p.o_title.trim(),
    krs.rows.length > 0,
    kas.rows.length > 0,
  ]
  const open = (i: number) => done.slice(0, i).every(Boolean) || done[i] || (i >= 4 && (!!p.o_title.trim() || krs.rows.length > 0))
  const causes = sel.flatMap((o) => [o.tham, o.san, o.si].map((x) => x.trim()).filter(Boolean))
  const remind = s.remind_time.slice(0, 5)
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <>
      <PeriodNav kind="day" start={date} onShift={(n) => setDate(addDays(date, n))} extra={<span className="period-tag">{mode === 'plan' ? 'Lập kế hoạch' : date === t0 ? 'Hôm nay' : ''}</span>} />

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
          Chưa làm Kaizen hôm nay. Thứ tự đúng: Kaizen ngày {fmtDM(t0)} trước, rồi mới lập OKR ngày {fmtDM(date)}.{' '}
          <button className="btn" onClick={() => go('day', t0)}>
            Làm Kaizen hôm nay
          </button>
        </div>
      )}
      {mode === 'today' && date === t0 && nowHM >= remind && !kaizenStarted(p.kaizen) && (
        <div className="alert blue">
          Đã {remind}: dành 20–30 phút làm Kaizen hôm nay và lập OKR ngày mai.{' '}
          <button className="btn" onClick={() => go('plan', addDays(t0, 1))}>
            Lập OKR ngày mai
          </button>
        </div>
      )}
      {!link.ok && krs.rows.length > 0 && <div className="alert red">{link.message}</div>}
      {link.ok && link.message && <div className="alert yellow">{link.message}</div>}

      <FocusBand title={p.o_title} pct={pct} />

      <div className="panes">
        <div className="pane">
          <div className="pane-h">OKRs ngày</div>
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

          <Step n="1" title="1a. Quan sát · Lịch cố định & cam kết" hint="Làm bước này trước: biết quỹ thời gian mới chọn được việc khả thi (chữ A)." open done={done[0]}>
            <Schedule date={date} periodId={pid} sched={sched} editable={editable} />
            <label className="li">
              <input type="checkbox" checked={p.no_fixed_schedule} disabled={!editable} onChange={() => patch({ no_fixed_schedule: !p.no_fixed_schedule })} />
              Ngày này không có lịch cố định
            </label>
          </Step>

          <Step n="2" title="1b. Quan sát · Vấn đề, nỗi đau, tồn đọng, cơ hội" hint="Mỗi ý trả lời: Nếu không làm thì sao?" open={open(1)} done={done[1]} lockedMsg="Ghi lịch cố định (hoặc tick 'không có lịch cố định') trước.">
            <Observe periodId={pid} obs={obs} editable={editable} />
          </Step>

          <Step n="3" title="2. Phân tích" hint="Tô đậm việc đủ điều kiện (nhân duyên) giải quyết ngay trong ngày." open={open(2)} done={done[2]} lockedMsg="Ghi ít nhất 1 quan sát ở bước 2 trước.">
            <Analyze obs={obs} editable={editable} />
          </Step>

          <Step n="4" title="3. Nguyên nhân lỗi" hint="Với từng việc đã tô đậm: gốc rễ nằm ở Tham, Sân hay Si?" open={open(3)} done={done[3]} lockedMsg="Tô đậm ít nhất 1 việc ở bước 3 trước.">
            <RootCauses obs={obs} editable={editable} />
          </Step>

          <Step n="5" title="Tiêu điểm (O)" hint="1 câu mục tiêu, tick đủ 6 tiêu chí." open={open(4)} done={done[4]} lockedMsg="Tìm nguyên nhân ở bước 4 trước.">
            <Objective p={p} patch={patch} editable={editable} weekTitle={weekTitle} causes={causes} />
          </Step>

          <Step n="6–7" title="KR và KA" hint="Để O hoàn thành cần những KR nào? Dưới mỗi KR là các KA có ô tick." open={open(5)} done={done[5] && done[6]} lockedMsg="Viết tiêu điểm O ở bước 5 trước.">
            <KrBlocks
              periodId={pid}
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

        <div className="pane">
          <div className="pane-h">Kaizen ngày</div>
          {date <= t0 ? <Kaizen p={p} save={patchKaizen} pct={pct} acts={acts} /> : <p className="empty">Kaizen ngày {fmtDM(date)} mở vào cuối ngày đó.</p>}
        </div>
      </div>
    </>
  )
}
