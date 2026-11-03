import { useCallback, useEffect, useState } from 'react'
import { CarriedBlock, FocusBlock, KaizenBlock } from '../components/Blocks'
import { Badge, PaceBar, Sec, Txt, toNum } from '../components/ui'
import { useApp, usePeriod } from '../lib/ctx'
import { errMsg, getPeriod, insert, krActuals, listGoals, listKrs, listPeriods, listTasks, remove, update } from '../lib/db'
import { addDays, fmtDM, mondayOf, today } from '../lib/dates'
import { dayPct, dayStatus, expectedFraction, fmtNum, planLocked, redStreakLock } from '../lib/pace'
import type { Goal, KR, Task } from '../lib/types'
import { PeriodNav } from './PeriodNav'

const MAX_LINKED = 3

export default function Day({ date, setDate, mode }: { date: string; setDate: (d: string) => void; mode: 'today' | 'plan' }) {
  const { uid, settings, toast, go } = useApp()
  const { p, patch, patchObserve, patchKaizen } = usePeriod('day', date)
  const [goals, setGoals] = useState<Goal[]>([])
  const [weekKrs, setWeekKrs] = useState<KR[]>([])
  const [actuals, setActuals] = useState(new Map<string, number>())
  const [tasks, setTasks] = useState<Task[]>([])
  const [red, setRed] = useState<{ locked: boolean; day?: string }>({ locked: false })
  const [now, setNow] = useState(() => new Date())
  const [unlocking, setUnlocking] = useState(false)
  const [reason, setReason] = useState('')
  const [f, setF] = useState({ kr: '', title: '', target: '', unit: '' })

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    if (!p) return
    try {
      const wp = await getPeriod(uid, 'week', mondayOf(date))
      const [g, wk, ts] = await Promise.all([listGoals(), listKrs([wp.id]), listTasks([p.id])])
      setGoals(g)
      setWeekKrs(wk)
      setTasks(ts)
      setActuals(await krActuals(wk))
      // R8: chuỗi ngày đỏ trước hôm nay
      const t0 = today()
      if (date >= t0) {
        const dps = await listPeriods('day', addDays(t0, -45), addDays(t0, -1))
        const dts = await listTasks(dps.map((d) => d.id))
        setRed(redStreakLock(t0, dps.map((d) => ({ date: d.start_date, period: d, tasks: dts.filter((x) => x.period_id === d.id) })), settings))
      } else setRed({ locked: false })
    } catch (e) {
      toast(errMsg(e))
    }
  }, [p, uid, date, settings, toast])
  useEffect(() => {
    load()
  }, [load])

  if (!p) return <p className="note">Đang mở ngày…</p>

  const t0 = today()
  const isPast = date <= t0
  const lock = planLocked(p, settings.lock_time, now)
  const editable = !lock.locked
  const linked = tasks.filter((t) => t.kr_id)
  const canAdd = editable && !red.locked
  const pct = dayPct(tasks)
  const st = isPast ? dayStatus(p, tasks, settings) : 'none'
  const krLabel = (id: string | null) => {
    const k = weekKrs.find((x) => x.id === id)
    if (!k) return 'Ngoài mục tiêu'
    const g = goals.find((x) => x.id === k.goal_id)
    return `${k.title}${g ? ' · ' + g.title : ''}`
  }

  async function saveTask(t: Task, part: Partial<Task>) {
    try {
      const u = await update<Task>('tasks', t.id, part)
      setTasks((xs) => xs.map((x) => (x.id === t.id ? u : x)))
      if ('actual' in part) setActuals(await krActuals(weekKrs))
    } catch (e) {
      toast(errMsg(e))
    }
  }
  async function addTask() {
    const target = toNum(f.target)
    if (!f.title.trim() || !target || target <= 0 || !f.unit.trim()) return
    try {
      const t = await insert<Task>('tasks', { period_id: p!.id, kr_id: f.kr || null, title: f.title.trim(), target, unit: f.unit.trim(), sort: tasks.length })
      setTasks((xs) => [...xs, t])
      setF({ ...f, title: '', target: '' })
    } catch (e) {
      toast(errMsg(e))
    }
  }
  async function checkIn() {
    const missing = linked.filter((t) => t.actual === null)
    if (missing.length) return toast(`Nhập số thực tế cho: ${missing.map((t) => t.title).join(', ')}`)
    await patch({ checked_in_at: new Date().toISOString() })
  }
  const lockLabel = `${settings.lock_time.slice(0, 5)} ngày ${fmtDM(addDays(date, -1))}`

  return (
    <>
      <PeriodNav
        kind="day"
        start={date}
        onShift={(n) => setDate(addDays(date, n))}
        extra={
          <span className="period-tag">
            {mode === 'plan' ? 'Lập kế hoạch' : date === t0 ? 'Hôm nay' : ''} {isPast && <Badge st={st} />}
          </span>
        }
      />

      {red.locked && (
        <div className="redlock">
          <b>Đã đỏ {settings.red_streak} ngày liền.</b> Không thêm được việc mới cho đến khi viết Bài học cho ngày {fmtDM(red.day!)}.{' '}
          <button className="btn" onClick={() => go('day', red.day)}>
            Viết Kaizen ngày {fmtDM(red.day!)}
          </button>
        </div>
      )}

      <div className="lockbar">
        {editable ? (
          <>
            <span>
              Kế hoạch mở. Tự khoá lúc <b>{lockLabel}</b>.
            </span>
            {!isPast && (
              <button className="btn" onClick={() => patch({ locked_at: new Date().toISOString() })}>
                Chốt kế hoạch ngay
              </button>
            )}
          </>
        ) : (
          <>
            <span>🔒 Kế hoạch đã chốt. Vẫn nhập được số thực tế.</span>
            {!unlocking && (
              <button className="btn ghost" onClick={() => setUnlocking(true)}>
                Mở khoá để sửa
              </button>
            )}
            {unlocking && (
              <span className="unlock">
                <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vì sao phải sửa kế hoạch đã chốt?" aria-label="Lý do mở khoá" />
                <button
                  className="btn"
                  disabled={!reason.trim()}
                  onClick={async () => {
                    await patchObserve({ unlocks: [...(p.observe.unlocks ?? []), { at: new Date().toISOString(), reason: reason.trim() }] })
                    setReason('')
                    setUnlocking(false)
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

      <div className="panes">
        <div className="pane">
          <div className="pane-h">OKRs ngày</div>
          <CarriedBlock p={p} />
          <FocusBlock p={p} patch={patch} pct={isPast ? pct : null} disabled={!editable}>
            <div className="tasks">
              <div className="fld-l">
                Việc bắt buộc · {linked.length}/{MAX_LINKED} việc gắn mục tiêu
              </div>
              {!tasks.length && <p className="empty">Chưa có việc. Mỗi việc phải gắn vào một KR tuần và có con số.</p>}
              {tasks.map((t) => {
                const done = t.actual !== null && t.actual >= t.target
                return (
                  <div key={t.id} className={'task ' + (t.kr_id ? '' : 'out ') + (done ? 'done' : '')}>
                    <div className="task-kr">{krLabel(t.kr_id)}</div>
                    <div className="task-r">
                      <Txt className="strong" value={t.title} onSave={(v) => v.trim() && saveTask(t, { title: v.trim() })} disabled={!editable} label="Việc" />
                      <span className="task-n">
                        <Txt
                          className="num"
                          type="number"
                          value={t.actual === null ? '' : String(t.actual)}
                          onSave={(v) => saveTask(t, { actual: toNum(v) })}
                          disabled={!isPast}
                          placeholder="0"
                          label="Số thực tế"
                        />
                        <span>/</span>
                        <Txt className="num" type="number" value={String(t.target)} onSave={(v) => (toNum(v) ?? 0) > 0 && saveTask(t, { target: toNum(v)! })} disabled={!editable} label="Con số đặt ra" />
                        <span className="unit">{t.unit}</span>
                      </span>
                      {editable && (
                        <button
                          className="x"
                          aria-label="Xoá việc"
                          onClick={async () => {
                            try {
                              await remove('tasks', t.id)
                              setTasks((xs) => xs.filter((x) => x.id !== t.id))
                            } catch (e) {
                              toast(errMsg(e))
                            }
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {canAdd && (
                <div className="addrow task-add">
                  <select
                    value={f.kr}
                    onChange={(e) => setF({ ...f, kr: e.target.value, unit: weekKrs.find((k) => k.id === e.target.value)?.unit ?? f.unit })}
                    aria-label="Gắn vào KR tuần"
                  >
                    <option value="">Ngoài mục tiêu (không tính %)</option>
                    {weekKrs.map((k) => (
                      <option key={k.id} value={k.id} disabled={linked.length >= MAX_LINKED}>
                        {krLabel(k.id)}
                      </option>
                    ))}
                  </select>
                  <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Việc cụ thể" aria-label="Việc mới" />
                  <input className="num" inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="Số" aria-label="Con số" />
                  <input className="short" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="Đơn vị" aria-label="Đơn vị" />
                  <button className="btn" onClick={addTask} disabled={!f.title.trim() || !((toNum(f.target) ?? 0) > 0) || !f.unit.trim()}>
                    Thêm
                  </button>
                </div>
              )}
              {!weekKrs.length && (
                <p className="flag">
                  Tuần này chưa có KR.{' '}
                  <button className="linkbtn" onClick={() => go('week', date)}>
                    Đặt KR tuần
                  </button>{' '}
                  để gắn việc vào mục tiêu.
                </p>
              )}
            </div>
            {isPast && (
              <div className="checkin">
                {p.checked_in_at ? (
                  <span>
                    ✓ Đã check-in lúc {new Date(p.checked_in_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · hoàn thành <b>{pct ?? 0}%</b>
                  </span>
                ) : (
                  <button className="btn primary" onClick={checkIn}>
                    Check-in cuối ngày
                  </button>
                )}
              </div>
            )}
          </FocusBlock>

          {mode === 'today' && weekKrs.length > 0 && (
            <Sec title="Tiến độ KR tuần này" hint="Vạch đứng = mức cần đạt đến hết hôm qua">
              {weekKrs.map((k) => (
                <PaceBar
                  key={k.id}
                  label={krLabel(k.id)}
                  actual={actuals.get(k.id) ?? 0}
                  target={k.target}
                  frac={expectedFraction(mondayOf(date), addDays(mondayOf(date), 6), t0, settings.rest_weekdays)}
                  unit={k.unit}
                />
              ))}
            </Sec>
          )}
        </div>

        <div className="pane">
          <div className="pane-h">Kaizen ngày</div>
          {isPast ? (
            <KaizenBlock
              p={p}
              save={patchKaizen}
              measure={
                <div className="measure">
                  <div className="t">{p.focus_title || 'Chưa đặt tiêu điểm ngày'}</div>
                  <b className="big">{p.checked_in_at ? `${pct ?? 0}%` : '–'}</b>
                  {linked.map((t) => (
                    <div key={t.id} className="mline">
                      {t.title}: {fmtNum(t.actual ?? 0)}/{fmtNum(t.target)} {t.unit}
                    </div>
                  ))}
                </div>
              }
            />
          ) : (
            <p className="empty">Kaizen mở khi đến ngày {fmtDM(date)}.</p>
          )}
        </div>
      </div>
    </>
  )
}
