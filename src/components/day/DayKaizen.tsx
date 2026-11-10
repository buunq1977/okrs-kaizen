import { useEffect, useState } from 'react'
import { AffPulse } from '../aff/AffOkr'
import { Kaizen, OkrSummary } from './Kaizen'
import { useApp, useMainObjective, usePeriod, useRows } from '../../lib/ctx'
import { errMsg, eventsBetween, findPeriods, listBy, listIn, objectivesOf, seriesActiveOn } from '../../lib/db'
import { fmtDM, fmtDMY, today } from '../../lib/dates'
import { execPercent, kaizenConfirm, kaizenDeadline, kaizenReady, krPercent, oActualPercent } from '../../lib/okr'
import { eventEntries, mergeSchedule } from '../../lib/schedule'
import type { EventItem, KA, KaizenData, KR, NextAction, Objective, Period, ScheduleItem, ScheduleSeries } from '../../lib/types'

const hm = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${fmtDM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)}`
}

/** Nút "Xác nhận" Kaizen ngày: cần nhật ký/đánh giá + ít nhất 1 bài học. Đúng hạn nếu trước giờ chốt Kaizen (22:00). */
export function ConfirmBar({ date, k, save }: { date: string; k: KaizenData; save: (p: Partial<KaizenData>) => void }) {
  const { settings: s } = useApp()
  const st = kaizenConfirm(date, k, s)
  const ready = kaizenReady(k)
  const due = kaizenDeadline(date, s)
  const late = new Date() > due
  return (
    <section className={'confirmbar ' + (st === 'ontime' ? 'ok' : st === 'late' ? 'late' : '')}>
      {st !== 'none' ? (
        <span>
          ✓ Đã xác nhận Kaizen ngày {fmtDMY(date)} lúc <b>{hm(k.confirmed_at!)}</b>
          {st === 'late' ? ` (trễ hạn ${s.lock_time.slice(0, 5)})` : ''}. Đã hoàn thành và đã ghi lại.
        </span>
      ) : (
        <span>
          {ready ? 'Kaizen đã đủ nội dung.' : 'Cần ghi nhật ký (hoặc đánh giá) và ít nhất 1 bài học trước khi xác nhận.'} Hạn chốt: <b>{s.lock_time.slice(0, 5)} ngày {fmtDMY(date)}</b>
          {late ? ' (đã quá hạn)' : ''}.
        </span>
      )}
      <button className={'btn ' + (st === 'none' ? 'primary' : 'ghost')} disabled={!ready} onClick={() => save({ confirmed_at: new Date().toISOString() })}>
        {st === 'none' ? 'Xác nhận' : 'Xác nhận lại'}
      </button>
    </section>
  )
}

/** Tab Kaizen của một ngày bất kỳ (dùng cho "Kaizen ngày hôm trước"). */
export function DayKaizenPane({ date }: { date: string }) {
  const { settings: s } = useApp()
  const { p, patchKaizen } = usePeriod('day', date)
  const pid = p?.id ?? ''
  const { o, patch: patchO } = useMainObjective(pid)
  const none = <T,>() => Promise.resolve([] as T[])
  const items = useRows<ScheduleItem>('schedule_items', pid, () => (pid ? listBy('schedule_items', 'period_id', pid, 'created_at') : none()))
  const series = useRows<ScheduleSeries>('schedule_series', date, () => seriesActiveOn(date))
  const krs = useRows<KR>('key_results', pid, () => (pid ? listBy('key_results', 'period_id', pid) : none()))
  const krIds = krs.rows.map((k) => k.id).join(',')
  const kas = useRows<KA>('key_actions', krIds, () => (krIds ? listIn('key_actions', 'kr_id', krIds.split(',')) : none()))
  const acts = useRows<NextAction>('next_actions', pid, () => (pid ? listBy('next_actions', 'period_id', pid) : none()))
  const [events, setEvents] = useState<EventItem[]>([])
  useEffect(() => {
    eventsBetween(date, date).then(setEvents).catch(() => setEvents([]))
  }, [date])

  if (date > today()) return <p className="empty">Kaizen ngày {fmtDMY(date)} mở vào cuối ngày đó.</p>
  if (!p || !o) return <p className="note">Đang mở Kaizen ngày {fmtDMY(date)}…</p>
  const entries = [...mergeSchedule(series.rows, items.rows, date), ...eventEntries(events, date)]
  const pcts = krs.rows.map((k) => krPercent(k, kas.rows.filter((a) => a.kr_id === k.id), s.weights_enabled))
  const exec = execPercent(krs.rows.map((k, i) => ({ pct: pcts[i], weight: k.weight })), s.weights_enabled)
  return (
    <div className="stack">
      <OkrSummary o={o} krs={krs.rows} kas={kas.rows} pcts={pcts} />
      <Kaizen
        level="day"
        p={p}
        save={patchKaizen}
        o={o}
        patchO={patchO}
        exec={exec}
        actual={oActualPercent(o)}
        acts={acts}
        extraMeasure={<AffPulse level="day" start={date} end={date} />}
        prefill={() => [
          ...entries.filter((e) => e.title.trim()).map((e) => ({ time: e.time_from ?? '', did: e.title })),
          ...kas.rows.filter((a) => a.done).map((a) => ({ time: '', did: 'KA: ' + a.title })),
        ]}
      />
      <ConfirmBar date={date} k={p.kaizen ?? {}} save={patchKaizen} />
    </div>
  )
}

/* ---------- Xem nhanh tab khác (chỉ đọc) ---------- */
interface Brief {
  p: Period | null
  o: Objective | null
  krs: KR[]
  kas: KA[]
  acts: NextAction[]
}
export function DayPeek({ date, kind, onClose, onOpen }: { date: string; kind: 'okr' | 'kaizen'; onClose: () => void; onOpen: () => void }) {
  const { settings: s, toast } = useApp()
  const [b, setB] = useState<Brief | null>(null)
  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const [p] = await findPeriods('day', date, date)
        if (!p) return live && setB({ p: null, o: null, krs: [], kas: [], acts: [] })
        const [os, krs, acts] = await Promise.all([objectivesOf([p.id]), listBy<KR>('key_results', 'period_id', p.id), listBy<NextAction>('next_actions', 'period_id', p.id)])
        const kas = await listIn<KA>('key_actions', 'kr_id', krs.map((k) => k.id))
        if (live) setB({ p, o: os.find((x) => !x.area) ?? null, krs, kas, acts })
      } catch (e) {
        toast(errMsg(e))
      }
    })()
    return () => {
      live = false
    }
  }, [date, toast])
  const k = b?.p?.kaizen ?? {}
  const st = kaizenConfirm(date, k, s)
  return (
    <aside className="peek" role="dialog" aria-label={`Xem nhanh ${kind === 'okr' ? 'OKR' : 'Kaizen'} ngày ${fmtDMY(date)}`}>
      <div className="peek-h">
        <b>
          {kind === 'okr' ? 'OKR' : 'Kaizen'} ngày {fmtDMY(date)}
        </b>
        <button className="btn mini" onClick={onOpen}>
          Mở tab
        </button>
        <button className="x" aria-label="Đóng" onClick={onClose}>
          ×
        </button>
      </div>
      {!b ? (
        <p className="note">Đang tải…</p>
      ) : !b.p ? (
        <p className="note">Chưa có dữ liệu ngày này.</p>
      ) : kind === 'okr' ? (
        <div className="peek-b">
          <p>
            <small>O</small> <b>{b.o?.title || 'Chưa đặt tiêu điểm'}</b>
          </p>
          {b.krs.map((kr) => (
            <div key={kr.id}>
              <b>{kr.title || 'KR chưa đặt tên'}</b>
              <ul>
                {b.kas
                  .filter((a) => a.kr_id === kr.id)
                  .map((a) => (
                    <li key={a.id} className={a.done ? 'done' : ''}>
                      {a.done ? '☑' : '☐'} {a.title}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
          {!b.krs.length && <p className="note">Chưa có KR.</p>}
        </div>
      ) : (
        <div className="peek-b">
          <p className="note">{st === 'none' ? 'Chưa xác nhận' : `✓ Đã xác nhận${st === 'late' ? ' (trễ hạn)' : ''}`}</p>
          {k.assessment?.trim() && (
            <p>
              <small>Đánh giá</small> {k.assessment}
            </p>
          )}
          {k.causes?.trim() && (
            <p>
              <small>Nguyên nhân</small> {k.causes}
            </p>
          )}
          {(k.lessons ?? []).filter((l) => l.text.trim()).length > 0 && (
            <>
              <small>Bài học</small>
              <ul>
                {(k.lessons ?? [])
                  .filter((l) => l.text.trim())
                  .map((l, i) => (
                    <li key={i}>{l.text}</li>
                  ))}
              </ul>
            </>
          )}
          {b.acts.length > 0 && (
            <>
              <small>Hành động tiếp theo</small>
              <ul>
                {b.acts.map((a) => (
                  <li key={a.id}>{a.text}</li>
                ))}
              </ul>
            </>
          )}
          {!k.assessment?.trim() && !(k.lessons ?? []).some((l) => l.text.trim()) && !b.acts.length && <p className="note">Chưa ghi Kaizen.</p>}
        </div>
      )}
    </aside>
  )
}
