import { useEffect, useState } from 'react'
import { StatusPill } from '../components/long/NumericKr'
import { PctPill } from '../components/ui'
import { useApp } from '../lib/ctx'
import { errMsg, findPeriods, listAll, listIn, objectivesOf } from '../lib/db'
import { addDays, DOW, fmtDM, isoDow, mondayOf, monthStart, today } from '../lib/dates'
import { AREA_NAME, loadLongSummary, longStart, type LongSum } from '../lib/long'
import { dayScore, execPercent, focusLevel, krPercent, oActualPercent } from '../lib/okr'
import { funnelPace, quarterTriggered, reviewMissed, reviewWindow, statusColor } from '../lib/numeric'
import type { IncomeModel, KA, KR, PlanChange, Period } from '../lib/types'

interface Warn {
  level: 'red' | 'yellow'
  text: string
  go?: [string, string?]
}

/** Tổng quan (§14.1): tình trạng Năm/Quý/Tháng, bảng từng KR, % ngày/tuần, cảnh báo. */
export default function Dashboard() {
  const { settings: s, toast, go } = useApp()
  const t0 = today()
  const [sums, setSums] = useState<LongSum[]>([])
  const [days, setDays] = useState<{ date: string; score: number | null; title: string }[]>([])
  const [week, setWeek] = useState<{ title: string; pct: number | null; focus: number } | null>(null)
  const [warns, setWarns] = useState<Warn[]>([])
  const [lowered, setLowered] = useState(0)

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const [y, q, m] = await Promise.all([loadLongSummary('year', t0, t0, s), loadLongSummary('quarter', t0, t0, s), loadLongSummary('month', t0, t0, s)])
        const exec = (ks: KR[], as: KA[]) => execPercent(ks.map((k) => ({ pct: krPercent(k, as.filter((a) => a.kr_id === k.id), s.weights_enabled), weight: k.weight })), s.weights_enabled)

        // 14 ngày gần nhất
        const from = addDays(t0, -13)
        const dps = await findPeriods('day', from, t0)
        const [dos, dks] = await Promise.all([objectivesOf(dps.map((x) => x.id)), listIn<KR>('key_results', 'period_id', dps.map((x) => x.id))])
        const das = await listIn<KA>('key_actions', 'kr_id', dks.map((x) => x.id))
        const dl = Array.from({ length: 14 }, (_, i) => addDays(from, i)).map((d) => {
          const p = dps.find((x) => x.start_date === d)
          const o = dos.find((x) => x.period_id === p?.id && !x.area)
          return { date: d, title: o?.title ?? '', score: o?.title.trim() ? dayScore(p ? exec(dks.filter((k) => k.period_id === p.id), das) : null, oActualPercent(o)) : null }
        })

        // Tuần này
        const ws = mondayOf(t0)
        const [wp] = await findPeriods('week', ws, ws)
        let wk: typeof week = null
        if (wp) {
          const [wos, wks] = await Promise.all([objectivesOf([wp.id]), listIn<KR>('key_results', 'period_id', [wp.id])])
          const was = await listIn<KA>('key_actions', 'kr_id', wks.map((x) => x.id))
          const wo = wos.find((x) => !x.area)
          const wdays = dos.filter((o) => dps.some((p) => p.id === o.period_id && p.start_date >= ws))
          wk = { title: wo?.title ?? '', pct: wo ? dayScore(exec(wks, was), oActualPercent(wo)) : null, focus: focusLevel(wdays, wks.map((k) => k.id), was.map((a) => a.id)) }
        }

        // Cảnh báo
        const w: Warn[] = []
        for (const o of m.objs)
          for (const x of o.krs) {
            if (x.st.triggered && m.period?.kaizen?.decisions?.[x.kr.id]?.week !== ws) w.push({ level: 'red', text: `Luật kích hoạt: "${x.kr.title}" trễ >${s.trigger_lag_pct}% ${s.trigger_weeks} tuần liên tiếp. Chọn quyết định ngay tuần này.`, go: ['month', t0] })
          }
        for (const o of q.objs) for (const x of o.krs) if (quarterTriggered(x.st.status, s.trigger_quarter_pct)) w.push({ level: 'red', text: `KR quý "${x.kr.title}" trễ >${s.trigger_quarter_pct}%: mở chẩn đoán đầy đủ.`, go: ['quarter', t0] })
        const models = await listAll<IncomeModel>('income_models')
        for (const mo of models) {
          const pace = funnelPace(mo)
          if (pace.overCapacity) w.push({ level: 'red', text: `Mô hình "${mo.name}": nhịp độ vượt công suất cá nhân. Cần KR đội ngũ tự vận hành / đòn bẩy.`, go: ['income'] })
          const unk = Object.entries(mo.unknown ?? {}).filter(([, v]) => v).length
          if (unk) w.push({ level: 'yellow', text: `Mô hình "${mo.name}" còn ${unk} hệ số "chưa đo": nhịp độ chỉ là ước lượng. Nên có KR đo hệ số.`, go: ['income'] })
        }
        // Buổi rà tháng/quý trước bị bỏ
        for (const [kind, start] of [
          ['month', monthStart(addDays(monthStart(t0), -1))],
          ['quarter', longStart('quarter', addDays(longStart('quarter', t0), -1))],
        ] as const) {
          const [pp] = await findPeriods(kind, start, start)
          if (!pp) continue
          const krs = await listIn<KR>('key_results', 'period_id', [pp.id])
          const done = krs.every((k) => pp.kaizen?.decisions?.[k.id])
          if (reviewMissed(reviewWindow(kind, start), t0, done) && !pp.kaizen?.skip_reason?.trim()) w.push({ level: 'yellow', text: `Bỏ buổi rà ${kind === 'month' ? 'tháng' : 'quý'} ${fmtDM(start)}: làm Kaizen số liệu hoặc ghi lý do.`, go: [kind, start] })
        }
        if (wk && wk.focus < 4) w.push({ level: 'yellow', text: `Mức tập trung tuần này: ${wk.focus}/7 ngày phục vụ O tuần (thông tin).`, go: ['week', t0] })
        if (!m.period) w.push({ level: 'yellow', text: 'Tháng này chưa lập OKR tháng.', go: ['month', t0] })

        const allKr = [...y.objs, ...q.objs, ...m.objs].flatMap((o) => o.krs.map((x) => x.kr.id))
        const ch = await listIn<PlanChange>('plan_changes', 'kr_id', allKr, 'created_at')
        const low = ch.filter((c) => (c.type === 'lower' || c.type === 'cut') && c.status === 'applied').length

        if (!live) return
        setSums([y, q, m].filter((x) => x.period))
        setDays(dl)
        setWeek(wk)
        setWarns(w)
        setLowered(low)
      } catch (e) {
        toast(errMsg(e))
      }
    })()
    return () => {
      live = false
    }
  }, [t0, s, toast])

  const todayRow = days.find((d) => d.date === t0)
  const label = { year: 'Năm', quarter: 'Quý', month: 'Tháng', kickoff: 'Khởi động' } as Record<string, string>

  return (
    <div className="stack">
      <h1>Tổng quan</h1>
      {warns.length > 0 && (
        <section className="sec">
          <h3>Cảnh báo</h3>
          {warns.map((w, i) => (
            <div key={i} className={'alert ' + w.level}>
              {w.text}
              {w.go && (
                <button className="btn" onClick={() => go(w.go![0], w.go![1])}>
                  Mở
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      <div className="upper">
        <button className="up" onClick={() => go('day', t0)}>
          <small>Hôm nay</small>
          <span className="up-t">{todayRow?.title || <em>Chưa lập O</em>}</span>
          <b>{todayRow?.score ?? '–'}%</b>
        </button>
        <button className="up" onClick={() => go('week', t0)}>
          <small>Tuần này</small>
          <span className="up-t">{week?.title || <em>Chưa lập O tuần</em>}</span>
          <b>{week?.pct ?? '–'}%</b>
          {week && <span className="up-n">Tập trung {week.focus}/7</span>}
        </button>
        <div className="up">
          <small>Đã hạ mục tiêu</small>
          <span className="up-t">năm · quý · tháng hiện tại</span>
          <b>{lowered} lần</b>
        </div>
      </div>

      {sums.map((sm) => (
        <section key={sm.kind} className="sec">
          <h3>
            {label[sm.kind]} {fmtDM(sm.start)} – {fmtDM(sm.end)}
            <button className="linkbtn" onClick={() => go(sm.kind, sm.start)}>
              Mở
            </button>
          </h3>
          <div className="tbl">
            <table className="ktable">
              <thead>
                <tr>
                  <th>O</th>
                  <th>KR</th>
                  <th>Thực tế / Đích</th>
                  <th>% KR</th>
                  <th>Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {sm.objs.flatMap((o) =>
                  (o.krs.length ? o.krs : [null]).map((x, i) => (
                    <tr key={o.o.id + (x?.kr.id ?? 'none')}>
                      <td>{i === 0 ? `${AREA_NAME[o.o.area!]}: ${o.o.title || '–'}` : ''}</td>
                      <td>{x?.kr.title ?? <em>Chưa có KR</em>}</td>
                      <td className="n">{x ? `${x.st.actual ?? '–'} / ${x.kr.target ?? '–'} ${x.kr.unit ?? ''}` : ''}</td>
                      <td>{x && <PctPill pct={x.st.pct} />}</td>
                      <td>{x && <StatusPill v={x.st.status} color={statusColor(x.st.status, s)} />}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {!sums.length && <p className="empty">Chưa có OKR Năm / Quý / Tháng. Bắt đầu từ Tầm nhìn → Kỳ khởi động hoặc Năm.</p>}

      <section className="sec">
        <h3>14 ngày gần nhất</h3>
        <div className="bars">
          {days.map((d) => (
            <div key={d.date} className={'b ' + (d.score === null ? 'none' : d.score < s.red_below ? 'red' : d.score < s.pass_pct ? 'yellow' : 'green')} title={d.title}>
              <b>{d.score === null ? '–' : d.score}</b>
              <i style={{ height: (d.score ?? 0) * 0.7 + '%' }} />
              <span>
                {DOW[isoDow(d.date)]}
                <br />
                {d.date.slice(8)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export type { Period }
